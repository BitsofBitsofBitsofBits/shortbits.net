const allowedOrigins = new Set(["https://www.shortbits.net", "https://shortbits.net", "null"]);
const cacheTtlMs = 60_000;
interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string;
}
interface TwitchChannel {
  login: string;
  avatarUrl: string | null;
  live: { title: string; game: string; startedAt: string } | null;
  video: { title: string; url: string; publishedAt: string } | null;
  unavailable: boolean;
}
let token: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;
let cache: TwitchChannel[] | null = null;
let cachedAt = 0;
let inFlight: Promise<TwitchChannel[]> | null = null;

function headers(request: Request, cacheable = false): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.shortbits.net",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheable ? `public, max-age=0, s-maxage=${Math.max(0, Math.floor((cachedAt + cacheTtlMs - Date.now()) / 1000))}` : "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function channelLogin(input: string): string {
  const value = input.trim();
  const guidance = "Enter a Twitch username (for example, human1) or a channel URL such as https://www.twitch.tv/human1, not a clip, video, or directory URL.";
  let url: URL;
  try {
    url = new URL(/^[A-Za-z0-9_]{1,25}$/.test(value) ? `https://www.twitch.tv/${value}` : value);
  } catch {
    throw new Error(guidance);
  }
  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,25})\/?$/);
  const reserved = new Set(["directory", "downloads", "jobs", "p", "search", "settings", "subscriptions", "turbo", "videos", "wallet"]);
  if (url.protocol !== "https:" || !["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(url.hostname)
    || url.username || url.password || url.port || !match || reserved.has(match[1].toLowerCase())) {
    throw new Error(guidance);
  }
  return match[1].toLowerCase();
}

function isPhoto(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "static-cdn.jtvnw.net"
      && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = Deno.env.get("TWITCH_CLIENT_ID");
  const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Twitch application credentials are not configured.");
  return { clientId, clientSecret };
}

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  if (!tokenRequest) {
    tokenRequest = (async () => {
      const { clientId, clientSecret } = credentials();
      const response = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
        signal: AbortSignal.timeout(10_000), redirect: "error",
      });
      if (!response.ok) throw new Error(`Twitch authentication returned HTTP ${response.status}.`);
      const data = await response.json();
      if (typeof data.access_token !== "string" || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
        throw new Error("Twitch authentication returned invalid data.");
      }
      token = { value: data.access_token, expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
      return token.value;
    })().finally(() => { tokenRequest = null; });
  }
  return tokenRequest;
}

async function helix(resource: string, params: URLSearchParams): Promise<unknown[]> {
  const { clientId } = credentials();
  let value = await accessToken();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`https://api.twitch.tv/helix/${resource}?${params}`, {
      headers: { "Client-Id": clientId, Authorization: `Bearer ${value}` },
      signal: AbortSignal.timeout(10_000), redirect: "error",
    });
    if (response.status === 401 && attempt === 0) {
      if (token?.value === value) token = null;
      value = await accessToken();
      continue;
    }
    if (!response.ok) throw new Error(`Twitch ${resource} returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error(`Twitch ${resource} returned invalid data.`);
    return payload.data;
  }
  throw new Error("Twitch authentication could not be refreshed.");
}

function userMetadata(value: unknown): TwitchUser {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !/^\d+$/.test(value.id)
    || !("login" in value) || typeof value.login !== "string" || !/^[a-z0-9_]{1,25}$/.test(value.login)
    || !("display_name" in value) || typeof value.display_name !== "string"
    || !("profile_image_url" in value) || !isPhoto(value.profile_image_url)) {
    throw new Error("Twitch returned invalid channel metadata.");
  }
  return { id: value.id, login: value.login, displayName: value.display_name, avatarUrl: value.profile_image_url };
}

async function lookup(request: Request): Promise<Response> {
  const respond = (body: object, status: number) => Response.json(body, { status, headers: headers(request) });
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return respond({ error: "Sign in to Admin to look up channels." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Twitch lookup configuration is missing.");
  const auth = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(10_000), redirect: "error",
  });
  if (auth.status >= 500) throw new Error(`Twitch lookup authentication returned HTTP ${auth.status}.`);
  if (!auth.ok) return respond({ error: "Your Admin session expired. Sign in again." }, 401);
  const user = await auth.json();
  if (!user || typeof user.id !== "string" || !user.id || user.is_anonymous === true) {
    return respond({ error: "Sign in to Admin to look up channels." }, 401);
  }
  let login: string;
  try {
    const body = await request.json();
    if (!body || typeof body.channelUrl !== "string" || body.channelUrl.length > 500) throw new Error("Enter a Twitch channel URL or username.");
    login = channelLogin(body.channelUrl);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Invalid Twitch lookup request." }, 400);
  }
  const users = await helix("users", new URLSearchParams({ login }));
  if (!users.length) return respond({ error: "No Twitch channel was found for that username." }, 404);
  if (users.length !== 1) throw new Error("Twitch returned an unexpected number of channels.");
  const channel = userMetadata(users[0]);
  if (channel.login !== login) throw new Error("Twitch returned a different channel.");
  return respond({ ...channel, channelUrl: `https://www.twitch.tv/${channel.login}` }, 200);
}

