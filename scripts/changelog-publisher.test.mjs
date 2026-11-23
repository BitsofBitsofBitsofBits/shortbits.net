import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createHandler } from "../supabase/functions/changelog-publish/handler.mjs";
import { MAX_BODY_BYTES, validatePayload, validateRelease } from "../supabase/functions/changelog-publish/validation.mjs";
import { publishChangelog } from "./publish-changelog.mjs";

const token = `sbcg_${"a".repeat(64)}`;
const hash = createHash("sha256").update(token).digest("hex");
const sha = "b".repeat(40);
const run = "https://github.com/owner/site/actions/runs/123";
const payload = { release_id: "publisher-v1", notes: [{ title: "Publisher", summary: "Reviewed notes" }], source_commit: sha, run_url: run };
const config = { CHANGELOG_PUBLISH_TOKEN_SHA256: hash, SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "private-backend-key" };
const result = (input = payload) => ({ ok: true, release_id: input.release_id, version: input.version ?? "2.0",
  published_at: "2026-11-23T12:00:00Z", positions: input.notes.map((_, index) => index + 43), idempotent: false });
function request(body = payload, { method = "POST", credential = token, contentType = "application/json" } = {}) {
  return new Request("https://project.supabase.co/functions/v1/changelog-publish", {
    method, headers: { "X-Changelog-Publish-Token": credential, "Content-Type": contentType },
    ...(method === "GET" ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
function harness({ settings = config, live = { commit: sha }, rpc = result(), fetchError, rpcStatus = 200 } = {}) {
  const calls = [];
  const handler = createHandler({ env: key => settings[key], now: () => 123456, fetch: async (url, options) => {
    calls.push({ url, options });
    if (fetchError) throw new Error("private-upstream-error private-backend-key");
    return calls.length === 1 ? Response.json(live) : Response.json(rpc, { status: rpcStatus });
  } });
  return { handler, calls };
}

test("pure validation strictly bounds and normalizes reviewed inputs and context", () => {
  assert.deepEqual(validatePayload({ ...payload, version: "2.0.0", notes: [{ title: " Publisher ", summary: " Notes " }] }),
    { ...payload, version: "2.0", notes: [{ title: "Publisher", summary: "Notes" }] });
  const invalid = [
    null, [], { ...payload, positions: [1] }, { ...payload, enabled: true }, { ...payload, entry_date: "2026-01-01" },
    { ...payload, notes: [] }, { ...payload, notes: Array(21).fill(payload.notes[0]) },
    { ...payload, notes: [payload.notes[0], payload.notes[0]] },
    { ...payload, notes: [{ title: "a".repeat(81), summary: "ok" }] },
    { ...payload, notes: [{ title: "ok", summary: "a".repeat(801) }] },
    { ...payload, notes: [{ title: "   ", summary: "ok" }] },
    { ...payload, notes: [{ title: "ok", summary: "line\nbreak" }] },
    { ...payload, notes: [{ title: "\ud800", summary: "ok" }] },
    { ...payload, notes: [{ ...payload.notes[0], table: "site_blog_posts" }] },
    { ...payload, notes: [null] }, { ...payload, version: null }, { ...payload, version: "02.0" },
    { ...payload, version: "2.10000" }, { ...payload, version: "2" }, { ...payload, release_id: "../bad" },
    { ...payload, source_commit: "b".repeat(7) }, { ...payload, source_commit: sha.toUpperCase() },
    { ...payload, run_url: `${run}?token=private` }, { ...payload, run_url: "https://evil.test/actions/runs/123" },
  ];
  for (const input of invalid) assert.throws(() => validatePayload(input));
  assert.doesNotThrow(() => validatePayload({ ...payload, notes: [{ title: "😀".repeat(80), summary: "ok" }] }));
  assert.throws(() => validateRelease(payload), "Reviewed files must not contain run context");
});

test("POST-only, dedicated header authentication and explicit configuration failures", async () => {
  for (const method of ["GET", "PUT", "OPTIONS"]) {
    const { handler, calls } = harness();
    const response = await handler(request(payload, { method }));
    assert.equal(response.status, 405);
    assert.equal(calls.length, 0);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  for (const settings of [{}, { ...config, CHANGELOG_PUBLISH_TOKEN_SHA256: token },
    { ...config, SUPABASE_URL: "https://project.supabase.co/private" },
    { ...config, SUPABASE_SERVICE_ROLE_KEY: undefined, SUPABASE_SECRET_KEYS: "not json" },
    { ...config, SUPABASE_SERVICE_ROLE_KEY: undefined }]) {
    const { handler, calls } = harness({ settings });
    assert.equal((await handler(request())).status, 503);
    assert.equal(calls.length, 0);
  }
  for (const credential of ["", `sbcg_${"c".repeat(64)}`, hash, token.toUpperCase()]) {
    const { handler, calls } = harness();
    assert.equal((await handler(request(payload, { credential }))).status, 401);
    assert.equal(calls.length, 0);
  }
  const { handler } = harness();
  assert.equal((await handler(new Request("https://example.test", { method: "POST",
    headers: { cookie: `token=${token}`, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload) }))).status, 401);
});

test("bad JSON, unknown fields, body size and content type fail before any network call", async () => {
  for (const [body, options, status] of [
    ["not json", {}, 400], [{ ...payload, table: "other" }, {}, 400],
    [" ".repeat(MAX_BODY_BYTES + 1), {}, 413], [payload, { contentType: "text/plain" }, 415],
  ]) {
    const { handler, calls } = harness();
    assert.equal((await handler(request(body, options))).status, status);
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = harness();
  const streaming = new Request("https://example.test", { method: "POST", duplex: "half",
    headers: { "Content-Type": "application/json", "X-Changelog-Publish-Token": token, "Content-Length": "1" },
    body: new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(32_768)); controller.enqueue(new Uint8Array(32_769)); controller.close();
    } }) });
  assert.equal((await handler(streaming)).status, 413);
  assert.equal(calls.length, 0);
});

test("live revision mismatch, malformed metadata, outage and oversized response block RPC", async () => {
  for (const options of [{ live: { commit: "c".repeat(40) } }, { live: {} },
    { live: { commit: sha.slice(0, 7) } }, { fetchError: true }, { live: { commit: sha, padding: "x".repeat(4096) } }]) {
    const { handler, calls } = harness(options);
    const response = await handler(request());
    assert.equal(response.status, options.live?.commit === "c".repeat(40) ? 409 : 502);
    assert.equal(calls.length, 1);
    assert.ok(!JSON.stringify(await response.json()).includes("private"));
  }
  const handler = createHandler({ env: key => config[key], fetch: async () => new Response("unavailable", { status: 503 }) });
  assert.equal((await handler(request())).status, 502);
});

test("successful publication uses fixed live and RPC URLs, safe headers, and sanitized response", async () => {
  for (const key of ["private-backend-key", "sb_secret_private"]) {
    const { handler, calls } = harness({ settings: { ...config, SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: key }) } });
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), result());
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(calls[0].url, "https://www.shortbits.net/build-info.json?changelog_verify=123456");
    assert.equal(calls[1].url, "https://project.supabase.co/rest/v1/rpc/publish_site_changelog");
    for (const { options } of calls) { assert.equal(options.redirect, "error"); assert.ok(options.signal instanceof AbortSignal); }
    assert.deepEqual(JSON.parse(calls[1].options.body), { p_payload: payload });
    assert.equal(calls[1].options.headers.apikey, key);
    assert.equal(calls[1].options.headers.Authorization, key.startsWith("sb_") ? undefined : `Bearer ${key}`);
    assert.ok(!JSON.stringify(calls).includes(token));
  }
});

