import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { buildThemeCss } from "./build-theme-css.mjs";
import { versionAssets } from "./build-site.mjs";

const bootSource = await readFile(new URL("../online/scripts/boot.js", import.meta.url), "utf8");
const loaderSource = await readFile(new URL("../online/scripts/arcade-loader.js", import.meta.url), "utf8");
const themeSource = await readFile(new URL("../shared/scripts/theme-init.js", import.meta.url), "utf8");
const runtimeSource = await readFile(new URL("../online/scripts/online-runtime.js", import.meta.url), "utf8");

function runBoot({ mobile = false, reduced = false, seen = false, paused = false, steps, runtime } = {}) {
  const listeners = new Map();
  const windowListeners = new Map();
  const elements = new Map(["boot-screen", "boot-log", "boot-progress-bar", "boot-skip"].map((id) => [
    `#${id}`,
    { hidden: true, style: {}, replaceChildren() {}, append() {}, focus() {}, addEventListener() {} },
  ]));
  const background = { tagName: "MAIN", inert: false };
  const timers = [];
  const root = { dataset: { motion: reduced ? "reduced" : "system", pauseContent: paused ? "on" : "off", ...(runtime ? { runtime } : {}) } };
  const context = {
    document: {
      documentElement: root,
      body: { children: [elements.get("#boot-screen"), background] },
      querySelector: (selector) => elements.get(selector),
      addEventListener: (type, callback) => listeners.set(type, callback),
      createElement: () => ({}),
    },
    window: {
      matchMedia: (query) => ({ matches: query.includes("max-width") ? mobile || reduced : reduced }),
      addEventListener: (name, callback) => windowListeners.set(name, callback),
      removeEventListener: (name) => windowListeners.delete(name),
      setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
      clearTimeout() {},
      ...(steps ? { BITS_SEASONAL_PROFILE: { mode: "exclusive", initialBootSteps: steps } } : {}),
    },
    sessionStorage: { getItem: () => seen ? "true" : null, setItem() {} },
    console,
  };
  vm.runInNewContext(bootSource, context);
  const initialState = root.dataset.boot;
  listeners.get("DOMContentLoaded")();
  return { ...context, initialState, background, timers, windowListeners, screen: elements.get("#boot-screen") };
}

for (const options of [{ mobile: true }, { reduced: true }, { seen: true }, { paused: true }]) {
  test(`automatic boot does not block ${JSON.stringify(options)}`, () => {
    const result = runBoot(options);
    assert.equal(result.initialState, "complete");
    assert.equal(result.document.documentElement.dataset.boot, "complete");
    assert.equal(result.background.inert, false);
    assert.equal(result.timers.length, 0);
    assert.equal(typeof result.window.BITS_BOOT.play, "function");
  });
}

test("desktop boot finishes within 900ms and manual replay stays available", () => {
  const result = runBoot();
  assert.equal(result.initialState, "pending");
  assert.equal(result.background.inert, true);
  const steps = [...result.timers];
  steps.forEach(({ callback }) => callback());
  assert.ok(Math.max(...steps.map(({ delay }) => delay)) + result.timers.at(-1).delay <= 900);
  result.timers.at(-1).callback();
  assert.equal(result.document.documentElement.dataset.boot, "complete");
  result.window.BITS_BOOT.play();
  assert.equal(result.document.documentElement.dataset.boot, "pending");
  result.window.BITS_BOOT.skip();
  assert.equal(result.background.inert, false);
});

test("an empty exclusive seasonal boot uses standard steps and still finishes within 900ms", () => {
  const result = runBoot({ steps: [] });
  const steps = [...result.timers];
  assert.ok(steps.length > 0);
  steps.forEach(({ callback }) => callback());
  assert.ok(Math.max(...steps.map(({ delay }) => delay)) + result.timers.at(-1).delay <= 900);
  result.timers.at(-1).callback();
  assert.equal(result.document.documentElement.dataset.boot, "complete");
  assert.equal(result.background.inert, false);
});

