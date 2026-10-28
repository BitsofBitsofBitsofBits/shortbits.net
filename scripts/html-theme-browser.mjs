import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const screenshotsIndex = args.indexOf("--screenshots");
const screenshots = screenshotsIndex < 0 ? null : resolve(args[screenshotsIndex + 1]);
if (screenshots) await mkdir(screenshots, { recursive: true });
const server = await startSiteServer(resolve(rootIndex < 0 ? "." : args[rootIndex + 1]));
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const rows = ["messages", "activities"].map((category, position) => ({
  position: position + 1, profile: "standard", category, text: "HTML THEME PREVIEW", weight: 1,
  colorful: false, format: {}, enabled: true, markup: false, corrected_text: null,
}));
async function ready(page) {
  await page.waitForFunction(() => document.documentElement.dataset.interfaceTheme === "html"
    && document.querySelector("#bits-theme-stylesheet")?.sheet);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function audit(page, label, scope = "document") {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async scope => {
    const target = scope === "document" ? document : document.querySelector(scope);
    return (await axe.run(target, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
  }, scope);
  assert.deepEqual(violations, [], `${label}: accessibility`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${label}: no horizontal overflow`);
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
      localStorage.setItem("bits-color-scheme", "dark");
      localStorage.setItem("bits-message-catalog-v2", JSON.stringify({ rows, pools: [], timezone: "UTC", loadedAt: Date.now() }));
    }, rows);
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      const now = Date.now();
      const json = body => route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body),
      });
      if (url.pathname.includes("/rest/v1/")) return json(url.pathname.endsWith("/site_message_catalog") ? rows
        : url.pathname.endsWith("/site_message_settings") ? [{ id: "primary", timezone: "UTC" }] : []);
      if (url.pathname.endsWith("/functions/v1/spotify-now-playing")) return json({
        item: { title: "HTML audio", artists: ["Test artist"], durationMs: 180000, albumArt: null },
        isPlaying: true, progressMs: 1000, servedAt: now, sessionStartedAt: new Date(now - 300000).toISOString(),
      });
      if (url.pathname.endsWith("/functions/v1/youtube-presence")) return json({
        item: { videoId: "abcdefghijk", title: "HTML video", channel: "Test channel", durationMs: 180000 },
        isPlaying: true, progressMs: 1000, updatedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 90000).toISOString(), sessionStartedAt: new Date(now - 600000).toISOString(),
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    try {
      await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    } catch (error) {
      throw new Error(`Online runtime failed to start: ${JSON.stringify(errors)}`, { cause: error });
    }
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("/layouts/html.css")).length), 0, "Default does not download the HTML skin");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    const picker = page.locator("#settings-window .theme-picker");
    await picker.locator(":scope > summary").click();
    await picker.locator('summary:text-is("Essentials")').click();
    await picker.locator('[data-theme="html"]').click();
    await ready(page);
    assert.equal(await page.locator("#interface-theme-select").inputValue(), "html");
    assert.equal(await page.locator("#settings-scheme").isVisible(), false, "HTML intentionally locks to light mode");
    assert.equal(await page.locator("#settings-variant").isVisible(), false);
    assert.equal(await page.locator("html").getAttribute("data-color-scheme"), "light");
    assert.equal(await page.locator("#bits-layout-runtime").count(), 0, "HTML is a skin, not an experimental workspace");
    const native = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const link = getComputedStyle(document.querySelector(".media-presentation-link"));
      const button = getComputedStyle(document.querySelector("#settings-reset-all"));
      return { background: body.backgroundColor, color: body.color, font: body.fontFamily,
        link: link.color, underline: link.textDecorationLine, appearance: button.appearance,
        shellShadow: getComputedStyle(document.querySelector("#interface-shell")).boxShadow,
        atmosphere: getComputedStyle(document.querySelector("#theme-atmosphere")).display };
    });
    assert.equal(native.background, "rgb(255, 255, 255)");
    assert.equal(native.color, "rgb(0, 0, 0)");
    assert.match(native.font, /Times|serif/);
    assert.equal(native.link, "rgb(0, 0, 238)");
    assert.equal(native.underline, "underline");
    assert.equal(native.appearance, "auto");
    assert.equal(native.shellShadow, "none");
    assert.equal(native.atmosphere, "none");
    const formattedFonts = await page.evaluate(() => {
      const sample = document.createElement("span");
      document.body.append(sample);
      window.BITS_MESSAGE_TEXT.render(sample, { text: "{{font:mono|MONOSPACE}}", markup: true });
      const preset = getComputedStyle(sample.firstElementChild).fontFamily;
      window.BITS_MESSAGE_TEXT.render(sample, {
        text: "{{font:custom:Courier New|CUSTOM}}", markup: true,
        format: { fontFamily: "Georgia", fontWeight: "700" },
      });
      const custom = getComputedStyle(sample.firstElementChild).fontFamily;
      const whole = getComputedStyle(sample);
      const result = { preset, custom, whole: whole.fontFamily, weight: whole.fontWeight };
      sample.remove();
      return result;
    });
    assert.match(formattedFonts.preset, /monospace/, "Explicit message formatting is not reset by the skin");
    assert.match(formattedFonts.custom, /Courier New/);
    assert.match(formattedFonts.whole, /Georgia/);
    assert.equal(formattedFonts.weight, "700");
    await audit(page, `${width}px settings`, "#settings-window");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.close("settings"));
    assert.equal(await page.locator("#settings-window").isVisible(), false, "Hidden windows stay hidden");
    await page.locator("#media-next").click();
    assert.equal(await page.locator("#spotify-widget").isVisible(), true);
    await page.locator("#media-previous").click();
    assert.equal(await page.locator("#youtube-widget").isVisible(), true);
    await page.emulateMedia({ forcedColors: "active" });
    assert.equal(await page.locator("#interface-shell").evaluate(node => getComputedStyle(node).backgroundImage), "none");
    await page.emulateMedia({ forcedColors: "none" });
    const clock = await page.locator("#youtube-current-time").textContent();
    await page.waitForFunction(previous => document.querySelector("#youtube-current-time").textContent !== previous, clock);
    await audit(page, `${width}px Online`);
    if (screenshots) await page.screenshot({ path: join(screenshots, `html-online-${width}.png`), fullPage: true });
    await page.locator('#contact-form input[name="name"]').fill("HTML visitor");
    await page.locator('#contact-form textarea[name="message"]').fill("Native inputs still work.");
    assert.equal(await page.locator("#contact-form").evaluate(form => form.checkValidity()), true);
    await audit(page, `${width}px contact`, "#contact-form");
    await page.reload({ waitUntil: "networkidle" });
    await ready(page);
    assert.equal(await page.locator("#interface-theme-select").inputValue(), "html", "Selection persists after reload");
    for (const path of ["/", "/professional/", "/blog/", "/boot/", "/nowplaying/"]) {
      await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await ready(page);
      assert.equal(await page.locator("html").getAttribute("data-color-scheme"), "light", `${path} preserves HTML`);
      await audit(page, `${width}px ${path}`);
      if (screenshots && path === "/professional/") await page.screenshot({
        path: join(screenshots, `html-professional-${width}.png`), fullPage: true,
      });
      if (path === "/professional/") {
        assert.ok(await page.locator("#profile-heading").evaluate(heading => {
          const firstLine = document.createRange();
          firstLine.selectNodeContents(heading.firstChild);
          return heading.querySelector("span").getBoundingClientRect().top >= firstLine.getBoundingClientRect().bottom - 2;
        }), "Native headings preserve the authored line break");
        await page.locator('#contact-form input[name="name"]').fill("HTML visitor");
        await page.locator('#contact-form textarea[name="message"]').fill("Professional contact still works.");
        assert.equal(await page.locator("#contact-form").evaluate(form => form.checkValidity()), true);
      }
      if (path === "/boot/") {
        await page.locator("#endless-boot-settings-toggle").click();
        await page.locator("#endless-boot-command-open").click();
        await page.locator("#endless-boot-command-input").fill("help");
        await page.locator("#endless-boot-command-input").press("Enter");
        assert.equal(await page.locator("#endless-boot-command-input").inputValue(), "", "The live boot console still accepts commands");
        assert.match(await page.locator("#endless-boot-command-output").textContent(), /COMMANDS: STATUS/);
        await page.locator("#endless-boot-command-close").click();
      }
      if (path === "/nowplaying/") {
        assert.equal(await page.locator("#spotify-widget").isVisible(), true);
        assert.equal(await page.locator("#youtube-widget").isVisible(), true);
      }
    }
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await ready(page);
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("settings"));
    await page.locator("#settings-theme").selectOption("default", { force: true });
    await page.waitForFunction(() => document.documentElement.dataset.interfaceTheme === "default"
      && !document.querySelector("#bits-theme-stylesheet"));
    assert.equal(await page.locator("html").getAttribute("data-color-scheme"), "dark", "Leaving HTML restores the user's color preference");
    assert.deepEqual(errors, [], "No JavaScript errors");
    await context.close();
    console.log(`PASS ${width}px HTML theme: native appearance, lazy loading, picker, persistence, media clocks, windows, forms, compact pages, accessibility and restoring themes`);
  }
} finally {
  await browser?.close();
  await server.close();
}
