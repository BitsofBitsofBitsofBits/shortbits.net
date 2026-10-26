import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { canonicalOrigin, enrichSeo, pagePath, validateSeo } from "./build-seo.mjs";

function fixture(path = "/", extraHead = "", body = '<h1>Caleb K Masters</h1>') {
  return `<!doctype html><html lang="en"><head><title>Caleb K Masters &amp; Projects</title>
<meta name="description" content="Personal projects &amp; technical notes.">
<link rel="canonical" href="${canonicalOrigin}${path}">${extraHead}</head><body>${body}</body></html>`;
}
const sitemap = (paths) => `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(
  (path) => `<url><loc>${canonicalOrigin}${path}</loc></url>`,
).join("")}</urlset>`;
const schema = (html) => {
  const { document } = parseHTML(html);
  return [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) => JSON.parse(script.textContent));
};

test("page paths preserve canonical directories and file routes on Windows", () => {
  assert.equal(pagePath("index.html"), "/");
  assert.equal(pagePath("professional\\resume\\index.html"), "/professional/resume/");
  assert.equal(pagePath("source.html"), "/source.html");
});

test("Google ownership verification is preserved without page metadata", () => {
  const path = "/google2dd607a2af6e8097.html";
  const html = `google-site-verification: ${path.slice(1)}`;
  assert.equal(enrichSeo(html, path), html);
  assert.equal(enrichSeo(`${html}\n`, path), `${html}\n`);
  assert.throws(() => enrichSeo("google-site-verification: different.html", path), /SEO:/);
  assert.throws(() => enrichSeo(html, "/blog/google2dd607a2af6e8097.html"), /SEO:/);
  assert.equal(validateSeo([{ path: "/", html: fixture() }, { path, html }], sitemap(["/"])), 1);
});

test("SEO is static, repeatable, and preserves the exact body and runtime script order", () => {
  const body = '<main><h1>Caleb</h1><!-- keep this -->$&<button data-window-target="settings-window">Settings</button></main>';
  const input = fixture("/", '<script src="/first.js"></script><script src="/second.js"></script>', body);
  const output = enrichSeo(input, "/");
  assert.equal(output.split("<body>")[1], `${body}</body></html>`);
  assert.ok(output.indexOf("/first.js") < output.indexOf("/second.js"));
  assert.equal(enrichSeo(output, "/"), output);
  const { document } = parseHTML(output);
  assert.equal(document.querySelector('meta[property="og:title"]').getAttribute("content"), "Caleb K Masters & Projects");
  assert.equal(document.querySelector('meta[name="twitter:image"]').getAttribute("content"),
    `${canonicalOrigin}/shared/images/social-preview.png`);
  assert.match(document.querySelector('meta[name="robots"]').getAttribute("content"), /max-image-preview:large/);
  assert.equal(validateSeo([{ path: "/", html: output }], sitemap(["/"])), 1);
});

test("existing profile identity and factual schema are preserved without duplicate page entities", () => {
  const profile = {
    "@context": "https://schema.org", "@type": "ProfilePage",
    mainEntity: { "@type": "Person", "@id": `${canonicalOrigin}/#person`, name: "Caleb K Masters" },
  };
  const output = enrichSeo(fixture("/professional/", `<script type="application/ld+json">${JSON.stringify(profile)}</script>`),
    "/professional/");
  const values = schema(output);
  assert.equal(values.filter((value) => value["@type"] === "ProfilePage").length, 1);
  assert.deepEqual(values[0].mainEntity, profile.mainEntity);
  assert.equal(values[0]["@id"], `${canonicalOrigin}/professional/#webpage`);
  assert.equal(values[0].isPartOf["@id"], `${canonicalOrigin}/#website`);
  assert.equal(values[1]["@graph"].find((value) => value["@type"] === "BreadcrumbList").itemListElement.length, 2);
});

test("article breadcrumbs skip the nonexistent articles directory and collection links are real static links", () => {
  const path = "/blog/articles/first-lab-notes/";
  const graph = schema(enrichSeo(fixture(path), path))[0]["@graph"];
  assert.deepEqual(graph[1].itemListElement.map((item) => item.item),
    [`${canonicalOrigin}/`, `${canonicalOrigin}/blog/`, `${canonicalOrigin}${path}`]);
  assert.equal(graph[0].mainEntity["@id"], `${canonicalOrigin}${path}#article`);
  const archive = fixture("/blog/", "", '<h1>Blog</h1><div id="blog-post-list"><h3><a href="/blog/articles/first-lab-notes/">Real notes</a></h3></div>');
  const output = enrichSeo(archive, "/blog/");
  assert.equal(schema(output)[0]["@graph"][0].mainEntity.itemListElement[0].url, `${canonicalOrigin}${path}`);
  assert.equal(enrichSeo(output, "/blog/"), output);
});

test("noindex helpers stay untouched and missing metadata or malformed JSON fail explicitly", () => {
  const noindex = fixture("/", '<meta name="robots" content="noindex, follow">');
  assert.equal(enrichSeo(noindex, "/"), noindex);
  assert.throws(() => enrichSeo(fixture().replace('name="description"', 'name="other"'), "/"), /description/);
  assert.throws(() => enrichSeo(fixture().replace("www.shortbits.net", "shortbits.net"), "/"), /self-canonical/);
  assert.throws(() => enrichSeo(fixture("/", '<script type="application/ld+json">{bad}</script>'), "/"), SyntaxError);
  assert.throws(() => validateSeo([{ path: "/", html: noindex }], sitemap(["/"])), /noindex/);
});

test("SEO validation rejects duplicates, wrong-host URLs, missing pages and unlisted indexable pages", () => {
  const pages = [{ path: "/", html: fixture() }];
  assert.throws(() => validateSeo(pages, sitemap(["/", "/"])), /unique/);
  assert.throws(() => validateSeo(pages, sitemap(["/"]).replace("www.shortbits.net", "shortbits.net")), /noncanonical/);
  assert.throws(() => validateSeo(pages, sitemap(["/", "/missing/"])), /missing/);
  assert.throws(() => validateSeo([...pages, { path: "/projects/", html: fixture("/projects/") }], sitemap(["/"])), /absent/);
});

test("markup-like titles cannot break out of the generated JSON-LD data block", () => {
  const title = '&lt;/title&gt;&lt;script&gt;alert("SEO")&lt;/script&gt;';
  const input = fixture().replace("Caleb K Masters &amp; Projects", title);
  const output = enrichSeo(input, "/");
  assert.equal(schema(output)[0]["@graph"][0].name, '</title><script>alert("SEO")</script>');
  const { document } = parseHTML(output);
  assert.equal(document.querySelectorAll('script:not([type="application/ld+json"])').length, 0);
  assert.match(output, /<title>&lt;\/title&gt;/);
});
