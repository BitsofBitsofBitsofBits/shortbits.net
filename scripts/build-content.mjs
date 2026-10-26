import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import publishing from "../shared/scripts/publishing-status.js";

export const normalizePosts = publishing.normalizePosts;

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const siteUrl = "https://www.shortbits.net";
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
export const articlePath = (slug) => `/blog/articles/${slug}/`;

// Run the browser's renderer unchanged against a text-only DOM adapter. No
// innerHTML, event handlers, or arbitrary attributes are accepted by this DOM.
export function markdownRenderer(source) {
  class Node {
    constructor(tag = "") {
      this.tag = tag;
      this.childNodes = [];
      this.attributes = {};
      this.dataset = {};
    }
    append(...nodes) {
      for (const node of nodes) {
        if (node instanceof Node && !node.tag && !("text" in node)) {
          this.childNodes.push(...node.childNodes);
        } else {
          this.childNodes.push(node instanceof Node ? node : textNode(node));
        }
      }
    }
    setAttribute(name, value) {
      if (!["role", "aria-label"].includes(name)) throw new Error(`Unsupported Markdown attribute: ${name}`);
      this.attributes[name] = value;
    }
    set textContent(value) { this.childNodes = [textNode(value)]; }
    get children() { return this.childNodes.filter((node) => Boolean(node.tag)); }
    get firstElementChild() { return this.children[0]; }
    get classList() { return { contains: (name) => (this.className || "").split(/\s+/).includes(name) }; }
    toString() {
      if ("text" in this) return escapeHtml(this.text);
      const content = this.childNodes.join("");
      if (!this.tag) return content;
      const attributes = { ...this.attributes };
      for (const key of ["href", "src", "alt", "loading", "decoding", "referrerPolicy", "target", "rel", "scope", "type", "tabIndex"]) {
        if (this[key] !== undefined) attributes[key.toLowerCase()] = this[key];
      }
      if (this.className) attributes.class = this.className;
      for (const [key, value] of Object.entries(this.dataset)) attributes[`data-${key}`] = value;
      for (const key of ["checked", "disabled"]) if (this[key]) attributes[key] = "";
      const opening = `<${this.tag}${Object.entries(attributes).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join("")}>`;
      return ["hr", "img", "input"].includes(this.tag) ? opening : `${opening}${content}</${this.tag}>`;
    }
  }
  function textNode(value) {
    const node = new Node();
    node.text = String(value);
    return node;
  }
  const window = { location: { origin: siteUrl } };
  vm.runInNewContext(source, {
    window, URL,
    document: {
      createElement: (tag) => new Node(tag),
      createTextNode: textNode,
      createDocumentFragment: () => new Node(),
    },
  }, { timeout: 1000, filename: "shared/scripts/markdown.js" });
  return {
    render: (markdown) => String(window.BITS_MARKDOWN.render(markdown)),
    readingTime: window.BITS_MARKDOWN.readingTime,
  };
}

export async function publicConfig(root, env = process.env) {
  const source = await readFile(join(root, "shared/scripts/supabase-config.js"), "utf8");
  const url = env.SUPABASE_URL || /url:\s*"([^"]+)"/.exec(source)?.[1];
  const anonKey = env.SUPABASE_ANON_KEY || /anonKey:\s*"([^"]+)"/.exec(source)?.[1];
  let role;
  try { role = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString()).role; } catch {}
  if (!anonKey || (!anonKey.startsWith("sb_publishable_") && role !== "anon")) {
    throw new Error("Content build requires a public Supabase publishable/anon key, never a service-role or secret key.");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("SUPABASE_URL must be an HTTPS project origin.");
  }
  return { url: parsed.origin, anonKey };
}

