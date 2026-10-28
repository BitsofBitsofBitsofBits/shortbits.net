# Creator feed

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- A `CREATOR.FEED` card and shareable `/online/?window=creators` window for
  creators worth watching on YouTube or any other platform. Admin -> Showcase ->
  Creators manages names, platform labels, HTTPS channel/profile links, notes,
  numeric display order (lower first), and enabled/hidden entries. Nothing is
  preselected; add your own list in Admin.
  An optional 24-character YouTube channel ID (`UC` followed by 22 characters,
  not an `@handle`) enables a latest-upload link using YouTube's public Atom
  feed and an automatic channel photo from the public channel page. In Admin,
  paste a channel URL or `@handle` into CHANNEL / PROFILE URL and click
  **LOOK UP YOUTUBE CHANNEL**, then save. This authenticated lookup fills the
  UC ID and a canonical channel URL; it never saves automatically. Supported
  links include `/@handle`, `/channel/UC...`, `/c/name`, `/user/name`, and older
  top-level channel links such as `https://www.youtube.com/OzMediaOfficial`.
  IDs can also
  be copied from a channel's description / About -> Share channel -> Copy channel ID,
  or YouTube's advanced account settings for your own channel. Uploads may include Shorts
  and livestreams; this is not a long-form-only feed.
  Creator data and video requests run only when the window opens. Creator lists
  refresh on reopen after five minutes or immediately with **Refresh feed**;
  successful upload/photo results are cached for up to ten minutes. Feed/photo
  failures are reported independently without hiding channel links or successful
  uploads. Failed integration requests, per-channel failures, and photo-loading
  failures do not mark the browser's feed as fresh: reopening the window retries
  immediately, as does **Refresh feed**. Successful loads keep their normal
  freshness window; there is still no continuous background polling.
  Photos use fixed 64px slots, lazy loading, and initials when unavailable;
  platforms without an integration also show initials. YouTube photos are restricted
  to YouTube's image CDN hosts.
  Channel-page metadata may stop working if YouTube blocks requests or changes its
  markup. No YouTube API key or embedded player is needed; browsers request only
  the channel image from Google's image CDN, without sending a referrer.
  Deploy `20261025010000_create_creators.sql` and the public `creator-videos`
  Edge Function (`--no-verify-jwt`); the deployment workflow includes both.
  The function uses Supabase's built-in URL/anon-key environment variables and
  fetches feeds/photos only for enabled, Admin-configured channel IDs on public
  GET requests. POST lookups verify a signed-in, non-anonymous Supabase user
  (matching the creator editor's authenticated-user policy), accept only YouTube
  channel paths, disable redirects, and bound channel-metadata reads to 2 MB/10 seconds.
  Twitch channel URLs (`https://www.twitch.tv/username`) also enable automatic
  profile photos and live/offline status. **Look up Twitch channel** accepts a
  username or channel URL, validates it through Twitch, canonicalizes the link,
  sets the platform, and fills an empty creator name. It does not save automatically.
  Use the full `twitch.tv` hostname (for example,
  `https://www.twitch.tv/human1`), or enter just `human1`; `https://www.twitch/human1`
  is not a Twitch channel URL. Lookup errors display the server's explanation,
  including invalid URLs, expired Admin sessions, and channels not found.
  Replacing a YouTube integration asks before clearing its channel ID, and edits
  made during a lookup are never overwritten.
  Live creators show the stream title, category, and **Watch live** link; offline
  creators show their latest available archived broadcast, or an explicit
  no-public-broadcasts message. VODs can expire or require a subscription; the
  site does not bypass Twitch's playback restrictions. Twitch failures retain
  channel links and do not hide working YouTube data. Photos load only from
  `static-cdn.jtvnw.net`, with no referrer. Twitch data is cached for one minute;
  reopening the window after that interval or **Refresh feed** checks again.
  There is no continuous polling or embedded player.
  Deploy the `creator-twitch` Edge Function (`--no-verify-jwt`) and configure
  `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` in Supabase. The workflow deploys
  it automatically and can sync both credentials from GitHub environment secrets.
  No additional database migration or Twitch ID field is required; integrations
  are derived from saved channel URLs, including existing Twitch entries.
  Public GETs fetch only enabled, configured creators. POST lookups require an
  authenticated, non-anonymous Supabase user. Twitch app tokens stay server-side,
  are reused until expiry, and refresh once on a revoked-token response.
  For setup, register an application in the
  [Twitch developer console](https://dev.twitch.tv/console/apps) using Twitch's
  [registration guide](https://dev.twitch.tv/docs/authentication/register-app/).
  Enable 2FA on the developer account, use a confidential/server-side application
  with category **Website Integration**, and generate its client secret.
  If registration requires a redirect URL, add `https://shortbits.net/`;
  this integration uses client credentials, so it never redirects visitors or
  asks them to log into Twitch. Add both values as secrets named
  `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in the GitHub **Supabase**
  environment before deployment, or set those names directly in Supabase
  **Edge Functions -> Secrets**. Never add the secret to browser configuration,
  source files, or chat. No streamer-specific authorization or scopes are needed.
