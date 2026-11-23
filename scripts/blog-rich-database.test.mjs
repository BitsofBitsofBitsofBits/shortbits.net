import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("rich migration preserves originals, rejects malformed envelopes and keeps draft RLS", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated");
    for (const name of ["20261016215500_create_blog_posts.sql", "20261101120000_increase_blog_post_limit.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    await db.exec("insert into site_blog_posts(slug,title,excerpt,body_markdown) values ('legacy-post','Legacy','Excerpt','Keep **original**')");
    await db.exec(await readFile(new URL("../supabase/migrations/20261123094500_blog_rich_content.sql", import.meta.url), "utf8"));
    assert.deepEqual((await db.query("select body_markdown,body_rich from site_blog_posts")).rows[0], { body_markdown: "Keep **original**", body_rich: null });
    for (const value of [{}, { version: "1", doc: { type: "doc", content: [] } }, { version: 1 }, { version: 1, doc: null }]) {
      await assert.rejects(db.query("update site_blog_posts set body_rich=$1::jsonb", [JSON.stringify(value)]), /check constraint/);
    }
    const rich = { version: 1, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New article" }] }] } };
    await db.query("update site_blog_posts set body_rich=$1::jsonb,body_markdown=''", [JSON.stringify(rich)]);
    await db.exec("set role anon");
    assert.equal((await db.query("select body_rich from site_blog_posts")).rows.length, 0);
    await assert.rejects(db.query("update site_blog_posts set title='No access'"), /permission denied/);
  } finally { await db.close(); }
});
