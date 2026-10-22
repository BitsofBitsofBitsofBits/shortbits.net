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
  by machine. Admin edits each machine as its own card with a component list
  (add, remove, show or hide parts; rename or remove the whole machine).
  Admin's **Import from a PC** flyout provides a read-only PowerShell
  scan script (CPU, GPU, RAM, motherboard, storage, displays, OS; no serial
  numbers) that copies JSON to the clipboard for pasting back into the editor
  before saving. The scan names the machine from its system model, falling
  back to the Windows device name when the model is a generic placeholder or
  just the motherboard (custom builds), so imports don't overwrite another
  machine; the name is pre-filled and can be changed before or after import. Machines are collapsible, and the
  collapsed state is remembered per browser. Admin's **Move up / Move down**
  controls and **Save hardware** persist the public device order, including
  live devices without component rows; new unordered devices appear afterward.
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
  minute. Hardware jokes (including seasonal variants) rotate as agent chatter
  beneath online agents' live stats; offline agents do not show chatter.
  System Monitor shows desktop status and fictional process statuses, not
  simulated hardware readings. Re-running the installer upgrades the agent and can keep the saved
  token. Leaving the token's machine name blank creates a pending device that
  the agent names on its first spec sync (same model / device-name rule,
  through the service-role-only hardware_agent_claim_name RPC, which reuses
  a matching scanned machine and suffixes clashes with other agents). Agent
  machines can be renamed from **Live agents** or the editor; the device row,
  its live status, and its rows move together and the agent keeps syncing
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
- Forty-five persistent full-interface themes, each with its own fixed accent,
  background, window treatment, typography, and scrollbar. These include
  Default, Aurora, Cozy Blossom, Mica, Fluent, Midnight OLED, macOS, Terminal,
  Vaporwave, Amber CRT, Y2K Silver, Cyberpunk, DOS Blue, Windows 95, Windows XP
  (Luna), Solarized, Nord, Dracula, Candy Pop, RGB, Aero Glass, Catppuccin,
  Gruvbox, Tokyo Night, Monokai, Game Bit, High Contrast, Deep Ocean, Coffee
  Shop, Matrix, Sunset, the original voxel-inspired MineBits, Windows 3.1,
  Spotify, UEFI, Mac OS X Aqua, Aquatic (underwater), Atari, Commodore 64,
  Mac OS 9 Platinum, Winamp, iPod Classic, Ubuntu, PlayStation, and Xbox.
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
  Desert, Snowy Taiga, Ocean Monument, Deep Dark, Nether, The End, Creeper),
  Aurora colors (Borealis, Australis, Solar Storm, Glacier, Amethyst),
  Terminal phosphors (Green, White, Cyan, IBM Blue, Red Alert),
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
  **Special Themes** in the shared theme pickers, separate from standard
  themes and Experimental Layouts. Normal seasonal availability is unchanged.
  Seasonal picker choices and dismissals retain the existing
  per-season behavior. Run `node --test scripts/holiday-themes.test.mjs` to
  check calendar boundaries, overlaps, previews, and particle controls.
- Valentine's Day, St. Patrick's Day, Easter, Earth Day, Independence Day,
  and Thanksgiving also add seasonal messages without replacing the normal
  pool: each has 16 messages at weight 18 and six activities at weight 12.
  Against the current regular pools, that gives a single holiday about 35%
  of the weighted message pool and 50% of activities before repeat avoidance.
  Boot messages, live-agent hardware chatter, shutdown text, and desktop
  jokes also get holiday additions through the existing seasonal consumers.
  Existing New Year, Halloween, and Christmas exclusivity is unchanged.
  Dates use the visitor's local calendar, not the selected visual theme;
  overlapping additive holidays combine. `seasonal-calendar.js` shares
  Gregorian Easter calculation between visual themes and message profiles.
  Run `node --test scripts/holiday-themes.test.mjs scripts/seasonal-messages.test.mjs`
  to validate schedules, complete pool retention, and weighted shares.
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

### Unraid NAS live monitoring

