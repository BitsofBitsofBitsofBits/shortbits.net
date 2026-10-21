# shortbits.net

The source for [shortbits.net](https://www.shortbits.net/), the terminal-themed
internet presence of BitsofBitsofBits.

## Site layout

| Path | Page | Source |
| --- | --- | --- |
| `/` | Themed boot-menu chooser between the two sites | `index.html`, `chooser.js`, `chooser.css` |
| `/online/` | The playful internet presence (desktop windows, games, Easter eggs) | `online/index.html` |
| `/professional/` | Recruiter-facing professional profile | `professional/` |

The chooser can remember a visitor's pick in `localStorage` (`bits-site-choice`)
and redirect on later visits; `/?choose` always shows the menu, and both sites
link to it from their footers. Legacy deep links such as `/?window=resume` or
`/#…` are forwarded to `/online/` with their query and hash intact. Shared
scripts, styles, and images stay at the site root, so pages in subfolders must
reference them with root-absolute paths (`/script.js`, `/images/...`).

## AI Notice

Some features of this site were created and are maintained with the help of AI.
While I don't generally support relying on AI in most commercial settings, this
is a personal project and largely a learning exercise for me.

## Features

- Responsive LinkTree-style social and project links
- A recruiter-facing `/professional/` profile with career highlights, skills,
  selected independent projects, LinkedIn/GitHub links, and the shared private
  contact form. It inherits the saved theme without loading games, simulated
  desktop windows, boot screens, or Easter eggs. Its experience timeline,
  location, and availability load from the Admin-managed `RESUME_PROFILE` data
  shared with `CAREER.SYS`; the hand-written cards in `professional/index.html`
  are only a fallback when Supabase is unreachable. Summary lines starting with
  `•` or `-` render as bullets, and technologies (comma- or double-space-
  separated) render as tags via `career-format.js`.
  Education entries (school, credential, period, and optional bullet details)
  are edited in the same Admin form, stored in `site_resume_education`, and
  shown in both `CAREER.SYS` and the professional Education section.
  Certifications (name, issuer, issue date, credential ID, and an HTTPS
  verification link) use the same pattern through
  `site_resume_certifications`. `career-data.js` shares one cached loader
  between the professional page and its printable résumé.
- A print-ready résumé at `/professional/resume/` built from the same Admin
  data. Its **Download PDF** button opens the browser's print dialog with
  Letter-sized print styles, so choosing "Save as PDF" produces a clean résumé.
  It is also the default `RESUME.PDF` target when no external résumé URL is set.
- Theme-driven, high-contrast, and reduced-motion display profiles
- Spotify now-playing integration through a Supabase Edge Function
- Cached Discord presence, custom status, and activity through Lanyard
- Private contact form backed by a Supabase Edge Function
  (`contact-message`) with a honeypot, length and link limits, hashed
  per-visitor and global rate limits, and optional Cloudflare Turnstile
  verification
- Persistent local achievements and a large collection of Easter eggs,
  including Blue, Red, Black, and Insider Green death screens with a
  four-color completion achievement, plus an automatically recovering
  Kernel Panic diagnostic dump
- Adaptive performance mode for constrained or slow devices
- Optional draggable mini-windows for profile, pronouns, Spotify, source,
  settings, and simulated system diagnostics with animated resource meters,
  fake process telemetry, and rotating jokes. Windows stay viewport-safe,
  resize from every edge and corner, and use themed internal scrollbars
- Shareable window URLs such as `?window=spotify` and
  `?windows=about,spotify` that restore linked windows on load
- A persistent control panel for appearance, reduced motion, larger text,
  increased contrast, decorative effects, window-layout resets, link copying,
  and an experimental Canary Bits Insider channel
- Admin-managed `CAREER.SYS`, `NOW.TXT`, and `CHANGELOG.LOG` windows with
  shareable URLs, responsive layouts, five-minute public caching, and clean
  unpublished states
- A "Bits 365 admin center" at `/admin` (legacy `/admin.html` links
  redirect there), styled after the Microsoft 365 admin center and separate
  from the public site themes: a suite bar (app launcher, search, settings,
  help, account), a collapsible grouped left navigation that becomes a drawer
  on small screens, hash-routed pages such as `/admin/#/inbox`, a Home
  dashboard with quick actions and live counts, and right-side flyout panels
  for messages, hardware import, live agents, and settings. Light, dark, or
  system appearance is saved per device
- An accessible public `BLOG.LOG` with draft-aware Supabase publishing,
  semantic article pages, safe Markdown rendering, and a live Markdown preview
  in the Admin Portal
- GUI controls for adding and removing résumé experiences, featured playlists,
  featured songs, and changelog entries without fixed slot limits
- A public `GUESTBOOK.LOG` with immediate publishing and authenticated Admin
  deletion controls
- A shared virtual filesystem available through `FILE_EXPLORER.EXE` and the
  terminal's `pwd`, `ls`, `cd`, `cat`, and `files` commands
- An Admin-managed `GAMES.EXE` library of favorite games with ordered,
  publishable entries and links to their official or storefront pages
- An Admin-managed `HARDWARE.SYS` window listing real machine specs grouped
  by machine. Admin's **Import from a PC** flyout provides a read-only PowerShell
  scan script (CPU, GPU, RAM, motherboard, storage, displays, OS; no serial
  numbers or computer name) that copies JSON to the clipboard for pasting
  back into the editor before saving. Machines are collapsible, and the
  collapsed state is remembered per browser
- Optional live hardware agents: Admin's **Live agents** flyout issues a
  per-machine device token (only its SHA-256 hash is stored, revocable at any
  time) and a PowerShell installer. The installer saves the token
  DPAPI-encrypted under `%LOCALAPPDATA%\BitsHardwareAgent` and registers a
  per-user logon task that needs no admin rights and runs in a headless console, so no PowerShell window stays open. The agent posts CPU, GPU,
  and RAM load plus boot time as lightweight pulses to the
  `hardware_agent_pulse` RPC (token hashed server-side, at most one pulse per
  2 seconds): every 3 seconds while anyone has HARDWARE.SYS open (viewers
  call the throttled `hardware_watch` RPC), otherwise every 15 seconds. Specs
  are re-synced at start and every six hours through the `hardware-sync` Edge
  Function (`x-device-token` header; at most one report per 20 seconds and one
  spec sync per five minutes per device). Synced
  rows are matched by component and name, so unticking a row in Admin keeps it
  hidden, and manually entered rows are kept. HARDWARE.SYS polls
  `site_hardware_status` every 3 seconds while open and visible, ticks uptime
  every second, and shows a machine as LIVE when it reported within the last
  minute. Re-running the installer upgrades the agent and can keep the saved
  token
- Linux / Unraid machines (e.g. a NAS) use **Import from a PC** with the
  `LINUX / UNRAID (BASH)` platform: a one-shot bash scan (run as root for RAM
  module details) that prints CPU, RAM, motherboard, GPUs, network cards with
  link speed, storage grouped by identical drive, and OS as one JSON line. It
  uploads nothing and has no live agent; paste the JSON into Admin and save
- A desktop-only, full-window `ARCADE.EXE` with Snake.BIT, Minesweeper,
  Bitsweeper, Bitris, Bititaire, Bit Pong, Packet Dodge, Cursor Chase,
  Null Tac Toe, endless wave-based Packet Breaker, and Flappy Bit, plus local
  bests, public rankings, and Admin moderation
- A stateful `COBITS.EXE` parody assistant with quick actions, delayed replies,
  slash commands, conversational memory, multi-step interviews, diagnostics,
  and discoverable achievements
- An Admin-only ShortBits manager for HTTPS redirects at
  `shortbits.net/go/<alias>`, with generated or custom aliases, expiration,
  enable/disable controls, aggregate click totals, masked landing pages, and
  YouTube, Vimeo, or Spotify embeds
- A skippable first-visit boot sequence that remembers completion for the
  current browser session and respects reduced-motion preferences
- An unlinked `/boot` display mode with the shared persistent theme catalog,
  rotating main-site transmissions, an endless randomized firmware log with
  speed-sensitive bursts, occasional long-running operations, and rare warning,
  error, and rainbow messages. Distinct boot phases drive correlated hardware
  telemetry, POST codes, activity lights, expanded theme-exclusive message pools,
  rapidly changing unreliable ETA estimates with live numeric countdowns, chained
  incidents, persistent incident history, telemetry sparklines, uptime milestones,
  daily machine personalities, one anomaly per browser session, real online/offline
  reactions, user-presence responses, long narrative sequences, and gradual idle
  degradation. Local boot achievements, expanded diagnostic/export commands,
  subtle burn-in protection, and rare self-recovering Blue, Black, Green Insider,
  Red, and Purple bootkit crash screens add depth without taking permanent log
  space. Locally persistent fake hardware, keyboard shortcuts, fullscreen
  presentation, and compact square/portrait case-screen layouts support
  long-running displays. Sparse, theme-colored binary digits drift behind the
  terminal log, respecting reduced motion, paused output, and display power.
  The offline/restore screen uses the active theme's accent, background, and
  font, with CRT-style power-down and power-up transitions
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

The Admin Portal also manages the public résumé profile and career entries,
the singleton NOW profile, and ten ordered changelog entries. Draft rows remain
hidden from anonymous Supabase clients through row-level security until their
publish controls are enabled.

Blog posts are authored as Markdown in the Admin Portal. The shared renderer
supports headings, emphasis, links, lists, blockquotes, inline code, and fenced
code blocks, along with images, tables, task lists, highlighting, constrained
colors, rainbow text, text sizes, and curated font choices. A formatting
toolbar inserts the underlying markup for authors who do not want to write it
manually. Authenticated image uploads accept JPEG, PNG, WebP, or GIF files up to
5 MB and require alternative text before insertion. The renderer creates DOM
nodes directly instead of injecting HTML, and raw HTML in a post is displayed
as text. Draft and future-dated posts remain hidden from anonymous clients
through row-level security.

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

`site-config.js` holds optional public third-party identifiers:

- `cloudflareAnalyticsToken`: the Cloudflare Web Analytics site token.
  `cf-analytics.js` loads the cookieless beacon on public pages only when the
  token is set, and skips it on localhost or when Global Privacy Control or
  Do Not Track is enabled.
- `turnstileSiteKey`: the public Cloudflare Turnstile site key. When set, the
  contact form renders a Turnstile challenge. Store the matching secret as the
  `TURNSTILE_SECRET_KEY` Supabase secret so `contact-message` enforces it.

The contact form posts to the `contact-message` Edge Function, which inserts
messages with the service role after its spam checks. The
`20261021030000_protect_contact_messages.sql` migration then revokes direct
anonymous inserts into `messages`. Until the function is deployed, the browser
falls back to the previous direct insert.

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

Database and Edge Function changes ship from the same workflow. Add these
`Supabase` environment secrets to enable the `supabase` job:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token
- `SUPABASE_DB_PASSWORD`: the project's database password
- `TURNSTILE_SECRET_KEY` (optional): synced to the Edge Function secrets

The job deploys `contact-message` and then runs `supabase db push`. When the
required secrets are missing it logs a warning and skips, and the static
deploy still runs if the job fails.

After each deploy, the `lighthouse` job audits the chooser, `/online/`,
`/professional/`, and `/professional/resume/` on mobile and desktop. It writes
a score table to the run summary, logs failing audits, and uploads the JSON
reports as an artifact. It never blocks a deploy.

The workflow validates JavaScript and local asset references, scans for
committed secrets, generates `build-info.json`, and uploads only public static
site files. It does not delete other files from the production directory.

The production Caddy server must route missing paths to the themed error page
while retaining the HTTP 404 status. The active Caddy configuration supplies
that internal error handling for `/404.html`.

After deploying the static files, the workflow downloads
`/etc/caddy/Caddyfile`, updates its quoted Content Security Policy with the
approved YouTube, Vimeo, Spotify, and Cloudflare Turnstile `frame-src` values
plus the Cloudflare Web Analytics and Turnstile script and connect origins,
validates the candidate
configuration, installs it, and reloads Caddy. A failed reload restores the
original Caddyfile automatically. The deployment user therefore needs narrowly
scoped passwordless `sudo` access to `caddy validate`,
`install /tmp/Caddyfile.* /etc/caddy/Caddyfile`, and
`systemctl reload caddy`.
