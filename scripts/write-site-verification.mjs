import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function writeSiteVerification(root, content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("GOOGLE_SITE_VERIFICATION is required for production deployment.");
  }
  const match = /^google-site-verification: (google[a-f0-9]+\.html)$/.exec(content.trim());
  if (!match) throw new Error("GOOGLE_SITE_VERIFICATION must contain Google's HTML verification file contents.");
  await writeFile(join(root, match[1]), content);
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--root");
  if (index >= 0 && !process.argv[index + 1]) throw new Error("--root requires a directory.");
  await writeSiteVerification(resolve(index < 0 ? ".site-build" : process.argv[index + 1]),
    process.env.GOOGLE_SITE_VERIFICATION);
}
