const spotifyWidget = document.querySelector("#spotify-widget");
const spotifyArtwork = document.querySelector("#spotify-artwork");
const spotifyState = document.querySelector("#spotify-state");
const spotifyTrack = document.querySelector("#spotify-track");
const spotifyArtist = document.querySelector("#spotify-artist");
const spotifyProgress = document.querySelector("#spotify-progress");
const spotifyCurrentTime = document.querySelector("#spotify-current-time");
const spotifyDuration = document.querySelector("#spotify-duration");
const spotifyLink = document.querySelector("#spotify-track-link");
const spotifyRecentTrack = document.querySelector("#spotify-recent-track");
const spotifyTopTracks = document.querySelector("#spotify-top-tracks");
const spotifyAllTimeTracks = document.querySelector("#spotify-all-time-tracks");
const spotifyFeaturedPlaylists = document.querySelector("#spotify-featured-playlists");
const spotifyFeaturedTracks = document.querySelector("#spotify-featured-tracks");
const spotifyHistoryStatus = document.querySelector("#spotify-history-status");
const spotifyRefreshIntervalMs = 30000;
const spotifyHistoryRefreshIntervalMs = 300_000;
const spotifyMaximumRetryDelayMs = 2_147_000_000;
const lanyardOverrideWindowMs = 35_000;

let spotifyRefreshTimer;
let spotifyRequestSequence = 0;
let hasSpotifyPlayback = false;
let hasLanyardSpotifyPlayback = false;
let lastLanyardSpotifyUpdateAt = 0;
let spotifyHistoryLoadedAt = 0;
let spotifyHistoryRequestInFlight = null;
let featuredPlaylistsLoadedAt = 0;
let featuredPlaylistsRequestInFlight = null;
let featuredTracksLoadedAt = 0;
let featuredTracksRequestInFlight = null;
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

