# Repository layout

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

Public assets are grouped by ownership. Shared browser assets live under
`shared/`; assets used only by one page live in that page's folder.
JavaScript and CSS no longer live directly in the repository root.

```text
shared/
  scripts/                 Shared configuration, content, themes, and integrations
    blog-data.js           Public blog queries shared by live readers and the static build
    career-data.js         Public resume queries shared by online, professional, and the resume build
    layouts/               Lazy-loaded experimental theme behavior
  styles/                  Shared base styles and generated compact theme CSS
    layouts/               Lazy-loaded theme styles
  images/                  Icons, social previews, and other shared images
home/
  scripts/                 Root chooser behavior
  styles/                  Root chooser styles
online/
  index.html
  scripts/                 Online desktop feature modules, windows, games, and widgets
    fake-desktop.js        Desktop shell, task manager, action center, and Wi-Fi
    cobits.js              CoBits assistant, initialized by the desktop shell
    achievements.js        Achievement state, persistence, and UI
  styles/                  Online-only styles
nowplaying/
  index.html               Dedicated live presentation of both playback sources
  scripts/                 Fullscreen, controls, session clocks, theme selection
  styles/
admin/
  index.html
  scripts/                 Admin modules and legacy redirect
  styles/
blog/
  index.html
  post.html
  scripts/
boot/
  index.html
  scripts/                 Standalone endless-boot display
professional/
  index.html
  scripts/
  styles/
  resume/
    index.html
    scripts/
    styles/
not-found/
  scripts/                 Root 404 page behavior
useless/
  scripts/                 Root useless.html page behavior
projects/
  index.html
  homelab/index.html
  shortbits/index.html
scripts/                   Node build, validation, test, and maintenance tools
docs/wiki/                 Versioned Wiki sources
supabase/                  Database migrations and server-side functions
agents/                    Optional hardware collectors
extensions/
  youtube-presence/        Locally installed Chromium extension; not a site asset
```

## Entry HTML and public routes

Entry HTML stays at its original route: `index.html`, `404.html`, `admin.html`,
`source.html`, `useless.html`, and each existing page's `index.html`.
This preserves bookmarks, shared window URLs, static-server directory indexes,
the legacy Admin redirect, and the server's configured 404 page.
The `home/`, `not-found/`, and `useless/` folders own assets; they do not move
the corresponding root HTML pages or introduce new page URLs.

There are no shared HTML fragments to move today, so no empty `shared/html/`
folder is maintained. Add it only if a real shared template is introduced.
Likewise, pages without dedicated JavaScript or CSS do not need empty folders.

Use root-absolute asset URLs in HTML, CSS, and dynamically loaded resources:

- `/shared/scripts/theme-init.js`
- `/shared/styles/styles.css`
- `/shared/images/favicon.png`
- `/online/scripts/script.js`
- `/professional/resume/styles/resume.css`

Keep runtime browser scripts separate from the root `scripts/` directory,
which contains Node tooling and is not copied into the public build.

## Generated files and deployment

`node scripts/build-theme-css.mjs` generates `shared/styles/theme-base.css`
from `shared/styles/styles.css`; do not edit the generated file by hand.

The production build copies the public page and shared directories while
excluding tooling, Wiki sources, database sources, dependencies, hardware
agents, and locally installed extensions. It preserves the same asset folder structure as a local static server.
The online optimization step generates `online/styles/site.css` and
`online/scripts/startup.js` only in the build output. Blog article generation,
the printable resume snapshot, URL versioning, and compression remain unchanged.

Asset URLs have moved, but page routes have not. Publish the complete generated
site, not an individual relocated file. Existing deployment behavior retains
older non-article files on the server, which also allows already-open pages to
finish fetching older versioned assets; this reorganization does not add a
destructive cleanup step for those files.

Run the tests and build checks described in
[Development and validation](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki/Development-and-Validation).
The build tests check that route entries and nested runtime assets exist,
root-level JavaScript/CSS are absent, and private tooling stays out of the output.
