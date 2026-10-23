const discordRefreshIntervalMs = 60_000;
const lanyardReconnectDelayMs = 5_000;
const discordStatus = document.querySelector("#discord-presence-status");
const discordCustomStatus = document.querySelector("#discord-custom-status");
const discordActivity = document.querySelector("#discord-activity");

let discordRefreshTimer;
let lanyardHeartbeatTimer;
let lanyardReconnectTimer;
let lanyardSocket;
let lanyardSocketGeneration = 0;
let lanyardUserId;
let discordLastPresence;
let discordLastUpdatedAt = 0;
let discordRequestInFlight = false;

function markDiscordStale() {
  if (!discordLastPresence) return;
  discordStatus.dataset.state = "stale";
  discordStatus.textContent = `${String(discordLastPresence.status || "offline").toUpperCase()} // LAST KNOWN ${new Date(discordLastUpdatedAt).toLocaleString()}`;
}

function formatDiscordActivity(activity) {
  return [activity.name, activity.details, activity.state]
    .filter(Boolean)
    .join(" // ");
}

function renderDiscordPresence(presence) {
  discordStatus.dataset.state = presence.stale ? "stale" : "fresh";
  if (!presence.enrolled) {
    discordLastPresence = undefined;
    lanyardUserId = undefined;
    disconnectLanyardSocket();
    discordStatus.textContent = "SETUP REQUIRED";
    discordCustomStatus.textContent = "Join Lanyard to publish presence";
    discordActivity.textContent = "Unavailable";
    return;
  }

  discordStatus.textContent = String(presence.status || "offline").toUpperCase();
  discordCustomStatus.textContent = presence.customStatus || "No custom status";
  discordActivity.textContent = presence.activities?.length
    ? presence.activities.map(formatDiscordActivity).join(" | ")
    : "No public activity";
  discordLastPresence = presence;
  const age = Number(presence.cacheAgeMs);
  discordLastUpdatedAt = Date.now() - (Number.isFinite(age) ? Math.max(0, age) : 0);
  if (presence.stale || Date.now() - discordLastUpdatedAt > discordRefreshIntervalMs * 2) markDiscordStale();
}

function publishLanyardSpotify(presence) {
  const spotify = presence?.listening_to_spotify ? presence.spotify : null;
  const timestamps = spotify?.timestamps;
  const detail = (
      spotify
      && typeof spotify.song === "string"
      && typeof spotify.artist === "string"
      && Number.isFinite(timestamps?.start)
      && Number.isFinite(timestamps?.end)
      && timestamps.end > timestamps.start
    )
    ? {
      album: typeof spotify.album === "string" ? spotify.album : null,
      albumArtUrl: typeof spotify.album_art_url === "string"
        ? spotify.album_art_url
        : null,
      artist: spotify.artist,
      song: spotify.song,
      startAt: timestamps.start,
      endAt: timestamps.end,
      trackId: typeof spotify.track_id === "string" ? spotify.track_id : null,
    }
    : null;

  window.LANYARD_SPOTIFY = detail;
  window.dispatchEvent(new CustomEvent("lanyard:spotify", { detail }));
}

function disconnectLanyardSocket() {
  lanyardSocketGeneration += 1;
  window.clearInterval(lanyardHeartbeatTimer);
  window.clearTimeout(lanyardReconnectTimer);
  lanyardHeartbeatTimer = undefined;
  lanyardReconnectTimer = undefined;

  if (lanyardSocket) {
    lanyardSocket.close();
    lanyardSocket = undefined;
  }
  window.LANYARD_SPOTIFY = null;
  window.dispatchEvent(new CustomEvent("lanyard:disconnected"));
}

