# Publishing and recovery

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- The Admin blog editor compares saved posts with `/blog/content-manifest.json`,
  generated from the same public posts as static articles, RSS, and the sitemap.
  It shows new/changed static articles, static copies awaiting removal, and
  future scheduled posts. **Check static snapshot status** reloads saved
  database content and bypasses the snapshot cache; saves and deletions also
  refresh the comparison. Unsaved edits are excluded. Scheduled posts require
  another check and a deployment after their publication time for static files. Missing or
  invalid snapshots show an explicit unavailable state, never "in sync."
  The public manifest contains only public slugs and SHA-256 fingerprints, not
  drafts, future post content, or admin credentials. This status does not trigger
  deployments; the editor links to the deployment workflow.
- `/projects/` contains factual case studies for the home lab and this site.
  These describe implemented capabilities, not independently measured business
  outcomes.
- **Find a Bit** is available in the online site's Tools menu or with
  `Ctrl+K` / `Cmd+K`. Search windows, pages, settings, and the boot replay action;
  desktop-only windows are omitted on mobile.
- Online enhancements initialize after the first contentful paint. Early
  controls queue with loading feedback; failed initialization shows an explicit
  retry action instead of leaving apparently functional but inactive controls.
- Browser blog archives and article readers reconcile with public Supabase data
  on load, on return to the page, and every minute while visible. Edits and
  same-slug deletion/recreation update without deployment; new and due scheduled
  posts appear in the live archive, using the live reader until a static route
  exists. A successful empty article response hides deleted, unpublished, or
  future-scheduled content instead of restoring the deployed copy. Backend errors
  show an explicit stale-content warning and retry; an already hidden article
  stays hidden during an outage.
- **Theme settings** in the top navigation on the blog archive and both article
  readers opens a popup sharing the site's saved theme, color mode, and
  per-theme variants. Close it with **Close**, Escape, or a click outside.
  The nested family picker matches the main site's menu (Windows, macOS,
  palettes, and other families), with variants inside each theme.
  Color mode and variant
  controls appear only where supported; seasonal availability follows the
  shared theme picker. These controls do not load the Online desktop runtime.
- Professional, Now Playing, and Endless Boot theme controls use the same nested
  family picker as Online and the blog. The Admin draft preview also uses it,
  with preview-only appearance choices that never change saved site preferences
  or Admin appearance.
- Deployment still generates initial article HTML, article-specific metadata,
  `/blog/feed.xml`, archive cards, and sitemap entries. Static HTML is retained
  for SEO and no-JavaScript readers; search/social crawlers, RSS, and sitemap do
  not become live. Deploy to refresh these artifacts or remove previously
  deployed content from them. Static copies may remain accessible without
  JavaScript or during an outage; unpublishing alone is not immediate removal
  of previously public content. Client reconciliation does not change HTTP status.
- The Admin center's **Content backups** page exports 15 editorial tables,
  including creators, message catalogs, and drafts. Restore validates the complete schema and runs atomically
  under existing authenticated permissions. A safety backup downloads first.
  The backup, creator, and message-catalog migrations must be deployed before these actions work.
  Export a new backup after schema updates; older 13/14-table backups do not
  match the current schema and are rejected rather than silently clearing new content.
- Backups exclude private messages, guestbook entries, leaderboards, analytics,
  short links, device credentials, live telemetry, and image binaries. Keep
  backups private, retain separate Supabase database/Storage backups, and reload
  the editor after restoring. Regenerate static content with a new deploy.
- Contact verification loads near the form or on focus, with an inline retry
  action when verification fails. Verification remains required when configured.
  Discord/Spotify show timestamped last-known states when live updates fail.
