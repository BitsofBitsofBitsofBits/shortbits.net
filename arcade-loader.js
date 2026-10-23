(() => {
  const arcadeWindow = document.querySelector("#arcade-window");
  if (!arcadeWindow) {
    return;
  }

  const loader = document.currentScript;
  const source = new URL("arcade.js", loader.src);
  source.search = new URL(loader.src).search;
  let loading = null;
  let loaded = false;

  function loadArcade() {
    if (loading) {
      return loading;
    }
    const status = document.querySelector("#arcade-status");
    status.textContent = "Loading arcade subsystems…";
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source.href;
      script.async = true;
      script.addEventListener("load", () => {
        loaded = true;
        observer.disconnect();
        resolve();
      }, { once: true });
      script.addEventListener("error", () => {
        script.remove();
        loading = null;
        status.textContent = "Arcade could not load. Close and reopen this window to retry.";
        reject(new Error("Unable to load arcade subsystems."));
      }, { once: true });
      document.head.append(script);
    });
    return loading;
  }

  function loadWhenVisible() {
    if (!loaded && !arcadeWindow.hidden && !arcadeWindow.classList.contains("is-minimized")) {
      loadArcade().catch(() => {});
    }
  }

  const observer = new MutationObserver(loadWhenVisible);
  observer.observe(arcadeWindow, {
    attributes: true,
    attributeFilter: ["hidden", "class"],
  });
  window.BITS_ARCADE = { load: loadArcade };
  loadWhenVisible();
})();
