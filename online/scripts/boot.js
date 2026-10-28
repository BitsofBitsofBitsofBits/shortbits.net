const bootSessionKey = "bits-boot-seen-v1";
const automaticBootAllowed = !window.matchMedia(
  "(max-width: 720px), (pointer: coarse), (prefers-reduced-motion: reduce)",
).matches && document.documentElement.dataset.motion !== "reduced"
  && document.documentElement.dataset.pauseContent !== "on";
let shouldPlayBoot = automaticBootAllowed;

try {
  shouldPlayBoot = automaticBootAllowed && sessionStorage.getItem(bootSessionKey) !== "true";
} catch (error) {
  console.warn("Unable to read boot session state:", error);
}

document.documentElement.dataset.boot = shouldPlayBoot ? "pending" : "complete";

document.addEventListener("DOMContentLoaded", () => {
  const bootScreen = document.querySelector("#boot-screen");
  const bootLog = document.querySelector("#boot-log");
  const bootProgressBar = document.querySelector("#boot-progress-bar");
  const bootSkip = document.querySelector("#boot-skip");
  if (!bootScreen || !bootLog || !bootProgressBar || !bootSkip) {
    document.documentElement.dataset.boot = "complete";
    return;
  }
  const bootBackgroundElements = Array.from(
    document.body.children,
  ).filter((element) => (
    element !== bootScreen && !["SCRIPT", "NOSCRIPT"].includes(element.tagName)
  ));
  const baseBootSteps = [
    "MEMORY CHECK ............... TOO MANY BITS",
    "MOUNT /dev/internet ........ OK",
    "LOAD avatar.service ........ OPINIONATED",
    "LOAD questionable-css.dll .. ENABLED",
    "SYNC social_nodes .......... CONNECTED",
    "START presence.exe ......... READY",
  ];
  const bindBootMessages = () => window.BITS_MESSAGE_CATALOG?.bind("standard", "initialBootSteps", baseBootSteps);
  bindBootMessages();
  window.addEventListener("bits:runtime-ready", bindBootMessages, { once: true });
  const timers = [];
  let finished = false;

  function finishBoot() {
    if (finished) {
      return;
    }
    finished = true;
    timers.forEach((timer) => window.clearTimeout(timer));
    try {
      sessionStorage.setItem(bootSessionKey, "true");
    } catch (error) {
      console.warn("Unable to persist boot session state:", error);
    }
    document.documentElement.dataset.boot = "complete";
    bootScreen.hidden = true;
    bootBackgroundElements.forEach((element) => {
      element.inert = false;
    });
    window.removeEventListener("keydown", handleBootKeydown, true);
    if (shouldPlayBoot) {
      window.BITS_NOTIFICATIONS?.notify({
        title: "BOOT COMPLETE",
        message: "Internet presence initialized successfully.",
        type: "success",
        dedupeKey: "boot-complete",
      });
    }
  }

  function handleBootKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      finishBoot();
    }
  }

  function playBoot() {
    const seasonalProfile = window.BITS_SEASONAL_PROFILE;
    const seasonalBootSteps = seasonalProfile?.initialBootSteps ?? [];
    const bootSteps = seasonalProfile?.mode === "exclusive" && seasonalBootSteps.length
      ? seasonalBootSteps
      : [...baseBootSteps, ...seasonalBootSteps];
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
    finished = false;
    document.documentElement.dataset.boot = "pending";
    bootLog.replaceChildren();
    bootProgressBar.style.width = "0%";
    bootScreen.hidden = false;
    bootBackgroundElements.forEach((element) => {
      element.inert = true;
    });
    window.addEventListener("keydown", handleBootKeydown, true);
    bootSkip.focus();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || document.documentElement.dataset.motion === "reduced"
      || document.documentElement.dataset.pauseContent === "on";
    if (reduceMotion) {
      finishBoot();
      return;
    }

    bootSteps.forEach((step, index) => {
      timers.push(window.setTimeout(() => {
        const item = document.createElement("li");
        if (window.BITS_MESSAGE_TEXT) window.BITS_MESSAGE_TEXT.render(item, step);
        else item.textContent = step;
        bootLog.append(item);
        bootProgressBar.style.width = `${Math.round(((index + 1) / bootSteps.length) * 100)}%`;
        if (index === bootSteps.length - 1) {
          timers.push(window.setTimeout(finishBoot, 150));
        }
      }, index * Math.min(120, 750 / Math.max(bootSteps.length - 1, 1))));
    });
    if (bootSteps.length === 0) {
      finishBoot();
    }
  }

  bootSkip.addEventListener("click", finishBoot);
  window.addEventListener("bits:preferences-changed", () => {
    if (document.documentElement.dataset.pauseContent === "on") finishBoot();
  });
  window.BITS_BOOT = { play: playBoot, skip: finishBoot };

  if (shouldPlayBoot) {
    if (document.documentElement.dataset.runtime === "pending") {
      bootScreen.hidden = false;
      bootBackgroundElements.forEach((element) => {
        element.inert = true;
      });
      bootSkip.focus();
      window.addEventListener("keydown", handleBootKeydown, true);
      window.addEventListener("bits:runtime-ready", () => {
        if (!finished) {
          playBoot();
        }
      }, { once: true });
    } else {
      playBoot();
    }
  } else {
    finishBoot();
  }
});
