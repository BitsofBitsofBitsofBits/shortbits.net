# Deployment

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

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
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (optional as a complete set):
  synced for Twitch creator lookup, profile photos, live status, and offline VODs.
  If absent or incomplete, existing Supabase Twitch secrets are unchanged.

The job deploys `contact-message`, `creator-videos`, `creator-twitch`,
`spotify-now-playing`, `youtube-presence`, and `hardware-sync`, then runs `supabase db push`. When the
required secrets are missing it logs a warning and skips, and the static
deploy still runs if the job fails.

YouTube watching presence additionally deploys `youtube-presence` and uses
the updated `spotify-now-playing` function for continuous session timing.
Apply both `20261026050000_youtube_presence.sql` and
`20261026060000_youtube_session_continuity.sql`; the latter is also required
when the first migration has already shipped. The browser extension is
installed unpacked from the repository, not copied into the public site build.
Provision its revocable device token in Supabase's SQL editor using the
[extension setup guide](https://github.com/BitsofBitsofBitsofBits/shortbits.net/tree/main/extensions/youtube-presence).
It requires no additional GitHub or YouTube secrets.

The updated `spotify-now-playing` function is required for media-session timing
and is deployed automatically alongside YouTube presence. The post-deployment
Spotify health check rejects missing session fields and session-database failures,
even when playback itself still works. An inactive response may have a null session
start; playing or paused items must include a valid session timestamp.

Pushing a commit starts validation; it does not apply migrations immediately.
The Supabase job depends on successful validation and is skipped when validation
fails. Inspect **Apply database migrations** directly before trying newly added
database functions. An overall failed run may instead be a later Lighthouse
failure after a successful deploy, so distinguish job results.

The October 26 changelog catch-up is stored in
`20261026070000_recent_changes_changelog.sql`. It appends dated, enabled entries
after the highest existing position without replacing earlier releases or Admin
drafts. The public `CHANGELOG.LOG` updates after this migration, subject to the
existing five-minute content cache; publishing the Wiki alone does not update it.

Before deployment, the workflow builds an offline fixture site and runs browser
smoke checks, axe accessibility checks, and mobile/desktop Lighthouse budgets.
After each deploy, the `lighthouse` job also audits the chooser, `/online/`,
`/professional/`, and `/professional/resume/` on mobile and desktop. It writes
a score table to the run summary, logs failing audits, and uploads the JSON
reports as an artifact. Both audit runs require performance >= 90,
accessibility and SEO = 100, LCP <= 2.5 seconds, and CLS <= 0.1. Missing reports
and audit runtime errors fail the check. The pre-deployment check blocks
deployment; a failing post-deployment check marks the workflow unsuccessful
but does not automatically roll back the deployed site.

## Static files and Caddy

The workflow validates JavaScript and local asset references, scans for
committed secrets, generates `build-info.json`, and uploads only public static
site files from `.site-build`. It mirrors only the generated
`blog/articles/` directory with `rsync --delete`, so unpublished or removed
articles do not leave public HTML behind. Other production directories are
not deleted.

The production Caddy server must route missing paths to the themed error page
while retaining the HTTP 404 status. The active Caddy configuration supplies
that internal error handling for `/404.html`.

After deploying the static files, the workflow downloads
`/etc/caddy/Caddyfile`, updates its quoted Content Security Policy with the
approved YouTube, Vimeo, Spotify, and Cloudflare Turnstile `frame-src` values
plus the Cloudflare Web Analytics, Turnstile, and Lanyard WebSocket origins.
It enables precompressed Brotli/gzip files and year-long immutable caching
only for existing CSS/JS with a generated 16-hex asset version. It then
validates the candidate
configuration, installs it, and reloads Caddy. A failed reload restores the
original Caddyfile automatically. The deployment user therefore needs narrowly
scoped passwordless `sudo` access to `caddy validate`,
`install /tmp/Caddyfile.* /etc/caddy/Caddyfile`, and
`systemctl reload caddy`.

The Caddy updater accepts one unambiguous top-level shortbits.net site with a
root, quoted CSP, and a simple file server. It rejects unsupported custom routing
instead of silently rewriting it; adapt the server configuration deliberately
if validation reports an unsupported layout. Never bypass `caddy validate`.

The updater also adds a permanent 308 redirect from `shortbits.net` to the
canonical `https://www.shortbits.net`, preserving the path and query string.
The site block must explicitly include `www.shortbits.net`; an apex-only
configuration is rejected instead of redirecting to an unconfigured host.
The build generates static search/social metadata and breadcrumbs, and site
validation checks sitemap/canonical consistency. See
[Search visibility and SEO](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Search-and-SEO)
for Google Search Console and Bing Webmaster Tools setup after deployment.

Cloudflare JavaScript Detections can inject inline code that the site's strict
CSP rejects. Disable that injection for these static pages in Cloudflare, or
configure compatible nonce handling at the edge. Do not add `unsafe-inline` or
static hashes for Cloudflare's changing injected code. This dashboard setting
is separate from the repository and is not changed by deployment.
