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

document.documentElement.dataset.colorScheme = colorScheme;
document.documentElement.style.setProperty("--accent", initialAccent.accent);
document.documentElement.style.setProperty("--accent-rgb", initialAccent.rgb);
document.querySelector('meta[name="theme-color"]').content = colorScheme === "light"
  ? "#edf3ef"
  : "#070b0f";
