(() => {
  if (!window.BITS_LAYOUTS) return;

  const cleanups = [];
  function chrome(tag, className, text) {
    const node = document.createElement(tag);
    node.setAttribute("data-layout-chrome", "windows-10");
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function caption(target, text) {
    if (!target) return;
    const bar = chrome("div", "w10-caption", text);
    const controls = chrome("span", "w10-caption-controls", "—   □   ×");
    controls.setAttribute("aria-hidden", "true");
    bar.append(controls);
    target.prepend(bar);
  }

  window.BITS_LAYOUTS.register("windows-10", {
    mount(ctx) {
      if (ctx.page === "professional") {
        caption(ctx.body, "Settings — Professional profile");
        const nav = chrome("nav", "w10-settings-nav");
        nav.setAttribute("aria-label", "Profile settings navigation");
        nav.id = "w10-profile-navigation";
        const toggle = chrome("button", "", "☰  Profile");
        toggle.type = "button";
        toggle.setAttribute("aria-controls", nav.id);
        const narrow = window.matchMedia("(max-width: 700px)").matches;
        nav.dataset.collapsed = String(narrow);
        toggle.setAttribute("aria-expanded", String(!narrow));
        toggle.addEventListener("click", () => {
          const expanded = nav.dataset.collapsed === "true";
          nav.dataset.collapsed = String(!expanded);
          toggle.setAttribute("aria-expanded", String(expanded));
        });
        nav.append(toggle, chrome("strong", "", "Your professional profile"));
        const sections = [["main", "⌂  Home"], ["experience", "Experience"], ["education", "Education"], ["skills", "Skills"], ["projects", "Projects"], ["contact", "Contact"]];
        sections.forEach(([id, title]) => {
          if (!document.getElementById(id)) return;
          const link = chrome("a", "", title);
          link.href = `#${id}`;
          nav.append(link);
        });
        const home = chrome("a", "", "← Choose another profile");
        home.href = "/";
        nav.append(home);
        ctx.body.querySelector(".w10-caption").after(nav);
      }
      if (ctx.page === "blog" || ctx.page === "post") caption(document.querySelector(".blog-shell"), "Bits Journal");
      if (ctx.page === "online") {
        const taskbar = document.querySelector(".fake-taskbar");
        const start = document.querySelector(".fake-start-menu");
        if (taskbar && start) {
          const search = chrome("button", "w10-search", "Type here to search");
          search.type = "button";
          search.setAttribute("aria-label", "Type here to search desktop apps");
          search.setAttribute("aria-haspopup", "true");
          search.addEventListener("click", () => {
            start.open = true;
            start.querySelector("button")?.focus();
          });
          start.after(search);
          const menu = start.querySelector("div");
          [["settings-window", "⚙  Settings"], ["filesystem-window", "▱  File Explorer"], ["about-window", "About Bits"]].forEach(([id, title]) => {
            const launcher = document.querySelector(`[data-window-target="${id}"]`);
            if (!menu || !launcher) return;
            const button = chrome("button", "", title);
            button.type = "button";
            button.addEventListener("click", () => { launcher.click(); start.open = false; });
            menu.append(button);
          });
          const summary = start.querySelector("summary");
          if (summary) {
            const original = summary.getAttribute("aria-label");
            summary.setAttribute("aria-label", "Start — BITS OS");
            cleanups.push(() => original === null ? summary.removeAttribute("aria-label") : summary.setAttribute("aria-label", original));
          }
        }
      }
      if (ctx.page === "boot") {
        const host = document.querySelector(".endless-boot-transmission");
        if (host) {
          const status = chrome("div", "w10-updates");
          const dots = chrome("span", "w10-dots");
          dots.setAttribute("aria-hidden", "true");
          for (let index = 0; index < 5; index += 1) dots.append(chrome("i"));
          status.append(dots, chrome("span", "", "Working on updates"));
          host.prepend(status);
        }
      }
    },
    unmount() {
      cleanups.splice(0).forEach((cleanup) => cleanup());
    },
  });
})();
