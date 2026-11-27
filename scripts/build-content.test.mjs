import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rm, cp, access } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildContent, fetchPosts, normalizePosts, markdownRenderer, publicConfig,
  renderArticle, renderArchive, renderFeed, renderSitemap,
} from "./build-content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = join(root, "scripts", "fixtures", "blog-posts.json");
const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
const now = new Date("2026-10-22T12:00:00Z");
const posts = normalizePosts(fixtures, now);
const renderer = markdownRenderer(await readFile(join(root, "shared/scripts/markdown.js"), "utf8"), await readFile(join(root, "shared/scripts/blog-content.js"), "utf8"));

test("publication rules exclude drafts and future posts and reject malformed data", () => {
  assert.deepEqual(posts.map((post) => post.slug), ["safe-markdown", "first-lab-notes"]);
  for (const patch of [{ slug: "../../escape" }, { title: "" }, { published_at: "bad" }, { published: null }]) {
    assert.throws(() => normalizePosts([{ ...fixtures[0], ...patch }], now));
  }
  assert.throws(() => normalizePosts([fixtures[0], fixtures[0]], now), /duplicate/);
  assert.throws(() => normalizePosts({ error: "failed" }, now), /array/);
});

test("reuses browser Markdown blocks and safely escapes HTML and attributes", () => {
  const html = renderer.render(fixtures[0].body_markdown);
  for (const element of ["<h2>", "<strong>", "<em>", "<code>", "<table>", "<thead>", 'type="checkbox"', 'class="blog-text-color-cyan"']) {
    assert.ok(html.includes(element), element);
  }
  assert.match(html, /checked=""/);
  assert.match(html, /disabled=""/);
  const unsafe = renderer.render(fixtures[1].body_markdown);
  assert.doesNotMatch(unsafe, /<script>|href="javascript:|src="data:/);
  assert.match(unsafe, /&lt;script&gt;/);
  assert.match(unsafe, /href="https:\/\/example.com\/\?x=1&amp;y=2"/);
  assert.match(unsafe, /alt="A &quot;caption&quot;"/);
  assert.match(unsafe, /<figure/);
  assert.match(unsafe, /<figcaption>An image<\/figcaption>/);
});

