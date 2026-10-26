(() => {
  const played = new WeakSet();
  function snapshot() {
    const videoId = BITS_YOUTUBE.videoId(location.href);
    if (!videoId) return { item: null };
    const shorts = location.pathname.startsWith("/shorts/");
    const container = document.querySelector(shorts ? "ytd-reel-video-renderer[is-active]" : "ytd-watch-flexy");
    const containerId = container?.getAttribute("video-id");
    if (containerId && containerId !== videoId) return { transient: true };
    const video = container?.querySelector("video.html5-main-video") ?? document.querySelector("video.html5-main-video");
    if (document.querySelector(".ad-showing, .ad-interrupting")) return { transient: true };
    if (!video || video.ended) return { item: null };
    if (video.readyState < 1) return { transient: true };
    if (!video.paused || video.currentTime > 0) played.add(video);
    if (!played.has(video)) return { item: null };
    const title = (document.querySelector(shorts
      ? "ytd-reel-video-renderer[is-active] h2"
      : "h1.ytd-watch-metadata yt-formatted-string")?.textContent ?? document.title.replace(/ - YouTube$/, "")).trim().slice(0, 300);
    const channel = (container?.querySelector("#channel-name a, ytd-channel-name a, .yt-content-metadata-view-model__metadata-text")?.textContent ?? "").trim().slice(0, 200);
    if (!title || !channel) return { transient: true };
    const avatarImages = container?.querySelectorAll(
      "#owner #avatar img, ytd-video-owner-renderer #avatar img, #channel-thumbnail img, yt-reel-channel-bar-view-model img"
    ) ?? [];
    let channelAvatarUrl = null;
    for (const image of avatarImages) {
      channelAvatarUrl = [image.currentSrc, image.getAttribute("src"), image.getAttribute("data-src")]
        .map(value => BITS_YOUTUBE.channelAvatarUrl(value)).find(Boolean) ?? null;
      if (channelAvatarUrl) break;
    }
    const milliseconds = value => Number.isFinite(value) ? Math.min(2_147_483_647, Math.max(0, Math.round(value * 1000))) : 0;
    const item = { videoId, title, channel, channelAvatarUrl, isPlaying: !video.paused,
      progressMs: milliseconds(video.currentTime), durationMs: milliseconds(video.duration) };
    return { item };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id === chrome.runtime.id && message.type === "snapshot") respond(snapshot());
  });
  function changed(event) {
    if (event.target instanceof HTMLVideoElement && event.type === "play") played.add(event.target);
    chrome.runtime.sendMessage({ type: "playback-changed" }).catch(error => {
      console.warn("YouTube presence extension disconnected. Reload this tab to reconnect.", error.message);
    });
  }
  for (const type of ["play", "pause", "ended", "loadedmetadata", "seeked", "emptied"]) {
    document.addEventListener(type, changed, true);
  }
  document.addEventListener("yt-navigate-finish", changed);
})();
