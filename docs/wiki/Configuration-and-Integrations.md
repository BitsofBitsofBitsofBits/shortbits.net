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
anonymous inserts into `messages`. Until the function is deployed, the browser
falls back to the previous direct insert.

## Spotify request caching

The Spotify integration polls from the browser every 30 seconds while updating
the visible playback timeline locally once per second. The Edge Function caches
successful playback for 30 seconds, coalesces simultaneous refreshes, and serves
the last known playback while honoring Spotify's full `Retry-After` cooldown.
This greatly reduces the number of separate upstream Spotify requests created
by visitors and open tabs.
