(() => {
  if (!window.BITS_LAYOUTS) return;

  const cleanups = [];
  let liveTimer = null;
  let resizeHandler = null;

  function chrome(tag, className, text) {
    const element = document.createElement(tag);
    element.setAttribute("data-layout-chrome", "windows-8");
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function appendStartHeader(ctx) {
    const host = ctx.page === "chooser" ? document.querySelector(".chooser-terminal")
      : ctx.page === "online" ? document.querySelector("#interface-shell")
        : ctx.page === "professional" ? document.querySelector(".profile-layout")
          : ctx.page === "blog" || ctx.page === "post" ? document.querySelector(".blog-shell")
            : ctx.page === "error" ? document.querySelector(".error-window") : null;
    if (!host) return;
    const header = chrome("div", "w8-start-header");
    header.append(chrome("span", "w8-start-word", "Start"), chrome("span", "w8-start-user", "Caleb K Masters"));
    host.prepend(header);
  }

  function decorateChooser() {
    const options = [...document.querySelectorAll(".chooser-options a")];
    options.forEach((link, index) => {
      link.classList.add("w8-tile", index === 0 ? "w8-tile-wide" : "w8-tile-tall");
      const icon = chrome("span", "w8-tile-icon", index === 0 ? "▦" : "▤");
      icon.setAttribute("aria-hidden", "true");
      link.querySelector(".chooser-copy")?.prepend(icon);
      if (index === 0) link.dataset.liveBack = "Themes · music · games";
      if (index === 1) link.dataset.liveBack = "Experience · skills · contact";
    });
    const list = document.querySelector(".chooser-options");
    if (list) list.classList.add("w8-tile-grid");
  }

  function decorateProfessional() {
    const nav = document.querySelector(".profile-header-tools nav");
    if (nav) {
      nav.classList.add("w8-nav-tiles");
      nav.querySelectorAll("a").forEach((link, index) => {
        link.classList.add("w8-nav-tile");
        const icon = chrome("span", "w8-nav-icon", ["▣", "▤", "◇", "▦", "✉"][index % 5]);
        icon.setAttribute("aria-hidden", "true");
        link.prepend(icon);
      });
    }
    document.querySelectorAll(".profile-actions a, .profile-socials a").forEach(link => link.classList.add("w8-square-link"));
  }

  function decorateBlog() {
    const header = document.querySelector(".blog-header");
    const back = header?.querySelector(":scope > a");
    if (back) {
      back.classList.add("w8-blog-tile");
      back.prepend(chrome("span", "w8-nav-icon", "⌂"));
    }
    const posts = document.querySelector("#blog-post-list");
    if (posts) posts.classList.add("w8-blog-tiles");
  }

  function addLiveUpdates() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced") return;
    const candidates = [...document.querySelectorAll("[data-live-back]")];
    if (!candidates.length) return;
    const faces = candidates.map(tile => {
      const face = chrome("span", "w8-live-face", "LIVE NOW");
      face.dataset.liveBack = tile.dataset.liveBack;
      face.setAttribute("aria-hidden", "true");
      tile.querySelector(".chooser-copy")?.append(face);
      return face;
    });
    let showing = false;
    liveTimer = window.setInterval(() => {
      showing = !showing;
      faces.forEach(face => {
        face.classList.toggle("is-visible", showing);
        face.textContent = showing ? face.dataset.liveBack : "LIVE NOW";
      });
    }, 4300);
  }

  function addDesktopHeader() {
    const desktop = document.getElementById("fake-desktop");
    if (!desktop) return;
    const header = chrome("div", "w8-desktop-header");
    header.append(chrome("span", "w8-desktop-start", "Start"), chrome("span", "w8-desktop-user", "Caleb K Masters"));
    desktop.prepend(header);
  }
  function setupCharms() {
    const desktop = document.getElementById("fake-desktop");
    if (!desktop) return;
    const edge = chrome("div", "w8-charms-edge");
    const toggle = chrome("button", "w8-charms-toggle", "⋮");
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Open charms bar");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "w8-charms-panel");
    const panel = chrome("nav", "w8-charms-panel");
    panel.id = "w8-charms-panel";
    panel.setAttribute("aria-label", "Windows 8 charms");
    const buttons = [
      ["⌕", "Search", () => document.querySelector('#fake-desktop [data-window-target="filesystem-window"]')?.click()],
      ["↗", "Share", async () => {
        const data = { title: document.title, url: location.href };
        if (navigator.share) {
          try { await navigator.share(data); } catch (error) { if (error.name !== "AbortError") console.warn("Share unavailable", error); }
        } else if (navigator.clipboard?.writeText) {
          try { await navigator.clipboard.writeText(data.url); } catch { /* Clipboard access may be unavailable on HTTP. */ }
        }
      }],
      ["⊞", "Start", () => {
        const menu = document.querySelector(".fake-start-menu");
        if (menu) { menu.open = true; menu.querySelector("summary")?.focus(); }
      }],
      ["▣", "Devices", () => document.getElementById("fake-action-center-trigger")?.click()],
      ["⚙", "Settings", () => document.querySelector('#fake-desktop [data-window-target="settings-window"]')?.click()],
    ];
    buttons.forEach(([icon, label, action]) => {
      const button = chrome("button", "w8-charm");
      button.type = "button";
      button.append(chrome("span", "w8-charm-icon", icon), chrome("span", "w8-charm-label", label));
      button.addEventListener("click", () => { action(); close(); });
      panel.append(button);
    });
    function open() { panel.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); }
    function close() { panel.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
    toggle.addEventListener("click", () => panel.classList.contains("is-open") ? close() : open());
    edge.addEventListener("mouseenter", open);
    edge.addEventListener("mouseleave", event => { if (!panel.contains(event.relatedTarget) && event.relatedTarget !== toggle) close(); });
    edge.addEventListener("focusin", open);
    edge.addEventListener("focusout", event => { if (!edge.contains(event.relatedTarget)) close(); });
    const keyHandler = event => {
      if (event.key === "Escape" && !document.body.dataset.desktopWorkspace) { close(); toggle.focus(); }
    };
    document.addEventListener("keydown", keyHandler);
    cleanups.push(() => document.removeEventListener("keydown", keyHandler));
    edge.append(toggle, panel);
    desktop.append(edge);
    resizeHandler = () => desktop.classList.toggle("w8-mobile", window.matchMedia("(max-width: 600px)").matches);
    resizeHandler();
    window.addEventListener("resize", resizeHandler);
    cleanups.push(() => window.removeEventListener("resize", resizeHandler));
  }

  function addBootNavigation() {
    const host = document.querySelector(".endless-boot-console");
    if (!host) return;
    const nav = chrome("nav", "w8-boot-nav");
    nav.setAttribute("aria-label", "Start navigation");
    [["Start", "/", "⊞"], ["Online", "/online/", "▦"], ["Profile", "/professional/", "▤"], ["Blog", "/blog/", "▱"]].forEach(([label, href, icon]) => {
      const link = chrome("a", "w8-boot-tile");
      link.href = href;
      link.append(chrome("span", "w8-nav-icon", icon), document.createTextNode(label));
      nav.append(link);
    });
    host.prepend(nav);
  }

  window.BITS_LAYOUTS.register("windows-8", {
    mount(ctx) {
      document.documentElement.dataset.w8Variant = document.documentElement.dataset.themeVariant || "purple";
      appendStartHeader(ctx);
      if (ctx.page === "chooser") decorateChooser();
      if (ctx.page === "professional") decorateProfessional();
      if (ctx.page === "blog" || ctx.page === "post") decorateBlog();
      if (ctx.page === "online") { addDesktopHeader(); setupCharms(); }
      if (ctx.page === "boot") addBootNavigation();
      addLiveUpdates();
    },
    update(ctx) {
      document.documentElement.dataset.w8Variant = document.documentElement.dataset.themeVariant || "purple";
    },
    unmount() {
      if (liveTimer !== null) window.clearInterval(liveTimer);
      liveTimer = null;
      cleanups.splice(0).forEach(cleanup => cleanup());
      document.documentElement.removeAttribute("data-w8-variant");
    }
  });
})();
