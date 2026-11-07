import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export class CollectorError extends Error {}
function requireValue(condition, code) {
  if (!condition) throw new CollectorError(code);
}
export function userId(value) {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value)) return null;
  const id = value.replaceAll("-", "").toLowerCase();
  return /^0+$/.test(id) ? null : id;
}
export function validateConfig(config) {
  requireValue(config && typeof config === "object", "CONFIG_INVALID");
  requireValue(userId(config.jellyfinUserId), "CONFIG_OWNER_USER_ID_REQUIRED");
  for (const field of ["jellyfinUrl", "supabaseUrl"]) {
    let url;
    try { url = new URL(config[field]); } catch { throw new CollectorError("CONFIG_URL_INVALID"); }
    requireValue(!url.username && !url.password && !url.search && !url.hash
      && (field === "jellyfinUrl" ? ["http:", "https:"].includes(url.protocol)
        : url.protocol === "https:" && url.pathname === "/"), "CONFIG_URL_INVALID");
  }
  requireValue(typeof config.jellyfinApiKey === "string" && config.jellyfinApiKey.trim().length >= 8
    && !/[\r\n]/.test(config.jellyfinApiKey), "CONFIG_API_KEY_INVALID");
  requireValue(/^sbjf_[a-f0-9]{64}$/.test(config.deviceToken), "CONFIG_DEVICE_TOKEN_INVALID");
  requireValue(typeof config.supabaseKey === "string" && !/[\r\n]/.test(config.supabaseKey), "CONFIG_PUBLIC_KEY_INVALID");
  let publicKey = config.supabaseKey.startsWith("sb_publishable_") && config.supabaseKey.length > 20;
  if (!publicKey) {
    try { publicKey = JSON.parse(Buffer.from(config.supabaseKey.split(".")[1], "base64url").toString()).role === "anon"; }
    catch { throw new CollectorError("CONFIG_USE_PUBLIC_KEY_NOT_SERVICE_ROLE"); }
  }
  requireValue(publicKey, "CONFIG_USE_PUBLIC_KEY_NOT_SERVICE_ROLE");
  return Object.freeze({ ...config, jellyfinUserId: userId(config.jellyfinUserId) });
}

function milliseconds(ticks) {
  requireValue(Number.isSafeInteger(ticks) && ticks >= 0 && ticks <= 21_474_836_470_000, "JELLYFIN_PLAYBACK_INVALID");
  return Math.floor(ticks / 10_000);
}
function text(value, limit) {
  requireValue(typeof value === "string" && value.trim().length > 0 && value.length <= limit, "JELLYFIN_TITLE_INVALID");
  return value.trim();
}
function episodeNumber(value) {
  if (value == null) return null;
  requireValue(Number.isInteger(value) && value >= 0 && value <= 9999, "JELLYFIN_EPISODE_INVALID");
  return value;
}
export function normalize(sessions, configuredUserId, now = Date.now()) {
  const owner = userId(configuredUserId);
  requireValue(owner, "CONFIG_OWNER_USER_ID_REQUIRED");
  requireValue(Array.isArray(sessions) && sessions.length <= 512, "JELLYFIN_SESSIONS_INVALID");
  // AdditionalUsers, controllable sessions and display names never establish ownership.
  const watching = sessions.filter(session => userId(session?.UserId) === owner
    && ["Movie", "Episode", "Video", "Trailer", "MusicVideo"].includes(session?.NowPlayingItem?.Type));
  const active = watching.filter(session => {
    const checkedAt = Date.parse(session.LastPlaybackCheckIn);
    return Number.isFinite(checkedAt) && checkedAt > now - 90_000 && checkedAt <= now + 30_000;
  });
  for (const session of active) requireValue(typeof session.PlayState?.IsPaused === "boolean", "JELLYFIN_PLAYBACK_INVALID");
  active.sort((first, second) => Number(first.PlayState.IsPaused) - Number(second.PlayState.IsPaused)
    || Date.parse(second.LastPlaybackCheckIn) - Date.parse(first.LastPlaybackCheckIn));
  const session = active[0];
  if (!session) return { userId: owner, state: watching.length ? "expired" : "idle", item: null };
  const source = session.NowPlayingItem;
  const durationMs = milliseconds(source.RunTimeTicks ?? 0);
  const position = milliseconds(session.PlayState.PositionTicks);
  const isPlaying = !session.PlayState.IsPaused;
  const elapsed = isPlaying ? Math.max(0, now - Date.parse(session.LastPlaybackCheckIn)) : 0;
  return {
    userId: owner,
    state: isPlaying ? "playing" : "paused",
    item: {
      title: text(source.Name, 300),
      series: source.Type === "Episode" && source.SeriesName != null ? text(source.SeriesName, 200) : null,
      season: source.Type === "Episode" ? episodeNumber(source.ParentIndexNumber) : null,
      episode: source.Type === "Episode" ? episodeNumber(source.IndexNumber) : null,
      durationMs,
      progressMs: Math.min(durationMs || 2_147_483_647, position + elapsed),
      isPlaying,
    },
  };
}

