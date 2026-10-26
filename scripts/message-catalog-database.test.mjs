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
    ]) await assert.rejects(db.exec(`update site_message_catalog set ${assignment} where position = 2`), /check constraint/);
    await db.exec("set role anon");
    assert.equal((await db.query("select count(*)::int as count from site_message_catalog")).rows[0].count, 2206);
    await assert.rejects(db.exec("update site_message_catalog set enabled = true"), /permission denied/);
    await assert.rejects(db.exec("delete from site_message_catalog"), /permission denied/);
    await assert.rejects(db.exec("update site_message_catalog set corrected_text = 'Unauthorized'"), /permission denied/);
    await db.exec("set role authenticated; delete from site_message_catalog where position = 1");
    assert.equal((await db.query("select count(*)::int as count from site_message_catalog")).rows[0].count, 2206);
  } finally { await db.close(); }
});
