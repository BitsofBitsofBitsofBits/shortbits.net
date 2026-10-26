import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

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
    "wss://api.lanyard.rest/socket",
  ],
};
const frameDirective = `frame-src ${approvedFrameSources.join(" ")};`;
const imageDirective = "img-src 'self' data: https:;";
export function updateCaddyCsp(caddyfile) {
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
      const current = existing[1].trim().split(/\s+/).filter((source) => source !== "'none'");
      const merged = [...current, ...sources.filter((source) => !current.includes(source))];
      policy = policy.replace(directivePattern, `${directive} ${merged.join(" ")}`);
    } else {
      policy = `${policy.trim().replace(/;?$/, ";")} ${directive} 'self' ${sources.join(" ")};`;
    }
  }

  return caddyfile.replace(
    policyPattern,
    (_header, prefix, _policy, suffix) => `${prefix}${policy}${suffix}`,
  );
}

function findBlocks(source) {
  const blocks = [];
  const stack = [];
  let quote = "";
  let comment = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (comment) {
      if (char === "\n") comment = false;
      continue;
    }
    if (quote) {
      if (char === "\\" && quote === '"') {
        index++;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "#") {
      comment = true;
    } else if (char === '"' || char === "`") {
      quote = char;
    } else if (
      (char === "{" || char === "}")
      && (index === 0 || /\s/.test(source[index - 1]))
      && (index === source.length - 1 || /\s/.test(source[index + 1]))
    ) {
      if (char === "{") {
        const lineStart = source.lastIndexOf("\n", index - 1) + 1;
        const block = {
          start: lineStart,
          open: index,
          header: source.slice(lineStart, index).trim(),
          depth: stack.length,
        };
        stack.push(block);
      } else {
        const block = stack.pop();
        if (!block) throw new Error("Unbalanced Caddyfile blocks.");
        block.close = index;
        blocks.push(block);
      }
    }
  }
  if (stack.length || quote) throw new Error("Unbalanced Caddyfile blocks or quotes.");
  return blocks;
}

const staticCacheRules = [
  "  @bits_versioned_static {",
  "    path_regexp \\.(js|css)$",
  "    file {path}",
  "    expression `{http.request.uri.query.v}.matches('^[a-f0-9]{16}$')`",
  "  }",
  '  header @bits_versioned_static >Cache-Control "public, max-age=31536000, immutable"',
].join("\n");
const canonicalHostRules = [
  "  @bits_noncanonical_host host shortbits.net",
  "  redir @bits_noncanonical_host https://www.shortbits.net{uri} 308",
].join("\n");

export function updateCaddyConfig(caddyfile) {
  const blocks = findBlocks(caddyfile);
  const sites = blocks.filter((block) => (
    block.depth === 0
    && block.header.split(/[\s,]+/).some((address) => (
      /^(?:https?:\/\/)?(?:www\.)?shortbits\.net(?::(?:80|443))?$/.test(address)
    ))
  ));
  if (sites.length !== 1) {
    throw new Error("Cannot safely identify exactly one shortbits.net site block.");
  }
  const site = sites[0];
  if (!site.header.split(/[\s,]+/).some((address) => /^(?:https?:\/\/)?www\.shortbits\.net(?::(?:80|443))?$/.test(address))) {
    throw new Error("The site must declare www.shortbits.net before enabling the canonical-host redirect.");
  }
  let body = caddyfile.slice(site.open + 1, site.close);
  const nested = findBlocks(body);
  const rootLines = [...body.matchAll(/^[ \t]*root[ \t]+\*[ \t]+(?:"\/[^"\n]+"|\/[^\s{}]+)[ \t]*$/gm)]
    .filter((match) => !nested.some((block) => match.index > block.open && match.index < block.close));
  const policies = [...body.matchAll(/Content-Security-Policy\s+"[^"]*"/gi)];
  const headers = nested.filter((block) => block.header === "header" && block.depth === 0);
  const policy = policies[0];
  const policyLine = policy ? body.slice(body.lastIndexOf("\n", policy.index) + 1, policy.index) : "";
  if (
    rootLines.length !== 1
    || policies.length !== 1
    || !(
      /^\s*header\s+$/.test(policyLine)
      || headers.some((block) => policy.index > block.open && policy.index < block.close)
    )
  ) {
    throw new Error("The shortbits site needs one top-level absolute root and one unambiguous CSP header.");
  }
  // Custom route/matcher trees need a human review before changing response caching.
  if (nested.some((block) => block.depth === 0 && /^(?:route|handle|handle_path)\b/.test(block.header))) {
    throw new Error("Cannot safely rewrite a shortbits site with custom routing blocks.");
  }
  const customRoutes = [...body.matchAll(/^[ \t]*(?:import|reverse_proxy|rewrite|try_files)\b/gm)]
    .filter((match) => !nested.some((block) => match.index > block.open && match.index < block.close));
  if (customRoutes.length) {
    throw new Error("Cannot safely rewrite a shortbits site with custom routing directives.");
  }

  const serverBlocks = nested.filter((block) => block.depth === 0 && block.header === "file_server");
  const plainServers = [...body.matchAll(/^[ \t]*file_server[ \t]*$/gm)]
    .filter((match) => !nested.some((block) => match.index > block.open && match.index < block.close));
  if (serverBlocks.length + plainServers.length !== 1) {
    throw new Error("The shortbits site needs exactly one top-level file_server.");
  }
  if (serverBlocks.length) {
    const server = serverBlocks[0];
    let options = body.slice(server.open + 1, server.close);
    if (/[{}]/.test(options) || /(?:^|\n)\s*root\b/.test(options)) {
      throw new Error("Cannot safely rewrite nested file_server options.");
    }
    const precompressed = [...options.matchAll(/^[ \t]*precompressed(?:[ \t]+[^\n]*)?$/gm)];
    if (precompressed.length > 1) {
      throw new Error("Ambiguous precompressed file_server settings.");
    }
    if (precompressed.length) {
      const existing = precompressed[0];
      const formats = existing[0].trim().split(/\s+/).slice(1);
      if (formats.some((format) => !["br", "gzip"].includes(format))) {
        throw new Error("Cannot safely replace custom precompressed formats.");
      }
      options = options.replace(existing[0], "    precompressed br gzip");
    } else {
      options = `${options.trimEnd()}\n    precompressed br gzip\n  `;
    }
    body = body.slice(0, server.open + 1) + options + body.slice(server.close);
  } else {
    body = body.replace(plainServers[0][0], "  file_server {\n    precompressed br gzip\n  }");
  }

  if (body.includes("@bits_versioned_static")) {
    if (!body.includes(staticCacheRules)) {
      throw new Error("Existing @bits_versioned_static rules differ; refusing an unsafe cache rewrite.");
    }
  } else {
    body = `${body.trimEnd()}\n${staticCacheRules}\n`;
  }
  if (body.includes("@bits_noncanonical_host")) {
    if (!body.includes(canonicalHostRules)) {
      throw new Error("Existing @bits_noncanonical_host rules differ; refusing an unsafe redirect rewrite.");
    }
  } else {
    body = `${body.trimEnd()}\n${canonicalHostRules}\n`;
  }
  body = updateCaddyCsp(body);
  return caddyfile.slice(0, site.open + 1) + body + caddyfile.slice(site.close);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const caddyfilePath = process.argv[2];
  if (!caddyfilePath) {
    throw new Error("Usage: node scripts/update-caddy-csp.mjs <Caddyfile>");
  }
  const caddyfile = await readFile(caddyfilePath, "utf8");
  await writeFile(caddyfilePath, updateCaddyConfig(caddyfile), "utf8");
}
