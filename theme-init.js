window.BITS_THEMES = [
  {
    name: "GREEN",
    dark: { accent: "#66ff9a", rgb: "102, 255, 154" },
    light: { accent: "#08783e", rgb: "8, 120, 62" },
  },
  {
    name: "CYAN",
    dark: { accent: "#63d8ff", rgb: "99, 216, 255" },
    light: { accent: "#006f8f", rgb: "0, 111, 143" },
  },
  {
    name: "VIOLET",
    dark: { accent: "#b99aff", rgb: "185, 154, 255" },
    light: { accent: "#6946ad", rgb: "105, 70, 173" },
  },
  {
    name: "AMBER",
    dark: { accent: "#ffcc66", rgb: "255, 204, 102" },
    light: { accent: "#8a5b00", rgb: "138, 91, 0" },
  },
];

window.BITS_INTERFACE_THEMES = [
  { id: "default", name: "DEFAULT", darkColor: "#070b0f", lightColor: "#edf3ef" },
  { id: "aurora", name: "AURORA", darkColor: "#071018", lightColor: "#edf7f5" },
  { id: "cozy-blossom", name: "COZY BLOSSOM", darkColor: "#1c1218", lightColor: "#fff4f1" },
  { id: "mica", name: "MICA", darkColor: "#202124", lightColor: "#eef3f8" },
  { id: "fluent", name: "FLUENT", darkColor: "#101722", lightColor: "#f3f8ff" },
  { id: "midnight-oled", name: "MIDNIGHT OLED", darkColor: "#000000", lightColor: "#f7f7f7" },
  { id: "macos", name: "MACOS", darkColor: "#18181a", lightColor: "#f5f5f7" },
  { id: "terminal", name: "TERMINAL", darkColor: "#000500", lightColor: "#e8f4e8" },
];

const storedScheme = localStorage.getItem("bits-color-scheme");
const colorScheme = storedScheme === "light" || storedScheme === "dark"
  ? storedScheme
  : window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
const storedAccent = localStorage.getItem("bits-accent");
const initialTheme = window.BITS_THEMES.find((theme) => theme.name === storedAccent)
  ?? window.BITS_THEMES[0];
const initialAccent = initialTheme[colorScheme];
const storedInterfaceTheme = localStorage.getItem("bits-interface-theme");
const initialInterfaceTheme = window.BITS_INTERFACE_THEMES.find(
  (theme) => theme.id === storedInterfaceTheme,
) ?? window.BITS_INTERFACE_THEMES[0];

document.documentElement.dataset.colorScheme = colorScheme;
document.documentElement.dataset.interfaceTheme = initialInterfaceTheme.id;
document.documentElement.classList.toggle(
  "is-rgb-mode",
  localStorage.getItem("bits-rgb-mode") === "true",
);
document.documentElement.dataset.motion =
  localStorage.getItem("bits-motion") === "reduced" ? "reduced" : "system";
document.documentElement.dataset.textsize =
  localStorage.getItem("bits-text-size") === "large" ? "large" : "default";
document.documentElement.dataset.contrast =
  localStorage.getItem("bits-contrast") === "high" ? "high" : "default";
document.documentElement.dataset.effects =
  localStorage.getItem("bits-effects") === "off" ? "off" : "on";
document.documentElement.style.setProperty("--accent", initialAccent.accent);
document.documentElement.style.setProperty("--accent-rgb", initialAccent.rgb);
document.querySelector('meta[name="theme-color"]').content =
  colorScheme === "light"
    ? initialInterfaceTheme.lightColor
    : initialInterfaceTheme.darkColor;
