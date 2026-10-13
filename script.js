const repositoryUrl = "https://github.com/BitsofBitsofBitsofBits/shortbits.net";
const siteUrl = "https://www.shortbits.net/";
const sourceUrl = repositoryUrl;

const links = [
  {
    label: "GITHUB",
    description: "Tiny Bits Production Factory",
    url: "https://github.com/BitsofBitsofBitsofBits",
    icon: "GH",
    iconPath: "images/github.svg",
    color: "#66ff9a",
  },
  {
    label: "PROJECTS",
    description: "Things that escaped localhost",
    url: "https://github.com/BitsofBitsofBitsofBits?tab=repositories",
    icon: "01",
    color: "#63d8ff",
  },
  {
    label: "BLUESKY",
    description: "Flying blue Bits in the Sky",
    url: "https://bsky.app/profile/shortbits.net",
    icon: "BS",
    iconPath: "images/bluesky.svg",
    color: "#7aa7ff",
  },
  {
    label: "YOUTUBE",
    description: "Occasionally moving pixels",
    url: "https://www.youtube.com/@BitsofBitsofBits",
    icon: "YT",
    iconPath: "images/youtube.svg",
    color: "#ff6d7a",
  },
  {
    label: "TWITCH",
    description: "Sometimes my Bits Twitch a little.",
    url: "https://www.twitch.tv/bitsofbitsofbits",
    icon: "TV",
    iconPath: "images/twitch.svg",
    color: "#b99aff",
  },
  {
    label: "DISCORD",
    description: "Wumpus stole my bits :(",
    url: "https://discord.com/users/202220288459538442",
    icon: "DC",
    iconPath: "images/discord.svg",
    color: "#5865f2",
  },
  {
    label: "LINKEDIN",
    description: "Professional Bits",
    url: "https://www.linkedin.com/in/calebkmasters/",
    icon: "IN",
    iconPath: "images/linkedin.svg",
    color: "#0a66c2",
  },
  {
    label: "Spotify",
    description: "Musical Bits",
    url: "https://open.spotify.com/user/22fainfo6ycgibjw5xlhmp3ba",
    icon: "SP",
    iconPath: "images/spotify.svg",
    color: "#1db954",
  },
  { label: "Facebook",
    description: "Bits with a book full of faces",
    url: "https://www.facebook.com/calebkmasters",
    icon: "FB",
    iconPath: "images/facebook.svg",
    color: "#1877f2",
  },
  {
    label: "REDDIT",
    description: "Bits in the hivemind",
    url: "https://www.reddit.com/user/BitsofBitsofBits/",
    icon: "RD",
    iconPath: "images/reddit.svg?v=reddit-1",
    color: "#ff4500",
  },
];

const themes = window.BITS_THEMES ?? [
  {
    name: "GREEN",
    dark: { accent: "#66ff9a", rgb: "102, 255, 154" },
    light: { accent: "#08783e", rgb: "8, 120, 62" },
  },
  {
    name: "CYAN",
    dark: { accent: "#63d8ff", rgb: "99, 216, 255" },
    light: { accent: "#006f8f", rgb: "0, 111, 143" },
  },
  {
    name: "VIOLET",
    dark: { accent: "#b99aff", rgb: "185, 154, 255" },
    light: { accent: "#6946ad", rgb: "105, 70, 173" },
  },
  {
    name: "AMBER",
    dark: { accent: "#ffcc66", rgb: "255, 204, 102" },
    light: { accent: "#8a5b00", rgb: "138, 91, 0" },
  },
];
const interfaceThemes = window.BITS_INTERFACE_THEMES ?? [
  { id: "default", name: "DEFAULT", darkColor: "#070b0f", lightColor: "#edf3ef" },
  { id: "aurora", name: "AURORA", darkColor: "#071018", lightColor: "#edf7f5" },
  { id: "cozy-blossom", name: "COZY BLOSSOM", darkColor: "#1c1218", lightColor: "#fff4f1" },
  { id: "mica", name: "MICA", darkColor: "#202124", lightColor: "#eef3f8" },
  { id: "fluent", name: "FLUENT", darkColor: "#101722", lightColor: "#f3f8ff" },
  { id: "midnight-oled", name: "MIDNIGHT OLED", darkColor: "#000000", lightColor: "#f7f7f7" },
  { id: "macos", name: "MACOS", darkColor: "#18181a", lightColor: "#f5f5f7" },
  { id: "terminal", name: "TERMINAL", darkColor: "#000500", lightColor: "#e8f4e8" },
];

