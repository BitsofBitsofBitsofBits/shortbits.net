const maxBodyBytes = 4096;
const tokenPattern = /^sbyt_[0-9a-f]{64}$/;

function respond(request: Request, body: unknown, status = 200): Response {
  const origin = request.headers.get("origin") ?? "";
  return Response.json(body, { status, headers: {
    "Access-Control-Allow-Origin": ["https://shortbits.net", "https://www.shortbits.net"].includes(origin) ? origin : "*",
    "Access-Control-Allow-Headers": "apikey, content-type, x-device-token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

function validItem(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(item.videoId)
    && typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 300
    && typeof item.channel === "string" && item.channel.trim().length > 0 && item.channel.length <= 200
    && typeof item.isPlaying === "boolean"
    && Number.isInteger(item.progressMs) && Number(item.progressMs) >= 0 && Number(item.progressMs) <= 2_147_483_647
    && Number.isInteger(item.durationMs) && Number(item.durationMs) >= 0 && Number(item.durationMs) <= 2_147_483_647;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return respond(request, null, 200);
  if (!["GET", "POST"].includes(request.method)) return respond(request, { error: "Method not allowed." }, 405);
  try {
    const projectUrl = Deno.env.get("SUPABASE_URL");
    let key = Deno.env.get(request.method === "POST" ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY");
    if (!key && request.method === "POST") {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
      key = typeof keys.default === "string" ? keys.default : undefined;
    }
    if (!projectUrl || !key) {
      console.error("YouTube presence database credentials are missing.");
      return respond(request, { error: "YouTube presence is not configured." }, 503);
    }
    let rpc = "read_youtube_presence";
    let body: object = {};
    if (request.method === "POST") {
      const token = request.headers.get("x-device-token") ?? "";
      if (!tokenPattern.test(token)) return respond(request, { error: "Missing or invalid device token." }, 401);
      if (Number(request.headers.get("content-length")) > maxBodyBytes) return respond(request, { error: "Report is too large." }, 413);
      const reader = request.body?.getReader();
      if (!reader) return respond(request, { error: "Report must be JSON." }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBodyBytes) {
          await reader.cancel();
          return respond(request, { error: "Report is too large." }, 413);
        }
        chunks.push(value);
      }
      const raw = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
      let report;
      try { report = JSON.parse(new TextDecoder().decode(raw)); }
      catch { return respond(request, { error: "Report must be JSON." }, 400); }
      if (!report || typeof report !== "object" || !("item" in report)
        || (report.item !== null && !validItem(report.item))) {
        return respond(request, { error: "Invalid YouTube playback report." }, 400);
      }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      rpc = "report_youtube_presence";
      body = { p_token_hash: hash, p_item: report.item };
    }
    const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
    if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(`${projectUrl}/rest/v1/rpc/${rpc}`, {
      method: "POST", headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000), redirect: "error",
    });
    if (!response.ok) throw new Error(`Presence database returned HTTP ${response.status}.`);
    const data = await response.json();
    if (data?.error === "invalid_token") return respond(request, { error: "Device token was revoked or is invalid." }, 401);
    return respond(request, data);
  } catch (error) {
    console.error("YouTube presence request failed:", error instanceof Error ? error.message : "Unknown error");
    return respond(request, { error: "YouTube presence is temporarily unavailable." }, 502);
  }
});
