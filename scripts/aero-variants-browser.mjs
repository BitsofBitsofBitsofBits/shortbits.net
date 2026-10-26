import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`--${name} requires a value.`);
  return args[index + 1];
};
const server = await startSiteServer(resolve(option("root") || "."));
const screenshots = option("screenshots");
if (screenshots) await mkdir(resolve(screenshots), { recursive: true });
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}), headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/rest/v1/")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "[]",
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    assert.equal(await page.locator('link[href*="/layouts/aero-glass.css"]').count(), 0, "Aero CSS is not loaded for other themes");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    await page.locator("#settings-theme").selectOption("aero-glass");
    await page.waitForFunction(() => document.querySelector("#bits-theme-stylesheet")?.sheet);
    assert.equal(await page.locator("#settings-variant").inputValue(), "classic", "Existing Aero users retain the original variant");
    assert.deepEqual(await page.locator("#settings-variant option").evaluateAll(options => options.map(option => option.value)), ["classic", "windows-7", "vista"]);
    const classic = await page.locator("#interface-shell").evaluate(element => {
      const style = getComputedStyle(element);
      return [style.background, style.border, style.boxShadow];
    });
    await page.addScriptTag({ path: axePath });
    const backgrounds = new Set();
    for (const variant of ["windows-7", "vista"]) {
      for (const scheme of ["dark", "light"]) {
        await page.locator("#settings-variant").selectOption(variant);
        await page.locator("#settings-scheme").selectOption(scheme);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.locator("html").getAttribute("data-theme-variant"), variant);
        assert.equal(await page.locator("#interface-variant-select").inputValue(), variant, "Settings and View pickers remain synchronized");
        backgrounds.add(await page.locator("html").evaluate(root => getComputedStyle(root).getPropertyValue("--body-background")));
        assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"),
          variant === "windows-7" ? scheme === "dark" ? "#0b3b70" : "#c6e4fa" : scheme === "dark" ? "#101e21" : "#d8e7de");
        const violations = await page.evaluate(async () => (await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })).violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })));
        assert.deepEqual(violations, [], `${width}px ${variant}/${scheme} accessibility`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "Aero variants must not create horizontal overflow");
        if (screenshots) {
          await page.keyboard.press("Escape");
          await page.screenshot({ path: join(resolve(screenshots), `${variant}-${scheme}-${width}.png`) });
          await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
        }
      }
    }
    assert.equal(backgrounds.size, 4, "Both palettes of both variants must have visibly distinct desktop backgrounds");
    await page.locator("#settings-scheme").selectOption("dark");
    await page.locator("#settings-variant").selectOption("classic");
    assert.deepEqual(await page.locator("#interface-shell").evaluate(element => {
      const style = getComputedStyle(element);
      return [style.background, style.border, style.boxShadow];
    }), classic, "Returning to Classic restores the original Aero styling exactly");
    await page.locator("#settings-variant").selectOption("vista");
    await page.keyboard.press("Escape");
    await page.locator(".app-menu").filter({ has: page.locator("#interface-variant-select") }).locator("summary").click();
    await page.locator("#interface-variant-select").selectOption("windows-7");
    assert.equal(await page.locator("#settings-variant").inputValue(), "windows-7", "The View picker also updates Settings");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("html").getAttribute("data-theme-variant"), "windows-7", "Variant selection persists after reload");
    for (const path of ["/professional/", "/boot/", "/projects/"]) {
      await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.querySelector("#bits-theme-stylesheet")?.sheet);
      assert.equal(await page.locator("html").getAttribute("data-theme-variant"), "windows-7", `${path} uses the saved variant before runtime`);
    }
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    await page.evaluate(() => {
      document.documentElement.dataset.contrast = "high";
      document.documentElement.dataset.effects = "off";
    });
    assert.equal(await page.locator("#interface-shell").evaluate(node => getComputedStyle(node).backdropFilter), "none");
    assert.equal(await page.locator("body").evaluate(node => getComputedStyle(node, "::before").display), "none");
    await page.emulateMedia({ forcedColors: "active" });
    assert.equal(await page.locator("#interface-shell").evaluate(node => getComputedStyle(node).backgroundImage), "none");
    await page.emulateMedia({ forcedColors: "none" });
    await page.evaluate(() => {
      document.documentElement.dataset.contrast = "default";
      window.BITS_THEME_PREFERENCE.select("default");
      window.BITS_THEME_PREFERENCE.apply("default");
    });
    assert.equal(await page.locator("#bits-theme-stylesheet").count(), 0, "Leaving Aero removes its stylesheet");
    assert.equal(await page.locator("html").getAttribute("data-theme-variant"), null);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px Aero: Classic compatibility, Windows 7/Vista light/dark, both pickers, persistence/shared pages, lazy CSS, accessibility, contrast/effects/forced colors`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
