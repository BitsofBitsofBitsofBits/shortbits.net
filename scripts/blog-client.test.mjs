import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const archiveSource = await readFile(new URL("../blog/scripts/blog.js", import.meta.url), "utf8");
const postSource = await readFile(new URL("../blog/scripts/post.js", import.meta.url), "utf8");
const contractSource = await readFile(new URL("../shared/scripts/blog-data.js", import.meta.url), "utf8");
const taxonomySource = await readFile(new URL("../shared/scripts/blog-taxonomy.js", import.meta.url), "utf8");

class Element {
  constructor(tag = "") {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.listeners = {};
    this.value = "";
    this.hidden = false;
    this.text = "";
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent || "").join(" "); }
  append(...children) { children.forEach(child => { child.parent = this; }); this.children.push(...children); }
  replaceChildren(...children) { this.text = ""; this.children = []; this.append(...children); }
  addEventListener(event, listener) { this.listeners[event] = listener; }
  setAttribute(name, value) { this[name] = String(value); }
  removeAttribute(name) { delete this[name]; }
  querySelector(selector) { return selector === "[data-series-error]" ? this.children.find(child => child.dataset?.seriesError !== undefined) : null; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}

async function browserScript(source, { nodes, pages = [], slug = "existing-post", pathname = "/blog/", query, offline = false, adaptColors = () => {} } = {}) {
  const requests = [];
  const options = [];
  const listeners = {};
  const timers = [];
  const head = new Element("head");
  const context = vm.createContext({
    document: {
      querySelector: (selector) => nodes[selector] || head.children.find((element) =>
        (selector === 'link[rel="canonical"]' && element.rel === "canonical")
        || (selector === 'meta[name="robots"]' && element.name === "robots")),
      createElement: (tag) => new Element(tag),
      addEventListener: (event, listener) => { listeners[event] = listener; },
      head,
    },
    window: {
      SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "sb_publishable_example" },
      location: { pathname, search: query ?? `?slug=${slug}` },
      BITS_MARKDOWN: { readingTime: () => 1, render: (text) => ({ textContent: text }), applyReadableColors: adaptColors },
      BITS_BLOG_CONTENT: { readingTime: () => 1, renderPost: post => ({ textContent: post.body_markdown }) },
      BITS_BLOG_TOC: { render: () => null },
      BITS_BLOG_VIEWS: { show() {} },
      addEventListener: (event, listener) => { listeners[event] = listener; },
      setInterval: (listener, delay) => { timers.push({ listener, delay }); },
      requestAnimationFrame: callback => setImmediate(callback),
      cancelAnimationFrame: handle => clearImmediate(handle),
    },
    URLSearchParams, AbortSignal, console: { error() {} },
    fetch: async (url, init) => {
      requests.push(new URL(url));
      options.push(init);
      if (offline) throw new Error("Offline fixture");
      const page = pages.shift() || [];
      if (page instanceof Error) throw page;
      return { ok: true, json: async () => page };
    },
  });
  context.document.createElement = tag => Object.assign(new Element(tag), { ownerDocument: context.document });
  Object.values(nodes).forEach(node => { node.ownerDocument = context.document; });
  vm.runInContext(contractSource, context);
  vm.runInContext(taxonomySource, context);
  vm.runInContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  return { requests, options, head, context, listeners, timers, refresh: async () => {
    timers[0].listener();
    await new Promise((resolve) => setImmediate(resolve));
  } };
}

function archiveNodes() {
  const nodes = Object.fromEntries(["#blog-post-list", "#blog-status", "#blog-post-count", "#blog-search", "#blog-taxonomy-browse", ".blog-header h1"].map((selector) => [selector, new Element()]));
  nodes["#blog-post-list"].dataset.staticSlugs = '["existing-post"]';
  nodes["#blog-status"].textContent = "Published posts from the latest deployment.";
  return nodes;
}

