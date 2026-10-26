import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { messageCatalogDefaults } from "./message-catalog-data.mjs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const defaults = messageCatalogDefaults();
function setup({ date = "2026-08-10T12:00:00", rows = defaults, fail = false, cache = null, storageFails = false, pools = [], timezone = "America/Chicago", switchDateAfterFetch = null, temporal = undefined } = {}) {
  const events = new EventTarget();
  const storage = new Map(cache ? Object.entries(cache) : []);
  const calls = [];
  const warnings = [];
  const timers = [];
  let currentDate = date;
  let advancedDate = false;
  const window = {
    SUPABASE_CONFIG: { url: "https://database.example", anonKey: "public-key" },
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    scheduler: { yield: async () => {} },
  };
  const context = vm.createContext({
    window, URLSearchParams, AbortSignal, CustomEvent, Temporal: temporal,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [currentDate])); }
      static now() { return new Date(currentDate).getTime(); }
    },
    document: { documentElement: { dataset: { runtime: "pending" } }, readyState: "complete" },
    console: { warn: (...args) => warnings.push(args) },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { if (storageFails) throw new Error("storage denied"); storage.set(key, value); },
    },
    fetch: async (url) => {
      calls.push(url);
      if (fail) throw new Error("network unavailable");
      const query = new URL(url).searchParams;
      if (new URL(url).pathname.endsWith("/site_message_settings")) return { ok: true, json: async () => [{ id: "primary", timezone }] };
      if (new URL(url).pathname.endsWith("/site_message_pools")) return { ok: true, json: async () => pools.filter((pool) => pool.enabled) };
      assert.equal(query.get("enabled"), "eq.true");
      assert.ok(query.get("select").split(",").includes("corrected_text"));
      const ids = query.get("profile").slice(4, -1).split(",");
      const filtered = rows.filter((row) => ids.includes(row.profile));
      const offset = Number(query.get("offset"));
      return { ok: true, json: async () => {
        if (switchDateAfterFetch && !advancedDate) { currentDate = switchDateAfterFetch; advancedDate = true; }
        return filtered.slice(offset, offset + 500);
      } };
    },
  });
  vm.runInContext(read("seasonal-calendar.js"), context);
  vm.runInContext(read("messages.js"), context);
  vm.runInContext(read("message-text.js"), context);
  vm.runInContext(read("message-catalog.js"), context);
  vm.runInContext(read("seasonal-messages.js"), context);
  return { window, context, calls, warnings, storage, timers, setDate: (value) => { currentDate = value; } };
}
test("catalog startup never waits for the network, validates all seeded messages, and pages beyond 500 entries", async () => {
  const app = setup();
  assert.equal(app.calls.length, 0);
  defaults.forEach(app.window.BITS_MESSAGE_CATALOG.validate);
  const target = app.window.BITS_MESSAGES;
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.equal(app.window.BITS_MESSAGES, target, "existing weighted consumers retain a live array");
  assert.ok(app.calls.length > 1);
  assert.deepEqual(JSON.parse(JSON.stringify(target)).map((row) => [row.text, row.weight]),
    defaults.filter((row) => row.profile === "standard" && row.category === "messages").map((row) => [row.text, row.weight]));
});
test("database edits and appearance fields update weighted arrays without accumulating seasonal duplicates", async () => {
  for (const [date, season, mode] of [
    ["2026-08-10T12:00:00", null, "standard"], ["2026-04-05T12:00:00", "easter", "additive"], ["2026-12-25T12:00:00", "christmas", "exclusive"],
  ]) {
    const rows = defaults.map((row) => row.profile === (season ?? "standard") && row.category === "messages"
      ? { ...row, text: `edited ${row.position}`, weight: 0.25, colorful: true, format: { color: "#123456" } } : row);
    const app = setup({ date, rows });
    const target = app.window.BITS_MESSAGES;
    const count = target.length;
    await app.window.BITS_MESSAGE_CATALOG.refresh();
    await app.window.BITS_MESSAGE_CATALOG.refresh();
    assert.equal(app.window.BITS_SEASONAL_PROFILE.mode, mode);
    assert.equal(target.length, count, `${mode}: repeated refresh must not grow the pool`);
    assert.ok(target.some((entry) => entry.text.startsWith("edited ") && entry.colorful && entry.weight === 0.25));
    if (season) assert.ok(app.window.BITS_GET_SEASONAL_PROFILE().messages.some((entry) => entry.text.startsWith("edited ")));
  }
});
test("registered boot, monitor, and desktop pools use database entries and empty pools explicitly retain defaults", async () => {
  const app = setup({ rows: defaults.filter((row) => row.category !== "monitor.cpu").map((row) =>
    row.category === "bootMessages" && row.profile === "standard" ? { ...row, text: `changed ${row.position}` } : row) });
  const boot = ["bundled boot"];
  const cpu = ["bundled cpu"];
  app.window.BITS_MESSAGE_CATALOG.bind("standard", "bootMessages", boot);
  app.window.BITS_MESSAGE_CATALOG.bind("standard", "monitor.cpu", cpu);
  await app.window.BITS_MESSAGE_CATALOG.refresh();
  assert.ok(boot[0].startsWith("changed "));
  assert.deepEqual(cpu, ["bundled cpu"]);
  assert.ok(app.warnings.some((entry) => String(entry[0]).includes("monitor.cpu")));
});
test("valid cache is available synchronously and database failures preserve it; corrupt caches do not replace defaults", async () => {
  const key = "bits-message-catalog-v2";
  const rows = defaults.filter((row) => row.profile === "standard").map((row) => row.category === "messages" ? { ...row, text: `cached ${row.position}` } : row);
  const app = setup({ fail: true, cache: { [key]: JSON.stringify({ rows, pools: [], timezone: "America/Chicago", loadedAt: 1 }) } });
  assert.ok(app.window.BITS_MESSAGES[0].text.startsWith("cached "));
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), false);
  assert.ok(app.window.BITS_MESSAGES[0].text.startsWith("cached "));
  assert.match(app.window.BITS_MESSAGE_CATALOG.status, /unavailable/);
  const corrupt = setup({ cache: { [key]: '{"rows":[{}],"loadedAt":1}' } });
  assert.equal(corrupt.window.BITS_MESSAGES[0].text, defaults[0].text);
  assert.ok(corrupt.warnings.length);
});
test("invalid database data leaves all existing arrays untouched and storage failures remain explicit", async () => {
  const rows = defaults.map((row) => row.position === 1 ? { ...row, format: { backgroundImage: "url(https://bad.example)" } } : row);
  const app = setup({ rows });
  const original = JSON.stringify(app.window.BITS_MESSAGES);
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), false);
  assert.equal(JSON.stringify(app.window.BITS_MESSAGES), original);
  const denied = setup({ storageFails: true });
  assert.equal(await denied.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.ok(denied.warnings.length);
});

