import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
const channelId = `UC${"a".repeat(22)}`;
const secondId = `UC${"b".repeat(22)}`;
const avatarUrl = "https://yt3.googleusercontent.com/example=s160-c-k-c0x00ffffff-no-rj";
const page = (id = channelId) => `<html><head><title>Example creator</title></head><body>
  <meta content="https://www.youtube.com/channel/${id}" property="og:url">
  <meta property='og:image' content='https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj'>
  Channel</body></html>`;
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
    Request, Response, AbortSignal, Date, URL, TextDecoder,
    Deno: { env: { get: (name) => env[name] }, serve: (callback) => { handler = callback; } },
    console: { error: (...args) => logs.push(args.join(" ")) },
    fetch: async (url, init) => {
      calls.push({ url, init });
      assert.ok(init.signal instanceof AbortSignal);
      if (url === "https://database.example/auth/v1/user") {
        assert.equal(init.headers.Authorization, "Bearer test-session");
        return Response.json(options.user ?? { id: "admin", is_anonymous: false }, { status: options.authStatus ?? 200 });
      }
      if (url.startsWith("https://database.example/")) {
        assert.ok(url.includes("enabled=eq.true"));
        return Response.json(options.rows ?? [{ youtube_channel_id: channelId }], { status: options.databaseStatus ?? 200 });
      }
      assert.equal(init.redirect, "error");
      if (!url.includes("/feeds/")) {
        assert.match(url, /^https:\/\/www\.youtube\.com\/(?:channel\/UC[A-Za-z0-9_-]{22}|@[^/]+|c\/[^/]+|user\/[^/]+)$/);
        if (options.photoError) throw options.photoError;
        const id = url.match(/\/channel\/(UC[A-Za-z0-9_-]{22})$/)?.[1] ?? channelId;
        return new Response(options.html ?? page(id), { status: options.photoStatus ?? 200 });
      }
      assert.match(url, /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[A-Za-z0-9_-]{22}$/);
      if (options.feedError) throw options.feedError;
      return new Response(options.xml ?? feed, { status: options.feedStatus ?? 200 });
    },
  });
  return {
    calls, logs,
    get: (method = "GET", origin = "https://www.shortbits.net") => handler(new Request("https://function.example", {
      method, headers: { origin },
    })),
    post: (channelUrl, token = "test-session") => handler(new Request("https://function.example", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ channelUrl }),
    })),
  };
}

test("returns the newest upload and a channel photo from metadata after the HTML head, with safe links and decoded text", async () => {
  const app = setup();
  const response = await app.get();
  assert.equal(response.status, 200);
  const result = (await response.json()).videos[0];
  assert.deepEqual(result, {
    channelId, unavailable: false, avatarUrl, photoUnavailable: false,
    video: { title: "New & shiny \u{1f600} <script>", url: "https://www.youtube.com/watch?v=0123456789_", publishedAt: "2026-10-25T12:00:00Z" },
  });
  assert.match(response.headers.get("Cache-Control"), /s-maxage=600/);
  await app.get();
  assert.equal(app.calls.length, 3, "warm cache must not query the database or YouTube again");
});

test("deduplicates configured channels and coalesces concurrent requests", async () => {
  const app = setup({ rows: [{ youtube_channel_id: channelId }, { youtube_channel_id: channelId }, { youtube_channel_id: secondId }] });
  const responses = await Promise.all([app.get(), app.get()]);
  assert.equal((await responses[0].json()).videos.length, 2);
  assert.equal(app.calls.length, 5);
});

