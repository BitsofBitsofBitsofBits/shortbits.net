const repositoryUrl = "https://github.com/BitsofBitsofBitsofBits/shortbits.net";
const siteUrl = "https://www.shortbits.net/online/";
const sourceUrl = repositoryUrl;

let links = window.SocialLinks.ordered(window.SocialLinks.initial(document), "personal");

const interfaceThemes = window.BITS_INTERFACE_THEMES ?? [
  { id: "default", name: "DEFAULT", darkColor: "#070b0f", lightColor: "#edf3ef" },
  { id: "aurora", name: "AURORA", darkColor: "#071018", lightColor: "#edf7f5" },
  { id: "cozy-blossom", name: "COZY BLOSSOM", darkColor: "#1c1218", lightColor: "#fff4f1" },
  { id: "mica", name: "MICA", darkColor: "#202124", lightColor: "#eef3f8" },
  { id: "fluent", name: "FLUENT", darkColor: "#101722", lightColor: "#f3f8ff" },
  { id: "midnight-oled", name: "MIDNIGHT OLED", darkColor: "#000000", lightColor: "#f7f7f7" },
  { id: "macos", name: "MACOS", darkColor: "#18181a", lightColor: "#f5f5f7" },
  { id: "terminal", name: "TERMINAL", darkColor: "#000500", lightColor: "#e8f4e8" },
  { id: "vaporwave", name: "VAPORWAVE", darkColor: "#160d2b", lightColor: "#fff0fb" },
  { id: "amber-crt", name: "AMBER CRT", darkColor: "#100900", lightColor: "#fff4d6" },
  { id: "y2k-silver", name: "Y2K SILVER", darkColor: "#252a33", lightColor: "#e8edf4" },
  { id: "cyberpunk", name: "CYBERPUNK", darkColor: "#080712", lightColor: "#f3f000" },
  { id: "dos-blue", name: "DOS BLUE", darkColor: "#0000aa", lightColor: "#d7d7d7" },
  { id: "windows-95", name: "WINDOWS 95", darkColor: "#004c4c", lightColor: "#008080" },
  { id: "solarized", name: "SOLARIZED", darkColor: "#002b36", lightColor: "#fdf6e3" },
  { id: "nord", name: "NORD", darkColor: "#2e3440", lightColor: "#eceff4" },
  { id: "dracula", name: "DRACULA", darkColor: "#282a36", lightColor: "#f8f8f2" },
  { id: "candy-pop", name: "CANDY POP", darkColor: "#25152d", lightColor: "#fff4fb" },
  { id: "rgb", name: "RGB", darkColor: "#090713", lightColor: "#090713" },
  { id: "aero-glass", name: "AERO GLASS", darkColor: "#0d3358", lightColor: "#0d3358" },
  { id: "minebits", name: "MINEBITS", darkColor: "#332719", lightColor: "#dbe8c5" },
  { id: "catppuccin", name: "CATPPUCCIN", darkColor: "#1e1e2e", lightColor: "#eff1f5" },
  { id: "gruvbox", name: "GRUVBOX", darkColor: "#282828", lightColor: "#fbf1c7" },
  { id: "tokyo-night", name: "TOKYO NIGHT", darkColor: "#1a1b26", lightColor: "#e1e2e7" },
  { id: "monokai", name: "MONOKAI", darkColor: "#272822", lightColor: "#fafaf5" },
  { id: "game-bit", name: "GAME BIT", darkColor: "#0f380f", lightColor: "#9bbc0f" },
  { id: "high-contrast", name: "HIGH CONTRAST", darkColor: "#000000", lightColor: "#ffffff" },
  { id: "ocean", name: "DEEP OCEAN", darkColor: "#03141f", lightColor: "#e6f6f8" },
  { id: "coffee", name: "COFFEE SHOP", darkColor: "#1f1510", lightColor: "#f6efe4" },
  { id: "matrix", name: "MATRIX", darkColor: "#000a02", lightColor: "#e9f7ec" },
  { id: "sunset", name: "SUNSET", darkColor: "#1d0f24", lightColor: "#fff1e6" },
];

if (!window.BITS_INTERFACE_THEMES) {
  console.warn("shared/scripts/theme-init.js did not load; using the built-in theme configuration.");
  document.documentElement.dataset.colorScheme = "dark";
  document.documentElement.dataset.interfaceTheme = "default";
}

const messages = window.BITS_MESSAGES;
const activities = window.BITS_ACTIVITIES;
const shutdownMessages = window.BITS_SHUTDOWN_MESSAGES;
const stopCodes = window.BITS_STOP_CODES;

function validateTextOptions(options, name) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error(`${name} must contain at least one entry.`);
  }

  options.forEach((option, index) => {
    if (
      typeof option.text !== "string"
      || option.text.trim() === ""
      || !Number.isFinite(option.weight)
      || option.weight <= 0
      || (option.colorful !== undefined && typeof option.colorful !== "boolean")
      || (option.markup !== undefined && typeof option.markup !== "boolean")
      || (option.author !== undefined && (typeof option.author !== "string"
        || !option.author.trim() || option.author.length > 200))
      || (option.correctedText !== undefined && (typeof option.correctedText !== "string"
        || !option.correctedText.trim() || option.correctedText.length > 2000))
    ) {
      throw new Error(`Invalid entry at ${name}[${index}].`);
    }
  });
}

validateTextOptions(messages, "BITS_MESSAGES");
validateTextOptions(activities, "BITS_ACTIVITIES");

if (
  !Array.isArray(shutdownMessages)
  || shutdownMessages.length === 0
  || shutdownMessages.some((message) => !window.BITS_MESSAGE_TEXT.isMessage(message))
) {
  throw new Error("BITS_SHUTDOWN_MESSAGES must contain at least one message.");
}

if (
  !Array.isArray(stopCodes)
  || stopCodes.length === 0
  || stopCodes.some((code) => typeof code !== "string" || !code.trim())
) {
  throw new Error("BITS_STOP_CODES must contain at least one stop code.");
}

const linkGrid = document.querySelector("#link-grid");
const linkCount = document.querySelector("#link-count");
const typedText = document.querySelector("#typed-text");
const typedAuthor = document.querySelector("#typed-author");
const authorBox = document.querySelector("#message-author-box");
const terminalOutput = document.querySelector("#terminal-output");
const activityText = document.querySelector("#activity-text");
const uptime = document.querySelector("#uptime");
const commandLine = document.querySelector(".command-line");
const interfaceThemeSelect = document.querySelector("#interface-theme-select");
const appMenuBar = document.querySelector("#app-menu-bar");
const appMenus = [...appMenuBar.querySelectorAll(".app-menu")];
const binaryRain = document.querySelector("#binary-rain");
const forbiddenBitDock = document.querySelector("#forbidden-bit-dock");
const interfaceShell = document.querySelector("#interface-shell");
const minimizeButton = document.querySelector("#minimize-button");
const maximizeButton = document.querySelector("#maximize-button");
const fakeDesktop = document.querySelector("#fake-desktop");
const closeButton = document.querySelector("#close-button");
const processTitle = document.querySelector("#process-title");
const statusText = document.querySelector("#status-text");
const shutdownScreen = document.querySelector("#shutdown-screen");
const shutdownCode = document.querySelector("#shutdown-code");
const shutdownMessage = document.querySelector("#shutdown-message");
const rebootButton = document.querySelector("#reboot-button");
const avatarWrap = document.querySelector("#avatar-wrap");
const avatarButton = document.querySelector("#avatar-button");
const avatarReaction = document.querySelector("#avatar-reaction");
const avatarDeparture = document.querySelector("#avatar-departure");
const identityName = document.querySelector("#identity-name");
const redScreen = document.querySelector("#red-screen");
const redScreenProgress = document.querySelector("#red-screen-progress");
const redScreenCountdown = document.querySelector("#red-screen-countdown");
const redScreenMeterFill = document.querySelector("#red-screen-meter-fill");
const interactiveSpotifyArtwork = document.querySelector("#spotify-artwork");
const reportLinks = document.querySelector("#report-links");
const reportCommands = document.querySelector("#report-commands");
const reportAvatar = document.querySelector("#report-avatar");
const reportSecrets = document.querySelector("#report-secrets");
const biosPanel = document.querySelector("#bios-panel");
const biosClose = document.querySelector("#bios-close");
const updatePanel = document.querySelector("#update-panel");
const updateProgress = document.querySelector("#update-progress");
const updateStatus = document.querySelector("#update-status");
const bitsAssistant = document.querySelector("#bits-assistant");
const assistantAnswers = document.querySelectorAll(".assistant-answer");
const cookieNotice = document.querySelector("#cookie-notice");
const cookieDismiss = document.querySelector("#cookie-dismiss");
const rootPanel = document.querySelector("#root-panel");
const rootClose = document.querySelector("#root-close");
const buildLink = document.querySelector("#build-link");
const sourceScanButton = document.querySelector("#source-scan-button");
const sourceScanOutput = document.querySelector("#source-scan-output");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const narrowViewport = window.matchMedia("(max-width: 700px)");
const deviceMemory = navigator.deviceMemory ?? 8;
const logicalProcessors = navigator.hardwareConcurrency ?? 8;
const saveDataEnabled = navigator.connection?.saveData === true;
const constrainedHardware = (
  deviceMemory <= 4
  || logicalProcessors <= 4
  || saveDataEnabled
);

function closeAppMenus(exceptMenu = null) {
  appMenus.forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.open = false;
    }
  });
}

appMenus.forEach((menu) => {
  menu.addEventListener("toggle", () => {
    if (menu.open) {
      closeAppMenus(menu);
    }
  });
});

appMenuBar.addEventListener("click", (event) => {
  if (event.target.closest(".app-menu-popup button, .app-menu-popup a")) {
    closeAppMenus();
  }
});

appMenuBar.addEventListener("change", () => {
  closeAppMenus();
});

appMenuBar.addEventListener("keydown", (event) => {
  const summaries = appMenus.map((menu) => menu.querySelector("summary"));
  const activeSummaryIndex = summaries.indexOf(document.activeElement);

  if (event.key === "Escape") {
    const openMenu = appMenus.find((menu) => menu.open);
    if (openMenu) {
      openMenu.open = false;
      openMenu.querySelector("summary").focus();
      event.preventDefault();
    }
    return;
  }

  if (activeSummaryIndex < 0 || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }

  const direction = event.key === "ArrowRight" ? 1 : -1;
  const nextIndex = (activeSummaryIndex + direction + summaries.length) % summaries.length;
  summaries[nextIndex].focus();
  event.preventDefault();
});

document.addEventListener("pointerdown", (event) => {
  if (!appMenuBar.contains(event.target)) {
    closeAppMenus();
  }
});
let runtimePerformanceLite = sessionStorage.getItem("bits-runtime-performance-lite") === "true";
let performanceLite;
let maximumFallingBits;
let performanceProfileReason = "full effects";
let framePerformanceMonitorState = "idle";

