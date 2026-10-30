import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const source = await readFile(new URL("../online/scripts/achievements.js", import.meta.url), "utf8");

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function setup() {
  const { document, window } = parseHTML(`<!doctype html><html><body>
    <button id="achievements-button"></button>
    <span id="achievement-count"></span>
    <div id="achievement" hidden>
      <span id="achievement-label"></span>
      <strong id="achievement-message"></strong>
    </div>
    <div id="achievements-panel" hidden>
      <button id="achievements-close"></button>
      <p id="achievements-empty"></p>
      <p id="achievements-progress"></p>
      <ol id="achievements-list"></ol>
      <button id="achievements-export"></button>
      <button id="achievements-reset"></button>
    </div>
  </body></html>`);
  const localStorage = storage();
  const sessionStorage = storage();
  const notifications = [];
  window.localStorage = localStorage;
  window.sessionStorage = sessionStorage;
  window.confirm = () => true;
  window.BITS_NOTIFICATIONS = { notify: (notification) => notifications.push(notification) };
  window.setTimeout = () => 1;
  window.clearTimeout = () => {};
  const context = vm.createContext({
    console,
    CustomEvent: window.CustomEvent,
    Date,
    document,
    encodeURIComponent,
    HTMLElement: window.HTMLElement,
    localStorage,
    sessionStorage,
    window,
  });
  vm.runInContext(source, context);
  return { document, localStorage, notifications, window };
}

test("achievement module records, persists, and deduplicates unlocks", () => {
  const { document, localStorage, notifications, window } = setup();
  let unlocks = 0;
  const achievements = window.BITS_ACHIEVEMENTS.initialize({
    onUnlock: () => {
      unlocks += 1;
    },
  });

  achievements.unlock("meaning-of-life", "42 BITS", "ANSWER FOUND");
  achievements.unlock("meaning-of-life", "42 BITS", "ANSWER FOUND");

  assert.equal(unlocks, 1);
  assert.equal(achievements.unlocked.length, 1);
  assert.equal(document.querySelector("#achievement-count").textContent, "1");
  assert.equal(notifications.length, 1);
  assert.equal(JSON.parse(localStorage.getItem("bits-achievements"))[0].id, "meaning-of-life");
  assert.throws(() => achievements.unlock("not-real", "NOPE"), /Unknown achievement/);
});

test("achievement panel reveals hints, tracks repeat checks, and resets in place", () => {
  const { document, window } = setup();
  let panelOpens = 0;
  const achievements = window.BITS_ACHIEVEMENTS.initialize({
    onPanelOpen: () => {
      panelOpens += 1;
    },
  });

  achievements.openPanel();
  achievements.closePanel();
  achievements.openPanel();
  achievements.closePanel();
  achievements.openPanel();

  assert.equal(panelOpens, 3);
  assert.equal(achievements.has("achievement-checker"), true);
  assert.equal(document.querySelector("#achievements-panel").hidden, false);
  assert.equal(document.querySelectorAll("#achievements-list li").length, achievements.catalog.length);

  document.querySelector("#achievements-reset").click();
  assert.equal(achievements.unlocked.length, 0);
  assert.equal(document.querySelector("#achievement-count").textContent, "0");
});
