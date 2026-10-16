(() => {
  const log = document.querySelector("#endless-boot-log");
  const cycleOutput = document.querySelector("#endless-boot-cycle");
  const countOutput = document.querySelector("#endless-boot-count");
  const elapsedOutput = document.querySelector("#endless-boot-elapsed");
  const progressBar = document.querySelector("#endless-boot-progress-bar");
  const stageOutput = document.querySelector("#endless-boot-stage");
  const percentOutput = document.querySelector("#endless-boot-percent");
  const messageOutput = document.querySelector("#endless-boot-message");
  const themeSelect = document.querySelector("#endless-boot-theme");
  const settingsPanel = document.querySelector("#endless-boot-settings-panel");
  const settingsToggle = document.querySelector("#endless-boot-settings-toggle");

  const subjects = [
    "avatar.service", "binary_rain.sys", "bitclip.dll", "caffeine.driver",
    "changelog.cache", "cookie_eater.sys", "cobits.language.model",
    "confidence.module", "cursor_enthusiasm", "desktop.ini", "discord.presence",
    "dramatic_lighting.fx", "filesystem.vibes", "firmware.personality",
    "guestbook.daemon", "internet.presence", "keyboard_clacks.wav",
    "linktree.compat", "missing_bit.trace", "notification.anxiety",
    "packet_router", "playlist.telemetry", "questionable_css.dll",
    "rgb_process", "side_project_daemon", "social_nodes", "spotify.signal",
    "terminal.sarcasm", "theme_atmosphere", "unallocated.bit",
  ];
  const actions = [
    "ALLOCATE", "AUTHENTICATE", "CALIBRATE", "CHECK", "COMPILE", "CONNECT",
    "DEFRAGMENT", "ENUMERATE", "INDEX", "INITIALIZE", "LOAD", "MOUNT",
    "NEGOTIATE", "PING", "PRETEND TO UNDERSTAND", "RECONCILE", "RENDER",
    "RESOLVE", "SCAN", "SYNC", "VALIDATE", "WAKE",
  ];
  const results = [
    "OK", "READY", "NOMINAL", "PROBABLY FINE", "OPINIONATED", "TOO MANY BITS",
    "SUSPICIOUSLY FAST", "NO NOTES", "STILL THINKING", "CONNECTED",
    "MOSTLY HARMLESS", "WITH FEELING", "UNREASONABLY CONFIDENT", "CACHE HIT",
    "CACHE MISS (IT DUCKED)", "ENABLED", "ABSOLUTELY", "ASK AGAIN LATER",
    "TECHNICALLY WORKING", "VIBES PASS", "0 ERRORS, 3 CONCERNS",
  ];
  const fixedMessages = [
    "MEMORY CHECK ........................ TOO MANY BITS",
    "MOUNT /dev/internet ................. OK",
    "COUNT AVAILABLE CORES ............... SOME",
    "VERIFY USERNAME LENGTH .............. EXCESSIVE",
    "LOCATE PRODUCTIVITY ................. NOT FOUND",
    "CHECK WARRANTY ...................... BOLD OF YOU",
    "MEASURE INTERNET PRESENCE ........... PALPABLE",
    "ASK GPU TO DRAW A RECTANGLE ......... COMPLIED",
    "CONTACT RESPONSIBLE ADULT ........... TIMEOUT",
    "CONTAIN LOOSE BITS .................. IN PROGRESS",
    "PARSE TODO LIST ..................... GREW BY FOUR",
    "INSPECT DOWNLOADS FOLDER ............ DECLINED",
    "LOAD LAST_KNOWN_GOOD_VIBES .......... PARTIAL",
    "RUN CABLE MANAGEMENT ................ SKIPPED",
    "CHECK CAPS LOCK ..................... EMOTIONALLY ON",
    "DETECT SECOND MONITOR ............... JEALOUS",
    "VERIFY CLOUD ........................ STILL UP THERE",
    "COUNT BROWSER TABS .................. INTEGER OVERFLOW",
    "BENCHMARK COFFEE .................... 98.6%",
    "TRAIN TINY BIT ...................... REFUSES COMMANDS",
    "REHEARSE ERROR MESSAGE .............. CONVINCING",
    "CHECK IF PLUGGED IN ................. PHILOSOPHICALLY",
    "DOWNLOAD MORE RAM ................... ETHICALLY DUBIOUS",
    "OPTIMIZE NOTHING .................... 43% FASTER",
    "VALIDATE VIBES ...................... PASS",
    "WAKE SLEEPING THREADS ............... FIVE MORE MINUTES",
    "READ THE ROOM ....................... ACCESS DENIED",
    "TEST EMERGENCY CONFETTI ............. ARMED",
    "SEARCH FOR SEMICOLON ................ HIDING",
    "COMPILE PERSONALITY ................. WARNINGS IGNORED",
    "NEGOTIATE WITH FIREWALL ............. IT WANTS A SNACK",
    "CHECK STACK ......................... PANCAKES DETECTED",
    "INSPECT HEAP ........................ A LITTLE MESSY",
    "START ACTUAL_WORK.EXE ............... SUSPENDED",
    "SYNCHRONIZE CLOCK ................... CLOSE ENOUGH",
    "PING LOCALHOST ...................... IT KNOWS WE LIVE HERE",
    "CALCULATE ETA ....................... EVENTUALLY",
    "VERIFY FINAL_FINAL_V2 ............... NOT FINAL",
    "TEST UNDO BUTTON .................... NO REGRETS",
    "MOUNT SIDE PROJECT ................. ANOTHER ONE",
  ];
  const stages = [
    "ENUMERATING SUSPICIOUS HARDWARE",
    "MOUNTING THE INTERNET",
    "CALIBRATING PERSONALITY CORE",
    "COUNTING LOOSE BITS",
    "NEGOTIATING WITH PERIPHERALS",
    "PRETENDING THIS IS NECESSARY",
    "VERIFYING QUESTIONABLE DECISIONS",
    "STARTING PRESENCE SUBSYSTEMS",
    "RECHECKING EVERYTHING FOREVER",
  ];

  const startedAt = Date.now();
  let cycle = 1;
  let count = 0;
  let progress = 0;
  let lastMessage = "";
  let lastTransmission = "";
  let timer = 0;
  let viewportFrame = 0;

  function trimLog() {
    const firstItem = log.firstElementChild;
    const measuredLineHeight = firstItem
      ? Number.parseFloat(window.getComputedStyle(firstItem).lineHeight)
      : 16;
    const lineHeight = Number.isFinite(measuredLineHeight) && measuredLineHeight > 0
      ? measuredLineHeight
      : 16;
    const visibleLines = Math.ceil(log.clientHeight / lineHeight);
    const retainedLines = Math.min(240, Math.max(80, visibleLines + 8));

    while (log.children.length > retainedLines) {
      log.firstElementChild.remove();
    }
  }

  function reconcileViewport() {
    window.cancelAnimationFrame(viewportFrame);
    viewportFrame = window.requestAnimationFrame(() => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty(
        "--boot-viewport-height",
        `${Math.round(viewportHeight)}px`,
      );
      trimLog();
      log.scrollTop = log.scrollHeight;
    });
  }

  function applyTheme(themeId, persist = true) {
    const themes = window.BITS_INTERFACE_THEMES ?? [];
    const theme = themes.find((entry) => entry.id === themeId) ?? themes[0];
    if (!theme) {
      return;
    }
    document.documentElement.dataset.interfaceTheme = theme.id;
    document.documentElement.classList.toggle("is-rgb-mode", theme.id === "rgb");
    document.querySelector('meta[name="theme-color"]').content = theme.darkColor;
    themeSelect.value = theme.id;
    if (persist) {
      localStorage.setItem("bits-interface-theme", theme.id);
    }
  }

  function initializeThemePicker() {
    const themes = window.BITS_INTERFACE_THEMES ?? [];
    themeSelect.replaceChildren(...themes.map((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      return option;
    }));
    applyTheme(document.documentElement.dataset.interfaceTheme, false);
    themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
    window.addEventListener("storage", (event) => {
      if (event.key === "bits-interface-theme" && event.newValue) {
        applyTheme(event.newValue, false);
      }
    });
    settingsToggle.addEventListener("click", () => {
      const opening = settingsPanel.hidden;
      settingsPanel.hidden = !opening;
      settingsToggle.setAttribute("aria-expanded", String(opening));
      settingsToggle.setAttribute(
        "aria-label",
        opening ? "Close display settings" : "Open display settings",
      );
      if (opening) {
        themeSelect.focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".endless-boot-settings")) {
        settingsPanel.hidden = true;
        settingsToggle.setAttribute("aria-expanded", "false");
        settingsToggle.setAttribute("aria-label", "Open display settings");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !settingsPanel.hidden) {
        settingsPanel.hidden = true;
        settingsToggle.setAttribute("aria-expanded", "false");
        settingsToggle.setAttribute("aria-label", "Open display settings");
        settingsToggle.focus();
      }
    });
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function generatedMessage() {
    const subject = randomItem(subjects);
    const action = randomItem(actions);
    const result = randomItem(results);
    const dots = ".".repeat(Math.max(3, 39 - action.length - subject.length));
    return `${action} ${subject} ${dots} ${result}`;
  }

  function nextMessage() {
    let message;
    do {
      message = Math.random() < 0.38 ? randomItem(fixedMessages) : generatedMessage();
    } while (message === lastMessage);
    lastMessage = message;
    return message;
  }

  function weightedTransmission() {
    const messages = (window.BITS_MESSAGES ?? []).filter((message) => (
      message && typeof message.text === "string" && Number(message.weight) > 0
    ));
    if (!messages.length) {
      return { text: "the main process is being mysteriously quiet...", weight: 1 };
    }
    const totalWeight = messages.reduce((total, message) => total + Number(message.weight), 0);
    let choice = Math.random() * totalWeight;
    return messages.find((message) => {
      choice -= Number(message.weight);
      return choice <= 0;
    }) ?? messages.at(-1);
  }

  function renderTransmission() {
    let message;
    do {
      message = weightedTransmission();
    } while (message.text === lastTransmission && (window.BITS_MESSAGES?.length ?? 0) > 1);
    lastTransmission = message.text;
    messageOutput.replaceChildren();
    messageOutput.removeAttribute("style");
    if (message.format) {
      Object.entries(message.format).forEach(([property, value]) => {
        if (property in messageOutput.style) {
          messageOutput.style[property] = value;
        }
      });
    }
    if (message.colorful) {
      [...message.text].forEach((character, index) => {
        const span = document.createElement("span");
        span.textContent = character;
        if (character.trim()) {
          span.style.color = `hsl(${(index * 37) % 360} 88% 70%)`;
        }
        messageOutput.append(span);
      });
    } else {
      messageOutput.textContent = message.text;
    }
  }

  function updateElapsed() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    elapsedOutput.textContent = `${hours}:${minutes}:${seconds}`;
  }

  function appendMessage() {
    const item = document.createElement("li");
    item.textContent = nextMessage();
    if (Math.random() < 0.08) {
      item.dataset.state = "warning";
    }
    log.append(item);
    trimLog();
    log.scrollTop = log.scrollHeight;

    count += 1;
    progress += 2 + Math.floor(Math.random() * 7);
    if (progress >= 100) {
      progress %= 100;
      cycle += 1;
      stageOutput.textContent = "BOOT COMPLETE; VERIFYING BOOT COMPLETION";
    } else if (count % 7 === 0) {
      stageOutput.textContent = randomItem(stages);
    }
    countOutput.textContent = String(count).padStart(6, "0");
    cycleOutput.textContent = String(cycle).padStart(4, "0");
    percentOutput.textContent = `${progress}%`;
    progressBar.style.width = `${progress}%`;
    updateElapsed();

    const delay = 90 + Math.floor(Math.random() * 360);
    timer = window.setTimeout(appendMessage, delay);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearTimeout(timer);
    } else {
      appendMessage();
    }
  });
  window.addEventListener("resize", reconcileViewport);
  window.addEventListener("orientationchange", reconcileViewport);
  window.visualViewport?.addEventListener("resize", reconcileViewport);
  window.visualViewport?.addEventListener("scroll", reconcileViewport);

  for (let index = 0; index < 12; index += 1) {
    const item = document.createElement("li");
    item.textContent = nextMessage();
    log.append(item);
    count += 1;
  }
  countOutput.textContent = String(count).padStart(6, "0");
  reconcileViewport();
  initializeThemePicker();
  renderTransmission();
  updateElapsed();
  window.setInterval(updateElapsed, 1000);
  window.setInterval(renderTransmission, 7000);
  appendMessage();
})();
