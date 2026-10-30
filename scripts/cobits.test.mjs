import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const source = await readFile(new URL("../online/scripts/cobits.js", import.meta.url), "utf8");

function setup() {
  const { document, window } = parseHTML(`<!doctype html><html data-interface-theme="default"><body>
    <div class="fake-desktop-icons"><button></button><button hidden></button></div>
    <div class="desktop-window"></div>
    <button id="fake-cobits-launch"></button>
    <aside id="fake-cobits" hidden>
      <button data-fake-app-close></button>
      <button id="fake-cobits-clear"></button>
      <button data-cobits-prompt="/diagnose"></button>
      <div id="fake-cobits-log"><p class="is-cobits">READY</p></div>
      <p id="fake-cobits-typing"></p>
      <span id="fake-cobits-memory"></span>
      <form id="fake-cobits-form">
        <input id="fake-cobits-input">
        <button type="submit">SEND</button>
      </form>
    </aside>
  </body></html>`);
  const unlocked = [];
  window.BITS_ACHIEVEMENTS = {
    unlock: (id, message, label) => unlocked.push({ id, message, label }),
  };
  window.BITS_ARG = {
    getState: () => ({
      assembled: false,
      discovered: ["B"],
      outcome: "",
      reconstructed: false,
      total: 6,
    }),
  };
  window.requestAnimationFrame = (callback) => callback();
  window.setTimeout = (callback) => {
    callback();
    return 1;
  };
  window.clearTimeout = () => {};
  const context = vm.createContext({
    console,
    document,
    Math,
    window,
  });
  vm.runInContext(source, context);
  return { document, unlocked, window };
}

test("CoBits keeps conversational memory and unlocks related achievements", () => {
  const { unlocked, window } = setup();
  const app = window.BITS_COBITS.initialize({ openApp: () => {} });

  assert.match(app.respond("my name is Ada"), /Hello, Ada/);
  assert.match(app.respond("what is my name"), /You are Ada/);
  assert.equal(app.memory.name, "Ada");
  assert.equal(unlocked.at(-1).id, "cobits-remembers");

  assert.match(app.respond("interview me"), /which Bit is superior/);
  assert.match(app.respond("1"), /Defend this position/);
  assert.equal(Array.isArray(app.respond("because it is one")), true);
  assert.equal(unlocked.at(-1).id, "cobits-interview");
});

test("CoBits exposes desktop diagnostics, ARG status, and UI lifecycle", () => {
  const { document, unlocked, window } = setup();
  let opened;
  const app = window.BITS_COBITS.initialize({
    openApp: (element, input) => {
      opened = { element, input };
      element.hidden = false;
    },
  });

  document.querySelector("#fake-cobits-launch").click();
  assert.equal(opened.element, app.element);
  assert.equal(opened.input, app.input);
  assert.equal(app.element.hidden, false);

  assert.equal(Array.isArray(app.respond("/diagnose")), true);
  assert.equal(unlocked.at(-1).id, "cobits-diagnostics");
  assert.match(app.respond("tell me about process_000"), /5 bytes remain/);

  app.close();
  assert.equal(app.element.hidden, true);
  app.clearTranscript({ resetMemory: true });
  assert.equal(app.memory.name, "");
  assert.match(document.querySelector("#fake-cobits-log").textContent, /Memory reset/);
});

test("CoBits preserves the distinct division and self-destruct animation timing", () => {
  const { window } = setup();
  const frames = [];
  const timers = [];
  window.requestAnimationFrame = (callback) => frames.push(callback);
  window.setTimeout = (callback, delay) => timers.push({ callback, delay });
  const app = window.BITS_COBITS.initialize({ openApp: () => {} });

  app.respond("self destruct");
  assert.equal(app.element.classList.contains("is-calculating-impossible"), true);
  assert.equal(frames.length, 0);
  assert.equal(timers[0].delay, 900);
  timers.shift().callback();
  assert.equal(app.element.classList.contains("is-calculating-impossible"), false);

  app.respond("divide by zero");
  assert.equal(app.element.classList.contains("is-calculating-impossible"), false);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(app.element.classList.contains("is-calculating-impossible"), true);
  assert.equal(timers[0].delay, 900);
  timers.shift().callback();
  assert.equal(app.element.classList.contains("is-calculating-impossible"), false);
});
