import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = { window: {}, document: { querySelector: () => null } };
vm.runInNewContext(readFileSync(new URL("../admin-backup.js", import.meta.url), "utf8"), context);
const { tables, validate } = context.window.BITS_CONTENT_BACKUP;
function backup() {
  const tablesData = Object.fromEntries(tables.map((table) => [table, []]));
  for (const table of ["pronoun_profiles", "site_now", "site_resume_profile", "site_message_settings"]) tablesData[table] = [{ id: "primary" }];
  return { format: "shortbits-content", version: 1, exportedAt: "2026-10-22T21:00:00Z", tables: tablesData };
}
test("accepts complete versioned editorial backups without private tables", () => {
  assert.equal(validate(backup()), 4);
  assert.ok(tables.includes("site_creators"));
  assert.ok(tables.includes("site_message_catalog"));
  assert.ok(tables.includes("site_message_pools"));
  assert.ok(tables.includes("site_message_settings"));
  for (const name of ["messages", "site_hardware_devices", "site_short_links", "arcade_scores"]) assert.ok(!tables.includes(name));
});
test("rejects incomplete, unknown, malformed, and oversized content", () => {
  const cases = [
    (value) => { delete value.tables.site_blog_posts; },
    (value) => { value.tables.messages = []; },
    (value) => { value.version = 2; },
    (value) => { value.tables.site_now = []; },
    (value) => { value.tables.site_blog_posts = [null]; },
    (value) => { value.tables.site_blog_posts = Array(10001).fill({}); },
    (value) => { value.exportedAt = "invalid"; },
  ];
  for (const change of cases) {
    const value = backup();
    change(value);
    assert.throws(() => validate(value));
  }
});
