const baseInterfaceThemes = [
  { id: "default", name: "DEFAULT", darkColor: "#070b0f", lightColor: "#edf3ef" },
  { id: "html", name: "HTML", darkColor: "#ffffff", lightColor: "#ffffff", schemes: ["light"], stylesheet: true },
  {
    id: "aurora",
    name: "AURORA",
    darkColor: "#071018",
    lightColor: "#071018",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "borealis", name: "BOREALIS" },
      { id: "australis", name: "AUSTRALIS", darkColor: "#140a1c" },
      { id: "solar-storm", name: "SOLAR STORM", darkColor: "#1a0808" },
      { id: "glacier", name: "GLACIER", darkColor: "#06121c" },
      { id: "amethyst", name: "AMETHYST", darkColor: "#0f0a1f" },
    ],
  },
  { id: "cozy-blossom", name: "COZY BLOSSOM", darkColor: "#1c1218", lightColor: "#fff4f1" },
  { id: "mica", name: "MICA", darkColor: "#202124", lightColor: "#eef3f8" },
  { id: "fluent", name: "FLUENT", darkColor: "#101722", lightColor: "#f3f8ff" },
  {
    id: "midnight-oled",
    name: "MIDNIGHT OLED",
    darkColor: "#000000",
    lightColor: "#000000",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "classic", name: "CLASSIC" },
      { id: "cyan", name: "CYAN" },
      { id: "crimson", name: "CRIMSON" },
      { id: "violet", name: "VIOLET" },
      { id: "amber", name: "AMBER" },
      { id: "mono", name: "MONOCHROME" },
    ],
  },
  { id: "macos", name: "MACOS", darkColor: "#18181a", lightColor: "#f5f5f7" },
  {
    id: "terminal",
    name: "TERMINAL",
    darkColor: "#000500",
    lightColor: "#000500",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "green", name: "GREEN PHOSPHOR" },
      { id: "white", name: "WHITE PHOSPHOR", darkColor: "#050505" },
      { id: "cyan", name: "CYAN", darkColor: "#00080a" },
      { id: "ibm-blue", name: "IBM BLUE", darkColor: "#00051a" },
      { id: "red-alert", name: "RED ALERT", darkColor: "#0a0000" },
      { id: "amber", name: "AMBER PHOSPHOR", darkColor: "#100a02" },
    ],
  },
  { id: "vaporwave", name: "VAPORWAVE", darkColor: "#160d2b", lightColor: "#fff0fb" },
  { id: "amber-crt", name: "AMBER CRT", darkColor: "#100900", lightColor: "#100900", schemes: ["dark"] },
  { id: "y2k-silver", name: "Y2K SILVER", darkColor: "#252a33", lightColor: "#e8edf4" },
  { id: "cyberpunk", name: "CYBERPUNK", darkColor: "#080712", lightColor: "#f3f000" },
  { id: "dos-blue", name: "DOS BLUE", darkColor: "#0000aa", lightColor: "#d7d7d7", stylesheet: true, variants: [
    { id: "classic-blue", name: "CLASSIC BLUE" },
    { id: "norton-commander", name: "NORTON COMMANDER", darkColor: "#0000a8" },
    { id: "turbo-pascal", name: "TURBO PASCAL", darkColor: "#0000a8" },
    { id: "qbasic", name: "QBASIC", darkColor: "#000080" },
    { id: "amber-mono", name: "AMBER MONO", darkColor: "#120a00" },
    { id: "green-mono", name: "GREEN MONO", darkColor: "#001200" },
    { id: "hercules", name: "HERCULES WHITE", darkColor: "#0a0a0a" },
  ] },
  {
    id: "windows-95",
    name: "WINDOWS 95",
    darkColor: "#002b2b",
    lightColor: "#004c4c",
    nativeScheme: "light",
  },
  { id: "solarized", name: "SOLARIZED", darkColor: "#002b36", lightColor: "#fdf6e3" },
  { id: "nord", name: "NORD", darkColor: "#2e3440", lightColor: "#eceff4" },
  { id: "dracula", name: "DRACULA", darkColor: "#282a36", lightColor: "#f8f8f2" },
  { id: "candy-pop", name: "CANDY POP", darkColor: "#25152d", lightColor: "#fff4fb" },
  {
    id: "rgb", name: "RGB", darkColor: "#090713", lightColor: "#f7f4ff",
    variants: [
      { id: "rainbow", name: "RAINBOW" },
      { id: "synthwave", name: "SYNTHWAVE", palette: ["#ff6bd6", "#db70ff", "#aa80ff", "#819cff", "#65dfff", "#aa80ff", "#db70ff"] },
      { id: "ice-blue", name: "ICE BLUE", palette: ["#65dfff", "#72caff", "#80b2ff", "#929aff", "#80b2ff", "#72caff", "#b2f4ff"] },
      { id: "firestorm", name: "FIRESTORM", palette: ["#ff7070", "#ff8565", "#ffa15e", "#ffc267", "#ffda80", "#ffa15e", "#ff8565"] },
      { id: "toxic-green", name: "TOXIC GREEN", palette: ["#66ff9a", "#8dff70", "#baff66", "#d6ff80", "#baff66", "#8dff70", "#66ffd0"] },
      { id: "cotton-candy", name: "COTTON CANDY", palette: ["#ff9cdd", "#efacff", "#cfb4ff", "#a5d4ff", "#9cf2f5", "#cfb4ff", "#efacff"] },
      { id: "arctic-white", name: "ARCTIC WHITE", palette: ["#f2f8ff", "#dfedff", "#c4e4ff", "#b0f0ff", "#d3f8ff", "#e5eeff", "#f7f7ff"] },
    ],
  },
  {
    id: "aero-glass", name: "AERO GLASS", darkColor: "#0d3358", lightColor: "#cfe8fb",
    stylesheet: true,
    variants: [
      { id: "classic", name: "CLASSIC" },
      { id: "windows-7", name: "WINDOWS 7", darkColor: "#0b3b70", lightColor: "#c6e4fa" },
      { id: "vista", name: "VISTA", darkColor: "#101e21", lightColor: "#d8e7de" },
      { id: "graphite", name: "GRAPHITE", darkColor: "#222831", lightColor: "#e1e5eb" },
      { id: "rose", name: "ROSE", darkColor: "#382432", lightColor: "#f8e7ee" },
      { id: "frost", name: "FROST", darkColor: "#173440", lightColor: "#edf7fc" },
    ],
  },
  {
    id: "minebits",
    name: "MINEBITS",
    darkColor: "#332719",
    lightColor: "#332719",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "overworld", name: "OVERWORLD" },
      { id: "cherry-grove", name: "CHERRY GROVE", darkColor: "#3a2430" },
      { id: "jungle", name: "JUNGLE", darkColor: "#1c2a14" },
      { id: "desert", name: "DESERT", darkColor: "#4a3a22" },
      { id: "snowy-taiga", name: "SNOWY TAIGA", darkColor: "#26323a" },
      { id: "ocean-monument", name: "OCEAN MONUMENT", darkColor: "#0d2a2e" },
      { id: "deep-dark", name: "DEEP DARK", darkColor: "#05080c" },
      { id: "nether", name: "NETHER", darkColor: "#2a0c0c" },
      { id: "the-end", name: "THE END", darkColor: "#120d1c" },
      { id: "creeper", name: "CREEPER", darkColor: "#13240f" },
      { id: "mushroom-fields", name: "MUSHROOM FIELDS", darkColor: "#302532" },
    ],
  },
  { id: "catppuccin", name: "CATPPUCCIN", darkColor: "#1e1e2e", lightColor: "#eff1f5" },
  { id: "gruvbox", name: "GRUVBOX", darkColor: "#282828", lightColor: "#fbf1c7" },
  { id: "tokyo-night", name: "TOKYO NIGHT", darkColor: "#1a1b26", lightColor: "#e1e2e7" },
  { id: "monokai", name: "MONOKAI", darkColor: "#272822", lightColor: "#fafaf5" },
  { id: "game-bit", name: "GAME BIT", darkColor: "#0f380f", lightColor: "#9bbc0f", stylesheet: true, variants: [
    { id: "dmg", name: "ORIGINAL (DMG)" },
    { id: "pocket", name: "POCKET", darkColor: "#2b2b26", lightColor: "#c5c7b8" },
    { id: "color-berry", name: "COLOR BERRY", darkColor: "#3a0b2a", lightColor: "#f2d6e6" },
    { id: "color-teal", name: "COLOR TEAL", darkColor: "#06302f", lightColor: "#cdeceb" },
    { id: "color-dandelion", name: "COLOR DANDELION", darkColor: "#3a3000", lightColor: "#fff1a8" },
    { id: "advance-indigo", name: "ADVANCE INDIGO", darkColor: "#1c1650", lightColor: "#dcd8ff" },
    { id: "advance-sp", name: "ADVANCE SP", darkColor: "#1f2329", lightColor: "#e4e8ee" },
  ] },
  { id: "high-contrast", name: "HIGH CONTRAST", darkColor: "#000000", lightColor: "#ffffff" },
  { id: "ocean", name: "DEEP OCEAN", darkColor: "#03141f", lightColor: "#e6f6f8" },
  { id: "coffee", name: "COFFEE SHOP", darkColor: "#1f1510", lightColor: "#f6efe4" },
  { id: "matrix", name: "MATRIX", darkColor: "#000a02", lightColor: "#000a02", schemes: ["dark"] },
  { id: "sunset", name: "SUNSET", darkColor: "#1d0f24", lightColor: "#fff1e6" },
  { id: "eink-reader", name: "E-INK READER", darkColor: "#222321", lightColor: "#eeeadd", nativeScheme: "light", stylesheet: true },
  { id: "blueprint", name: "BLUEPRINT", darkColor: "#0b2443", lightColor: "#e6f0fa", stylesheet: true },
  { id: "spacecraft", name: "SPACECRAFT CONSOLE", darkColor: "#20292d", lightColor: "#eee8d9", stylesheet: true },
  { id: "frutiger-eco", name: "FRUTIGER ECO", darkColor: "#12362f", lightColor: "#e5f4e9", nativeScheme: "light", stylesheet: true },
  { id: "holographic", name: "HOLOGRAPHIC FOIL", darkColor: "#1b1c2e", lightColor: "#f0effb", stylesheet: true },
  { id: "newspaper", name: "NEWSPAPER", darkColor: "#26231f", lightColor: "#f3eddf", nativeScheme: "light", stylesheet: true },
  { id: "workbench", name: "WORKBENCH", darkColor: "#272b2e", lightColor: "#e4e6e5", stylesheet: true },
  { id: "stickerbook", name: "STICKERBOOK", darkColor: "#302938", lightColor: "#fff1e6", nativeScheme: "light", stylesheet: true },
  { id: "night-train", name: "NIGHT TRAIN", darkColor: "#101e30", lightColor: "#e8e8df", stylesheet: true },
  { id: "museum", name: "MUSEUM TERMINAL", darkColor: "#292925", lightColor: "#f5f2e9", nativeScheme: "light", stylesheet: true },
  {
    id: "windows-31",
    name: "WINDOWS 3.1",
    darkColor: "#000000",
    lightColor: "#008080",
    nativeScheme: "light",
    stylesheet: true,
    variants: [
      { id: "windows-31", name: "WINDOWS 3.1" },
      { id: "windows-2", name: "WINDOWS 2.X", lightColor: "#ffffff" },
      { id: "windows-1", name: "WINDOWS 1.0", lightColor: "#ffffff" },
      { id: "hotdog-stand", name: "HOTDOG STAND", lightColor: "#ffff00" },
      { id: "arizona", name: "ARIZONA", lightColor: "#c08048" },
      { id: "ocean", name: "OCEAN", lightColor: "#4f7fa8" },
      { id: "plasma-power-saver", name: "PLASMA POWER SAVER", lightColor: "#000080" },
    ],
  },
  {
    id: "spotify",
    name: "SPOTIFY",
    darkColor: "#121212",
    lightColor: "#121212",
    schemes: ["dark"],
    stylesheet: true,
  },
  {
    id: "uefi",
    name: "UEFI",
    darkColor: "#0b0d12",
    lightColor: "#0b0d12",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "ez-mode", name: "EZ MODE" },
      { id: "gamer-red", name: "GAMER RED", darkColor: "#120405" },
      { id: "dragon", name: "DRAGON", darkColor: "#0e0e0e" },
      { id: "aorus", name: "AORUS ORANGE", darkColor: "#0f0a05" },
      { id: "workstation", name: "WORKSTATION", darkColor: "#0a1220" },
    ],
  },
  {
    id: "aqua",
    name: "AQUA",
    darkColor: "#e8e8e8",
    lightColor: "#e8e8e8",
    schemes: ["light"],
    stylesheet: true,
    variants: [
      { id: "blue", name: "AQUA BLUE" },
      { id: "graphite", name: "GRAPHITE" },
      { id: "brushed-metal", name: "BRUSHED METAL", lightColor: "#b8b8b8" },
    ],
  },
  {
    id: "aquatic",
    name: "AQUATIC",
    darkColor: "#022a3a",
    lightColor: "#022a3a",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "coral-reef", name: "CORAL REEF" },
      { id: "kelp-forest", name: "KELP FOREST", darkColor: "#0a2a1a" },
      { id: "tropical-lagoon", name: "TROPICAL LAGOON", darkColor: "#03404a" },
      { id: "abyss", name: "THE ABYSS", darkColor: "#01060f" },
      { id: "arctic", name: "ARCTIC WATERS", darkColor: "#0b2233" },
    ],
  },
  {
    id: "atari",
    name: "ATARI",
    darkColor: "#1a0f08",
    lightColor: "#1a0f08",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "2600", name: "2600 WOODGRAIN" },
      { id: "2600-jr", name: "2600 JR", darkColor: "#111111" },
      { id: "7800", name: "7800 PROSYSTEM", darkColor: "#0d0d10" },
      { id: "st-gem", name: "ST GEM DESKTOP", darkColor: "#00a800" },
      { id: "pong", name: "PONG", darkColor: "#000000" },
    ],
  },
  {
    id: "commodore-64",
    name: "COMMODORE 64",
    darkColor: "#40318d",
    lightColor: "#40318d",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "c64", name: "C64 BASIC" },
      { id: "c64-breadbin", name: "BREADBIN", darkColor: "#2a2620" },
      { id: "vic-20", name: "VIC-20", darkColor: "#1b1b6b" },
      { id: "pet", name: "PET 2001", darkColor: "#000000" },
      { id: "c128", name: "C128 80-COLUMN", darkColor: "#111111" },
    ],
  },
  {
    id: "mac-os-9",
    name: "MAC OS 9",
    darkColor: "#666699",
    lightColor: "#666699",
    schemes: ["light"],
    stylesheet: true,
    variants: [
      { id: "platinum", name: "PLATINUM" },
      { id: "graphite", name: "GRAPHITE" },
      { id: "hi-tech", name: "HI-TECH", darkColor: "#202428", lightColor: "#202428" },
      { id: "gizmo", name: "GIZMO", lightColor: "#d6a54a" },
      { id: "drawing-board", name: "DRAWING BOARD", lightColor: "#e9e2c9" },
    ],
  },
  {
    id: "winamp",
    name: "WINAMP",
    darkColor: "#1c1c2c",
    lightColor: "#1c1c2c",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "classic", name: "BASE SKIN" },
      { id: "modern", name: "MODERN", darkColor: "#202020" },
      { id: "bento", name: "BENTO", darkColor: "#1a1a1a" },
      { id: "nucleo", name: "NUCLEO", darkColor: "#0a0f14" },
      { id: "llama", name: "WHIPS THE LLAMA", darkColor: "#2a1606" },
    ],
  },
  {
    id: "ipod-classic",
    name: "IPOD CLASSIC",
    darkColor: "#1b1b1d",
    lightColor: "#f2f2f2",
    nativeScheme: "light",
    stylesheet: true,
    variants: [
      { id: "silver", name: "SILVER" },
      { id: "black", name: "BLACK", lightColor: "#2a2a2c" },
      { id: "u2", name: "U2 SPECIAL EDITION", lightColor: "#1a1a1a" },
      { id: "nano-pink", name: "NANO PINK", lightColor: "#ffd6e7" },
      { id: "nano-green", name: "NANO GREEN", lightColor: "#d8f5c4" },
      { id: "mini-blue", name: "MINI BLUE", lightColor: "#cfe6ff" },
    ],
  },
  {
    id: "ubuntu",
    name: "UBUNTU",
    darkColor: "#2c001e",
    lightColor: "#f6f5f4",
    stylesheet: true,
    variants: [
      { id: "yaru", name: "UBUNTU YARU" },
      { id: "human", name: "HUMAN (2006 BROWN)", darkColor: "#2b1d0e", lightColor: "#e9dcc5" },
      { id: "unity", name: "UNITY", darkColor: "#2c001e", lightColor: "#f2f1f0" },
      { id: "adwaita", name: "GNOME ADWAITA", darkColor: "#242424", lightColor: "#fafafa" },
      { id: "kubuntu", name: "KUBUNTU BREEZE", darkColor: "#1b1e20", lightColor: "#eff0f1" },
    ],
  },
  {
    id: "playstation",
    name: "PLAYSTATION",
    darkColor: "#000010",
    lightColor: "#000010",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "ps2", name: "PS2 BROWSER" },
      { id: "ps1", name: "PS1 MEMORY CARD", darkColor: "#0b0b1a" },
      { id: "ps3-xmb", name: "PS3 XMB", darkColor: "#0a1a3a" },
      { id: "psp", name: "PSP", darkColor: "#141414" },
    ],
  },
  {
    id: "xbox",
    name: "XBOX",
    darkColor: "#0a1a05",
    lightColor: "#0a1a05",
    schemes: ["dark"],
    stylesheet: true,
    variants: [
      { id: "original", name: "ORIGINAL XBOX" },
      { id: "blades", name: "360 BLADES", darkColor: "#1a1a1a" },
      { id: "nxe", name: "360 NXE", darkColor: "#0b1f0b" },
      { id: "one", name: "XBOX ONE", darkColor: "#107c10" },
    ],
  },
  {
    id: "windows-xp",
    name: "WINDOWS XP",
    darkColor: "#0b1f4a",
    lightColor: "#245edb",
    nativeScheme: "light",
    stylesheet: true,
    variants: [
      { id: "luna-blue", name: "LUNA BLUE" },
      { id: "olive-green", name: "OLIVE GREEN", lightColor: "#8ba169" },
      { id: "silver", name: "SILVER", lightColor: "#b6b6c8" },
      { id: "royale", name: "ROYALE (MEDIA CENTER)", lightColor: "#2c4f9e" },
      { id: "royale-noir", name: "ROYALE NOIR", lightColor: "#1b1b1b" },
      { id: "zune", name: "ZUNE", lightColor: "#2b2b2b" },
      { id: "embedded", name: "EMBEDDED", lightColor: "#3d6aa8" },
    ],
  },
  {
    id: "windows-10",
    name: "WINDOWS 10",
    darkColor: "#1f1f1f",
    lightColor: "#f2f2f2",
    experimental: true,
    desktopCapable: true,
  },
  {
    id: "windows-11",
    name: "WINDOWS 11",
    darkColor: "#202020",
    lightColor: "#f3f3f3",
    nativeScheme: "light",
    experimental: true,
    desktopCapable: true,
  },
  { id: "termius", name: "TERMIUS", darkColor: "#141729", lightColor: "#eef0f7", experimental: true, desktopCapable: true },
  { id: "youtube", name: "YOUTUBE", darkColor: "#0f0f0f", lightColor: "#ffffff", experimental: true, desktopCapable: true },
  {
    id: "m365",
    name: "BITS 365",
    darkColor: "#1b1a19",
    lightColor: "#faf9f8",
    nativeScheme: "light",
    experimental: true,
    desktopCapable: true,
  },
  {
    id: "google",
    name: "GOOGLE",
    darkColor: "#202124",
    lightColor: "#ffffff",
    nativeScheme: "light",
    experimental: true,
    desktopCapable: true,
  },
  {
    id: "browser",
    name: "BROWSER",
    darkColor: "#202124",
    lightColor: "#dee1e6",
    nativeScheme: "light",
    experimental: true,
    desktopCapable: true,
    variants: [
      { id: "chrome", name: "CHROME" },
      { id: "firefox", name: "FIREFOX", darkColor: "#1c1b22", lightColor: "#f0f0f4" },
      { id: "edge", name: "EDGE", darkColor: "#202020", lightColor: "#f7f7f7" },
      { id: "edge-legacy", name: "EDGE LEGACY (2015)", darkColor: "#2b2b2b", lightColor: "#e6e6e6" },
      { id: "internet-explorer", name: "INTERNET EXPLORER 6", darkColor: "#0a246a", lightColor: "#ece9d8" },
      { id: "safari", name: "SAFARI", darkColor: "#2a2a2c", lightColor: "#f5f5f7" },
      { id: "opera", name: "OPERA GX", darkColor: "#120f1a", lightColor: "#120f1a" },
      { id: "netscape", name: "NETSCAPE NAVIGATOR", darkColor: "#808080", lightColor: "#c0c0c0" },
    ],
  },
  {
    id: "windows-8",
    name: "WINDOWS 8",
    darkColor: "#1d1d1d",
    lightColor: "#2d0a52",
    experimental: true,
    desktopCapable: true,
    variants: [
      { id: "purple", name: "PURPLE START" },
      { id: "teal", name: "TEAL START" },
      { id: "crimson", name: "CRIMSON START" },
      { id: "green", name: "GREEN START" },
      { id: "blue", name: "BLUE START" },
    ],
  },
  {
    id: "legacy-bios",
    name: "LEGACY BIOS",
    darkColor: "#0000a8",
    lightColor: "#0000a8",
    schemes: ["dark"],
    experimental: true,
    desktopCapable: true,
    variants: [
      { id: "award", name: "AWARD" },
      { id: "phoenix", name: "PHOENIX", darkColor: "#a8a8a8" },
      { id: "ami", name: "AMI", darkColor: "#0000a8" },
    ],
  },
  {
    id: "youtube-music",
    name: "YOUTUBE MUSIC",
    darkColor: "#030303",
    lightColor: "#030303",
    schemes: ["dark"],
    experimental: true,
    desktopCapable: true,
  },
];
for (const [id, name] of [
  ["pride", "PRIDE (PROGRESS PRIDE)"],
  ["pride-rainbow", "RAINBOW"],
  ["pride-non-binary", "NON-BINARY"],
  ["pride-transgender", "TRANSGENDER"],
  ["pride-lesbian", "LESBIAN"],
  ["pride-gay", "GAY"],
  ["pride-bisexual", "BISEXUAL"],
  ["pride-pansexual", "PANSEXUAL"],
  ["pride-asexual", "ASEXUAL"],
  ["pride-aromantic", "AROMANTIC"],
  ["pride-aroace", "AROACE"],
  ["pride-agender", "AGENDER"],
  ["pride-genderfluid", "GENDERFLUID"],
  ["pride-genderqueer", "GENDERQUEER"],
  ["pride-intersex", "INTERSEX"],
  ["pride-polysexual", "POLYSEXUAL"],
  ["pride-omnisexual", "OMNISEXUAL"],
  ["pride-demisexual", "DEMISEXUAL"],
  ["pride-demiromantic", "DEMIROMANTIC"],
  ["pride-lgbtq", "LGBTQ RAINBOW (PHILADELPHIA)"],
]) {
  baseInterfaceThemes.push({
    id, name, pride: true, darkColor: "#100f18", lightColor: "#faf8fc", stylesheet: "pride",
  });
}
const layoutAssetVersion = "layouts-9";
const lastStandardThemeKey = "bits-last-standard-theme";
const themeVariantKey = "bits-theme-variants";

