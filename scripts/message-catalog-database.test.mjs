import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { messageCatalogDefaults } from "./message-catalog-data.mjs";

const migration = await readFile(new URL("../supabase/migrations/20261025030000_create_message_catalog.sql", import.meta.url), "utf8");
const seed = await readFile(new URL("../supabase/migrations/20261025031000_seed_message_catalog.sql", import.meta.url), "utf8");
test("message migration preserves every fallback entry, weights and formatting, and enforces publication and editing constraints", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    await db.exec(migration);
    await db.exec(seed);
    await db.exec(await readFile(new URL("../supabase/migrations/20261025032000_message_inline_markup.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261025033000_message_mistype_corrections.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261025034000_scheduled_message_pools.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261026030000_message_authors.sql", import.meta.url), "utf8"));
    const columns = "position,profile,category,text,weight,colorful,format,enabled";
    const entries = (await db.query(`select ${columns} from site_message_catalog order by position`)).rows;
    assert.deepEqual(entries, messageCatalogDefaults());
    assert.equal(entries.length, 2207);
    assert.equal((await db.query("select count(*)::int as count from site_message_catalog where corrected_text is not null")).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from site_message_catalog where markup")).rows[0].count, 0);
    assert.equal(new Set(entries.map((row) => `${row.profile}/${row.category}`)).size, 221);
    assert.ok((await db.query("select content_backup_tables() as tables")).rows[0].tables.includes("site_message_catalog"));
    await db.exec("set role authenticated");
    await db.exec("update site_message_catalog set text = 'Admin edited text', enabled = false where position = 1");
    await db.exec("update site_message_catalog set corrected_text = 'Admin corrected text' where position = 1");
    await db.exec("update site_message_catalog set author = 'Ada Lovelace' where position = 1");
    assert.equal((await db.query("select author from site_message_catalog where position = 1")).rows[0].author, "Ada Lovelace");
    assert.equal((await db.query("select count(*)::int as count from site_message_catalog where author is null")).rows[0].count, 2206);
    assert.equal((await db.query("select corrected_text from site_message_catalog where position = 1")).rows[0].corrected_text, "Admin corrected text");
    await db.exec("update site_message_catalog set text = '**Inline boot**', markup = true where category = 'bootMessages'");
    assert.ok((await db.query("select markup from site_message_catalog where category = 'bootMessages' limit 1")).rows[0].markup);
    for (const assignment of [
      "weight = 0", "weight = 'NaN'", "weight = 'Infinity'", "weight = 1001",
      "text = ' '", "category = 'unknown'", "profile = 'unknown'",
      `format = '{"backgroundImage":"url(https://bad.example/image)"}'`,
      `format = '{"color":"url(https://bad.example/image)"}'`, "format = '[]'",
      "category = 'bootMessages', colorful = true",
      "corrected_text = ' '", "corrected_text = text", "corrected_text = repeat('x', 2001)",
      "category = 'activities', corrected_text = 'Correction'",
      "category = 'bootMessages', corrected_text = 'Correction'",
      "author = ' '", "author = repeat('x', 201)", "author = 'Ada', category = 'activities'",
      "author = 'Ada', category = 'bootMessages'",
    ]) await assert.rejects(db.exec(`update site_message_catalog set ${assignment} where position = 2`), /check constraint/);
    await db.exec("set role anon");
    assert.equal((await db.query("select count(*)::int as count from site_message_catalog")).rows[0].count, 2206);
    await assert.rejects(db.exec("update site_message_catalog set enabled = true"), /permission denied/);
    await assert.rejects(db.exec("delete from site_message_catalog"), /permission denied/);
    await assert.rejects(db.exec("update site_message_catalog set corrected_text = 'Unauthorized'"), /permission denied/);
    await assert.rejects(db.exec("update site_message_catalog set author = 'Unauthorized'"), /permission denied/);
    await db.exec("set role authenticated; delete from site_message_catalog where position = 1");
    assert.equal((await db.query("select count(*)::int as count from site_message_catalog")).rows[0].count, 2206);
  } finally { await db.close(); }
});

test("custom pools enforce dates, timezone, permissions, draft privacy, immutable IDs, and atomic message deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    for (const file of [
      "20261025030000_create_message_catalog.sql", "20261025032000_message_inline_markup.sql",
      "20261025033000_message_mistype_corrections.sql", "20261025034000_scheduled_message_pools.sql",
    ]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    assert.equal((await db.query("select timezone from site_message_settings")).rows[0].timezone, "America/Chicago");
    await db.exec("set role authenticated");
    await db.exec("insert into site_message_pools(id,title,schedule,starts_on,ends_on) values ('custom-test','Test','annual','2000-12-30','2000-01-02')");
    await db.exec("insert into site_message_catalog(position,profile,category,text,enabled) values (1,'custom-test','messages','Custom draft',true), (2,'custom-test','activities','Hidden activity',false)");
    assert.equal((await db.query("select pool_id from site_message_catalog where position = 1")).rows[0].pool_id, "custom-test");
    await db.exec("update site_message_catalog set pool_id = null where position = 1");
    assert.equal((await db.query("select pool_id from site_message_catalog where position = 1")).rows[0].pool_id, "custom-test", "the server must maintain the cascading foreign key");
    for (const assignment of [
      "id = 'custom-changed'", "schedule = 'unknown'", "mode = 'unknown'", "title = ' '",
      "schedule = 'once'", "starts_on = '0999-01-01'",
    ]) await assert.rejects(db.exec(`update site_message_pools set ${assignment}`), /check constraint|cannot be changed/);
    await assert.rejects(db.exec("update site_message_catalog set profile = 'custom-unknown'"), /check constraint/);
    await assert.rejects(db.exec("update site_message_settings set timezone = 'Fake/Timezone'"), /check constraint/);
    await db.exec("update site_message_settings set timezone = 'America/New_York'");
    await assert.rejects(db.exec("delete from site_message_settings"), /permission denied/);
    await db.exec("set role anon");
    assert.equal((await db.query("select count(*)::int as n from site_message_pools")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int as n from site_message_catalog")).rows[0].n, 0, "a disabled pool's published messages must remain private");
    await assert.rejects(db.exec("update site_message_settings set timezone = 'UTC'"), /permission denied/);
    await assert.rejects(db.exec("delete from site_message_pools"), /permission denied/);
    await db.exec("set role authenticated; update site_message_pools set enabled = true");
    await db.exec("set role anon");
    assert.equal((await db.query("select count(*)::int as n from site_message_pools")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int as n from site_message_catalog")).rows[0].n, 1);
    await db.exec("set role authenticated; delete from site_message_pools");
    assert.equal((await db.query("select count(*)::int as n from site_message_catalog")).rows[0].n, 0);
  } finally { await db.close(); }
});
