function getYouTubeEmbedUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let videoId = null;
  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0];
  } else if (
    host === "youtube.com"
    || host === "m.youtube.com"
    || host === "youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else {
      const [section, id] = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(section)) {
        videoId = id;
      }
    }
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId ?? "")) {
    return null;
  }
  return {
    provider: "YouTube",
    url: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
  };
}

function getVimeoEmbedUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const videoId = host === "player.vimeo.com" && segments[0] === "video"
    ? segments[1]
    : segments[0];
  if (!/^\d+$/.test(videoId ?? "")) {
    return null;
  }
  return {
    provider: "Vimeo",
    url: `https://player.vimeo.com/video/${videoId}?autoplay=1`,
  };
}

function getSpotifyEmbedUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "open.spotify.com") {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const typeIndex = segments.findIndex((segment) => (
    ["album", "episode", "playlist", "show", "track"].includes(segment)
  ));
  const type = segments[typeIndex];
  const id = segments[typeIndex + 1];
  if (!type || !/^[A-Za-z0-9]+$/.test(id ?? "")) {
    return null;
  }
  return {
    provider: "Spotify",
    url: `https://open.spotify.com/embed/${type}/${id}`,
  };
}

function getShortBitEmbed(destination) {
  let url;
  try {
    url = new URL(destination);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") {
    return null;
  }
  return getYouTubeEmbedUrl(url)
    || getVimeoEmbedUrl(url)
    || getSpotifyEmbedUrl(url);
}

window.BITS_SHORTBITS = {
  getEmbed: getShortBitEmbed,
};
