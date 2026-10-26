import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : args[rootIndex + 1]);
const server = await startSiteServer(root);
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const entry = (position, category, text, profile = "standard") => ({
  position, profile, category, text, weight: 1, colorful: false, format: {}, enabled: true, markup: false, corrected_text: null, author: null,
});
const publicRows = [
  { ...entry(1, "messages", "DATABASE STATUS"), author: "Test author 👩‍💻" },
  entry(2, "activities", "DATABASE ACTIVITY"),
  entry(3, "shutdownMessages", "DATABASE_SHUTDOWN"),
  entry(4, "bootMessages", "DATABASE BOOT .................... OK"),
  entry(5, "initialBootSteps", "DATABASE INITIAL BOOT"),
  entry(6, "monitor.cpu", "DATABASE CPU CHATTER"),
  entry(7, "playingDeadMessages", "DATABASE PLAYING DEAD"),
  entry(8, "glitchMessages", "DATABASE GLITCH"),
];
const markupRows = publicRows.map((row) => ({
  ...row, markup: true, text: `${row.text} **BOLD** {{color:red|red}} {{color:rainbow|彩色}}`,
  corrected_text: row.category === "messages" ? "DATABASE CORRECTED **BOLD** {{color:red|red}} {{color:rainbow|彩色}}" : null,
}));
const customPools = ["one", "two"].map((name) => ({
  id: `custom-${name}`, title: name, schedule: "annual", starts_on: "2000-01-01", ends_on: "2000-12-31",
  mode: "exclusive", enabled: true,
}));
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}), headless: true,
  });
  for (const width of args.includes("--admin-only") ? [] : [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    let fail = false;
    let useMarkup = false;
    let useCustom = false;
    const errors = [];
    await context.addInitScript(() => {
      sessionStorage.setItem("bits-boot-seen-v1", "true");
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => {
        const timer = schedule(callback, delay, ...args);
        if (typeof callback === "function" && callback.name === "updateMessage") {
          window.__messageTimer = timer;
          if (window.__pauseMessageTypewriter) window.clearTimeout(timer);
        }
        return timer;
      };
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/rest/v1/")) {
        const isCatalog = url.pathname.endsWith("/site_message_catalog");
        const data = url.pathname.endsWith("/site_message_settings") ? [{ id: "primary", timezone: "America/Chicago" }]
          : url.pathname.endsWith("/site_message_pools") ? (useCustom ? customPools : [])
          : isCatalog ? (useCustom ? [...markupRows, ...customPools.map((pool, index) => entry(9001 + index, "messages", `CUSTOM ${pool.title}`, pool.id))]
            : useMarkup ? markupRows : publicRows) : [];
        return route.fulfill({
          status: isCatalog && fail ? 503 : 200, contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data),
        });
      }
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    const dates = await page.evaluate(() => {
      const catalog = window.BITS_MESSAGE_CATALOG;
      const formatter = Intl.DateTimeFormat;
      try {
        if (typeof Temporal !== "undefined") Intl.DateTimeFormat = function () { throw new Error("Native timezone conversion initialized locale formatting."); };
        return ["2026-08-10T04:59:59Z", "2026-08-10T05:00:00Z", "2026-02-10T05:59:59Z", "2026-02-10T06:00:00Z"].map((instant) => {
          const date = catalog.calendarDate(new Date(instant), "America/Chicago");
          return `${date.getMonth() + 1}-${date.getDate()}`;
        });
      } finally { Intl.DateTimeFormat = formatter; }
    });
    assert.deepEqual(dates, ["8-9", "8-10", "2-9", "2-10"]);
    assert.equal(await page.evaluate(() => window.BITS_MESSAGE_CATALOG.refresh()), true);
    assert.equal(await page.evaluate(() => window.BITS_MESSAGES[0].text), "DATABASE STATUS");
    assert.equal(await page.evaluate(() => activities[0].text), "DATABASE ACTIVITY");
    assert.equal(await page.evaluate(() => shutdownMessages[0]), "DATABASE_SHUTDOWN");
    assert.equal(await page.evaluate(() => hardwareChatter[0]), "DATABASE CPU CHATTER");
    assert.equal(await page.evaluate(() => playingDeadMessages[0]), "DATABASE PLAYING DEAD");
    fail = true;
    assert.equal(await page.evaluate(() => window.BITS_MESSAGE_CATALOG.refresh()), false);
    assert.equal(await page.evaluate(() => window.BITS_MESSAGES[0].text), "DATABASE STATUS");
    fail = false;
    useMarkup = true;
    assert.equal(await page.evaluate(() => window.BITS_MESSAGE_CATALOG.refresh()), true);
    await page.evaluate(() => {
      window.__pauseMessageTypewriter = true;
      clearTimeout(window.__messageTimer);
      displayedMessageHistory.push(window.BITS_MESSAGES[0]);
      displayedMessageHistoryIndex = displayedMessageHistory.length;
      showPreviousSplash(-1);
      updateActivity();
      inspectPlayingDeadProcess();
      inspectPlayingDeadProcess();
      const cpu = hardwareChatter.find((message) => message.markup);
      hardwareChatter.splice(0, hardwareChatter.length, cpu);
      renderHardware([{ machine: "Markup PC", component: "CPU", name: "Test CPU", detail: null, updated_at: new Date().toISOString() }]);
      hardwareState.statuses = [{
        machine: "Markup PC", updated_at: new Date().toISOString(), cpu_percent: 20, gpu_percent: null,
        memory_total_mb: null, memory_used_mb: null, booted_at: null, nas_metrics: null,
      }];
      updateHardwareStatus();
    });
    assert.equal(await page.locator("#typed-text strong").textContent(), "BOLD");
    assert.equal(await page.locator("#typed-text .blog-text-color-red").textContent(), "red");
    assert.equal(await page.locator("#message-author-box").isVisible(), true);
    assert.equal(await page.locator("#typed-author").textContent(), "Test author 👩‍💻");
    await page.addScriptTag({ path: axePath });
    const quoteViolations = await page.evaluate(async () => (await axe.run(document.querySelector(".profile"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
    assert.deepEqual(quoteViolations, [], `${width}px quote attribution accessibility`);
    assert.ok(await page.locator("#message-author-box").evaluate(element => element.scrollWidth <= element.clientWidth + 1),
      "The attribution box wraps instead of overflowing");
    assert.equal(await page.locator("#fake-playing-dead-message strong").textContent(), "BOLD");
    assert.ok((await page.locator("#fake-playing-dead-message").textContent()).includes("Check #2"));
    assert.equal(await page.locator(".hardware-live-chatter strong").textContent(), "BOLD");
    await page.waitForFunction(() => document.querySelector("#activity-text strong")?.textContent === "BOLD");
    await page.evaluate(() => {
      const matchMedia = window.matchMedia;
      const motion = document.documentElement.dataset.motion;
      window.matchMedia = () => ({ matches: false });
      document.documentElement.dataset.motion = "full";
      window.BITS_BOOT.play();
      window.matchMedia = matchMedia;
      document.documentElement.dataset.motion = motion;
    });
    await page.waitForFunction(() => document.querySelector("#boot-log strong")?.textContent === "BOLD");
    await page.evaluate(() => {
      window.BITS_BOOT.skip();
      triggerVirusScreen("Test network");
    });
    await page.waitForFunction(() => document.querySelector("#virus-screen-copy strong")?.textContent === "BOLD");
    await page.evaluate(() => { recoverFromVirusScreen(); closeButton.click(); });
    assert.equal(await page.locator("#shutdown-message strong").textContent(), "BOLD");
    await page.goto(`${server.origin}/boot/`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => window.BITS_MESSAGE_CATALOG.refresh()), true);
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#endless-boot-log span")).some(
      (span) => span.textContent.startsWith("DATABASE BOOT") && span.querySelector("strong")?.textContent === "BOLD"));
    await page.waitForFunction(() => document.querySelector("#endless-boot-message strong")?.textContent === "BOLD");
    fail = true;
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    assert.equal(await page.evaluate(() => playingDeadMessages[0].markup), true, "cached markup must apply before desktop consumers copy the pool");
    assert.equal(await page.evaluate(() => glitchMessages[0].markup), true);
    assert.equal(await page.evaluate(() => hardwareChatter[0].markup), true);
    assert.equal(await page.evaluate(() => window.BITS_MESSAGES[0].correctedText), markupRows[0].corrected_text);
    assert.equal(await page.evaluate(() => window.BITS_MESSAGES[0].author), markupRows[0].author);
    await page.evaluate(() => {
      window.__pauseMessageTypewriter = true;
      clearTimeout(window.__messageTimer);
      currentMessage = window.BITS_MESSAGES[0];
      currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(currentMessage).characters;
      characterIndex = currentMessageCharacters.length;
      currentAuthorCharacters = window.BITS_MESSAGE_TEXT.splitCharacters(currentMessage.author ?? "");
      authorCharacterIndex = currentAuthorCharacters.length;
      deleting = false;
      updateMessage();
    });
    assert.equal(await page.locator(".command-line").evaluate((node) => node.classList.contains("is-correcting")), true);
    await page.waitForFunction(() => currentMessage.wasCorrected === true);
    assert.equal(await page.locator("#typed-text").textContent(), "DATABASE CORRECTED BOLD red 彩色");
    assert.equal(await page.locator("#typed-text strong").textContent(), "BOLD");
    assert.equal(await page.locator("#typed-author").textContent(), "Test author 👩‍💻", "Author remains during correction");
    const erased = await page.evaluate(() => {
      clearTimeout(window.__messageTimer);
      updateMessage();
      clearTimeout(window.__messageTimer);
      updateMessage();
      clearTimeout(window.__messageTimer);
      return { quote: typedText.textContent, author: typedAuthor.textContent };
    });
    assert.equal(erased.quote, "DATABASE CORRECTED BOLD red 彩");
    assert.equal(erased.author, "Test author ", "Author backspaces a whole grapheme alongside the quote");
    assert.equal(await page.evaluate(() => unlockedAchievements.some((achievement) => achievement.id === "typo-corrected")), true);
    fail = false;
    useCustom = true;
    assert.equal(await page.evaluate(() => window.BITS_MESSAGE_CATALOG.refresh()), true);
    assert.deepEqual(await page.evaluate(() => window.BITS_MESSAGES.filter((message) => message.text.startsWith("CUSTOM")).map((message) => message.text)), ["CUSTOM one", "CUSTOM two"]);
    assert.equal(await page.evaluate(() => window.BITS_MESSAGES.some((message) => message.text.startsWith("DATABASE STATUS"))), false);
    await page.evaluate(() => {
      displayedMessageHistory.push(window.BITS_MESSAGES[0]);
      displayedMessageHistoryIndex = displayedMessageHistory.length;
      showPreviousSplash(-1);
    });
    assert.equal(await page.locator("#message-author-box").isVisible(), false);
    assert.equal(await page.locator("#typed-author").textContent(), "", "Unattributed scheduled statuses clear the previous attribution");
    assert.equal(await page.evaluate(() => [activities, shutdownMessages, playingDeadMessages, glitchMessages, hardwareChatter].every((pool) => pool.length > 0)), true);
    await page.evaluate(() => {
      const matchMedia = window.matchMedia;
      const motion = document.documentElement.dataset.motion;
      window.matchMedia = () => ({ matches: false });
      document.documentElement.dataset.motion = "full";
      window.BITS_BOOT.play();
      window.matchMedia = matchMedia;
      document.documentElement.dataset.motion = motion;
    });
    await page.waitForFunction(() => document.querySelector("#boot-log strong")?.textContent === "BOLD");
    await page.evaluate(() => window.BITS_BOOT.skip());
    await page.goto(`${server.origin}/boot/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#endless-boot-log span")).some(
      (span) => span.textContent.startsWith("DATABASE BOOT") && span.querySelector("strong")?.textContent === "BOLD"));
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px public messages: overlapping scheduled exclusives, empty-category boot/monitor fallbacks, inline status/history, mistype correction/unlock, activities, shutdown, desktop/glitches, cache, and outages`);
    await context.close();
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/shared/scripts/supabase-config.js") return route.fulfill({
        contentType: "text/javascript",
        body: `
          window.SUPABASE_CONFIG = { url: "https://test.example", anonKey: "test-key" };
          window.__messageRows = ${JSON.stringify([
            ...Array.from({ length: 30 }, (_, index) => entry(index + 1, "messages", `Regular message ${index + 1}`)),
            entry(31, "bootMessages", "Seasonal boot fixture", "halloween"),
            entry(100, "monitor.cpu", "Bulk deletion fixture one"),
            entry(101, "monitor.cpu", "Bulk deletion fixture two"),
          ])};
          window.__poolRows = [];
          window.__messageSettings = [{ id: "primary", timezone: "America/Chicago" }];
          window.createSiteSupabaseClient = () => ({
            auth: { getSession: async () => ({ data: { session: null }, error: null }) },
            from(table) {
              const store = { site_message_catalog: "__messageRows", site_message_pools: "__poolRows", site_message_settings: "__messageSettings" }[table];
              if (!store) throw new Error("Unexpected table " + table);
              let operation = "select", payload, single = false, descending = false, offset = 0, end = Infinity, limit = Infinity;
              let orderKey = "position";
              const filters = [];
              const query = {
                select() { return query; },
                eq(key, value) { filters.push(row => row[key] === value); return query; },
                in(key, values) { filters.push(row => values.includes(row[key])); return query; },
                ilike(key, value) { filters.push(row => row[key].toLowerCase().includes(value.slice(1, -1).toLowerCase())); return query; },
                order(key, options) { orderKey = key; descending = options?.ascending === false; return query; },
                range(start, last) { offset = start; end = last; return query; },
                limit(value) { limit = value; return query; },
                single() { single = true; return query; },
                insert(value) { operation = "insert"; payload = value; return query; },
                update(value) { operation = "update"; payload = value; return query; },
                delete() { operation = "delete"; return query; },
                then(resolve) {
                  if (window.__messageFailure) return Promise.resolve({ error: new Error("Simulated database outage"), data: null }).then(resolve);
                  let result = window[store].filter(row => filters.every(filter => filter(row)));
                  if (operation === "insert") { window[store].push(payload); result = [payload]; }
                  if (operation === "update") result.forEach(row => Object.assign(row, payload));
                  if (operation === "delete") {
                    window[store] = window[store].filter(row => !result.includes(row));
                    if (store === "__poolRows") window.__messageRows = window.__messageRows.filter(row => !result.some(pool => pool.id === row.profile));
                  }
                  result = [...result].sort((a,b) => (typeof a[orderKey] === "string" ? a[orderKey].localeCompare(b[orderKey]) : a[orderKey]-b[orderKey]) * (descending ? -1 : 1));
                  const count = result.length;
                  result = result.slice(offset, Math.min(end+1, offset+limit));
                  return Promise.resolve({ data: structuredClone(single ? result[0] : result), error: null, count }).then(resolve);
                }
              };
              return query;
            }
          });`,
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let acceptDialogs = true;
    page.on("dialog", (dialog) => acceptDialogs ? dialog.accept() : dialog.dismiss());
    const assertNoOverflow = async (label) => {
      const result = await page.evaluate(() => ({
        viewport: innerWidth, width: document.documentElement.scrollWidth,
        nodes: [...document.querySelectorAll(".ac-module:not([hidden]) *")]
          .filter(node => node.getBoundingClientRect().right > innerWidth + 2 || node.getBoundingClientRect().left < -2)
          .slice(0, 12).map(node => ({ tag: node.tagName, id: node.getAttribute("id"), width: node.getBoundingClientRect().width, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })),
      }));
      assert.ok(result.width <= result.viewport + 2 && result.nodes.length === 0, `${label}: ${JSON.stringify(result)}`);
    };
    await page.goto(`${server.origin}/admin/#/messages`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      loginView.hidden = true;
      inboxView.hidden = false;
      window.dispatchEvent(new CustomEvent("admin:authenticated"));
    });
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 25);
    assert.equal(await page.locator("#message-library-editor").isVisible(), true);
    assert.equal(await page.locator("#message-library-form").isVisible(), false, "The editor starts collapsed");
    assert.equal(await page.locator("#message-pool-help").isVisible(), false, "Non-boot pools do not show procedural boot counts");
    assert.equal(await page.locator("#message-bulk-delete").isDisabled(), true);
    await page.locator('[data-message-select="1"]').check();
    await page.locator('[data-message-select="2"]').check();
    assert.equal(await page.locator("#message-select-page").evaluate((field) => field.indeterminate), true);
    assert.equal(await page.locator("#message-selected-count").textContent(), "2 selected");
    await page.locator("#message-bulk-disable").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("2 selected message(s) disabled."));
    assert.equal(await page.evaluate(() => window.__messageRows.filter(row => [1, 2].includes(row.position)).every(row => !row.enabled)), true);
    assert.equal(await page.evaluate(() => window.__messageRows.find(row => row.position === 3).enabled), true);
    assert.equal(await page.locator("#message-selected-count").textContent(), "0 selected");
    await page.locator('[data-message-select="1"]').check();
    await page.locator("#message-state-filter").selectOption("enabled");
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("28 enabled message(s)"));
    assert.equal(await page.locator("#message-selected-count").textContent(), "0 selected", "Status filtering clears bulk selection");
    assert.equal(await page.locator('[data-message-select="1"]').count(), 0);
    assert.equal(await page.locator("#message-page-label").textContent(), "1-25 of 28");
    await page.locator("#message-page-next").click();
    await page.waitForFunction(() => document.querySelector("#message-page-label").textContent === "26-28 of 28");
    await page.locator("#message-state-filter").selectOption("disabled");
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("2 disabled message(s)"));
    assert.equal(await page.locator("#message-page-label").textContent(), "1-2 of 2", "Status changes return to the first page");
    assert.equal(await page.locator("#message-page-next").isDisabled(), true);
    await page.locator("#message-search").fill("Regular message 1");
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("1 disabled message(s)"));
    assert.equal(await page.locator('[data-message-select="1"]').count(), 1, "Search and disabled status are combined");
    await page.locator("#message-search").fill("");
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("2 disabled message(s)"));
    await page.locator('[data-message-toggle="1"]').first().click();
    await page.locator("#message-text").fill("Unsaved status-filter test");
    acceptDialogs = false;
    await page.locator("#message-state-filter").selectOption("enabled");
    assert.equal(await page.locator("#message-state-filter").inputValue(), "disabled", "Cancelled filter changes restore the selected status");
    assert.equal(await page.locator("#message-text").inputValue(), "Unsaved status-filter test");
    acceptDialogs = true;
    await page.locator("#message-cancel").click();
    await page.locator("#message-select-page").check();
    await page.locator("#message-bulk-enable").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("2 selected message(s) enabled."));
    assert.equal(await page.locator(".message-library-empty").isVisible(), true, "Enabled rows leave the disabled-only list");
    assert.equal(await page.locator("#message-page-label").textContent(), "0-0 of 0");
    await page.locator("#message-state-filter").selectOption("all");
    await page.waitForFunction(() => document.querySelector("#message-page-label").textContent === "1-25 of 30");
    await page.locator('[data-message-select="1"]').check();
    await page.locator('[data-message-select="2"]').check();
    await page.locator("#message-bulk-disable").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("2 selected message(s) disabled."));
    await page.locator('[data-message-select="1"]').check();
    await page.locator('[data-message-select="2"]').check();
    acceptDialogs = false;
    await page.locator("#message-bulk-delete").click();
    assert.equal(await page.evaluate(() => window.__messageRows.length), 33, "Cancelled bulk deletion must not write");
    assert.equal(await page.locator("#message-selected-count").textContent(), "2 selected");
    acceptDialogs = true;
    await page.evaluate(() => { window.__messageFailure = true; });
    await page.locator("#message-bulk-enable").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").dataset.state === "error");
    assert.equal(await page.locator("#message-selected-count").textContent(), "2 selected", "Failed writes keep the selection available to retry");
    assert.equal(await page.evaluate(() => window.__messageRows.find(row => row.position === 1).enabled), false);
    await page.evaluate(() => { window.__messageFailure = false; });
    await page.locator("#message-bulk-enable").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("2 selected message(s) enabled."));
    assert.equal(await page.evaluate(() => window.__messageRows.every(row => row.enabled)), true);
    await page.locator("#message-select-page").check();
    assert.equal(await page.locator("#message-selected-count").textContent(), "25 selected");
    await page.locator("#message-page-next").click();
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 5);
    assert.equal(await page.locator("#message-selected-count").textContent(), "0 selected", "Selection does not cross pages");
    assert.equal(await page.locator("#message-select-page").isChecked(), false);
    await page.locator('[data-message-select]').first().check();
    await page.locator("#message-category").selectOption("monitor.cpu");
    await page.waitForFunction(() => document.querySelectorAll("[data-message-select]").length === 2);
    assert.equal(await page.locator("#message-selected-count").textContent(), "0 selected", "Filters clear selection");
    await page.locator('[data-message-select="100"]').check();
    await page.locator("#message-bulk-delete").click();
    await page.waitForFunction(() => !window.__messageRows.some(row => row.position === 100));
    assert.equal(await page.evaluate(() => window.__messageRows.some(row => row.position === 101)), true, "Bulk delete only affects selected rows");
    await page.locator("#message-select-page").check();
    await page.locator("#message-bulk-delete").click();
    await page.waitForFunction(() => document.querySelector(".message-library-empty") !== null);
    assert.equal(await page.locator("#message-select-page").isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__messageRows.length), 31);
    await page.locator("#message-category").selectOption("messages");
    await page.waitForFunction(() => document.querySelectorAll("[data-message-select]").length === 25);
    await page.locator('[data-message-select="1"]').check();
    await page.locator('[data-message-select="2"]').check();
    await page.evaluate(() => { window.__messageRows = window.__messageRows.filter(row => row.position !== 2); });
    await page.locator("#message-bulk-enable").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.includes("1 of 2"));
    assert.equal(await page.locator("#message-library-status").getAttribute("data-state"), "error", "Concurrent removals must not report complete success");
    await page.evaluate((row) => window.__messageRows.push(row), entry(2, "messages", "Regular message 2"));
    await page.locator("#message-reload").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-message-select]").length === 25 && !document.querySelector("#message-new").disabled);
    await page.addScriptTag({ path: axePath });
    for (const route of ["inbox", "guestbook", "resume", "now", "changelog", "messages", "blog", "games", "creators", "hardware", "playlists", "songs", "arcade", "pronouns", "shortbits", "backups"]) {
      await page.evaluate((route) => window.BITS_ADMIN_SHELL.navigate(route), route);
      await page.waitForFunction((route) => window.BITS_ADMIN_SHELL.route === route, route);
      const module = page.locator(".ac-module:not([hidden])");
      assert.equal(await module.count(), 1);
      const buttons = module.locator(".ac-section-nav button");
      assert.ok(await buttons.count() >= 1, `${route} has subsection navigation`);
      for (const button of await buttons.all()) {
        await button.click();
        assert.equal(await button.getAttribute("aria-current"), "page");
        const paneIds = (await button.getAttribute("aria-controls")).split(" ");
        const pane = page.locator(`[id="${paneIds[0]}"]`);
        if (!await pane.isVisible()) {
          assert.fail(`${route}/${await button.getAttribute("data-admin-subsection")} is hidden: ${await pane.evaluate((node) => {
            const parents = [];
            for (let element = node; element; element = element.parentElement) {
              parents.push({ tag: element.tagName, id: element.id, hidden: element.hidden, display: getComputedStyle(element).display });
            }
            return JSON.stringify(parents);
          })}`);
        }
      }
      await assertNoOverflow(`${route} subsections must not overflow at ${width}px`);
      const issues = await module.evaluate(async (module) => (await axe.run(module, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
      assert.deepEqual(issues, [], `${width}px ${route} subsection accessibility`);
    }
    assert.deepEqual(await page.evaluate(() => {
      const seen = new Set();
      return [...document.querySelectorAll("[id]")].map(node => node.getAttribute("id")).filter(id => seen.has(id) || !seen.add(id));
    }), [], "Subsections and shared editors keep unique element IDs");
    await page.evaluate(() => {
      window.BITS_ADMIN_SHELL.navigate("resume");
      window.BITS_ADMIN_SHELL.showSubsection("resume", "profile");
      document.querySelector('#resume-form [name="headline"]').value = "Unsaved profile draft";
    });
    await page.waitForFunction(() => window.BITS_ADMIN_SHELL.route === "resume");
    const resumeData = await page.locator("#resume-form").evaluate((form) => [...new FormData(form)]);
    await page.locator('#resume-editor [data-admin-subsection="education"]').click();
    assert.equal(await page.locator("#resume-submit").isVisible(), true, "Shared Save remains available across form subsections");
    assert.deepEqual(await page.locator("#resume-form").evaluate((form) => [...new FormData(form)]), resumeData, "Switching subsections must preserve all submitted form values");
    await page.evaluate(() => {
      window.BITS_ADMIN_SHELL.navigate("hardware");
      window.BITS_ADMIN_SHELL.showSubsection("hardware", "import");
    });
    await page.waitForFunction(() => window.BITS_ADMIN_SHELL.route === "hardware");
    await page.locator("#hardware-import-json").fill(JSON.stringify({
      machine: "Navigation test PC", components: [{ component: "CPU", name: "Browser test processor", detail: "Fixture only" }],
    }));
    await page.locator("#hardware-import-apply").click();
    assert.equal(await page.locator("#hardware-form").isVisible(), true, "Import reveals the machines subsection for review");
    assert.equal(await page.locator('#hardware-slots [data-entry-field="name"]').inputValue(), "Browser test processor");
    assert.match(await page.locator("#hardware-admin-status").textContent(), /Imported 1 component/);
    await page.evaluate(() => {
      window.BITS_ADMIN_SHELL.navigate("pronouns");
      window.BITS_ADMIN_SHELL.showSubsection("pronouns", "preferences");
    });
    await page.waitForFunction(() => window.BITS_ADMIN_SHELL.route === "pronouns");
    await page.locator("#pronoun-profile-form").evaluate((form) => form.requestSubmit());
    assert.equal(await page.locator('#pronoun-editor [data-admin-subsection="pronouns"]').getAttribute("aria-current"), "page", "Native validation reveals the first invalid field's subsection");
    assert.equal(await page.locator('#pronoun-profile-form [name="display_name"]').evaluate((field) => document.activeElement === field), true);
    await page.evaluate(() => {
      window.BITS_ADMIN_SHELL.navigate("blog");
      window.BITS_ADMIN_SHELL.showSubsection("blog", "posts");
    });
    await page.waitForFunction(() => window.BITS_ADMIN_SHELL.route === "blog");
    await page.locator("#blog-post-new").click();
    assert.equal(await page.locator("#blog-post-form").isVisible(), true, "New post opens the editor subsection before focusing it");
    await page.evaluate(() => {
      window.BITS_ADMIN_SHELL.navigate("messages");
      window.BITS_ADMIN_SHELL.showSubsection("messages", "messages");
    });
    await page.waitForFunction(() => window.BITS_ADMIN_SHELL.route === "messages");
    await page.locator('[data-message-select="1"]').check();
    await page.locator("#message-search").fill("Regular message 1");
    await page.waitForFunction(() => document.querySelectorAll("[data-message-select]").length === 11 && !document.querySelector("#message-new").disabled);
    assert.equal(await page.locator("#message-selected-count").textContent(), "0 selected", "Searching clears selection");
    await page.locator("#message-search").fill("");
    await page.waitForFunction(() => document.querySelectorAll("[data-message-select]").length === 25 && !document.querySelector("#message-new").disabled);
    await page.locator('[data-message-action="edit"]').first().click();
    assert.equal(await page.locator("#message-library-form").evaluate((form) => form.closest("li")?.dataset.messagePosition), "1");
    await page.locator("#message-text").fill("Unsaved inline draft");
    await page.locator('#message-library-editor [data-admin-subsection="pools"]').click();
    await page.locator('#message-library-editor [data-admin-subsection="messages"]').click();
    assert.equal(await page.locator("#message-text").inputValue(), "Unsaved inline draft", "Subsection navigation preserves the open message draft");
    acceptDialogs = false;
    await page.locator("#message-page-next").click();
    await page.locator("#message-cancel").click();
    await page.locator('[data-message-action="edit"]').nth(1).click();
    assert.equal(await page.locator("#message-text").inputValue(), "Unsaved inline draft", "Declining discard preserves the inline draft through paging, closing and row changes");
    acceptDialogs = true;
    await page.locator("#message-cancel").click();
    assert.equal(await page.locator("#message-library-form").isVisible(), false);
    assert.equal(await page.locator('[data-message-action="edit"]').first().getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#message-library-form").count(), 1, "Only one shared editor is used");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#message-new").click();
    assert.equal(await page.locator("#message-inline-panel").evaluate((panel) => panel.getAnimations().length), 0, "Reduced motion disables slide-down animation");
    assert.equal(await page.locator("#message-library-form").evaluate((form) => form.closest("#message-new-panel-slot") !== null), true);
    await page.locator("#message-new").click();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    assert.equal(await page.locator("#message-library-form").isVisible(), false);
    await page.locator("#message-page-next").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-message-select]").length === 5);
    await page.locator("#message-page-previous").click();
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 25);
    await page.locator('[data-message-action="edit"]').first().click();
    await page.waitForFunction(() => {
      const top = document.querySelector("#message-library-form").getBoundingClientRect().top;
      return top >= 0 && top < 200;
    });
    assert.equal(await page.locator("#message-text").evaluate((field) => document.activeElement === field), true);
    await assertNoOverflow(`${width}px inline message editor must not overflow`);
    await page.locator("#message-text").fill("<script>not executable</script> edited message");
    await page.locator("#message-author").fill("  Ada <script>literal</script>  ");
    assert.equal(await page.locator("#message-author-preview script").count(), 0);
    await page.locator("#message-weight").fill("0.25");
    await page.locator('[data-message-format="fontWeight"]').fill("700");
    await page.locator("#message-colorful").check();
    assert.equal(await page.locator("#message-preview script").count(), 0);
    await page.locator("#message-save").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("Message saved."));
    assert.equal(await page.evaluate(() => window.__messageRows[0].weight), 0.25);
    assert.equal(await page.evaluate(() => window.__messageRows[0].author), "Ada <script>literal</script>");
    assert.equal(await page.evaluate(() => window.__messageRows[0].format.fontWeight), "700");
    await page.locator("#message-text").fill("Normal bold and {{color:red|red}} {{color:rainbow|彩色}}");
    await page.locator('[data-message-format="fontWeight"]').fill("");
    await page.locator("#message-colorful").uncheck();
    await page.locator("#message-text").evaluate((field) => { field.focus(); field.setSelectionRange(7, 11); });
    await page.locator('[data-message-markup="bold"]').click();
    assert.equal(await page.locator("#message-markup").isChecked(), true);
    assert.equal(await page.locator("#message-preview strong").textContent(), "bold");
    assert.equal(await page.locator("#message-preview").textContent(), "Normal bold and red 彩色");
    assert.equal(await page.locator("#message-preview .blog-text-color-red").evaluate((node) => getComputedStyle(node).color), "rgb(255, 107, 120)");
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows[0].markup === true);
    await page.locator("#message-mistype").check();
    await page.locator("#message-corrected-text").fill(await page.locator("#message-text").inputValue());
    await page.locator("#message-save").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").dataset.state === "error");
    assert.equal(await page.evaluate(() => window.__messageRows[0].corrected_text), null);
    const originalText = await page.locator("#message-text").inputValue();
    await page.locator("#message-corrected-text").fill("Corrected {{color:red|red}} <script>still literal</script>");
    await page.locator("#message-corrected-text").evaluate((field) => { field.focus(); field.setSelectionRange(0, 9); });
    await page.locator('[data-message-markup="bold"]').click();
    assert.equal(await page.locator("#message-text").inputValue(), originalText, "corrected-text formatting must not modify the original");
    assert.equal(await page.locator("#message-corrected-preview strong").textContent(), "Corrected");
    assert.equal(await page.locator("#message-corrected-preview script").count(), 0);
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows[0].corrected_text?.startsWith("**Corrected**"));
    await page.locator("#message-cancel").click();
    await page.locator('[data-message-action="edit"]').first().click();
    assert.equal(await page.locator("#message-mistype").isChecked(), true);
    assert.equal(await page.locator("#message-author").inputValue(), "Ada <script>literal</script>", "Saved quote authors can be edited");
    await page.locator("#message-author").fill("");
    assert.equal(await page.locator("#message-corrected-text").inputValue(), "**Corrected** {{color:red|red}} <script>still literal</script>");
    await page.locator("#message-mistype").uncheck();
    assert.equal(await page.locator("#message-corrected-text").isDisabled(), true);
    assert.equal(await page.locator("#message-corrected-preview-container").isVisible(), false);
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows[0].corrected_text === null);
    assert.equal(await page.evaluate(() => window.__messageRows[0].author), null, "Blank authors remove the attribution");
    await page.locator("#message-enabled").uncheck();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows[0].enabled === false);
    await page.locator("#message-new").click();
    await page.locator("#message-text").fill("Added in Admin");
    await page.locator("#message-enabled").check();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.length === 32);
    assert.equal(await page.evaluate(() => window.__messageRows.at(-1).markup), false, "new messages start as literal text");
    assert.equal(await page.evaluate(() => window.__messageRows.at(-1).author), null, "New messages are unattributed by default");
    await page.locator("#message-search").fill("Added in Admin");
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 1);
    await page.locator('[data-message-action="delete"]').click();
    await page.waitForFunction(() => window.__messageRows.length === 31);
    await page.locator("#message-search").fill("");
    await page.locator("#message-profile").selectOption("halloween");
    await page.locator("#message-category").selectOption("bootMessages");
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 1);
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("1 fixed message(s)"));
    assert.match(await page.locator("#message-page-label").textContent(), /of 1 fixed entries$/);
    assert.equal(await page.locator("#message-pool-help").isVisible(), true);
    assert.match(await page.locator("#message-pool-help").textContent(), /29 actions, 37 subjects, and 30 results\/statuses: 32,190 possible combinations/);
    assert.match(await page.locator("#message-pool-help").textContent(), /nonempty active exclusive boot pool replaces/);
    await page.locator("#message-search").fill("no such fixed message");
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("0 fixed message(s)"));
    assert.match(await page.locator("#message-library-status").textContent(), /matching this search/);
    assert.match(await page.locator("#message-pool-help").textContent(), /32,190 possible combinations/);
    await page.locator("#message-search").fill("");
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("1 fixed message(s)"));
    await page.locator('[data-message-action="edit"]').click();
    assert.equal(await page.locator("#message-weighted-options").isVisible(), false);
    assert.equal(await page.locator("#message-author-options").isVisible(), false, "Authors apply only to rotating splash/status quotes");
    assert.equal(await page.locator("#message-mistype-options").isVisible(), false);
    await page.locator("#message-text").fill("Updated **seasonal** boot message");
    await page.locator("#message-markup").check();
    assert.equal(await page.locator("#message-preview strong").textContent(), "seasonal");
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.find(row => row.position === 31).text === "Updated **seasonal** boot message");
    assert.equal(await page.evaluate(() => window.__messageRows.find(row => row.position === 31).markup), true);
    await page.locator('#message-library-editor [data-admin-subsection="pools"]').click();
    await page.locator("#message-pool-new").click();
    await page.locator("#message-pool-title").fill("Year boundary");
    await page.locator("#message-pool-start").fill("2000-12-30");
    await page.locator("#message-pool-end").fill("2000-01-02");
    await page.locator("#message-pool-mode").selectOption("exclusive");
    await page.locator("#message-pool-enabled").check();
    await page.locator('#message-pool-form button[type="submit"]').click();
    await page.waitForFunction(() => window.__poolRows.length === 1 && document.querySelector("#message-profile").value === window.__poolRows[0].id);
    const customId = await page.locator("#message-profile").inputValue();
    await page.locator('#message-library-editor [data-admin-subsection="messages"]').click();
    await page.locator("#message-new").click();
    await page.locator("#message-text").fill("CUSTOM BOOT");
    await page.locator("#message-enabled").check();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.some(row => row.text === "CUSTOM BOOT"));
    await page.locator("#message-category").selectOption("messages");
    assert.equal(await page.locator("#message-pool-help").isVisible(), false);
    await page.locator("#message-new").click();
    await page.locator("#message-text").fill("CUSTOM STATUS");
    await page.locator("#message-enabled").check();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.some(row => row.text === "CUSTOM STATUS"));
    await page.locator('#message-library-editor [data-admin-subsection="pools"]').click();
    await page.locator("#message-pool-title").fill("One-time celebration");
    await page.locator("#message-pool-schedule").selectOption("once");
    await page.locator("#message-pool-start").fill("2026-12-30");
    await page.locator("#message-pool-end").fill("2026-01-02");
    await page.locator('#message-pool-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("#message-pool-status").dataset.state === "error");
    assert.equal(await page.evaluate(() => window.__poolRows[0].schedule), "annual");
    await page.locator("#message-pool-end").fill("2027-01-02");
    await page.locator('#message-pool-form button[type="submit"]').click();
    await page.waitForFunction(() => window.__poolRows[0].schedule === "once");
    assert.equal(await page.evaluate(() => window.__poolRows[0].id), customId, "editing a pool must preserve its message association");
    await page.locator('#message-library-editor [data-admin-subsection="calendar"]').click();
    await page.locator("#message-timezone").fill("Invalid/Timezone");
    await page.locator('#message-timezone-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("#message-pool-status").dataset.state === "error");
    assert.equal(await page.evaluate(() => window.__messageSettings[0].timezone), "America/Chicago");
    await page.locator("#message-timezone").fill("America/New_York");
    await page.locator('#message-timezone-form button[type="submit"]').click();
    await page.waitForFunction(() => window.__messageSettings[0].timezone === "America/New_York");
    await page.locator('#message-library-editor [data-admin-subsection="pools"]').click();
    await page.locator("#message-pool-delete").click();
    await page.waitForFunction(() => window.__poolRows.length === 0 && document.querySelector("#message-profile").value === "standard");
    assert.equal(await page.evaluate((id) => window.__messageRows.some(row => row.profile === id), customId), false);
    await page.locator('#message-library-editor [data-admin-subsection="messages"]').click();
    await page.locator("#message-profile").selectOption("halloween");
    await page.locator("#message-category").selectOption("bootMessages");
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 1);
    await page.locator('[data-message-action="edit"]').click();
    await page.evaluate(() => { window.__messageFailure = true; });
    await page.locator("#message-text").fill("Must not save");
    await page.locator("#message-save").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").dataset.state === "error");
    assert.equal(await page.evaluate(() => window.__messageRows.find(row => row.position === 31).text), "Updated **seasonal** boot message");
    await page.waitForFunction(() => document.querySelector("#message-inline-panel").getAnimations().length === 0);
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#message-library-editor"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) })));
    assert.deepEqual(violations, [], `${width}px message editor accessibility`);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px Admin: all-module subsections, form preservation/validation, inline/add editors and discard protection, page-only bulk CRUD/cancellation/errors/concurrency, pools, timezone, markup/mistype, accessibility`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
