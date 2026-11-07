import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { markdownRenderer, renderArticle } from "./build-content.mjs";
import { enrichSeo } from "./build-seo.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const destinations = [
  ["/professional/", "Professional profile"], ["/online/", "Online"],
  ["/projects/", "Projects"], ["/blog/", "Blog"],
  ["/?choose", "Choose profile"], ["/privacy/", "Privacy"],
];

function assertNavigation(html, name) {
  const { document } = parseHTML(html);
  const nav = document.querySelector('nav.public-nav[aria-label="Public sections"]');
  assert.ok(nav, `${name}: static public section navigation`);
  assert.deepEqual([...nav.querySelectorAll("a")].slice(0, 6).map((link) => [
    link.getAttribute("href"), link.textContent.trim(),
  ]), destinations, name);
  assert.ok(document.querySelector('link[href^="/shared/styles/public-nav.css"]'), name);
}

test("public pages expose the same explicit profiles, projects, blog, chooser, and privacy destinations", async () => {
  for (const path of [
    "index.html", "online/index.html", "professional/index.html",
    "professional/resume/index.html", "projects/index.html",
    "projects/homelab/index.html", "projects/shortbits/index.html",
    "blog/index.html", "blog/post.html", "privacy/index.html", "source.html",
  ]) assertNavigation(await read(path), path);
});

test("generated articles preserve public navigation and do not imply Online is the only home", async () => {
  const renderer = markdownRenderer(await read("shared/scripts/markdown.js"));
  const post = {
    slug: "navigation-check", title: "Navigation check", excerpt: "Public journeys.",
    published_at: "2026-11-07T00:00:00Z", body_markdown: "## A static article\n\nStill readable.",
  };
  const html = renderArticle(post, renderer);
  assertNavigation(html, "generated article");
  const { document } = parseHTML(html);
  assert.equal(document.querySelector(".blog-breadcrumbs a").getAttribute("href"), "/?choose");
  assert.equal(document.querySelector('.public-nav a[aria-current]').getAttribute("href"), "/blog/");
  assert.doesNotMatch(await read("blog/index.html"), /RETURN_HOME/);
  assert.equal(parseHTML(await read("blog/post.html")).document
    .querySelector(".blog-breadcrumbs a").getAttribute("href"), "/?choose");
});

test("Online keeps the native File commands and compact footer navigation hooks", async () => {
  const { document } = parseHTML(await read("online/index.html"));
  const commands = [...document.querySelector("#app-menu-bar .app-menu-popup").children];
  assert.deepEqual(commands.map(command => command.getAttribute("data-window-target")),
    ["about-window", "filesystem-window", "source-window"]);
  const nav = document.querySelector("#interface-shell > footer .online-public-nav");
  assert.ok(nav);
  assert.equal(nav.querySelectorAll("a.site-switch-link").length, 7);
  assert.equal(nav.lastElementChild.getAttribute("href"), "/admin/");
});

test("privacy is indexable, included in the build and sitemap, and discloses the distinct data paths", async () => {
  const html = await read("privacy/index.html");
  const { document } = parseHTML(enrichSeo(html, "/privacy/"));
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute("href"),
    "https://www.shortbits.net/privacy/");
  assert.equal(document.querySelector('meta[property="og:url"]').getAttribute("content"),
    "https://www.shortbits.net/privacy/");
  assert.equal(document.querySelector('script[data-seo]') !== null, true);
  for (const id of ["contact", "statistics", "preferences", "services", "questions"]) {
    assert.ok(document.getElementById(id), id);
  }
  for (const phrase of [
    "Resend", "Supabase", "Cloudflare Turnstile", "Global Privacy Control",
    "Do Not Track", "random token", "UTC day", "guestbook is public",
    "not yours", "Lanyard", "does not publish a fixed retention period",
    "logs", "backups",
  ]) assert.ok(document.body.textContent.includes(phrase), phrase);
  assert.match(await read("sitemap.xml"), /<loc>https:\/\/www.shortbits.net\/privacy\/<\/loc>/);
  assert.match(await read("scripts/build-site.mjs"), /"privacy"/);
  for (const path of ["online/index.html", "professional/index.html"]) {
    assert.ok(parseHTML(await read(path)).document.querySelector('#contact-form a[href="/privacy/#contact"]'), path);
  }
  assert.ok(parseHTML(await read("online/index.html")).document
    .querySelector('#guestbook-form a[href="/privacy/#contact"]'));
  assert.ok(parseHTML(await read("nowplaying/index.html")).document
    .querySelector('a[href="/privacy/#services"]'));
});

test("chooser bypasses remembered Online and Professional choices only with the explicit choose mechanism", async () => {
  const source = await read("home/scripts/chooser.js");
  for (const choice of ["online", "professional"]) {
    for (const search of ["", "?choose"]) {
      const redirects = [];
      vm.runInNewContext(source, {
        URLSearchParams,
        window: { location: { search, hash: "", replace: (path) => redirects.push(path) } },
        localStorage: { getItem: () => choice },
        document: { addEventListener: () => {} },
      });
      assert.deepEqual(redirects, search ? [] : [`/${choice}/`], `${choice} ${search}`);
    }
  }
});
