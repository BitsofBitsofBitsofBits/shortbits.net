import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = ["index.html", "admin.html", "404.html", "source.html"];
const missingAssets = [];

for (const htmlFile of htmlFiles) {
  const html = readFileSync(resolve(root, htmlFile), "utf8");
  const references = html.matchAll(/\b(?:href|src)="([^"]+)"/g);

  for (const [, reference] of references) {
    if (
      reference.startsWith("http://")
      || reference.startsWith("https://")
      || reference.startsWith("#")
      || reference.startsWith("mailto:")
      || reference === "/"
    ) {
      continue;
    }

    const assetPath = reference
      .replace(/^\/+/, "")
      .split(/[?#]/, 1)[0];
    if (assetPath && !existsSync(resolve(root, assetPath))) {
      missingAssets.push(`${htmlFile}: ${reference}`);
    }
  }
}

if (missingAssets.length > 0) {
  throw new Error(`Missing local assets:\n${missingAssets.join("\n")}`);
}

const buildInfo = JSON.parse(readFileSync(resolve(root, "build-info.json"), "utf8"));
if (
  typeof buildInfo.commit !== "string"
  || !/^[0-9a-f]{7,40}$/i.test(buildInfo.commit)
  || Number.isNaN(Date.parse(buildInfo.builtAt))
) {
  throw new Error("build-info.json does not contain a valid commit and timestamp.");
}

const robots = readFileSync(resolve(root, "robots.txt"), "utf8");
if (!robots.includes("https://www.shortbits.net/sitemap.xml")) {
  throw new Error("robots.txt does not advertise the production sitemap.");
}

console.log(`Validated ${htmlFiles.length} HTML files and their local assets.`);