const colorSchemeKey = "bits-color-scheme";
const colorSchemeOptions = [
  { value: "auto", label: "THEME DEFAULT" },
  { value: "dark", label: "DARK" },
  { value: "light", label: "LIGHT" },
];

const seasonalInterfaceThemes = {
  winter: { id: "winter", name: "WINTER", darkColor: "#07131f", lightColor: "#eaf7ff", seasonal: true },
  spooky: { id: "spooky", name: "SPOOKY", darkColor: "#140b18", lightColor: "#fff0dc", seasonal: true },
  christmas: { id: "christmas", name: "CHRISTMAS", darkColor: "#07150f", lightColor: "#fff7e8", seasonal: true },
  "new-year": { id: "new-year", name: "NEW YEAR", darkColor: "#080a18", lightColor: "#fff8dc", seasonal: true },
  valentines: { id: "valentines", name: "VALENTINE'S DAY", darkColor: "#210e1a", lightColor: "#fff3ee", seasonal: true },
  "st-patricks": { id: "st-patricks", name: "ST. PATRICK'S DAY", darkColor: "#071c14", lightColor: "#f5f8e9", seasonal: true },
  easter: { id: "easter", name: "EASTER", darkColor: "#19162c", lightColor: "#fbf5ff", seasonal: true },
  "earth-day": { id: "earth-day", name: "EARTH DAY", darkColor: "#071c21", lightColor: "#eef8ee", seasonal: true },
  "independence-day": { id: "independence-day", name: "INDEPENDENCE DAY", darkColor: "#0b1530", lightColor: "#f5f7ff", seasonal: true },
  thanksgiving: { id: "thanksgiving", name: "THANKSGIVING", darkColor: "#24150e", lightColor: "#fff5e7", seasonal: true },
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
  if (month === 1 && day === 14) {
    availableThemeIds.push("valentines");
  }
  if (month === 2 && day === 17) {
    availableThemeIds.push("st-patricks");
  }
  if (month === 3 && day === 22) {
    availableThemeIds.push("earth-day");
  }
  if ((month === 2 || month === 3) && isEasterSunday(date)) {
    availableThemeIds.push("easter");
  }
  if (month === 6 && day === 4) {
    availableThemeIds.push("independence-day");
  }
  if (month === 10 && date.getDay() === 4 && day >= 22 && day <= 28) {
    availableThemeIds.push("thanksgiving");
  }

  const automaticThemeId = availableThemeIds.at(-1) || "";

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
  .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
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
  if (!theme.experimental) {
    localStorage.setItem(lastStandardThemeKey, theme.id);
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

function getColorSchemePreference() {
  const stored = localStorage.getItem(colorSchemeKey);
  return stored === "dark" || stored === "light" ? stored : "auto";
}

function getLockedScheme(theme) {
  return theme?.schemes?.length === 1 ? theme.schemes[0] : "";
}

function readVariantMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(themeVariantKey) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getThemeVariant(theme) {
  if (!theme?.variants?.length) {
    return null;
  }
  const storedId = readVariantMap()[theme.id];
  return theme.variants.find((variant) => variant.id === storedId) ?? theme.variants[0];
}

function setThemeVariant(themeId, variantId) {
  const theme = window.BITS_INTERFACE_THEMES.find((entry) => entry.id === themeId);
  if (!theme?.variants?.some((variant) => variant.id === variantId)) {
    return null;
  }
  const map = readVariantMap();
  if (variantId === theme.variants[0].id) {
    delete map[theme.id];
  } else {
    map[theme.id] = variantId;
  }
  localStorage.setItem(themeVariantKey, JSON.stringify(map));
  if (document.documentElement.dataset.interfaceTheme === theme.id) {
    applyThemeToDocument(theme.id);
  }
  return getThemeVariant(theme);
}

function resolveColorScheme(theme) {
  const locked = getLockedScheme(theme);
  if (locked) {
    return locked;
  }
  const preference = getColorSchemePreference();
  if (preference !== "auto") {
    return preference;
  }
  return theme?.nativeScheme === "light" ? "light" : "dark";
}

function applyThemeToDocument(themeId) {
  const theme = window.BITS_INTERFACE_THEMES.find((entry) => entry.id === themeId)
    ?? window.BITS_INTERFACE_THEMES[0];
  const scheme = resolveColorScheme(theme);
  const root = document.documentElement;
  root.dataset.colorScheme = scheme;
  root.dataset.interfaceTheme = theme.id;
  root.classList.toggle("is-rgb-mode", theme.id === "rgb");
  const variant = getThemeVariant(theme);
  if (variant) {
    root.dataset.themeVariant = variant.id;
  } else {
    delete root.dataset.themeVariant;
  }
  if (variant?.palette || root.style.getPropertyValue("--rgb-edge-colors")) {
    for (let index = 0; index < 7; index += 1) {
      const color = variant?.palette?.[index];
      const channels = color ? color.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16)) : null;
      ["red", "green", "blue"].forEach((channel, channelIndex) => {
        const property = `--rgb-palette-${index}-${channel}`;
        if (channels) {
          root.style.setProperty(property, channels[channelIndex]);
        } else {
          root.style.removeProperty(property);
        }
        if (index === 0) {
          if (channels) {
            root.style.setProperty(`--rgb-accent-${channel}`, channels[channelIndex]);
          } else {
            root.style.removeProperty(`--rgb-accent-${channel}`);
          }
        }
      });
    }
    if (variant?.palette) {
      root.style.setProperty("--rgb-edge-colors", [...variant.palette, variant.palette[0]].join(", "));
    } else {
      root.style.removeProperty("--rgb-edge-colors");
    }
    [0, 2, 4].forEach((paletteIndex, index) => {
      const property = `--rgb-glow-${index}`;
      if (variant?.palette) {
        root.style.setProperty(property, `${variant.palette[paletteIndex]}29`);
      } else {
        root.style.removeProperty(property);
      }
    });
  }
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.content = scheme === "light"
      ? variant?.lightColor ?? theme.lightColor
      : variant?.darkColor ?? theme.darkColor;
  }
  syncThemeAssets(theme);
  window.dispatchEvent(new CustomEvent("bits:theme-applied", {
    detail: { theme, scheme, variant },
  }));
  return theme;
}

