import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
function setup(options = {}) {
  let handler;
  let now = Date.now();
  let active = true;
  const calls = [];
  const logs = [];
  vm.runInNewContext(source, {
    Request, Response, URL, URLSearchParams, AbortSignal, btoa,
    Date: class extends Date { static now() { return now; } },
    console: { error: (...args) => logs.push(args.join(" ")) },
    Deno: { serve: callback => { handler = callback; }, env: { get: key => ({
      SUPABASE_URL: "https://database.example", SUPABASE_SERVICE_ROLE_KEY: "server-secret",
      SPOTIFY_CLIENT_ID: "client", SPOTIFY_CLIENT_SECRET: "secret", SPOTIFY_REFRESH_TOKEN: "refresh",
    })[key] } },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/oauth")) throw new Error("Unexpected OAuth endpoint");
      if (url.includes("accounts.spotify.com")) return Response.json({ access_token: "spotify-token" });
      if (url.includes("currently-playing")) {
        if (!active) return new Response(null, { status: 204 });
        return Response.json({ is_playing: true, progress_ms: 1000,
          item: { type: "track", name: "A song", artists: [{ name: "Artist" }], duration_ms: 180000, album: {}, external_urls: {} } },
        { status: options.playbackStatus ?? 200 });
      }
      assert.match(url, /observe_spotify_session$/);
      return Response.json("2026-10-26T12:00:00Z", { status: options.sessionStatus ?? 200 });
    },
  });
  return { calls, logs, advance: () => { now += 31_000; }, stop: () => { active = false; },
    get: () => handler(new Request("https://function.example")) };
}
test("fresh Spotify snapshots include persisted continuous session timing; cached snapshots do not add writes", async () => {
  const app = setup();
  const response = await app.get();
  const body = await response.json();
  assert.equal(body.sessionStartedAt, "2026-10-26T12:00:00Z");
  assert.equal(body.isPlaying, true);
  await app.get();
  assert.equal(app.calls.filter(call => call.url.includes("observe_spotify_session")).length, 1);
  app.advance();
  app.stop();
  assert.equal((await (await app.get()).json()).item, null);
  assert.deepEqual(JSON.parse(app.calls.at(-1).init.body), { p_active: false });
});
test("session database failure is explicit without breaking existing Spotify playback", async () => {
  const app = setup({ sessionStatus: 503 });
  const response = await app.get();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.item.title, "A song");
  assert.equal(body.sessionStartedAt, null);
  assert.equal(body.sessionTrackingUnavailable, true);
  assert.ok(app.logs.length);
});
test("Spotify upstream failures do not create session observations", async () => {
  const app = setup({ playbackStatus: 429 });
  assert.equal((await app.get()).status, 429);
  assert.equal(app.calls.filter(call => call.url.includes("observe_spotify_session")).length, 0);
});
