const baseInterfaceThemes = [
  { id: "default", name: "DEFAULT", darkColor: "#070b0f", lightColor: "#edf3ef" },
  { id: "aurora", name: "AURORA", darkColor: "#071018", lightColor: "#edf7f5" },
  { id: "cozy-blossom", name: "COZY BLOSSOM", darkColor: "#1c1218", lightColor: "#fff4f1" },
  { id: "mica", name: "MICA", darkColor: "#202124", lightColor: "#eef3f8" },
  { id: "fluent", name: "FLUENT", darkColor: "#101722", lightColor: "#f3f8ff" },
  { id: "midnight-oled", name: "MIDNIGHT OLED", darkColor: "#000000", lightColor: "#f7f7f7" },
  { id: "macos", name: "MACOS", darkColor: "#18181a", lightColor: "#f5f5f7" },
  { id: "terminal", name: "TERMINAL", darkColor: "#000500", lightColor: "#e8f4e8" },
  { id: "vaporwave", name: "VAPORWAVE", darkColor: "#160d2b", lightColor: "#fff0fb" },
  { id: "amber-crt", name: "AMBER CRT", darkColor: "#100900", lightColor: "#fff4d6" },
  { id: "y2k-silver", name: "Y2K SILVER", darkColor: "#252a33", lightColor: "#e8edf4" },
  { id: "cyberpunk", name: "CYBERPUNK", darkColor: "#080712", lightColor: "#f3f000" },
  { id: "dos-blue", name: "DOS BLUE", darkColor: "#0000aa", lightColor: "#d7d7d7" },
  { id: "windows-95", name: "WINDOWS 95", darkColor: "#004c4c", lightColor: "#008080" },
  { id: "solarized", name: "SOLARIZED", darkColor: "#002b36", lightColor: "#fdf6e3" },
  { id: "nord", name: "NORD", darkColor: "#2e3440", lightColor: "#eceff4" },
  { id: "dracula", name: "DRACULA", darkColor: "#282a36", lightColor: "#f8f8f2" },
  { id: "candy-pop", name: "CANDY POP", darkColor: "#25152d", lightColor: "#fff4fb" },
  { id: "rgb", name: "RGB", darkColor: "#090713", lightColor: "#090713" },
  { id: "aero-glass", name: "AERO GLASS", darkColor: "#0d3358", lightColor: "#0d3358" },
  { id: "minebits", name: "MINEBITS", darkColor: "#332719", lightColor: "#dbe8c5" },
];

const seasonalInterfaceThemes = {
  winter: { id: "winter", name: "WINTER", darkColor: "#07131f", lightColor: "#eaf7ff", seasonal: true },
  spooky: { id: "spooky", name: "SPOOKY", darkColor: "#140b18", lightColor: "#fff0dc", seasonal: true },
  christmas: { id: "christmas", name: "CHRISTMAS", darkColor: "#07150f", lightColor: "#fff7e8", seasonal: true },
  "new-year": { id: "new-year", name: "NEW YEAR", darkColor: "#080a18", lightColor: "#fff8dc", seasonal: true },
};
const themeDebugKey = "bits-theme-debug";
const themeDebugEnabled = localStorage.getItem(themeDebugKey) === "enabled";

function getSeasonalThemeState(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  const isWinter = month === 11 || month === 0 || month === 1;
  const isSpooky = (month === 9 && day >= 28) || (month === 10 && day === 1);
  const isChristmas = month === 11 && day >= 23 && day <= 26;
  const isNewYear = (month === 11 && day === 31) || (month === 0 && day === 1);
  const availableThemeIds = [];

  if (isWinter) {
    availableThemeIds.push("winter");
  }
  if (isSpooky) {
    availableThemeIds.push("spooky");
  }
  if (isChristmas) {
    availableThemeIds.push("christmas");
  }
  if (isNewYear) {
    availableThemeIds.push("new-year");
  }

  const automaticThemeId = isNewYear
    ? "new-year"
    : isChristmas
      ? "christmas"
      : isSpooky
        ? "spooky"
        : isWinter
          ? "winter"
          : "";

  return {
    active: Boolean(automaticThemeId),
    id: automaticThemeId || "standard",
    automaticThemeId,
    availableThemeIds,
  };
}

const seasonalThemeState = getSeasonalThemeState();
const availableSeasonalThemes = themeDebugEnabled
  ? Object.values(seasonalInterfaceThemes)
  : seasonalThemeState.availableThemeIds.map(
    (themeId) => seasonalInterfaceThemes[themeId],
  );
window.BITS_INTERFACE_THEMES = [...baseInterfaceThemes, ...availableSeasonalThemes]
  .sort((left, right) => left.name.localeCompare(right.name));
window.BITS_GET_SEASONAL_THEME_STATE = getSeasonalThemeState;
window.BITS_SEASONAL_THEME_STATE = seasonalThemeState;

const storedInterfaceThemeId = localStorage.getItem("bits-interface-theme");
const storedInterfaceTheme = baseInterfaceThemes.find(
  (theme) => theme.id === storedInterfaceThemeId,
) ?? baseInterfaceThemes[0];
const legacyRgbMode = localStorage.getItem("bits-rgb-mode") === "true";
const savedInterfaceTheme = legacyRgbMode
  ? baseInterfaceThemes.find((theme) => theme.id === "rgb")
  : storedInterfaceTheme;
