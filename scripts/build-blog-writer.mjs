import { build } from "esbuild";
import { fileURLToPath } from "node:url";

export async function buildBlogWriter() {
  await build({
    entryPoints: [fileURLToPath(new URL("./blog-writer-entry.mjs", import.meta.url))],
    outfile: fileURLToPath(new URL("../admin/scripts/blog-writer.js", import.meta.url)),
    bundle: true, format: "iife", minify: true, target: ["es2022"],
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildBlogWriter();
