import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { medianLcp } from "./lighthouse-lcp.mjs";
import { checkPerformanceBudget, requiredReports } from "./performance-budgets.mjs";

function report(lcp, performance = 0.95) {
  return {
    categories: {
      performance: { id: "performance", score: performance },
      accessibility: { id: "accessibility", score: 1 },
      seo: { id: "seo", score: 1 },
    },
    audits: {
      "largest-contentful-paint": { numericValue: lcp },
      "cumulative-layout-shift": { numericValue: 0.05 },
    },
  };
}

test("the LCP budget uses the middle measurement without changing other budgets", () => {
  const samples = [report(2900, 0.89), report(2400), report(2300)];
  const result = medianLcp(samples, "online-mobile");
  assert.deepEqual(result, { values: [2900, 2400, 2300], median: 2400 });
  assert.deepEqual(checkPerformanceBudget(samples[0], "online-mobile", { lcpValue: result.median }), [
    "online-mobile: performance must be at least 90; received 89",
  ]);
  assert.match(checkPerformanceBudget(samples[0], "online-mobile")[1], /largest-contentful-paint/);
  assert.match(checkPerformanceBudget(samples[0], "online-mobile", { lcpValue: 2501 })[1], /received 2501/);
  assert.match(checkPerformanceBudget(samples[0], "online-mobile", { lcpValue: NaN })[1], /largest-contentful-paint/);
});

test("missing, invalid, and failed samples cannot produce a median", () => {
  assert.throws(() => medianLcp([report(1)], "page"), /expected three/);
  for (const bad of [null, {}, report(-1), report(NaN), { runtimeError: { message: "failed" } }]) {
    assert.throws(() => medianLcp([report(1), bad, report(3)], "page"), /sample 2/);
  }
});

test("the summary enforces the median and requires every sample", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-lcp-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "samples"));
  for (const name of requiredReports) {
    await writeFile(join(directory, `${name}.json`), JSON.stringify(report(2900)));
    await writeFile(join(directory, "samples", `${name}-sample-2.json`), JSON.stringify(report(2300)));
    await writeFile(join(directory, "samples", `${name}-sample-3.json`), JSON.stringify(report(2400)));
  }
  const run = () => promisify(execFile)(process.execPath, [
    fileURLToPath(new URL("./lighthouse-summary.mjs", import.meta.url)), directory, "--enforce", "--median-lcp",
  ]);
  const { stdout } = await run();
  assert.match(stdout, /median LCP: 2400\.0 ms \(samples: 2900\.0, 2300\.0, 2400\.0 ms\)/);
  await rm(join(directory, "samples", "online-mobile-sample-2.json"));
  await assert.rejects(run, (error) => /online-mobile: unable to read LCP sample 2/.test(error.stderr));
});
