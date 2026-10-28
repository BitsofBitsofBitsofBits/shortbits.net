import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const rootIndex = process.argv.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : process.argv[rootIndex + 1]);
const server = await startSiteServer(root);
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const rows = [
  { position: 1, profile: "standard", category: "messages", text: "A complete readable message.",
    author: "Test author", weight: 1, enabled: true, colorful: false, format: {}, markup: false, corrected_text: null },
  { position: 2, profile: "standard", category: "activities", text: "An activity worth reading.",
    author: null, weight: 1, enabled: true, colorful: false, format: {}, markup: false, corrected_text: null },
];
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}), headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: "America/Chicago" });
    await context.addInitScript(rows => {
      sessionStorage.setItem("bits-boot-seen-v1", "true");
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
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-10-28T15:00:00Z") });
    await page.goto(`${server.origin}/online/?window=settings`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.equal(await page.locator("#settings-text-size").inputValue(), "default");
    for (const key of ["pause-content", "readable-text", "large-controls", "simple-layout", "transparency", "focus"]) {
      assert.equal(await page.locator(`#settings-${key}`).isChecked(), false, `${key} remains opt-in`);
    }
    assert.equal(await page.locator("#paused-message-controls").isVisible(), false);
    const normalPosition = await page.locator("#settings-window").evaluate(node => getComputedStyle(node).position);
    const normalResizeVisible = await page.locator("#settings-window [data-window-resize]").isVisible();
    assert.equal(normalPosition, "fixed");
    await page.locator("#settings-pause-content").check();
    await page.waitForFunction(() => document.querySelector("#typed-text").textContent.length > 0);
    const snapshot = await page.locator("#typed-text").textContent();
    const author = await page.locator("#typed-author").textContent();
    const activity = await page.locator("#activity-text").textContent();
    assert.equal(snapshot, await page.evaluate(() => window.BITS_MESSAGE_TEXT.plainText(currentMessage)));
    assert.equal(author, await page.evaluate(() => currentMessage.author ?? ""));
    await page.clock.fastForward(65_000);
    assert.equal(await page.locator("#typed-text").textContent(), snapshot);
    assert.equal(await page.locator("#typed-author").textContent(), author);
    assert.equal(await page.locator("#activity-text").textContent(), activity);
    assert.equal(await page.locator("#desktop-screensaver").isVisible(), false);
    assert.equal(await page.locator("#paused-message-controls").isVisible(), true);
    await page.locator("#message-history-next").click();
    assert.ok(await page.locator("#typed-text").textContent());
    await page.locator("#message-history-previous").click();
    assert.equal(await page.locator("#typed-text").textContent(), snapshot);

    await page.locator("#settings-text-size").selectOption("extra-large");
    for (const key of ["readable-text", "large-controls", "transparency", "focus", "simple-layout"]) {
      await page.locator(`#settings-${key}`).check();
    }
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "20px");
    assert.ok((await page.locator("#typed-text").evaluate(node => getComputedStyle(node).fontFamily)).includes("system-ui"));
    const target = await page.locator("#settings-window [data-window-close]").boundingBox();
    assert.ok(target.width >= 44 && target.height >= 44, "Window controls meet the 44px target");
    assert.equal(await page.locator("#settings-window").evaluate(node => getComputedStyle(node).backdropFilter), "none");
    assert.equal(await page.locator("#settings-window").evaluate(node => getComputedStyle(node).position), "relative");
    assert.equal(await page.locator("#settings-window [data-window-resize]").isVisible(), false);
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("about"));
    const positions = await page.locator(".desktop-window:not([hidden])").evaluateAll(nodes =>
      nodes.map(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
    assert.ok(positions.every((position, index) => !index || position.top >= positions[index - 1].bottom), "Simple windows never overlap");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.close("about"));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${width}px settings do not overflow`);
    await page.locator("#settings-text-size").focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth), "3px");
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#settings-window"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
    assert.deepEqual(violations, [], `${width}px settings accessibility`);

    const chooseTheme = async id => {
      await page.locator("#interface-theme-select").evaluate((select, value) => {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }, id);
      await page.waitForFunction(value => document.documentElement.dataset.interfaceTheme === value, id);
    };
    for (const theme of ["aero-glass", "macos"]) {
      await chooseTheme(theme);
      const box = await page.locator("#settings-window [data-window-close]").boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `${theme}: large controls override compact theme buttons`);
      assert.equal(await page.locator("#settings-window").evaluate(node => getComputedStyle(node).backdropFilter), "none");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${theme}: accessible settings fit`);
    }
    await chooseTheme("browser");
    assert.equal(await page.locator("[data-layout-chrome]").count(), 0, "Simple layout suspends experimental chrome");
    await page.locator("#settings-simple-layout").uncheck();
    await page.locator("#minimize-button").evaluate(node => node.click());
    await page.waitForFunction(() => document.body.dataset.desktopWorkspace === "browser");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    await page.locator("#settings-simple-layout").check();
    await page.waitForFunction(() => !document.body.dataset.desktopWorkspace);
    assert.equal(await page.locator(".workspace-chrome").count(), 0, "Enabling simple layout cleans up an active workspace");
    assert.equal(await page.locator("#settings-window").evaluate(node => getComputedStyle(node).position), "relative");
    await page.locator("#fake-desktop-restore").click();
    await chooseTheme("default");

    const other = await context.newPage();
    await other.goto(`${server.origin}/professional/`, { waitUntil: "networkidle" });
    assert.equal(await other.evaluate(() => getComputedStyle(document.documentElement).fontSize), "20px");
    assert.equal(await other.evaluate(() => document.documentElement.dataset.readableText), "on");
    await page.locator("#settings-text-size").selectOption("large");
    await other.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === "18px");
    await other.evaluate(() => localStorage.removeItem("bits-text-size"));
    await page.waitForFunction(() => document.querySelector("#settings-text-size").value === "default");
    for (const path of ["/professional/resume/", "/blog/", "/projects/", "/nowplaying/", "/admin/"]) {
      await other.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      assert.equal(await other.evaluate(() => document.documentElement.dataset.readableText), "on", `${path}: shared preference`);
      assert.ok(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${width}px ${path}: no overflow`);
    }
    await other.goto(`${server.origin}/professional/resume/`, { waitUntil: "networkidle" });
    await other.evaluate(() => window.BITS_ACCESSIBILITY.set("text-size", "extra-large"));
    await other.emulateMedia({ media: "print" });
    assert.equal(await other.evaluate(() => getComputedStyle(document.documentElement).fontSize), "16px");
    const printFont = await other.locator("body").evaluate(node => getComputedStyle(node).fontFamily);
    assert.ok(!printFont.startsWith("system-ui"), "Opt-in screen typography does not alter the print stylesheet");
    await other.emulateMedia({ media: "screen" });
    await other.goto(`${server.origin}/boot/`, { waitUntil: "networkidle" });
    assert.equal(await other.locator("#endless-boot-pause").getAttribute("aria-pressed"), "true");
    const bootCount = await other.locator("#endless-boot-log").locator(":scope > *").count();
    await other.clock.install();
    await other.clock.fastForward(10_000);
    assert.equal(await other.locator("#endless-boot-log").locator(":scope > *").count(), bootCount);
    await other.locator("#endless-boot-settings-toggle").click();
    await other.locator("#endless-boot-pause").click();
    await other.clock.fastForward(1000);
    assert.ok(await other.locator("#endless-boot-log").locator(":scope > *").count() > bootCount, "Explicitly resuming Boot output still works");
    await other.close();

    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#settings-pause-content").isChecked(), true);
    assert.equal(await page.locator("#settings-simple-layout").isChecked(), true);
    await page.locator("#settings-simple-layout").uncheck();
    assert.equal(await page.locator("#settings-window").evaluate(node => getComputedStyle(node).position), normalPosition);
    assert.equal(await page.locator("#settings-window [data-window-resize]").isVisible(), normalResizeVisible);
    await page.locator("#settings-pause-content").uncheck();
    assert.equal(await page.locator("#paused-message-controls").isVisible(), false);
    await page.clock.fastForward(1500);
    assert.ok(await page.evaluate(() => messageTimer !== undefined), "Automatic messages resume");
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#settings-reset-all").click();
    await page.waitForFunction(() => document.documentElement.dataset.pauseContent === "off"
      && document.documentElement.dataset.simpleLayout === "off");
    assert.equal(await page.locator("#settings-readable-text").isChecked(), false);
    assert.equal(await page.locator("#settings-text-size").inputValue(), "default");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px opt-in accessibility: defaults, paused/manual messages, larger targets, typography, focus, stacked layout, persistence, cross-tab reset, boot pause, and print isolation`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
