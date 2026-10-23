import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};
export async function startSiteServer(directory) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      const relativePath = relative(root, path);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      let metadata;
      try { metadata = await stat(path); } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        response.writeHead(404).end("Not found");
        return;
      }
      if (metadata.isDirectory()) path = join(path, "index.html");
      const headers = {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": /\.(?:js|css)$/.test(path) && /^[a-f0-9]{16}$/.test(url.searchParams.get("v") || "")
          ? "public, max-age=31536000, immutable" : "no-cache",
      };
      let body;
      const accepted = request.headers["accept-encoding"] || "";
      for (const [encoding, suffix] of [["br", ".br"], ["gzip", ".gz"]]) {
        if (!accepted.split(",").some((item) => item.trim().split(";")[0] === encoding)) continue;
        try {
          body = await readFile(`${path}${suffix}`);
          headers["Content-Encoding"] = encoding;
          headers.Vary = "Accept-Encoding";
          break;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      body ??= await readFile(path);
      headers["Content-Length"] = body.length;
      response.writeHead(200, headers);
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      console.error("Static test server request failed:", error);
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Unable to serve resource");
    }
  });
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListening);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolveClosed, reject) => {
      server.close((error) => error ? reject(error) : resolveClosed());
      server.closeAllConnections();
    }),
  };
}
