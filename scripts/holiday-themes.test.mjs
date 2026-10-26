import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const themeSource = readFileSync(new URL("../theme-init.js", import.meta.url), "utf8");
const calendarSource = readFileSync(new URL("../seasonal-calendar.js", import.meta.url), "utf8");
const preferenceSource = themeSource.slice(0, themeSource.indexOf("function getColorSchemePreference()"));
const optionsSource = themeSource.slice(themeSource.indexOf("function buildThemeOptions("), themeSource.indexOf("function getPageId("));
const effectsSource = readFileSync(new URL("../theme-effects.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const newThemes = ["valentines", "st-patricks", "easter", "earth-day", "independence-day", "thanksgiving"];

test("Aero retains Classic as its default and exposes five opt-in variants without experimental layout chrome", () => {
  const { available } = themesOn(2026, 10, 22);
  const aero = available.find(theme => theme.id === "aero-glass");
  assert.equal(aero.stylesheet, true);
  assert.equal(aero.experimental, undefined);
  assert.deepEqual(Array.from(aero.variants, variant => variant.id), ["classic", "windows-7", "vista", "graphite", "rose", "frost"]);
  assert.equal(aero.darkColor, "#0d3358");
  assert.equal(aero.lightColor, "#cfe8fb");
});

test("The ten collection themes use lazy CSS and both schemes without experimental chrome", () => {
  const { available } = themesOn(2026, 10, 22);
  for (const id of ["eink-reader", "blueprint", "spacecraft", "frutiger-eco", "holographic", "newspaper", "workbench", "stickerbook", "night-train", "museum"]) {
    const theme = available.find(theme => theme.id === id);
    assert.ok(theme, id);
    assert.equal(theme.stylesheet, true, id);
    assert.equal(theme.experimental, undefined, id);
    assert.ok(theme.darkColor && theme.lightColor, id);
    assert.match(readFileSync(new URL(`../layouts/${id}.css`, import.meta.url), "utf8"), /@import "\/layouts\/collection-base\.css\?v=/);
  }
  for (const [id, variant] of [["terminal", "amber"], ["minebits", "mushroom-fields"]]) {
    assert.ok(available.find(theme => theme.id === id).variants.some(entry => entry.id === variant));
  }
});

function themesOn(year, month, day, preferences = {}) {
  const date = new Date(year, month - 1, day, 12);
  const stored = new Map(Object.entries(preferences));
  const context = {
    window: { location: { reload() {} } },
    document: {
      createElement(tagName) {
        return { tagName, children: [], append(...children) { this.children.push(...children); } };
      },
    },
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key),
    },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [date.getTime()])); }
    },
  };
  vm.runInNewContext(`String.prototype.localeCompare = () => { throw new Error("Theme startup must not initialize locale collation."); };
    ${calendarSource}\n${preferenceSource}\n${optionsSource}
    globalThis.api = {
      state: seasonalThemeState, initial: initialInterfaceTheme.id,
      catalog: seasonalInterfaceThemes, select: selectInterfaceTheme,
      resolve: resolveInterfaceTheme, buildOptions: buildThemeOptions
    };`, context);
  return { ...context.api, available: context.window.BITS_INTERFACE_THEMES, stored };
}

test("fixed uppercase ASCII theme names keep the same alphabetical order without locale initialization", () => {
  const { available } = themesOn(2026, 10, 22, { "bits-theme-debug": "enabled" });
  const names = Array.from(available, (theme) => theme.name);
  for (const name of names) {
    assert.match(name, /^[\x20-\x7e]+$/);
    assert.equal(name, name.toUpperCase());
  }
  assert.ok(names.length >= 65, "Include experimental and seasonal themes");
  for (const locale of ["en", "de", "fr", "ja", "sv", "tr"]) {
    assert.deepEqual(names, [...names].sort((first, second) => first.localeCompare(second, locale)), locale);
  }
});

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

test("debug pickers group all seasonal themes once under Special Themes", () => {
  const debug = themesOn(2026, 8, 10, { "bits-theme-debug": "enabled" });
  const nodes = debug.buildOptions();
  const group = nodes.find((node) => node.label === "SPECIAL THEMES");
  assert.ok(group);
  assert.equal(group.tagName, "optgroup");
  assert.deepEqual(
    [...group.children].map((option) => option.value).sort(),
    Object.keys(debug.catalog).sort(),
  );
  assert.ok(nodes.find((node) => node.label === "STANDARD THEMES").children.every((node) => !debug.catalog[node.value]));
  const options = nodes.flatMap((node) => node.tagName === "optgroup" ? [...node.children] : [node]);
  assert.equal(options.length, debug.available.length);
  assert.equal(new Set(options.map((option) => option.value)).size, options.length);
  assert.ok(nodes.some((node) => node.label === "EXPERIMENTAL LAYOUTS"));
});

test("group labels honor the picker formatter", () => {
  const debug = themesOn(2026, 8, 10, { "bits-theme-debug": "enabled" });
  const groups = debug.buildOptions((label) => label.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()))
    .filter((node) => node.tagName === "optgroup");
  assert.deepEqual([...groups].map((group) => group.label), ["Standard Themes", "Special Themes", "Experimental Layouts"]);
});

test("normal seasonal availability remains unchanged without debug grouping", () => {
  for (const [month, day, expected] of [[8, 10, []], [2, 14, ["winter", "valentines"]]]) {
    const normal = themesOn(2026, month, day);
    const nodes = normal.buildOptions();
    assert.ok(!nodes.some((node) => node.label === "SPECIAL THEMES"));
    assert.deepEqual(
      [...nodes.find((node) => node.label === "STANDARD THEMES").children]
        .filter((node) => normal.catalog[node.value]).map((node) => node.value).sort(),
      [...expected].sort(),
    );
  }
});

