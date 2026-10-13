# shortbits.net

The source for [shortbits.net](https://www.shortbits.net/), the terminal-themed
internet presence of BitsofBitsofBits.

## AI Notice

Some features of this site were created and are maintained with the help of AI.
While I don't generally support relying on AI in most commercial settings, this
is a personal project and largely a learning exercise for me.

## Features

- Responsive LinkTree-style social and project links
- Dark, light, accent, high-contrast, and reduced-motion display profiles
- Spotify now-playing integration through a Supabase Edge Function
- Cached Discord presence, custom status, and activity through Lanyard
- Private contact form backed by Supabase
- Persistent local achievements and a large collection of Easter eggs
- Adaptive performance mode for constrained or slow devices
- Optional draggable mini-windows for profile, pronouns, Spotify, source,
  diagnostics, and settings that stay viewport-safe, resize from every edge
  and corner, and use themed internal scrollbars
- Shareable window URLs such as `?window=spotify` and
  `?windows=about,spotify` that restore linked windows on load
- A persistent control panel for appearance, reduced motion, larger text,
  increased contrast, decorative effects, window-layout resets, and link copying
- Admin-managed `CAREER.SYS`, `NOW.TXT`, and `CHANGELOG.LOG` windows with
  shareable URLs, responsive layouts, five-minute public caching, and clean
  unpublished states
- A desktop-style Admin Portal with draggable, resizable, deep-linkable windows
  for the inbox and every public-content editor
- RGB Mode that preserves the interface accent while cycling a rainbow gradient
  around the main shell and desktop-window edges
- Persistent full-interface themes: Default, Aurora, Cozy Blossom, Mica,
  Fluent, Midnight OLED, macOS, and Terminal. These remain independent from
  accent colors, light/dark display mode, and RGB edges. Theme and accent
  dropdowns provide direct selection, including a persistent RGB option.
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

The production web server must route missing paths to the themed error page
while retaining the HTTP 404 status. For Nginx, add this inside the site's
`server` block and reload Nginx:

```nginx
error_page 404 /404.html;

location = /404.html {
    internal;
}
```
