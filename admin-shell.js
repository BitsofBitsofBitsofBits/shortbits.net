(() => {
  const root = document.documentElement;
  const app = document.querySelector("#inbox-view");
  const loginView = document.querySelector("#login-view");
  const suitebar = document.querySelector(".ac-suitebar");
  const main = document.querySelector("#ac-main");
  const navList = document.querySelector("#ac-nav-list");
  const navToggle = document.querySelector("#ac-nav-toggle");
  const pageTitle = document.querySelector("#ac-page-title");
  const pageDescription = document.querySelector("#ac-page-description");
  const breadcrumb = document.querySelector("#ac-breadcrumb");
  const homePage = document.querySelector("#ac-home");
  const homeCards = document.querySelector("#ac-home-cards");
  const quickActions = document.querySelector("#ac-quick-actions");
  const panelLayer = document.querySelector("#ac-panel-layer");
  const panel = document.querySelector("#ac-panel");
  const panelTitle = document.querySelector("#ac-panel-title");
  const panelBody = document.querySelector("#ac-panel-body");
  const panelFooter = document.querySelector("#ac-panel-footer");
  const templates = document.querySelector("#ac-panel-templates");
  const search = document.querySelector("#ac-search");
  const searchInput = document.querySelector("#ac-search-input");
  const searchResults = document.querySelector("#ac-search-results");
  const accountButton = document.querySelector("#ac-account-button");
  const mobileQuery = window.matchMedia("(max-width: 900px)");
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const icons = {
    home: '<path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1Z"/>',
    mail: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/><path d="m3 5.5 7 5.5 7-5.5"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5Zm0 12A1.5 1.5 0 0 0 5.5 18H16v-3"/>',
    document: '<path d="M5 2.5h6.5L15 6v11.5H5Z"/><path d="M11.5 2.5V6H15M7.5 10h5M7.5 13h5"/>',
    note: '<rect x="3.5" y="3" width="13" height="14" rx="1.5"/><path d="M6.5 7h7M6.5 10h7M6.5 13h4"/>',
    history: '<path d="M3.5 10a6.5 6.5 0 1 0 2-4.7"/><path d="M3 3v3.5h3.5M10 6.5V10l2.5 2"/>',
    edit: '<path d="m12.5 3.5 4 4L7 17H3v-4Z"/><path d="m10.5 5.5 4 4"/>',
    game: '<rect x="2.5" y="6" width="15" height="9" rx="4.5"/><path d="M6.5 9v3M5 10.5h3M12.5 10h.01M14.5 11.5h.01"/>',
    chip: '<rect x="5" y="5" width="10" height="10" rx="1"/><path d="M8 2.5v2.5M12 2.5v2.5M8 15v2.5M12 15v2.5M2.5 8H5M2.5 12H5M15 8h2.5M15 12h2.5"/>',
    music: '<path d="M7.5 15V4.5l9-2V13"/><circle cx="5.5" cy="15" r="2"/><circle cx="14.5" cy="13" r="2"/>',
    list: '<path d="M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01"/>',
    trophy: '<path d="M6 3h8v4a4 4 0 0 1-8 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M14 5h3v1a3 3 0 0 1-3 3M10 11v3M7 17h6M8 14h4v3H8Z"/>',
    person: '<circle cx="10" cy="6.5" r="3.5"/><path d="M3.5 17a6.5 6.5 0 0 1 13 0"/>',
    link: '<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>',
    menu: '<path d="M3 5h14M3 10h14M3 15h14"/>',
    search: '<circle cx="8.5" cy="8.5" r="5"/><path d="m12.5 12.5 4.5 4.5"/>',
    settings: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    help: '<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.6M10 14.5h.01"/>',
    close: '<path d="m5 5 10 10M15 5 5 15"/>',
    chevron: '<path d="m7 8 3 3 3-3"/>',
    add: '<path d="M10 4v12M4 10h12"/>',
    upload: '<path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13v3.5h13V13"/>',
  };

  const groups = [
    { id: "communications", label: "Communications", icon: "mail" },
    { id: "content", label: "Content", icon: "document" },
    { id: "showcase", label: "Showcase", icon: "chip" },
    { id: "community", label: "Community", icon: "person" },
    { id: "tools", label: "Tools", icon: "link" },
  ];

  const modules = [
    { route: "inbox", sourceId: "message-editor", label: "Inbox", group: "communications", icon: "mail", description: "Read and manage messages sent through the contact form.", keywords: "messages contact mail packets" },
    { route: "guestbook", sourceId: "guestbook-editor", label: "Guestbook", group: "communications", icon: "book", description: "Review and remove public guestbook signatures.", keywords: "signatures moderation" },
    { route: "resume", sourceId: "resume-editor", label: "Résumé", group: "content", icon: "document", description: "Edit CAREER.SYS, work history, education, and certifications.", keywords: "resume career jobs education certifications" },
    { route: "now", sourceId: "now-editor", label: "Now", group: "content", icon: "note", description: "Update current projects and interests.", keywords: "now.txt status" },
    { route: "changelog", sourceId: "changelog-editor", label: "Changelog", group: "content", icon: "history", description: "Manage the public deployment history.", keywords: "releases updates" },
    { route: "blog", sourceId: "blog-editor", label: "Blog", group: "content", icon: "edit", description: "Write, preview, draft, and publish Markdown posts.", keywords: "posts markdown articles" },
    { route: "games", sourceId: "games-editor", label: "Games", group: "showcase", icon: "game", description: "Manage the public favorite-games library.", keywords: "library favorites" },
    { route: "hardware", sourceId: "hardware-editor", label: "Hardware", group: "showcase", icon: "chip", description: "Publish machine specs, import scans, and manage live agents.", keywords: "pc nas unraid specs agent devices" },
    { route: "playlists", sourceId: "playlist-editor", label: "Playlists", group: "showcase", icon: "list", description: "Manage featured Spotify playlists.", keywords: "spotify music" },
    { route: "songs", sourceId: "track-editor", label: "Songs", group: "showcase", icon: "music", description: "Manage featured Spotify songs.", keywords: "spotify tracks music" },
    { route: "arcade", sourceId: "arcade-editor", label: "Arcade", group: "community", icon: "trophy", description: "Configure leaderboards and moderate public scores.", keywords: "scores leaderboard games" },
    { route: "pronouns", sourceId: "pronoun-editor", label: "Pronouns", group: "community", icon: "person", description: "Edit the public identity reference.", keywords: "identity profile" },
    { route: "shortbits", sourceId: "short-links-editor", label: "ShortBits", group: "tools", icon: "link", description: "Create and manage tiny Bits of the internet.", keywords: "short links urls redirects" },
    { route: "backups", sourceId: "backup-editor", label: "Content backups", group: "tools", icon: "upload", description: "Export editorial content and restore a saved backup.", keywords: "backup restore export import drafts recovery" },
  ];
  const modulesByRoute = new Map(modules.map((module) => [module.route, module]));
  const navItems = new Map();
  let currentRoute = "home";
  let activePanel = null;
  let pendingGoKey = false;

  function createIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("ac-icon");
    svg.innerHTML = icons[name] || "";
    return svg;
  }

  function hydrateIcons(scope = document) {
    scope.querySelectorAll("[data-ac-icon]").forEach((element) => {
      if (!element.querySelector(":scope > .ac-icon")) {
        element.prepend(createIcon(element.dataset.acIcon));
      }
    });
  }

  function isSignedIn() {
    return !app.hidden;
  }

  // Panels
  function getFocusable(container) {
    return [...container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.offsetParent !== null || element === document.activeElement);
  }

  function setBackgroundInert(inert) {
    [suitebar, app, loginView].forEach((element) => {
      element.inert = inert;
    });
  }

  function closePanel() {
    if (!activePanel) {
      return;
    }
    const { onClose, returnFocus } = activePanel;
    activePanel = null;
    panelLayer.hidden = true;
    panel.dataset.size = "";
    setBackgroundInert(false);
    document.body.classList.remove("ac-panel-open");
    onClose?.();
    panelBody.replaceChildren();
    panelFooter.replaceChildren();
    panelFooter.hidden = true;
    if (returnFocus?.isConnected && !returnFocus.closest("[hidden]")) {
      returnFocus.focus();
    }
  }

  function openPanel({ title, description = "", content, actions = [], size = "medium", onClose } = {}) {
    if (activePanel) {
      closePanel();
    }
    activePanel = { onClose, returnFocus: document.activeElement };
    panelTitle.textContent = title;
    panel.dataset.size = size;
    const nodes = [];
    if (description) {
      const intro = document.createElement("p");
      intro.className = "ac-panel-description";
      intro.textContent = description;
      nodes.push(intro);
    }
    if (content) {
      nodes.push(content);
    }
    panelBody.replaceChildren(...nodes);
    panelFooter.replaceChildren(...actions);
    panelFooter.hidden = actions.length === 0;
    panelLayer.hidden = false;
    document.body.classList.add("ac-panel-open");
    setBackgroundInert(true);
    panelBody.scrollTop = 0;
    const focusTarget = getFocusable(panelBody)[0] || panel.querySelector(".ac-panel-close");
    focusTarget?.focus();
  }

  function openTemplatePanel(templateId, options) {
    const template = document.getElementById(templateId);
    openPanel({
      ...options,
      content: template,
      onClose: () => templates.append(template),
    });
  }

  panelLayer.addEventListener("click", (event) => {
    if (event.target.closest("[data-ac-panel-close]")) {
      closePanel();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }
    const focusable = getFocusable(panel);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Navigation
  function createNavLink(route, label, icon) {
    const link = document.createElement("a");
    const text = document.createElement("span");
    const badge = document.createElement("span");
    link.href = `#/${route}`;
    link.className = "ac-nav-item";
    link.dataset.route = route;
    link.title = label;
    text.className = "ac-nav-label";
    text.textContent = label;
    badge.className = "ac-badge";
    badge.hidden = true;
    link.append(createIcon(icon), text, badge);
    navItems.set(route, link);
    return link;
  }

  function buildNav() {
    const homeItem = document.createElement("li");
    homeItem.append(createNavLink("home", "Home", "home"));
    navList.append(homeItem);

    groups.forEach((group) => {
      const item = document.createElement("li");
      const toggle = document.createElement("button");
      const label = document.createElement("span");
      const chevron = createIcon("chevron");
      const list = document.createElement("ul");
      const listId = `ac-nav-group-${group.id}`;

      item.className = "ac-nav-group";
      toggle.type = "button";
      toggle.className = "ac-nav-item ac-nav-group-toggle";
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-controls", listId);
      toggle.title = group.label;
      label.className = "ac-nav-label";
      label.textContent = group.label;
      chevron.classList.add("ac-chevron");
      toggle.append(createIcon(group.icon), label, chevron);
      toggle.addEventListener("click", () => {
        if (app.dataset.nav === "collapsed" && !mobileQuery.matches) {
          setNavCollapsed(false);
          toggle.setAttribute("aria-expanded", "true");
          list.hidden = false;
          return;
        }
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        list.hidden = expanded;
      });

      list.id = listId;
      list.className = "ac-nav-sublist";
      modules
        .filter((module) => module.group === group.id)
        .forEach((module) => {
          const moduleItem = document.createElement("li");
          moduleItem.append(createNavLink(module.route, module.label, module.icon));
          list.append(moduleItem);
        });

      item.append(toggle, list);
      navList.append(item);
    });
  }

  function setNavCollapsed(collapsed) {
    app.dataset.nav = collapsed ? "collapsed" : "expanded";
    navToggle.setAttribute("aria-expanded", String(!collapsed));
    navToggle.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
  }

  function setMobileNavOpen(open) {
    app.dataset.mobileNav = open ? "open" : "closed";
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  function syncNavMode() {
    if (mobileQuery.matches) {
      app.dataset.nav = "expanded";
      setMobileNavOpen(false);
    } else {
      delete app.dataset.mobileNav;
      setNavCollapsed(root.dataset.adminNavCollapsed === "true");
    }
  }

  navToggle.addEventListener("click", () => {
    if (mobileQuery.matches) {
      setMobileNavOpen(app.dataset.mobileNav !== "open");
    } else {
      setNavCollapsed(app.dataset.nav !== "collapsed");
    }
  });

  app.addEventListener("click", (event) => {
    if (mobileQuery.matches && app.dataset.mobileNav === "open" && event.target === app) {
      setMobileNavOpen(false);
    }
  });

  mobileQuery.addEventListener("change", syncNavMode);

  // Routing
  function getRouteFromHash() {
    const route = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0].toLowerCase();
    return route === "home" || modulesByRoute.has(route) ? route : "home";
  }

  function renderBreadcrumb(parts) {
    breadcrumb.replaceChildren(...parts.map((part, index) => {
      const item = document.createElement("li");
      if (part.route && index < parts.length - 1) {
        const link = document.createElement("a");
        link.href = `#/${part.route}`;
        link.textContent = part.label;
        item.append(link);
      } else {
        const text = document.createElement("span");
        text.textContent = part.label;
        if (index === parts.length - 1) {
          text.setAttribute("aria-current", "page");
        }
        item.append(text);
      }
      return item;
    }));
  }

  function showRoute(route, { focus = false } = {}) {
    currentRoute = route;
    const module = modulesByRoute.get(route);
    homePage.hidden = route !== "home";
    modules.forEach((entry) => {
      const page = document.getElementById(entry.sourceId);
      if (page) {
        page.hidden = entry.route !== route;
      }
    });

    navItems.forEach((link, linkRoute) => {
      if (linkRoute === route) {
        link.setAttribute("aria-current", "page");
        const groupList = link.closest(".ac-nav-sublist");
        if (groupList?.hidden) {
          groupList.hidden = false;
          groupList.previousElementSibling.setAttribute("aria-expanded", "true");
        }
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (module) {
      const group = groups.find((entry) => entry.id === module.group);
      pageTitle.textContent = module.label;
      pageDescription.textContent = module.description;
      pageDescription.hidden = false;
      renderBreadcrumb([{ route: "home", label: "Home" }, { label: group.label }, { label: module.label }]);
      document.title = `${module.label} - Bits 365 admin center`;
    } else {
      pageTitle.textContent = "Home";
      pageDescription.hidden = true;
      renderBreadcrumb([{ label: "Home" }]);
      document.title = "Bits 365 admin center // BitsofBitsofBits";
      refreshHome();
    }

    if (mobileQuery.matches) {
      setMobileNavOpen(false);
    }
    if (focus) {
      main.focus({ preventScroll: true });
      main.scrollTop = 0;
      window.scrollTo(0, 0);
    }
  }

  function navigate(route) {
    if (getRouteFromHash() === route && location.hash) {
      showRoute(route, { focus: true });
      return;
    }
    location.hash = `#/${route}`;
  }

  window.addEventListener("hashchange", () => {
    if (isSignedIn()) {
      closePanel();
      showRoute(getRouteFromHash(), { focus: true });
    }
  });

  // Home dashboard
  const metrics = {
    inbox: () => {
      const total = document.querySelectorAll("#message-list .message-card").length;
      const unread = document.querySelectorAll("#message-list .message-card.is-unread").length;
      return { value: unread, label: unread === 1 ? "unread message" : "unread messages", detail: `${total} total in the inbox` };
    },
    guestbook: () => {
      const total = document.querySelectorAll("#guestbook-admin-list .message-card").length;
      return { value: total, label: total === 1 ? "signature" : "signatures", detail: "Public guestbook entries" };
    },
    blog: () => {
      const total = document.querySelectorAll("#blog-admin-list .blog-admin-post-button").length;
      return { value: total, label: total === 1 ? "post" : "posts", detail: "Drafts and published posts" };
    },
    hardware: () => {
      const total = document.querySelectorAll("#hardware-devices > li").length;
      return { value: total, label: total === 1 ? "live agent" : "live agents", detail: "Registered monitoring devices" };
    },
    shortbits: () => {
      const total = document.querySelectorAll("#short-links-list .short-link-admin-entry").length;
      return { value: total, label: total === 1 ? "ShortBit" : "ShortBits", detail: "Active short links" };
    },
  };

  function buildHome() {
    const actions = [
      { label: "Write a blog post", icon: "add", run: () => { navigate("blog"); document.querySelector("#blog-post-new")?.click(); } },
      { label: "Check the inbox", icon: "mail", run: () => navigate("inbox") },
      { label: "Create a ShortBit", icon: "link", run: () => { navigate("shortbits"); document.querySelector("#short-links-editor input:not([type=hidden])")?.focus(); } },
      { label: "Import hardware", icon: "upload", run: () => { navigate("hardware"); document.querySelector('[data-ac-hardware-panel="0"]')?.click(); } },
    ];
    quickActions.replaceChildren(...actions.map((action) => {
      const button = document.createElement("button");
      const text = document.createElement("span");
      button.type = "button";
      button.className = "ac-quick-action";
      text.textContent = action.label;
      button.append(createIcon(action.icon), text);
      button.addEventListener("click", action.run);
      return button;
    }));

    homeCards.replaceChildren(...Object.keys(metrics).map((route) => {
      const module = modulesByRoute.get(route);
      const card = document.createElement("article");
      const header = document.createElement("header");
      const title = document.createElement("h3");
      const metric = document.createElement("p");
      const value = document.createElement("strong");
      const label = document.createElement("span");
      const detail = document.createElement("p");
      const link = document.createElement("a");

      card.className = "ac-card";
      card.dataset.metric = route;
      title.textContent = module.label;
      header.append(createIcon(module.icon), title);
      metric.className = "ac-metric";
      value.className = "ac-metric-value";
      label.className = "ac-metric-label";
      metric.append(value, " ", label);
      detail.className = "ac-card-detail";
      link.href = `#/${route}`;
      link.className = "ac-card-link";
      link.textContent = `Go to ${module.label}`;
      card.append(header, metric, detail, link);
      return card;
    }));

    const health = document.createElement("article");
    health.className = "ac-card ac-card-health";
    health.innerHTML = `
      <header><h3>Service health</h3></header>
      <ul class="ac-health-list">
        <li><span class="ac-health-dot" aria-hidden="true"></span> Website</li>
        <li><span class="ac-health-dot" aria-hidden="true"></span> Supabase</li>
        <li><span class="ac-health-dot is-warning" aria-hidden="true"></span> Operator (needs coffee)</li>
      </ul>`;
    health.querySelector("header").prepend(createIcon("help"));
    homeCards.append(health);
  }

  function refreshHome() {
    Object.entries(metrics).forEach(([route, read]) => {
      const card = homeCards.querySelector(`[data-metric="${route}"]`);
      if (!card) {
        return;
      }
      const result = read();
      card.querySelector(".ac-metric-value").textContent = String(result.value);
      card.querySelector(".ac-metric-label").textContent = result.label;
      card.querySelector(".ac-card-detail").textContent = result.detail;
    });
    const unread = metrics.inbox().value;
    const badge = navItems.get("inbox")?.querySelector(".ac-badge");
    if (badge) {
      badge.hidden = unread === 0;
      badge.textContent = String(unread);
      navItems.get("inbox").setAttribute("aria-label", unread ? `Inbox, ${unread} unread` : "Inbox");
    }
  }

  let refreshTimer = 0;
  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshHome, 120);
  }

  ["#message-list", "#guestbook-admin-list", "#blog-admin-list", "#hardware-devices", "#short-links-list"].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      new MutationObserver(scheduleRefresh).observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  });

  // Module pages
  function prepareModules() {
    modules.forEach((module) => {
      const section = document.getElementById(module.sourceId);
      if (!section) {
        return;
      }
      section.classList.add("ac-page", "ac-module");
      section.setAttribute("aria-labelledby", "ac-page-title");
      section.hidden = true;
      const legacyLabel = section.querySelector(":scope > .section-label");
      legacyLabel?.classList.add("ac-legacy-label");
    });

    document.querySelectorAll("#hardware-editor details.hardware-import").forEach((details, index, all) => {
      const body = details.querySelector(".hardware-import-body");
      if (!body) {
        return;
      }
      let bar = document.querySelector("#ac-hardware-commandbar");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "ac-hardware-commandbar";
        bar.className = "ac-commandbar";
        all[0].before(bar);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ac-command";
      button.dataset.acHardwarePanel = String(index);
      button.append(createIcon(index === 0 ? "upload" : "chip"), details.dataset.panelTitle || details.querySelector("summary").textContent);
      button.addEventListener("click", () => {
        openPanel({
          title: details.dataset.panelTitle,
          description: details.dataset.panelDescription,
          content: body,
          size: "large",
          onClose: () => details.append(body),
        });
      });
      bar.append(button);
      details.hidden = true;
    });
  }

  // Suite bar
  function renderSearchResults() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      searchResults.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
      searchResults.replaceChildren();
      return;
    }
    const matches = [{ route: "home", label: "Home", description: "Dashboard", icon: "home", keywords: "dashboard overview" }, ...modules]
      .filter((entry) => `${entry.label} ${entry.description} ${entry.keywords}`.toLowerCase().includes(query))
      .slice(0, 8);

    if (matches.length === 0) {
      const empty = document.createElement("li");
      empty.className = "ac-search-empty";
      empty.textContent = "No results";
      searchResults.replaceChildren(empty);
    } else {
      searchResults.replaceChildren(...matches.map((entry, index) => {
        const option = document.createElement("li");
        const text = document.createElement("span");
        const label = document.createElement("strong");
        const detail = document.createElement("small");
        option.id = `ac-search-option-${index}`;
        option.role = "option";
        option.dataset.route = entry.route;
        option.setAttribute("aria-selected", String(index === 0));
        label.textContent = entry.label;
        detail.textContent = entry.description;
        text.append(label, detail);
        option.append(createIcon(entry.icon), text);
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          chooseSearchResult(entry.route);
        });
        return option;
      }));
      searchInput.setAttribute("aria-activedescendant", "ac-search-option-0");
    }
    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function chooseSearchResult(route) {
    searchInput.value = "";
    renderSearchResults();
    searchInput.blur();
    navigate(route);
  }

  searchInput.addEventListener("input", renderSearchResults);
  searchInput.addEventListener("blur", () => {
    window.setTimeout(() => {
      searchResults.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
    }, 100);
  });
  searchInput.addEventListener("keydown", (event) => {
    const options = [...searchResults.querySelectorAll("[role=option]")];
    const activeIndex = options.findIndex((option) => option.getAttribute("aria-selected") === "true");
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) {
        return;
      }
      const nextIndex = (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options.forEach((option, index) => option.setAttribute("aria-selected", String(index === nextIndex)));
      searchInput.setAttribute("aria-activedescendant", options[nextIndex].id);
    } else if (event.key === "Enter" && options[activeIndex]) {
      event.preventDefault();
      chooseSearchResult(options[activeIndex].dataset.route);
    } else if (event.key === "Escape") {
      searchInput.value = "";
      renderSearchResults();
    }
  });

  document.querySelector("#ac-waffle-button").addEventListener("click", () => {
    openTemplatePanel("ac-launcher-panel", { title: "Apps", size: "small" });
  });
  document.querySelector("#ac-help-button").addEventListener("click", () => {
    openTemplatePanel("ac-help-panel", { title: "Help & support", size: "small" });
  });
  accountButton.addEventListener("click", () => {
    openTemplatePanel("ac-account-panel", { title: "Account", size: "small" });
  });
  document.querySelector("#ac-settings-button").addEventListener("click", () => {
    const preference = root.dataset.adminAppearancePreference || "system";
    document.querySelectorAll('input[name="ac-appearance"]').forEach((input) => {
      input.checked = input.value === preference;
    });
    document.querySelector("#ac-setting-collapse-nav").checked = root.dataset.adminNavCollapsed === "true";
    openTemplatePanel("ac-settings-panel", { title: "Settings", size: "small" });
  });

  function applyAppearance(preference) {
    root.dataset.adminAppearancePreference = preference;
    root.dataset.adminAppearance = preference === "system"
      ? (darkQuery.matches ? "dark" : "light")
      : preference;
  }

  document.querySelectorAll('input[name="ac-appearance"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }
      try {
        localStorage.setItem("bits-admin-appearance", input.value);
      } catch {
        // Settings still apply for this page view.
      }
      applyAppearance(input.value);
    });
  });

  darkQuery.addEventListener("change", () => {
    if ((root.dataset.adminAppearancePreference || "system") === "system") {
      applyAppearance("system");
    }
  });

  document.querySelector("#ac-setting-collapse-nav").addEventListener("change", (event) => {
    const collapsed = event.target.checked;
    if (collapsed) {
      root.dataset.adminNavCollapsed = "true";
    } else {
      delete root.dataset.adminNavCollapsed;
    }
    try {
      localStorage.setItem("bits-admin-nav-collapsed", String(collapsed));
    } catch {
      // Ignore unavailable storage.
    }
    if (!mobileQuery.matches) {
      setNavCollapsed(collapsed);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activePanel) {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key === "Escape" && mobileQuery.matches && app.dataset.mobileNav === "open") {
      setMobileNavOpen(false);
      navToggle.focus();
      return;
    }
    const typing = event.target.closest?.("input, textarea, select, [contenteditable=true]");
    if (typing || event.ctrlKey || event.metaKey || event.altKey || !isSignedIn() || activePanel) {
      return;
    }
    if (event.key === "/" && searchInput.offsetParent) {
      event.preventDefault();
      searchInput.focus();
    } else if (event.key.toLowerCase() === "g") {
      pendingGoKey = true;
      window.setTimeout(() => {
        pendingGoKey = false;
      }, 1200);
    } else if (pendingGoKey && event.key.toLowerCase() === "h") {
      pendingGoKey = false;
      navigate("home");
    }
  });

  async function updateAccountEmail() {
    try {
      // adminClient is a global lexical binding created by admin.js.
      const client = typeof adminClient === "undefined" ? null : adminClient;
      const { data } = (await client?.auth.getSession()) || {};
      const email = data?.session?.user?.email;
      if (email) {
        document.querySelector("#ac-account-email").textContent = email;
      }
    } catch {
      // The account panel falls back to "Signed in".
    }
  }

  function syncSignedInChrome() {
    const signedIn = isSignedIn();
    search.hidden = !signedIn;
    accountButton.hidden = !signedIn;
    document.body.classList.toggle("ac-signed-in", signedIn);
    if (signedIn) {
      showRoute(getRouteFromHash());
      updateAccountEmail();
    }
  }

  new MutationObserver(syncSignedInChrome).observe(app, { attributes: true, attributeFilter: ["hidden"] });

  window.addEventListener("admin:authenticated", () => {
    refreshHome();
    updateAccountEmail();
  });
  window.addEventListener("admin:inbox-updated", scheduleRefresh);
  window.addEventListener("admin:logged-out", () => {
    closePanel();
    history.replaceState(null, "", location.pathname + location.search);
    currentRoute = "home";
    document.title = "Bits 365 admin center // BitsofBitsofBits";
  });

  // Terminal-style labels (e.g. "> SAVE_POST") become Fluent sentence case.
  const keepUpper = new Set(["URL", "URLS", "ID", "CPU", "GPU", "RAM", "OS", "PC", "JSON", "NAS", "API", "HTML", "SSD", "HDD", "NIC", "UTC", "CSV", "IP", "DNS", "USB", "OK", "CV", "UI", "FAQ", "GPA", "SQL", "PDF", "HTTP", "HTTPS", "AM", "PM"]);
  const properCase = new Map([["spotify", "Spotify"], ["unraid", "Unraid"], ["linux", "Linux"], ["windows", "Windows"], ["markdown", "Markdown"], ["github", "GitHub"], ["linkedin", "LinkedIn"], ["shortbit", "ShortBit"], ["shortbits", "ShortBits"], ["powershell", "PowerShell"], ["bits", "Bits"], ["supabase", "Supabase"]]);
  const caseSelector = [
    ".ac-module button",
    ".ac-panel-body button",
    ".ac-module label > span:first-child",
    ".ac-panel-body label > span:first-child",
    ".ac-module legend",
    ".ac-panel-body legend",
    ".ac-module .section-label h2",
    ".ac-module .section-label span",
    ".ac-module h3",
    ".ac-panel-body h3",
    ".ac-module summary",
    ".ac-module .admin-checkbox",
  ].join(",");
  const userContentSelector = ".message-card, .short-link-admin-heading, .blog-admin-post-button, .hardware-devices, .blog-admin-preview, .ac-message-detail";

  function toSentenceCase(text) {
    const match = text.match(/^(\s*)(.*?)(\s*)$/s);
    const core = match[2];
    if (!/[A-Z]{2}/.test(core) || /[a-z]/.test(core)) {
      return text;
    }
    let words = core.replace(/^[>+]\s*/, "").replace(/_/g, " ").split(/(\s+|\/)/);
    let first = true;
    words = words.map((word) => {
      if (!/[A-Za-zÀ-ÿ]/.test(word)) {
        return word;
      }
      const bare = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
      let result;
      if (/\.[A-Z]{2,4}$/.test(word) || keepUpper.has(bare)) {
        result = word;
      } else if (properCase.has(bare.toLowerCase())) {
        result = word.replace(bare, properCase.get(bare.toLowerCase()));
      } else {
        result = word.toLowerCase();
        if (first) {
          result = result.replace(/[a-zà-ÿ]/, (letter) => letter.toUpperCase());
        }
      }
      first = false;
      return result;
    });
    return `${match[1]}${words.join("")}${match[3]}`;
  }

  function fluentCaseElement(element) {
    const isControl = element.tagName === "BUTTON" && !element.classList.contains("blog-admin-post-button");
    if (!isControl && element.closest(userContentSelector)) {
      return;
    }
    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        const next = toSentenceCase(node.textContent);
        if (next !== node.textContent) {
          node.textContent = next;
        }
      }
    });
  }

  function fluentCase(scope = document) {
    if (scope.nodeType !== Node.ELEMENT_NODE && scope !== document) {
      return;
    }
    if (scope !== document && scope.matches(caseSelector)) {
      fluentCaseElement(scope);
    }
    scope.querySelectorAll(caseSelector).forEach(fluentCaseElement);
  }

  new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "characterData") {
        const parent = record.target.parentElement;
        if (parent?.matches(caseSelector)) {
          fluentCaseElement(parent);
        }
        return;
      }
      if (record.target.nodeType === Node.ELEMENT_NODE && record.target.matches(caseSelector)) {
        fluentCaseElement(record.target);
      }
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          fluentCase(node);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  hydrateIcons();
  buildNav();
  prepareModules();
  buildHome();
  fluentCase();
  syncNavMode();
  syncSignedInChrome();

  window.BITS_ADMIN_SHELL = {
    openPanel,
    closePanel,
    navigate,
    get route() {
      return currentRoute;
    },
  };
})();
