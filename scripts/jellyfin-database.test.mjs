import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migration = await readFile(new URL("../supabase/migrations/20261107090000_jellyfin_presence.sql", import.meta.url), "utf8");
const owner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const item = { title: "Owner film", series: null, season: null, episode: null, durationMs: 1000, progressMs: 0, isPlaying: true };
test("Jellyfin storage and routines are service-only, account-scoped, overwrite-only and expire media", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    await db.exec(migration);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.exec("select * from jellyfin_presence"), /permission denied/);
      await assert.rejects(db.query("select read_jellyfin_presence($1)", [owner]), /permission denied/);
      await assert.rejects(db.query("select report_jellyfin_presence($1, 'playing', $2)", [owner, item]), /permission denied/);
    }
    await db.exec("set role service_role");
    await db.query("select report_jellyfin_presence($1, 'playing', $2)", [owner, item]);
    const own = (await db.query("select read_jellyfin_presence($1) as result", [owner])).rows[0].result;
    assert.deepEqual(own.item, item);
    assert.equal(Date.parse(own.expiresAt) - Date.parse(own.updatedAt), 90_000);
    assert.ok(!JSON.stringify(own).includes(owner));
    assert.equal((await db.query("select read_jellyfin_presence($1) as result", [other])).rows[0].result.item, null);
    await db.query("select report_jellyfin_presence($1, 'paused', $2)", [owner, { ...item, isPlaying: false }]);
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as count from jellyfin_presence")).rows[0].count, 1);
    await db.exec("update jellyfin_presence set expires_at = now() - interval '1 second'");
    const expired = (await db.query("select read_jellyfin_presence($1) as result", [owner])).rows[0].result;
    assert.equal(expired.state, "expired");
    assert.equal(expired.item, null);
    await assert.rejects(db.query("select report_jellyfin_presence(null, 'idle', null)"), /Owner account is required/);
  } finally { await db.close(); }
});
