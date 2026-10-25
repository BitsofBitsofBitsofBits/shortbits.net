import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditPage } from "./lighthouse-runner.mjs";

const goodReport = {
  categories: { performance: { id: "performance", score: 0.95 } },
  audits: {},
};
const traceError = { runtimeError: { code: "NO_NAVSTART", message: "Trace recording failed (NO_NAVSTART)" } };
const sessionError = "Unhandled Rejection. Reason: Error: Protocol error (Target.getTargetInfo): Protocol error (Target.getTargetInfo): Session with given id not found.";

async function setup(t, outcomes) {
  const directory = await mkdtemp(join(tmpdir(), "shortbits-lighthouse-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = [], warnings = [], waits = [];
  const outputPath = join(directory, "online-mobile.json");
  const run = () => auditPage({
    url: "https://example.com/online/", outputPath, preset: "mobile", saveAssets: true,
  }, {
    execute: async (args) => {
      const outcome = outcomes[calls.length];
      assert.ok(outcome, "must not run more attempts than expected");
      calls.push(args);
      const path = args.find((arg) => arg.startsWith("--output-path=")).slice("--output-path=".length);
      if (outcome.error) throw outcome.error;
      if (outcome.report) await writeFile(path, JSON.stringify(outcome.report));
      if (outcome.raw) await writeFile(path, outcome.raw);
      return { code: outcome.code ?? 0, stderr: outcome.stderr ?? "" };
    },
    wait: async (ms) => waits.push(ms),
    warn: (message) => warnings.push(message),
  });
  return { directory, outputPath, calls, warnings, waits, run };
}

test("successful audits run once and preserve canonical and attempt reports", async (t) => {
  const app = await setup(t, [{ report: goodReport }]);
  assert.deepEqual(await app.run(), goodReport);
  assert.deepEqual(JSON.parse(await readFile(app.outputPath, "utf8")), goodReport);
  assert.equal(app.calls.length, 1);
  assert.ok(app.calls[0].includes("--save-assets"));
  assert.ok(!app.calls[0].includes("--preset=desktop"));
  assert.equal(app.warnings.length, 0);
  assert.equal((await readdir(join(app.directory, "attempts"))).length, 1);
});

test("trace failures retry with fresh report paths and preserve failed evidence", async (t) => {
  const app = await setup(t, [{ code: 1, report: traceError }, { report: goodReport }]);
  assert.deepEqual(await app.run(), goodReport);
  assert.equal(app.calls.length, 2);
  assert.equal(app.warnings.length, 1);
  assert.deepEqual(app.waits, [1500]);
  assert.equal((await readdir(join(app.directory, "attempts"))).length, 2);
  assert.deepEqual(JSON.parse(await readFile(app.outputPath, "utf8")), goodReport);
});

test("the observed Chrome session crash retries even when no JSON report exists", async (t) => {
  const app = await setup(t, [{ code: 1, stderr: sessionError }, { report: goodReport }]);
  await app.run();
  assert.equal(app.calls.length, 2);
  assert.ok(app.warnings[0].includes("Session with given id not found"));
});

test("exhausted retries fail after three attempts and retain the runtime error", async (t) => {
  const app = await setup(t, Array(3).fill({ code: 1, report: traceError }));
  await assert.rejects(app.run, /attempt 3.*NO_NAVSTART/);
  assert.equal(app.calls.length, 3);
  assert.equal(app.warnings.length, 2);
  assert.deepEqual(JSON.parse(await readFile(app.outputPath, "utf8")), traceError);
});

test("measured low scores are not retried or replaced with a better run", async (t) => {
  const low = { ...goodReport, categories: { performance: { id: "performance", score: 0.4 } } };
  const app = await setup(t, [{ report: low }]);
  assert.deepEqual(await app.run(), low);
  assert.equal(app.calls.length, 1);
});

test("page errors, malformed reports, and process-launch errors fail without retries", async (t) => {
  for (const outcome of [
    { code: 1, report: { runtimeError: { code: "CHROME_INTERSTITIAL_ERROR", message: "Certificate error" } } },
    { code: 1, stderr: "Unknown command-line option" },
    { raw: "invalid JSON" },
    { error: new Error("ENOENT: executable missing") },
    {},
  ]) {
    const app = await setup(t, [outcome]);
    await assert.rejects(app.run);
    assert.equal(app.calls.length, 1);
    assert.equal(app.warnings.length, 0);
  }
});

test("stale reports cannot turn a failed rerun into a passing audit", async (t) => {
  const app = await setup(t, [{ code: 1, stderr: "Unexpected failure" }]);
  await writeFile(app.outputPath, JSON.stringify(goodReport));
  await mkdir(join(app.directory, "attempts"));
  await writeFile(join(app.directory, "attempts", "online-mobile-attempt-1.json"), JSON.stringify(goodReport));
  await assert.rejects(app.run);
  await assert.rejects(readFile(app.outputPath), { code: "ENOENT" });
});

test("summary labels missing measurements as N/A and reports the trace error", async (t) => {
  const app = await setup(t, []);
  await writeFile(app.outputPath, JSON.stringify({
    ...traceError,
    categories: { performance: { id: "performance", score: null } },
  }));
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL("./lighthouse-summary.mjs", import.meta.url)), app.directory,
  ]);
  assert.match(stdout, /\| online-mobile \| N\/A \| N\/A \| N\/A \| N\/A \|/);
  assert.match(stdout, /AUDIT ERROR:.*NO_NAVSTART/);
});
