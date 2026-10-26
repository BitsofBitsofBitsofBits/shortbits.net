import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const server = await startSiteServer(resolve(rootIndex < 0 ? "." : args[rootIndex + 1]));
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    await context.route("**/*", route => new URL(route.request().url()).origin === server.origin
      ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    const menu = page.locator(".app-menu").filter({ has: page.locator("#interface-theme-select") });
    const viewPicker = menu.locator(".theme-picker");
    await menu.locator(":scope > summary").click();
    await viewPicker.locator(":scope > summary").click();
    const mac = viewPicker.locator(".theme-picker-branch").filter({
      has: page.locator('summary:text-is("macOS")'),
    }).first();
    await mac.locator(":scope > summary").click();
    await mac.locator('summary:text-is("AQUA")').click();
    await mac.locator('[data-theme="aqua"][data-variant="graphite"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.interfaceTheme === "aqua"
      && document.documentElement.dataset.themeVariant === "graphite");
    assert.equal(await page.locator("#settings-theme").inputValue(), "aqua");
    assert.equal(await page.locator("#settings-variant").inputValue(), "graphite");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.equal(await page.locator("#settings-theme").inputValue(), "aqua", "Theme survives reload");
    assert.equal(await page.locator("#settings-variant").inputValue(), "graphite", "Variant survives reload");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    const settings = page.locator("#settings-window .theme-picker");
    await settings.locator(":scope > summary").click();
    assert.match(await settings.locator(":scope > summary").textContent(), /macOS \/ AQUA \/ GRAPHITE/);
    assert.equal(await settings.locator('[data-theme="aqua"][data-variant="graphite"]').getAttribute("aria-pressed"), "true");
    await settings.locator('summary:text-is("Windows")').click();
    await settings.locator('summary:text-is("AERO GLASS")').click();
    await settings.locator('[data-theme="aero-glass"][data-variant="vista"]').click();
    assert.equal(await page.locator("#interface-theme-select").inputValue(), "aero-glass");
    assert.equal(await page.locator("#interface-variant-select").inputValue(), "vista");
    await settings.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await settings.getAttribute("open"), "");
    await page.keyboard.press("Escape");
    assert.equal(await settings.getAttribute("open"), null);
    await settings.locator(":scope > summary").click();
    await settings.locator('summary:text-is("macOS")').click();
    await settings.locator('[data-theme="macos"]').click();
    assert.equal(await page.locator("#settings-theme").inputValue(), "macos");
    await settings.locator(":scope > summary").click();
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#settings-window"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) })));
    assert.deepEqual(violations, [], "Expanded picker remains accessible");
    assert.ok(await settings.evaluate(element => element.scrollWidth <= element.clientWidth + 1),
      "Expanded picker does not overflow horizontally");
    assert.ok(await settings.locator(".theme-picker-list").evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.height <= innerHeight * 0.55 + 20;
    }), "Theme list stays bounded on mobile and desktop");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px nested theme selection, persistence, synchronization, keyboard, accessibility and overflow`);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
