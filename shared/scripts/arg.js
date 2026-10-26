const missingBitStorageKey = "bits-missing-bit-v1";
const missingBitAchievementStorageKey = "bits-achievements";
const missingBitFragments = [
  {
    id: "terminal",
    source: "TERMINAL TRACE",
    token: "01010010",
    letter: "R",
    hint: "Ask the terminal to trace the missing bit.",
  },
  {
    id: "now",
    source: "NOW.TXT",
    token: "01000101",
    letter: "E",
    hint: "NOW.TXT contains a trailing byte that was not written by the operator.",
  },
  {
    id: "changelog",
    source: "CHANGELOG.LOG",
    token: "01010100",
    letter: "T",
    hint: "The deployment history remembers a release that never shipped.",
  },
  {
    id: "filesystem",
    source: ".lost+found",
    token: "01010101",
    letter: "U",
    hint: "File Explorer does not hide dot-directories very well.",
  },
  {
    id: "support",
    source: "SUPPORT TICKET 13",
    token: "01010010",
    letter: "R",
    hint: "Actual Help becomes unusually useful on its thirteenth request.",
  },
  {
    id: "source",
    source: "UNTRACKED SOURCE",
    token: "01001110",
    letter: "N",
    hint: "The public source directory contains one file Git forgot.",
  },
];
const missingBitAchievements = {
  first: {
    id: "found-a-bit",
    label: "FOUND A BIT",
    message: "ONE DOWN. FIVE UNACCOUNTED FOR.",
  },
  fragments: {
    id: "defragmented",
    label: "DEFRAGMENTED",
    message: "RETURN",
  },
  complete: {
    id: "bits-all-the-way-down",
    label: "BITS ALL THE WAY DOWN",
    message: "PROCESS_000 HAS AN OPINION",
  },
};

function createMissingBitState() {
  return {
    fragments: [],
    reconstructed: false,
    outcome: null,
    updatedAt: new Date().toISOString(),
  };
}

function loadMissingBitState() {
  try {
    const stored = localStorage.getItem(missingBitStorageKey);
    if (!stored) {
      return createMissingBitState();
    }

    const parsed = JSON.parse(stored);
    if (
      !parsed
      || !Array.isArray(parsed.fragments)
      || typeof parsed.reconstructed !== "boolean"
    ) {
      throw new Error("Missing Bit state has an invalid shape.");
    }

    return {
      fragments: [...new Set(parsed.fragments)].filter((id) => (
        missingBitFragments.some((fragment) => fragment.id === id)
      )),
      reconstructed: parsed.reconstructed,
      outcome: typeof parsed.outcome === "string" ? parsed.outcome : null,
      updatedAt: typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : new Date().toISOString(),
    };
  } catch (error) {
    console.error("Unable to load Missing Bit progress:", error);
    return createMissingBitState();
  }
}

let missingBitState = loadMissingBitState();

function saveMissingBitState() {
  missingBitState.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(
      missingBitStorageKey,
      JSON.stringify(missingBitState),
    );
  } catch (error) {
    console.error("Unable to save Missing Bit progress:", error);
    return false;
  }
  window.dispatchEvent(new CustomEvent("bits:arg-updated", {
    detail: getMissingBitSnapshot(),
  }));
  return true;
}

function hasStoredAchievement(id) {
  try {
    const stored = localStorage.getItem(missingBitAchievementStorageKey);
    const achievements = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(achievements)) {
      throw new Error("Achievement storage does not contain an array.");
    }
    return achievements.some((achievement) => achievement?.id === id);
  } catch (error) {
    console.error("Unable to inspect achievements for Missing Bit:", error);
    return false;
  }
}

function unlockMissingBitAchievement(achievement) {
  if (hasStoredAchievement(achievement.id)) {
    return false;
  }

  if (typeof window.showAchievement === "function") {
    window.showAchievement(
      achievement.message,
      achievement.label,
      4200,
      achievement.id,
    );
    return true;
  }

  try {
    const stored = localStorage.getItem(missingBitAchievementStorageKey);
    const achievements = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(achievements)) {
      throw new Error("Achievement storage does not contain an array.");
    }
    achievements.push({
      ...achievement,
      unlockedAt: new Date().toISOString(),
    });
    localStorage.setItem(
      missingBitAchievementStorageKey,
      JSON.stringify(achievements),
    );
    return true;
  } catch (error) {
    console.error("Unable to save a Missing Bit achievement:", error);
    return false;
  }
}

