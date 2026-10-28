import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("content backup RPCs enforce permissions, exact schemas, and atomic restoration", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    const names = [
      "pronoun_profiles", "site_blog_posts", "site_changelog", "site_favorite_games",
      "site_hardware", "site_hardware_machine_order", "site_now",
      "site_resume_certifications", "site_resume_education", "site_resume_entries",
      "site_resume_profile", "spotify_featured_playlists", "spotify_featured_tracks",
    ];
    const singletons = ["pronoun_profiles", "site_now", "site_resume_profile"];
    for (const table of names) {
      await db.exec(`
        create table public.${table} (
          id text primary key,
          body text not null check (body <> 'INVALID')
        );
        insert into public.${table} values ('${singletons.includes(table) ? "primary" : "one"}', 'original');
        grant select, update ${singletons.includes(table) ? "" : ", insert, delete"}
          on public.${table} to authenticated;
      `);
    }
    await db.exec(await readFile(new URL("../supabase/migrations/20261022030000_content_backups.sql", import.meta.url), "utf8"));
    await db.exec("create table site_analytics_windows_daily (window_slug text constraint site_analytics_windows_daily_window_slug_check check (window_slug = 'about'));");
    await db.exec(await readFile(new URL("../supabase/migrations/20261025010000_create_creators.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261025030000_create_message_catalog.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261025032000_message_inline_markup.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261025033000_message_mistype_corrections.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261025034000_scheduled_message_pools.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261026030000_message_authors.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261026090000_featured_project.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261028070000_builtin_message_pool_settings.sql", import.meta.url), "utf8"));
    await db.exec("set role anon");
    await assert.rejects(db.query("select public.export_site_content()"), /permission denied/);
    await assert.rejects(db.query("select public.restore_site_content('{}'::jsonb)"), /permission denied/);
    await db.exec("set role authenticated");
    await db.exec("insert into site_creators (position, title, platform, channel_url, enabled) values (1, 'Original creator', 'YouTube', 'https://www.youtube.com/@example', true)");
    await db.exec("insert into site_message_catalog (position, profile, category, text, markup, corrected_text) values (1, 'standard', 'messages', 'Private message draft', true, '**Corrected** draft')");
    await db.exec("update site_message_catalog set author = 'Ada Lovelace' where position = 1");
    await db.exec("insert into site_message_pools (id,title,schedule,starts_on,ends_on,enabled) values ('custom-backup','Backup pool','annual','2000-12-30','2000-01-02',true)");
    await db.exec("insert into site_message_catalog (position,profile,category,text) values (2,'custom-backup','messages','Custom backup message')");
    await db.exec("insert into site_message_pools(id,title,schedule,mode,enabled) values ('easter','Backup Easter','automatic','exclusive',false)");
    await db.exec("update site_message_settings set timezone = 'America/New_York'");
    const exported = (await db.query("select public.export_site_content() as backup")).rows[0].backup;
    assert.equal(Object.keys(exported.tables).length, names.length + 5);
    assert.equal(exported.tables.site_featured_project[0].enabled, false);
    assert.equal(exported.tables.site_creators[0].title, "Original creator");
    assert.ok(!("messages" in exported.tables));
    assert.equal(exported.tables.site_message_catalog[0].text, "Private message draft");
    assert.equal(exported.tables.site_message_catalog[0].markup, true);
    assert.equal(exported.tables.site_message_catalog[0].corrected_text, "**Corrected** draft");
    assert.equal(exported.tables.site_message_catalog[0].author, "Ada Lovelace");
    await db.exec("update public.site_blog_posts set body = 'changed'");
    await db.exec("delete from site_creators");
    await db.exec("delete from site_featured_project");
    await db.exec("delete from site_message_catalog");
    await db.exec("delete from site_message_pools");
    await db.exec("update site_message_settings set timezone = 'UTC'");
    const result = (await db.query("select public.restore_site_content($1::jsonb) as result", [JSON.stringify(exported)])).rows[0].result;
    assert.deepEqual(result, { rows: 20, tables: 18 });
    assert.equal((await db.query("select title from site_featured_project")).rows[0].title, "BITSOFBITS WEBSITE");
    assert.equal((await db.query("select enabled from site_featured_project")).rows[0].enabled, false);
    assert.equal((await db.query("select title from site_message_pools")).rows[0].title, "Backup pool");
    assert.deepEqual((await db.query("select schedule, starts_on, ends_on, enabled from site_message_pools where id='easter'")).rows[0],
      { schedule: "automatic", starts_on: null, ends_on: null, enabled: false });
    assert.equal((await db.query("select text from site_message_catalog where profile = 'custom-backup'")).rows[0].text, "Custom backup message");
    assert.equal((await db.query("select timezone from site_message_settings")).rows[0].timezone, "America/New_York");
    assert.equal((await db.query("select body from site_blog_posts")).rows[0].body, "original");
    assert.equal((await db.query("select title from site_creators")).rows[0].title, "Original creator");
    assert.equal((await db.query("select text from site_message_catalog")).rows[0].text, "Private message draft");
    assert.equal((await db.query("select markup from site_message_catalog")).rows[0].markup, true);
    assert.equal((await db.query("select corrected_text from site_message_catalog")).rows[0].corrected_text, "**Corrected** draft");
    assert.equal((await db.query("select author from site_message_catalog")).rows[0].author, "Ada Lovelace");
    const oldAuthorSchema = structuredClone(exported);
    delete oldAuthorSchema.tables.site_message_catalog[0].author;
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(oldAuthorSchema)]), /schema does not match/);
    const invalidAuthor = structuredClone(exported);
    invalidAuthor.tables.site_blog_posts[0].body = "must roll back";
    invalidAuthor.tables.site_message_catalog[0].author = " ";
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(invalidAuthor)]), /check constraint/);
    assert.equal((await db.query("select body from site_blog_posts")).rows[0].body, "original");

    const outdated = structuredClone(exported);
    delete outdated.tables.site_message_catalog;
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(outdated)]), /exactly the supported/);
    const oldMessageSchema = structuredClone(exported);
    delete oldMessageSchema.tables.site_message_catalog[0].markup;
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(oldMessageSchema)]), /schema does not match/);
    const oldCorrectionSchema = structuredClone(exported);
    delete oldCorrectionSchema.tables.site_message_catalog[0].corrected_text;
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(oldCorrectionSchema)]), /schema does not match/);
    const invalidCorrection = structuredClone(exported);
    invalidCorrection.tables.site_blog_posts[0].body = "must roll back";
    invalidCorrection.tables.site_message_catalog[0].corrected_text = " ";
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(invalidCorrection)]), /check constraint/);
    assert.equal((await db.query("select body from site_blog_posts")).rows[0].body, "original");

    const invalid = structuredClone(exported);
    invalid.tables.site_blog_posts[0].body = "must roll back";
    invalid.tables.spotify_featured_tracks[0].body = "INVALID";
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(invalid)]), /check constraint/);
    assert.equal((await db.query("select body from site_blog_posts")).rows[0].body, "original");
    const extra = structuredClone(exported);
    extra.tables.messages = [];
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(extra)]), /exactly the supported/);
    const missingColumn = structuredClone(exported);
    delete missingColumn.tables.site_blog_posts[0].body;
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(missingColumn)]), /schema does not match/);
    const missingPrimary = structuredClone(exported);
    missingPrimary.tables.site_now = [];
    await assert.rejects(db.query("select public.restore_site_content($1::jsonb)", [JSON.stringify(missingPrimary)]), /Invalid singleton/);
  } finally {
    await db.close();
  }
});