test("keeps CDATA literal and reports channels with no uploads without an error", async () => {
  const cdata = setup({ xml: `<feed>${entry("abcdefghijk", "<![CDATA[A &amp; B]]>", "2026-10-25T12:00:00Z")}</feed>` });
  assert.equal((await (await cdata.get()).json()).videos[0].video.title, "A &amp; B");
  const empty = setup({ xml: "<feed></feed>" });
  assert.deepEqual((await (await empty.get()).json()).videos[0], {
    channelId, video: null, unavailable: false, avatarUrl, photoUnavailable: false,
  });
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
    assert.deepEqual((await response.json()).videos[0], {
      channelId, video: null, unavailable: true, avatarUrl, photoUnavailable: false,
    });
    assert.ok(app.logs.length);
    await app.get();
    assert.equal(app.calls.length, 6);
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

test("supports preflight, restricts lookups to authenticated users, and does not echo untrusted origins", async () => {
  const app = setup();
  assert.equal((await app.get("OPTIONS")).status, 204);
  assert.match((await app.get("OPTIONS")).headers.get("Access-Control-Allow-Methods"), /POST/);
  assert.match((await app.get("OPTIONS")).headers.get("Access-Control-Allow-Headers"), /x-client-info/);
  assert.equal((await app.get("DELETE")).status, 405);
  assert.equal((await app.get("POST")).status, 401);
  const response = await app.get("GET", "https://untrusted.example");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://www.shortbits.net");
});

for (const options of [
  { photoStatus: 503 }, { photoError: new Error("timeout") }, { html: "<html>blocked</html>" },
  { html: page(secondId) },
  { html: page().replace("https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj", "https://untrusted.example/photo.png") },
  { html: page().replace("https://yt3.googleusercontent.com", "https://yt3.googleusercontent.com.evil.example") },
  { html: page().replace("https://yt3.googleusercontent.com", "https://user:password@yt3.googleusercontent.com") },
  { html: "x".repeat(2_000_001) },
]) {
  test(`photo failures preserve successful uploads and are not cached: ${options.html ? options.html.slice(0, 80) : JSON.stringify(options)}`, async () => {
    const app = setup(options);
    const response = await app.get();
    const result = (await response.json()).videos[0];
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(result.unavailable, false);
    assert.equal(result.video.url, "https://www.youtube.com/watch?v=0123456789_");
    assert.equal(result.avatarUrl, null);
    assert.equal(result.photoUnavailable, true);
    assert.ok(app.logs.length);
    await app.get();
    assert.equal(app.calls.length, 6);
  });
}

test("parses canonical links and encoded image URLs independently of attribute order", async () => {
  const app = setup({ html: `<head><link href="https://www.youtube.com/channel/${channelId}" rel="canonical">
    <meta content="https://yt3.ggpht.com/photo=s88-c?one=1&amp;two=2" property="og:image"></head>` });
  const result = (await (await app.get()).json()).videos[0];
  assert.equal(result.avatarUrl, "https://yt3.ggpht.com/photo=s160-c?one=1&two=2");
  assert.equal(result.photoUnavailable, false);
});

test("authenticated lookup accepts handles, channel URLs, legacy URLs and IDs without querying or caching the public list", async () => {
  for (const input of [
    "@example", channelId, `https://www.youtube.com/channel/${channelId}`,
    "https://www.youtube.com/@example/videos?view=0", "https://m.youtube.com/@example/",
    "https://youtube.com/c/example", "https://www.youtube.com/user/example",
  ]) {
    const app = setup();
    const response = await app.post(input);
    assert.equal(response.status, 200, input);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).channelId, channelId);
    assert.equal(app.calls.length, 2);
    assert.ok(app.calls.every(({ url }) => !url.includes("/rest/") && !url.includes("/feeds/")));
  }
});

test("channel ID lookup still succeeds when a photo is missing", async () => {
  const app = setup({ html: `<head><meta property="og:url" content="https://www.youtube.com/channel/${channelId}"></head>` });
  const response = await app.post("@example");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).channelId, channelId);
  assert.ok(app.logs.length);
});

test("lookups reject unsigned, expired and anonymous sessions before requesting YouTube", async () => {
  for (const options of [{ authStatus: 401 }, { user: { id: "anonymous", is_anonymous: true } }, { user: {} }]) {
    const app = setup(options);
    assert.equal((await app.post("@example")).status, 401);
    assert.ok(app.calls.every(({ url }) => !url.includes("youtube.com")));
  }
  const unsigned = setup();
  assert.equal((await unsigned.post("@example", "")).status, 401);
  assert.equal(unsigned.calls.length, 0);
});

test("lookups reject non-channel URLs without following redirects or fetching arbitrary hosts", async () => {
  for (const input of [
    "https://private.example/@example", "https://www.youtube.com.evil.example/@example",
    "https://user:password@www.youtube.com/@example", "http://www.youtube.com/@example",
    "https://www.youtube.com:444/@example", "https://www.youtube.com/watch?v=abcdefghijk",
    "https://www.youtube.com/redirect?url=https://private.example", "", null, "x".repeat(501),
  ]) {
    const app = setup();
    assert.equal((await app.post(input)).status, 400, String(input));
    assert.equal(app.calls.length, 1, "only the authentication check may run");
  }
});

test("lookup infrastructure failures are explicit and never cached", async () => {
  for (const options of [{ authStatus: 503 }, { photoStatus: 403 }, { html: "<html>consent required</html>" }]) {
    const app = setup(options);
    const response = await app.post("@example");
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match((await response.json()).error, /lookup is unavailable/);
    assert.ok(app.logs.length);
  }
});
