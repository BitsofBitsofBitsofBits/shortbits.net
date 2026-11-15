import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";
import { chooseTheme, openThemePicker } from "./theme-picker-helpers.mjs";

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
    for (const path of ["/professional/", "/boot/", "/nowplaying/"]) {
      const standalone = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await standalone.route("**/*", route => new URL(route.request().url()).origin === server.origin
        ? route.continue() : route.abort());
      const publicPage = await standalone.newPage();
      const standaloneErrors = [];
      publicPage.on("pageerror", error => standaloneErrors.push(error.message));
      const revealControls = async () => {
        if (path === "/boot/") await publicPage.locator("#endless-boot-settings-toggle").click();
        if (path === "/nowplaying/") {
          await publicPage.mouse.move(20, 20);
          await publicPage.locator("#presentation-auto-hide").uncheck();
        }
      };
      await publicPage.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await revealControls();
      const picker = publicPage.locator(".theme-picker");
      await picker.waitFor({ state: "visible" });
      assert.equal(await publicPage.locator(".theme-picker-native select").first().isVisible(), false);
      await openThemePicker(picker);
      assert.deepEqual(await picker.locator(".theme-picker-list > details > summary").allTextContents(),
        await publicPage.evaluate(() => BITS_THEME_PREFERENCE.getGroups().map(group => group.name)));
      await chooseTheme(publicPage, picker, "aqua", "graphite");
      await publicPage.waitForFunction(() => document.documentElement.dataset.interfaceTheme === "aqua"
        && document.documentElement.dataset.themeVariant === "graphite");
      assert.match(await picker.locator(":scope > summary").textContent(), /macOS \/ AQUA \/ GRAPHITE/);
      await publicPage.reload({ waitUntil: "networkidle" });
      await revealControls();
      assert.match(await picker.locator(":scope > summary").textContent(), /macOS \/ AQUA \/ GRAPHITE/);
      await publicPage.goto(`${server.origin}/blog/`, { waitUntil: "networkidle" });
      assert.equal(await publicPage.evaluate(() => document.documentElement.dataset.interfaceTheme), "aqua",
        "Standalone selection carries to the blog");
      assert.equal(await publicPage.evaluate(() => document.documentElement.dataset.themeVariant), "graphite");
      await publicPage.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await revealControls();
      const peer = await standalone.newPage();
      await peer.goto(`${server.origin}/professional/`, { waitUntil: "networkidle" });
      await chooseTheme(peer, peer.locator(".theme-picker"), "terminal");
      await publicPage.waitForFunction(() => document.documentElement.dataset.interfaceTheme === "terminal");
      assert.match(await picker.locator(":scope > summary").textContent(), /Terminals & retro computers \/ TERMINAL/);
      await peer.close();
      await publicPage.addScriptTag({ path: axePath });
      const schemeSelect = publicPage.locator(path === "/professional/" ? "#profile-scheme-select"
        : path === "/boot/" ? "#endless-boot-scheme" : "#presentation-scheme");
      for (const [theme, variant] of [["default", null], ["aero-glass", "vista"], ["macos", null]]) {
        await chooseTheme(publicPage, picker, theme, variant);
        await publicPage.waitForFunction(id => {
          const theme = BITS_THEME_PREFERENCE.getTheme(id);
          return document.documentElement.dataset.interfaceTheme === id
            && (!(theme.stylesheet || theme.experimental) || Boolean(document.querySelector("#bits-theme-stylesheet")?.sheet));
        }, theme);
        for (const scheme of ["dark", "light"]) {
          await schemeSelect.selectOption(scheme);
          await openThemePicker(picker);
          await publicPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await publicPage.waitForFunction(() => document.getAnimations().every(animation =>
            animation.playState !== "running" && !animation.pending));
          const issues = await publicPage.evaluate(async () => (await axe.run(document.querySelector(".theme-picker"), {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })).violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) })));
          assert.deepEqual(issues, [], `${path} ${theme} ${scheme} expanded family picker remains accessible`);
        }
      }
      assert.ok(await picker.evaluate(element => element.scrollWidth <= element.clientWidth + 1),
        `${path} expanded menu fits its container`);
      assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${path} does not overflow the viewport`);
      await picker.locator(":scope > summary").focus();
      await publicPage.keyboard.press("Escape");
      assert.equal(await picker.getAttribute("open"), null);
      if (path === "/nowplaying/") {
        await publicPage.keyboard.press("f");
        assert.equal(await publicPage.evaluate(() => document.fullscreenElement), null,
          "Family-picker keyboard input does not trigger fullscreen");
      } else {
        await publicPage.locator(path === "/boot/" ? "#endless-boot-theme-random" : ".profile-theme-random").click();
        assert.equal(await publicPage.locator(".theme-picker-native select").first().inputValue(),
          await publicPage.evaluate(() => document.documentElement.dataset.interfaceTheme),
          "Random selection stays synchronized with the family menu");
      }
      assert.equal(await publicPage.evaluate(() => Boolean(window.BITS_DESKTOP_WINDOWS)), false,
        "Standalone family controls do not load the Online desktop runtime");
      assert.deepEqual(standaloneErrors, []);
      console.log(`PASS ${width}px ${path} shared family selection, variants, persistence, keyboard, accessibility and overflow`);
      await standalone.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