function getMissingBitSnapshot() {
  const discovered = missingBitFragments.filter((fragment) => (
    missingBitState.fragments.includes(fragment.id)
  ));
  return {
    ...missingBitState,
    discovered,
    total: missingBitFragments.length,
    assembled: discovered.length === missingBitFragments.length
      ? missingBitFragments.map(({ letter }) => letter).join("")
      : null,
  };
}

function announceMissingBitDiscovery(fragment, wasNew) {
  const status = document.querySelector("#arg-page-status");
  if (status) {
    status.textContent = wasNew
      ? `FRAGMENT RECOVERED // ${fragment.token} // ${fragment.letter}`
      : `FRAGMENT ALREADY RECOVERED // ${fragment.token}`;
  }
}

function syncMissingBitFragmentButtons() {
  document.querySelectorAll("[data-arg-fragment]").forEach((button) => {
    const fragment = missingBitFragments.find(({ id }) => (
      id === button.dataset.argFragment
    ));
    if (!fragment) {
      return;
    }
    button.dataset.argDefaultLabel ||= button.textContent.trim();
    button.textContent = missingBitState.fragments.includes(fragment.id)
      ? `FRAGMENT VERIFIED // ${fragment.token}`
      : button.dataset.argDefaultLabel;
  });
}

function discoverMissingBitFragment(id) {
  const fragment = missingBitFragments.find((candidate) => candidate.id === id);
  if (!fragment) {
    throw new Error(`Unknown Missing Bit fragment: ${id}`);
  }

  const wasNew = !missingBitState.fragments.includes(id);
  if (wasNew) {
    missingBitState.fragments.push(id);
    if (!saveMissingBitState()) {
      return { fragment, wasNew: false, saved: false };
    }
    if (missingBitState.fragments.length === 1) {
      unlockMissingBitAchievement(missingBitAchievements.first);
    }
    if (missingBitState.fragments.length === missingBitFragments.length) {
      unlockMissingBitAchievement(missingBitAchievements.fragments);
    }
  }

  announceMissingBitDiscovery(fragment, wasNew);
  renderMissingBitTrace();
  return { fragment, wasNew, saved: true };
}

function renderMissingBitTrace() {
  syncMissingBitFragmentButtons();
  const list = document.querySelector("#arg-fragment-list");
  if (!list) {
    return;
  }

  const snapshot = getMissingBitSnapshot();
  const progress = document.querySelector("#arg-progress");
  const nextHint = document.querySelector("#arg-next-hint");
  const assembly = document.querySelector("#arg-assembly");
  const archive = document.querySelector("#arg-archive");
  const outcome = document.querySelector("#arg-outcome");

  progress.textContent =
    `${snapshot.discovered.length} / ${snapshot.total} FRAGMENTS RECOVERED`;
  list.replaceChildren(...missingBitFragments.map((fragment, index) => {
    const item = document.createElement("li");
    const recovered = missingBitState.fragments.includes(fragment.id);
    item.className = recovered ? "is-recovered" : "is-missing";
    item.innerHTML = recovered
      ? `<span>0${index + 1}</span><strong>${fragment.source}</strong><code>${fragment.token} // ${fragment.letter}</code>`
      : `<span>0${index + 1}</span><strong>UNACCOUNTED FOR</strong><code>????????</code>`;
    return item;
  }));

  const nextFragment = missingBitFragments.find((fragment) => (
    !missingBitState.fragments.includes(fragment.id)
  ));
  nextHint.textContent = nextFragment
    ? `NEXT TRACE: ${nextFragment.hint}`
    : "ALL FRAGMENTS ACCOUNTED FOR. THE BYTES DECODE TO A TERMINAL INSTRUCTION.";

  assembly.hidden = !snapshot.assembled;
  if (snapshot.assembled) {
    assembly.querySelector("strong").textContent = snapshot.assembled;
  }

  archive.hidden = !missingBitState.reconstructed;
  outcome.textContent = missingBitState.outcome
    ? `ACTIVE DECISION: ${missingBitState.outcome.toUpperCase()} // REVISION PERMITTED`
    : "NO CONTAINMENT DECISION RECORDED";
}

