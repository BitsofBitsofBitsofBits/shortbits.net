(() => {
  if (!window.BITS_LAYOUTS) return;
  let observer;
  let chrome = [];
  let tracks = [];
  let selected = 0;
  let playing = false;
  let playerTitle, playerArtist, playerArt, playButton, progress;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.dataset.layoutChrome = "youtube-music";
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const link = (text, href, className) => {
    const node = make("a", className, text);
    node.href = href;
    return node;
  };
  const button = (label, text, action) => {
    const node = make("button", "ym-icon", text);
    node.type = "button";
    node.setAttribute("aria-label", label);
    node.addEventListener("click", action);
    return node;
  };
  function art(title, index) {
    const node = make("span", `ym-art ym-art-${index % 6}`);
    node.setAttribute("aria-hidden", "true");
    node.append(make("small", "", "BITS / MIX"), make("strong", "", title), make("span", "ym-art-play", "▶"));
    return node;
  }
  function showTrack(index) {
    selected = (index + tracks.length) % tracks.length;
    const track = tracks[selected];
    playerTitle.textContent = track.title;
    playerTitle.href = track.href;
    playerArtist.textContent = "Bits collection · Preview only · No audio playback";
    playerArt.replaceChildren(art(track.title, selected));
    playing = false;
    updatePlay();
  }
  function updatePlay() {
    playButton.textContent = playing ? "Ⅱ" : "▶";
    playButton.setAttribute("aria-pressed", String(playing));
    playButton.setAttribute("aria-label", playing ? "Pause visual preview (no audio)" : "Play visual preview (no audio)");
    progress.classList.toggle("ym-preview-active", playing);
  }
  function syncSpotify() {
    const widget = document.querySelector("#spotify-widget");
    const title = document.querySelector("#spotify-track")?.textContent.trim();
    if (!widget || !["playing", "paused"].includes(widget.dataset.state) || !title) return;
    playerTitle.textContent = title;
    playerTitle.href = document.querySelector("#spotify-track-link")?.href || "/online/#spotify-widget";
    playerArtist.textContent = `${document.querySelector("#spotify-artist")?.textContent.trim() || "Spotify"} · Live Spotify status (preview controls only)`;
    const source = document.querySelector("#spotify-artwork");
    if (source?.getAttribute("src") && !source.hidden) {
      const image = make("img");
      image.src = source.src;
      image.alt = "";
      playerArt.replaceChildren(image);
    }
    const amount = document.querySelector("#spotify-progress")?.style.getPropertyValue("--spotify-progress");
    if (amount) progress.style.setProperty("--ym-progress", amount);
  }
  window.BITS_LAYOUTS.register("youtube-music", {
    mount(ctx) {
      const main = document.querySelector("#interface-shell, .profile-layout, .blog-shell, .chooser, .endless-boot-console, .error-window");
      if (!main) return;
      const header = make("header", "ym-header");
      const brand = link("", "/", "ym-brand");
      brand.setAttribute("aria-label", "Music — Bits home, a YouTube Music inspired layout");
      brand.append(make("span", "ym-logo", "▶"), make("strong", "", "Music"));
      const searchLabel = make("label", "ym-search");
      searchLabel.append(make("span", "", "⌕"));
      const search = make("input");
      search.type = "search";
      search.placeholder = "Search your Bits";
      search.setAttribute("aria-label", "Filter music shelves");
      searchLabel.append(search);
      const account = link("C", "/professional/", "ym-account");
      account.setAttribute("aria-label", "Caleb's professional profile");
      header.append(brand, searchLabel, account);
      const sidebar = make("nav", "ym-sidebar");
      sidebar.setAttribute("aria-label", "Music navigation");
      [["⌂", "Home", "/", "chooser"], ["◉", "Explore", "/blog/", "blog"], ["▤", "Library", "/professional/", "professional"]].forEach(([glyph, title, href, page]) => {
        const item = link("", href, "ym-nav-item");
        item.append(make("span", "ym-nav-icon", glyph), make("span", "", title));
        if (ctx.page === page || (page === "blog" && ctx.page === "post")) item.setAttribute("aria-current", "page");
        sidebar.append(item);
      });
      const playlists = make("div", "ym-playlists");
      playlists.append(link("＋  Discover a playlist", "/online/", "ym-new-playlist"), link("Endless Boot", "/boot/"), make("small", "", "Bits · Live radio"), link("The professional mix", "/professional/"), make("small", "", "Caleb K Masters"), link("Longer Bits", "/blog/"), make("small", "", "Stories & liner notes"), make("p", "ym-disclaimer", "A personal-site remix.\nNot affiliated with YouTube.\nPreview controls do not play audio."));
      sidebar.append(playlists);
      const collection = make("section", "ym-collection");
      collection.setAttribute("aria-label", "Your Bits music collection");
      const greeting = make("div", "ym-greeting");
      greeting.append(make("span", "ym-avatar", "C"), make("div", "", "MADE FOR YOU"));
      const heading = make("h2", "ym-welcome", ctx.page === "boot" ? "The endless session" : ctx.page === "error" ? "A skipped track" : "Welcome to your next favorite Bit");
      collection.append(greeting, heading);
      const sources = [...main.querySelectorAll(".chooser-options a, .profile-header nav a, .profile-section[id], .blog-header a, .error-actions a, .endless-boot-actions a, .link-card, .content-file-grid button")];
      tracks = sources.slice(0, 12).map((node, index) => {
        const title = (node.querySelector("strong, h2, h3")?.textContent || node.textContent).trim().replace(/[_\s]+/g, " ").slice(0, 65);
        return { title: node.closest(".chooser-options") ? (index === 0 ? "The online mix" : "The professional mix") : title || `Bit ${index + 1}`, href: node.getAttribute("href") || (node.id ? `#${node.id}` : "/online/") };
      });
      const defaults = [{ title: "Endless Boot", href: "/boot/" }, { title: "The online mix", href: "/online/" }, { title: "Caleb, unplugged", href: "/professional/" }, { title: "Longer Bits", href: "/blog/" }, { title: "Choose your frequency", href: "/" }];
      defaults.forEach(track => { if (!tracks.some(item => item.href === track.href)) tracks.push(track); });
      const cards = [];
      ["Listen again", "Quick picks"].forEach((title, shelfIndex) => {
        const section = make("section", "ym-shelf");
        const rowHeader = make("div", "ym-shelf-heading");
        rowHeader.append(make("h2", "", title));
        const controls = make("div", "ym-shelf-controls");
        const row = make("div", "ym-row");
        row.setAttribute("role", "list");
        controls.append(button(`Scroll ${title} left`, "‹", () => row.scrollBy({ left: -350 })), button(`Scroll ${title} right`, "›", () => row.scrollBy({ left: 350 })));
        rowHeader.append(controls);
        const items = shelfIndex ? [...tracks].reverse().slice(0, 6) : tracks.slice(0, 8);
        items.forEach((track, index) => {
          const card = link("", track.href, "ym-card");
          card.setAttribute("role", "listitem");
          card.append(art(track.title, index + shelfIndex * 3), make("strong", "ym-card-title", track.title), make("span", "ym-card-meta", shelfIndex ? "Caleb K Masters · Your library" : "Mix · A few of your favorite Bits"));
          cards.push(card);
          row.append(card);
        });
        section.append(rowHeader, row);
        collection.append(section);
      });
      const empty = make("p", "ym-no-results", "No matching Bits. Try another search; the original page is below.");
      empty.hidden = true;
      collection.append(empty);
      search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        cards.forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(query); });
        empty.hidden = cards.some(card => !card.hidden);
      });
      const player = make("footer", "ym-player");
      player.setAttribute("aria-label", "Music preview player — no audio playback");
      progress = make("div", "ym-progress");
      progress.setAttribute("aria-hidden", "true");
      progress.append(make("span"));
      const controls = make("div", "ym-player-controls");
      playButton = button("Play visual preview (no audio)", "▶", () => { playing = !playing; updatePlay(); });
      playButton.classList.add("ym-play");
      playButton.setAttribute("aria-pressed", "false");
      controls.append(button("Previous preview", "❮", () => showTrack(selected - 1)), playButton, button("Next preview", "❯", () => showTrack(selected + 1)));
      playerArt = make("span", "ym-player-art");
      playerArt.append(art("Bits", 0));
      const copy = make("div", "ym-player-copy");
      playerTitle = link("Bits — Endless Boot", "/boot/");
      playerArtist = make("span", "", "Now playing · An infinite loop · Visual preview only");
      copy.append(playerTitle, playerArtist);
      player.append(progress, controls, playerArt, copy, make("span", "ym-player-note", "∞ / ∞   ♫   BITS RADIO"));
      main.prepend(collection);
      ctx.body.prepend(header, sidebar);
      ctx.body.append(player);
      chrome = [header, sidebar, collection, player];
      syncSpotify();
      const widget = document.querySelector("#spotify-widget");
      if (widget) {
        observer = new MutationObserver(syncSpotify);
        observer.observe(widget, { subtree: true, childList: true, characterData: true, attributes: true });
      }
    },
    unmount() {
      observer?.disconnect();
      observer = null;
      chrome.forEach(node => node.remove());
      chrome = [];
      tracks = [];
      selected = 0;
      playing = false;
    },
  });
})();
