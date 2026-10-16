import { readFile, writeFile } from "node:fs/promises";

const caddyfilePath = process.argv[2];
if (!caddyfilePath) {
  throw new Error("Usage: node scripts/update-caddy-csp.mjs <Caddyfile>");
}

const approvedFrameSources = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://open.spotify.com",
];
const frameDirective = `frame-src ${approvedFrameSources.join(" ")};`;
const imageDirective = "img-src 'self' data: https:;";
const caddyfile = await readFile(caddyfilePath, "utf8");
const policyPattern = /(Content-Security-Policy\s+")([^"]*)(")/i;
const match = caddyfile.match(policyPattern);

if (!match) {
  throw new Error(
    "The Caddyfile does not contain a quoted Content-Security-Policy header.",
  );
}

let policy = match[2];
if (/frame-src\s+[^;"]*;?/i.test(policy)) {
  policy = policy.replace(/frame-src\s+[^;"]*;?/i, frameDirective);
} else if (/font-src/i.test(policy)) {
  policy = policy.replace(/font-src/i, `${frameDirective} font-src`);
} else {
  policy = `${policy.trim().replace(/;?$/, ";")} ${frameDirective}`;
}
if (/img-src\s+[^;"]*;?/i.test(policy)) {
  policy = policy.replace(/img-src\s+[^;"]*;?/i, imageDirective);
} else {
  policy = `${policy.trim().replace(/;?$/, ";")} ${imageDirective}`;
}

const updated = caddyfile.replace(
  policyPattern,
  `$1${policy}$3`,
);
await writeFile(caddyfilePath, updated, "utf8");
