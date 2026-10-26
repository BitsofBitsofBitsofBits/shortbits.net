(() => {
  if (!window.BITS_LAYOUTS) return;
  const themeId = "m365";
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-6h-4v6H4a1 1 0 0 1-1-1z"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    message: '<path d="M4 4h16v13H8l-4 4z"/><path d="M8 9h8M8 13h5"/>',
    health: '<path d="M3 12h4l2-7 4 14 2-7h6"/><path d="M4 3h16v18H4z"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-1.2 1-2 1.5-2 3M12 17h.01"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.2-1.6l1.4-1.1-1.5-2.6-1.7.7a7 7 0 0 0-2-1.1L14.7 4h-3.1l-.3 2.3a7 7 0 0 0-2 1.1l-1.7-.7-1.5 2.6 1.4 1.1a7 7 0 0 0 0 3.2l-1.4 1.1 1.5 2.6 1.7-.7a7 7 0 0 0 2 1.1l.3 2.3h3.1l.3-2.3a7 7 0 0 0 2-1.1l1.7.7 1.5-2.6-1.4-1.1A7 7 0 0 0 19 12z"/>',
  };
  const make = (tag, className) => {
    const node = document.createElement(tag);
    node.setAttribute("data-layout-chrome", "");
    if (className) node.className = className;
    return node;
  };
  const icon = (name) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("data-layout-chrome", "");
    node.innerHTML = paths[name] || paths.apps;
    node.querySelectorAll("*").forEach((child) => child.setAttribute("data-layout-chrome", ""));
    return node;
  };
  let cleanup = null;

  window.BITS_LAYOUTS.register(themeId, {
    mount(ctx) {
      const { body, page } = ctx;
      if (!body || body.querySelector(".m365-suitebar")) return;
      const suite = make("header", "m365-suitebar");
      suite.setAttribute("aria-label", "Bits 365 suite navigation");
      const launchButton = make("button", "m365-chrome-button");
      launchButton.type = "button";
      launchButton.setAttribute("aria-label", "Open app launcher");
      launchButton.setAttribute("aria-expanded", "false");
      const waffle = make("span", "m365-waffle");
      waffle.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 9; i += 1) waffle.append(make("i", ""));
      launchButton.append(waffle);
      const brand = make("a", "m365-brand");
      brand.href = "/online/";
      brand.textContent = "Bits 365";
      const searchIcon = icon("search");
      searchIcon.classList.add("m365-search-icon");
      const search = make("input", "m365-search");
      search.type = "search";
      search.placeholder = "Search this site";
      search.setAttribute("aria-label", "Search site navigation");
      const actions = make("div", "m365-suite-actions");
      const help = make("a", "m365-chrome-button");
      help.href = "/blog/";
      help.setAttribute("aria-label", "Help and updates");
      help.append(icon("help"));
      const avatar = make("a", "m365-avatar");
      avatar.href = "/professional/";
      avatar.setAttribute("aria-label", "Caleb K Masters profile");
      avatar.textContent = "CM";
      actions.append(help, avatar);
      suite.append(launchButton, brand, searchIcon, search, actions);

      const launcher = make("div", "m365-launcher");
      launcher.hidden = true;
      launcher.setAttribute("aria-label", "App launcher");
      [["BITS", "Bits 365", "/online/"], ["ME", "Professional", "/professional/"], ["MC", "Message center", "/blog/"], ["SH", "Service health", "/boot/"]].forEach(([tag, label, href]) => {
        const link = make("a", "");
        link.href = href;
        const mark = make("span", "m365-launcher-icon");
        mark.textContent = tag;
        const text = make("span", "");
        text.textContent = label;
        link.append(mark, text);
        launcher.append(link);
      });

      const nav = make("nav", "m365-nav");
      nav.setAttribute("aria-label", "Bits 365 navigation");
      const toggle = make("button", "m365-nav-toggle");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Collapse navigation");
      toggle.append(icon("menu"));
      const toggleLabel = make("span", "");
      toggleLabel.textContent = "Collapse navigation";
      toggle.append(toggleLabel);
      const list = make("ul", "m365-nav-links");
      const pages = [["home", "Home", "/online/", "online"], ["person", "Profile", "/professional/", "professional"], ["message", "Message center", "/blog/", "blog"], ["health", "Service health", "/boot/", "boot"], ["apps", "App launcher", "/", "chooser"]];
      pages.forEach(([ico, label, href, target]) => {
        const li = make("li", "");
        const link = make("a", target === page ? "m365-current" : "");
        link.href = href;
        if (target === page) link.setAttribute("aria-current", "page");
        link.append(icon(ico));
        const text = make("span", "m365-nav-label");
        text.textContent = label;
        link.append(text);
        li.append(link);
        list.append(li);
      });
      const caption = make("p", "m365-nav-caption");
      caption.textContent = "Resources";
      const captionItem = make("li", "");
      captionItem.append(caption);
      list.append(captionItem);
      const resources = [["settings", "About this site", "/online/#about-window"], ["help", "Contact", "/professional/#contact"]];
      resources.forEach(([ico, label, href]) => {
        const li = make("li", "");
        const link = make("a", "");
        link.href = href;
        link.append(icon(ico));
        const text = make("span", "m365-nav-label");
        text.textContent = label;
        link.append(text);
        li.append(link);
        list.append(li);
      });
      nav.append(toggle, list);
      body.prepend(nav);
      body.prepend(launcher);
      body.prepend(suite);
      if (page === "online") {
        const shell = body.querySelector("#interface-shell");
        const commandBar = shell?.querySelector("#app-menu-bar");
        const heading = make("header", "m365-page-heading");
        const title = make("h1", "");
        title.textContent = "Home";
        const description = make("p", "");
        description.textContent = "Your personal Bits 365 overview";
        heading.append(title, description);
        shell?.insertBefore(heading, commandBar?.nextSibling || shell.firstChild);
      }

      const onToggle = () => {
        const collapsed = body.classList.toggle("m365-nav-collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
        toggleLabel.textContent = collapsed ? "Expand navigation" : "Collapse navigation";
      };
      const onLauncher = () => {
        launcher.hidden = !launcher.hidden;
        launchButton.setAttribute("aria-expanded", String(!launcher.hidden));
      };
      const onOutside = (event) => {
        if (!launcher.hidden && !launcher.contains(event.target) && !launchButton.contains(event.target)) {
          launcher.hidden = true;
          launchButton.setAttribute("aria-expanded", "false");
        }
      };
      const onSearch = (event) => {
        if (event.key !== "Enter") return;
        const value = search.value.trim().toLowerCase();
        const match = [...list.querySelectorAll("a")].find((link) => link.textContent.toLowerCase().includes(value));
        if (value && match) window.location.href = match.href;
      };
      toggle.addEventListener("click", onToggle);
      launchButton.addEventListener("click", onLauncher);
      document.addEventListener("pointerdown", onOutside);
      search.addEventListener("keydown", onSearch);
      ctx.root.dataset.m365Chrome = "active";
      cleanup = () => {
        toggle.removeEventListener("click", onToggle);
        launchButton.removeEventListener("click", onLauncher);
        document.removeEventListener("pointerdown", onOutside);
        search.removeEventListener("keydown", onSearch);
        delete ctx.root.dataset.m365Chrome;
        body.classList.remove("m365-nav-collapsed");
      };
    },
    update() {},
    unmount() {
      cleanup?.();
      cleanup = null;
    },
  });
})();