test("markup flags survive weighted and plain-string pool loading, seasonal recombination, and cached reloads", async () => {
  const key = "bits-message-catalog-v2";
  const rows = defaults.map((row) => ({ ...row, text: `**entry ${row.position}**`, markup: true }));
  const app = setup({ date: "2026-04-05T12:00:00", rows });
  const boot = ["fallback boot"];
  app.window.BITS_MESSAGE_CATALOG.bind("standard", "bootMessages", boot);
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.equal(app.window.BITS_MESSAGES[0].markup, true);
  assert.equal(app.window.BITS_SHUTDOWN_MESSAGES[0].markup, true);
  assert.equal(boot[0].markup, true);
  assert.equal(app.window.BITS_SEASONAL_PROFILE.monitorJokes.cpu[0].markup, true);
  const cached = setup({ date: "2026-04-05T12:00:00", fail: true, cache: { [key]: app.storage.get(key) } });
  assert.equal(cached.window.BITS_MESSAGES[0].markup, true);
  assert.equal(cached.window.BITS_SHUTDOWN_MESSAGES[0].markup, true);
});

test("mistype corrections survive seasonal recombination and cached reloads without changing legacy messages", async () => {
  const date = "2026-04-05T12:00:00";
  const rows = defaults.map((row) => row.category === "messages"
    ? { ...row, text: "A **tyop**", markup: true, corrected_text: "A **typo**" }
    : { ...row, corrected_text: null });
  const app = setup({ date, rows });
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.ok(app.window.BITS_MESSAGES.every((message) => message.correctedText === "A **typo**" && message.markup));
  assert.ok(app.window.BITS_GET_SEASONAL_PROFILE().messages.every((message) => message.correctedText === "A **typo**"));
  const key = "bits-message-catalog-v2";
  const cached = setup({ date, fail: true, cache: { [key]: app.storage.get(key) } });
  assert.equal(cached.window.BITS_MESSAGES[0].correctedText, "A **typo**");
  assert.equal(await cached.window.BITS_MESSAGE_CATALOG.refresh(), false);
  assert.equal(cached.window.BITS_MESSAGES[0].correctedText, "A **typo**");
  const legacy = setup();
  assert.equal(await legacy.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.equal(legacy.window.BITS_MESSAGES[0].correctedText, undefined);
});

test("invalid corrections are rejected atomically and are limited to splash/status messages", async () => {
  for (const overrides of [
    { corrected_text: "" }, { corrected_text: " " }, { corrected_text: 42 },
    { corrected_text: "x".repeat(2001) }, { corrected_text: defaults[0].text },
    { category: "activities", corrected_text: "corrected" },
    { category: "bootMessages", corrected_text: "corrected" },
  ]) {
    const rows = defaults.map((row, index) => index === 0 ? { ...row, ...overrides } : row);
    const app = setup({ rows });
    const original = JSON.stringify(app.window.BITS_MESSAGES);
    assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), false);
    assert.equal(JSON.stringify(app.window.BITS_MESSAGES), original);
    assert.ok(app.warnings.some((warning) => String(warning[1]).includes("Mistype corrections")));
  }
});

