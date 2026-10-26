import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const calendarSource = readFileSync(new URL("../seasonal-calendar.js", import.meta.url), "utf8");
const messageSource = readFileSync(new URL("../messages.js", import.meta.url), "utf8");
const seasonalSource = readFileSync(new URL("../seasonal-messages.js", import.meta.url), "utf8");
const themeSource = readFileSync(new URL("../theme-init.js", import.meta.url), "utf8");
const scheduleSource = themeSource.slice(0, themeSource.indexOf("const seasonalThemeState ="));
const metrics = ["cpu", "gpu", "network", "ram", "storage", "thermal"];
const holidays = [
  [2026, 2, 14, "valentines"],
  [2026, 3, 17, "st-patricks"],
  [2026, 4, 5, "easter"],
  [2026, 4, 22, "earth-day"],
  [2026, 7, 4, "independence-day"],
  [2026, 11, 26, "thanksgiving"],
];

function onDate(year, month, day, withBaseMessages = true) {
  const date = new Date(year, month - 1, day, 12);
  const context = {
    window: {},
    localStorage: { getItem: () => null },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [date.getTime()])); }
    },
  };
  vm.createContext(context);
  vm.runInContext(`${calendarSource}\n${scheduleSource}
    window.BITS_GET_SEASONAL_THEME_STATE = getSeasonalThemeState;`, context);
  if (withBaseMessages) vm.runInContext(messageSource, context);
  const base = {
    messages: context.window.BITS_MESSAGES,
    activities: context.window.BITS_ACTIVITIES,
    shutdownMessages: context.window.BITS_SHUTDOWN_MESSAGES,
  };
  vm.runInContext(seasonalSource, context);
  return { window: context.window, profile: context.window.BITS_SEASONAL_PROFILE, base };
}

const totalWeight = (pool) => pool.reduce((sum, entry) => sum + entry.weight, 0);

for (const [year, month, day, id] of holidays) {
  test(`${id} adds high-weight messages while preserving the complete regular pools`, () => {
    const { window, profile, base } = onDate(year, month, day);
    assert.equal(profile.id, id);
    assert.equal(profile.mode, "additive");
    assert.equal(profile.messages.length, 16);
    assert.equal(profile.activities.length, 6);
    assert.ok(profile.messages.every((entry) => entry.weight === 18));
    assert.ok(profile.activities.every((entry) => entry.weight === 12));
    assert.ok(base.messages.every((entry) => window.BITS_MESSAGES.includes(entry)));
    assert.ok(base.activities.every((entry) => window.BITS_ACTIVITIES.includes(entry)));
    assert.ok(base.shutdownMessages.every((entry) => window.BITS_SHUTDOWN_MESSAGES.includes(entry)));
    assert.equal(window.BITS_MESSAGES.length, base.messages.length + 16);
    assert.equal(window.BITS_ACTIVITIES.length, base.activities.length + 6);
    assert.equal(new Set(profile.messages.map((entry) => entry.text)).size, 16);
    const share = totalWeight(profile.messages) / totalWeight(window.BITS_MESSAGES);
    const activityShare = totalWeight(profile.activities) / totalWeight(window.BITS_ACTIVITIES);
    assert.equal(share, 16 * 18 / (totalWeight(base.messages) + 16 * 18), `${id}: holiday message share`);
    assert.equal(activityShare, 6 * 12 / (totalWeight(base.activities) + 6 * 12), `${id}: holiday activity share`);
    assert.ok(window.BITS_GET_SEASONAL_THEME_STATE(new Date(year, month - 1, day)).availableThemeIds.includes(id));
  });

  test(`${id} includes boot, live hardware, shutdown, and desktop messages`, () => {
    const { window, profile, base } = onDate(year, month, day);
    for (const field of ["bootMessages", "initialBootSteps", "shutdownMessages", "playingDeadMessages", "glitchMessages"]) {
      assert.ok(profile[field].length > 0, field);
      assert.ok(profile[field].every((text) => typeof text === "string" && text.trim()), field);
    }
    assert.equal(profile.bootMessages.length, 6);
    assert.equal(profile.shutdownMessages.length, 3);
    for (const metric of metrics) assert.equal(profile.monitorJokes[metric].length, 2, metric);
    for (const text of profile.shutdownMessages) {
      assert.equal(window.BITS_SHUTDOWN_MESSAGES.filter((entry) => entry === text).length, 12);
    }
    assert.equal(window.BITS_SHUTDOWN_MESSAGES.length, base.shutdownMessages.length + 36);
  });

  test(`${id} only activates on its date`, () => {
    for (const offset of [-1, 1]) {
      const { profile } = onDate(year, month, day + offset);
      assert.ok(!profile.ids.includes(id), `offset ${offset}`);
    }
  });
}

