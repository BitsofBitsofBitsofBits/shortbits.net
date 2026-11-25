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
        denied: false, fail: false, saves: [], fetches: 0, history: [], revision: 0,
      };
      const saved = sessionStorage.getItem("writer-fixture-row");
      if (saved) window.__fixture.row = JSON.parse(saved);
      window.__fixture.live = structuredClone(window.__fixture.row);
      const snapshot = () => Object.fromEntries(["title", "slug", "excerpt", "body_markdown", "body_rich", "published_at"].map(key => [key, window.__fixture.row[key] ?? (key === "body_rich" || key === "published_at" ? null : "")]));
      const state = () => ({
        draft_id: window.__fixture.row.id, post_id: window.__fixture.row.id,
        version: window.__fixture.row.draft_version || null, revision: window.__fixture.revision,
        snapshot: snapshot(), base_public_version: window.__fixture.row.updated_at,
        live: { ...window.__fixture.live }, scheduled_at: window.__fixture.scheduled_at || null, has_unpublished_changes: true,
      });
      const persist = (payload, requestId, reason) => {
        const f = window.__fixture; f.revision++;
        f.row = { ...f.row, ...structuredClone(payload), draft_version: crypto.randomUUID() };
        if (reason) f.history.unshift({ id: crypto.randomUUID(), revision: f.revision, created_at: new Date().toISOString(), reason, title: payload.title, snapshot: structuredClone(payload) });
        sessionStorage.setItem("writer-fixture-row", JSON.stringify(f.row));
        return { data: { ...state(), request_id: requestId } };
      };
      window.__writerClient = {
        storage: { from: () => ({ upload: async () => ({ error: { message: "Fixture upload denied" } }) }) },
        auth: {
          getSession: async () => ({ data: { session: window.__fixture.denied || location.pathname === "/admin/" ? null : { user: { id: "local-fixture" } } } }),
          getUser: async () => ({ data: { user: { id: "local-fixture" } } }),
          onAuthStateChange: callback => { window.__signOut = () => callback("SIGNED_OUT"); },
        },
        rpc(name, args = {}) {
          const promise = (async () => {
            const f = window.__fixture;
            if (name === "load_blog_draft") { f.fetches++; return { data: state() }; }
            if (name === "list_blog_editor_entries") return { data: [state()] };
            if (name === "list_blog_draft_history") return { data: structuredClone(f.history) };
            if (name === "get_blog_draft_revision") return { data: structuredClone(f.history.find(row => row.id === args.p_revision_id)) };
            if (f.fail || args.p_expected_version !== (f.row.draft_version || null)) return { error: { message: "Fixture conflict", code: "40001" } };
            if (name === "save_blog_draft") {
              f.saves.push(structuredClone(args.p_snapshot));
              return persist(args.p_snapshot, args.p_request_id, args.p_checkpoint || !f.history.length ? "manual" : null);
            }
            if (name === "restore_blog_draft_revision") return persist(f.history.find(row => row.id === args.p_revision_id).snapshot, args.p_request_id, "restore");
            if (name === "publish_blog_draft") {
              if (args.p_expected_public_version !== f.live.updated_at) return { error: { code: "40001", message: "Live version conflict" } };
              if (Date.parse(f.row.published_at) > Date.now()) f.scheduled_at = f.row.published_at;
              else f.live = { ...f.row, published: true, published_at: f.row.published_at || new Date().toISOString() };
              return persist(snapshot(), args.p_request_id, "publish");
            }
            if (name === "cancel_blog_draft_schedule") { f.scheduled_at = null; return persist(snapshot(), args.p_request_id, "manual"); }
            if (name === "unpublish_blog_draft") { f.live.published = false; return persist(snapshot(), args.p_request_id, "manual"); }
            throw new Error(`Unexpected fixture RPC: ${name}`);
          })();
          promise.abortSignal = () => promise;
          return promise;
        },
        from() {
          window.__fixture.fetches++;
          let payload;
          return {
            select() { return this; }, eq() { return this; }, order() { return this; },
            async range() { return { data: window.__fixture.live.published ? [window.__fixture.live] : [] }; },
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
      if (url.pathname.endsWith("/rest/v1/site_blog_public_posts")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(publishedFixture ? [publishedFixture] : []),
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const waitForSaved = async () => {
      await page.waitForFunction(() => {
        const status = document.querySelector("#writer-status");
        return status.dataset.state === "error" || status.textContent === "Private draft saved. The live article is unchanged.";
      });
      assert.equal(await page.locator("#writer-status").textContent(), "Private draft saved. The live article is unchanged.");
    };
    const formatCommand = async name => {
      const button = page.getByRole("button", { name, exact: true, includeHidden: true });
      const menu = await button.evaluate(node => node.closest(".writer-dropdown")?.id);
      if (menu) await page.locator(`#${menu} > summary`).click();
      await button.click();
      if (menu) assert.equal(await page.locator(`#${menu}`).evaluate(node => node.open), false);
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
      assert.ok(layout.toolbar <= (width > 600 ? 64 : 176), JSON.stringify(layout));
      assert.ok(layout.rows <= (width > 600 ? 1 : 3), JSON.stringify(layout));
      assert.ok(layout.articleTop < (width > 600 ? 250 : 455), JSON.stringify(layout));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      return layout;
    };
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/admin/blog-writer/?post=fixture`);
    await page.getByText("Original Markdown preserved.", { exact: false }).first().waitFor();
    await formatCommand("Import original Markdown");
    await page.getByText("Formatted copy imported into the private draft.", { exact: false }).waitFor();
    await page.getByRole("textbox", { name: "Article body", exact: true }).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("New visual text");
    await page.keyboard.press("Control+Shift+ArrowLeft");
    await formatCommand("Highlight");
    await formatCommand("Strikethrough");
    await page.selectOption("#writer-font", "serif");
    await page.keyboard.press("Control+s");
    await waitForSaved();
    assert.equal(await page.evaluate(() => window.__fixture.saves[0].body_markdown), "# Preserved\n\nHello **writer**.");
    assert.equal(await page.evaluate(() => window.__fixture.saves[0].body_rich.version), 1);
    assert.match(await page.evaluate(() => JSON.stringify(window.__fixture.saves[0].body_rich)), /"font":"serif"/);
    assert.equal(await page.evaluate(() => Object.hasOwn(window.__fixture.saves.at(-1), "published")), false);
    assert.match(await page.locator(".tiptap").textContent(), /New visual text/);
    await page.getByRole("button", { name: "Link", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Text shown", exact: true }).inputValue(), "text");
    await page.getByRole("textbox", { name: "Link", exact: true }).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator("#writer-dialog-error").filter({ hasText: "Unsafe article URL." }).waitFor();
    await page.getByRole("textbox", { name: "Link", exact: true }).fill("https://example.com/original");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator('.tiptap a[href="https://example.com/original"]').click();
    await page.getByRole("button", { name: "Link", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Text shown", exact: true }).inputValue(), "text");
    assert.equal(await page.getByRole("textbox", { name: "Link", exact: true }).inputValue(), "https://example.com/original");
    await page.getByRole("textbox", { name: "Link", exact: true }).fill("https://example.com/revised");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await waitForSaved();
    const marks = await page.evaluate(() => {
      const nodes = [];
      function visit(node) { if (node.text === "text") nodes.push(node); node.content?.forEach(visit); }
      visit(window.__fixture.row.body_rich.doc);
      return nodes[0].marks.map(mark => mark.type);
    });
    for (const mark of ["link", "style", "strike", "highlight"]) assert.ok(marks.includes(mark), `URL edits preserve ${mark}`);
    await page.locator('.tiptap a[href="https://example.com/revised"]').click();
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await page.getByRole("textbox", { name: "Text shown", exact: true }).fill("Read more");
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-link-dialog-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("textbox", { name: "Article body", exact: true }).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await page.getByRole("textbox", { name: "Link", exact: true }).fill("https://example.com/new");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator("#writer-dialog-error").filter({ hasText: "Enter the text shown" }).waitFor();
    await page.getByRole("textbox", { name: "Text shown", exact: true }).fill("<em>Literal text</em>");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    assert.equal(await page.locator('.tiptap a[href="https://example.com/new"]').textContent(), "<em>Literal text</em>");
    assert.equal(await page.locator('.tiptap a[href="https://example.com/new"] em').count(), 0);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await waitForSaved();
    await page.reload();
    await page.getByText("Autosave ready.", { exact: false }).waitFor();
    assert.equal(await page.locator('.tiptap a[href="https://example.com/revised"]').textContent(), "Read more");
    assert.equal(await page.locator('.tiptap a[href="https://example.com/new"]').textContent(), "<em>Literal text</em>");
    publishedFixture = await page.evaluate(() => ({ ...window.__fixture.row, published: true, published_at: "2026-11-01T00:00:00Z" }));
    const reader = await context.newPage();
    await reader.goto(`${server.origin}/blog/post.html?slug=fixture-post`);
    await reader.locator("#blog-post-body").filter({ hasText: "Read more" }).waitFor();
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
    await page.keyboard.type("Custom color fixture");
    await page.keyboard.press("Control+Shift+ArrowLeft");
    await formatCommand("Bold");
    await page.selectOption("#writer-font", "serif");
    const coloredText = page.locator(".tiptap span").filter({ hasText: /^fixture$/ });
    for (const [color, rendered] of [
      ["red", "blog-text-color-red"], ["#ff8800", "rgb(255, 136, 0)"],
      ["yellow", "blog-text-color-yellow"], ["green", "blog-text-color-green"],
      ["blue", "blog-text-color-blue"], ["#4b0082", "rgb(75, 0, 130)"],
      ["#8f00ff", "rgb(143, 0, 255)"], ["purple", "blog-text-color-purple"],
      ["rainbow", "blog-text-color-rainbow"],
    ]) {
      await page.locator("#writer-style > summary").click();
      await page.selectOption("#writer-color", color);
      assert.equal(await page.locator("#writer-style").evaluate(node => node.open), false);
      assert.equal(await coloredText.evaluate(node => node.style.color || node.className), rendered);
    }
    const beforePicker = await page.locator(".tiptap").innerHTML();
    await page.locator("#writer-style > summary").click();
    await page.selectOption("#writer-color", "custom");
    const picker = page.getByLabel("Custom text color", { exact: true });
    assert.equal(await picker.evaluate(node => node.type), "color");
    assert.equal(await picker.evaluate(node => node === document.activeElement), true);
    await picker.fill("#123456");
    const hexField = page.getByLabel("Hex color", { exact: true });
    assert.equal(await hexField.inputValue(), "#123456");
    await hexField.fill("#ggg");
    await page.getByRole("button", { name: "Apply color", exact: true }).click();
    assert.match(await page.locator("#writer-custom-color-error").textContent(), /Enter RGB/);
    assert.equal(await page.locator(".tiptap").innerHTML(), beforePicker);
    await hexField.fill("123456");
    assert.equal(await picker.inputValue(), "#123456");
    assert.equal(await page.locator(".tiptap").innerHTML(), beforePicker);
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-custom-color-${width}.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".tiptap").innerHTML(), beforePicker);
    assert.equal(await page.locator("#writer-style > summary").evaluate(node => node === document.activeElement), true);
    await page.locator("#writer-style > summary").click();
    await page.getByRole("button", { name: "Apply color", exact: true }).click();
    assert.equal(await page.locator("#writer-style").evaluate(node => node.open), false);
    assert.equal(await coloredText.evaluate(node => node.style.color), "rgb(18, 52, 86)");
    await page.keyboard.press("Control+s");
    await waitForSaved();
    const savedColor = await page.evaluate(() => {
      const nodes = [];
      function visit(node) { if (node.text === "fixture") nodes.push(node); node.content?.forEach(visit); }
      visit(window.__fixture.row.body_rich.doc);
      return nodes[0];
    });
    assert.ok(savedColor.marks.some(mark => mark.type === "bold"));
    assert.deepEqual(savedColor.marks.find(mark => mark.type === "style").attrs, { color: "#123456", font: "serif", size: null });
    await page.reload();
    await page.getByText("Autosave ready.", { exact: false }).waitFor();
    await coloredText.click();
    await page.locator("#writer-style > summary").click();
    assert.equal(await page.locator("#writer-color").inputValue(), "custom");
    assert.equal(await picker.inputValue(), "#123456");
    await page.keyboard.press("Escape");
    publishedFixture = await page.evaluate(() => ({ ...window.__fixture.row, published: true, published_at: "2026-11-01T00:00:00Z" }));
    const colorReader = await context.newPage();
    await colorReader.goto(`${server.origin}/blog/post.html?slug=fixture-post`);
    await colorReader.locator("#blog-post-body").filter({ hasText: "Custom color fixture" }).waitFor();
    assert.equal(await colorReader.locator("#blog-post-body span").filter({ hasText: /^fixture$/ }).evaluate(node => node.style.color), "rgb(18, 52, 86)");
    await colorReader.close();
    for (const [savedHex, pickerHex] of [["#1234", "#112233"], ["#ABCDEF77", "#abcdef"]]) {
      await page.evaluate(hex => {
        function visit(node) {
          if (node.text === "fixture") node.marks.find(mark => mark.type === "style").attrs.color = hex;
          node.content?.forEach(visit);
        }
        visit(window.__fixture.row.body_rich.doc);
        sessionStorage.setItem("writer-fixture-row", JSON.stringify(window.__fixture.row));
      }, savedHex);
      await page.reload();
      await page.getByText("Autosave ready.", { exact: false }).waitFor();
      await coloredText.click();
      await page.locator("#writer-style > summary").click();
      assert.equal(await picker.inputValue(), pickerHex);
      assert.equal(await hexField.inputValue(), savedHex.toLowerCase());
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+s");
      await waitForSaved();
      assert.match(await page.evaluate(() => JSON.stringify(window.__fixture.row.body_rich)), new RegExp(`"color":"${savedHex}"`));
    }
    await coloredText.dblclick();
    await page.locator("#writer-style > summary").click();
    await hexField.fill("ABCD");
    assert.equal(await picker.inputValue(), "#aabbcc");
    await hexField.press("Enter");
    assert.equal(await coloredText.evaluate(node => node.style.color), "rgba(170, 187, 204, 0.867)");
    await page.keyboard.press("Control+s");
    await waitForSaved();
    assert.match(await page.evaluate(() => JSON.stringify(window.__fixture.row.body_rich)), /"color":"#abcd"/);
    await page.locator("#writer-style > summary").click();
    await picker.fill("#123456");
    assert.equal(await hexField.inputValue(), "#123456dd");
    await hexField.fill("#123456");
    await page.getByRole("button", { name: "Apply color", exact: true }).click();
    await page.getByRole("textbox", { name: "Article body", exact: true }).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    for (const level of [1, 2, 3, 4, 5, 6]) {
      await page.keyboard.type(`Heading fixture ${level}`);
      await page.locator("#writer-structure > summary").click();
      await page.selectOption("#writer-heading", String(level));
      await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
      assert.equal(await page.locator("#writer-structure").evaluate(node => node.open), false);
      assert.equal(await page.locator(`.tiptap h${level}`).filter({ hasText: `Heading fixture ${level}` }).count(), 1,
        `H${level}: ${await page.locator(".tiptap").innerHTML()}`);
      assert.equal(await page.locator("#writer-heading").inputValue(), String(level));
      await page.locator("#writer-structure > summary").click();
      await page.selectOption("#writer-heading", String(level));
      await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
      assert.equal(await page.locator(`.tiptap h${level}`).filter({ hasText: `Heading fixture ${level}` }).count(), 1);
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
    }
    await page.keyboard.type("Paragraph fixture");
    await page.locator("#writer-structure > summary").click();
    await page.selectOption("#writer-heading", "6");
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    await page.locator("#writer-structure > summary").click();
    await page.selectOption("#writer-heading", "");
    await page.waitForFunction(() => document.activeElement?.classList.contains("tiptap"));
    assert.equal(await page.locator(".tiptap p").filter({ hasText: "Paragraph fixture" }).count(), 1);
    await page.keyboard.press("Control+s");
    await waitForSaved();
    const headings = await page.evaluate(() => window.__fixture.row.body_rich.doc.content.filter(node =>
      node.type === "heading" && node.content?.some(child => child.text?.startsWith("Heading fixture"))));
    assert.deepEqual(headings.map(node => node.attrs.level), [1, 2, 3, 4, 5, 6]);
    for (const heading of headings) assert.equal(heading.content[0].marks.find(mark => mark.type === "style").attrs.font, "serif");
    await page.reload();
    await page.getByText("Autosave ready.", { exact: false }).waitFor();
    for (const level of [1, 2, 3, 4, 5, 6]) {
      await page.locator(`.tiptap h${level}`).filter({ hasText: `Heading fixture ${level}` }).click();
      assert.equal(await page.locator("#writer-heading").inputValue(), String(level));
    }
    publishedFixture = await page.evaluate(() => ({ ...window.__fixture.row, published: true, published_at: "2026-11-01T00:00:00Z" }));
    const headingReader = await context.newPage();
    await headingReader.goto(`${server.origin}/blog/post.html?slug=fixture-post`);
    for (const level of [1, 2, 3, 4, 5, 6]) await headingReader.locator("#blog-post-body").getByRole("heading", { level, name: `Heading fixture ${level}`, exact: true }).waitFor();
    await headingReader.close();
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
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await waitForSaved();
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
    await page.evaluate(() => { window.__fixture.live = { ...structuredClone(window.__fixture.row), published: true, published_at: "2026-11-01T00:00:00Z" }; });
    const beforePrivateEdit = await page.evaluate(() => structuredClone(window.__fixture.live));
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Private autosaved revision");
    await waitForSaved();
    assert.deepEqual(await page.evaluate(() => window.__fixture.live), beforePrivateEdit, "Autosave leaves all live content and metadata unchanged");
    assert.equal(await page.evaluate(() => window.__fixture.row.title), "Private autosaved revision");
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.locator("#writer-history-list button").first().click();
    await page.getByText("Preview only. Restore to draft does not publish.", { exact: true }).waitFor();
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-private-history-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Restore to draft", exact: true }).click();
    await page.getByText("Revision restored to the private draft.", { exact: false }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__fixture.live), beforePrivateEdit, "Restore leaves the live article unchanged");
    assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(), beforePrivateEdit.title);
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Explicitly published revision");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Publish revision", exact: true }).click();
    await page.getByText("Revision published. Live readers use this version.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__fixture.live.title), "Explicitly published revision");
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#writer-history-dialog").open);
    assert.equal(await page.locator("#writer-history-open").evaluate(node => node === document.activeElement), true);
    await page.evaluate(() => { window.__fixture.fail = true; });
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unsaved title");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText("Draft save failed: Fixture conflict", { exact: false }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Unsaved title");
    page.once("dialog", async dialog => { assert.equal(dialog.type(), "confirm"); await dialog.dismiss(); });
    await page.getByRole("link", { name: "Back to Admin", exact: true }).click();
    assert.match(page.url(), /blog-writer/);
    assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Unsaved title");
    await page.evaluate(() => { window.__fixture.fail = false; });
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Reload latest draft", exact: true }).click();
    await page.getByText("Autosave ready.", { exact: false }).waitFor();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unsaved title");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await waitForSaved();
    await page.reload();
    await page.getByText("Autosave ready.", { exact: false }).waitFor();
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
    await page.locator("#writer-structure > summary").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("combobox", { name: "Heading level", exact: true }).evaluate(node => node === document.activeElement), true);
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-format-popup-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#writer-structure").evaluate(node => node.open), false);
    assert.equal(await page.locator("#writer-structure > summary").evaluate(node => node === document.activeElement), true);
    await page.locator("#writer-structure > summary").click();
    await page.locator("#writer-style > summary").click();
    assert.equal(await page.locator("#writer-structure").evaluate(node => node.open), false);
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `writer-style-dropdown-${width}.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    assert.equal(await page.locator("#writer-style").evaluate(node => node.open), false);
    assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).evaluate(node => node === document.activeElement), true);
    await page.locator("#writer-structure > summary").click();
    await page.locator(".writer-header h1").click();
    assert.equal(await page.locator("#writer-structure").evaluate(node => node.open), false);
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
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await waitForSaved();
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
    await popup.waitForFunction(() => document.querySelector("#writer-title")?.value === "Unsaved Admin title");
    assert.equal(await popup.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Unsaved Admin title");
    assert.match(await popup.locator(".writer-legacy-block").textContent(), /Unsaved Admin source/);
    assert.doesNotMatch(popup.url(), /Unsaved|Transferred|source/);
    await parent.locator('#blog-post-form [name="title"]').fill("Newer independent Admin edits");
    await popup.getByRole("button", { name: "Save draft", exact: true }).click();
    await popup.getByText("Private draft saved. The live article is unchanged.", { exact: true }).waitFor();
    await parent.getByText("Your separate Admin edits remain here", { exact: false }).waitFor();
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
