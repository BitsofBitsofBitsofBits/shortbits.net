const desktopWindows = [...document.querySelectorAll("[data-window]")];
const desktopWindowCount = document.querySelector("#desktop-window-count");
const desktopWindowLaunchers = document.querySelectorAll("[data-window-target]");
const desktopWindowMirrors = document.querySelectorAll("[data-window-mirror]");
const desktopWindowImageMirrors = document.querySelectorAll("[data-window-mirror-image]");
const systemMonitorWindow = document.querySelector("#monitor-window");
const systemMonitorMetrics = systemMonitorWindow
  ? {
      bits: systemMonitorWindow.querySelector("#monitor-bits-processed"),
      cpu: systemMonitorWindow.querySelector("#monitor-cpu-value"),
      cpuJoke: systemMonitorWindow.querySelector("#monitor-cpu-joke"),
      cpuMeter: systemMonitorWindow.querySelector("#monitor-cpu-meter"),
      gpu: systemMonitorWindow.querySelector("#monitor-gpu-value"),
      gpuJoke: systemMonitorWindow.querySelector("#monitor-gpu-joke"),
      gpuMeter: systemMonitorWindow.querySelector("#monitor-gpu-meter"),
      network: systemMonitorWindow.querySelector("#monitor-network-value"),
      networkJoke: systemMonitorWindow.querySelector("#monitor-network-joke"),
      networkMeter: systemMonitorWindow.querySelector("#monitor-network-meter"),
      processPresence: systemMonitorWindow.querySelector("#monitor-process-presence"),
      processProjects: systemMonitorWindow.querySelector("#monitor-process-projects"),
      ram: systemMonitorWindow.querySelector("#monitor-ram-value"),
      ramJoke: systemMonitorWindow.querySelector("#monitor-ram-joke"),
      ramMeter: systemMonitorWindow.querySelector("#monitor-ram-meter"),
      storage: systemMonitorWindow.querySelector("#monitor-storage-value"),
      storageJoke: systemMonitorWindow.querySelector("#monitor-storage-joke"),
      storageMeter: systemMonitorWindow.querySelector("#monitor-storage-meter"),
      thermal: systemMonitorWindow.querySelector("#monitor-thermal-value"),
      thermalJoke: systemMonitorWindow.querySelector("#monitor-thermal-joke"),
      thermalMeter: systemMonitorWindow.querySelector("#monitor-thermal-meter"),
    }
  : null;
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
let systemMonitorTick = 0;
let systemMonitorBits = 8192;
let systemMonitorState = {
  cpu: 24,
  gpu: 18,
  ram: 13.4,
  thermal: 42,
};

const baseSystemMonitorJokes = {
  cpu: [
    "Calculating how many Bits fit in another Bit.",
    "Briefly considering doing actual work.",
    "Compiling opinions into machine code.",
    "One core is dedicated entirely to overthinking.",
  ],
  gpu: [
    "Rendering one extremely important gradient.",
    "Adding bloom to something nobody can see.",
    "Drawing triangles as fast as legally permitted.",
    "Preparing another frame for the void.",
  ],
  network: [
    "Packets are taking the scenic route.",
    "Downloading additional download indicators.",
    "Negotiating with a router named Linksys.",
    "Uploading confidence at dial-up speed.",
  ],
  ram: [
    "Remembering several tabs you forgot existed.",
    "Holding a thought until the process responds.",
    "Caching one suspiciously large personality.",
    "Memory leak insists it is a water feature.",
  ],
  storage: [
    "Most space is reserved for screenshots named final_final.",
    "Defragmenting a folder full of untitled documents.",
    "The recycle bin is emotionally attached.",
    "Archiving side projects that are definitely almost done.",
  ],
  thermal: [
    "Warm, but not emotionally available.",
    "Fans are whispering encouraging words.",
    "Temperature classified as laptop-adjacent.",
    "Applying thermal paste conceptually.",
  ],
};
const seasonalMonitorJokes = window.BITS_SEASONAL_PROFILE?.monitorJokes ?? {};
const systemMonitorJokes = window.BITS_SEASONAL_PROFILE?.mode === "exclusive"
  ? seasonalMonitorJokes
  : Object.fromEntries(Object.entries(baseSystemMonitorJokes).map(([metric, jokes]) => [
      metric,
      [...jokes, ...(seasonalMonitorJokes[metric] ?? [])],
    ]));

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

