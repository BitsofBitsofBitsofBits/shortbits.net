import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const server = await startSiteServer(resolve(rootIndex < 0 ? "." : args[rootIndex + 1]));
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const rows = ["messages", "activities"].map((category, position) => ({
  position: position + 1, profile: "standard", category, text: "PRIDE THEME PREVIEW", weight: 1,
  colorful: false, format: {}, enabled: true, markup: false, corrected_text: null,
}));
const failures = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function ready(page, id) {
  await page.waitForFunction(id => {
    const sheet = document.querySelector("#bits-theme-stylesheet");
    return document.documentElement.dataset.interfaceTheme === id
      && sheet?.href.includes("/layouts/pride.css?") && sheet.sheet;
  }, id);
  await settle(page);
}
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}), headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.addInitScript(rows => {
      sessionStorage.setItem("bits-boot-seen-v1", "true");
      if (!localStorage.getItem("bits-interface-theme")) localStorage.setItem("bits-interface-theme", "default");
      localStorage.setItem("bits-message-catalog-v2", JSON.stringify({ rows, pools: [], timezone: "UTC", loadedAt: Date.now() }));
    }, rows);
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/rest/v1/")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(url.pathname.endsWith("/site_message_catalog") ? rows
          : url.pathname.endsWith("/site_message_settings") ? [{ id: "primary", timezone: "UTC" }] : []),
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    const missing = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      if (response.status() >= 400 && new URL(response.url()).origin === server.origin) missing.push(response.url());
    });
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("/layouts/pride.css")).length), 0, "Default does not download Pride styles");
    const themes = await page.evaluate(() => window.BITS_INTERFACE_THEMES.filter(theme => theme.pride).map(theme => theme.id));
    assert.equal(themes.length, 20);
    assert.equal(await page.locator('#interface-theme-select optgroup[label="PRIDE"] option').count(), 20);
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    const picker = page.locator("#settings-window .theme-picker");
    await picker.locator(":scope > summary").click();
    await picker.locator('summary:text-is("Pride")').click();
    await picker.locator('[data-theme="pride-transgender"]').click();
    await ready(page, "pride-transgender");
    assert.equal(await page.locator("#interface-theme-select").inputValue(), "pride-transgender");
    assert.match(await picker.locator(":scope > summary").textContent(), /Pride \/ TRANSGENDER/);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    await page.addScriptTag({ path: axePath });
    const accents = new Set();
    for (const theme of themes) {
      await page.locator("#settings-theme").selectOption(theme, { force: true });
      await ready(page, theme);
      assert.equal(await page.locator("#interface-theme-select").inputValue(), theme);
      assert.equal(await page.locator("#settings-variant").isVisible(), false);
      assert.equal(await page.locator("#settings-scheme").isVisible(), true);
      for (const scheme of ["dark", "light"]) {
        await page.locator("#settings-scheme").selectOption(scheme);
        await settle(page);
        assert.equal(await page.locator("html").getAttribute("data-color-scheme"), scheme);
        const colors = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          const swatch = getComputedStyle(document.querySelector(".system-bar"), "::after");
          return { bg: style.getPropertyValue("--bg").trim(), flag: style.getPropertyValue("--pride-flag"),
            accent: style.getPropertyValue("--accent"), swatch: swatch.backgroundImage };
        });
        assert.equal(colors.bg, scheme === "dark" ? "#100f18" : "#faf8fc");
        assert.match(colors.flag, /gradient|progress-pride\.svg/);
        assert.notEqual(colors.swatch, "none", "Active flag is visible in the header");
        accents.add(colors.accent);
        const violations = await page.evaluate(async () => (await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })).violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })));
        if (violations.length) failures.push({ theme, width, scheme, violations });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
          `${theme}/${scheme}/${width} fits horizontally`);
      }
    }
    assert.ok(accents.size >= 24, "Flag palettes have distinct accents in both color schemes");
    assert.equal(await page.locator("#bits-layout-runtime").count(), 0, "Pride themes never mount experimental chrome");
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("/layouts/pride.css")).length), 1, "All flags share a single lazy stylesheet");
    await page.locator("#settings-theme").selectOption("pride", { force: true });
    await ready(page, "pride");
    const flag = await page.evaluate(() => new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = "/shared/images/flags/progress-pride.svg";
    }));
    assert.ok(flag?.width > 0 && flag.height > 0, "The original Progress Pride flag SVG loads");
    await page.evaluate(() => { document.documentElement.dataset.effects = "off"; });
    assert.equal(await page.locator("body").evaluate(body => getComputedStyle(body, "::before").display), "none");
    await page.evaluate(() => {
      document.documentElement.dataset.effects = "on";
      document.documentElement.dataset.contrast = "high";
    });
    assert.equal(await page.locator("body").evaluate(body => getComputedStyle(body, "::before").display), "none");
    await page.emulateMedia({ forcedColors: "active" });
    assert.equal(await page.locator(".system-bar").evaluate(bar => getComputedStyle(bar, "::after").display), "none");
    await page.emulateMedia({ forcedColors: "none" });
    await page.evaluate(() => {
      document.documentElement.dataset.contrast = "default";
      window.BITS_THEME_PREFERENCE.select("pride-non-binary");
      window.BITS_THEME_PREFERENCE.apply("pride-non-binary");
    });
    await page.reload({ waitUntil: "networkidle" });
    await ready(page, "pride-non-binary");
    for (const path of ["/professional/", "/nowplaying/", "/boot/", "/blog/", "/?choose"]) {
      await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await ready(page, "pride-non-binary");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${path} preserves mobile layout`);
      if (["/professional/", "/nowplaying/", "/boot/"].includes(path)) {
        assert.equal(await page.evaluate(() => [...document.querySelectorAll("optgroup")]
          .find(group => group.label.toUpperCase() === "PRIDE")?.children.length), 20);
      }
    }
    await page.evaluate(() => {
      window.BITS_THEME_PREFERENCE.select("default");
      window.BITS_THEME_PREFERENCE.apply("default");
    });
    await settle(page);
    assert.equal(await page.locator("#bits-theme-stylesheet").count(), 0, "Returning to Default removes Pride styles");
    assert.equal(await page.locator("html").evaluate(root => getComputedStyle(root).getPropertyValue("--pride-flag").trim()), "",
      "No flag palette leaks into another theme");
    assert.deepEqual(errors, [], "No JavaScript errors");
    assert.deepEqual(missing, [], "All public assets are present");
    console.log(`Checked ${width}px: 20 Pride flags, dedicated pickers, both schemes, flag accents, lazy CSS, reduced effects, forced colors, persistence, and shared pages`);
    await context.close();
  }
  assert.deepEqual(failures, [], "All Pride themes pass accessibility in both schemes");
  console.log("PASS all 80 Pride theme/scheme/viewport accessibility audits");
} finally {
  await browser?.close();
  await server.close();
}
