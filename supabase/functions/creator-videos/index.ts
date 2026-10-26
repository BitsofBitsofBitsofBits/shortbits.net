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
  avatarUrl: string | null;
  photoUnavailable: boolean;
}
let cache: ChannelVideo[] | null = null;
let cachedAt = 0;
let inFlight: Promise<ChannelVideo[]> | null = null;

function headers(request: Request, cacheable = false): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.shortbits.net",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function channelPath(input: string): string {
  const value = input.trim();
  const url = new URL(value.startsWith("@") || /^UC[A-Za-z0-9_-]{22}$/.test(value)
    ? `https://www.youtube.com/${value.startsWith("@") ? value : `channel/${value}`}` : value);
  const path = url.pathname.match(/^\/(@[^/]+|channel\/UC[A-Za-z0-9_-]{22}|c\/[^/]+|user\/[^/]+|[A-Za-z0-9_-]+)(?:\/(?:featured|videos|shorts|streams|about))?\/?$/);
  const reservedPaths = new Set([
    "account", "attribution_link", "channel", "clip", "c", "embed", "feed", "gaming",
    "get_video_info", "hashtag", "history", "home", "live", "logout", "music", "oembed",
    "playlist", "premium", "redirect", "results", "shorts", "signin", "t", "upload",
    "user", "watch", "youtubei",
  ]);
  if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    || url.username || url.password || url.port || !path || reservedPaths.has(path[1].toLowerCase())) {
    throw new Error("Enter a YouTube channel URL, @handle, or UC channel ID.");
  }
  return `/${path[1]}`;
}

async function channelMetadata(path: string): Promise<{ channelId: string; avatarUrl: string | null; photoUnavailable: boolean }> {
  const response = await fetch(`https://www.youtube.com${path}`, {
    signal: AbortSignal.timeout(10_000), redirect: "error",
  });
  if (!response.ok) throw new Error(`YouTube channel returned HTTP ${response.status}.`);
  if (!response.body) throw new Error("YouTube returned an empty channel page.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        html += decoder.decode();
        break;
      }
      bytes += value.byteLength;
      if (bytes > 2_000_000) throw new Error("YouTube channel metadata exceeds the size limit.");
      html += decoder.decode(value, { stream: true });
      const hasChannel = /<meta\b(?=[^>]*\bproperty\s*=\s*["']og:url["'])[^>]*>/i.test(html)
        || /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i.test(html);
      const hasPhoto = /<meta\b(?=[^>]*\bproperty\s*=\s*["']og:image["'])[^>]*>/i.test(html);
      if (hasChannel && hasPhoto) break;
    }
  } finally {
    await reader.cancel();
  }
  const metadata = new Map<string, string>();
  for (const tag of html.matchAll(/<(?:meta|link)\b[^>]*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
      attributes.set(attribute[1].toLowerCase(), xmlText(attribute[3]));
    }
    const key = attributes.get("property") ?? attributes.get("name") ?? attributes.get("rel");
    const value = attributes.get("content") ?? attributes.get("href");
    if (key && value) metadata.set(key, value);
  }
  const canonical = metadata.get("og:url") ?? metadata.get("canonical") ?? "";
  const channelId = canonical.match(/^https:\/\/(?:www\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/)?.[1];
  if (!channelId) throw new Error("YouTube did not return a channel ID. Check the handle or channel URL.");
  try {
    const image = new URL(metadata.get("og:image") ?? "");
    if (image.protocol !== "https:" || !["yt3.googleusercontent.com", "yt3.ggpht.com"].includes(image.hostname)
      || image.username || image.password || image.port) {
      throw new Error("YouTube did not return a supported channel photo.");
    }
    image.pathname = image.pathname.replace(/=s\d+(?=-|$)/, "=s160");
    return { channelId, avatarUrl: image.href, photoUnavailable: false };
  } catch (error) {
    console.error(`Channel photo metadata unavailable for ${channelId}:`, error);
    return { channelId, avatarUrl: null, photoUnavailable: true };
  }
}

async function resolveChannel(request: Request): Promise<Response> {
  const respond = (body: object, status: number) => Response.json(body, { status, headers: headers(request) });
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return respond({ error: "Sign in to Admin to look up channels." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Creator lookup configuration is missing.");
  const auth = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  if (auth.status >= 500) throw new Error(`Creator lookup authentication returned HTTP ${auth.status}.`);
  if (!auth.ok) return respond({ error: "Your Admin session expired. Sign in again." }, 401);
  const user = await auth.json();
  if (!user || typeof user.id !== "string" || !user.id || user.is_anonymous === true) {
    return respond({ error: "Sign in to Admin to look up channels." }, 401);
  }
  let path: string;
  try {
    const body = await request.json();
    if (!body || typeof body.channelUrl !== "string" || body.channelUrl.length > 500) {
      throw new Error("Enter a YouTube channel URL, @handle, or UC channel ID.");
    }
    path = channelPath(body.channelUrl);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Invalid channel lookup request." }, 400);
  }
  const channel = await channelMetadata(path);
  return respond(channel, 200);
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
      const [upload, photo] = await Promise.all([
        (async () => {
          try {
            const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
              signal: AbortSignal.timeout(10_000), redirect: "error",
            });
            if (!feed.ok) throw new Error(`YouTube returned HTTP ${feed.status}.`);
            const xml = await feed.text();
            if (xml.length > 512_000) throw new Error("YouTube feed exceeds the size limit.");
            return { video: parseLatestVideo(xml), unavailable: false };
          } catch (error) {
            console.error(`Latest video unavailable for ${channelId}:`, error);
            return { video: null, unavailable: true };
          }
        })(),
        (async () => {
          try {
            const metadata = await channelMetadata(`/channel/${channelId}`);
            if (metadata.channelId !== channelId) throw new Error("YouTube returned a different channel.");
            return { avatarUrl: metadata.avatarUrl, photoUnavailable: metadata.photoUnavailable };
          } catch (error) {
            console.error(`Channel photo unavailable for ${channelId}:`, error);
            return { avatarUrl: null, photoUnavailable: true };
          }
        })(),
      ]);
      return { channelId, ...upload, ...photo };
    })));
  }
  return results;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== "GET" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: headers(request) });
  }
  try {
    if (request.method === "POST") return await resolveChannel(request);
    if (!cache || Date.now() - cachedAt >= cacheTtlMs) {
      if (!inFlight) inFlight = loadVideos().finally(() => { inFlight = null; });
      const videos = await inFlight;
      cache = videos.some((entry) => entry.unavailable || entry.photoUnavailable) ? null : videos;
      cachedAt = Date.now();
      return Response.json({ videos }, { headers: headers(request, cache !== null) });
    }
    return Response.json({ videos: cache }, { headers: headers(request, true) });
  } catch (error) {
    console.error("Creator video request failed:", error);
    return Response.json({ error: request.method === "POST"
      ? "YouTube channel lookup is unavailable. Check the channel URL or try again later."
      : "YouTube videos and photos are temporarily unavailable." }, {
      status: 502, headers: headers(request),
    });
  }
});