test("article has server-readable content, canonical social metadata and safe JSON-LD", () => {
  const html = renderArticle(posts[0], renderer);
  assert.match(html, /<h1 id="blog-post-title">Escaping &lt;markup&gt; &amp; &quot;quotes&quot;<\/h1>/);
  assert.match(html, /rel="canonical" href="https:\/\/www.shortbits.net\/blog\/articles\/safe-markdown\/"/);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /name="twitter:card"/);
  const schema = JSON.parse(/<script type="application\/ld\+json" data-blog-schema>([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(schema["@type"], "BlogPosting");
  assert.equal(schema.headline, posts[0].title);
  assert.equal(schema.description, posts[0].excerpt);
  assert.equal(schema.dateModified, posts[0].updated_at);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /<div id="blog-post-body" class="blog-markdown">/);
  assert.match(html, /\/blog\/scripts\/post\.js/);
  assert.match(html, /<article id="blog-post" class="blog-article" data-blog-slug="safe-markdown" data-static-slugs=/);
  assert.match(html, /data-blog-slug="safe-markdown"/);
  assert.match(html, /shared\/scripts\/supabase-config\.js/);
  assert.match(html, /shared\/scripts\/blog-views\.js/);
  assert.match(html, /id="blog-post-views" role="status"/);
  assert.match(html, /\/blog\/scripts\/theme-settings\.js/);
  assert.match(html, /\/shared\/scripts\/theme-picker\.js/);
  assert.match(html, /\/blog\/styles\/theme-settings\.css/);
  assert.doesNotMatch(html, /\/online\/scripts\//);
});
test("generated rich articles render the primary structured body instead of retained original Markdown", () => {
  const body_rich = { version: 1, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Visual version", marks: [{ type: "highlight" }] }] }] } };
  const html = renderArticle({ ...posts[0], body_markdown: "Retained source not current body", body_rich }, renderer);
  assert.match(html, /<mark>Visual version<\/mark>/);
  assert.doesNotMatch(html, /Retained source not current body/);
  assert.match(html, /shared\/scripts\/blog-content\.js/);
});

test("static blog articles retain validated hex colors and nested formatting", () => {
  for (const color of ["#abc", "#abcd", "#a1b2c3", "#a1b2c380"]) {
    const html = renderArticle({ ...posts[0], body_markdown: `{{color:${color}|**Colored**}}` }, renderer);
    assert.match(html, /class="blog-text-color-custom blog-color-readable"/);
    assert.ok(html.includes(`data-color="${color}"`), html);
    assert.doesNotMatch(html, /background-color:/);
    assert.match(html, /<strong>Colored<\/strong>/);
  }
  const invalid = "{{color:#abc;background:red|Literal}}";
  assert.ok(renderer.render(invalid).includes(invalid));
  assert.doesNotMatch(renderer.render(invalid), /style=/);
});

test("static articles serialize explicit breaks without accepting arbitrary HTML", () => {
  const html = renderer.render('First<br>Second<BR />Third<br onclick="alert(1)">literal\n\n```\n<br>\n```');
  assert.equal((html.match(/<br>/g) || []).length, 2);
  assert.doesNotMatch(html, /<\/br>|<br onclick/);
  assert.match(html, /&lt;br onclick=/);
  assert.match(html, /<code>&lt;br&gt;<\/code>/);
});

test("static articles retain imported validated font formatting", () => {
  const html = renderer.render('{{font:custom:"Arial", sans-serif|Copied font}}');
  assert.match(html, /style="font-family:&quot;Arial&quot;, sans-serif"/);
  assert.match(html, /Copied font/);
});

test("quote lines and blank quote lines retain breaks in static articles", () => {
  const html = renderer.render("> First **line**\n> Second\n>\n> Fourth\n\nOutside");
  assert.match(html, /<blockquote><p>First <strong>line<\/strong><br>Second<br><br>Fourth<\/p><\/blockquote>/);
  assert.match(html, /<p>Outside<\/p>/);
});

test("RSS, static archive and sitemap use only published static URLs", () => {
  const feed = renderFeed(posts);
  assert.match(feed, /<rss version="2.0"/);
  assert.equal((feed.match(/<item>/g) || []).length, 2);
  assert.match(feed, /&lt;\/script&gt;/);
  assert.doesNotMatch(feed, /private-draft|future-post|post.html\?slug/);
  const archive = renderArchive(posts);
  assert.match(archive, /href="\/blog\/articles\/safe-markdown\/"/);
  assert.match(archive, /data-static-slugs="\[&quot;safe-markdown&quot;/);
  const source = '<urlset><url><loc>https://www.shortbits.net/projects/</loc></url></urlset>';
  const sitemap = renderSitemap(source, posts);
  assert.match(sitemap, /\/projects\//);
  assert.match(sitemap, /\/blog\/articles\/first-lab-notes\//);
  assert.equal(renderSitemap(sitemap, posts), sitemap);
  assert.doesNotMatch(renderSitemap(sitemap, []), /\/blog\/articles\//);
});

test("public fetch paginates, pins publication cutoff, and fails explicitly", async () => {
  const calls = [];
  const pages = [fixtures.slice(0, 1), fixtures.slice(1, 2), []];
  const result = await fetchPosts({ url: "https://example.supabase.co", anonKey: "sb_publishable_example" }, {
    now,
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return { ok: true, json: async () => pages.shift() };
    },
  });
  assert.equal(result.length, 2);
  assert.deepEqual(calls.map(({ url }) => url.searchParams.get("offset")), ["0", "1", "2"]);
  for (const { url } of calls) {
    assert.equal(url.searchParams.get("published"), "eq.true");
    assert.equal(url.searchParams.get("published_at"), `lte.${now.toISOString()}`);
    assert.equal(url.searchParams.get("order"), "published_at.desc,slug.asc");
    assert.equal(url.searchParams.get("limit"), "500");
    assert.equal(url.searchParams.get("select"), "slug,title,excerpt,body_markdown,body_rich,published,published_at,updated_at,tags,series,series_order");
  }
  assert.equal(calls[0].options.headers.apikey, "sb_publishable_example");
  await assert.rejects(fetchPosts({}, { fetchImpl: async () => ({ ok: false, status: 503 }) }), /HTTP 503/);
  await assert.rejects(fetchPosts({}, { fetchImpl: async () => ({ ok: true, json: async () => ({ error: "bad" }) }) }), /array/);
});

test("build writes persistent outputs, removes stale articles, and never overwrites on fetch failure", async () => {
  const output = join(root, `.content-test-${process.pid}`);
  await mkdir(join(output, "blog", "articles", "removed-post"), { recursive: true });
  try {
    for (const file of ["shared/scripts/markdown.js", "shared/scripts/blog-content.js", "shared/scripts/supabase-config.js", "sitemap.xml", join("blog", "index.html")]) {
      await cp(join(root, file), join(output, file));
    }
    await writeFile(join(output, "blog", "articles", "removed-post", "index.html"), "old article");
    let networkCalls = 0;
    await buildContent({
      root: output, input: fixturePath, now,
      fetchImpl: async () => { networkCalls += 1; throw new Error("Network not permitted"); },
    });

    assert.equal(networkCalls, 0);
    const article = await readFile(join(output, "blog", "articles", "safe-markdown", "index.html"), "utf8");
    assert.match(article, /<h1 id="blog-post-title">/);
    await assert.rejects(access(join(output, "blog", "articles", "removed-post")));
    await assert.rejects(access(join(output, "blog", "articles", "private-draft")));
    const archive = await readFile(join(output, "blog", "index.html"), "utf8");
    const sitemap = await readFile(join(output, "sitemap.xml"), "utf8");
    const feed = await readFile(join(output, "blog", "feed.xml"), "utf8");
    const manifest = JSON.parse(await readFile(join(output, "blog", "content-manifest.json"), "utf8"));
    assert.equal(manifest.generatedAt, now.toISOString());
    assert.deepEqual(manifest.posts.map((post) => post.slug), ["first-lab-notes", "safe-markdown"]);
    assert.doesNotMatch(JSON.stringify(manifest), /private-draft|future-post|body_markdown/);
    await buildContent({ root: output, input: fixturePath, now });
    assert.equal(await readFile(join(output, "blog", "index.html"), "utf8"), archive);
    assert.equal(await readFile(join(output, "sitemap.xml"), "utf8"), sitemap);
    assert.equal(await readFile(join(output, "blog", "feed.xml"), "utf8"), feed);
    await assert.rejects(buildContent({
      root: output, env: {}, now,
      fetchImpl: async () => ({ ok: false, status: 401 }),
    }), /HTTP 401/);
    assert.equal(await readFile(join(output, "blog", "articles", "safe-markdown", "index.html"), "utf8"), article);
    assert.equal(await readFile(join(output, "blog", "index.html"), "utf8"), archive);
    for (const key of ["sb_secret_do_not_use", "not-a-key"]) {
      await assert.rejects(publicConfig(output, { SUPABASE_ANON_KEY: key }), /public Supabase/);
    }
    const serviceKey = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('{"role":"service_role"}').toString("base64url")}.signature`;
    await assert.rejects(publicConfig(output, { SUPABASE_ANON_KEY: serviceKey }), /public Supabase/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("generated taxonomy pages are escaped, ordered, public-only and removed when no longer used", async () => {
  const output = join(root, `.taxonomy-content-test-${process.pid}`);
  await mkdir(join(output, "blog"), { recursive: true });
  try {
    for (const file of ["shared/scripts/markdown.js", "shared/scripts/blog-content.js", "shared/scripts/supabase-config.js", "sitemap.xml", join("blog", "index.html")]) {
      await cp(join(root, file), join(output, file));
    }
    const series = { name: 'Colors $& <safe> "quoted"', slug: "colors" };
    const tag = { name: "Accessible $1 colors", slug: "accessible" };
    const input = join(output, "posts.json");
    const tagged = fixtures.map((post, index) => ({ ...post, tags: [tag], series, series_order: index === 0 ? 2 : 1 }));
    await writeFile(input, JSON.stringify(tagged));
    await buildContent({ root: output, input, now });
    const category = await readFile(join(output, "blog", "series", "colors", "index.html"), "utf8");
    assert.match(category, /<h1>Series: Colors \$&amp; &lt;safe&gt; &quot;quoted&quot;<\/h1>/);
    assert.match(category, /<title>Series: Colors \$&amp; &lt;safe&gt; &quot;quoted&quot; \/\/ BitsofBitsofBits<\/title>/);
    assert.ok(category.indexOf('href="/blog/articles/safe-markdown/"') < category.indexOf('href="/blog/articles/first-lab-notes/"'));
    assert.doesNotMatch(category, /private-draft|future-post/);
    const article = await readFile(join(output, "blog", "articles", "first-lab-notes", "index.html"), "utf8");
    assert.match(article, /Previous: Escaping/);
    assert.match(article, /Part 2 of 2/);
    const schema = JSON.parse(/data-blog-schema>([\s\S]*?)<\/script>/.exec(article)[1]);
    assert.deepEqual(schema.keywords, [tag.name]);
    assert.equal(schema.isPartOf.name, series.name);
    assert.match(await readFile(join(output, "blog", "feed.xml"), "utf8"), /<category>Accessible \$1 colors<\/category>/);
    const sitemap = await readFile(join(output, "sitemap.xml"), "utf8");
    assert.match(sitemap, /\/blog\/tags\/accessible\/<\/loc>/);
    assert.match(sitemap, /\/blog\/series\/colors\/<\/loc>/);
    await writeFile(input, JSON.stringify(fixtures));
    await buildContent({ root: output, input, now });
    await assert.rejects(access(join(output, "blog", "series", "colors")));
    await assert.rejects(access(join(output, "blog", "tags", "accessible")));
    await access(join(output, "blog", "series", "index.html"));
  } finally { await rm(output, { recursive: true, force: true }); }
});
