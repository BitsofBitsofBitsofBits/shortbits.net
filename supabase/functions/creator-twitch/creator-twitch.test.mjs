import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
const avatarUrl = "https://static-cdn.jtvnw.net/jtv_user_pictures/example-profile_image-300x300.png";
const user = { id: "123", login: "example", display_name: "Example", profile_image_url: avatarUrl };
const stream = { user_id: "123", title: "<script>Live!</script>", game_name: "Science & Technology", started_at: "2026-10-26T00:00:00Z" };
const vod = { user_id: "123", id: "456", title: "Past broadcast", published_at: "2026-10-25T00:00:00Z" };

function setup(options = {}) {
  let handler;
  let now = Date.now();
  const calls = [];
  const logs = [];
  const env = { SUPABASE_URL: "https://database.example", SUPABASE_ANON_KEY: "test-anon",
    TWITCH_CLIENT_ID: "test-client", TWITCH_CLIENT_SECRET: "test-secret", ...options.env };
  vm.runInNewContext(source, {
    Request, Response, AbortSignal, URL, URLSearchParams,
    Date: class extends Date { static now() { return now; } },
    console: { error: (...args) => logs.push(args.join(" ")) },
    Deno: { env: { get: name => env[name] }, serve: callback => { handler = callback; } },
    fetch: async (input, init) => {
      const url = new URL(input);
      calls.push({ url: url.href, init });
      assert.ok(init.signal instanceof AbortSignal);
      assert.equal(init.redirect, "error");
      if (url.hostname === "database.example") {
        if (url.pathname === "/auth/v1/user") return Response.json(options.authUser ?? { id: "admin" }, { status: options.authStatus ?? 200 });
        assert.equal(url.searchParams.get("enabled"), "eq.true");
        return Response.json(options.rows ?? [{ channel_url: "https://www.twitch.tv/example" }], { status: options.databaseStatus ?? 200 });
      }
      if (url.hostname === "id.twitch.tv") {
        assert.equal(url.href, "https://id.twitch.tv/oauth2/token");
        assert.equal(init.method, "POST");
        assert.equal(init.body.get("client_secret"), "test-secret");
        assert.equal(url.search, "", "Tokens and secrets must not appear in URLs");
        return Response.json({ access_token: "test-token", expires_in: options.expiresIn ?? 3600 }, { status: options.tokenStatus ?? 200 });
      }
      assert.equal(url.origin, "https://api.twitch.tv");
      assert.equal(init.headers["Client-Id"], "test-client");
      assert.equal(init.headers.Authorization, "Bearer test-token");
      if (options.rejectToken && calls.filter(call => call.url.includes("/helix/")).length === 1) return Response.json({}, { status: 401 });
      const resource = url.pathname.split("/").pop();
      if (options.failResource === resource) return Response.json({}, { status: 429 });
      return Response.json({ data: resource === "users" ? options.users ?? [user]
        : resource === "streams" ? options.streams ?? [stream] : options.videos ?? [vod] });
    },
  });
  return {
    calls, logs, advance: ms => { now += ms; },
    get: (method = "GET") => handler(new Request("https://function.example", { method })),
    post: (channelUrl, authenticated = true) => handler(new Request("https://function.example", {
      method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer test-session" } : {}) },
      body: JSON.stringify({ channelUrl }),
    })),
  };
}

test("live channels include a photo and stream metadata without fetching VODs, with one-minute caching", async () => {
  const app = setup();
  const response = await app.get();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control"), /s-maxage=60/);
  assert.deepEqual((await response.json()).channels, [{
    login: "example", avatarUrl, live: { title: stream.title, game: stream.game_name, startedAt: stream.started_at }, video: null, unavailable: false,
  }]);
  assert.ok(app.calls.every(call => !call.url.includes("/videos?")));
  const count = app.calls.length;
  app.advance(59_000);
  assert.match((await app.get()).headers.get("Cache-Control"), /s-maxage=1(?:$|,)/, "CDN caching must not extend a nearly expired status for another minute");
  assert.equal(app.calls.length, count);
  app.advance(1001);
  await app.get();
  assert.equal(app.calls.filter(call => call.url.includes("/oauth2/")).length, 1, "Warm app token is reused after feed expiry");
});

test("offline channels use the most recent archived VOD, and no-VOD channels remain explicitly offline", async () => {
  const app = setup({ streams: [] });
  const response = await app.get();
  const channel = (await response.json()).channels[0];
  assert.equal(channel.live, null);
  assert.deepEqual(channel.video, { title: vod.title, url: "https://www.twitch.tv/videos/456", publishedAt: vod.published_at });
  const request = new URL(app.calls.find(call => call.url.includes("/videos?")).url);
  assert.equal(request.searchParams.get("type"), "archive");
  assert.equal(request.searchParams.get("sort"), "time");
  assert.equal(request.searchParams.get("first"), "1");
  const empty = setup({ streams: [], videos: [] });
  assert.deepEqual((await (await empty.get()).json()).channels[0], { login: "example", avatarUrl, live: null, video: null, unavailable: false });
});