function hasReducedMotionPreference() {
  return (
    document.documentElement.dataset.motion === "reduced"
    || prefersReducedMotion.matches
  );
}

function updatePerformanceProfile() {
  performanceLite = (
    narrowViewport.matches
    || hasReducedMotionPreference()
    || constrainedHardware
    || runtimePerformanceLite
  );
  if (hasReducedMotionPreference()) {
    performanceProfileReason = "reduced motion preference";
  } else if (narrowViewport.matches) {
    performanceProfileReason = "narrow viewport";
  } else if (saveDataEnabled) {
    performanceProfileReason = "data saver";
  } else if (constrainedHardware) {
    performanceProfileReason = "constrained hardware";
  } else if (runtimePerformanceLite) {
    performanceProfileReason = "measured frame performance";
  } else {
    performanceProfileReason = "full effects";
  }
  maximumFallingBits = performanceLite ? 10 : 24;
  document.documentElement.classList.toggle("is-performance-lite", performanceLite);
  document.documentElement.dataset.performanceProfile = performanceLite ? "lite" : "full";

  Array.from(binaryRain.children)
    .slice(maximumFallingBits)
    .forEach((bit) => bit.remove());
}

function monitorFramePerformance() {
  if (
    performanceLite
    || document.hidden
    || framePerformanceMonitorState !== "idle"
  ) {
    return;
  }

  framePerformanceMonitorState = "running";
  const frameTimes = [];
  let previousFrame;

  function sampleFrame(timestamp) {
    if (document.hidden) {
      framePerformanceMonitorState = "idle";
      return;
    }
    if (runtimePerformanceLite) {
      framePerformanceMonitorState = "complete";
      return;
    }

    if (previousFrame !== undefined) {
      const frameTime = timestamp - previousFrame;
      if (frameTime < 120) {
        frameTimes.push(frameTime);
      }
    }
    previousFrame = timestamp;

    if (frameTimes.length < 120) {
      window.requestAnimationFrame(sampleFrame);
      return;
    }

    const averageFrameTime = frameTimes.reduce((total, time) => total + time, 0)
      / frameTimes.length;
    const slowFrameRatio = frameTimes.filter((time) => time > 34).length
      / frameTimes.length;
    framePerformanceMonitorState = "complete";
    if (averageFrameTime > 26 || slowFrameRatio > 0.2) {
      runtimePerformanceLite = true;
      sessionStorage.setItem("bits-runtime-performance-lite", "true");
      updatePerformanceProfile();
    }
  }

  window.requestAnimationFrame(sampleFrame);
}

updatePerformanceProfile();
narrowViewport.addEventListener("change", updatePerformanceProfile);
prefersReducedMotion.addEventListener("change", updatePerformanceProfile);
window.addEventListener("bits:preferences-changed", updatePerformanceProfile);
document.documentElement.classList.toggle("is-page-hidden", document.hidden);
window.setTimeout(monitorFramePerformance, 1200);

let systemOverlayPreviousFocus;
const sessionMetrics = {
  linksOpened: 0,
  commandsEntered: 0,
  avatarIncidents: 0,
  secretsDiscovered: 0,
};
const achievementSystem = window.BITS_ACHIEVEMENTS.initialize({
  onPanelOpen: () => showAvatarContextReaction("[¬_¬] KEEPING RECORDS NOW? CONCERNING."),
  onUnlock: () => {
    sessionMetrics.secretsDiscovered += 1;
  },
});
const achievementCatalog = achievementSystem.catalog;
const unlockedAchievements = achievementSystem.unlocked;
const recordAchievement = achievementSystem.record;
const showAchievement = achievementSystem.show;
const updateAchievementCount = achievementSystem.updateCount;

const rootSequence = [
  "forbidden-bit",
  "meaning-of-life",
  "spotify-vinyl",
  "reboot",
  "avatar-return",
];
let rootSequenceIndex = 0;

function activateRootAccess() {
  document.documentElement.classList.add("is-root-mode");
  systemOverlayPreviousFocus = document.activeElement;
  rootPanel.hidden = false;
  rootClose.focus();
  showAchievement(
    "ROOT ACCESS GRANTED",
    "SECRET SEQUENCE COMPLETE",
    5000,
    "root-access",
  );
  showAvatarContextReaction("[ಠ_ಠ] YOU ABSOLUTELY SHOULD NOT HAVE THAT.");
}

function markRootStep(step) {
  if (step === rootSequence[rootSequenceIndex]) {
    rootSequenceIndex += 1;
    if (rootSequenceIndex === rootSequence.length) {
      rootSequenceIndex = 0;
      activateRootAccess();
    }
    return;
  }

  rootSequenceIndex = step === rootSequence[0] ? 1 : rootSequenceIndex;
}

function openBios() {
  systemOverlayPreviousFocus = document.activeElement;
  biosPanel.hidden = false;
  biosClose.focus();
  showAchievement("BIOS SETTINGS LOCATED", "PRE-BOOT ENVIRONMENT", 3200, "bios");
}

function closeBios() {
  biosPanel.hidden = true;
  if (systemOverlayPreviousFocus instanceof HTMLElement) {
    systemOverlayPreviousFocus.focus();
  }
}

biosClose.addEventListener("click", closeBios);
rootClose.addEventListener("click", () => {
  rootPanel.hidden = true;
  document.documentElement.classList.remove("is-root-mode");
  if (systemOverlayPreviousFocus instanceof HTMLElement) {
    systemOverlayPreviousFocus.focus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !biosPanel.hidden) {
    closeBios();
  } else if (event.key === "Escape" && !rootPanel.hidden) {
    rootClose.click();
  }
});

function activateRare404Card() {
  if (linkGrid.querySelector(".is-fake-404")) {
    return;
  }

  const card = document.createElement("button");
  card.type = "button";
  card.className = "link-card is-fake-404";
  card.style.setProperty("--card-accent", "#ff6d7a");

  const icon = document.createElement("span");
  icon.className = "link-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "404";
  const copy = document.createElement("span");
  copy.className = "link-copy";
  const title = document.createElement("span");
  title.className = "link-title";
  title.textContent = "404";
  const description = document.createElement("span");
  description.className = "link-description";
  description.textContent = "PERSONALITY NOT FOUND";
  const arrow = document.createElement("span");
  arrow.className = "link-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "FIX";

  copy.append(title, description);
  card.append(icon, copy, arrow);
  card.addEventListener("click", () => {
    card.remove();
    linkCount.textContent = `${String(links.length).padStart(2, "0")} NODES`;
    showAchievement(
      "PERSONALITY RESTORED",
      "404 RECOVERY",
      3200,
      "personality-restored",
    );
  }, { once: true });
  linkGrid.append(card);
  linkCount.textContent = `${String(links.length + 1).padStart(2, "0")} NODES`;
}

function renderLinks(allowRare404 = true) {
  linkGrid.replaceChildren(...links.map(row => window.SocialLinks.anchor(row, document, true)));

  linkCount.textContent = `${String(links.length).padStart(2, "0")} NODES`;

  linkGrid.querySelectorAll(".link-card").forEach((card) => {
    const arrow = card.querySelector(".link-arrow");
    const normalArrow = arrow.textContent;
    card.addEventListener("click", () => {
      sessionMetrics.linksOpened += 1;
    });
    card.addEventListener("pointerenter", () => {
      if (Math.random() < 0.01) {
        const rareArrows = [`${normalArrow} probably safe`, `${normalArrow} here goes nothing`, `${normalArrow} follow link`];
        arrow.textContent = rareArrows[Math.floor(Math.random() * rareArrows.length)];
        card.dataset.rareHover = "true";
      }
    });
    card.addEventListener("pointerleave", () => {
      arrow.textContent = normalArrow;
      delete card.dataset.rareHover;
    });
  });

  if (allowRare404 && Math.random() < 0.015) {
    activateRare404Card();
  }
}

const applyTextFormat = window.BITS_MESSAGE_TEXT.applyFormat;

function pickWeightedOption(options) {
  const totalWeight = options.reduce((total, option) => total + option.weight, 0);
  let selection = Math.random() * totalWeight;

  for (const option of options) {
    selection -= option.weight;
    if (selection < 0) {
      return option;
    }
  }

  return options[options.length - 1];
}

const rainbowColors = {
  dark: ["#ff6d7a", "#ff9b62", "#ffcc66", "#66ff9a", "#63d8ff", "#7aa7ff", "#b99aff"],
  light: ["#b4232f", "#a44800", "#746000", "#087a2a", "#006a8e", "#3155a6", "#743aa2"],
};

let currentMessage = window.BITS_MESSAGE_TEXT.snapshot(pickWeightedOption(messages));
let currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(currentMessage).characters;
let currentAuthorCharacters = window.BITS_MESSAGE_TEXT.splitCharacters(currentMessage.author ?? "");
let authorCharacterIndex = 0;
let characterIndex = 0;
let deleting = false;
const typoMessage = {
  text: "the bits are definately working...",
  correctedText: "the bits are definitely working...",
};
let forceTypoMessage = false;
const displayedMessageHistory = [currentMessage];
let displayedMessageHistoryIndex = displayedMessageHistory.length;
let messageTimer;
let correctionTimer;
let activityTimer;
const pausedMessageControls = document.querySelector("#paused-message-controls");
const previousMessageButton = document.querySelector("#message-history-previous");
const nextMessageButton = document.querySelector("#message-history-next");
const accessibleMessage = document.querySelector("#accessible-message");
let accessibleMessageSnapshot;
const changingContentPaused = () => document.documentElement.dataset.pauseContent === "on";

function scheduleMessage(delay) {
  window.clearTimeout(messageTimer);
  if (!changingContentPaused()) messageTimer = window.setTimeout(updateMessage, delay);
}

function scheduleActivity(delay) {
  window.clearTimeout(activityTimer);
  if (!changingContentPaused()) activityTimer = window.setTimeout(updateActivity, delay);
}

function renderCompleteMessage() {
  if (currentMessage.correctedText && !currentMessage.wasCorrected) {
    currentMessage = { ...currentMessage, text: currentMessage.correctedText, wasCorrected: true };
  }
  currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(currentMessage).characters;
  currentAuthorCharacters = window.BITS_MESSAGE_TEXT.splitCharacters(currentMessage.author ?? "");
  characterIndex = currentMessageCharacters.length;
  authorCharacterIndex = currentAuthorCharacters.length;
  deleting = false;
  commandLine.classList.remove("is-correcting");
  window.BITS_MESSAGE_TEXT.render(typedText, currentMessage);
  renderMessageAuthor();
  previousMessageButton.disabled = displayedMessageHistoryIndex <= 0;
}

