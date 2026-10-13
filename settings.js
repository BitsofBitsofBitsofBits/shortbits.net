const settingsTheme = document.querySelector("#settings-theme");
const settingsAccent = document.querySelector("#settings-accent");
const settingsDisplay = document.querySelector("#settings-display");
const settingsMotion = document.querySelector("#settings-motion");
const settingsLargeText = document.querySelector("#settings-large-text");
const settingsHighContrast = document.querySelector("#settings-high-contrast");
const settingsEffects = document.querySelector("#settings-effects");
const settingsCopyLink = document.querySelector("#settings-copy-link");
const settingsResetWindows = document.querySelector("#settings-reset-windows");
const settingsResetAll = document.querySelector("#settings-reset-all");
const settingsStatus = document.querySelector("#settings-status");
const footerTheme = document.querySelector("#interface-theme-select");
const footerAccent = document.querySelector("#accent-select");
const footerDisplay = document.querySelector("#mode-button");

const preferenceKeys = [
  "bits-interface-theme",
  "bits-accent",
  "bits-color-scheme",
  "bits-rgb-mode",
  "bits-motion",
  "bits-text-size",
  "bits-contrast",
  "bits-effects",
  "bits-insider-channel",
];

function addSelectOptions(select, options) {
  options.forEach(({ label, value }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
}

function setSettingsStatus(message, isError = false) {
  settingsStatus.textContent = message;
  settingsStatus.classList.toggle("is-error", isError);
}

function syncAppearanceControls() {
  settingsTheme.value = document.documentElement.dataset.interfaceTheme;
  settingsAccent.value = document.documentElement.classList.contains("is-rgb-mode")
    ? "RGB"
    : localStorage.getItem("bits-accent") || "GREEN";
  settingsDisplay.value = document.documentElement.dataset.colorScheme;
}

function applyAccessibilityPreference(key, value) {
  localStorage.setItem(`bits-${key}`, value);
  const datasetKey = key === "text-size" ? "textsize" : key;
  document.documentElement.dataset[datasetKey] = value;
  window.dispatchEvent(new CustomEvent("bits:preferences-changed", {
    detail: { key, value },
  }));
  setSettingsStatus("Accessibility preferences saved.");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (clipboardError) {
    const copyField = document.createElement("textarea");
    copyField.value = text;
    copyField.setAttribute("readonly", "");
    copyField.style.position = "fixed";
    copyField.style.opacity = "0";
    document.body.append(copyField);
    copyField.select();
    const copied = document.execCommand("copy");
    copyField.remove();
    if (!copied) {
      throw clipboardError;
    }
  }
}

addSelectOptions(
  settingsTheme,
  window.BITS_INTERFACE_THEMES.map((theme) => ({
    label: theme.name,
    value: theme.id,
  })),
);
addSelectOptions(
  settingsAccent,
  [
    ...window.BITS_THEMES.map((theme) => ({
      label: theme.name,
      value: theme.name,
    })),
    { label: "RGB", value: "RGB" },
  ],
);

settingsMotion.value = document.documentElement.dataset.motion;
settingsLargeText.checked = document.documentElement.dataset.textsize === "large";
settingsHighContrast.checked = document.documentElement.dataset.contrast === "high";
settingsEffects.checked = document.documentElement.dataset.effects !== "off";
syncAppearanceControls();

settingsTheme.addEventListener("change", () => {
  footerTheme.value = settingsTheme.value;
  footerTheme.dispatchEvent(new Event("change", { bubbles: true }));
  setSettingsStatus("Interface theme saved.");
});

settingsAccent.addEventListener("change", () => {
  footerAccent.value = settingsAccent.value;
  footerAccent.dispatchEvent(new Event("change", { bubbles: true }));
  setSettingsStatus("Accent preference saved.");
});

settingsDisplay.addEventListener("change", () => {
  if (document.documentElement.dataset.colorScheme !== settingsDisplay.value) {
    footerDisplay.click();
  }
  setSettingsStatus("Display preference saved.");
});

settingsMotion.addEventListener("change", () => {
  applyAccessibilityPreference("motion", settingsMotion.value);
});

settingsLargeText.addEventListener("change", () => {
  applyAccessibilityPreference(
    "text-size",
    settingsLargeText.checked ? "large" : "default",
  );
});

settingsHighContrast.addEventListener("change", () => {
  applyAccessibilityPreference(
    "contrast",
    settingsHighContrast.checked ? "high" : "default",
  );
});

settingsEffects.addEventListener("change", () => {
  applyAccessibilityPreference(
    "effects",
    settingsEffects.checked ? "on" : "off",
  );
});

footerTheme.addEventListener("change", syncAppearanceControls);
footerAccent.addEventListener("change", syncAppearanceControls);
footerDisplay.addEventListener("click", syncAppearanceControls);

settingsCopyLink.addEventListener("click", async () => {
  try {
    const shareUrl = window.BITS_DESKTOP_WINDOWS.getShareUrl();
    await copyText(shareUrl);
    setSettingsStatus("Open-window link copied to the clipboard.");
  } catch (error) {
    console.error("Unable to copy the open-window link:", error);
    setSettingsStatus("Unable to copy the link. Copy it from the address bar instead.", true);
  }
});

settingsResetWindows.addEventListener("click", () => {
  window.BITS_DESKTOP_WINDOWS.resetLayout();
});

settingsResetAll.addEventListener("click", () => {
  if (!window.confirm("Reset appearance and accessibility preferences?")) {
    return;
  }
  preferenceKeys.forEach((key) => localStorage.removeItem(key));
  window.location.reload();
});
