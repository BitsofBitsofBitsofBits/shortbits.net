(() => {
  const trigger = document.querySelector("#bits-launcher-open");
  if (!trigger) return;

  const dialog = document.createElement("dialog");
  dialog.id = "bits-launcher";
  dialog.className = "bits-launcher";
  dialog.setAttribute("aria-labelledby", "bits-launcher-title");
  const heading = document.createElement("h2");
  heading.id = "bits-launcher-title";
  heading.textContent = "Find a Bit";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  const label = document.createElement("label");
  label.htmlFor = "bits-launcher-search";
  label.textContent = "Search windows, pages, and actions";
  const input = document.createElement("input");
  input.id = label.htmlFor;
  input.type = "search";
  input.autocomplete = "off";
  input.setAttribute("aria-controls", "bits-launcher-results");
  const status = document.createElement("p");
  status.className = "bits-launcher-status";
  status.setAttribute("role", "status");
  const results = document.createElement("ul");
  results.id = "bits-launcher-results";
  dialog.append(heading, close, label, input, status, results);
  document.body.append(dialog);

  const entries = [...document.querySelectorAll("[data-window]")].map((element) => {
    const title = document.getElementById(element.getAttribute("aria-labelledby"));
    const launcher = document.querySelector(`[data-window-target="${element.id}"]`);
    return {
      label: title?.textContent.trim() || element.id,
      keywords: `${element.id} ${launcher?.textContent || ""}`,
      desktopOnly: element.hasAttribute("data-desktop-only"),
      run: () => window.BITS_DESKTOP_WINDOWS.open(element.id.replace(/-window$/, "")),
    };
  });
  const pages = [
    ["Professional profile", "/professional/", "career work skills"],
    ["Project case studies", "/projects/", "homelab automation infrastructure"],
    ["Blog", "/blog/", "articles notes posts"],
    ["Printable résumé", "/professional/resume/", "resume PDF experience"],
    ["Choose a profile", "/?choose", "home switch"],
  ];
  pages.forEach(([labelText, href, keywords]) => entries.push({
    label: labelText, keywords, run: () => window.location.assign(href),
  }));
  entries.push({
    label: "Replay boot sequence", keywords: "command startup BIOS",
    run: () => window.BITS_BOOT.play(),
  });
  let visibleEntries = [];
  let previousFocus = null;
  let actionSelected = false;

  function render() {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    visibleEntries = entries.filter((entry) => (
      (!entry.desktopOnly || window.matchMedia("(min-width: 901px)").matches)
      && terms.every((term) => `${entry.label} ${entry.keywords}`.toLowerCase().includes(term))
    ));
    results.replaceChildren(...visibleEntries.map((entry) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = entry.label;
      button.addEventListener("click", () => {
        actionSelected = true;
        dialog.close();
        entry.run();
      });
      item.append(button);
      return item;
    }));
    status.textContent = visibleEntries.length
      ? `${visibleEntries.length} results. Use arrow keys to browse, Enter to open.`
      : "No matching Bits. Try a window name or topic.";
  }

  function open() {
    if (document.documentElement.dataset.boot === "pending") window.BITS_BOOT.skip();
    if (!dialog.open) {
      previousFocus = document.activeElement;
      dialog.showModal();
    }
    input.value = "";
    render();
    input.focus();
  }
  trigger.addEventListener("click", open);
  close.addEventListener("click", () => dialog.close());
  input.addEventListener("input", render);
  dialog.addEventListener("keydown", (event) => {
    const buttons = [...results.querySelectorAll("button")];
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement);
      const next = current < 0
        ? (event.key === "ArrowDown" ? 0 : buttons.length - 1)
        : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === "Enter" && event.target === input) {
      event.preventDefault();
      buttons[0]?.click();
    }
  });
  dialog.addEventListener("close", () => {
    if (!actionSelected) {
      const target = previousFocus?.getClientRects().length
        ? previousFocus : trigger.closest("details")?.querySelector("summary");
      target?.focus();
    }
    actionSelected = false;
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      if (document.querySelector(".system-overlay:not([hidden]), .death-screen:not([hidden])")) return;
      event.preventDefault();
      open();
    }
  });
})();
