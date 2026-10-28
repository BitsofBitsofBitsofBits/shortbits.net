import { createHash } from "node:crypto";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build, transform } from "esbuild";
import { buildResume } from "./build-resume.mjs";
import { buildSeo } from "./build-seo.mjs";
import { parseHTML } from "linkedom";
import { filterCssForMarkup } from "./build-theme-css.mjs";

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

export async function optimizeStyles(directory) {
  const onlinePath = join(directory, "online", "index.html");
  const onlineHtml = await readFile(onlinePath, "utf8");
  const stylesheetPattern = /<link rel="stylesheet" href="([^"]+)">/g;
  const onlineSheets = [...onlineHtml.matchAll(stylesheetPattern)];
  if (!onlineSheets.length) throw new Error("The online page has no stylesheets to optimize.");
  const imports = onlineSheets.map(([, href]) => {
    if (!href.startsWith("/") || href.startsWith("//")) {
      throw new Error(`Expected a local online stylesheet, received ${href}.`);
    }
    return `@import ${JSON.stringify(href.split("?")[0].slice(1))};`;
  }).join("\n");
  const bundled = await build({
    stdin: { contents: imports, loader: "css", resolveDir: directory },
    bundle: true,
    minify: true,
    write: false,
    outfile: join(directory, "online", "styles", "site.css"),
    target: ["chrome105", "firefox102", "safari15.6"],
    logLevel: "silent",
  });
  if (bundled.outputFiles.length !== 1) throw new Error("Online CSS optimization produced unexpected assets.");
  await mkdir(join(directory, "online", "styles"), { recursive: true });
  await writeFile(join(directory, "online", "styles", "site.css"), bundled.outputFiles[0].contents);
  const { document } = parseHTML(onlineHtml);
  document.querySelectorAll("[hidden]").forEach((element) => {
    if (element.id !== "boot-screen") element.remove();
  });
  const critical = await transform(filterCssForMarkup(bundled.outputFiles[0].text, document.toString()), {
    loader: "css", minify: true, target: ["chrome105", "firefox102", "safari15.6"],
  });
  let first = true;
  await writeFile(onlinePath, onlineHtml.replace(stylesheetPattern, () => {
    if (!first) return "";
    first = false;
    return `<style data-online-critical>${critical.code.replace(/<\/style/gi, "<\\/style")}</style>`
      + '<link rel="stylesheet" href="/online/styles/site.css" media="print" data-online-styles>'
      + '<noscript><link rel="stylesheet" href="/online/styles/site.css"></noscript>';
  }));

  for (const file of (await filesUnder(directory)).filter((path) => path.endsWith(".css"))) {
    const source = await readFile(file, "utf8");
    const result = await transform(source, {
      loader: "css", minify: true, target: ["chrome105", "firefox102", "safari15.6"],
      sourcefile: file,
    });
    await writeFile(file, result.code);
  }
  const resumePath = join(directory, "professional", "resume", "index.html");
  const resumeHtml = await readFile(resumePath, "utf8");
  const resumeCss = await readFile(join(directory, "professional", "resume", "styles", "resume.css"), "utf8");
  if (Buffer.byteLength(resumeCss) > 8192) throw new Error("Résumé CSS exceeds the 8 KiB inline budget.");
  const resumeSheet = /<link rel="stylesheet" href="\/professional\/resume\/styles\/resume\.css(?:\?[^"]*)?">/;
  if (!resumeSheet.test(resumeHtml)) throw new Error("Unable to locate the résumé stylesheet.");
  await writeFile(resumePath, resumeHtml.replace(resumeSheet,
    `<style data-resume-styles>${resumeCss.replace(/<\/style/gi, "<\\/style")}</style>`));
}

export async function optimizeStartup(directory) {
  const file = join(directory, "online", "index.html");
  const html = await readFile(file, "utf8");
  const pattern = /(<script src="\/shared\/scripts\/accessibility\.js(?:\?[^"]*)?"><\/script>\s*)?<script src="\/shared\/scripts\/seasonal-calendar\.js(?:\?[^"]*)?"><\/script>\s*<script src="\/shared\/scripts\/theme-init\.js(?:\?[^"]*)?"><\/script>\s*<script src="\/online\/scripts\/boot\.js(?:\?[^"]*)?"><\/script>/;
  if (!pattern.test(html)) throw new Error("Unable to locate the ordered online startup scripts.");
  const sources = await Promise.all([...(html.match(pattern)[1] ? ["shared/scripts/accessibility.js"] : []),
    "shared/scripts/seasonal-calendar.js", "shared/scripts/theme-init.js", "online/scripts/boot.js"]
    .map((name) => readFile(join(directory, name), "utf8")));
  // Keep classic-script globals visible to the deferred runtime; do not bundle into a module or IIFE.
  const result = await transform(sources.join("\n;\n"), {
    loader: "js", minify: true, treeShaking: false,
    target: ["chrome105", "firefox102", "safari15.6"],
  });
  await mkdir(join(directory, "online", "scripts"), { recursive: true });
  await writeFile(join(directory, "online", "scripts", "startup.js"), result.code);
  await writeFile(file, html.replace(pattern, '<script src="/online/scripts/startup.js"></script>'));
}

export async function buildSite(output, contentInput, resumeInput) {
  const destination = resolve(output);
  if (destination === root || root.startsWith(`${destination}\\`) || root.startsWith(`${destination}/`)) {
    throw new Error("Build output must not be the repository or one of its ancestors.");
  }
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) throw new Error("Build output must be an empty directory.");
  const themeBuild = spawnSync(process.execPath, [join(root, "scripts", "build-theme-css.mjs")], { stdio: "inherit" });
  if (themeBuild.error) throw themeBuild.error;
  if (themeBuild.status !== 0) throw new Error(`Shared theme CSS generation failed (exit ${themeBuild.status}).`);
  const directories = new Set(["admin", "blog", "boot", "home", "not-found", "nowplaying", "online", "professional", "projects", "shared", "useless"]);
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
  await buildResume({
    root: destination,
    input: resumeInput || (contentInput ? join(root, "scripts", "fixtures", "resume-data.json") : undefined),
  });
  await buildSeo(destination, await filesUnder(destination));
  await optimizeStyles(destination);
  await optimizeStartup(destination);
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
  await buildSite(option("output") || join(root, ".site-build"), option("input"), option("resume-input"));
}
