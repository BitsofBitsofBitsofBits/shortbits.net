import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const source = await readFile(new URL("../online/scripts/script.js", import.meta.url), "utf8");
const charactersSource = await readFile(new URL("../shared/scripts/message-text.js", import.meta.url), "utf8");
const markdownSource = await readFile(new URL("../shared/scripts/markdown.js", import.meta.url), "utf8");
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
    window: {},
    Intl: { Segmenter: class extends Intl.Segmenter {
      constructor(...args) { super(...args); constructions += 1; }
    } },
  });
  vm.runInContext(charactersSource, context);
  assert.equal(vm.runInContext('window.BITS_MESSAGE_TEXT.splitCharacters("Bits").join("")', context), "Bits");
  assert.equal(constructions, 0);
  assert.equal(vm.runInContext('window.BITS_MESSAGE_TEXT.splitCharacters("👩‍💻e\\u0301").length', context), 2);
  assert.equal(constructions, 1);
  vm.runInContext('window.BITS_MESSAGE_TEXT.splitCharacters("🏳️‍🌈")', context);
  assert.equal(constructions, 1);
});

test("Unicode code-point fallback remains available without Intl.Segmenter", () => {
  const context = vm.createContext({ window: {}, Intl: {} });
  vm.runInContext(charactersSource, context);
  assert.equal(vm.runInContext('window.BITS_MESSAGE_TEXT.splitCharacters("😀").length', context), 1);
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

function correctionSetup(message) {
  const { document } = parseHTML("<html><body><div id='command'><span id='typed'></span></div></body></html>");
  const timers = [];
  const achievements = [];
  const schedule = (callback, delay) => { timers.push({ callback, delay }); return timers.length; };
  const window = { location: { origin: "https://example.test" }, setTimeout: schedule };
  const context = vm.createContext({
    window, document, URL, Intl, setTimeout: schedule, Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    currentMessage: message, characterIndex: 0, deleting: false,
    messages: [{ text: "ordinary message", weight: 1 }], pickWeightedOption: (options) => options[0],
    commandLine: document.querySelector("#command"), typedText: document.querySelector("#typed"),
    showAchievement: (...args) => achievements.push(args),
  });
  vm.runInContext(markdownSource, context);
  vm.runInContext(charactersSource, context);
  context.applyTextFormat = window.BITS_MESSAGE_TEXT.applyFormat;
  context.currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(message).characters;
  vm.runInContext(source.slice(source.indexOf("const typoMessage ="), source.indexOf("\nfunction updateActivity()")), context);
  return { context, timers, achievements, window };
}

test("configured mistypes correct after typing, preserve markup/defaults, unlock once, and delete normally", () => {
  const app = correctionSetup({
    text: "A **tyop** {{color:red|👩‍💻}}", correctedText: "A **typo** {{color:red|👩‍💻}}",
    markup: true, colorful: true, format: { fontStyle: "italic" },
  });
  const { context, timers, achievements } = app;
  context.characterIndex = context.currentMessageCharacters.length;
  vm.runInContext("updateMessage()", context);
  assert.equal(context.typedText.textContent, "A ty_");
  assert.ok(context.commandLine.classList.contains("is-correcting"));
  assert.equal(timers[0].delay, 420);
  assert.equal(achievements.length, 0);
  timers.shift().callback();
  assert.equal(context.currentMessage.text, "A **typo** {{color:red|👩‍💻}}");
  assert.equal(context.typedText.textContent, "A typo 👩‍💻");
  assert.equal(context.typedText.querySelector("strong").textContent, "typo");
  assert.equal(context.typedText.querySelector(".blog-text-color-red").textContent, "👩‍💻");
  assert.equal(context.typedText.style.fontStyle, "italic");
  assert.ok(context.typedText.classList.contains("is-colorful-text"));
  assert.equal(context.characterIndex, 8);
  assert.equal(context.deleting, true);
  assert.equal(context.currentMessage.wasCorrected, true);
  assert.equal(context.commandLine.classList.contains("is-correcting"), false);
  assert.equal(achievements.length, 1);
  assert.equal(achievements[0][3], "typo-corrected");
  assert.equal(timers[0].delay, 1600);
  for (let index = 0; index < 10; index++) vm.runInContext("updateMessage()", context);
  assert.equal(context.currentMessage.text, "ordinary message");
  assert.equal(achievements.length, 1);
});

test("plain corrections keep punctuation literal and never inject HTML", () => {
  const { context, timers } = correctionSetup({ text: "**tyop**", correctedText: "**typo** <script>no</script>" });
  vm.runInContext("runTypoCorrection()", context);
  timers.shift().callback();
  assert.equal(context.typedText.textContent, "**typo** <script>no</script>");
  assert.equal(context.typedText.querySelector("strong,script"), null);
});

test("history navigation during a correction neither overwrites history nor awards an unseen correction", () => {
  const { context, timers, achievements } = correctionSetup({ text: "tyop", correctedText: "typo" });
  vm.runInContext("runTypoCorrection()", context);
  const historical = { text: "history" };
  context.currentMessage = historical;
  context.typedText.textContent = "history";
  timers.shift().callback();
  assert.equal(context.currentMessage, historical);
  assert.equal(context.typedText.textContent, "history");
  assert.equal(context.commandLine.classList.contains("is-correcting"), false);
  assert.equal(achievements.length, 0);
  assert.equal(timers[0].callback, context.updateMessage);
});

test("the built-in rare typo and explicit Easter egg trigger remain available", () => {
  const { context, timers, achievements } = correctionSetup({ text: "ordinary" });
  vm.runInContext("forceTypoMessage = true", context);
  assert.equal(vm.runInContext("pickNextMessage().text", context), "the bits are definately working...");
  assert.equal(vm.runInContext("pickNextMessage().text", context), "ordinary message");
  context.Math.random = () => 0;
  assert.equal(vm.runInContext("pickNextMessage().correctedText", context), "the bits are definitely working...");
  vm.runInContext("runTypoCorrection()", context);
  timers.shift().callback();
  assert.equal(context.typedText.textContent, "the bits are definitely working...");
  assert.equal(achievements[0][3], "typo-corrected");
});
