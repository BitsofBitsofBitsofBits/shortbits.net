import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const archiveSource = await readFile(new URL("../blog/blog.js", import.meta.url), "utf8");
const postSource = await readFile(new URL("../blog/post.js", import.meta.url), "utf8");

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
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ""; this.children = children; }
  addEventListener(event, listener) { this.listeners[event] = listener; }
}

async function browserScript(source, { nodes, pages = [], slug = "existing-post", offline = false } = {}) {
  const requests = [];
  const head = new Element("head");
  vm.runInNewContext(source, {
    document: {
      querySelector: (selector) => nodes[selector],
      createElement: (tag) => new Element(tag),
      head,
    },
    window: {
      SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "sb_publishable_example" },
      location: { search: `?slug=${slug}` },
      BITS_MARKDOWN: { readingTime: () => 1, render: (text) => ({ textContent: text }) },
    },
    URLSearchParams, console: { error() {} },
    fetch: async (url) => {
      requests.push(new URL(url));
      if (offline) throw new Error("Offline fixture");
      return { ok: true, json: async () => pages.shift() || [] };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { requests, head };
}

function archiveNodes() {
  const nodes = Object.fromEntries(["#blog-post-list", "#blog-status", "#blog-post-count", "#blog-search"].map((selector) => [selector, new Element()]));
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
  assert.equal(requests[0].searchParams.get("published"), "eq.true");
  assert.match(requests[0].searchParams.get("published_at"), /^lte\./);
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
    "#blog-post-date", "#blog-post-reading-time", "#blog-post-body",
  ].map((selector) => [selector, new Element()]));
  nodes["#blog-post"].hidden = true;
  return nodes;
}

test("legacy links preserve unpublished semantics rather than redirecting to stale static copies", async () => {
  const nodes = postNodes();
  const { requests, head } = await browserScript(postSource, { nodes, pages: [[]] });
  assert.equal(nodes["#blog-post"].hidden, true);
  assert.match(nodes["#blog-post-status"].textContent, /does not exist or is not published/);
  assert.equal(head.children.length, 0);
  assert.equal(requests[0].searchParams.get("published"), "eq.true");
  assert.match(requests[0].searchParams.get("published_at"), /^lte\./);
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
