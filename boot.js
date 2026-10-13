const bootSessionKey = "bits-boot-seen-v1";
let shouldPlayBoot = true;

try {
  shouldPlayBoot = sessionStorage.getItem(bootSessionKey) !== "true";
} catch (error) {
  console.warn("Unable to read boot session state:", error);
}

document.documentElement.dataset.boot = shouldPlayBoot ? "pending" : "complete";

document.addEventListener("DOMContentLoaded", () => {
  const bootScreen = document.querySelector("#boot-screen");
  const bootLog = document.querySelector("#boot-log");
  const bootProgressBar = document.querySelector("#boot-progress-bar");
  const bootSkip = document.querySelector("#boot-skip");
  const bootBackgroundElements = Array.from(
    document.body.children,
  ).filter((element) => (
    element !== bootScreen && !["SCRIPT", "NOSCRIPT"].includes(element.tagName)
  ));
  const bootSteps = [
    "MEMORY CHECK ............... TOO MANY BITS",
    "MOUNT /dev/internet ........ OK",
    "LOAD avatar.service ........ OPINIONATED",
    "LOAD questionable-css.dll .. ENABLED",
    "SYNC social_nodes .......... CONNECTED",
    "START presence.exe ......... READY",
  ];
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
      || document.documentElement.dataset.motion === "reduced";
    if (reduceMotion) {
      finishBoot();
      return;
    }

    bootSteps.forEach((step, index) => {
      timers.push(window.setTimeout(() => {
        const item = document.createElement("li");
        item.textContent = step;
        bootLog.append(item);
        bootProgressBar.style.width = `${Math.round(((index + 1) / bootSteps.length) * 100)}%`;
        if (index === bootSteps.length - 1) {
          timers.push(window.setTimeout(finishBoot, 450));
        }
      }, index * 360));
    });
  }

  bootSkip.addEventListener("click", finishBoot);
  window.BITS_BOOT = { play: playBoot, skip: finishBoot };

  if (shouldPlayBoot) {
    playBoot();
  } else {
    finishBoot();
  }
});
