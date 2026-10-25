import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
const channelId = `UC${"a".repeat(22)}`;
const secondId = `UC${"b".repeat(22)}`;
const entry = (id, title, date) => `<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><published>${date}</published></entry>`;
const feed = `<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">${[
  entry("abcdefghijk", "Older upload", "2026-10-23T12:00:00Z"),
  entry("0123456789_", "New &amp; shiny &#x1F600; &lt;script&gt;", "2026-10-25T12:00:00Z"),
].join("")}</feed>`;

function setup(options = {}) {
  let handler;
  const calls = [];
  const logs = [];
  const env = { SUPABASE_URL: "https://database.example", SUPABASE_ANON_KEY: "test-key", ...options.env };
  vm.runInNewContext(source, {
    Request, Response, AbortSignal, Date,
    Deno: { env: { get: (name) => env[name] }, serve: (callback) => { handler = callback; } },
    console: { error: (...args) => logs.push(args.join(" ")) },
    fetch: async (url, init) => {
      calls.push({ url, init });
      assert.ok(init.signal instanceof AbortSignal);
      if (url.startsWith("https://database.example/")) {
        assert.ok(url.includes("enabled=eq.true"));
        return Response.json(options.rows ?? [{ youtube_channel_id: channelId }], { status: options.databaseStatus ?? 200 });
      }
      assert.match(url, /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[A-Za-z0-9_-]{22}$/);
      assert.equal(init.redirect, "error");
      if (options.feedError) throw options.feedError;
      return new Response(options.xml ?? feed, { status: options.feedStatus ?? 200 });
    },
  });
  return {
    calls, logs,
    get: (method = "GET", origin = "https://www.shortbits.net") => handler(new Request("https://function.example", {
      method, headers: { origin },
    })),
  };
}

test("returns the newest upload, decodes XML text, and constructs only safe YouTube links", async () => {
  const app = setup();
  const response = await app.get();
  assert.equal(response.status, 200);
  const result = (await response.json()).videos[0];
  assert.deepEqual(result, {
    channelId, unavailable: false,
    video: { title: "New & shiny \u{1f600} <script>", url: "https://www.youtube.com/watch?v=0123456789_", publishedAt: "2026-10-25T12:00:00Z" },
  });
  assert.match(response.headers.get("Cache-Control"), /s-maxage=600/);
  await app.get();
  assert.equal(app.calls.length, 2, "warm cache must not query the database or YouTube again");
});

test("deduplicates configured channels and coalesces concurrent requests", async () => {
  const app = setup({ rows: [{ youtube_channel_id: channelId }, { youtube_channel_id: channelId }, { youtube_channel_id: secondId }] });
  const responses = await Promise.all([app.get(), app.get()]);
  assert.equal((await responses[0].json()).videos.length, 2);
  assert.equal(app.calls.length, 3);
});

test("keeps CDATA literal and reports channels with no uploads without an error", async () => {
  const cdata = setup({ xml: `<feed>${entry("abcdefghijk", "<![CDATA[A &amp; B]]>", "2026-10-25T12:00:00Z")}</feed>` });
  assert.equal((await (await cdata.get()).json()).videos[0].video.title, "A &amp; B");
  const empty = setup({ xml: "<feed></feed>" });
  assert.deepEqual((await (await empty.get()).json()).videos[0], { channelId, video: null, unavailable: false });
});

for (const options of [
  { feedStatus: 503 }, { feedError: new Error("timeout") }, { xml: "<html>blocked</html>" },
  { xml: "<feed><entry></feed>" },
  { xml: `<feed>${entry("not-valid", "Bad", "invalid")}</feed>` },
]) {
  test(`feed failures remain explicit, preserve channel results, and are not cached: ${JSON.stringify(options)}`, async () => {
    const app = setup(options);
    const response = await app.get();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual((await response.json()).videos[0], { channelId, video: null, unavailable: true });
    assert.ok(app.logs.length);
    await app.get();
    assert.equal(app.calls.length, 4);
  });
}

test("invalid database results and missing configuration fail explicitly without fetching arbitrary channels", async () => {
  for (const options of [
    { rows: [{ youtube_channel_id: "../../private" }] },
    { rows: { error: "malformed" } }, { databaseStatus: 503 },
    { env: { SUPABASE_ANON_KEY: undefined } },
  ]) {
    const app = setup(options);
    const response = await app.get();
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.ok(app.logs.length);
    assert.ok(app.calls.every(({ url }) => !url.includes("youtube.com")));
  }
});

test("supports preflight, rejects writes, and does not echo untrusted origins", async () => {
  const app = setup();
  assert.equal((await app.get("OPTIONS")).status, 204);
  assert.equal((await app.get("POST")).status, 405);
  const response = await app.get("GET", "https://untrusted.example");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://www.shortbits.net");
});
