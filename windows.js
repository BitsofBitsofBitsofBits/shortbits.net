const desktopWindows = [...document.querySelectorAll("[data-window]")];
const desktopWindowCount = document.querySelector("#desktop-window-count");
const desktopWindowLaunchers = document.querySelectorAll("[data-window-target]");
const desktopWindowMirrors = document.querySelectorAll("[data-window-mirror]");
const desktopWindowImageMirrors = document.querySelectorAll("[data-window-mirror-image]");
const desktopWindowMinimumWidthPx = 280;
const desktopWindowMinimumHeightPx = 120;
const desktopExperienceQuery = window.matchMedia("(min-width: 901px)");
const openedDesktopWindowIds = new Set();
const desktopWindowsBySlug = new Map(
  desktopWindows.map((windowElement) => [
    windowElement.id.replace(/-window$/, ""),
    windowElement,
  ]),
);

let activeDesktopWindow = null;
let dragState = null;
let resizeState = null;
let isApplyingWindowUrl = false;

function getDesktopWindowSlug(windowElement) {
  return windowElement.id.replace(/-window$/, "");
}

function getOpenDesktopWindowSlugs() {
  return desktopWindows
    .filter((windowElement) => !windowElement.hidden)
    .map(getDesktopWindowSlug);
}

function syncDesktopWindowUrl() {
  if (isApplyingWindowUrl) {
    return;
  }

  const url = new URL(window.location.href);
  const openSlugs = getOpenDesktopWindowSlugs();
  url.searchParams.delete("window");
  url.searchParams.delete("windows");

  if (openSlugs.length === 1) {
    url.searchParams.set("window", openSlugs[0]);
  } else if (openSlugs.length > 1) {
    url.searchParams.set("windows", openSlugs.join(","));
  }

  window.history.replaceState(null, "", url);
}

