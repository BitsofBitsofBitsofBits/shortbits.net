type Item = { title: string; series: string | null; season: number | null; episode: number | null;
  durationMs: number; progressMs: number; isPlaying: boolean };
function userId(value: unknown): string | null {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value)) return null;
  const id = value.replaceAll("-", "").toLowerCase();
  return /^0+$/.test(id) ? null : id;
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function validItem(value: unknown): value is Item {
  if (!record(value) || Object.keys(value).sort().join(",") !== "durationMs,episode,isPlaying,progressMs,season,series,title") return false;
  return typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= 300
    && (value.series === null || typeof value.series === "string" && value.series.trim().length > 0 && value.series.length <= 200)
    && [value.season, value.episode].every(number => number === null || Number.isInteger(number) && Number(number) >= 0 && Number(number) <= 9999)
    && typeof value.isPlaying === "boolean"
    && [value.durationMs, value.progressMs].every(number => Number.isInteger(number) && Number(number) >= 0 && Number(number) <= 2_147_483_647)
    && (value.durationMs === 0 || Number(value.progressMs) <= Number(value.durationMs));
}
function validState(state: unknown, item: unknown): boolean {
  return state === "playing" || state === "paused"
    ? validItem(item) && item.isPlaying === (state === "playing")
    : typeof state === "string" && ["idle", "expired", "unavailable"].includes(state) && item === null;
}
function respond(request: Request, body: unknown, status = 200): Response {
  const origin = request.headers.get("origin") ?? "";
  return Response.json(body, { status, headers: {
    "Access-Control-Allow-Origin": ["https://shortbits.net", "https://www.shortbits.net"].includes(origin) ? origin : "*",
    "Access-Control-Allow-Headers": "apikey, content-type, x-device-token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
async function tokenMatches(token: string, expected: string): Promise<boolean> {
  if (!/^sbjf_[a-f0-9]{64}$/.test(token)) return false;
  const hashes = await Promise.all([token, expected].map(value => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
  const first = new Uint8Array(hashes[0]), second = new Uint8Array(hashes[1]);
  let difference = 0;
  for (let i = 0; i < first.length; i++) difference |= first[i] ^ second[i];
  return difference === 0;
}
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new Error("oversized"); }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(data));
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return respond(request, null);
  if (!["GET", "POST"].includes(request.method)) return respond(request, { error: "Method not allowed." }, 405);
  const owner = userId(Deno.env.get("JELLYFIN_USER_ID"));
  const token = Deno.env.get("JELLYFIN_INGEST_TOKEN") ?? "";
  if (!owner || !/^sbjf_[a-f0-9]{64}$/.test(token)) {
    console.error("JELLYFIN_CONFIGURATION_UNAVAILABLE");
    return respond(request, { error: "Jellyfin presence is not configured." }, 503);
  }
  try {
    let rpc = "read_jellyfin_presence";
    let body: Record<string, unknown> = { p_user_id: owner };
    if (request.method === "POST") {
      if (!await tokenMatches(request.headers.get("x-device-token") ?? "", token)) return respond(request, { error: "Invalid collector token." }, 401);
      let payload;
      try { payload = await readBody(request); }
      catch (error) { return respond(request, { error: "Invalid Jellyfin report." }, error instanceof Error && error.message === "oversized" ? 413 : 400); }
      if (!record(payload) || Object.keys(payload).sort().join(",") !== "item,state,userId"
        || userId(payload.userId) !== owner || !validState(payload.state, payload.item)) {
        return respond(request, { error: "Invalid or non-owner Jellyfin report." }, 400);
      }
      rpc = "report_jellyfin_presence";
      body = { p_user_id: owner, p_state: payload.state, p_item: payload.item };
    }
    const project = Deno.env.get("SUPABASE_URL");
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? keys.default;
    if (!project || typeof key !== "string" || !key) throw new Error("configuration");
    const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
    if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(`${project}/rest/v1/rpc/${rpc}`, {
      method: "POST", headers, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("database");
    const result = await response.json();
    if (request.method === "POST") {
      if (result?.ok !== true) throw new Error("database");
      return respond(request, { ok: true });
    }
    if (!record(result) || !validState(result.state, result.item)) throw new Error("database");
    if (result.updatedAt !== null && typeof result.updatedAt !== "string"
      || result.expiresAt !== null && typeof result.expiresAt !== "string") throw new Error("database");
    const updatedAt = result.updatedAt === null ? null : Date.parse(result.updatedAt);
    const expiresAt = result.expiresAt === null ? null : Date.parse(result.expiresAt);
    if (updatedAt !== null && (!Number.isFinite(updatedAt) || expiresAt === null || !Number.isFinite(expiresAt)
      || expiresAt - updatedAt !== 90_000 || updatedAt > Date.now() + 30_000)
      || updatedAt === null && (expiresAt !== null || result.state !== "idle" || result.item !== null)) throw new Error("database");
    const expired = expiresAt !== null && expiresAt <= Date.now();
    // Construct the public response; never forward database rows or owner identifiers.
    const item = !expired && validItem(result.item) ? result.item : null;
    return respond(request, { state: expired ? "expired" : result.state,
      item: item ? { title: item.title, series: item.series, season: item.season, episode: item.episode,
        durationMs: item.durationMs, progressMs: item.progressMs, isPlaying: item.isPlaying } : null,
      updatedAt: updatedAt === null ? null : new Date(updatedAt).toISOString(),
      expiresAt: expiresAt === null ? null : new Date(expiresAt).toISOString() });
  } catch {
    console.error("JELLYFIN_PRESENCE_REQUEST_FAILED");
    return respond(request, { error: "Jellyfin presence is temporarily unavailable." }, 502);
  }
});
