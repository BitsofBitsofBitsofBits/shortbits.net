# Development and validation

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

## Local static server

The public site is dependency-free. Serve the directory with any static server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly also works for most development, but a local HTTP
server more closely matches production behavior.

## Validation and production builds

Use Node 22.19 or later, then:

```powershell
npm ci --ignore-scripts
npm test
npm run validate
npm run build
node scripts/validate-site.mjs --root .site-build
npx playwright install chromium
npm run test:browser
node scripts/resume-browser.mjs --root .site-build
node scripts/hardware-layout-browser.mjs --root .site-build
node scripts/creators-browser.mjs --root .site-build
node scripts/media-player-browser.mjs --root .site-build
node scripts/nowplaying-browser.mjs --root .site-build
node scripts/youtube-extension-browser.mjs
node scripts/aero-variants-browser.mjs --root .site-build
node scripts/theme-collection-browser.mjs --root .site-build
node scripts/theme-picker-browser.mjs --root .site-build
node scripts/pride-themes-browser.mjs --root .site-build
node scripts/desktop-workspaces-browser.mjs --root .site-build
node scripts/messages-browser.mjs --root .site-build
node scripts/critical-css-browser.mjs --root .site-build
npm run audit
```

The unpacked-extension check requires Playwright's bundled Chromium rather
than branded Chrome. CI explicitly installs it with
`npx playwright install --with-deps chromium`. The extension check uses real
extension contexts with fixture YouTube playback and intercepted service
responses; it does not publish personal viewing data.

Message-browser snapshot assertions pause only the `updateMessage` timer chain
while reading quote and author text, including after cached reloads and
Mistype correction. Tests advance deletion ticks explicitly, avoiding a race
where animation erases the final Unicode grapheme before an assertion.
Other live widgets and production animation behavior are unchanged.

Local and post-deployment Lighthouse audits share `scripts/audit-site.mjs`.
For live checks, run
`node scripts/audit-site.mjs --url https://www.shortbits.net --enforce`.
Each page/device audit gets at most three attempts, but only for the observed
`NO_NAVSTART` trace-recording error or Chrome's `Target.getTargetInfo` missing-session
crash. Each retry starts a fresh Lighthouse process and waits briefly. Low measured
scores, page errors, and other failures are not retried. The existing performance
(90), accessibility/SEO (100), LCP (2.5 seconds), and CLS (0.1) budgets remain enforced.
Original reports and saved traces are retained under `lighthouse-reports/attempts/`;
the summary uses only the final reports at the directory root. Missing scores are
shown as `N/A`, and exhausted runner retries still fail the job. Pre-deployment
budgets and the separate deployed-site health checks remain enabled.

`npm run build` requires an empty output directory, copies only public site
assets, fetches published posts and enabled public career data, generates static content, versions local CSS/JS
URLs, and writes Brotli/gzip sidecars. Public Supabase configuration is read from
`shared/scripts/supabase-config.js`; optional `SUPABASE_URL` and `SUPABASE_ANON_KEY` overrides
must be public credentials, never service-role secrets. Failed content fetches
fail the build rather than deploying an empty archive or an incomplete resume snapshot.

The printable resume is rendered during deployment using the same DOM renderer
as the browser, so its saved content is visible immediately, including without
JavaScript or with slow/unavailable live data. Background checks bypass the
five-minute shared cache. New data is applied only after clicking "Update resume";
printing always uses the version currently visible. Failed or incomplete checks
leave the saved version intact and display an explicit status. Email and phone
links remain runtime-only and are not injected into the generated HTML.
The focused resume browser check verifies two-page PDF output with six
representative career entries, long headlines, aligned contact details and
dates, section-heading break rules, and preserved mobile screen styling.
It runs at mobile/desktop widths with JavaScript enabled and disabled.

