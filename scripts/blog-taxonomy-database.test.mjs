import test from "node:test";
import assert from "node:assert/strict";
import { database, rpc, save, publish, snapshot, nonce, raw, future, migration } from "./blog-drafts-db-helper.mjs";

const item = name => ({ name, slug: name.toLowerCase().replaceAll(" ", "-") });
const revision = overrides => snapshot({ tags: [], series: null, series_order: null, ...overrides });
const published = async db => {
  const blank = await rpc(db, "load_blog_draft");
  return publish(db, await save(db, blank, revision()));
};

test("taxonomy stays private through autosave/history and publishes atomically with idempotent receipts", async () => {
  const db = await database({ taxonomy: true });
  try {
    let state = await published(db);
    const original = await raw(db, state.post_id);
    const metadata = { tags: [item("Colors"), item("Technology")], series: item("Color stories"), series_order: 2 };
    state = await save(db, state, revision(metadata), nonce(), true);
    assert.deepEqual(await raw(db, state.post_id), original);
    assert.deepEqual((await rpc(db, "list_blog_taxonomy")).tags.map(tag => tag.slug), ["colors", "technology"]);
    await db.exec("set role anon");
    assert.deepEqual((await db.query("select tags,series,series_order from site_blog_public_posts")).rows[0],
      { tags: [], series: null, series_order: null });
    await assert.rejects(db.query("select snapshot from site_blog_drafts"), /permission denied/);
    await assert.rejects(rpc(db, "list_blog_taxonomy"), /permission denied/);
    await assert.rejects(rpc(db, "blog_publish_content_draft", [state.draft_id, state.version, nonce(), state.live.updated_at, false]), /permission denied/);
    await db.exec("set role authenticated");
    const before = state, request = nonce();
    state = await publish(db, before, request);
    assert.deepEqual(await publish(db, before, request), state);
    assert.equal(state.has_unpublished_changes, false);
    const row = await raw(db, state.post_id);
    assert.deepEqual({ tags: row.tags, series: row.series, series_order: row.series_order }, metadata);
    const history = await rpc(db, "list_blog_draft_history", [state.draft_id]);
    const baseline = history.find(entry => entry.reason === "publish" && entry.revision < before.revision);
    state = await rpc(db, "restore_blog_draft_revision", [state.draft_id, baseline.id, state.version, nonce()]);
    assert.deepEqual(state.snapshot.tags, []);
    assert.equal(state.snapshot.series, null);
    assert.deepEqual(await raw(db, state.post_id), row);
    await assert.rejects(save(db, state, revision({ tags: [item("Colors"), item("Colors")] })), /Invalid draft snapshot/);
    await assert.rejects(save(db, state, revision({ series: item("Colors") })), /Invalid draft snapshot/);
    await assert.rejects(save(db, state, revision({ series_order: 1 })), /Invalid draft snapshot/);
    await assert.rejects(save(db, state, revision({ series: item("Colors"), series_order: "1" })), /Invalid draft snapshot/);
    await assert.rejects(save(db, state, revision({ series: item("Colors"), series_order: 100001 })), /Invalid draft snapshot/);
    await assert.rejects(save(db, state, snapshot()), /Invalid draft snapshot/);
  } finally { await db.close(); }
});

test("scheduled taxonomy is invisible until due, materializes correctly, and unpublishing removes public membership", async () => {
  const db = await database({ taxonomy: true });
  try {
    let state = await published(db);
    const base = await raw(db, state.post_id);
    const taxonomy = { tags: [item("Scheduled tag")], series: item("Scheduled series"), series_order: 3 };
    state = await save(db, state, revision({ ...taxonomy, published_at: await future(db) }));
    state = await publish(db, state);
    assert.equal(state.has_unpublished_changes, false);
    assert.deepEqual(await raw(db, state.post_id), base);
    await db.exec("set role anon");
    assert.deepEqual((await db.query("select tags,series from site_blog_public_posts")).rows[0], { tags: [], series: null });
    assert.equal((await db.query("select * from site_blog_approved_revisions")).rows.length, 0);
    await db.exec("reset role");
    await db.query("update site_blog_approved_revisions set published_at=now()-interval '1 minute' where id=$1", [state.post_id]);
    await db.exec("set role anon");
    assert.deepEqual((await db.query("select tags,series,series_order from site_blog_public_posts")).rows[0], taxonomy);
    await db.exec("set role authenticated");
    state = await rpc(db, "load_blog_draft", [state.draft_id]);
    state = await save(db, state, revision({ series: item("Next series"), series_order: 1, published_at: await future(db, "2 days") }));
    state = await publish(db, state, nonce(), true);
    const materialized = await raw(db, state.post_id);
    assert.deepEqual(materialized.tags, taxonomy.tags);
    assert.deepEqual(materialized.series, taxonomy.series);
    state = await rpc(db, "cancel_blog_draft_schedule", [state.draft_id, state.version, nonce()]);
    assert.deepEqual((await db.query("select tags from site_blog_public_posts")).rows[0].tags, taxonomy.tags);
    state = await rpc(db, "unpublish_blog_draft", [state.draft_id, state.version, nonce()]);
    await db.exec("set role anon");
    assert.equal((await db.query("select * from site_blog_public_posts")).rows.length, 0);
  } finally { await db.close(); }
});

test("migration retains existing content/history, invalidates old sessions, and exact-schema backups restore taxonomy", async () => {
  const db = await database({ backups: true });
  try {
    const blank = await rpc(db, "load_blog_draft");
    const old = await save(db, blank, snapshot(), nonce(), true);
    await db.exec("reset role");
    await migration(db, "20261126160000_blog_taxonomy.sql");
    await db.exec("set role authenticated");
    let state = await rpc(db, "load_blog_draft", [old.draft_id]);
    assert.notEqual(state.version, old.version);
    assert.equal(state.snapshot.body_markdown, old.snapshot.body_markdown);
    assert.deepEqual(state.snapshot.tags, []);
    await assert.rejects(publish(db, old), error => error.code === "40001");
    state = await save(db, state, revision({ tags: [item("Backup tag")], series: item("Backup series"), series_order: 1 }));
    state = await publish(db, state);
    const backup = await rpc(db, "export_site_content");
    await rpc(db, "unpublish_blog_draft", [state.draft_id, state.version, nonce()]);
    await rpc(db, "restore_site_content", [backup]);
    state = await rpc(db, "load_blog_draft", [state.draft_id]);
    assert.deepEqual(state.snapshot.tags, [item("Backup tag")]);
    assert.deepEqual((await db.query("select tags from site_blog_public_posts")).rows[0].tags, [item("Backup tag")]);
  } finally { await db.close(); }
});
