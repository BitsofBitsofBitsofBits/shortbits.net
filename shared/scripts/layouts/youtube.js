(() => {
  if (!window.BITS_LAYOUTS) return;
  let observer;
  let body;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.setAttribute("data-layout-chrome", "youtube");
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const link = (text, href, className = "") => {
    const node = make("a", className, text);
    node.href = href;
    return node;
  };
  const icon = (name) => {
    const paths = {
      menu: "M4 6h16M4 12h16M4 18h16", search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5",
      mic: "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8",
      bell: "M18 8a6 6 0 0 0-12 0v6l-2 3h16l-2-3ZM10 21h4", plus: "M12 5v14M5 12h14",
      home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z", shorts: "m14 2-9 5a4 4 0 0 0 0 7l5 3-3 2 3 3 9-5a4 4 0 0 0 0-7l-5-3 3-2Z",
      subscriptions: "M6 3h12M4 6h16M3 9h18v12H3ZM10 12l5 3-5 3Z", user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2",
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-layout-chrome", "youtube");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("data-layout-chrome", "youtube");
    path.setAttribute("d", paths[name] || paths.home);
    svg.append(path);
    return svg;
  };
  const thumb = (title, index) => {
    const node = make("div", `yt-thumbnail yt-art-${index % 4}`);
    node.setAttribute("aria-hidden", "true");
    node.append(make("span", "yt-thumb-eyebrow", "BITS / ORIGINALS"), make("strong", "", title), make("span", "yt-thumb-play", "▶"), make("span", "yt-duration", ["8:24", "12:08", "LIVE", "4:32"][index % 4]));
    return node;
  };
  const video = (title, href, index, subtitle) => {
    const card = link("", href, "yt-video");
    card.append(thumb(title, index));
    const info = make("div", "yt-video-info");
    info.append(make("span", "yt-channel-avatar", "C"));
    const copy = make("div", "yt-video-copy");
    copy.append(make("strong", "yt-video-title", title), make("span", "yt-video-meta", "Caleb K Masters ✓"), make("span", "yt-video-meta", subtitle));
    info.append(copy, make("span", "yt-more", "⋮"));
    card.append(info);
    return card;
  };
  function decorateCards() {
    document.querySelectorAll(".content-file-grid > button, #blog-post-list > article, .chooser-options > li > a").forEach((card, index) => {
      if (card.querySelector(".yt-thumbnail")) return;
      const title = card.closest(".chooser-options") ? (index === 0 ? "The online channel" : "The professional channel") : card.querySelector("strong, h3")?.textContent.trim() || "More Bits";
      card.prepend(thumb(title.replace(/[_\.]/g, " "), index));
      card.append(make("span", "yt-card-channel", "Caleb K Masters · BitsTube originals"));
    });
  }
  window.BITS_LAYOUTS.register("youtube", {
    mount(ctx) {
      body = ctx.body;
      const masthead = make("header", "yt-masthead");
      const menu = make("button", "yt-icon-button");
      menu.type = "button";
      menu.setAttribute("aria-label", "Collapse guide");
      menu.setAttribute("aria-expanded", "true");
      menu.addEventListener("click", () => {
        const collapsed = body.classList.toggle("yt-guide-collapsed");
        menu.setAttribute("aria-expanded", String(!collapsed));
        menu.setAttribute("aria-label", collapsed ? "Expand guide" : "Collapse guide");
      });
      menu.append(icon("menu"));
      const brand = link("", "/online/", "yt-brand");
      brand.setAttribute("aria-label", "BitsTube home — a video-site parody");
      brand.append(make("span", "yt-brand-play"), make("strong", "", "BitsTube"), make("sup", "", "BITS"));
      const search = make("div", "yt-search");
      search.setAttribute("aria-label", "Decorative search bar");
      search.append(make("span", "yt-search-placeholder", "Search"));
      const searchIcon = make("span", "yt-search-end");
      searchIcon.append(icon("search"));
      search.append(searchIcon);
      const mic = make("span", "yt-mic");
      mic.setAttribute("aria-hidden", "true");
      mic.append(icon("mic"));
      const tools = make("nav", "yt-tools");
      tools.setAttribute("aria-label", "Channel shortcuts");
      const create = link("", "/professional/#contact", "yt-create");
      create.append(icon("plus"), make("span", "", "Create"));
      const bell = link("", "/blog/", "yt-icon-button");
      bell.setAttribute("aria-label", "Latest videos and posts");
      bell.append(icon("bell"));
      const avatar = link("C", "/professional/", "yt-account");
      avatar.setAttribute("aria-label", "Caleb K Masters channel");
      tools.append(create, bell, avatar);
      masthead.append(menu, brand, search, mic, tools);
      const guide = make("nav", "yt-guide");
      guide.setAttribute("aria-label", "BitsTube guide");
      [["home", "Home", "/online/", "online"], ["shorts", "Shorts", "/boot/", "boot"], ["subscriptions", "Subscriptions", "/blog/", "blog"], ["user", "You", "/professional/", "professional"]].forEach(([glyph, title, href, page]) => {
        const item = link("", href);
        if (ctx.page === page) item.setAttribute("aria-current", "page");
        item.append(icon(glyph), make("span", "", title));
        guide.append(item);
      });
      guide.append(make("hr"), make("p", "yt-guide-label", "Explore more Bits"), link("Choose your profile", "/"), link("Live from the terminal", "/boot/"), make("p", "yt-guide-note", "A personal-site parody.\nNot affiliated with YouTube.\n\n© BitsTube · Made of Bits"));
      body.prepend(masthead, guide);
      const main = document.querySelector("#interface-shell, .profile-layout, .blog-shell, .chooser, .endless-boot-console, .error-window");
      if (main && ctx.page !== "professional" && ctx.page !== "post" && ctx.page !== "error") {
        const chips = make("nav", "yt-chips");
        chips.setAttribute("aria-label", "Browse categories");
        [["All", "/online/"], ["Technology", "/professional/#skills"], ["Projects", "/professional/#projects"], ["Music", "/online/#spotify-widget"], ["Live", "/boot/"], ["From Caleb", "/blog/"], ["For you", "/"]].forEach(([title, href], i) => chips.append(link(title, href, i === 0 ? "yt-chip-selected" : "")));
        main.prepend(chips);
      }
      if (ctx.page === "online") {
        const recommendations = make("nav", "yt-recommendations");
        recommendations.setAttribute("aria-label", "Recommended videos — site destinations");
        recommendations.append(video("A few Bits of my internet", "#identity-name", 0, "Personal projects · A little bit of everything"), video("Inside the home lab", "/professional/#projects", 1, "Systems, servers & experiments"), video("Booting the Bits. Forever.", "/boot/", 2, "Premiere · Live from the terminal"));
        document.querySelector(".profile")?.before(recommendations);
        document.querySelector("#spotify-widget")?.prepend(make("span", "yt-now-playing", "▶  Now playing"));
      }
      if (ctx.page === "professional") {
        const channel = make("section", "yt-channel");
        channel.setAttribute("aria-label", "Caleb K Masters channel");
        const banner = make("div", "yt-channel-banner");
        banner.append(make("small", "", "WELCOME TO THE CHANNEL"), make("strong", "", "Technology. People. Bits."), make("span", "", "IT SUPPORT   /   SYSTEMS   /   AUTOMATION"));
        const info = make("div", "yt-channel-heading");
        info.append(make("span", "yt-channel-avatar yt-avatar-large", "C"));
        const copy = make("div", "");
        copy.append(make("h2", "", "Caleb K Masters"), make("p", "yt-video-meta", "@calebkmasters · IT support & systems"), make("p", "yt-channel-description", "Making technology work for people. One Bit at a time."), link("Subscribe / Get in touch", "#contact", "yt-subscribe"));
        info.append(copy);
        const tabs = make("nav", "yt-channel-tabs");
        tabs.setAttribute("aria-label", "Channel sections");
        [["Home", "#main"], ["Experience", "#experience"], ["Skills", "#skills"], ["Projects", "#projects"], ["Contact", "#contact"]].forEach(([title, href]) => tabs.append(link(title, href)));
        channel.append(banner, info, tabs);
        document.querySelector("#main")?.prepend(channel);
      }
      if (ctx.page === "post") {
        const player = make("div", "yt-watch-player");
        player.setAttribute("aria-label", "Decorative BitsTube article preview, not a video player");
        player.append(make("span", "yt-watch-symbol", "▶"), make("strong", "", "A longer Bit"), make("span", "", "Read the full story below · BitsTube originals"));
        document.querySelector(".blog-breadcrumbs")?.after(player);
      }
      if (ctx.page === "boot") {
        const premiere = make("div", "yt-premiere");
        premiere.append(make("span", "yt-live-badge", "● LIVE"), make("strong", "", "Premiere starting soon"), make("span", "", "Caleb K Masters · The stream that never quite starts"));
        document.querySelector(".endless-boot-header")?.before(premiere);
      }
      if (ctx.page === "error") {
        const message = make("div", "yt-error-message");
        message.append(make("span", "yt-error-glyph", ":("), make("h2", "", "This page isn't available. Sorry about that."), make("p", "", "Try looking for something else. There's always another Bit."));
        document.querySelector("#error-content")?.prepend(message);
      }
      decorateCards();
      const postList = document.querySelector("#blog-post-list");
      if (postList) {
        observer = new MutationObserver(decorateCards);
        observer.observe(postList, { childList: true });
      }
    },
    unmount() {
      observer?.disconnect();
      observer = null;
      body?.classList.remove("yt-guide-collapsed");
      body = null;
    },
  });
})();

