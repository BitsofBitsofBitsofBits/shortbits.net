import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { monitorSite, reportMarkdown, sshSiteFetch } from "./monitor-site.mjs";

const site = "https://www.shortbits.net";
const config = { url: "https://example.supabase.co", anonKey: "sb_publishable_test" };
const commit = "a".repeat(40);
const manifest = { version: 1, generatedAt: "2026-10-22T12:00:00Z", posts: [{ slug: "notes", fingerprint: "b".repeat(64) }] };
const json = (value, headers = {}) => new Response(JSON.stringify(value), {
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": site, ...headers },
});
function healthy(url, options) {
  const path = new URL(url).pathname;
  if (path.endsWith(".css")) return new Response("body{color:green;background:black}", { headers: { "Content-Type": "text/css" } });
  if (path.endsWith(".js")) return new Response('console.log("Healthy public asset");', { headers: { "Content-Type": "application/javascript" } });
  if (path === "/build-info.json") return json({ commit, builtAt: manifest.generatedAt });
  if (path === "/blog/content-manifest.json") return json(manifest);
  if (path === "/blog/feed.xml") return new Response(`<rss version="2.0"><channel><item><link>${site}/blog/articles/notes/</link></item></channel></rss>`, { headers: { "Content-Type": "application/xml" } });
  if (path.endsWith("spotify-now-playing")) return json({ isPlaying: false, item: null, cacheAgeMs: 0, sessionStartedAt: null });
  if (path.endsWith("discord-presence")) return json({ enrolled: true, status: "offline", activities: [], cacheAgeMs: 0 });
  if (path.endsWith("contact-message")) {
    assert.equal(options.method, "OPTIONS");
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": site, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }
  return new Response(`<html><body class="chooser-page"><div id="interface-shell"></div><div class="professional-page"></div><div class="resume-page"></div><div id="blog-post-list"></div><title>Site</title><link href="${site}/blog/articles/notes/"><link href="/site.css?v=123"><script src="/site.js?v=123"></script></body></html>`, { headers: { "Content-Type": "text/html" } });
}
const run = (fetchImpl, extra = {}) => monitorSite({ config, fetchImpl, retryDelayMs: 0, sleep: async () => {}, ...extra });

test("health checks cover public pages, linked assets, content, and integrations without mutations", async () => {
  const calls = [];
  const report = await run((url, options) => {
    calls.push({ url, options });
    return healthy(url, options);
  }, { expectedCommit: commit });
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 15);
  assert.ok(calls.every(({ options }) => !options.method || options.method === "OPTIONS"));
  assert.equal(calls.filter(({ url }) => new URL(url).pathname === "/site.css").length, 1);
  assert.ok(calls.filter(({ url }) => url.startsWith(config.url) && !url.endsWith("contact-message"))
    .every(({ options }) => options.headers.apikey === config.anonKey && options.headers.Origin === site));
  assert.doesNotMatch(JSON.stringify(report), /sb_publishable_test|Authorization|customStatus/);
});

