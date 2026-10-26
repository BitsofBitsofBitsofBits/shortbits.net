# Publishing and recovery

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- The Admin blog editor compares saved posts with `/blog/content-manifest.json`,
  generated from the same public posts as static articles, RSS, and the sitemap.
  It shows new/changed articles, articles still public until deployment removes
  them, and future scheduled posts. **Check deployment status** reloads saved
  database content and bypasses the snapshot cache; saves and deletions also
  refresh the comparison. Unsaved edits are excluded. Scheduled posts require
  another check and a deployment after their publication time. Missing or
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
- Deployment generates static blog articles, article-specific metadata,
  `/blog/feed.xml`, archive cards, and sitemap entries from published Supabase
  posts. Newly published posts use the live legacy reader until the next deploy.
  Edits, scheduling, deletion, and unpublishing require another deploy to update
  static copies and RSS. Do not treat unpublishing alone as immediate removal of
  previously deployed public content.
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
