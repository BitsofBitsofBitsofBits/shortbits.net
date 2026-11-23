import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";
import { chooseTheme } from "./theme-picker-helpers.mjs";

const rootIndex = process.argv.indexOf("--root");
const server = await startSiteServer(resolve(rootIndex < 0 ? "." : process.argv[rootIndex + 1]));
const screenshotIndex = process.argv.indexOf("--screenshots");
const screenshots = screenshotIndex < 0 ? null : resolve(process.argv[screenshotIndex + 1]);
if (screenshots) await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const errors = [];
    let publishedFixture = null;
    await context.addInitScript(() => {
      window.__fixture = {
        row: { id: "fixture", slug: "fixture-post", title: "Fixture article", excerpt: "Private local fixture", body_markdown: "# Preserved\n\nHello **writer**.", body_rich: null, published: false, published_at: null, updated_at: "2026-11-23T00:00:00Z" },
        denied: false, fail: false, saves: [], fetches: 0,
      };
      const saved = sessionStorage.getItem("writer-fixture-row");
      if (saved) window.__fixture.row = JSON.parse(saved);
      window.__writerClient = {
        storage: { from: () => ({ upload: async () => ({ error: { message: "Fixture upload denied" } }) }) },
        auth: {
          getSession: async () => ({ data: { session: window.__fixture.denied || location.pathname === "/admin/" ? null : { user: { id: "local-fixture" } } } }),
          getUser: async () => ({ data: { user: { id: "local-fixture" } } }),
          onAuthStateChange: callback => { window.__signOut = () => callback("SIGNED_OUT"); },
        },
        from() {
          window.__fixture.fetches++;
          let payload;
          return {
            select() { return this; }, eq() { return this; },
            update(value) { payload = value; return this; }, insert(value) { payload = value; return this; },
            async single() {
              if (window.__fixture.fail) return { error: { message: "Fixture conflict", code: "PGRST116" } };
              if (payload) {
                window.__fixture.saves.push(payload);
                window.__fixture.row = { ...window.__fixture.row, ...payload };
                sessionStorage.setItem("writer-fixture-row", JSON.stringify(window.__fixture.row));
              }
              return { data: structuredClone(window.__fixture.row) };
            },
          };
        },
      };
    });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.hostname === "cdn.jsdelivr.net") return route.fulfill({ contentType: "application/javascript", body: "window.supabase={createClient:()=>window.__writerClient};" });
      if (url.pathname.endsWith("/rest/v1/site_blog_posts")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(publishedFixture ? [publishedFixture] : []),
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const formatCommand = async name => {
      await page.getByRole("button", { name: "Format", exact: true }).click();
      await page.getByRole("button", { name, exact: true }).click();
      assert.equal(await page.locator("#writer-format-dialog").isVisible(), false);
    };
    const assertCompact = async () => {
      const layout = await page.evaluate(() => {
        const toolbar = document.querySelector(".writer-toolbar");
        return {
          header: document.querySelector(".writer-header").getBoundingClientRect().height,
          settings: document.querySelector(".writer-settings").getBoundingClientRect().height,
          toolbar: toolbar.getBoundingClientRect().height,
          rows: new Set([...toolbar.children].map(node => Math.round(node.getBoundingClientRect().top))).size,
          articleTop: document.querySelector(".writer-article").getBoundingClientRect().top + scrollY,
        };
      });
      assert.ok(layout.header <= (width > 600 ? 64 : 110), JSON.stringify(layout));
      assert.ok(layout.settings <= (width > 800 ? 100 : 150), JSON.stringify(layout));
      assert.ok(layout.toolbar <= (width > 600 ? 64 : 120), JSON.stringify(layout));
      assert.ok(layout.rows <= (width > 600 ? 1 : 2), JSON.stringify(layout));
      assert.ok(layout.articleTop < (width > 600 ? 250 : 400), JSON.stringify(layout));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      return layout;
    };
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/admin/blog-writer/?post=fixture`);
    await page.getByText("Original Markdown preserved.", { exact: false }).first().waitFor();
    await formatCommand("Import original Markdown");
    await page.getByText("Formatted copy imported.", { exact: false }).waitFor();
    await page.getByRole("textbox", { name: "Article body", exact: true }).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("New visual text");
    await page.keyboard.press("Control+Shift+ArrowLeft");
    await formatCommand("Highlight");
    await page.getByRole("button", { name: "Format", exact: true }).click();
    await page.selectOption("#writer-font", "serif");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+s");
    await page.getByText("Draft saved. It is not published.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__fixture.saves[0].body_markdown), "# Preserved\n\nHello **writer**.");
    assert.equal(await page.evaluate(() => window.__fixture.saves[0].body_rich.version), 1);
    assert.match(await page.evaluate(() => JSON.stringify(window.__fixture.saves[0].body_rich)), /"font":"serif"/);
    assert.equal(await page.evaluate(() => window.__fixture.saves[0].published), false);
    assert.match(await page.locator(".tiptap").textContent(), /New visual text/);
    publishedFixture = await page.evaluate(() => ({ ...window.__fixture.row, published: true, published_at: "2026-11-01T00:00:00Z" }));
    const reader = await context.newPage();
    await reader.goto(`${server.origin}/blog/post.html?slug=fixture-post`);
    await reader.locator("#blog-post-body").filter({ hasText: "New visual text" }).waitFor();
    publishedFixture.body_rich = { version: 1, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Updated live rich body" }] }] } };
    await reader.evaluate(() => window.dispatchEvent(new Event("focus")));
    await reader.getByText("Updated live rich body", { exact: true }).waitFor();
    publishedFixture = null;
    await reader.evaluate(() => window.dispatchEvent(new Event("focus")));
    await reader.getByText("That post does not exist or is not published.", { exact: true }).waitFor();
    assert.equal(await reader.locator("#blog-post").isVisible(), false);
    await reader.close();
    await page.getByRole("textbox", { name: "Article body", exact: true }).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await formatCommand("Checklist");
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    await page.keyboard.type("Task fixture");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await formatCommand("Table");
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    await page.keyboard.type("Table fixture");
    await formatCommand("Add row");
    await page.getByRole("button", { name: "Save post", exact: true }).click();
    await page.getByText("Draft saved. It is not published.", { exact: true }).waitFor();
    assert.match(await page.evaluate(() => JSON.stringify(window.__fixture.row.body_rich)), /taskItem/);
    assert.match(await page.evaluate(() => JSON.stringify(window.__fixture.row.body_rich)), /tableRow/);
    const taskLayout = await page.locator('.tiptap [data-type="taskItem"]').first().evaluate(item => {
      const box = item.querySelector("input").getBoundingClientRect();
      const text = item.querySelector("p").getBoundingClientRect();
      return { overlap: box.right > text.left, verticalGap: Math.abs((box.top + box.bottom - text.top - text.bottom) / 2) };
    });
    assert.equal(taskLayout.overlap, false);
    assert.ok(taskLayout.verticalGap < 24, "Checklist control and text remain on the same row");
    await page.getByRole("button", { name: "Image", exact: true }).click();
    await page.locator("#writer-value").fill("javascript:alert(1)");
    await page.locator("#writer-alt").fill("Safe alt text");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator("#writer-dialog-error").filter({ hasText: "Unsafe article URL." }).waitFor();
    await page.locator("#writer-file").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: Buffer.from("local test fixture") });
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator("#writer-dialog-error").filter({ hasText: "Image upload failed: Fixture upload denied" }).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.evaluate(() => { window.__fixture.fail = true; });
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unsaved title");
    await page.getByRole("button", { name: "Save post", exact: true }).click();
    await page.getByText("Save failed: Fixture conflict", { exact: false }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Unsaved title");
    page.once("dialog", async dialog => { assert.equal(dialog.type(), "confirm"); await dialog.dismiss(); });
    await page.getByRole("link", { name: "Back to Admin", exact: true }).click();
    assert.match(page.url(), /blog-writer/);
    assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Unsaved title");
    await page.evaluate(() => { window.__fixture.fail = false; });
    await page.getByRole("button", { name: "Save post", exact: true }).click();
    await page.getByText("Draft saved. It is not published.", { exact: true }).waitFor();
    await page.reload();
    await page.getByText("Ready to write.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Unsaved title");
    await page.getByRole("button", { name: "Theme settings", exact: true }).click();
    const preferences = await page.evaluate(() => JSON.stringify(localStorage));
    await page.selectOption("#writer-scheme", "light");
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), preferences);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#writer-theme-open").getAttribute("aria-expanded") === "false");
    assert.equal(await page.locator("#writer-theme-dialog").isVisible(), false);
    assert.equal(await page.locator("#writer-theme-open").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#writer-theme-open").evaluate(node => node === document.activeElement), true);
    await page.addScriptTag({ path: createRequire(import.meta.url).resolve("axe-core/axe.min.js") });
    const issues = await page.evaluate(async () => (await axe.run(document)).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(issues.filter(v => ["serious", "critical"].includes(v.impact)), []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow at ${width}`);
    const baselineLayout = await assertCompact();
    await page.getByRole("button", { name: "Format", exact: true }).click();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      assert.equal(await page.locator("#writer-format-dialog").evaluate(node => node.contains(document.activeElement)), true);
    }
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-format-popup-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#writer-format-open").evaluate(node => node === document.activeElement), true);
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Theme settings", exact: true }).click();
    await chooseTheme(page, page.locator(".theme-picker"), "aero-glass", "rose");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.interfaceTheme), "aero-glass");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.themeVariant), "rose");
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), preferences);
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-theme-popup-${width}.png`), fullPage: true });
    await page.locator("#writer-theme-dialog [data-writer-close]").click();
    const themedLayout = await assertCompact();
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-themed-${width}.png`), fullPage: true });
    for (const theme of ["windows-95", "terminal"]) {
      await page.getByRole("button", { name: "Theme settings", exact: true }).click();
      await chooseTheme(page, page.locator(".theme-picker"), theme);
      await page.mouse.click(1, 1);
      assert.equal(await page.locator("#writer-theme-dialog").isVisible(), false);
      await assertCompact();
    }
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), preferences);
    console.log(`Compact writer ${width}px: ${JSON.stringify({ baselineLayout, themedLayout })}`);
    await page.evaluate(() => window.__signOut());
    assert.equal(await page.locator("#writer-workspace").isVisible(), false);
    assert.equal(await page.locator(".tiptap").count(), 0);
    assert.deepEqual(errors, []);
    await page.evaluate(() => sessionStorage.setItem("writer-fixture-row", JSON.stringify({
      id: "unsupported", slug: "unsupported-post", title: "Unsupported source", excerpt: "Fixture", body_markdown: "{{font:display|Keep my custom font}}", body_rich: null, published: false, updated_at: "2026-11-23T00:00:00Z",
    })));
    await page.goto(`${server.origin}/admin/blog-writer/?post=unsupported`);
    await page.getByText("Original Markdown preserved.", { exact: false }).first().waitFor();
    await formatCommand("Import original Markdown");
    await page.getByText("Some original formatting cannot be imported exactly.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Save post", exact: true }).click();
    await page.getByText("Draft saved. It is not published.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__fixture.row.body_rich.doc.content[0].attrs.source), "{{font:display|Keep my custom font}}");
    assert.equal(await page.evaluate(() => window.__fixture.row.body_markdown), "{{font:display|Keep my custom font}}");
    const parent = await context.newPage();
    parent.on("pageerror", error => errors.push(`Admin: ${error.message}`));
    await parent.goto(`${server.origin}/admin/#/blog`);
    await parent.evaluate(() => {
      loginView.hidden = true; inboxView.hidden = false;
      const form = document.querySelector("#blog-post-form");
      for (let node = form; node && node !== document.body; node = node.parentElement) { node.hidden = false; node.inert = false; }
      for (const [name, value] of Object.entries({ id: "fixture", title: "Unsaved Admin title", slug: "admin-draft", excerpt: "Transferred privately", body_markdown: "Unsaved **Admin** source" })) form.elements[name].value = value;
    });
    assert.deepEqual(errors, []);
    assert.equal(await parent.evaluate(() => Boolean(adminClient)), true);
    const [popup] = await Promise.all([parent.waitForEvent("popup"), parent.locator("#blog-writer-open").click()]);
    await popup.getByText("Original Markdown preserved.", { exact: false }).first().waitFor();
    assert.equal(await popup.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Unsaved Admin title");
    assert.match(await popup.locator(".writer-legacy-block").textContent(), /Unsaved Admin source/);
    assert.doesNotMatch(popup.url(), /Unsaved|Transferred|source/);
    await parent.locator('#blog-post-form [name="title"]').fill("Newer independent Admin edits");
    await popup.getByRole("button", { name: "Save post", exact: true }).click();
    await popup.getByText("Draft saved. It is not published.", { exact: true }).waitFor();
    await parent.getByText("Your separate Admin edits were preserved", { exact: false }).waitFor();
    assert.equal(await parent.locator('#blog-post-form [name="title"]').inputValue(), "Newer independent Admin edits");
    await popup.close(); await parent.close();
    await context.close();
  }
  const denied = await browser.newContext();
  await denied.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "cdn.jsdelivr.net") return route.fulfill({ contentType: "application/javascript", body: "window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};" });
    return url.origin === server.origin ? route.continue() : route.abort();
  });
  const page = await denied.newPage();
  await page.goto(`${server.origin}/admin/blog-writer/?post=private-fixture`);
  await page.getByText("Sign in through Admin before opening the writer.", { exact: true }).waitFor();
  assert.equal(await page.locator("#writer-workspace").isVisible(), false);
  assert.equal(await page.locator(".tiptap").count(), 0);
  await denied.close();
  console.log("Writer fixtures passed: visual import, edits, save/reload, failure retention, responsive themes, sign-out and unauthenticated access.");
} finally { await browser.close(); await server.close(); }