The optional [Unraid Docker collector](agents/unraid/README.md) sends filtered
CPU/RAM/uptime, array capacity/state, DATA-drive readings, and selected-interface
network rates into HARDWARE.SYS. It uses a separate existing Admin-issued device
token and a local read-only Unraid API key, with verified outbound HTTPS and no
public NAS endpoint. Credentials and raw identifying API fields stay local.
Reviewed hardware model descriptions can be added manually in Admin. Public
uptime/activity remains inferable; read the privacy and coverage limitations
before enabling it. The Docker setup includes a no-publish compatibility check.

Collector tests: `node --test agents/unraid/collector.test.mjs`. CI additionally
tests the NAS migration against PostgreSQL and builds the non-root Docker image.

### Static site

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
  contact form runs a Turnstile check in the background (`interaction-only`),
  showing a one-line themed status. Cloudflare's box only expands when it needs
  a click (or fails) and collapses again after success; it uses Cloudflare's
  light or dark skin to match the active site theme. Store the matching secret as the
  `TURNSTILE_SECRET_KEY` Supabase secret so `contact-message` enforces it.
  If the browser verifies but submission is rejected, the form and Edge
  Function logs now include Cloudflare's standard Siteverify error codes.
  `invalid-input-secret` indicates a server configuration issue;
  `invalid-input-response` or `timeout-or-duplicate` requires a fresh check.
  Siteverify network/HTTP/invalid-JSON failures return a service error and never
  allow storage or email. Logs exclude tokens, secrets, IPs, and raw responses.
  Match the secret to the public widget key in `site-config.js`; if GitHub's
  Supabase environment also defines the secret, update it there so deployment
  does not overwrite a dashboard-only correction.

The contact form posts to the `contact-message` Edge Function, which inserts
messages with the service role after its spam checks. The
`20261021030000_protect_contact_messages.sql` migration then revokes direct
anonymous inserts into `messages`. Until the function is deployed, the browser
falls back to the previous direct insert.

### Contact email (Resend)

Both contact forms use the same Edge Function. After a message is saved, it
sends an owner notification and, when the visitor supplies an email address,
a confirmation through Resend. The owner notification uses the visitor's
address as Reply-To; confirmations use the owner's inbox as Reply-To.
Confirmations contain no visitor-supplied name, links, or message content.
The existing honeypot, Turnstile, and rate limits apply before storage or email.

To enable sending:

1. Add `shortbits.net` in the Resend dashboard and publish its required DNS
   records. Wait for domain verification. `contact@shortbits.net` does not need
   a paid mailbox; replies go to the configured owner inbox instead. Do not
   enable inbound mail or replace root MX records just to send notifications.
2. Create a Resend API key with sending access for that domain.
3. Add these secrets in Supabase's Edge Function settings (never in browser
   configuration or committed files), or set all three as GitHub **Supabase**
   environment secrets for the deployment workflow to sync:
   - `RESEND_API_KEY`: your Resend sending key
   - `CONTACT_EMAIL_FROM`: `shortbits.net <contact@shortbits.net>`
   - `CONTACT_EMAIL_TO`: `CalebKMasters@outlook.com`
4. Deploy `contact-message` and the updated site. Test once with a visitor
   address and once without, then check the inboxes and Resend delivery logs.

Resend's free transactional plan currently allows 100 emails/day and
3,000/month. A submission with a visitor email uses two sends; one without
uses one. Existing submission limits do not guarantee staying below that
daily quota.

Email requests have an eight-second timeout and run independently after
storage succeeds. The response distinguishes provider acceptance, failures,
and missing configuration. If sending fails, the form confirms the message
was saved, warns that email is unavailable, and tells visitors not to resend.
Failures and accepted Resend message IDs are logged in the Edge Function.
Provider acceptance is not proof of inbox delivery; consult Resend for
bounces or delivery events. There is no automatic retry queue: saved messages
remain available in Admin for manual follow-up even during an email outage.
The legacy direct-insert fallback cannot send email and reports it unavailable.

Run the mocked contact/storage/email tests with
`node --test supabase/functions/contact-message/contact.test.mjs` on Node 22.13+
or later. The tests use Node's built-in TypeScript stripping; no real emails
are sent.

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
- `RESEND_API_KEY`, `CONTACT_EMAIL_FROM`, `CONTACT_EMAIL_TO` (optional as a
  complete set): synced to enable contact notifications and confirmations.
  When incomplete, the workflow leaves existing Supabase email secrets alone.

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
