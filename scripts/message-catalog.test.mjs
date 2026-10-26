import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { messageCatalogDefaults } from "./message-catalog-data.mjs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const defaults = messageCatalogDefaults();
function setup({ date = "2026-08-10T12:00:00", rows = defaults, fail = false, cache = null, storageFails = false } = {}) {
  const events = new EventTarget();
  const storage = new Map(cache ? Object.entries(cache) : []);
  const calls = [];
  const warnings = [];
  const window = {
    SUPABASE_CONFIG: { url: "https://database.example", anonKey: "public-key" },
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    setTimeout: () => 1,
  };
  const context = vm.createContext({
    window, URLSearchParams, AbortSignal, CustomEvent,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [date])); } },
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
      assert.equal(query.get("enabled"), "eq.true");
      assert.ok(query.get("select").split(",").includes("corrected_text"));
      const ids = query.get("profile").slice(4, -1).split(",");
      const filtered = rows.filter((row) => ids.includes(row.profile));
      const offset = Number(query.get("offset"));
      return { ok: true, json: async () => filtered.slice(offset, offset + 500) };
    },
  });
  vm.runInContext(read("seasonal-calendar.js"), context);
  vm.runInContext(read("messages.js"), context);
  vm.runInContext(read("message-text.js"), context);
  vm.runInContext(read("message-catalog.js"), context);
  vm.runInContext(read("seasonal-messages.js"), context);
  return { window, context, calls, warnings, storage };
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
  const key = "bits-message-catalog-v1:standard";
  const rows = defaults.filter((row) => row.profile === "standard").map((row) => row.category === "messages" ? { ...row, text: `cached ${row.position}` } : row);
  const app = setup({ fail: true, cache: { [key]: JSON.stringify({ rows, loadedAt: 1 }) } });
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
  const key = "bits-message-catalog-v1:standard,easter";
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
  const key = "bits-message-catalog-v1:standard,easter";
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
