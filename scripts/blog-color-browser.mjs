import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const option = name => {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`--${name} is required.`);
  return process.argv[index + 1];
};
const posts = JSON.parse(await readFile(resolve(option("posts")), "utf8"));
if (posts.length !== 2 || posts.some(post => !post.published)) throw new Error("Use exactly the two public published posts.");
const postIndex = process.argv.indexOf("--post");
const selectedPosts = postIndex < 0 ? posts : posts.filter(post => post.slug === process.argv[postIndex + 1]);
if (!selectedPosts.length) throw new Error("--post must identify one of the supplied public posts.");
const output = resolve(option("output"));
await mkdir(output, { recursive: true });
const server = await startSiteServer(resolve(option("root")));
const browser = await chromium.launch({ headless: true });

function measure() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const colors = new Map();
  function color(value) {
    if (!colors.has(value)) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const data = [...ctx.getImageData(0, 0, 1, 1).data];
      colors.set(value, [...data.slice(0, 3), data[3] / 255]);
    }
    return colors.get(value);
  }
  const blend = (front, back) => front.slice(0, 3).map((channel, index) => channel * front[3] + back[index] * (1 - front[3]));
  const luminance = rgb => rgb.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  const contrastAgainst = (front, backs) => {
    const differences = backs.map(back => luminance(blend(front, back)) - luminance(back));
    if (Math.min(...differences) <= 0 && Math.max(...differences) >= 0) return 1;
    return Math.min(...backs.map(back => contrast(blend(front, back), back)));
  };
  const extremes = values => [values.reduce((a, b) => luminance(a) < luminance(b) ? a : b), values.reduce((a, b) => luminance(a) > luminance(b) ? a : b)];
  function layers(value) {
    const result = [];
    let start = 0, depth = 0;
    for (let index = 0; index < value.length; index++) {
      if (value[index] === "(") depth++;
      if (value[index] === ")") depth--;
      if (value[index] === "," && !depth) { result.push(value.slice(start, index)); start = index + 1; }
    }
    result.push(value.slice(start));
    return result;
  }
  const cache = new WeakMap();
  function background(element) {
    if (!element) return { values: [[255, 255, 255]], artwork: false };
    if (cache.has(element)) return cache.get(element);
    const style = getComputedStyle(element);
    const parent = background(element.parentElement);
    let values = parent.values.map(back => blend(color(style.backgroundColor), back));
    let artwork = parent.artwork;
    for (const layer of layers(style.backgroundImage).reverse()) {
      if (layer.trim() === "none" || style.backgroundClip.includes("text")) continue;
      const stops = layer.match(/(?:rgba?|color)\([^)]*\)|#[0-9a-f]{3,8}\b/gi);
      if (!stops || layer.includes("url(")) {
        artwork = true;
        values = [[0, 0, 0], [255, 255, 255]];
      } else {
        values = extremes(values.flatMap(back => stops.map(stop => blend(color(stop), back))));
      }
    }
    const result = { values, artwork };
    cache.set(element, result);
    return result;
  }
  const dialog = document.querySelector("[data-blog-theme-settings]");
  const roots = [document.querySelector("#blog-post-body"), document.querySelector("#blog-post-toc"), document.querySelector(".public-nav"),
    document.querySelector("#blog-post > header"), dialog].filter(Boolean);
  const results = [];
  for (const root of roots) {
    if (root === dialog) {
      dialog.showModal();
      const picker = dialog.querySelector(".theme-picker");
      if (picker) picker.open = true;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let text; (text = walker.nextNode());) {
      if (!text.textContent.trim()) continue;
      const element = text.parentElement;
      if (!element.getClientRects().length) continue;
      const style = getComputedStyle(element);
      const backgroundResult = background(element);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.6667 && Number(style.fontWeight) >= 700);
      const minimum = large ? 3 : 4.5;
      let foregrounds = [color(style.webkitTextFillColor || style.color)];
      const rainbow = element.closest(".blog-text-color-rainbow");
      if (foregrounds[0][3] === 0 && rainbow) {
        foregrounds = (getComputedStyle(rainbow).backgroundImage.match(/(?:rgba?|color)\([^)]*\)/gi) || []).map(color);
        foregrounds = foregrounds.flatMap((stop, index, stops) => index ? Array.from({ length: 21 }, (_, step) =>
          stop.map((channel, component) => channel * step / 20 + stops[index - 1][component] * (1 - step / 20))) : [stop]);
      }
      const ratio = foregrounds.length ? Math.min(...foregrounds.map(front => contrastAgainst(front, backgroundResult.values))) : 0;
      const colored = Boolean(element.closest('[class*="blog-text-color-"], [style*="color:"], mark'));
      results.push({
        text: text.textContent.trim().slice(0, 100), ratio: Number(ratio.toFixed(3)), minimum,
        foreground: style.color, background: backgroundResult.values, artwork: backgroundResult.artwork,
        kind: colored ? "colored" : root === dialog ? "controls" : root.id === "blog-post-toc" ? "toc" : element.closest("a") ? "link" : "body",
      });
    }
    const target = root === dialog ? root.querySelector(".theme-picker > summary") : root.id === "blog-post-toc" ? root.querySelector("a") : null;
    if (target) {
      target.focus({ preventScroll: true });
      const style = getComputedStyle(target);
      const back = background(target).values;
      const ratio = style.outlineStyle === "none" ? 0 : contrastAgainst(color(style.outlineColor), back);
      results.push({ kind: "focus", text: root === dialog ? "Theme picker focus" : "TOC link focus", ratio: Number(ratio.toFixed(3)), minimum: 3, foreground: style.outlineColor, background: back });
    }
    if (root === dialog) dialog.close();
  }
  return results;
}

