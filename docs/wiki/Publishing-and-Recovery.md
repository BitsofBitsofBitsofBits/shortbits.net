# Publishing and recovery

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- **Open visual writer** in Admin opens an independently authenticated, themed
  article-writing page. Formatting, lists, checklists, tables, links, accessible
  images and protected legacy sections are saved as versioned rich-text JSON.
  Private save attempts run after a two-second typing pause or ten seconds of
  continuous editing, including
  incomplete titles, slugs and bodies. **Save draft** or Ctrl/Cmd+S makes a
  checkpoint. Only **Publish revision** promotes the saved revision; publication
  still requires a complete valid article. Editing a published article never
  changes its live body, title, slug, excerpt or date through autosaving.
  Appearance choices are preview-only. Unsaved navigation prompts and conditional
  updates protect drafts against accidental loss and competing edits.
  The toolbar keeps Strike, Highlight and the Font dropdown directly visible.
  **Structure** contains lists, tables and legacy-source controls; **Style**
  contains color, size and inline code. These are non-modal dropdowns, closed
  by a selection, Escape, clicking outside or tabbing out. Escape returns focus
  to the dropdown trigger.
  **Structure > Heading level** offers Paragraph and all supported levels:
  Header (H1), Heading 2 (H2), Heading 3 (H3), Heading 4 (H4), Heading 5 (H5)
  and Heading 6 (H6). It reflects the current block and preserves inline formatting.
  **Theme settings** still opens the preview-only
  family/variant popup, dismissed with Close, Escape or a backdrop click.
  **Link** separates the displayed text from the destination, prefills selected
  text or an existing link, and preserves text formatting when only its URL changes.
  **Style > Color** includes rainbow-spectrum presets and **Custom color**.
  Both editors include **Blurple** with the fixed color `#553fff`.
  Choose a swatch with the built-in picker or enter a **Hex color**, then **Apply color** to format the
  selected text or subsequent typing. Picking or dismissing without applying
  does not change the article. Both the visual writer and legacy Markdown editor
  accept RGB, RGBA, RRGGBB and RRGGBBAA Hex values, with or without `#`.
  Valid Hex values synchronize the picker; changing the picker preserves any
  Hex alpha channel. Invalid input displays an error without changing content.
- **History** previews private earlier revisions and **Restore to draft** creates
  a new private revision without publishing or cancelling an approved schedule.
  The latest draft head saves continuously; history keeps the newest **100
  checkpoints per article**, every **five minutes** and on manual saves,
  publishing and restores. Older checkpoints are pruned under that retention
  policy. Restoring checkpoints preserves current edits in history first.
  Saving/saved/error/conflict messages distinguish durable saves from local
  changes. Writes are serialized with UUID version tokens and retry receipts.
  A conflicting tab pauses autosaving instead of overwriting newer changes;
  reload the latest draft only after explicitly discarding local edits.
  Network/uncertain autosaves retry the same request with **Retry save**.
  Interrupted publication/restoration must be checked by reloading, not assumed
  successful. All textual draft/history access requires authenticated editorial
  permission. Uploaded images still use the existing public image bucket.
- The legacy Admin Markdown form now saves private drafts manually and has
  separate **Publish revision** / **Unpublish** actions. Rich bodies remain
  editable in the visual writer. A future publication time approves a frozen
  revision: an already-live article stays visible until that revision becomes
  due, even if its working draft changes afterward. **History > Cancel scheduled
  revision** cancels approval without hiding the currently live article.
  Deleting an article also permanently deletes its private draft, retained
  history and approved schedule; unpublishing retains its draft/history.
- **Tags and series:** both authenticated editors offer optional comma-separated
  tags (up to ten) and one series with a reading order from 1 to 100000.
  Choose an existing suggestion or enter a new name (up to 80 characters).
  Series names may contain commas; tag names may not. Names produce safe stable
  identifiers, and choosing a known name retains its identifier. Duplicate tags
  are rejected. Tied series positions sort by publication date, then article slug.
  Tags, series and reading order belong to each revision: autosaves, restoring
  history and editing an approved schedule never change current public membership.
  Only explicit publication promotes them. Suggestions are authenticated and
  derived from saved revisions, not a publicly mutable catalog. Changing a label
  on one revision does not rewrite other posts' saved labels.
  Public archives provide tag/series browsing; articles show labels and ordered
  previous/next navigation using only eligible public members. These reconcile
  live alongside articles. New groups use archive query links until a generated
  route exists. Generated category pages, RSS categories, sitemap entries and
  no-JavaScript membership/navigation remain deployment snapshots.
