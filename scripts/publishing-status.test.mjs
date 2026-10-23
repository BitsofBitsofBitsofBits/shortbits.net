import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import publishing from "../publishing-status.js";

const fixtures = JSON.parse(await readFile(new URL("./fixtures/blog-posts.json", import.meta.url), "utf8"));
const now = new Date("2026-10-22T12:00:00Z");

test("publishing snapshots are deterministic and contain no draft or scheduled content", async () => {
  const manifest = await publishing.snapshot(fixtures, now);
  assert.deepEqual(manifest, await publishing.snapshot([...fixtures].reverse(), now));
  assert.deepEqual(manifest.posts.map((post) => post.slug), ["first-lab-notes", "safe-markdown"]);
  assert.deepEqual(Object.keys(manifest.posts[0]).sort(), ["fingerprint", "slug"]);
  assert.doesNotMatch(JSON.stringify(manifest), /private-draft|future-post|body_markdown|excerpt/);
  assert.equal(publishing.validate(manifest), manifest);
  const equivalentDates = fixtures.map((post) => ({
    ...post, published_at: post.published_at ? new Date(post.published_at).toISOString() : null,
  }));
  assert.deepEqual(await publishing.snapshot(equivalentDates, now), manifest);
});

test("publishing comparison detects all rendered changes, additions, removals, and renames", async () => {
  const baseline = await publishing.snapshot(fixtures, now);
  assert.deepEqual(publishing.compare(baseline, baseline), { added: [], changed: [], removed: [] });
  for (const field of ["title", "excerpt", "body_markdown", "updated_at", "published_at"]) {
    const posts = fixtures.map((post, index) => index ? post : {
      ...post, [field]: field.endsWith("_at") ? "2026-01-01T00:00:00Z" : `${post[field]} changed`,
    });
    assert.deepEqual(publishing.compare(await publishing.snapshot(posts, now), baseline).changed, [fixtures[0].slug], field);
  }
  const renamed = fixtures.map((post, index) => index ? post : { ...post, slug: "new-name" });
  const result = publishing.compare(await publishing.snapshot(renamed, now), baseline);
  assert.deepEqual(result.added, ["new-name"]);
  assert.deepEqual(result.removed, [fixtures[0].slug]);
  const unpublished = fixtures.map((post, index) => index ? post : { ...post, published: false });
  assert.deepEqual(publishing.compare(await publishing.snapshot(unpublished, now), baseline).removed, [fixtures[0].slug]);
  assert.deepEqual(publishing.compare(await publishing.snapshot([], now), baseline).removed, baseline.posts.map((post) => post.slug));
});

test("scheduled posts become deployment differences only after publication time", async () => {
  const scheduled = { ...fixtures[0], slug: "scheduled", published_at: "2026-10-23T00:00:00Z" };
  const deployed = await publishing.snapshot([scheduled], now);
  assert.equal(deployed.posts.length, 0);
  const due = await publishing.snapshot([scheduled], new Date("2026-10-23T00:00:00Z"));
  assert.deepEqual(publishing.compare(due, deployed).added, ["scheduled"]);
});

test("missing or malformed deployed snapshots never appear synchronized", async () => {
  const manifest = await publishing.snapshot(fixtures, now);
  for (const value of [
    null, {}, { ...manifest, version: 2 }, { ...manifest, generatedAt: "invalid" },
    { ...manifest, posts: [...manifest.posts, manifest.posts[0]] },
    { ...manifest, posts: [{ slug: "../private", fingerprint: "a".repeat(64) }] },
    { ...manifest, posts: [{ slug: "valid", fingerprint: "bad" }] },
  ]) assert.throws(() => publishing.compare(manifest, value));
});