function syncChangingContent() {
  const paused = changingContentPaused();
  pausedMessageControls.hidden = !paused;
  window.clearTimeout(messageTimer);
  window.clearTimeout(correctionTimer);
  window.clearTimeout(activityTimer);
  activityText.classList.remove("is-changing");
  if (paused) {
    displayedMessageHistoryIndex = Math.min(displayedMessageHistoryIndex, displayedMessageHistory.length - 1);
    renderCompleteMessage();
  } else {
    scheduleMessage(250);
    scheduleActivity(4000 + Math.random() * 4000);
  }
}

function pickNextMessage() {
  if (forceTypoMessage || Math.random() < 0.008) {
    forceTypoMessage = false;
    return window.BITS_MESSAGE_TEXT.snapshot(typoMessage);
  }
  return window.BITS_MESSAGE_TEXT.snapshot(pickWeightedOption(messages));
}

function renderMessageAuthor() {
  if (accessibleMessageSnapshot !== currentMessage) {
    accessibleMessageSnapshot = currentMessage;
    accessibleMessage.textContent = window.BITS_MESSAGE_TEXT.plainText(currentMessage)
      + (currentMessage.author ? ` - ${currentMessage.author}` : "");
  }
  authorBox.hidden = currentAuthorCharacters.length === 0;
  typedAuthor.textContent = currentAuthorCharacters.slice(0, Math.max(0, authorCharacterIndex)).join("");
}

function runTypoCorrection() {
  if (!currentMessage.correctedText) {
    currentMessage = window.BITS_MESSAGE_TEXT.snapshot(typoMessage);
    currentAuthorCharacters = [];
    authorCharacterIndex = 0;
    renderMessageAuthor();
  }
  const correctingMessage = currentMessage;
  const correctedMessage = { ...correctingMessage, text: correctingMessage.correctedText, wasCorrected: true };
  const originalCharacters = window.BITS_MESSAGE_TEXT.prepare(correctingMessage).characters;
  const correctedCharacters = window.BITS_MESSAGE_TEXT.prepare(correctedMessage).characters;
  let sharedLength = 0;
  while (sharedLength < originalCharacters.length && sharedLength < correctedCharacters.length
    && originalCharacters[sharedLength] === correctedCharacters[sharedLength]) sharedLength++;
  commandLine.classList.add("is-correcting");
  window.BITS_MESSAGE_TEXT.render(typedText, correctingMessage, { length: sharedLength, suffix: "_" });
  correctionTimer = window.setTimeout(() => {
    commandLine.classList.remove("is-correcting");
    if (currentMessage !== correctingMessage) {
      scheduleMessage(1600);
      return;
    }
    currentMessage = correctedMessage;
    currentMessageCharacters = correctedCharacters;
    characterIndex = currentMessageCharacters.length;
    window.BITS_MESSAGE_TEXT.render(typedText, currentMessage);
    renderMessageAuthor();
    showAchievement("NOTHING HAPPENED", "TYPO CORRECTION", 1800, "typo-corrected");
    deleting = true;
    scheduleMessage(1600);
  }, 420);
}

function updateMessage() {
  if (changingContentPaused()) {
    renderCompleteMessage();
    return;
  }
  if (document.hidden) {
    scheduleMessage(1000);
    return;
  }

  window.BITS_MESSAGE_TEXT.render(typedText, currentMessage, { length: characterIndex });
  renderMessageAuthor();

  if (deleting) {
    characterIndex = Math.max(-1, characterIndex - 1);
    authorCharacterIndex = Math.max(-1, authorCharacterIndex - 1);
    if (characterIndex < 0 && authorCharacterIndex < 0) {
      deleting = false;
      currentMessage = pickNextMessage();
      displayedMessageHistory.push(currentMessage);
      if (displayedMessageHistory.length > 30) {
        displayedMessageHistory.shift();
      }
      displayedMessageHistoryIndex = displayedMessageHistory.length;
      currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(currentMessage).characters;
      currentAuthorCharacters = window.BITS_MESSAGE_TEXT.splitCharacters(currentMessage.author ?? "");
      characterIndex = 0;
      authorCharacterIndex = 0;
      renderMessageAuthor();
      applyTextFormat(typedText, currentMessage.format);
      scheduleMessage(250 + Math.random() * 500);
      return;
    }
  } else {
    if (characterIndex >= currentMessageCharacters.length && authorCharacterIndex >= currentAuthorCharacters.length) {
      if (currentMessage.correctedText && !currentMessage.wasCorrected) {
        runTypoCorrection();
        return;
      }
      deleting = true;
      scheduleMessage(1400 + Math.random() * 1600);
      return;
    }
    characterIndex = Math.min(currentMessageCharacters.length, characterIndex + 1);
    authorCharacterIndex = Math.min(currentAuthorCharacters.length, authorCharacterIndex + 1);
  }

  const typingDelay = deleting
    ? 18 + Math.random() * 28
    : 35 + Math.random() * 55;
  scheduleMessage(typingDelay);
}

function updateActivity() {
  if (changingContentPaused()) return;
  if (document.hidden) {
    scheduleActivity(2000);
    return;
  }

  activityText.classList.add("is-changing");

  activityTimer = window.setTimeout(() => {
    if (changingContentPaused()) return;
    if (new Date().getHours() === 0) {
      window.BITS_MESSAGE_TEXT.render(activityText, "pretending tomorrow is not approaching...");
      activityText.classList.remove("is-changing");
      scheduleActivity(60000);
      return;
    }
    const activity = pickWeightedOption(activities);
    window.BITS_MESSAGE_TEXT.render(activityText, activity);
    activityText.classList.remove("is-changing");
    scheduleActivity(4000 + Math.random() * 6000);
  }, 150);
}

const startedAt = Date.now();
const uptimeMilestones = new Map([
  [300, "YOU'RE STILL HERE"],
  [600, "PLEASE CONSIDER ANOTHER TAB"],
  [1800, "THIS IS YOUR HOME NOW"],
]);
const reachedUptimeMilestones = new Set();

function updateUptime() {
  if (document.hidden) {
    return;
  }

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  uptime.textContent = `${hours}:${minutes}:${seconds}`;

  uptimeMilestones.forEach((message, milestone) => {
    if (elapsed >= milestone && !reachedUptimeMilestones.has(milestone)) {
      reachedUptimeMilestones.add(milestone);
      showAchievement(message, "UPTIME MILESTONE", 3200, `uptime-${milestone}`);
    }
  });
}

function getForbiddenBitX() {
  const shellWidth = interfaceShell.getBoundingClientRect().width;
  const gutterWidth = Math.max(0, (window.innerWidth - shellWidth) / 2);
  if (gutterWidth < 70) {
    return "36px";
  }

  const gutterInset = 24 + Math.random() * Math.max(1, gutterWidth - 48);
  return `${gutterInset}px`;
}

function releaseBit(forceForbidden = false) {
  if (changingContentPaused()) return;
  const isForbidden = forceForbidden || Math.random() < 0.015;
  if (!isForbidden && binaryRain.childElementCount >= maximumFallingBits) {
    return;
  }
  const bit = document.createElement(isForbidden ? "button" : "span");
  bit.className = "falling-bit";
  bit.textContent = isForbidden ? "2" : Math.random() < 0.5 ? "0" : "1";
  bit.style.setProperty(
    "--bit-x",
    isForbidden ? getForbiddenBitX() : `${Math.random() * 100}%`,
  );
  bit.style.setProperty("--bit-size", `${0.65 + Math.random() * 0.7}rem`);
  bit.style.setProperty(
    "--bit-speed",
    `${isForbidden ? 14 + Math.random() * 4 : 5 + Math.random() * 5}s`,
  );
  bit.style.setProperty("--bit-opacity", `${0.12 + Math.random() * 0.25}`);

  if (isForbidden) {
    const existingForbiddenBit = forbiddenBitDock.querySelector(".is-forbidden");
    if (existingForbiddenBit) {
      return;
    }
    bit.type = "button";
    bit.classList.add("is-forbidden", "is-docked");
    bit.title = "A forbidden non-binary bit";
    bit.setAttribute("aria-label", "Catch the forbidden non-binary bit");
    bit.addEventListener("click", () => {
      showAchievement(
        "NON-BINARY BIT DETECTED",
        "ACHIEVEMENT UNLOCKED",
        3200,
        "forbidden-bit",
      );
      markRootStep("forbidden-bit");
      bit.remove();
    }, { once: true });
    window.setTimeout(() => bit.remove(), 18000);
  } else if (document.documentElement.classList.contains("is-rgb-mode")) {
    applyRgbBitColor(bit);
  }

  if (!isForbidden) {
    bit.addEventListener("animationend", () => bit.remove(), { once: true });
  }
  (isForbidden ? forbiddenBitDock : binaryRain).append(bit);
}

function scheduleNextBit() {
  const delay = performanceLite
    ? 900 + Math.random() * 1200
    : 500 + Math.random() * 900;
  setTimeout(() => {
    if (
      !document.hidden
      && !hasReducedMotionPreference()
      && document.documentElement.dataset.effects !== "off"
    ) {
      releaseBit();
    }
    scheduleNextBit();
  }, delay);
}

let interfaceThemeIndex = Math.max(
  0,
  interfaceThemes.findIndex(
    (theme) => theme.id === document.documentElement.dataset.interfaceTheme,
  ),
);
function hexToRgbString(hexColor) {
  const color = Number.parseInt(hexColor.slice(1), 16);
  return `${color >> 16}, ${(color >> 8) & 255}, ${color & 255}`;
}

function getRgbPalette() {
  const theme = interfaceThemes.find((entry) => entry.id === "rgb");
  const variant = theme?.variants?.find((entry) => entry.id === document.documentElement.dataset.themeVariant);
  return variant?.palette ?? rainbowColors.dark;
}

function applyRgbBitColor(bit) {
  const palette = getRgbPalette();
  const color = palette[Math.floor(Math.random() * palette.length)];
  bit.classList.add("is-rgb-bit");
  bit.style.setProperty("--bit-color", color);
  bit.style.setProperty("--bit-color-rgb", hexToRgbString(color));
}

function setRgbMode(enabled) {
  document.documentElement.classList.toggle("is-rgb-mode", enabled);

  if (!enabled) {
    binaryRain.querySelectorAll(".is-rgb-bit").forEach((bit) => {
      bit.classList.remove("is-rgb-bit");
      bit.style.removeProperty("--bit-color");
      bit.style.removeProperty("--bit-color-rgb");
    });
    return;
  }

  binaryRain.querySelectorAll(".falling-bit:not(.is-forbidden)")
    .forEach(applyRgbBitColor);
}