function openMissingBitTrace() {
  window.BITS_DESKTOP_WINDOWS?.open("trace");
  renderMissingBitTrace();
}

function handleMissingBitCommand(command) {
  if (command === "trace missing_bit" || command === "trace missing bit") {
    const { fragment, wasNew } = discoverMissingBitFragment("terminal");
    openMissingBitTrace();
    return {
      handled: true,
      title: "trace missing bit",
      lines: [
        wasNew
          ? "ANOMALOUS PROCESS LOCATED."
          : "ANOMALOUS PROCESS REMAINS LOCATED.",
        `FRAGMENT 01: ${fragment.token} // ${fragment.letter}`,
        "TRACE.EXE opened. Five Bits remain unaccounted for.",
      ],
    };
  }

  if (command === "trace" || command === "trace status") {
    const snapshot = getMissingBitSnapshot();
    openMissingBitTrace();
    return {
      handled: true,
      title: "trace status",
      lines: [
        `${snapshot.discovered.length}/${snapshot.total} fragments recovered.`,
        snapshot.assembled
          ? `ASSEMBLED INSTRUCTION: ${snapshot.assembled}`
          : "ASSEMBLED INSTRUCTION: INCOMPLETE",
      ],
    };
  }

  if (command === "trace return") {
    const snapshot = getMissingBitSnapshot();
    openMissingBitTrace();
    if (!snapshot.assembled) {
      return {
        handled: true,
        title: "trace return",
        lines: [
          "RECONSTRUCTION FAILED.",
          `${snapshot.total - snapshot.discovered.length} fragments remain missing.`,
        ],
      };
    }
    missingBitState.reconstructed = true;
    saveMissingBitState();
    renderMissingBitTrace();
    return {
      handled: true,
      title: "trace return",
      lines: [
        "PROCESS_000 reconstructed from six noncontiguous Bits.",
        "ARCHIVE_13.SYS is now readable in TRACE.EXE.",
        "WARNING: the process has requested a containment decision.",
      ],
    };
  }

  return { handled: false };
}

function setMissingBitOutcome(outcome) {
  if (!["restore", "quarantine", "delete", "negotiate"].includes(outcome)) {
    throw new Error(`Unknown Missing Bit outcome: ${outcome}`);
  }
  if (!missingBitState.reconstructed) {
    return;
  }
  missingBitState.outcome = outcome;
  saveMissingBitState();
  unlockMissingBitAchievement(missingBitAchievements.complete);
  renderMissingBitTrace();
}

function resetMissingBitProgress() {
  missingBitState = createMissingBitState();
  try {
    localStorage.removeItem(missingBitStorageKey);
  } catch (error) {
    console.error("Unable to reset Missing Bit progress:", error);
    return false;
  }
  window.dispatchEvent(new CustomEvent("bits:arg-updated", {
    detail: getMissingBitSnapshot(),
  }));
  renderMissingBitTrace();
  return true;
}

document.querySelectorAll("[data-arg-fragment]").forEach((button) => {
  button.addEventListener("click", () => {
    discoverMissingBitFragment(button.dataset.argFragment);
  });
});

document.querySelectorAll("[data-arg-outcome]").forEach((button) => {
  button.addEventListener("click", () => {
    setMissingBitOutcome(button.dataset.argOutcome);
  });
});

document.querySelector("#arg-reset")?.addEventListener("click", () => {
  if (window.confirm("Erase all Missing Bit fragment and outcome progress?")) {
    resetMissingBitProgress();
  }
});

window.addEventListener("desktop-window:opened", (event) => {
  if (event.detail?.windowId === "trace-window") {
    renderMissingBitTrace();
  }
});

window.addEventListener("bits:achievements-reset", resetMissingBitProgress);

window.BITS_ARG = {
  discover: discoverMissingBitFragment,
  getState: getMissingBitSnapshot,
  handleCommand: handleMissingBitCommand,
  open: openMissingBitTrace,
  reset: resetMissingBitProgress,
};

renderMissingBitTrace();