async function loadChannels(): Promise<TwitchChannel[]> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Twitch feed database configuration is missing.");
  const response = await fetch(
    `${url}/rest/v1/site_creators?select=channel_url&enabled=eq.true&order=position.asc&limit=1000`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000), redirect: "error" },
  );
  if (!response.ok) throw new Error(`Creator list returned HTTP ${response.status}.`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length >= 1000) throw new Error("Invalid creator list or too many creators.");
  const logins = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.channel_url !== "string") throw new Error("Invalid creator channel URL.");
    const host = new URL(row.channel_url).hostname;
    if (["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(host)) logins.add(channelLogin(row.channel_url));
  }
  const result: TwitchChannel[] = [];
  for (let index = 0, names = [...logins]; index < names.length; index += 4) {
    result.push(...await Promise.all(names.slice(index, index + 4).map(async (login): Promise<TwitchChannel> => {
      let avatarUrl: string | null = null;
      try {
        const users = await helix("users", new URLSearchParams({ login }));
        if (users.length !== 1) throw new Error("Twitch channel was not found.");
        const user = userMetadata(users[0]);
        if (user.login !== login) throw new Error("Twitch returned a different channel.");
        avatarUrl = user.avatarUrl;
        const streams = await helix("streams", new URLSearchParams({ user_id: user.id, type: "live", first: "1" }));
        if (streams.length > 1) throw new Error("Twitch returned multiple streams.");
        if (streams.length) {
          const stream = streams[0];
          if (!stream || typeof stream !== "object" || !("user_id" in stream) || stream.user_id !== user.id
            || !("title" in stream) || typeof stream.title !== "string"
            || !("game_name" in stream) || typeof stream.game_name !== "string"
            || !("started_at" in stream) || typeof stream.started_at !== "string" || !Number.isFinite(Date.parse(stream.started_at))) {
            throw new Error("Twitch returned invalid stream data.");
          }
          return { login, avatarUrl, live: { title: stream.title, game: stream.game_name, startedAt: stream.started_at }, video: null, unavailable: false };
        }
        const videos = await helix("videos", new URLSearchParams({ user_id: user.id, type: "archive", sort: "time", first: "1" }));
        if (videos.length > 1) throw new Error("Twitch returned multiple latest videos.");
        let video: TwitchChannel["video"] = null;
        if (videos.length) {
          const vod = videos[0];
          if (!vod || typeof vod !== "object" || !("user_id" in vod) || vod.user_id !== user.id
            || !("id" in vod) || typeof vod.id !== "string" || !/^\d+$/.test(vod.id)
            || !("title" in vod) || typeof vod.title !== "string"
            || !("published_at" in vod) || typeof vod.published_at !== "string" || !Number.isFinite(Date.parse(vod.published_at))) {
            throw new Error("Twitch returned invalid VOD data.");
          }
          video = { title: vod.title, url: `https://www.twitch.tv/videos/${vod.id}`, publishedAt: vod.published_at };
        }
        return { login, avatarUrl, live: null, video, unavailable: false };
      } catch (error) {
        console.error(`Twitch feed unavailable for ${login}:`, error);
        return { login, avatarUrl, live: null, video: null, unavailable: true };
      }
    })));
  }
  return result;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== "GET" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: headers(request) });
  }
  try {
    if (request.method === "POST") return await lookup(request);
    if (!cache || Date.now() - cachedAt >= cacheTtlMs) {
      if (!inFlight) inFlight = loadChannels().finally(() => { inFlight = null; });
      const channels = await inFlight;
      cache = channels.some(channel => channel.unavailable) ? null : channels;
      cachedAt = Date.now();
      return Response.json({ channels }, { headers: headers(request, cache !== null) });
    }
    return Response.json({ channels: cache }, { headers: headers(request, true) });
  } catch (error) {
    console.error("Twitch creator request failed:", error);
    return Response.json({ error: "Twitch lookup/feed is unavailable. Check the channel and the server's Twitch application credentials, or try again later." }, {
      status: 502, headers: headers(request),
    });
  }
});
