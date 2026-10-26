(() => {
  const spotify = document.querySelector("#spotify-widget");
  const youtube = document.querySelector("#youtube-widget");
  const navigation = document.querySelector("#media-navigation");
  const selection = document.querySelector("#media-selection");
  const status = document.querySelector("#media-status");
  const state = { spotify: null, youtube: null };
  let selected = "spotify";
  let manualSelection = false;
  let orderSignature = "";
  let youtubeError = "";
  let refreshTimer;
  let requestSequence = 0;
  let requestController;

  function rankedSources() {
    return Object.entries(state).filter(([, media]) => media?.available).sort(([firstId, first], [secondId, second]) =>
      Number(second.isPlaying) - Number(first.isPlaying)
      || (first.startedAt ?? Infinity) - (second.startedAt ?? Infinity)
      || firstId.localeCompare(secondId)
    ).map(([id]) => id);
  }

  function renderSelection() {
    const sources = rankedSources();
    const signature = sources.map(id => `${id}:${state[id].isPlaying}`).join(",");
    if (signature !== orderSignature || !sources.includes(selected)) manualSelection = false;
    if (!manualSelection) selected = sources[0] ?? "spotify";
    orderSignature = signature;
    spotify.hidden = selected !== "spotify";
    youtube.hidden = selected !== "youtube";
    navigation.hidden = sources.length < 2;
    selection.textContent = `${selected === "youtube" ? "YOUTUBE" : "SPOTIFY"} // ${Math.max(1, sources.indexOf(selected) + 1)} OF ${Math.max(1, sources.length)}`;
    const missingSession = sources.some(id => state[id].startedAt === null);
    status.textContent = youtubeError || (missingSession ? "Session timing unavailable; active playback is still prioritized." : "");
  }

  function switchSource(direction) {
    const sources = rankedSources();
    if (sources.length < 2) return;
    selected = sources[(sources.indexOf(selected) + direction + sources.length) % sources.length];
    manualSelection = true;
    renderSelection();
  }
  document.querySelector("#media-previous").addEventListener("click", () => switchSource(-1));
  document.querySelector("#media-next").addEventListener("click", () => switchSource(1));

  window.addEventListener("media:spotify", event => {
    const detail = event.detail;
    const startedAt = Date.parse(detail.sessionStartedAt);
    state.spotify = { available: detail.available, isPlaying: detail.isPlaying,
      startedAt: Number.isFinite(startedAt) ? startedAt : null };
    renderSelection();
  });

  function time(milliseconds) {
    const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function renderYoutubeTimeline() {
    const media = state.youtube;
    if (!media?.available) return;
    if (Date.now() >= media.expiresAt) {
      state.youtube = null;
      renderSelection();
      return;
    }
    const elapsed = media.isPlaying ? Math.max(0, Date.now() - media.updatedAt) : 0;
    const progress = media.durationMs > 0
      ? Math.min(media.durationMs, media.progressMs + elapsed) : media.progressMs + elapsed;
    document.querySelector("#youtube-current-time").textContent = time(progress);
    document.querySelector("#youtube-duration").textContent = media.durationMs > 0 ? time(media.durationMs) : "LIVE";
    document.querySelector("#youtube-progress").style.setProperty("--spotify-progress", `${media.durationMs > 0 ? progress / media.durationMs * 100 : 0}%`);
  }

  function applyYoutube(payload) {
    if (payload.item === null) {
      state.youtube = null;
      renderSelection();
      return;
    }
    const item = payload.item;
    const updatedAt = Date.parse(payload.updatedAt);
    const expiresAt = Date.parse(payload.expiresAt);
    const startedAt = Date.parse(payload.sessionStartedAt);
    if (!item || typeof item.videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(item.videoId)
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > 300
      || typeof item.channel !== "string" || !item.channel.trim() || item.channel.length > 200
      || typeof payload.isPlaying !== "boolean"
      || !Number.isFinite(payload.progressMs) || payload.progressMs < 0
      || !Number.isFinite(item.durationMs) || item.durationMs < 0
      || !Number.isFinite(updatedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(startedAt)
      || expiresAt - updatedAt > 90_000 || expiresAt < updatedAt || updatedAt > Date.now() + 30_000
      || startedAt > updatedAt) {
      throw new Error("YouTube playback response is malformed.");
    }
    state.youtube = { available: expiresAt > Date.now(), isPlaying: payload.isPlaying,
      startedAt, updatedAt, expiresAt, progressMs: payload.progressMs, durationMs: item.durationMs };
    youtube.dataset.state = payload.isPlaying ? "playing" : "paused";
    document.querySelector("#youtube-state").textContent = payload.isPlaying ? "NOW WATCHING // YOUTUBE" : "WATCHING PAUSED // YOUTUBE";
    document.querySelector("#youtube-track").textContent = item.title;
    document.querySelector("#youtube-channel").textContent = item.channel;
    document.querySelector("#youtube-video-link").href = `https://www.youtube.com/watch?v=${item.videoId}`;
    renderYoutubeTimeline();
    renderSelection();
  }

  async function refreshYoutubePresence() {
    window.clearTimeout(refreshTimer);
    if (document.visibilityState !== "visible") return;
    const config = window.SUPABASE_CONFIG;
    if (!config?.url || !config?.anonKey) {
      youtubeError = "YouTube presence is not configured.";
      renderSelection();
      return;
    }
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    const sequence = ++requestSequence;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${config.url}/functions/v1/youtube-presence`, {
        headers: { apikey: config.anonKey }, signal: controller.signal, cache: "no-store",
      });
      if (!response.ok) throw new Error(`YouTube presence returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (sequence !== requestSequence) return;
      youtubeError = "";
      applyYoutube(payload);
    } catch (error) {
      if (sequence !== requestSequence) return;
      console.error("Unable to load YouTube presence:", error);
      state.youtube = null;
      youtubeError = "YouTube status unavailable. Spotify status is unaffected.";
      renderSelection();
    } finally {
      window.clearTimeout(timeout);
      if (sequence === requestSequence && document.visibilityState === "visible") {
        refreshTimer = window.setTimeout(refreshYoutubePresence, 30_000);
      }
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      renderYoutubeTimeline();
      refreshYoutubePresence();
    } else {
      window.clearTimeout(refreshTimer);
      requestSequence++;
      requestController?.abort();
    }
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) refreshYoutubePresence();
  });
  window.setInterval(renderYoutubeTimeline, 1000);
  refreshYoutubePresence();
})();