function getSpotifyCurrentTimeMs() {
  const elapsedSinceSync = playbackClock.isPlaying
    ? performance.now() - playbackClock.synchronizedAt
    : 0;
  return Math.min(
    playbackClock.durationMs,
    playbackClock.progressMs + elapsedSinceSync,
  );
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

  applySpotifyPlayback(playback, item);
}

  function isValidHistoryTrack(track) {
    return track
      && typeof track.title === "string"
      && Array.isArray(track.artists)
      && track.artists.every((artist) => typeof artist === "string")
      && (track.collection === null || typeof track.collection === "string")
      && (track.albumArt === null || typeof track.albumArt === "string")
      && (track.spotifyUrl === null || typeof track.spotifyUrl === "string");
  }

  function createSpotifyHistoryTrack(track, detail = "") {
    const element = track.spotifyUrl
      ? document.createElement("a")
      : document.createElement("div");
    element.className = "spotify-history-track";
    if (track.spotifyUrl) {
      element.href = track.spotifyUrl;
      element.target = "_blank";
      element.rel = "noreferrer";
    }

    if (track.albumArt) {
      element.classList.add("has-artwork");
      const artwork = document.createElement("img");
      artwork.src = track.albumArt;
      artwork.alt = "";
      artwork.loading = "lazy";
      element.append(artwork);
    }

    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const artist = document.createElement("span");
    title.textContent = track.title;
    artist.textContent = track.artists.join(", ") || "Unknown artist";
    copy.append(title, artist);

    if (detail) {
      const metadata = document.createElement("small");
      metadata.textContent = detail;
      copy.append(metadata);
    }

    element.append(copy);
    return element;
  }

  function renderSpotifyHistory(history) {
    const recentTrack = history.recentTrack;

    spotifyRecentTrack.replaceChildren();
    if (recentTrack && isValidHistoryTrack(recentTrack)) {
      const playedAt = Date.parse(recentTrack.playedAt);
      const detail = Number.isFinite(playedAt)
        ? `PLAYED ${new Date(playedAt).toLocaleString()}`
        : "";
      spotifyRecentTrack.append(createSpotifyHistoryTrack(recentTrack, detail));
    } else {
      const empty = document.createElement("p");
      empty.textContent = "No recently played track was returned.";
      spotifyRecentTrack.append(empty);
    }

    renderSpotifyRankings(history);
  }

  function isValidFeaturedPlaylist(playlist) {
      return playlist
        && Number.isInteger(playlist.position)
        && playlist.position >= 1
        && typeof playlist.title === "string"
        && playlist.title.trim().length > 0
        && playlist.title.length <= 100
        && typeof playlist.spotify_url === "string"
        && /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?.*)?$/.test(
          playlist.spotify_url,
        );
    }

  function renderFeaturedPlaylists(playlists) {
      spotifyFeaturedPlaylists.replaceChildren();
      playlists
        .filter((playlist) => playlist.enabled && isValidFeaturedPlaylist(playlist))
        .sort((first, second) => first.position - second.position)
        .forEach((playlist) => {
          const item = document.createElement("li");
          item.value = playlist.position;
          item.append(createSpotifyHistoryTrack({
            title: playlist.title.trim(),
            artists: ["CURATED PLAYLIST"],
            collection: null,
            albumArt: null,
            spotifyUrl: playlist.spotify_url,
          }));
          spotifyFeaturedPlaylists.append(item);
        });

      if (!spotifyFeaturedPlaylists.children.length) {
        const empty = document.createElement("li");
        empty.textContent = "Playlist entries are awaiting curation.";
        spotifyFeaturedPlaylists.append(empty);
      }
    }

  async function loadFeaturedPlaylists() {
      if (
        featuredPlaylistsRequestInFlight
        || Date.now() - featuredPlaylistsLoadedAt < spotifyHistoryRefreshIntervalMs
      ) {
        return featuredPlaylistsRequestInFlight;
      }

      const { url, anonKey } = window.SUPABASE_CONFIG || {};
      if (!url || !anonKey) {
        spotifyFeaturedPlaylists.replaceChildren();
        const error = document.createElement("li");
        error.textContent = "Featured playlists are not configured.";
        spotifyFeaturedPlaylists.append(error);
        return;
      }

      featuredPlaylistsRequestInFlight = (async () => {
        try {
          const response = await fetch(
            `${url.replace(/\/$/, "")}/rest/v1/spotify_featured_playlists?select=position,title,spotify_url,enabled&order=position.asc`,
            {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
              },
            },
          );
          const playlists = await response.json();
          if (!response.ok) {
            throw new Error(
              playlists.message || `Featured playlists returned ${response.status}.`,
            );
          }
          if (
            !Array.isArray(playlists)
            || playlists.some((playlist) => (
              typeof playlist.enabled !== "boolean"
              || (
                playlist.enabled
                && !isValidFeaturedPlaylist(playlist)
              )
            ))
          ) {
            throw new Error("Featured playlist response is malformed.");
          }
          renderFeaturedPlaylists(playlists);
          featuredPlaylistsLoadedAt = Date.now();
        } catch (error) {
          console.error("Unable to load featured playlists:", error);
          spotifyFeaturedPlaylists.replaceChildren();
          const unavailable = document.createElement("li");
          unavailable.textContent = "Featured playlist signal temporarily unavailable.";
          spotifyFeaturedPlaylists.append(unavailable);
        } finally {
          featuredPlaylistsRequestInFlight = null;
        }
      })();

      return featuredPlaylistsRequestInFlight;
    }

  function isValidFeaturedTrack(track) {
    return track
      && Number.isInteger(track.position)
      && track.position >= 1
      && typeof track.title === "string"
      && track.title.trim().length > 0
      && track.title.length <= 100
      && typeof track.artist === "string"
      && track.artist.trim().length > 0
      && track.artist.length <= 100
      && typeof track.spotify_url === "string"
      && /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+(?:\?.*)?$/.test(
        track.spotify_url,
      );
  }

  function renderFeaturedTracks(tracks) {
    spotifyFeaturedTracks.replaceChildren();
    tracks
      .filter((track) => track.enabled && isValidFeaturedTrack(track))
      .sort((first, second) => first.position - second.position)
      .forEach((track) => {
        const item = document.createElement("li");
        item.value = track.position;
        item.append(createSpotifyHistoryTrack({
          title: track.title.trim(),
          artists: [track.artist.trim()],
          collection: null,
          albumArt: null,
          spotifyUrl: track.spotify_url,
        }));
        spotifyFeaturedTracks.append(item);
      });

    if (!spotifyFeaturedTracks.children.length) {
      const empty = document.createElement("li");
      empty.textContent = "Song entries are awaiting curation.";
      spotifyFeaturedTracks.append(empty);
    }
  }

  async function loadFeaturedTracks() {
    if (
      featuredTracksRequestInFlight
      || Date.now() - featuredTracksLoadedAt < spotifyHistoryRefreshIntervalMs
    ) {
      return featuredTracksRequestInFlight;
    }

    const { url, anonKey } = window.SUPABASE_CONFIG || {};
    if (!url || !anonKey) {
      spotifyFeaturedTracks.replaceChildren();
      const error = document.createElement("li");
      error.textContent = "Featured songs are not configured.";
      spotifyFeaturedTracks.append(error);
      return;
    }

    featuredTracksRequestInFlight = (async () => {
      try {
        const response = await fetch(
          `${url.replace(/\/$/, "")}/rest/v1/spotify_featured_tracks?select=position,title,artist,spotify_url,enabled&order=position.asc`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          },
        );
        const tracks = await response.json();
        if (!response.ok) {
          throw new Error(
            tracks.message || `Featured songs returned ${response.status}.`,
          );
        }
        if (
          !Array.isArray(tracks)
          || tracks.some((track) => (
            typeof track.enabled !== "boolean"
            || (track.enabled && !isValidFeaturedTrack(track))
          ))
        ) {
          throw new Error("Featured song response is malformed.");
        }
        renderFeaturedTracks(tracks);
        featuredTracksLoadedAt = Date.now();
      } catch (error) {
        console.error("Unable to load featured songs:", error);
        spotifyFeaturedTracks.replaceChildren();
        const unavailable = document.createElement("li");
        unavailable.textContent = "Featured song signal temporarily unavailable.";
        spotifyFeaturedTracks.append(unavailable);
      } finally {
        featuredTracksRequestInFlight = null;
      }
    })();

    return featuredTracksRequestInFlight;
  }

  function renderSpotifyRankings(history) {
    const topTracks = Array.isArray(history.topTracks) ? history.topTracks : [];
    const allTimeTracks = Array.isArray(history.allTimeTracks)
      ? history.allTimeTracks
      : [];

    spotifyTopTracks.replaceChildren();
    topTracks.filter(isValidHistoryTrack).slice(0, 5).forEach((track, index) => {
      const item = document.createElement("li");
      item.value = index + 1;
      item.append(createSpotifyHistoryTrack(track));
      spotifyTopTracks.append(item);
    });
    if (!spotifyTopTracks.children.length) {
      const empty = document.createElement("li");
      empty.textContent = "No short-term top tracks were returned.";
      spotifyTopTracks.append(empty);
    }

    spotifyAllTimeTracks.replaceChildren();
    allTimeTracks.filter(isValidHistoryTrack).slice(0, 5).forEach((track, index) => {
      const item = document.createElement("li");
      item.value = index + 1;
      item.append(createSpotifyHistoryTrack(track));
      spotifyAllTimeTracks.append(item);
    });
    if (!spotifyAllTimeTracks.children.length) {
      const empty = document.createElement("li");
      empty.textContent = "No long-term top tracks were returned.";
      spotifyAllTimeTracks.append(empty);
    }

    spotifyHistoryStatus.textContent = history.cacheStatus === "stale"
      ? "Spotify history is cooling down. Showing cached musical Bits."
      : "Spotify short-term ranking synchronized.";
  }

  async function loadSpotifyHistory() {
    if (
      spotifyHistoryRequestInFlight
      || Date.now() - spotifyHistoryLoadedAt < spotifyHistoryRefreshIntervalMs
    ) {
      return spotifyHistoryRequestInFlight;
    }

    const projectUrl = window.SUPABASE_CONFIG?.url;
    const anonKey = window.SUPABASE_CONFIG?.anonKey;
    if (!projectUrl || projectUrl.toLowerCase().includes("your_project_id")) {
      spotifyHistoryStatus.textContent = "Spotify history is not configured.";
      return;
    }

    spotifyHistoryStatus.textContent = "Loading recent and top musical Bits...";
    spotifyHistoryRequestInFlight = (async () => {
      try {
        const response = await fetch(
          `${projectUrl}/functions/v1/spotify-now-playing?view=history`,
          { headers: anonKey ? { "apikey": anonKey } : {} },
        );
        const history = await response.json();
        if (!response.ok) {
          throw new Error(
            history.error || `Spotify history returned ${response.status}.`,
          );
        }
        if (
          !Array.isArray(history.topTracks)
          || !Array.isArray(history.allTimeTracks)
          || history.topTracks.some((track) => !isValidHistoryTrack(track))
          || history.allTimeTracks.some((track) => !isValidHistoryTrack(track))
          || (history.recentTrack && !isValidHistoryTrack(history.recentTrack))
        ) {
          throw new Error("Spotify history response is malformed.");
        }
        renderSpotifyHistory(history);
        spotifyHistoryLoadedAt = Date.now();
      } catch (error) {
        console.error("Unable to load Spotify history:", error);
        spotifyHistoryStatus.textContent = error.message.includes("updated scopes")
          ? "Spotify history needs owner reauthorization."
          : "Spotify history signal temporarily unavailable.";
      } finally {
        spotifyHistoryRequestInFlight = null;
      }
    })();

    return spotifyHistoryRequestInFlight;
  }

