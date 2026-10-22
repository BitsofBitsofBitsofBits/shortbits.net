import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const themeSource = readFileSync(new URL("../theme-init.js", import.meta.url), "utf8");
const calendarSource = readFileSync(new URL("../seasonal-calendar.js", import.meta.url), "utf8");
const preferenceSource = themeSource.slice(0, themeSource.indexOf("function getColorSchemePreference()"));
const effectsSource = readFileSync(new URL("../theme-effects.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const newThemes = ["valentines", "st-patricks", "easter", "earth-day", "independence-day", "thanksgiving"];

function themesOn(year, month, day, preferences = {}) {
  const date = new Date(year, month - 1, day, 12);
  const stored = new Map(Object.entries(preferences));
  const context = {
    window: { location: { reload() {} } },
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key),
    },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [date.getTime()])); }
    },
  };
  vm.runInNewContext(`${calendarSource}\n${preferenceSource}
    globalThis.api = {
      state: seasonalThemeState, initial: initialInterfaceTheme.id,
      catalog: seasonalInterfaceThemes, select: selectInterfaceTheme,
      resolve: resolveInterfaceTheme
    };`, context);
  return { ...context.api, available: context.window.BITS_INTERFACE_THEMES, stored };
}

for (const [year, month, day, theme] of [
  [2026, 2, 14, "valentines"],
  [2026, 3, 17, "st-patricks"],
  [2026, 4, 5, "easter"],
  [2026, 4, 22, "earth-day"],
  [2026, 7, 4, "independence-day"],
  [2026, 11, 26, "thanksgiving"],
]) {
  test(`${theme} is automatically selected on its holiday`, () => {
    const result = themesOn(year, month, day);
    assert.equal(result.state.automaticThemeId, theme);
    assert.equal(result.initial, theme);
    assert.ok(result.available.some((entry) => entry.id === theme && entry.seasonal));
    const previous = themesOn(year, month, day - 1);
    const next = themesOn(year, month, day + 1);
    assert.ok(!previous.state.availableThemeIds.includes(theme));
    assert.ok(!next.state.availableThemeIds.includes(theme));
    assert.ok(styles.includes(`:root[data-interface-theme="${theme}"] {`));
    assert.ok(styles.includes(`:root[data-interface-theme="${theme}"][data-color-scheme="light"] {`));
  });
}

test("Valentine's Day takes priority over Winter without removing Winter", () => {
  const result = themesOn(2026, 2, 14);
  assert.deepEqual([...result.state.availableThemeIds], ["winter", "valentines"]);
});

test("Thanksgiving follows the fourth Thursday, including earliest/latest dates", () => {
  for (const [year, day] of [[2023, 23], [2024, 28], [2025, 27], [2026, 26], [2029, 22]]) {
    assert.equal(themesOn(year, 11, day).initial, "thanksgiving");
    assert.ok(!themesOn(year, 11, day - 7).state.availableThemeIds.includes("thanksgiving"));
  }
});

test("Gregorian Easter handles March, April, and computus corrections", () => {
  for (const [year, month, day] of [
    [1818, 3, 22], [1943, 4, 25], [1954, 4, 18], [2000, 4, 23],
    [2024, 3, 31], [2025, 4, 20], [2026, 4, 5], [2027, 3, 28],
    [2038, 4, 25], [2100, 3, 28],
  ]) {
    assert.equal(themesOn(year, month, day).initial, "easter", String(year));
    assert.ok(!themesOn(year, month, day - 1).state.availableThemeIds.includes("easter"));
    assert.ok(!themesOn(year, month, day + 1).state.availableThemeIds.includes("easter"));
  }
});

test("Easter wins an Earth Day overlap, but both remain selectable", () => {
  const result = themesOn(2057, 4, 22);
  assert.deepEqual([...result.state.availableThemeIds], ["earth-day", "easter"]);
  assert.equal(result.initial, "easter");
});

test("existing seasonal boundaries and priority are preserved", () => {
  for (const [month, day, expected] of [
    [10, 27, ""], [10, 28, "spooky"], [11, 1, "spooky"], [11, 2, ""],
    [12, 1, "winter"], [12, 22, "winter"], [12, 23, "christmas"],
    [12, 26, "christmas"], [12, 27, "winter"], [12, 31, "new-year"],
    [1, 1, "new-year"], [1, 2, "winter"], [2, 28, "winter"], [3, 1, ""],
  ]) assert.equal(themesOn(2026, month, day).state.automaticThemeId, expected, `${month}/${day}`);
  assert.equal(themesOn(2028, 2, 29).initial, "winter");
});

