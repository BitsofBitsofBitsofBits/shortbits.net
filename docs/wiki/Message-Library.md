# Message library

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- Valentine's Day, St. Patrick's Day, Easter, Earth Day, Independence Day,
  and Thanksgiving also add seasonal messages without replacing the normal
  pool: each has 16 messages at weight 18 and six activities at weight 12.
  Their share is the seasonal total weight divided by the combined regular
  and seasonal weight; adding/editing messages changes those probabilities.
  Boot messages, live-agent hardware chatter, shutdown text, and desktop
  jokes also get holiday additions through the existing seasonal consumers.
  Existing New Year, Halloween, and Christmas exclusivity is unchanged.
  Bundled fallback dates use the visitor's local calendar, not the selected visual theme;
  when the database catalog is active, its configured timezone governs message dates instead;
  overlapping additive holidays combine. `seasonal-calendar.js` shares
  Gregorian Easter calculation between visual themes and message profiles.
  Run `node --test scripts/holiday-themes.test.mjs scripts/seasonal-messages.test.mjs`
  to validate schedules, complete pool retention, and weighted shares.

- **Admin -> Content -> Message library** manages regular and seasonal status
  messages, activities, shutdown messages, fixed endless-boot messages, initial
  boot steps, playing-dead/glitch messages, and six hardware-monitor joke pools.
  Filter by season and message type, search, page through entries, add/edit/delete,
  enable/hide, adjust positive rarity weights (up to 1000), and preview rainbow
  text and the eight supported style properties. Date rules and exclusive/additive
  seasonal behavior remain in code, as do procedural boot generators, themed
  narratives, game/dialog text, and interface labels.
  Deploy `20261025030000_create_message_catalog.sql` and
  `20261025031000_seed_message_catalog.sql`; the seed preserves all 2,207 current
  entries, including local additions, weights, formatting, and duplicate entries.
  It is a one-time snapshot, not a deploy-time overwrite of Admin edits.
  `messages.js`, `seasonal-messages.js`, and the existing local boot/monitor
  definitions remain bundled fallbacks. Empty enabled pools use their bundled
  defaults rather than breaking weighted selection; deleting/hiding an entire
  pool does not disable that feature. Edit the database through Admin going forward.
  `message-catalog.js` keeps existing consumer arrays live, applies a valid cached
  snapshot immediately, and fetches active season/standard entries in 500-row pages
  in the background after startup. Cached data lasts five minutes; reload/refocus
  refreshes expired data. Network/schema failures log a warning and retain cached
  or bundled data. The initial automatic boot never waits for the network; a
  running sequence finishes unchanged and later replays use updated messages.
  Run `node --test scripts/message-catalog.test.mjs scripts/message-catalog-database.test.mjs`
  and `node scripts/messages-browser.mjs --root .site-build` for regression coverage.
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
  Under **Scheduled pools**, create, rename, disable, or delete custom pools,
  then select them in **Season / profile** to manage their messages in **Messages**.
  **Calendar** contains the timezone settings. Switching these subsections keeps
  drafts intact and the pool selector remains available throughout.
  Pool deletion atomically removes all associated messages, including hidden ones.
  Built-in holiday definitions remain available and are not deleted by this UI.
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
