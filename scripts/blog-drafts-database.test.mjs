import test from "node:test";
import assert from "node:assert/strict";
import { database, rpc, save, publish, snapshot, nonce, liveFixture, raw, future } from "./blog-drafts-db-helper.mjs";

const conflict = error => error.code === "40001";
test("private incomplete autosave, immutable public metadata, explicit publish and real role boundaries", async () => {
  const db = await database();
  try {
    let blank = await rpc(db, "load_blog_draft");
    assert.equal((await db.query("select * from site_blog_drafts")).rows.length, 0);
    const incomplete = snapshot({ title: "", slug: "", excerpt: "", body_markdown: "" });
    let state = await save(db, blank, incomplete);
    assert.equal(state.post_id, null);
    assert.equal((await db.query("select * from site_blog_posts")).rows.length, 0);
    await assert.rejects(publish(db, state), /Incomplete publication/);
    await assert.rejects(db.query("update site_blog_drafts set revision=20"), /permission denied/);
    await assert.rejects(db.query("delete from site_blog_draft_history"), /permission denied/);
    await assert.rejects(db.query("insert into site_blog_posts(slug,title,excerpt,body_markdown) values('bad-client','bad','bad','bad')"), /permission denied/);
    state = await save(db, state, snapshot({ body_rich: { version: 1, doc: { type: "doc", content: [] } } }));
    state = await publish(db, state);
    assert.equal(state.post_id, blank.draft_id);
    assert.equal(state.live.published, true);
    assert.equal(state.has_unpublished_changes, false);
    const before = await raw(db, state.post_id);
    state = await save(db, state, snapshot({ title: "Private title", slug: "private-slug" }));
    assert.deepEqual(await raw(db, state.post_id), before);
    assert.equal(state.has_unpublished_changes, true);
    await assert.rejects(rpc(db, "delete_blog_draft", [state.draft_id, state.version]), /explicit public-post deletion/);
    await db.exec("set role anon");
    for (const table of ["site_blog_drafts", "site_blog_draft_history"]) {
      await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    }
    for (const [name, args] of [
      ["load_blog_draft", []], ["save_blog_draft", [state.draft_id, state.version, null, snapshot(), nonce(), false]],
      ["publish_blog_draft", [state.draft_id, state.version, nonce(), state.live.updated_at, false]],
      ["list_blog_draft_history", [state.draft_id]], ["get_blog_draft_revision", [state.draft_id, nonce()]],
      ["restore_blog_draft_revision", [state.draft_id, nonce(), state.version, nonce()]],
      ["cancel_blog_draft_schedule", [state.draft_id, state.version, nonce()]],
      ["unpublish_blog_draft", [state.draft_id, state.version, nonce()]],
      ["delete_blog_draft", [state.draft_id, state.version]], ["list_blog_editor_entries", []],
      ["blog_editor_lock", []],
    ]) await assert.rejects(rpc(db, name, args), /permission denied/);
    assert.equal((await db.query("select title,slug from site_blog_public_posts")).rows[0].title, before.title);
    await db.exec("set role authenticated");
    state = await publish(db, state);
    assert.equal((await raw(db, state.post_id)).title, "Private title");
    const entries = await rpc(db, "list_blog_editor_entries");
    assert.equal(entries[0].id, state.draft_id);
    assert.equal(entries[0].snapshot.body_markdown, "Original **Markdown**");
    for (const field of Object.keys(state).filter(field => field !== "request_id")) {
      assert.ok(Object.hasOwn(entries[0], field), `editor entry includes ${field}`);
    }
    let privateOnly = await save(db, await rpc(db, "load_blog_draft"), incomplete);
    await rpc(db, "delete_blog_draft", [privateOnly.draft_id, privateOnly.version]);
    await assert.rejects(rpc(db, "load_blog_draft", [privateOnly.draft_id]), /not found/);
  } finally { await db.close(); }
});

