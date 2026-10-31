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
const themes = ["eink-reader", "blueprint", "spacecraft", "frutiger-eco", "holographic", "newspaper", "workbench", "stickerbook", "night-train", "museum"];
// Theme audits use deterministic content, not randomly selected custom message colors.
const messageRows = ["messages", "activities"].map((category, position) => ({
  position: position + 1, profile: "standard", category, text: "THEME PREVIEW", weight: 1,
  colorful: false, format: {}, enabled: true, markup: false, corrected_text: null,
}));
const server = await startSiteServer(resolve(option("root") || "."));
const screenshots = option("screenshots");
if (screenshots) await mkdir(resolve(screenshots), { recursive: true });
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const auditFailures = [];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function waitForTheme(page, id) {
  await page.waitForFunction(id => {
    const link = document.querySelector("#bits-theme-stylesheet");
    if (!link?.href.includes(`/shared/styles/layouts/${id}.css`) || !link.sheet) return false;
    return !["eink-reader", "blueprint", "spacecraft", "frutiger-eco", "holographic", "newspaper", "workbench", "stickerbook", "night-train", "museum"].includes(id)
      || [...link.sheet.cssRules].some(rule => rule.type === CSSRule.IMPORT_RULE && rule.styleSheet?.cssRules.length);
  }, id);
  await settle(page);
}
async function audit(page, label) {
  const violations = await page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  })).violations.map(issue => ({
    id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
  })));
  if (violations.length) auditFailures.push({ label, violations });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${label}: horizontal overflow`);
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
      localStorage.setItem("bits-message-catalog-v2", JSON.stringify({ rows, pools: [], timezone: "UTC", loadedAt: Date.now() }));
      window.__einkRefreshCount = 0;
      new MutationObserver(records => {
        window.__einkRefreshCount += records.flatMap(record => [...record.addedNodes])
          .filter(node => node.classList?.contains("eink-refresh-overlay")).length;
      }).observe(document, { childList: true, subtree: true });
    }, messageRows);
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/rest/v1/")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(url.pathname.endsWith("/site_message_catalog") ? messageRows
          : url.pathname.endsWith("/site_message_settings") ? [{ id: "primary", timezone: "UTC" }] : []),
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-01-15T12:00:00Z"));
    const errors = [];
    const missing = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      if (response.status() >= 400 && new URL(response.url()).pathname.startsWith("/shared/styles/layouts/")) missing.push(response.url());
    });
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.equal(await page.evaluate(() => window.BITS_ACTIVITIES[0].text), "THEME PREVIEW", "Audits must use the deterministic catalog");
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource").filter(entry => /\/shared\/styles\/layouts\/(?:collection-base|eink-reader|blueprint|spacecraft|frutiger-eco|holographic|newspaper|workbench|stickerbook|night-train|museum)\.css/.test(entry.name)).length), 0, "No collection CSS is fetched for Default");
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    await page.addScriptTag({ path: axePath });
    await page.locator("#contact-form").dispatchEvent("focusin");
    await page.waitForFunction(() => document.querySelector(".contact-turnstile")?.dataset.state === "error");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    for (const theme of themes) {
      await page.locator("#settings-theme").selectOption(theme, { force: true });
      await waitForTheme(page, theme);
      assert.equal(await page.locator("#interface-theme-select").inputValue(), theme, "View follows Settings");
      assert.equal(await page.locator("#settings-variant").isVisible(), false);
      assert.equal(await page.locator("#settings-eink-refresh-option").isVisible(), theme === "eink-reader");
      const palettes = new Set();
      for (const scheme of ["dark", "light"]) {
        await page.locator("#settings-scheme").selectOption(scheme);
        await settle(page);
        palettes.add(await page.locator("html").evaluate(root => getComputedStyle(root).getPropertyValue("--bg").trim()));
        assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"),
          await page.evaluate(scheme => window.BITS_INTERFACE_THEMES.find(theme => theme.id === document.documentElement.dataset.interfaceTheme)[`${scheme}Color`], scheme));
        await audit(page, `${width}px ${theme}/${scheme}`);
        if (screenshots && ["eink-reader", "blueprint", "holographic", "stickerbook"].includes(theme)) {
          await page.screenshot({ path: join(resolve(screenshots), `${theme}-${scheme}-${width}.png`) });
        }
      }
      assert.equal(palettes.size, 2, `${theme} has distinct dark/light palettes`);
      await page.evaluate(() => { document.documentElement.dataset.contrast = "high"; });
      assert.equal(await page.locator("#interface-shell").evaluate(node => getComputedStyle(node).backdropFilter), "none");
      await audit(page, `${width}px ${theme}/high-contrast`);
      await page.evaluate(() => { document.documentElement.dataset.contrast = "default"; });
      await page.emulateMedia({ forcedColors: "active" });
      assert.equal(await page.locator("#interface-shell").evaluate(node => getComputedStyle(node).backgroundImage), "none");
      await page.emulateMedia({ forcedColors: "none" });
    }
    for (const [theme, variant] of [["terminal", "amber"], ["minebits", "mushroom-fields"]]) {
      await page.locator("#settings-theme").selectOption(theme, { force: true });
      await waitForTheme(page, theme);
      await page.locator("#settings-variant").selectOption(variant, { force: true });
      await settle(page);
      assert.equal(await page.locator("#interface-variant-select").inputValue(), variant);
      await audit(page, `${width}px ${theme}/${variant}`);
    }
    assert.deepEqual(auditFailures, [], "All theme palettes must pass accessibility checks");
    await page.locator("#settings-theme").selectOption("blueprint", { force: true });
    await waitForTheme(page, "blueprint");
    await page.keyboard.press("Escape");
    await page.locator(".app-menu").filter({ has: page.locator("#interface-theme-select") }).locator(":scope > summary").click();
    await page.locator("#interface-theme-select").selectOption("museum", { force: true });
    await waitForTheme(page, "museum");
    assert.equal(await page.locator("#settings-theme").inputValue(), "museum", "Settings follows View");
    await page.reload({ waitUntil: "networkidle" });
    await waitForTheme(page, "museum");
    assert.equal(await page.locator("html").getAttribute("data-interface-theme"), "museum");
    for (const path of ["/professional/", "/projects/", "/blog/"]) {
      await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await waitForTheme(page, "museum");
      assert.equal(await page.locator("html").getAttribute("data-interface-theme"), "museum", `${path} uses saved themes`);
    }
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    await page.locator("#settings-theme").selectOption("eink-reader", { force: true });
    await waitForTheme(page, "eink-reader");
    assert.equal(await page.locator("#settings-eink-refresh").isChecked(), false, "Refresh defaults off");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#settings-motion").selectOption("system");
    await page.locator("#settings-eink-refresh").check();
    assert.equal(await page.evaluate(() => localStorage.getItem("bits-eink-refresh")), "on");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    assert.equal(await page.locator(".eink-refresh-overlay").count(), 0, "Focusing an already-open window does not refresh");
    await page.locator("#settings-window [data-window-close]").click();
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    assert.equal(await page.locator(".eink-refresh-overlay").count(), 1, "Opted-in window opens refresh");
    await page.locator("#settings-effects").uncheck();
    await page.waitForFunction(() => !document.querySelector(".eink-refresh-overlay"));
    await page.locator("#settings-effects").check();
    await page.locator("#settings-theme").selectOption("holographic", { force: true });
    await waitForTheme(page, "holographic");
    await page.mouse.move(width / 3, 120);
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--foil-x"));
    await page.locator("#settings-motion").selectOption("reduced");
    await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--foil-x"));
    await page.locator("#settings-motion").selectOption("system");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(width / 2, 130);
    await settle(page);
    assert.equal(await page.locator("html").evaluate(root => root.style.getPropertyValue("--foil-x")), "");
    await page.locator("#settings-theme").selectOption("eink-reader", { force: true });
    await waitForTheme(page, "eink-reader");
    assert.equal(await page.locator("#settings-eink-refresh").isChecked(), true, "Refresh preference survives switching themes");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.equal(await page.locator("html").getAttribute("data-eink-refresh"), "on", "Refresh persists after reload");
    assert.equal(await page.evaluate(() => window.__einkRefreshCount), 0, "Restoring windows on page load must not flash, even with full motion");
    await page.evaluate(() => {
      window.BITS_THEME_PREFERENCE.select("default");
      window.BITS_THEME_PREFERENCE.apply("default");
    });
    assert.equal(await page.locator("#bits-theme-stylesheet").count(), 0, "Leaving collection removes imported CSS too");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#settings-reset-all").click();
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready"
      && document.documentElement.dataset.einkRefresh === "off");
    assert.equal(await page.evaluate(() => localStorage.getItem("bits-eink-refresh")), null, "Reset clears the optional effect preference");
    assert.deepEqual(missing, [], "All lazy theme assets resolve");
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log(`PASS ${width}px: ten themes, two palettes, Amber/Mushroom variants, both pickers, accessibility, shared pages, lazy imports, opt-in refresh and motion-safe foil`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
