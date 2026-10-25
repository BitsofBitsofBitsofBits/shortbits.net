import test from "node:test";
import assert from "node:assert/strict";
import { checkPerformanceBudget } from "./performance-budgets.mjs";

function report() {
  return {
    categories: { performance: { score: 0.9 }, accessibility: { score: 1 }, seo: { score: 1 } },
    audits: {
      "cumulative-layout-shift": { numericValue: 0.1 },
      "largest-contentful-paint": { numericValue: 2500 },
    },
  };
}
test("accepts exact budget thresholds", () => assert.deepEqual(checkPerformanceBudget(report(), "test"), []));
test("rejects regressions, missing measurements, and audit failures", () => {
  const value = report();
  value.categories.performance.score = 0.89;
  value.audits["cumulative-layout-shift"].numericValue = 0.101;
  value.audits["largest-contentful-paint"].numericValue = 2501;
  assert.equal(checkPerformanceBudget(value, "test").length, 3);
  value.runtimeError = { message: "Navigation failed" };
  assert.equal(checkPerformanceBudget(value, "test").length, 1);
  assert.equal(checkPerformanceBudget({}, "test").length, 5);
});
