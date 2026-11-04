import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";

const source = await readFile(new URL("../shared/scripts/blog-views.js", import.meta.url), "utf8");
const token = "12345678-1234-4123-8123-123456789abc";

test("blog RPC deduplicates daily receipts, counts atomically, and restricts access", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    for (const migration of ["20261016215500_create_blog_posts.sql", "20261104160000_create_blog_views.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
    }
    await db.exec(`
      insert into site_blog_posts (slug, title, excerpt, body_markdown, published, published_at)
      values ('live-post', 'Live', 'Excerpt', 'Body', true, now() - interval '1 day'),
        ('other-post', 'Other', 'Excerpt', 'Body', true, now() - interval '1 day'),
        ('draft-post', 'Draft', 'Excerpt', 'Body', false, null),
        ('future-post', 'Future', 'Excerpt', 'Body', true, now() + interval '1 day');
      set role anon;
    `);
    const views = async (slug, value = null) =>
      (await db.query("select get_blog_post_views($1, $2::uuid) as views", [slug, value])).rows[0].views;
    assert.equal(await views("live-post"), 0);
    assert.equal(await views("live-post", token), 1);
    assert.equal(await views("live-post", token), 1);
    const repeated = await Promise.all(Array.from({ length: 10 }, () => views("live-post", token)));
    assert.ok(repeated.every(value => value === 1));
    assert.equal(await views("live-post", "12345678-1234-4123-8123-123456789abd"), 2);
    assert.equal(await views("other-post", token), 1);
    for (const slug of ["draft-post", "future-post", "missing-post", "'; delete from site_blog_posts; --"]) {
      assert.equal(await views(slug, token), null);
    }
    await assert.rejects(views("live-post", "not-a-uuid"), /uuid/);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role}`);
      for (const table of ["site_blog_view_counts", "site_blog_view_receipts"]) {
        await assert.rejects(db.exec(`select * from ${table}`), /permission denied/);
        await assert.rejects(db.exec(`delete from ${table}`), /permission denied/);
      }
      await assert.rejects(db.exec("update site_blog_view_counts set views = 9000"), /permission denied/);
      await assert.rejects(db.exec("insert into site_blog_view_receipts values (gen_random_uuid(), current_date, gen_random_uuid())"), /permission denied/);
    }
    await db.exec("set role anon");
    await assert.rejects(db.exec("update site_blog_posts set title = 'Changed'"), /permission denied/);
    await db.exec("reset role; update site_blog_view_receipts set day = day - 1; set role anon");
    assert.equal(await views("live-post", token), 3);
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as count from site_blog_view_receipts")).rows[0].count, 1);
    await db.exec("update site_blog_posts set slug = 'renamed-post' where slug = 'live-post'; set role anon");
    assert.equal(await views("renamed-post"), 3);
    await db.exec("reset role; update site_blog_posts set published = false where slug = 'renamed-post'; set role anon");
    assert.equal(await views("renamed-post", token), null);
    await db.exec("reset role; delete from site_blog_posts");
    assert.equal((await db.query("select count(*)::int as count from site_blog_view_counts")).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from site_blog_view_receipts")).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

function browser({ storage = new Map(), privacy = {}, hidden = false, fail = false, result = 1, blockedStorage = false, staticSlug = null } = {}) {
  const requests = [];
  const errors = [];
  const listeners = new Map();
  const element = {};
  const document = {
    hidden,
    querySelector: selector => selector === "[data-blog-slug]"
      ? (staticSlug ? { dataset: { blogSlug: staticSlug } } : null) : element,
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: event => listeners.delete(event),
  };
  let generated = 0;
  const context = vm.createContext({
    window: { SUPABASE_CONFIG: { url: "https://example.supabase.co/", anonKey: "sb_publishable_test" } },
    document,
    navigator: { ...privacy, locks: { request: async (_name, callback) => callback() } },
    localStorage: {
      getItem: key => { if (blockedStorage) throw new Error("Storage blocked"); return storage.get(key); },
      setItem: (key, value) => storage.set(key, value),
    },
    crypto: { randomUUID: () => { generated++; return token; } },
    AbortSignal,
    console: { error: (...args) => errors.push(args) },
    fetch: async (url, options) => {
      requests.push({ url, ...options, body: JSON.parse(options.body) });
      return { ok: !fail, status: fail ? 503 : 200, json: async () => result };
    },
  });
  vm.runInContext(source, context);
  return { context, document, element, requests, errors, listeners, storage, generated: () => generated,
    show: slug => context.window.BITS_BLOG_VIEWS.show(slug, element) };
}

test("reader reuses daily per-post token across reloads and retries, never sends a chosen count/date", async () => {
  const first = browser();
  await first.show("live-post");
  await first.show("live-post");
  assert.equal(first.generated(), 1);
  assert.equal(first.element.textContent, "1 VIEW");
  assert.deepEqual(Object.keys(first.requests[0].body), ["p_slug", "p_token"]);
  assert.equal(first.requests[0].body.p_token, token);
  assert.equal(first.requests[0].headers.apikey, "sb_publishable_test");
  assert.equal(first.requests[0].headers.Authorization, undefined);
  const reload = browser({ storage: first.storage, result: 2 });
  await reload.show("live-post");
  assert.equal(reload.generated(), 0);
  assert.equal(reload.element.textContent, "2 VIEWS");
  await reload.show("other-post");
  assert.equal(reload.generated(), 1);
  const saved = JSON.parse(first.storage.get("bits-blog-view-live-post"));
  first.storage.set("bits-blog-view-live-post", JSON.stringify({ ...saved, day: "2000-01-01" }));
  await reload.show("live-post");
  assert.equal(reload.generated(), 2);
  const failed = browser({ storage: first.storage, fail: true });
  await failed.show("live-post");
  assert.equal(failed.element.textContent, "VIEWS UNAVAILABLE");
  assert.equal(failed.errors.length, 1);
  assert.equal(failed.requests[0].body.p_token, reload.requests[0].body.p_token);
});

test("privacy opt-outs and blocked storage read totals without recording; malformed responses are explicit", async () => {
  for (const options of [{ privacy: { globalPrivacyControl: true } }, { privacy: { doNotTrack: "1" } }, { blockedStorage: true }]) {
    const reader = browser(options);
    await reader.show("live-post");
    assert.equal(reader.requests[0].body.p_token, null);
    assert.equal(reader.storage.size, 0);
    assert.equal(reader.element.textContent, "1 VIEW");
  }
  for (const result of [null, -1, "123", 1.5, {}, Number.MAX_SAFE_INTEGER + 1]) {
    const reader = browser({ result });
    await reader.show("live-post");
    assert.equal(reader.element.textContent, "VIEWS UNAVAILABLE");
    assert.equal(reader.errors.length, 1);
  }
});

test("only visible article opens count; archives do not auto-track; static articles do", async () => {
  const reader = browser({ hidden: true });
  await reader.show("live-post");
  assert.equal(reader.requests.length, 0);
  reader.document.hidden = false;
  reader.listeners.get("visibilitychange")();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reader.requests.length, 1);
  assert.equal(reader.listeners.size, 0);
  const archive = browser();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(archive.requests.length, 0);
  const article = browser({ staticSlug: "live-post" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(article.requests.length, 1);
  assert.equal(article.requests[0].body.p_slug, "live-post");
  await archive.show("../invalid");
  assert.equal(archive.requests.length, 0);
});
