import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { publicConfig } from "./build-content.mjs";
import featuredProject from "../shared/scripts/featured-project.js";

export async function buildFeaturedProject(root, { offline = false, fetchImpl = fetch } = {}) {
  let project;
  if (offline) {
    project = JSON.parse(await readFile(new URL("./fixtures/featured-project.json", import.meta.url), "utf8"));
  } else {
    const { url, anonKey } = await publicConfig(root);
    const response = await fetchImpl(
      `${url.replace(/\/$/, "")}/rest/v1/site_featured_project?select=title,summary,status,tags,link_url,link_label&enabled=eq.true&position=eq.1`,
      { headers: { apikey: anonKey }, signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error(`Featured project build failed with HTTP ${response.status}.`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length > 1) throw new Error("Invalid featured project build response.");
    [project] = rows;
  }
  const file = join(root, "online", "index.html");
  const { document } = parseHTML(await readFile(file, "utf8"));
  featuredProject.render(document, project);
  await writeFile(file, document.toString());
  console.log(`Built ${project ? "published" : "empty"} featured project snapshot.`);
}
