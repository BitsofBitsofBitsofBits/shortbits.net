(() => {
  const widget = document.querySelector("#jellyfin-widget");
  if (!widget || window.SITE_CONFIG?.jellyfinPresenceEnabled !== true) return;
  widget.dataset.enabled = "true";
  const elements = Object.fromEntries(["state", "track", "series", "current-time", "duration", "progress", "updated", "status"]
    .map(name => [name, document.querySelector(`#jellyfin-${name}`)]));
  let snapshot = null;
  let timer, controller;
  let sequence = 0;
  function time(ms) {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function emit() {
    window.dispatchEvent(new CustomEvent("media:jellyfin", { detail: {
      available: ["playing", "paused"].includes(widget.dataset.state),
      isPlaying: widget.dataset.state === "playing",
    } }));
  }
  function clear(state) {
    snapshot = null;
    widget.dataset.state = state;
    elements.state.textContent = `${({ loading: "CONNECTING", idle: "NO ACTIVE SIGNAL",
      expired: "SIGNAL EXPIRED", unavailable: "SIGNAL UNAVAILABLE" })[state]} // JELLYFIN`;
    elements.track.textContent = state === "expired" ? "Shared watching status expired"
      : state === "unavailable" ? "Jellyfin signal temporarily lost" : state === "loading" ? "Locating watched bits..." : "Nothing is playing rn";
    elements.series.textContent = "Only the configured owner's account is shared.";
    elements["current-time"].textContent = "0:00";
    elements.duration.textContent = "0:00";
    elements.progress.style.setProperty("--spotify-progress", "0%");
    elements.updated.textContent = state === "expired" ? "UPDATE EXPIRED" : state === "loading" ? "AWAITING SIGNAL" : "NO ACTIVE SIGNAL";
    emit();
  }
  function timeline() {
    if (!snapshot) return;
    if (Date.now() >= snapshot.expiresAt) { clear("expired"); return; }
    const { item, updatedAt } = snapshot;
    const progress = Math.min(item.durationMs || 2_147_483_647,
      item.progressMs + (item.isPlaying ? Math.max(0, Date.now() - updatedAt) : 0));
    elements["current-time"].textContent = time(progress);
    elements.duration.textContent = item.durationMs ? time(item.durationMs) : "LIVE";
    elements.progress.style.setProperty("--spotify-progress", `${item.durationMs ? progress / item.durationMs * 100 : 0}%`);
    elements.updated.textContent = `UPDATED ${Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))}s AGO`;
  }
  function apply(payload) {
    if (!payload || !["playing", "paused", "idle", "expired", "unavailable"].includes(payload.state)) throw new Error("Invalid Jellyfin response.");
    if (![payload.updatedAt, payload.expiresAt].every(value => value === null || typeof value === "string")) throw new Error("Invalid Jellyfin freshness.");
    const updatedAt = payload.updatedAt === null ? null : Date.parse(payload.updatedAt);
    const expiresAt = payload.expiresAt === null ? null : Date.parse(payload.expiresAt);
    if (updatedAt !== null && (!Number.isFinite(updatedAt) || !Number.isFinite(expiresAt) || expiresAt - updatedAt !== 90_000
      || updatedAt > Date.now() + 30_000) || updatedAt === null && (expiresAt !== null || payload.state !== "idle")) {
      throw new Error("Invalid Jellyfin freshness.");
    }
    const item = payload.item;
    if (!["playing", "paused"].includes(payload.state)) {
      if (item !== null) throw new Error("Inactive Jellyfin response contains media.");
      clear(payload.state);
      return;
    }
    if (!item || Object.keys(item).sort().join(",") !== "durationMs,episode,isPlaying,progressMs,season,series,title"
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > 300
      || (item.series !== null && (typeof item.series !== "string" || !item.series.trim() || item.series.length > 200))
      || ![item.season, item.episode].every(value => value === null || Number.isInteger(value) && value >= 0 && value <= 9999)
      || typeof item.isPlaying !== "boolean" || item.isPlaying !== (payload.state === "playing")
      || ![item.progressMs, item.durationMs].every(value => Number.isInteger(value) && value >= 0 && value <= 2_147_483_647)
      || item.durationMs > 0 && item.progressMs > item.durationMs || updatedAt === null) throw new Error("Invalid Jellyfin media.");
    if (expiresAt <= Date.now()) { clear("expired"); return; }
    snapshot = { item, updatedAt, expiresAt };
    widget.dataset.state = payload.state;
    elements.state.textContent = `${item.isPlaying ? "NOW WATCHING" : "WATCHING PAUSED"} // JELLYFIN`;
    elements.track.textContent = item.title;
    const episode = [item.season === null ? "" : `S${item.season}`, item.episode === null ? "" : `E${item.episode}`].filter(Boolean).join(" ");
    elements.series.textContent = [item.series, episode].filter(Boolean).join(" // ") || "OWNER'S SHARED WATCHING";
    timeline();
    emit();
  }
  async function refresh() {
    window.clearTimeout(timer);
    if (document.visibilityState !== "visible") return;
    controller?.abort();
    controller = new AbortController();
    const requestController = controller;
    const current = ++sequence;
    const timeout = window.setTimeout(() => requestController.abort(), 10_000);
    try {
      const config = window.SUPABASE_CONFIG;
      if (!config?.url || !config?.anonKey) throw new Error("Jellyfin public endpoint is not configured.");
      const response = await fetch(`${config.url}/functions/v1/jellyfin-presence`, {
        headers: { apikey: config.anonKey }, signal: requestController.signal, cache: "no-store",
      });
      if (!response.ok) throw new Error(`Jellyfin presence returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (current !== sequence) return;
      elements.status.textContent = "";
      apply(payload);
      if (payload.state === "unavailable") elements.status.textContent = "Jellyfin collector is unavailable. Other media signals are unaffected.";
    } catch (error) {
      if (current !== sequence) return;
      console.error("Unable to load Jellyfin presence:", error);
      clear("unavailable");
      elements.status.textContent = "Jellyfin status unavailable. Other media signals are unaffected; updates retry automatically.";
    } finally {
      window.clearTimeout(timeout);
      if (current === sequence && document.visibilityState === "visible") timer = window.setTimeout(refresh, 30_000);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { timeline(); refresh(); }
    else { sequence++; controller?.abort(); window.clearTimeout(timer); }
  });
  window.addEventListener("pageshow", event => { if (event.persisted) refresh(); });
  window.setInterval(timeline, 1000);
  clear("loading");
  refresh();
})();
