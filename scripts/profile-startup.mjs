import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
if (rootIndex >= 0 && !args[rootIndex + 1]) throw new Error("--root requires a directory.");
const urlIndex = args.indexOf("--url");
if (urlIndex >= 0 && !args[urlIndex + 1]) throw new Error("--url requires an absolute URL.");
const outputIndex = args.indexOf("--output");
if (outputIndex >= 0 && !args[outputIndex + 1]) throw new Error("--output requires a file.");
const server = urlIndex < 0 ? await startSiteServer(resolve(rootIndex < 0 ? ".site-build" : args[rootIndex + 1])) : null;
const target = new URL(urlIndex < 0 ? `${server.origin}/online/` : args[urlIndex + 1]);
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await client.send("Profiler.enable");
  await client.send("Profiler.start");
  const response = await page.goto(target.href, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error("Unable to load the staged online page for profiling.");
  await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
  const { profile } = await client.send("Profiler.stop");
  if (outputIndex >= 0) await writeFile(resolve(args[outputIndex + 1]), JSON.stringify(profile));
  const self = new Map();
  const totals = new Map();
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children || []) parents.set(child, node.id);
  }
  profile.samples.forEach((id, index) => {
    const duration = profile.timeDeltas[index] || 0;
    self.set(id, (self.get(id) || 0) + duration);
    for (let ancestor = id; ancestor; ancestor = parents.get(ancestor)) {
      totals.set(ancestor, (totals.get(ancestor) || 0) + duration);
    }
  });
  const summary = profile.nodes
    .filter((node) => node.callFrame.url.startsWith(target.origin))
    .map((node) => ({
      file: new URL(node.callFrame.url).pathname,
      function: node.callFrame.functionName || "(top level)",
      line: node.callFrame.lineNumber + 1,
      selfMs: Math.round((self.get(node.id) || 0) / 1000),
      totalMs: Math.round((totals.get(node.id) || 0) / 1000),
    }))
    .sort((first, second) => second.totalMs - first.totalMs)
    .slice(0, 30);
  console.log(JSON.stringify({ browser: await browser.version(), cpuSlowdown: 4, startup: summary }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
}
