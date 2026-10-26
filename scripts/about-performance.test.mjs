import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../online/scripts/about.js", import.meta.url), "utf8");

test("About does no timezone work while hidden and refreshes immediately on open and visibility restore", () => {
  const elements = new Map();
  for (const id of ["operator-local-time", "operator-state", "operator-age", "personality-checksum", "operator-query-button", "operator-query-output", "about-window", "fake-desktop"]) {
    elements.set(`#${id}`, { hidden: true, textContent: "", classList: { contains: () => false }, addEventListener() {} });
  }
  const events = new Map();
  const documentEvents = new Map();
  let tick;
  let constructors = 0;
  let formats = 0;
  const document = {
    hidden: false, querySelector: (selector) => elements.get(selector),
    addEventListener: (name, callback) => documentEvents.set(name, callback),
  };
  vm.runInNewContext(source, {
    document,
    window: {
      addEventListener: (name, callback) => events.set(name, callback),
      setInterval: (callback) => { tick = callback; },
    },
    Intl: { DateTimeFormat: class {
      constructor(locale, options) { constructors++; this.year = Boolean(options.year); }
      format() { formats++; return this.year ? "2026" : "12:00:00 PM CDT"; }
    } },
  });
  tick();
  assert.equal(constructors, 0);
  assert.equal(formats, 0);
  elements.get("#about-window").hidden = false;
  events.get("desktop-window:opened")({ detail: { windowId: "about-window" } });
  assert.equal(constructors, 2);
  assert.equal(formats, 2);
  assert.equal(elements.get("#operator-local-time").textContent, "12:00:00 PM CDT");
  document.hidden = true;
  tick();
  assert.equal(formats, 2);
  document.hidden = false;
  documentEvents.get("visibilitychange")();
  assert.equal(formats, 4);
  assert.equal(constructors, 2);
  elements.get("#about-window").classList.contains = () => true;
  tick();
  assert.equal(formats, 4);
  elements.get("#about-window").classList.contains = () => false;
  elements.get("#about-window").hidden = true;
  tick();
  assert.equal(formats, 4);
});
