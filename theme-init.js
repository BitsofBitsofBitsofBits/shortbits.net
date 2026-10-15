window.BITS_INTERFACE_THEMES = [
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

const storedInterfaceTheme = localStorage.getItem("bits-interface-theme");
const legacyRgbMode = localStorage.getItem("bits-rgb-mode") === "true";
const initialInterfaceTheme = window.BITS_INTERFACE_THEMES.find(
  (theme) => theme.id === (legacyRgbMode ? "rgb" : storedInterfaceTheme),
) ?? window.BITS_INTERFACE_THEMES[0];

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
localStorage.setItem("bits-interface-theme", initialInterfaceTheme.id);
localStorage.removeItem("bits-accent");
localStorage.removeItem("bits-color-scheme");
localStorage.removeItem("bits-rgb-mode");
document.querySelector('meta[name="theme-color"]').content = initialInterfaceTheme.darkColor;