test("non-holidays leave regular pools unchanged", () => {
  const { window, profile, base } = onDate(2026, 8, 10);
  assert.equal(profile.mode, "standard");
  assert.equal(window.BITS_MESSAGES, base.messages);
  assert.equal(window.BITS_ACTIVITIES, base.activities);
  assert.equal(window.BITS_SHUTDOWN_MESSAGES, base.shutdownMessages);
});

test("existing major holidays retain exclusive message pools", () => {
  for (const [month, day, id] of [[1, 1, "new-year"], [10, 31, "halloween"], [12, 25, "christmas"]]) {
    const { window, profile, base } = onDate(2026, month, day);
    assert.equal(profile.mode, "exclusive");
    assert.equal(profile.id, id);
    assert.equal(window.BITS_MESSAGES, profile.messages);
    assert.equal(window.BITS_ACTIVITIES, profile.activities);
    assert.equal(window.BITS_SHUTDOWN_MESSAGES, profile.shutdownMessages);
    assert.ok(!window.BITS_MESSAGES.some((entry) => base.messages.includes(entry)));
  }
});

test("Easter and Earth Day overlap additively without dropping either set or the regular pool", () => {
  const { window, profile, base } = onDate(2057, 4, 22);
  assert.equal(profile.mode, "additive");
  assert.deepEqual([...profile.ids].sort(), ["earth-day", "easter"]);
  assert.equal(profile.messages.length, 32);
  assert.equal(window.BITS_MESSAGES.length, base.messages.length + 32);
  for (const metric of metrics) assert.equal(profile.monitorJokes[metric].length, 4);
});

test("messages and visual themes agree on moving Easter and Thanksgiving dates", () => {
  for (const [year, month, day, id] of [
    [1818, 3, 22, "easter"], [1943, 4, 25, "easter"], [1954, 4, 18, "easter"],
    [2024, 3, 31, "easter"], [2025, 4, 20, "easter"], [2027, 3, 28, "easter"],
    [2100, 3, 28, "easter"], [2024, 11, 28, "thanksgiving"], [2029, 11, 22, "thanksgiving"],
  ]) {
    const { window, profile } = onDate(year, month, day);
    assert.ok(profile.ids.includes(id), `${year}: messages`);
    assert.ok(window.BITS_GET_SEASONAL_THEME_STATE(new Date(year, month - 1, day)).availableThemeIds.includes(id), `${year}: theme`);
  }
});

test("profiles resolve without the public message pools, including Admin's standalone loading order", () => {
  const { window, profile } = onDate(2026, 4, 5, false);
  assert.equal(profile.id, "easter");
  assert.equal(window.BITS_MESSAGES, undefined);
  assert.equal(window.BITS_ACTIVITIES, undefined);
});

test("every seasonal entry is a valid positive weighted message or nonempty string", () => {
  const { window } = onDate(2026, 8, 10);
  for (const [, month, day] of [...holidays, [2026, 1, 1], [2026, 10, 31], [2026, 12, 25]]) {
    const profile = window.BITS_GET_SEASONAL_PROFILE(new Date(2026, month - 1, day));
    for (const field of ["messages", "activities"]) {
      for (const entry of profile[field]) {
        assert.ok(typeof entry.text === "string" && entry.text.trim());
        assert.ok(Number.isFinite(entry.weight) && entry.weight > 0);
      }
    }
    assert.ok(metrics.every((metric) => profile.monitorJokes[metric].every((text) => typeof text === "string" && text.trim())));
  }
});

test("all HTML consumers load the shared calendar before its dependents", () => {
  for (const file of [
    "index.html", "404.html", "source.html", "useless.html", "online/index.html",
    "boot/index.html", "professional/index.html", "blog/index.html", "blog/post.html", "admin/index.html",
  ]) {
    const html = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const calendar = html.indexOf('src="/seasonal-calendar.js?');
    assert.ok(calendar >= 0, file);
    for (const asset of ["theme-init.js", "seasonal-messages.js"]) {
      const dependent = html.indexOf(`src="/${asset}?`);
      if (dependent >= 0) assert.ok(calendar < dependent, `${file}: ${asset}`);
    }
  }
});