test("tokens and receipts reject stale/out-of-order writes; original public anchor requires checked acknowledgement", async () => {
  const db = await database();
  try {
    const blank = await rpc(db, "load_blog_draft");
    const request = nonce();
    const first = await save(db, blank, snapshot(), request);
    assert.deepEqual(await save(db, blank, snapshot(), request), first);
    await assert.rejects(save(db, blank, snapshot({ title: "Different" }), request), conflict);
    const race = await Promise.allSettled([
      save(db, first, snapshot({ title: "Winner" })),
      save(db, first, snapshot({ title: "Loser" })),
    ]);
    assert.equal(race.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(race.find(r => r.status === "rejected").reason.code, "40001");
    await assert.rejects(save(db, blank, snapshot(), request), conflict);
    let state = await rpc(db, "load_blog_draft", [blank.draft_id]);
    const pubRequest = nonce();
    const old = state;
    state = await publish(db, old, pubRequest);
    assert.deepEqual(await publish(db, old, pubRequest), state);
    await assert.rejects(publish(db, old, pubRequest, true), conflict);
    // Simulate a legacy public post that had no head at load.
    await db.exec("reset role");
    await db.query("delete from site_blog_drafts where id=$1", [state.post_id]);
    await db.exec("set role authenticated");
    const loaded = await rpc(db, "load_blog_draft", [state.post_id]);
    await db.exec("reset role");
    await db.query("update site_blog_posts set title='Changed live',updated_at=updated_at+interval '1 second' where id=$1", [state.post_id]);
    await db.exec("set role authenticated");
    state = await save(db, loaded, snapshot({ title: "My revision" }));
    assert.equal(state.base_public_version, loaded.base_public_version);
    await assert.rejects(publish(db, state), conflict);
    await assert.rejects(publish(db, state, nonce(), true, loaded.base_public_version), conflict);
    state = await publish(db, state, nonce(), true);
    assert.equal(state.live.title, "My revision");
    // Public deletion cascades and must never become a private new draft.
    await db.query("delete from site_blog_posts where id=$1", [state.post_id]);
    await assert.rejects(save(db, state, state.snapshot), conflict);
    await assert.rejects(save(db, { ...loaded, version: null }, loaded.snapshot), conflict);
    assert.equal((await db.query("select * from site_blog_draft_history")).rows.length, 0);
  } finally { await db.close(); }
});

test("approved future revisions retain live content; due/cancel/replacement, new scheduling and slug reservations", async () => {
  const db = await database();
  try {
    let state = await liveFixture(db);
    const base = await raw(db, state.post_id);
    const later = await future(db);
    state = await save(db, state, snapshot({ title: "Approved future", slug: "future-slug", published_at: later }));
    state = await publish(db, state);
    assert.deepEqual(await raw(db, state.post_id), base);
    assert.equal(state.scheduled_at !== null, true);
    assert.equal(state.has_unpublished_changes, false);
    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_blog_approved_revisions")).rows.length, 0);
    assert.equal((await db.query("select title from site_blog_public_posts")).rows[0].title, base.title);
    await db.exec("set role authenticated");
    const scheduled = (await db.query("select to_jsonb(a) as row from site_blog_approved_revisions a")).rows[0].row;
    state = await save(db, state, snapshot({ title: "Unapproved private", published_at: later }));
    const history = await rpc(db, "list_blog_draft_history", [state.draft_id]);
    state = await rpc(db, "restore_blog_draft_revision", [state.draft_id, history.at(-1).id, state.version, nonce()]);
    assert.deepEqual((await db.query("select to_jsonb(a) as row from site_blog_approved_revisions a")).rows[0].row, scheduled);
    let collision = await save(db, await rpc(db, "load_blog_draft"), snapshot({ slug: "future-slug" }));
    await assert.rejects(publish(db, collision), /slug reserved/);
    const beforeCancel = state, cancelNonce = nonce();
    state = await rpc(db, "cancel_blog_draft_schedule", [state.draft_id, state.version, cancelNonce]);
    assert.deepEqual(await rpc(db, "cancel_blog_draft_schedule", [beforeCancel.draft_id, beforeCancel.version, cancelNonce]), state);
    assert.equal(state.scheduled_at, null);
    assert.deepEqual(await raw(db, state.post_id), base);
    state = await save(db, state, snapshot({ title: "Now approved", slug: "future-slug", published_at: later }));
    state = await publish(db, state);
    // Advance only the synthetic approved record's clock, never real records.
    await db.exec("reset role");
    await db.query("update site_blog_approved_revisions set published_at=now()-interval '1 minute' where id=$1", [state.post_id]);
    await db.exec("set role anon");
    assert.equal((await db.query("select title,slug from site_blog_public_posts")).rows[0].title, "Now approved");
    await db.exec("set role authenticated");
    state = await rpc(db, "load_blog_draft", [state.draft_id]);
    const effective = state.live;
    state = await save(db, state, snapshot({ title: "Next future", slug: "next-future", published_at: later }));
    await assert.rejects(publish(db, state), conflict);
    state = await publish(db, state, nonce(), true);
    assert.equal((await raw(db, state.post_id)).title, "Now approved");
    assert.equal(Date.parse((await raw(db, state.post_id)).updated_at), Date.parse(effective.updated_at));
    await db.exec("set role anon");
    assert.equal((await db.query("select slug from site_blog_public_posts")).rows[0].slug, "future-slug");
    await db.exec("set role authenticated");
    state = await save(db, state, snapshot({ title: "Immediate", slug: "immediate-slug" }));
    state = await publish(db, state);
    assert.equal((await db.query("select * from site_blog_approved_revisions")).rows.length, 0);
    let newScheduled = await save(db, await rpc(db, "load_blog_draft"), snapshot({ slug: "new-scheduled", published_at: later }));
    newScheduled = await publish(db, newScheduled);
    assert.equal(newScheduled.live.published, false);
    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_blog_public_posts")).rows.length, 1);
    await db.exec("set role authenticated");
    newScheduled = await rpc(db, "cancel_blog_draft_schedule", [newScheduled.draft_id, newScheduled.version, nonce()]);
    assert.equal((await raw(db, newScheduled.post_id)).published, false);
    // Deleted slug can be recreated by a fresh identity, never by a stale tab.
    await db.query("delete from site_blog_posts where id=$1", [state.post_id]);
    await assert.rejects(publish(db, state), conflict);
    const recreated = await liveFixture(db, { slug: "immediate-slug" });
    assert.notEqual(recreated.post_id, state.post_id);
    // Privileged unpublication must hide an approved snapshot as well.
    let pending = await save(db, recreated, snapshot({ slug: "reserved-hidden", published_at: later }));
    pending = await publish(db, pending);
    await db.exec("reset role");
    await db.query("update site_blog_posts set published=false where id=$1", [pending.post_id]);
    await db.query("update site_blog_approved_revisions set published_at=now()-interval '1 minute' where id=$1", [pending.post_id]);
    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_blog_public_posts")).rows.length, 0);
    assert.equal((await db.query("select * from site_blog_approved_revisions")).rows.length, 0);
    await db.exec("set role authenticated");
    await db.query("delete from site_blog_posts where id=$1", [pending.post_id]);
    assert.equal((await db.query("select * from site_blog_drafts where id=$1", [pending.post_id])).rows.length, 0);
    assert.equal((await db.query("select * from site_blog_draft_history where draft_id=$1", [pending.post_id])).rows.length, 0);
    assert.equal((await db.query("select * from site_blog_approved_revisions where id=$1", [pending.post_id])).rows.length, 0);
  } finally { await db.close(); }
});

test("explicit unpublication preserves effective due content and private snapshot, clears schedule, and confirms retries", async () => {
  const db = await database();
  try {
    let state = await liveFixture(db);
    state = await save(db, state, snapshot({ title: "Due approved article", slug: "due-approved", published_at: await future(db) }));
    state = await publish(db, state);
    state = await save(db, state, snapshot({ title: "Still private", slug: "still-private" }));
    const privateSnapshot = state.snapshot;
    await db.exec("reset role");
    await db.query("update site_blog_approved_revisions set published_at=now()-interval '1 minute' where id=$1", [state.post_id]);
    await db.exec("set role authenticated");
    const old = state, request = nonce();
    state = await rpc(db, "unpublish_blog_draft", [state.draft_id, state.version, request]);
    assert.equal(state.live.published, false);
    assert.deepEqual(state.snapshot, privateSnapshot);
    assert.equal(state.live.title, "Due approved article");
    assert.equal((await raw(db, state.post_id)).title, "Due approved article");
    assert.equal(state.base_public_version, state.live.updated_at);
    assert.equal(state.scheduled_at, null);
    assert.equal((await db.query("select * from site_blog_approved_revisions")).rows.length, 0);
    assert.deepEqual(await rpc(db, "unpublish_blog_draft", [old.draft_id, old.version, request]), state);
    await assert.rejects(rpc(db, "unpublish_blog_draft", [old.draft_id, old.version, nonce()]), conflict);
    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_blog_public_posts")).rows.length, 0);
    await db.exec("set role authenticated");
    state = await publish(db, state);
    assert.equal(state.live.title, "Still private");
    assert.equal(state.live.published, true);
    const orphan = await save(db, await rpc(db, "load_blog_draft"), snapshot());
    await assert.rejects(rpc(db, "unpublish_blog_draft", [orphan.draft_id, orphan.version, nonce()]), /no public post/);
    // Legacy Admin rows without private heads still support an intentional hide.
    await db.exec("reset role");
    await db.query("delete from site_blog_drafts where id=$1", [state.post_id]);
    await db.exec("set role authenticated");
    const legacy = await rpc(db, "load_blog_draft", [state.post_id]);
    assert.equal(legacy.version, null);
    const hidden = await rpc(db, "unpublish_blog_draft", [legacy.draft_id, null, nonce()]);
    assert.equal(hidden.live.published, false);
    assert.deepEqual(hidden.snapshot, legacy.snapshot);
    assert.notEqual(hidden.version, null);
  } finally { await db.close(); }
});

test("view counter follows the due approved slug before materialization and preserves daily per-post tokens", async () => {
  const db = await database();
  try {
    let state = await liveFixture(db, { slug: "counter-original" });
    state = await save(db, state, snapshot({ slug: "counter-approved", published_at: await future(db) }));
    state = await publish(db, state);
    const token = nonce(), anotherToken = nonce();
    const views = (slug, value = null) => rpc(db, "get_blog_post_views", [slug, value]);
    await db.exec("set role anon");
    assert.equal(await views("counter-original"), 0);
    assert.equal(await views("counter-original", token), 1);
    assert.equal(await views("counter-approved", anotherToken), null);
    await db.exec("reset role");
    await db.query("update site_blog_approved_revisions set published_at=now()-interval '1 minute' where id=$1", [state.post_id]);
    assert.equal((await raw(db, state.post_id)).slug, "counter-original", "base has not been materialized");
    await db.exec("set role anon");
    assert.equal((await db.query("select slug from site_blog_public_posts")).rows[0].slug, "counter-approved");
    assert.equal(await views("counter-approved"), 1, "read-only totals follow the post ID");
    assert.equal(await views("counter-approved", token), 1, "renaming does not duplicate the daily receipt");
    assert.equal(await views("counter-approved", anotherToken), 2);
    assert.equal(await views("counter-approved", anotherToken), 2);
    assert.equal(await views("counter-original"), null);
    assert.equal(await views("counter-original", nonce()), null, "obsolete slug cannot record a view");
    await assert.rejects(views("counter-approved", "not-a-uuid"), /uuid/);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.equal(await views("counter-approved"), 2);
      for (const table of ["site_blog_view_counts", "site_blog_view_receipts"]) {
        await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
        await assert.rejects(db.query(`delete from ${table}`), /permission denied/);
      }
    }
    await db.exec("reset role");
    assert.equal((await db.query("select views from site_blog_view_counts where post_id=$1", [state.post_id])).rows[0].views, 2);
    assert.equal((await db.query("select count(*)::int as n from site_blog_view_receipts")).rows[0].n, 2);
    await db.exec("update site_blog_view_receipts set day=day-1; set role anon");
    assert.equal(await views("counter-approved", token), 3, "token can count again on a new UTC day");
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as n from site_blog_view_receipts")).rows[0].n, 1);
    await db.exec("set role authenticated");
    state = await rpc(db, "unpublish_blog_draft", [state.draft_id, state.version, nonce()]);
    await db.exec("set role anon");
    assert.equal(await views("counter-approved", nonce()), null);
    assert.equal(await views("counter-original", nonce()), null);
    await db.exec("set role authenticated");
    await db.query("delete from site_blog_posts where id=$1", [state.post_id]);
    await db.exec("reset role");
    assert.equal((await db.query("select * from site_blog_view_counts")).rows.length, 0);
    assert.equal((await db.query("select * from site_blog_view_receipts")).rows.length, 0);
  } finally { await db.close(); }
});

