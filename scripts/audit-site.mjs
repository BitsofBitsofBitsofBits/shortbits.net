import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startSiteServer } from "./site-server.mjs";
import { auditPage } from "./lighthouse-runner.mjs";

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`--${name} requires a value.`);
  return args[index + 1];
}
const root = resolve(option("root", ".site-build"));
const output = resolve(option("output", "lighthouse-reports"));
await mkdir(output, { recursive: true });
const pages = [
  ["chooser", "/?choose"], ["online", "/online/"],
  ["professional", "/professional/"], ["professional-resume", "/professional/resume/"],
].filter(([name]) => !option("page", "") || option("page", "") === name);
if (!pages.length) throw new Error("Unknown --page. Use chooser, online, professional, or professional-resume.");
function run(argumentsList) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, argumentsList, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`Audit command failed with exit ${code}.`)));
  });
}
const liveUrl = option("url", "");
if (liveUrl) {
  const parsed = new URL(liveUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("--url must be an HTTP(S) URL without credentials.");
  }
}
const server = liveUrl ? null : await startSiteServer(root);
const origin = liveUrl || server.origin;
const failures = [];
const medianLcp = args.includes("--median-lcp");
try {
  for (const [name, path] of pages) {
    for (const preset of ["mobile", "desktop"]) {
      for (let sample = 1; sample <= (medianLcp ? 3 : 1); sample++) {
        try {
          await auditPage({
            url: new URL(path, origin).href,
            preset,
            outputPath: sample === 1
              ? join(output, `${name}-${preset}.json`)
              : join(output, "samples", `${name}-${preset}-sample-${sample}.json`),
            saveAssets: sample === 1 && preset === "mobile" && (name === "online" || Boolean(liveUrl)),
          });
          console.log(`Audited ${name}-${preset}${medianLcp ? ` (sample ${sample}/3)` : ""}.`);
        } catch (error) {
          failures.push(error.message);
          console.error(`Lighthouse audit failed: ${error.message}`);
        }
      }
    }
  }
  await run([
    fileURLToPath(new URL("./lighthouse-summary.mjs", import.meta.url)), output,
    ...(args.includes("--enforce") ? ["--enforce"] : []),
    ...(medianLcp ? ["--median-lcp"] : []),
  ]);
  if (failures.length) throw new Error(`Lighthouse could not complete:\n${failures.join("\n")}`);
} finally {
  if (server) await server.close();
}