function applySpotifyPlayback(playback, item) {
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

function renderLanyardSpotify(spotify) {
  const durationMs = spotify.endAt - spotify.startAt;
  renderSpotifyPlayback({
    cacheAgeMs: 0,
    isPlaying: true,
    item: {
      albumArt: spotify.albumArtUrl,
      artists: [spotify.artist],
      collection: spotify.album,
      durationMs,
      spotifyUrl: spotify.trackId
        ? `https://open.spotify.com/track/${spotify.trackId}`
        : null,
      title: spotify.song,
    },
    progressMs: Math.max(0, Math.min(durationMs, Date.now() - spotify.startAt)),
    servedAt: Date.now(),
  });
}

function handleLanyardSpotify(event) {
  if (event.detail) {
    lastLanyardSpotifyUpdateAt = Date.now();
    hasLanyardSpotifyPlayback = true;
    renderLanyardSpotify(event.detail);
    return;
  }
  if (!hasLanyardSpotifyPlayback || !hasSpotifyPlayback) {
    return;
  }

  lastLanyardSpotifyUpdateAt = Date.now();
  playbackClock = {
    ...playbackClock,
    isPlaying: false,
    progressMs: getSpotifyCurrentTimeMs(),
    synchronizedAt: performance.now(),
  };
  spotifyWidget.dataset.state = "paused";
  spotifyState.textContent = "PLAYBACK PAUSED";
  updateSpotifyTimeline();
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

    if (Date.now() - lastLanyardSpotifyUpdateAt >= lanyardOverrideWindowMs) {
      renderSpotifyPlayback(playback);
    }
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

window.addEventListener("lanyard:spotify", handleLanyardSpotify);
window.addEventListener("desktop-window:opened", (event) => {
  if (event.detail?.windowId === "spotify-window") {
    loadSpotifyHistory();
    loadFeaturedPlaylists();
    loadFeaturedTracks();
  }
});
if (!document.querySelector("#spotify-window")?.hidden) {
  loadSpotifyHistory();
  loadFeaturedPlaylists();
  loadFeaturedTracks();
}
if (window.LANYARD_SPOTIFY) {
  handleLanyardSpotify({ detail: window.LANYARD_SPOTIFY });
}

refreshSpotifyPlayback();
window.setInterval(updateSpotifyTimeline, 1000);
