# Monitoring

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

`Monitor public site` runs after deployment and approximately every 30 minutes
through GitHub Actions (scheduled runs can be delayed by GitHub). It also supports
manual dispatch. The deployment check requires the live build to match the
deployed commit. Public probes check the main pages and their linked CSS/JS,
build metadata, the publishing snapshot, RSS consistency, up to three static
articles, Spotify and Discord HTTP responses (including stale-data and CORS
failures), and the contact endpoint's OPTIONS preflight.

Checks retry once for transient failures and have a bounded overall request
deadline. Cloudflare Bot Fight Mode challenges hosted runners and does not
support scoped Skip rules. The workflow therefore reuses the production
environment's existing deployment SSH credentials and host-key verification to
run read-only `curl` GET requests to the public HTTPS site from the existing
server. Probe logic stays on the runner; the host needs only SSH and curl, and
the workflow verifies curl without installing tools or persisting probe files.
This checks public CDN URLs from the server's network, not from an independent
external uptime provider; failure to reach the server over SSH also fails the
checks. Cloudflare and CSP remain unchanged. Public integration probes run
directly from GitHub with the configured CORS origin. Checks never submit
contact messages, solve Turnstile, send test emails,
authenticate as an admin, or modify published content. They do not prove email
delivery or browser/WebSocket functionality; browser smoke and performance
checks remain separate.

Failures open one `[Site monitor]` GitHub issue, update that issue while the
outage continues, and close it with a recovery comment once checks pass.
Subscribe to the issue or configure repository issue notifications to receive
alerts; no external alert service is required. The workflow needs Issues enabled
and `issues: write` permission. Health summaries and sanitized reports (not
integration response bodies, activity details, or credentials) are retained for
14 days.

To run the same read-only production probes locally:
`node scripts/monitor-site.mjs --output <report.json>`.
For the workflow's SSH transport, configure `SITE_MONITOR_SSH_TARGET=user@host`,
optional `SITE_MONITOR_SSH_PORT`, and your normal verified SSH key/known-hosts
setup, then add `--ssh`. The deployment workflow and scheduled monitor share the
production environment's SSH secrets; no new credential is published.
The deployment caller explicitly passes only the four required SSH secrets to
the reusable monitor; scheduled and manually dispatched runs use the existing
repository/environment configuration directly.
