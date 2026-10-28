const settingsTheme = document.querySelector("#settings-theme");
const settingsMotion = document.querySelector("#settings-motion");
const settingsTextSize = document.querySelector("#settings-text-size");
const settingsHighContrast = document.querySelector("#settings-high-contrast");
const settingsEffects = document.querySelector("#settings-effects");
const settingsEinkRefresh = document.querySelector("#settings-eink-refresh");
const settingsCopyLink = document.querySelector("#settings-copy-link");
const settingsResetWindows = document.querySelector("#settings-reset-windows");
const settingsResetAll = document.querySelector("#settings-reset-all");
const settingsStatus = document.querySelector("#settings-status");
const toolbarTheme = document.querySelector("#interface-theme-select");

const preferenceKeys = [
  "bits-interface-theme",
  "bits-seasonal-theme-choice",
  "bits-seasonal-theme-dismissed",
  "bits-accent",
  "bits-color-scheme",
  "bits-rgb-mode",
  ...window.BITS_ACCESSIBILITY.keys,
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
  const eink = settingsTheme.value === "eink-reader";
  document.querySelector("#settings-eink-refresh-option").hidden = !eink;
  document.querySelector("#settings-eink-refresh-help").hidden = !eink;
  settingsEinkRefresh.checked = document.documentElement.dataset.einkRefresh === "on";
}

function applyAccessibilityPreference(key, value) {
  try {
    window.BITS_ACCESSIBILITY.set(key, value);
    setSettingsStatus("Accessibility preferences saved for this browser across the site.");
  } catch (error) {
    console.error("Unable to save accessibility preferences:", error);
    syncAccessibilityControls();
    setSettingsStatus("Unable to save this preference. Check browser storage permissions and try again.", true);
  }
}

const accessibilityChecks = [
  ["pause-content", "pauseContent", "on", "off"],
  ["readable-text", "readableText", "on", "off"],
  ["large-controls", "largeControls", "on", "off"],
  ["simple-layout", "simpleLayout", "on", "off"],
  ["transparency", "transparency", "reduced", "default"],
  ["focus", "focus", "enhanced", "default"],
];

function syncAccessibilityControls() {
  const preferences = document.documentElement.dataset;
  settingsMotion.value = preferences.motion;
  settingsTextSize.value = preferences.textsize;
  settingsHighContrast.checked = preferences.contrast === "high";
  settingsEffects.checked = preferences.effects !== "off";
  accessibilityChecks.forEach(([key, attribute, value]) => {
    document.querySelector(`#settings-${key}`).checked = preferences[attribute] === value;
  });
  syncAppearanceControls();
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

if (window.BITS_THEME_PREFERENCE?.buildOptions) {
  settingsTheme.append(...window.BITS_THEME_PREFERENCE.buildOptions());
} else {
  addSelectOptions(
    settingsTheme,
    window.BITS_INTERFACE_THEMES.map((theme) => ({
      label: theme.name,
      value: theme.id,
    })),
  );
}
syncAccessibilityControls();

settingsTheme.addEventListener("change", () => {
  toolbarTheme.value = settingsTheme.value;
  toolbarTheme.dispatchEvent(new Event("change", { bubbles: true }));
  setSettingsStatus("Interface theme saved.");
});

settingsMotion.addEventListener("change", () => {
  applyAccessibilityPreference("motion", settingsMotion.value);
});

settingsTextSize.addEventListener("change", () => {
  applyAccessibilityPreference("text-size", settingsTextSize.value);
});

accessibilityChecks.forEach(([key, , on, off]) => {
  const control = document.querySelector(`#settings-${key}`);
  control.addEventListener("change", () => applyAccessibilityPreference(key, control.checked ? on : off));
});
window.addEventListener("bits:preferences-changed", syncAccessibilityControls);

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

settingsEinkRefresh.addEventListener("change", () => {
  applyAccessibilityPreference("eink-refresh", settingsEinkRefresh.checked ? "on" : "off");
});

toolbarTheme.addEventListener("change", syncAppearanceControls);
window.addEventListener("bits:theme-applied", syncAppearanceControls);
window.BITS_THEME_PREFERENCE?.bindColorSchemeSelect(document.querySelector("#settings-scheme"));
window.BITS_THEME_PREFERENCE?.bindVariantSelect?.(document.querySelector("#settings-variant"));
window.BITS_THEME_PICKER.bind(settingsTheme, document.querySelector("#settings-variant"));
document.querySelector("#settings-theme-random")?.addEventListener("click", () => {
  document.querySelector("#interface-theme-random")?.click();
  setSettingsStatus("Random interface theme applied.");
});

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
