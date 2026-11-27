import test from "node:test";
import assert from "node:assert/strict";
import taxonomy from "../shared/scripts/blog-taxonomy.js";

const form = (tags = "", series = "", order = "") => ({ elements: {
  tags: { value: tags }, series: { value: series }, series_order: { value: order },
} });
test("editor taxonomy preserves known identifiers, normalizes tag order, and rejects ambiguous or incomplete assignments", () => {
  const previous = { tags: [{ name: "Technology", slug: "tech" }], series: { name: "Color stories", slug: "colors" }, series_order: 1 };
  const metadata = taxonomy.fields(form("Technology, Colors", "Color stories", "2"), previous);
  assert.deepEqual(metadata.tags.map(tag => tag.slug), ["colors", "tech"]);
  assert.equal(metadata.series.slug, "colors");
  assert.equal(metadata.series_order, 2);
  assert.deepEqual(taxonomy.fields(form()), { tags: [], series: null, series_order: null });
  assert.throws(() => taxonomy.fields(form("Colors, colors")), /unique/);
  assert.throws(() => taxonomy.fields(form("C++, C")), /unique/);
  assert.throws(() => taxonomy.fields(form("", "Colors")), /reading order/);
  assert.throws(() => taxonomy.fields(form("", "Colors", "1.5")), /reading order/);
  const incomplete = taxonomy.captureFields(form("", "Colors", ""));
  assert.doesNotThrow(() => JSON.stringify(incomplete));
  assert.throws(() => taxonomy.read(incomplete), /reading order/);
  assert.equal(taxonomy.read({ tags: [{ name: "\u{1f600}".repeat(80), slug: "unicode" }] }).tags[0].name, "\u{1f600}".repeat(80));
  assert.throws(() => taxonomy.read({ tags: [{ name: "\u{1f600}".repeat(81), slug: "unicode" }] }), /Invalid blog tag/);
});

test("one-series ordering has deterministic date and slug ties without mutating the archive", () => {
  const series = { name: "Colors", slug: "colors" };
  const posts = [
    { slug: "second", series, series_order: 2, published_at: "2026-01-01" },
    { slug: "first-b", series, series_order: 1, published_at: "2026-01-01" },
    { slug: "unassigned", published_at: "2026-01-01" },
    { slug: "first-a", series, series_order: 1, published_at: "2026-01-01" },
  ];
  assert.deepEqual(taxonomy.ordered(posts, "colors").map(post => post.slug), ["first-a", "first-b", "second"]);
  assert.equal(posts[0].slug, "second");
  assert.equal(taxonomy.path("series", "colors"), "/blog/series/colors/");
  assert.throws(() => taxonomy.path("tags", "../private"), /Invalid taxonomy/);
});