const datedPool = (id, changes = {}) => ({
  id: `custom-${id}`, title: id, schedule: "annual", starts_on: "2000-08-10", ends_on: "2000-08-10",
  mode: "additive", enabled: true, ...changes,
});
const poolMessage = (pool, position) => ({ ...defaults[0], position, profile: pool.id, text: pool.title, enabled: true });

test("custom date ranges are inclusive, repeat annually, wrap New Year, and support leap days and one-time years", async () => {
  for (const [pool, date, active] of [
    [datedPool("single"), "2026-08-10T18:00:00Z", true],
    [datedPool("single"), "2026-08-11T18:00:00Z", false],
    [datedPool("wrap", { mode: "exclusive", starts_on: "2000-12-30", ends_on: "2000-01-02" }), "2027-01-01T18:00:00Z", true],
    [datedPool("wrap", { starts_on: "2000-12-30", ends_on: "2000-01-02" }), "2027-01-03T18:00:00Z", false],
    [datedPool("leap", { starts_on: "2000-02-29", ends_on: "2000-02-29" }), "2028-02-29T18:00:00Z", true],
    [datedPool("leap", { starts_on: "2000-02-29", ends_on: "2000-02-29" }), "2027-03-01T18:00:00Z", false],
    [datedPool("once", { schedule: "once", starts_on: "2026-08-10", ends_on: "2026-08-12" }), "2026-08-12T18:00:00Z", true],
    [datedPool("once", { schedule: "once", starts_on: "2026-08-10", ends_on: "2026-08-12" }), "2027-08-10T18:00:00Z", false],
    [datedPool("disabled", { enabled: false }), "2026-08-10T18:00:00Z", false],
  ]) {
    const app = setup({ date, pools: [pool], rows: [...defaults, poolMessage(pool, 9001)] });
    assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
    assert.equal(app.window.BITS_SEASONAL_PROFILE.ids.includes(pool.id), active, `${pool.title} on ${date}`);
  }
});

test("exclusive pools combine, suppress additive and standard messages, and keep empty message types usable", async () => {
  const pools = [datedPool("first", { mode: "exclusive" }), datedPool("second", { mode: "exclusive" }), datedPool("additive")];
  const app = setup({ pools, rows: [...defaults, ...pools.map((pool, index) => poolMessage(pool, 9001 + index))] });
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.deepEqual(Array.from(app.window.BITS_SEASONAL_PROFILE.ids), ["custom-first", "custom-second"]);
  assert.deepEqual(Array.from(app.window.BITS_MESSAGES, (message) => message.text), ["first", "second"]);
  assert.ok(app.window.BITS_ACTIVITIES.length, "empty exclusive activities must retain standard activities");
  assert.ok(app.window.BITS_SHUTDOWN_MESSAGES.length, "empty exclusive shutdown messages must retain standard messages");
  await app.window.BITS_MESSAGE_CATALOG.refresh();
  assert.equal(app.window.BITS_MESSAGES.length, 2, "refresh must not accumulate duplicates");
  const key = "bits-message-catalog-v2";
  const cached = setup({ fail: true, cache: { [key]: app.storage.get(key) } });
  assert.deepEqual(Array.from(cached.window.BITS_MESSAGES, (message) => message.text), ["first", "second"]);
  assert.equal(await cached.window.BITS_MESSAGE_CATALOG.refresh(), false);
  assert.equal(cached.window.BITS_SEASONAL_PROFILE.mode, "exclusive");
});