function updateBrowserThemeColor() {
  const theme = interfaceThemes[interfaceThemeIndex];
  const isLight = document.documentElement.dataset.colorScheme === "light";
  document.querySelector('meta[name="theme-color"]').content = isLight
    ? theme.lightColor
    : theme.darkColor;
}

function applyInterfaceTheme(theme, persist = true) {
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.style.removeProperty("--accent-rgb");
  if (window.BITS_THEME_PREFERENCE?.apply) {
    window.BITS_THEME_PREFERENCE.apply(theme.id);
  } else {
    document.documentElement.dataset.colorScheme = "dark";
    document.documentElement.dataset.interfaceTheme = theme.id;
  }
  setRgbMode(theme.id === "rgb");
  interfaceThemeSelect.value = theme.id;
  if (persist) {
    if (window.BITS_THEME_PREFERENCE) {
      window.BITS_THEME_PREFERENCE.select(theme.id);
    } else {
      localStorage.setItem("bits-interface-theme", theme.id);
    }
  }
  localStorage.removeItem("bits-accent");
  localStorage.removeItem("bits-rgb-mode");
  updateBrowserThemeColor();
}

interfaceThemeSelect.replaceChildren(...(window.BITS_THEME_PREFERENCE?.buildOptions()
  ?? interfaceThemes.map((theme) => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    return option;
  })));
interfaceThemeSelect.value = interfaceThemes[interfaceThemeIndex].id;
interfaceThemeSelect.addEventListener("change", () => {
  const selectedIndex = interfaceThemes.findIndex(
    (theme) => theme.id === interfaceThemeSelect.value,
  );
  if (selectedIndex < 0) {
    throw new Error(`Unknown interface theme: ${interfaceThemeSelect.value}`);
  }
  interfaceThemeIndex = selectedIndex;
  applyInterfaceTheme(interfaceThemes[interfaceThemeIndex]);
  if (interfaceThemes[interfaceThemeIndex].id === "rgb") {
    showAchievement(
      "RGB MODE ENABLED",
      "RGB MODE",
      3200,
      "pride-mode",
    );
    showAvatarContextReaction("[>_<] MY OPTICAL SENSORS OBJECT TO THIS.");
  }
  window.dispatchEvent(new CustomEvent("bits:appearance-changed", {
    detail: {
      label: "INTERFACE THEME",
      value: interfaceThemes[interfaceThemeIndex].name,
    },
  }));
});
const interfaceSchemeSelect = document.querySelector("#interface-scheme-select");
window.BITS_THEME_PREFERENCE?.bindColorSchemeSelect(interfaceSchemeSelect);
window.BITS_THEME_PREFERENCE?.bindVariantSelect?.(document.querySelector("#interface-variant-select"));
window.BITS_THEME_PICKER.bind(interfaceThemeSelect, document.querySelector("#interface-variant-select"));
document.querySelector("#interface-theme-random")?.addEventListener("click", () => {
  const themeId = window.BITS_THEME_PREFERENCE?.pickRandom()
    ?? interfaceThemes[Math.floor(Math.random() * interfaceThemes.length)].id;
  interfaceThemeSelect.value = themeId;
  interfaceThemeSelect.dispatchEvent(new Event("change", { bubbles: true }));
});
window.addEventListener("storage", (event) => {
  const themePreferenceKeys = [
    "bits-interface-theme",
    window.BITS_THEME_PREFERENCE?.choiceKey,
    window.BITS_THEME_PREFERENCE?.dismissalKey,
  ];
  if (!themePreferenceKeys.includes(event.key)) {
    return;
  }
  const themeId = window.BITS_THEME_PREFERENCE?.resolve() ?? event.newValue;
  const selectedIndex = interfaceThemes.findIndex((theme) => theme.id === themeId);
  if (selectedIndex >= 0) {
    interfaceThemeIndex = selectedIndex;
    applyInterfaceTheme(interfaceThemes[interfaceThemeIndex], false);
  }
});

function triggerChaosMode() {
  document.documentElement.classList.add("is-chaos-mode");
  showAchievement("TOO MANY BITS", "MAXIMUM BITS MODE", 5000, "maximum-bits");

  if (!hasReducedMotionPreference()) {
    for (let index = 0; index < 80; index += 1) {
      window.setTimeout(releaseBit, index * 24);
    }
  }

  window.setTimeout(() => {
    document.documentElement.classList.remove("is-chaos-mode");
  }, 10000);
}

const controlSequence = ["minimize", "maximize", "minimize", "close"];
let recentControlSequence = [];
let bootToBios = false;
let previousStopCode;

function pickStopCode() {
  const availableCodes = stopCodes.filter((code) => code !== previousStopCode);
  const code = availableCodes[Math.floor(Math.random() * availableCodes.length)]
    || stopCodes[0];
  previousStopCode = code;
  return code;
}

function recordControl(name) {
  recentControlSequence.push(name);
  recentControlSequence = recentControlSequence.slice(-controlSequence.length);

  if (recentControlSequence.join() === controlSequence.join()) {
    recentControlSequence = [];
    triggerChaosMode();
    return true;
  }

  return false;
}

const desktopSystem = window.BITS_FAKE_DESKTOP.initialize({
  interfaceThemes,
  setRgbMode,
  hasReducedMotionPreference,
  releaseBit,
});
const setFakeDesktopVisible = desktopSystem.setVisible;

minimizeButton.addEventListener("click", () => {
  recordControl("minimize");
  const willMinimize = !interfaceShell.classList.contains("is-minimized");
  interfaceShell.classList.toggle("is-minimized", willMinimize);
  interfaceShell.classList.remove("is-maximized");
  maximizeButton.setAttribute("aria-pressed", "false");
  minimizeButton.setAttribute(
    "aria-label",
    willMinimize ? "Restore interface" : "Minimize interface",
  );
  processTitle.textContent = "~/internet/presence.exe";
  statusText.textContent = "ONLINE";
  setFakeDesktopVisible(willMinimize);
});

maximizeButton.addEventListener("click", () => {
  recordControl("maximize");
  const willMaximize = !interfaceShell.classList.contains("is-maximized");
  interfaceShell.classList.remove("is-minimized");
  interfaceShell.classList.toggle("is-maximized", willMaximize);
  minimizeButton.setAttribute("aria-label", "Minimize interface");
  maximizeButton.setAttribute("aria-pressed", String(willMaximize));
  processTitle.textContent = willMaximize
    ? "~/internet/MAXIMUM_BITS.exe"
    : "~/internet/presence.exe";
  statusText.textContent = willMaximize ? "OVERCLOCKED" : "ONLINE";
  setFakeDesktopVisible(false);

  if (willMaximize && !hasReducedMotionPreference()) {
    for (let index = 0; index < 24; index += 1) {
      setTimeout(releaseBit, index * 25);
    }
  }
});

closeButton.addEventListener("click", () => {
  if (recordControl("close")) {
    interfaceShell.classList.remove("is-minimized", "is-maximized");
    minimizeButton.setAttribute("aria-label", "Minimize interface");
    maximizeButton.setAttribute("aria-pressed", "false");
    processTitle.textContent = "~/internet/MAXIMUM_BITS.exe";
    statusText.textContent = "CHAOS ONLINE";
    setFakeDesktopVisible(false);
    window.setTimeout(() => {
      if (!isIdle) {
        processTitle.textContent = "~/internet/presence.exe";
        statusText.textContent = "ONLINE";
      }
    }, 10000);
    return;
  }

  window.BITS_MESSAGE_TEXT.render(shutdownMessage, shutdownMessages[
    Math.floor(Math.random() * shutdownMessages.length)
  ]);
  shutdownCode.textContent = `STOP CODE: ${pickStopCode()}`;
  reportLinks.textContent = String(sessionMetrics.linksOpened);
  reportCommands.textContent = String(sessionMetrics.commandsEntered);
  reportAvatar.textContent = String(sessionMetrics.avatarIncidents);
  reportSecrets.textContent = String(sessionMetrics.secretsDiscovered);
  interfaceShell.classList.add("is-closing");
  setFakeDesktopVisible(false);
  setTimeout(() => {
    interfaceShell.hidden = true;
    document.body.classList.add("is-shutdown");
    shutdownScreen.hidden = false;
    rebootButton.focus();
  }, 500);
});

document.addEventListener("keydown", (event) => {
  if (!shutdownScreen.hidden && event.key.toLowerCase() === "b") {
    bootToBios = true;
    shutdownMessage.textContent = "B held during reboot. Entering setup...";
  }
});

rebootButton.addEventListener("click", () => {
  shutdownScreen.hidden = true;
  document.body.classList.remove("is-shutdown");
  interfaceShell.hidden = false;
  interfaceShell.classList.remove("is-closing", "is-minimized", "is-maximized");
  minimizeButton.setAttribute("aria-label", "Minimize interface");
  maximizeButton.setAttribute("aria-pressed", "false");
  processTitle.textContent = "~/internet/presence.exe";
  statusText.textContent = "ONLINE";
  setFakeDesktopVisible(false);
  showAchievement(
    "THE INTERNET IS BACK ONLINE",
    "SECOND THOUGHTS",
    2800,
    "reboot",
  );
  window.dispatchEvent(new CustomEvent("bits:death-screen-survived", {
    detail: { screen: "blue" },
  }));
  markRootStep("reboot");
  if (bootToBios) {
    bootToBios = false;
    openBios();
  } else {
    closeButton.focus();
  }
});

const avatarReactions = [
  { reaction: "[•_•]", mood: "" },
  { reaction: null },
  { reaction: null },
  { reaction: "[•‿•] HEY, THAT TICKLES.", mood: "amused" },
  { reaction: null },
  { reaction: "[•_•] STOP IT.", mood: "wary" },
  { reaction: null },
  { reaction: "[ಠ_ಠ] HEY.", mood: "annoyed" },
  { reaction: "[¬_¬] SERIOUSLY?", mood: "annoyed" },
  { reaction: "[>_<] I SAID STOP.", mood: "angry" },
  { reaction: "[╬ಠ益ಠ] LAST WARNING.", mood: "furious" },
];
let avatarReactionIndex = 0;
let avatarReturnPokes = 0;
let avatarHasReturned = false;
let returnedAvatarWarningPending = false;
let avatarContextTimer;
const avatarReturnRefusals = [
  "No.",
  "No. I'm not coming back.",
  "You can't make me.",
  "Nope.",
  "Nuh uh.",
  "This is not a negotiation.",
  "Clicking again will not improve your argument.",
  "...",
  "You are remarkably committed to this.",
  "Fine. But this does not mean we're friends.",
];

function showAvatarContextReaction(message) {
  if (!avatarHasReturned || avatarButton.hidden) {
    return;
  }

  window.clearTimeout(avatarContextTimer);
  avatarReaction.textContent = message;
  avatarButton.dataset.mood = "wary";
  avatarContextTimer = window.setTimeout(() => {
    if (avatarReactionIndex === 0 && !avatarButton.hidden) {
      avatarReaction.textContent = "[•_•]";
      avatarButton.dataset.mood = "";
    }
  }, 3200);
}

