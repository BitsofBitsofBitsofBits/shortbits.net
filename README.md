# shortbits.net

The source for [shortbits.net](https://www.shortbits.net/), the terminal-themed
internet presence of BitsofBitsofBits.

## AI Notice

Some features of this site were created and are maintained with the help of AI.
While I don't generally support relying on AI in most commercial settings, this
is a personal project and largely a learning exercise for me.

## Features

- Responsive LinkTree-style social and project links
- Theme-driven, high-contrast, and reduced-motion display profiles
- Spotify now-playing integration through a Supabase Edge Function
- Cached Discord presence, custom status, and activity through Lanyard
- Private contact form backed by Supabase
- Persistent local achievements and a large collection of Easter eggs,
  including Blue, Red, Black, and Insider Green death screens with a
  four-color completion achievement, plus an automatically recovering
  Kernel Panic diagnostic dump
- Adaptive performance mode for constrained or slow devices
- Optional draggable mini-windows for profile, pronouns, Spotify, source,
  diagnostics, and settings that stay viewport-safe, resize from every edge
  and corner, and use themed internal scrollbars
- Shareable window URLs such as `?window=spotify` and
  `?windows=about,spotify` that restore linked windows on load
- A persistent control panel for appearance, reduced motion, larger text,
  increased contrast, decorative effects, window-layout resets, link copying,
  and an experimental Canary Bits Insider channel
- Admin-managed `CAREER.SYS`, `NOW.TXT`, and `CHANGELOG.LOG` windows with
  shareable URLs, responsive layouts, five-minute public caching, and clean
  unpublished states
- A desktop-style Admin Portal with draggable, resizable, deep-linkable windows
  for the inbox and every public-content editor
- GUI controls for adding and removing résumé experiences, featured playlists,
  featured songs, and changelog entries without fixed slot limits
- A public `GUESTBOOK.LOG` with immediate publishing and authenticated Admin
  deletion controls
- A shared virtual filesystem available through `FILE_EXPLORER.EXE` and the
  terminal's `pwd`, `ls`, `cd`, `cat`, and `files` commands
- An Admin-managed `GAMES.EXE` library of favorite games with ordered,
  publishable entries and links to their official or storefront pages
- A desktop-only, full-window `ARCADE.EXE` with Snake.BIT, Minesweeper,
  Bitsweeper, Bitris, Bititaire, the original first-person MineBits voxel
  sandbox, and Flappy Bit, plus local bests, public rankings, and
  Admin moderation
- A stateful `COBITS.EXE` parody assistant with quick actions, delayed replies,
  slash commands, conversational memory, multi-step interviews, diagnostics,
  and discoverable achievements
- An Admin-only ShortBits manager for HTTPS redirects at
  `shortbits.net/go/<alias>`, with generated or custom aliases, expiration,
  enable/disable controls, aggregate click totals, masked landing pages, and
  YouTube, Vimeo, or Spotify embeds
- A skippable first-visit boot sequence that remembers completion for the
  current browser session and respects reduced-motion preferences
- An in-site `NOTIFICATIONS.LOG` with persistent history, unread tracking,
  transient toast alerts, individual dismissal, and clear-all controls
- Public `STATS.EXE` aggregate telemetry showing daily/all-time views, browser
  sessions, and popular windows without cookies, IP addresses,
  fingerprints, user agents, or individual event records
- Distinct decorative atmospheres for every interface theme, including circuit
  pulses, aurora ribbons, petals, acrylic lighting, reveal sweeps, OLED stars,
  color orbs, and phosphor effects. These respect decorative-effects, contrast,
  reduced-motion, forced-colors, and performance preferences
- A persistent RGB interface theme that cycles rainbow gradients around the
  main shell, desktop-window edges, falling Bits, and themed scrollbars
- Twenty-one persistent full-interface themes, each with its own fixed accent,
  background, window treatment, typography, and scrollbar. These include
  Default, Aurora, Cozy Blossom, Mica, Fluent, Midnight OLED, macOS, Terminal,
  Vaporwave, Amber CRT, Y2K Silver, Cyberpunk, DOS Blue, Windows 95, Solarized,
  Nord, Dracula, Candy Pop, RGB, Aero Glass, and the original voxel-inspired
  MineBits.
- Terminal-themed 404 recovery and generated production build metadata
- Self-hosted source browser with raw-file and archive access
- Automated validation and SSH deployment through GitHub Actions

The Spotify integration polls from the browser every 30 seconds while updating
the visible playback timeline locally once per second. The Edge Function caches
successful playback for 30 seconds, coalesces simultaneous refreshes, and serves
the last known playback while honoring Spotify's full `Retry-After` cooldown.
This greatly reduces the number of separate upstream Spotify requests created
by visitors and open tabs.

## Local development

The public site is dependency-free. Serve the directory with any static server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly also works for most development, but a local HTTP
server more closely matches production behavior.

## Configuration

`supabase-config.js` contains the public Supabase project URL and publishable
key used by the browser. Spotify credentials are not stored in this repository;
the Edge Function reads them from Supabase secrets:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

The refresh token needs these scopes:

- `user-read-currently-playing`
- `user-read-playback-state`
- `user-read-recently-played`
- `user-top-read`

Generate and store a replacement token with `scripts/spotify-auth-helper.mjs`
after setting `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the local
shell. The helper completes OAuth locally and writes the refresh token directly
to the linked Supabase project without printing it.

The Admin Portal also manages the public résumé profile and six career entries,
the singleton NOW profile, and ten ordered changelog entries. Draft rows remain
hidden from anonymous Supabase clients through row-level security until their
publish controls are enabled.

ShortBit records remain private to authenticated Admin sessions. Anonymous
visitors can resolve only an exact enabled, unexpired alias through the
restricted `resolve_short_link` function; the public API cannot list the link
inventory. Redirects use the server's internal custom-404 handling so the
visitor-facing URL can remain `/go/<alias>` on this static deployment. They
therefore require JavaScript and initially return HTTP 404 before the browser
redirects; click totals are approximate and can include link-preview bots.
Masked ShortBits retain the `/go/<alias>` address. Embed mode accepts only
YouTube, Vimeo, and Spotify URLs; Landing mode presents any HTTPS destination
behind an explicit open button.

Deploy the function with:

```powershell
npx --yes supabase@latest functions deploy "spotify-now-playing" `
  --project-ref "arjwrycitgobvlodmkeo" `
  --no-verify-jwt
```

Discord presence requires the Discord account to be enrolled in Lanyard. Deploy
its cached public-presence proxy with:

```powershell
npx --yes supabase@latest functions deploy "discord-presence" `
  --project-ref "arjwrycitgobvlodmkeo" `
  --no-verify-jwt
```

Set `DISCORD_USER_ID` as a Supabase function secret before deployment. It is a
public Discord identifier used as configuration, not a bot token.

The site displays public presence, custom status, and activities. A Lanyard
WebSocket also pushes Spotify track and pause changes to the player while the
existing cached Spotify API remains the authoritative fallback.

The Spotify popup loads the most recently played track, five short-term top
tracks, and five long-term top tracks only when opened. Spotify's long-term
range covers several years and is its closest available equivalent to all-time
history. The response is cached in the browser, Edge Function, and CDN for five
minutes, so it does not change the now-playing poll rate.

Five manually curated playlist slots are stored in
`spotify_featured_playlists` and edited through the authenticated Admin Portal.
They load with the popup from Supabase's public read-only API and do not create
additional Spotify API requests.

Five manually curated song slots are stored in `spotify_featured_tracks` and
use the same Admin Portal and public read-only pattern. Song data is loaded
directly from Supabase, so it also creates no Spotify API requests.

The public pronoun reference is stored in the `pronoun_profiles` Supabase table.
Anonymous visitors can read its single profile row, while authenticated Admin
Portal sessions can update it. Apply migrations with:

```powershell
npx --yes supabase@latest db push --linked
```

Site statistics use daily aggregate counters updated through restricted
Supabase functions. The browser counts a daily session once with
`sessionStorage`, honors Global Privacy Control and Do Not Track, and never
transmits or stores a visitor identifier.

## Deployment

The production site is served as static files from `/srv/bitsofbits/`.
When changing cached CSS or JavaScript, update its query-string version in the
HTML before publishing.

Pushes to `main` are validated and then deployed with
`.github/workflows/site.yml`. Configure the following repository environment
secrets for the `production` environment:

- `DEPLOY_HOST`: production server hostname
- `DEPLOY_USER`: SSH user with write access to `/srv/bitsofbits/`
- `DEPLOY_SSH_KEY`: private Ed25519 key for that user
- `DEPLOY_KNOWN_HOSTS`: pinned `known_hosts` entry for the production server

Set the optional `DEPLOY_PORT` environment variable when SSH does not use port
22.

The workflow validates JavaScript and local asset references, scans for
committed secrets, generates `build-info.json`, and uploads only public static
site files. It does not delete other files from the production directory.

The production Caddy server must route missing paths to the themed error page
while retaining the HTTP 404 status. The active Caddy configuration supplies
that internal error handling for `/404.html`.

After deploying the static files, the workflow downloads
`/etc/caddy/Caddyfile`, updates its quoted Content Security Policy with the
approved YouTube, Vimeo, and Spotify `frame-src` values, validates the candidate
configuration, installs it, and reloads Caddy. A failed reload restores the
original Caddyfile automatically. The deployment user therefore needs narrowly
scoped passwordless `sudo` access to `caddy validate`,
`install /tmp/Caddyfile.* /etc/caddy/Caddyfile`, and
`systemctl reload caddy`.