test("desktop boot waits for deferred seasonal data and can still be skipped", () => {
  const result = runBoot({ runtime: "pending" });
  assert.equal(result.timers.length, 0);
  assert.equal(result.screen.hidden, false);
  result.window.BITS_SEASONAL_PROFILE = { mode: "exclusive", initialBootSteps: ["SEASONAL BOOT"] };
  result.windowListeners.get("bits:runtime-ready")();
  assert.equal(result.timers.length, 1);
  result.window.BITS_BOOT.skip();
  assert.equal(result.document.documentElement.dataset.boot, "complete");

  const skipped = runBoot({ runtime: "pending" });
  skipped.window.BITS_BOOT.skip();
  skipped.windowListeners.get("bits:runtime-ready")();
  assert.equal(skipped.timers.length, 0);
});

test("arcade loads once on first open, retries failure, and preserves the version query", async () => {
  const scripts = [];
  let observe;
  const arcade = { hidden: true, classList: { contains: () => false } };
  const context = {
    URL,
    document: {
      currentScript: { src: "https://example.test/online/scripts/arcade-loader.js?v=arcade-10" },
      querySelector: (selector) => selector === "#arcade-window" ? arcade : {},
      head: { append: (script) => scripts.push(script) },
      createElement() {
        return { listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; }, remove() {} };
      },
    },
    window: {},
    MutationObserver: class {
      constructor(callback) { observe = callback; }
      observe() {}
      disconnect() {}
    },
  };
  vm.runInNewContext(loaderSource, context);
  assert.equal(scripts.length, 0);
  arcade.hidden = false;
  observe();
  observe();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://example.test/online/scripts/arcade.js?v=arcade-10");
  scripts[0].listeners.error();
  await Promise.resolve();
  observe();
  assert.equal(scripts.length, 2);
  scripts[1].listeners.load();
  await context.window.BITS_ARCADE.load();
  observe();
  assert.equal(scripts.length, 2);
});

