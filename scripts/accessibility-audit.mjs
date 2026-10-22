import { createRequire } from "node:module";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const argumentsList = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argumentsList.indexOf(`--${name}`);
  return index < 0 ? fallback : argumentsList[index + 1];
};
const tools = option("tools", join(tmpdir(), "bits-accessibility-tools"));
const require = createRequire(join(resolve(tools), "package.json"));
const { chromium } = require("playwright");
const axePath = require.resolve("axe-core/axe.min.js");
const origin = option("url", "http://127.0.0.1:8799");
const output = resolve(option("output", join(tmpdir(), "bits-accessibility-audit")));
const profileName = option("profile", "desktop");
const windowMode = argumentsList.includes("--windows");
const runName = `${windowMode ? "windows-" : ""}${profileName}`;
const limit = Number(option("limit", "0"));
const workers = Number(option("workers", "3"));
const profiles = {
  desktop: { viewport: { width: 1440, height: 1000 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 },
  reduced: { viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" },
  forced: { viewport: { width: 1440, height: 1000 }, forcedColors: "active", contrast: "more" },
};
if (!profiles[profileName]) throw new Error(`Unknown profile: ${profileName}`);
await mkdir(output, { recursive: true });
async function summarize() {
  const summary = { profile: profileName, cases: 0, errors: [], violationCases: 0, incompleteCases: 0,
    ruleCounts: {}, groups: {}, overflow: {}, animations: {}, hiddenFocus: {}, appearanceErrors: [] };
  const recordMetric = (collection, key, result, details) => {
    const group = collection[key] ??= { cases: 0, themes: [], samples: [] };
    group.cases += 1;
    if (!group.themes.includes(result.appearance.theme)) group.themes.push(result.appearance.theme);
    if (group.samples.length < 8) group.samples.push({ appearance: result.appearance, details });
  };
  for await (const line of createInterface({ input: createReadStream(join(output, `${runName}.jsonl`)), crlfDelay: Infinity })) {
    if (!line) continue;
    const result = JSON.parse(line);
    summary.cases += 1;
    if (result.error) { summary.errors.push(result); continue; }
    if (result.violations.length) summary.violationCases += 1;
    if (result.incomplete.length) summary.incompleteCases += 1;
    if (!result.applied.supported || result.applied.theme !== result.appearance.theme || !result.applied.stylesheetLoaded) {
      summary.appearanceErrors.push({ path: result.path, appearance: result.appearance, applied: result.applied });
    }
    for (const rule of result.violations) {
      summary.ruleCounts[rule.id] = (summary.ruleCounts[rule.id] || 0) + 1;
      const key = `${result.path} :: ${rule.id}`;
      const group = summary.groups[key] ??= { path: result.path, rule: rule.id, impact: rule.impact, cases: 0, nodes: 0, appearances: [], samples: [] };
      group.cases += 1;
      group.nodes += rule.nodes.length;
      group.appearances.push(result.appearance);
      for (const node of rule.nodes) {
        if (group.samples.length < 12 && !group.samples.some(sample => JSON.stringify(sample.target) === JSON.stringify(node.target))) {
          group.samples.push({ appearance: result.appearance, ...node });
        }
      }
    }
    if (result.metrics.scrollWidth > result.metrics.width + 2) recordMetric(summary.overflow, result.path, result, { width: result.metrics.width, scrollWidth: result.metrics.scrollWidth });
    if (result.metrics.reduced && result.metrics.runningAnimations.length) recordMetric(summary.animations, result.path, result, result.metrics.runningAnimations);
    if (result.metrics.hiddenFocus.length) recordMetric(summary.hiddenFocus, result.path, result, result.metrics.hiddenFocus);
  }
  await writeFile(join(output, `summary-${runName}.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ phase: "summary", profile: profileName, cases: summary.cases, errors: summary.errors.length,
    violationCases: summary.violationCases, incompleteCases: summary.incompleteCases, rules: summary.ruleCounts,
    appearanceErrors: summary.appearanceErrors.length, overflowPages: Object.keys(summary.overflow),
    reducedAnimationPages: Object.keys(summary.animations), hiddenFocusPages: Object.keys(summary.hiddenFocus) }));
}
if (argumentsList.includes("--summarize")) {
  await summarize();
  process.exit(0);
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
const axeOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  resultTypes: ["violations", "incomplete"],
};

async function createContext() {
  const context = await browser.newContext(profiles[profileName]);
  await context.addInitScript(() => {
    localStorage.setItem("bits-theme-debug", "enabled");
    localStorage.removeItem("bits-site-choice");
    sessionStorage.setItem("bits-boot-seen-v1", "true");
  });
  await context.route(/(?:google-analytics|cloudflareinsights|challenges\.cloudflare)/, route => route.abort());
  return context;
}

async function navigate(page, path) {
  await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => document.readyState === "complete", { timeout: 15000 }).catch(() => {});
  await page.locator("#skip-boot, #boot-skip, [data-boot-skip]").first().click({ timeout: 300 }).catch(() => {});
  await page.waitForTimeout(180);
}

async function setAppearance(page, appearance) {
  return page.evaluate(async state => {
    if (!window.BITS_THEME_PREFERENCE) return { supported: false };
    const preference = window.BITS_THEME_PREFERENCE;
    localStorage.setItem("bits-color-scheme", state.scheme);
    if (state.variant) preference.setVariant(state.theme, state.variant);
    preference.select(state.theme);
    if (typeof window.applyInterfaceTheme === "function") window.applyInterfaceTheme(preference.getTheme(state.theme));
    else preference.apply(state.theme);
    const stylesheet = document.getElementById("bits-theme-stylesheet");
    if (stylesheet && !stylesheet.sheet) {
      await new Promise(resolveLoad => {
        stylesheet.addEventListener("load", resolveLoad, { once: true });
        stylesheet.addEventListener("error", resolveLoad, { once: true });
        setTimeout(resolveLoad, 4000);
      });
    }
    const theme = preference.getTheme(state.theme);
    if (theme.experimental) {
      const started = performance.now();
      while (!document.querySelector(`[data-layout-chrome="${state.theme}"]`) && performance.now() - started < 250) {
        await new Promise(resolveFrame => requestAnimationFrame(resolveFrame));
      }
    }
    await new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    if (document.documentElement.dataset.interfaceTheme !== state.theme
      || document.documentElement.dataset.colorScheme !== state.scheme
      || (state.variant && document.documentElement.dataset.themeVariant !== state.variant)
      || (stylesheet && !stylesheet.sheet)) {
      throw new Error(`Appearance did not apply: ${JSON.stringify(state)}`);
    }
    return {
      supported: true,
      theme: document.documentElement.dataset.interfaceTheme,
      variant: document.documentElement.dataset.themeVariant || null,
      scheme: document.documentElement.dataset.colorScheme,
      stylesheetLoaded: !stylesheet || Boolean(stylesheet.sheet),
      layoutChrome: document.querySelectorAll("[data-layout-chrome]").length,
    };
  }, appearance);
}

async function inspect(page) {
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
  const audit = await page.evaluate(async options => {
    const result = await axe.run(document, options);
    const compact = rule => ({
      id: rule.id, impact: rule.impact, help: rule.help, helpUrl: rule.helpUrl,
      nodes: rule.nodes.map(node => ({ target: node.target, html: node.html, summary: node.failureSummary,
        checks: [...node.any, ...node.all, ...node.none].map(check => ({ id: check.id, message: check.message, data: check.data })) })),
    });
    const visible = element => {
      const style = getComputedStyle(element);
      return element.getClientRects().length && style.visibility !== "hidden" && style.display !== "none";
    };
    const root = document.documentElement;
    const hiddenFocus = [...document.querySelectorAll('[aria-hidden="true"] a[href], [aria-hidden="true"] button, [aria-hidden="true"] input, [aria-hidden="true"] select, [aria-hidden="true"] [tabindex]')]
      .filter(element => visible(element) && element.tabIndex >= 0 && !element.disabled && !element.closest("[inert]"))
      .map(element => element.id || element.outerHTML.slice(0, 180));
    return {
      violations: result.violations.map(compact), incomplete: result.incomplete.map(compact),
      metrics: { title: document.title, lang: root.lang, width: innerWidth, scrollWidth: root.scrollWidth,
        mainCount: [...document.querySelectorAll('main,[role="main"]')].filter(visible).length,
        headings: [...document.querySelectorAll("h1")].filter(visible).map(element => element.textContent.trim()),
        hiddenFocus,
        runningAnimations: document.getAnimations().filter(animation => animation.playState === "running" && animation.effect?.getTiming().duration > 100)
          .map(animation => ({ name: animation.animationName || "scripted", target: animation.effect?.target?.id || animation.effect?.target?.className })).slice(0, 30),
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        forced: matchMedia("(forced-colors: active)").matches,
        contrast: matchMedia("(prefers-contrast: more)").matches,
        liveRegions: [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')].filter(visible).map(element => ({ id: element.id, role: element.getAttribute("role"), live: element.getAttribute("aria-live") })),
      },
    };
  }, axeOptions);
  return audit;
}

if (argumentsList.includes("--supplemental")) {
  const context = await createContext();
  const page = await context.newPage();
  const results = [];
  try {
    const cases = [
      { path: "/professional/resume/" },
      { path: "/admin/", admin: "system" },
      { path: "/admin/", admin: "dark" },
      { path: "/admin/", admin: "light" },
      { path: "/admin.html", admin: "system" },
      { path: "/index.html?choose" },
    ];
    for (const state of cases) {
      await navigate(page, "/?choose");
      if (state.admin) await page.evaluate(appearance => localStorage.setItem("bits-admin-appearance", appearance), state.admin);
      await navigate(page, state.path);
      await page.waitForFunction(() => !document.querySelector('main[aria-busy="true"]'), { timeout: 6000 }).catch(() => {});
      const audit = await inspect(page);
      const focus = [];
      for (let index = 0; index < 12; index += 1) {
        await page.keyboard.press("Tab");
        focus.push(await page.evaluate(() => {
          const element = document.activeElement;
          const rectangle = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return { tag: element.tagName, id: element.id, text: (element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 100),
            hidden: Boolean(element.closest('[hidden],[inert],[aria-hidden="true"]')), width: rectangle.width, height: rectangle.height,
            outlineStyle: style.outlineStyle, outlineColor: style.outlineColor, outlineWidth: style.outlineWidth };
        }));
      }
      results.push({ ...state, finalUrl: page.url(), ...audit, focus });
      await page.screenshot({ path: join(output, `${profileName}-${state.path.includes("resume") ? "resume" : state.admin || "chooser"}.png`), fullPage: true });
    }
    for (const path of ["/online/", "/professional/", "/boot/"]) {
      await navigate(page, path);
      await setAppearance(page, { theme: "rgb", variant: "firestorm", scheme: "dark" });
      const before = await inspect(page);
      await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active", contrast: "more" });
      await page.waitForTimeout(250);
      const after = await inspect(page);
      results.push({ path, runtimePreferences: true, before: before.metrics, after: after.metrics });
      await page.emulateMedia({ reducedMotion: profiles[profileName].reducedMotion || "no-preference",
        forcedColors: profiles[profileName].forcedColors || "none", contrast: profiles[profileName].contrast || "no-preference" });
    }
    await navigate(page, "/online/");
    await setAppearance(page, { theme: "default", scheme: "dark" });
    const windowIds = await page.locator("[data-window]").evaluateAll(elements => elements.map(element => element.id));
    for (const id of windowIds) {
      const launcher = page.locator(`[data-window-target="${id}"]:visible`).first();
      if (!await launcher.count()) { results.push({ window: id, keyboard: "No visible launcher in this viewport/state" }); continue; }
      await launcher.focus();
      await page.keyboard.press("Enter");
      const opened = await page.locator(`#${id}`).isVisible();
      const focusedAfterOpen = await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute("aria-label"));
      await page.keyboard.press("Escape");
      const closedByEscape = !await page.locator(`#${id}`).isVisible();
      if (!closedByEscape) await page.locator(`#${id} [data-window-close]`).click({ timeout: 500 }).catch(() => {});
      const restored = await launcher.evaluate(element => element === document.activeElement);
      results.push({ window: id, keyboard: { opened, focusedAfterOpen, closedByEscape, focusRestored: restored } });
    }
    await writeFile(join(output, `supplemental-${profileName}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ phase: "supplemental", profile: profileName, cases: results.length,
      violations: results.filter(result => result.violations?.length).map(result => ({ path: result.path, admin: result.admin, rules: result.violations.map(rule => rule.id) })),
      keyboard: results.filter(result => result.keyboard).map(result => ({ window: result.window, ...typeof result.keyboard === "object" ? result.keyboard : { note: result.keyboard } })) }));
  } finally {
    await context.close();
    await browser.close();
  }
  process.exit(0);
}

try {
  const discoveryContext = await createContext();
  const discovery = await discoveryContext.newPage();
  await navigate(discovery, "/?choose");
  const themes = await discovery.evaluate(() => window.BITS_INTERFACE_THEMES.map(theme => ({
    id: theme.id, experimental: Boolean(theme.experimental), seasonal: Boolean(theme.seasonal),
    variants: theme.variants?.map(variant => variant.id) || [null],
    schemes: theme.schemes || ["dark", "light"],
  })));
  await navigate(discovery, "/blog/");
  const postLinks = await discovery.locator('a[href*="post.html?slug="]').evaluateAll(links => links.map(link => new URL(link.href).pathname + new URL(link.href).search));
  let pages = ["/?choose", "/online/", "/professional/", "/blog/", "/blog/post.html", "/boot/", "/404.html", "/source.html", "/useless.html", ...new Set(postLinks)];
  let excludedWindows = [];
  if (windowMode) {
    await navigate(discovery, "/online/");
    const windows = await discovery.locator("[data-window]").evaluateAll(elements => elements.map(element => ({
      slug: element.id.replace(/-window$/, ""), desktopOnly: element.hasAttribute("data-desktop-only"),
    })));
    excludedWindows = windows.filter(entry => entry.desktopOnly && profileName === "mobile").map(entry => entry.slug);
    pages = windows.filter(entry => !excludedWindows.includes(entry.slug)).map(entry => `/online/?window=${entry.slug}`);
  }
  if (option("page", "")) pages = [option("page", "")];
  const appearances = themes.flatMap(theme => theme.variants.flatMap(variant => theme.schemes.map(scheme => ({ theme: theme.id, variant, scheme, experimental: theme.experimental }))));
  let jobs = pages.flatMap(path => appearances.map(appearance => ({ path, appearance })));
  if (limit) jobs = jobs.slice(0, limit);
  const manifest = { origin, profile: profileName, viewport: profiles[profileName], axeVersion: require("axe-core").version,
    createdAt: new Date().toISOString(), themes, pages, excludedWindows, appearances: appearances.length, cases: jobs.length,
    limitations: ["Unauthenticated admin only; no credentials or publishing actions.", "Automated audits do not constitute actual screen-reader testing.", "Cross-origin Turnstile and analytics blocked; external widgets need separate manual review."] };
  await writeFile(join(output, `manifest-${runName}.json`), JSON.stringify(manifest, null, 2));
  await discoveryContext.close();
  const resultPath = join(output, `${runName}.jsonl`);
  await writeFile(resultPath, "");
  console.log(JSON.stringify({ phase: "inventory", profile: profileName, themes: themes.length, appearances: appearances.length, pages: pages.length, cases: jobs.length, output }));
  let nextJob = 0;
  let completed = 0;
  let failures = 0;
  let lastProgress = Date.now();
  await Promise.all(Array.from({ length: workers }, async () => {
    const context = await createContext();
    const page = await context.newPage();
    let currentPath = "";
    while (nextJob < jobs.length) {
      const job = jobs[nextJob++];
      const started = Date.now();
      try {
        if (currentPath !== job.path) {
          await navigate(page, job.path);
          currentPath = job.path;
        }
        const applied = await setAppearance(page, job.appearance);
        if (windowMode) {
          const slug = new URL(job.path, origin).searchParams.get("window");
          if (!await page.locator(`#${slug}-window`).isVisible()) throw new Error(`Requested window is not visible: ${slug}`);
        }
        const audit = await inspect(page);
        await appendFile(resultPath, JSON.stringify({ ...job, applied, ...audit, duration: Date.now() - started }) + "\n");
      } catch (error) {
        failures += 1;
        currentPath = "";
        await appendFile(resultPath, JSON.stringify({ ...job, error: String(error), duration: Date.now() - started }) + "\n");
      }
      completed += 1;
      if (Date.now() - lastProgress > 30000 || completed === jobs.length) {
        console.log(JSON.stringify({ profile: profileName, completed, total: jobs.length, errors: failures }));
        lastProgress = Date.now();
      }
    }
    await context.close();
  }));
  console.log(JSON.stringify({ phase: "finished", profile: profileName, completed, failures, resultPath }));
  await summarize();
} finally {
  await browser.close();
}