avatarButton.addEventListener("click", () => {
  sessionMetrics.avatarIncidents += 1;
  if (returnedAvatarWarningPending) {
    returnedAvatarWarningPending = false;
    showAvatarContextReaction("[¬_¬] WE'RE NOT DOING THIS AGAIN.");
    return;
  }

  if (avatarReactionIndex === avatarReactions.length - 1) {
    avatarWrap.classList.add("is-departing");
    avatarButton.setAttribute("aria-label", "Avatar is storming off");
    showAchievement(
      "THE AVATAR HAS LEFT THE WEBSITE",
      "PERSONAL SPACE VIOLATION",
      4200,
      "personal-space",
    );
    window.setTimeout(() => {
      avatarButton.hidden = true;
      avatarWrap.classList.remove("is-departing");
      avatarWrap.classList.add("has-departed");
      avatarDeparture.hidden = false;
    }, 520);
    return;
  }

  avatarReactionIndex += 1;
  const reaction = avatarReactions[avatarReactionIndex];
  if (reaction.reaction !== null) {
    avatarReaction.textContent = reaction.reaction;
    avatarButton.dataset.mood = reaction.mood;
  }
});

avatarDeparture.addEventListener("click", () => {
  sessionMetrics.avatarIncidents += 1;
  avatarReturnPokes += 1;
  if (avatarReturnPokes <= avatarReturnRefusals.length) {
    avatarDeparture.textContent = avatarReturnRefusals[avatarReturnPokes - 1];
    return;
  }

  avatarReturnPokes = 0;
  avatarReactionIndex = 0;
  avatarDeparture.hidden = true;
  avatarDeparture.textContent = "Fine. Poke the empty box yourself.";
  avatarButton.hidden = false;
  avatarButton.dataset.mood = "";
  avatarButton.setAttribute("aria-label", "Poke the bit avatar");
  avatarReaction.textContent = "[•_•]";
  avatarWrap.classList.remove("has-departed");
  avatarWrap.classList.add("is-returning");
  avatarHasReturned = true;
  returnedAvatarWarningPending = true;
  window.setTimeout(() => avatarWrap.classList.remove("is-returning"), 600);
  showAchievement(
    "THE AVATAR CAME BACK, FOR SOME REASON",
    "RELUCTANT RETURN",
    3600,
    "avatar-return",
  );
  markRootStep("avatar-return");
});

avatarButton.addEventListener("auxclick", (event) => {
  if (event.button !== 1) {
    return;
  }

  event.preventDefault();
  for (let index = 0; index < 28; index += 1) {
    window.setTimeout(releaseBit, index * 20);
  }
  showAchievement("BITS RELEASED", "MIDDLE-CLICK ACCEPTED", 3200, "bits-released");
});

avatarButton.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  showAchievement("ACCESS DENIED", "SECURITY RESPONSE", 3200, "access-denied");
});

let identityHoldTimer;
let identityExpansionTimer;
let heldBitCount = 0;
let didHoldIdentity = false;
let identityClickCount = 0;
let redScreenTimer;
let redScreenPreviousFocus;

function resetIdentityName() {
  const fragments = ["Bits", "of", "Bits", "of", "Bits"];
  identityName.replaceChildren(
    ...fragments.map((fragment, index) => {
      const span = document.createElement("span");
      span.textContent = fragment;
      if (index % 2 === 1) {
        span.className = "dim";
      }
      return span;
    }),
  );
  identityName.classList.remove("is-expanding", "is-collapsed-bits");
  identityName.setAttribute(
    "aria-label",
    "BitsofBitsofBits. Click or hold for more bits.",
  );
}

function recoverFromRedScreen() {
  window.clearInterval(redScreenTimer);
  redScreen.hidden = true;
  document.body.classList.remove("is-red-screen");
  document.title = "BitsofBitsofBits // BITSOFWEBSITE";
  identityClickCount = 0;
  heldBitCount = 0;
  didHoldIdentity = false;
  resetIdentityName();
  showAchievement(
    "BIT OVERFLOW RECOVERED",
    "RED SCREEN SURVIVED",
    3600,
    "red-screen",
  );
  window.dispatchEvent(new CustomEvent("bits:death-screen-survived", {
    detail: { screen: "red" },
  }));
  const recoveryFocus = redScreenPreviousFocus instanceof HTMLElement
    && document.contains(redScreenPreviousFocus)
    && redScreenPreviousFocus !== document.body
    ? redScreenPreviousFocus
    : identityName;
  recoveryFocus.focus();
}

function triggerRedScreen() {
  window.clearTimeout(identityHoldTimer);
  window.clearInterval(identityExpansionTimer);
  redScreenPreviousFocus = document.activeElement;
  let remainingSeconds = 10;
  let progress = 0;
  redScreenProgress.textContent = "0%";
  redScreenCountdown.textContent = String(remainingSeconds);
  redScreenMeterFill.style.width = "0%";
  document.body.classList.add("is-red-screen");
  document.title = "FATAL ERROR // TOO MANY BITS";
  redScreen.hidden = false;
  redScreen.focus();
  redScreenTimer = window.setInterval(() => {
    remainingSeconds -= 1;
    progress = Math.min(100, progress + 10);
    redScreenProgress.textContent = `${progress}%`;
    redScreenCountdown.textContent = String(Math.max(0, remainingSeconds));
    redScreenMeterFill.style.width = `${progress}%`;
    if (remainingSeconds <= 0) {
      recoverFromRedScreen();
    }
  }, 1000);
}

function appendIdentityBits() {
  const separator = document.createElement("span");
  separator.className = "dim";
  separator.textContent = "of";
  const bits = document.createElement("span");
  bits.textContent = "Bits";
  identityName.append(separator, bits);
}

function collapseInfiniteIdentity() {
  window.clearInterval(identityExpansionTimer);
  identityName.replaceChildren(document.createTextNode("Bits²ⁿ"));
  identityName.classList.remove("is-expanding");
  identityName.classList.add("is-collapsed-bits");
  showAchievement(
    "INFINITE BITS COMPRESSED",
    "EXPONENTIAL USERNAME",
    3600,
    "infinite-username",
  );
}

function startIdentityHold() {
  if (identityName.classList.contains("is-collapsed-bits")) {
    return;
  }

  didHoldIdentity = false;
  window.clearTimeout(identityHoldTimer);
  identityHoldTimer = window.setTimeout(() => {
    didHoldIdentity = true;
    heldBitCount = 0;
    identityName.classList.add("is-expanding");
    identityExpansionTimer = window.setInterval(() => {
      appendIdentityBits();
      heldBitCount += 1;
      if (heldBitCount >= 12) {
        collapseInfiniteIdentity();
      }
    }, 140);
  }, 550);
}

function stopIdentityHold() {
  window.clearTimeout(identityHoldTimer);
  window.clearInterval(identityExpansionTimer);
  identityName.classList.remove("is-expanding");
}

function addIdentityBit() {
  appendIdentityBits();
  identityClickCount += 1;
  showAchievement(
    "MORE BITS HAVE BEEN ADDED",
    "ACHIEVEMENT UNLOCKED",
    3200,
    "more-bits",
  );
  if (identityClickCount === 10) {
    window.setTimeout(triggerRedScreen, 260);
  }
}

identityName.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  startIdentityHold();
});
window.addEventListener("pointerup", stopIdentityHold);
identityName.addEventListener("pointercancel", stopIdentityHold);
identityName.addEventListener("keydown", (event) => {
  if ((event.key === " " || event.key === "Enter") && !event.repeat) {
    event.preventDefault();
    startIdentityHold();
  }
});
identityName.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    stopIdentityHold();
    if (!didHoldIdentity) {
      addIdentityBit();
    }
    didHoldIdentity = false;
  }
});

identityName.addEventListener("click", (event) => {
  event.preventDefault();
  if (didHoldIdentity) {
    didHoldIdentity = false;
    return;
  }

  addIdentityBit();
});

let vinylSpeed = 2.4;
interactiveSpotifyArtwork.addEventListener("click", () => {
  vinylSpeed = interactiveSpotifyArtwork.classList.contains("is-spinning")
    ? Math.max(0.45, vinylSpeed * 0.72)
    : 2.4;
  interactiveSpotifyArtwork.classList.add("is-spinning");
  interactiveSpotifyArtwork.style.setProperty("--vinyl-speed", `${vinylSpeed}s`);
  showAchievement(
    vinylSpeed < 2.4 ? "VINYL SPEED INCREASED" : "NOW SPINNING",
    "SPOTIFY DECK",
    1800,
    "spotify-vinyl",
  );
  markRootStep("spotify-vinyl");
});

let updateRunId = 0;

function startFakeUpdate() {
  updateRunId += 1;
  const currentRunId = updateRunId;
  const updateSteps = [
    [0, "Preparing questionable dependencies..."],
    [18, "Downloading one (1) Bit..."],
    [47, "Asking the avatar for permission..."],
    [83, "Compiling personality..."],
    [99, "99% // This is where updates live now."],
    [74, "74% // Found additional uncertainty."],
    [100, "Installed 1 additional Bit. Restart absolutely not required."],
  ];

  updatePanel.hidden = false;
  updateProgress.style.width = "0%";

  updateSteps.forEach(([progress, message], index) => {
    window.setTimeout(() => {
      if (currentRunId !== updateRunId) {
        return;
      }
      updateProgress.style.width = `${progress}%`;
      updateStatus.textContent = message;
      if (progress === 100) {
        showAchievement(
          "ONE ADDITIONAL BIT INSTALLED",
          "SYSTEM UPDATE",
          3200,
          "fake-update",
        );
        window.setTimeout(() => {
          if (currentRunId === updateRunId) {
            updatePanel.hidden = true;
          }
        }, 1600);
      }
    }, index * 520);
  });
}

let gravityTimer;

function setGravityMode(mode) {
  window.clearTimeout(gravityTimer);
  document.documentElement.classList.remove("is-gravity-mode", "is-antigravity-mode");
  document.documentElement.classList.add(
    mode === "gravity" ? "is-gravity-mode" : "is-antigravity-mode",
  );
  showAchievement(
    mode === "gravity" ? "GRAVITY.DLL RESTORED" : "GRAVITY.DLL NOT FOUND",
    "PHYSICS ENGINE",
    3600,
    mode === "gravity" ? "gravity" : "antigravity",
  );
  if (!hasReducedMotionPreference()) {
    for (let index = 0; index < 48; index += 1) {
      window.setTimeout(releaseBit, index * 18);
    }
  }
  gravityTimer = window.setTimeout(() => {
    document.documentElement.classList.remove("is-gravity-mode", "is-antigravity-mode");
  }, 8000);
}

