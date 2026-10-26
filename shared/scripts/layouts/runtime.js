(() => {
  if (window.BITS_LAYOUTS) {
    return;
  }

  const preference = window.BITS_THEME_PREFERENCE;
  const root = document.documentElement;
  const registry = new Map();
  const requestedScripts = new Set();
  const noticeDismissalKey = "bits-layout-notice-dismissed";
  const themeSelectSelector = [
    "#interface-theme-select",
    "#profile-theme-select",
    "#endless-boot-theme",
  ].join(", ");
  let mountedThemeId = "";
  let mountedModule = null;
  let notice = null;
  let noticeThemeId = "";

  function getActiveTheme() {
    return preference?.getTheme(root.dataset.interfaceTheme) ?? null;
  }

  function switchToStandardTheme() {
    const themeId = preference?.getLastStandard() ?? "default";
    const select = document.querySelector(themeSelectSelector);
    if (select && [...select.options].some((option) => option.value === themeId)) {
      select.value = themeId;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    preference?.select(themeId);
    preference?.apply(themeId);
  }

  function createContext(theme) {
    return {
      page: root.dataset.page,
      theme,
      scheme: root.dataset.colorScheme,
      root,
      body: document.body,
      lastStandardTheme: preference?.getTheme(preference.getLastStandard()),
      switchToStandardTheme,
    };
  }

  function unmountLayout() {
    if (mountedModule?.unmount) {
      try {
        mountedModule.unmount();
      } catch (error) {
        console.error(`Unable to unmount the ${mountedThemeId} layout:`, error);
      }
    }
    document.querySelectorAll("[data-layout-chrome]").forEach((node) => node.remove());
    mountedModule = null;
    mountedThemeId = "";
  }

  function mountLayout(theme) {
    const module = registry.get(theme.id);
    if (!module) {
      return;
    }
    mountedThemeId = theme.id;
    mountedModule = module;
    try {
      module.mount?.(createContext(theme));
    } catch (error) {
      console.error(`Unable to mount the ${theme.id} layout:`, error);
    }
  }

  function requestLayoutScript(theme) {
    if (requestedScripts.has(theme.id)) {
      return;
    }
    requestedScripts.add(theme.id);
    const script = document.createElement("script");
    script.src = `/shared/scripts/layouts/${theme.id}.js?v=${preference?.layoutAssetVersion ?? "1"}`;
    script.defer = true;
    document.head.append(script);
  }

  function hideNotice() {
    notice?.remove();
    notice = null;
    noticeThemeId = "";
  }

  function showNotice(theme) {
    if (noticeThemeId === theme.id) {
      return;
    }
    hideNotice();
    if (sessionStorage.getItem(noticeDismissalKey) === theme.id) {
      return;
    }
    const fallback = preference?.getTheme(preference.getLastStandard());
    notice = document.createElement("aside");
    notice.className = "bits-layout-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-label", "Experimental layout");

    const badge = document.createElement("strong");
    badge.textContent = "EXPERIMENTAL";
    const message = document.createElement("span");
    message.textContent = `${theme.name} layout. Some areas may still look unfinished.`;
    const revert = document.createElement("button");
    revert.type = "button";
    revert.textContent = `Use ${fallback?.name ?? "DEFAULT"}`;
    revert.addEventListener("click", switchToStandardTheme);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "bits-layout-notice-close";
    close.setAttribute("aria-label", "Dismiss experimental layout notice");
    close.textContent = "×";
    close.addEventListener("click", () => {
      sessionStorage.setItem(noticeDismissalKey, theme.id);
      hideNotice();
    });
    notice.append(badge, message, revert, close);
    document.body.append(notice);
    noticeThemeId = theme.id;
  }

  function sync() {
    const theme = getActiveTheme();
    if (!theme?.experimental) {
      unmountLayout();
      hideNotice();
      return;
    }
    showNotice(theme);
    if (mountedThemeId === theme.id) {
      try {
        mountedModule?.update?.(createContext(theme));
      } catch (error) {
        console.error(`Unable to update the ${theme.id} layout:`, error);
      }
      return;
    }
    unmountLayout();
    requestLayoutScript(theme);
    mountLayout(theme);
  }

  window.BITS_LAYOUTS = Object.freeze({
    register(themeId, module) {
      registry.set(themeId, module);
      const theme = getActiveTheme();
      if (theme?.id === themeId && mountedThemeId !== themeId) {
        mountLayout(theme);
      }
    },
    switchToStandardTheme,
  });

  window.addEventListener("bits:theme-applied", sync);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync, { once: true });
  } else {
    sync();
  }
})();
