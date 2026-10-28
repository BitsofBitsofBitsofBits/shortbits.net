# Message library

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- Valentine's Day, St. Patrick's Day, Easter, Earth Day, Independence Day,
  and Thanksgiving also add seasonal messages without replacing the normal
  pool: each has 16 messages at weight 18 and six activities at weight 12.
  Their share is the seasonal total weight divided by the combined regular
  and seasonal weight; adding/editing messages changes those probabilities.
  Boot messages, live-agent hardware chatter, shutdown text, and desktop
  jokes also get holiday additions through the existing seasonal consumers.
  New Year, Halloween, and Christmas are exclusive by default; pool settings can override this.
  Bundled fallback dates use the visitor's local calendar, not the selected visual theme;
  when the database catalog is active, its configured timezone governs message dates instead;
  overlapping additive holidays combine. `shared/scripts/seasonal-calendar.js` shares
  Gregorian Easter calculation between visual themes and message profiles.
  Run `node --test scripts/holiday-themes.test.mjs scripts/seasonal-messages.test.mjs`
  to validate schedules, complete pool retention, and weighted shares.

- **Admin -> Content -> Message library** manages regular and seasonal status
  messages, activities, shutdown messages, fixed endless-boot messages, initial
  boot steps, playing-dead/glitch messages, and six hardware-monitor joke pools.
  Filter by season, message type, and entry status (**All entries**, **Enabled only**,
  or **Disabled only**), search, page through entries, add/edit/delete,
  enable/hide, adjust positive rarity weights (up to 1000), and preview rainbow
  text and the eight supported style properties. Built-in automatic date rules
  remain in code but can be overridden in Scheduled pools, along with exclusive/additive
  behavior and enablement. Procedural boot generators, themed
  narratives, game/dialog text, and interface labels remain code-defined.
  **Endless boot / fixed messages** lists editable fixed entries, not the total
  number of possible lines. The procedural generator combines **29 actions x
  37 subjects x 30 results/statuses = 32,190 combinations**, in addition to fixed,
  phase, theme, narrative, and event lines. `shared/scripts/boot-message-generator.js`
  supplies both the public generator and Admin's counts so they cannot drift.
  The generator components are defined in code, not editable database entries.
  Admin labels pagination/counts as fixed entries (filtered by status and search;
  All entries includes disabled entries), and explains that additive pools contribute fixed lines
  while a nonempty active exclusive boot pool replaces the normal fixed/generated
  mix. The initial boot steps are a separate, non-procedural category.
  Status filtering applies to the database query before pagination, so totals
  reflect all matching entries rather than just the current page. Changing status
  resets pagination and clears bulk selection, with the usual unsaved-change
  confirmation. Enabling/disabling entries refreshes the filtered list, removing
  entries that no longer match.
  Status messages also support an optional **Author** (plain text, up to 200
  characters) after applying `20261026030000_message_authors.sql`. Use it to
  attribute real quotations. Admin previews the attribution and allows it to be
  edited or removed by clearing the field. Other message types do not expose it.
  On Online, an attributed message shows a separate author box below the quote:
  both type concurrently, the hold starts only after both finish, and both
  backspace together before the next message. Unicode names are grapheme-safe;
  names are always literal text, even when the quote uses inline markup.
  Authors survive Mistype correction, status history, scheduled pools, and cached
  catalog reloads. Unattributed messages hide and clear the author box.
  Export a fresh content backup after this migration: backups from before the
  `author` column was added fail the existing exact-schema restore validation.
  Deploy `20261025030000_create_message_catalog.sql` and
  `20261025031000_seed_message_catalog.sql`; the seed preserves all 2,207 current
  entries, including local additions, weights, formatting, and duplicate entries.
  It is a one-time snapshot, not a deploy-time overwrite of Admin edits.
  `shared/scripts/messages.js`, `shared/scripts/seasonal-messages.js`, and the existing local boot/monitor
  definitions remain bundled fallbacks. Empty enabled pools use their bundled
  defaults rather than breaking weighted selection; deleting/hiding an entire
  pool does not disable that feature. Edit the database through Admin going forward.
  `shared/scripts/message-catalog.js` keeps existing consumer arrays live, applies a valid cached
  snapshot immediately, and fetches active season/standard entries in 500-row pages
  in the background after startup. Cached data lasts five minutes; reload/refocus
  refreshes expired data. Network/schema failures log a warning and retain cached
  or bundled data. The initial automatic boot never waits for the network; a
  running sequence finishes unchanged and later replays use updated messages.
  Run `node --test scripts/message-catalog.test.mjs scripts/message-catalog-database.test.mjs`
  and `node scripts/messages-browser.mjs --root .site-build` for regression coverage.
  Add `--screenshots <directory>` to capture desktop/mobile toolbar previews
  in both Admin appearances.
  All message-library types support live data placeholders in **Message text**,
  including seasonal/scheduled messages and **Corrected text**. No database
  migration or extra markup toggle is needed. Templates stay unchanged in the
  database, cache, editor, and backups; values resolve only in the visitor's browser.
  Expand **Live data placeholders** in the editor for the full list and descriptions.
  The compact toolbar above the message text has **Date**, **Day**, **Time**, and
  **Browser** insertion buttons, plus a **More placeholders** dropdown and
  **+ Insert** button for the complete list. Insertions replace the selection or
  insert at the caret in the last-focused message/corrected-text field, return
  focus there, and leave inline markup unchanged. The toolbar identifies its
  current target. All actions respect the 2,000-character limit and unsaved-change
  protection. Compact style/color buttons and **Font family** / **Font size**
  dropdowns apply safe markup to the selection; these enable markup automatically.
  Font, size, and color directives can be nested to combine styles on the same text.
  The controls wrap on smaller screens and follow Admin's light/dark appearance.
  The font dropdown is shared with the blog editor and supports 24 choices:
  Default (site theme), Serif, Sans serif, Monospace, Display, System UI,
  Arial, Helvetica, Verdana, Tahoma, Trebuchet MS, Segoe UI, Georgia,
  Times New Roman, Palatino, Garamond, Cambria, Courier New, Consolas,
  Menlo, Monaco, Impact, Arial Narrow, and Comic Sans MS.
  These use installed system fonts with fallback stacks, not external font downloads.
  Appearance can vary by visitor device if the requested font is unavailable.
  Use the dropdown or type an allowlisted directive such as
  `{{font:verdana|words}}`, `{{font:times-new-roman|words}}`, or
  `{{font:comic-sans|words}}`. Existing font identifiers remain unchanged.
  Choose **Custom...** at the bottom of either editor's font dropdown to enter an
  installed font family or comma-separated fallback stack, then **Apply font**.
  For example, `Aptos, Arial, sans-serif` inserts
  `{{font:custom:"Aptos", "Arial", sans-serif|selected words}}`.
  The input accepts up to 200 characters (including normalized quotes) using
  letters, numbers, spaces, underscores, and hyphens in family names; matching
  single/double quotes around names are accepted. CSS rules, URLs, CSS-wide
  keywords, functions, and markup are rejected with an explicit editor error.
  Custom fonts do not upload or download files and are not added to the preset
  list. Visitors need the font installed; otherwise their browser uses the
  specified fallback stack. Custom styles survive previews, saved templates,
  corrections, typewriter truncation, and blog rendering.

  **Whole-message settings** now lives inside the top toolbar for statuses and
  activities; there is no separate bottom **Weight and appearance** section.
  Weight and **Rainbow characters (whole message)** remain immediately available.
  Expand **Whole-message style defaults** for text color, font weight, font
  family (including installed custom names/stacks), font size, font style,
  letter spacing, text decoration, and text transform. These retain the existing
  saved `format` fields and affect the entire message/correction, independently
  of the selected-text formatting controls. Clearing a value removes that default.
  Other message types still support inline formatting/custom fonts but do not
  expose weighted-only settings. No database migration or backup schema change
  is needed.

  | Placeholder | Value |
  | --- | --- |
  | `%currentdate%`, `%date%` | Localized date, such as Oct 26, 2026 |
  | `%day%` | Full localized weekday name, such as Monday |
  | `%time%` | Localized time including seconds |
  | `%year%`, `%month%`, `%dayofmonth%` | Four-digit year, full localized month name, numeric day |
  | `%hour%`, `%minute%`, `%second%` | Two-digit local clock parts; hour is 00-23 |
  | `%timezone%` | Visitor's IANA timezone, when available |
  | `%useragent%`, `%browser%` | Friendly browser type, not a raw user-agent string |
  | `%os%` | Operating system |
  | `%language%` | Browser language, such as en-US |
  | `%hostname%` | Current site's hostname |

  For example, `Happy %day%! It's %time% and you're using %useragent%.`
  Names are case-insensitive; unknown placeholders remain visible as typed.
  Write `%%time%%` to display the literal text `%time%` (or `%%` for a percent sign).
  Dates and times use the **visitor's local timezone and locale**, independently
  of the catalog's scheduling timezone. Each message occurrence captures one
  snapshot: values do not tick during typing, holding, deletion, or mistype
  correction. Selecting the message again captures fresh values; navigating
  splash history or reading an old boot-log line preserves its original snapshot.
  Hardware chatter refreshes its snapshot on its existing six-second rotation,
  not on every telemetry update. Admin previews capture fresh values on edits,
  using the admin's browser, with one shared snapshot for the original/correction.
  Attribution remains literal plain text.

  Placeholders work inside safe inline formatting, such as `**%day%**` or
  `{{color:rainbow|%browser%}}`. Replacement values are inserted as text after
  parsing authored markup, so browser data cannot introduce HTML or formatting.
  No additional network requests or browser identification services are used.
  Browser/OS detection is best-effort: Client Hints are used when available,
  with user-agent fallback; privacy restrictions may produce a generic name or
  `Unknown browser` / `Unknown OS`. Other unavailable values display
  `Unknown language`, `Unknown host`, or `Unknown timezone`, respectively.

  Each entry also has **Enable inline markup**, off by default so existing text
  stays literal. After deploying `20261025032000_message_inline_markup.sql`,
  style selected words with `**bold**`, `*italic*`, `++underline++`, `~~strike~~`,
  backtick code, `{{color:red|words}}`, or `{{color:rainbow|words}}`.
  The existing blog palette/font/size names also work, for example
  `{{font:serif|words}}` and `{{size:large|words}}`. Formatting buttons wrap the
  selected text and the live preview uses the public renderer. All library
  categories support markup; optional whole-message defaults still apply to
  statuses/activities. The typewriter counts rendered graphemes, not delimiters,
  and preserves styling while typing/deleting. Raw HTML, links, images, and
  block markup are not enabled for messages. Export a fresh backup after this
  migration; backups without the new `markup` column fail exact-schema validation.
  Run `node --test scripts/message-text.test.mjs scripts/startup-formatting.test.mjs`
  to verify safe inline rendering, Unicode, and plain-text compatibility.
  Splash/status entries also support **Mistype** with a **Corrected text** field
  after deploying `20261025033000_message_mistype_corrections.sql`. Enter the
  misspelled message as the message text and a different, nonblank corrected
  version (up to 2,000 characters). After typing the original, the splash briefly
  rewinds to the first differing character, displays the correction, and unlocks
  the existing Mistyped achievement. Both versions share the inline markup flag
  and whole-message defaults; Admin previews both, and the formatting toolbar
  works on whichever text field was last focused. This is limited to the
  splash/status type, not activities, boot logs, or other non-typewriter pools.
  Turning the toggle off saves a null `corrected_text`; existing messages remain
  unchanged and the rare built-in typo continues to appear independently.
  Corrections are cached and included in content backups. Export a fresh backup
  after deployment; earlier backups lack the new column and fail schema validation.
  After `20261025034000_scheduled_message_pools.sql`, each message row has explicit
  **Edit** (expands an editor directly beneath that message and focuses it) and
  **Delete** actions. **Add message** expands the same shared editor above the list;
  click the expanded toggle again or **Close editor** to collapse it. Only one
  editor is open at a time. Switching rows, changing pages/filters/search, closing,
  or reloading confirms before discarding a message draft. Leaving the page with
  unsaved message, pool, or calendar changes triggers the browser's unload warning.
  Select individual rows or **Select page**, then **Enable selected**,
  **Disable selected**, or **Delete selected**. Actions confirm the selected count
  and affect only explicit IDs in the current pool/type on the current page
  (at most 25 messages). Paging, filters/search, or reload clears selection.
  Failed writes retain selection for retry; concurrent removals are reported with
  the actual affected count rather than complete-success feedback. Deletion is
  permanent; disabling retains entries for editing.
  Under **Scheduled pools**, select any existing built-in or custom pool in
  **Existing pool**, or use **Edit pool settings** beside **Season / profile**.
  View or change the pool name, schedule, exclusive/additive behavior, and enabled
  state. The selectors stay synchronized; use **Messages** to edit that pool's entries.
  **+ New pool** creates a custom pool.
  **Calendar** contains the timezone settings. Switching these subsections keeps
  drafts intact and the pool selector remains available throughout.
  Custom pool deletion atomically removes all associated messages, including hidden ones.
  After applying `20261028070000_builtin_message_pool_settings.sql`, built-in pools
  can also have saved overrides. They default to **Automatic built-in dates**,
  preserving moving holidays such as Gregorian Easter, the fourth Thursday of
  November, and every Friday the 13th. The editor displays the actual matching
  dates for the current year in the configured calendar timezone, alongside the
  original rule and current enabled/behavior/schedule settings. New Year's
  year-wrap and leap-day years are included; years with no dates say so explicitly.
  Choose fixed annual or one-time dates to **replace**, not add to, a built-in rule.
  Automatic schedules do not store start/end dates. Disabling a built-in pool
  suppresses its automatic or fixed schedule, without deleting its messages.
  **Restore built-in defaults** removes only its saved override, restoring the
  original dates, name, mode, and enabled state while retaining every edited message.
  Built-in pools cannot be deleted. **Standard / year-round** remains the permanent
  fallback: its settings are read-only, but its messages remain editable.
  Message pool overrides never change the separate visual seasonal-theme schedules.
  Schedules support inclusive one-time dates/ranges and annually recurring
  month/day ranges, including December-to-January wrapping and February 29.
  For annual ranges the years in the date inputs are ignored; a blank end means
  a single day. New pools start disabled until explicitly enabled.
  Active additive pools mix with standard messages. When exclusive pools overlap,
  all matching exclusive pools (including built-in holidays) combine and suppress
  standard/additive entries for message types they populate. Empty exclusive
  message types retain standard/bundled content so boot, monitor, and typewriter
  features never receive empty arrays.
  The configurable IANA timezone defaults to `America/Chicago` (Central Time,
  including daylight saving) and governs both built-in and custom message dates
  for every visitor. Settings and definitions load in the background with the
  catalog; cached configuration applies immediately on later visits. An open,
  visible page checks for a calendar-day change once a minute. Outages retain the
  previous complete cached catalog/configuration or bundled fallbacks.
  Browsers with native Temporal convert timezone dates without initializing
  locale formatting during startup; older browsers use a cached Intl formatter.
  Background refresh yields between response processing, atomic application, and
  cache persistence so these stages do not form one long input-blocking task.
  Pools/settings are included in content backups, with definitions restored before
  their messages. Export a new backup after deploying this migration; older
  backups do not have the two new tables.
  Built-in overrides reuse the existing pool table and backup column shape;
  no new backup table is needed. Restore backups containing `automatic` schedules
  only after applying the built-in settings migration. Disabled built-in overrides
  are public so visitor browsers can honor disablement; disabled custom pools and
  their messages remain private. Browsers without cached configuration temporarily
  use the bundled rules until settings load. Validate overrides with
  `node --test scripts/builtin-pools.test.mjs scripts/message-catalog.test.mjs scripts/message-catalog-database.test.mjs scripts/content-backup-database.test.mjs`
  and the desktop/mobile `messages-browser.mjs` checks.
