(() => {
  const presentations = {
    "windows-8": { title: "Start", home: "Start tiles", tabs: "App switcher", mode: "windowed", layout: "tiles" },
    "windows-10": { title: "BITS desktop", home: "Desktop", tabs: "Taskbar", mode: "windowed", layout: "desktop" },
    "windows-11": { title: "BITS desktop", home: "Desktop", tabs: "Taskbar", mode: "windowed", layout: "desktop" },
    browser: { title: "Bits Browser", home: "New tab", tabs: "Open tabs", search: "bits://settings or app name", layout: "browser" },
    termius: { title: "Local sessions", home: "Hosts", tabs: "Session tabs", search: "Open a session: open hardware", layout: "sessions" },
    m365: { title: "Bits 365", home: "App home", tabs: "Open documents", layout: "office", recent: true },
    google: { title: "Bits workspace", home: "Search home", tabs: "Workspace panels", layout: "search" },
    youtube: { title: "BitsTube", home: "Browse", tabs: "Open viewers", layout: "video" },
    "youtube-music": { title: "Bits Music", home: "Library", tabs: "Open collections", layout: "music", category: "Media" },
    "legacy-bios": { title: "SHORTBITS SETUP UTILITY", home: "Main setup", tabs: "Open setup pages", layout: "setup" },
  };
  const api = window.BITS_DESKTOP_WINDOWS;
  const desktop = document.querySelector("#fake-desktop");
  const body = document.body;
  const categories = {
    Media: new Set(["spotify", "creators", "games", "arcade"]),
    Personal: new Set(["about", "pronouns", "resume", "now", "guestbook"]),
  };
  let mounted = null;
  let recent = [];

  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function button(text, action, key) {
    const element = node("button", "", text);
    element.type = "button";
    if (key) element.dataset.workspaceKey = key;
    element.addEventListener("click", action);
    return element;
  }

  function mount(theme, config) {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const chrome = node("div", "workspace-chrome");
    const home = node("section", "workspace-home");
    home.setAttribute("aria-label", `${theme.name} app library`);
    const mode = config.mode || "tabbed";
    body.dataset.desktopWorkspace = theme.id;
    body.dataset.workspaceMode = mode;
    body.dataset.workspaceLayout = config.layout;
    const apps = api.catalog().map((app) => ({
      ...app,
      title: app.title.replace(/_/g, " ").replace(/\.(EXE|TXT|SYS)$/i, ""),
      category: Object.entries(categories).find(([, slugs]) => slugs.has(app.slug))?.[0] || "Tools",
    }));
    let category = config.category || "All apps";
    let previousActive = "";
    let signature = "";

    const utilities = [...desktop.querySelectorAll(".fake-desktop-app, .fake-playing-dead, .fake-action-center, .fake-wifi-picker")]
      .map((element) => {
        const marker = document.createComment("workspace utility position");
        element.before(marker);
        body.append(element);
        return { element, marker };
      });
    const closeUtilities = () => {
      utilities.forEach(({ element }) => {
        if (element.hidden) return;
        const close = element.querySelector("[data-fake-app-close], #fake-playing-dead-close");
        if (close) close.click();
        else if (element.id === "fake-action-center") document.querySelector("#fake-action-center-trigger").click();
      });
    };
    const header = node("header", "workspace-header");
    const brand = node("strong", "workspace-brand", config.title);
    const badge = node("span", "workspace-badge", "Experimental");
    const homeButton = button(config.home, showHome, "home");
    homeButton.className = "workspace-home-button";
    const form = node("form", "workspace-search");
    form.setAttribute("role", "search");
    form.setAttribute("aria-label", "Search workspace apps");
    const search = node("input", "");
    search.type = "search";
    search.placeholder = config.search || "Search site apps";
    search.setAttribute("aria-label", search.placeholder);
    search.autocomplete = "off";
    const submit = button(theme.id === "termius" ? "Connect" : "Open", () => {});
    submit.type = "submit";
    form.append(search, submit);
    const exit = button("Main site", () => document.querySelector("#fake-desktop-restore").click(), "exit");
    exit.className = "workspace-exit";
    const settings = button("Settings", () => launch("settings"), "settings");
    header.append(brand, badge, homeButton, form, settings, exit);

    const launcher = node("details", "workspace-launcher");
    launcher.append(node("summary", "", mode === "windowed" ? "Start" : "All apps"));
    const launchPanel = node("div", "workspace-launch-panel");
    const launcherSearch = node("input", "");
    launcherSearch.type = "search";
    launcherSearch.placeholder = "Find an app";
    launcherSearch.setAttribute("aria-label", "Find an app in launcher");
    const launcherList = node("div", "workspace-launch-list");
    launchPanel.append(launcherSearch, launcherList);
    launcher.append(launchPanel);
    const tools = node("details", "workspace-tools");
    tools.append(node("summary", "", "Desktop tools"));
    const toolList = node("div", "workspace-tool-list");
    const toolSources = [
      ["fake-task-manager-launch", "Task Manager"],
      ["fake-cobits-launch", "CoBits"],
      ["fake-recycle-bin", "Recycle Bin"],
      ["fake-action-center-trigger", "Quick settings"],
      ["fake-arg-signal", "ARG signal"],
    ].map(([id, title]) => {
      const source = document.getElementById(id);
      const control = button(title, () => {
        launcher.open = false;
        tools.open = false;
        if (mode === "tabbed") api.deactivate();
        source.click();
      });
      control.hidden = source.hidden;
      toolList.append(control);
      return { source, control };
    });
    const professional = node("a", "", "Professional profile");
    professional.href = "/professional/";
    const blog = node("a", "", "Blog");
    blog.href = "/blog/";
    toolList.append(professional, blog);
    tools.append(toolList);

    const sidebar = node("nav", "workspace-sidebar");
    sidebar.setAttribute("aria-label", theme.id === "legacy-bios" ? "Setup sections" : "App categories");
    const categoryControls = ["All apps", "Media", "Personal", "Tools"].map((name) => {
      const control = button(theme.id === "legacy-bios" && name === "Tools" ? "Tools & configuration" : name, () => {
        category = name;
        search.value = "";
        showHome();
      });
      control.dataset.category = name;
      sidebar.append(control);
      return control;
    });
    const description = node("p", "workspace-description",
      theme.id === "legacy-bios" ? "Site setup pages, not real firmware. Arrow keys select items; Enter opens; F10 returns to the main site."
        : theme.id === "termius" ? "Local site app sessions. No SSH connection or remote commands are executed."
          : theme.id === "youtube-music" ? "Live Spotify status and music links. Playback stays with your music service."
            : "Open the site's real apps. Your app contents stay intact when switching views.");
    sidebar.append(description);

    const heading = node("h1", "", config.home);
    const status = node("p", "workspace-results");
    status.setAttribute("role", "status");
    const recents = node("section", "workspace-recents");
    recents.setAttribute("aria-label", "Recently opened apps");
    const grid = node("div", "workspace-app-grid");
    home.append(heading, status, recents, grid);
    const footer = node("footer", "workspace-footer");
    const running = node("nav", "workspace-running");
    running.setAttribute("aria-label", config.tabs);
    const clock = node("time", "workspace-clock");
    const player = node("div", "workspace-player");
    if (theme.id === "youtube-music") {
      const track = node("span", "workspace-track");
      const music = button("Open Spotify", () => launch("spotify"));
      player.append(track, music);
    } else player.hidden = true;
    footer.append(launcher, tools, running, clock);
    chrome.append(header, sidebar, player, footer);

    function launch(slug) {
      launcher.open = false;
      tools.open = false;
      closeUtilities();
      api.open(slug);
    }

    function showHome() {
      closeUtilities();
      launcher.open = false;
      tools.open = false;
      api.deactivate();
      renderApps();
      homeButton.focus();
    }

    function matches(app, query) {
      return `${app.slug} ${app.title}`.toLowerCase().includes(query.toLowerCase());
    }

    function normalizedQuery() {
      return search.value.trim().replace(/^(bits:\/\/|open\s+)/i, "");
    }

    function appButton(app, className = "") {
      const control = button(app.title, () => launch(app.slug), `app-${app.slug}`);
      control.className = className;
      control.dataset.app = app.slug;
      if (app.desktopOnly && !window.matchMedia("(min-width: 901px)").matches) {
        control.disabled = true;
        control.append(node("small", "", "Desktop only"));
      }
      return control;
    }

    function renderApps() {
      const query = normalizedQuery();
      const filtered = apps.filter((app) => (category === "All apps" || app.category === category) && matches(app, query));
      grid.replaceChildren(...filtered.map((app) => {
        const control = appButton(app, "workspace-app-card");
        control.prepend(node("span", "workspace-app-icon", app.title.slice(0, 2).toUpperCase()));
        control.append(node("small", "", app.category));
        return control;
      }));
      status.textContent = filtered.length ? `${filtered.length} apps${query ? ` matching "${query}"` : ""}`
        : "No matching apps. Try another name or select All apps.";
      categoryControls.forEach((control) => control.setAttribute("aria-pressed", String(control.dataset.category === category)));
      recents.replaceChildren();
      recents.hidden = !config.recent || Boolean(query);
      if (!recents.hidden) {
        recents.append(node("h2", "", "Recent"));
        const recentApps = recent.map((slug) => apps.find((app) => app.slug === slug)).filter(Boolean);
        if (!recentApps.length) recents.append(node("p", "", "Apps you open will appear here."));
        else recents.append(...recentApps.map((app) => appButton(app)));
      }
    }

    function renderLauncher() {
      const filtered = apps.filter((app) => matches(app, launcherSearch.value.trim()));
      launcherList.replaceChildren(...filtered.map((app) => appButton(app)));
      if (!filtered.length) launcherList.append(node("p", "", "No matching apps."));
    }

    function renderState() {
      const state = api.state();
      const active = state.find((app) => app.active);
      if (!active && previousActive
        && !state.some((app) => app.slug === previousActive && !app.minimized)) {
        previousActive = "";
        const next = state.filter((app) => !app.minimized).at(-1);
        if (next) {
          api.open(next.slug);
          return;
        }
      }
      const returnHomeFocus = previousActive && !active;
      previousActive = active?.slug || "";
      body.dataset.workspaceHome = String(!active);
      home.hidden = ((mode === "tabbed" || config.layout === "tiles") && Boolean(active))
        || utilities.some(({ element }) => !element.hidden);
      const nextSignature = JSON.stringify(state);
      if (signature === nextSignature) return;
      signature = nextSignature;
      const focusedKey = document.activeElement?.dataset.workspaceKey;
      running.replaceChildren(...state.map((app) => {
        const group = node("div", "workspace-running-app");
        const control = button(app.title, () => {
          if (mode === "windowed" && app.active) api.minimize(app.slug);
          else launch(app.slug);
        }, `running-${app.slug}`);
        control.dataset.running = app.slug;
        control.setAttribute("aria-pressed", String(app.active));
        if (app.minimized) control.setAttribute("aria-label", `Restore ${app.title}`);
        const close = button("x", () => api.close(app.slug), `close-${app.slug}`);
        close.setAttribute("aria-label", `Close ${app.title}`);
        close.dataset.closeApp = app.slug;
        group.append(control, close);
        return group;
      }));
      if (!state.length) running.append(node("span", "workspace-empty", "No apps open"));
      if (focusedKey) chrome.querySelector(`[data-workspace-key="${CSS.escape(focusedKey)}"]`)?.focus();
      if (returnHomeFocus && !active && document.activeElement.closest("[data-window]")) homeButton.focus();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = normalizedQuery().toLowerCase();
      if (query === "home") return showHome();
      const available = apps.filter((app) => !app.desktopOnly || window.matchMedia("(min-width: 901px)").matches);
      const exact = available.find((app) => app.slug === query || app.title.toLowerCase() === query);
      const filtered = available.filter((app) => matches(app, query));
      if (exact || (query && filtered.length === 1)) launch((exact || filtered[0]).slug);
      else {
        category = "All apps";
        showHome();
        search.focus();
      }
    }, options);
    search.addEventListener("input", () => {
      category = "All apps";
      api.deactivate();
      renderApps();
    }, options);
    launcherSearch.addEventListener("input", renderLauncher, options);
    launcher.addEventListener("toggle", () => {
      if (launcher.open) {
        tools.open = false;
        renderLauncher();
        launcherSearch.focus();
      }
    }, options);
    tools.addEventListener("toggle", () => { if (tools.open) launcher.open = false; }, options);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && (launcher.open || tools.open)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = launcher.open ? launcher : tools;
        target.open = false;
        target.querySelector("summary").focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector(".system-overlay:not([hidden]), .death-screen:not([hidden]), #bits-launcher[open]")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        search.focus();
        search.select();
      }
      if (theme.id === "legacy-bios" && event.key === "F10") {
        event.preventDefault();
        exit.click();
      }
    }, { ...options, capture: true });
    home.addEventListener("keydown", (event) => {
      if (theme.id !== "legacy-bios" || !event.target.matches(".workspace-app-card")) return;
      const items = [...grid.querySelectorAll("button:not(:disabled)")];
      const index = items.indexOf(event.target);
      const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : delta ? (index + delta + items.length) % items.length : undefined;
      if (next !== undefined) {
        event.preventDefault();
        items[next].focus();
      }
    }, options);
    window.addEventListener("desktop-window:state", renderState, options);
    window.addEventListener("desktop-window:opened", (event) => {
      const slug = event.detail.windowId.replace(/-window$/, "");
      recent = [slug, ...recent.filter((item) => item !== slug)].slice(0, 6);
    }, options);
    window.matchMedia("(min-width: 901px)").addEventListener("change", () => {
      renderApps();
      renderLauncher();
    }, options);
    function syncStatus() {
      clock.textContent = document.querySelector("#fake-desktop-clock").textContent;
      toolSources.forEach(({ source, control }) => { control.hidden = source.hidden; });
      if (theme.id === "youtube-music") {
        player.querySelector(".workspace-track").textContent = [
          document.querySelector("#spotify-state")?.textContent,
          document.querySelector("#spotify-track")?.textContent,
          document.querySelector("#spotify-artist")?.textContent,
        ].filter(Boolean).join(" - ");
      }
      renderState();
    }
    const observer = new MutationObserver(syncStatus);
    [document.querySelector("#fake-desktop-clock"), ...utilities.map(({ element }) => element),
      ...toolSources.map(({ source }) => source),
      ...(theme.id === "youtube-music" ? [document.querySelector("#spotify-widget")] : [])]
      .filter(Boolean).forEach((element) => observer.observe(element, {
        attributes: true, attributeFilter: ["hidden"], childList: true, characterData: true, subtree: true,
      }));
    desktop.append(home);
    body.append(chrome);
    renderApps();
    renderLauncher();
    renderState();
    syncStatus();
    if (!document.activeElement.closest("[data-window]")) homeButton.focus();
    return {
      themeId: theme.id,
      destroy() {
        controller.abort();
        observer.disconnect();
        closeUtilities();
        utilities.forEach(({ element, marker }) => marker.replaceWith(element));
        chrome.remove();
        home.remove();
        delete body.dataset.desktopWorkspace;
        delete body.dataset.workspaceMode;
        delete body.dataset.workspaceLayout;
        delete body.dataset.workspaceHome;
      },
    };
  }

  function sync() {
    const id = document.documentElement.dataset.interfaceTheme;
    const config = document.documentElement.dataset.simpleLayout === "on" ? null : presentations[id];
    if (!desktop.hidden && config && mounted?.themeId === id) return;
    mounted?.destroy();
    mounted = null;
    if (!desktop.hidden && config) {
      mounted = mount(window.BITS_THEME_PREFERENCE.getTheme(id), config);
    }
  }

  window.BITS_DESKTOP_WORKSPACE = Object.freeze({ sync });
  window.addEventListener("bits:desktop-visibility", sync);
  window.addEventListener("bits:theme-applied", sync);
  window.addEventListener("bits:preferences-changed", sync);
  sync();
})();