test("archive links built posts statically and newer posts through the legacy reader; searches locally", async () => {
  const nodes = archiveNodes();
  const { requests } = await browserScript(archiveSource, {
    nodes,
    pages: [[
      { slug: "existing-post", title: "Lab notes", excerpt: "Identity practice", published_at: "2026-10-01T12:00:00Z" },
      { slug: "brand-new-post", title: "Web notes", excerpt: "Publishing workflow", published_at: "2026-10-02T12:00:00Z" },
    ], []],
  });
  const cards = nodes["#blog-post-list"].children;
  assert.equal(cards[0].children[0].children[0].href, "/blog/articles/existing-post/");
  assert.equal(cards[1].children[0].children[0].href, "/blog/post.html?slug=brand-new-post");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get("select"), "slug,title,excerpt,published_at,tags,series,series_order");
  assert.equal(requests[0].searchParams.get("published"), "eq.true");
  assert.equal(requests[0].searchParams.get("published_at"), null, "Database-time eligibility must not be overridden by a skewed client clock");
  assert.equal(requests[0].searchParams.get("order"), "published_at.desc,slug.asc");
  assert.equal(requests[0].searchParams.get("limit"), "500");
  nodes["#blog-search"].value = "identity";
  nodes["#blog-search"].listeners.input();
  assert.equal(cards[0].hidden, false);
  assert.equal(cards[1].hidden, true);
  assert.equal(nodes["#blog-post-count"].textContent, "1 POST");
  nodes["#blog-search"].value = "no-match";
  nodes["#blog-search"].listeners.input();
  assert.equal(nodes["#blog-status"].textContent, "0 matching posts.");
});

test("archive pagination stops if the service repeats a full page", async () => {
  const nodes = archiveNodes();
  const saved = new Element("article");
  saved.textContent = "Saved post";
  nodes["#blog-post-list"].append(saved);
  const page = Array.from({ length: 500 }, (_, index) => ({
    slug: `post-${index}`, title: `Post ${index}`, excerpt: "Published",
    published_at: "2026-10-01T12:00:00Z",
  }));
  const { requests } = await browserScript(archiveSource, { nodes, pages: [page, page] });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get("offset"), "500");
  assert.equal(requests[1].searchParams.get("published_at"), requests[0].searchParams.get("published_at"));
  assert.equal(nodes["#blog-post-list"].children[0], saved);
  assert.match(nodes["#blog-status"].textContent, /latest deployment/);
});

test("archive preserves and searches deployment content when live fetch fails", async () => {
  const nodes = archiveNodes();
  const saved = new Element("article");
  saved.textContent = "Saved post";
  nodes["#blog-post-list"].append(saved);
  await browserScript(archiveSource, { nodes, offline: true });
  assert.equal(nodes["#blog-post-list"].children[0], saved);
  assert.equal(nodes["#blog-post-count"].textContent, "1 POST");
  assert.match(nodes["#blog-status"].textContent, /latest deployment/);
});

function postNodes() {
  const nodes = Object.fromEntries([
    "#blog-post", "#blog-post-status", "#blog-post-title", "#blog-post-excerpt",
    "#blog-post-date", "#blog-post-reading-time", "#blog-post-body", "#blog-post-views", "#blog-post-toc",
    "#blog-post-taxonomy", "#blog-series-navigation",
  ].map((selector) => [selector, new Element()]));
  nodes["#blog-post"].hidden = true;
  return nodes;
}

test("live taxonomy browsing combines tag and series filters, preserves reading order and uses fallback routes", async () => {
  const nodes = archiveNodes();
  const series = { name: "Colors", slug: "colors" };
  const tag = { name: "Accessible colors", slug: "accessible" };
  const posts = [
    { slug: "second", title: "Second", excerpt: "Public", published_at: "2026-01-01", tags: [tag], series, series_order: 2 },
    { slug: "first", title: "First", excerpt: "Public", published_at: "2026-01-01", tags: [tag], series, series_order: 1 },
    { slug: "other", title: "Unassigned", excerpt: "Public", published_at: "2026-01-01", tags: [tag] },
  ];
  await browserScript(archiveSource, { nodes, pages: [posts], pathname: "/blog/series/colors/", query: "?tag=accessible" });
  const cards = nodes["#blog-post-list"].children;
  assert.deepEqual(cards.map(card => card.children[0].textContent), ["First", "Second"]);
  assert.equal(nodes["#blog-post-count"].textContent, "2 POSTS");
  assert.equal(cards[0].children[3].children[0].href, "/blog/?tag=accessible");
  assert.equal(cards[0].children[3].children[1].href, "/blog/?series=colors");
  assert.equal(nodes["#blog-status"].textContent, "Archive synchronized.");
});

