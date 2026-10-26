# Themes and appearance

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- Distinct decorative atmospheres for every interface theme, including circuit
  pulses, aurora ribbons, petals, acrylic lighting, reveal sweeps, OLED stars,
  color orbs, and phosphor effects. These respect decorative-effects, contrast,
  reduced-motion, forced-colors, and performance preferences

- A persistent RGB interface theme that cycles rainbow gradients around the
  main shell, desktop-window edges, falling Bits, and themed scrollbars

- Fifty-five persistent full-interface themes, each with its own fixed accent,
  background, window treatment, typography, and scrollbar. These include
  Default, Aurora, Cozy Blossom, Mica, Fluent, Midnight OLED, macOS, Terminal,
  Vaporwave, Amber CRT, Y2K Silver, Cyberpunk, DOS Blue, Windows 95, Windows XP
  (Luna), Solarized, Nord, Dracula, Candy Pop, RGB, Aero Glass, Catppuccin,
  Gruvbox, Tokyo Night, Monokai, Game Bit, High Contrast, Deep Ocean, Coffee
  Shop, Matrix, Sunset, the original voxel-inspired MineBits, Windows 3.1,
  Spotify, UEFI, Mac OS X Aqua, Aquatic (underwater), Atari, Commodore 64,
  Mac OS 9 Platinum, Winamp, iPod Classic, Ubuntu, PlayStation, Xbox, E-Ink
  Reader, Blueprint, Spacecraft Console, Frutiger Eco, Holographic Foil,
  Newspaper, Workbench, Stickerbook, Night Train, and Museum Terminal.
  The ten newest themes support dark/light modes and load their stylesheets
  (including their shared collection styles) only while selected. E-Ink,
  Frutiger Eco, Newspaper, Stickerbook, and Museum default to light mode.
  Holographic uses a pointer-responsive foil border without a continuous
  animation loop; it remains static with reduced motion or effects off.
  E-Ink adds an optional **Gentle E-Ink Refresh** checkbox in Settings > Appearance,
  visible only while E-Ink is selected and **off by default**. It remembers your
  choice and briefly overlays a low-opacity neutral tint when opening or
  restoring a window, never just focusing an already-visible window or
  restoring the session during page startup. Refreshes
  are limited to one per two seconds and suppressed by reduced motion, effects
  off, high contrast, forced colors, or a hidden tab; Reset All clears the choice.
  Run `node scripts/theme-collection-browser.mjs` for desktop/mobile theme,
  accessibility, persistence, lazy-loading, and optional-effect checks.
  Aero Glass includes **Classic** (the unchanged existing look), **Windows 7**
  (sky-blue glass and brighter desktop light), and **Vista** (smokier glass with
  green-blue aurora accents), plus **Graphite**, **Rose**, and **Frost**.
  Select Aero Glass, then use **Variant** in View or Settings.
  All five alternate variants offer dark/light palettes, persist across shared
  public pages, and use original CSS gradients rather than bundled Windows
  wallpapers or artwork. Their stylesheet loads only while Aero Glass is active;
  high-contrast, effects-off, and forced-color preferences remain available.
  Run `node scripts/aero-variants-browser.mjs` to check both pickers, persistence,
  desktop/mobile accessibility, and Classic compatibility.

- Experimental layout themes that restyle the whole interface rather than just
  its colors: Windows 10, Windows 11, Windows 8 (Metro), Termius, YouTube
  (BitsTube), YouTube Music, Bits 365, Google, Browser, and Legacy BIOS. They
  are grouped under EXPERIMENTAL LAYOUTS in every
  theme picker, show a dismissible experimental notice with a one-click way
  back to the last standard theme, and are skipped by RANDOM THEME. Windows 8,
  10, and 11 also restyle the BITS OS desktop; the others temporarily switch the
  desktop to the last standard theme (with a notification) and come back when
  the desktop is closed. Each layout lives in `layouts/<id>.css` and
  `layouts/<id>.js` and is only downloaded while that theme is active;
  `layouts/runtime.js` mounts and unmounts layout chrome

- A shared COLOR MODE preference (Theme default, Dark, or Light) on the online
  app menu, Settings, `/boot`, and `/professional`. Most themes have a dark and
  a light palette. Theme default keeps each theme's native look; Windows 95
  defaults to classic light and offers a charcoal dark mode. Aurora, Midnight
  OLED, MineBits, Terminal, Matrix, Amber CRT, Spotify, and the console/firmware
  themes are dark-only; Aqua and Mac OS 9 are light-only, so COLOR MODE is
  hidden while they are active (VARIANT likewise hides for themes without
  variants)

