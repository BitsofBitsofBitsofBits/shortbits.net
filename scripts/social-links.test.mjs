import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { PGlite } from "@electric-sql/pglite";
import { buildSocialLinks } from "./build-social-links.mjs";

const source = await readFile(new URL("../shared/scripts/social-links.js", import.meta.url), "utf8");
function context(extra = {}) {
  const { window, document } = parseHTML('<html><body><nav data-social-links></nav></body></html>');
  vm.runInNewContext(source, { window, URL, AbortSignal, ...extra });
  return { api: window.SocialLinks, window, document };
}
const plain = value => JSON.parse(JSON.stringify(value));

test("social migration preserves existing links and enforces publication, ownership and safe fields", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated");
    await db.exec(await readFile(new URL("../supabase/migrations/20261028180000_social_links.sql", import.meta.url), "utf8"));
    const seeded = (await db.query("select * from site_social_links order by position")).rows;
    const { api } = context();
    assert.deepEqual(seeded.map(({ updated_at, ...row }) => row),
      plain(api.defaults).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === "" ? null : value]))));
    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_social_links")).rows.length, 11);
    await assert.rejects(db.exec("delete from site_social_links"), /permission denied/);
    await db.exec("set role authenticated");
    await db.exec("insert into site_social_links (position) values (12)");
    await db.exec("insert into site_social_links (position,label,url,enabled,personal,professional) values (13,'Hidden','https://example.com',true,false,false)");
    await assert.rejects(db.exec("update site_social_links set enabled=true where position=12"), /check constraint/);
    for (const [column, value] of [
      ["url", "javascript:alert(1)"], ["url", "//evil.example"], ["url", "https://user:pass@example.com"],
      ["url", "/\\evil.example"], ["url", "/with space"], ["image_url", "data:image/svg+xml,bad"],
      ["icon", "<svg>"], ["color", "red;background:url(bad)"], ["sort_order", "-1"],
    ]) {
      await assert.rejects(db.query(`update site_social_links set ${column}=$1 where position=1`, [value]), /check constraint/);
    }
    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_social_links")).rows.length, 11, "Drafts and invisible links stay private");
  } finally { await db.close(); }
});

test("shared social rendering safely supports icons, ordering, per-site visibility, and authoritative emptiness", () => {
  const { api, document } = context();
  const a = { ...plain(api.defaults[0]), label: '<img src=x onerror="bad">', description: "<script>bad</script>", sort_order: 2 };
  const b = { ...plain(api.defaults[7]), sort_order: 1, image_url: "https://example.com/custom.png", icon_text: "IN" };
  const draft = { ...a, enabled: false };
  assert.deepEqual(plain(api.ordered([a, b, draft], "professional")).map(row => row.position), [8, 1]);
  const card = api.anchor(a, document, true);
  assert.equal(card.querySelector(".link-title").textContent, a.label);
  assert.equal(card.querySelector("script"), null);
  assert.equal(card.querySelectorAll("img").length, 1);
  assert.equal(card.getAttribute("rel"), "noopener noreferrer");
  const custom = api.anchor(b, document);
  assert.equal(custom.querySelector("img").getAttribute("src"), b.image_url);
  custom.querySelector("img").dispatchEvent(new document.defaultView.Event("error"));
  assert.equal(custom.querySelector(".link-icon").textContent, "IN");
  api.renderProfessional([b], document);
  assert.equal(document.querySelector("nav a").textContent.includes("LINKEDIN"), true);
  api.renderProfessional([], document);
  assert.equal(document.querySelector("nav").hidden, true);
  assert.equal(document.querySelector("nav").children.length, 0);
  for (const url of ["javascript:alert(1)", "//example.com", "/\\example.com", "https://user@example.com", "data:text/html,x", "/with\nnewline"]) {
    assert.equal(api.safeUrl(url), false, url);
    assert.throws(() => api.anchor({ ...a, url }, document), /Invalid/);
  }
  for (const url of ["https://example.com/path?a=1&b=2", "/blog/", "/"]) assert.equal(api.safeUrl(url), true);
});

test("social loader paginates without caching edits or treating errors as empty publication", async () => {
  let calls = 0;
  const { api, window } = context({ fetch: async url => {
    calls += 1;
    assert.ok(url.includes(`offset=${calls === 1 ? 0 : 500}`));
    return { ok: true, json: async () => calls === 1 ? Array(500).fill(plain(api.defaults[0])) : [] };
  } });
  window.SUPABASE_CONFIG = { url: "https://test.example", anonKey: "test-public-key" };
  assert.equal((await api.load()).length, 500);
  assert.equal(calls, 2);
  const broken = context({ fetch: async () => ({ ok: false, status: 503 }) });
  broken.window.SUPABASE_CONFIG = window.SUPABASE_CONFIG;
  await assert.rejects(broken.api.load(), /HTTP 503/);
  await assert.rejects(broken.api.load(), /HTTP 503/);
});

test("static professional output follows managed links even without JavaScript", async () => {
  const root = await mkdtemp(join(tmpdir(), "shortbits-social-"));
  try {
    await mkdir(join(root, "shared", "scripts"), { recursive: true });
    await mkdir(join(root, "professional"), { recursive: true });
    await mkdir(join(root, "online"), { recursive: true });
    await writeFile(join(root, "online", "index.html"), '<html><body><span id="link-count"></span><div id="link-grid"></div></body></html>');
    await writeFile(join(root, "shared", "scripts", "social-links.js"), source);
    await writeFile(join(root, "shared", "scripts", "supabase-config.js"), 'window.SUPABASE_CONFIG={url:"https://test.example",anonKey:"sb_publishable_test"};');
    const file = join(root, "professional", "index.html");
    await writeFile(file, '<html><body><nav data-social-links>old</nav><script type="application/ld+json">{"@type":"ProfilePage","mainEntity":{"sameAs":["old"]}}</script></body></html>');
    const row = { ...plain(context().api.defaults[0]), label: "Edited <link>", url: "https://example.com/edited" };
    await buildSocialLinks(root, { fetchImpl: async () => ({ ok: true, json: async () => [row] }) });
    const { document } = parseHTML(await readFile(file, "utf8"));
    assert.equal(document.querySelector("nav a").getAttribute("href"), row.url);
    assert.equal(document.querySelector(".link-title").textContent, row.label);
    assert.deepEqual(JSON.parse(document.querySelector("script").textContent).mainEntity.sameAs, [row.url]);
    const personal = parseHTML(await readFile(join(root, "online", "index.html"), "utf8")).document;
    assert.equal(context().api.initial(personal)[0].url, row.url);
    await buildSocialLinks(root, { fetchImpl: async () => ({ ok: true, json: async () => [] }) });
    assert.equal(parseHTML(await readFile(file, "utf8")).document.querySelector("nav").children.length, 0);
    assert.equal(context().api.initial(parseHTML(await readFile(join(root, "online", "index.html"), "utf8")).document).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