test("RPC error codes are mapped without returning private errors; malformed success fails closed", async () => {
  for (const [code, status] of [["23505", 409], ["22023", 400], ["55000", 409], ["XX000", 502]]) {
    const { handler } = harness({ rpcStatus: 400, rpc: { code, message: token, details: config.SUPABASE_SERVICE_ROLE_KEY, hint: "private" } });
    const response = await handler(request());
    assert.equal(response.status, status);
    const body = JSON.stringify(await response.json());
    for (const secret of [token, config.SUPABASE_SERVICE_ROLE_KEY, "private"]) assert.ok(!body.includes(secret));
  }
  for (const rpc of [{ ...result(), secret: token }, { ...result(), positions: [0] }, { ...result(), release_id: "wrong" },
    { ...result(), version: "2.0.0" }, { ...result(), published_at: "invalid" }, { ...result(), idempotent: "true" }]) {
    const { handler } = harness({ rpc });
    assert.equal((await handler(request())).status, 502);
  }
  const { handler } = harness({ rpc: { ...result(), idempotent: true } });
  assert.equal((await handler(request())).status, 200);
});

const file = new URL("../releases/changelog.json", import.meta.url);
const clientEnv = { CHANGELOG_PUBLISH_TOKEN: token, CHANGELOG_PUBLISH_URL: "https://project.supabase.co/functions/v1/changelog-publish",
  GITHUB_SHA: sha, GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "owner/site", GITHUB_RUN_ID: "123",
  SUPABASE_SERVICE_ROLE_KEY: "never-send-this" };