function connectLanyardSocket(userId) {
  if (!/^\d{17,20}$/.test(userId) || document.visibilityState !== "visible") {
    return;
  }
  if (
    lanyardSocket
    && (
      lanyardSocket.readyState === WebSocket.CONNECTING
      || lanyardSocket.readyState === WebSocket.OPEN
    )
  ) {
    return;
  }

  window.clearTimeout(lanyardReconnectTimer);
  const generation = ++lanyardSocketGeneration;
  const socket = new WebSocket("wss://api.lanyard.rest/socket");
  lanyardSocket = socket;

  socket.addEventListener("message", (event) => {
    if (generation !== lanyardSocketGeneration) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      console.warn("Ignoring malformed Lanyard socket data:", error);
      return;
    }

    if (payload.op === 1) {
      const heartbeatInterval = Number(payload.d?.heartbeat_interval);
      if (!Number.isFinite(heartbeatInterval) || heartbeatInterval < 1_000) {
        socket.close();
        return;
      }
      socket.send(JSON.stringify({
        op: 2,
        d: { subscribe_to_id: userId },
      }));
      window.clearInterval(lanyardHeartbeatTimer);
      lanyardHeartbeatTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ op: 3 }));
        }
      }, heartbeatInterval);
      return;
    }

    if (
      payload.op === 0
      && (payload.t === "INIT_STATE" || payload.t === "PRESENCE_UPDATE")
    ) {
      publishLanyardSpotify(payload.d?.[userId] ?? payload.d);
    }
  });

  socket.addEventListener("close", () => {
    if (generation !== lanyardSocketGeneration) {
      return;
    }
    window.clearInterval(lanyardHeartbeatTimer);
    lanyardHeartbeatTimer = undefined;
    lanyardSocket = undefined;
    window.LANYARD_SPOTIFY = null;
    window.dispatchEvent(new CustomEvent("lanyard:disconnected"));
    if (document.visibilityState === "visible") {
      lanyardReconnectTimer = window.setTimeout(
        () => connectLanyardSocket(userId),
        lanyardReconnectDelayMs,
      );
    }
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

async function refreshDiscordPresence() {
  window.clearTimeout(discordRefreshTimer);
  if (discordRequestInFlight || document.visibilityState !== "visible") return;
  const projectUrl = window.SUPABASE_CONFIG?.url;
  const anonKey = window.SUPABASE_CONFIG?.anonKey;

  if (!projectUrl || projectUrl.toLowerCase().includes("your_project_id")) {
    discordStatus.textContent = "NOT CONFIGURED";
    return;
  }

  discordRequestInFlight = true;
  try {
    const response = await fetch(`${projectUrl}/functions/v1/discord-presence`, {
      headers: anonKey ? { "apikey": anonKey } : {},
    });
    const presence = await response.json();
    if (!response.ok) {
      throw new Error(presence.error || `Discord presence returned ${response.status}.`);
    }
    if (typeof presence.enrolled !== "boolean") {
      throw new Error("Discord presence response is malformed.");
    }
    renderDiscordPresence(presence);
    if (presence.enrolled && typeof presence.userId === "string") {
      lanyardUserId = presence.userId;
      connectLanyardSocket(lanyardUserId);
    }
  } catch (error) {
    console.error("Unable to load Discord presence:", error);
    if (discordLastPresence) {
      markDiscordStale();
    } else {
      discordStatus.textContent = "SIGNAL UNAVAILABLE";
      discordCustomStatus.textContent = "Presence could not be loaded";
      discordActivity.textContent = "Unavailable";
    }
  } finally {
    discordRequestInFlight = false;
    if (document.visibilityState === "visible") {
      discordRefreshTimer = window.setTimeout(
        refreshDiscordPresence,
        discordRefreshIntervalMs,
      );
    } else {
      markDiscordStale();
    }
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshDiscordPresence();
    if (lanyardUserId) {
      connectLanyardSocket(lanyardUserId);
    }
  } else {
    window.clearTimeout(discordRefreshTimer);
    markDiscordStale();
    disconnectLanyardSocket();
  }
});

refreshDiscordPresence();