test("online runtime starts after first paint and preserves dependency/version order", () => {
  const frames = [];
  const appended = [];
  const events = [];
  const root = { dataset: {} };
  const context = {
    document: {
      documentElement: root,
      querySelectorAll: () => [{ src: "https://example.test/shared/scripts/messages.js?v=123" }, { src: "https://example.test/online/scripts/script.js?v=123" }],
      createElement: () => ({
        listeners: {},
        addEventListener(type, callback) { this.listeners[type] = callback; },
      }),
      head: { append: (script) => appended.push(script) },
    },
    window: {
      requestAnimationFrame: (callback) => frames.push(callback),
      dispatchEvent: (event) => events.push(event.type),
    },
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  vm.runInNewContext(runtimeSource, context);
  assert.equal(root.dataset.runtime, "pending");
  assert.equal(appended.length, 0);
  frames.shift()();
  assert.equal(appended.length, 0);
  frames.shift()();
  assert.deepEqual(appended.map(({ src, async }) => [src, async]), [
    ["https://example.test/shared/scripts/messages.js?v=123", false],
    ["https://example.test/online/scripts/script.js?v=123", false],
  ]);
  appended[0].listeners.load();
  assert.equal(root.dataset.runtime, "pending");
  appended[1].listeners.load();
  assert.equal(root.dataset.runtime, "ready");
  assert.deepEqual(events, ["bits:runtime-ready"]);
});

test("online runtime queues early control clicks until ordered initialization completes", () => {
  const frames = [];
  const handlers = new Map();
  const scripts = [];
  let activations = 0;
  const control = {
    isConnected: true,
    click() { activations += 1; },
    closest(selector) {
      return selector.startsWith("button,") ? control : null;
    },
  };
  const context = {
    document: {
      documentElement: { dataset: {} },
      querySelectorAll: () => [{ src: "https://example.test/online/scripts/script.js" }],
      addEventListener: (type, callback) => handlers.set(type, callback),
      removeEventListener: (type) => handlers.delete(type),
      createElement: () => ({
        listeners: {},
        addEventListener(type, callback) { this.listeners[type] = callback; },
      }),
      head: { append: (script) => scripts.push(script) },
    },
    window: {
      requestAnimationFrame: (callback) => frames.push(callback),
      dispatchEvent() {},
    },
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  vm.runInNewContext(runtimeSource, context);
  handlers.get("click")({
    type: "click", target: control,
    preventDefault() {}, stopImmediatePropagation() {},
  });
  assert.equal(activations, 0);
  frames.shift()();
  frames.shift()();
  scripts[0].listeners.load();
  assert.equal(activations, 1);
  assert.equal(handlers.size, 0);
});

for (const failure of ["fetch", "execution", "timeout"]) {
  test(`online runtime surfaces ${failure} failure instead of reporting ready`, () => {
    const frames = [];
    const scripts = [];
    const events = [];
    let errorHandler;
    let timeout;
    const root = { dataset: {} };
    const source = "https://example.test/online/scripts/script.js?v=build";
    const context = {
      document: {
        documentElement: root,
        querySelectorAll: () => [{ src: source }],
        createElement: () => ({
          listeners: {},
          addEventListener(type, callback) { this.listeners[type] = callback; },
        }),
        head: { append: (script) => scripts.push(script) },
      },
      window: {
        requestAnimationFrame: (callback) => frames.push(callback),
        dispatchEvent: (event) => events.push(event.type),
        addEventListener: (type, callback) => { if (type === "error") errorHandler = callback; },
        removeEventListener() {},
        setTimeout: (callback) => { timeout = callback; return 1; },
        clearTimeout() {},
      },
      CustomEvent: class { constructor(type) { this.type = type; } },
    };
    vm.runInNewContext(runtimeSource, context);
    frames.shift()();
    frames.shift()();
    if (failure === "fetch") {
      scripts[0].listeners.error();
    } else if (failure === "execution") {
      errorHandler({ filename: source });
      scripts[0].listeners.load();
    } else {
      timeout();
    }
    assert.equal(root.dataset.runtime, "error");
    assert.deepEqual(events, ["bits:runtime-error"]);
  });
}

for (const outcome of ["load", "error", "timeout"]) {
  test(`online runtime waits for nonblocking full CSS and handles ${outcome}`, () => {
    const frames = [], scripts = [], events = [];
    let timeout;
    const stylesheet = {
      media: "print", sheet: null, listeners: {},
      addEventListener(name, callback) { this.listeners[name] = callback; },
    };
    const root = { dataset: {} };
    vm.runInNewContext(runtimeSource, {
      document: {
        documentElement: root,
        querySelector: (selector) => selector === "[data-online-styles]" ? stylesheet : null,
        querySelectorAll: () => [{ src: "https://example.test/online/scripts/script.js" }],
        createElement: () => ({
          listeners: {},
          addEventListener(name, callback) { this.listeners[name] = callback; },
        }),
        head: { append: (script) => scripts.push(script) },
      },
      window: {
        requestAnimationFrame: (callback) => frames.push(callback),
        setTimeout: (callback) => { timeout = callback; },
        clearTimeout() {},
        dispatchEvent: (event) => events.push(event.type),
      },
      CustomEvent: class { constructor(type) { this.type = type; } },
    });
    frames.shift()();
    frames.shift()();
    assert.equal(stylesheet.media, "all");
    assert.equal(scripts.length, 0);
    if (outcome === "load") {
      stylesheet.sheet = {};
      stylesheet.listeners.load();
      assert.equal(scripts.length, 1);
      scripts[0].listeners.load();
      assert.equal(root.dataset.runtime, "ready");
    } else {
      if (outcome === "error") stylesheet.listeners.error();
      else timeout();
      assert.equal(root.dataset.runtime, "error");
      assert.equal(scripts.length, 0);
      stylesheet.listeners.load();
      assert.equal(scripts.length, 0, "late stylesheet loads must not resume a failed runtime");
    }
    assert.equal(events.length, 1);
  });
}

test("paint-aware browsers do not fetch enhancement scripts before content is painted", () => {
  let notify;
  const appended = [];
  let disconnected = false;
  const context = {
    document: {
      documentElement: { dataset: {} },
      querySelectorAll: () => [{ src: "https://example.test/online/scripts/script.js?v=build" }],
      createElement: () => ({ addEventListener() {} }),
      head: { append: (script) => appended.push(script) },
    },
    window: { requestAnimationFrame() { throw new Error("Must use actual paint events when supported"); } },
    PerformanceObserver: class {
      static supportedEntryTypes = ["paint"];
      constructor(callback) { notify = callback; }
      observe(options) { assert.equal(options.type, "paint"); assert.equal(options.buffered, true); }
      disconnect() { disconnected = true; }
    },
  };
  vm.runInNewContext(runtimeSource, context);
  assert.equal(appended.length, 0);
  notify({ getEntries: () => [{ name: "first-paint" }] });
  assert.equal(appended.length, 0);
  notify({ getEntries: () => [{ name: "first-contentful-paint" }] });
  assert.equal(appended.length, 1);
  assert.equal(disconnected, true);
});

test("compact shared stylesheet is current and removes at least 70% of desktop CSS", async () => {
  const actual = await readFile(new URL("../shared/styles/theme-base.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../shared/styles/styles.css", import.meta.url), "utf8");
  assert.equal(actual, await buildThemeCss(), "Run node scripts\\build-theme-css.mjs after shared CSS changes.");
  assert.ok(Buffer.byteLength(actual) < Buffer.byteLength(source) * 0.3);
  for (const match of source.matchAll(/:root\[data-interface-theme="([^"]+)"\]/g)) {
    assert.ok(actual.includes(match[0]), `Missing ${match[1]} theme tokens`);
  }
  assert.ok(actual.includes("--w95-hi:"));
  assert.ok(actual.includes("rgb-accent-color-cycle"));
});

test("staged theme stylesheet and runtime URLs contain exactly one build version", async () => {
  const directory = new URL("../.performance-asset-test/", import.meta.url);
  await mkdir(directory);
  await mkdir(new URL("shared/scripts/", directory), { recursive: true });
  try {
    await writeFile(new URL("shared/scripts/theme-init.js", directory), themeSource);
    const { fileURLToPath } = await import("node:url");
    const version = await versionAssets(fileURLToPath(directory).replace(/[\\/]$/, ""));
    const staged = await readFile(new URL("shared/scripts/theme-init.js", directory), "utf8");
    const nodes = new Map();
    const context = {
      layoutAssetVersion: "layouts-6",
      document: {
        documentElement: { dataset: {} },
        readyState: "complete",
        head: { append(node) { nodes.set(node.id, node); } },
        getElementById: (id) => nodes.get(id),
        createElement: () => ({}),
      },
    };
    const start = staged.indexOf("function syncThemeAssets(");
    const end = staged.indexOf('document.documentElement.dataset.page = getPageId();', start);
    vm.runInNewContext(`${staged.slice(start, end)}\nsyncThemeAssets({ id: "terminal", experimental: true });`, context);
    assert.equal(nodes.get("bits-theme-stylesheet").href, `/shared/styles/layouts/terminal.css?v=${version}`);
    assert.equal(nodes.get("bits-layout-runtime").src, `/shared/scripts/layouts/runtime.js?v=${version}`);
    nodes.clear();
    vm.runInNewContext(`${staged.slice(start, end)}\nsyncThemeAssets({ id: "pride-transgender", stylesheet: "pride" });`, context);
    assert.equal(nodes.get("bits-theme-stylesheet").href, `/shared/styles/layouts/pride.css?v=${version}`);
    assert.equal(nodes.has("bits-layout-runtime"), false, "Shared Pride CSS does not load experimental layout scripts");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const [name, preferences] of [
  ["narrow viewport", { matches: true }],
  ["reduced motion", { motion: "reduced" }],
  ["low memory", { memory: 4 }],
  ["data saver", { saveData: true }],
  ["runtime fallback", { runtime: true }],
  ["desktop", {}],
]) {
  test(`online performance profile is decided before first paint: ${name}`, () => {
    const dataset = { page: "online", motion: preferences.motion || "system" };
    const classes = new Set();
    const context = {
      document: {
        documentElement: {
          dataset,
          classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
        },
      },
      window: { matchMedia: () => ({ matches: preferences.matches || false }) },
      navigator: { deviceMemory: preferences.memory || 8, hardwareConcurrency: 8, connection: { saveData: preferences.saveData || false } },
      sessionStorage: { getItem: () => preferences.runtime ? "true" : null },
    };
    const start = themeSource.indexOf('if (document.documentElement.dataset.page === "online")');
    const end = start + themeSource.slice(start).search(/if\s*\(\s*legacyRgbMode/);
    vm.runInNewContext(themeSource.slice(start, end), context);
    const expected = name !== "desktop";
    assert.equal(classes.has("is-performance-lite"), expected);
    assert.equal(dataset.performanceProfile, expected ? "lite" : "full");
  });
}
