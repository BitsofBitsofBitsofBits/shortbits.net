import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const rootIndex = process.argv.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : process.argv[rootIndex + 1]);
const server = await startSiteServer(root);
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const rows = [{
  position: 1, profile: "standard", category: "messages", text: "A complete message ready for reading.",
  author: "Test author", weight: 1, enabled: true, colorful: false, format: {}, markup: false, corrected_text: null,
}];
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}), headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.addInitScript(() => { Math.random = () => 0.5; });
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
    await page.clock.setFixedTime(new Date("2026-01-15T12:00:00Z"));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let releaseLauncher;
    const launcherGate = new Promise(resolve => { releaseLauncher = resolve; });
    await page.route("**/online/scripts/launcher.js**", async route => {
      await launcherGate;
      await route.continue();
    });
    const launcherRequested = page.waitForRequest("**/online/scripts/launcher.js**");
    await page.goto(`${server.origin}/online/`, { waitUntil: "domcontentloaded" });
    await launcherRequested;
    assert.equal(await page.locator("#interface-shell").getAttribute("aria-busy"), null, "Static content stays readable during initialization");
    await page.keyboard.press("Tab");
    assert.ok((await page.locator("#identity-name").ariaSnapshot()).includes("Bits"), "Heading semantics are available after keyboard boot skip, before controls initialize");
    await page.keyboard.press("Control+k");
    releaseLauncher();
    await page.locator("#bits-launcher").waitFor({ state: "visible" });
    assert.equal(await page.locator("#bits-launcher-search").evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.boot), "complete");
    await page.locator("#bits-launcher-search").fill("settings");
    await page.keyboard.press("Enter");
    await page.locator("#settings-window").waitFor({ state: "visible" });
    assert.equal(await page.locator("#settings-window").evaluate(node => node.contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#settings-window").isVisible(), false);
    assert.ok(await page.evaluate(() => document.activeElement !== document.body && document.activeElement.getClientRects().length > 0),
      "Closing a launcher-opened window restores visible keyboard focus");
    await page.unroute("**/online/scripts/launcher.js**");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("skip-link")), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#interface-shell").evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Meta+k");
    await page.locator("#bits-launcher").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement === document.querySelector("#interface-shell"));
    const shell = page.locator("#interface-shell");
    await shell.focus();
    await page.keyboard.type("help");
    assert.equal(await page.evaluate(() => commandInput), "", "Single-letter shortcuts never intercept screen-reader browsing outside the terminal");
    const terminal = page.locator(".command-line");
    await page.waitForFunction(() => document.querySelector("#accessible-message").textContent.includes("A complete message ready for reading."));
    await page.keyboard.press("Control+k");
    await page.locator("#bits-launcher").waitFor({ state: "visible" });
    await page.evaluate(() => new Promise(resolve => {
      const dialog = document.querySelector("#bits-launcher");
      dialog.addEventListener("close", resolve, { once: true });
      dialog.close();
      document.querySelector(".command-line").focus();
    }));
    assert.equal(await terminal.evaluate(node => node === document.activeElement), true,
      "A delayed launcher close event must not steal newly selected keyboard focus");
    await terminal.focus();
    const terminalSnapshot = await terminal.ariaSnapshot();
    assert.ok(terminalSnapshot.includes("A complete message ready for reading."), terminalSnapshot);
    await page.keyboard.type("he");
    await page.keyboard.press("Control+Space");
    assert.equal(await page.evaluate(() => commandInput), "help");
    await page.keyboard.press("Tab");
    assert.equal(await terminal.evaluate(node => node === document.activeElement), false, "Tab always leaves the terminal");
    await terminal.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => commandInput), "");
    assert.equal(await page.locator("#terminal-output").getAttribute("aria-live"), "polite");

    await page.evaluate(() => { window.BITS_DESKTOP_WINDOWS.open("settings"); window.BITS_DESKTOP_WINDOWS.open("about"); });
    await page.locator("#settings-text-size").focus();
    assert.equal(await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.state().find(app => app.active)?.slug), "settings");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => commandInput), "", "Native select arrows do not enter terminal commands");
    const readableText = page.locator("#settings-readable-text");
    await readableText.focus();
    await page.keyboard.press("Space");
    assert.equal(await readableText.isChecked(), true, "Space toggles native checkboxes without entering terminal commands");
    await page.keyboard.press("Space");
    assert.equal(await readableText.isChecked(), false);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#settings-window").isVisible(), false, "Escape closes the keyboard-focused window, not the last mouse-selected window");
    assert.equal(await page.locator("#about-window").isVisible(), true);
    await page.locator("#about-window [data-window-close]").focus();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#about-window").isVisible(), false);
    assert.ok(await page.evaluate(() => document.activeElement !== document.body && document.activeElement.getClientRects().length > 0),
      "Closing a keyboard-focused window restores visible focus");
    await page.locator("#terminal-output").focus();
    assert.equal(await page.locator("#terminal-output").evaluate(node => node === document.activeElement), true,
      "Scrollable terminal output is keyboard reachable");
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
    assert.deepEqual(violations, [], `${width}px keyboard-first page accessibility`);
    await page.evaluate(() => sessionStorage.removeItem("bits-boot-seen-v1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.boot === "complete"
      && document.documentElement.dataset.runtime === "ready");
    if (width > 720) {
      assert.equal(await shell.evaluate(node => node === document.activeElement), true,
        "Automatic boot restores focus to visible main content without any interaction");
    }
    assert.ok((await page.locator("#identity-name").ariaSnapshot()).includes("Bits"),
      "Main content is exposed after automatic startup without keyboard or pointer input");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: no-click initialization, early Ctrl/Cmd+K, skip link, accessible complete messages, native keys, terminal Tab escape, focused-window Escape, and focus restoration`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
