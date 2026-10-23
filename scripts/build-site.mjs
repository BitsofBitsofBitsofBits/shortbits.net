import { createHash } from "node:crypto";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

export async function versionAssets(directory) {
  const files = await filesUnder(directory);
  const assets = files.filter((file) => /\.(?:css|js)$/.test(file));
  const hash = createHash("sha256");
  for (const asset of assets) {
    hash.update(asset.slice(directory.length).replaceAll("\\", "/"));
    hash.update(await readFile(asset));
  }
  const version = hash.digest("hex").slice(0, 16);
  for (const file of files.filter((path) => /\.(?:html|css|js)$/.test(path))) {
    const source = await readFile(file, "utf8");
    const updated = source.replace(
      /(?<=[="'`(])\/(?!\/)[^"'`\s<>?#]*?\.(?:css|js)(?=[?"'`#)\s]|$)(?:\?[^"'`\s<>#)]*)?/g,
      (url) => {
        const queryIndex = url.indexOf("?");
        const path = queryIndex < 0 ? url : url.slice(0, queryIndex);
        const query = queryIndex < 0 ? [] : url.slice(queryIndex + 1).split("&").filter((part) => part && !part.startsWith("v="));
        return `${path}?${[...query, `v=${version}`].join("&")}`;
      },
    );
    if (updated !== source) await writeFile(file, updated);
  }
  return version;
}

export async function compressAssets(directory) {
  for (const file of await filesUnder(directory)) {
    if (!/\.(?:html|css|js|json|xml|svg|txt)$/.test(file)) continue;
    const content = await readFile(file);
    if (content.length < 1024) continue;
    await Promise.all([
      writeFile(`${file}.gz`, gzipSync(content, { level: 9 })),
      writeFile(`${file}.br`, brotliCompressSync(content)),
    ]);
  }
}

export async function buildSite(output, contentInput) {
  const destination = resolve(output);
  if (destination === root || root.startsWith(`${destination}\\`) || root.startsWith(`${destination}/`)) {
    throw new Error("Build output must not be the repository or one of its ancestors.");
  }
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) throw new Error("Build output must be an empty directory.");
  const themeBuild = spawnSync(process.execPath, [join(root, "scripts", "build-theme-css.mjs")], { stdio: "inherit" });
  if (themeBuild.error) throw themeBuild.error;
  if (themeBuild.status !== 0) throw new Error(`Shared theme CSS generation failed (exit ${themeBuild.status}).`);
  const directories = new Set(["admin", "blog", "boot", "images", "layouts", "online", "professional", "projects"]);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if ((entry.isDirectory() && directories.has(entry.name))
      || (entry.isFile() && (/\.(?:html|css|js)$/.test(entry.name)
        || ["robots.txt", "sitemap.xml", "build-info.json"].includes(entry.name)))) {
      await cp(join(root, entry.name), join(destination, entry.name), { recursive: true });
    }
  }
  const argumentsList = [join(root, "scripts", "build-content.mjs"), "--output", destination];
  if (contentInput) argumentsList.push("--input", resolve(contentInput));
  const generation = spawnSync(process.execPath, argumentsList, { stdio: "inherit" });
  if (generation.error) throw generation.error;
  if (generation.status !== 0) throw new Error(`Content generation failed (exit ${generation.status}).`);
  const version = await versionAssets(destination);
  await compressAssets(destination);
  console.log(`Built static site at ${destination} with asset version ${version}.`);
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(`--${name}`);
    if (index < 0) return undefined;
    if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`--${name} requires a value.`);
    return args[index + 1];
  };
  await buildSite(option("output") || join(root, ".site-build"), option("input"));
}
