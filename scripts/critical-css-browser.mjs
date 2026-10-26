import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const server = await startSiteServer(resolve(rootIndex < 0 ? ".site-build" : args[rootIndex + 1]));
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    let release;
    const fullCss = new Promise((resolveCss) => { release = resolveCss; });
    await context.addInitScript(() => {
      sessionStorage.setItem("bits-boot-seen-v1", "true");
      Math.random = () => 0.5;
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== server.origin) return route.abort();
      if (url.pathname === "/online/styles/site.css") await fullCss;
      if (url.pathname.endsWith(".js") && !["/online/scripts/startup.js", "/online/scripts/online-runtime.js"].includes(url.pathname)) {
        return route.fulfill({ contentType: "text/javascript", body: "" });
      }
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${server.origin}/online/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => performance.getEntriesByName("first-contentful-paint").length > 0);
    assert.equal(await page.locator("style[data-online-critical]").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.runtime), "pending");
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource").some(
      (entry) => new URL(entry.name).pathname === "/online/scripts/script.js",
    )), false, "enhancements must wait for full styles");
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    const themes = await page.evaluate(() => window.BITS_INTERFACE_THEMES.filter((theme) => !theme.experimental)
      .flatMap((theme) => (theme.schemes || ["dark", "light"]).map((scheme) => ({ id: theme.id, scheme }))));
    async function snapshot(theme) {
      return page.evaluate(({ id, scheme }) => {
        document.documentElement.dataset.interfaceTheme = id;
        document.documentElement.dataset.colorScheme = scheme;
        const properties = [
          "display", "color", "backgroundColor", "fontFamily", "fontSize",
          "lineHeight", "borderTopWidth", "borderTopColor", "padding", "margin",
          "width", "boxShadow", "visibility",
        ];
        return [...document.querySelectorAll(
          "#interface-shell,.profile,.identity,.bio,.command-line,.featured-section,.app-menu-bar,.link-card",
        )].filter((element) => !element.closest("[hidden]")).map((element) => {
          const style = getComputedStyle(element);
          return [element.id || element.className, ...properties.map((property) => style[property])];
        });
      }, theme);
    }
    const before = [];
    for (const theme of themes) before.push(await snapshot(theme));
    release();
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    for (let index = 0; index < themes.length; index++) {
      assert.deepEqual(await snapshot(themes[index]), before[index],
        `${width}px ${themes[index].id} ${themes[index].scheme}: full CSS changed first-paint styles`);
    }
    console.log(`PASS ${width}px: content paints before full CSS, controls wait, and first-paint styles match across ${themes.length} theme/scheme combinations`);
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  await context.route("**/*", (route) => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
  await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#interface-shell").isVisible(), true);
  assert.equal(await page.locator("noscript link[rel=stylesheet]").count(), 1);
  assert.ok(await page.evaluate(() => [...document.styleSheets].some((sheet) => sheet.href?.includes("/online/styles/site.css"))));
  console.log("PASS JavaScript-disabled stylesheet fallback");
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
