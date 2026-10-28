import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function setup() {
  const context = vm.createContext({ window: {}, Intl, console });
  for (const file of ["message-text", "seasonal-calendar", "message-catalog", "seasonal-messages"]) {
    vm.runInContext(readFileSync(new URL(`../shared/scripts/${file}.js`, import.meta.url), "utf8"), context);
  }
  const { BITS_MESSAGE_CATALOG: catalog, BITS_GET_SEASONAL_PROFILE: resolve } = context.window;
  return { catalog, resolve: (day, pools = []) => resolve(new Date(`${day}T12:00:00`), { pools }) };
}
const plain = value => JSON.parse(JSON.stringify(value));

test("all built-in defaults and automatic dates are exposed from their actual matching rules", () => {
  const { catalog } = setup();
  for (const id of catalog.builtinProfiles.filter(id => id !== "standard")) {
    const pool = catalog.builtinPool(id);
    catalog.validatePool(pool);
    assert.equal(pool.id, id);
    assert.ok(pool.title);
    assert.equal(pool.schedule, "automatic");
    assert.equal(pool.enabled, true);
    assert.ok(catalog.builtinSchedule(id, 2026).rule);
  }
  assert.equal(catalog.builtinPool("standard"), null);
  assert.deepEqual(plain(catalog.builtinSchedule("easter", 2026).ranges), [{ start: "2026-04-05", end: "2026-04-05" }]);
  assert.deepEqual(plain(catalog.builtinSchedule("easter", 2027).ranges), [{ start: "2027-03-28", end: "2027-03-28" }]);
  assert.deepEqual(plain(catalog.builtinSchedule("thanksgiving", 2026).ranges), [{ start: "2026-11-26", end: "2026-11-26" }]);
  assert.deepEqual(plain(catalog.builtinSchedule("thanksgiving", 2027).ranges), [{ start: "2027-11-25", end: "2027-11-25" }]);
  assert.deepEqual(plain(catalog.builtinSchedule("new-year", 2026).ranges),
    [{ start: "2026-01-01", end: "2026-01-02" }, { start: "2026-12-31", end: "2026-12-31" }]);
  assert.deepEqual(plain(catalog.builtinSchedule("friday-the-13th", 2026).ranges),
    ["02", "03", "11"].map(month => ({ start: `2026-${month}-13`, end: `2026-${month}-13` })));
  assert.deepEqual(plain(catalog.builtinSchedule("leap-day", 2027).ranges), []);
  assert.deepEqual(plain(catalog.builtinSchedule("leap-day", 2028).ranges), [{ start: "2028-02-29", end: "2028-02-29" }]);
});

test("built-in overrides preserve automatic moving dates and change exclusivity without duplicating profiles", () => {
  const { catalog, resolve } = setup();
  const christmas = { ...catalog.builtinPool("christmas"), mode: "additive" };
  assert.equal(resolve("2026-12-25", [christmas]).mode, "additive");
  assert.deepEqual(plain(resolve("2026-12-25", [christmas]).ids), ["christmas"]);
  const easter = { ...catalog.builtinPool("easter"), mode: "exclusive" };
  assert.equal(resolve("2026-04-05", [easter]).mode, "exclusive");
  assert.equal(resolve("2027-03-28", [easter]).mode, "exclusive");
  assert.equal(resolve("2027-04-05", [easter]).active, false);
  catalog.setAdminPools([easter]);
  assert.equal(catalog.profiles.filter(id => id === "easter").length, 1);
  assert.equal(catalog.scheduledProfiles(new Date("2026-04-05T12:00:00"), [easter]).length, 0,
    "Overrides use the original bundled content, not empty custom profiles");
  const custom = { id: "custom-overlap", title: "Overlap", schedule: "annual",
    starts_on: "2000-12-25", ends_on: "2000-12-25", mode: "exclusive", enabled: true };
  assert.deepEqual(plain(resolve("2026-12-25", [christmas, custom]).ids), ["custom-overlap"]);
  assert.deepEqual(plain(resolve("2026-12-25", [{ ...christmas, mode: "exclusive" }, custom]).ids), ["christmas", "custom-overlap"]);
});

test("fixed dates replace built-in matching rules, support year-wrap and one-time ranges, and disabled overrides suppress defaults", () => {
  const { catalog, resolve } = setup();
  const christmas = { ...catalog.builtinPool("christmas"), schedule: "annual", starts_on: "2000-08-10", ends_on: "2000-08-12" };
  catalog.validatePool(christmas);
  assert.ok(resolve("2026-08-10", [christmas]).ids.includes("christmas"));
  assert.equal(resolve("2026-12-25", [christmas]).active, false);
  assert.equal(resolve("2026-08-13", [christmas]).active, false);
  const wrapped = { ...christmas, starts_on: "2000-12-30", ends_on: "2000-01-03" };
  for (const day of ["2026-12-30", "2027-01-03"]) assert.ok(resolve(day, [wrapped]).ids.includes("christmas"));
  const once = { ...christmas, schedule: "once", starts_on: "2026-08-10", ends_on: "2026-08-11" };
  assert.ok(resolve("2026-08-11", [once]).ids.includes("christmas"));
  assert.equal(resolve("2027-08-10", [once]).active, false);
  assert.equal(resolve("2026-12-25", [{ ...catalog.builtinPool("christmas"), enabled: false }]).active, false);
  assert.equal(resolve("2026-12-25").mode, "exclusive", "Removing the override restores the original behavior");
});

test("automatic schedules reject custom IDs, invalid builtin IDs, and stray fixed dates", () => {
  const { catalog } = setup();
  const pool = catalog.builtinPool("easter");
  for (const changes of [
    { id: "custom-invalid" }, { id: "standard" }, { id: "unknown" },
    { starts_on: "2000-01-01" }, { ends_on: "2000-01-01" },
    { schedule: "annual" }, { enabled: null }, { mode: "invalid" },
  ]) assert.throws(() => catalog.validatePool({ ...pool, ...changes }), /Enter a pool/);
  assert.throws(() => catalog.setAdminPools([pool, pool]), /Duplicate/);
});
