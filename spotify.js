const spotifyWidget = document.querySelector("#spotify-widget");
const spotifyArtwork = document.querySelector("#spotify-artwork");
const spotifyState = document.querySelector("#spotify-state");
const spotifyTrack = document.querySelector("#spotify-track");
const spotifyArtist = document.querySelector("#spotify-artist");
const spotifyProgress = document.querySelector("#spotify-progress");
const spotifyCurrentTime = document.querySelector("#spotify-current-time");
const spotifyDuration = document.querySelector("#spotify-duration");
const spotifyLink = document.querySelector("#spotify-track-link");
const spotifyRefreshIntervalMs = 30000;
const spotifyMaximumRetryDelayMs = 2_147_000_000;

let spotifyRefreshTimer;
let spotifyRequestSequence = 0;
let hasSpotifyPlayback = false;
let playbackClock = {
  durationMs: 0,
  isPlaying: false,
  progressMs: 0,
  synchronizedAt: performance.now(),
};

function formatPlaybackTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateSpotifyTimeline() {
  const elapsedSinceSync = playbackClock.isPlaying
    ? performance.now() - playbackClock.synchronizedAt
    : 0;
  const currentMs = Math.min(
    playbackClock.durationMs,
    playbackClock.progressMs + elapsedSinceSync,
  );
  const progress = playbackClock.durationMs > 0
    ? (currentMs / playbackClock.durationMs) * 100
    : 0;

  spotifyCurrentTime.textContent = formatPlaybackTime(currentMs);
  spotifyDuration.textContent = formatPlaybackTime(playbackClock.durationMs);
  spotifyProgress.style.setProperty("--spotify-progress", `${progress}%`);
}

function setSpotifyIdle(message, detail = "Check back when the bits are louder.") {
  hasSpotifyPlayback = false;
  spotifyWidget.dataset.state = "idle";
  spotifyState.textContent = "NO ACTIVE SIGNAL";
  spotifyTrack.textContent = message;
  spotifyArtist.textContent = detail;
  spotifyArtwork.hidden = true;
  spotifyArtwork.removeAttribute("src");
  playbackClock = {
    durationMs: 0,
    isPlaying: false,
    progressMs: 0,
    synchronizedAt: performance.now(),
  };
  updateSpotifyTimeline();
  spotifyLink.hidden = true;
}

function renderSpotifyPlayback(playback) {
  const { item } = playback;

  if (!item) {
    setSpotifyIdle("Nothing is playing rn");
    return;
  }

  spotifyWidget.dataset.state = playback.isPlaying ? "playing" : "paused";
  hasSpotifyPlayback = true;
  spotifyState.textContent = playback.isPlaying ? "NOW LISTENING" : "PLAYBACK PAUSED";
  spotifyTrack.textContent = item.title;
  spotifyArtist.textContent = item.artists.join(", ") || item.collection || "Unknown artist";

  if (item.albumArt) {
    spotifyArtwork.src = item.albumArt;
    spotifyArtwork.alt = `${item.collection || item.title} artwork`;
    spotifyArtwork.hidden = false;
  } else {
    spotifyArtwork.hidden = true;
    spotifyArtwork.removeAttribute("src");
  }

  const originCacheAgeMs = Number(playback.cacheAgeMs);
  const servedAt = Number(playback.servedAt);
  const deliveryAgeMs = Number.isFinite(servedAt)
    ? Math.max(0, Date.now() - servedAt)
    : 0;
  const effectiveCacheAgeMs = Number.isFinite(originCacheAgeMs)
    ? Math.max(0, originCacheAgeMs) + deliveryAgeMs
    : 0;

  playbackClock = {
    durationMs: item.durationMs,
    isPlaying: playback.isPlaying,
    progressMs: Math.min(
      item.durationMs,
      playback.progressMs + (playback.isPlaying ? effectiveCacheAgeMs : 0),
    ),
    synchronizedAt: performance.now(),
  };
  updateSpotifyTimeline();

  if (item.spotifyUrl) {
    spotifyLink.href = item.spotifyUrl;
    spotifyLink.hidden = false;
  } else {
    spotifyLink.hidden = true;
  }
}

async function refreshSpotifyPlayback() {
  window.clearTimeout(spotifyRefreshTimer);
  const requestSequence = ++spotifyRequestSequence;
  let nextRefreshDelayMs = spotifyRefreshIntervalMs;

  const projectUrl = window.SUPABASE_CONFIG?.url;
  const anonKey = window.SUPABASE_CONFIG?.anonKey;

  if (!projectUrl || projectUrl.toLowerCase().includes("your_project_id")) {
    setSpotifyIdle("Spotify signal is not configured");
    return;
  }

  try {
    const response = await fetch(
      `${projectUrl}/functions/v1/spotify-now-playing`,
      {
        headers: anonKey ? { "apikey": anonKey } : {},
      },
    );
    const playback = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterSeconds = Number(playback.retryAfterSeconds);
        nextRefreshDelayMs = Number.isFinite(retryAfterSeconds)
          && retryAfterSeconds > 0
          ? Math.min(
            spotifyMaximumRetryDelayMs,
            Math.max(spotifyRefreshIntervalMs, retryAfterSeconds * 1000),
          )
          : 60000;
        const error = new Error("Spotify rate limit reached.");
        error.isRateLimited = true;
        error.retryAfterMs = nextRefreshDelayMs;
        throw error;
      }
      throw new Error(playback.error || `Spotify request failed with ${response.status}.`);
    }

    if (requestSequence !== spotifyRequestSequence) {
      return;
    }

    renderSpotifyPlayback(playback);
    const retryAfterSeconds = Number(playback.retryAfterSeconds);
    if (
      playback.cacheStatus === "stale"
      && Number.isFinite(retryAfterSeconds)
      && retryAfterSeconds > 0
    ) {
      nextRefreshDelayMs = Math.min(
        spotifyMaximumRetryDelayMs,
        Math.max(spotifyRefreshIntervalMs, retryAfterSeconds * 1000),
      );
      console.warn(
        `Spotify is cooling down; showing cached playback and retrying in ${Math.ceil(nextRefreshDelayMs / 1000)} seconds.`,
      );
      if (playback.item) {
        spotifyState.textContent = "SIGNAL THROTTLED";
      } else {
        setSpotifyIdle(
          "Spotify is cooling down",
          "I sent too many bits to it.",
        );
      }
    }
  } catch (error) {
    if (requestSequence !== spotifyRequestSequence) {
      return;
    }

    if (error.isRateLimited) {
      console.warn(
        `Spotify rate limit reached; retrying in ${Math.ceil(error.retryAfterMs / 1000)} seconds.`,
      );
      if (hasSpotifyPlayback) {
        spotifyState.textContent = "SIGNAL THROTTLED";
      } else {
        setSpotifyIdle(
          "Spotify is cooling down",
          "I sent too many bits to it.",
        );
      }
    } else {
      console.error("Unable to load Spotify playback:", error);
      setSpotifyIdle("Spotify signal temporarily lost");
    }
  } finally {
    if (requestSequence === spotifyRequestSequence) {
      spotifyRefreshTimer = window.setTimeout(
        refreshSpotifyPlayback,
        nextRefreshDelayMs,
      );
    }
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    updateSpotifyTimeline();
    refreshSpotifyPlayback();
  }
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    updateSpotifyTimeline();
    refreshSpotifyPlayback();
  }
});

refreshSpotifyPlayback();
window.setInterval(updateSpotifyTimeline, 1000);