Styles are minified with esbuild only in the staged output; source stylesheets
remain unchanged for authoring. The online page's four shared stylesheets are
bundled in their original cascade order into one stylesheet. A smaller, generated
subset for initially visible content and boot controls is inlined so first paint
does not wait for desktop, game, and Admin rules. The full stylesheet downloads
without blocking the initial render; interactive controls wait for it to load,
with explicit failure/timeout reporting. A noscript stylesheet preserves the
non-JavaScript view. Browser checks compare first-paint and fully loaded styles
across standard themes and color schemes. The printable
resume's minified CSS is inlined (including print rules), with an 8 KiB build
limit to prevent unbounded HTML growth. Both validation and deployment install
the pinned build dependencies with `npm ci --ignore-scripts`.
The online page's calendar, initial theme, and boot scripts are concatenated
in their original order and minified into one blocking startup request.
They remain classic scripts with shared globals, not isolated modules.

For an offline content build, use
`node scripts/build-site.mjs --output <empty-directory> --input scripts/fixtures/blog-posts.json`.
This also uses `scripts/fixtures/resume-data.json` for the career snapshot;
override it with `--resume-input <fixture.json>` when testing other resume data.
Pass that directory to validation, browser smoke, and `scripts/audit-site.mjs`
with `--root`. On Windows with Edge installed, set
`$env:BITS_BROWSER_CHANNEL = "msedge"` for browser smoke and
`$env:CHROME_PATH = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`
for Lighthouse. Browser smoke uses mocked live services and never sends
messages, publishes content, or modifies production data; real third-party
integrations still require deployment-time verification.

The online About clock creates its timezone formatters only while its desktop
window is visible, rather than doing expensive timezone initialization at startup
or updating a hidden clock every second. Opening it or restoring visibility
refreshes the clock immediately.
The online build tooltip uses an unambiguous UTC timestamp without initializing
locale/date formatting during startup; malformed timestamps are reported rather
than displayed as a successful deployment label.
The fixed uppercase ASCII theme catalog is sorted without locale initialization.
Tests verify identical alphabetical ordering across the complete catalog.

To compare source and optimized online styles across the theme catalog at
mobile and desktop widths, run
`node scripts/style-optimization-browser.mjs --root <build-directory>`.
This offline check waits for experimental layout assets and uses reduced motion
to avoid differences caused by adaptive frame-rate detection.

The local mobile online-page audit and all production mobile audits retain their
Lighthouse traces and DevTools network logs in the report artifact to diagnose
runner-specific blocking tasks.
Validation pins Ubuntu 24.04 and uses the runner's preinstalled Chrome for
browser checks. Failed performance budgets also log a sampled startup CPU
profile; this diagnostic does not change or bypass the performance gate.
To profile the deployed page directly and retain raw CPU samples, run
`node scripts/profile-startup.mjs --url https://www.shortbits.net/online/ --output startup.cpuprofile`.
Omit `--url` and use `--root <build-directory>` to profile a staged build instead.

## Maintaining this Wiki

The versioned Wiki sources live in [`docs/wiki/`](https://github.com/BitsofBitsofBitsofBits/shortbits.net/tree/main/docs/wiki).
Edit those files with the site documentation, then publish their Markdown files
to the separate [GitHub Wiki repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net.wiki.git). The site deployment
workflow does not publish Wiki changes.

To publish an update from the repository root, clone the Wiki into a separate
directory outside the source checkout, copy the source pages, review, commit,
and push:

```powershell
git clone https://github.com/BitsofBitsofBitsofBits/shortbits.net.wiki.git ..\shortbits-wiki
Copy-Item -Path .\docs\wiki\*.md -Destination ..\shortbits-wiki
git -C ..\shortbits-wiki diff --check
git -C ..\shortbits-wiki diff --stat
git -C ..\shortbits-wiki add -- "*.md"
git -C ..\shortbits-wiki commit -m "Update site documentation"
git -C ..\shortbits-wiki push
```

Use an existing Wiki clone instead of cloning again for later updates, and pull
it before copying. Review any conflicts with direct Wiki edits before publishing.
When removing or renaming a page, explicitly remove its old file from the Wiki
clone too; copying files alone does not remove retired pages. Keep Home and the
sidebar in sync with page names. Publish new source commits before relying on
their source links from the Wiki.