function setColorSchemePreference(preference) {
  if (preference === "dark" || preference === "light") {
    localStorage.setItem(colorSchemeKey, preference);
  } else {
    localStorage.removeItem(colorSchemeKey);
  }
  return applyThemeToDocument(document.documentElement.dataset.interfaceTheme);
}

function pickRandomThemeId() {
  const currentThemeId = document.documentElement.dataset.interfaceTheme;
  const candidates = window.BITS_INTERFACE_THEMES.filter(
    (theme) => theme.id !== currentThemeId && !theme.experimental,
  );
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

function setPickerVisibility(container, visible) {
  if (!container) {
    return;
  }
  container.hidden = !visible;
  container.style.display = visible ? "" : "none";
}

function bindColorSchemeSelect(select, formatLabel = (label) => label, container = select?.closest("label")) {
  if (!select) {
    return;
  }
  select.replaceChildren(...colorSchemeOptions.map(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = formatLabel(label);
    return option;
  }));
  const lockedOption = document.createElement("option");
  lockedOption.value = "locked";
  const syncLock = () => {
    const theme = getThemeById(document.documentElement.dataset.interfaceTheme);
    const locked = getLockedScheme(theme);
    setPickerVisibility(container, !locked);
    if (locked) {
      lockedOption.textContent = formatLabel(`${locked.toUpperCase()} ONLY`);
      if (!lockedOption.isConnected) {
        select.append(lockedOption);
      }
      select.value = "locked";
      select.disabled = true;
      select.title = `${theme.name} is designed for ${locked} mode only`;
    } else {
      lockedOption.remove();
      select.disabled = false;
      select.removeAttribute("title");
      select.value = getColorSchemePreference();
    }
  };
  syncLock();
  select.addEventListener("change", () => {
    if (select.value === "locked") {
      return;
    }
    setColorSchemePreference(select.value);
    window.dispatchEvent(new CustomEvent("bits:appearance-changed", {
      detail: {
        label: "COLOR MODE",
        value: colorSchemeOptions.find((option) => option.value === select.value)?.label,
      },
    }));
  });
  window.addEventListener("bits:theme-applied", syncLock);
  window.addEventListener("storage", (event) => {
    if (event.key === colorSchemeKey) {
      setColorSchemePreference(getColorSchemePreference());
    }
  });
}

