// Receives reports from the BitsofBits hardware agent. Callers authenticate with a
// per-machine device token issued in Admin; only its SHA-256 hash is stored.
const tokenPattern = /^sbhw_[A-Za-z0-9_-]{43}$/;
const maxBodyBytes = 32 * 1024;
const maxComponents = 60;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getServiceKey(): string | null {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) {
    return legacy;
  }
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return typeof keys.default === "string" ? keys.default : null;
  } catch {
    return null;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function readMegabytes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e8) {
    return null;
  }
  return Math.round(value);
}

function readStatus(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const status = value as Record<string, unknown>;
  const bootedAt = typeof status.booted_at === "string" ? new Date(status.booted_at) : null;
  const validBoot = bootedAt
    && !Number.isNaN(bootedAt.getTime())
    && bootedAt.getTime() <= Date.now() + 5 * 60_000
    && bootedAt.getTime() > Date.now() - 365 * 24 * 60 * 60_000;
  const memoryTotal = readMegabytes(status.memory_total_mb);
  const memoryUsed = readMegabytes(status.memory_used_mb);
  return {
    cpu_percent: readPercent(status.cpu_percent),
    gpu_percent: readPercent(status.gpu_percent),
    memory_total_mb: memoryTotal || null,
    memory_used_mb: memoryTotal && memoryUsed !== null ? Math.min(memoryUsed, memoryTotal) : null,
    booted_at: validBoot ? bootedAt.toISOString() : null,
  };
}

function readText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readComponents(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value
    .slice(0, maxComponents)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      component: readText(item.component, 40),
      name: readText(item.name, 160),
      detail: readText(item.detail, 300),
    }))
    .filter((item) => item.component && item.name);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const token = request.headers.get("x-device-token") ?? "";
  if (!tokenPattern.test(token)) {
    return jsonResponse({ error: "Missing or malformed device token." }, 401);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBodyBytes) {
    return jsonResponse({ error: "Report is too large." }, 413);
  }
  const rawBody = await request.text();
  if (rawBody.length > maxBodyBytes) {
    return jsonResponse({ error: "Report is too large." }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Report must be JSON." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Report must be a JSON object." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = getServiceKey();
  if (!url || !key) {
    return jsonResponse({ error: "Hardware sync is unavailable." }, 503);
  }
  // New-style sb_secret_ keys are not JWTs and must only be sent as the apikey header.
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) {
    headers.Authorization = "Bearer " + key;
  }

  try {
    const rpcUrl = `${url.replace(/\/$/, "")}/rest/v1/rpc`;
    const tokenHash = await sha256Hex(token);
    const machineName = readText(body.machine_name, 60);
    if (machineName && body.components !== undefined) {
      const claim = await fetch(`${rpcUrl}/hardware_agent_claim_name`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_token_hash: tokenHash, p_machine: machineName }),
      });
      if (!claim.ok) {
        console.error("Hardware name claim failed:", claim.status, await claim.text());
      }
    }
    const response = await fetch(`${rpcUrl}/hardware_agent_report`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_token_hash: tokenHash,
        p_status: readStatus(body.status),
        p_components: readComponents(body.components),
      }),
    });
    if (!response.ok) {
      console.error("Hardware report failed:", response.status, await response.text());
      return jsonResponse({ error: "Hardware sync is unavailable." }, 502);
    }
    const result = await response.json();
    if (result?.error === "invalid_token") {
      return jsonResponse({ error: "Unknown or revoked device token." }, 401);
    }
    if (result?.error === "rate_limited") {
      return jsonResponse({ error: "Reports are limited to one every 20 seconds." }, 429);
    }
    return jsonResponse(result);
  } catch (error) {
    console.error("Hardware report failed:", error);
    return jsonResponse({ error: "Hardware sync is unavailable." }, 502);
  }
});
