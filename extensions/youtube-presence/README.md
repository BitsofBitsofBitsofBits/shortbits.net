# ShortBits YouTube Presence

A Chromium Manifest V3 extension for Chrome, Edge, and Brave. Sharing starts
**off**. Once enabled, it publishes the current YouTube video and paused/playing
status to the same website player area as Spotify.

## 1. Deploy the backend and website

The normal site workflow deploys `youtube-presence` and these migrations:

- `supabase/migrations/20261026050000_youtube_presence.sql`
- `supabase/migrations/20261026060000_youtube_session_continuity.sql`

The updated `spotify-now-playing` function must also be deployed for session
timing. It is not currently in the workflow's automatic Edge Function deploy
list; deploy it explicitly using the command below.

Deploy the website changes too, including `media-player.js` and its stylesheet.
The Edge Functions use Supabase's built-in database credentials. No YouTube API
key, Google OAuth grant, or additional Supabase secret is needed.

For manual deployment with an authenticated Supabase CLI:

```powershell
supabase link --project-ref arjwrycitgobvlodmkeo
supabase db push --linked
supabase functions deploy youtube-presence --project-ref arjwrycitgobvlodmkeo --no-verify-jwt
supabase functions deploy spotify-now-playing --project-ref arjwrycitgobvlodmkeo --no-verify-jwt
```

Do not skip the second migration if the first is already applied.

## 2. Create a device token

In this project's **Supabase SQL Editor**, run:

```sql
select public.create_youtube_presence_device('My desktop browser');
```

Copy the returned `token` into the extension popup. The token begins with
`sbyt_` and is returned only once; only its SHA-256 hash is stored in the
database. Treat it like a password: anyone holding it can publish YouTube
status to this website. Never commit it, put it in browser-page code, share
query results, or paste it into chat.

To revoke a device, use the SQL editor to find its ID, then delete that exact
device. Revocation also deletes its current public report immediately:

```sql
select id, name, created_at, last_seen_at
from public.youtube_presence_devices;

-- Replace the example UUID with the exact device ID you intend to revoke.
delete from public.youtube_presence_devices
where id = '00000000-0000-0000-0000-000000000000';
```

Create a new token if you lose the original or suspect it has been exposed.
Use one publishing browser/profile at a time. Multiple devices are supported
for credential management, but their reports share a single public YouTube slot.

## 3. Load the extension

1. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Enable **Developer mode**, choose **Load unpacked**, and select this
   `extensions\youtube-presence` folder (the folder containing `manifest.json`).
3. Pin **ShortBits YouTube Presence** to the toolbar.
4. Reload any YouTube tabs that were already open.
5. Open the popup, paste the device token, check **Share my YouTube playback**,
   and save.
6. Play a video, then open the online page. A YouTube entry should appear in
   the existing player area; arrows switch between it and Spotify.

After changing extension files, use **Reload** on the extensions page and
reload YouTube tabs again. The extension is loaded locally, not distributed
through a browser store. No developer signing or build step is required.

## Sharing and privacy

- Only `https://www.youtube.com` watch pages and Shorts are observed. YouTube
  phone/TV apps, embedded players, other sites, and incognito windows are not.
- Reports contain the video ID, title, channel name, playback position,
  duration, and paused/playing state. The server assigns session timestamps.
  No cookies, Google account credentials, search queries, playlists, or
  viewing-history lists are collected.
- Metadata is read only when the background worker requests it while sharing
  is enabled. Ads and incomplete navigation metadata are not published.
- **Paused videos remain public while sharing is on.** Turn sharing off
  before opening private or unlisted content. The extension cannot reliably
  determine a video's visibility and does not claim to hide private videos.
- Tokens are stored only in this browser profile's local extension storage,
  not Chrome Sync. Content scripts cannot read them.
- Playback changes normally publish after a one-second debounce; heartbeats
  run every 30 seconds. Closing all eligible tabs clears the report. Turning
  sharing off also ends the viewing session.
- If the browser closes, the device goes offline, the extension is removed,
  or an immediate clear fails, the public report expires within 90 seconds
  of its last successful update. An already-open website polls every
  30 seconds and also enforces the expiry locally.
- The popup shows errors and an `!` badge for failed updates. Sharing remains
  off if clearing a previous configuration fails during a settings change.
  If a token is revoked, replace it with a newly generated token in the popup.

## Session ordering

The card prioritizes **playing over paused** media. When both sources are
playing, or both are paused, the earlier continuous session appears first.
Changing songs, videos, or playback position does not restart the session.
Arrow controls select the other source; a playback-state or source-order
change restores automatic priority. There is no timed auto-rotation.

Session start means the **first server observation of a continuous session**,
not the song/video position. Pauses preserve a session while updates continue;
navigation/autoplay gaps of up to 90 seconds preserve the YouTube session.
No playback, an explicit opt-out, or an observation gap over 90 seconds ends
the relevant session.

While sharing is enabled, the extension also checks the existing cached
Spotify endpoint at most once every 30 seconds. This keeps Spotify sessions
observable even without a website visitor and does not publish additional
Spotify metadata. Spotify's existing rate-limit/cooldown behavior is retained.
When the browser is closed or suspended and nobody visits the site, playback
cannot be observed; historical continuous-session start times cannot be
reconstructed from YouTube or Spotify. Tracking resumes as a new observed
session after the gap, rather than inventing an earlier start.

## Validation

From the repository root:

```powershell
node --test scripts\youtube-extension.test.mjs scripts\youtube-presence-database.test.mjs scripts\live-widgets.test.mjs supabase\functions\youtube-presence\youtube-presence.test.mjs supabase\functions\spotify-now-playing\spotify.test.mjs
node scripts\youtube-extension-browser.mjs
node scripts\media-player-browser.mjs
```

The extension browser check requires Playwright's bundled Chromium
(`npx playwright install chromium`), not branded Chrome, which restricts
command-line loading of unpacked extensions. CI installs this browser explicitly.

The extension browser check loads the real unpacked extension in Chromium
with synthetic YouTube playback and intercepted backend responses. The
carousel check tests desktop/mobile priority, paused playback, arrows,
metadata safety, expiry, independent failures, and accessibility.