function bindVariantSelect(select, formatLabel = (label) => label, container = select?.closest("label")) {
  if (!select) {
    return;
  }
  let renderedThemeId = null;
  const sync = () => {
    const theme = getThemeById(document.documentElement.dataset.interfaceTheme);
    const variants = theme?.variants ?? [];
    setPickerVisibility(container, variants.length > 0);
    if (renderedThemeId !== theme?.id) {
      renderedThemeId = theme?.id ?? null;
      select.replaceChildren(...variants.map((variant) => {
        const option = document.createElement("option");
        option.value = variant.id;
        option.textContent = formatLabel(variant.name);
        return option;
      }));
    }
    const variant = getThemeVariant(theme);
    if (variant) {
      select.value = variant.id;
    }
  };
  sync();
  select.addEventListener("change", () => {
    const themeId = document.documentElement.dataset.interfaceTheme;
    const variant = setThemeVariant(themeId, select.value);
    if (variant) {
      window.dispatchEvent(new CustomEvent("bits:appearance-changed", {
        detail: { label: "VARIANT", value: variant.name },
      }));
    }
  });
  window.addEventListener("bits:theme-applied", sync);
  window.addEventListener("storage", (event) => {
    if (event.key === themeVariantKey) {
      applyThemeToDocument(document.documentElement.dataset.interfaceTheme);
    }
  });
}

