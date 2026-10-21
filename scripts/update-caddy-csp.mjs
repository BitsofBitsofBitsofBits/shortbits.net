import { readFile, writeFile } from "node:fs/promises";

const caddyfilePath = process.argv[2];
if (!caddyfilePath) {
  throw new Error("Usage: node scripts/update-caddy-csp.mjs <Caddyfile>");
}

const turnstileOrigin = "https://challenges.cloudflare.com";
const approvedFrameSources = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://open.spotify.com",
  turnstileOrigin,
];
// Third-party origins that must be present in addition to whatever the server already allows.
const requiredSources = {
  "script-src": [
    "https://static.cloudflareinsights.com",
    turnstileOrigin,
  ],
  "connect-src": [
    "https://cloudflareinsights.com",
  ],
};
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

for (const [directive, sources] of Object.entries(requiredSources)) {
  const directivePattern = new RegExp(`${directive}\\s+([^;"]*)`, "i");
  const existing = policy.match(directivePattern);
  if (existing) {
    const current = existing[1].trim().split(/\s+/);
    const merged = [...current, ...sources.filter((source) => !current.includes(source))];
    policy = policy.replace(directivePattern, `${directive} ${merged.join(" ")}`);
  } else {
    policy = `${policy.trim().replace(/;?$/, ";")} ${directive} 'self' ${sources.join(" ")};`;
  }
}

const updated = caddyfile.replace(
  policyPattern,
  `$1${policy}$3`,
);
await writeFile(caddyfilePath, updated, "utf8");
