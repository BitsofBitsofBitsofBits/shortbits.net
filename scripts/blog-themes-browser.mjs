import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const rootIndex = process.argv.indexOf("--root");
const shotsIndex = process.argv.indexOf("--screenshots");
const shots = shotsIndex < 0 ? null : resolve(process.argv[shotsIndex + 1]);
if (shots) await mkdir(shots, { recursive: true });
const server = await startSiteServer(resolve(rootIndex < 0 ? ".site-build" : process.argv[rootIndex + 1]));
const fixtures = JSON.parse(await readFile(new URL("./fixtures/blog-posts.json", import.meta.url), "utf8"));
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const routes = ["/blog/", "/blog/articles/first-lab-notes/", "/blog/post.html?slug=first-lab-notes"];
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}), headless: true,
  });
  async function mock(context) {
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      const json = body => route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body),
      });
      if (url.pathname.endsWith("/site_blog_public_posts")) {
        const slug = url.searchParams.get("slug")?.slice(3);
        return json(fixtures.filter(post => post.published && Date.parse(post.published_at) <= Date.now() && (!slug || post.slug === slug)));
      }
      if (url.pathname.endsWith("/get_blog_post_views")) return json(1);
      if (url.pathname.includes("/rest/v1/")) return json([]);
      return url.origin === server.origin ? route.continue() : route.abort();
    });
  }
  async function ready(page, path) {
    await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: "Theme settings", exact: true });
    await trigger.waitFor();
    assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), false, "Settings stay out of the page until opened");
    await trigger.press("Enter");
    assert.equal(await page.getByRole("dialog", { name: "Theme settings" }).isVisible(), true);
    assert.equal(await page.locator("[data-blog-theme-settings]").evaluate(node => node.matches(":modal")), true);
  }
  async function openPicker(page) {
    const picker = page.locator(".blog-theme-settings .theme-picker");
    if (await picker.getAttribute("open") === null) {
      await Promise.all([
        page.evaluate(() => new Promise(resolve => {
          const picker = document.querySelector(".blog-theme-settings .theme-picker");
          const opened = event => {
            if (event.target !== picker || !picker.open) return;
            picker.removeEventListener("toggle", opened);
            resolve();
          };
          picker.addEventListener("toggle", opened);
        })),
        picker.locator(":scope > summary").click(),
      ]);
    }
    return picker;
  }
  async function theme(page, id, variant = null) {
    const picker = await openPicker(page);
    const group = await page.evaluate(id => window.BITS_THEME_PREFERENCE.getGroups()
      .find(group => group.themes.some(theme => theme.id === id)).name, id);
    const family = picker.locator(".theme-picker-list > .theme-picker-branch")
      .filter({ has: page.getByText(group, { exact: true }) });
    if (await family.getAttribute("open") === null) await family.locator(":scope > summary").click();
    const selector = `[data-theme="${id}"]${variant ? `[data-variant="${variant}"]` : ""}`;
    const choice = family.locator(selector).first();
    const submenu = family.locator(":scope > .theme-picker-branch").filter({ has: page.locator(selector) });
    if (await submenu.count() && await submenu.getAttribute("open") === null) await submenu.locator(":scope > summary").click();
    await choice.click();
    assert.equal(await picker.getAttribute("open"), null, "Choosing a theme closes its family menu, not the popup");
    assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), true);
    await page.waitForFunction(id => {
      if (document.documentElement.dataset.interfaceTheme !== id) return false;
      const theme = window.BITS_THEME_PREFERENCE.getTheme(id);
      return !(theme.stylesheet || theme.experimental) || Boolean(document.querySelector("#bits-theme-stylesheet")?.sheet);
    }, id);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  async function audit(page, label) {
    const picker = await openPicker(page);
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running" && !animation.pending));
    if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector("[data-blog-theme-settings]"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })));
    assert.deepEqual(violations, [], `${label}: appearance controls are accessible`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${label}: no horizontal overflow`);
    const popup = await page.locator("[data-blog-theme-settings]").boundingBox();
    assert.ok(popup.y >= 0 && popup.y + popup.height <= await page.evaluate(() => innerHeight) + 1, `${label}: popup fits the viewport`);
    assert.ok(await picker.evaluate(node => node.scrollWidth <= node.clientWidth + 1), `${label}: family picker fits its popup`);
    for (const select of await page.locator(".blog-theme-controls select:visible").all()) {
      const bounds = await select.boundingBox();
      assert.ok(bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= await page.evaluate(() => innerWidth) + 1, `${label}: usable select bounds`);
    }
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await mock(context);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2027-01-15T12:00:00Z"));
    const errors = [];
    const resources = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => resources.push(new URL(request.url()).pathname));
    await ready(page, routes[0]);
    const themeSummary = page.locator(".blog-theme-settings .theme-picker > summary");
    assert.equal(await themeSummary.evaluate(node => node === document.activeElement), true, "Opening focuses the family picker");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.getByRole("button", { name: "Close theme settings" }).evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Tab");
    assert.equal(await themeSummary.evaluate(node => node === document.activeElement), true);
    await page.locator(".public-nav a").first().evaluate(node => node.focus());
    assert.equal(await themeSummary.evaluate(node => node === document.activeElement), true, "Modal popup keeps background navigation inert");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), false);
    const trigger = page.getByRole("button", { name: "Theme settings", exact: true });
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, "Escape restores focus to the top-navigation trigger");
    await trigger.press("Enter");
    await page.getByRole("button", { name: "Close theme settings" }).click();
    assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), false, "Close dismisses the popup");
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, "Close restores trigger focus");
    await trigger.press("Space");
    await page.mouse.click(2, 2);
    assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), false, "Backdrop click dismisses the popup");
    await trigger.press("Enter");
    const popup = await page.locator("[data-blog-theme-settings]").boundingBox();
    await page.mouse.click(popup.x + 4, popup.y + 4);
    assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), true, "Clicking popup padding does not dismiss it");
    await themeSummary.focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.locator("#blog-scheme-select").evaluate(node => node === document.activeElement), true);
    const optionIds = await page.locator("#blog-theme-select option").evaluateAll(options => options.map(option => option.value).sort());
    assert.deepEqual(optionIds, await page.evaluate(() => window.BITS_INTERFACE_THEMES.map(theme => theme.id).sort()), "Picker delegates seasonal and experimental availability to the shared catalog");
    assert.equal(await page.locator("#blog-theme-select").isVisible(), false, "Legacy native theme menu is replaced");
    assert.equal(await page.locator("#blog-variant-select").isVisible(), false, "Variants live inside theme branches");
    const families = await page.locator(".theme-picker-list > .theme-picker-branch > summary").allTextContents();
    assert.deepEqual(families, await page.evaluate(() => window.BITS_THEME_PREFERENCE.getGroups().map(group => group.name)), "Blog uses the same family listing as the main menu");
    assert.ok(families.includes("Windows") && families.includes("macOS"));
    const choices = await page.locator(".theme-picker-choice").evaluateAll(buttons => [...new Set(buttons.map(button => button.dataset.theme))].sort());
    assert.deepEqual(choices, optionIds, "Family choices retain every available theme");
    await theme(page, "aqua", "graphite");
    await openPicker(page);
    const aqua = page.locator(".theme-picker-branch").filter({
      has: page.locator('[data-theme="aqua"][data-variant="graphite"]'),
    }).last();
    await aqua.locator(":scope > summary").focus();
    await page.keyboard.press("Escape");
    assert.equal(await aqua.getAttribute("open"), null, "Escape closes the nested theme branch");
    assert.equal(await page.locator(".theme-picker").getAttribute("open"), "");
    await themeSummary.focus();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".theme-picker").getAttribute("open"), null);
    assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), true, "Family-menu Escape does not close its parent popup");
    for (const id of ["default", "aero-glass", "html", "high-contrast"]) {
      await theme(page, id, id === "aero-glass" ? "windows-7" : null);
      if (id !== "html") {
        for (const scheme of ["dark", "light"]) {
          await page.locator("#blog-scheme-select").selectOption(scheme);
          await audit(page, `${width}px ${id}/${scheme}`);
        }
      } else {
        assert.equal(await page.locator("#blog-scheme-select").isVisible(), false);
        assert.equal(await page.locator("#blog-variant-select").isVisible(), false);
        assert.equal(await page.locator("html").getAttribute("data-color-scheme"), "light");
        await audit(page, `${width}px HTML`);
      }
    }
    await theme(page, "aurora", "amethyst");
    assert.equal(await page.locator("#blog-scheme-select").isVisible(), false);
    assert.equal(await page.locator('[data-theme="aurora"][data-variant="amethyst"]').count(), 1);
    assert.equal(await page.locator("html").getAttribute("data-color-scheme"), "dark");
    await theme(page, "aero-glass", "rose");
    await page.locator("#blog-scheme-select").selectOption("light");
    for (const [index, path] of routes.entries()) {
      await ready(page, path);
      assert.equal(await page.locator("#blog-theme-select").inputValue(), "aero-glass");
      assert.equal(await page.locator("#blog-scheme-select").inputValue(), "light");
      assert.equal(await page.locator("#blog-variant-select").inputValue(), "rose");
      assert.match(await page.locator(".blog-theme-settings .theme-picker > summary").textContent(), /Windows \/ AERO GLASS \/ ROSE/);
      if (index) {
        await page.waitForFunction(() => !document.querySelector("#blog-post").hidden);
        assert.equal(await page.locator("#blog-post-title").textContent(), "First lab notes", "Live publishing remains functional");
        const toc = page.locator("#blog-post-toc details");
        assert.equal(await toc.evaluate(node => node.open), false);
        await page.getByRole("button", { name: "Close theme settings" }).click();
        await toc.locator("summary").press("Enter");
        assert.ok(await toc.locator("a").count());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.addScriptTag({ path: axePath });
        assert.deepEqual(await page.evaluate(async () => (await axe.run(document.querySelector("#blog-post-toc"), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })).violations.map(issue => issue.id)), [], `${width}px ${path} expanded TOC is accessible`);
        if (shots) await page.screenshot({ path: join(shots, `toc-themes-${index}-${width}.png`), fullPage: true });
        await toc.locator("summary").press("Enter");
        await page.getByRole("button", { name: "Theme settings", exact: true }).click();
      }
      await audit(page, `${width}px ${path} persisted settings`);
      if (shots) {
        await page.screenshot({ path: join(shots, `blog-themes-${index}-${width}.png`), fullPage: true });
        if (index === 0) {
          await page.getByRole("button", { name: "Close theme settings" }).click();
          await page.screenshot({ path: join(shots, `blog-themes-closed-${width}.png`), fullPage: true });
          await page.getByRole("button", { name: "Theme settings", exact: true }).click();
        }
      }
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator("[data-blog-theme-settings]").isVisible(), false, "Controls stay out of print");
      assert.equal(await page.locator("#blog-post-toc details").isVisible(), false, "TOC stays out of print");
      await page.emulateMedia({ media: "screen" });
    }
    await page.goto(`${server.origin}/professional/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#profile-theme-select").inputValue(), "aero-glass");
    assert.equal(await page.locator("#profile-scheme-select").inputValue(), "light");
    assert.equal(await page.locator("#profile-variant-select").inputValue(), "rose");
    await ready(page, routes[0]);
    const second = await context.newPage();
    await second.clock.setFixedTime(new Date("2027-01-15T12:00:00Z"));
    await ready(second, routes[1]);
    await theme(page, "default");
    await second.waitForFunction(() => document.querySelector("#blog-theme-select").value === "default");
    await page.locator("#blog-scheme-select").selectOption("dark");
    await second.waitForFunction(() => document.querySelector("#blog-scheme-select").value === "dark");
    await theme(page, "aero-glass", "frost");
    await second.waitForFunction(() => document.querySelector("#blog-variant-select").value === "frost");
    assert.match(await second.locator(".theme-picker > summary").textContent(), /FROST/);
    await page.evaluate(() => localStorage.clear());
    await second.waitForFunction(() => document.querySelector("#blog-theme-select").value === window.BITS_THEME_PREFERENCE.resolve());
    assert.equal(await second.locator("#blog-scheme-select").inputValue(), "auto");
    assert.deepEqual(errors, []);
    assert.equal(resources.some(path => path.startsWith("/online/scripts/")), false, "Blog settings do not load the Online desktop runtime");
    await context.close();
    console.log(`PASS ${width}px blog settings popup: keyboard, modal isolation/focus restoration, close/Escape/backdrop, theme/mode/variant, three routes, shared preferences, cross-tab updates, contrast, responsive controls, and print`);
  }
  const seasonal = await browser.newContext();
  await mock(seasonal);
  const page = await seasonal.newPage();
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await ready(page, routes[0]);
  assert.ok(await page.locator('#blog-theme-select option[value="spooky"]').count(), "In-season theme is available");
  await theme(page, "spooky");
  await ready(page, routes[1]);
  assert.equal(await page.locator("#blog-theme-select").inputValue(), "spooky");
  await theme(page, "default");
  await ready(page, routes[2]);
  assert.equal(await page.locator("#blog-theme-select").inputValue(), "default", "Standard choice preserves shared seasonal dismissal");
  await seasonal.close();
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  for (const path of routes.slice(0, 2)) {
    await staticPage.goto(`${server.origin}${path}`);
    assert.equal(await staticPage.locator("[data-blog-theme-settings]").isVisible(), false);
    assert.equal(await staticPage.locator(".blog-theme-trigger").count(), 0, "No inactive popup trigger without JavaScript");
  }
  await noScript.close();
  console.log("PASS seasonal selection/dismissal and no-JavaScript progressive enhancement");
} finally {
  await browser?.close();
  await server.close();
}