test("authenticated lookup accepts usernames and Twitch URLs without saving or querying the public list", async () => {
  for (const input of ["Example", "https://twitch.tv/Example", "https://www.twitch.tv/example/", "https://m.twitch.tv/example?ref=link"]) {
    const app = setup();
    const response = await app.post(input);
    assert.equal(response.status, 200, input);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { id: "123", login: "example", displayName: "Example", avatarUrl, channelUrl: "https://www.twitch.tv/example" });
    assert.equal(app.calls.filter(call => call.url.includes("database.example")).length, 1);
  }
});

test("unauthenticated, expired and anonymous users cannot look up channels", async () => {
  const unsigned = setup();
  assert.equal((await unsigned.post("example", false)).status, 401);
  assert.equal(unsigned.calls.length, 0);
  for (const options of [{ authStatus: 401 }, { authUser: { id: "anon", is_anonymous: true } }, { authUser: {} }]) {
    const app = setup(options);
    assert.equal((await app.post("example")).status, 401);
    assert.equal(app.calls.length, 1);
  }
});

test("lookup rejects unrelated hosts, credentials, non-HTTPS URLs and non-channel paths before contacting Twitch", async () => {
  for (const input of ["https://private.example/example", "https://twitch.tv.evil.example/example",
    "http://twitch.tv/example", "https://user:password@twitch.tv/example", "https://twitch.tv:444/example",
    "https://twitch.tv/directory", "https://twitch.tv/videos/123", "https://clips.twitch.tv/example",
    "https://twitch.tv/example/videos", "", null, "x".repeat(501)]) {
    const app = setup();
    assert.equal((await app.post(input)).status, 400, String(input));
    assert.equal(app.calls.length, 1);
  }
  assert.equal((await setup({ users: [] }).post("example")).status, 404);
});

test("malformed Twitch URLs return actionable guidance without contacting Twitch", async () => {
  for (const input of ["https://www.twitch/human1", "www.twitch.tv/human1", "not a URL", ""]) {
    const app = setup();
    const response = await app.post(input);
    assert.equal(response.status, 400, input);
    assert.match((await response.json()).error, /Twitch username.*https:\/\/www\.twitch\.tv\/human1/);
    assert.equal(app.calls.length, 1, "Only Supabase session verification should run");
  }
});

test("partial API failures preserve the photo/channel, log errors and never cache an offline-shaped success", async () => {
  for (const options of [{ failResource: "streams" }, { streams: [], failResource: "videos" },
    { streams: [{ ...stream, user_id: "999" }] }, { streams: [], videos: [{ ...vod, id: "../evil" }] }]) {
    const app = setup(options);
    const response = await app.get();
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual((await response.json()).channels[0], { login: "example", avatarUrl, live: null, video: null, unavailable: true });
    assert.ok(app.logs.length);
    const count = app.calls.length;
    await app.get();
    assert.ok(app.calls.length > count);
  }
});

test("missing credentials and invalid metadata are explicit, and no server secrets reach responses", async () => {
  for (const options of [{ env: { TWITCH_CLIENT_SECRET: undefined } }, { tokenStatus: 403 },
    { users: [{ ...user, profile_image_url: "https://evil.example/photo" }] }, { users: [{ ...user, login: "someone_else" }] }]) {
    const app = setup(options);
    const response = await app.post("example");
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.ok(!body.includes("test-secret") && !body.includes("test-token"));
    assert.ok(app.logs.length);
  }
});

test("enabled Twitch channels deduplicate and concurrent public requests coalesce", async () => {
  const app = setup({ rows: [
    { channel_url: "https://www.youtube.com/@example" },
    { channel_url: "https://twitch.tv/Example" }, { channel_url: "https://www.twitch.tv/example" },
  ] });
  const results = await Promise.all([app.get(), app.get()]);
  assert.equal((await results[0].json()).channels.length, 1);
  assert.equal(app.calls.filter(call => call.url.includes("/users?")).length, 1);
  assert.equal(app.calls.filter(call => call.url.includes("/oauth2/")).length, 1);
});

test("expired and revoked application tokens refresh without an unbounded retry", async () => {
  const revoked = setup({ rejectToken: true });
  assert.equal((await revoked.post("example")).status, 200);
  assert.equal(revoked.calls.filter(call => call.url.includes("/oauth2/")).length, 2);
  const expired = setup({ expiresIn: 61 });
  await expired.post("example");
  expired.advance(2000);
  await expired.post("example");
  assert.equal(expired.calls.filter(call => call.url.includes("/oauth2/")).length, 2);
});

test("methods, empty lists, database failures and unexpected list truncation fail predictably", async () => {
  assert.equal((await setup().get("OPTIONS")).status, 204);
  assert.equal((await setup().get("DELETE")).status, 405);
  assert.deepEqual(await (await setup({ rows: [] }).get()).json(), { channels: [] });
  for (const options of [{ databaseStatus: 503 }, { rows: {} }, { rows: Array(1000).fill({ channel_url: "https://twitch.tv/example" }) }]) {
    const app = setup(options);
    assert.equal((await app.get()).status, 502);
    assert.equal(app.calls.length, 1);
  }
});
