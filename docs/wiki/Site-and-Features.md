# Site and features

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

## Site layout

| Path | Page | Source |
| --- | --- | --- |
| `/` | Themed boot-menu chooser between the two sites | `index.html`, `home/scripts/chooser.js`, `home/styles/chooser.css` |
| `/online/` | The playful internet presence (desktop windows, games, Easter eggs) | `online/index.html` |
| `/professional/` | Recruiter-facing professional profile | `professional/` |

The chooser can remember a visitor's pick in `localStorage` (`bits-site-choice`)
and redirect on later visits; `/?choose` always shows the menu, and both sites
link to it from their footers. Legacy deep links such as `/?window=resume` or
`/#…` are forwarded to `/online/` with their query and hash intact. Shared
assets live in `shared/` or their owning page's `scripts/` and `styles/` folders.
Pages reference them with root-absolute paths such as
`/shared/scripts/theme-init.js`, `/online/scripts/script.js`, and `/shared/images/...`.
Route-entry HTML stays in place so page URLs and basic static serving still work.
See [Repository layout](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Repository-Layout).

## Public features

- Responsive LinkTree-style social and project links

- A recruiter-facing `/professional/` profile with career highlights, skills,
  selected independent projects, LinkedIn/GitHub links, and the shared private
  contact form. It inherits the saved theme without loading games, simulated
  desktop windows, boot screens, or Easter eggs. Its experience timeline,
  location, and availability load from the Admin-managed `RESUME_PROFILE` data
  shared with `CAREER.SYS`; the hand-written cards in `professional/index.html`
  are only a fallback when Supabase is unreachable. Summary lines starting with
  `•` or `-` render as bullets, and technologies (comma- or double-space-
  separated) render as tags via `shared/scripts/career-format.js`.
  Education entries (school, credential, period, and optional bullet details)
  are edited in the same Admin form, stored in `site_resume_education`, and
  shown in both `CAREER.SYS` and the professional Education section.
  Certifications (name, issuer, issue date, credential ID, and an HTTPS
  verification link) use the same pattern through
  `site_resume_certifications`. `shared/scripts/career-data.js` shares one cached loader
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

- A shared virtual filesystem available through `FILE_EXPLORER.EXE` and the
  terminal's `pwd`, `ls`, `cd`, `cat`, and `files` commands

- A desktop-only, full-window `ARCADE.EXE` with Snake.BIT, Minesweeper,
  Bitsweeper, Bitris, Bit Pong, Packet Dodge, Cursor Chase,
  Null Tac Toe, endless wave-based Packet Breaker, and Flappy Bit, plus local
  bests, public rankings, and Admin moderation. Bititaire is temporarily
  unavailable while being reworked; its implementation and saved scores are retained

- A stateful `COBITS.EXE` parody assistant with quick actions, delayed replies,
  slash commands, conversational memory, multi-step interviews, diagnostics,
  and discoverable achievements

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

- Terminal-themed 404 recovery with bounded, theme-colored falling binary bits
  behind the recovery panel. Decoration pauses and clears when the page is hidden,
  and stays off with reduced motion, effects off, high contrast, or forced colors.
  ShortBit routes do not run the decoration. Production builds include generated metadata.

- Self-hosted source browser with raw-file and archive access

- Automated validation and SSH deployment through GitHub Actions
