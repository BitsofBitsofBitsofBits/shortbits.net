globalThis.BITS_YOUTUBE = {
  videoId(url) {
    const parsed = new URL(url);
    if (parsed.origin !== "https://www.youtube.com") return null;
    const id = parsed.pathname === "/watch"
      ? parsed.searchParams.get("v")
      : parsed.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  },
  validPlayback(item) {
    return item && typeof item === "object"
      && typeof item.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(item.videoId)
      && typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 300
      && typeof item.channel === "string" && item.channel.trim().length > 0 && item.channel.length <= 200
      && typeof item.isPlaying === "boolean"
      && Number.isInteger(item.progressMs) && item.progressMs >= 0 && item.progressMs <= 2_147_483_647
      && Number.isInteger(item.durationMs) && item.durationMs >= 0 && item.durationMs <= 2_147_483_647;
  },
  chooseTab(reports) {
    return reports.filter(report => this.validPlayback(report.item)).sort((first, second) =>
      Number(second.item.isPlaying) - Number(first.item.isPlaying)
      || Number(second.active) - Number(first.active)
      || first.tabId - second.tabId
    )[0]?.item ?? null;
  },
};
