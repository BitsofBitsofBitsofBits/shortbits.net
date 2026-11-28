import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import publishing from "../shared/scripts/publishing-status.js";
import blogData from "../shared/scripts/blog-data.js";
import blogToc from "../shared/scripts/blog-toc.js";
import taxonomy from "../shared/scripts/blog-taxonomy.js";

export const normalizePosts = publishing.normalizePosts;

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const siteUrl = "https://www.shortbits.net";
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
export const articlePath = (slug) => `/blog/articles/${slug}/`;

// Run the browser's renderer unchanged against a text-only DOM adapter. No
// innerHTML, event handlers, or arbitrary attributes are accepted by this DOM.
export function markdownRenderer(source, richSource) {
  class Node {
    constructor(tag = "") {
      this.tag = tag;
      this.childNodes = [];
      this.attributes = {};
      this.dataset = {};
      this.style = {};
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
      if (!["role", "aria-label", "start", "colspan", "rowspan", "align"].includes(name)) throw new Error(`Unsupported Markdown attribute: ${name}`);
      this.attributes[name] = value;
    }
    set textContent(value) { this.childNodes = [textNode(value)]; }
    get textContent() { return "text" in this ? this.text : this.childNodes.map(node => node.textContent).join(""); }
    get tagName() { return this.tag.toUpperCase(); }
    get children() { return this.childNodes.filter((node) => Boolean(node.tag)); }
    get firstElementChild() { return this.children[0]; }
    get classList() { return { contains: (name) => (this.className || "").split(/\s+/).includes(name) }; }
    toString() {
      if ("text" in this) return escapeHtml(this.text);
      const content = this.childNodes.join("");
      if (!this.tag) return content;
      const attributes = { ...this.attributes };
      for (const key of ["id", "href", "src", "alt", "loading", "decoding", "referrerPolicy", "target", "rel", "title", "scope", "type", "tabIndex"]) {
        if (this[key] !== undefined) attributes[key.toLowerCase()] = this[key];
      }
      if (this.className) attributes.class = this.className;
      const styles = [];
      if (this.style.color !== undefined) {
        const color = window.BITS_MARKDOWN.hexColor(this.style.color);
        if (!color) throw new Error("Unsupported Markdown color.");
        styles.push(`color:${color}`);
      }
      if (this.style.fontFamily !== undefined) {
        const font = window.BITS_MARKDOWN.customFontFamily(this.style.fontFamily);
        if (!font) throw new Error("Unsupported Markdown font.");
        styles.push(`font-family:${font}`);
      }
      if (styles.length) attributes.style = styles.join(";");
      for (const [key, value] of Object.entries(this.dataset)) attributes[`data-${key}`] = value;
      for (const key of ["checked", "disabled"]) if (this[key]) attributes[key] = "";
      const opening = `<${this.tag}${Object.entries(attributes).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join("")}>`;
      return ["br", "hr", "img", "input"].includes(this.tag) ? opening : `${opening}${content}</${this.tag}>`;
    }
  }
  function textNode(value) {
    const node = new Node();
    node.text = String(value);
    return node;
  }
  const window = { location: { origin: siteUrl } };
  const document = {
    createElement: (tag) => new Node(tag),
    createTextNode: textNode,
    createDocumentFragment: () => new Node(),
  };
  const context = vm.createContext({
    window, URL,
    document,
  });
  vm.runInContext(source, context, { timeout: 1000, filename: "shared/scripts/markdown.js" });
  if (richSource) vm.runInContext(richSource, context, { timeout: 1000, filename: "shared/scripts/blog-content.js" });
  const renderPost = post => post.body_rich ? window.BITS_BLOG_CONTENT.render(post.body_rich, { readableColors: true })
    : window.BITS_MARKDOWN.render(post.body_markdown, { readableColors: true });
  return {
    render: (markdown) => String(window.BITS_MARKDOWN.render(markdown)),
    readingTime: window.BITS_MARKDOWN.readingTime,
    renderPost: post => String(renderPost(post)),
    renderArticleContent: post => {
      const body = renderPost(post);
      const toc = blogToc.render(body, document);
      return { body: String(body), toc: toc ? String(toc) : "" };
    },
    postReadingTime: post => post.body_rich ? window.BITS_BLOG_CONTENT.readingTime(post) : window.BITS_MARKDOWN.readingTime(post.body_markdown),
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
  const cutoff = now.toISOString();
  for (;;) {
    const query = blogData.build(cutoff, posts.length);
    const response = await fetchImpl(`${config.url}/rest/v1/${query}`, {
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

function renderLabels(post, groups) {
  return taxonomy.metadataLinks(post, groups).map(link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.name)}</a>`).join("\n");
}
function renderSeries(post, posts) {
  const metadata = taxonomy.read(post);
  if (!metadata.series) return "";
  const members = taxonomy.ordered(posts, metadata.series.slug);
  const index = members.findIndex(member => member.slug === post.slug);
  const links = [["Previous", members[index - 1], "prev"], ["Next", members[index + 1], "next"]]
    .filter(([, member]) => member).map(([label, member, rel]) => `<a rel="${rel}" href="${articlePath(member.slug)}">${label}: ${escapeHtml(member.title)}</a>`);
  return `<a href="${taxonomy.path("series", metadata.series.slug)}">${escapeHtml(metadata.series.name)}</a><p>Part ${index + 1} of ${members.length}</p>${links.join("\n")}`;
}
export function renderArticle(post, renderer, posts = [post]) {
  const content = renderer.renderArticleContent(post);
  const url = siteUrl + articlePath(post.slug);
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt);
  const image = `${siteUrl}/shared/images/social-preview.png`;
  const groups = taxonomy.groups(posts);
  const metadata = taxonomy.read(post);
  const schema = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title, description: post.excerpt, url, mainEntityOfPage: { "@id": `${url}#webpage` },
    datePublished: post.published_at,
    dateModified: Number.isFinite(Date.parse(post.updated_at)) ? post.updated_at : post.published_at,
    author: { "@type": "Person", "@id": `${siteUrl}/#person`, name: "Caleb K Masters", url: `${siteUrl}/professional/` },
    image, keywords: metadata.tags.map(tag => tag.name),
    ...(metadata.series ? { isPartOf: { "@type": "CreativeWorkSeries", name: metadata.series.name, url: siteUrl + taxonomy.path("series", metadata.series.slug) } } : {}),
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
    <script src="/shared/scripts/accessibility.js?v=accessibility-1"></script>
    <script src="/shared/scripts/theme-init.js?v=theme-27"></script>
    <script src="/blog/scripts/reading-width.js"></script>
    <link rel="stylesheet" href="/shared/styles/styles.css?v=upgrade-132">
    <link rel="stylesheet" href="/blog/styles/theme-settings.css">
    <link rel="stylesheet" href="/blog/styles/article-toc.css">
    <link rel="stylesheet" href="/blog/styles/blog-layout.css">
    <script src="/shared/scripts/theme-picker.js?v=picker-1" defer></script>
    <script src="/blog/scripts/theme-settings.js" defer></script>
    <link rel="stylesheet" href="/shared/styles/accessibility.css?v=accessibility-1">
    <link rel="stylesheet" href="/shared/styles/public-nav.css?v=public-nav-1">
    <script type="application/ld+json" data-blog-schema>${jsonScript(schema)}</script>
    <script src="/shared/scripts/site-config.js?v=site-config-3" defer></script>
    <script src="/shared/scripts/markdown.js?v=markdown-2" defer></script>
    <script src="/shared/scripts/blog-content.js" defer></script>
    <script src="/shared/scripts/blog-toc.js" defer></script>
    <script src="/shared/scripts/supabase-config.js" defer></script>
    <script src="/shared/scripts/blog-taxonomy.js" defer></script>
    <script src="/shared/scripts/blog-data.js?v=blog-data-1" defer></script>
    <script src="/shared/scripts/blog-views.js?v=blog-views-1" defer></script>
    <script src="/blog/scripts/post.js?v=blog-3" defer></script>
    <script src="/shared/scripts/cf-analytics.js?v=cf-analytics-2" defer></script>
  </head>
  <body class="blog-page blog-post-page">
    <a class="skip-link" href="#blog-post">Skip to article</a>
    <main class="blog-shell">
      <nav class="public-nav" aria-label="Public sections">
        <a href="/professional/">Professional profile</a>
        <a href="/online/">Online</a>
        <a href="/projects/">Projects</a>
        <a href="/blog/" aria-current="location">Blog</a>
        <a href="/?choose">Choose profile</a>
        <a href="/privacy/">Privacy</a>
      </nav>
      <nav class="blog-breadcrumbs" aria-label="Breadcrumb"><a href="/?choose">PROFILES</a><span aria-hidden="true">/</span><a href="/blog/">BLOG.LOG</a></nav>
      <p id="blog-post-status" class="blog-status" role="status" aria-live="polite" hidden></p>
      <article id="blog-post" class="blog-article" data-blog-slug="${escapeHtml(post.slug)}" data-static-slugs="${escapeHtml(JSON.stringify(posts.map(post => post.slug)))}" data-static-taxonomies="${escapeHtml(JSON.stringify(groups))}">
        <header>
          <p class="system-kicker">BLOG_ENTRY</p>
          <h1 id="blog-post-title">${title}</h1>
          <p id="blog-post-excerpt" class="blog-article-excerpt">${excerpt}</p>
          <p class="blog-article-meta"><time id="blog-post-date" datetime="${escapeHtml(post.published_at)}">${dateLabel(post.published_at)}</time><span aria-hidden="true">//</span><span id="blog-post-reading-time">${renderer.postReadingTime ? renderer.postReadingTime(post) : renderer.readingTime(post.body_markdown)} MIN READ</span><span id="blog-post-views" role="status"></span></p>
          <div id="blog-post-taxonomy" class="blog-post-taxonomy">${renderLabels(post, groups)}</div>
        </header>
        <div id="blog-post-toc">${content.toc}</div>
        <div id="blog-post-body" class="blog-markdown">${content.body}</div>
        <nav id="blog-series-navigation" class="blog-series-navigation" aria-label="Series navigation" data-series="${escapeHtml(metadata.series?.slug || "")}">${renderSeries(post, posts)}</nav>
      </article>
      <footer class="blog-footer"><p><a href="/blog/">All posts</a> &middot; <a href="/blog/feed.xml">Subscribe via RSS</a> &middot; <a href="/professional/">Professional profile</a></p></footer>
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
    <description>Personal thoughts, project ideas, and whatever else is on my mind. A blog by Caleb K Masters (BitsofBitsofBits).</description>
    <language>en</language>
    <atom:link href="${siteUrl}/blog/feed.xml" rel="self" type="application/rss+xml"/>
${posts.map((post) => `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${siteUrl}${articlePath(post.slug)}</link>
      <guid isPermaLink="true">${siteUrl}${articlePath(post.slug)}</guid>
      <description>${escapeHtml(post.excerpt)}</description>
${taxonomy.read(post).tags.map(tag => `      <category>${escapeHtml(tag.name)}</category>`).join("\n")}
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
    </item>`).join("\n")}
  </channel>
</rss>
`;
}

export function renderArchive(posts, allPosts = posts) {
  const groups = taxonomy.groups(allPosts);
  const cards = posts.map((post) => {
    const metadata = taxonomy.read(post);
    return `<article data-tags="${escapeHtml(JSON.stringify(metadata.tags.map(tag => tag.slug)))}" data-series="${escapeHtml(metadata.series?.slug || "")}"><h3><a href="${articlePath(post.slug)}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.excerpt)}</p><p class="blog-post-card-meta"><time datetime="${escapeHtml(post.published_at)}">${dateLabel(post.published_at)}</time></p><div class="blog-post-taxonomy">${renderLabels(post, groups)}</div></article>`;
  }).join("\n");
  return `<!-- GENERATED_POSTS_START -->
        <p id="blog-status" class="blog-status" role="status" aria-live="polite">${posts.length ? "Published posts from the latest deployment." : "No posts were published at the latest deployment."}</p>
        <div id="blog-post-list" class="blog-post-list" data-static-slugs="${escapeHtml(JSON.stringify(allPosts.map((post) => post.slug)))}">${cards}</div>
        <!-- GENERATED_POSTS_END -->`;
}

export function renderSitemap(source, posts) {
  const clean = source.replace(/\r\n?/g, "\n").replace(/\s*<!-- GENERATED_ARTICLES_START -->[\s\S]*?<!-- GENERATED_ARTICLES_END -->/g, "");
  const groups = taxonomy.groups(posts);
  const entries = [...posts.map((post) => `  <url><loc>${siteUrl}${articlePath(post.slug)}</loc><lastmod>${new Date(Number.isFinite(Date.parse(post.updated_at)) ? post.updated_at : post.published_at).toISOString()}</lastmod></url>`),
    ...["tags", "series"].flatMap(kind => [`  <url><loc>${siteUrl}/blog/${kind}/</loc></url>`,
      ...groups[kind].map(item => `  <url><loc>${siteUrl}${taxonomy.path(kind, item.slug)}</loc></url>`)])].join("\n");
  return clean.replace(/\s*<\/urlset>/, `\n  <!-- GENERATED_ARTICLES_START -->\n${entries}\n  <!-- GENERATED_ARTICLES_END -->\n</urlset>`);
}

export async function buildContent({ root = defaultRoot, input, env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  // Fetch and render everything before touching the previously built content.
  const posts = input
    ? normalizePosts(JSON.parse(await readFile(resolve(input), "utf8")), now)
    : await fetchPosts(await publicConfig(root, env), { fetchImpl, now });
  const renderer = markdownRenderer(await readFile(join(root, "shared/scripts/markdown.js"), "utf8"), await readFile(join(root, "shared/scripts/blog-content.js"), "utf8"));
  posts.forEach(post => taxonomy.read(post));
  const groups = taxonomy.groups(posts);
  const articles = posts.map((post) => [post.slug, renderArticle(post, renderer, posts)]);
  const manifest = await publishing.snapshot(posts, now);
  const archiveFile = join(root, "blog", "index.html");
  const archive = await readFile(archiveFile, "utf8");
  if (!archive.includes("<!-- GENERATED_POSTS_START -->") || !archive.includes("<!-- GENERATED_POSTS_END -->")) {
    throw new Error("Content build: archive generation markers are missing.");
  }
  if (!archive.includes("<!-- GENERATED_TAXONOMY_START -->") || !archive.includes("<!-- GENERATED_TAXONOMY_END -->")) throw new Error("Content build: taxonomy generation markers are missing.");
  const navigation = ["tags", "series"].map(kind => groups[kind].length
    ? `<section><h2>Browse ${kind}</h2>${groups[kind].map(item => `<a href="${taxonomy.path(kind, item.slug)}">${escapeHtml(item.name)}</a>`).join("\n")}</section>` : "").join("\n");
  const updatedArchive = archive.replace(/<!-- GENERATED_POSTS_START -->[\s\S]*?<!-- GENERATED_POSTS_END -->/, renderArchive(posts))
    .replace(/<!-- GENERATED_TAXONOMY_START -->[\s\S]*?<!-- GENERATED_TAXONOMY_END -->/,
      `<!-- GENERATED_TAXONOMY_START --><nav id="blog-taxonomy-browse" class="blog-taxonomy-browse" aria-label="Browse blog tags and series" data-static-taxonomies="${escapeHtml(JSON.stringify(groups))}">${navigation}</nav><!-- GENERATED_TAXONOMY_END -->`)
    .replace(/(<span id="blog-post-count">)[^<]*(<\/span>)/, `$1${posts.length} POST${posts.length === 1 ? "" : "S"}$2`);
  const sitemapFile = join(root, "sitemap.xml");
  const sitemap = renderSitemap(await readFile(sitemapFile, "utf8"), posts);
  const articlesDir = join(root, "blog", "articles");
  const taxonomyPages = ["tags", "series"].flatMap(kind => [null, ...groups[kind]].map(item => {
    const selected = !item ? posts : kind === "tags" ? posts.filter(post => taxonomy.read(post).tags.some(tag => tag.slug === item.slug))
      : taxonomy.ordered(posts, item.slug);
    const title = item ? `${kind === "tags" ? "Tag" : "Series"}: ${item.name}` : `Blog ${kind}`;
    const path = item ? taxonomy.path(kind, item.slug) : `/blog/${kind}/`;
    const description = item ? `Published articles ${kind === "tags" ? "tagged" : "in the series"} ${item.name}.` : `Browse ${kind} used by published blog articles.`;
    const page = updatedArchive
      .replace(/<!-- GENERATED_POSTS_START -->[\s\S]*?<!-- GENERATED_POSTS_END -->/, renderArchive(selected, posts))
      .replace(/(<span id="blog-post-count">)[^<]*(<\/span>)/, `$1${selected.length} POST${selected.length === 1 ? "" : "S"}$2`)
      .replace(/<h1>BLOG.LOG<\/h1>/, () => `<h1>${escapeHtml(title)}</h1>`)
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)} // BitsofBitsofBits</title>`)
      .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")/g, (_, open, close) => `${open}${escapeHtml(description)}${close}`)
      .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*(")/g, (_, open, close) => `${open}${escapeHtml(title)}${close}`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${siteUrl}${path}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${siteUrl}${path}$2`);
    return [kind, item?.slug || "", page];
  }));
  // This directory is exclusively generated, so redeploys remove unpublished,
  // deleted, and renamed posts rather than leaving old public HTML behind.
  await rm(articlesDir, { recursive: true, force: true });
  for (const kind of ["tags", "series"]) await rm(join(root, "blog", kind), { recursive: true, force: true });
  for (const [slug, html] of articles) {
    await mkdir(join(articlesDir, slug), { recursive: true });
    await writeFile(join(articlesDir, slug, "index.html"), html);
  }
  await writeFile(archiveFile, updatedArchive);
  for (const [kind, slug, html] of taxonomyPages) {
    const directory = join(root, "blog", kind, slug);
    await mkdir(directory, { recursive: true }); await writeFile(join(directory, "index.html"), html);
  }
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