test("standard and experimental themes each appear once in their own group", () => {
  for (const preferences of [{}, { "bits-theme-debug": "enabled" }]) {
    const result = themesOn(2026, 8, 10, preferences);
    const nodes = result.buildOptions();
    assert.ok(nodes.every((node) => node.tagName === "optgroup" && node.children.length > 0));
    for (const [label, experimental] of [["STANDARD THEMES", false], ["EXPERIMENTAL LAYOUTS", true]]) {
      assert.deepEqual(
        [...nodes.find((node) => node.label === label).children].map((node) => node.value),
        [...result.available].filter((theme) => !theme.seasonal && Boolean(theme.experimental) === experimental)
          .map((theme) => theme.id),
      );
    }
    const ids = nodes.flatMap((node) => [...node.children].map((option) => option.value));
    assert.equal(ids.length, result.available.length);
    assert.equal(new Set(ids).size, ids.length);
  }
});

function atmosphere(options = {}) {
  const element = () => ({
    dataset: {}, properties: new Map(),
    style: { setProperty(key, value) { this.owner.properties.set(key, value); } },
    textContent: "",
  });
  const layer = { dataset: {}, hidden: false, replaceChildren(...children) { this.children = children; } };
  const root = {
    dataset: { interfaceTheme: "independence-day", runtime: "ready", ...options.dataset },
    style: { removeProperty() {}, setProperty() {} },
  };
  const events = new Map();
  const overlays = [];
  const animations = [];
  const clock = { now: 10000 };
  const context = {
    document: {
      documentElement: root,
      hidden: Boolean(options.hidden),
      addEventListener(name, handler) { events.set(name, handler); },
      body: { append(node) { overlays.push(node); } },
      querySelector: () => layer,
      createElement() {
        const node = element();
        node.style.owner = node;
        node.setAttribute = () => {};
        node.remove = () => { overlays.splice(overlays.indexOf(node), 1); };
        node.animate = (frames, timing) => {
          const animation = { frames, timing, cancel() { this.oncancel?.(); } };
          animations.push(animation);
          return animation;
        };
        return node;
      },
    },
    window: {
      addEventListener(name, handler) { events.set(name, handler); },
      matchMedia: (query) => ({
        matches: query.includes("reduced-motion") ? Boolean(options.reducedMotion) : Boolean(options.forcedColors),
        addEventListener() {},
      }),
    },
    MutationObserver: class { observe() {} },
    Date: { now: () => clock.now },
  };
  vm.runInNewContext(effectsSource, context);
  return { layer, root, render: context.renderThemeAtmosphere, events, overlays, animations, clock, document: context.document };
}

test("E-Ink refresh defaults off and only runs on real window opens, with bounded opacity and frequency", () => {
  const app = atmosphere({ dataset: { interfaceTheme: "eink-reader" } });
  const open = newlyOpened => app.events.get("desktop-window:opened")({ detail: { newlyOpened } });
  open(true);
  assert.equal(app.animations.length, 0);
  app.root.dataset.einkRefresh = "on";
  app.render();
  assert.equal(app.animations.length, 0, "Selecting E-Ink or changing settings must not flash");
  open(false);
  assert.equal(app.animations.length, 0, "Focusing a visible window must not refresh");
  open(true);
  assert.equal(app.overlays.length, 1);
  assert.equal(app.animations[0].timing.duration, 260);
  assert.equal(Math.max(...app.animations[0].frames.map(frame => frame.opacity)), 0.08);
  app.animations[0].onfinish();
  assert.equal(app.overlays.length, 0);
  open(true);
  assert.equal(app.animations.length, 1, "Rapid opens are throttled");
  app.clock.now += 2000;
  open(true);
  assert.equal(app.animations.length, 2);
  app.root.dataset.einkRefresh = "off";
  app.render();
  assert.equal(app.overlays.length, 0, "Turning the preference off cancels and removes the overlay");
});

for (const options of [
  { dataset: { motion: "reduced" } }, { reducedMotion: true },
  { dataset: { effects: "off" } }, { dataset: { contrast: "high" } },
  { forcedColors: true }, { hidden: true },
  { dataset: { runtime: "pending" } },
]) {
  test(`E-Ink refresh respects accessibility/visibility: ${JSON.stringify(options)}`, () => {
    const app = atmosphere({ ...options, dataset: { interfaceTheme: "eink-reader", einkRefresh: "on", ...options.dataset } });
    app.events.get("desktop-window:opened")({ detail: { newlyOpened: true } });
    assert.equal(app.animations.length, 0);
  });
}

test("Active E-Ink refresh is cleaned up when leaving the theme or hiding the tab", () => {
  const app = atmosphere({ dataset: { interfaceTheme: "eink-reader", einkRefresh: "on" } });
  app.events.get("desktop-window:opened")({ detail: { newlyOpened: true } });
  app.root.dataset.interfaceTheme = "default";
  app.render();
  assert.equal(app.overlays.length, 0);
  app.root.dataset.interfaceTheme = "eink-reader";
  app.clock.now += 2000;
  app.events.get("desktop-window:opened")({ detail: { newlyOpened: true } });
  app.document.hidden = true;
  app.events.get("visibilitychange")();
  assert.equal(app.overlays.length, 0);
});

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