test("transient failures retry once and permanent failures are explicit", async () => {
  let attempts = 0;
  const report = await run((url, options) => {
    if (new URL(url).pathname === "/online/" && attempts++ === 0) return new Response("unavailable", { status: 503 });
    if (new URL(url).pathname === "/site.css") return new Response("not found", { status: 404 });
    return healthy(url, options);
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find((check) => check.name === "Page /online/").attempts, 2);
  assert.deepEqual(report.checks.find((check) => check.name === "Asset /site.css"), {
    name: "Asset /site.css", ok: false, attempts: 2, error: "HTTP 404",
  });
});

test("monitor rejects wrong builds, success-shaped HTML errors, stale integrations, and broken CORS", async () => {
  const report = await run((url, options) => {
    const path = new URL(url).pathname;
    if (path === "/online/") return new Response("<html>Not found</html>", { headers: { "Content-Type": "text/html" } });
    if (path.endsWith("spotify-now-playing")) return json({ isPlaying: false, item: null, cacheStatus: "stale" });
    if (path.endsWith("discord-presence")) return json({ enrolled: true, status: "online", activities: [] }, { "Access-Control-Allow-Origin": "https://wrong.example" });
    return healthy(url, options);
  }, { expectedCommit: "c".repeat(40) });
  assert.deepEqual(report.checks.filter((check) => !check.ok).map((check) => check.name), [
    "Page /online/", "Build metadata", "Integration spotify-now-playing", "Integration discord-presence",
  ]);
});

test("malformed snapshots, missing feed entries, and malformed integration payloads fail", async () => {
  const report = await run((url, options) => {
    const path = new URL(url).pathname;
    if (path === "/blog/content-manifest.json") return json({ ...manifest, posts: [{ slug: "../escape" }] });
    if (path === "/blog/feed.xml") return new Response("<html>feed</html>", { headers: { "Content-Type": "text/html" } });
    if (path.endsWith("spotify-now-playing")) return json({ ok: true });
    if (path.endsWith("discord-presence")) return json({ enrolled: true, status: "invalid", activities: [] });
    return healthy(url, options);
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.filter((check) => !check.ok).length, 4);
  const mismatch = await run((url, options) => new URL(url).pathname === "/blog/feed.xml"
    ? new Response('<rss version="2.0"></rss>', { headers: { "Content-Type": "application/xml" } })
    : healthy(url, options));
  assert.equal(mismatch.checks.find((check) => check.name === "RSS feed").ok, false);
});

test("reports never retain JSON parse payloads or live integration data", async () => {
  const report = await run((url, options) => new URL(url).pathname.endsWith("discord-presence")
    ? new Response("private activity payload", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": site } })
    : healthy(url, options));
  assert.equal(report.ok, false);
  assert.doesNotMatch(JSON.stringify(report), /private activity payload/);
  assert.match(reportMarkdown(report), /Response is not valid JSON/);
  assert.match(reportMarkdown(report), /no contact message was sent/);
});

test("SSH transport preserves final HTTP status, quotes commands, and keeps integrations on direct HTTP", async () => {
  const calls = [];
  let integrationCalls = 0;
  const fetchImpl = sshSiteFetch({
    target: "monitor@example.test", port: "2222",
    execute: async (file, args, options) => {
      calls.push({ file, args, options });
      return {
        stdout: "Forbidden",
        stderr: "HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 403\r\nContent-Type: text/html\r\nX-Test: value:with:colons\r\n\r\n",
      };
    },
    fetchImpl: (url, options) => {
      integrationCalls += 1;
      assert.equal(options.headers.apikey, config.anonKey);
      return healthy(url, options);
    },
  });
  const options = { headers: { Origin: site, "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(1000) };
  const response = await fetchImpl(`${site}/online/?q=a'b`, options);
  assert.equal(response.status, 403);
  assert.equal(await response.text(), "Forbidden");
  assert.equal(response.headers.get("x-test"), "value:with:colons");
  assert.equal(calls[0].file, "ssh");
  assert.ok(calls[0].args.includes("StrictHostKeyChecking=yes"));
  assert.ok(calls[0].args.includes("2222"));
  assert.ok(calls[0].args.at(-1).includes("a'\\''b"));
  await fetchImpl(`${config.url}/functions/v1/spotify-now-playing`, { ...options, headers: { apikey: config.anonKey } });
  assert.equal(integrationCalls, 1);
  const aborted = AbortSignal.abort();
  await assert.rejects(fetchImpl(`${site}/online/`, { ...options, signal: aborted }));
  assert.equal(calls.length, 1);
  await assert.rejects(fetchImpl(`${site}/online/`, { ...options, method: "POST" }), /only support GET/);
});

test("SSH failures and malformed responses cannot leak host details or appear healthy", async () => {
  const options = { headers: {}, signal: AbortSignal.timeout(1000) };
  const failed = sshSiteFetch({
    target: "monitor@example.test",
    execute: async () => { throw new Error("Private SSH host and response details"); },
  });

  await assert.rejects(failed(`${site}/`, options), (error) => {
    assert.match(error.message, /SSH HTTPS probe failed/);
    assert.doesNotMatch(error.message, /Private/);
    return true;
  });
  const malformed = sshSiteFetch({
    target: "monitor@example.test", execute: async () => ({ stdout: "body", stderr: "no headers" }),
  });
  await assert.rejects(malformed(`${site}/`, options), /valid HTTP response headers/);
  for (const value of [{ target: "" }, { target: "user@host", port: "0" }, { target: "user@host", port: "65536" }]) {
    assert.throws(() => sshSiteFetch(value), /valid port/);
  }
});

test("post-deployment monitoring explicitly forwards its required SSH secrets", async () => {
  const caller = await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8");
  const reusable = await readFile(new URL("../.github/workflows/monitor.yml", import.meta.url), "utf8");
  const health = caller.split("\n  health:")[1].split("\n  lighthouse:")[0];
  for (const name of ["DEPLOY_SSH_KEY", "DEPLOY_KNOWN_HOSTS", "DEPLOY_USER", "DEPLOY_HOST"]) {
    assert.ok(health.includes(`${name}: \${{ secrets.${name} }}`), `${name} must be forwarded by the caller`);
    assert.match(reusable, new RegExp(`${name}:\\s+required: true`), `${name} must be required by the reusable workflow`);
  }
});

test("public media session functions are deployed automatically with the configured project and gateway settings", async () => {
  const workflow = (await readFile(new URL("../.github/workflows/site.yml", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const supabase = workflow.split("\n  supabase:")[1].split("\n  deploy:")[0];
  for (const name of ["spotify-now-playing", "youtube-presence"]) {
    const step = supabase.split("- name:").find(value => value.includes(`supabase functions deploy ${name}\n`));
    assert.ok(step, `${name} must be included in the automatic deploy job`);
    assert.ok(step.includes("if: steps.credentials.outputs.ready == 'true'"));
    assert.ok(step.includes('--project-ref "$SUPABASE_PROJECT_REF"'));
    assert.ok(step.includes("--no-verify-jwt"));
    assert.ok(step.includes("--use-api"));
  }
});

test("monitor rejects missing or failed Spotify sessions but accepts inactive and paused sessions", async () => {
  for (const [payload, expected] of [
    [{ isPlaying: false, item: null }, false],
    [{ isPlaying: true, item: { title: "Playing" } }, false],
    [{ isPlaying: true, item: { title: "Playing" }, sessionStartedAt: null }, false],
    [{ isPlaying: false, item: null, sessionStartedAt: null, sessionTrackingUnavailable: true }, false],
    [{ isPlaying: true, item: { title: "Playing" }, sessionStartedAt: "invalid" }, false],
    [{ isPlaying: false, item: null, sessionStartedAt: null }, true],
    [{ isPlaying: true, item: { title: "Playing" }, sessionStartedAt: "2026-10-28T06:00:00Z" }, true],
    [{ isPlaying: false, item: { title: "Paused" }, sessionStartedAt: "2026-10-28T06:00:00Z" }, true],
  ]) {
    const report = await run((url, options) => new URL(url).pathname.endsWith("spotify-now-playing")
      ? json(payload) : healthy(url, options));
    const check = report.checks.find(check => check.name === "Integration spotify-now-playing");
    assert.equal(check.ok, expected, JSON.stringify(payload));
    if (!expected) assert.match(check.error, /Spotify session timing is unavailable or missing/);
  }
});