test("series navigation refreshes independent of body, handles outages honestly and clears confirmed absence", async () => {
  const nodes = postNodes();
  nodes["#blog-post"].dataset.staticSlugs = '["before","existing-post"]';
  const series = { name: "Colors", slug: "colors" };
  const post = { slug: "existing-post", title: "Middle", excerpt: "Public", body_markdown: "Body", published_at: "2026-01-01", series, series_order: 2 };
  const members = [
    { ...post, slug: "after", title: "After", series_order: 3 },
    { ...post, slug: "before", title: "Before", series_order: 1 }, post,
  ];
  const state = await browserScript(postSource, { nodes, pages: [[post], members, [post], members.slice(0, 1).concat(post), [post], new Error("Unavailable"), []] });
  const navigation = nodes["#blog-series-navigation"];
  assert.equal(nodes["#blog-post-status"].hidden, true);
  assert.match(navigation.textContent, /Part 2 of 3/);
  assert.equal(navigation.children.find(child => child.rel === "prev").href, "/blog/articles/before/");
  assert.equal(navigation.children.find(child => child.rel === "next").href, "/blog/post.html?slug=after");
  assert.equal(state.requests[1].searchParams.get("series->>slug"), "eq.colors");
  const rendered = nodes["#blog-post-body"].children[0];
  await state.refresh();
  assert.equal(nodes["#blog-post-body"].children[0], rendered);
  assert.match(navigation.textContent, /Part 1 of 2/);
  assert.equal(navigation.children.some(child => child.rel === "prev"), false);
  await state.refresh();
  assert.match(navigation.textContent, /could not be refreshed and may be out of date/);
  assert.equal(nodes["#blog-post-status"].hidden, true, "Series failure must not falsely report a body-fetch outage.");
  await state.refresh();
  assert.equal(nodes["#blog-post"].hidden, true);
  assert.equal(navigation.children.length, 0);
});