if (!window.BITS_THEMES) {
  console.warn("theme-init.js did not load; using the built-in theme configuration.");
  const storedScheme = localStorage.getItem("bits-color-scheme");
  document.documentElement.dataset.colorScheme = storedScheme === "light"
    || storedScheme === "dark"
    ? storedScheme
    : window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
}
if (!window.BITS_INTERFACE_THEMES) {
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
  || shutdownMessages.some((message) => typeof message !== "string" || !message.trim())
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
const terminalOutput = document.querySelector("#terminal-output");
const activityText = document.querySelector("#activity-text");
const uptime = document.querySelector("#uptime");
const commandLine = document.querySelector(".command-line");
const interfaceThemeSelect = document.querySelector("#interface-theme-select");
const accentSelect = document.querySelector("#accent-select");
const modeButton = document.querySelector("#mode-button");
const modeName = document.querySelector("#mode-name");
const binaryRain = document.querySelector("#binary-rain");
const forbiddenBitDock = document.querySelector("#forbidden-bit-dock");
const interfaceShell = document.querySelector("#interface-shell");
const minimizeButton = document.querySelector("#minimize-button");
const maximizeButton = document.querySelector("#maximize-button");
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
const interactiveSpotifyArtwork = document.querySelector("#spotify-artwork");
const achievement = document.querySelector("#achievement");
const achievementLabel = document.querySelector("#achievement-label");
const achievementMessage = document.querySelector("#achievement-message");
const achievementsButton = document.querySelector("#achievements-button");
const achievementCount = document.querySelector("#achievement-count");
const achievementsPanel = document.querySelector("#achievements-panel");
const achievementsClose = document.querySelector("#achievements-close");
const achievementsEmpty = document.querySelector("#achievements-empty");
const achievementsList = document.querySelector("#achievements-list");
const achievementsProgress = document.querySelector("#achievements-progress");
const achievementsExport = document.querySelector("#achievements-export");
const achievementsReset = document.querySelector("#achievements-reset");
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

let achievementTimer;
let achievementsPreviousFocus;
let systemOverlayPreviousFocus;
const achievementStorageKey = "bits-achievements";
const visitCountKey = "bits-visit-count";
const storedVisitCount = Number.parseInt(localStorage.getItem(visitCountKey) || "0", 10);
const visitCount = (Number.isFinite(storedVisitCount) ? storedVisitCount : 0) + 1;
localStorage.setItem(visitCountKey, String(visitCount));
const achievementCatalog = [
  { id: "forbidden-bit", hints: ["One Bit is not like the others.", "Watch below the footer.", "Catch the forbidden 2."] },
  { id: "meaning-of-life", hints: ["The terminal accepts questions.", "Some answers are universal.", "Type meaningoflife."] },
  { id: "spotify-vinyl", hints: ["Music can go in circles.", "The album art is interactive.", "Spin the Spotify artwork."] },
  { id: "reboot", hints: ["Every shutdown deserves a recovery.", "Close the internet, then reconsider.", "Use the close button and reboot."] },
  { id: "avatar-return", hints: ["Some departures are temporary.", "Persistence may annoy the empty box.", "Convince the avatar to return."] },
  { id: "root-access", hints: ["Five discoveries form one sequence.", "Follow the Bits all the way down.", "Complete the ROOT ACCESS chain in order."] },
  { id: "bios", hints: ["Computers have opinions before booting.", "Try a pre-boot command.", "Type bios, or hold B while rebooting."] },
  { id: "achievement-checker", hints: ["This panel notices repeat visitors.", "Check your progress more than once.", "Open achievements three times."] },
  { id: "personality-restored", hints: ["A missing page may appear unexpectedly.", "A rare extra destination needs repair.", "Fix the temporary 404 card."] },
  { id: "typo-corrected", hints: ["Even the splash text makes mistakes.", "Watch for a rare spelling problem.", "Wait for and observe the typo correction."] },
  { id: "uptime-300", hints: ["Patience is measurable.", "Stay for at least five minutes.", "Reach 00:05:00 uptime."] },
  { id: "uptime-600", hints: ["The tab is becoming concerned.", "Ten minutes is a long time here.", "Reach 00:10:00 uptime."] },
  { id: "uptime-1800", hints: ["Perhaps this is your home now.", "Thirty minutes should do it.", "Reach 00:30:00 uptime."] },
  { id: "pride-mode", hints: ["The accent control contains more than solid colors.", "Inspect the accent dropdown.", "Select RGB Mode."] },
  { id: "maximum-bits", hints: ["Window controls can be sequenced.", "Minimize and maximize with intent.", "Use minimize, maximize, minimize, close."] },
  { id: "personal-space", hints: ["The avatar has boundaries.", "Poke it considerably more than once.", "Keep poking until the avatar leaves."] },
  { id: "bits-released", hints: ["Not every click is a left click.", "The avatar understands a middle click.", "Middle-click the avatar."] },
  { id: "access-denied", hints: ["The avatar guards its context.", "Try asking it for a menu.", "Right-click the avatar."] },
  { id: "infinite-username", hints: ["The username can contain more username.", "Hold the repeated name.", "Press and hold BitsofBitsofBits."] },
  { id: "more-bits", hints: ["Rapid repetition reveals more.", "The username responds to impatient clicking.", "Triple-click BitsofBitsofBits."] },
  { id: "fake-update", hints: ["Everything needs an update eventually.", "The terminal knows update.", "Type update."] },
  { id: "gravity", hints: ["Physics is configurable.", "Restore a familiar force.", "Type gravity."] },
  { id: "antigravity", hints: ["Physics is optional.", "Try removing a familiar force.", "Type antigravity."] },
  { id: "cursor-trail", hints: ["A process can follow your pointer.", "Try running a suspicious executable.", "Type cursor.exe."] },
  { id: "binary-translator", hints: ["The terminal speaks in eight-bit groups.", "01000010 begins something familiar.", "Type binary followed by 8-bit bytes."] },
  { id: "fake-system-crash", hints: ["A famously dangerous command is harmless here.", "Try deleting absolutely everything.", "Type rm -rf /."] },
  { id: "view-source", hints: ["The source is not actually classified.", "The terminal can open the repository.", "Type source or repo."] },
  { id: "page-not-found", hints: ["Not every route contains Bits.", "An actual missing page has its own reward.", "Visit a path that does not exist."] },
  { id: "window-shopper", hints: ["Some processes prefer their own space.", "Look for OPEN and POP OUT controls.", "Open all five mini-window types."] },
  { id: "bits-assistant", hints: ["Help arrives after prolonged hesitation.", "Remain inactive for a while.", "Wait for the Bits Assistant."] },
  { id: "cookie-notice", hints: ["Someone ate the compliance mechanism.", "A delayed notice appears below the site.", "Dismiss the fake cookie notice."] },
  { id: "avatar-escape", hints: ["Idle processes may wander.", "Leave the page alone for three minutes.", "Trigger avatar idle mode."] },
  { id: "inspect-bits", hints: ["The Bits dislike close inspection.", "A certain browser panel changes the viewport.", "Open developer tools or resize dramatically."] },
  { id: "friday-thirteen", hints: ["The calendar can alter the protocol.", "An ominous date is required.", "Visit on Friday the 13th."] },
  { id: "snake-byte", hints: ["An old process is hungry.", "Open ARCADE.EXE.", "Feed the Snake at least one byte."] },
  { id: "mine-clear", hints: ["Some Bits are dangerously buried.", "Open ARCADE.EXE.", "Clear the Minesweeper field."] },
  { id: "bitsweeper-defender", hints: ["The firewall is under linguistic attack.", "Open ARCADE.EXE.", "Type at least one falling target."] },
  { id: "tetris-line", hints: ["Order can emerge from falling blocks.", "Open ARCADE.EXE.", "Complete a line in Tetris."] },
  { id: `birthday-${new Date().getFullYear()}`, hints: ["One date belongs to Caleb.", "Look near the end of June.", "Visit on June 26."] },
];
const sessionMetrics = {
  linksOpened: 0,
  commandsEntered: 0,
  avatarIncidents: 0,
  secretsDiscovered: 0,
};

function loadUnlockedAchievements() {
  let storedAchievements;

  try {
    storedAchievements = localStorage.getItem(achievementStorageKey);
  } catch (error) {
    console.error("Unable to read saved achievements:", error);
    return [];
  }

  if (!storedAchievements) {
    return [];
  }

  let parsedAchievements;
  try {
    parsedAchievements = JSON.parse(storedAchievements);
  } catch (error) {
    console.error("Saved achievements contain invalid JSON:", error);
    return [];
  }

  if (!Array.isArray(parsedAchievements)) {
    console.error("Saved achievements must be an array.");
    return [];
  }

  const validAchievements = parsedAchievements.filter((entry) => (
    entry
    && typeof entry.id === "string"
    && typeof entry.label === "string"
    && typeof entry.message === "string"
    && typeof entry.unlockedAt === "string"
    && !Number.isNaN(Date.parse(entry.unlockedAt))
  )).map((entry) => {
    if (entry.id !== "pride-mode") {
      return entry;
    }
    return {
      ...entry,
      label: "RGB MODE",
      message: entry.message.replace("PRIDE MODE", "RGB MODE"),
    };
  });

  if (validAchievements.length !== parsedAchievements.length) {
    console.error("One or more saved achievements were invalid and could not be loaded.");
  }

  return validAchievements;
}

let unlockedAchievements = loadUnlockedAchievements();

function saveUnlockedAchievements() {
  try {
    localStorage.setItem(achievementStorageKey, JSON.stringify(unlockedAchievements));
  } catch (error) {
    console.error("Unable to save achievements:", error);
  }
}

function updateAchievementCount() {
  achievementCount.textContent = String(unlockedAchievements.length);
  const discoveredCount = achievementCatalog.filter(({ id }) => (
    unlockedAchievements.some((entry) => entry.id === id)
  )).length;
  achievementsProgress.textContent = `${discoveredCount} / ${achievementCatalog.length} DISCOVERED`;
}

function recordAchievement(id, message, label) {
  if (unlockedAchievements.some((entry) => entry.id === id)) {
    return false;
  }

  unlockedAchievements.push({
    id,
    label,
    message,
    unlockedAt: new Date().toISOString(),
  });
  sessionMetrics.secretsDiscovered += 1;
  saveUnlockedAchievements();
  updateAchievementCount();
  return true;
}

function showAchievement(
  message,
  label = "ACHIEVEMENT UNLOCKED",
  duration = 3200,
  achievementId = null,
) {
  const wasNewAchievement = achievementId
    ? recordAchievement(achievementId, message, label)
    : false;
  if (wasNewAchievement) {
    window.BITS_NOTIFICATIONS?.notify({
      title: label,
      message,
      type: "achievement",
      dedupeKey: `achievement-${achievementId}`,
    });
  }

  window.clearTimeout(achievementTimer);
  achievementLabel.textContent = label;
  achievementMessage.textContent = message;
  achievement.hidden = false;
  achievementTimer = window.setTimeout(() => {
    achievement.hidden = true;
  }, duration);
}

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

function renderAchievementsPanel() {
  achievementsList.replaceChildren();
  achievementsEmpty.hidden = unlockedAchievements.length > 0;
  updateAchievementCount();

  const unlockedById = new Map(unlockedAchievements.map((entry) => [entry.id, entry]));
  const panelOpenCount = Number.parseInt(
    sessionStorage.getItem("bits-achievement-panel-opens") || "0",
    10,
  );
  const hintLevel = visitCount >= 5 || panelOpenCount >= 6
    ? 2
    : visitCount >= 2 || panelOpenCount >= 3
      ? 1
      : 0;

  achievementCatalog.forEach(({ id, hints }) => {
      const entry = unlockedById.get(id);
      const item = document.createElement("li");
      item.className = `achievement-entry${entry ? "" : " is-locked"}`;

      const label = document.createElement("span");
      label.textContent = entry?.label || "LOCKED // ???";
      const message = document.createElement("strong");
      message.textContent = entry?.message || hints[hintLevel];
      item.append(label, message);
      if (entry) {
        const unlockedAt = document.createElement("time");
        unlockedAt.dateTime = entry.unlockedAt;
        unlockedAt.textContent = `Unlocked ${new Date(entry.unlockedAt).toLocaleString()}`;
        item.append(unlockedAt);
      }
      achievementsList.append(item);
    });

  unlockedAchievements
    .filter(({ id }) => !achievementCatalog.some((entry) => entry.id === id))
    .sort((first, second) => second.unlockedAt.localeCompare(first.unlockedAt))
    .forEach((entry) => {
      const item = document.createElement("li");
      item.className = "achievement-entry is-archived";
      const label = document.createElement("span");
      label.textContent = `${entry.label} // ARCHIVED`;
      const message = document.createElement("strong");
      message.textContent = entry.message;
      const unlockedAt = document.createElement("time");
      unlockedAt.dateTime = entry.unlockedAt;
      unlockedAt.textContent = `Unlocked ${new Date(entry.unlockedAt).toLocaleString()}`;
      item.append(label, message, unlockedAt);
      achievementsList.append(item);
    });
}

function openAchievementsPanel() {
  const panelOpenCount = Number.parseInt(
    sessionStorage.getItem("bits-achievement-panel-opens") || "0",
    10,
  ) + 1;
  sessionStorage.setItem("bits-achievement-panel-opens", String(panelOpenCount));
  if (panelOpenCount === 3) {
    recordAchievement(
      "achievement-checker",
      "CHECKED THE ACHIEVEMENTS",
      "ACHIEVEMENT ACHIEVEMENT",
    );
  } else if (
    panelOpenCount > 3
    && unlockedAchievements.some((entry) => entry.id === "achievement-checker")
  ) {
    showAchievement("YES, IT IS STILL HERE", "ACHIEVEMENT STATUS", 1800);
  }

  achievementsPreviousFocus = document.activeElement;
  renderAchievementsPanel();
  achievementsPanel.hidden = false;
  achievementsClose.focus();
  showAvatarContextReaction("[¬_¬] KEEPING RECORDS NOW? CONCERNING.");
}

function closeAchievementsPanel() {
  achievementsPanel.hidden = true;
  if (achievementsPreviousFocus instanceof HTMLElement) {
    achievementsPreviousFocus.focus();
  }
}

achievementsButton.addEventListener("click", openAchievementsPanel);
achievementsClose.addEventListener("click", closeAchievementsPanel);
achievementsExport.addEventListener("click", () => {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    achievements: unlockedAchievements,
  };
  const download = document.createElement("a");
  download.href = `data:application/json;charset=utf-8,${
    encodeURIComponent(JSON.stringify(exportData, null, 2))
  }`;
  download.download = "bitsofbits-achievements.json";
  document.body.append(download);
  download.click();
  download.remove();
  showAchievement("LOCAL CACHE EXPORTED", "ACHIEVEMENT DATA", 2200);
});
achievementsReset.addEventListener("click", () => {
  if (!window.confirm("Reset every locally saved achievement on this device?")) {
    return;
  }
  unlockedAchievements = [];
  saveUnlockedAchievements();
  updateAchievementCount();
  renderAchievementsPanel();
  showAchievement("LOCAL CACHE CLEARED", "ACHIEVEMENT DATA", 2200);
});
achievementsPanel.addEventListener("click", (event) => {
  if (event.target === achievementsPanel) {
    closeAchievementsPanel();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !achievementsPanel.hidden) {
    closeAchievementsPanel();
  } else if (event.key === "Escape" && !biosPanel.hidden) {
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
  linkGrid.innerHTML = links
    .map(
      ({ label, description, url, icon, iconPath, color }) => `
        <a
          class="link-card"
          href="${url}"
          style="--card-accent: ${color}"
          target="_blank"
          rel="noreferrer"
        >
          <span class="link-icon" aria-hidden="true">
            ${
              iconPath
                ? `<img class="link-icon-image" src="${iconPath}" alt="">`
                : icon
            }
          </span>
          <span class="link-copy">
            <span class="link-title">${label}</span>
            <span class="link-description">${description}</span>
          </span>
          <span class="link-arrow" aria-hidden="true">↗</span>
        </a>
      `,
    )
    .join("");

  linkCount.textContent = `${String(links.length).padStart(2, "0")} NODES`;

  linkGrid.querySelectorAll(".link-card").forEach((card) => {
    const arrow = card.querySelector(".link-arrow");
    card.addEventListener("click", () => {
      sessionMetrics.linksOpened += 1;
    });
    card.addEventListener("pointerenter", () => {
      if (Math.random() < 0.01) {
        const rareArrows = ["↗ probably safe", "↗ here goes nothing", "↗ another tab"];
        arrow.textContent = rareArrows[Math.floor(Math.random() * rareArrows.length)];
        card.dataset.rareHover = "true";
      }
    });
    card.addEventListener("pointerleave", () => {
      arrow.textContent = "↗";
      delete card.dataset.rareHover;
    });
  });

  if (allowRare404 && Math.random() < 0.015) {
    activateRare404Card();
  }
}

const supportedMessageStyles = [
  "color",
  "fontWeight",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "letterSpacing",
  "textDecoration",
  "textTransform",
];

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

function applyTextFormat(element, format = {}) {
  supportedMessageStyles.forEach((property) => {
    element.style[property] = "";
  });

  Object.entries(format).forEach(([property, value]) => {
    if (!supportedMessageStyles.includes(property)) {
      throw new Error(`Unsupported message format property: ${property}`);
    }

    element.style[property] = value;
  });
}

const graphemeSegmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

function splitVisibleCharacters(text) {
  return graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment)
    : Array.from(text);
}

const rainbowColors = {
  dark: ["#ff6d7a", "#ff9b62", "#ffcc66", "#66ff9a", "#63d8ff", "#7aa7ff", "#b99aff"],
  light: ["#b4232f", "#a44800", "#746000", "#087a2a", "#006a8e", "#3155a6", "#743aa2"],
};

function renderMessageText(element, characters, length, colorful = false) {
  const visibleCharacters = characters.slice(0, length);
  element.classList.toggle("is-colorful-text", colorful);
  element.textContent = visibleCharacters.join("");
}

let currentMessage = pickWeightedOption(messages);
let currentMessageCharacters = splitVisibleCharacters(currentMessage.text);
let characterIndex = 0;
let deleting = false;
const typoMessage = {
  text: "the bits are definately working...",
  correctedText: "the bits are definitely working...",
};
let forceTypoMessage = false;
const displayedMessageHistory = [currentMessage];
let displayedMessageHistoryIndex = displayedMessageHistory.length;

function pickNextMessage() {
  if (forceTypoMessage || Math.random() < 0.008) {
    forceTypoMessage = false;
    return { ...typoMessage };
  }
  return pickWeightedOption(messages);
}

function runTypoCorrection() {
  commandLine.classList.add("is-correcting");
  typedText.textContent = "the bits are definite_";
  window.setTimeout(() => {
    currentMessage = {
      text: typoMessage.correctedText,
      wasCorrected: true,
    };
    currentMessageCharacters = splitVisibleCharacters(currentMessage.text);
    characterIndex = currentMessageCharacters.length;
    typedText.textContent = currentMessage.text;
    commandLine.classList.remove("is-correcting");
    showAchievement("NOTHING HAPPENED", "TYPO CORRECTION", 1800, "typo-corrected");
    deleting = true;
    window.setTimeout(updateMessage, 1600);
  }, 420);
}

function updateMessage() {
  if (document.hidden) {
    setTimeout(updateMessage, 1000);
    return;
  }

  renderMessageText(
    typedText,
    currentMessageCharacters,
    characterIndex,
    currentMessage.colorful,
  );

  if (deleting) {
    characterIndex -= 1;
    if (characterIndex < 0) {
      deleting = false;
      currentMessage = pickNextMessage();
      displayedMessageHistory.push(currentMessage);
      if (displayedMessageHistory.length > 30) {
        displayedMessageHistory.shift();
      }
      displayedMessageHistoryIndex = displayedMessageHistory.length;
      currentMessageCharacters = splitVisibleCharacters(currentMessage.text);
      applyTextFormat(typedText, currentMessage.format);
      setTimeout(updateMessage, 250 + Math.random() * 500);
      return;
    }
  } else {
    characterIndex += 1;
    if (characterIndex > currentMessageCharacters.length) {
      if (currentMessage.correctedText && !currentMessage.wasCorrected) {
        runTypoCorrection();
        return;
      }
      deleting = true;
      setTimeout(updateMessage, 1400 + Math.random() * 1600);
      return;
    }
  }

  const typingDelay = deleting
    ? 18 + Math.random() * 28
    : 35 + Math.random() * 55;
  setTimeout(updateMessage, typingDelay);
}

function updateActivity() {
  if (document.hidden) {
    setTimeout(updateActivity, 2000);
    return;
  }

  activityText.classList.add("is-changing");

  setTimeout(() => {
    if (new Date().getHours() === 0) {
      activityText.textContent = "pretending tomorrow is not approaching...";
      activityText.classList.remove("is-changing");
      setTimeout(updateActivity, 60000);
      return;
    }
    const activity = pickWeightedOption(activities);
    activityText.textContent = activity.text;
    applyTextFormat(activityText, activity.format);
    activityText.classList.remove("is-changing");
    setTimeout(updateActivity, 4000 + Math.random() * 6000);
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

let themeIndex = Math.max(
  0,
  themes.findIndex((theme) => theme.name === localStorage.getItem("bits-accent")),
);
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
  return rainbowColors[document.documentElement.dataset.colorScheme]
    || rainbowColors.dark;
}

function applyRgbAccent() {
  applyAccentTheme(themes[themeIndex]);
  accentSelect.value = "RGB";
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
  localStorage.setItem("bits-rgb-mode", String(enabled));

  if (!enabled) {
    binaryRain.querySelectorAll(".is-rgb-bit").forEach((bit) => {
      bit.classList.remove("is-rgb-bit");
      bit.style.removeProperty("--bit-color");
      bit.style.removeProperty("--bit-color-rgb");
    });
    applyAccentTheme(themes[themeIndex]);
    return;
  }

  applyRgbAccent();
  binaryRain.querySelectorAll(".falling-bit:not(.is-forbidden)")
    .forEach(applyRgbBitColor);
}

function applyAccentTheme(theme) {
  const colorScheme = document.documentElement.dataset.colorScheme;
  const accent = theme[colorScheme];
  document.documentElement.style.setProperty("--accent", accent.accent);
  document.documentElement.style.setProperty("--accent-rgb", accent.rgb);
  if (!document.documentElement.classList.contains("is-rgb-mode")) {
    accentSelect.value = theme.name;
  }
  localStorage.setItem("bits-accent", theme.name);
}

function updateBrowserThemeColor() {
  const theme = interfaceThemes[interfaceThemeIndex];
  const colorScheme = document.documentElement.dataset.colorScheme;
  document.querySelector('meta[name="theme-color"]').content =
    colorScheme === "light" ? theme.lightColor : theme.darkColor;
}

function applyInterfaceTheme(theme) {
  document.documentElement.dataset.interfaceTheme = theme.id;
  interfaceThemeSelect.value = theme.id;
  localStorage.setItem("bits-interface-theme", theme.id);
  updateBrowserThemeColor();
}

function applyColorScheme(colorScheme) {
  document.documentElement.dataset.colorScheme = colorScheme;
  modeName.textContent = colorScheme.toUpperCase();
  updateBrowserThemeColor();
  localStorage.setItem("bits-color-scheme", colorScheme);
  if (document.documentElement.classList.contains("is-rgb-mode")) {
    applyRgbAccent();
  } else {
    applyAccentTheme(themes[themeIndex]);
  }
}

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
  window.dispatchEvent(new CustomEvent("bits:appearance-changed", {
    detail: {
      label: "INTERFACE THEME",
      value: interfaceThemes[interfaceThemeIndex].name,
    },
  }));
});

accentSelect.value = document.documentElement.classList.contains("is-rgb-mode")
  ? "RGB"
  : themes[themeIndex].name;
accentSelect.addEventListener("change", () => {
  if (accentSelect.value === "RGB") {
    setRgbMode(true);
    window.dispatchEvent(new CustomEvent("bits:appearance-changed", {
      detail: { label: "ACCENT", value: "RGB MODE" },
    }));
    showAchievement(
      "RGB MODE ENABLED",
      "RGB MODE",
      3200,
      "pride-mode",
    );
    showAvatarContextReaction("[>_<] MY OPTICAL SENSORS OBJECT TO THIS.");
    return;
  }

  const selectedIndex = themes.findIndex(
    (theme) => theme.name === accentSelect.value,
  );
  if (selectedIndex < 0) {
    throw new Error(`Unknown accent: ${accentSelect.value}`);
  }
  themeIndex = selectedIndex;
  setRgbMode(false);
  window.dispatchEvent(new CustomEvent("bits:appearance-changed", {
    detail: { label: "ACCENT", value: themes[themeIndex].name },
  }));
});

modeButton.addEventListener("click", () => {
  const nextScheme = document.documentElement.dataset.colorScheme === "dark"
    ? "light"
    : "dark";
  applyColorScheme(nextScheme);
  window.dispatchEvent(new CustomEvent("bits:appearance-changed", {
    detail: { label: "DISPLAY", value: nextScheme.toUpperCase() },
  }));
  renderMessageText(
    typedText,
    currentMessageCharacters,
    characterIndex,
    currentMessage.colorful,
  );
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
  processTitle.textContent = willMinimize
    ? "~/internet/playing_dead.exe"
    : "~/internet/presence.exe";
  statusText.textContent = willMinimize ? "PLAYING DEAD" : "ONLINE";
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
    window.setTimeout(() => {
      if (!isIdle) {
        processTitle.textContent = "~/internet/presence.exe";
        statusText.textContent = "ONLINE";
      }
    }, 10000);
    return;
  }

  shutdownMessage.textContent = shutdownMessages[
    Math.floor(Math.random() * shutdownMessages.length)
  ];
  shutdownCode.textContent = `STOP CODE: ${pickStopCode()}`;
  reportLinks.textContent = String(sessionMetrics.linksOpened);
  reportCommands.textContent = String(sessionMetrics.commandsEntered);
  reportAvatar.textContent = String(sessionMetrics.avatarIncidents);
  reportSecrets.textContent = String(sessionMetrics.secretsDiscovered);
  interfaceShell.classList.add("is-closing");
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
  showAchievement(
    "THE INTERNET IS BACK ONLINE",
    "SECOND THOUGHTS",
    2800,
    "reboot",
  );
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

identityName.addEventListener("pointerdown", startIdentityHold);
window.addEventListener("pointerup", stopIdentityHold);
identityName.addEventListener("keydown", (event) => {
  if ((event.key === " " || event.key === "Enter") && !event.repeat) {
    event.preventDefault();
    startIdentityHold();
  }
});
identityName.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") {
    stopIdentityHold();
  }
});

