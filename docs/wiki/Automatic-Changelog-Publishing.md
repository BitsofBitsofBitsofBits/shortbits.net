# Automatic changelog publishing

This is a disabled-by-default, reviewed release publisher, not an AI author or a schedule. It appends only reviewed, shipped changes after a verified deployment. It does not accept commit messages as release notes, replace Admin editing, or backfill production history.

## Workflow integration contract

The separate workflow integration must:

- Use repository Actions variable `CHANGELOG_AUTO_PUBLISH_ENABLED == 'true'` as an explicit job-level opt-in. Missing or any other value disables it.
- Run only for the trusted production branch/deployment, after **successful** `validate`, `supabase`, `deploy`, `health`, and `lighthouse` jobs. Failed, cancelled, or skipped gates must not publish.
- Use the protected `production` environment with a main-only deployment branch policy; retain any operator-configured reviewer requirements. Give the publishing job only read-only repository access; no Supabase management token, database password, backend API key, Admin login, or GitHub write token.
- Supply environment `CHANGELOG_PUBLISH_URL` (the HTTPS Supabase project endpoint ending in `/functions/v1/changelog-publish`) and protected secret `CHANGELOG_PUBLISH_TOKEN`. Standard `GITHUB_SHA`, `GITHUB_RUN_ID`, and `GITHUB_REPOSITORY` supply deployment context; `GITHUB_SERVER_URL` defaults to `https://github.com` and other GitHub hosts are rejected.
- Run `node scripts/publish-changelog.mjs --file releases/changelog.json` with Node 22.19+ after checkout of the verified SHA. Preserve the existing deployment concurrency/ordering controls so an older deployment cannot publish after a newer one.
- Deploy the optional `changelog-publish` function only **after successful database migrations**, using `--no-verify-jwt`; the function authenticates its own dedicated header. No publishing schedule or new automation service is required.

The publishing client uses only `X-Changelog-Publish-Token`, not cookies, CORS, `Authorization`, or a database credential. Its URL must be a standard `https://<project>.supabase.co/functions/v1/changelog-publish` endpoint. A separate trusted server configuration supplies the fixed database RPC destination. The endpoint checks the full source SHA against the actual `https://www.shortbits.net/build-info.json` with a cache-buster, no redirects, a 10-second timeout, and a 4 KiB response limit. This is an additional live-revision check, not a replacement for workflow gates or protected-environment approval.

Successful responses contain only `ok`, `release_id`, `version`, UTC-compatible `published_at`, allocated `positions`, and `idempotent`. The client prints an ID/version/count, never note text or credentials. Failures are nonzero and sanitized. An ambiguous timeout or invalid response may occur after a successful transaction: retry the **same** reviewed release ID.

## Reviewing release notes and versions

`releases/changelog.json` contains only:

```json
{
  "release_id": "stable-reviewed-release-id",
  "notes": [
    { "title": "A shipped capability", "summary": "Reviewed factual description." }
  ]
}
```

An optional `version` requests a deliberately reviewed change. The initial `changelog-publisher-v1` file requests the small `2.0.1` patch step and covers the approved writer heading/color/link improvements and this publisher's capability. It is eligible only after those features, the migration, function and workflow integration are approved and deployed. It excludes the already-published manual catch-up at positions 31–42 and unrelated Caddy and Unraid work. Do not silently change its ID or notes between retries or deployments; edit notes before the first approved publication. For a genuinely new release, review new notes and a new stable ID in a normal code change. Leaving an already-published file in place is harmless: subsequent deployments return the original receipt without appending or bumping.

Historical evidence: `20261013070500_seed_initial_public_content.sql` established `shortbits.net 1.0`; `20261025020000_release_2_0.sql` appended `shortbits.net 2.0` and `shortbits.net 2.0 - ...`; `20261026070000_recent_changes_changelog.sql` appended unversioned grouped catch-up entries. Numeric ordering, not string ordering, selects the highest established enabled version title or ledger version. Unversioned groups do not reset it; disabled draft titles do not establish it.

By default the publisher reuses that version. It never bootstraps a version if no established version is available. Explicit requests may reuse the current version or advance **exactly one** patch, minor (reset patch), or major (reset minor/patch), e.g. from `2.0`: `2.0.1`, `2.1`, or `3.0`. Backward and skipped versions fail. Components are canonical nonnegative integers up to 9999; `.0` patch is normalized away (`3.0.0` becomes `3.0`). Grouped entries share the effective version, `shortbits.net <version> - <title>` prefix, and the UTC date of publication.

Inputs are revalidated independently at the endpoint and RPC: exact fields/types; release ID 1–100 lowercase letters/digits/dot/underscore/hyphen; 1–20 notes; unique normalized titles 1–80 characters; summaries 1–800 characters; no control characters; full lowercase 40-hex SHA; bounded canonical GitHub Actions run URL. Leading/trailing ASCII spaces in note text are normalized. There are no caller-controlled positions, dates, enabled flags, tables, SQL, or RPC names. Request body limit is 64 KiB; all generated titles fit the existing 120-character schema.

## Secure provisioning — only after separate production approval

Nothing in local implementation or testing authorizes production changes. Keep the opt-in variable absent/false while provisioning.