test("server checkpoint cadence/cap, restore-only history and snapshot validation", async () => {
  const db = await database();
  try {
    let state = await liveFixture(db);
    const before = await raw(db, state.post_id);
    const initial = await rpc(db, "list_blog_draft_history", [state.draft_id]);
    state = await save(db, state, snapshot({ title: "Autosave one" }));
    state = await save(db, state, snapshot({ title: "Autosave two" }));
    assert.equal((await rpc(db, "list_blog_draft_history", [state.draft_id])).length, initial.length);
    await db.exec("reset role");
    await db.query("update site_blog_draft_history set created_at=now()-interval '6 minutes' where draft_id=$1", [state.draft_id]);
    await db.exec("set role authenticated");
    state = await save(db, state, snapshot({ title: "Five minute checkpoint" }));
    assert.equal((await rpc(db, "list_blog_draft_history", [state.draft_id]))[0].reason, "autosave");
    const revision = initial[0];
    const checkpoint = await rpc(db, "get_blog_draft_revision", [state.draft_id, revision.id]);
    const old = state, restoreNonce = nonce();
    state = await rpc(db, "restore_blog_draft_revision", [state.draft_id, revision.id, state.version, restoreNonce]);
    assert.deepEqual(state.snapshot, checkpoint.snapshot);
    assert.equal(state.base_public_version, old.base_public_version);
    assert.deepEqual(await raw(db, state.post_id), before);
    assert.deepEqual(await rpc(db, "restore_blog_draft_revision", [old.draft_id, revision.id, old.version, restoreNonce]), state);
    for (let i = 0; i < 105; i++) state = await save(db, state, snapshot({ title: `Checkpoint ${i}` }), nonce(), true);
    const history = await rpc(db, "list_blog_draft_history", [state.draft_id]);
    assert.equal(history.length, 100);
    assert.equal(history[0].title, "Checkpoint 104");
    assert.ok(history.every((h, i) => i === 0 || history[i - 1].revision > h.revision));
    await assert.rejects(rpc(db, "get_blog_draft_revision", [state.draft_id, revision.id]), /not found/);
    for (const bad of [
      { ...snapshot(), unexpected: true }, snapshot({ title: null }), snapshot({ body_markdown: "x".repeat(200001) }),
      snapshot({ body_rich: {} }), snapshot({ body_rich: { version: "1", doc: { type: "doc", content: [] } } }),
      snapshot({ body_rich: { version: 1, doc: { type: "doc", content: [], extra: "x".repeat(1000000) } } }),
      snapshot({ published_at: "infinity" }), snapshot({ published_at: 1 }), snapshot({ excerpt: "x".repeat(501) }),
      snapshot({ published_at: "tomorrow" }), snapshot({ published_at: "2030-01-01T00:00:00" }),
    ]) await assert.rejects(save(db, state, bad), /Invalid draft snapshot/);
    state = await save(db, state, snapshot({ published_at: "2030-01-01T00:00:00Z" }));
    const equivalent = await save(db, state, snapshot({ published_at: "2030-01-01T00:00:00+00:00" }));
    assert.deepEqual(equivalent.snapshot, state.snapshot);
    await db.exec("set timezone='America/Chicago'");
    const otherZone = await save(db, equivalent, snapshot({ published_at: "2029-12-31T18:00:00-06:00" }));
    assert.deepEqual(otherZone.snapshot, state.snapshot);
  } finally { await db.close(); }
});

