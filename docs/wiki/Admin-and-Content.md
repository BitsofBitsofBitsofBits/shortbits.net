# Admin and content

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- A "Bits 365 admin center" at `/admin` (legacy `/admin.html` links
  redirect there), styled after the Microsoft 365 admin center and separate
  from the public site themes: a suite bar (app launcher, search, settings,
  help, account), a collapsible grouped left navigation that becomes a drawer
  on small screens, hash-routed pages such as `/admin/#/inbox`, a Home
  dashboard with quick actions and live counts, and right-side flyout panels
  for inbox messages and settings. Each module has its own subsection navigation,
  which wraps into horizontal buttons on smaller screens. Larger editors split
  into focused views (for example résumé profile/experience/education/certifications,
  blog posts/editor/publishing, and hardware machines/import/live agents).
  Switching subsections preserves unsaved form values; shared Save buttons still
  submit the complete form, and validation reveals hidden fields that need attention.
  Light, dark, or system appearance is saved per device

- An accessible public `BLOG.LOG` with draft-aware Supabase publishing,
  semantic article pages, safe Markdown rendering, and a live Markdown preview
  in the Admin Portal

- GUI controls for adding and removing résumé experiences, featured playlists,
  featured songs, and changelog entries without fixed slot limits
  - Experience entries support **Use start/end date selectors**, start/end
    months, and **I'm still here** for an active role. The generated period
    stores only the date range, not a duration that will become stale. End dates
    cannot precede the start, and role dates cannot be in the future.
    Existing month/year ranges prefill these controls; custom labels remain
    editable when date selectors are off. A label such as `Current` needs its
    actual start month entered once before tenure can be calculated.
    These controls reuse the existing `period` field, so no database migration
    or backup-format change is required.

- **Showcase > Featured project** (`/admin/#/featured-project`) controls the
  Online `FEATURED_PROCESS` box: title, summary, optional status and comma-separated
  technology tags, HTTPS project link, link label, and publishing checkbox.
  It is disabled by default; disabling it hides the entire section while keeping
  the saved draft. Changes appear when Online is reloaded, without rebuilding.
  Apply `supabase/migrations/20261026090000_featured_project.sql` before using
  the editor. Until then (or if the request fails), the public section stays hidden.
  Featured-project drafts and publishing state are included in content backups;
  export a fresh backup after applying the migration.

- A public `GUESTBOOK.LOG` with immediate publishing and authenticated Admin
  deletion controls

- An Admin-managed `GAMES.EXE` library of favorite games with ordered,
  publishable entries and links to their official or storefront pages

- An Admin-only ShortBits manager for HTTPS redirects at
  `shortbits.net/go/<alias>`, with generated or custom aliases, expiration,
  enable/disable controls, aggregate click totals, masked landing pages, and
  YouTube, Vimeo, or Spotify embeds
