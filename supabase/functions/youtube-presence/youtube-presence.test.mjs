import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
const token = `sbyt_${"a".repeat(64)}`;
const item = { videoId: "abcdefghijk", title: "<script>A video</script>", channel: "A channel", isPlaying: false, progressMs: 1000, durationMs: 180_000 };
function setup(options = {}) {
  let handler;
  const calls = [];
  const logs = [];
  const env = { SUPABASE_URL: "https://database.example", SUPABASE_ANON_KEY: "public-key",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret", ...options.env };
  vm.runInNewContext(source, {
    Request, Response, AbortSignal, Uint8Array, TextEncoder, TextDecoder, crypto: webcrypto,
    Deno: { env: { get: key => env[key] }, serve: value => { handler = value; } },
    console: { error: (...args) => logs.push(args.join(" ")) },
    fetch: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      assert.equal(init.redirect, "error");
      assert.ok(init.signal instanceof AbortSignal);
      return Response.json(options.result ?? (url.endsWith("read_youtube_presence") ? { item: null } : { ok: true }),
        { status: options.status ?? 200 });
    },
  });
  return { calls, logs, get: () => handler(new Request("https://function.example")),
    send: (body, key = token, headers = {}) => handler(new Request("https://function.example", {
      method: "POST", headers: { "x-device-token": key, "Content-Type": "application/json", ...headers }, body,
    })),
    method: method => handler(new Request("https://function.example", { method })),
  };
}

test("YouTube reports hash device tokens server-side, support paused playback and explicit privacy clears", async () => {
  const app = setup();
  const response = await app.send(JSON.stringify({ item }));
  assert.equal(response.status, 200);
  assert.match(app.calls[0].url, /report_youtube_presence$/);
  assert.match(app.calls[0].body.p_token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(app.calls[0].body.p_token_hash, token.slice(5));
  assert.deepEqual(app.calls[0].body.p_item, item);
  assert.equal(app.calls[0].init.headers.apikey, "server-secret");
  assert.ok(!JSON.stringify(app.calls).includes(token));
  assert.ok(!(await response.text()).includes("server-secret"));
  assert.equal((await app.send(JSON.stringify({ item: null, endSession: true }))).status, 200);
  assert.equal(app.calls[1].body.p_item, null);
  assert.equal(app.calls[1].body.p_end_session, true);
});

test("public reads require no device token and use no-store responses", async () => {
  const app = setup();
  const response = await app.get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { item: null });
  assert.match(app.calls[0].url, /read_youtube_presence$/);
  assert.equal(app.calls[0].init.headers.apikey, "public-key");
  assert.equal((await app.method("OPTIONS")).status, 200);
  assert.equal((await app.method("DELETE")).status, 405);
});

test("invalid tokens, malformed bodies and oversized streams never reach the database", async () => {
  const app = setup();
  assert.equal((await app.send(JSON.stringify({ item }), "bad-token")).status, 401);
  for (const body of ["{", "null", "[]", "{}", JSON.stringify({ item: { ...item, videoId: "../invalid" } }),
    JSON.stringify({ item: { ...item, progressMs: -1 } }), JSON.stringify({ item: { ...item, durationMs: "1000" } }),
    JSON.stringify({ item, endSession: "yes" })]) {
    assert.equal((await app.send(body)).status, 400, body);
  }
  assert.equal((await app.send("x".repeat(4097))).status, 413);
  assert.equal((await app.send("{}", token, { "content-length": "5000" })).status, 413);
  assert.equal(app.calls.length, 0);
});

test("revoked credentials and database failures surface explicitly without exposing secrets", async () => {
  assert.equal((await setup({ result: { error: "invalid_token" } }).send(JSON.stringify({ item }))).status, 401);
  const app = setup({ status: 500 });
  const response = await app.send(JSON.stringify({ item }));
  assert.equal(response.status, 502);
  assert.ok(app.logs.length);
  assert.ok(!(await response.text()).includes("server-secret"));
  const missing = setup({ env: { SUPABASE_SERVICE_ROLE_KEY: undefined } });
  assert.equal((await missing.send(JSON.stringify({ item }))).status, 503);
  const modern = setup({ env: { SUPABASE_SERVICE_ROLE_KEY: undefined, SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}' } });
  assert.equal((await modern.send(JSON.stringify({ item }))).status, 200);
  assert.equal(modern.calls[0].init.headers.Authorization, undefined);
});
