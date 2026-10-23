import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");
const charactersSource = source.slice(source.indexOf("let graphemeSegmenter;"), source.indexOf("const rainbowColors"));
const clockSource = source.slice(source.indexOf("let fakeDesktopClockFormatter;"), source.indexOf('fakeDesktopRestore.addEventListener'));

test("ASCII messages avoid internationalization startup and Unicode still uses grapheme clusters", () => {
  let constructions = 0;
  const context = vm.createContext({
    Intl: { Segmenter: class extends Intl.Segmenter {
      constructor(...args) { super(...args); constructions += 1; }
    } },
  });
  vm.runInContext(charactersSource, context);
  assert.equal(vm.runInContext('splitVisibleCharacters("Bits").join("")', context), "Bits");
  assert.equal(constructions, 0);
  assert.equal(vm.runInContext('splitVisibleCharacters("👩‍💻e\\u0301").length', context), 2);
  assert.equal(constructions, 1);
  vm.runInContext('splitVisibleCharacters("🏳️‍🌈")', context);
  assert.equal(constructions, 1);
});

test("Unicode code-point fallback remains available without Intl.Segmenter", () => {
  const context = vm.createContext({ Intl: {} });
  vm.runInContext(charactersSource, context);
  assert.equal(vm.runInContext('splitVisibleCharacters("😀").length', context), 1);
});

test("desktop clock only formats while visible and reuses its formatter", () => {
  let constructions = 0;
  let formats = 0;
  const context = vm.createContext({
    fakeDesktop: { hidden: true },
    document: { hidden: false },
    fakeDesktopClock: {},
    Intl: { DateTimeFormat: class {
      constructor() { constructions += 1; }
      format() { formats += 1; return "12:34"; }
    } },
  });
  vm.runInContext(clockSource, context);
  vm.runInContext("updateFakeDesktopClock()", context);
  assert.equal(constructions, 0);
  context.fakeDesktop.hidden = false;
  vm.runInContext("updateFakeDesktopClock(); updateFakeDesktopClock()", context);
  assert.equal(constructions, 1);
  assert.equal(formats, 2);
  context.document.hidden = true;
  vm.runInContext("updateFakeDesktopClock()", context);
  assert.equal(formats, 2);
  assert.equal(context.fakeDesktopClock.textContent, "12:34");
});
