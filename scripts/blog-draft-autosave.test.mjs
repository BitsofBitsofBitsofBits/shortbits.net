import { test } from "node:test";
import assert from "node:assert/strict";
import { DraftAutosave } from "./blog-draft-autosave.mjs";

function fixture(save) {
  let snapshot = { title: "Original" }, counter = 0;
  const states = [], callbacks = new Map();
  const clock = { setTimeout(fn, delay) { callbacks.set(++counter, { fn, delay }); return counter; }, clearTimeout(id) { callbacks.delete(id); } };
  const controller = new DraftAutosave({
    capture: () => snapshot, save, onState: (...value) => states.push(value), onSaved: () => {},
    timers: clock, requestId: () => `request-${++counter}`,
  });
  return { controller, states, edit(title) { snapshot = { title }; controller.changed(); }, tick(delay) {
    for (const [id, callback] of [...callbacks]) {
      if (!callbacks.has(id) || (delay !== undefined && callback.delay !== delay)) continue;
      callbacks.delete(id); callback.fn();
    }
  } };
}
const receipt = (request, version) => ({ version, request_id: request.requestId });
const settle = () => new Promise(resolve => setImmediate(resolve));

test("autosave debounces changes and saves incomplete draft metadata", async () => {
  const calls = [];
  const f = fixture(async request => { calls.push(request); return receipt(request, "v1"); });
  f.edit("One"); f.edit("");
  assert.equal(calls.length, 0);
  f.tick(); await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].snapshot.title, "");
  assert.equal(f.controller.dirty, false);
});
test("newer edits queue behind an immutable in-flight snapshot and use its confirmed version", async () => {
  const calls = []; let finish;
  const f = fixture(request => { calls.push(request); return calls.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(receipt(request, "v2")); });
  f.edit("First"); f.tick(); f.edit("Second"); f.tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].snapshot.title, "First");
  finish(receipt(calls[0], "v1")); await settle();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].version, "v1");
  assert.equal(calls[1].snapshot.title, "Second");
  assert.equal(f.controller.dirty, false);
});
test("ambiguous saves retry the original nonce and snapshot before newer edits", async () => {
  const calls = [];
  const f = fixture(async request => {
    calls.push(request);
    if (calls.length === 1) throw new Error("Network response lost");
    return receipt(request, `v${calls.length}`);
  });
  f.edit("First"); f.tick(); await settle();
  f.edit("Newer");
  await f.controller.retry();
  assert.equal(calls[0], calls[1]);
  assert.equal(calls[2].snapshot.title, "Newer");
  assert.equal(calls[2].version, "v2");
});
test("conflicts pause autosaving without discarding local changes or retrying", async () => {
  let calls = 0;
  const error = Object.assign(new Error("Draft changed in another editor"), { code: "40001" });
  const f = fixture(async () => { calls++; throw error; });
  f.edit("Keep mine"); f.tick(); await settle();
  f.edit("Still mine"); f.tick(); await settle();
  assert.equal(calls, 1);
  assert.equal(f.controller.dirty, true);
  await assert.rejects(f.controller.retry(), /another editor/);
  assert.equal(f.states.at(-1)[0], "conflict");
});
test("manual saving forces a checkpoint even when the draft is already saved", async () => {
  const calls = [];
  const f = fixture(async request => { calls.push(request); return receipt(request, "v1"); });
  await f.controller.flush(true);
  assert.equal(calls[0].checkpoint, true);
});
test("sign-out cancels pending work and ignores late responses", async () => {
  let finish;
  const f = fixture(request => new Promise(resolve => { finish = () => resolve(receipt(request, "v1")); }));
  f.edit("Private"); f.tick();
  f.controller.stop(); finish(); await settle();
  assert.equal(f.controller.version, null);
  assert.equal(f.controller.pending, null);
  assert.equal(f.controller.baseline, "");
  assert.notEqual(f.states.at(-1)[0], "saved");
});
test("unconfirmed responses remain unsaved and preserve the request for safe retry", async () => {
  const f = fixture(async () => ({ version: "v1", request_id: "wrong" }));
  f.edit("Private"); f.tick(); await settle();
  assert.equal(f.controller.dirty, true);
  assert.equal(f.controller.version, null);
  assert.ok(f.controller.pending);
  assert.match(f.states.at(-1)[1].message, /could not be confirmed/);
});
test("continuous typing cannot postpone a private save indefinitely", async () => {
  const calls = [];
  const f = fixture(async request => { calls.push(request); return receipt(request, "v1"); });
  for (let i = 0; i < 20; i++) f.edit(`Typing ${i}`);
  assert.equal(calls.length, 0);
  f.tick(10000); await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].snapshot.title, "Typing 19");
});
test("a never-persisted initial document does not report a successful save", async () => {
  const f = fixture(async () => assert.fail("No write needed"));
  f.edit("Temporary"); f.edit("Original");
  await f.controller.flush(false);
  assert.equal(f.states.at(-1)[0], "idle");
});
test("a definitively rejected save retries corrected input, not the invalid snapshot", async () => {
  const calls = [];
  const f = fixture(async request => {
    calls.push(request);
    if (calls.length === 1) throw Object.assign(new Error("Invalid draft"), { code: "22023" });
    return receipt(request, "v1");
  });
  f.edit("Invalid"); f.tick(); await settle();
  f.edit("Corrected"); await f.controller.retry();
  assert.notEqual(calls[0].requestId, calls[1].requestId);
  assert.equal(calls[1].snapshot.title, "Corrected");
  assert.equal(f.controller.dirty, false);
});
