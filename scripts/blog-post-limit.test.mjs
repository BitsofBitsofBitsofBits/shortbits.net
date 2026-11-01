import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("blog editor and database accept 200,000 characters and reject larger or empty bodies", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    await db.exec(await readFile(new URL("../supabase/migrations/20261016215500_create_blog_posts.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261101120000_increase_blog_post_limit.sql", import.meta.url), "utf8"));
    const insert = body => db.query(
      "insert into public.site_blog_posts (slug, title, excerpt, body_markdown) values (gen_random_uuid()::text, 'Title', 'Excerpt', $1)",
      [body],
    );
    await insert("x".repeat(50001));
    await insert("x".repeat(200000));
    await assert.rejects(insert("x".repeat(200001)), /site_blog_posts_body_markdown_check/);
    await assert.rejects(insert(""), /site_blog_posts_body_markdown_check/);
    const html = await readFile(new URL("../admin/index.html", import.meta.url), "utf8");
    assert.match(html, /id="blog-post-markdown"[^>]*maxlength="200000"/);
  } finally {
    await db.close();
  }
});
