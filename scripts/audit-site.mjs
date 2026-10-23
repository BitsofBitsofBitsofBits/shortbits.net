import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startSiteServer } from "./site-server.mjs";

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
const cli = fileURLToPath(new URL("../node_modules/lighthouse/cli/index.js", import.meta.url));
function run(argumentsList) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, argumentsList, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`Audit command failed with exit ${code}.`)));
  });
}
const server = await startSiteServer(root);
try {
  for (const [name, path] of pages) {
    for (const preset of ["mobile", "desktop"]) {
      await run([
        cli, `${server.origin}${path}`,
        ...(preset === "desktop" ? ["--preset=desktop"] : []),
        ...(name === "online" && preset === "mobile" ? ["--save-assets"] : []),
        "--only-categories=performance,accessibility,best-practices,seo",
        "--chrome-flags=--headless=new --no-sandbox",
        "--output=json", `--output-path=${join(output, `${name}-${preset}.json`)}`, "--quiet",
      ]);
      console.log(`Audited ${name}-${preset}.`);
    }
  }
  await run([
    fileURLToPath(new URL("./lighthouse-summary.mjs", import.meta.url)), output,
    ...(args.includes("--enforce") ? ["--enforce"] : []),
  ]);
} finally {
  await server.close();
}
