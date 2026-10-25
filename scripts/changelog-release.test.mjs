import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20261025020000_release_2_0.sql", import.meta.url), "utf8");
test("2.0 release notes append complete, editable entries without overwriting published history or drafts", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table site_changelog (
        position integer primary key check (position > 0),
        entry_date date,
        title text check (title is null or char_length(title) between 1 and 120),
        summary text check (summary is null or char_length(summary) between 1 and 800),
        enabled boolean not null default false,
        updated_at timestamptz not null default now(),
        check (not enabled or (entry_date is not null and title is not null and summary is not null))
      );
      insert into site_changelog (position, entry_date, title, summary, enabled) values
        (1, '2026-10-13', 'shortbits.net 1.0', 'Original release', true),
        (2, '2026-10-14', 'shortbits.net 1.1', 'Original update', true),
        (3, '2026-10-14', 'shortbits.net 1.1.1', 'Theme update', true),
        (1000, null, 'Unpublished draft', 'Keep this draft', false);
    `);
    const original = (await db.query("select * from site_changelog order by position")).rows;
    await db.exec(migration);
    assert.deepEqual((await db.query("select * from site_changelog where position <= 1000 order by position")).rows, original);
    const entries = (await db.query("select * from site_changelog where position > 1000 order by position")).rows;
    assert.equal(entries.length, 16);
    assert.equal(entries[0].title, "shortbits.net 2.0");
    assert.deepEqual(entries.map((entry) => entry.position), Array.from({ length: 16 }, (_, index) => 1001 + index));
    assert.equal(new Set(entries.map((entry) => entry.title)).size, entries.length);
    for (const entry of entries) {
      assert.ok(entry.title.startsWith("shortbits.net 2.0"));
      assert.equal(entry.entry_date.toISOString().slice(0, 10), "2026-10-25");
      assert.equal(entry.enabled, true);
      assert.ok(entry.summary.length <= 800);
    }
    const summaries = entries.map((entry) => entry.summary).join(" ");
    for (const feature of [
      "professional profile", "certifications", "Markdown", "RSS", "ShortBits",
      "atomic restoration", "HARDWARE.SYS", "Unraid", "CREATOR.FEED", "CoBits",
      "BITITAIRE", "Experimental Layouts", "fireworks", "/boot", "Find a Bit",
      "NOTIFICATIONS.LOG", "Resend", "first-paint styles", "bounded retries",
    ]) assert.ok(summaries.includes(feature), `Missing release coverage for ${feature}`);
  } finally {
    await db.close();
  }
});
