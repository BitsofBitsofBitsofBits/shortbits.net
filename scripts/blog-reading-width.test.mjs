import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const source = await readFile(new URL("../blog/scripts/reading-width.js", import.meta.url), "utf8");
function fixture(saved, blocked = false) {
  const { window, document } = parseHTML("<html><body></body></html>");
  const values = new Map(saved === undefined ? [] : [["bits-blog-reading-width", saved]]);
  const warnings = [];
  vm.runInNewContext(source, {
    window, document, CustomEvent: window.CustomEvent,
    console: { warn: (...args) => warnings.push(args) },
    localStorage: {
      getItem(key) { if (blocked) throw new Error("Storage blocked"); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw new Error("Storage blocked"); values.set(key, value); },
    },
  });
  return { window, document, values, warnings, preference: window.BITS_BLOG_READING_WIDTH };
}
test("reading width applies the saved choice immediately and rejects stale or malformed values", () => {
  for (const [saved, expected] of [[undefined, "comfortable"], ["narrow", "comfortable"], ["full", "full"], ["wide", "wide"], ["<script>", "comfortable"]]) {
    const { preference, document } = fixture(saved);
    assert.equal(preference.value, expected);
    assert.equal(document.documentElement.dataset.blogReadingWidth, expected);
  }
});
test("reading choices persist locally, synchronize cleared/changed storage and restored pages", () => {
  const { window, values, preference } = fixture();
  let notifications = 0;
  window.addEventListener("bits:blog-reading-width", () => notifications++);
  preference.select("wide");
  assert.equal(values.get(preference.key), "wide");
  assert.equal(preference.value, "wide");
  values.set(preference.key, "full");
  const event = new window.Event("storage");
  event.key = preference.key;
  window.dispatchEvent(event);
  assert.equal(preference.value, "full");
  values.clear();
  window.dispatchEvent(new window.Event("pageshow"));
  assert.equal(preference.value, "comfortable");
  assert.equal(notifications, 3);
});
test("blocked storage reports the failure but allows a page-local reading choice", () => {
  const { preference, warnings, window } = fixture(undefined, true);
  assert.equal(preference.storageError, true);
  preference.select("full");
  assert.equal(preference.value, "full");
  assert.equal(preference.storageError, true);
  window.dispatchEvent(new window.Event("pageshow"));
  assert.equal(preference.value, "full");
  assert.equal(warnings.length, 3);
});