async function readJson(url, init, service, fetchImpl) {
  let response;
  try { response = await fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) }); }
  catch { throw new CollectorError(`${service}_CONNECTION_FAILED`); }
  requireValue(response.ok, `${service}_HTTP_${response.status}`);
  const reader = response.body?.getReader();
  requireValue(reader, `${service}_INVALID_JSON`);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) { await reader.cancel(); throw new CollectorError(`${service}_RESPONSE_TOO_LARGE`); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw error instanceof CollectorError ? error : new CollectorError(`${service}_INVALID_JSON`);
  }
}
export async function collect(config, fetchImpl = fetch, now = Date.now()) {
  config = validateConfig(config);
  const base = `${config.jellyfinUrl.replace(/\/+$/, "")}/`;
  const headers = { "X-Emby-Token": config.jellyfinApiKey };
  const account = await readJson(new URL(`Users/${config.jellyfinUserId}`, base), { headers }, "JELLYFIN", fetchImpl);
  requireValue(userId(account?.Id) === config.jellyfinUserId && account?.Policy?.IsDisabled !== true,
    "JELLYFIN_OWNER_ACCOUNT_INVALID_OR_DISABLED");
  const sessions = await readJson(new URL("Sessions", base), { headers }, "JELLYFIN", fetchImpl);
  return normalize(sessions, config.jellyfinUserId, now);
}
export async function publish(config, payload, fetchImpl = fetch) {
  config = validateConfig(config);
  requireValue(payload && Object.keys(payload).sort().join(",") === "item,state,userId"
    && userId(payload.userId) === config.jellyfinUserId, "REPORT_OWNER_INVALID");
  const item = payload.item;
  if (["playing", "paused"].includes(payload.state)) {
    requireValue(item && Object.keys(item).sort().join(",") === "durationMs,episode,isPlaying,progressMs,season,series,title"
      && typeof item.isPlaying === "boolean" && item.isPlaying === (payload.state === "playing")
      && [item.season, item.episode].every(value => value === null || Number.isInteger(value) && value >= 0 && value <= 9999)
      && [item.durationMs, item.progressMs].every(value => Number.isInteger(value) && value >= 0 && value <= 2_147_483_647)
      && (item.durationMs === 0 || item.progressMs <= item.durationMs), "REPORT_ITEM_INVALID");
    text(item.title, 300);
    if (item.series !== null) text(item.series, 200);
    episodeNumber(item.season);
    episodeNumber(item.episode);
  } else requireValue(["idle", "expired", "unavailable"].includes(payload.state) && item === null, "REPORT_STATE_INVALID");
  const result = await readJson(`${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/jellyfin-presence`, {
    method: "POST", headers: { apikey: config.supabaseKey, "x-device-token": config.deviceToken, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "SITE", fetchImpl);
  requireValue(result?.ok === true, "SITE_REPORT_REJECTED");
}
export async function main(args = process.argv.slice(2)) {
  let config;
  try { config = validateConfig(JSON.parse(await readFile(process.env.SHORTBITS_CONFIG ?? "/config/config.json", "utf8"))); }
  catch (error) { console.error(error instanceof CollectorError ? error.message : "CONFIG_READ_FAILED"); return 1; }
  do {
    let payload;
    try { payload = await collect(config); }
    catch (error) {
      console.error(error instanceof CollectorError ? error.message : "COLLECTOR_UNEXPECTED_ERROR");
      if (args.includes("--check")) return 1;
      payload = { userId: config.jellyfinUserId, state: "unavailable", item: null };
    }
    if (args.includes("--check")) { console.log("CHECK_OK: owner account and session schema verified. Nothing published."); return 0; }
    try { await publish(config, payload); console.log("REPORT_OK"); }
    catch (error) {
      console.error(error instanceof CollectorError ? error.message : "SITE_REPORT_FAILED");
      if (error instanceof CollectorError && /^SITE_HTTP_(401|403)$/.test(error.message)) return 1;
    }
    await sleep(15_000);
  } while (true);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