test("additive pools mix with standard entries and custom exclusives combine with built-in exclusive holidays", async () => {
  const pool = datedPool("mix");
  const app = setup({ pools: [pool], rows: [...defaults, poolMessage(pool, 9001)] });
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.ok(app.window.BITS_MESSAGES.some((message) => message.text === "mix"));
  assert.ok(app.window.BITS_MESSAGES.some((message) => message.text === defaults[0].text));
  const christmas = datedPool("christmas", { mode: "exclusive", starts_on: "2000-12-25", ends_on: "2000-12-25" });
  const holiday = setup({ date: "2026-12-25T18:00:00Z", pools: [christmas], rows: [...defaults, poolMessage(christmas, 9001)] });
  assert.equal(await holiday.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.deepEqual(Array.from(holiday.window.BITS_SEASONAL_PROFILE.ids), ["christmas", "custom-christmas"]);
  assert.ok(holiday.window.BITS_MESSAGES.some((message) => message.text === "christmas"));
  assert.ok(!holiday.window.BITS_MESSAGES.some((message) => message.text === defaults[0].text));
});

test("the configured calendar honors Central midnight, DST, timezone changes, and built-in holiday dates", async () => {
  for (const [start, date, timezone, active] of [
    ["2000-08-10", "2026-08-10T04:59:59Z", "America/Chicago", false],
    ["2000-08-10", "2026-08-10T05:00:00Z", "America/Chicago", true],
    ["2000-02-10", "2026-02-10T05:59:59Z", "America/Chicago", false],
    ["2000-02-10", "2026-02-10T06:00:00Z", "America/Chicago", true],
    ["2000-08-10", "2026-08-10T04:30:00Z", "America/New_York", true],
    ["2000-08-10", "2026-08-10T04:30:00Z", "UTC", true],
  ]) {
    const pool = datedPool("timezone", { starts_on: start, ends_on: start });
    const app = setup({ date, timezone, pools: [pool], rows: [...defaults, poolMessage(pool, 9001)] });
    assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
    assert.equal(app.window.BITS_SEASONAL_PROFILE.ids.includes(pool.id), active, `${date} in ${timezone}`);
  }
  const holiday = setup({ date: "2026-12-24T04:00:00Z" });
  assert.equal(await holiday.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.ok(!holiday.window.BITS_SEASONAL_PROFILE.ids.includes("christmas"), "Central time is still before the December 24-26 Christmas pool");
});

test("invalid dates/settings fail explicitly without changing the active catalog", async () => {
  const app = setup();
  for (const changes of [{ starts_on: "2000-02-30" }, { ends_on: "bad" }, { title: " " },
    { schedule: "unknown" }, { id: "standard" }, { mode: "unknown" },
    { schedule: "once", starts_on: "2026-12-31", ends_on: "2026-01-01" }]) {
    assert.throws(() => app.window.BITS_MESSAGE_CATALOG.validatePool(datedPool("bad", changes)), /Enter a pool/);
  }
  const invalid = setup({ timezone: "Not/A_Timezone" });
  const original = JSON.stringify(invalid.window.BITS_MESSAGES);
  assert.equal(await invalid.window.BITS_MESSAGE_CATALOG.refresh(), false);
  assert.equal(JSON.stringify(invalid.window.BITS_MESSAGES), original);
  assert.ok(invalid.warnings.length);
});

test("an open page checks for calendar-day changes and refreshes its active pool selection", async () => {
  const pool = datedPool("today", { mode: "exclusive" });
  const app = setup({ date: "2026-08-10T23:59:30-05:00", pools: [pool], rows: [...defaults, poolMessage(pool, 9001)] });
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.equal(app.window.BITS_MESSAGES[0].text, "today");
  app.setDate("2026-08-11T00:00:30-05:00");
  app.timers.find((timer) => timer.delay === 60_000).callback();
  const refresh = app.timers.find((timer) => timer.delay === 1000);
  assert.ok(refresh, "a new calendar day must schedule a refresh even without focus/reload");
  await refresh.callback();
  assert.equal(app.window.BITS_SEASONAL_PROFILE.mode, "standard");
  assert.ok(!app.window.BITS_MESSAGES.some((message) => message.text === "today"));
});

test("a fetch crossing Central midnight keeps its selection timestamp so the next day check loads the new pool", async () => {
  const pools = [
    datedPool("before", { mode: "exclusive" }),
    datedPool("after", { mode: "exclusive", starts_on: "2000-08-11", ends_on: "2000-08-11" }),
  ];
  const app = setup({
    date: "2026-08-10T23:59:59-05:00", switchDateAfterFetch: "2026-08-11T00:00:01-05:00",
    pools, rows: [...defaults, ...pools.map((pool, index) => poolMessage(pool, 9001 + index))],
  });
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  app.timers.find((timer) => timer.delay === 60_000).callback();
  const refresh = app.timers.find((timer) => timer.delay === 1000);
  assert.ok(refresh, "a pre-midnight selection must not be marked as already refreshed for the new date");
  await refresh.callback();
  assert.deepEqual(Array.from(app.window.BITS_MESSAGES, (message) => message.text), ["after"]);
});

test("native Temporal avoids locale-format startup while preserving timezone validation and date selection", async () => {
  const instants = [];
  const temporal = { Instant: { fromEpochMilliseconds(value) {
    instants.push(value);
    return { toZonedDateTimeISO(zone) {
      if (zone !== "America/Chicago") throw new RangeError("Invalid time zone");
      return { year: 2026, month: 8, day: 10 };
    } };
  } } };
  const pool = datedPool("native", { mode: "exclusive" });
  const app = setup({ temporal, pools: [pool], rows: [...defaults, poolMessage(pool, 9001)] });
  app.context.Intl = { DateTimeFormat: class {
    constructor() { throw new Error("Native calendar conversion must not initialize locale formatting."); }
  } };
  assert.equal(await app.window.BITS_MESSAGE_CATALOG.refresh(), true);
  assert.equal(app.window.BITS_MESSAGES[0].text, "native");
  assert.ok(instants.includes(0), "the zone must be validated through Temporal");
  assert.ok(instants.some((value) => value > 0), "date conversion must use the requested instant");
  assert.throws(() => app.window.BITS_MESSAGE_CATALOG.validateTimezone("Invalid/Timezone"), /Invalid time zone/);
  assert.throws(() => app.window.BITS_MESSAGE_CATALOG.validateTimezone("+05:00"), /IANA timezone/);
});

test("background refresh yields between parsing, applying the complete snapshot, and persisting its cache", async () => {
  const rows = defaults.map((row, index) => index === 0 ? { ...row, text: "YIELDED MESSAGE" } : row);
  const app = setup({ rows });
  const releases = [];
  app.window.scheduler.yield = () => new Promise((resolve) => releases.push(resolve));
  const refresh = app.window.BITS_MESSAGE_CATALOG.refresh();
  await new Promise(setImmediate);
  assert.equal(releases.length, 1);
  assert.equal(app.window.BITS_MESSAGES[0].text, defaults[0].text);
  assert.equal(app.storage.size, 0);
  releases[0]();
  await new Promise(setImmediate);
  assert.equal(app.window.BITS_MESSAGES[0].text, "YIELDED MESSAGE");
  assert.equal(releases.length, 2);
  assert.equal(app.storage.size, 0);
  releases[1]();
  assert.equal(await refresh, true);
  assert.equal(app.storage.size, 1);
});

test("older browsers without scheduler.yield use separate timer tasks for refresh application and caching", async () => {
  const app = setup();
  app.window.scheduler = undefined;
  const refresh = app.window.BITS_MESSAGE_CATALOG.refresh();
  await new Promise(setImmediate);
  const apply = app.timers.filter((timer) => timer.delay === 0);
  assert.equal(apply.length, 1);
  apply[0].callback();
  await new Promise(setImmediate);
  const tasks = app.timers.filter((timer) => timer.delay === 0);
  assert.equal(tasks.length, 2);
  tasks[1].callback();
  assert.equal(await refresh, true);
});
