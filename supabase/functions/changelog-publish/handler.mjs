import { readBoundedJson, record, validatePayload, validateResult } from "./validation.mjs";

function respond(status, body) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
async function tokenMatches(token, expectedHash) {
  if (!/^sbcg_[a-f0-9]{64}$/.test(token)) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  let difference = 0;
  for (let index = 0; index < 32; index++) difference |= digest[index] ^ Number.parseInt(expectedHash.slice(index * 2, index * 2 + 2), 16);
  return difference === 0;
}
export function createHandler({ env, fetch: fetcher = globalThis.fetch, now = Date.now }) {
  return async request => {
    if (request.method !== "POST") return respond(405, { error: "Method not allowed." });
    let project, key, hash;
    try {
      hash = env("CHANGELOG_PUBLISH_TOKEN_SHA256") ?? "";
      project = new URL(env("SUPABASE_URL"));
      key = env("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(env("SUPABASE_SECRET_KEYS") ?? "{}").default;
      if (!/^[a-f0-9]{64}$/.test(hash) || project.protocol !== "https:" || project.username || project.password
        || project.pathname !== "/" || project.search || project.hash || typeof key !== "string" || !key.trim()) throw new Error();
    } catch { return respond(503, { error: "Publisher configuration unavailable." }); }
    if (!await tokenMatches(request.headers.get("x-changelog-publish-token") ?? "", hash)) return respond(401, { error: "Invalid publisher credential." });
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return respond(415, { error: "JSON required." });
    let payload;
    try { payload = validatePayload(await readBoundedJson(request.body)); }
    catch (error) { return respond(error instanceof Error && error.message === "oversized" ? 413 : 400, { error: "Invalid publication request." }); }
    try {
      const live = await fetcher(`https://www.shortbits.net/build-info.json?changelog_verify=${now()}`, {
        method: "GET", headers: { "Cache-Control": "no-cache", Accept: "application/json" },
        redirect: "error", signal: AbortSignal.timeout(10_000),
      });
      if (!live.ok) throw new Error();
      const metadata = await readBoundedJson(live.body, 4096);
      if (!record(metadata) || typeof metadata.commit !== "string" || !/^[a-f0-9]{40}$/.test(metadata.commit)) throw new Error();
      if (metadata.commit !== payload.source_commit) return respond(409, { error: "Source revision is not live." });
    } catch { return respond(502, { error: "Live revision verification unavailable." }); }
    try {
      const headers = { apikey: key, "Content-Type": "application/json" };
      if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
      const upstream = await fetcher(`${project.origin}/rest/v1/rpc/publish_site_changelog`, {
        method: "POST", headers, body: JSON.stringify({ p_payload: payload }),
        redirect: "error", signal: AbortSignal.timeout(10_000),
      });
      if (!upstream.ok) {
        let code;
        try { code = (await readBoundedJson(upstream.body, 4096))?.code; } catch { /* Discard private upstream errors. */ }
        if (code === "23505") return respond(409, { error: "Release ID conflicts with a prior publication." });
        if (code === "22023") return respond(400, { error: "Publication or requested version rejected." });
        if (code === "55000") return respond(409, { error: "No established site version." });
        throw new Error();
      }
      const result = validateResult(await readBoundedJson(upstream.body, 4096), payload);
      return respond(200, { ok: true, release_id: result.release_id, version: result.version,
        published_at: result.published_at, positions: result.positions, idempotent: result.idempotent });
    } catch { return respond(502, { error: "Publication unavailable; retry the same release ID." }); }
  };
}
