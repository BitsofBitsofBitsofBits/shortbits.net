import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { database } from "./blog-drafts-db-helper.mjs";
import { startSiteServer } from "./site-server.mjs";

const db = await database();
const postId = "00000000-0000-4000-8000-000000000011";
await db.exec(`reset role; insert into public.site_blog_posts (id,slug,title,excerpt,body_markdown,published,published_at)
  values ('${postId}','still-live','Still live','Synthetic browser fixture','# Original\\n\\nPublished body.',true,'2026-11-01'); set role authenticated;`);
const server = await startSiteServer(resolve("."));
const browser = await chromium.launch({ headless: true });
const signatures = {
  load_blog_draft: [["p_id", "uuid"]],
  save_blog_draft: [["p_id", "uuid"], ["p_expected_version", "uuid"], ["p_base_public_version", "timestamptz"], ["p_snapshot", "jsonb"], ["p_request_id", "uuid"], ["p_checkpoint", "boolean"]],
  publish_blog_draft: [["p_id", "uuid"], ["p_expected_version", "uuid"], ["p_request_id", "uuid"], ["p_expected_public_version", "timestamptz"], ["p_accept_live_change", "boolean"]],
  list_blog_editor_entries: [],
  list_blog_draft_history: [["p_id", "uuid"]],
  get_blog_draft_revision: [["p_id", "uuid"], ["p_revision_id", "uuid"]],
  restore_blog_draft_revision: [["p_id", "uuid"], ["p_revision_id", "uuid"], ["p_expected_version", "uuid"], ["p_request_id", "uuid"]],
  cancel_blog_draft_schedule: [["p_id", "uuid"], ["p_expected_version", "uuid"], ["p_request_id", "uuid"]],
  unpublish_blog_draft: [["p_id", "uuid"], ["p_expected_version", "uuid"], ["p_request_id", "uuid"]],
};
let queue = Promise.resolve();
function operation(role, run) {
  const result = queue.then(async () => { await db.exec(`set role ${role}`); return run(); });
  queue = result.then(() => undefined, () => undefined);
  return result;
}
const publicRows = () => operation("anon", async () => (await db.query("select * from public.site_blog_public_posts order by slug")).rows);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "UTC" });
  await context.exposeBinding("__databaseRpc", async (_source, name, args) => {
    if (!Object.hasOwn(signatures, name)) throw new Error("Unexpected browser-fixture RPC");
    try {
      const signature = signatures[name];
      const values = signature.map(([key, type]) => type === "jsonb" ? JSON.stringify(args[key]) : args[key] ?? null);
      const parameters = signature.map(([key, type], index) => `${key} => $${index + 1}::${type}`).join(",");
      return await operation("authenticated", async () => ({ data: (await db.query(`select public.${name}(${parameters}) as result`, values)).rows[0].result }));
    } catch (error) { return { error: { message: error.message, code: error.code } }; }
  });
  await context.exposeBinding("__publicRows", publicRows);
  await context.addInitScript(() => {
    window.__writerClient = {
      auth: {
        getSession: async () => ({ data: { session: location.pathname === "/admin/" ? null : { user: { id: "synthetic-editor" } } } }),
        getUser: async () => ({ data: { user: { id: "synthetic-editor" } } }),
        onAuthStateChange: () => {},
      },
      rpc(name, args = {}) { const promise = window.__databaseRpc(name, args); promise.abortSignal = () => promise; return promise; },
      from(table) {
        if (table !== "site_blog_public_posts") throw new Error("Unexpected direct editorial table access");
        return { select() { return this; }, order() { return this; }, async range() { return { data: await window.__publicRows() }; } };
      },
    };
  });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "cdn.jsdelivr.net") return route.fulfill({ contentType: "application/javascript", body: "window.supabase={createClient:()=>window.__writerClient};" });
    if (url.pathname.endsWith("/rest/v1/site_blog_public_posts")) {
      const slug = url.searchParams.get("slug")?.replace(/^eq\./, "");
      return route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify((await publicRows()).filter(row => !slug || row.slug === slug)) });
    }
    return url.origin === server.origin ? route.continue() : route.abort();
  });
  const first = await context.newPage(), second = await context.newPage();
  for (const page of [first, second]) {
    await page.goto(`${server.origin}/admin/blog-writer/?post=${postId}`);
    await page.getByText("Original Markdown preserved.", { exact: false }).waitFor();
  }
  const original = await publicRows();
  await first.getByRole("textbox", { name: "Title", exact: true }).fill("Private SQL-backed edit");
  await first.getByText("Private draft saved. The live article is unchanged.", { exact: true }).waitFor();
  assert.deepEqual(await publicRows(), original);
  await second.getByRole("textbox", { name: "Title", exact: true }).fill("Conflicting tab keeps this locally");
  await second.getByText("Autosave paused: another editor changed this draft.", { exact: false }).waitFor();
  assert.equal(await second.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Conflicting tab keeps this locally");
  assert.deepEqual(await publicRows(), original);
  await first.getByRole("button", { name: "History", exact: true }).click();
  await first.locator("#writer-history-list button").last().click();
  await first.getByText("Preview only. Restore to draft does not publish.", { exact: true }).waitFor();
  await first.getByRole("button", { name: "Restore to draft", exact: true }).click();
  await first.getByText("Revision restored to the private draft.", { exact: false }).waitFor();
  assert.deepEqual(await publicRows(), original);
  await first.getByRole("textbox", { name: "Title", exact: true }).fill("Explicit SQL-backed publication");
  first.once("dialog", dialog => dialog.accept());
  await first.getByRole("button", { name: "Publish revision", exact: true }).click();
  await first.getByText("Revision published. Live readers use this version.", { exact: true }).waitFor();
  assert.equal((await publicRows())[0].title, "Explicit SQL-backed publication");
  const reader = await context.newPage();
  await reader.addInitScript(() => {
    const NativeDate = Date;
    window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : ["1990-01-01T00:00:00Z"])); } };
  });
  await reader.goto(`${server.origin}/blog/post.html?slug=still-live`);
  await reader.getByRole("heading", { name: "Explicit SQL-backed publication", exact: true }).waitFor();
  const admin = await context.newPage();
  await admin.goto(`${server.origin}/admin/#/blog`);
  await admin.evaluate(async id => {
    loginView.hidden = true; inboxView.hidden = false;
    const form = document.querySelector("#blog-post-form");
    for (let node = form; node && node !== document.body; node = node.parentElement) { node.hidden = false; node.inert = false; }
    selectBlogPost(blogEditorPost((await window.__databaseRpc("load_blog_draft", { p_id: id })).data));
  }, postId);
  await admin.locator('#blog-post-form [name="title"]').fill("Private legacy Admin edit");
  await admin.locator("#blog-post-save").click();
  await admin.getByText("Private draft saved. Public content is unchanged.", { exact: true }).waitFor();
  assert.equal((await publicRows())[0].title, "Explicit SQL-backed publication");
  const scheduling = await context.newPage();
  await scheduling.goto(`${server.origin}/admin/blog-writer/?post=${postId}`);
  await scheduling.getByText("Autosave ready.", { exact: false }).waitFor();
  await scheduling.getByRole("textbox", { name: "Title", exact: true }).fill("Approved scheduled revision");
  await scheduling.getByLabel("Publish time", { exact: true }).fill(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  scheduling.once("dialog", dialog => dialog.accept());
  await scheduling.getByRole("button", { name: "Publish revision", exact: true }).click();
  await scheduling.getByText("Revision scheduled.", { exact: false }).waitFor();
  assert.equal((await publicRows())[0].title, "Explicit SQL-backed publication");
  await scheduling.getByRole("textbox", { name: "Title", exact: true }).fill("Later private changes");
  await scheduling.getByText("Private draft saved. The live article is unchanged.", { exact: true }).waitFor();
  assert.equal((await publicRows())[0].title, "Explicit SQL-backed publication");
  await scheduling.getByRole("button", { name: "History", exact: true }).click();
  scheduling.once("dialog", dialog => dialog.accept());
  await scheduling.getByRole("button", { name: "Cancel scheduled revision", exact: true }).click();
  await scheduling.getByText("Scheduled revision cancelled.", { exact: false }).waitFor();
  assert.equal((await publicRows())[0].title, "Explicit SQL-backed publication");
  const fresh = await context.newPage();
  await fresh.goto(`${server.origin}/admin/blog-writer/`);
  await fresh.getByText("Autosave ready.", { exact: false }).waitFor();
  await fresh.getByRole("textbox", { name: "Title", exact: true }).fill("Incomplete new draft");
  await fresh.getByText("Private draft saved. The live article is unchanged.", { exact: true }).waitFor();
  assert.equal((await publicRows()).length, 1);
  await context.close();
  console.log("SQL-backed browser passed: private autosave/restore, cross-tab conflict, explicit publication, clock-skewed public reader, legacy Admin separation, scheduling/cancellation and incomplete new drafts.");
} finally { await browser.close(); await server.close(); await db.close(); }