- **Tags/series release order:** obtain explicit migration and
  release approval and a fresh private pre-migration backup; apply
  `20261126160000_blog_taxonomy.sql`; export and verify a fresh exact-schema private
  backup; then deploy the compatible Admin, bundled writer, public readers,
  query contract and generator together. The migration adds metadata to existing
  public and approved rows and private snapshots without assigning existing posts
  or publishing anything. Existing loaded draft tokens and retry receipts are
  invalidated; save/export local unsaved edits before migration and reopen editors
  afterward. Old six-field clients fail closed. The backup table set is unchanged,
  but older exact-schema exports lack the new columns and cannot be restored by
  the post-migration content restore. Retain them privately for database-level
  recovery; code rollback requires compatible nine-field clients and readers.
- Existing Markdown is not converted by the database migration. On opening an
  old post, its exact source remains in a protected editable section.
  **Import original Markdown** adopts visual content only if a rendered-structure
  comparison confirms the supported formatting survives; otherwise the original
  stays protected with an explanation. The original `body_markdown` remains
  retained when saving rich content. Protected source edits are explicit.
  Rich posts' bodies must be edited in the visual writer, not the old textarea.
- **Rich-writer release order:** privately back up the database/content first;
  apply `20261123094500_blog_rich_content.sql`; export a fresh exact-schema content
  backup; then deploy the matching public readers, generator, Admin and locally
  bundled writer together. The new queries require the added column. Do not
  convert real posts before the compatible readers are deployed. No backfill is
  performed. Old readers cannot display newly rich-only bodies; code rollback
  after rich saves requires compatible readers or an explicit content recovery.
  Old exact-schema content backups lack `body_rich` and are rejected after the
  migration; retain pre-migration backups privately for database-level recovery.
  The browser/build strictly validate supported rich nodes and safe URLs; the
  database checks the versioned envelope and size, not recursive editor semantics.
  Image binaries remain separate Storage backups, as before.
  The documented private editorial backup path is Admin's **Content backups**
  download; keep it privately, never in public workflow artifacts. For the first
  rich-writer release, stage the additive migration while the old readers/writer
  remain deployed, download a fresh exact-schema backup, then release the rich
  readers and writer. Production deployment requires the Supabase migration job
  to succeed; missing credentials or migration failures must not ship the site.
- **Private-draft release order:** obtain a fresh private
  pre-migration database backup, then apply
  `20261123150000_private_blog_drafts.sql`, establish a fresh exact-schema
  private backup, and deploy the matching writer, Admin, public query contract
  and generator together. No post backfill or automatic publication occurs.
  The production environment variable
  `BLOG_PRIVATE_DRAFT_SCHEMA_BACKUP_CONFIRMED=true` unlocks frontend deployment
  only after that post-migration private backup/recovery readiness is confirmed.
  Until then, the workflow applies migrations but fails closed before deploying
  frontend files. Retain this one-time confirmation for compatible future releases.
  The migration revokes legacy direct INSERT/UPDATE publication writes; old
  already-open editors fail closed until reopened on the compatible code.
  RPCs permit only scoped authenticated editorial operations.
  `site_blog_public_posts` is a security-invoker public projection of eligible
  base articles and due explicitly approved revisions, never working drafts or
  history. No cron or additional hosting service is required.
  Browser eligibility uses database time so clock skew cannot hide a due replacement.
  A code rollback must retain compatible RPCs/public readers, or use a reviewed full recovery;
  restoring old direct writer writes would break draft/live separation.
