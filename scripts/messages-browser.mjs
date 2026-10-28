import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : args[rootIndex + 1]);
const screenshotsIndex = args.indexOf("--screenshots");
const screenshots = screenshotsIndex < 0 ? null : resolve(args[screenshotsIndex + 1]);
if (screenshots) await mkdir(screenshots, { recursive: true });
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
  ...row, markup: true, text: `${row.text} %hostname% {{font:custom:"Aptos Display", Arial, sans-serif|**BOLD**}} {{color:red|red}} {{color:rainbow|彩色}}`,
  corrected_text: row.category === "messages"
    ? 'DATABASE CORRECTED %hostname% {{font:custom:"Aptos Display", Arial, sans-serif|**BOLD**}} {{color:red|red}} {{color:rainbow|彩色}}' : null,
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
    assert.equal(await page.locator("#typed-text .blog-text-font-custom").evaluate(element => element.style.fontFamily),
      '"Aptos Display", Arial, sans-serif', "Saved custom fonts render through public splash history");
    assert.ok((await page.locator("#typed-text").textContent()).includes(new URL(server.origin).hostname));
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
    for (const selector of ["#fake-playing-dead-message", ".hardware-live-chatter", "#activity-text"]) {
      assert.ok((await page.locator(selector).textContent()).includes(new URL(server.origin).hostname), selector);
      assert.equal(await page.locator(`${selector} .blog-text-font-custom`).evaluate(element => element.style.fontFamily),
        '"Aptos Display", Arial, sans-serif', `${selector} renders custom fonts`);
    }
    const chatterTimes = await page.evaluate(() => {
      const RealDate = Date;
      const original = hardwareChatter[0];
      let instant = Math.floor(RealDate.now() / 6000) * 6000 + 100;
      window.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [instant])); }
        static now() { return instant; }
      };
      try {
        hardwareChatter[0] = { text: "**%hour%:%minute%:%second%**", markup: true };
        const read = () => {
          updateHardwareStatus();
          return document.querySelector(".hardware-live-chatter").textContent;
        };
        const first = read();
        instant += 1000;
        const repeated = read();
        instant += 6000;
        const next = read();
        return { first, repeated, next };
      } finally {
        window.Date = RealDate;
        hardwareChatter[0] = original;
        updateHardwareStatus();
      }
    });
    assert.equal(chatterTimes.first, chatterTimes.repeated, "Telemetry updates preserve the current message snapshot");
    assert.notEqual(chatterTimes.first, chatterTimes.next, "The six-second rotation captures fresh clock values");
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
    assert.ok((await page.locator("#boot-log").textContent()).includes(new URL(server.origin).hostname));
    await page.evaluate(() => {
      window.BITS_BOOT.skip();
      triggerVirusScreen("Test network");
    });
    await page.waitForFunction(() => document.querySelector("#virus-screen-copy strong")?.textContent === "BOLD");
    assert.ok((await page.locator("#virus-screen-copy").textContent()).includes(new URL(server.origin).hostname));
    await page.evaluate(() => { recoverFromVirusScreen(); closeButton.click(); });
    assert.equal(await page.locator("#shutdown-message strong").textContent(), "BOLD");
    assert.ok((await page.locator("#shutdown-message").textContent()).includes(new URL(server.origin).hostname));
    await page.goto(`${server.origin}/boot/`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => window.BITS_MESSAGE_CATALOG.refresh()), true);
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#endless-boot-log span")).some(
      (span) => span.textContent.startsWith("DATABASE BOOT") && span.querySelector("strong")?.textContent === "BOLD"));
    await page.waitForFunction(() => document.querySelector("#endless-boot-message strong")?.textContent === "BOLD");
    for (const selector of ["#endless-boot-log", "#endless-boot-message"]) {
      assert.ok((await page.locator(selector).textContent()).includes(new URL(server.origin).hostname), selector);
    }
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
      currentMessage = window.BITS_MESSAGE_TEXT.snapshot(window.BITS_MESSAGES[0]);
      currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(currentMessage).characters;
      characterIndex = currentMessageCharacters.length;
      currentAuthorCharacters = window.BITS_MESSAGE_TEXT.splitCharacters(currentMessage.author ?? "");
      authorCharacterIndex = currentAuthorCharacters.length;
      deleting = false;
      updateMessage();
    });
    assert.equal(await page.locator(".command-line").evaluate((node) => node.classList.contains("is-correcting")), true);
    await page.waitForFunction(() => currentMessage.wasCorrected === true);
    assert.equal(await page.locator("#typed-text").textContent(), `DATABASE CORRECTED ${new URL(server.origin).hostname} BOLD red 彩色`);
    assert.equal(await page.locator("#typed-text strong").textContent(), "BOLD");
    assert.equal(await page.locator("#typed-text .blog-text-font-custom").evaluate(element => element.style.fontFamily),
      '"Aptos Display", Arial, sans-serif', "Mistype correction preserves the custom font");
    assert.equal(await page.locator("#typed-author").textContent(), "Test author 👩‍💻", "Author remains during correction");
    const erased = await page.evaluate(() => {
      clearTimeout(window.__messageTimer);
      updateMessage();
      clearTimeout(window.__messageTimer);
      updateMessage();
      clearTimeout(window.__messageTimer);
      return { quote: typedText.textContent, author: typedAuthor.textContent };
    });
    assert.equal(erased.quote, `DATABASE CORRECTED ${new URL(server.origin).hostname} BOLD red 彩`);
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
                    if (store === "__poolRows") window.__messageRows = window.__messageRows.filter(row => !result.some(pool => pool.id.startsWith("custom-") && pool.id === row.profile));
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
    await page.locator("#message-text").fill("Hello visitor!");
    await page.locator("#message-text").evaluate((field) => field.setSelectionRange(6, 13));
    await page.locator('[data-message-variable="currentdate"]').click();
    assert.equal(await page.locator("#message-text").inputValue(), "Hello %currentdate%!");
    assert.equal(await page.locator("#message-markup").isChecked(), false, "Placeholders do not enable markup");
    assert.deepEqual(await page.locator("#message-text").evaluate(field => ({
      focused: document.activeElement === field, start: field.selectionStart, end: field.selectionEnd,
    })), { focused: true, start: 19, end: 19 });
    acceptDialogs = false;
    await page.locator("#message-cancel").click();
    assert.equal(await page.locator("#message-text").inputValue(), "Hello %currentdate%!", "Inserting a placeholder marks the draft dirty");
    acceptDialogs = true;
    await page.locator("#message-text").fill("");
    for (const name of ["day", "time", "useragent"]) {
      await page.locator(`[data-message-variable="${name}"]`).focus();
      await page.locator(`[data-message-variable="${name}"]`).press("Enter");
    }
    assert.equal(await page.locator("#message-text").inputValue(), "%day%%time%%useragent%", "Repeated keyboard insertions advance the caret");
    const variables = await page.evaluate(() => Object.keys(window.BITS_MESSAGE_TEXT.variables));
    assert.equal(await page.locator("#message-variable-select option").count(), variables.length + 1);
    for (const name of variables) {
      await page.locator("#message-text").fill("");
      await page.locator("#message-variable-select").selectOption(name);
      await page.locator("#message-variable-insert").click();
      assert.equal(await page.locator("#message-text").inputValue(), `%${name}%`);
    }
    await page.locator("#message-text").fill("x".repeat(2000));
    await page.locator('[data-message-variable="time"]').click();
    assert.equal((await page.locator("#message-text").inputValue()).length, 2000, "Insertion never exceeds the saved-text limit");
    assert.equal(await page.locator("#message-library-status").getAttribute("data-state"), "error");
    await page.locator("#message-text").evaluate(field => { field.focus(); field.setSelectionRange(1994, 2000); });
    await page.locator('[data-message-variable="time"]').click();
    assert.equal(await page.locator("#message-text").inputValue(), "x".repeat(1994) + "%time%", "Replacing a selection may exactly meet the limit");
    await page.locator("#message-text").fill("Sample");
    await page.locator("#message-text").evaluate(field => field.select());
    await page.locator("#message-markup-font").selectOption("serif");
    assert.equal(await page.locator("#message-text").inputValue(), "{{font:serif|Sample}}");
    assert.equal(await page.locator("#message-preview .blog-text-font-serif").textContent(), "Sample");
    await page.locator("#message-markup-size").selectOption("large");
    assert.equal(await page.locator("#message-preview .blog-text-font-serif .blog-text-size-large").textContent(), "Sample");
    assert.equal(await page.locator("#message-preview").textContent(), "Sample", "Combined toolbar styles leave no markup delimiters behind");
    const fonts = await page.evaluate(() => Object.keys(window.BITS_MARKDOWN.fonts));
    assert.equal(fonts.length, 24);
    for (const selector of ["#message-markup-font", "#blog-format-font"]) {
      assert.deepEqual(await page.locator(`${selector} option`).evaluateAll(options => options.map(option => option.value)),
        ["", ...fonts, "custom"], `${selector} uses the shared supported font list and Custom option`);
    }
    assert.equal(await page.locator("#message-markup-toolbar #message-weighted-options").count(), 1);
    assert.equal(await page.locator('#message-library-form > #message-weighted-options').count(), 0, "No bottom weight/appearance section remains");
    assert.equal(await page.locator("#message-custom-font").isVisible(), false);
    await page.locator("#message-text").fill("Custom words");
    await page.locator("#message-text").evaluate(field => field.select());
    await page.locator("#message-markup-font").selectOption("custom");
    assert.equal(await page.locator("#message-custom-font").isVisible(), true);
    const beforeCustom = await page.locator("#message-text").inputValue();
    for (const invalid of ["", "Arial; color:red", "url(https://example.test/font)"]) {
      await page.locator("#message-custom-font-family").fill(invalid);
      await page.locator("#message-custom-font-apply").click();
      assert.ok((await page.locator("#message-custom-font-status").textContent()).includes("Enter font names"));
      assert.equal(await page.locator("#message-text").inputValue(), beforeCustom);
    }
    await page.locator("#message-custom-font-family").fill("Aptos Display, Arial, sans-serif");
    await page.locator("#message-custom-font-family").press("Enter");
    const customFamily = '"Aptos Display", "Arial", sans-serif';
    const serializedCustomFamily = await page.evaluate(family => {
      const sample = document.createElement("span");
      sample.style.fontFamily = family;
      return sample.style.fontFamily;
    }, customFamily);
    const customTemplate = `{{font:custom:${customFamily}|Custom words}}`;
    assert.equal(await page.locator("#message-text").inputValue(), customTemplate);
    assert.equal(await page.locator("#message-preview .blog-text-font-custom").evaluate(element => element.style.fontFamily), serializedCustomFamily);
    assert.equal(await page.locator("#message-text").evaluate(field => document.activeElement === field), true);
    await page.locator("#message-save").click();
    await page.waitForFunction(template => window.__messageRows[0].text === template, customTemplate);
    await page.locator("#message-cancel").click();
    await page.locator('[data-message-action="edit"]').first().click();
    assert.equal(await page.locator("#message-text").inputValue(), customTemplate);
    assert.equal(await page.locator("#message-preview .blog-text-font-custom").evaluate(element => element.style.fontFamily), serializedCustomFamily, "Saved custom font survives reopening");
    await page.locator("#message-weight").fill("0.5");
    acceptDialogs = false;
    await page.locator("#message-cancel").click();
    assert.equal(await page.locator("#message-weight").inputValue(), "0.5", "Toolbar defaults alone mark the draft dirty");
    assert.equal(await page.locator("#message-library-form").isVisible(), true);
    acceptDialogs = true;
    await page.locator("#message-weight").fill("1");
    await page.locator("#message-markup-font").selectOption("custom");
    await page.locator("#message-custom-font-cancel").click();
    assert.equal(await page.locator("#message-text").inputValue(), customTemplate, "Cancel never changes stored text");
    assert.equal(await page.locator("#message-custom-font").isVisible(), false);
    await page.locator("#message-text").fill("x".repeat(2000));
    await page.locator("#message-text").evaluate(field => field.select());
    await page.locator("#message-markup-font").selectOption("custom");
    await page.locator("#message-custom-font-family").fill("Aptos");
    await page.locator("#message-custom-font-apply").click();
    assert.equal((await page.locator("#message-text").inputValue()).length, 2000, "Custom font markup respects the text limit");
    assert.equal(await page.locator("#message-library-status").getAttribute("data-state"), "error");
    await page.locator("#message-defaults summary").click();
    assert.equal(await page.locator("[data-message-format]").count(), 8, "Every legacy whole-message format control is retained");
    for (const id of fonts) {
      await page.locator("#message-text").fill("Font sample");
      await page.locator("#message-text").evaluate(field => field.select());
      await page.locator("#message-markup-font").selectOption(id);
      assert.equal(await page.locator("#message-text").inputValue(), `{{font:${id}|Font sample}}`);
      assert.equal(await page.locator(`#message-preview .blog-text-font-${id}`).textContent(), "Font sample");
      assert.equal(await page.locator("#message-markup-font").inputValue(), "");
      assert.ok(await page.locator(`#message-preview .blog-text-font-${id}`).evaluate(element =>
        [...document.styleSheets].some(sheet => {
          if (!sheet.href || new URL(sheet.href).origin !== location.origin) return false;
          return [...sheet.cssRules].some(rule => rule.selectorText?.includes(`.blog-text-font-${element.className.slice("blog-text-font-".length)}`)
            && rule.style?.fontFamily);
        })), `The optimized stylesheet retains ${id}`);
    }
    await page.locator("#message-text").fill("x".repeat(2000));
    await page.locator("#message-text").evaluate(field => field.select());
    await page.locator('[data-message-markup="bold"]').click();
    assert.equal((await page.locator("#message-text").inputValue()).length, 2000, "Formatting also respects the text limit");
    for (const appearance of ["light", "dark"]) {
      await page.evaluate(appearance => { document.documentElement.dataset.adminAppearance = appearance; }, appearance);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const toolbarIssues = await page.locator("#message-markup-toolbar").evaluate(async toolbar => (await axe.run(toolbar, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })).violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) })));
      assert.deepEqual(toolbarIssues, [], `${width}px ${appearance} message toolbar accessibility`);
      await assertNoOverflow(`${width}px ${appearance} message toolbar must wrap`);
      if (screenshots) await page.locator("#message-markup-toolbar").screenshot({
        path: resolve(screenshots, `message-toolbar-${width}-${appearance}.png`),
      });
    }
    await page.evaluate(() => { document.documentElement.dataset.adminAppearance = "light"; });
    await page.locator("#message-markup").uncheck();
    await page.locator("#message-text").fill("<script>not executable</script> edited message");
    await page.locator("#message-author").fill("  Ada <script>literal</script>  ");
    assert.equal(await page.locator("#message-author-preview script").count(), 0);
    await page.locator("#message-weight").fill("0.25");
    const defaults = {
      color: "#123456", fontWeight: "700", fontFamily: '"Aptos", Arial, sans-serif',
      fontSize: "18px", fontStyle: "italic", letterSpacing: "0.05em",
      textDecoration: "underline", textTransform: "uppercase",
    };
    for (const [key, value] of Object.entries(defaults)) {
      await page.locator(`[data-message-format="${key}"]`).fill(value);
    }
    await page.locator("#message-colorful").check();
    assert.equal(await page.locator("#message-preview").evaluate(element => element.style.fontWeight), "700", "Toolbar defaults update previews immediately");
    assert.equal(await page.locator("#message-preview").evaluate(element => element.classList.contains("is-colorful-text")), true);
    assert.equal(await page.locator("#message-preview script").count(), 0);
    await page.locator("#message-save").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("Message saved."));
    assert.equal(await page.evaluate(() => window.__messageRows[0].weight), 0.25);
    assert.equal(await page.evaluate(() => window.__messageRows[0].author), "Ada <script>literal</script>");
    assert.equal(await page.evaluate(() => window.__messageRows[0].format.fontWeight), "700");
    assert.deepEqual(await page.evaluate(() => window.__messageRows[0].format), defaults);
    assert.equal(await page.evaluate(() => window.__messageRows[0].colorful), true);
    for (const key of Object.keys(defaults)) await page.locator(`[data-message-format="${key}"]`).fill("");
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
    const liveTemplate = "**%day%** %time% / %useragent% / %hostname% / %%time%% / %unknown%";
    await page.locator("#message-text").fill(liveTemplate);
    assert.equal(await page.locator("#message-preview strong").textContent(),
      await page.evaluate(() => new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date())));
    assert.ok((await page.locator("#message-preview").textContent()).includes(new URL(server.origin).hostname));
    assert.match(await page.locator("#message-preview").textContent(), /Google Chrome|Chromium|Microsoft Edge/);
    assert.ok((await page.locator("#message-preview").textContent()).endsWith("%time% / %unknown%"));
    assert.equal(await page.locator("#message-variable-list dt").count(), 16);
    await page.locator(".message-variable-help summary").click();
    await assertNoOverflow(`${width}px live placeholder help must not overflow`);
    await page.locator("#message-save").click();
    await page.waitForFunction((template) => window.__messageRows[0].text === template, liveTemplate);
    await page.locator("#message-mistype").check();
    await page.locator("#message-corrected-text").fill("Correction");
    await page.locator("#message-corrected-text").evaluate(field => field.select());
    await page.locator("#message-markup-font").selectOption("custom");
    await page.locator("#message-custom-font-family").fill("Aptos, sans-serif");
    await page.locator("#message-custom-font-apply").click();
    assert.equal(await page.locator("#message-corrected-preview .blog-text-font-custom").textContent(), "Correction");
    assert.equal(await page.locator("#message-text").inputValue(), liveTemplate, "Custom fonts target corrected text without overwriting the original");
    await page.locator("#message-corrected-text").fill("Correct me");
    await page.locator("#message-corrected-text").evaluate(field => field.setSelectionRange(8, 10));
    await page.locator('[data-message-variable="day"]').click();
    assert.equal(await page.locator("#message-corrected-text").inputValue(), "Correct %day%");
    assert.equal(await page.locator("#message-text").inputValue(), liveTemplate, "Placeholder insertion targets the last-focused corrected field only");
    assert.equal(await page.locator("#message-toolbar-target").textContent(), "Editing: corrected text");
    await page.locator("#message-mistype").uncheck();
    await page.locator('[data-message-variable="day"]').click();
    assert.equal(await page.locator("#message-toolbar-target").textContent(), "Editing: message text", "Disabling corrections restores the message target");
    await page.locator("#message-text").fill(liveTemplate);
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
    assert.equal(await page.locator("#message-pool-title").isDisabled(), true);
    assert.equal(await page.locator("#message-pool-save").isDisabled(), true);
    assert.match(await page.locator("#message-pool-summary").textContent(), /Always active/);
    await page.locator("#message-pool-select").selectOption("easter");
    await page.waitForFunction(() => !document.querySelector("#message-library-list").inert);
    assert.equal(await page.locator("#message-profile").inputValue(), "easter");
    assert.equal(await page.locator("#message-pool-schedule").inputValue(), "automatic");
    assert.equal(await page.locator("#message-pool-dates").isVisible(), false);
    assert.match(await page.locator("#message-pool-summary").textContent(), /Gregorian Easter Sunday/);
    const easterDates = await page.evaluate(() => {
      const catalog = window.BITS_MESSAGE_CATALOG;
      const year = catalog.calendarDate(new Date(), "America/New_York").getFullYear();
      return catalog.builtinSchedule("easter", year).ranges[0].start;
    });
    assert.ok((await page.locator("#message-pool-summary").textContent()).includes(easterDates));
    await page.locator("#message-pool-mode").selectOption("exclusive");
    await page.locator("#message-pool-save").click();
    await page.waitForFunction(() => window.__poolRows.some(pool => pool.id === "easter" && pool.mode === "exclusive")
      && !document.querySelector("#message-pool-form").inert);
    assert.equal(await page.evaluate(() => window.__poolRows[0].starts_on), null);
    assert.equal(await page.locator("#message-profile option[value=easter]").count(), 1);
    await page.locator("#message-pool-schedule").selectOption("once");
    assert.equal(await page.locator("#message-pool-dates").isVisible(), true);
    await page.locator("#message-pool-start").fill("2026-08-10");
    await page.locator("#message-pool-end").fill("2026-08-12");
    await page.locator("#message-pool-save").click();
    await page.waitForFunction(() => window.__poolRows[0].schedule === "once" && !document.querySelector("#message-pool-form").inert);
    await page.locator("#message-pool-select").selectOption("christmas");
    await page.waitForFunction(() => !document.querySelector("#message-pool-form").inert);
    assert.equal(await page.locator("#message-pool-mode").inputValue(), "exclusive");
    await page.locator("#message-pool-select").selectOption("easter");
    await page.waitForFunction(() => !document.querySelector("#message-pool-form").inert);
    assert.equal(await page.locator("#message-pool-start").inputValue(), "2026-08-10");
    assert.equal(await page.locator("#message-pool-end").inputValue(), "2026-08-12");
    await page.locator("#message-pool-schedule").selectOption("automatic");
    await page.locator("#message-pool-enabled").uncheck();
    acceptDialogs = false;
    await page.locator("#message-pool-select").selectOption("halloween");
    assert.equal(await page.locator("#message-pool-select").inputValue(), "easter", "Cancel keeps the current pool and its unsaved draft");
    assert.equal(await page.locator("#message-pool-enabled").isChecked(), false);
    acceptDialogs = true;
    await page.locator("#message-pool-save").click();
    await page.waitForFunction(() => window.__poolRows[0].schedule === "automatic" && !window.__poolRows[0].enabled
      && !document.querySelector("#message-pool-form").inert);
    assert.match(await page.locator("#message-pool-select option[value=easter]").textContent(), /DISABLED/);
    await page.locator("#message-pool-reset").click();
    await page.waitForFunction(() => window.__poolRows.length === 0 && !document.querySelector("#message-pool-form").inert);
    assert.equal(await page.locator("#message-pool-mode").inputValue(), "additive");
    assert.equal(await page.locator("#message-pool-enabled").isChecked(), true);
    await page.locator("#message-pool-select").selectOption("halloween");
    await page.waitForFunction(() => !document.querySelector("#message-pool-form").inert);
    await page.locator("#message-pool-mode").selectOption("additive");
    await page.locator("#message-pool-save").click();
    await page.waitForFunction(() => window.__poolRows.length === 1 && !document.querySelector("#message-pool-form").inert);
    await page.locator("#message-pool-reset").click();
    await page.waitForFunction(() => window.__poolRows.length === 0 && !document.querySelector("#message-pool-form").inert);
    assert.equal(await page.evaluate(() => window.__messageRows.find(row => row.position === 31).text), "Updated **seasonal** boot message",
      "Resetting built-in settings must not cascade-delete its edited messages");
    assert.equal(await page.locator("#message-pool-mode").inputValue(), "exclusive");
    await assertNoOverflow("scheduled built-in pool editor");
    const poolViolations = await page.evaluate(async () => (await axe.run(document.querySelector("#message-library-editor"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
    assert.deepEqual(poolViolations, [], `${width}px scheduled pool accessibility`);
    if (screenshots) await page.locator("#message-pool-form").screenshot({
      path: resolve(screenshots, `builtin-pool-${width}.png`),
    });
    await page.locator('#message-library-editor [data-admin-subsection="messages"]').click();
    await page.locator("#message-pool-edit").click();
    assert.equal(await page.locator("#message-pool-form").isVisible(), true, "Pool settings are reachable beside the profile selector");
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
    await page.evaluate(() => {
      window.__messageFailure = false;
      window.BITS_ADMIN_SHELL.navigate("blog");
      window.BITS_ADMIN_SHELL.showSubsection("blog", "posts");
    });
    await page.locator("#blog-post-new").click();
    assert.equal(await page.locator("#blog-custom-font").isVisible(), false);
    await page.locator("#blog-post-markdown").fill("Blog font sample");
    await page.locator("#blog-post-markdown").evaluate(field => field.select());
    await page.locator("#blog-format-font").selectOption("custom");
    await page.locator("#blog-custom-font-family").fill("url(https://example.test/font)");
    await page.locator("#blog-custom-font-apply").click();
    assert.equal(await page.locator("#blog-post-markdown").inputValue(), "Blog font sample");
    assert.ok((await page.locator("#blog-custom-font-status").textContent()).includes("Enter font names"));
    await page.locator("#blog-custom-font-family").fill("Aptos Display, Arial, sans-serif");
    await page.locator("#blog-custom-font-family").press("Enter");
    assert.equal(await page.locator("#blog-post-markdown").inputValue(), `{{font:custom:${customFamily}|Blog font sample}}`);
    assert.equal(await page.locator("#blog-markdown-preview .blog-text-font-custom").textContent(), "Blog font sample");
    assert.equal(await page.locator("#blog-markdown-preview .blog-text-font-custom").evaluate(element => element.style.fontFamily), serializedCustomFamily);
    await assertNoOverflow(`${width}px custom blog font controls`);
    await page.locator("#blog-custom-font-cancel").click();
    assert.equal(await page.locator("#blog-custom-font").isVisible(), false);
    assert.equal(await page.locator("#blog-post-markdown").evaluate(field => document.activeElement === field), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px Admin: all-module subsections, form preservation/validation, inline/add editors and discard protection, page-only bulk CRUD/cancellation/errors/concurrency, pools, timezone, markup/mistype, accessibility`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
