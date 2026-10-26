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

- A public `GUESTBOOK.LOG` with immediate publishing and authenticated Admin
  deletion controls

- An Admin-managed `GAMES.EXE` library of favorite games with ordered,
  publishable entries and links to their official or storefront pages

- An Admin-only ShortBits manager for HTTPS redirects at
  `shortbits.net/go/<alias>`, with generated or custom aliases, expiration,
  enable/disable controls, aggregate click totals, masked landing pages, and
  YouTube, Vimeo, or Spotify embeds
