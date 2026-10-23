import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootIndex = process.argv.indexOf("--root");
if (rootIndex >= 0 && !process.argv[rootIndex + 1]) throw new Error("--root requires a directory.");
const root = resolve(rootIndex < 0
  ? resolve(dirname(fileURLToPath(import.meta.url)), "..")
  : process.argv[rootIndex + 1]);
function discoverHtml(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return discoverHtml(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [relative(root, path)] : [];
  });
}
const htmlFiles = discoverHtml(root);
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
      || reference.startsWith("tel:")
      || reference.startsWith("data:")
      || reference === "/"
    ) {
      continue;
    }

    const assetPath = reference
      .replace(/^\/+/, "")
      .split(/[?#]/, 1)[0];
    const resolvedAsset = reference.startsWith("/")
      ? resolve(root, assetPath)
      : resolve(dirname(resolve(root, htmlFile)), assetPath);
    if (assetPath && !existsSync(resolvedAsset)) {
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
