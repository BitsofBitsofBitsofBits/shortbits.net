import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { checkPerformanceBudget, requiredReports } from "./performance-budgets.mjs";
import { medianLcp } from "./lighthouse-lcp.mjs";

// Prints category scores and failing audits from Lighthouse JSON reports in a directory.
const reportDir = process.argv[2] ?? "lighthouse-reports";
const files = (await readdir(reportDir)).filter((file) => (
  file.endsWith(".json") && !/\.(?:trace|devtoolslog)\.json$/.test(file)
)).sort();
const summary = [];
const failures = [];
const enforce = process.argv.includes("--enforce");
const useMedianLcp = process.argv.includes("--median-lcp");
if (enforce) {
  for (const name of requiredReports) {
    if (!files.includes(`${name}.json`)) failures.push(`Missing required Lighthouse report: ${name}`);
  }
}

for (const file of files) {
  const report = JSON.parse(await readFile(join(reportDir, file), "utf8"));
  const name = file.replace(/\.json$/, "");
  let lcp;
  if (useMedianLcp) {
    const samples = [report];
    for (const sample of [2, 3]) {
      const samplePath = join(reportDir, "samples", `${name}-sample-${sample}.json`);
      try {
        samples.push(JSON.parse(await readFile(samplePath, "utf8")));
      } catch (error) {
        throw new Error(`${name}: unable to read LCP sample ${sample} from ${samplePath}: ${error.message}`, { cause: error });
      }
    }
    lcp = medianLcp(samples, name);
  }
  if (enforce) failures.push(...checkPerformanceBudget(report, name, { lcpValue: lcp?.median }));
  const scores = Object.fromEntries(
    Object.values(report.categories ?? {}).map((category) => [
      category.id,
      typeof category.score === "number" ? Math.round(category.score * 100) : "N/A",
    ]),
  );
  summary.push(`| ${name} | ${scores.performance ?? "N/A"} | ${scores.accessibility ?? "N/A"} | ${scores["best-practices"] ?? "N/A"} | ${scores.seo ?? "N/A"} |${lcp ? ` ${lcp.median.toFixed(1)} ms |` : ""}`);

  console.log(`\n=== ${file} ===`);
  console.log(JSON.stringify(scores));
  if (lcp) console.log(`  median LCP: ${lcp.median.toFixed(1)} ms (samples: ${lcp.values.map((value) => value.toFixed(1)).join(", ")} ms)`);
  if (report.runtimeError) console.log(`  AUDIT ERROR: ${report.runtimeError.message}`);
  const metrics = ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"];
  for (const id of metrics) {
    const audit = report.audits?.[id];
    if (audit) {
      console.log(`  ${id}: ${audit.displayValue ?? "not measured"} (${typeof audit.score === "number" ? Math.round(audit.score * 100) : "N/A"})`);
    }
  }
  const failing = Object.values(report.audits ?? {})
    .filter((audit) => (
      audit.score !== null
      && audit.score < 0.9
      && !["notApplicable", "manual", "informative"].includes(audit.scoreDisplayMode)
    ))
    .sort((a, b) => a.score - b.score);
  for (const audit of failing) {
    console.log(`  FAIL ${audit.id} (${Math.round(audit.score * 100)}): ${audit.title}${audit.displayValue ? ` - ${audit.displayValue}` : ""}`);
    const items = audit.details?.items ?? [];
    for (const item of items.slice(0, 5)) {
      const label = item.url || item.node?.selector || item.node?.snippet || item.source?.url || item.description || item.label;
      if (label) {
        const extra = item.wastedBytes ? ` (${Math.round(item.wastedBytes / 1024)} KiB)` : item.wastedMs ? ` (${Math.round(item.wastedMs)} ms)` : "";
        console.log(`      - ${String(label).slice(0, 160)}${extra}`);
      }
    }
  }
}

const table = [
  `| Page | Performance | Accessibility | Best practices | SEO |${useMedianLcp ? " Median LCP |" : ""}`,
  `| --- | --- | --- | --- | --- |${useMedianLcp ? " --- |" : ""}`,
  ...summary,
].join("\n");
console.log(`\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Lighthouse\n\n${table}\n`);
}
if (failures.length) throw new Error(`Performance budgets failed:\n${failures.join("\n")}`);