let cursorTrailEnabled = false;
let lastCursorBitAt = 0;

function createCursorBit(clientX, clientY, forceForbidden = false) {
  if (document.querySelectorAll(".cursor-bit").length >= maximumFallingBits) {
    return;
  }

  const bit = document.createElement("span");
  bit.className = "cursor-bit";
  bit.textContent = forceForbidden ? "2" : Math.random() < 0.5 ? "0" : "1";
  bit.style.left = `${clientX + (Math.random() - 0.5) * 14}px`;
  bit.style.top = `${clientY + (Math.random() - 0.5) * 14}px`;
  bit.addEventListener("animationend", () => bit.remove(), { once: true });
  document.body.append(bit);
}

function setCursorTrail(enabled) {
  cursorTrailEnabled = enabled;
  showAchievement(
    enabled ? "CURSOR TRAIL ATTACHED" : "CURSOR TRAIL DETACHED",
    "CURSOR.EXE",
    2600,
    enabled ? "cursor-trail" : null,
  );
}

document.addEventListener("pointermove", (event) => {
  if (!cursorTrailEnabled || performance.now() - lastCursorBitAt < 55) {
    return;
  }
  lastCursorBitAt = performance.now();
  createCursorBit(event.clientX, event.clientY);
}, { passive: true });

document.addEventListener("click", (event) => {
  if (!cursorTrailEnabled) {
    return;
  }
  for (let index = 0; index < 6; index += 1) {
    createCursorBit(event.clientX, event.clientY, index === 5 && Math.random() < 0.2);
  }
});

function translateBinary(binaryInput) {
  const bits = binaryInput.replace(/\s+/g, "");
  if (!/^[012]+$/.test(bits) || bits.length === 0 || bits.length % 8 !== 0) {
    return "BINARY INPUT MUST USE 8-BIT GROUPS";
  }

  const includedForbiddenBit = bits.includes("2");
  const translated = bits
    .match(/.{8}/g)
    .map((byte) => String.fromCharCode(Number.parseInt(byte.replaceAll("2", "0"), 2)))
    .join("");
  return includedForbiddenBit
    ? `${translated} // NON-BINARY INPUT ACCEPTED ANYWAY.`
    : translated;
}

const secretCommandResponses = {
  whoami: "BITS_OF_BITS_OF_BITS // THEY/THEM // PROBABLY HUMAN",
  sudo: "PERMISSION DENIED: NICE TRY",
  meaningoflife: "42 BITS, GIVE OR TAKE",
};

function renderTerminalOutput(title, lines) {
  terminalOutput.textContent = [`> ${title}`, "", ...lines].join("\n");
  terminalOutput.hidden = false;
}

function renderHelpCommand() {
  const hasAchievement = (id) => unlockedAchievements.some((entry) => entry.id === id);
  renderTerminalOutput("help", [
    "PUBLIC COMMANDS",
    "  help       list available processes",
    "  status     inspect this session",
    "  changelog  view recent patches",
    "  source     open the source repository",
    "  share      copy this site's address",
    "  stats      open aggregate site statistics",
    "  files      open FILE_EXPLORER.EXE",
    "  pwd        print virtual working directory",
    "  ls [path]  list virtual files",
    "  cd [path]  change virtual directory",
    "  cat <file> read a virtual file",
    "  clear      clear this output",
    "  whoami     identify the operator",
    "",
    "DISCOVERED / REDACTED",
    `  ${hasAchievement("bios") ? "bios" : "████"}`,
    "  update",
    "  gravity",
    `  ${hasAchievement("antigravity") ? "antigravity" : "███████████"}`,
    `  ${hasAchievement("cursor-trail") ? "cursor.exe" : "██████.███"}`,
    `  ${hasAchievement("binary-translator") ? "binary" : "██████"}`,
    `  ${hasAchievement("fake-system-crash") ? "rm -rf /" : "██ ██ ██"}`,
    "  █████████████",
  ]);
}

function renderDiagnosticsCommand() {
  const spotifyState = document.querySelector("#spotify-widget").dataset.state || "unknown";
  const discoveredCount = achievementCatalog.filter(({ id }) => (
    unlockedAchievements.some((entry) => entry.id === id)
  )).length;
  renderTerminalOutput("status", [
    "BITSOFWEBSITE DIAGNOSTICS",
    `  BUILD: ${buildLink.dataset.commit || "LOCAL"}`,
    `  DISPLAY PROFILE: ${performanceLite ? "LITE" : "FULL"}`,
    `  PROFILE REASON: ${performanceProfileReason.toUpperCase()}`,
    `  INTERFACE THEME: ${interfaceThemes[interfaceThemeIndex].name}`,
    `  RGB PROCESS: ${document.documentElement.classList.contains("is-rgb-mode") ? "ACTIVE" : "IDLE"}`,
    `  SPOTIFY SIGNAL: ${spotifyState.toUpperCase()}`,
    `  ACHIEVEMENTS: ${discoveredCount} / ${achievementCatalog.length}`,
    `  UPTIME: ${uptime.textContent}`,
    `  BITS CONTAINED: ${binaryRain.childElementCount}`,
  ]);
}

function renderChangelogCommand() {
  renderTerminalOutput("changelog", [
    "RECENT PATCHES",
    "  upgrade-5  source tools, build record, deployment automation",
    "  upgrade-1  diagnostics, hints, portfolio, accessibility",
    "  eggs-14    extended avatar refusal protocol",
    "  eggs-13    continuous RGB interpolation",
    "  eggs-12    adaptive low-power rendering",
    "  spotify-6  upstream cooldown protection",
  ]);
}

function openSourceRepository() {
  showAchievement(
    "SOURCE CODE ACCESSED",
    "TRANSPARENCY PROTOCOL",
    3200,
    "view-source",
  );
  window.open(sourceUrl, "_blank", "noopener,noreferrer");
}

async function copySiteUrl() {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(siteUrl);
    } else {
      const copyTarget = document.createElement("textarea");
      copyTarget.value = siteUrl;
      copyTarget.setAttribute("readonly", "");
      copyTarget.style.position = "fixed";
      copyTarget.style.opacity = "0";
      document.body.append(copyTarget);
      copyTarget.select();
      const copied = document.execCommand("copy");
      copyTarget.remove();
      if (!copied) {
        throw new Error("The browser rejected the fallback copy command.");
      }
    }
    showAchievement("URL COPIED TO CLIPBOARD", "> share", 2600);
  } catch (error) {
    console.error("Unable to copy the site URL:", error);
    showAchievement("COPY FAILED // shortbits.net", "> share", 3200);
  }
}

function handleSecretCommand(rawCommand) {
  const command = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
  const argResult = window.BITS_ARG?.handleCommand(command);
  if (argResult?.handled) {
    renderTerminalOutput(argResult.title, argResult.lines);
    return true;
  }

  const filesystemResult = window.BITS_VIRTUAL_FILESYSTEM?.handleCommand(command);

  if (filesystemResult?.handled) {
    renderTerminalOutput(filesystemResult.title, filesystemResult.lines);
    return true;
  }

  if (command === "help") {
    renderHelpCommand();
    return true;
  }

  if (command === "status" || command === "diagnostics") {
    renderDiagnosticsCommand();
    return true;
  }

  if (command === "changelog") {
    renderChangelogCommand();
    return true;
  }

  if (command === "source" || command === "repo") {
    openSourceRepository();
    return true;
  }

  if (command === "share") {
    copySiteUrl();
    return true;
  }

  if (command === "stats") {
    window.BITS_DESKTOP_WINDOWS?.open("stats");
    renderTerminalOutput("stats", [
      "STATS.EXE opened.",
      "Telemetry mode: aggregate counters only.",
    ]);
    return true;
  }

  if (command === "clear") {
    terminalOutput.textContent = "";
    terminalOutput.hidden = true;
    return true;
  }

  if (command === "bios") {
    openBios();
    return true;
  }

  if (command === "update") {
    startFakeUpdate();
    return true;
  }

  if (command === "gravity" || command === "antigravity") {
    setGravityMode(command);
    return true;
  }

  if (command === "cursor.exe") {
    setCursorTrail(!cursorTrailEnabled);
    return true;
  }

  if (command.startsWith("binary ") || /^[012 ]+$/.test(command)) {
    const binaryInput = command.startsWith("binary ") ? command.slice(7) : command;
    showAchievement(translateBinary(binaryInput), "> binary", 5000, "binary-translator");
    return true;
  }

  if (command === "rm -rf /") {
    showAchievement(
      "ERROR: TOO MANY BITS // DIVIDING BY ZERO",
      "SYSTEM FAILURE",
      4200,
      "fake-system-crash",
    );
    interfaceShell.classList.add("is-crashing");
    window.setTimeout(() => interfaceShell.classList.remove("is-crashing"), 800);
    return true;
  }

  const response = secretCommandResponses[command];
  if (!response) {
    showAchievement(`COMMAND NOT FOUND: ${rawCommand.trim()}`, "TERMINAL", 2200);
    return false;
  }

  showAchievement(
    response,
    `> ${command}`,
    4200,
    command === "meaningoflife" ? "meaning-of-life" : null,
  );
  if (command === "meaningoflife") {
    markRootStep("meaning-of-life");
  }
  return true;
}

let commandInput = "";
const commandHistory = [];
let commandHistoryIndex = 0;
const commandSuggestions = [
  "help",
  "trace missing bit",
  "trace status",
  "status",
  "changelog",
  "source",
  "repo",
  "share",
  "stats",
  "files",
  "pwd",
  "ls",
  "ls /etc",
  "cd links",
  "cd ..",
  "cat readme.txt",
  "cat /etc/motd",
  "clear",
  "whoami",
  "bios",
  "update",
  "gravity",
  "antigravity",
  "cursor.exe",
  "binary 01000010 01101001 01110100 01110011",
  "sudo make-me-a-sandwich",
  "git blame avatar",
  "npm install personality",
  "rm -rf /",
];
let autocompleteIndex = 0;
const konamiSequence = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
];
let konamiProgress = 0;

function showPreviousSplash(direction) {
  displayedMessageHistoryIndex = Math.min(
    displayedMessageHistory.length - 1,
    Math.max(0, displayedMessageHistoryIndex + direction),
  );
  const historicalMessage = displayedMessageHistory[displayedMessageHistoryIndex];
  if (!historicalMessage) {
    return;
  }

  currentMessage = window.BITS_MESSAGE_TEXT.snapshot(historicalMessage);
  currentMessageCharacters = window.BITS_MESSAGE_TEXT.prepare(currentMessage).characters;
  characterIndex = currentMessageCharacters.length;
  currentAuthorCharacters = window.BITS_MESSAGE_TEXT.splitCharacters(currentMessage.author ?? "");
  authorCharacterIndex = currentAuthorCharacters.length;
  deleting = true;
  applyTextFormat(typedText, currentMessage.format);
  window.BITS_MESSAGE_TEXT.render(typedText, currentMessage, { length: characterIndex });
  renderMessageAuthor();
  if (changingContentPaused()) renderCompleteMessage();
  showAchievement(window.BITS_MESSAGE_TEXT.plainText(currentMessage), "COMMAND HISTORY", 1800);
}

