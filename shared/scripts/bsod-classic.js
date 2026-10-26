(() => {
  const classicThemes = ["windows-31", "windows-95", "windows-xp", "aero-glass"];
  const root = document.documentElement;
  const isClassicTheme = () => classicThemes.includes(root.dataset.interfaceTheme);
  const dateStamp = "3d6dd67c";

  function h(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => {
      if (name === "className") {
        element.className = value;
      } else {
        element.setAttribute(name, value);
      }
    });
    children.flat().forEach((child) => {
      if (child !== null && child !== undefined && child !== false) {
        element.append(child);
      }
    });
    return element;
  }

  const textObserverOptions = { childList: true, characterData: true, subtree: true };
  const kindObserverOptions = { attributes: true, attributeFilter: ["data-kind"] };

  function live(getter, source, options = textObserverOptions) {
    const span = h("span", { className: "bsod-classic-live" });
    const sync = () => {
      const text = getter() ?? "";
      if (span.textContent !== text) {
        span.textContent = text;
      }
    };
    if (source) {
      new MutationObserver(sync).observe(source, options);
    }
    sync();
    return span;
  }

  function mirror(selector, transform = (text) => text) {
    const source = document.querySelector(selector);
    return live(() => (source ? transform(source.textContent.trim()) : ""), source);
  }

  const stripPrefix = (prefix) => (text) => text.replace(prefix, "").trim();

  function troubleshootingLine() {
    return h(
      "p",
      { className: "bsod-classic-link" },
      "For troubleshooting, visit: ",
      h("a", { href: "/useless.html" }, "shortbits.net/useless.html"),
    );
  }

  function promptLine(prompt, action) {
    const cursor = h("span", { className: "bsod-classic-cursor", "aria-hidden": "true" }, "_");
    if (!action) {
      return h("p", { className: "bsod-classic-prompt" }, `${prompt} `, cursor);
    }
    const button = h("button", { className: "bsod-classic-action", type: "button" }, prompt);
    button.addEventListener("click", () => action()?.click());
    return h("p", { className: "bsod-classic-prompt" }, button, " ", cursor);
  }

  function nineX(config) {
    return h(
      "div",
      { className: "bsod-classic-9x" },
      h("p", { className: "bsod-classic-title" }, h("span", {}, config.label ?? " Windows ")),
      h("p", {}, config.lead),
      config.extra?.map((line) => h("p", {}, line)),
      h(
        "div",
        { className: "bsod-classic-bullets" },
        config.bullets.map((line) => h("p", {}, "*  ", line)),
      ),
      config.status ? h("p", { className: "bsod-classic-status", "aria-live": "polite" }, config.status) : null,
      troubleshootingLine(),
      promptLine(config.prompt, config.action),
    );
  }

  function nt(config) {
    return h(
      "div",
      { className: "bsod-classic-nt" },
      h("p", {}, config.lead),
      h("p", { className: "bsod-classic-stop-name" }, config.stopName),
      h("p", {}, config.firstTime),
      config.steps.map((line) => h("p", {}, line)),
      h("p", {}, "Technical information:"),
      h("p", {}, "*** STOP: ", config.stop),
      h(
        "p",
        {},
        "***  ",
        config.driver,
        ` - Address ${config.address} base at ${config.base}, DateStamp ${dateStamp}`,
      ),
      h(
        "div",
        { className: "bsod-classic-dump", "aria-live": "polite" },
        h("p", {}, "Beginning dump of physical memory"),
        config.dump.map((line) => h("p", {}, line)),
      ),
      troubleshootingLine(),
      promptLine(config.prompt, config.action),
    );
  }

  function attach(screen, color, build) {
    if (!screen || screen.querySelector(":scope > .bsod-classic")) {
      return;
    }
    const block = h(
      "div",
      { className: "bsod-classic", "data-bsod-color": color, hidden: "" },
      nineX(build.nineX),
      nt(build.nt),
    );
    screen.append(block);
  }

  const restartSteps = [
    "Check to make sure any new Bits are properly installed. If this is a new installation, ask your hardware or software manufacturer for any Windows updates you might need.",
    "If problems continue, disable or remove any newly installed hardware or software. Disable BIOS memory options such as caching or shadowing, then pretend that helped.",
  ];

  const screens = [];

  const shutdownScreen = document.querySelector("#shutdown-screen");
  if (shutdownScreen) {
    const rebootButton = () => document.querySelector("#reboot-button");
    const shutdownStop = () => mirror("#shutdown-code", stripPrefix(/^STOP CODE:\s*/i));
    attach(shutdownScreen, "blue", {
      nineX: {
        lead: [
          "You closed the internet. A fatal exception 0E has occurred at 0028:C0FFEE00 in VXD INTERNET(01) + 00000B17. ",
          mirror("#shutdown-message"),
          " The current internet will be terminated.",
        ],
        extra: [[
          "Stop code: ", shutdownStop(), ". Links opened: ", mirror("#report-links"),
          ". Commands entered: ", mirror("#report-commands"), ". Productivity: INCONCLUSIVE.",
        ]],
        bullets: [
          "Press any key to undo that immediately.",
          "Press CTRL+ALT+DEL again to restart the internet. You will lose any unsaved Bits in all applications.",
          "Hold B while rebooting to enter setup.",
        ],
        prompt: "Press any key to continue",
        action: rebootButton,
      },
      nt: {
        lead: "A problem has been detected and the internet has been shut down to prevent damage to your Bits.",
        stopName: shutdownStop(),
        firstTime: [
          "If this is the first time you've seen this Stop error screen, reopen the internet. ",
          mirror("#shutdown-message"),
          " If this screen appears again, follow these steps:",
        ],
        steps: [
          [
            "Session report: LINKS OPENED ", mirror("#report-links"),
            ", COMMANDS ENTERED ", mirror("#report-commands"),
            ", AVATAR INCIDENTS ", mirror("#report-avatar"),
            ", SECRETS DISCOVERED ", mirror("#report-secrets"),
            ", PRODUCTIVITY INCONCLUSIVE.",
          ],
          "Check to make sure you actually meant to close the internet. Hold B while restarting to enter setup.",
        ],
        stop: "0x0000000E (0xC0FFEE00, 0x00000002, 0x00000000, 0xF8A1B2C3)",
        driver: "internet.sys",
        address: "F8A1B2C3",
        base: "F8A00000",
        dump: ["Physical memory dump complete.", "Everyone is going to be so mad."],
        prompt: "Press any key to reopen the internet",
        action: rebootButton,
      },
    });
    screens.push({ screen: shutdownScreen, action: rebootButton });
  }

  const kernelPanic = document.querySelector("#kernel-panic");
  if (kernelPanic) {
    const lastLog = () => {
      const log = document.querySelector("#kernel-panic-log");
      return live(() => log?.lastElementChild?.textContent ?? "Debugger called: <panic>", log);
    };
    attach(kernelPanic, "black", {
      nineX: {
        lead: "A fatal exception 06 has occurred at 0028:0B17B175 in VXD KERNEL(01) + 0000B175. BIT_ASSERTION_FAILED: expected 1 or 0, received \"probably\". The kernel encountered a Bit it could not emotionally process.",
        extra: [[lastLog()]],
        bullets: [
          "Press any key to terminate the current panic. The kernel will panic anyway.",
          "Press CTRL+ALT+DEL again to restart your computer. Please do not turn off the internet while it is already off.",
        ],
        status: ["Automatic restart in ", mirror("#kernel-panic-countdown"), " seconds."],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
      nt: {
        lead: "A problem has been detected and the kernel has been shut down to prevent it from emotionally processing any more Bits.",
        stopName: "BIT_ASSERTION_FAILED",
        firstTime: "If this is the first time you've seen this Stop error screen, remain calm while the kernel does not. If this screen appears again, follow these steps:",
        steps: [
          "Expected 1 or 0, received \"probably\". OS version: BitOS 13.37 (Probably Final).",
          ["Automatic restart in ", mirror("#kernel-panic-countdown"), " seconds."],
        ],
        stop: "0x000000B1 (0xFFFFFF80, 0x0B17B175, 0x00000001, 0x00000000)",
        driver: "kernel.sys",
        address: "FFFFFF80",
        base: "0B17B000",
        dump: [[lastLog()]],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
    });
    screens.push({ screen: kernelPanic });
  }

  const blackScreen = document.querySelector("#black-screen");
  if (blackScreen) {
    attach(blackScreen, "black", {
      nineX: {
        lead: "A fatal exception 00 has occurred at 0000:00000000 in VXD NOTHING(00) + 00000000. Your Bits ran into nothing and need to be rediscovered.",
        bullets: [
          "Press any key to look for the missing Bits. There is nothing to find.",
          "Press CTRL+ALT+DEL again to restart reality. You will lose any unsaved nothing in all applications.",
        ],
        status: [mirror("#black-screen-status"), " ", mirror("#black-screen-progress"), " complete."],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
      nt: {
        lead: "A problem has been detected and Windows has been shut down because there was nothing left to display.",
        stopName: "BIT_BUCKET_EMPTY",
        firstTime: "If this is the first time you've seen this Stop error screen, stare into the Bit Bucket. If this screen appears again, follow these steps:",
        steps: [[mirror("#black-screen-status"), " ", mirror("#black-screen-progress"), " complete."]],
        stop: "0x00000000 (0x00000000, 0x00000000, 0x00000000, 0x00000000)",
        driver: "reality.dll",
        address: "00000000",
        base: "00000000",
        dump: ["Physical memory not found. Making some up..."],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
    });
    screens.push({ screen: blackScreen });
  }

  const greenScreen = document.querySelector("#green-screen");
  if (greenScreen) {
    attach(greenScreen, "green", {
      nineX: {
        label: " Windows Insider ",
        lead: ["A fatal exception 0C has occurred at 0028:CA4A4100 in VXD CANARY(03) + 00026052. Your experimental Bits ran into a problem: ", mirror("#green-screen-code"), "."],
        bullets: [
          "Press any key to install an even less stable build.",
          "Press CTRL+ALT+DEL again to restart your computer. You will lose any unsaved features that were not yet features.",
        ],
        status: ["Collecting extremely speculative error info: ", mirror("#green-screen-progress"), " complete."],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
      nt: {
        lead: "A problem has been detected and Windows has been shut down to prevent damage to your experimental Bits.",
        stopName: mirror("#green-screen-code"),
        firstTime: "If this is the first time you've seen this Stop error screen, thank you for testing this without volunteering. If this screen appears again, follow these steps:",
        steps: [
          "Leave the Canary channel. Or don't. Production testing is enabled.",
          ["Collecting extremely speculative error info: ", mirror("#green-screen-progress"), " complete."],
          "Evaluation copy. Build 10.0.26052.bits_canary.241013-0032",
        ],
        stop: "0x0000CA4A (0x00026052, 0x00000003, 0xB17CA4A0, 0x00000000)",
        driver: "definitely-ready-for-production.sys",
        address: "F8C4A410",
        base: "F8C40000",
        dump: ["Physical memory dump complete. Promoting crash to production."],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
    });
    screens.push({ screen: greenScreen });
  }

  const redScreen = document.querySelector("#red-screen");
  if (redScreen) {
    attach(redScreen, "red", {
      nineX: {
        lead: "A fatal exception 0D has occurred at 0028:B17B17B1 in VXD USERNAME(10) + 0000000A. TOO MANY BITS. The username exceeded the maximum safe quantity of Bits and the current application will be terminated.",
        bullets: [
          "Press any key to remove some Bits. This will not help.",
          "Press CTRL+ALT+DEL again to restart your computer. You will lose any unsaved Bits of Bits of Bits in all applications.",
        ],
        status: ["Collecting loose Bits: ", mirror("#red-screen-progress"), ". Automatic reboot in ", mirror("#red-screen-countdown"), " seconds."],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
      nt: {
        lead: "A problem has been detected and Windows has been shut down to prevent further recursion of Bits.",
        stopName: "BIT_OF_BIT_OF_BIT_OVERFLOW",
        firstTime: "If this is the first time you've seen this Stop error screen, stop clicking the username. If this screen appears again, follow these steps:",
        steps: [
          "Check to make sure the username contains a reasonable number of Bits. Added Bits: 10 / 10.",
          ["Collecting loose Bits: ", mirror("#red-screen-progress"), ". Automatic reboot in ", mirror("#red-screen-countdown"), " seconds."],
        ],
        stop: "0x000000BB (0xB17B17B1, 0x0000000A, 0x0000000A, 0x00000000)",
        driver: "username-expander.exe",
        address: "F8B17B17",
        base: "F8B10000",
        dump: ["Physical memory dump complete. Too many Bits to count."],
        prompt: "Restarting automatically. Press any key to feel involved",
      },
    });
    screens.push({ screen: redScreen });
  }

  const virusScreen = document.querySelector("#virus-screen");
  if (virusScreen) {
    const recoverButton = () => document.querySelector("#virus-screen-recover");
    attach(virusScreen, "purple", {
      nineX: {
        label: " BitProtector ",
        lead: ["A fatal exception 0F has occurred at 0028:DEADB175 in VXD COMMON_SENSE(01) + 0000BAD5. ", mirror("#virus-screen-copy"), " The current application has been infected and will be terminated."],
        bullets: [
          "Press any key to quarantine the virus and restart.",
          "Press CTRL+ALT+DEL again to restart your computer. You will lose any unsaved toolbars in all applications.",
        ],
        status: ["Quarantining suspicious Bits: ", mirror("#virus-screen-progress")],
        prompt: "Press any key to continue",
        action: recoverButton,
      },
      nt: {
        lead: "A problem has been detected and Windows has been shut down because your Bits connected to something they should not have.",
        stopName: "UNPROTECTED_BIT_EXPOSURE",
        firstTime: ["If this is the first time you've seen this Stop error screen, stop joining free Wi-Fi. ", mirror("#virus-screen-copy"), " If this screen appears again, follow these steps:"],
        steps: [
          "Disconnect from any extremely trustworthy networks. Run BitProtector. Ignore BitProtector.",
          ["Quarantining suspicious Bits: ", mirror("#virus-screen-progress")],
        ],
        stop: "0x000000F0 (0xDEADB175, 0x0000BAD5, 0x00000001, 0x00000000)",
        driver: "common_sense.sys",
        address: "F8DEAD00",
        base: "F8DE0000",
        dump: ["Physical memory dump complete. Several browser toolbars were also dumped."],
        prompt: "Press any key to quarantine and restart",
        action: recoverButton,
      },
    });
    screens.push({ screen: virusScreen, action: recoverButton });
  }

  const bootCrash = document.querySelector("#endless-boot-crash");
  if (bootCrash) {
    const kinds = {
      blue: { exception: "0E", address: "0028:B007B007", vxd: "ENDLESS(01) + 0000B007", stop: "0x0000B007" },
      black: { exception: "00", address: "0000:00000000", vxd: "NOTHING(00) + 00000000", stop: "0x00000000" },
      green: { exception: "0C", address: "0028:CA4A4B00", vxd: "CANARY(03) + 00026052", stop: "0x0000CA4A" },
      red: { exception: "0D", address: "0028:F14EB007", vxd: "POST(10) + 0000F14E", stop: "0x000000BB" },
      purple: { exception: "0F", address: "0028:DEADB007", vxd: "BOOTKIT(01) + 0000BAD5", stop: "0x000000F0" },
    };
    const kindInfo = () => kinds[bootCrash.dataset.kind] ?? kinds.blue;
    const kindLive = (getter) => live(() => getter(kindInfo()), bootCrash, kindObserverOptions);
    const fault = () => mirror("#endless-boot-crash-fault", stripPrefix(/^FAULT:\s*/i));
    const progress = () => mirror("#endless-boot-crash-progress");
    const copy = () => mirror("#endless-boot-crash-copy");
    attach(bootCrash, "blue", {
      nineX: {
        lead: [
          "A fatal exception ", kindLive((info) => info.exception), " has occurred at ",
          kindLive((info) => info.address), " in VXD ", kindLive((info) => info.vxd), ". ",
          mirror("#endless-boot-crash-title"), " The current boot will be terminated, then started again.",
        ],
        extra: [["Stop code: ", mirror("#endless-boot-crash-code"), ". What failed: ", fault(), "."]],
        bullets: [
          "Press any key to terminate the current boot. It will boot again anyway.",
          "Press CTRL+ALT+DEL again to restart your computer. You will lose any unsaved progress bars in all applications.",
        ],
        status: [copy(), " Recovery progress: ", progress()],
        prompt: "Resuming endless boot automatically. Press any key to feel involved",
      },
      nt: {
        lead: "A problem has been detected and the endless boot has been shut down to prevent it from finishing.",
        stopName: mirror("#endless-boot-crash-code"),
        firstTime: ["If this is the first time you've seen this Stop error screen, restart your computer. It is already restarting. ", mirror("#endless-boot-crash-title"), " If this screen appears again, follow these steps:"],
        steps: [restartSteps[0], [copy(), " Recovery progress: ", progress()]],
        stop: [kindLive((info) => info.stop), " (0x00000B17, 0x00000000, 0xB0070000, 0x00000000)"],
        driver: fault(),
        address: "F8B00700",
        base: "F8B00000",
        dump: ["Physical memory dump complete. Resuming endless boot."],
        prompt: "Resuming endless boot automatically. Press any key to feel involved",
      },
    });
    screens.push({ screen: bootCrash });
  }

  const isVisible = (screen) => !screen.hidden;

  screens.forEach(({ screen, action }) => {
    if (!action) {
      return;
    }
    new MutationObserver(() => {
      if (isVisible(screen) && isClassicTheme()) {
        const target = [...screen.querySelectorAll(".bsod-classic-action")]
          .find((button) => button.offsetParent !== null);
        target?.focus();
      }
    }).observe(screen, { attributes: true, attributeFilter: ["hidden"] });
  });

  const ignoredKeys = new Set(["Shift", "Control", "Alt", "Meta", "Tab", "CapsLock", "Fn", "Dead", "Unidentified"]);
  document.addEventListener("keydown", (event) => {
    if (!isClassicTheme() || event.repeat || ignoredKeys.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const active = screens.find(({ screen, action }) => action && isVisible(screen));
    if (!active) {
      return;
    }
    if (
      event.target instanceof Element
      && event.target.closest(".bsod-classic-action, .bsod-classic a")
      && (event.key === "Enter" || event.key === " ")
    ) {
      return;
    }
    event.preventDefault();
    active.action()?.click();
  });
})();
