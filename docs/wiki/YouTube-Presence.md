# YouTube watching presence

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

The **ShortBits YouTube Presence** extension reports your current YouTube video
to the online page's existing Spotify player area. It supports Chrome, Edge,
and Brave through Chromium Manifest V3. Sharing starts **off**, and Google
account credentials, YouTube OAuth, and API keys are not required.

## Deploy before pairing

The main-branch workflow must finish validation and then successfully run the
**Supabase -> Apply database migrations** step. It deploys `youtube-presence`.
The updated `spotify-now-playing` function is also required for session timing;
it is not currently in the automatic Edge Function deploy list, so deploy it
explicitly using the command below. Apply both migrations:

1. `20261026050000_youtube_presence.sql`
2. `20261026060000_youtube_session_continuity.sql`

Deploy the matching website assets too. The extension itself is installed
locally from the source checkout and is excluded from the public site build.
No additional GitHub or Supabase secret is needed for YouTube reporting.

For manual deployment with an authenticated Supabase CLI:

```powershell
supabase link --project-ref arjwrycitgobvlodmkeo
supabase db push --linked
supabase functions deploy youtube-presence --project-ref arjwrycitgobvlodmkeo --no-verify-jwt
supabase functions deploy spotify-now-playing --project-ref arjwrycitgobvlodmkeo --no-verify-jwt
```

## Create and install a device token

In the correct project's **Supabase SQL Editor**, run:

```sql
select public.create_youtube_presence_device('My desktop browser');
```

The returned object contains a device ID and one-time `sbyt_...` token. Copy
the token directly into the extension popup, not into source files or chat.
Only its SHA-256 hash is stored in the database. Anyone holding the raw token
can publish status to the website.

1. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Enable **Developer mode**, choose **Load unpacked**, and select
   `extensions\youtube-presence` in the source checkout.
3. Pin **ShortBits YouTube Presence** to the toolbar.
4. Reload any existing YouTube tabs.
5. Open the popup, paste the token, check **Share my YouTube playback**, and save.
6. Play a video and open `/online/`. Use the media arrows to switch sources.

After extension updates, click **Reload** on the browser's extensions page
and reload YouTube tabs again. This is a local unpacked extension, not a
browser-store listing. See its
[source and detailed setup guide](https://github.com/BitsofBitsofBitsofBits/shortbits.net/tree/main/extensions/youtube-presence).

## Sharing, ordering, and expiry

- Sharing includes video ID, title, channel, playback position, duration, and
  playing/paused status. It does not collect viewing-history lists, search
  queries, cookies, Google credentials, or playlists.
- Playing media comes before paused media. With equal playback state, the
  earlier continuous session appears first. Song changes, video changes, and
  seeking do not restart the session. Arrows override the displayed source
  until playback state/source priority changes; there is no timed auto-rotation.
- Pauses preserve a session while observations continue. Brief navigation or
  autoplay gaps retain the YouTube session, but gaps over 90 seconds restart
  timing. Starts represent the first server observation, not a reconstructed
  historical start.
- While sharing is on, the extension also checks the existing cached Spotify
  endpoint at most once every 30 seconds, allowing session tracking without
  a website visitor. When neither the browser nor a visitor observes playback,
  historical session timing cannot be recovered.
- Playback changes debounce for one second; heartbeats run every 30 seconds.
  Closing eligible YouTube tabs clears the current report. Turning sharing
  off also ends the session.
- Reports expire 90 seconds after the last successful update if the browser
  closes, suspends, disconnects, or the extension is removed. The site polls
  every 30 seconds and also enforces received expiry locally.

**Paused videos remain public while sharing is enabled.** Turn sharing off
before opening private or unlisted content. The extension cannot reliably
detect video visibility. It excludes incognito windows, ads, and incomplete
navigation metadata. It observes only YouTube watch pages and Shorts on
`https://www.youtube.com`, not phone/TV apps, embedded players, or other sites.

Tokens stay in this browser profile's local extension storage, not Chrome
Sync. Content scripts cannot read them. Use one publishing browser/profile
at a time; multiple devices share one public YouTube slot.

## Revoke or replace a token

Use the SQL Editor to identify the exact device:

```sql
select id, name, created_at, last_seen_at
from public.youtube_presence_devices;
```

Delete only the intended ID, replacing the example:

```sql
delete from public.youtube_presence_devices
where id = '00000000-0000-0000-0000-000000000000';
```

Revocation also deletes that device's current public report. Generate a new
device token if the original is lost or exposed; it cannot be recovered
from its stored hash.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `create_youtube_presence_device(unknown) does not exist` | The first migration is missing in the queried project. Check that the pushed commit contains it and the Supabase migration step succeeded. `LIMIT 100` and an explicit text cast do not solve a missing function. |
| The push is visible but the function is still missing | Validation runs before Supabase. An in-progress or failed validation job has not applied the migrations. Check job/step results, not just the commit or overall run badge. |
| Function works but publishing fails | Apply the continuity migration too, deploy the updated functions, and check the popup error/`!` badge. The raw device token must not be a publishable key or service-role key. |
| Existing YouTube tabs are not detected | Reload them after installing or reloading the extension. |
| Sharing was turned off but a card remains briefly | The immediate clear may have failed or a visitor may be between polls. The popup reports clear failures; the last report expires within 90 seconds. |
| Session timing is unavailable | Check the session migration and updated Spotify function. Existing Spotify playback remains usable if session persistence fails, but the site does not invent a session start. |

## Validation

```powershell
node --test scripts\youtube-extension.test.mjs scripts\youtube-presence-database.test.mjs scripts\live-widgets.test.mjs supabase\functions\youtube-presence\youtube-presence.test.mjs supabase\functions\spotify-now-playing\spotify.test.mjs
npx playwright install chromium
node scripts\youtube-extension-browser.mjs
node scripts\media-player-browser.mjs --root .site-build
```

The real-extension check uses bundled Chromium with fixture playback and
intercepted backend responses. The carousel check covers desktop/mobile
session ordering, paused clocks, arrow controls, metadata safety, expiry,
independent failure handling, theme layouts, and accessibility.