- The Admin blog editor compares **current public publications**, not private
  working drafts, with `/blog/content-manifest.json`,
  generated from the same public posts as static articles, RSS, and the sitemap.
  It shows new/changed static articles and static copies awaiting removal.
  The editor separately labels private changes and approved schedules.
  **Check static snapshot status** reloads saved
  database content and bypasses the snapshot cache; saves and deletions also
  refresh the comparison. Unsaved edits are excluded. Scheduled posts require
  another check and a deployment after their publication time for static files. Missing or
  invalid snapshots show an explicit unavailable state, never "in sync."
  The public manifest contains only public slugs and SHA-256 fingerprints, not
  drafts, future post content, or admin credentials. This status does not trigger
  deployments; the editor links to the deployment workflow.
  Fingerprints include normalized public tags, series and reading order, so
  metadata-only edits also flag changed generated snapshots.
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
- Public articles include a **Table of Contents** above the body when content
  headings exist. It starts collapsed and uses nested bullet links for heading
  hierarchy, excluding the article title and interface headings. Markdown and
  rich content share deterministic unique section anchors, including duplicate
  headings. Live body refreshes replace the navigation along with the body;
  unchanged refreshes preserve its disclosure state. Generated articles include
  working disclosure and jump links without JavaScript. Articles without content
  headings omit the disclosure, and print output omits navigation.
- Public Markdown and rich readers adjust displayed text shades only when needed
  for normal-text AA contrast, without adding highlight boxes. Already readable
  colors stay exact; other shades lighten or darken while preserving their hue.
  For example, Blurple remains stored as `#553fff` but can display lighter on a
  dark reading surface. Original Hex/alpha remains in `data-color`; display
  opacity increases only if the original opacity cannot support readable text.
  Stored articles, private drafts/history and editor/import colors are unchanged.
  Rainbow retains its gradient with jointly contrast-checked stops, and linked
  formatting inherits its enclosing adapted color. Headings, metadata and focus
  indicators use readable theme ink,
  and decorative page overlays stay behind the reading surface.
  Generated initial HTML has readable default-dark colors without JavaScript.
  Live replacements, theme changes, stylesheet loads and resizing recalculate
  shades against the current reading surface, including gradient/alpha bounds.
- Blog articles use the full available shell width without an inner pixel or
  character cap. The shell has 8px outer side margins (4px on phones), compact
  responsive padding, and respects theme sidebars. Theme-specific shell caps
  and nested section padding do not squeeze
  the article or archive. Theme fonts, author formatting, colors, TOC and series
  navigation are retained. The phone layout reduces layered card padding while
  preserving theme navigation. `scripts/blog-layout-browser.mjs` measures usable
  widths, captures desktop/mobile views and checks supporting accessibility;
  use `--origin https://www.shortbits.net --override-css` to review local CSS on
  the public readers without changing published records. Omit `--override-css`
  for the deployed baseline; `--all-themes` covers all registered theme families.
- Deployment still generates initial article HTML, article-specific metadata,
  `/blog/feed.xml`, archive cards, and sitemap entries. Static HTML is retained
  for SEO and no-JavaScript readers; search/social crawlers, RSS, and sitemap do
  not become live. Deploy to refresh these artifacts or remove previously
  deployed content from them. Static copies may remain accessible without
  JavaScript or during an outage; unpublishing alone is not immediate removal
  of previously public content. Client reconciliation does not change HTTP status.
- The Admin center's **Content backups** page exports 23 editorial tables,
  including private draft heads, retained revision history and approved future
  publications. Restore validates the complete schema and runs atomically
  under authenticated editorial permission, with fixed-table privileged writes.
  It restores dependencies in order and rotates draft concurrency tokens so
  older tabs cannot overwrite restored content. A safety backup downloads first.
  The backup, creator, and message-catalog migrations must be deployed before these actions work.
  Export a new backup after schema updates; older backups do not
  match the current schema and are rejected rather than silently clearing new content.
  Admin restore remains bounded to **10 MiB / 10,000 rows**; history can exceed
  these bounds. Oversized exports/restores report an explicit limitation, never
  omit checkpoints or claim a truncated backup is complete. Use the supported
  private full-database backup/recovery path for larger datasets, including the
  operational changelog ledger, and keep Storage backups separately.
- Backups exclude private messages, guestbook entries, leaderboards, analytics,
  short links, device credentials, live telemetry, and image binaries. Keep
  backups private, retain separate Supabase database/Storage backups, and reload
  the editor after restoring. Regenerate static content with a new deploy.
- Contact verification loads near the form or on focus, with an inline retry
  action when verification fails. Verification remains required when configured.
  Discord/Spotify show timestamped last-known states when live updates fail.
