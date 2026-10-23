import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");
const charactersSource = source.slice(source.indexOf("let graphemeSegmenter;"), source.indexOf("const rainbowColors"));
const clockSource = source.slice(source.indexOf("let fakeDesktopClockFormatter;"), source.indexOf('fakeDesktopRestore.addEventListener'));
const buildSource = source.slice(source.indexOf("async function loadBuildMetadata()"), source.indexOf("\napplyInterfaceTheme(interfaceThemes[interfaceThemeIndex], false);"));

test("build metadata formats an unambiguous UTC tooltip without locale initialization", async () => {
  const buildLink = { dataset: {} };
  const context = vm.createContext({
    buildLink, repositoryUrl: "https://example.com/repository",
    window: { location: { protocol: "https:" } },
    fetch: async () => ({ ok: true, json: async () => ({ commit: "abcdef1234567", builtAt: "2026-10-22T23:15:30-05:00" }) }),
    Date: class extends Date {
      toLocaleString() { throw new Error("Startup must not initialize locale formatting."); }
    },
    console: { warn: () => assert.fail("Valid metadata should not log an error") },
  });
  vm.runInContext(buildSource, context);
  await vm.runInContext("loadBuildMetadata()", context);
  assert.equal(buildLink.textContent, "BUILD ABCDEF1");
  assert.equal(buildLink.dataset.commit, "ABCDEF1");
  assert.equal(buildLink.title, "Deployed 2026-10-23 04:15:30 UTC");
  assert.equal(buildLink.href, "https://example.com/repository");
});

test("invalid build timestamps leave the saved label unchanged and log an explicit error", async () => {
  const buildLink = { textContent: "BUILD LOCAL", dataset: {} };
  const warnings = [];
  const context = vm.createContext({
    buildLink, repositoryUrl: "https://example.com/repository",
    window: { location: { protocol: "https:" } },
    fetch: async () => ({ ok: true, json: async () => ({ commit: "abcdef1234567", builtAt: "invalid" }) }),
    console: { warn: (...args) => warnings.push(args) },
  });
  vm.runInContext(buildSource, context);
  await vm.runInContext("loadBuildMetadata()", context);
  assert.equal(buildLink.textContent, "BUILD LOCAL");
  assert.equal(buildLink.dataset.commit, undefined);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][1].message, /timestamp is malformed/);
});

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
