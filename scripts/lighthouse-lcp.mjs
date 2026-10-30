export function medianLcp(reports, name) {
  if (reports.length !== 3) throw new Error(`${name}: expected three Lighthouse LCP samples.`);
  const values = reports.map((report, index) => {
    if (!report || typeof report !== "object" || Array.isArray(report)) {
      throw new Error(`${name}: sample ${index + 1} is not a Lighthouse report.`);
    }
    if (report.runtimeError) {
      throw new Error(`${name}: sample ${index + 1} has a Lighthouse runtime error: ${report.runtimeError.message}`);
    }
    const value = report.audits?.["largest-contentful-paint"]?.numericValue;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name}: sample ${index + 1} has no valid LCP measurement.`);
    }
    return value;
  });
  return { values, median: [...values].sort((a, b) => a - b)[1] };
}