previousMessageButton.addEventListener("click", () => showPreviousSplash(-1));
nextMessageButton.addEventListener("click", () => {
  if (displayedMessageHistoryIndex < displayedMessageHistory.length - 1) {
    showPreviousSplash(1);
    return;
  }
  currentMessage = pickNextMessage();
  displayedMessageHistory.push(currentMessage);
  if (displayedMessageHistory.length > 30) displayedMessageHistory.shift();
  displayedMessageHistoryIndex = displayedMessageHistory.length - 1;
  renderCompleteMessage();
});
window.addEventListener("bits:preferences-changed", event => {
  if (event.detail?.key && event.detail.key !== "pause-content") return;
  syncChangingContent();
  resetIdleTimer();
});

document.addEventListener("keydown", (event) => {
  if (document.documentElement.dataset.boot === "pending") {
    return;
  }
  const target = event.target;
  const isEditable = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target.isContentEditable;
  if (isEditable) {
    return;
  }
  const completeCommand = event.ctrlKey && event.code === "Space" && !event.metaKey && !event.altKey;
  if (event.defaultPrevented || ((event.ctrlKey || event.metaKey || event.altKey) && !completeCommand)
    || !commandLine.contains(target)) {
    return;
  }
  if (completeCommand && commandInput) {
    event.preventDefault();
    const matches = commandSuggestions.filter(suggestion => suggestion.startsWith(commandInput.toLowerCase()));
    const suggestions = matches.length ? matches : commandSuggestions;
    commandInput = suggestions[autocompleteIndex % suggestions.length];
    autocompleteIndex += 1;
    processTitle.textContent = `> ${commandInput}_`;
    return;
  }

  const expectedKonamiKey = konamiSequence[konamiProgress];
  let matchedKonamiKey = false;
  if (event.key.toLowerCase() === expectedKonamiKey.toLowerCase()) {
    matchedKonamiKey = true;
    konamiProgress += 1;
    if (konamiProgress === konamiSequence.length) {
      konamiProgress = 0;
      commandInput = "";
      processTitle.textContent = "~/internet/presence.exe";
      triggerChaosMode();
    }
  } else {
    konamiProgress = event.key.toLowerCase() === konamiSequence[0].toLowerCase() ? 1 : 0;
  }

  const isHistoryKey = event.key === "ArrowUp" || event.key === "ArrowDown";
  if (matchedKonamiKey && !(isHistoryKey && commandHistory.length > 0)) {
    event.preventDefault();
    return;
  }

  if (!commandInput && commandHistory.length === 0 && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    showPreviousSplash(event.key === "ArrowUp" ? -1 : 1);
    return;
  }

  if (
    (event.key === "ArrowUp" || event.key === "ArrowDown")
    && commandHistory.length > 0
    && (commandInput || !commandLine.matches(":hover"))
  ) {
    event.preventDefault();
    konamiProgress = 0;
    if (event.key === "ArrowUp") {
      commandHistoryIndex = Math.max(0, commandHistoryIndex - 1);
      commandInput = commandHistory[commandHistoryIndex];
    } else {
      commandHistoryIndex = Math.min(commandHistory.length, commandHistoryIndex + 1);
      commandInput = commandHistory[commandHistoryIndex] || "";
    }
    processTitle.textContent = commandInput
      ? `> ${commandInput}_`
      : "~/internet/presence.exe";
    return;
  }

  if (event.key === "Enter" && commandInput.trim()) {
    event.preventDefault();
    commandHistory.push(commandInput);
    commandHistoryIndex = commandHistory.length;
    sessionMetrics.commandsEntered += 1;
    handleSecretCommand(commandInput);
    commandInput = "";
    processTitle.textContent = "~/internet/presence.exe";
    return;
  }

  if (event.key === "Backspace" && commandInput) {
    commandInput = commandInput.slice(0, -1);
    processTitle.textContent = `> ${commandInput}_`;
    return;
  }

  if (
    event.key.length === 1
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && /^[a-zA-Z0-9 ./-]$/.test(event.key)
  ) {
    event.preventDefault();
    commandInput = `${commandInput}${event.key}`.slice(-48);
    processTitle.textContent = `> ${commandInput}_`;
  }
});

let idleTimer;
let assistantTimer;
let isIdle = false;
let avatarRoamFrame = 0;
let avatarRoamState = null;
const idleDelayMs = 180000;
const assistantDelayMs = 90000;
const avatarRoamSpeed = 118;

function showBitsAssistant() {
  if (!bitsAssistant.hidden) {
    return;
  }
  bitsAssistant.hidden = false;
}

assistantAnswers.forEach((button) => {
  button.addEventListener("click", () => {
    bitsAssistant.hidden = true;
    for (let index = 0; index < 36; index += 1) {
      window.setTimeout(releaseBit, index * 22);
    }
    showAchievement(
      button.textContent === "YES"
        ? "BITS SUCCESSFULLY PROVIDED"
        : "BITS PROVIDED REGARDLESS",
      "BITS ASSISTANT",
      3200,
      "bits-assistant",
    );
  });
});

cookieDismiss.addEventListener("click", () => {
  cookieNotice.hidden = true;
  sessionStorage.setItem("bits-cookie-notice-dismissed", "true");
  showAchievement("THE AVATAR REGRETS NOTHING", "COOKIE STATUS", 2600, "cookie-notice");
});

function getAvatarCornerInterval() {
  return 5 + Math.floor(Math.random() * 5);
}

function releaseCornerConfetti(x, y) {
  const colors = ["#ff4f81", "#ffcc33", "#25d9ff", "#7cff6b", "#ad7cff", "#ff7a2f"];
  const horizontalDirection = x < window.innerWidth / 2 ? 1 : -1;
  const verticalDirection = y < window.innerHeight / 2 ? 1 : -1;

  for (let index = 0; index < 64; index += 1) {
    const bit = document.createElement("span");
    const distance = 120 + Math.random() * Math.min(window.innerWidth * 0.72, 760);
    const drop = 90 + Math.random() * Math.min(window.innerHeight * 0.68, 620);
    bit.className = "avatar-corner-confetti";
    bit.textContent = Math.random() < 0.5 ? "0" : "1";
    bit.setAttribute("aria-hidden", "true");
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.color = colors[index % colors.length];
    bit.style.setProperty("--confetti-dx", `${horizontalDirection * distance}px`);
    bit.style.setProperty("--confetti-dy", `${verticalDirection * drop}px`);
    bit.style.setProperty("--confetti-spin", `${(Math.random() - 0.5) * 1080}deg`);
    bit.style.setProperty("--confetti-delay", `${Math.random() * 120}ms`);
    bit.style.setProperty("--confetti-size", `${10 + Math.random() * 13}px`);
    document.body.append(bit);
    window.setTimeout(() => bit.remove(), 1900);
  }
}

function setRandomAvatarDirection(state, cornerX, cornerY) {
  const minAngle = Math.PI / 7;
  const maxAngle = Math.PI / 2 - minAngle;
  const angle = minAngle + Math.random() * (maxAngle - minAngle);
  state.velocityX = Math.cos(angle) * avatarRoamSpeed * (cornerX === 0 ? 1 : -1);
  state.velocityY = Math.sin(angle) * avatarRoamSpeed * (cornerY === 0 ? 1 : -1);
}

function aimAvatarNearCorner(state, hitX, hitY, maxX, maxY) {
  const exactCorner = Math.random() < 0.12;
  const missOffset = exactCorner ? 0 : 8 + Math.random() * 34;
  const horizontalOffset = Math.min(missOffset, maxX / 2);
  const verticalOffset = Math.min(missOffset, maxY / 2);
  const targetX = hitX
    ? (state.x === 0 ? maxX : 0)
    : (Math.random() < 0.5 ? horizontalOffset : maxX - horizontalOffset);
  const targetY = hitY
    ? (state.y === 0 ? maxY : 0)
    : (Math.random() < 0.5 ? verticalOffset : maxY - verticalOffset);
  const distanceX = targetX - state.x;
  const distanceY = targetY - state.y;
  const distance = Math.hypot(distanceX, distanceY);

  if (distance === 0) {
    return;
  }

  state.velocityX = (distanceX / distance) * avatarRoamSpeed;
  state.velocityY = (distanceY / distance) * avatarRoamSpeed;
  state.isCornerBound = true;
}

