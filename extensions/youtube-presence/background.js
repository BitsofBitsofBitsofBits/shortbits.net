importScripts("playback.js");
const projectUrl = "https://arjwrycitgobvlodmkeo.supabase.co";
const publicKey = "sb_publishable_AWXT71G2lX4cqbdK9A9g0w_6e1EUvIl";
const tokenPattern = /^sbyt_[0-9a-f]{64}$/;
let queue = Promise.resolve();
let updateTimer;

async function request(path, options = {}) {
  const response = await fetch(`${projectUrl}/functions/v1/${path}`, {
    ...options, headers: { apikey: publicKey, ...options.headers },
    signal: AbortSignal.timeout(10_000), redirect: "error", cache: "no-store",
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Service returned an unreadable response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : `Service returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function publish(token, item, endSession = false) {
  await request("youtube-presence", { method: "POST",
    headers: { "Content-Type": "application/json", "x-device-token": token },
    body: JSON.stringify({ item, endSession }) });
}

async function status(enabled, error = "") {
  await chrome.storage.local.set({ lastError: error });
  await chrome.action.setBadgeText({ text: error ? "!" : enabled ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: error ? "#b42318" : "#176b42" });
  await chrome.action.setTitle({ title: error ? `YouTube sharing: ${error}` : `YouTube sharing is ${enabled ? "on" : "off"}` });
}

async function update() {
  const config = await chrome.storage.local.get(["enabled", "token", "lastSpotifyCheckedAt"]);
  if (!config.enabled) return;
  if (!tokenPattern.test(config.token ?? "")) throw new Error("Configure a device token before sharing.");
  const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
  const reports = await Promise.all(tabs.map(async tab => {
    try {
      const report = await chrome.tabs.sendMessage(tab.id, { type: "snapshot" });
      return { ...report, tabId: tab.id, active: tab.active };
    } catch (error) {
      console.warn(`Unable to read YouTube tab ${tab.id}. Reload it to connect the extension.`, error.message);
      return { unavailable: true };
    }
  }));
  const item = BITS_YOUTUBE.chooseTab(reports);
  if (item || !reports.some(report => report.transient || report.unavailable)) {
    await publish(config.token, item);
    await chrome.storage.local.set({ lastPublishedAt: Date.now(), currentTitle: item?.title ?? "" });
  }
  // Keep the continuous Spotify session observable even when nobody has the site open.
  if (!config.lastSpotifyCheckedAt || Date.now() - config.lastSpotifyCheckedAt >= 30_000) {
    const spotify = await request("spotify-now-playing");
    if (spotify.sessionTrackingUnavailable) throw new Error("Spotify session tracking needs its database migration.");
    await chrome.storage.local.set({ lastSpotifyCheckedAt: Date.now() });
  }
  if (reports.some(report => report.unavailable)) throw new Error("Reload existing YouTube tabs to connect the extension.");
  await status(true);
}

async function configure(message) {
  const config = await chrome.storage.local.get(["enabled", "token"]);
  const token = message.token?.trim() || config.token || "";
  if (typeof message.enabled !== "boolean") throw new Error("Choose whether to enable sharing.");
  if (message.enabled && !tokenPattern.test(token)) throw new Error("Enter the sbyt_ device token issued by Supabase.");
  if (token && !tokenPattern.test(token)) throw new Error("Enter the sbyt_ device token issued by Supabase.");
  await chrome.storage.local.set({ enabled: false });
  if (config.token && (config.enabled || config.token !== token)) {
    try { await publish(config.token, null, true); }
    catch (error) {
      if (config.token !== token && error.status === 401) {
        console.warn("The previous device token was revoked; replacing it with the configured token.");
      } else {
        if (!message.enabled) {
          await chrome.storage.local.set({ token });
          throw new Error(`Sharing is off. The last report expires within 90 seconds; clearing it failed: ${error.message}`);
        }
        throw new Error(`Unable to clear the previous report: ${error.message}`);
      }
    }
  }
  await chrome.storage.local.set({ token, enabled: message.enabled });
  if (message.enabled) await update();
  else await status(false);
}

function enqueue(action) {
  const result = queue.then(action);
  queue = result.catch(async error => {
    console.error("YouTube presence:", error.message);
    const { enabled } = await chrome.storage.local.get("enabled");
    await status(Boolean(enabled), error.message);
  });
  return result;
}

async function initialize() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.alarms.create("presence-heartbeat", { periodInMinutes: 0.5 });
  const { enabled } = await chrome.storage.local.get("enabled");
  await status(Boolean(enabled));
  if (enabled) await update();
}
chrome.runtime.onInstalled.addListener(() => { enqueue(initialize).catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { enqueue(initialize).catch(() => {}); });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "presence-heartbeat") enqueue(update).catch(() => {});
});
function scheduleUpdate() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => { enqueue(update).catch(() => {}); }, 1000);
}
chrome.tabs.onRemoved.addListener(scheduleUpdate);
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.status === "complete" || change.url) scheduleUpdate();
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === "playback-changed" && sender.tab
    && sender.url?.startsWith("https://www.youtube.com/")) {
    scheduleUpdate();
    respond({ ok: true });
    return;
  }
  if (!sender.url?.startsWith(chrome.runtime.getURL(""))) return;
  if (message.type === "configure") {
    enqueue(() => configure(message)).then(() => respond({ ok: true }), error => respond({ error: error.message }));
    return true;
  }
});
