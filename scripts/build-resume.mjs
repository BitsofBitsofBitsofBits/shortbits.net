import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { publicConfig } from "./build-content.mjs";

export async function resumeContext(root, document) {
  const context = vm.createContext({ window: {}, document });
  for (const script of ["shared/scripts/career-format.js", "shared/scripts/career-data.js", "professional/resume/scripts/resume-content.js"]) {
    vm.runInContext(await readFile(join(root, script), "utf8"), context, { filename: script, timeout: 1000 });
  }
  return context.window;
}

export async function fetchResume(config, queries, fetchImpl = fetch) {
  const records = await Promise.all(Object.entries(queries).map(async ([name, query]) => {
    const rows = [];
    for (;;) {
      const response = await fetchImpl(`${config.url}/rest/v1/${query}&limit=500&offset=${rows.length}`, {
        headers: { apikey: config.anonKey }, signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Resume build: ${name} fetch failed (HTTP ${response.status}).`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error(`Resume build: ${name} response was not an array.`);
      rows.push(...page);
      if (page.length < 500) break;
    }
    return [name, name === "profile" ? rows[0] ?? null : rows];
  }));
  return Object.fromEntries(records);
}

export async function buildResume({ root, input, fetchImpl = fetch, env = process.env } = {}) {
  const file = join(root, "professional", "resume", "index.html");
  const { document } = parseHTML(await readFile(file, "utf8"));
  const api = await resumeContext(root, document);
  const data = input ? JSON.parse(await readFile(input, "utf8"))
    : await fetchResume(await publicConfig(root, env), api.CareerData.queries, fetchImpl);
  const serialized = api.ResumeContent.serialize(data);
  api.ResumeContent.render(data);
  const sheet = document.querySelector(".resume-sheet");
  if (!sheet || !document.querySelector("#resume-status")) throw new Error("Resume build: template elements are missing.");
  sheet.dataset.resumeSnapshot = createHash("sha256").update(serialized).digest("hex");
  sheet.classList.remove("is-loading");
  sheet.removeAttribute("aria-busy");
  document.querySelector("#resume-status").textContent = data.profile ? "Saved resume." : "Saved fallback. Public data unavailable.";
  await writeFile(file, document.toString());
  console.log("Built a visible public resume snapshot; live updates require explicit confirmation.");
}
