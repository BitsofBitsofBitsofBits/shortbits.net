# Recent changes - October 26, 2026

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

This catch-up covers changes after the October 25 **shortbits.net 2.0**
changelog through the message-browser timing fix (`53b6196`). These are
implementation notes, not a guarantee that a particular deployment has finished.
The matching October 26 changelog entries are appended by
`20261026070000_recent_changes_changelog.sql` and become public only after the
Supabase migration succeeds.

## YouTube watching and the shared player

- Added a locally installed Chromium extension for Chrome, Edge, and Brave.
  Sharing is off by default and requires a revocable device token; paused
  videos remain public while sharing is enabled. No Google OAuth grant or
  YouTube API key is required.
- YouTube and Spotify share the existing player area. Previous/next arrows
  switch sources. Playing media outranks paused media; otherwise the earlier
  continuous listening/watching session appears first. Song/video changes do
  not reset a session.
- Sessions use server-observed starts, not playback position. Pauses preserve
  sessions while reports continue; observation gaps over 90 seconds restart
  timing. YouTube reports also expire after 90 seconds without updates.
- Added hashed-token storage, token revocation, isolated extension credentials,
  privacy controls, explicit failures, public expiry checks, and real Chromium
  extension and desktop/mobile carousel tests.

See [YouTube watching presence](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/YouTube-Presence)
for installation, migrations, token creation, troubleshooting, and limitations.

## Creator feed and Twitch

- YouTube creators gained automatic channel photos and authenticated channel
  lookup, including canonical links and automatic channel-ID completion.
- Twitch creators gained channel lookup, profile photos, live titles and
  categories, and the latest available archived broadcast when offline.
  Channels without public broadcasts remain explicitly offline.
- Failed lookups show the server explanation rather than only Supabase's
  generic non-2xx error. Editing fields during a lookup does not overwrite
  those edits; replacing a YouTube integration asks before clearing its ID.
- Twitch requires server-side `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.
  Configure them directly in Supabase or sync the complete pair through the
  GitHub Supabase environment. Neither credential belongs in browser code.

See [Creator feed](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Creator-Feed).

## Message library, scheduling, and quotation authors

- Moved the editable message catalog into Supabase with Admin editing,
  filtering, searching, pagination, enable/disable controls, positive rarity
  weights, and retained bundled fallbacks.
- Added date-ranged custom pools, additive/exclusive schedules, timezone
  selection, explicit row editing, and page-scoped bulk actions with
  cancellation, error reporting, and unsaved-change protection.
- Added opt-in safe inline formatting and Mistype corrections. Existing plain
  text stays literal; raw HTML, links, images, and media are not message markup.
- Optional quotation authors appear in a separate box below the status quote.
  Quote and author type and erase together; Unicode names are grapheme-safe
  and survive history, correction, caching, and scheduled pools.
- Boot-library counts now distinguish editable fixed entries from the
  procedural generator's **32,190 combinations**. Admin and the boot display
  share the generator definitions.
- Improved message refresh/cache scheduling and calendar conversion,
  including correct day selection when a refresh crosses midnight.
- Browser snapshot checks pause only message-typewriter ticks while asserting
  text, removing a race where the author emoji could disappear before the
  assertion. Production animations are unchanged.

The catalog schema changed several times: export a fresh content backup after
applying the markup, correction, pool, and author migrations. See
[Message library](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Message-Library)
for migration names, editing behavior, and backup compatibility.

## Themes, picker, and desktop workspaces

- Expanded the theme collection and experimental layouts, including Aero Glass
  Windows 7/Vista treatments and additional glass color variants.
- Online's View menu and Appearance settings now use bounded, keyboard-friendly
  theme families, subthemes, and variants rather than one long dropdown.
  Existing preferences, random selection, and experimental labels are retained.
- Experimental themes now retain their native desktop/workspace when the main
  shell is minimized. The persistent **Open workspace** control makes that
  experience discoverable.
- Windows-style taskbars and Start menus, browser tabs, terminal-style sessions,
  office/search workspaces, media collections, and BIOS-style setup navigation
  use real site apps. They do not provide real SSH, firmware, or simulated
  audio playback.
- Added mobile layout refinements, usable regular-desktop fallback on asset
  failure, explicit workspace retry, URL restoration, and lifecycle/accessibility
  checks.

See [Themes and appearance](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Themes-and-Appearance).

## Profile, error page, and source organization

- Added the optimized Online profile portrait with visible credit to **Kay
  (@galacticcookie)** while retaining the interactive bit avatar and its
  reactions. The portrait and avatar sit above the text on narrow screens.
- The not-found page now uses falling **404**, **4**, and **0** particles with
  motion/effects preferences respected.
- Reorganized runtime assets into shared and page-owned directories without
  moving public page routes. The README now points to focused wiki guides.
- Added extension-specific Chromium checks to CI. Failed validation prevents
  the Supabase migration job; pushing a commit alone does not mean its database
  functions exist yet.

See [Site and features](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Site-and-Features),
[Repository layout](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Repository-Layout),
and [Deployment](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Deployment).
