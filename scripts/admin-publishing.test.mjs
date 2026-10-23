import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../admin.js", import.meta.url), "utf8");
const loader = source.slice(source.indexOf("let blogPostsLoadSequence ="), source.indexOf("\nasync function loadShortLinks"));
function setup(pages) {
  const snapshots = [];
  const ranges = [];
  const reports = [];
  const context = {
    console: { error: () => {} },
    window: { BITS_PUBLISHING_UI: { clear: (...args) => reports.push(args), update: (posts) => snapshots.push(posts) } },
    document: { createElement: () => ({}) },
    blogAdminStatus: {},
    blogAdminList: { replaceChildren: () => {}, append: () => {} },
    createBlogPostButton: (post) => post,
    selectBlogPost: () => {},
    setAdminStatus: () => {},
    adminClient: {
      from() { return this; }, select() { return this; }, order() { return this; },
      range(start, end) { ranges.push([start, end]); return pages.shift(); },
    },
  };
  vm.createContext(context);
  vm.runInContext(loader, context);
  return { context, snapshots, ranges, reports };
}
test("admin compares every saved post, including paginated entries", async () => {
  const first = Array.from({ length: 500 }, (_, id) => ({ id: String(id), slug: `post-${id}` }));
  const last = [{ id: "500", slug: "post-500" }];
  const state = setup([{ data: first }, { data: last }]);
  assert.equal(await state.context.loadBlogPosts(), true);
  assert.deepEqual(state.ranges, [[0, 499], [500, 999]]);
  assert.equal(state.snapshots[0].length, 501);
  assert.equal(state.snapshots[0][500].slug, "post-500");
});
test("admin database failures clear the comparison and permit explicit retry", async () => {
  const state = setup([{ data: null, error: { message: "Database unreachable" } }]);
  assert.equal(await state.context.loadBlogPosts(), false);
  assert.equal(state.snapshots.length, 0);
  assert.match(state.reports.at(-1)[0], /Database unreachable/);
  assert.deepEqual(state.reports.at(-1).slice(1), ["error", true]);
});
test("late loads cannot replace a newer saved-post comparison", async () => {
  let release;
  const state = setup([
    new Promise((done) => { release = done; }),
    { data: [{ id: "new", slug: "new-post" }] },
  ]);
  const older = state.context.loadBlogPosts();
  assert.equal(await state.context.loadBlogPosts(), true);
  release({ data: [{ id: "old", slug: "old-post" }] });
  assert.equal(await older, false);
  assert.equal(state.snapshots.length, 1);
  assert.equal(state.snapshots[0][0].slug, "new-post");
});
