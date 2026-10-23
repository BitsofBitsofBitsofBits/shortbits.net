export const requiredReports = [
  "chooser-desktop", "chooser-mobile", "online-desktop", "online-mobile",
  "professional-desktop", "professional-mobile",
  "professional-resume-desktop", "professional-resume-mobile",
];

export function checkPerformanceBudget(report, name) {
  const failures = [];
  if (report.runtimeError) failures.push(`${name}: Lighthouse runtime error: ${report.runtimeError.message}`);
  for (const [category, minimum] of [["performance", 0.9], ["accessibility", 1], ["seo", 1]]) {
    const score = report.categories?.[category]?.score;
    if (typeof score !== "number" || score < minimum) {
      failures.push(`${name}: ${category} must be at least ${minimum * 100}; received ${typeof score === "number" ? Math.round(score * 100) : "no score"}`);
    }
  }
  for (const [id, maximum] of [["cumulative-layout-shift", 0.1], ["largest-contentful-paint", 2500]]) {
    const value = report.audits?.[id]?.numericValue;
    if (typeof value !== "number" || value > maximum) {
      failures.push(`${name}: ${id} must be <= ${maximum}; received ${value ?? "no measurement"}`);
    }
  }
  return failures;
}
