(() => {
  function initialize({ interfaceThemes, setRgbMode, hasReducedMotionPreference, releaseBit }) {
    const fakeDesktop = document.querySelector("#fake-desktop");
    const interfaceShell = document.querySelector("#interface-shell");
    const minimizeButton = document.querySelector("#minimize-button");
    const processTitle = document.querySelector("#process-title");
    const statusText = document.querySelector("#status-text");
    const fakeDesktopRestore = document.querySelector("#fake-desktop-restore");
    const fakeDesktopClock = document.querySelector("#fake-desktop-clock");
    const fakeRecycleBin = document.querySelector("#fake-recycle-bin");
    const fakeRecycleIcon = document.querySelector("#fake-recycle-icon");
    const fakeRecycleLabel = document.querySelector("#fake-recycle-label");
    const fakePlayingDead = document.querySelector("#fake-playing-dead");
    const fakePlayingDeadClose = document.querySelector("#fake-playing-dead-close");
    const fakePlayingDeadMessage = document.querySelector("#fake-playing-dead-message");
    const fakeTaskManagerLaunch = document.querySelector("#fake-task-manager-launch");
    const fakeTaskManager = document.querySelector("#fake-task-manager");
    const fakeTaskManagerStatus = document.querySelector("#fake-task-manager-status");
    const fakeVpnAd = document.querySelector("#fake-vpn-ad");
    const fakeVpnHeading = document.querySelector("#fake-vpn-heading");
    const fakeVpnCopy = document.querySelector("#fake-vpn-copy");
    const fakeVpnInstall = document.querySelector("#fake-vpn-install");
    const fakeVpnDecline = document.querySelector("#fake-vpn-decline");
    let fakeVpnInstallTimer;
    const fakeActionCenterTrigger = document.querySelector("#fake-action-center-trigger");
    const fakeActionCenter = document.querySelector("#fake-action-center");
    const fakeActionCenterStatus = document.querySelector("#fake-action-center-status");
    const fakeActionNotification = document.querySelector(".fake-action-notification");
    const fakeActionNotificationTitle = document.querySelector("#fake-action-notification-title");
    const fakeActionNotificationCopy = document.querySelector("#fake-action-notification-copy");
    const fakeActionNotificationDismiss = document.querySelector("#fake-action-notification-dismiss");
    const fakeWifiPickerTrigger = document.querySelector("#fake-wifi-picker-trigger");
    const fakeWifiPicker = document.querySelector("#fake-wifi-picker");
    const fakeWifiPickerBack = document.querySelector("#fake-wifi-picker-back");
    const fakeWifiCurrent = document.querySelector("#fake-wifi-current");
    const fakeArgSignal = document.querySelector("#fake-arg-signal");
    const fakeArgSignalLabel = document.querySelector("#fake-arg-signal-label");
    const fakeArgProcess = document.querySelector("#fake-arg-process");
    const fakeArgProcessCpu = document.querySelector("#fake-arg-process-cpu");
    const fakeArgProcessInspect = document.querySelector("#fake-arg-process-inspect");
    const fakeArgAction = document.querySelector("#fake-arg-action");
    const fakeArgActionCopy = document.querySelector("#fake-arg-action-copy");
    const virusScreen = document.querySelector("#virus-screen");
    const virusScreenCopy = document.querySelector("#virus-screen-copy");
    const virusScreenProgress = document.querySelector("#virus-screen-progress");
    const virusScreenMeterFill = document.querySelector("#virus-screen-meter-fill");
    const virusScreenRecover = document.querySelector("#virus-screen-recover");

    function setFakeDesktopVisible(visible) {
      fakeDesktop.hidden = !visible;
      if (visible) {
        updateFakeDesktopClock();
      }
      document.body.classList.toggle("has-fake-desktop", visible);
      if (!visible) {
        closePlayingDeadProcess();
        closeFakeDesktopApps();
      }
      syncDesktopThemeFallback();
      syncDesktopWorkspaceEntry();
      window.dispatchEvent(new CustomEvent("bits:desktop-visibility"));
    }

    let desktopFallbackThemeId = "";
    let isApplyingDesktopFallback = false;
    let desktopWorkspaceLoading = false;

    function syncDesktopWorkspaceEntry() {
      const theme = window.BITS_THEME_PREFERENCE?.getTheme(document.documentElement.dataset.interfaceTheme);
      const available = Boolean(theme?.experimental && theme.desktopCapable && fakeDesktop.hidden);
      document.body.classList.toggle("has-workspace-entry", available);
      let entry = document.querySelector("#desktop-workspace-entry");
      if (!entry && available) {
        entry = document.createElement("button");
        entry.id = "desktop-workspace-entry";
        entry.type = "button";
        entry.textContent = "Open workspace";
        entry.addEventListener("click", () => minimizeButton.click());
        document.body.append(entry);
      }
      if (entry) entry.hidden = !available;
    }

    async function loadDesktopWorkspace() {
      if (window.BITS_DESKTOP_WORKSPACE || desktopWorkspaceLoading) return;
      desktopWorkspaceLoading = true;
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "/online/styles/desktop-workspaces.css?v=workspace-1";
      const script = document.createElement("script");
      script.src = "/online/scripts/desktop-workspaces.js?v=workspace-1";
      const load = (element) => new Promise((resolve, reject) => {
        element.addEventListener("load", resolve, { once: true });
        element.addEventListener("error", () => reject(new Error(`Unable to load ${element.href || element.src}`)), { once: true });
        document.head.append(element);
      });
      try {
        await load(stylesheet);
        await load(script);
        document.querySelector("#desktop-workspace-error")?.remove();
      } catch (error) {
        stylesheet.remove();
        script.remove();
        console.error("Unable to load the experimental desktop workspace:", error);
        let notice = document.querySelector("#desktop-workspace-error");
        if (!notice) {
          notice = document.createElement("p");
          notice.id = "desktop-workspace-error";
          notice.setAttribute("role", "alert");
          notice.append("The experimental workspace could not load. The regular desktop is still available. ");
          const retry = document.createElement("button");
          retry.type = "button";
          retry.textContent = "Retry workspace";
          retry.addEventListener("click", loadDesktopWorkspace);
          notice.append(retry);
          fakeDesktop.prepend(notice);
        }
      } finally {
        desktopWorkspaceLoading = false;
      }
    }

    function syncDesktopThemeFallback() {
      const preference = window.BITS_THEME_PREFERENCE;
      if (!preference?.getTheme || isApplyingDesktopFallback) {
        return;
      }
      const desktopVisible = !fakeDesktop.hidden;
      const activeTheme = preference.getTheme(document.documentElement.dataset.interfaceTheme);
      if (desktopVisible && activeTheme?.experimental && activeTheme.desktopCapable) {
        loadDesktopWorkspace();
      }
      isApplyingDesktopFallback = true;
      try {
        if (desktopVisible && activeTheme?.experimental && !activeTheme.desktopCapable) {
          const fallbackTheme = preference.getTheme(preference.getLastStandard())
            ?? interfaceThemes[0];
          desktopFallbackThemeId = activeTheme.id;
          preference.apply(fallbackTheme.id);
          setRgbMode(fallbackTheme.id === "rgb");
          window.BITS_NOTIFICATIONS?.notify({
            title: "EXPERIMENTAL THEME PAUSED",
            message: `${activeTheme.name} doesn't fit the BITS OS desktop, so ${fallbackTheme.name} is shown here. It comes back when you leave the desktop.`,
            type: "info",
          });
          return;
        }
        if (!desktopVisible && desktopFallbackThemeId) {
          const restoreThemeId = desktopFallbackThemeId;
          desktopFallbackThemeId = "";
          if (preference.resolve() === restoreThemeId) {
            preference.apply(restoreThemeId);
            setRgbMode(false);
            window.BITS_NOTIFICATIONS?.notify({
              title: "EXPERIMENTAL THEME RESTORED",
              message: `${preference.getTheme(restoreThemeId)?.name ?? "The experimental"} layout is back.`,
              type: "info",
            });
          }
        }
      } finally {
        isApplyingDesktopFallback = false;
      }
    }

    window.addEventListener("bits:theme-applied", () => {
      syncDesktopWorkspaceEntry();
      if (document.documentElement.dataset.interfaceTheme === "rgb") {
        setRgbMode(true);
      }
      if (!fakeDesktop.hidden) {
        window.setTimeout(syncDesktopThemeFallback, 0);
      }
    });
    syncDesktopWorkspaceEntry();

    const basePlayingDeadMessages = [
      "The process is extremely committed to the bit.",
      "Please stop checking. It is doing its best.",
      "playing_dead.exe has declined to comment.",
      "The process moved slightly when nobody was looking.",
      "Diagnostic result: suspiciously alive for something this dead.",
    ];
    window.BITS_MESSAGE_CATALOG?.bind("standard", "playingDeadMessages", basePlayingDeadMessages);
    const seasonalDesktopProfile = window.BITS_SEASONAL_PROFILE;
    const seasonalPlayingDeadMessages = seasonalDesktopProfile?.playingDeadMessages ?? [];
    const playingDeadMessages = seasonalDesktopProfile?.mode === "exclusive" && seasonalPlayingDeadMessages.length
      ? seasonalPlayingDeadMessages
      : [...basePlayingDeadMessages, ...seasonalPlayingDeadMessages];
    const baseGlitchMessages = [
      "THR3AT NAM3: fr33_b1ts_final_FINAL.exe // PLEASE PANIC NORMALLY",
      "M3M0RY LEAK DETECTED: several memories now belong to the toolbar",
      "QUARANTINE STATUS: YES // NO // FILE NOT EMOTIONALLY AVAILABLE",
    ];
    const baseNotificationMessages = [
      "Notification dismissed\nBITS OS noticed. No action is required. Yet.",
      "Reminder about your dismissed reminder\nThis notification is much more important because it is newer.",
      "Final notification (2 of 7)\nPlease stop proving that the dismiss button works.",
      "Dismissal appeal received\nYour request has been forwarded to the notification you just dismissed.",
      "Task failed successfully\nThe notification was closed. A replacement has been dispatched.",
      "We have been trying to reach you\nAbout your desktop's extended notification warranty.",
      "Achievement unlocked: click again\nYour reward is another notification.",
      "This could have been an email\nUnfortunately, the email also became a notification.",
      "Notification recycling enabled\nThank you for keeping this popup out of the landfill.",
      "You are now on mute\nNot me. You. I am still talking.",
      "One more thing\nThere will be one more thing after this one more thing.",
      "Your feedback matters\nWe interpreted that click as a request for more popups.",
      "Background process promoted\nThis notification has decided to become a foreground problem.",
      "Snooze button on vacation\nPlease enjoy this complimentary awake button.",
      "Dismissal speedrun detected\nThe world record is still held by someone with notifications disabled.",
    ];
    window.BITS_MESSAGE_CATALOG?.bind("standard", "notificationMessages", baseNotificationMessages);
    window.BITS_MESSAGE_CATALOG?.bind("standard", "glitchMessages", baseGlitchMessages);
    const seasonalGlitchMessages = seasonalDesktopProfile?.glitchMessages ?? [];
    const glitchMessages = seasonalDesktopProfile?.mode === "exclusive" && seasonalGlitchMessages.length
      ? seasonalGlitchMessages
      : seasonalGlitchMessages.length
        ? [seasonalGlitchMessages[0], baseGlitchMessages[1], seasonalGlitchMessages.at(-1)]
        : baseGlitchMessages;
    window.addEventListener("bits:messages-updated", () => {
      const profile = window.BITS_SEASONAL_PROFILE;
      const dead = profile?.playingDeadMessages ?? [];
      const glitch = profile?.glitchMessages ?? [];
      const nextDead = profile?.mode === "exclusive" && dead.length ? dead : [...basePlayingDeadMessages, ...dead];
      const nextGlitch = profile?.mode === "exclusive" && glitch.length ? glitch : glitch.length
        ? [glitch[0], baseGlitchMessages[1] ?? baseGlitchMessages[0], glitch.at(-1)] : [...baseGlitchMessages];
      playingDeadMessages.splice(0, playingDeadMessages.length, ...nextDead);
      glitchMessages.splice(0, glitchMessages.length, ...nextGlitch);
    });
    let playingDeadChecks = 0;

    function closePlayingDeadProcess() {
      fakePlayingDead.hidden = true;
      fakeRecycleBin.classList.remove("is-playing-dead");
      fakeRecycleIcon.textContent = "⌫";
      fakeRecycleLabel.textContent = "RECYCLE.BIN";
    }

    function inspectPlayingDeadProcess() {
      const message = playingDeadMessages[
        Math.min(playingDeadChecks, playingDeadMessages.length - 1)
      ];
      playingDeadChecks += 1;
      fakeRecycleBin.classList.add("is-playing-dead");
      fakeRecycleIcon.textContent = "[x_x]";
      fakeRecycleLabel.textContent = "playing_dead.exe";
      window.BITS_MESSAGE_TEXT.render(fakePlayingDeadMessage, message, {
        suffix: playingDeadChecks > playingDeadMessages.length ? ` Check #${playingDeadChecks} has changed nothing.` : "",
      });
      fakePlayingDead.hidden = false;
      fakePlayingDeadClose.focus();
    }

    function closeFakeDesktopApps() {
      [fakeTaskManager, fakeVpnAd].forEach((app) => {
        app.hidden = true;
      });
      coBitsSystem.close();
      fakeActionCenter.hidden = true;
      fakeWifiPicker.hidden = true;
      fakeWifiPickerTrigger.setAttribute("aria-expanded", "false");
      fakeActionCenterTrigger.setAttribute("aria-expanded", "false");
    }

    function openFakeDesktopApp(app, focusTarget) {
      closePlayingDeadProcess();
      closeFakeDesktopApps();
      app.hidden = false;
      focusTarget.focus();
    }

    const coBitsSystem = window.BITS_COBITS.initialize({
      openApp: (app, focusTarget) => openFakeDesktopApp(app, focusTarget),
    });

    function restoreInterfaceFromDesktop() {
      interfaceShell.classList.remove("is-minimized");
      minimizeButton.setAttribute("aria-label", "Minimize interface");
      processTitle.textContent = "~/internet/presence.exe";
      statusText.textContent = "ONLINE";
      setFakeDesktopVisible(false);
      minimizeButton.focus();
    }

    function syncFakeDesktopArg(snapshot = window.BITS_ARG?.getState()) {
      if (!snapshot) {
        return;
      }
      const started = snapshot.discovered.length > 0;
      fakeArgSignal.hidden = !started;
      fakeArgProcess.hidden = !started;
      fakeArgAction.hidden = !started;

      if (!started) {
        fakeTaskManagerStatus.textContent =
          "4 processes require varying amounts of supervision.";
        return;
      }

      if (fakeTaskManagerStatus.textContent.startsWith("4 processes require")) {
        fakeTaskManagerStatus.textContent =
          "5 processes detected. One process does not have a valid allocation record.";
      }
      fakeArgSignal.classList.toggle("is-reconstructed", snapshot.reconstructed);
      fakeArgSignalLabel.textContent = snapshot.reconstructed
        ? "PROCESS_000"
        : "UNALLOCATED.BIT";
      fakeArgProcessCpu.textContent = snapshot.reconstructed ? "1%" : "0%";
      fakeArgActionCopy.textContent = snapshot.outcome
        ? `Containment outcome: ${snapshot.outcome.toUpperCase()}. Revision remains possible.`
        : snapshot.reconstructed
          ? "PROCESS_000 is requesting a containment decision."
          : `${snapshot.discovered.length}/${snapshot.total} fragments recovered. Trace remains incomplete.`;
    }

    function inspectFakeDesktopArg(source) {
      window.BITS_ARG?.open();
      if (source === "task-manager") {
        fakeTaskManagerStatus.textContent =
          "PROCESS_000 handed to TRACE.EXE. Task termination unavailable.";
      } else if (source === "action-center") {
        fakeActionCenterStatus.textContent =
          "Recovery signal transferred to TRACE.EXE.";
      }
    }

    let fakeDesktopClockFormatter;

    function updateFakeDesktopClock() {
      if (fakeDesktop.hidden || document.hidden) {
        return;
      }
      const now = new Date();
      fakeDesktopClock.dateTime = now.toISOString();
      fakeDesktopClockFormatter ??= new Intl.DateTimeFormat(undefined, {
        hour: "2-digit", minute: "2-digit",
      });
      fakeDesktopClock.textContent = fakeDesktopClockFormatter.format(now);
    }

    fakeDesktopRestore.addEventListener("click", restoreInterfaceFromDesktop);
    fakeRecycleBin.addEventListener("click", inspectPlayingDeadProcess);
    fakePlayingDeadClose.addEventListener("click", () => {
      closePlayingDeadProcess();
      fakeRecycleBin.focus();
    });
    fakeTaskManagerLaunch.addEventListener("click", () => {
      openFakeDesktopApp(
        fakeTaskManager,
        fakeTaskManager.querySelector("[data-fake-app-close]"),
      );
    });
    fakeArgSignal.addEventListener("click", () => {
      inspectFakeDesktopArg("desktop");
    });
    fakeArgProcessInspect.addEventListener("click", () => {
      inspectFakeDesktopArg("task-manager");
    });
    fakeArgAction.addEventListener("click", () => {
      inspectFakeDesktopArg("action-center");
    });
    document.querySelectorAll("[data-fake-app-close]").forEach((button) => {
      button.addEventListener("click", () => {
        const app = button.closest(".fake-desktop-app");
        if (app === fakeVpnAd) {
          window.clearTimeout(fakeVpnInstallTimer);
        }
        app.hidden = true;
      });
    });
    document.querySelectorAll("[data-end-fake-process]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".fake-process-row");
        const processName = row.dataset.fakeProcess;
        if (button.dataset.protected === "true") {
          fakeTaskManagerStatus.textContent =
            "ACCESS DENIED: Ending presence.exe would make this interface inconveniently absent.";
          return;
        }
        row.classList.add("is-ended");
        row.children[1].textContent = "0%";
        row.children[2].textContent = "0 MB";
        button.textContent = "ENDED";
        button.disabled = true;
        fakeTaskManagerStatus.textContent =
          `${processName} ended. It will pretend not to restart later.`;
      });
    });
    fakeActionCenterTrigger.addEventListener("click", () => {
      const willOpen = fakeActionCenter.hidden;
      fakeActionCenter.hidden = !willOpen;
      fakeActionCenterTrigger.setAttribute("aria-expanded", String(willOpen));
    });
    const actionCenterMessages = {
      wifi: {
        on: "WI-FI-ish enabled. Use the arrow to choose a questionable network.",
        off: "WI-FI-ish disabled. You are now connected to the concept of offline.",
      },
      night: {
        on: "NIGHT BITS enabled. The desktop is wearing tiny sunglasses.",
        off: "NIGHT BITS disabled. The Bits must face the light.",
      },
      dnd: {
        on: "DO NOT DISTURB enabled. Notifications will now disturb you quietly.",
        off: "DO NOT DISTURB disabled. The system has resumed craving attention.",
      },
      chaos: {
        on: "CHAOS GUARD enabled. Chaos has signed the compliance form.",
        off: "CHAOS GUARD disabled. This was almost certainly a deliberate choice.",
      },
    };
    let chaosGuardDisables = 0;
    let dismissedActionNotifications = 0;
    let suppressedActionNotifications = 0;
    let actionNotificationTimer;
    let connectedWifiNetwork = "BITS_LAN";
    let connectedWifiSignal = "Excellent";
    let virusScreenTimer;
    let virusScreenPreviousFocus;
    let virusNetworkName = "";
    let virusTriggerTimer;
    let virusTextTimer;

    function isActionCenterEnabled(name) {
      return fakeActionCenter.querySelector(
        `[data-action-center-control="${name}"]`,
      ).getAttribute("aria-pressed") === "true";
    }

    function setActionCenterNotification(title, copy) {
      if (isActionCenterEnabled("dnd")) {
        suppressedActionNotifications += 1;
        return;
      }
      window.clearTimeout(actionNotificationTimer);
      fakeActionNotificationTitle.textContent = title;
      fakeActionNotificationCopy.textContent = copy;
      fakeActionNotification.hidden = false;
    }

    function setWifiPickerOpen(open) {
      fakeWifiPicker.hidden = !open;
      fakeWifiPickerTrigger.setAttribute("aria-expanded", String(open));
      if (open) {
        fakeWifiPickerBack.focus();
      } else {
        fakeWifiPickerTrigger.focus();
      }
    }

    function updateWifiPickerAvailability() {
      const enabled = isActionCenterEnabled("wifi");
      fakeWifiPicker.querySelectorAll("[data-wifi-network]").forEach((button) => {
        button.disabled = !enabled;
      });
      fakeWifiCurrent.textContent = enabled
        ? connectedWifiNetwork
          ? `Connected: ${connectedWifiNetwork} // Signal: ${connectedWifiSignal}`
          : "WI-FI-ish is on // Select a network"
        : "WI-FI-ish is off";
    }

    function recoverFromVirusScreen() {
      window.clearInterval(virusScreenTimer);
      window.clearTimeout(virusTextTimer);
      virusScreen.hidden = true;
      virusScreen.classList.remove("is-glitch-spike");
      document.body.classList.remove("is-virus-screen");
      document.title = "BitsofBitsofBits // BITSOFWEBSITE";
      virusScreenProgress.textContent = "0%";
      virusScreenMeterFill.style.width = "0%";
      connectedWifiNetwork = "";
      connectedWifiSignal = "";
      fakeWifiPicker.querySelectorAll("[data-wifi-network]").forEach((network) => {
        network.classList.remove("is-connected");
      });
      updateWifiPickerAvailability();
      fakeActionCenterStatus.textContent =
        `${virusNetworkName} quarantined. WI-FI-ish remains on but wisely disconnected.`;
      window.BITS_ACHIEVEMENTS.unlock(
        "wifi-virus",
        "ANTIVIRUS ANTIBODY",
        "QUESTIONABLE NETWORK SURVIVED",
      );
      window.dispatchEvent(new CustomEvent("bits:death-screen-survived", {
        detail: { screen: "virus" },
      }));
      setActionCenterNotification(
        "Threat quarantined",
        `${virusNetworkName} has been blocked until someone forgets why.`,
      );
      virusScreenPreviousFocus?.focus();
    }

    function triggerVirusScreen(networkName) {
      if (!virusScreen.hidden) {
        return;
      }
      virusNetworkName = networkName;
      virusScreenPreviousFocus = document.activeElement;
      let progress = 0;
      virusScreenCopy.textContent =
        `${networkName} installed a complimentary virus and several browser toolbars.`;
      virusScreenProgress.textContent = "0%";
      virusScreenMeterFill.style.width = "0%";
      document.body.classList.add("is-virus-screen");
      document.title = "BITPROTECTOR // VERY CONCERNED";
      virusScreen.hidden = false;
      virusScreen.focus();
      window.clearInterval(virusScreenTimer);
      virusScreenTimer = window.setInterval(() => {
        progress = Math.min(100, progress + 10);
        virusScreenProgress.textContent = `${progress}%`;
        virusScreenMeterFill.style.width = `${progress}%`;
        if (progress > 0 && progress < 100 && progress % 30 === 0) {
          window.BITS_MESSAGE_TEXT.render(virusScreenCopy,
            glitchMessages[(progress / 30 - 1) % glitchMessages.length]);
          virusScreen.classList.add("is-glitch-spike");
          window.clearTimeout(virusTextTimer);
          virusTextTimer = window.setTimeout(() => {
            virusScreenCopy.textContent =
              `${networkName} installed a complimentary virus and several browser toolbars.`;
            virusScreen.classList.remove("is-glitch-spike");
          }, 240);
        }
        if (progress >= 100) {
          recoverFromVirusScreen();
        }
      }, 700);
    }

    function openFakeVpnAd() {
      window.clearTimeout(fakeVpnInstallTimer);
      fakeVpnHeading.textContent =
        "Protect your Bits before someone sees all of them.";
      fakeVpnCopy.textContent =
        "FREE_PUBLIC_WIFI recommends BitShield VPN, the only VPN brave enough to advertise on FREE_PUBLIC_WIFI.";
      fakeVpnInstall.textContent = "INSTALL DEFINITELY SECURE VPN";
      fakeVpnInstall.disabled = false;
      fakeVpnDecline.textContent = "NO THANKS, I PREFER DANGER";
      openFakeDesktopApp(fakeVpnAd, fakeVpnInstall);
    }

    function reactToActionCenterControl(name, pressed) {
      fakeActionCenterStatus.textContent =
        actionCenterMessages[name][pressed ? "on" : "off"];

      if (name === "wifi") {
        if (!pressed) {
          connectedWifiNetwork = "";
          setWifiPickerOpen(false);
        }
        updateWifiPickerAvailability();
      }
      if (name === "night") {
        fakeDesktop.classList.toggle("has-night-bits", pressed);
      }
      if (name === "dnd" && !pressed && suppressedActionNotifications > 0) {
        const count = suppressedActionNotifications;
        suppressedActionNotifications = 0;
        setActionCenterNotification(
          `${count} notification${count === 1 ? "" : "s"} heroically suppressed`,
          "None of them were important, which has never stopped BITS OS.",
        );
      }
      if (name === "chaos" && !pressed) {
        chaosGuardDisables += 1;
        fakeDesktop.classList.remove("is-action-chaotic");
        window.requestAnimationFrame(() => {
          fakeDesktop.classList.add("is-action-chaotic");
        });
        window.setTimeout(() => {
          fakeDesktop.classList.remove("is-action-chaotic");
        }, 700);
        if (!hasReducedMotionPreference()) {
          for (let index = 0; index < 12; index += 1) {
            window.setTimeout(releaseBit, index * 35);
          }
        }
        if (chaosGuardDisables >= 3) {
          window.BITS_ACHIEVEMENTS.unlock(
            "chaos-unguarded",
            "SAFETY THIRD",
            "CHAOS GUARD HAS LEFT THE CHAT",
          );
          setActionCenterNotification(
            "Chaos is now self-governing",
            "It has promised to hold free and fair elections.",
          );
        }
      }

      const controls = [...fakeActionCenter.querySelectorAll(
        "[data-action-center-control]",
      )];
      if (controls.every((control) => control.getAttribute("aria-pressed") === "false")) {
        window.BITS_ACHIEVEMENTS.unlock(
          "action-airgap",
          "OFF THE GRID",
          "ALL CONVENIENCES SUCCESSFULLY DISABLED",
        );
        fakeActionCenterStatus.textContent =
          "AIRGAP COMPLETE. BITS OS can no longer reach even itself.";
      }
    }

    fakeActionCenter.querySelectorAll("[data-action-center-control]").forEach((button) => {
      button.addEventListener("click", () => {
        const pressed = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(pressed));
        reactToActionCenterControl(button.dataset.actionCenterControl, pressed);
      });
    });
    fakeWifiPickerTrigger.addEventListener("click", () => {
      updateWifiPickerAvailability();
      setWifiPickerOpen(fakeWifiPicker.hidden);
    });
    fakeWifiPickerBack.addEventListener("click", () => {
      setWifiPickerOpen(false);
    });
    fakeWifiPicker.querySelectorAll("[data-wifi-network]").forEach((button) => {
      button.addEventListener("click", () => {
        const networkName = button.dataset.wifiNetwork;
        const outcome = button.dataset.networkOutcome;
        connectedWifiNetwork = networkName;
        connectedWifiSignal = button.dataset.signal;
        fakeWifiPicker.querySelectorAll("[data-wifi-network]").forEach((network) => {
          network.classList.toggle("is-connected", network === button);
        });
        fakeWifiCurrent.textContent =
          `Connected: ${networkName} // Signal: ${button.dataset.signal}`;
        fakeActionCenterStatus.textContent =
          `Connected to ${networkName}. Signal strength: ${button.dataset.signal.toLowerCase()}.`;
        setActionCenterNotification(
          `Connected to ${networkName}`,
          outcome === "vpn-ad"
            ? "This free connection is supported by several unavoidable sponsors."
            : button.dataset.virus === "true"
              ? "BitProtector is checking this connection. It seems nervous."
            : "No immediate disasters detected.",
        );
        if (outcome === "vpn-ad") {
          window.setTimeout(openFakeVpnAd, 700);
        } else if (button.dataset.virus === "true") {
          window.clearTimeout(virusTriggerTimer);
          virusTriggerTimer = window.setTimeout(() => triggerVirusScreen(networkName), 900);
        }
      });
    });
    fakeVpnInstall.addEventListener("click", () => {
      fakeVpnInstall.disabled = true;
      fakeVpnInstall.textContent = "INSTALLING TRUST...";
      fakeVpnInstallTimer = window.setTimeout(() => {
        fakeVpnHeading.textContent = "Your Bits are now protected-ish.";
        fakeVpnCopy.textContent =
          "BitShield VPN moved your internet traffic behind a very convincing shield icon.";
        fakeVpnInstall.textContent = "PROTECTED-ISH";
        fakeVpnDecline.textContent = "CLOSE THIS EXTREMELY SECURE WINDOW";
        setActionCenterNotification(
          "BitShield VPN installed",
          "Your IP address is now wearing a small disguise.",
        );
      }, 900);
    });
    fakeVpnDecline.addEventListener("click", () => {
      window.clearTimeout(fakeVpnInstallTimer);
      fakeVpnAd.hidden = true;
      fakeActionCenterStatus.textContent =
        "BitShield VPN declined. FREE_PUBLIC_WIFI is judging your risk tolerance.";
    });
    virusScreenRecover.addEventListener("click", recoverFromVirusScreen);
    fakeActionNotificationDismiss.addEventListener("click", () => {
      dismissedActionNotifications += 1;
      fakeActionNotification.hidden = true;
      window.clearTimeout(actionNotificationTimer);
      actionNotificationTimer = window.setTimeout(() => {
        const profile = window.BITS_SEASONAL_PROFILE;
        const seasonal = profile?.notificationMessages ?? [];
        const pool = profile?.mode === "exclusive" && seasonal.length
          ? seasonal : [...baseNotificationMessages, ...seasonal];
        const message = pool[(dismissedActionNotifications - 1) % pool.length];
        const text = window.BITS_MESSAGE_TEXT.prepare(message).text;
        const [title, ...copy] = text.split("\n");
        setActionCenterNotification(copy.length ? title : "BITS OS has another notification",
          copy.length ? copy.join("\n") : title);
      }, 1200);
    });
    window.addEventListener("bits:arg-updated", (event) => {
      syncFakeDesktopArg(event.detail);
    });
    syncFakeDesktopArg();
    updateFakeDesktopClock();
    window.setInterval(updateFakeDesktopClock, 1000);

    return {
      setVisible: setFakeDesktopVisible,
      inspectPlayingDeadProcess,
      triggerVirusScreen,
      recoverFromVirusScreen,
      playingDeadMessages,
      glitchMessages,
    };
  }

  window.BITS_FAKE_DESKTOP = { initialize };
})();
