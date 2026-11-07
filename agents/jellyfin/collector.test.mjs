import test from "node:test";
import assert from "node:assert/strict";
import { collect, normalize, publish, validateConfig } from "./collector.mjs";

const owner = "a".repeat(32), other = "b".repeat(32);
const now = Date.now();
const config = { jellyfinUrl: "http://private.example:8096/jellyfin/", jellyfinUserId: owner,
  jellyfinApiKey: "private-jellyfin-key", supabaseUrl: "https://site.example/", supabaseKey: "sb_publishable_test_public_key",
  deviceToken: `sbjf_${"c".repeat(64)}` };
function session(id, title, paused = false, age = 0) {
  return { UserId: id, UserName: "PRIVATE_USERNAME", DeviceName: "PRIVATE_DEVICE", RemoteEndPoint: "PRIVATE_ADDRESS",
    Id: "PRIVATE_SESSION", NowPlayingItem: { Type: "Episode", Name: title, SeriesName: "A series", IndexNumber: 2,
      ParentIndexNumber: 1, RunTimeTicks: 1_800_000_000, Path: "PRIVATE_PATH", MediaSources: ["PRIVATE_MEDIA"] },
    LastPlaybackCheckIn: new Date(now - age).toISOString(), PlayState: { IsPaused: paused, PositionTicks: 100_000_000 } };
}
test("exact primary owner filtering excludes other users, additional users and controllable sessions", () => {
  const foreign = { ...session(other, "OTHER_TITLE"), AdditionalUsers: [{ UserId: owner }], SupportsRemoteControl: true };
  const result = normalize([foreign, session(owner.toUpperCase(), "OWNER_TITLE", true),
    session(other, "OTHER_NEWER_TITLE"), session(owner, "OWNER_PLAYING", false, 1000)], owner, now);
  assert.equal(result.state, "playing");
  assert.equal(result.item.title, "OWNER_PLAYING");
  assert.equal(result.item.progressMs, 11_000);
  const output = JSON.stringify(result);
  for (const excluded of ["OTHER_", "PRIVATE_", other, "DeviceName", "Path", "UserName", "AdditionalUsers"]) {
    assert.ok(!output.includes(excluded), excluded);
  }
  assert.deepEqual(normalize([foreign, session(other, "OTHER_TITLE")], owner, now), { userId: owner, state: "idle", item: null });
});
test("paused clocks stay fixed; stale playback expires; audio and idle sessions are not watching", () => {
  const paused = normalize([session(owner, "Paused", true, 10_000)], owner, now);
  assert.equal(paused.state, "paused");
  assert.equal(paused.item.progressMs, 10_000);
  assert.equal(normalize([session(owner, "Stale", false, 90_000)], owner, now).state, "expired");
  assert.equal(normalize([{ ...session(owner, "Missing freshness"), LastPlaybackCheckIn: undefined }], owner, now).item, null);
  assert.equal(normalize([{ ...session(owner, "Audio"), NowPlayingItem: { Type: "Audio" } }], owner, now).state, "idle");
  assert.throws(() => normalize([{ ...session(owner, "Bad"), PlayState: {} }], owner, now), /PLAYBACK_INVALID/);
});
test("missing, malformed and zero owner configuration never falls back to all sessions", () => {
  for (const jellyfinUserId of [undefined, "", "Caleb", "0".repeat(32), other.slice(1)]) {
    assert.throws(() => validateConfig({ ...config, jellyfinUserId }), /OWNER_USER_ID_REQUIRED/);
    assert.throws(() => normalize([session(other, "Must not publish")], jellyfinUserId, now), /OWNER_USER_ID_REQUIRED/);
  }
  assert.equal(validateConfig({ ...config, jellyfinUserId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }).jellyfinUserId, owner);
  assert.throws(() => validateConfig({ ...config, supabaseKey: "sb_secret_never_use" }), /PUBLIC_KEY/);
  assert.throws(() => validateConfig({ ...config, jellyfinUrl: "http://user:password@private.example/" }), /URL_INVALID/);
});
test("private API calls are local and publication sends only the owner allowlist", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    if (String(url).includes(`/Users/${owner}`)) return Response.json({ Id: owner, Policy: { IsDisabled: false } });
    if (String(url).endsWith("/Sessions")) return Response.json([session(other, "OTHER_TITLE"), session(owner, "My title")]);
    return Response.json({ ok: true });
  };
  const payload = await collect(config, fetchImpl, now);
  await publish(config, payload, fetchImpl);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].init.headers["X-Emby-Token"], config.jellyfinApiKey);
  const outbound = calls[2];
  assert.equal(outbound.url, "https://site.example/functions/v1/jellyfin-presence");
  for (const value of [config.jellyfinApiKey, config.jellyfinUrl, "PRIVATE_", "OTHER_TITLE", other]) {
    assert.ok(!JSON.stringify(outbound).includes(value), value);
  }
  assert.equal(outbound.init.headers["x-device-token"], config.deviceToken);
  let sent = false;
  await assert.rejects(publish(config, { ...payload, userId: other }, async () => { sent = true; }), /OWNER_INVALID/);
  await assert.rejects(publish(config, { ...payload, sessions: [] }, async () => { sent = true; }), /OWNER_INVALID/);
  assert.equal(sent, false);
});
test("invalid or disabled owner identity stops before session reads; network errors never include addresses", async () => {
  let calls = 0;
  await assert.rejects(collect(config, async () => { calls++; return Response.json({ Id: other }); }), /OWNER_ACCOUNT_INVALID/);
  assert.equal(calls, 1);
  await assert.rejects(collect(config, async () => Response.json({ Id: owner, Policy: { IsDisabled: true } })), /OWNER_ACCOUNT_INVALID/);
  await assert.rejects(collect(config, async () => { throw new Error(config.jellyfinApiKey + config.jellyfinUrl); }),
    error => error.message === "JELLYFIN_CONNECTION_FAILED");
});
