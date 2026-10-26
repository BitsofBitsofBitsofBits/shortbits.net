(() => {
  const layer = document.querySelector("#not-found-bits");
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const forcedColors = window.matchMedia("(forced-colors: active)");
  const compact = window.matchMedia("(max-width: 900px)");
  const errorBits = ["404", "4", "0"];
  let timer;
  let suspended = false;

  function enabled() {
    return !suspended && !document.hidden && !window.location.pathname.startsWith("/go/")
      && !reducedMotion.matches && !forcedColors.matches
      && root.dataset.motion !== "reduced" && root.dataset.effects !== "off"
      && root.dataset.contrast !== "high" && root.dataset.interfaceTheme !== "high-contrast";
  }

  function releaseBit(initial = false) {
    if (layer.childElementCount >= (compact.matches ? 6 : 12)) return;
    const bit = document.createElement("span");
    bit.className = "falling-bit";
    bit.textContent = errorBits[Math.floor(Math.random() * errorBits.length)];
    bit.style.setProperty("--bit-x", `${Math.random() * 100}%`);
    bit.style.setProperty("--bit-size", `${0.65 + Math.random() * 0.7}rem`);
    bit.style.setProperty("--bit-speed", `${5 + Math.random() * 5}s`);
    bit.style.setProperty("--bit-opacity", `${0.12 + Math.random() * 0.25}`);
    if (initial) bit.style.animationDelay = `${-1 - Math.random() * 3}s`;
    bit.addEventListener("animationend", () => bit.remove(), { once: true });
    layer.append(bit);
  }

  function schedule() {
    timer = window.setTimeout(() => {
      timer = undefined;
      if (!enabled()) {
        sync();
        return;
      }
      releaseBit();
      schedule();
    }, compact.matches ? 1200 : 750);
  }

  function sync() {
    window.clearTimeout(timer);
    timer = undefined;
    layer.replaceChildren();
    layer.hidden = !enabled();
    if (layer.hidden) return;
    for (let index = 0; index < (compact.matches ? 3 : 4); index++) releaseBit(true);
    schedule();
  }

  for (const media of [reducedMotion, forcedColors, compact]) media.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { suspended = true; sync(); });
  window.addEventListener("pageshow", () => { suspended = false; sync(); });
  new MutationObserver(sync).observe(root, {
    attributes: true,
    attributeFilter: ["data-motion", "data-effects", "data-contrast", "data-interface-theme"],
  });
  sync();
})();