function animateAvatarRoam(timestamp) {
  const state = avatarRoamState;
  if (!state || !isIdle) {
    return;
  }

  const avatarRect = avatarButton.getBoundingClientRect();
  const maxX = Math.max(0, window.innerWidth - avatarRect.width);
  const maxY = Math.max(0, window.innerHeight - avatarRect.height);
  const deltaSeconds = state.lastTimestamp
    ? Math.min((timestamp - state.lastTimestamp) / 1000, 0.05)
    : 0;
  state.lastTimestamp = timestamp;
  state.x += state.velocityX * deltaSeconds;
  state.y += state.velocityY * deltaSeconds;

  const hitX = state.x <= 0 || state.x >= maxX;
  const hitY = state.y <= 0 || state.y >= maxY;

  if (hitX) {
    state.x = Math.max(0, Math.min(maxX, state.x));
    state.velocityX *= -1;
  }
  if (hitY) {
    state.y = Math.max(0, Math.min(maxY, state.y));
    state.velocityY *= -1;
  }

  if (hitX || hitY) {
    if (hitX && hitY) {
      const cornerX = state.x === 0 ? 0 : window.innerWidth;
      const cornerY = state.y === 0 ? 0 : window.innerHeight;
      releaseCornerConfetti(cornerX, cornerY);
      setRandomAvatarDirection(state, state.x, state.y);
      state.collisionsUntilCornerAttempt = getAvatarCornerInterval();
      state.isCornerBound = false;
    } else if (state.isCornerBound) {
      state.collisionsUntilCornerAttempt = getAvatarCornerInterval();
      state.isCornerBound = false;
    } else if (!state.isCornerBound) {
      state.collisionsUntilCornerAttempt -= 1;
      if (state.collisionsUntilCornerAttempt <= 0) {
        aimAvatarNearCorner(state, hitX, hitY, maxX, maxY);
      }
    }
  }

  avatarButton.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.velocityX > 0 ? 3 : -3}deg)`;
  avatarRoamFrame = window.requestAnimationFrame(animateAvatarRoam);
}

function startAvatarRoam() {
  const avatarRect = avatarButton.getBoundingClientRect();
  const maxX = Math.max(0, window.innerWidth - avatarRect.width);
  const maxY = Math.max(0, window.innerHeight - avatarRect.height);
  const startX = Math.max(0, Math.min(avatarRect.left, maxX));
  const startY = Math.max(0, Math.min(avatarRect.top, maxY));
  const angle = Math.PI / 5;
  avatarRoamState = {
    x: startX,
    y: startY,
    velocityX: Math.cos(angle) * avatarRoamSpeed,
    velocityY: -Math.sin(angle) * avatarRoamSpeed,
    lastTimestamp: 0,
    collisionsUntilCornerAttempt: getAvatarCornerInterval(),
    isCornerBound: false,
  };
  avatarButton.classList.add("is-screen-roaming");
  document.body.append(avatarButton);
  avatarRoamFrame = window.requestAnimationFrame(animateAvatarRoam);
}

function stopAvatarRoam() {
  window.cancelAnimationFrame(avatarRoamFrame);
  avatarRoamFrame = 0;
  avatarRoamState = null;
  avatarButton.classList.remove("is-screen-roaming");
  avatarButton.style.removeProperty("transform");
}

function enterIdleMode() {
  if (changingContentPaused() || isIdle || avatarWrap.classList.contains("has-departed")) {
    return;
  }

  isIdle = true;
  avatarWrap.classList.add("is-idle");
  if (!hasReducedMotionPreference()) {
    if (fakeDesktop.hidden) {
      startAvatarRoam();
    } else {
      window.BitsDesktopScreensaver.start();
    }
  }
  statusText.textContent = "AFK?";
  processTitle.textContent = "~/internet/avatar_escape.exe";
  showAchievement(
    "THE AVATAR HAS LEFT ITS BOX",
    "IDLE PROCESS",
    4200,
    "avatar-escape",
  );
}

function resetIdleTimer() {
  window.clearTimeout(idleTimer);
  window.clearTimeout(assistantTimer);
  if (isIdle) {
    isIdle = false;
    stopAvatarRoam();
    window.BitsDesktopScreensaver.stop();
    avatarWrap.insertBefore(avatarButton, avatarWrap.querySelector(".avatar-shadow"));
    avatarWrap.classList.remove("is-idle");
    statusText.textContent = "ONLINE";
    processTitle.textContent = "~/internet/presence.exe";
  }
  if (!changingContentPaused()) {
    assistantTimer = window.setTimeout(showBitsAssistant, assistantDelayMs);
    idleTimer = window.setTimeout(enterIdleMode, idleDelayMs);
  }
}

["pointerdown", "keydown", "scroll"].forEach((eventName) => {
  window.addEventListener(eventName, resetIdleTimer, { passive: true });
});

window.addEventListener("pointermove", () => {
  if (isIdle) {
    resetIdleTimer();
  }
}, { passive: true });

document.addEventListener("visibilitychange", () => {
  document.documentElement.classList.toggle("is-page-hidden", document.hidden);
  if (document.hidden) {
    binaryRain.replaceChildren();
  } else {
    updateUptime();
    monitorFramePerformance();
  }
});

let inspectMessageShown = false;
let resizeTimer;

function checkForInspection() {
  const horizontalGap = window.outerWidth - window.innerWidth;
  const verticalGap = window.outerHeight - window.innerHeight;
  if (
    !inspectMessageShown
    && (horizontalGap > 180 || verticalGap > 250 || window.innerWidth <= 520)
  ) {
    inspectMessageShown = true;
    showAchievement(
      "NICE TRY. THE BITS HAVE ALREADY BEEN INSPECTED.",
      "DEVELOPER DETECTED",
      4200,
      "inspect-bits",
    );
  }
}

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(checkForInspection, 250);
});

const announcedTemporalEggs = new Set();

function applyTemporalEggs(now = new Date()) {
  const isMidnight = now.getHours() === 0;
  const isFridayThirteen = now.getDay() === 5 && now.getDate() === 13;
  const isBirthday = now.getMonth() === 5 && now.getDate() === 26;
  const wasMidnight = avatarWrap.classList.contains("is-sleepy");
  const wasFridayThirteen = document.documentElement.classList.contains(
    "is-friday-thirteen",
  );

  avatarWrap.classList.toggle("is-sleepy", isMidnight);
  document.documentElement.classList.toggle("is-friday-thirteen", isFridayThirteen);
  document.documentElement.classList.toggle("is-birthday", isBirthday);
  if (isFridayThirteen) {
    document.documentElement.style.setProperty("--accent", "#ff3e4d");
    document.documentElement.style.setProperty("--accent-rgb", "255, 62, 77");
  } else if (wasFridayThirteen) {
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-rgb");
  }

  if (isMidnight) {
    activityText.textContent = "pretending tomorrow is not approaching...";
  } else if (wasMidnight) {
    activityText.textContent = "system back online...";
  }
  if (isFridayThirteen && !announcedTemporalEggs.has("friday-thirteen")) {
    announcedTemporalEggs.add("friday-thirteen");
    showAchievement(
      "FRIDAY THE 13TH PROTOCOL ACTIVE",
      "OMINOUS DATE DETECTED",
      4200,
      "friday-thirteen",
    );
  }
  if (isBirthday && !announcedTemporalEggs.has("birthday")) {
    announcedTemporalEggs.add("birthday");
    showAchievement(
      "HAPPY BIRTHDAY, CALEB!",
      "JUNE 26 // BIRTHDAY PROTOCOL",
      5000,
      `birthday-${now.getFullYear()}`,
    );
    if (!hasReducedMotionPreference()) {
      for (let index = 0; index < 80; index += 1) {
        window.setTimeout(releaseBit, index * 24);
      }
    }
  }
}

console.log(
  "%cOh, hello developer.%c\nPlease do not inspect the bits too closely.",
  "color:#66ff9a;font-weight:bold;font-size:14px",
  "color:inherit",
);

window.BITS_EASTER_EGGS = {
  activateRare404Card,
  applyTemporalEggs,
  checkForInspection,
  enterIdleMode,
  handleSecretCommand,
  markRootStep,
  openBios,
  releaseForbiddenBit: () => releaseBit(true),
  runTypoCorrection,
  setCursorTrail,
  setGravityMode,
  setRgbMode,
  showBitsAssistant,
  showAchievement,
  startFakeUpdate,
  triggerTypoMessage: () => {
    forceTypoMessage = true;
  },
  triggerChaosMode,
};

updateAchievementCount();
renderLinks();
window.SocialLinks.load().then(rows => {
  links = window.SocialLinks.ordered(rows, "personal");
  renderLinks(false);
}).catch(error => {
  console.error("Unable to refresh social links; retaining saved links:", error);
  linkCount.textContent = `${String(links.length).padStart(2, "0")} NODES (OFFLINE)`;
});
document.querySelectorAll(".featured-project-actions a").forEach((link) => {
  link.addEventListener("click", () => {
    sessionMetrics.linksOpened += 1;
    if (link.matches("[data-source-link]")) {
      showAchievement(
        "SOURCE CODE ACCESSED",
        "TRANSPARENCY PROTOCOL",
        3200,
        "view-source",
      );
    }
  });
});

const sillySourcePaths = [
  "C:\\BITS\\BITS\\MORE_BITS\\probably-final.js",
  "/dev/null/but-louder",
  "~/projects/definitely-not-production/",
  "A:\\DO_NOT_INSERT_DISC_47",
  "cloud://somewhere-over-the-rainbow.css",
  "C:\\Users\\Caleb\\Desktop\\new-folder-final-FINAL-2\\",
  "/usr/share/misc/assorted-bits/",
  "ram://temporarily-important/do-not-unplug.js",
  "recycle-bin://that-one-working-version/",
  "quantum://file-exists-and-does-not-exist.json",
  "minecraft://redstone/website-backup/",
  "void://please-hold/",
];

sourceScanButton.addEventListener("click", async () => {
  sourceScanButton.disabled = true;
  sourceScanButton.textContent = "SCANNING...";

  const paths = hasReducedMotionPreference()
    ? sillySourcePaths.slice(0, 3)
    : sillySourcePaths;

  for (const [index, path] of paths.entries()) {
    const progress = Math.round(((index + 1) / paths.length) * 94);
    sourceScanOutput.textContent = `[${String(progress).padStart(2, "0")}%] CHECKING ${path}`;
    await new Promise((resolve) => window.setTimeout(
      resolve,
      hasReducedMotionPreference() ? 500 : 620,
    ));
  }

  sourceScanOutput.textContent = "[99%] COUNTING LOOSE BITS...";
  await new Promise((resolve) => window.setTimeout(
    resolve,
    hasReducedMotionPreference() ? 500 : 900,
  ));
  sourceScanOutput.textContent = "SCAN COMPLETE: 0 normal files, 100% Bits.";
  sourceScanButton.textContent = "BROWSE AGAIN";
  sourceScanButton.disabled = false;
});

async function loadBuildMetadata() {
  if (window.location.protocol === "file:") {
    return;
  }

  try {
    const response = await fetch("/build-info.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Build metadata returned HTTP ${response.status}.`);
    }
    const metadata = await response.json();
    if (
      typeof metadata.commit !== "string"
      || !/^[0-9a-f]{7,40}$/i.test(metadata.commit)
      || typeof metadata.builtAt !== "string"
    ) {
      throw new Error("Build metadata is malformed.");
    }
    const builtAt = new Date(metadata.builtAt);
    if (Number.isNaN(builtAt.getTime())) throw new Error("Build timestamp is malformed.");
    const shortCommit = metadata.commit.slice(0, 7);
    buildLink.textContent = `BUILD ${shortCommit.toUpperCase()}`;
    buildLink.href = repositoryUrl;
    buildLink.title = `Deployed ${builtAt.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}`;
    buildLink.dataset.commit = shortCommit.toUpperCase();
  } catch (error) {
    console.warn("Unable to load build metadata:", error);
  }
}

applyInterfaceTheme(interfaceThemes[interfaceThemeIndex], false);
window.BITS_MESSAGE_TEXT.render(typedText, currentMessage, { length: characterIndex });
renderMessageAuthor();
applyTextFormat(typedText, currentMessage.format);
document.querySelector("#year").textContent = new Date().getFullYear();
loadBuildMetadata();
setInterval(updateUptime, 1000);
syncChangingContent();
applyTemporalEggs();
setInterval(applyTemporalEggs, 60000);

if (sessionStorage.getItem("bits-cookie-notice-dismissed") !== "true") {
  setTimeout(() => {
    cookieNotice.hidden = false;
  }, 7000);
}

scheduleNextBit();
resetIdleTimer();
