const insiderStorageKey = "bits-insider-channel";
const deathScreenStorageKey = "bits-death-screens";
const insiderToggle = document.querySelector("#settings-insider-toggle");
const insiderStatus = document.querySelector("#settings-insider-status");
const insiderWatermark = document.querySelector("#insider-watermark");
const systemStatusTrigger = document.querySelector("#system-status-trigger");
const kernelPanic = document.querySelector("#kernel-panic");
const kernelPanicLog = document.querySelector("#kernel-panic-log");
const kernelPanicCountdown = document.querySelector("#kernel-panic-countdown");
const blackScreen = document.querySelector("#black-screen");
const blackScreenProgress = document.querySelector("#black-screen-progress");
const blackScreenStatus = document.querySelector("#black-screen-status");
const greenScreen = document.querySelector("#green-screen");
const greenScreenProgress = document.querySelector("#green-screen-progress");
const greenScreenCode = document.querySelector("#green-screen-code");
const greenStopCodes = [
  "UNSTABLE_BIT_CHANNEL",
  "FEATURE_NOT_YET_A_FEATURE",
  "EXPERIMENTAL_BIT_LEAK",
  "CANARY_ESCAPED_CONTAINMENT",
  "WORKED_ON_MY_MACHINE",
  "DOCUMENTATION_PENDING",
  "PRODUCTION_TESTING_ENABLED",
];
const kernelPanicLines = [
  "Debugger called: <panic>",
  "Memory ID: 0xB17B17 // confidence level: optimistic",
  "OS release type: User (allegedly)",
  "OS version: BitOS 13.37 (Probably Final)",
  "Kernel version: Darwin Bits Kernel 23.0.0 // RELEASE_TINY",
  "BSD process name corresponding to current thread: presence.exe",
  "Kernel extensions in backtrace: net.shortbits.questionablecss",
  "Attempting to sync disks... disks have requested personal space",
];

let insiderEnabled = localStorage.getItem(insiderStorageKey) === "canary";
let insiderWindowLaunches = 0;
let greenCrashPending = false;
let kernelPanicClicks = 0;
let kernelPanicTimer;
let kernelPanicRecoveryTimer;
let kernelPanicPreviousFocus;
let greenScreenTimer;
let greenScreenPreviousFocus;
let blackScreenTimer;
let blackScreenRecoveryTimer;
let blackScreenPreviousFocus;
let emptyDesktopClicks = 0;
let emptyDesktopArmTimer;

function loadDeathScreens() {
  try {
    const stored = JSON.parse(localStorage.getItem(deathScreenStorageKey) || "[]");
    if (!Array.isArray(stored)) {
      throw new Error("Saved death screen history is not an array.");
    }
    return new Set(stored.filter((screen) => (
      ["blue", "red", "black", "green"].includes(screen)
    )));
  } catch (error) {
    console.error("Unable to load death screen history:", error);
    return new Set();
  }
}

const survivedDeathScreens = loadDeathScreens();

try {
  const savedAchievements = JSON.parse(
    localStorage.getItem("bits-achievements") || "[]",
  );
  if (Array.isArray(savedAchievements)) {
    if (savedAchievements.some((entry) => entry?.id === "reboot")) {
      survivedDeathScreens.add("blue");
    }
    if (savedAchievements.some((entry) => entry?.id === "red-screen")) {
      survivedDeathScreens.add("red");
    }
  }
} catch (error) {
  console.error("Unable to derive death screen history from achievements:", error);
}

function saveDeathScreens() {
  try {
    localStorage.setItem(
      deathScreenStorageKey,
      JSON.stringify([...survivedDeathScreens]),
    );
  } catch (error) {
    console.error("Unable to save death screen history:", error);
  }
}

function markDeathScreenSurvived(screen) {
  if (!["blue", "red", "black", "green"].includes(screen)) {
    return;
  }
  const isNewScreen = !survivedDeathScreens.has(screen);
  survivedDeathScreens.add(screen);
  saveDeathScreens();
  if (isNewScreen && survivedDeathScreens.size === 4) {
    window.BITS_ACHIEVEMENTS.unlock(
      "failure-spectrum",
      "FULL SPECTRUM FAILURE",
      "ALL FAILURE COLORS COLLECTED",
    );
  }
}

function isDeathScreenActive() {
  return document.body.matches(
    ".is-shutdown, .is-red-screen, .is-kernel-panic, .is-black-screen, .is-green-screen, .is-black-screen-staging",
  );
}

function notifyInsider(title, message, type = "info") {
  window.BITS_NOTIFICATIONS?.notify({
    title,
    message,
    type,
  });
}

