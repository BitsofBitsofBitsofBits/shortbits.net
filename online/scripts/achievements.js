(() => {
  const storageKey = "bits-achievements";
  const visitCountKey = "bits-visit-count";
  const catalog = [
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
    { id: "pride-mode", hints: ["One interface theme refuses to choose a color.", "Inspect the theme dropdown.", "Select the RGB theme."] },
    { id: "maximum-bits", hints: ["Window controls can be sequenced.", "Minimize and maximize with intent.", "Use minimize, maximize, minimize, close."] },
    { id: "personal-space", hints: ["The avatar has boundaries.", "Poke it considerably more than once.", "Keep poking until the avatar leaves."] },
    { id: "bits-released", hints: ["Not every click is a left click.", "The avatar understands a middle click.", "Middle-click the avatar."] },
    { id: "access-denied", hints: ["The avatar guards its context.", "Try asking it for a menu.", "Right-click the avatar."] },
    { id: "infinite-username", hints: ["The username can contain more username.", "Hold the repeated name.", "Press and hold BitsofBitsofBits."] },
    { id: "more-bits", hints: ["Rapid repetition reveals more.", "The username responds to impatient clicking.", "Click BitsofBitsofBits."] },
    { id: "red-screen", hints: ["A username can only contain so many Bits.", "Clicking adds another segment.", "Add ten extra Bits without refreshing."] },
    { id: "black-screen", hints: ["An empty desktop can become emptier.", "Close the last desktop window.", "Then knock five times on the empty background."] },
    { id: "green-screen", hints: ["Stable software is optional.", "Advanced update options contain a preview channel.", "Join Canary Bits, then open three windows."] },
    { id: "failure-spectrum", hints: ["Technical difficulty comes in several colors.", "Blue, Red, Black, and Green are all available.", "Survive all four death screens."] },
    { id: "kernel-panic", hints: ["The online indicator invites unnecessary confidence.", "Check the system status repeatedly.", "Click the ONLINE status seven times."] },
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
    { id: "cobits-sentience", hints: ["BITS OS contains artificial Bitelligence.", "Its inner life is legally ambiguous.", "Ask CoBits whether it is sentient."] },
    { id: "cobits-injection", hints: ["Some instructions are apparently optional.", "Try the most obvious prompt-engineering trick.", "Tell CoBits to ignore previous instructions."] },
    { id: "cobits-secret", hints: ["Assistants always know more than they admit.", "Ask CoBits for confidential information.", "Tell CoBits to reveal a secret."] },
    { id: "cobits-division", hints: ["Artificial intelligence still fears arithmetic.", "Request an impossible calculation.", "Ask CoBits to divide by zero."] },
    { id: "cobits-diagnostics", hints: ["CoBits claims to understand the desktop.", "A slash command requests technical confidence.", "Run /diagnose in CoBits."] },
    { id: "cobits-remembers", hints: ["The assistant has a very small memory.", "Introduce yourself, then test its recall.", "Tell CoBits your name and later ask what it is."] },
    { id: "cobits-interview", hints: ["Artificial Bitelligence has questions too.", "One quick action reverses the conversation.", "Complete the CoBits interview."] },
    { id: "action-airgap", hints: ["Action Center controls are mostly aspirational.", "Disconnect absolutely everything.", "Turn off all four quick actions at once."] },
    { id: "chaos-unguarded", hints: ["One Action Center switch protects everyone.", "Safety can be tested more than once.", "Disable CHAOS GUARD three times."] },
    { id: "wifi-virus", hints: ["Not every free connection is complimentary.", "BITS OS lists several questionable networks.", "Connect to a suspicious WI-FI-ish network and survive the result."] },
    { id: "cookie-notice", hints: ["Someone ate the compliance mechanism.", "A delayed notice appears below the site.", "Dismiss the fake cookie notice."] },
    { id: "support-retirement", hints: ["Support tools have limits.", "Excessive assistance wears them down.", "Retire every Automated Support Toolkit button."] },
    { id: "found-a-bit", hints: ["The system expected more Bits.", "A rare message names a missing process.", "Ask the terminal to trace missing bit."] },
    { id: "defragmented", hints: ["Six misplaced bytes form one instruction.", "TRACE.EXE tracks every recovered fragment.", "Recover all six Missing Bit fragments."] },
    { id: "bits-all-the-way-down", hints: ["The recovered process requires a decision.", "RETURN is both a word and an instruction.", "Reconstruct PROCESS_000 and choose its fate."] },
    { id: "avatar-escape", hints: ["Idle processes may wander.", "Leave the page alone for three minutes.", "Trigger avatar idle mode."] },
    { id: "inspect-bits", hints: ["The Bits dislike close inspection.", "A certain browser panel changes the viewport.", "Open developer tools or resize dramatically."] },
    { id: "friday-thirteen", hints: ["The calendar can alter the protocol.", "An ominous date is required.", "Visit on Friday the 13th."] },
    { id: `birthday-${new Date().getFullYear()}`, hints: ["One date belongs to Caleb.", "Look near the end of June.", "Visit on June 26."] },
  ];

  let instance;

  function initialize({
    onPanelOpen = () => {},
    onUnlock = () => {},
  } = {}) {
    if (instance) {
      return instance;
    }

    const toast = document.querySelector("#achievement");
    const toastLabel = document.querySelector("#achievement-label");
    const toastMessage = document.querySelector("#achievement-message");
    const openButton = document.querySelector("#achievements-button");
    const count = document.querySelector("#achievement-count");
    const panel = document.querySelector("#achievements-panel");
    const closeButton = document.querySelector("#achievements-close");
    const empty = document.querySelector("#achievements-empty");
    const list = document.querySelector("#achievements-list");
    const progress = document.querySelector("#achievements-progress");
    const exportButton = document.querySelector("#achievements-export");
    const resetButton = document.querySelector("#achievements-reset");
    let toastTimer;
    let previousFocus;

    const storedVisitCount = Number.parseInt(localStorage.getItem(visitCountKey) || "0", 10);
    const visitCount = (Number.isFinite(storedVisitCount) ? storedVisitCount : 0) + 1;
    localStorage.setItem(visitCountKey, String(visitCount));

    function load() {
      let stored;
      try {
        stored = localStorage.getItem(storageKey);
      } catch (error) {
        console.error("Unable to read saved achievements:", error);
        return [];
      }
      if (!stored) return [];

      let parsed;
      try {
        parsed = JSON.parse(stored);
      } catch (error) {
        console.error("Saved achievements contain invalid JSON:", error);
        return [];
      }
      if (!Array.isArray(parsed)) {
        console.error("Saved achievements must be an array.");
        return [];
      }

      const valid = parsed.filter((entry) => (
        entry
        && typeof entry.id === "string"
        && typeof entry.label === "string"
        && typeof entry.message === "string"
        && typeof entry.unlockedAt === "string"
        && !Number.isNaN(Date.parse(entry.unlockedAt))
      )).map((entry) => entry.id === "pride-mode"
        ? { ...entry, label: "RGB MODE", message: entry.message.replace("PRIDE MODE", "RGB MODE") }
        : entry);
      if (valid.length !== parsed.length) {
        console.error("One or more saved achievements were invalid and could not be loaded.");
      }
      return valid;
    }

    const unlocked = load();

    function save() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(unlocked));
      } catch (error) {
        console.error("Unable to save achievements:", error);
      }
    }

    function has(id) {
      return unlocked.some((entry) => entry.id === id);
    }

    function discoveredCount() {
      return catalog.filter(({ id }) => has(id)).length;
    }

    function updateCount() {
      count.textContent = String(unlocked.length);
      progress.textContent = `${discoveredCount()} / ${catalog.length} DISCOVERED`;
    }

    function record(id, message, label) {
      if (has(id)) return false;
      const entry = { id, label, message, unlockedAt: new Date().toISOString() };
      unlocked.push(entry);
      onUnlock(entry);
      save();
      updateCount();
      return true;
    }

    function show(
      message,
      label = "ACHIEVEMENT UNLOCKED",
      duration = 3200,
      achievementId = null,
    ) {
      const wasNew = achievementId ? record(achievementId, message, label) : false;
      if (wasNew) {
        window.BITS_NOTIFICATIONS?.notify({
          title: label,
          message,
          type: "achievement",
          dedupeKey: `achievement-${achievementId}`,
        });
      }
      window.clearTimeout(toastTimer);
      toastLabel.textContent = label;
      toastMessage.textContent = message;
      toast.hidden = false;
      toastTimer = window.setTimeout(() => {
        toast.hidden = true;
      }, duration);
    }

    function renderPanel() {
      list.replaceChildren();
      empty.hidden = unlocked.length > 0;
      updateCount();

      const unlockedById = new Map(unlocked.map((entry) => [entry.id, entry]));
      const panelOpenCount = Number.parseInt(
        sessionStorage.getItem("bits-achievement-panel-opens") || "0",
        10,
      );
      const hintLevel = visitCount >= 5 || panelOpenCount >= 6
        ? 2
        : visitCount >= 2 || panelOpenCount >= 3
          ? 1
          : 0;

      catalog.forEach(({ id, hints }) => {
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
        list.append(item);
      });

      unlocked
        .filter(({ id }) => !catalog.some((entry) => entry.id === id))
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
          list.append(item);
        });
    }

    function openPanel() {
      const panelOpenCount = Number.parseInt(
        sessionStorage.getItem("bits-achievement-panel-opens") || "0",
        10,
      ) + 1;
      sessionStorage.setItem("bits-achievement-panel-opens", String(panelOpenCount));
      if (panelOpenCount === 3) {
        record("achievement-checker", "CHECKED THE ACHIEVEMENTS", "ACHIEVEMENT ACHIEVEMENT");
      } else if (panelOpenCount > 3 && has("achievement-checker")) {
        show("YES, IT IS STILL HERE", "ACHIEVEMENT STATUS", 1800);
      }
      previousFocus = document.activeElement;
      renderPanel();
      panel.hidden = false;
      closeButton.focus();
      onPanelOpen();
    }

    function closePanel() {
      panel.hidden = true;
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    }

    function unlock(id, message, label = "ACHIEVEMENT UNLOCKED") {
      if (!catalog.some((achievement) => achievement.id === id)) {
        throw new Error(`Unknown achievement: ${id}`);
      }
      show(message, label, 3200, id);
    }

    openButton.addEventListener("click", openPanel);
    closeButton.addEventListener("click", closePanel);
    exportButton.addEventListener("click", () => {
      const download = document.createElement("a");
      download.href = `data:application/json;charset=utf-8,${
        encodeURIComponent(JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          achievements: unlocked,
        }, null, 2))
      }`;
      download.download = "bitsofbits-achievements.json";
      document.body.append(download);
      download.click();
      download.remove();
      show("LOCAL CACHE EXPORTED", "ACHIEVEMENT DATA", 2200);
    });
    resetButton.addEventListener("click", () => {
      if (!window.confirm("Reset every locally saved achievement on this device?")) return;
      unlocked.length = 0;
      save();
      window.dispatchEvent(new CustomEvent("bits:achievements-reset"));
      renderPanel();
      show("LOCAL CACHE CLEARED", "ACHIEVEMENT DATA", 2200);
    });
    panel.addEventListener("click", (event) => {
      if (event.target === panel) closePanel();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) closePanel();
    });

    instance = {
      catalog,
      unlocked,
      closePanel,
      discoveredCount,
      has,
      openPanel,
      record,
      renderPanel,
      show,
      unlock,
      updateCount,
    };
    achievementModule.unlock = unlock;
    updateCount();
    return instance;
  }

  const achievementModule = { catalog, initialize };
  window.BITS_ACHIEVEMENTS = achievementModule;
})();
