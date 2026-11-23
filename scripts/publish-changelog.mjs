import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { MAX_BODY_BYTES, readBoundedJson, validatePayload, validateRelease, validateResult } from "../supabase/functions/changelog-publish/validation.mjs";

export async function publishChangelog({ file, env = process.env, fetch: fetcher = globalThis.fetch }) {
  const token = env.CHANGELOG_PUBLISH_TOKEN ?? "";
  let endpoint;
  try { endpoint = new URL(env.CHANGELOG_PUBLISH_URL); } catch { throw new Error("Publisher endpoint configuration required."); }
  if (endpoint.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(endpoint.hostname)
    || endpoint.port || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
    || endpoint.pathname !== "/functions/v1/changelog-publish") throw new Error("Invalid publisher endpoint configuration.");
  if (!/^sbcg_[a-f0-9]{64}$/.test(token)) throw new Error("Scoped publisher credential required.");
  if (!file || (await stat(file)).size > MAX_BODY_BYTES) throw new Error("Reviewed release file missing or oversized.");
  let payload;
  try {
    const release = validateRelease(JSON.parse(await readFile(file, "utf8")));
    payload = validatePayload({ ...release, source_commit: env.GITHUB_SHA,
      run_url: `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` });
  } catch { throw new Error("Invalid reviewed release or GitHub run context."); }
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error("Publication request oversized.");
  let response;
  try {
    response = await fetcher(endpoint.href, { method: "POST", headers: {
      "Content-Type": "application/json", "X-Changelog-Publish-Token": token,
    }, body, redirect: "error", signal: AbortSignal.timeout(30_000) });
  } catch { throw new Error("Publisher request failed; retry the same reviewed release."); }
  if (!response.ok) throw new Error(`Publisher rejected request (HTTP ${response.status}); retry only after resolving the failure.`);
  try { return validateResult(await readBoundedJson(response.body, 4096), payload); }
  catch { throw new Error("Invalid publisher response; retry the same reviewed release."); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--file") throw new Error("Usage: node scripts/publish-changelog.mjs --file releases/changelog.json");
    const result = await publishChangelog({ file: process.argv[3] });
    console.log(`Changelog ${result.idempotent ? "already published" : "published"}: ${result.release_id}; version ${result.version}; ${result.positions.length} entries.`);
  } catch {
    console.error("CHANGELOG_PUBLICATION_FAILED: check configuration, reviewed input, live revision and publisher status. Retry the same release ID; never rotate it to bypass a failure.");
    process.exitCode = 1;
  }
}