- Rounded themes use restrained corners for cards and text fields rather than
  button-sized pill radii on large panels. Aqua and Spotify also have dedicated
  form surfaces, more comfortable field padding, and clear keyboard-focus
  rings; Aqua keeps its glossy buttons without terminal noise or scanlines.

- A classic text-mode crash screen on the Windows 3.1, 95, XP, and Aero Glass
  themes: every death screen switches to a 9x "fatal exception" box or an NT
  STOP-error wall of text in that screen's color, with a troubleshooting link
  instead of a QR code

- A VARIANT picker beside COLOR MODE for themes with alternate styles:
  Windows XP (Luna Blue, Olive Green, Silver, Royale/Media Center, Royale Noir,
  Zune, Embedded), MineBits biomes and mobs (Overworld, Cherry Grove, Jungle,
  Desert, Snowy Taiga, Ocean Monument, Deep Dark, Nether, The End, Creeper,
  Mushroom Fields),
  Aurora colors (Borealis, Australis, Solar Storm, Glacier, Amethyst),
  Terminal phosphors (Green, White, Cyan, IBM Blue, Red Alert, Amber Phosphor),
  RGB lighting (Rainbow, Synthwave, Ice Blue, Firestorm, Toxic Green, Cotton
  Candy, Arctic White), with animated color-matched borders, accents, glow,
  scrollbars, and falling bits; reduced-motion preferences still apply,
  Midnight OLED accents (Classic, Cyan, Crimson, Violet, Amber, Monochrome),
  DOS Blue (Classic, Norton Commander, Turbo Pascal, QBasic, Amber, Green,
  Hercules), Game Bit (DMG, Pocket, Color, Advance, Advance SP), Windows 3.1
  (3.1, 2.x, 1.0, Hotdog Stand, Arizona, Ocean, Plasma), Legacy BIOS (Award,
  Phoenix, AMI), UEFI vendors, Atari (2600, 7800, ST GEM, Pong), Commodore
  machines, Winamp skins, iPod finishes, Ubuntu/GNOME/KDE desktops,
  PlayStation and Xbox dashboards, Windows 8 accents, and Browser
  spoofs (Chrome, Firefox, Edge, Edge Legacy, Internet Explorer 6, Safari,
  Opera GX, Netscape Navigator). The Browser layout also moves the BITS OS
  FILE / EDIT / VIEW menu bar into its favorites/bookmarks bar.
  Each theme remembers its own variant; styles live in `layouts/<id>.css`

- A RANDOM THEME button on the same pages. On `/boot`, the `theme random`,
  `theme dark`, `theme light`, `theme auto`, and `theme variant <name>`
  commands do the same

- Seasonal themes appear automatically on each visitor's local calendar:
  Winter (December through February), Spooky (October 28-November 1),
  Christmas (December 23-26), New Year (December 31-January 1),
  Valentine's Day (February 14; rose/red/cream), St. Patrick's Day
  (March 17; emerald/gold/cream), Easter (Gregorian Easter Sunday;
  lavender/mint/yellow), Earth Day (April 22; forest green/ocean blue),
  US Independence Day (July 4; red/white/blue), and US Thanksgiving
  (fourth Thursday in November; orange/brown/gold). All have dark and light
  palettes. A holiday takes priority over Winter, but overlapping themes stay
  selectable; Easter takes priority if it falls on Earth Day.
  Independence Day adds four staggered binary-Bits firework bursts to the
  personal site's background atmosphere. They become static with reduced
  motion and disappear with effects off, high contrast, or forced colors.
  Switching themes replaces the particles without accumulating effects.
  To preview them all, run `BITS_THEME_DEBUG.enable()` in the
  browser console (it reloads the page); `BITS_THEME_DEBUG.disable()` turns
  the preview off. Debug mode groups all holiday/seasonal themes under
  **Special Themes** in the shared theme pickers, separate from
  **Standard Themes** and **Experimental Layouts**. Standard themes are
  grouped in both normal and debug mode. Normal seasonal availability is unchanged.
  Seasonal picker choices and dismissals retain the existing
  per-season behavior. Run `node --test scripts/holiday-themes.test.mjs` to
  check calendar boundaries, overlaps, previews, and particle controls.