test("save and retry hold publication/reservation locks until the transaction ends", async () => {
  const db = await database();
  try {
    const blank = await rpc(db, "load_blog_draft"), request = nonce();
    const confirmed = await save(db, blank, snapshot(), request);
    await db.exec("begin");
    try {
      assert.deepEqual(await save(db, blank, snapshot(), request), confirmed);
      const locks = (await db.query(`select c.relname, l.mode, l.granted from pg_locks l
        join pg_class c on c.oid=l.relation where l.mode='ShareRowExclusiveLock'`)).rows;
      for (const table of ["site_blog_posts", "site_blog_drafts", "site_blog_draft_history", "site_blog_approved_revisions"]) {
        assert.ok(locks.some(lock => lock.relname === table && lock.granted), `${table} serialized through transaction end`);
      }
    } finally { await db.exec("rollback"); }
  } finally { await db.close(); }
});

test("complete exact-schema backup restores children, content and history atomically and invalidates old receipts/tokens", async () => {
  const db = await database({ backups: true });
  try {
    let state = await liveFixture(db);
    state = await save(db, state, snapshot({ title: "Scheduled backup", slug: "backup-schedule", published_at: await future(db) }));
    state = await publish(db, state);
    const privateOnly = await save(db, await rpc(db, "load_blog_draft"), snapshot({ slug: "", title: "" }));
    await db.exec("insert into site_message_pools(id,title,schedule,starts_on,ends_on) values('custom-test','Synthetic pool','once','2030-01-01','2030-01-02')");
    await db.exec("insert into site_message_catalog(position,profile,category,text) values(1,'custom-test','messages','Synthetic message')");
    const backup = await rpc(db, "export_site_content");
    assert.equal(Object.keys(backup.tables).length, 23);
    assert.equal(backup.tables.site_blog_drafts.length, 2);
    assert.equal(backup.tables.site_blog_approved_revisions.length, 1);
    const originalHistory = backup.tables.site_blog_draft_history;
    const old = state;
    state = await save(db, state, snapshot({ title: "Not in backup" }));
    await db.query("delete from site_blog_posts where id=$1", [state.post_id]);
    const restored = await rpc(db, "restore_site_content", [backup]);
    assert.equal(restored.tables, 23);
    const after = await rpc(db, "export_site_content");
    assert.deepEqual(after.tables.site_blog_draft_history, originalHistory);
    assert.deepEqual(after.tables.site_blog_approved_revisions, backup.tables.site_blog_approved_revisions);
    assert.deepEqual(after.tables.site_blog_posts, backup.tables.site_blog_posts);
    assert.equal(after.tables.site_message_catalog[0].pool_id, "custom-test");
    const loaded = await rpc(db, "load_blog_draft", [old.draft_id]);
    assert.notEqual(loaded.version, old.version);
    assert.deepEqual(loaded.snapshot, old.snapshot);
    assert.equal(after.tables.site_blog_drafts.find(h => h.id === old.draft_id).last_receipt, null);
    await assert.rejects(save(db, old, old.snapshot), conflict);
    await assert.rejects(rpc(db, "publish_blog_draft", [old.draft_id, old.version, old.request_id, old.live.updated_at, false]), conflict);
    assert.notEqual((await rpc(db, "load_blog_draft", [privateOnly.draft_id])).version, privateOnly.version);
    for (const mutate of [
      b => { delete b.tables.site_blog_drafts; },
      b => { delete b.tables.site_blog_drafts[0].version; },
      b => { b.tables.site_blog_draft_history[0].snapshot.body_markdown = null; },
      b => { b.tables.site_blog_draft_history[0].draft_id = nonce(); },
      b => { b.tables.site_blog_draft_history[0].revision = 2147483647; },
      b => { b.tables.spotify_featured_tracks[0].body = "INVALID"; },
      b => { b.tables.auth_users = []; },
    ]) {
      const invalid = structuredClone(backup);
      mutate(invalid);
      await assert.rejects(rpc(db, "restore_site_content", [invalid]));
      assert.deepEqual((await rpc(db, "export_site_content")).tables, after.tables);
    }
    const overSize = structuredClone(backup);
    overSize.tables.site_blog_drafts[0].snapshot.body_markdown = "x".repeat(10485760);
    await assert.rejects(rpc(db, "restore_site_content", [overSize]), /Invalid content backup/);
    const overRows = structuredClone(backup);
    overRows.tables.site_message_catalog = Array.from({ length: 10001 }, () => backup.tables.site_message_catalog[0]);
    await assert.rejects(rpc(db, "restore_site_content", [overRows]), /10000 rows/);
    const overHistory = structuredClone(backup);
    overHistory.tables.site_blog_draft_history = Array.from({ length: 101 }, (_, revision) => ({
      ...originalHistory[0], id: nonce(), revision,
    }));
    overHistory.tables.site_blog_drafts.find(h => h.id === originalHistory[0].draft_id).revision = 101;
    await assert.rejects(rpc(db, "restore_site_content", [overHistory]), /100 checkpoints/);
    assert.deepEqual((await rpc(db, "export_site_content")).tables, after.tables);
    await db.exec("set role anon");
    await assert.rejects(rpc(db, "restore_site_content", [backup]), /permission denied/);
    await assert.rejects(rpc(db, "export_site_content"), /permission denied/);
    await db.exec("set role authenticated");
    const next = await save(db, loaded, snapshot({ title: "Restored draft can continue editing" }), nonce(), true);
    assert.equal(next.revision, loaded.revision + 1);
  } finally { await db.close(); }
});
