const themeAtmosphere = document.querySelector("#theme-atmosphere");
const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
const forcedColorsMedia = window.matchMedia("(forced-colors: active)");
const themeParticleCounts = {
  default: 9,
  aurora: 0,
  "cozy-blossom": 18,
  mica: 0,
  fluent: 7,
  "midnight-oled": 28,
  macos: 0,
  terminal: 10,
  minebits: 18,
  aquatic: 16,
  winter: 34,
  spooky: 18,
  christmas: 28,
  "new-year": 36,
  valentines: 18,
  "st-patricks": 18,
  easter: 20,
  "earth-day": 16,
  "independence-day": 64,
  thanksgiving: 18,
};
let einkRefreshAnimation = null;
let lastEinkRefresh = -Infinity;

function canRefreshEink() {
  return document.documentElement.dataset.interfaceTheme === "eink-reader"
    && document.documentElement.dataset.runtime === "ready"
    && document.documentElement.dataset.einkRefresh === "on"
    && canRenderAtmosphere() && !hasReducedAtmosphereMotion() && !document.hidden;
}

function refreshEink(event) {
  if (event.detail?.newlyOpened !== true || !canRefreshEink() || Date.now() - lastEinkRefresh < 2000) return;
  lastEinkRefresh = Date.now();
  const overlay = document.createElement("div");
  overlay.className = "eink-refresh-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.append(overlay);
  const animation = overlay.animate([{ opacity: 0 }, { opacity: 0.08, offset: 0.35 }, { opacity: 0 }], {
    duration: 260, easing: "ease-out",
  });
  einkRefreshAnimation = animation;
  const cleanup = () => {
    overlay.remove();
    if (einkRefreshAnimation === animation) einkRefreshAnimation = null;
  };
  animation.onfinish = cleanup;
  animation.oncancel = cleanup;
}

function hasReducedAtmosphereMotion() {
  return document.documentElement.dataset.motion === "reduced"
    || document.documentElement.dataset.pauseContent === "on"
    || reducedMotionMedia.matches;
}

function canRenderAtmosphere() {
  return document.documentElement.dataset.effects !== "off"
    && document.documentElement.dataset.contrast !== "high"
    && !forcedColorsMedia.matches;
}

function createThemeParticle(theme, index, count) {
  const particle = document.createElement("span");
  const seed = index + 1;
  particle.className = "theme-particle";
  particle.style.setProperty("--particle-x", `${(seed * 47) % 101}%`);
  particle.style.setProperty("--particle-y", `${(seed * 71) % 101}%`);
  particle.style.setProperty("--particle-delay", `${-((seed * 0.73) % 8)}s`);
  particle.style.setProperty("--particle-duration", `${7 + ((seed * 13) % 9)}s`);
  particle.style.setProperty("--particle-size", `${3 + ((seed * 11) % 9)}px`);
  particle.style.setProperty("--particle-drift", `${20 + ((seed * 17) % 70)}px`);
  particle.style.setProperty("--particle-index", String(index));
  particle.style.setProperty("--particle-count", String(count));
  particle.dataset.theme = theme;
  if (theme === "independence-day") {
    const burst = Math.floor(index / 16);
    const angle = (index % 16) * Math.PI / 8;
    const radius = 12 + (index % 3) * 3;
    particle.textContent = String(index % 2);
    particle.style.setProperty("--particle-x", `${[18, 76, 42, 64][burst]}%`);
    particle.style.setProperty("--particle-y", `${[28, 20, 52, 40][burst]}%`);
    particle.style.setProperty("--particle-delay", `${-burst * 2}s`);
    particle.style.setProperty("--firework-dx", `${(Math.cos(angle) * radius).toFixed(2)}vmin`);
    particle.style.setProperty("--firework-dy", `${(Math.sin(angle) * radius).toFixed(2)}vmin`);
  }
  return particle;
}

function renderThemeAtmosphere() {
  const theme = document.documentElement.dataset.interfaceTheme || "default";
  const enabled = canRenderAtmosphere();
  const reducedMotion = hasReducedAtmosphereMotion();
  const particleCount = enabled ? themeParticleCounts[theme] ?? 0 : 0;
  if (!canRefreshEink()) einkRefreshAnimation?.cancel();
  if (theme !== "holographic" || reducedMotion || !enabled) {
    document.documentElement.style.removeProperty("--foil-x");
    document.documentElement.style.removeProperty("--foil-y");
  }

  themeAtmosphere.dataset.theme = theme;
  themeAtmosphere.dataset.motion = reducedMotion ? "reduced" : "full";
  themeAtmosphere.hidden = !enabled;
  themeAtmosphere.replaceChildren(
    ...Array.from(
      { length: particleCount },
      (_, index) => createThemeParticle(theme, index, particleCount),
    ),
  );
}

let pointerFrame;
window.addEventListener("pointermove", (event) => {
  if (pointerFrame || themeAtmosphere.hidden) {
    return;
  }
  pointerFrame = window.requestAnimationFrame(() => {
    themeAtmosphere.style.setProperty(
      "--atmosphere-x",
      `${(event.clientX / window.innerWidth) * 100}%`,
    );
    if (document.documentElement.dataset.interfaceTheme === "holographic"
      && canRenderAtmosphere() && !hasReducedAtmosphereMotion()) {
      document.documentElement.style.setProperty("--foil-x", `${20 + (event.clientX / window.innerWidth) * 60}%`);
      document.documentElement.style.setProperty("--foil-y", `${20 + (event.clientY / window.innerHeight) * 60}%`);
    }
    themeAtmosphere.style.setProperty(
      "--atmosphere-y",
      `${(event.clientY / window.innerHeight) * 100}%`,
    );
    pointerFrame = null;
  });
}, { passive: true });

window.addEventListener("bits:appearance-changed", renderThemeAtmosphere);
window.addEventListener("bits:preferences-changed", renderThemeAtmosphere);
reducedMotionMedia.addEventListener("change", renderThemeAtmosphere);
forcedColorsMedia.addEventListener("change", renderThemeAtmosphere);
window.addEventListener("desktop-window:opened", refreshEink);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) einkRefreshAnimation?.cancel();
});

const atmosphereObserver = new MutationObserver(renderThemeAtmosphere);
atmosphereObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: [
    "data-interface-theme",
    "data-effects",
    "data-contrast",
    "data-motion",
    "data-eink-refresh",
    "data-pause-content",
  ],
});

renderThemeAtmosphere();