test("holiday dismissal and choosing the overlapping season remain persistent", () => {
  const result = themesOn(2026, 2, 14, { "bits-interface-theme": "terminal" });
  result.select("winter");
  assert.equal(result.resolve(), "winter");
  assert.equal(result.stored.get("bits-seasonal-theme-choice"), "valentines:winter");
  result.select("terminal");
  assert.equal(result.resolve(), "terminal");
  assert.equal(result.stored.get("bits-seasonal-theme-dismissed"), "valentines");
  const reload = themesOn(2026, 2, 14, Object.fromEntries(result.stored));
  assert.equal(reload.initial, "terminal");
  const nextDay = themesOn(2026, 2, 15, Object.fromEntries(result.stored));
  assert.equal(nextDay.initial, "winter");
});

test("debug preview exposes all holiday themes outside their dates", () => {
  const normal = themesOn(2026, 8, 10);
  assert.ok(!normal.available.some((theme) => theme.seasonal));
  const debug = themesOn(2026, 8, 10, { "bits-theme-debug": "enabled" });
  for (const theme of newThemes) assert.ok(debug.available.some((entry) => entry.id === theme));
  debug.select("independence-day");
  assert.equal(debug.resolve(), "independence-day");
  assert.equal(debug.stored.get("bits-seasonal-theme-choice"), "debug:independence-day");
});

function atmosphere(options = {}) {
  const element = () => ({
    dataset: {}, properties: new Map(),
    style: { setProperty(key, value) { this.owner.properties.set(key, value); } },
    textContent: "",
  });
  const layer = { dataset: {}, hidden: false, replaceChildren(...children) { this.children = children; } };
  const root = { dataset: { interfaceTheme: "independence-day", ...options.dataset } };
  const context = {
    document: {
      documentElement: root,
      querySelector: () => layer,
      createElement() { const node = element(); node.style.owner = node; return node; },
    },
    window: {
      addEventListener() {},
      matchMedia: (query) => ({
        matches: query.includes("reduced-motion") ? Boolean(options.reducedMotion) : Boolean(options.forcedColors),
        addEventListener() {},
      }),
    },
    MutationObserver: class { observe() {} },
  };
  vm.runInNewContext(effectsSource, context);
  return { layer, root, render: context.renderThemeAtmosphere };
}

test("fireworks have a bounded four bursts of sixteen binary Bits", () => {
  const { layer } = atmosphere();
  assert.equal(layer.hidden, false);
  assert.equal(layer.children.length, 64);
  const origins = new Set();
  const delays = new Set();
  for (const node of layer.children) {
    assert.match(node.textContent, /^[01]$/);
    assert.equal(node.dataset.theme, "independence-day");
    assert.match(node.properties.get("--firework-dx"), /^-?\d+\.\d{2}vmin$/);
    assert.match(node.properties.get("--firework-dy"), /^-?\d+\.\d{2}vmin$/);
    origins.add(`${node.properties.get("--particle-x")},${node.properties.get("--particle-y")}`);
    delays.add(node.properties.get("--particle-delay"));
  }
  assert.equal(origins.size, 4);
  assert.equal(delays.size, 4);
});

test("repeated render and theme changes replace particles rather than leaking nodes", () => {
  const app = atmosphere();
  app.render();
  assert.equal(app.layer.children.length, 64);
  app.root.dataset.interfaceTheme = "valentines";
  app.render();
  assert.equal(app.layer.children.length, 18);
  assert.ok(app.layer.children.every((node) => node.dataset.theme === "valentines"));
});

for (const options of [
  { dataset: { effects: "off" } },
  { dataset: { contrast: "high" } },
  { forcedColors: true },
]) {
  test("disabled effects or accessible color modes suppress fireworks entirely", () => {
    const { layer } = atmosphere(options);
    assert.equal(layer.hidden, true);
    assert.equal(layer.children.length, 0);
  });
}

for (const options of [{ reducedMotion: true }, { dataset: { motion: "reduced" } }]) {
  test("OS and site reduced motion select the static atmosphere", () => {
    assert.equal(atmosphere(options).layer.dataset.motion, "reduced");
  });
}
