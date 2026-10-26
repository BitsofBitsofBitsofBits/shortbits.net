import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { PGlite } from "@electric-sql/pglite";

const html = await readFile(new URL("../online/index.html", import.meta.url), "utf8");
const source = await readFile(new URL("../online/scripts/content.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261026090000_featured_project.sql", import.meta.url), "utf8");
const project = {
  title: "A different project", summary: "<b>Plain text summary</b>", status: "IN PROGRESS",
  tags: "TypeScript, CSS, , SQL", link_url: "https://example.com/project", link_label: "VIEW PROJECT",
};

async function render(rows, { offline = false } = {}) {
  const { document } = parseHTML(html);
  const requests = [];
  const errors = [];
  vm.runInNewContext(source, {
    document, URL, ResizeObserver: class { observe() {} },
    window: {
      SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "public" },
      addEventListener() {},
    },
    console: { error: (...args) => errors.push(args) },
    fetch: async (url) => {
      requests.push(new URL(url));
      if (offline) throw new Error("Offline fixture");
      return { ok: true, json: async () => rows };
    },
  });
  await new Promise(setImmediate);
  return { document, requests, errors };
}

test("FEATURED_PROCESS starts hidden and stays hidden when unpublished or unavailable", async () => {
  assert.equal(parseHTML(html).document.querySelector("#featured-project-section").hidden, true);
  for (const options of [{}, { offline: true }]) {
    const { document, errors, requests } = await render([], options);
    assert.equal(document.querySelector("#featured-project-section").hidden, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get("enabled"), "eq.true");
    assert.equal(errors.length, options.offline ? 1 : 0);
  }
});

test("published project renders editable content as text with optional status and tags", async () => {
  const { document, errors } = await render([project]);
  assert.deepEqual(errors, []);
  assert.equal(document.querySelector("#featured-project-section").hidden, false);
  assert.equal(document.querySelector("#featured-project-title").textContent, project.title);
  assert.equal(document.querySelector("#featured-project-summary").textContent, project.summary);
  assert.equal(document.querySelector("#featured-project-summary b"), null);
  assert.deepEqual([...document.querySelectorAll("#featured-project-tags li")].map((item) => item.textContent), ["TypeScript", "CSS", "SQL"]);
  assert.equal(document.querySelector("#featured-project-link").href, project.link_url);
  assert.equal(document.querySelector("#featured-project-link").textContent, project.link_label);
  assert.equal(document.querySelector("#featured-project-section [data-window-target='source-window']"), null);
  const empty = await render([{ ...project, status: "", tags: "" }]);
  assert.equal(empty.document.querySelector("#featured-project-status").hidden, true);
  assert.equal(empty.document.querySelector("#featured-project-tags").hidden, true);
});

test("unsafe project links keep the section hidden and report the error", async () => {
  for (const link_url of ["javascript:alert(1)", "http://example.com", "https://user:password@example.com", "invalid"]) {
    const { document, errors } = await render([{ ...project, link_url }]);
    assert.equal(document.querySelector("#featured-project-section").hidden, true);
    assert.equal(errors.length, 1);
  }
});

test("featured project database defaults to a private draft and enforces publishing and management", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    await db.exec(migration);
    assert.equal((await db.query("select enabled from site_featured_project")).rows[0].enabled, false);
    await db.exec("set role anon");
    assert.deepEqual((await db.query("select * from site_featured_project")).rows, []);
    await assert.rejects(db.exec("update site_featured_project set enabled = true"), /permission denied/);
    await assert.rejects(db.exec("delete from site_featured_project"), /permission denied/);
    await db.exec("set role authenticated");
    await assert.rejects(db.exec("insert into site_featured_project (position) values (2)"), /check constraint|row-level security/);
    await assert.rejects(db.exec("update site_featured_project set title = '', enabled = true"), /check constraint/);
    await assert.rejects(db.exec("update site_featured_project set link_url = 'javascript:alert(1)'"), /check constraint/);
    await assert.rejects(db.exec("update site_featured_project set link_url = 'https://user:password@example.com'"), /check constraint/);
    await db.exec("update site_featured_project set enabled = true");
    await db.exec("set role anon");
    assert.equal((await db.query("select title from site_featured_project")).rows[0].title, "BITSOFBITS WEBSITE");
    await db.exec("set role authenticated; update site_featured_project set enabled = false; set role anon");
    assert.deepEqual((await db.query("select * from site_featured_project")).rows, []);
    await db.exec("reset role");
    const names = (await db.query("select content_backup_tables() as names")).rows[0].names;
    assert.ok(names.includes("site_featured_project"));
    assert.deepEqual(names, [...names].sort());
  } finally {
    await db.close();
  }
});
