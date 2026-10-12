const allowedOrigins = new Set([
  "https://www.shortbits.net",
  "https://shortbits.net",
  "null",
]);
const spotifyPlaybackCacheTtlMs = 30_000;
const spotifyDefaultRetryAfterSeconds = 60;
let spotifyRateLimitedUntil = 0;
let cachedPlayback: Record<string, unknown> | null = null;
let cachedPlaybackAt = 0;
let spotifyRequestInFlight: Promise<Response> | null = null;

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

function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  cacheControl = "no-store",
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function retryAfterSeconds(response: Response): number | null {
  const value = response.headers.get("Retry-After");
  if (!value) {
    return null;
  }

  const deltaSeconds = Number.parseInt(value, 10);
  if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
    return deltaSeconds;
  }

  const retryDate = Date.parse(value);
  if (!Number.isFinite(retryDate)) {
    return null;
  }

  return Math.max(1, Math.ceil((retryDate - Date.now()) / 1000));
}

function beginSpotifyCooldown(retryAfter: number | null): number {
  const effectiveRetryAfter = retryAfter ?? spotifyDefaultRetryAfterSeconds;
  spotifyRateLimitedUntil = Math.max(
    spotifyRateLimitedUntil,
    Date.now() + effectiveRetryAfter * 1000,
  );
  return effectiveRetryAfter;
}

function cachedPlaybackPayload(
  cacheStatus: "hit" | "stale",
  retryAfter: number | null = null,
): Record<string, unknown> {
  return {
    ...cachedPlayback,
    cacheStatus,
    cacheAgeMs: Math.max(0, Date.now() - cachedPlaybackAt),
    servedAt: Date.now(),
    ...(retryAfter === null ? {} : { retryAfterSeconds: retryAfter }),
  };
}

async function fetchSpotifyPlayback(request: Request): Promise<Response> {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  const refreshToken = Deno.env.get("SPOTIFY_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("One or more Spotify secrets are missing.");
    return jsonResponse(request, { error: "Spotify integration is unavailable." }, 503);
  }

  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Spotify token refresh failed:", tokenResponse.status, tokenData.error);
      const tokenRetryAfter = tokenResponse.status === 429
        ? beginSpotifyCooldown(retryAfterSeconds(tokenResponse))
        : null;
      return jsonResponse(request, {
        error: "Spotify authentication failed.",
        upstreamStatus: tokenResponse.status,
        retryAfterSeconds: tokenRetryAfter,
      }, tokenResponse.status === 429 ? 429 : 502);
    }

    const playbackResponse = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: { "Authorization": `Bearer ${tokenData.access_token}` },
      },
    );

    if (playbackResponse.status === 204) {
      return jsonResponse(request, { isPlaying: false, item: null });
    }

    if (!playbackResponse.ok) {
      console.error("Spotify playback request failed:", playbackResponse.status);
      const playbackRetryAfter = playbackResponse.status === 429
        ? beginSpotifyCooldown(retryAfterSeconds(playbackResponse))
        : null;
      return jsonResponse(request, {
        error: "Spotify playback is unavailable.",
        upstreamStatus: playbackResponse.status,
        retryAfterSeconds: playbackRetryAfter,
      }, playbackResponse.status === 429 ? 429 : 502);
    }

    const playback = await playbackResponse.json();
    const item = playback.item;

    if (!item) {
      return jsonResponse(request, { isPlaying: false, item: null });
    }

    const isEpisode = item.type === "episode";
    const artists = isEpisode
      ? [item.show?.name].filter(Boolean)
      : (item.artists ?? []).map((artist: { name: string }) => artist.name);
    const images = isEpisode ? item.images : item.album?.images;

    return jsonResponse(request, {
      isPlaying: Boolean(playback.is_playing),
      progressMs: playback.progress_ms ?? 0,
      item: {
        type: item.type,
        title: item.name,
        artists,
        collection: isEpisode ? item.show?.name : item.album?.name,
        durationMs: item.duration_ms ?? 0,
        albumArt: images?.[0]?.url ?? null,
        spotifyUrl: item.external_urls?.spotify ?? null,
      },
    });
  } catch (error) {
    console.error("Spotify function failed:", error);
    return jsonResponse(request, { error: "Spotify integration failed." }, 500);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "GET") {
    return jsonResponse(request, { error: "Method not allowed." }, 405);
  }

  const rateLimitSecondsRemaining = Math.ceil(
    (spotifyRateLimitedUntil - Date.now()) / 1000,
  );
  if (rateLimitSecondsRemaining > 0) {
    if (cachedPlayback) {
      return jsonResponse(
        request,
        cachedPlaybackPayload("stale", rateLimitSecondsRemaining),
      );
    }
    return jsonResponse(request, {
      error: "Spotify playback is temporarily rate limited.",
      upstreamStatus: 429,
      retryAfterSeconds: rateLimitSecondsRemaining,
    }, 429);
  }

  if (
    cachedPlayback
    && Date.now() - cachedPlaybackAt < spotifyPlaybackCacheTtlMs
  ) {
    return jsonResponse(
      request,
      cachedPlaybackPayload("hit"),
      200,
      "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
    );
  }

  if (!spotifyRequestInFlight) {
    spotifyRequestInFlight = fetchSpotifyPlayback(request)
      .finally(() => {
        spotifyRequestInFlight = null;
      });
  }

  const upstreamResponse = await spotifyRequestInFlight;
  const upstreamBody = await upstreamResponse.clone().json();

  if (upstreamResponse.ok) {
    cachedPlayback = upstreamBody;
    cachedPlaybackAt = Date.now();
    return jsonResponse(
      request,
      cachedPlaybackPayload("hit"),
      200,
      "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
    );
  }

  if (upstreamResponse.status === 429 && cachedPlayback) {
    const retryAfter = Number(upstreamBody.retryAfterSeconds);
    return jsonResponse(
      request,
      cachedPlaybackPayload(
        "stale",
        Number.isFinite(retryAfter)
          ? retryAfter
          : spotifyDefaultRetryAfterSeconds,
      ),
    );
  }

  return jsonResponse(request, upstreamBody, upstreamResponse.status);
});