function syncInsiderInterface() {
  document.documentElement.classList.toggle("is-insider-build", insiderEnabled);
  insiderWatermark.hidden = !insiderEnabled;
  insiderToggle.textContent = insiderEnabled
    ? "LEAVE CANARY BITS"
    : "JOIN CANARY BITS";
  insiderToggle.setAttribute("aria-pressed", String(insiderEnabled));
  insiderStatus.textContent = insiderEnabled
    ? "Channel: CANARY // Stability is no longer covered by warranty."
    : "Channel: STABLE // Sensible decisions enabled.";
}

function setInsiderEnabled(enabled) {
  insiderEnabled = enabled;
  insiderWindowLaunches = 0;
  greenCrashPending = false;
  if (enabled) {
    localStorage.setItem(insiderStorageKey, "canary");
    notifyInsider(
      "CANARY BITS ENABLED",
      "Experimental Bits will now arrive before their documentation.",
      "warning",
    );
  } else {
    localStorage.removeItem(insiderStorageKey);
    notifyInsider(
      "STABLE CHANNEL RESTORED",
      "The website will resume pretending to be production-ready.",
      "success",
    );
  }
  syncInsiderInterface();
}

function restoreDeathScreenFocus(previousFocus, fallback) {
  const recoveryFocus = previousFocus instanceof HTMLElement
    && document.contains(previousFocus)
    && previousFocus !== document.body
    ? previousFocus
    : fallback;
  recoveryFocus?.focus();
}

function recoverFromKernelPanic() {
  window.clearInterval(kernelPanicTimer);
  window.clearTimeout(kernelPanicRecoveryTimer);
  kernelPanic.hidden = true;
  document.body.classList.remove("is-kernel-panic");
  document.title = "BitsofBitsofBits // BITSOFWEBSITE";
  window.BITS_ACHIEVEMENTS.unlock(
    "kernel-panic",
    "PANIC! AT THE KERNEL",
    "UNIX-LIKE FAILURE SURVIVED",
  );
  restoreDeathScreenFocus(kernelPanicPreviousFocus, systemStatusTrigger);
}

function triggerKernelPanic() {
  if (isDeathScreenActive()) {
    return;
  }

  disarmEmptyDesktop();
  kernelPanicClicks = 0;
  kernelPanicPreviousFocus = document.activeElement;
  kernelPanicCountdown.textContent = "8";
  kernelPanicLog.replaceChildren();
  document.body.classList.add("is-kernel-panic");
  document.title = "KERNEL PANIC // BIT_ASSERTION_FAILED";
  kernelPanic.hidden = false;
  kernelPanic.focus();

  let remainingSeconds = 8;
  let lineIndex = 0;
  kernelPanicTimer = window.setInterval(() => {
    const line = document.createElement("li");
    line.textContent = kernelPanicLines[lineIndex];
    kernelPanicLog.append(line);
    lineIndex += 1;
    remainingSeconds -= 1;
    kernelPanicCountdown.textContent = String(remainingSeconds);
    if (remainingSeconds <= 0) {
      window.clearInterval(kernelPanicTimer);
      kernelPanicRecoveryTimer = window.setTimeout(recoverFromKernelPanic, 450);
    }
  }, 1000);
}

function recoverFromGreenScreen() {
  window.clearInterval(greenScreenTimer);
  greenScreen.hidden = true;
  document.body.classList.remove("is-green-screen");
  document.title = "BitsofBitsofBits // BITSOFWEBSITE";
  greenCrashPending = false;
  insiderWindowLaunches = 0;
  notifyInsider(
    "UPDATE SUCCESSFUL",
    "The unstable feature responsible for the crash has been promoted directly to production.",
    "success",
  );
  window.BITS_ACHIEVEMENTS.unlock(
    "green-screen",
    "FREE QUALITY ASSURANCE",
    "GREEN SCREEN SURVIVED",
  );
  markDeathScreenSurvived("green");
  restoreDeathScreenFocus(greenScreenPreviousFocus, insiderToggle);
}

function triggerGreenScreen() {
  if (!insiderEnabled || isDeathScreenActive()) {
    greenCrashPending = false;
    return;
  }

  greenScreenPreviousFocus = document.activeElement;
  greenScreenCode.textContent = greenStopCodes[
    Math.floor(Math.random() * greenStopCodes.length)
  ];
  greenScreenProgress.textContent = "0%";
  document.body.classList.add("is-green-screen");
  document.title = "BITS INSIDER PREVIEW // UNSTABLE";
  greenScreen.hidden = false;
  greenScreen.focus();

  const progressSteps = [12, 29, 47, 68, 86, 100, 103];
  let progressIndex = 0;
  greenScreenTimer = window.setInterval(() => {
    greenScreenProgress.textContent = `${progressSteps[progressIndex]}%`;
    progressIndex += 1;
    if (progressIndex >= progressSteps.length) {
      window.clearInterval(greenScreenTimer);
      window.setTimeout(recoverFromGreenScreen, 900);
    }
  }, 850);
}