function getThemeById(themeId) {
  return window.BITS_INTERFACE_THEMES.find((theme) => theme.id === themeId) ?? null;
}

function getLastStandardThemeId() {
  const storedId = localStorage.getItem(lastStandardThemeKey);
  const storedTheme = getThemeById(storedId);
  return storedTheme && !storedTheme.experimental ? storedTheme.id : "default";
}

function getThemeGroups() {
  const families = [
    ["Essentials", ["default", "html", "high-contrast"]],
    ["macOS", ["macos", "aqua", "mac-os-9"]],
    ["Windows", ["windows-31", "windows-95", "windows-xp", "aero-glass", "windows-8", "windows-10", "windows-11", "mica", "fluent"]],
    ["Terminals & retro computers", ["terminal", "amber-crt", "dos-blue", "matrix", "termius", "legacy-bios", "uefi", "commodore-64", "ubuntu"]],
    ["Games & consoles", ["game-bit", "atari", "playstation", "xbox", "minebits"]],
    ["Media & web", ["spotify", "winamp", "ipod-classic", "youtube", "youtube-music", "m365", "google", "browser"]],
    ["Color palettes", ["solarized", "nord", "dracula", "catppuccin", "gruvbox", "tokyo-night", "monokai", "rgb", "midnight-oled"]],
    ["Pride", window.BITS_INTERFACE_THEMES.filter(theme => theme.pride).map(theme => theme.id)],
    ["Atmospheres & materials", []],
    ["Seasonal", []],
  ];
  const groups = families.map(([name]) => ({ name, themes: [] }));
  for (const theme of window.BITS_INTERFACE_THEMES) {
    const index = theme.seasonal ? families.length - 1
      : families.findIndex(([, ids]) => ids.includes(theme.id));
    groups[index < 0 ? families.length - 2 : index].themes.push(theme);
  }
  return groups.filter(group => group.themes.length);
}