test("theme and stylesheet changes refresh shades; color errors do not hide live content", async () => {
  const nodes = postNodes();
  const post = { slug: "existing-post", title: "Live", excerpt: "Public", body_markdown: "Live body", published_at: "2026-10-01T12:00:00Z" };
  let calls = 0, fail = false;
  const state = await browserScript(postSource, { nodes, pages: [[post]], adaptColors: () => {
    calls++;
    if (fail) throw new Error("Unsupported surface");
  } });
  const initial = calls;
  state.listeners["bits:theme-applied"]();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(calls > initial);
  fail = true;
  state.listeners.load({ target: { id: "bits-theme-stylesheet" } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes["#blog-post"].hidden, false);
  assert.equal(nodes["#blog-post-body"].textContent, "Live body");
  assert.match(nodes["#blog-post-status"].textContent, /colors could not be adjusted/);
  assert.equal(nodes["#blog-post-status"].hidden, false);
  assert.equal(state.requests.length, 1);
});

test("legacy links preserve unpublished semantics rather than redirecting to stale static copies", async () => {
  const nodes = postNodes();
  const { requests, head } = await browserScript(postSource, { nodes, pages: [[]] });
  assert.equal(nodes["#blog-post"].hidden, true);
  assert.match(nodes["#blog-post-status"].textContent, /does not exist or is not published/);
  assert.equal(head.children.filter((element) => element.rel === "canonical").length, 0);
  assert.equal(requests[0].searchParams.get("published"), "eq.true");
  assert.equal(requests[0].searchParams.get("published_at"), null, "Database-time eligibility must not be overridden by a skewed client clock");
  assert.equal(requests[0].searchParams.get("slug"), "eq.existing-post");
  assert.equal(requests[0].searchParams.get("select"), "slug,title,excerpt,body_markdown,body_rich,published_at,updated_at,tags,series,series_order");
  assert.equal(requests[0].searchParams.get("limit"), "1");
});

test("canonical article reconciles by route slug, hides confirmed absence, and recovers same-slug recreation", async () => {
  const nodes = postNodes();
  nodes["#blog-post"].hidden = false;
  nodes["#blog-post"].dataset.blogSlug = "existing-post";
  nodes["#blog-post-body"].textContent = "Old deployed body";
  const post = { slug: "existing-post", title: "Edited", excerpt: "Public", body_markdown: "Edited body", published_at: "2026-10-01T12:00:00Z" };
  const state = await browserScript(postSource, {
    nodes, slug: "unrelated-query",
    pages: [[post], [], new Error("Offline"), [{ ...post, title: "Recreated", body_markdown: "Recreated body" }]],
  });
  assert.equal(state.requests[0].searchParams.get("slug"), "eq.existing-post");
  assert.equal(state.options[0].cache, "no-store");
  assert.equal(nodes["#blog-post-body"].textContent.trim(), "Edited body");
  assert.equal(state.timers[0].delay, 60000);
  await state.refresh();
  assert.equal(nodes["#blog-post"].hidden, true);
  assert.equal(nodes["#blog-post-body"].textContent, "");
  assert.equal(state.head.children.find((element) => element.name === "robots").content, "noindex, follow");
  await state.refresh();
  assert.equal(nodes["#blog-post"].hidden, true, "Outages must not resurrect content after confirmed absence");
  await state.refresh();
  assert.equal(nodes["#blog-post"].hidden, false);
  assert.equal(nodes["#blog-post-title"].textContent, "Recreated");
  assert.equal(state.head.children.find((element) => element.name === "robots").content, "index, follow");
  assert.equal(state.head.children.filter((element) => element.rel === "canonical").length, 1);
});

test("article outages retain snapshots with explicit warnings; malformed responses are not absence", async () => {
  for (const response of [new Error("Offline"), {}, [{ slug: "wrong-slug" }]]) {
    const nodes = postNodes();
    nodes["#blog-post"].hidden = false;
    nodes["#blog-post"].dataset.blogSlug = "existing-post";
    nodes["#blog-post-body"].textContent = "Snapshot";
    await browserScript(postSource, { nodes, pages: [response] });
    assert.equal(nodes["#blog-post"].hidden, false);
    assert.equal(nodes["#blog-post-body"].textContent, "Snapshot");
    assert.match(nodes["#blog-post-status"].textContent, /Live updates are unavailable.*latest deployment/);
    assert.equal(nodes["#blog-post-status"].hidden, false);
  }
});

test("unchanged live refreshes preserve rendered article nodes and archive keyboard targets", async () => {
  const post = { slug: "existing-post", title: "Live", excerpt: "Public", body_markdown: "Live body", published_at: "2026-10-01T12:00:00Z" };
  for (const [source, nodes, selector] of [
    [postSource, postNodes(), "#blog-post-body"],
    [archiveSource, archiveNodes(), "#blog-post-list"],
  ]) {
    const state = await browserScript(source, { nodes, pages: [[post], [post]] });
    const child = nodes[selector].children[0];
    await state.refresh();
    assert.equal(nodes[selector].children[0], child);
  }
});

test("archive refresh includes newly due posts, removes old entries, and does not restore removed cards on failure", async () => {
  const nodes = archiveNodes();
  const post = { slug: "due-post", title: "Due", excerpt: "Scheduled", published_at: "2026-10-01T12:00:00Z" };
  const state = await browserScript(archiveSource, { nodes, pages: [[], [post], [], new Error("Offline")] });
  assert.equal(nodes["#blog-post-list"].children.length, 0);
  await state.refresh();
  assert.equal(nodes["#blog-post-list"].children[0].children[0].children[0].href, "/blog/post.html?slug=due-post");
  await state.refresh();
  assert.equal(nodes["#blog-post-list"].children.length, 0);
  await state.refresh();
  assert.equal(nodes["#blog-post-list"].children.length, 0);
  assert.match(nodes["#blog-status"].textContent, /last synchronized archive/);
  nodes["#blog-search"].value = "due";
  nodes["#blog-search"].listeners.input();
  assert.match(nodes["#blog-status"].textContent, /Live updates are unavailable/);
  assert.equal(state.options[0].cache, "no-store");
  state.context.document.hidden = true;
  const count = state.requests.length;
  await state.refresh();
  assert.equal(state.requests.length, count);
  state.context.document.hidden = false;
  state.listeners.visibilitychange();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.requests.length, count + 1);
});

test("legacy published reader renders a live post; malformed slugs make no request", async () => {
  const nodes = postNodes();
  const { head } = await browserScript(postSource, {
    nodes,
    pages: [[{ slug: "existing-post", title: "Live post", excerpt: "Public", body_markdown: "Live body", published_at: "2026-10-01T12:00:00Z" }]],
  });
  assert.equal(nodes["#blog-post"].hidden, false);
  assert.equal(nodes["#blog-post-title"].textContent, "Live post");
  assert.equal(head.children[0].href, "https://www.shortbits.net/blog/articles/existing-post/");
  const invalid = postNodes();
  const { requests } = await browserScript(postSource, { nodes: invalid, slug: "../bad" });
  assert.equal(requests.length, 0);
  assert.match(invalid["#blog-post-status"].textContent, /invalid/);
});