test("client sends only the scoped credential and reviewed notes with GitHub context", async () => {
  const reviewed = validateRelease(JSON.parse(await readFile(file, "utf8")));
  const published = await publishChangelog({ file, env: clientEnv, fetch: async (url, options) => {
    assert.equal(url, clientEnv.CHANGELOG_PUBLISH_URL);
    assert.deepEqual(options.headers, { "Content-Type": "application/json", "X-Changelog-Publish-Token": token });
    assert.equal(options.redirect, "error");
    const input = JSON.parse(options.body);
    assert.deepEqual(input, { ...reviewed, source_commit: sha, run_url: run });
    assert.ok(!options.body.includes(token));
    assert.ok(!JSON.stringify(options).includes("never-send-this"));
    return Response.json(result(input));
  } });
  assert.equal(published.release_id, "changelog-publisher-v1");
});

test("client refuses misconfiguration, unsafe endpoints, invalid context, upstream and response failures", async () => {
  for (const env of [{ ...clientEnv, CHANGELOG_PUBLISH_TOKEN: "" }, { ...clientEnv, CHANGELOG_PUBLISH_URL: "https://evil.test/functions/v1/changelog-publish" },
    { ...clientEnv, CHANGELOG_PUBLISH_URL: `${clientEnv.CHANGELOG_PUBLISH_URL}?secret=x` },
    { ...clientEnv, GITHUB_SHA: "short" }, { ...clientEnv, GITHUB_SERVER_URL: "https://other.test" }]) {
    await assert.rejects(publishChangelog({ file, env, fetch: () => { assert.fail("Must not fetch"); } }));
  }
  for (const fetcher of [async () => { throw new Error(token); }, async () => new Response(token, { status: 409 }),
    async () => Response.json({ token })]) {
    await assert.rejects(publishChangelog({ file, env: clientEnv, fetch: fetcher }), error => !error.message.includes(token));
  }
});

test("integrated publisher workflow is opt-in, protected and gated, with no caller backend keys", async t => {
  const workflow = (await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const start = workflow.indexOf("\n  publish-changelog:\n");
  if (start < 0) { t.skip("Separate parent workflow integration not present yet"); return; }
  const block = workflow.slice(start + 1).split(/\n  [a-z][a-z-]*:/)[0];
  assert.match(block, /vars\.CHANGELOG_AUTO_PUBLISH_ENABLED == 'true'/);
  assert.match(block, /github\.event_name != 'pull_request'/);
  assert.match(block, /github\.ref == 'refs\/heads\/main'/);
  for (const gate of ["validate", "supabase", "deploy", "health", "lighthouse"]) {
    assert.ok(block.includes(`needs.${gate}.result == 'success'`), `Missing explicit ${gate} success gate`);
  }
  assert.match(block, /needs: \[validate, supabase, deploy, health, lighthouse\]/);
  assert.match(block, /environment: production/);
  assert.match(block, /CHANGELOG_PUBLISH_TOKEN: \$\{\{ secrets\.CHANGELOG_PUBLISH_TOKEN \}\}/);
  assert.match(block, /node scripts\/publish-changelog\.mjs --file releases\/changelog\.json/);
  assert.doesNotMatch(block, /SUPABASE_(?:ACCESS_TOKEN|SERVICE_ROLE_KEY|SECRET_KEYS|DB_PASSWORD)|GH_TOKEN|permissions:\s*\n\s*contents: write/);
  const supabase = workflow.slice(workflow.indexOf("  supabase:")).split(/\n  deploy:/)[0];
  assert.ok(supabase.indexOf("Apply database migrations") < supabase.indexOf("supabase functions deploy changelog-publish"));
  assert.match(supabase, /Deploy optional changelog publisher[\s\S]*?vars\.CHANGELOG_AUTO_PUBLISH_ENABLED == 'true'[\s\S]*?supabase functions deploy changelog-publish[\s\S]*?--no-verify-jwt/);
});