export async function fetchPosts(config, { fetchImpl = fetch, now = new Date() } = {}) {
  const posts = [];
  for (;;) {
    const query = new URLSearchParams({
      select: "slug,title,excerpt,body_markdown,published,published_at,updated_at",
      published: "eq.true", published_at: `lte.${now.toISOString()}`,
      order: "published_at.desc,slug.asc", limit: "500", offset: String(posts.length),
    });
    const response = await fetchImpl(`${config.url}/rest/v1/site_blog_posts?${query}`, {
      headers: { apikey: config.anonKey },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Content build: published-post fetch failed (HTTP ${response.status}).`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Content build: published-post response was not an array.");
    if (!page.length) break;
    posts.push(...page);
  }
  return normalizePosts(posts, now);
}

const dateLabel = (value) => new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const jsonScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export function renderArticle(post, renderer) {
  const url = siteUrl + articlePath(post.slug);
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt);
  const image = `${siteUrl}/shared/images/social-preview.png`;
  const schema = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: post.title, description: post.excerpt, url, mainEntityOfPage: url,
    datePublished: post.published_at,
    dateModified: Number.isFinite(Date.parse(post.updated_at)) ? post.updated_at : post.published_at,
    author: { "@type": "Person", name: "Caleb Masters", url: `${siteUrl}/professional/` },
    image,
  };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#020806">
    <title>${title} // BitsofBitsofBits</title>
    <meta name="description" content="${excerpt}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="BitsofBitsofBits">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${excerpt}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${image}">
    <meta property="article:published_time" content="${escapeHtml(post.published_at)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${excerpt}">
    <meta name="twitter:image" content="${image}">
    <link rel="alternate" type="application/rss+xml" title="BLOG.LOG RSS" href="/blog/feed.xml">
    <link rel="icon" type="image/png" href="/shared/images/favicon.png">
    <script src="/shared/scripts/seasonal-calendar.js?v=calendar-1"></script>
    <script src="/shared/scripts/theme-init.js?v=theme-27"></script>
    <link rel="stylesheet" href="/shared/styles/styles.css?v=upgrade-132">
    <script type="application/ld+json">${jsonScript(schema)}</script>
    <script src="/shared/scripts/site-config.js?v=site-config-3" defer></script>
    <script src="/shared/scripts/cf-analytics.js?v=cf-analytics-2" defer></script>
  </head>
  <body class="blog-page blog-post-page">
    <a class="skip-link" href="#blog-post">Skip to article</a>
    <main class="blog-shell">
      <nav class="blog-breadcrumbs" aria-label="Breadcrumb"><a href="/online/">HOME</a><span aria-hidden="true">/</span><a href="/blog/">BLOG.LOG</a></nav>
      <article id="blog-post" class="blog-article">
        <header>
          <p class="system-kicker">BLOG_ENTRY</p>
          <h1>${title}</h1>
          <p class="blog-article-excerpt">${excerpt}</p>
          <p class="blog-article-meta"><time datetime="${escapeHtml(post.published_at)}">${dateLabel(post.published_at)}</time><span aria-hidden="true">//</span><span>${renderer.readingTime(post.body_markdown)} MIN READ</span></p>
        </header>
        <div class="blog-markdown">${renderer.render(post.body_markdown)}</div>
      </article>
      <footer><p><a href="/blog/">All posts</a> &middot; <a href="/blog/feed.xml">Subscribe via RSS</a> &middot; <a href="/professional/">Professional profile</a></p></footer>
    </main>
  </body>
</html>
`;
}

export function renderFeed(posts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BitsofBitsofBits // BLOG.LOG</title>
    <link>${siteUrl}/blog/</link>
    <description>Dispatches and project notes from BitsofBitsofBits.</description>
    <language>en</language>
    <atom:link href="${siteUrl}/blog/feed.xml" rel="self" type="application/rss+xml"/>
${posts.map((post) => `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${siteUrl}${articlePath(post.slug)}</link>
      <guid isPermaLink="true">${siteUrl}${articlePath(post.slug)}</guid>
      <description>${escapeHtml(post.excerpt)}</description>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
    </item>`).join("\n")}
  </channel>
</rss>
`;
}

export function renderArchive(posts) {
  const cards = posts.map((post) => `<article><h3><a href="${articlePath(post.slug)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.excerpt)}</p><p class="blog-post-card-meta"><time datetime="${escapeHtml(post.published_at)}">${dateLabel(post.published_at)}</time></p></article>`).join("\n");
  return `<!-- GENERATED_POSTS_START -->
        <p id="blog-status" class="blog-status" role="status" aria-live="polite">${posts.length ? "Published posts from the latest deployment." : "No posts were published at the latest deployment."}</p>
        <div id="blog-post-list" class="blog-post-list" data-static-slugs="${escapeHtml(JSON.stringify(posts.map((post) => post.slug)))}">${cards}</div>
        <!-- GENERATED_POSTS_END -->`;
}

export function renderSitemap(source, posts) {
  const clean = source.replace(/\r\n?/g, "\n").replace(/\s*<!-- GENERATED_ARTICLES_START -->[\s\S]*?<!-- GENERATED_ARTICLES_END -->/g, "");
  const entries = posts.map((post) => `  <url><loc>${siteUrl}${articlePath(post.slug)}</loc><lastmod>${new Date(Number.isFinite(Date.parse(post.updated_at)) ? post.updated_at : post.published_at).toISOString()}</lastmod></url>`).join("\n");
  return clean.replace(/\s*<\/urlset>/, `\n  <!-- GENERATED_ARTICLES_START -->\n${entries}\n  <!-- GENERATED_ARTICLES_END -->\n</urlset>`);
}

export async function buildContent({ root = defaultRoot, input, env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  // Fetch and render everything before touching the previously built content.
  const posts = input
    ? normalizePosts(JSON.parse(await readFile(resolve(input), "utf8")), now)
    : await fetchPosts(await publicConfig(root, env), { fetchImpl, now });
  const renderer = markdownRenderer(await readFile(join(root, "shared/scripts/markdown.js"), "utf8"));
  const articles = posts.map((post) => [post.slug, renderArticle(post, renderer)]);
  const manifest = await publishing.snapshot(posts, now);
  const archiveFile = join(root, "blog", "index.html");
  const archive = await readFile(archiveFile, "utf8");
  if (!archive.includes("<!-- GENERATED_POSTS_START -->") || !archive.includes("<!-- GENERATED_POSTS_END -->")) {
    throw new Error("Content build: archive generation markers are missing.");
  }
  const updatedArchive = archive.replace(/<!-- GENERATED_POSTS_START -->[\s\S]*?<!-- GENERATED_POSTS_END -->/, renderArchive(posts))
    .replace(/(<span id="blog-post-count">)[^<]*(<\/span>)/, `$1${posts.length} POST${posts.length === 1 ? "" : "S"}$2`);
  const sitemapFile = join(root, "sitemap.xml");
  const sitemap = renderSitemap(await readFile(sitemapFile, "utf8"), posts);
  const articlesDir = join(root, "blog", "articles");
  // This directory is exclusively generated, so redeploys remove unpublished,
  // deleted, and renamed posts rather than leaving old public HTML behind.
  await rm(articlesDir, { recursive: true, force: true });
  for (const [slug, html] of articles) {
    await mkdir(join(articlesDir, slug), { recursive: true });
    await writeFile(join(articlesDir, slug, "index.html"), html);
  }
  await writeFile(archiveFile, updatedArchive);
  await writeFile(join(root, "blog", "feed.xml"), renderFeed(posts));
  await writeFile(join(root, "blog", "content-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(sitemapFile, sitemap);
  console.log(`Built ${posts.length} static blog article(s), archive, RSS feed, and sitemap.`);
  return posts.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = {};
    for (let index = 2; index < process.argv.length; index += 2) {
      const flag = process.argv[index];
      const value = process.argv[index + 1];
      if (!["--output", "--input"].includes(flag) || !value || value.startsWith("--")) {
        throw new Error("Usage: node scripts/build-content.mjs [--output staging-root] [--input fixture.json]");
      }
      options[flag === "--output" ? "root" : "input"] = resolve(value);
    }
    await buildContent(options);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