function driftMonitorValue(value, minimum, maximum, movement) {
  return Math.min(maximum, Math.max(minimum, value + ((Math.random() - 0.5) * movement)));
}

function setSystemMonitorMeter(element, value) {
  if (element) {
    element.style.width = `${Math.min(100, Math.max(0, value))}%`;
  }
}

function updateSystemMonitor() {
  if (!systemMonitorMetrics) {
    return;
  }

  systemMonitorTick += 1;
  systemMonitorState.cpu = driftMonitorValue(systemMonitorState.cpu, 7, 88, 24);
  systemMonitorState.gpu = driftMonitorValue(
    systemMonitorState.gpu + ((systemMonitorState.cpu - systemMonitorState.gpu) * 0.08),
    4,
    82,
    18,
  );
  systemMonitorState.ram = driftMonitorValue(systemMonitorState.ram, 9.5, 27.5, 2.6);
  systemMonitorState.thermal = driftMonitorValue(
    systemMonitorState.thermal + ((systemMonitorState.cpu - 35) * 0.015),
    37,
    67,
    2.8,
  );
  const download = 2 + (Math.random() * 92);
  const upload = 0.4 + (Math.random() * 18);
  const storageUsed = 37.5;
  systemMonitorBits += Math.round(256 + (systemMonitorState.cpu * 17) + (download * 5));

  systemMonitorMetrics.cpu.textContent = `${Math.round(systemMonitorState.cpu)}%`;
  systemMonitorMetrics.gpu.textContent = `${Math.round(systemMonitorState.gpu)}%`;
  systemMonitorMetrics.ram.textContent = `${systemMonitorState.ram.toFixed(1)} / 32 GB`;
  systemMonitorMetrics.network.textContent = `↓ ${download.toFixed(1)} / ↑ ${upload.toFixed(1)} Mbps`;
  systemMonitorMetrics.storage.textContent = "404.0 GB FREE";
  systemMonitorMetrics.thermal.textContent = `${Math.round(systemMonitorState.thermal)}°C`;
  systemMonitorMetrics.bits.textContent = systemMonitorBits.toLocaleString();
  systemMonitorMetrics.processPresence.textContent = `${Math.max(1, systemMonitorState.cpu * 0.46).toFixed(1)}%`;
  systemMonitorMetrics.processProjects.textContent = `${Math.max(0.5, systemMonitorState.cpu * 0.31).toFixed(1)}%`;

  setSystemMonitorMeter(systemMonitorMetrics.cpuMeter, systemMonitorState.cpu);
  setSystemMonitorMeter(systemMonitorMetrics.gpuMeter, systemMonitorState.gpu);
  setSystemMonitorMeter(systemMonitorMetrics.ramMeter, (systemMonitorState.ram / 32) * 100);
  setSystemMonitorMeter(systemMonitorMetrics.networkMeter, download);
  setSystemMonitorMeter(systemMonitorMetrics.storageMeter, storageUsed);
  setSystemMonitorMeter(systemMonitorMetrics.thermalMeter, ((systemMonitorState.thermal - 30) / 45) * 100);

  Object.entries(systemMonitorJokes).forEach(([metric, jokes], index) => {
    const output = systemMonitorMetrics[`${metric}Joke`];
    if (output) {
      output.textContent = jokes[(systemMonitorTick + index) % jokes.length];
    }
  });
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

updateSystemMonitor();
window.setInterval(updateSystemMonitor, 2200);
applyDesktopWindowUrl();
