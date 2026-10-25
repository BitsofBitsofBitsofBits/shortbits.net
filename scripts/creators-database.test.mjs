import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20261025010000_create_creators.sql", import.meta.url), "utf8");
test("creators enforce publication, authenticated management, valid channels, ordering, and backup inclusion", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create table site_analytics_daily (
        day date primary key, views integer default 0, sessions integer default 0,
        updated_at timestamptz default now()
      );
      create table site_analytics_windows_daily (
        day date, opens integer default 0, updated_at timestamptz default now(),
        window_slug text constraint site_analytics_windows_daily_window_slug_check check (window_slug = 'about'),
        primary key (day, window_slug)
      );
    `);
    await db.exec(migration);
    await db.exec("set role authenticated");
    await db.exec(`
      insert into site_creators (position, sort_order, title, platform, channel_url, enabled)
      values (1, 20, 'Public creator', 'YouTube', 'https://www.youtube.com/@creator', true),
             (2, 0, 'Draft creator', 'Twitch', 'https://www.twitch.tv/creator', false),
             (3, 10, 'Another creator', 'Other', 'https://example.com', true);
    `);
    await assert.rejects(db.exec("insert into site_creators (position, enabled) values (4, true)"), /check constraint/);
    await assert.rejects(db.exec("update site_creators set youtube_channel_id = '@handle' where position = 1"), /check constraint/);
    await assert.rejects(db.exec("update site_creators set channel_url = 'javascript:alert(1)' where position = 1"), /check constraint/);
    await assert.rejects(db.exec("update site_creators set sort_order = -1 where position = 1"), /check constraint/);
    assert.ok((await db.query("select content_backup_tables() as names")).rows[0].names.includes("site_creators"));
    await db.exec("set role anon");
    assert.deepEqual((await db.query("select position from site_creators order by sort_order, position")).rows.map((row) => row.position), [3, 1]);
    await assert.rejects(db.exec("delete from site_creators"), /permission denied/);
    await assert.rejects(db.exec("update site_creators set enabled = true"), /permission denied/);
    await db.exec("select record_site_analytics('window_open', 'creators')");
    await db.exec("set role authenticated; delete from site_creators where position = 2");
    assert.equal((await db.query("select count(*)::int as count from site_creators")).rows[0].count, 2);
    await db.exec("reset role");
    assert.equal((await db.query("select opens from site_analytics_windows_daily where window_slug = 'creators'")).rows[0].opens, 1);
  } finally {
    await db.close();
  }
});
