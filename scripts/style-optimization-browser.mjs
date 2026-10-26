import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const index = args.indexOf("--root");
if (index < 0 || !args[index + 1]) throw new Error("--root requires a staged build directory.");
const root = resolve(args[index + 1]);
const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceStyles = (await Promise.all([
  "shared/styles/styles.css", "shared/styles/bsod-classic.css", "online/styles/launcher.css", "shared/styles/contact-reliability.css",
].map((file) => readFile(join(sourceRoot, file), "utf8")))).join("\n");
const server = await startSiteServer(root);
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
  });
  for (const width of [390, 1440]) {
    const contexts = await Promise.all([true, false].map(async (baseline) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 }, reducedMotion: "reduce",
      });
      await context.addInitScript(() => {
        sessionStorage.setItem("bits-boot-seen-v1", "true");
        localStorage.setItem("bits-theme-debug", "enabled");
        Math.random = () => 0.5;
      });
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== server.origin) return route.abort();
        if (baseline && url.pathname.endsWith(".css")) {
          const css = url.pathname === "/online/styles/site.css"
            ? sourceStyles : await readFile(join(sourceRoot, url.pathname.slice(1)), "utf8");
          return route.fulfill({ contentType: "text/css", body: css });
        }
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
      return { context, page };
    }));
    let themes = await contexts[0].page.evaluate(() => window.BITS_INTERFACE_THEMES.map((theme) => ({
      id: theme.id, experimental: theme.experimental, schemes: theme.schemes || ["dark", "light"],
    })));
    const themeIndex = args.indexOf("--theme");
    if (themeIndex >= 0) themes = themes.filter((theme) => theme.id === args[themeIndex + 1]);
    assert.ok(themes.length, "--theme must name an existing theme.");
    for (const theme of themes) {
      for (const scheme of theme.schemes) {
        const snapshots = await Promise.all(contexts.map(async ({ page }) => {
          await page.evaluate(({ theme, scheme }) => {
            localStorage.setItem("bits-color-scheme", scheme);
            window.BITS_THEME_PREFERENCE.apply(theme);
          }, { theme: theme.id, scheme });
          await page.waitForLoadState("networkidle");
          const stylesheet = page.locator("#bits-theme-stylesheet");
          if (await stylesheet.count()) await page.waitForFunction(() => document.querySelector("#bits-theme-stylesheet").sheet);
          if (theme.experimental) {
            await page.waitForFunction((id) => performance.getEntriesByType("resource").some(
              (entry) => new URL(entry.name).pathname === `/shared/scripts/layouts/${id}.js`,
            ), theme.id);
          }
          return page.evaluate(async () => {
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
            const properties = [
              "display", "color", "backgroundColor", "fontFamily", "fontSize",
              "lineHeight", "borderTopWidth", "borderTopColor", "padding", "margin",
              "width", "height", "boxShadow", "visibility",
            ];
            return [...document.querySelectorAll(
              "#interface-shell,.profile,.bio,.command-line,.featured-section,.desktop-window,.app-menu-bar,.link-card",
            )].map((element) => {
              const style = getComputedStyle(element);
              return [element.id || element.className, ...properties.map((property) => style[property])];
            });
          });
        }));
        const differences = snapshots[1].flatMap((entry, entryIndex) => (
          JSON.stringify(entry) === JSON.stringify(snapshots[0][entryIndex])
            ? [] : [{ element: entry[0], actual: entry, expected: snapshots[0][entryIndex] }]
        ));
        if (differences.length) {
          console.error(JSON.stringify(differences.slice(0, 3), null, 2));
        }
        assert.equal(differences.length, 0, `${width}px ${theme.id} ${scheme}: minification changed styles`);
      }
    }
    console.log(`PASS ${width}px: source and optimized styles match across ${themes.length} themes and supported color schemes.`);
    await Promise.all(contexts.map(({ context }) => context.close()));
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
