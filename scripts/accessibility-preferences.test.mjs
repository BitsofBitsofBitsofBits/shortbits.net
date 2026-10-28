import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../shared/scripts/accessibility.js", import.meta.url), "utf8");
function setup(initial = {}) {
  const stored = new Map(Object.entries(initial));
  const dataset = {};
  const listeners = new Map();
  const events = [];
  const warnings = [];
  const context = {
    document: { documentElement: { dataset }, addEventListener() {}, getAnimations: () => [] },
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    window: {
      addEventListener: (key, callback) => listeners.set(key, callback),
      dispatchEvent: event => events.push(event),
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    console: { warn: (...args) => warnings.push(args) },
  };
  vm.runInNewContext(source, context);
  return { ...context, stored, dataset, listeners, events, warnings, api: context.window.BITS_ACCESSIBILITY };
}

test("accessibility defaults preserve the original experience without writing preferences", () => {
  const app = setup();
  assert.deepEqual(app.dataset, {
    motion: "system", textsize: "default", contrast: "default", effects: "on", einkRefresh: "off",
    pauseContent: "off", readableText: "off", largeControls: "off", simpleLayout: "off",
    transparency: "default", focus: "default",
  });
  assert.equal(app.stored.size, 0);
  assert.equal(app.events.length, 0);
});

test("existing large-text choices and all new preferences survive initialization", () => {
  for (const size of ["large", "extra-large"]) {
    const app = setup({
      "bits-text-size": size, "bits-pause-content": "on", "bits-readable-text": "on",
      "bits-large-controls": "on", "bits-simple-layout": "on",
      "bits-transparency": "reduced", "bits-focus": "enhanced",
    });
    assert.equal(app.dataset.textsize, size);
    for (const key of ["pauseContent", "readableText", "largeControls", "simpleLayout"]) assert.equal(app.dataset[key], "on");
    assert.equal(app.dataset.transparency, "reduced");
    assert.equal(app.dataset.focus, "enhanced");
    assert.equal(app.warnings.length, 0);
  }
});

test("setting preferences validates inputs, persists first, and publishes changes immediately", () => {
  const app = setup();
  app.api.set("text-size", "extra-large");
  assert.equal(app.dataset.textsize, "extra-large");
  assert.equal(app.stored.get("bits-text-size"), "extra-large");
  assert.equal(app.events[0].type, "bits:preferences-changed");
  assert.equal(app.events[0].detail.key, "text-size");
  assert.throws(() => app.api.set("unknown", "on"), /Invalid accessibility preference/);
  assert.throws(() => app.api.set("text-size", "huge"), /Invalid accessibility preference/);
  app.localStorage.setItem = () => { throw new Error("Storage blocked"); };
  assert.throws(() => app.api.set("pause-content", "on"), /Storage blocked/);
  assert.equal(app.dataset.pauseContent, "off", "A failed save is not presented as success");
});

test("storage events synchronize other pages and clearing preferences restores defaults", () => {
  const app = setup();
  app.stored.set("bits-pause-content", "on");
  app.listeners.get("storage")({ key: "bits-pause-content" });
  assert.equal(app.dataset.pauseContent, "on");
  assert.equal(app.events.length, 1);
  app.listeners.get("storage")({ key: "unrelated" });
  assert.equal(app.events.length, 1);
  app.stored.clear();
  app.listeners.get("storage")({ key: null });
  assert.equal(app.dataset.pauseContent, "off");
  assert.equal(app.events.length, 2);
  app.localStorage.getItem = () => { throw new Error("Storage blocked"); };
  app.api.sync();
  assert.ok(app.warnings.length > 0, "Read failures are explicitly logged");
});

test("all public page templates and the Admin share accessibility assets", () => {
  for (const page of [
    "index.html", "online/index.html", "professional/index.html", "professional/resume/index.html",
    "nowplaying/index.html", "boot/index.html", "blog/index.html", "blog/post.html",
    "projects/index.html", "projects/homelab/index.html", "projects/shortbits/index.html",
    "404.html", "useless.html", "source.html", "admin/index.html",
  ]) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
    assert.match(html, /\/shared\/scripts\/accessibility\.js/, page);
    assert.match(html, /\/shared\/styles\/accessibility\.css/, page);
  }
});

test("pause only stops looping animations, never finite content-reveal animations", () => {
  const app = setup();
  const looping = {
    playState: "running",
    effect: { getTiming: () => ({ iterations: Infinity }) },
    pause() { this.playState = "paused"; },
    play() { this.playState = "running"; },
  };
  const reveal = { playState: "running", effect: { getTiming: () => ({ iterations: 1 }) } };
  app.document.getAnimations = () => [looping, reveal];
  app.api.set("pause-content", "on");
  app.listeners.get("bits:preferences-changed")();
  assert.equal(looping.playState, "paused");
  assert.equal(reveal.playState, "running");
  app.api.set("pause-content", "off");
  app.listeners.get("bits:preferences-changed")();
  assert.equal(looping.playState, "running");
});