function buildThemeOptions(formatLabel = (label) => label) {
  const createOption = (theme) => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = formatLabel(theme.name, theme);
    return option;
  };
  const special = themeDebugEnabled
    ? window.BITS_INTERFACE_THEMES.filter((theme) => theme.seasonal)
    : [];
  const standard = window.BITS_INTERFACE_THEMES.filter((theme) => (
    !theme.experimental && !theme.pride && !(themeDebugEnabled && theme.seasonal)
  ));
  const pride = window.BITS_INTERFACE_THEMES.filter(theme => theme.pride);
  const experimental = window.BITS_INTERFACE_THEMES.filter((theme) => theme.experimental);
  const nodes = [];
  for (const [label, themes] of [
    ["STANDARD THEMES", standard],
    ["PRIDE", pride],
    ["SPECIAL THEMES", special],
    ["EXPERIMENTAL LAYOUTS", experimental],
  ]) {
    if (!themes.length) {
      continue;
    }
    const group = document.createElement("optgroup");
    group.label = formatLabel(label);
    group.append(...themes.map(createOption));
    nodes.push(group);
  }
  return nodes;
}

function getPageId() {
  const path = window.location?.pathname ?? "/";
  if (path === "/" || path === "/index.html") {
    return "chooser";
  }
  if (path.startsWith("/online")) {
    return "online";
  }
  if (path.startsWith("/nowplaying")) {
    return "nowplaying";
  }
  if (path.startsWith("/professional/resume")) {
    return "resume";
  }
  if (path.startsWith("/professional")) {
    return "professional";
  }
  if (path.startsWith("/blog")) {
    return path.includes("post") ? "post" : "blog";
  }
  if (path.startsWith("/boot")) {
    return "boot";
  }
  return "error";
}

