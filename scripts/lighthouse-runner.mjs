import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../node_modules/lighthouse/cli/index.js", import.meta.url));

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      stderr = (stderr + chunk).slice(-16_384);
    });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stderr }));
  });
}

export async function auditPage({ url, outputPath, preset, saveAssets = false }, {
  execute = runCommand, wait = delay, warn = console.warn,
} = {}) {
  const attemptsDirectory = join(dirname(outputPath), "attempts");
  await mkdir(attemptsDirectory, { recursive: true });
  await rm(outputPath, { force: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const attemptPath = join(attemptsDirectory, `${basename(outputPath, ".json")}-attempt-${attempt}.json`);
    await rm(attemptPath, { force: true });
    const result = await execute([
      url,
      ...(preset === "desktop" ? ["--preset=desktop"] : []),
      ...(saveAssets ? ["--save-assets"] : []),
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless=new --no-sandbox",
      "--output=json", `--output-path=${attemptPath}`, "--quiet",
    ]);
    let report = null;
    let source;
    try {
      source = await readFile(attemptPath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (source !== undefined) {
      report = JSON.parse(source);
      if (!report || typeof report !== "object" || Array.isArray(report)) {
        throw new Error(`Invalid Lighthouse report: ${attemptPath}`);
      }
      await copyFile(attemptPath, outputPath);
    }
    if (result.code === 0 && report && !report.runtimeError) return report;
    const traceError = report?.runtimeError?.code === "NO_NAVSTART";
    const sessionError = /Protocol error \(Target\.getTargetInfo\):[\s\S]*Session with given id not found/.test(result.stderr);
    const reason = report?.runtimeError?.message
      || result.stderr.trim()
      || `Lighthouse exited with ${result.signal || result.code} without a usable report.`;
    if (attempt === 3 || (!traceError && !sessionError)) {
      throw new Error(`${url} (${preset}), attempt ${attempt}: ${reason}`);
    }
    warn(`Retrying Lighthouse after a browser/trace failure (${attempt}/3): ${url} (${preset}). ${reason}`);
    await wait(1500);
  }
}
