(() => {
  const root = document.documentElement;
  const preferences = {
    motion: ["motion", ["system", "reduced"], "system"],
    "text-size": ["textsize", ["default", "large", "extra-large"], "default"],
    contrast: ["contrast", ["default", "high"], "default"],
    effects: ["effects", ["on", "off"], "on"],
    "eink-refresh": ["einkRefresh", ["on", "off"], "off"],
    "pause-content": ["pauseContent", ["on", "off"], "off"],
    "readable-text": ["readableText", ["on", "off"], "off"],
    "large-controls": ["largeControls", ["on", "off"], "off"],
    "simple-layout": ["simpleLayout", ["on", "off"], "off"],
    transparency: ["transparency", ["default", "reduced"], "default"],
    focus: ["focus", ["default", "enhanced"], "default"],
  };
  const keys = Object.keys(preferences).map(key => `bits-${key}`);
  const pausedAnimations = new Set();

  function syncAnimations() {
    if (root.dataset.pauseContent === "on") {
      for (const animation of document.getAnimations()) {
        if (animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity) {
          pausedAnimations.add(animation);
          animation.pause();
        }
      }
    } else {
      for (const animation of pausedAnimations) {
        if (animation.playState === "paused") animation.play();
      }
      pausedAnimations.clear();
    }
  }

  function sync() {
    for (const [key, [attribute, values, fallback]] of Object.entries(preferences)) {
      let value;
      try {
        value = localStorage.getItem(`bits-${key}`);
      } catch (error) {
        console.warn(`Unable to read the ${key} accessibility preference:`, error);
      }
      root.dataset[attribute] = values.includes(value) ? value : fallback;
    }
  }

  function set(key, value) {
    const preference = preferences[key];
    if (!preference || !preference[1].includes(value)) {
      throw new Error(`Invalid accessibility preference: ${key}=${value}`);
    }
    localStorage.setItem(`bits-${key}`, value);
    root.dataset[preference[0]] = value;
    window.dispatchEvent(new CustomEvent("bits:preferences-changed", { detail: { key, value } }));
  }

  sync();
  document.addEventListener("animationstart", () => {
    if (root.dataset.pauseContent === "on") syncAnimations();
  });
  document.addEventListener("DOMContentLoaded", syncAnimations, { once: true });
  window.addEventListener("bits:preferences-changed", syncAnimations);
  window.addEventListener("storage", event => {
    if (event.key !== null && !keys.includes(event.key)) return;
    sync();
    window.dispatchEvent(new CustomEvent("bits:preferences-changed"));
  });
  window.BITS_ACCESSIBILITY = Object.freeze({ keys: Object.freeze(keys), set, sync });
})();
