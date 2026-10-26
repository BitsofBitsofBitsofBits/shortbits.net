import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = (await Promise.all([
  "../supabase/migrations/20261026050000_youtube_presence.sql",
  "../supabase/migrations/20261026060000_youtube_session_continuity.sql",
].map(path => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
const artworkMigration = await readFile(new URL("../supabase/migrations/20261026080000_youtube_channel_artwork.sql", import.meta.url), "utf8");
const item = { videoId: "abcdefghijk", title: "A video", channel: "A channel",
  isPlaying: true, progressMs: 1000, durationMs: 180_000 };

test("YouTube tokens are hashed, service-only, revocable, and never exposed to public readers", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    await db.exec(migration);
    await db.exec(artworkMigration);
    const device = (await db.query("select create_youtube_presence_device('My browser') as device")).rows[0].device;
    assert.match(device.token, /^sbyt_[0-9a-f]{64}$/);
    const hash = (await db.query("select token_hash from youtube_presence_devices")).rows[0].token_hash;
    assert.notEqual(hash, device.token);
    await db.exec("set role service_role");
    assert.deepEqual((await db.query("select report_youtube_presence('invalid', $1) as result", [item])).rows[0].result, { error: "invalid_token" });
    assert.deepEqual((await db.query("select report_youtube_presence($1, $2) as result", [hash, item])).rows[0].result, { ok: true });
    await db.exec("set role anon");
    const presence = (await db.query("select read_youtube_presence() as result")).rows[0].result;
    assert.deepEqual(presence.item, { videoId: item.videoId, title: item.title, channel: item.channel,
      channelAvatarUrl: null, durationMs: item.durationMs });
    assert.equal(presence.isPlaying, true);
    assert.ok(presence.sessionStartedAt && presence.expiresAt);
    assert.ok(!JSON.stringify(presence).includes(hash));
    assert.ok(!JSON.stringify(presence).includes(device.id));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.exec("select * from youtube_presence_devices"), /permission denied/);
      await assert.rejects(db.exec("select * from youtube_presence"), /permission denied/);
      await assert.rejects(db.exec("select * from media_sessions"), /permission denied/);
      await assert.rejects(db.exec("select create_youtube_presence_device('unauthorized')"), /permission denied/);
      await assert.rejects(db.query("select report_youtube_presence($1, $2)", [hash, item]), /permission denied/);
      await assert.rejects(db.exec("select observe_spotify_session(true)"), /permission denied/);
    }
    await db.exec("reset role; update youtube_presence set expires_at = now() - interval '1 second'");
    assert.deepEqual((await db.query("select read_youtube_presence() as result")).rows[0].result, { item: null });
    await db.query("delete from youtube_presence_devices where id = $1", [device.id]);
    assert.deepEqual((await db.query("select report_youtube_presence($1, $2) as result", [hash, item])).rows[0].result, { error: "invalid_token" });
    assert.equal((await db.query("select count(*)::int as count from youtube_presence")).rows[0].count, 0);
  } finally { await db.close(); }
});

test("continuous sessions survive track changes and pauses, but expire after observation gaps", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    await db.exec(migration);
    await db.exec(artworkMigration);
    await db.exec("select observe_spotify_session(true)");
    await db.exec("update media_sessions set started_at = now() - interval '10 minutes' where provider = 'spotify'");
    const first = (await db.query("select started_at from media_sessions where provider = 'spotify'")).rows[0].started_at;
    assert.equal(Number((await db.query("select observe_spotify_session(true) as started")).rows[0].started), Number(first));
    await db.exec("update media_sessions set last_seen_at = now() - interval '91 seconds' where provider = 'spotify'");
    assert.notEqual(Number((await db.query("select observe_spotify_session(true) as started")).rows[0].started), Number(first));
    await db.exec("select observe_spotify_session(false)");
    assert.equal((await db.query("select count(*)::int as count from media_sessions")).rows[0].count, 0);

    await db.exec("select create_youtube_presence_device('Browser')");
    const hash = (await db.query("select token_hash from youtube_presence_devices")).rows[0].token_hash;
    await db.query("select report_youtube_presence($1, $2)", [hash, item]);
    await db.exec("update media_sessions set started_at = now() - interval '20 minutes' where provider = 'youtube'");
    const started = (await db.query("select started_at from media_sessions where provider = 'youtube'")).rows[0].started_at;
    await db.query("select report_youtube_presence($1, $2)", [hash, { ...item, videoId: "ZYXWVUTSRQP", isPlaying: false }]);
    assert.equal(Date.parse((await db.query("select read_youtube_presence() as result")).rows[0].result.sessionStartedAt), Number(started));
    await db.query("select report_youtube_presence($1, null)", [hash]);
    assert.deepEqual((await db.query("select read_youtube_presence() as result")).rows[0].result, { item: null });
    await db.query("select report_youtube_presence($1, $2)", [hash, item]);
    assert.equal(Number((await db.query("select started_at from media_sessions where provider = 'youtube'")).rows[0].started_at), Number(started), "Autoplay/navigation gaps do not restart a session");
    await db.query("select report_youtube_presence($1, null, true)", [hash]);
    assert.equal((await db.query("select count(*)::int as count from media_sessions")).rows[0].count, 0, "Opting out ends the session");
  } finally { await db.close(); }
});

test("artwork migration preserves existing presence, validates icons, and supports older extension reports", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    await db.exec(migration);
    await db.exec("select create_youtube_presence_device('Browser')");
    const hash = (await db.query("select token_hash from youtube_presence_devices")).rows[0].token_hash;
    await db.query("select report_youtube_presence($1, $2)", [hash, item]);
    const startedAt = (await db.query("select read_youtube_presence() as result")).rows[0].result.sessionStartedAt;
    await db.exec(artworkMigration);
    assert.equal((await db.query("select read_youtube_presence() as result")).rows[0].result.item.channelAvatarUrl, null);
    for (const channelAvatarUrl of ["https://yt3.ggpht.com/channel=s88-c", "https://yt3.googleusercontent.com/ytc/channel=s88-c"]) {
      await db.exec("set role service_role");
      await db.query("select report_youtube_presence($1, $2)", [hash, { ...item, channelAvatarUrl }]);
      await db.exec("set role anon");
      const presence = (await db.query("select read_youtube_presence() as result")).rows[0].result;
      assert.equal(presence.item.channelAvatarUrl, channelAvatarUrl);
      assert.equal(presence.sessionStartedAt, startedAt);
    }
    await db.exec("set role service_role");
    for (const channelAvatarUrl of ["http://yt3.ggpht.com/icon", "https://untrusted.example/icon",
      "https://yt3.ggpht.com.evil.example/icon", "https://yt3.ggpht.com@evil.example/icon",
      "https://yt3.ggpht.com:444/icon", "https://yt3.ggpht.com/icon?private=value",
      "https://yt3.ggpht.com/icon#fragment", "https://yt3.ggpht.com/\\evil.example",
      "https://yt3.ggpht.com/white space", `https://yt3.ggpht.com/${"a".repeat(2048)}`]) {
      await assert.rejects(db.query("select report_youtube_presence($1, $2)", [hash, { ...item, channelAvatarUrl }]), /check constraint/);
    }
    await db.query("select report_youtube_presence($1, $2)", [hash, { ...item, channelAvatarUrl: null }]);
    await db.query("select report_youtube_presence($1, $2)", [hash, item]);
    await db.exec("set role anon");
    assert.equal((await db.query("select read_youtube_presence() as result")).rows[0].result.item.channelAvatarUrl, null);
  } finally { await db.close(); }
});