function disarmEmptyDesktop() {
  window.clearTimeout(emptyDesktopArmTimer);
  emptyDesktopClicks = 0;
  document.body.classList.remove(
    "is-empty-desktop-armed",
    "is-black-screen-warning",
  );
}

function armEmptyDesktop() {
  disarmEmptyDesktop();
  document.body.classList.add("is-empty-desktop-armed");
  emptyDesktopArmTimer = window.setTimeout(disarmEmptyDesktop, 15000);
}

function recoverFromBlackScreen() {
  window.clearInterval(blackScreenTimer);
  window.clearTimeout(blackScreenRecoveryTimer);
  blackScreen.hidden = true;
  document.body.classList.remove(
    "is-black-screen",
    "is-black-screen-staging",
  );
  document.title = "BitsofBitsofBits // BITSOFWEBSITE";
  window.BITS_ACHIEVEMENTS.unlock(
    "black-screen",
    "STARED INTO THE BIT BUCKET",
    "BLACK SCREEN SURVIVED",
  );
  markDeathScreenSurvived("black");
  restoreDeathScreenFocus(blackScreenPreviousFocus, document.querySelector("#settings-button"));
}

function showBlackScreen() {
  blackScreenProgress.textContent = "0%";
  blackScreenStatus.textContent = "Searching the Bit Bucket for recoverable interface fragments.";
  document.body.classList.remove("is-black-screen-staging");
  document.body.classList.add("is-black-screen");
  document.title = "NOTHING // BIT_BUCKET_EMPTY";
  blackScreen.hidden = false;
  blackScreen.focus();

  const progressSteps = [18, 41, 67, 86, 99];
  let progressIndex = 0;
  blackScreenTimer = window.setInterval(() => {
    blackScreenProgress.textContent = `${progressSteps[progressIndex]}%`;
    progressIndex += 1;
    if (progressIndex >= progressSteps.length) {
      window.clearInterval(blackScreenTimer);
      blackScreenStatus.textContent = "We couldn't find the remaining 1%. Making one up...";
      blackScreenRecoveryTimer = window.setTimeout(() => {
        blackScreenProgress.textContent = "100%";
        blackScreenStatus.textContent = "Replacement Bit fabricated. Authenticity inconclusive.";
        blackScreenRecoveryTimer = window.setTimeout(recoverFromBlackScreen, 1000);
      }, 1300);
    }
  }, 700);
}

function triggerBlackScreen() {
  if (isDeathScreenActive()) {
    return;
  }
  blackScreenPreviousFocus = document.activeElement;
  disarmEmptyDesktop();
  document.body.classList.add("is-black-screen-staging");
  window.setTimeout(showBlackScreen, 650);
}

insiderToggle.addEventListener("click", () => {
  setInsiderEnabled(!insiderEnabled);
});

systemStatusTrigger.addEventListener("click", () => {
  if (isDeathScreenActive()) {
    return;
  }
  kernelPanicClicks += 1;
  systemStatusTrigger.classList.remove("is-status-probed");
  window.requestAnimationFrame(() => {
    systemStatusTrigger.classList.add("is-status-probed");
  });
  if (kernelPanicClicks >= 7) {
    systemStatusTrigger.classList.remove("is-status-probed");
    triggerKernelPanic();
  }
});

window.addEventListener("desktop-window:opened", () => {
  disarmEmptyDesktop();
  if (!insiderEnabled || greenCrashPending || isDeathScreenActive()) {
    return;
  }
  insiderWindowLaunches += 1;
  if (insiderWindowLaunches >= 3) {
    greenCrashPending = true;
    window.setTimeout(triggerGreenScreen, 420);
  }
});

window.addEventListener("desktop-window:closed", (event) => {
  if (event.detail?.remainingOpen === 0 && !isDeathScreenActive()) {
    armEmptyDesktop();
  }
});

window.addEventListener("bits:death-screen-survived", (event) => {
  markDeathScreenSurvived(event.detail?.screen);
});

window.addEventListener("bits:achievements-reset", () => {
  survivedDeathScreens.clear();
  saveDeathScreens();
});

document.body.addEventListener("click", (event) => {
  if (
    !document.body.classList.contains("is-empty-desktop-armed")
    || event.target.closest(
      "#interface-shell, footer, [data-window], button, a, input, select, textarea, summary",
    )
  ) {
    return;
  }

  emptyDesktopClicks += 1;
  if (emptyDesktopClicks === 3) {
    document.body.classList.add("is-black-screen-warning");
  }
  if (emptyDesktopClicks >= 5) {
    triggerBlackScreen();
  }
});

syncInsiderInterface();
saveDeathScreens();
