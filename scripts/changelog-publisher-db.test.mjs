import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20261123130000_changelog_publisher.sql", import.meta.url), "utf8");
const payload = { release_id: "publisher-v1", notes: [{ title: "One", summary: "Reviewed one" }, { title: "Two", summary: "Reviewed two" }],
  source_commit: "a".repeat(40), run_url: "https://github.com/owner/site/actions/runs/123" };
async function withDb(fn) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      grant usage on schema public to anon, authenticated, service_role;
      create table public.site_changelog (
        position integer primary key check (position > 0), entry_date date,
        title text check (title is null or char_length(title) between 1 and 120),
        summary text check (summary is null or char_length(summary) between 1 and 800),
        enabled boolean not null default false, updated_at timestamptz not null default now(),
        check (not enabled or (entry_date is not null and title is not null and summary is not null))
      );
      alter table public.site_changelog enable row level security;
      create policy public_read on public.site_changelog for select to anon using (enabled);
      create policy admin_all on public.site_changelog to authenticated using (true) with check (true);
      grant select on public.site_changelog to anon;
      grant select, insert, update, delete on public.site_changelog to authenticated;
      insert into public.site_changelog values
        (1, '2026-10-13', 'shortbits.net 1.9', 'Original', true, '2026-10-13T12:00:00Z'),
        (2, '2026-10-25', 'shortbits.net 2.0 - Published feature', 'Owner edited', true, '2026-10-25T12:00:00Z'),
        (42, '2026-11-23', 'Grouped manual catch-up', 'Already published; keep', true, '2026-11-23T12:00:00Z'),
        (1000, null, 'shortbits.net 99.0 - Unreleased draft', 'Keep draft', false, '2026-10-14T12:00:00Z');
    `);
    await db.exec(migration);
    await fn(db);
  } finally { await db.close(); }
}
async function publish(db, input = payload) {
  return (await db.query("select public.publish_site_changelog($1::jsonb) as result", [JSON.stringify(input)])).rows[0].result;
}
async function snapshot(db) { return (await db.query("select * from public.site_changelog order by position")).rows; }

test("append preserves all published/manual/draft rows and timestamps, grouping and UTC publication date", async () => withDb(async db => {
  const before = await snapshot(db);
  await db.exec("set timezone = 'Pacific/Honolulu'");
  const output = await publish(db);
  assert.equal(output.version, "2.0");
  assert.equal(output.idempotent, false);
  assert.deepEqual(output.positions, [1001, 1002]);
  const after = await snapshot(db);
  assert.deepEqual(after.slice(0, before.length), before);
  for (const [index, row] of after.slice(before.length).entries()) {
    assert.equal(row.title, `shortbits.net 2.0 - ${payload.notes[index].title}`);
    assert.equal(row.summary, payload.notes[index].summary);
    assert.equal(row.enabled, true);
    const utcDate = (await db.query("select entry_date::text as date from site_changelog where position=$1", [row.position])).rows[0].date;
    assert.equal(utcDate, new Date(output.published_at).toISOString().slice(0, 10));
  }
}));

test("same release is idempotent across deployment contexts, normalized whitespace and later edits/deletion", async () => withDb(async db => {
  const first = await publish(db);
  await db.exec(`set role authenticated;
    update public.site_changelog set summary='Admin edit', updated_at='2026-11-24T12:00:00Z' where position=1001;
    delete from public.site_changelog where position=1002;
    reset role;`);
  const before = await snapshot(db);
  const retry = await publish(db, { ...payload, notes: payload.notes.map(note => ({ title: ` ${note.title} `, summary: ` ${note.summary} ` })),
    source_commit: "b".repeat(40), run_url: "https://github.com/owner/site/actions/runs/999" });
  assert.deepEqual(retry, { ...first, idempotent: true });
  assert.deepEqual(await snapshot(db), before);
  const ledger = (await db.query("select * from public.changelog_publications")).rows;
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].source_commit, payload.source_commit);
  assert.deepEqual(ledger[0].positions, first.positions);
  for (const input of [{ ...payload, notes: [{ title: "Different", summary: "Reviewed" }] }, { ...payload, version: "2.0" }]) {
    await assert.rejects(publish(db, input), error => error.code === "23505");
    assert.deepEqual(await snapshot(db), before);
  }
}));

test("version reuse and only deliberately requested next patch/minor/major; ledger survives removed version titles", async () => withDb(async db => {
  assert.equal((await publish(db)).version, "2.0");
  for (const version of ["1.9.9", "2.0.2", "2.2", "4.0", "3.1", "2.1.1"]) {
    await assert.rejects(publish(db, { ...payload, release_id: `reject-${version}`, version }), error => error.code === "22023");
  }
  for (const [id, version] of [["patch", "2.0.1"], ["minor", "2.1"], ["major", "3.0.0"]]) {
    assert.equal((await publish(db, { ...payload, release_id: id, version })).version, version.replace(/\.0\.0$/, ".0"));
  }
  const explicit = await publish(db, { ...payload, release_id: "explicit", version: "3.0" });
  const retry = await publish(db, { ...payload, release_id: "explicit", version: "3.0.0" });
  assert.deepEqual(retry, { ...explicit, idempotent: true });
  await db.exec("delete from public.site_changelog where enabled");
  assert.equal((await publish(db, { ...payload, release_id: "after-deletion" })).version, "3.0");
  assert.equal((await publish(db)).version, "2.0", "Retry must not adopt a later site's version");
}));

test("numeric version inference, strict historical title convention and no silent bootstrap", async () => withDb(async db => {
  await db.exec("delete from public.site_changelog where enabled");
  for (const version of [undefined, "1.0"]) {
    await assert.rejects(publish(db, { ...payload, ...(version ? { version } : {}) }), error => error.code === "55000");
  }
  await db.exec(`insert into public.site_changelog values
    (1, current_date, 'shortbits.net 2.9.9', 'Old', true, now()),
    (2, current_date, 'shortbits.net 2.10 - Newer', 'New', true, now()),
    (3, current_date, 'shortbits.net 9.0unexpected', 'Not a version title', true, now());`);
  assert.equal((await publish(db)).version, "2.10");
}));

test("DB revalidates keys, types, limits, control text and context independently with no mutation", async () => withDb(async db => {
  const before = await snapshot(db);
  const invalid = [null, [], {}, { ...payload, enabled: false }, { ...payload, positions: [43] }, { ...payload, notes: null },
    { ...payload, notes: [] }, { ...payload, notes: Array(21).fill(payload.notes[0]) }, { ...payload, notes: [null] },
    { ...payload, notes: [{ title: 1, summary: "ok" }] }, { ...payload, notes: [{ title: "ok", summary: null }] },
    { ...payload, notes: [{ title: "a".repeat(81), summary: "ok" }] }, { ...payload, notes: [{ title: "ok", summary: "a".repeat(801) }] },
    { ...payload, notes: [{ title: " ", summary: "ok" }] }, { ...payload, notes: [{ title: "ok", summary: "line\nbreak" }] },
    { ...payload, notes: [{ title: "ok", summary: "\u0085" }] }, { ...payload, notes: [payload.notes[0], payload.notes[0]] },
    { ...payload, notes: [{ ...payload.notes[0], arbitrary: true }] }, { ...payload, release_id: 42 },
    { ...payload, release_id: "../bad" }, { ...payload, source_commit: "short" }, { ...payload, run_url: "https://evil.test" },
    { ...payload, version: null }, { ...payload, version: "02.0" }, { ...payload, version: "2.10000" },
    { ...payload, notes: [{ title: "x".repeat(65_536), summary: "ok" }] }];
  for (const input of invalid) {
    await assert.rejects(publish(db, input), error => error.code === "22023");
    assert.deepEqual(await snapshot(db), before);
  }
  assert.equal((await db.query("select count(*)::int as count from public.changelog_publications")).rows[0].count, 0);
}));

test("failed later append and position overflow roll back the entire publication and ledger", async () => withDb(async db => {
  const before = await snapshot(db);
  await db.exec(`create function public.reject_second() returns trigger language plpgsql as $$
    begin if new.title like '% - Two' then raise exception 'Test failure'; end if; return new; end; $$;
    create trigger reject_second before insert on public.site_changelog for each row execute function public.reject_second();`);
  await assert.rejects(publish(db));
  assert.deepEqual(await snapshot(db), before);
  assert.equal((await db.query("select count(*)::int as count from public.changelog_publications")).rows[0].count, 0);
  await db.exec("drop trigger reject_second on public.site_changelog");
  assert.equal((await publish(db)).idempotent, false);
  await db.exec("insert into public.site_changelog(position) values (2147483647)");
  const atLimit = await snapshot(db);
  await assert.rejects(publish(db, { ...payload, release_id: "overflow" }), error => error.code === "22003");
  assert.deepEqual(await snapshot(db), atLimit);
  assert.equal((await db.query("select count(*)::int as count from public.changelog_publications")).rows[0].count, 1);
}));

test("publisher holds the Admin-conflicting table lock until the transaction ends, including retries", async () => withDb(async db => {
  const first = await publish(db);
  await db.exec("begin");
  try {
    assert.deepEqual(await publish(db), { ...first, idempotent: true });
    const locks = (await db.query(`select mode, granted from pg_locks
      where relation = 'public.site_changelog'::regclass and mode = 'ShareRowExclusiveLock'`)).rows;
    assert.ok(locks.some(lock => lock.granted));
  } finally { await db.exec("rollback"); }
}));

test("schema character limits support Unicode and the maximum reviewed version/title safely", async () => withDb(async db => {
  await db.exec(`insert into public.site_changelog values
    (3, current_date, 'shortbits.net 9999.9999.9999', 'Established boundary version', true, now());`);
  const output = await publish(db, { ...payload, version: "9999.9999.9999", notes: [{ title: "😀".repeat(80), summary: "😀".repeat(800) }] });
  const rows = (await db.query("select char_length(title) as title_length, char_length(summary) as summary_length from site_changelog where position=$1",
    [output.positions[0]])).rows;
  assert.ok(rows[0].title_length <= 120);
  assert.equal(rows[0].summary_length, 800);
}));

test("anon/authenticated cannot invoke publisher or access ledger; service role invokes but cannot mutate ledger", async () => withDb(async db => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(publish(db), error => error.code === "42501");
    for (const sql of ["select * from public.changelog_publications", "delete from public.changelog_publications",
      "update public.changelog_publications set effective_version='9.0'",
      "insert into public.changelog_publications(release_id) values ('bad')"]) {
      await assert.rejects(db.exec(sql), error => error.code === "42501");
    }
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.equal((await publish(db)).ok, true);
  await assert.rejects(db.exec("delete from public.changelog_publications"), error => error.code === "42501");
  await db.exec("reset role");
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.changelog_publications'::regclass")).rows[0].relrowsecurity, true);
}));
