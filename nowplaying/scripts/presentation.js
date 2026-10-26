(() => {
  const controls = document.querySelector("#presentation-controls");
  const autoHide = document.querySelector("#presentation-auto-hide");
  const fullscreen = document.querySelector("#presentation-fullscreen");
  const status = document.querySelector("#presentation-control-status");
  const sessions = { spotify: null, youtube: null };
  const sessionElements = {
    spotify: document.querySelector("#spotify-session"),
    youtube: document.querySelector("#youtube-session"),
  };
  let hideTimer;
  let fullscreenPending = false;
  const supportsFullscreen = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);

  function sessionTime(milliseconds) {
    const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
    return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function renderSessions() {
    for (const [provider, element] of Object.entries(sessionElements)) {
      const media = sessions[provider];
      const startedAt = Date.parse(media?.sessionStartedAt);
      if (!media?.available) {
        element.textContent = media?.state === "loading" || !media ? "AWAITING SIGNAL" : "NO ACTIVE SESSION";
        element.removeAttribute("title");
      } else if (!Number.isFinite(startedAt) || startedAt > Date.now()) {
        element.textContent = "SESSION TIMING UNAVAILABLE";
        element.title = "Deploy the session-tracking backend to show server-observed session lengths.";
      } else {
        const observedAt = Number(media.updatedAt);
        const end = media.state === "stale" && Number.isFinite(observedAt) ? observedAt : Date.now();
        element.textContent = `${sessionTime(end - startedAt)}${media.state === "stale" ? " // LAST KNOWN" : ""}`;
        element.title = `Continuous session first observed ${new Date(startedAt).toLocaleString()}. Pauses count toward the session.`;
      }
    }
  }
  for (const provider of Object.keys(sessions)) {
    window.addEventListener(`media:${provider}`, event => {
      sessions[provider] = event.detail;
      renderSessions();
    });
  }

  function showControls() {
    window.clearTimeout(hideTimer);
    document.body.classList.remove("presentation-controls-hidden");
    if (!autoHide.checked || document.visibilityState !== "visible") return;
    hideTimer = window.setTimeout(() => {
      if (controls.matches(":hover") || controls.contains(document.activeElement)
        && document.activeElement.matches(":focus-visible")) return;
      document.body.classList.add("presentation-controls-hidden");
    }, 4000);
  }
  for (const type of ["pointermove", "pointerdown", "keydown", "focusin"]) {
    document.addEventListener(type, showControls);
  }
  controls.addEventListener("pointerleave", showControls);
  controls.addEventListener("focusout", showControls);
  autoHide.addEventListener("change", showControls);

  function syncFullscreen() {
    const active = Boolean(document.fullscreenElement);
    fullscreen.setAttribute("aria-pressed", String(active));
    fullscreen.textContent = active ? "EXIT FULLSCREEN" : "ENTER FULLSCREEN";
    showControls();
  }

  async function toggleFullscreen() {
    if (!supportsFullscreen) {
      status.textContent = "Fullscreen is not supported in this browser. The live page still works normally.";
      return;
    }
    if (fullscreenPending) return;
    fullscreenPending = true;
    fullscreen.disabled = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      status.textContent = document.fullscreenElement
        ? "Press F or Escape to exit fullscreen. Move the pointer or press Tab to show controls."
        : "Press F for fullscreen. Move the pointer or press Tab to show controls.";
    } catch (error) {
      console.error("Unable to change presentation fullscreen:", error);
      status.textContent = "Fullscreen could not be changed. Try the fullscreen button or your browser's fullscreen command.";
    } finally {
      fullscreenPending = false;
      fullscreen.disabled = false;
      syncFullscreen();
    }
  }
  fullscreen.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() !== "f" || event.repeat || event.altKey || event.ctrlKey || event.metaKey
      || event.target instanceof Element && event.target.closest("input, select, textarea, [contenteditable]")) return;
    event.preventDefault();
    toggleFullscreen();
  });
  if (!supportsFullscreen) {
    fullscreen.disabled = true;
    fullscreen.textContent = "FULLSCREEN UNAVAILABLE";
    status.textContent = "Fullscreen is not supported in this browser. Controls still hide automatically.";
  }

  const preference = window.BITS_THEME_PREFERENCE;
  const theme = document.querySelector("#presentation-theme");
  const scheme = document.querySelector("#presentation-scheme");
  theme.replaceChildren(...preference.buildOptions());
  theme.value = document.documentElement.dataset.interfaceTheme;
  theme.addEventListener("change", () => {
    preference.select(theme.value);
    preference.apply(theme.value);
  });
  preference.bindColorSchemeSelect(scheme);
  window.addEventListener("bits:theme-applied", () => {
    theme.value = document.documentElement.dataset.interfaceTheme;
  });
  window.addEventListener("storage", event => {
    if (event.key === null || ["bits-interface-theme", preference.choiceKey, preference.dismissalKey].includes(event.key)) {
      preference.apply(preference.resolve());
    }
  });
  document.addEventListener("visibilitychange", () => {
    window.clearTimeout(hideTimer);
    if (document.visibilityState === "visible") {
      renderSessions();
      showControls();
    }
  });
  window.addEventListener("pageshow", showControls);
  window.setInterval(renderSessions, 1000);
  renderSessions();
  showControls();
})();
