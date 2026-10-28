import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const server = await startSiteServer(resolve(rootIndex < 0 ? "." : args[rootIndex + 1]));
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const themes = ["windows-10", "windows-11", "windows-8", "browser", "termius",
  "m365", "google", "youtube", "youtube-music", "legacy-bios"];
let browser;
let currentPage;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("bits-boot-seen-v1", "true");
      Math.random = () => 0.5;
    });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === server.origin
      ? route.continue() : route.abort());
    const page = await context.newPage();
    currentPage = page;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource")
      .some((entry) => entry.name.includes("desktop-workspaces"))), false, "Workspaces do not load at startup");
    await page.addScriptTag({ path: axePath });

    for (const id of themes) {
      await page.locator("#interface-theme-select").selectOption(id, { force: true });
      await page.locator("#desktop-workspace-entry").click();
      await page.waitForFunction((theme) => document.body.dataset.desktopWorkspace === theme, id).catch(async (error) => {
        console.error({ errors, state: await page.evaluate(() => ({
          theme: document.documentElement.dataset.interfaceTheme,
          body: { ...document.body.dataset },
          desktopHidden: document.querySelector("#fake-desktop").hidden,
          error: document.querySelector("#desktop-workspace-error")?.textContent,
          assets: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("desktop-workspaces")).map((entry) => entry.name),
        })) });
        throw error;
      });
      assert.equal(await page.locator(".workspace-chrome").count(), 1);
      assert.equal(await page.locator(".workspace-home").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.interfaceTheme), id);
      assert.equal(await page.locator(".fake-desktop-icons").isVisible(), false);
      assert.equal(await page.evaluate(() => window.BITS_THEME_PREFERENCE.getTheme(
        document.documentElement.dataset.interfaceTheme).experimental), true);
      await page.locator(".workspace-launcher > summary").click();
      await page.locator(".workspace-launch-panel input").fill("about");
      await page.locator('.workspace-launch-list [data-app="about"]').click();
      assert.equal(await page.locator("#about-window").isVisible(), true, `${id} launches real About app`);
      await page.locator("#about-window").evaluate((element) => { element.dataset.workspaceTest = "preserved"; });
      await page.locator('.workspace-header [data-workspace-key="settings"]').click();
      assert.equal(await page.locator("#settings-window").isVisible(), true);
      assert.equal(await page.locator("#about-window").getAttribute("hidden"), null, "Switching does not close apps");
      await page.locator('[data-close-app="settings"]').click();
      assert.equal(await page.locator("#about-window").isVisible(), true, "Closing a panel restores the remaining app");
      assert.equal(await page.locator("#about-window").getAttribute("data-workspace-test"), "preserved");
      await page.locator("#about-window [data-window-minimize]").click();
      assert.equal(await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.state()
        .find((app) => app.slug === "about").minimized), true);
      await page.locator('[data-running="about"]').click();
      assert.equal(await page.locator("#about-window").isVisible(), true);

      const search = page.locator(".workspace-search input");
      await page.keyboard.press("Control+k");
      assert.equal(await search.evaluate((element) => element === document.activeElement), true,
        "Workspace command shortcut does not also open the global launcher");
      await search.fill(id === "termius" ? "open hardware" : "bits://hardware");
      await search.press("Enter");
      assert.equal(await page.locator("#hardware-window").isVisible(), true, "Command/search opens real hardware");
      if (await page.locator("body").getAttribute("data-workspace-mode") === "tabbed") {
        assert.ok(await page.locator("#hardware-window").evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
        }), "Docked app fits the actual viewport");
      }
      await page.locator(".workspace-launcher > summary").click();
      await page.locator(".workspace-launch-panel input").press("Escape");
      assert.equal(await page.locator(".workspace-launcher").getAttribute("open"), null);
      assert.equal(await page.locator("#hardware-window").getAttribute("hidden"), null, "Escape closes launcher, not app");
      await search.fill("definitely-not-an-app");
      assert.match(await page.locator(".workspace-results").textContent(), /No matching apps/);
      await search.fill("");
      await page.locator(".workspace-home-button").click();
      if (id === "m365") {
        assert.equal(await page.locator('.workspace-recents [data-app="hardware"]').isVisible(), true);
      }
      await page.locator(".workspace-tools > summary").click();
      await page.locator(".workspace-tool-list button", { hasText: /^CoBits$/ }).click();
      assert.equal(await page.locator("#fake-cobits").isVisible(), true);
      await page.locator("#fake-cobits-input").fill("Workspace state");
      await page.locator("#fake-cobits [data-fake-app-close]").click();
      await page.locator(".workspace-tools > summary").click();
      await page.locator(".workspace-tool-list button", { hasText: /^CoBits$/ }).click();
      assert.equal(await page.locator("#fake-cobits-input").inputValue(), "Workspace state");
      await page.locator("#fake-cobits [data-fake-app-close]").click();
      await page.locator(".workspace-home-button").click();
      if (id === "legacy-bios") {
        const cards = page.locator(".workspace-app-card:not(:disabled)");
        await cards.first().focus();
        await page.keyboard.press("ArrowDown");
        assert.equal(await cards.nth(1).evaluate((element) => element === document.activeElement), true);
        await page.keyboard.press("Home");
        assert.equal(await cards.first().evaluate((element) => element === document.activeElement), true);
      }
      if (id === "youtube-music") {
        await page.evaluate(() => {
          document.querySelector("#spotify-track").textContent = "Live test track";
          document.querySelector("#spotify-artist").textContent = "Live test artist";
        });
        await page.waitForFunction(() => document.querySelector(".workspace-track").textContent.includes("Live test artist"));
        assert.match(await page.locator(".workspace-track").textContent(), /Live test track/);
        await page.locator(".workspace-player button").click();
        assert.equal(await page.locator("#spotify-window").isVisible(), true);
        await page.locator(".workspace-home-button").click();
      }
      await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.resetLayout());
      for (const scheme of ["dark", "light"]) {
        await page.evaluate((value) => window.BITS_THEME_PREFERENCE.setColorScheme(value), scheme);
        const violations = await page.evaluate(async () => (await axe.run({
          include: [[".workspace-chrome"], [".workspace-home"]],
        }, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })).violations.map((issue) => ({
          id: issue.id, nodes: issue.nodes.map((item) => ({ target: item.target, summary: item.failureSummary })),
        })));
        assert.deepEqual(violations, [], `${id} ${scheme} ${width}px accessibility`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${id} has no horizontal page overflow`);
      assert.ok(await page.locator(".workspace-home").evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        `${id} app library has no horizontal overflow`);
      await page.locator("#cookie-notice").evaluate((element) => { element.hidden = false; });
      assert.ok(await page.locator("#cookie-dismiss").evaluate((element) => {
        const reserved = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--workspace-bottom"));
        return element.getBoundingClientRect().bottom <= innerHeight - reserved;
      }), "Global notices remain above the workspace dock/player");
      await page.locator("#cookie-dismiss").click();
      if (id === "legacy-bios") await page.keyboard.press("F10");
      else await page.locator(".workspace-exit").click();
      assert.equal(await page.locator(".workspace-chrome").count(), 0);
      assert.equal(await page.locator("#fake-cobits").evaluate((element) => element.parentElement.id), "fake-desktop");
      assert.equal(await page.locator("#interface-shell").isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.interfaceTheme), id);
      console.log(`PASS ${width}px ${id}: apps, switching, minimize, commands, utilities, cleanup, accessibility`);
    }

    await page.locator("#interface-theme-select").selectOption("browser", { force: true });
    await page.locator("#desktop-workspace-entry").click();
    await page.waitForSelector('body[data-desktop-workspace="browser"]');
    await page.evaluate(() => {
      window.BITS_DESKTOP_WINDOWS.open("about");
      window.BITS_DESKTOP_WINDOWS.open("hardware");
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.deepEqual(await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.state().map((app) => app.slug).sort()),
      ["about", "hardware"], "Deep-linked open apps survive reload");
    await page.evaluate(() => document.querySelector("#desktop-workspace-entry").click());
    await page.waitForSelector('body[data-desktop-workspace="browser"]');
    await page.locator("#interface-theme-select").selectOption("termius", { force: true });
    await page.waitForSelector('body[data-desktop-workspace="termius"]');
    assert.equal(await page.locator(".workspace-chrome").count(), 1, "Live switching creates no duplicate workspace");
    assert.equal(await page.locator("#hardware-window").isVisible(), true);
    await page.locator("#interface-theme-select").selectOption("default", { force: true });
    assert.equal(await page.locator(".workspace-chrome").count(), 0);
    assert.equal(await page.locator(".fake-desktop-icons").isVisible(), true, "Standard desktop restored");
    await page.locator("#interface-theme-select").selectOption("google", { force: true });
    await page.waitForSelector('body[data-desktop-workspace="google"]');
    assert.equal(await page.locator("#hardware-window").isVisible(), true, "App state survives standard/experimental switches");
    assert.deepEqual(errors, [], "No uncaught runtime errors");
    console.log(`PASS ${width}px live theme transitions, standard desktop, and URL restoration`);
    await context.close();
  }
  const recovery = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
  await recovery.addInitScript(() => {
    sessionStorage.setItem("bits-boot-seen-v1", "true");
    localStorage.setItem("bits-interface-theme", "browser");
  });
  await recovery.route("**/*", (route) => new URL(route.request().url()).origin === server.origin
    ? route.continue() : route.abort());
  const page = await recovery.newPage();
  currentPage = page;
  await page.clock.setFixedTime(new Date("2026-10-30T12:00:00Z"));
  await page.route("**/online/styles/desktop-workspaces.css?*", (route) => route.abort());
  await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
  await page.locator("#interface-theme-select").selectOption("browser", { force: true });
  await page.locator("#desktop-workspace-entry").click();
  await page.waitForSelector("#desktop-workspace-error");
  assert.equal(await page.locator(".fake-desktop-icons").isVisible(), true, "Load failure keeps the standard desktop usable");
  await page.unroute("**/online/styles/desktop-workspaces.css?*");
  await page.locator("#desktop-workspace-error button").click();
  await page.waitForSelector('body[data-desktop-workspace="browser"]');
  assert.equal(await page.locator("#desktop-workspace-error").count(), 0, "Retry clears the visible load error");
  assert.equal(await page.locator(".workspace-chrome").count(), 1);
  await recovery.close();
  console.log("PASS visible asset failure, usable regular desktop, and successful workspace retry");
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    console.error(await currentPage.evaluate(() => [...document.querySelectorAll(
      ".workspace-footer,.workspace-running,.workspace-running-app,[data-close-app=settings]",
    )].map((element) => ({
      selector: element.className || element.dataset.closeApp,
      rect: element.getBoundingClientRect().toJSON(),
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      scrollLeft: element.scrollLeft, display: getComputedStyle(element).display,
    }))));
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
