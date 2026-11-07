import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
const owner = "a".repeat(32), other = "b".repeat(32), token = `sbjf_${"c".repeat(64)}`;
const item = { title: "Owner's film", series: null, season: null, episode: null,
  durationMs: 180_000, progressMs: 1000, isPlaying: true };
function setup(options = {}) {
  let handler;
  const calls = [], logs = [];
  const env = { JELLYFIN_USER_ID: owner, JELLYFIN_INGEST_TOKEN: token, SUPABASE_URL: "https://database.example",
    SUPABASE_SERVICE_ROLE_KEY: "private-database-key", ...options.env };
  vm.runInNewContext(source, {
    Request, Response, AbortSignal, Uint8Array, TextEncoder, TextDecoder, crypto: webcrypto,
    Deno: { env: { get: key => env[key] }, serve: value => { handler = value; } },
    console: { error: value => logs.push(value) },
    fetch: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      assert.equal(init.redirect, "error");
      assert.ok(init.signal instanceof AbortSignal);
      if (options.fail) throw new Error(token + " RAW_SESSION_DATA");
      const now = Date.now() - (options.expired ? 100_000 : 0);
      return Response.json(options.result ?? (url.endsWith("report_jellyfin_presence") ? { ok: true } : {
        state: "playing", item, updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 90_000).toISOString(),
        userId: owner, privateToken: token, rawSession: "RAW_SESSION_DATA",
      }));
    },
  });
  return { calls, logs, env, get: (query = "") => handler(new Request(`https://function.example/${query}`)),
    send: (payload, key = token) => handler(new Request("https://function.example", {
      method: "POST", headers: { "x-device-token": key }, body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })) };
}
test("authenticated reports bind to configured immutable owner; other users and extra fields never reach storage", async () => {
  const app = setup();
  assert.equal((await app.send({ userId: owner, state: "playing", item })).status, 200);
  assert.equal(app.calls[0].body.p_user_id, owner);
  assert.equal(app.calls[0].body.p_state, "playing");
  assert.equal((await app.send({ userId: other, state: "playing", item })).status, 400);
  assert.equal((await app.send({ userId: owner, state: "playing", item }, "bad-token")).status, 401);
  assert.equal((await app.send({ userId: owner, state: "playing", item, sessions: [] })).status, 400);
  assert.equal((await app.send({ userId: owner, state: "playing", item: { ...item, Path: "PRIVATE" } })).status, 400);
  assert.equal(app.calls.length, 1);
  app.env.JELLYFIN_INGEST_TOKEN = `sbjf_${"d".repeat(64)}`;
  assert.equal((await app.send({ userId: owner, state: "playing", item })).status, 401);
  assert.equal((await app.send({ userId: owner, state: "playing", item }, app.env.JELLYFIN_INGEST_TOKEN)).status, 200);
});
test("all owner states are validated narrowly, malformed and oversized reports are rejected", async () => {
  const app = setup();
  for (const state of ["idle", "expired", "unavailable"]) assert.equal((await app.send({ userId: owner, state, item: null })).status, 200);
  assert.equal((await app.send({ userId: owner, state: "paused", item: { ...item, isPlaying: false } })).status, 200);
  for (const payload of ["{", "null", "[]", { userId: owner, state: "paused", item },
    { userId: owner, state: "idle", item }, { userId: owner, state: ["idle"], item: null },
    { userId: owner, state: "playing", item: { ...item, progressMs: -1 } },
    { userId: owner, state: "playing", item: { ...item, progressMs: 180_001 } }]) {
    assert.equal((await app.send(payload)).status, 400);
  }
  assert.equal((await app.send("x".repeat(4097))).status, 413);
});
test("public reads ignore caller account selectors and never expose owner IDs, credentials or raw session data", async () => {
  const app = setup();
  const response = await app.get(`?userId=${other}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(app.calls[0].body.p_user_id, owner);
  const result = await response.json();
  assert.deepEqual(result.item, item);
  assert.deepEqual(Object.keys(result).sort(), ["expiresAt", "item", "state", "updatedAt"]);
  for (const secret of [owner, other, token, "RAW_SESSION_DATA", "private-database-key"]) {
    assert.ok(!JSON.stringify(result).includes(secret), secret);
    assert.ok(!JSON.stringify(app.logs).includes(secret));
  }
});
test("missing or invalid configuration fails closed even after a successful public read", async () => {
  for (const id of [undefined, "", "display-name", "0".repeat(32)]) {
    const app = setup({ env: { JELLYFIN_USER_ID: id } });
    assert.equal((await app.get()).status, 503);
    assert.equal((await app.send({ userId: owner, state: "playing", item })).status, 503);
    assert.equal(app.calls.length, 0);
  }
  const app = setup();
  assert.equal((await app.get()).status, 200);
  app.env.JELLYFIN_USER_ID = undefined;
  assert.equal((await app.get()).status, 503);
  assert.equal(app.calls.length, 1);
  assert.equal((await setup({ env: { JELLYFIN_INGEST_TOKEN: undefined } }).get()).status, 503);
});
test("expired playback hides all media; malformed stored media and outages are explicit and logs stay sanitized", async () => {
  const expired = await (await setup({ expired: true }).get()).json();
  assert.equal(expired.state, "expired");
  assert.equal(expired.item, null);
  const app = setup({ fail: true });
  const response = await app.get();
  assert.equal(response.status, 502);
  assert.deepEqual(app.logs, ["JELLYFIN_PRESENCE_REQUEST_FAILED"]);
  assert.ok(!(await response.text()).includes(token));
  assert.equal((await setup({ result: { state: "playing", item: { ...item, rawSession: "PRIVATE" } } }).get()).status, 502);
});
