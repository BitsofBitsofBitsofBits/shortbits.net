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
  position, profile, category, text, weight: 1, colorful: false, format: {}, enabled: true, markup: false, corrected_text: null,
});
const publicRows = [
  entry(1, "messages", "DATABASE STATUS"),
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
  for (const width of [1440, 390]) {
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
        if (typeof callback === "function" && callback.name === "updateMessage") window.__messageTimer = timer;
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
    await page.evaluate(() => {
      clearTimeout(window.__messageTimer);
      currentMessage = window.BITS_MESSAGES[0];
      currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(currentMessage).characters;
      characterIndex = currentMessageCharacters.length;
      deleting = false;
      updateMessage();
    });
    assert.equal(await page.locator(".command-line").evaluate((node) => node.classList.contains("is-correcting")), true);
    await page.waitForFunction(() => currentMessage.wasCorrected === true);
    assert.equal(await page.locator("#typed-text").textContent(), "DATABASE CORRECTED BOLD red 彩色");
    assert.equal(await page.locator("#typed-text strong").textContent(), "BOLD");
    assert.equal(await page.evaluate(() => unlockedAchievements.some((achievement) => achievement.id === "typo-corrected")), true);
    fail = false;
    useCustom = true;
    assert.equal(await page.evaluate(() => window.BITS_MESSAGE_CATALOG.refresh()), true);
    assert.deepEqual(await page.evaluate(() => window.BITS_MESSAGES.filter((message) => message.text.startsWith("CUSTOM")).map((message) => message.text)), ["CUSTOM one", "CUSTOM two"]);
    assert.equal(await page.evaluate(() => window.BITS_MESSAGES.some((message) => message.text.startsWith("DATABASE STATUS"))), false);
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
      if (url.pathname === "/supabase-config.js") return route.fulfill({
        contentType: "text/javascript",
        body: `
          window.SUPABASE_CONFIG = { url: "https://test.example", anonKey: "test-key" };
          window.__messageRows = ${JSON.stringify([
            ...Array.from({ length: 30 }, (_, index) => entry(index + 1, "messages", `Regular message ${index + 1}`)),
            entry(31, "bootMessages", "Seasonal boot fixture", "halloween"),
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
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`${server.origin}/admin/#/messages`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      loginView.hidden = true;
      inboxView.hidden = false;
      window.dispatchEvent(new CustomEvent("admin:authenticated"));
    });
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 25);
    assert.equal(await page.locator("#message-library-editor").isVisible(), true);
    await page.locator("#message-page-next").click();
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 5);
    await page.locator("#message-page-previous").click();
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 25);
    await page.locator('[data-message-action="edit"]').first().click();
    await page.waitForFunction(() => {
      const top = document.querySelector("#message-library-form").getBoundingClientRect().top;
      return top >= 0 && top < 200;
    });
    assert.equal(await page.locator("#message-text").evaluate((field) => document.activeElement === field), true);
    await page.locator("#message-text").fill("<script>not executable</script> edited message");
    await page.locator("#message-weight").fill("0.25");
    await page.locator('[data-message-format="fontWeight"]').fill("700");
    await page.locator("#message-colorful").check();
    assert.equal(await page.locator("#message-preview script").count(), 0);
    await page.locator("#message-save").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").textContent.startsWith("Message saved."));
    assert.equal(await page.evaluate(() => window.__messageRows[0].weight), 0.25);
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
    await page.locator("#message-library-list button").first().click();
    assert.equal(await page.locator("#message-mistype").isChecked(), true);
    assert.equal(await page.locator("#message-corrected-text").inputValue(), "**Corrected** {{color:red|red}} <script>still literal</script>");
    await page.locator("#message-mistype").uncheck();
    assert.equal(await page.locator("#message-corrected-text").isDisabled(), true);
    assert.equal(await page.locator("#message-corrected-preview-container").isVisible(), false);
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows[0].corrected_text === null);
    await page.locator("#message-enabled").uncheck();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows[0].enabled === false);
    await page.locator("#message-new").click();
    await page.locator("#message-text").fill("Added in Admin");
    await page.locator("#message-enabled").check();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.length === 32);
    assert.equal(await page.evaluate(() => window.__messageRows.at(-1).markup), false, "new messages start as literal text");
    await page.locator("#message-search").fill("Added in Admin");
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 1);
    await page.locator('[data-message-action="delete"]').click();
    await page.waitForFunction(() => window.__messageRows.length === 31);
    await page.locator("#message-search").fill("");
    await page.locator("#message-profile").selectOption("halloween");
    await page.locator("#message-category").selectOption("bootMessages");
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 1);
    await page.locator('[data-message-action="edit"]').click();
    assert.equal(await page.locator("#message-weighted-options").isVisible(), false);
    assert.equal(await page.locator("#message-mistype-options").isVisible(), false);
    await page.locator("#message-text").fill("Updated **seasonal** boot message");
    await page.locator("#message-markup").check();
    assert.equal(await page.locator("#message-preview strong").textContent(), "seasonal");
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.find(row => row.position === 31).text === "Updated **seasonal** boot message");
    assert.equal(await page.evaluate(() => window.__messageRows.find(row => row.position === 31).markup), true);
    await page.locator("#message-library-editor summary").click();
    await page.locator("#message-pool-new").click();
    await page.locator("#message-pool-title").fill("Year boundary");
    await page.locator("#message-pool-start").fill("2000-12-30");
    await page.locator("#message-pool-end").fill("2000-01-02");
    await page.locator("#message-pool-mode").selectOption("exclusive");
    await page.locator("#message-pool-enabled").check();
    await page.locator('#message-pool-form button[type="submit"]').click();
    await page.waitForFunction(() => window.__poolRows.length === 1 && document.querySelector("#message-profile").value === window.__poolRows[0].id);
    const customId = await page.locator("#message-profile").inputValue();
    await page.locator("#message-text").fill("CUSTOM BOOT");
    await page.locator("#message-enabled").check();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.some(row => row.text === "CUSTOM BOOT"));
    await page.locator("#message-category").selectOption("messages");
    await page.locator("#message-text").fill("CUSTOM STATUS");
    await page.locator("#message-enabled").check();
    await page.locator("#message-save").click();
    await page.waitForFunction(() => window.__messageRows.some(row => row.text === "CUSTOM STATUS"));
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
    await page.locator("#message-timezone").fill("Invalid/Timezone");
    await page.locator('#message-timezone-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("#message-pool-status").dataset.state === "error");
    assert.equal(await page.evaluate(() => window.__messageSettings[0].timezone), "America/Chicago");
    await page.locator("#message-timezone").fill("America/New_York");
    await page.locator('#message-timezone-form button[type="submit"]').click();
    await page.waitForFunction(() => window.__messageSettings[0].timezone === "America/New_York");
    await page.locator("#message-pool-delete").click();
    await page.waitForFunction(() => window.__poolRows.length === 0 && document.querySelector("#message-profile").value === "standard");
    assert.equal(await page.evaluate((id) => window.__messageRows.some(row => row.profile === id), customId), false);
    await page.locator("#message-profile").selectOption("halloween");
    await page.locator("#message-category").selectOption("bootMessages");
    await page.waitForFunction(() => document.querySelector("#message-library-list").children.length === 1);
    await page.locator('[data-message-action="edit"]').click();
    await page.evaluate(() => { window.__messageFailure = true; });
    await page.locator("#message-text").fill("Must not save");
    await page.locator("#message-save").click();
    await page.waitForFunction(() => document.querySelector("#message-library-status").dataset.state === "error");
    assert.equal(await page.evaluate(() => window.__messageRows.find(row => row.position === 31).text), "Updated **seasonal** boot message");
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#message-library-editor"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) })));
    assert.deepEqual(violations, [], `${width}px message editor accessibility`);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px Admin message library: row Edit/Delete and auto-scroll, pool create/edit/delete, annual/one-time ranges, timezone validation/save, routing, paging, markup/mistype, failure reporting, accessibility`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