function syncThemeAssets(theme) {
  const root = document.documentElement;
  const head = document.head;
  if (!head) {
    return;
  }
  if (theme.experimental) {
    root.dataset.layoutTheme = theme.id;
  } else {
    delete root.dataset.layoutTheme;
  }
  const stylesheetId = typeof theme.stylesheet === "string" ? theme.stylesheet : theme.id;
  const stylesheetHref = theme.experimental || theme.stylesheet
    ? `/shared/styles/layouts/${stylesheetId}.css?v=${layoutAssetVersion}`
    : "";
  let stylesheet = document.getElementById("bits-theme-stylesheet");
  if (!stylesheetHref) {
    stylesheet?.remove();
  } else if (!stylesheet || stylesheet.getAttribute("href") !== stylesheetHref) {
    const nextStylesheet = document.createElement("link");
    nextStylesheet.rel = "stylesheet";
    nextStylesheet.href = stylesheetHref;
    nextStylesheet.id = "bits-theme-stylesheet";
    if (stylesheet) {
      stylesheet.replaceWith(nextStylesheet);
    } else {
      head.append(nextStylesheet);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        const current = document.getElementById("bits-theme-stylesheet");
        if (current && current !== head.lastElementChild) {
          const laterStylesheets = [...head.querySelectorAll('link[rel="stylesheet"], style')];
          if (laterStylesheets.at(-1) !== current) {
            head.append(current);
          }
        }
      }, { once: true });
    }
  }
  if (theme.experimental && root.dataset.page !== "nowplaying" && !document.getElementById("bits-layout-runtime")) {
    const runtime = document.createElement("script");
    runtime.src = `/shared/scripts/layouts/runtime.js?v=${layoutAssetVersion}`;
    runtime.id = "bits-layout-runtime";
    runtime.defer = true;
    head.append(runtime);
  }
}

