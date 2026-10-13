const allowedOrigins = new Set([
  "https://www.shortbits.net",
  "https://shortbits.net",
  "null",
]);
const presenceCacheTtlMs = 30_000;

let cachedPresence: Record<string, unknown> | null = null;
let cachedPresenceAt = 0;
let presenceRequestInFlight: Promise<Record<string, unknown>> | null = null;

interface SanitizedActivity {
  name: string;
  details: string | null;
  state: string | null;
  type: number | null;
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://www.shortbits.net",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": status === 200
        ? "public, max-age=0, s-maxage=30, stale-while-revalidate=30"
        : "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizeActivity(activity: Record<string, unknown>): SanitizedActivity {
  return {
    name: typeof activity.name === "string" ? activity.name : "Unknown activity",
    details: typeof activity.details === "string" ? activity.details : null,
    state: typeof activity.state === "string" ? activity.state : null,
    type: typeof activity.type === "number" ? activity.type : null,
  };
}

async function fetchPresence(): Promise<Record<string, unknown>> {
  const discordUserId = Deno.env.get("DISCORD_USER_ID");
  if (!discordUserId || !/^\d{17,20}$/.test(discordUserId)) {
    throw new Error("DISCORD_USER_ID is missing or invalid.");
  }

  const response = await fetch(`https://api.lanyard.rest/v1/users/${discordUserId}`, {
    headers: { "Accept": "application/json" },
  });
  const payload = await response.json();

  if (response.status === 404) {
    return { enrolled: false };
  }
  if (!response.ok || payload.success !== true || !payload.data) {
    throw new Error(`Lanyard returned HTTP ${response.status}.`);
  }

  const data = payload.data;
  const activities: SanitizedActivity[] = Array.isArray(data.activities)
    ? data.activities.map(sanitizeActivity)
    : [];
  const customStatus = activities.find((activity) => activity.type === 4);
  const publicActivities = activities.filter((activity) => (
    activity.type !== 4 && activity.name !== "Spotify"
  ));
  return {
    enrolled: true,
    userId: discordUserId,
    status: typeof data.discord_status === "string"
      ? data.discord_status
      : "offline",
    customStatus: customStatus?.state ?? null,
    activities: publicActivities,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "GET") {
    return jsonResponse(request, { error: "Method not allowed." }, 405);
  }

  if (cachedPresence && Date.now() - cachedPresenceAt < presenceCacheTtlMs) {
    return jsonResponse(request, {
      ...cachedPresence,
      cacheAgeMs: Date.now() - cachedPresenceAt,
    });
  }

  if (!presenceRequestInFlight) {
    presenceRequestInFlight = fetchPresence().finally(() => {
      presenceRequestInFlight = null;
    });
  }

  try {
    cachedPresence = await presenceRequestInFlight;
    cachedPresenceAt = Date.now();
    return jsonResponse(request, { ...cachedPresence, cacheAgeMs: 0 });
  } catch (error) {
    console.error("Discord presence request failed:", error);
    if (cachedPresence) {
      return jsonResponse(request, {
        ...cachedPresence,
        cacheAgeMs: Date.now() - cachedPresenceAt,
        stale: true,
      });
    }
    return jsonResponse(request, { error: "Discord presence is unavailable." }, 502);
  }
});
