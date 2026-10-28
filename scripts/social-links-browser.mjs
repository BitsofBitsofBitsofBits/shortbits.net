import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const index = process.argv.indexOf("--root");
const root = resolve(index < 0 ? "." : process.argv[index + 1]);
const source = { window: {} };
vm.runInNewContext(await readFile(new URL("../shared/scripts/social-links.js", import.meta.url), "utf8"), source);
const defaults = JSON.parse(JSON.stringify(source.window.SocialLinks.defaults));
const server = await startSiteServer(root);
const browser = await chromium.launch({
  ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
});
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    let rows = [
      { ...defaults[0], label: 'Edited <social>', url: "https://example.com/edited", sort_order: 2 },
      { ...defaults[7], sort_order: 1, image_url: "/shared/images/youtube.svg" },
      { ...defaults[3], professional: false, personal: true, sort_order: 3 },
    ];
    await context.route("**/rest/v1/**", route => route.fulfill({
      status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(route.request().url().includes("/site_social_links?") ? rows : []),
    }));
    await context.route(/cloudflareinsights|challenges\.cloudflare|lanyard\.rest/, route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const [path, selector, expected] of [
      ["/online/", "#link-grid a", ["LINKEDIN", "Edited <social>", "BLUESKY"]],
      ["/professional/", ".profile-overview [data-social-links] a", ["LINKEDIN", "Edited <social>"]],
    ]) {
      await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count,
        { selector, count: expected.length });
      assert.deepEqual(await page.locator(`${selector} .link-title`).allTextContents(), expected);
      assert.equal(await page.locator(selector).first().locator("img").getAttribute("src"), "/shared/images/youtube.svg");
      assert.equal(await page.locator(selector).nth(1).getAttribute("href"), "https://example.com/edited");
      assert.equal(await page.locator(`${selector} .link-title img`).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      const saved = rows;
      rows = [];
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForFunction(selector => document.querySelectorAll(selector).length === 0, selector);
      if (path === "/online/") assert.equal(await page.locator("#link-count").textContent(), "00 NODES");
      else assert.equal(await page.locator(".profile-overview [data-social-links]").isVisible(), false);
      rows = saved;
    }
    console.log(`PASS ${width}px public social links: edits, icons, order, per-site visibility, empty state, no overflow`);

    await page.route("**/shared/scripts/supabase-config.js*", route => route.fulfill({
      contentType: "text/javascript",
      body: `
        window.SUPABASE_CONFIG = {url:"https://test.example",anonKey:"test-public-key"};
        window.__socialRows = ${JSON.stringify(defaults.slice(0, 2))};
        window.createSiteSupabaseClient = () => ({
          auth: { getSession: async () => ({data:{session:null},error:null}) },
          from(table) {
            let operation = "select", payload;
            const filters = [];
            const query = {
              select(){return query}, order(){return query}, limit(){return query}, range(){return query},
              eq(key,value){filters.push(row=>row[key]===value);return query},
              insert(value){operation="insert";payload=value;return query},
              update(value){operation="update";payload=value;return query},
              delete(){operation="delete";return query},
              then(done) {
                if(window.__socialFailure) return Promise.resolve({error:{message:"Simulated failure"}}).then(done);
                let selected = table === "site_social_links" ? window.__socialRows.filter(row=>filters.every(filter=>filter(row))) : [];
                if(operation==="insert") window.__socialRows.push(payload);
                if(operation==="update") selected.forEach(row=>Object.assign(row,payload));
                if(operation==="delete") window.__socialRows=window.__socialRows.filter(row=>!selected.includes(row));
                return Promise.resolve({data:structuredClone(table === "site_social_links" ? window.__socialRows : []),error:null}).then(done);
              }
            }; return query;
          }
        });
      `,
    }));
    await page.goto(`${server.origin}/admin/#/social-links`, { waitUntil: "networkidle" });
    page.on("dialog", dialog => dialog.accept());
    await page.evaluate(async () => {
      loginView.hidden = true;
      inboxView.hidden = false;
      window.dispatchEvent(new CustomEvent("admin:authenticated"));
      await loadSocialLinks();
    });
    await page.waitForFunction(() => !document.querySelector("#social-links-submit").disabled);
    const field = (row, key) => page.locator(`#social-link-slots fieldset:nth-child(${row}) [data-entry-field="${key}"]`);
    await field(1, "label").fill("Updated GitHub");
    await field(1, "icon").selectOption("bluesky");
    await field(1, "sort_order").fill("20");
    await field(1, "personal").uncheck();
    await field(1, "professional").check();
    await field(1, "new_tab").uncheck();
    await page.locator("#social-links-submit").click();
    await page.waitForFunction(() => document.querySelector("#social-links-status").textContent.startsWith("Social links saved."));
    const first = await page.evaluate(() => window.__socialRows[0]);
    assert.equal(first.label, "Updated GitHub");
    assert.equal(first.icon, "bluesky");
    assert.equal(first.sort_order, 20);
    assert.equal(first.personal, false);
    assert.equal(first.professional, true);
    assert.equal(first.new_tab, false);
    await page.locator("#social-link-add").click();
    await field(3, "label").fill("New site");
    await field(3, "url").fill("/blog/");
    await field(3, "icon_text").fill("NS");
    await field(3, "image_url").fill("/shared/images/github.svg");
    await field(3, "enabled").check();
    assert.equal(await page.locator("#social-link-slots fieldset").nth(2).locator(".social-link-preview img").getAttribute("src"), "/shared/images/github.svg");
    await page.locator("#social-links-submit").click();
    await page.waitForFunction(() => window.__socialRows.length === 3);
    await field(3, "url").fill("javascript:alert(1)");
    await page.locator("#social-links-submit").click();
    assert.equal(await page.locator("#social-links-status").getAttribute("data-state"), "error");
    assert.equal(await page.evaluate(() => window.__socialRows[2].url), "/blog/");
    await field(3, "url").fill("/blog/");
    await field(3, "enabled").uncheck();
    await page.locator("#social-links-submit").click();
    await page.waitForFunction(() => window.__socialRows[2].enabled === false);
    await page.locator("#social-link-slots fieldset").nth(2).locator(".repeatable-entry-remove").click();
    await page.locator("#social-links-submit").click();
    await page.waitForFunction(() => window.__socialRows.length === 2);
    await page.evaluate(() => { window.__socialFailure = true; });
    await field(1, "label").fill("Must not save");
    await page.locator("#social-links-submit").click();
    await page.waitForFunction(() => document.querySelector("#social-links-status").textContent.includes("Simulated failure"));
    assert.equal(await page.locator("#social-links-submit").isDisabled(), true);
    await page.evaluate(() => { window.__socialFailure = false; });
    await page.evaluate(() => loadSocialLinks());
    assert.equal(await field(1, "label").inputValue(), "Updated GitHub");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px Admin social links: real add/edit/save/delete, icon preview, visibility, order, validation, drafts, failed-save recovery`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