1. Verify a fresh private database backup and the private ledger recovery method before migration. Review additive migration `20261123130000_changelog_publisher.sql` for the existing authorized migration process. It creates no release entries or production backfill. Keep the existing `site_changelog` schema, RLS, Admin permissions, drafts and timestamps unchanged.
2. On a trusted administrator machine, generate a cryptographically random credential with format `sbcg_` plus 32 random bytes encoded as 64 lowercase hex characters. Use `node:crypto` `randomBytes(32).toString("hex")`. Hash the **entire raw credential**, including `sbcg_`, with SHA-256 (`createHash("sha256").update(token).digest("hex")`). Do not generate it in Actions output or log/echo either value.
3. Store the raw token only as `CHANGELOG_PUBLISH_TOKEN` in the protected GitHub `production` environment. Use the provider's secure secret UI/input; never commit it, put it in a URL/argument, repository variable, public backup, or workflow artifact. Store only its 64-hex hash as `CHANGELOG_PUBLISH_TOKEN_SHA256` in the GitHub `Supabase` environment. When opted in, the existing authenticated Supabase job validates and syncs this hash to the corresponding function secret before migrations; it never receives the raw caller token. A missing or malformed hash fails explicitly.
4. The Edge Function uses server-side `SUPABASE_URL` and existing `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_SECRET_KEYS.default`. A legacy role JWT uses both `apikey` and Bearer headers; modern `sb_secret_...` uses only `apikey`. These keys remain on the server, never in the publishing job. Missing/invalid configuration fails explicitly with 503.
5. Configure the nonsecret endpoint URL for the protected publishing job. After backup, credentials, reviewed input and production enablement are approved, set the repository variable to `true` and run the existing deployment workflow. It applies the migration, deploys `supabase/functions/changelog-publish` with JWT verification disabled only after migration success, then publishes only after all release gates pass.

This credential permits append-only changelog publication through this endpoint, not general database access. It is nevertheless trusted to submit notes for the live revision: do not expose it to pull requests, forks, untrusted build scripts or other environments. The endpoint does not independently authenticate GitHub gate results or verify run ownership. Keep repository review and environment protections in place. Rotation replaces the server hash and the environment token as one coordinated operation; the ledger remains unchanged. Remove/disable opt-in first for emergency revocation, then replace/delete the hash.

## Atomicity, retries and recovery

The RPC runs in one transaction as a `SECURITY DEFINER` with pinned `pg_catalog` search path and fully qualified application tables. Only `service_role` may execute it. The RLS-private `changelog_publications` ledger has no public/anon/authenticated access or policies; the backend role can read but not directly insert/update/delete it. The caller never receives ledger rows, backend secrets or private upstream errors.

Before duplicate lookup or position allocation, the RPC takes `SHARE ROW EXCLUSIVE` on `site_changelog`. This conflicts with ordinary Admin row-writing locks and other publisher calls, so notes and ledger commit together, beyond **all** existing enabled and disabled positions. An error on any row rolls back every new row and the ledger entry. Existing rows, including Admin `updated_at` values, are never rewritten.

The ledger stores immutable normalized notes and optional **requested** version plus the original source SHA, run URL, publication timestamp, effective version and positions. Matching ID/notes/requested version returns the original receipt even on a later deployment; source/run context differences are intentionally ignored for dedupe. Same ID with different normalized notes or requested version returns conflict. Do not create a fresh ID to bypass a conflict or uncertain response.

Admin may subsequently edit, disable or delete public entries. A retry never restores deliberately deleted entries or reverses edits. The ledger still establishes its published version even if those public entries disappear. Positions in an old receipt are historical allocations, not a promise the rows still exist: Admin deletion/reordering may reuse them.

Back up the operational ledger **privately alongside `site_changelog`**, using the authorized database backup process, with access controls, retention and restoration review. Existing editorial/public source backup artifacts must not include this ledger; they are not a complete operational backup. Do not publish raw exports, service credentials or private metadata in site assets, repository releases, workflow logs or public storage.

Restore both tables to a consistent point with publishing disabled and Admin writes paused. Restoring only editorial changelog rows cannot restore dedupe guarantees. Restoring an older ledger while retaining newer changelog entries may allow replay; restoring a newer ledger with older changelog rows intentionally does not recreate missing rows. Reconcile against private backup/receipts before re-enabling. Do not delete ledger entries as routine cleanup: deletion loses dedupe/version history and permits the same ID to append again. An authorized database owner may perform deliberate disaster recovery/deletion only with a reviewed backup and explicit acknowledgement of replay risks. No production ledger backfill is provided.

## Local validation

```powershell
node --test scripts\changelog-publisher.test.mjs scripts\changelog-publisher-db.test.mjs scripts\changelog-release.test.mjs
```

Tests use mocked fetches and in-memory PGlite only, without secrets, deployments, production reads or publications. They cover strict validation, scoped authentication, bounded bodies, live-source failures, fixed RPC/headers and error redaction, client handling, atomic rollback, Admin history/drafts, idempotence/conflicts/deletion, slow versions and role denial. PGlite is single-session: these tests verify transaction behavior, not a multi-session PostgreSQL load/concurrency test. Production lock compatibility follows PostgreSQL table-lock semantics; a separately authorized staging exercise can test concurrent Admin/publisher writes before enablement.
