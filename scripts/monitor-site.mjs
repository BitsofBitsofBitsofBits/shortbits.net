import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { publicConfig } from "./build-content.mjs";
import publishing from "../publishing-status.js";

export async function monitorSite({
  origin = "https://www.shortbits.net", config, expectedCommit = "",
  fetchImpl = fetch, retryDelayMs = 5000,
  sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)),
} = {}) {
  const results = [];
  const deadline = AbortSignal.timeout(5 * 60 * 1000);
  const site = new URL(origin).origin;
  if (!config?.url || !config?.anonKey) throw new Error("Public integration configuration is required.");
  if (expectedCommit && !/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error("Expected commit must be a full Git SHA.");
  async function check(name, url, validate, options = {}) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          ...options,
          headers: { Origin: site, "Cache-Control": "no-cache", ...options.headers },
          signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = await validate(response);
        results.push({ name, ok: true, attempts: attempt });
        return value;
      } catch (error) {
        if (attempt === 2) {
          const message = error instanceof SyntaxError ? "Response is not valid JSON."
            : ["TypeError", "AbortError", "TimeoutError"].includes(error.name) ? "Request failed or timed out." : error.message;
          results.push({ name, ok: false, attempts: attempt, error: message });
          return undefined;
        }
        if (!deadline.aborted) await sleep(retryDelayMs);
      }
    }
  }
  function requireValue(condition, message) {
    if (!condition) throw new Error(message);
  }
  function requireType(response, type) {
    requireValue((response.headers.get("content-type") || "").includes(type), `Expected ${type} content.`);
  }
  const assets = new Set();
  for (const [path, marker] of [
    ["/?choose", 'class="chooser-page"'], ["/online/", 'id="interface-shell"'],
    ["/professional/", 'class="professional-page"'], ["/professional/resume/", 'class="resume'],
    ["/blog/", 'id="blog-post-list"'], ["/projects/", "<title>"],
  ]) {
    await check(`Page ${path}`, `${site}${path}`, async (response) => {
      requireType(response, "text/html");
      const html = await response.text();
      requireValue(html.includes(marker), "Expected page content is missing.");
      for (const match of html.matchAll(/(?:src|href)="(\/(?!\/)[^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)) {
        assets.add(new URL(match[1].replaceAll("&amp;", "&"), site).href);
      }
    });
  }
  await check("Build metadata", `${site}/build-info.json`, async (response) => {
    requireType(response, "application/json");
    const metadata = await response.json();
    requireValue(/^[a-f0-9]{40}$/.test(metadata.commit) && Number.isFinite(Date.parse(metadata.builtAt)), "Invalid build metadata.");
    requireValue(!expectedCommit || metadata.commit === expectedCommit, "Production is not serving the expected commit.");
  });
  const manifest = await check("Publishing snapshot", `${site}/blog/content-manifest.json?monitor=${Date.now()}`, async (response) => {
    requireType(response, "application/json");
    return publishing.validate(await response.json());
  });
  await check("RSS feed", `${site}/blog/feed.xml`, async (response) => {
    requireType(response, "xml");
    const xml = await response.text();
    requireValue(xml.includes('<rss version="2.0"') && xml.includes("</rss>"), "RSS document is missing.");
    if (manifest) {
      for (const post of manifest.posts) {
        requireValue(xml.includes(`${site}/blog/articles/${post.slug}/`), `RSS is missing article ${post.slug}.`);
      }
      requireValue((xml.match(/<item>/g) || []).length === manifest.posts.length, "RSS and publishing snapshot counts differ.");
    }
  });
  for (const post of manifest?.posts.slice(0, 3) || []) {
    await check(`Article ${post.slug}`, `${site}/blog/articles/${post.slug}/`, async (response) => {
      requireType(response, "text/html");
      const html = await response.text();
      requireValue(html.includes(`href="${site}/blog/articles/${post.slug}/"`), "Expected article canonical URL is missing.");
    });
  }
  for (const asset of assets) {
    await check(`Asset ${new URL(asset).pathname}`, asset, async (response) => {
      requireType(response, new URL(asset).pathname.endsWith(".css") ? "text/css" : "javascript");
      requireValue((await response.text()).trim().length > 20, "Asset is empty or truncated.");
    });
  }
  function requireCors(response) {
    requireValue(response.headers.get("access-control-allow-origin") === site, "Public integration CORS origin does not match the site.");
  }
  for (const name of ["spotify-now-playing", "discord-presence"]) {
    await check(`Integration ${name}`, `${config.url}/functions/v1/${name}`, async (response) => {
      requireType(response, "application/json");
      requireCors(response);
      const body = await response.json();
      requireValue(body && typeof body === "object" && !Array.isArray(body) && !body.error, "Integration returned an error payload.");
      requireValue(body.stale !== true && body.cacheStatus !== "stale"
        && !(Number(body.cacheAgeMs) > 300000), "Integration is serving stale data.");
      if (name === "spotify-now-playing") {
        requireValue(typeof body.isPlaying === "boolean"
          && (body.item === null || (body.item && typeof body.item.title === "string")), "Invalid playback response.");
      } else {
        requireValue(typeof body.enrolled === "boolean", "Invalid presence response.");
        requireValue(!body.enrolled || (["online", "idle", "dnd", "offline"].includes(body.status) && Array.isArray(body.activities)), "Invalid presence status.");
      }
    }, { headers: { apikey: config.anonKey } });
  }
  await check("Contact preflight (no message sent)", `${config.url}/functions/v1/contact-message`, async (response) => {
    requireCors(response);
    requireValue((response.headers.get("access-control-allow-methods") || "").split(",").some((method) => method.trim() === "POST"), "Contact preflight does not allow POST.");
  }, { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST" } });
  return { version: 1, checkedAt: new Date().toISOString(), origin: site, ok: results.every((result) => result.ok), checks: results };
}

export function reportMarkdown(report) {
  const safe = (text) => String(text).replace(/[|<>\r\n]/g, " ").replace(/`/g, "'");
  return [
    `## Site health: ${report.ok ? "healthy" : "checks failing"}`,
    "", `Checked ${report.checkedAt}. Public read-only probes; no contact message was sent.`,
    "", "| Check | Result | Attempts | Detail |", "| --- | --- | --- | --- |",
    ...report.checks.map((check) => `| ${safe(check.name)} | ${check.ok ? "PASS" : "FAIL"} | ${check.attempts} | ${safe(check.error || "")} |`),
    "", "Scope: public pages and their linked CSS/JS, build metadata, publishing snapshot, RSS, up to three static articles, Spotify and Discord HTTP integrations, and contact CORS preflight.",
    "This does not verify email delivery, Turnstile solving, authenticated admin operations, or browser/WebSocket behavior.", "",
  ].join("\n");
}

export function sshSiteFetch({ target, port = "22", origin = "https://www.shortbits.net", execute = promisify(execFile), fetchImpl = fetch }) {
  if (!/^[^\s@]+@[^\s@]+$/.test(target || "") || !/^\d+$/.test(port)
    || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("SSH monitoring requires a user@host target and a valid port.");
  }
  const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
  return async (url, options) => {
    if (new URL(url).origin !== new URL(origin).origin) return fetchImpl(url, options);
    options.signal.throwIfAborted();
    if (options.method && options.method !== "GET") throw new Error("SSH site probes only support GET.");
    const command = [
      "curl", "--silent", "--show-error", "--compressed", "--max-time", "15",
      "--proto", "=https", "--dump-header", "/dev/stderr",
      ...Object.entries(options.headers).flatMap(([name, value]) => ["--header", `${name}: ${value}`]),
      "--url", url,
    ].map(quote).join(" ");
    let output;
    try {
      output = await execute("ssh", [
        "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10",
        "-p", String(port), "--", target, command,
      ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 20000, signal: options.signal });
    } catch (error) {
      // execFile errors include stdout/stderr; never put response bodies or SSH
      // host details into a public outage report.
      throw new Error("SSH HTTPS probe failed or timed out. Check the host's SSH access and curl installation.", { cause: error });
    }
    const blocks = output.stderr.split(/\r?\n\r?\n/).filter((block) => /^HTTP\/[\d.]+[ \t]+\d{3}/m.test(block));
    const last = blocks.at(-1);
    if (!last) throw new Error("SSH probe did not return valid HTTP response headers.");
    const lines = last.slice(last.search(/^HTTP\//m)).split(/\r?\n/);
    const status = Number(/^HTTP\/[\d.]+[ \t]+(\d{3})/.exec(lines.shift())[1]);
    const headers = new Headers();
    for (const line of lines) {
      const colon = line.indexOf(":");
      if (colon > 0) headers.append(line.slice(0, colon), line.slice(colon + 1).trim());
    }
    return new Response([204, 205, 304].includes(status) ? null : output.stdout, { status, headers });
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2).filter((argument) => argument !== "--ssh");
  if (args.length !== 2 || args[0] !== "--output" || !args[1]) throw new Error("Usage: node scripts/monitor-site.mjs --output report.json [--ssh]");
  const output = resolve(args[1]);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  // Use the same checked-in public configuration as the deployed clients.
  const config = await publicConfig(root);
  const fetchImpl = process.argv.includes("--ssh") ? sshSiteFetch({
    target: process.env.SITE_MONITOR_SSH_TARGET, port: process.env.SITE_MONITOR_SSH_PORT || "22",
  }) : fetch;
  const report = await monitorSite({ config, expectedCommit: process.env.SITE_EXPECTED_COMMIT || "", fetchImpl });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(`${output}.md`, reportMarkdown(report));
  console.log(reportMarkdown(report));
  if (!report.ok) process.exitCode = 1;
}
