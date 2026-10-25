const allowedOrigins = new Set(["https://www.shortbits.net", "https://shortbits.net", "null"]);
const cacheTtlMs = 600_000;
interface Video {
  title: string;
  url: string;
  publishedAt: string;
}
interface ChannelVideo {
  channelId: string;
  video: Video | null;
  unavailable: boolean;
}
let cache: ChannelVideo[] | null = null;
let cachedAt = 0;
let inFlight: Promise<ChannelVideo[]> | null = null;

function headers(request: Request, cacheable = false): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.shortbits.net",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheable ? "public, max-age=0, s-maxage=600" : "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function xmlText(value: string): string {
  return value.replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>|&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, literal: string | undefined, key: string | undefined) => {
      if (literal !== undefined) return literal;
      if (key === undefined) return entity;
      const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
      if (key.startsWith("#")) {
        const code = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code) : entity;
      }
      return named[key.toLowerCase()];
    },
  ).trim();
}

function parseLatestVideo(xml: string): Video | null {
  if (!/<feed(?:\s|>)/.test(xml) || !/<\/feed>/.test(xml)) {
    throw new Error("YouTube returned an invalid feed.");
  }
  const videos: Video[] = [];
  for (const entry of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g)) {
    const id = entry[1].match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1];
    const title = entry[1].match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/)?.[1];
    const publishedAt = entry[1].match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !title || !publishedAt || !Number.isFinite(Date.parse(publishedAt))) {
      throw new Error("YouTube returned an invalid video entry.");
    }
    videos.push({ title: xmlText(title), url: `https://www.youtube.com/watch?v=${id}`, publishedAt });
  }
  if (/<entry(?:\s|>)/.test(xml) && !videos.length) throw new Error("YouTube returned an incomplete entry.");
  videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return videos[0] ?? null;
}

async function loadVideos(): Promise<ChannelVideo[]> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Creator feed database configuration is missing.");
  const response = await fetch(
    `${url}/rest/v1/site_creators?select=youtube_channel_id&enabled=eq.true&youtube_channel_id=not.is.null`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`Creator lookup returned HTTP ${response.status}.`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Creator lookup returned invalid data.");
  const ids = [...new Set(rows.map((row) => {
    if (!row || typeof row !== "object" || !("youtube_channel_id" in row)
      || typeof row.youtube_channel_id !== "string" || !/^UC[A-Za-z0-9_-]{22}$/.test(row.youtube_channel_id)) {
      throw new Error("Creator lookup returned an invalid channel ID.");
    }
    return row.youtube_channel_id;
  }))];
  const results: ChannelVideo[] = [];
  for (let index = 0; index < ids.length; index += 4) {
    results.push(...await Promise.all(ids.slice(index, index + 4).map(async (channelId) => {
      try {
        const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
          signal: AbortSignal.timeout(10_000), redirect: "error",
        });
        if (!feed.ok) throw new Error(`YouTube returned HTTP ${feed.status}.`);
        const xml = await feed.text();
        if (xml.length > 512_000) throw new Error("YouTube feed exceeds the size limit.");
        return { channelId, video: parseLatestVideo(xml), unavailable: false };
      } catch (error) {
        console.error(`Latest video unavailable for ${channelId}:`, error);
        return { channelId, video: null, unavailable: true };
      }
    })));
  }
  return results;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: headers(request) });
  }
  try {
    if (!cache || Date.now() - cachedAt >= cacheTtlMs) {
      if (!inFlight) inFlight = loadVideos().finally(() => { inFlight = null; });
      const videos = await inFlight;
      cache = videos.some((entry) => entry.unavailable) ? null : videos;
      cachedAt = Date.now();
      return Response.json({ videos }, { headers: headers(request, cache !== null) });
    }
    return Response.json({ videos: cache }, { headers: headers(request, true) });
  } catch (error) {
    console.error("Creator video request failed:", error);
    return Response.json({ error: "Latest videos are temporarily unavailable." }, {
      status: 502, headers: headers(request),
    });
  }
});
