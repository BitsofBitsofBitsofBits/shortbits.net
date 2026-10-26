import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../not-found/scripts/falling-bits.js", import.meta.url), "utf8");
function setup({ dataset = {}, reduced = false, forced = false, compact = false, hidden = false, path = "/missing", random = Math.random } = {}) {
  const children = [];
  const layer = {
    hidden: true, children,
    get childElementCount() { return children.length; },
    append(node) { children.push(node); },
    replaceChildren() { children.length = 0; },
  };
  const events = new Map();
  const timers = new Map();
  const media = new Map();
  let nextTimer = 0;
  let mutation;
  const document = {
    hidden, documentElement: { dataset },
    querySelector: () => layer,
    addEventListener(name, callback) { events.set(name, callback); },
    createElement(tag) {
      const node = {
        tag, style: { setProperty(key, value) { this[key] = value; } },
        addEventListener(name, callback) { this[name] = callback; },
        remove() { children.splice(children.indexOf(node), 1); },
      };
      return node;
    },
  };
  vm.runInNewContext(source, {
    document,
    Math: Object.assign(Object.create(Math), { random }),
    window: {
      location: { pathname: path },
      matchMedia(query) {
        const result = {
          matches: query.includes("reduced-motion") ? reduced : query.includes("forced-colors") ? forced : compact,
          addEventListener(name, callback) { this.change = callback; },
        };
        media.set(query, result);
        return result;
      },
      addEventListener(name, callback) { events.set(name, callback); },
      setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
      clearTimeout(timer) { timers.delete(timer); },
    },
    MutationObserver: class {
      constructor(callback) { mutation = callback; }
      observe() {}
    },
  });
  return {
    layer, document, events, timers, media, sync: mutation,
    tick() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
    },
  };
}

for (const compact of [false, true]) {
  test(`404 bits use existing CSS, seed immediately, and remain bounded (${compact ? "mobile" : "desktop"})`, () => {
    const app = setup({ compact });
    assert.equal(app.layer.hidden, false);
    assert.equal(app.layer.childElementCount, compact ? 3 : 4);
    assert.ok(app.layer.children.every(bit => bit.tag === "span" && /^(404|4|0)$/.test(bit.textContent)
      && bit.className === "falling-bit" && Number.parseFloat(bit.style.animationDelay) < 0));
    for (let index = 0; index < 40; index++) app.tick();
    assert.equal(app.layer.childElementCount, compact ? 6 : 12);
    assert.equal(app.timers.size, 1);
    app.layer.children[0].animationend();
    app.tick();
    assert.equal(app.layer.childElementCount, compact ? 6 : 12);
  });
}

for (const [random, expected] of [[0, "404"], [0.5, "4"], [0.999, "0"]]) {
  test(`404 particles can show ${expected}, both initially and on subsequent falls`, () => {
    const app = setup({ random: () => random });
    assert.ok(app.layer.children.every(bit => bit.textContent === expected));
    app.tick();
    assert.equal(app.layer.children.at(-1).textContent, expected);
  });
}

for (const options of [
  { reduced: true }, { forced: true }, { hidden: true },
  { dataset: { motion: "reduced" } }, { dataset: { effects: "off" } },
  { dataset: { contrast: "high" } }, { dataset: { interfaceTheme: "high-contrast" } },
  { path: "/go/example" },
]) {
  test(`404 bits do not start when suppressed: ${JSON.stringify(options)}`, () => {
    const app = setup(options);
    assert.equal(app.layer.hidden, true);
    assert.equal(app.layer.childElementCount, 0);
    assert.equal(app.timers.size, 0);
  });
}

test("preference and visibility changes cancel work and safely restart a single bounded animation stream", () => {
  const app = setup();
  app.document.documentElement.dataset.effects = "off";
  app.sync();
  assert.equal(app.layer.childElementCount, 0);
  assert.equal(app.timers.size, 0);
  app.document.documentElement.dataset.effects = "on";
  app.sync();
  app.sync();
  assert.equal(app.layer.childElementCount, 4);
  assert.equal(app.timers.size, 1);
  app.document.hidden = true;
  app.events.get("visibilitychange")();
  assert.equal(app.timers.size, 0);
  assert.equal(app.layer.childElementCount, 0);
  app.document.hidden = false;
  app.events.get("visibilitychange")();
  app.events.get("pagehide")();
  assert.equal(app.timers.size, 0);
  app.events.get("pageshow")();
  assert.equal(app.timers.size, 1);
  const motion = app.media.get("(prefers-reduced-motion: reduce)");
  motion.matches = true;
  motion.change();
  assert.equal(app.layer.childElementCount, 0);
  assert.equal(app.timers.size, 0);
});