const cases = [];
const noJavaScript = [];
const accessibility = [];
let registry, matrix;
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => {
    localStorage.setItem("bits-theme-debug", "enabled");
    localStorage.setItem("bits-interface-theme", "default");
    localStorage.removeItem("bits-color-scheme");
    localStorage.setItem("bits-seasonal-theme-dismissed", "thanksgiving");
    localStorage.removeItem("bits-seasonal-theme-choice");
  });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/site_blog_public_posts")) {
      const slug = url.searchParams.get("slug")?.slice(3);
      return route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(posts.filter(post => !slug || post.slug === slug)) });
    }
    if (url.pathname.endsWith("/get_blog_post_views")) return route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "0" });
    return url.origin === server.origin || route.request().resourceType() === "image" ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  await page.goto(`${server.origin}/blog/`, { waitUntil: "networkidle" });
  registry = await page.evaluate(() => window.BITS_INTERFACE_THEMES);
  matrix = registry.flatMap(theme => (theme.variants || [null]).flatMap(variant =>
    (theme.schemes || ["auto", "dark", "light"]).map(scheme => ({ theme: theme.id, variant: variant?.id || null, scheme }))));
  const filter = process.argv.indexOf("--theme");
  if (filter >= 0) matrix = matrix.filter(entry => entry.theme === process.argv[filter + 1]);
  if (process.argv.includes("--representatives")) matrix = matrix.filter(entry =>
    entry.theme === "default" && entry.scheme !== "auto"
    || entry.theme === "html"
    || entry.theme === "rgb" && entry.variant === "rainbow" && entry.scheme === "light"
    || entry.theme === "aero-glass" && entry.variant === "rose" && entry.scheme === "light"
    || entry.theme === "ipod-classic" && entry.variant === "black" && entry.scheme === "light"
    || entry.theme === "aqua" && entry.variant === "graphite" && entry.scheme === "light"
    || entry.theme === "winamp" && entry.variant === "classic" && entry.scheme === "dark");
  console.log(`Auditing ${registry.length} themes; ${matrix.length} theme/mode/variant combinations; both readers, ${selectedPosts.length} published post(s), 1440/390px.`);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const post of selectedPosts) {
      for (const reader of ["canonical", "legacy"]) {
        const path = reader === "canonical" ? `/blog/articles/${post.slug}/` : `/blog/post.html?slug=${post.slug}`;
        await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
        await page.locator("#blog-post").waitFor({ state: "visible" });
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
        const toc = page.locator("#blog-post-toc details");
        if (await toc.count()) await toc.evaluate(element => { element.open = true; });
        for (const entry of matrix) {
          await page.evaluate(entry => window.BITS_THEME_PREFERENCE.apply(entry.theme, { scheme: entry.scheme, variant: entry.variant }), entry);
          await page.waitForFunction(id => {
            const theme = window.BITS_THEME_PREFERENCE.getTheme(id);
            return !theme.stylesheet && !theme.experimental || Boolean(document.querySelector("#bits-theme-stylesheet")?.sheet);
          }, entry.theme);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const runs = await page.evaluate(measure);
          const failures = runs.filter(run => run.ratio < run.minimum);
          const result = { ...entry, post: post.slug, reader, width, textRuns: runs.length, failures: failures.length, worst: failures.sort((a, b) => a.ratio - b.ratio).slice(0, 12) };
          cases.push(result);
          if (process.argv.includes("--axe")) {
            if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: createRequire(import.meta.url).resolve("axe-core/axe.min.js") });
            const audit = await page.evaluate(async () => {
              const result = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast", "link-name", "button-name", "aria-dialog-name"] } });
              const compact = issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) });
              return { violations: result.violations.map(compact), incomplete: result.incomplete.map(compact) };
            });
            accessibility.push({ ...entry, post: post.slug, reader, width, ...audit });
          }
          const representative = entry.theme === "default" && entry.scheme !== "auto"
            || entry.theme === "html"
            || entry.theme === "rgb" && entry.variant === "rainbow" && entry.scheme === "light"
            || entry.theme === "aero-glass" && entry.variant === "rose" && entry.scheme === "light"
            || entry.theme === "ipod-classic" && entry.variant === "black" && entry.scheme === "light";
          if (reader === "canonical" && representative) {
            const colored = page.locator('#blog-post-body [style*="color:"]').last();
            if (await colored.count()) await colored.scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(output, `${post.slug}-${entry.theme}-${entry.variant || "base"}-${entry.scheme}-${width}.png`) });
          }
          const controls = entry.theme === "aqua" && entry.variant === "graphite" && entry.scheme === "light"
            || entry.theme === "winamp" && entry.variant === "classic" && entry.scheme === "dark"
            || entry.theme === "tokyo-night" && entry.scheme === "light";
          if (reader === "canonical" && controls && post === posts[0]) {
            await page.evaluate(() => {
              const dialog = document.querySelector("[data-blog-theme-settings]");
              dialog.showModal();
              dialog.querySelector(".theme-picker").open = true;
            });
            await page.screenshot({ path: join(output, `controls-${entry.theme}-${entry.variant}-${entry.scheme}-${width}.png`) });
            await page.evaluate(() => document.querySelector("[data-blog-theme-settings]").close());
          }
        }
        console.log(`${width}px ${post.slug} ${reader}: ${matrix.length} combinations finished.`);
      }
    }
  }
  await context.close();
  if (process.argv.includes("--assert")) {
    const offline = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
    const staticPage = await offline.newPage();
    for (const width of [1440, 390]) {
      await staticPage.setViewportSize({ width, height: 1000 });
      for (const post of posts) {
        await staticPage.goto(`${server.origin}/blog/articles/${post.slug}/`, { waitUntil: "networkidle" });
        const details = staticPage.locator(".blog-toc");
        if (await details.count()) {
          if (await details.evaluate(node => node.open)) throw new Error("Static TOC must start collapsed.");
          await details.locator("summary").press("Enter");
          if (!await details.evaluate(node => node.open)) throw new Error("Static disclosure must work without JavaScript.");
        }
        const runs = await staticPage.evaluate(measure);
        const failures = runs.filter(run => run.ratio < run.minimum);
        noJavaScript.push({ post: post.slug, width, textRuns: runs.length, failures });
        await staticPage.emulateMedia({ media: "print" });
        if (await details.count() && await details.isVisible()) throw new Error("Print must still hide the TOC.");
        await staticPage.emulateMedia({ media: "screen" });
      }
    }
    await offline.close();
  }
} finally {
  await browser.close();
  await server.close();
}
const summary = { themes: registry.length, combinations: matrix.length, cases: cases.length, failingCases: cases.filter(entry => entry.failures).length,
  failures: cases.reduce((sum, entry) => sum + entry.failures, 0), textRuns: cases.reduce((sum, entry) => sum + entry.textRuns, 0) };
await writeFile(join(output, "results.json"), JSON.stringify({ summary, registry, matrix, cases, noJavaScript, accessibility }, null, 2));
console.log(JSON.stringify(summary));
if (process.argv.includes("--assert") && (summary.failures || noJavaScript.some(entry => entry.failures.length) || accessibility.some(entry => entry.violations.length))) throw new Error("Blog contrast/accessibility checks contain failures.");