function getLinkedDesktopWindowSlugs() {
  const params = new URLSearchParams(window.location.search);
  const values = [
    ...params.getAll("window"),
    ...(params.get("windows")?.split(",") ?? []),
  ];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function updateDesktopWindowCount() {
  desktopWindowCount.textContent = String(
    desktopWindows.filter((windowElement) => !windowElement.hidden).length,
  );
}

function focusDesktopWindow(windowElement) {
  const otherOpenWindows = desktopWindows.filter((candidate) => (
    candidate !== windowElement && !candidate.hidden
  ));
  otherOpenWindows.forEach((candidate, index) => {
    candidate.style.zIndex = String(30 + index);
  });
  windowElement.style.zIndex = String(30 + otherOpenWindows.length);
  activeDesktopWindow = windowElement;
}

function constrainDesktopWindow(windowElement, x, y) {
  const rect = windowElement.getBoundingClientRect();
  const width = windowElement.offsetWidth || rect.width;
  const height = windowElement.offsetHeight || rect.height;
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);

  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

function positionDesktopWindow(windowElement, x, y) {
  const position = constrainDesktopWindow(windowElement, x, y);
  windowElement.style.left = `${position.x}px`;
  windowElement.style.top = `${position.y}px`;
}

function resizeDesktopWindow(windowElement, width, height) {
  const clampedWidth = Math.min(
    window.innerWidth - 16,
    Math.max(desktopWindowMinimumWidthPx, width),
  );
  const clampedHeight = Math.min(
    window.innerHeight - 16,
    Math.max(desktopWindowMinimumHeightPx, height),
  );
  const rect = windowElement.getBoundingClientRect();

  windowElement.style.width = `${clampedWidth}px`;
  windowElement.style.height = `${clampedHeight}px`;
  positionDesktopWindow(
    windowElement,
    Math.min(rect.left, window.innerWidth - clampedWidth - 8),
    Math.min(rect.top, window.innerHeight - clampedHeight - 8),
  );
}

function resizeDesktopWindowFromEdge(state, clientX, clientY) {
  const horizontalDelta = clientX - state.startX;
  const verticalDelta = clientY - state.startY;
  const minimumWidth = Math.min(
    desktopWindowMinimumWidthPx,
    window.innerWidth - 16,
  );
  const minimumHeight = Math.min(
    desktopWindowMinimumHeightPx,
    window.innerHeight - 16,
  );
  let left = state.startLeft;
  let top = state.startTop;
  let width = state.startWidth;
  let height = state.startHeight;

  if (state.direction.includes("e")) {
    width = Math.min(
      window.innerWidth - state.startLeft - 8,
      Math.max(minimumWidth, state.startWidth + horizontalDelta),
    );
  } else if (state.direction.includes("w")) {
    width = Math.min(
      state.startRight - 8,
      Math.max(minimumWidth, state.startWidth - horizontalDelta),
    );
    left = state.startRight - width;
  }

  if (state.direction.includes("s")) {
    height = Math.min(
      window.innerHeight - state.startTop - 8,
      Math.max(minimumHeight, state.startHeight + verticalDelta),
    );
  } else if (state.direction.includes("n")) {
    height = Math.min(
      state.startBottom - 8,
      Math.max(minimumHeight, state.startHeight - verticalDelta),
    );
    top = state.startBottom - height;
  }

  state.windowElement.style.left = `${left}px`;
  state.windowElement.style.top = `${top}px`;
  state.windowElement.style.width = `${width}px`;
  state.windowElement.style.height = `${height}px`;
}

function openDesktopWindow(windowElement, launcher = null, syncUrl = true) {
  if (windowElement.hasAttribute("data-desktop-only") && !desktopExperienceQuery.matches) {
    window.dispatchEvent(new CustomEvent("desktop-window:desktop-required", {
      detail: { windowId: windowElement.id },
    }));
    return;
  }

  windowElement.hidden = false;
  windowElement.classList.remove("is-minimized");
  windowElement.dataset.launcherId = launcher?.id || "";

  if (windowElement.hasAttribute("data-window-fullscreen")) {
    windowElement.style.left = "8px";
    windowElement.style.top = "8px";
    windowElement.style.width = `${window.innerWidth - 16}px`;
    windowElement.style.height = `${window.innerHeight - 16}px`;
    windowElement.dataset.positioned = "true";
  } else if (!windowElement.dataset.positioned) {
    const offset = desktopWindows.filter((candidate) => (
      !candidate.hidden && candidate !== windowElement
    )).length * 24;
    positionDesktopWindow(
      windowElement,
      Number(windowElement.dataset.windowX) + offset,
      Number(windowElement.dataset.windowY) + offset,
    );
    windowElement.dataset.positioned = "true";
  }

  focusDesktopWindow(windowElement);
  updateDesktopWindowCount();
  window.dispatchEvent(new CustomEvent("desktop-window:opened", {
    detail: { windowId: windowElement.id },
  }));
  openedDesktopWindowIds.add(windowElement.id);
  if (openedDesktopWindowIds.size === desktopWindows.length) {
    window.BITS_EASTER_EGGS?.showAchievement(
      "WINDOW SHOPPER",
      "MULTITASKING PROTOCOL",
      3200,
      "window-shopper",
    );
  }
  if (syncUrl) {
    syncDesktopWindowUrl();
  }
  windowElement.querySelector("[data-window-close]")?.focus();
}

function closeDesktopWindow(windowElement, syncUrl = true) {
  windowElement.hidden = true;
  windowElement.classList.remove("is-minimized");
  updateDesktopWindowCount();
  const remainingOpen = desktopWindows.filter((candidate) => !candidate.hidden).length;

  const launcherId = windowElement.dataset.launcherId;
  if (launcherId) {
    document.getElementById(launcherId)?.focus();
  }

  if (activeDesktopWindow === windowElement) {
    activeDesktopWindow = null;
  }
  if (syncUrl) {
    syncDesktopWindowUrl();
  }
  window.dispatchEvent(new CustomEvent("desktop-window:closed", {
    detail: {
      remainingOpen,
      windowId: windowElement.id,
    },
  }));
}

function applyDesktopWindowUrl() {
  isApplyingWindowUrl = true;
  const linkedSlugs = getLinkedDesktopWindowSlugs();
  const linkedWindows = new Set(
    linkedSlugs
      .map((slug) => desktopWindowsBySlug.get(slug))
      .filter(Boolean),
  );

  desktopWindows.forEach((windowElement) => {
    if (linkedWindows.has(windowElement)) {
      openDesktopWindow(windowElement, null, false);
    } else if (!windowElement.hidden) {
      closeDesktopWindow(windowElement, false);
    }
  });
  isApplyingWindowUrl = false;
  updateDesktopWindowCount();
}

function resetDesktopWindowLayout() {
  desktopWindows.forEach((windowElement) => {
    windowElement.hidden = true;
    windowElement.classList.remove("is-minimized", "is-dragging", "is-resizing");
    windowElement.removeAttribute("style");
    delete windowElement.dataset.positioned;
    delete windowElement.dataset.launcherId;
  });
  activeDesktopWindow = null;
  dragState = null;
  resizeState = null;
  updateDesktopWindowCount();
  syncDesktopWindowUrl();
}

function toggleDesktopWindowMinimized(windowElement) {
  const minimized = windowElement.classList.toggle("is-minimized");
  const button = windowElement.querySelector("[data-window-minimize]");
  button.setAttribute("aria-label", `${minimized ? "Restore" : "Minimize"} ${windowElement.getAttribute("aria-labelledby")?.replace("-title", "") || "window"}`);
  focusDesktopWindow(windowElement);
}

function syncDesktopWindowMirror(mirror) {
  const source = document.querySelector(mirror.dataset.windowMirror);
  if (source) {
    mirror.textContent = source.textContent;
  }
}

function syncDesktopWindowImage(mirror) {
  const source = document.querySelector(mirror.dataset.windowMirrorImage);
  if (!source) {
    return;
  }

  const sourceUrl = source.currentSrc || source.src;
  mirror.hidden = source.hidden || !sourceUrl;
  if (!mirror.hidden) {
    mirror.src = sourceUrl;
    mirror.alt = source.alt;
  } else {
    mirror.removeAttribute("src");
    mirror.alt = "";
  }
}

desktopWindowLaunchers.forEach((launcher, index) => {
  if (!launcher.id) {
    launcher.id = `desktop-window-launcher-${index + 1}`;
  }
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.addEventListener("click", () => {
    const windowElement = document.getElementById(launcher.dataset.windowTarget);
    if (windowElement) {
      openDesktopWindow(windowElement, launcher);
    }
  });
});

desktopWindows.forEach((windowElement) => {
  windowElement.addEventListener("pointerdown", () => focusDesktopWindow(windowElement));
  windowElement.querySelector("[data-window-close]")?.addEventListener("click", () => {
    closeDesktopWindow(windowElement);
  });
  windowElement.querySelector("[data-window-minimize]")?.addEventListener("click", () => {
    toggleDesktopWindowMinimized(windowElement);
  });

  const dragHandle = windowElement.querySelector("[data-window-drag-handle]");
  dragHandle?.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0
      || event.target.closest("button")
      || windowElement.hasAttribute("data-window-fullscreen")
      || window.matchMedia("(max-width: 640px)").matches
    ) {
      return;
    }

    const rect = windowElement.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      windowElement,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    dragHandle.setPointerCapture(event.pointerId);
    windowElement.classList.add("is-dragging");
    focusDesktopWindow(windowElement);
    event.preventDefault();
  });

  dragHandle?.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    positionDesktopWindow(
      dragState.windowElement,
      event.clientX - dragState.offsetX,
      event.clientY - dragState.offsetY,
    );
  });

  const finishDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    dragState.windowElement.classList.remove("is-dragging");
    dragState = null;
  };
  dragHandle?.addEventListener("pointerup", finishDrag);
  dragHandle?.addEventListener("pointercancel", finishDrag);

  const resizeHandle = windowElement.querySelector("[data-window-resize]");
  if (resizeHandle) {
    resizeHandle.dataset.resizeDirection = "se";
  }
  ["n", "ne", "e", "s", "sw", "w", "nw"].forEach((direction) => {
    const edge = document.createElement("span");
    edge.className = "desktop-window-resize-edge";
    edge.dataset.resizeDirection = direction;
    edge.setAttribute("aria-hidden", "true");
    windowElement.append(edge);
  });
  const resizeHandles = windowElement.querySelectorAll("[data-resize-direction]");

  resizeHandles.forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0
        || windowElement.classList.contains("is-minimized")
        || windowElement.hasAttribute("data-window-fullscreen")
        || window.matchMedia("(max-width: 640px)").matches
      ) {
        return;
      }

      const rect = windowElement.getBoundingClientRect();
      resizeState = {
        direction: handle.dataset.resizeDirection,
        pointerId: event.pointerId,
        startBottom: rect.bottom,
        startHeight: rect.height,
        startLeft: rect.left,
        startRight: rect.right,
        startTop: rect.top,
        startWidth: rect.width,
        startX: event.clientX,
        startY: event.clientY,
        windowElement,
      };
      handle.setPointerCapture(event.pointerId);
      windowElement.classList.add("is-resizing");
      focusDesktopWindow(windowElement);
      event.preventDefault();
      event.stopPropagation();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!resizeState || resizeState.pointerId !== event.pointerId) {
        return;
      }
      resizeDesktopWindowFromEdge(resizeState, event.clientX, event.clientY);
    });

    const finishResize = (event) => {
      if (!resizeState || resizeState.pointerId !== event.pointerId) {
        return;
      }
      resizeState.windowElement.classList.remove("is-resizing");
      resizeState = null;
    };
    handle.addEventListener("pointerup", finishResize);
    handle.addEventListener("pointercancel", finishResize);
  });

  resizeHandle?.addEventListener("keydown", (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      || windowElement.classList.contains("is-minimized")
    ) {
      return;
    }

    const rect = windowElement.getBoundingClientRect();
    const step = event.shiftKey ? 50 : 20;
    const widthDelta = event.key === "ArrowLeft"
      ? -step
      : event.key === "ArrowRight"
        ? step
        : 0;
    const heightDelta = event.key === "ArrowUp"
      ? -step
      : event.key === "ArrowDown"
        ? step
        : 0;
    resizeDesktopWindow(
      windowElement,
      rect.width + widthDelta,
      rect.height + heightDelta,
    );
    focusDesktopWindow(windowElement);
    event.preventDefault();
  });
});

