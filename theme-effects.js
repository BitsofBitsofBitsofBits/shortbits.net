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
};

function hasReducedAtmosphereMotion() {
  return document.documentElement.dataset.motion === "reduced"
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
  return particle;
}

function renderThemeAtmosphere() {
  const theme = document.documentElement.dataset.interfaceTheme || "default";
  const enabled = canRenderAtmosphere();
  const reducedMotion = hasReducedAtmosphereMotion();
  const particleCount = enabled ? themeParticleCounts[theme] ?? 0 : 0;

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

const atmosphereObserver = new MutationObserver(renderThemeAtmosphere);
atmosphereObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: [
    "data-interface-theme",
    "data-effects",
    "data-contrast",
    "data-motion",
  ],
});

renderThemeAtmosphere();
