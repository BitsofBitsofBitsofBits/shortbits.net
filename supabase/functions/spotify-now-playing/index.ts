const allowedOrigins = new Set([
  "https://www.shortbits.net",
  "https://shortbits.net",
  "null",
]);
let spotifyRateLimitedUntil = 0;

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
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
    return jsonResponse(request, {
      error: "Spotify playback is temporarily rate limited.",
      upstreamStatus: 429,
      retryAfterSeconds: rateLimitSecondsRemaining,
    }, 429);
  }

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
      return jsonResponse(request, {
        error: "Spotify authentication failed.",
        upstreamStatus: tokenResponse.status,
      }, 502);
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
      const retryAfterSeconds = Number.parseInt(
        playbackResponse.headers.get("Retry-After") ?? "",
        10,
      );
      if (playbackResponse.status === 429 && Number.isFinite(retryAfterSeconds)) {
        spotifyRateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
      }
      return jsonResponse(request, {
        error: "Spotify playback is unavailable.",
        upstreamStatus: playbackResponse.status,
        retryAfterSeconds: Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds
          : null,
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
});