const seasonalDismissalKey = "bits-seasonal-theme-dismissed";
const seasonalChoiceKey = "bits-seasonal-theme-choice";
const seasonalDismissed = (
  localStorage.getItem(seasonalDismissalKey) === seasonalThemeState.id
);
const storedSeasonalChoice = localStorage.getItem(seasonalChoiceKey)?.split(":") ?? [];
const seasonalChoice = (
  (
    themeDebugEnabled
    && storedSeasonalChoice[0] === "debug"
    && Boolean(seasonalInterfaceThemes[storedSeasonalChoice[1]])
  )
  || (
    storedSeasonalChoice[0] === seasonalThemeState.id
    && seasonalThemeState.availableThemeIds.includes(storedSeasonalChoice[1])
  )
) ? storedSeasonalChoice[1] : "";
const automaticSeasonalTheme = window.BITS_INTERFACE_THEMES.find(
  (theme) => theme.id === seasonalThemeState.automaticThemeId,
);
const initialInterfaceTheme = window.BITS_INTERFACE_THEMES.find(
  (theme) => theme.id === (
    seasonalChoice
    || (!seasonalDismissed && automaticSeasonalTheme?.id)
    || savedInterfaceTheme.id
  ),
) ?? savedInterfaceTheme;

function selectInterfaceTheme(themeId) {
  const theme = window.BITS_INTERFACE_THEMES.find((entry) => entry.id === themeId);
  if (!theme) {
    return;
  }

  if (theme.seasonal && (themeDebugEnabled || seasonalThemeState.active)) {
    const choiceScope = themeDebugEnabled ? "debug" : seasonalThemeState.id;
    localStorage.setItem(seasonalChoiceKey, `${choiceScope}:${theme.id}`);
    localStorage.removeItem(seasonalDismissalKey);
    return;
  }

  localStorage.setItem("bits-interface-theme", theme.id);
  localStorage.removeItem(seasonalChoiceKey);
  if (seasonalThemeState.active) {
    localStorage.setItem(seasonalDismissalKey, seasonalThemeState.id);
  } else {
    localStorage.removeItem(seasonalDismissalKey);
  }
}

function resolveInterfaceTheme() {
  const choice = localStorage.getItem(seasonalChoiceKey)?.split(":") ?? [];
  if (
    themeDebugEnabled
    && choice[0] === "debug"
    && Boolean(seasonalInterfaceThemes[choice[1]])
  ) {
    return choice[1];
  }
  if (
    choice[0] === seasonalThemeState.id
    && seasonalThemeState.availableThemeIds.includes(choice[1])
  ) {
    return choice[1];
  }
  if (
    seasonalThemeState.active
    && localStorage.getItem(seasonalDismissalKey) !== seasonalThemeState.id
  ) {
    return seasonalThemeState.automaticThemeId;
  }
  const savedThemeId = localStorage.getItem("bits-interface-theme");
  return baseInterfaceThemes.some((theme) => theme.id === savedThemeId)
    ? savedThemeId
    : baseInterfaceThemes[0].id;
}

function setThemeDebugMode(enabled) {
  if (enabled) {
    localStorage.setItem(themeDebugKey, "enabled");
  } else {
    localStorage.removeItem(themeDebugKey);
    if (localStorage.getItem(seasonalChoiceKey)?.startsWith("debug:")) {
      localStorage.removeItem(seasonalChoiceKey);
    }
  }
  window.location.reload();
}

window.BITS_THEME_DEBUG = Object.freeze({
  disable: () => setThemeDebugMode(false),
  enable: () => setThemeDebugMode(true),
  isEnabled: () => localStorage.getItem(themeDebugKey) === "enabled",
});

window.BITS_THEME_PREFERENCE = {
  dismissalKey: seasonalDismissalKey,
  choiceKey: seasonalChoiceKey,
  select: selectInterfaceTheme,
  resolve: resolveInterfaceTheme,
};

if (typeof window.setTimeout === "function" && window.location?.reload) {
  const now = new Date();
  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    1,
  );
  window.setTimeout(() => window.location.reload(), nextDay.getTime() - now.getTime());
}

document.documentElement.dataset.colorScheme = "dark";
document.documentElement.dataset.interfaceTheme = initialInterfaceTheme.id;
document.documentElement.classList.toggle(
  "is-rgb-mode",
  initialInterfaceTheme.id === "rgb",
);
document.documentElement.dataset.motion =
  localStorage.getItem("bits-motion") === "reduced" ? "reduced" : "system";
document.documentElement.dataset.textsize =
  localStorage.getItem("bits-text-size") === "large" ? "large" : "default";
document.documentElement.dataset.contrast =
  localStorage.getItem("bits-contrast") === "high" ? "high" : "default";
document.documentElement.dataset.effects =
  localStorage.getItem("bits-effects") === "off" ? "off" : "on";
if (
  legacyRgbMode
  || !storedInterfaceThemeId
  || !baseInterfaceThemes.some((theme) => theme.id === storedInterfaceThemeId)
) {
  localStorage.setItem("bits-interface-theme", savedInterfaceTheme.id);
}
localStorage.removeItem("bits-accent");
localStorage.removeItem("bits-color-scheme");
localStorage.removeItem("bits-rgb-mode");
document.querySelector('meta[name="theme-color"]').content = initialInterfaceTheme.darkColor;