identityName.addEventListener("click", (event) => {
  if (didHoldIdentity || event.detail !== 3) {
    didHoldIdentity = false;
    return;
  }

  appendIdentityBits();
  showAchievement(
    "MORE BITS HAVE BEEN ADDED",
    "ACHIEVEMENT UNLOCKED",
    3200,
    "more-bits",
  );
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
  "status",
  "changelog",
  "source",
  "repo",
  "share",
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

  currentMessage = historicalMessage;
  currentMessageCharacters = splitVisibleCharacters(currentMessage.text);
  characterIndex = currentMessageCharacters.length;
  deleting = true;
  applyTextFormat(typedText, currentMessage.format);
  renderMessageText(
    typedText,
    currentMessageCharacters,
    characterIndex,
    currentMessage.colorful,
  );
  showAchievement(currentMessage.text, "COMMAND HISTORY", 1800);
}

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

  if (commandLine.matches(":hover") && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
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

  if (event.key === "Tab" && commandInput) {
    event.preventDefault();
    const matchingSuggestions = commandSuggestions.filter((suggestion) => (
      suggestion.startsWith(commandInput.toLowerCase())
    ));
    const suggestions = matchingSuggestions.length > 0
      ? matchingSuggestions
      : commandSuggestions;
    commandInput = suggestions[autocompleteIndex % suggestions.length];
    autocompleteIndex += 1;
    processTitle.textContent = `> ${commandInput}_`;
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
const idleDelayMs = 180000;
const assistantDelayMs = 90000;

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

function enterIdleMode() {
  if (avatarWrap.classList.contains("has-departed")) {
    return;
  }

  isIdle = true;
  avatarWrap.classList.add("is-idle");
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
    avatarWrap.classList.remove("is-idle");
    statusText.textContent = "ONLINE";
    processTitle.textContent = "~/internet/presence.exe";
  }
  assistantTimer = window.setTimeout(showBitsAssistant, assistantDelayMs);
  idleTimer = window.setTimeout(enterIdleMode, idleDelayMs);
}

["pointerdown", "keydown", "scroll"].forEach((eventName) => {
  window.addEventListener(eventName, resetIdleTimer, { passive: true });
});

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
    if (document.documentElement.classList.contains("is-rgb-mode")) {
      applyRgbAccent();
    } else {
      applyAccentTheme(themes[themeIndex]);
    }
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

window.BITS_ACHIEVEMENTS = {
  unlock: (id, message, label = "ACHIEVEMENT UNLOCKED") => {
    if (!achievementCatalog.some((achievement) => achievement.id === id)) {
      throw new Error(`Unknown achievement: ${id}`);
    }
    showAchievement(message, label, 3200, id);
  },
};

updateAchievementCount();
renderLinks();
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
    const response = await fetch("build-info.json", { cache: "no-store" });
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
    const shortCommit = metadata.commit.slice(0, 7);
    buildLink.textContent = `BUILD ${shortCommit.toUpperCase()}`;
    buildLink.href = repositoryUrl;
    buildLink.title = `Deployed ${new Date(metadata.builtAt).toLocaleString()}`;
    buildLink.dataset.commit = shortCommit.toUpperCase();
  } catch (error) {
    console.warn("Unable to load build metadata:", error);
  }
}

applyColorScheme(document.documentElement.dataset.colorScheme);
renderMessageText(
  typedText,
  currentMessageCharacters,
  characterIndex,
  currentMessage.colorful,
);
applyTextFormat(typedText, currentMessage.format);
document.querySelector("#year").textContent = new Date().getFullYear();
loadBuildMetadata();
setInterval(updateUptime, 1000);
setTimeout(updateMessage, 250);
setTimeout(updateActivity, 4000 + Math.random() * 4000);
applyTemporalEggs();
setInterval(applyTemporalEggs, 60000);

if (sessionStorage.getItem("bits-cookie-notice-dismissed") !== "true") {
  setTimeout(() => {
    cookieNotice.hidden = false;
  }, 7000);
}

scheduleNextBit();
resetIdleTimer();