document.documentElement.dataset.page = getPageId();

window.BITS_THEME_PREFERENCE = {
  dismissalKey: seasonalDismissalKey,
  choiceKey: seasonalChoiceKey,
  layoutAssetVersion,
  getTheme: getThemeById,
  getLastStandard: getLastStandardThemeId,
  buildOptions: buildThemeOptions,
  getGroups: getThemeGroups,
  colorSchemeKey,
  colorSchemeOptions,
  select: selectInterfaceTheme,
  resolve: resolveInterfaceTheme,
  apply: applyThemeToDocument,
  getColorScheme: getColorSchemePreference,
  setColorScheme: setColorSchemePreference,
  bindColorSchemeSelect,
  bindVariantSelect,
  getVariant: (themeId) => getThemeVariant(getThemeById(themeId)),
  setVariant: setThemeVariant,
  getLockedScheme: (themeId) => getLockedScheme(getThemeById(themeId)),
  pickRandom: pickRandomThemeId,
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

applyThemeToDocument(initialInterfaceTheme.id);
document.documentElement.dataset.motion =
  localStorage.getItem("bits-motion") === "reduced" ? "reduced" : "system";
document.documentElement.dataset.textsize =
  localStorage.getItem("bits-text-size") === "large" ? "large" : "default";
document.documentElement.dataset.contrast =
  localStorage.getItem("bits-contrast") === "high" ? "high" : "default";
document.documentElement.dataset.effects =
  localStorage.getItem("bits-effects") === "off" ? "off" : "on";
document.documentElement.dataset.einkRefresh =
  localStorage.getItem("bits-eink-refresh") === "on" ? "on" : "off";
if (document.documentElement.dataset.page === "online") {
  let runtimeLite = false;
  try {
    runtimeLite = sessionStorage.getItem("bits-runtime-performance-lite") === "true";
  } catch {
    // The initial viewport/hardware decision still works without session storage.
  }
  const device = typeof navigator === "undefined" ? {} : navigator;
  const initialPerformanceLite = window.matchMedia("(max-width: 700px), (prefers-reduced-motion: reduce)").matches
    || document.documentElement.dataset.motion === "reduced"
    || (device.deviceMemory ?? 8) <= 4
    || (device.hardwareConcurrency ?? 8) <= 4
    || device.connection?.saveData === true
    || runtimeLite;
  document.documentElement.classList.toggle("is-performance-lite", initialPerformanceLite);
  document.documentElement.dataset.performanceProfile = initialPerformanceLite ? "lite" : "full";
}
if (
  legacyRgbMode
  || !storedInterfaceThemeId
  || !baseInterfaceThemes.some((theme) => theme.id === storedInterfaceThemeId)
) {
  localStorage.setItem("bits-interface-theme", savedInterfaceTheme.id);
}
localStorage.removeItem("bits-accent");
localStorage.removeItem("bits-rgb-mode");
