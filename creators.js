(() => {
  const panel = document.querySelector("#creators-window");
  if (!panel) return;
  const list = document.querySelector("#creators-list");
  const status = document.querySelector("#creators-status");
  const refresh = document.querySelector("#creators-refresh");
  let loading = false;
  let loadedAt = 0;

  function report(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }

  function externalLink(label, href) {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function isHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  function createCreator(creator) {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    const avatar = document.createElement("span");
    avatar.className = "creator-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = creator.title.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase();
    if (creator.youtube_channel_id) avatar.dataset.avatarChannelId = creator.youtube_channel_id;
    heading.className = "creator-heading";
    const title = document.createElement("h3");
    const platform = document.createElement("p");
    title.append(externalLink(creator.title, creator.channel_url));
    platform.className = "creator-platform";
    platform.textContent = creator.platform;
    heading.append(avatar, title);
    item.append(heading, platform);
    if (creator.note) {
      const note = document.createElement("p");
      note.textContent = creator.note;
      item.append(note);
    }
    item.append(externalLink("OPEN CHANNEL / PROFILE", creator.channel_url));
    if (creator.youtube_channel_id) {
      const latest = document.createElement("div");
      latest.className = "creator-latest";
      latest.dataset.channelId = creator.youtube_channel_id;
      latest.textContent = "Checking latest YouTube upload...";
      item.append(latest);
    }
    return item;
  }

  function isChannelPhoto(value) {
    if (!isHttpsUrl(value)) return false;
    const url = new URL(value);
    return !url.port && ["yt3.googleusercontent.com", "yt3.ggpht.com"].includes(url.hostname);
  }

  async function loadLatest(url, anonKey) {
    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/creator-videos`, {
      headers: { apikey: anonKey }, signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Latest-video service returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (!Array.isArray(payload.videos) || payload.videos.some((entry) => (
      !entry || !/^UC[A-Za-z0-9_-]{22}$/.test(entry.channelId)
      || typeof entry.unavailable !== "boolean"
      || typeof entry.photoUnavailable !== "boolean"
      || (entry.avatarUrl !== null && !isChannelPhoto(entry.avatarUrl))
      || (entry.video !== null && (
        !entry.video || typeof entry.video.title !== "string"
        || !/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(entry.video.url)
        || !Number.isFinite(Date.parse(entry.video.publishedAt))
      ))
    ))) throw new Error("Latest-video service returned invalid data.");
    const videos = new Map(payload.videos.map((entry) => [entry.channelId, entry]));
    let unavailable = false;
    list.querySelectorAll("[data-avatar-channel-id]").forEach((container) => {
      const entry = videos.get(container.dataset.avatarChannelId);
      if (!entry || entry.photoUnavailable || !entry.avatarUrl) {
        container.title = "YouTube channel photo unavailable.";
        unavailable = true;
        return;
      }
      const image = document.createElement("img");
      image.alt = "";
      image.width = 64;
      image.height = 64;
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("load", () => image.classList.add("is-loaded"), { once: true });
      image.addEventListener("error", () => {
        image.remove();
        console.warn(`Unable to display channel photo for ${entry.channelId}.`);
        container.title = "YouTube channel photo unavailable.";
        report("Creator list loaded. Some channel photos could not load; initials are shown instead.", "warning");
      }, { once: true });
      image.src = entry.avatarUrl;
      container.append(image);
    });
    list.querySelectorAll("[data-channel-id]").forEach((container) => {
      const entry = videos.get(container.dataset.channelId);
      if (!entry || entry.unavailable) {
        container.textContent = "Latest video unavailable. The channel link still works.";
        unavailable = true;
      } else if (!entry.video) {
        container.textContent = "No public uploads found.";
      } else {
        const label = document.createElement("p");
        const date = document.createElement("time");
        label.textContent = "LATEST YOUTUBE UPLOAD";
        date.dateTime = entry.video.publishedAt;
        date.textContent = new Date(entry.video.publishedAt).toLocaleDateString();
        container.replaceChildren(label, externalLink(entry.video.title, entry.video.url), date);
      }
    });
    return unavailable;
  }

  async function load(force = false) {
    if (loading || (!force && Date.now() - loadedAt < 300_000)) return;
    loading = true;
    refresh.disabled = true;
    report("Loading CREATOR.FEED...");
    try {
      const { url, anonKey } = window.SUPABASE_CONFIG || {};
      if (!url || !anonKey) throw new Error("Creator feed configuration is missing.");
      const response = await fetch(
        `${url.replace(/\/$/, "")}/rest/v1/site_creators?select=position,title,platform,channel_url,note,youtube_channel_id&enabled=eq.true&order=sort_order.asc,position.asc`,
        { headers: { apikey: anonKey }, signal: AbortSignal.timeout(15_000) },
      );
      if (!response.ok) throw new Error(`Creator list returned HTTP ${response.status}.`);
      const creators = await response.json();
      if (!Array.isArray(creators) || creators.some((creator) => (
        !creator || typeof creator.title !== "string" || typeof creator.platform !== "string"
        || (creator.note !== null && typeof creator.note !== "string")
        || !isHttpsUrl(creator.channel_url)
        || (creator.youtube_channel_id !== null && !/^UC[A-Za-z0-9_-]{22}$/.test(creator.youtube_channel_id))
      ))) throw new Error("Creator list returned invalid data.");
      list.replaceChildren(...creators.map(createCreator));
      list.hidden = creators.length === 0;
      loadedAt = Date.now();
      if (!creators.length) {
        report("The creator list is awaiting operator input.");
        return;
      }
      report("Creator list loaded.", "success");
      if (creators.some((creator) => creator.youtube_channel_id)) {
        try {
          const unavailable = await loadLatest(url, anonKey);
          report(unavailable
            ? "Creator list loaded. Some YouTube videos or photos are unavailable; try Refresh later."
            : "Creator list loaded. YouTube uploads and photos may be cached for up to 10 minutes.",
          unavailable ? "warning" : "success");
        } catch (error) {
          console.warn("Unable to load latest creator videos:", error);
          list.querySelectorAll("[data-channel-id]").forEach((container) => {
            container.textContent = "Latest video unavailable. The channel link still works.";
          });
          report("Creator list loaded, but YouTube videos and photos are unavailable. Initials are shown instead. Try Refresh later.", "warning");
        }
      }
    } catch (error) {
      console.error("Unable to load creator feed:", error);
      loadedAt = 0;
      report(`Creator feed unavailable: ${error.message} Try Refresh to retry.`, "error");
    } finally {
      loading = false;
      refresh.disabled = false;
    }
  }

  refresh.addEventListener("click", () => load(true));
  window.addEventListener("desktop-window:opened", (event) => {
    if (event.detail.windowId === "creators-window") load();
  });
  if (!panel.hidden) load();
})();