desktopWindowMirrors.forEach((mirror) => {
  const source = document.querySelector(mirror.dataset.windowMirror);
  if (!source) {
    return;
  }
  syncDesktopWindowMirror(mirror);
  new MutationObserver(() => syncDesktopWindowMirror(mirror)).observe(source, {
    characterData: true,
    childList: true,
    subtree: true,
  });
});

desktopWindowImageMirrors.forEach((mirror) => {
  const source = document.querySelector(mirror.dataset.windowMirrorImage);
  if (!source) {
    return;
  }
  syncDesktopWindowImage(mirror);
  new MutationObserver(() => syncDesktopWindowImage(mirror)).observe(source, {
    attributeFilter: ["alt", "hidden", "src"],
    attributes: true,
  });
});

window.addEventListener("resize", () => {
  desktopWindows
    .filter((windowElement) => !windowElement.hidden)
    .forEach((windowElement) => {
      if (
        windowElement.hasAttribute("data-desktop-only")
        && !desktopExperienceQuery.matches
      ) {
        closeDesktopWindow(windowElement);
        return;
      }
      if (windowElement.hasAttribute("data-window-fullscreen")) {
        windowElement.style.left = "8px";
        windowElement.style.top = "8px";
        windowElement.style.width = `${window.innerWidth - 16}px`;
        windowElement.style.height = `${window.innerHeight - 16}px`;
        return;
      }
      const rect = windowElement.getBoundingClientRect();
      resizeDesktopWindow(
        windowElement,
        Math.min(rect.width, window.innerWidth - 16),
        Math.min(rect.height, window.innerHeight - 16),
      );
      positionDesktopWindow(windowElement, rect.left, rect.top);
    });
});

window.addEventListener("popstate", applyDesktopWindowUrl);

document.addEventListener("keydown", (event) => {
  const blockingInterface = document.querySelector(
    ".system-overlay:not([hidden]), .death-screen:not([hidden]), #achievements-panel:not([hidden]), #shutdown-screen:not([hidden])",
  );
  if (
    event.key === "Escape"
    && !blockingInterface
    && activeDesktopWindow
    && !activeDesktopWindow.hidden
  ) {
    closeDesktopWindow(activeDesktopWindow);
  }
}, { capture: true });

window.BITS_DESKTOP_WINDOWS = {
  getShareUrl() {
    syncDesktopWindowUrl();
    return window.location.href;
  },
  open(slug) {
    const windowElement = desktopWindowsBySlug.get(slug);
    if (!windowElement) {
      throw new Error(`Unknown desktop window: ${slug}`);
    }
    openDesktopWindow(windowElement);
  },
  resetLayout: resetDesktopWindowLayout,
};

applyDesktopWindowUrl();
