import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : args[rootIndex + 1]);
const channelId = `UC${"a".repeat(22)}`;
const avatarUrl = "https://yt3.googleusercontent.com/example=s160-c";
const twitchAvatar = "https://static-cdn.jtvnw.net/jtv_user_pictures/example.png";
const fixtures = [
  { position: 1, title: "Example creator", platform: "YouTube", channel_url: "https://www.youtube.com/@example", note: "Tech and projects", youtube_channel_id: channelId },
  { position: 2, title: "Another creator", platform: "Twitch", channel_url: "https://www.twitch.tv/example", note: null, youtube_channel_id: null },
];
const server = await startSiteServer(root);
const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    let creators = fixtures;
    let videoStatus = 200;
    let listStatus = 200;
    let listRequests = 0;
    let videoRequests = 0;
    let photoRequests = 0;
    let photoUnavailable = false;
    let uploadUnavailable = false;
    let imageFailure = false;
    let twitchRequests = 0;
    let twitchStatus = 200;
    let twitchLive = true;
    let twitchVideo = true;
    let twitchMalformed = false;
    const errors = [];
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (["yt3.googleusercontent.com", "static-cdn.jtvnw.net"].includes(url.hostname)) {
        photoRequests++;
        assert.equal(route.request().headers().referer, undefined);
        return imageFailure && url.hostname === "yt3.googleusercontent.com" ? route.abort() : route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        });
      }
      if (url.pathname.endsWith("/functions/v1/creator-twitch")) {
        twitchRequests++;
        return route.fulfill({
          status: twitchStatus, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ channels: [{
            login: "example", avatarUrl: twitchMalformed ? "https://evil.example/photo" : twitchAvatar, unavailable: false,
            live: twitchLive ? { title: "<script>Live stream</script>", game: "Science & Technology", startedAt: "2026-10-26T00:00:00Z" } : null,
            video: !twitchLive && twitchVideo ? { title: "Latest past broadcast", url: "https://www.twitch.tv/videos/123", publishedAt: "2026-10-25T00:00:00Z" } : null,
          }] }),
        });
      }
      if (url.pathname.includes("/rest/v1/")) {
        const isCreators = url.pathname.endsWith("/site_creators");
        if (isCreators) {
          listRequests++;
          assert.equal(url.searchParams.get("enabled"), "eq.true");
          assert.equal(url.searchParams.get("order"), "sort_order.asc,position.asc");
        }
        return route.fulfill({
          status: isCreators ? listStatus : 200, contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(isCreators ? creators : []),
        });
      }
      if (url.pathname.endsWith("/functions/v1/creator-videos")) {
        videoRequests++;
        return route.fulfill({
          status: videoStatus, contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ videos: [{
            channelId, unavailable: uploadUnavailable,
            avatarUrl: photoUnavailable ? null : `${avatarUrl}${imageFailure ? "?test=failed-image" : ""}`, photoUnavailable,
            video: uploadUnavailable ? null : { title: "<script>not executable</script> & latest upload", url: "https://www.youtube.com/watch?v=abcdefghijk", publishedAt: "2026-10-25T00:00:00Z" },
          }] }),
        });
      }
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    assert.equal(listRequests, 0, "closed feed must not query creators");
    assert.equal(videoRequests, 0, "closed feed must not fetch videos");
    assert.equal(twitchRequests, 0, "closed feed must not fetch Twitch status");
    assert.equal(photoRequests, 0, "closed feed must not request photos");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("creators"));
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("10 minutes"));
    assert.equal(await page.locator("#creators-list > li").count(), 2);
    await page.waitForFunction(() => document.querySelector(".creator-avatar img.is-loaded")?.naturalWidth === 64);
    assert.equal(await page.locator("[data-avatar-channel-id] img").getAttribute("src"), avatarUrl);
    assert.equal(await page.locator("[data-avatar-twitch-login] img").getAttribute("src"), twitchAvatar);
    assert.equal(await page.locator(".creator-avatar").last().textContent(), "AC");
    assert.equal(await page.locator("[data-channel-id] a").getAttribute("href"), "https://www.youtube.com/watch?v=abcdefghijk");
    assert.equal(await page.locator(".creator-latest script").count(), 0);
    assert.equal(await page.locator("[data-twitch-login] a").getAttribute("href"), "https://www.twitch.tv/example");
    assert.match(await page.locator("[data-twitch-login]").textContent(), /LIVE ON TWITCH/);
    assert.equal(await page.locator("[data-twitch-login] script").count(), 0);
    assert.ok(await page.locator("[data-channel-id] a").textContent().then((text) => text.includes("<script>")));
    assert.ok(await page.evaluate(() => {
      const content = document.querySelector("#creators-window .desktop-window-content");
      return content.scrollWidth <= content.clientWidth + 1;
    }), "creator feed must not overflow horizontally");
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#creators-window"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })));
    assert.deepEqual(violations, [], `${width}px creator accessibility`);
    photoUnavailable = true;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").dataset.state === "warning");
    assert.equal(await page.locator(".creator-avatar").first().textContent(), "EC");
    assert.equal(await page.locator("[data-avatar-channel-id] img").count(), 0);
    assert.equal(await page.locator("[data-channel-id] a").count(), 1, "missing photo must not remove the latest upload");
    assert.equal(await page.locator("[data-twitch-login] a").count(), 1, "YouTube photo failure must not affect Twitch");
    photoUnavailable = false;
    imageFailure = true;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("could not load"));
    assert.equal(await page.locator(".creator-avatar").first().textContent(), "EC");
    imageFailure = false;
    uploadUnavailable = true;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("[data-channel-id]")?.textContent.includes("Latest video unavailable"));
    await page.waitForFunction(() => document.querySelector("[data-avatar-channel-id] img.is-loaded")?.naturalWidth === 64);
    assert.ok((await page.locator("[data-channel-id]").textContent()).includes("Latest video unavailable"));
    uploadUnavailable = false;
    videoStatus = 503;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").dataset.state === "warning");
    assert.equal(await page.locator("#creators-list > li").count(), 2, "video outage must retain creator links");
    assert.equal(await page.locator("[data-twitch-login] a").getAttribute("href"), "https://www.twitch.tv/example");
    videoStatus = 200;
    twitchLive = false;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("[data-twitch-login] a")?.href.endsWith("/videos/123"));
    assert.match(await page.locator("[data-twitch-login]").textContent(), /OFFLINE/);
    twitchVideo = false;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("[data-twitch-login]")?.textContent.includes("No public past broadcasts"));
    twitchStatus = 503;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").dataset.state === "warning");
    assert.match(await page.locator("[data-twitch-login]").textContent(), /status unavailable/);
    assert.equal(await page.locator("[data-channel-id] a").count(), 1, "Twitch outage preserves YouTube uploads");
    twitchStatus = 200;
    twitchMalformed = true;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").dataset.state === "warning");
    assert.equal(await page.locator('[src="https://evil.example/photo"]').count(), 0);
    twitchMalformed = false;
    twitchLive = true;
    creators = [fixtures[1]];
    const before = videoRequests;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-list").children.length === 1);
    assert.equal(videoRequests, before, "Twitch-only creators need no YouTube request");
    creators = [];
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("awaiting operator"));
    listStatus = 503;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").dataset.state === "error");
    listStatus = 200;
    creators = fixtures;
    videoStatus = 200;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("10 minutes"));
    assert.deepEqual(errors, []);
    await page.goto(`${server.origin}/online/?window=creators`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("10 minutes"));
    console.log(`PASS ${width}px creator feed: lazy YouTube/Twitch photos, live links, offline VODs, no VODs, independent platform failures, safe metadata, accessibility, retry, and deep links`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/supabase-config.js") return route.fulfill({
      contentType: "text/javascript",
      body: `
        window.SUPABASE_CONFIG = { url: "https://test.example", anonKey: "test-key" };
        window.__creatorRows = [{ position: 1, title: "Original", platform: "YouTube", channel_url: "https://www.youtube.com/@example", youtube_channel_id: null, note: null, sort_order: 0, enabled: true }];
        window.createSiteSupabaseClient = () => ({
          auth: { getSession: async () => ({ data: { session: null }, error: null }) },
          functions: { invoke: async (name, options) => {
            if (!["creator-videos", "creator-twitch"].includes(name)) throw new Error("Unexpected function " + name);
            window.__lookupInput = options.body.channelUrl;
            if (window.__delayLookup) await new Promise(resolve => { window.__completeLookup = resolve; });
            return window.__lookupFailure
              ? { data: null, error: new Error("Channel lookup unavailable") }
              : { data: name === "creator-twitch"
                ? { login: "example", channelUrl: "https://www.twitch.tv/example", displayName: "Example Twitch" }
                : { channelId: "${channelId}" }, error: null };
          } },
          from(table) {
            let operation = "select", values, position;
            const query = {
              select() { return query; }, order() { return query; },
              eq(key, value) { position = value; return query; },
              insert(payload) { operation = "insert"; values = payload; return query; },
              update(payload) { operation = "update"; values = payload; return query; },
              delete() { operation = "delete"; return query; },
              then(resolve) {
                if (table !== "site_creators") throw new Error("Unexpected editor table " + table);
                if (operation === "insert") window.__creatorRows.push(values);
                if (operation === "update") Object.assign(window.__creatorRows.find(row => row.position === position), values);
                if (operation === "delete") window.__creatorRows = window.__creatorRows.filter(row => row.position !== position);
                return Promise.resolve({ data: structuredClone(window.__creatorRows), error: null }).then(resolve);
              }
            };
            return query;
          }
        });`,
    });
    return url.origin === server.origin ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let confirmReplacement = false;
  page.on("dialog", dialog => confirmReplacement ? dialog.accept() : dialog.dismiss());
  await page.goto(`${server.origin}/admin/#/creators`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await loadCreators();
    loginView.hidden = true;
    inboxView.hidden = false;
    window.dispatchEvent(new CustomEvent("admin:authenticated"));
  });
  await page.locator("#creators-entry-add").click();
  const newEntry = page.locator("#creators-slots fieldset").last();
  await newEntry.locator('[data-entry-field="title"]').fill("New creator");
  const lookup = newEntry.getByRole("button", { name: "LOOK UP YOUTUBE CHANNEL" });
  const lookupStatus = newEntry.locator('[role="status"]').first();
  await newEntry.locator('[data-entry-field="channel_url"]').fill("@example");
  await lookup.click();
  await page.waitForFunction(() => document.querySelector("#creators-slots fieldset:last-child [role=status]").dataset.state === "success");
  assert.equal(await page.evaluate(() => window.__lookupInput), "@example");
  assert.equal(await newEntry.locator('[data-entry-field="youtube_channel_id"]').inputValue(), channelId);
  assert.equal(await newEntry.locator('[data-entry-field="channel_url"]').inputValue(), `https://www.youtube.com/channel/${channelId}`);
  assert.equal(await newEntry.locator('[data-entry-field="platform"]').inputValue(), "YouTube");
  assert.equal(await page.evaluate(() => window.__creatorRows.length), 1, "lookup must not save the new entry");
  await page.evaluate(() => { window.__lookupFailure = true; });
  await lookup.click();
  await page.waitForFunction(() => document.querySelector("#creators-slots fieldset:last-child [role=status]").dataset.state === "error");
  assert.ok((await lookupStatus.textContent()).includes("Channel lookup failed"));
  assert.equal(await newEntry.locator('[data-entry-field="youtube_channel_id"]').inputValue(), channelId);
  await page.evaluate(() => { window.__lookupFailure = false; window.__delayLookup = true; });
  await lookup.click();
  await page.waitForFunction(() => typeof window.__completeLookup === "function");
  await newEntry.locator('[data-entry-field="channel_url"]').fill("https://www.twitch.tv/changed");
  await page.evaluate(() => window.__completeLookup());
  await page.waitForFunction(() => document.querySelector("#creators-slots fieldset:last-child [role=status]").dataset.state === "warning");
  assert.equal(await newEntry.locator('[data-entry-field="channel_url"]').inputValue(), "https://www.twitch.tv/changed");
  await page.evaluate(() => { window.__delayLookup = false; });
  const twitchLookup = newEntry.getByRole("button", { name: "LOOK UP TWITCH CHANNEL" });
  const twitchLookupStatus = newEntry.locator('[role="status"]').nth(1);
  await newEntry.locator('[data-entry-field="channel_url"]').fill("Example");
  await twitchLookup.click();
  assert.equal(await newEntry.locator('[data-entry-field="youtube_channel_id"]').inputValue(), channelId, "Declining Twitch replacement preserves the YouTube ID");
  confirmReplacement = true;
  await twitchLookup.click();
  await page.waitForFunction(() => document.querySelectorAll("#creators-slots fieldset:last-child [role=status]")[1].dataset.state === "success");
  assert.equal(await newEntry.locator('[data-entry-field="channel_url"]').inputValue(), "https://www.twitch.tv/example");
  assert.equal(await newEntry.locator('[data-entry-field="youtube_channel_id"]').inputValue(), "");
  assert.equal(await newEntry.locator('[data-entry-field="platform"]').inputValue(), "Twitch");
  assert.equal(await newEntry.locator('[data-entry-field="title"]').inputValue(), "New creator", "Custom creator names are preserved");
  assert.equal(await page.evaluate(() => window.__creatorRows.length), 1, "Twitch lookup does not save");
  await page.evaluate(() => { window.__lookupFailure = true; });
  await twitchLookup.click();
  assert.match(await twitchLookupStatus.textContent(), /Twitch lookup failed/);
  assert.equal(await newEntry.locator('[data-entry-field="channel_url"]').inputValue(), "https://www.twitch.tv/example");
  await page.evaluate(() => { window.__lookupFailure = false; window.__delayLookup = true; window.__completeLookup = null; });
  await twitchLookup.click();
  await page.waitForFunction(() => typeof window.__completeLookup === "function");
  await newEntry.locator('[data-entry-field="title"]').fill("Changed during Twitch lookup");
  await page.evaluate(() => window.__completeLookup());
  await page.waitForFunction(() => document.querySelectorAll("#creators-slots fieldset:last-child [role=status]")[1].dataset.state === "warning");
  assert.match(await twitchLookupStatus.textContent(), /fields changed/i);
  await page.evaluate(() => { window.__delayLookup = false; });
  await newEntry.locator('[data-entry-field="title"]').fill("");
  await twitchLookup.click();
  await page.waitForFunction(() => document.querySelectorAll("#creators-slots fieldset:last-child [role=status]")[1].dataset.state === "success");
  assert.equal(await newEntry.locator('[data-entry-field="title"]').inputValue(), "Example Twitch", "Twitch supplies a display name only for an empty name");
  await newEntry.locator('[data-entry-field="platform"]').fill("Twitch");
  await newEntry.locator('[data-entry-field="channel_url"]').fill("https://www.twitch.tv/new");
  await newEntry.locator('[data-entry-field="sort_order"]').fill("10");
  await newEntry.locator('[data-entry-field="youtube_channel_id"]').fill("@invalid");
  await newEntry.locator('[data-entry-field="enabled"]').check();
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => document.querySelector("#creators-admin-status").dataset.state === "error");
  assert.equal(await page.evaluate(() => window.__creatorRows.length), 1, "invalid IDs must not save");
  await newEntry.locator('[data-entry-field="youtube_channel_id"]').fill("");
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => document.querySelector("#creators-admin-status").textContent.startsWith("Creators updated."));
  assert.equal(await page.evaluate(() => window.__creatorRows[1].sort_order), 10);
  await page.locator("#creators-slots fieldset").first().locator('[data-entry-field="enabled"]').uncheck();
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => window.__creatorRows[0].enabled === false);
  await page.locator("#creators-slots fieldset").last().getByRole("button", { name: /Remove creator/ }).click();
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => window.__creatorRows.length === 1);
  assert.deepEqual(errors, []);
  console.log("PASS Admin creator editor: channel lookup, failure and edit races, explicit saving, validation, numeric order, hide, and remove");
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
