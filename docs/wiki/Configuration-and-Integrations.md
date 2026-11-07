# Configuration and integrations

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

## Public configuration and services

### YouTube watching presence

An opt-in Chromium extension reports playing and paused YouTube videos to
`youtube-presence`. The online page uses arrows to switch between YouTube
and Spotify in the existing player area. Playing media is prioritized over
paused media; otherwise the earlier continuous listening/watching session
appears first. Track and video changes do not reset the session.

See [YouTube watching presence](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/YouTube-Presence)
for unpacked installation, device-token provisioning/revocation, migrations,
and observation-gap limitations. Sharing is off by default; reports expire
after 90 seconds without updates. No YouTube API credentials are required.

### Spotify and public configuration

`shared/scripts/supabase-config.js` contains the public Supabase project URL and publishable
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
named and hex colors, rainbow text, text sizes, and curated font choices. Use
`{{color:#ff8800|colored text}}` for a custom color; supported hex formats are
`#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA` (including optional transparency).
Choose **CUSTOM HEX...** in the toolbar's color menu, enter a hex code, and
apply it to selected text. Hex codes may also omit the leading `#`, both in
the custom-color field and in Markdown. Formatting preserves the editor's
selection and scroll position, including when using custom-color controls.
Invalid codes are displayed literally when typed
in Markdown and rejected with an error by the toolbar. A formatting
toolbar inserts the underlying markup for authors who do not want to write it
manually. The text area is full-width and vertically resizable; its attached
toolbar stays visible below the Admin suite bar while scrolling the editor.
**Show preview** reveals a live article preview below the text area, with
independent Theme, Variant, and Color scheme selectors. The selectors include
all public themes and out-of-season themes without changing saved preferences
or Admin appearance. Single-scheme themes lock their color scheme; themes
without variants disable that selector. Experimental layouts show article
styling only. Preview is hidden by default; updates resume with the latest
unsaved title, excerpt, and body when reopened. Authenticated image uploads accept JPEG, PNG, WebP, or GIF files up to
5 MB and require alternative text before insertion. The renderer creates DOM
nodes directly instead of injecting HTML. Only attribute-free `<br>`, `<br/>`,
and `<br />` tags (case-insensitive) create explicit line breaks; other raw HTML
is displayed as text, including inside code blocks.
Pasting rich text into Blog Markdown converts supported HTML formatting to
Markdown: bold, italics, underline, strike, highlight, inline colors and fonts,
headings, paragraphs, line breaks, blockquotes, lists, tables, links, and code. Use
the toolbar's Quote option for selected lines, or prefix a line with `> `.
Clipboard
scripts and active content are never executed. External stylesheets and arbitrary
layouts are not imported; nested lists are flattened and link labels are plain
text. Images are not uploaded by paste. Use browser plain-text paste
(usually Ctrl+Shift+V or Command+Shift+V) to bypass conversion. Oversized pastes
are rejected with an error without changing the draft. Plain-text clipboard
content, including existing Markdown, is pasted unchanged.
Draft and future-dated posts remain hidden from anonymous clients
through row-level security.

### Formatting keyboard shortcuts

Shortcuts work while focused in the Blog **Markdown** field or the Message
Library's **Message text** / **Corrected text** fields. Use **Ctrl** on
Windows/Linux and **Command** on macOS. The same hints appear beside each
editor and in toolbar tooltips.

| Shortcut (Ctrl or Command) | Action | Editors |
| --- | --- | --- |
| B | Bold | Blog and messages |
| I | Emphasis / italic | Blog and messages |
| U | Underline | Blog and messages |
| Shift+X | Strikethrough | Blog and messages |
| Shift+C | Inline code | Blog and messages |
| Shift+H | Highlight | Blog only |
| K | Insert a link; prompts for an HTTP/HTTPS URL | Blog only |

Select text to wrap it in formatting markup; with no selection, the editor
inserts and selects placeholder text. These apply the same actions as the
toolbar, not formatting-off toggles. Message shortcuts automatically enable
inline markup, respect the 2,000-character limit, and affect only the focused
message or correction. Formatting retains the editor's selection and scroll
position. Shortcuts edit the unsaved draft; they do not save or publish it.

Plain-text fields (résumé summaries, excerpts, authors, contact/guestbook
forms, and JSON/script fields) do not render inline formatting and therefore
do not intercept these shortcuts. Unsupported combinations and normal
copy/paste, select-all, undo/redo, and save shortcuts keep their existing
browser behavior. Shortcuts are inactive in disabled/read-only fields or
during input-method composition.

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
transmits or stores a visitor identifier in these Online aggregate events.
Blog views are separate: `shared/scripts/blog-views.js` stores a random token
per article and UTC day in `localStorage`, sends it with the slug to
`get_blog_post_views`, and requests totals without a token under either privacy
signal. The database keeps aggregate totals and clears earlier-day duplicate
receipts on new counted views. These claims do not describe hosting/service
logs. The [public privacy page](https://www.shortbits.net/privacy/) explains all
three measurement paths, local state, contact handling, and third-party
requests without requiring visitors to read this Wiki.

`shared/scripts/site-config.js` holds optional public third-party identifiers:

- `cloudflareAnalyticsToken`: the Cloudflare Web Analytics site token.
  `shared/scripts/cf-analytics.js` loads the cookieless beacon on public pages only when the
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
  Match the secret to the public widget key in `shared/scripts/site-config.js`; if GitHub's
  Supabase environment also defines the secret, update it there so deployment
  does not overwrite a dashboard-only correction.

The contact form posts to the `contact-message` Edge Function, which inserts
messages with the service role after its spam checks. The
`20261021030000_protect_contact_messages.sql` migration then revokes direct
anonymous inserts into `messages`. When the function returns 404 and no Turnstile site key is configured, the browser
can fall back to the previous direct insert (subject to database permissions).
With the configured Turnstile key it never bypasses verification through this fallback.

## Spotify request caching

The Spotify integration polls from the browser every 30 seconds while updating
the visible playback timeline locally once per second. The Edge Function caches
successful playback for 30 seconds, coalesces simultaneous refreshes, and serves
the last known playback while honoring Spotify's full `Retry-After` cooldown.
This greatly reduces the number of separate upstream Spotify requests created
by visitors and open tabs.
