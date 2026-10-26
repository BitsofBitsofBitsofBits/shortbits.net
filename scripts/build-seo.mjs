import { readFile, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { parseHTML } from "linkedom";
import { escapeHtml, siteUrl } from "./build-content.mjs";

export const canonicalOrigin = siteUrl;
const labels = {
  "/": "shortbits.net",
  "/online/": "BitsofBitsofBits",
  "/professional/": "Professional profile",
  "/professional/resume/": "Resume",
  "/projects/": "IT & web projects",
  "/blog/": "Technical blog",
};
const jsonScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
export const pagePath = (file) => `/${file.replaceAll("\\", "/").replace(/(^|\/)index\.html$/, "$1")}`;
const isNoindex = (document) => /(?:^|[\s,])noindex(?:$|[\s,])/i.test(
  document.querySelector('meta[name="robots"]')?.getAttribute("content") || "",
);

export function enrichSeo(html, path) {
  if (/^\/google[a-f0-9]+\.html$/.test(path)
    && html.trim() === `google-site-verification: ${path.slice(1)}`) return html;
  const { document } = parseHTML(html);
  if (isNoindex(document)) return html;
  const url = `${canonicalOrigin}${path}`;
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const title = document.querySelector("title")?.textContent.trim();
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim();
  if (canonical !== url || !title || !description) {
    throw new Error(`SEO: ${path} needs a descriptive title, description, and self-canonical URL (${url}).`);
  }
  function meta(attribute, name, value) {
    let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, name);
      document.head.append(element);
    }
    element.setAttribute("content", value);
  }
  meta("property", "og:title", title);
  meta("property", "og:description", description);
  meta("property", "og:url", url);
  meta("property", "og:site_name", "shortbits.net");
  meta("property", "og:locale", "en_US");
  if (!document.head.querySelector('meta[property="og:type"]')) meta("property", "og:type", "website");
  if (!document.head.querySelector('meta[property="og:image"]')) {
    meta("property", "og:image", `${canonicalOrigin}/shared/images/social-preview.png`);
    meta("property", "og:image:alt", "BitsofBitsofBits, the personal website of Caleb K Masters.");
  }
  const image = document.head.querySelector('meta[property="og:image"]').getAttribute("content");
  if (!document.head.querySelector('meta[property="og:image:alt"]')) {
    meta("property", "og:image:alt", "shortbits.net, the personal website of Caleb K Masters.");
  }
  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", description);
  meta("name", "twitter:image", image);
  const imageAlt = document.head.querySelector('meta[property="og:image:alt"]')?.getAttribute("content");
  if (imageAlt) meta("name", "twitter:image:alt", imageAlt);
  const robots = document.head.querySelector('meta[name="robots"]')?.getAttribute("content") || "index, follow";
  if (!/max-image-preview:/i.test(robots)) meta("name", "robots", `${robots}, max-image-preview:large`);

  document.head.querySelector("script[data-seo]")?.remove();
  const schemas = [...document.head.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => ({ script, value: JSON.parse(script.textContent) }));
  const page = {
    "@id": `${url}#webpage`, url, name: title, description,
    inLanguage: "en-US", isPartOf: { "@id": `${canonicalOrigin}/#website` },
  };
  const existingPage = schemas.find(({ value }) => ["ProfilePage", "WebPage", "CollectionPage"].includes(value["@type"]));
  const graph = [];
  if (existingPage) {
    Object.assign(existingPage.value, page);
  } else {
    graph.push({ "@type": ["/blog/", "/projects/"].includes(path) ? "CollectionPage" : "WebPage", ...page });
  }
  if (path !== "/") {
    const parent = path.startsWith("/blog/articles/") ? "/blog/"
      : path.startsWith("/projects/") && path !== "/projects/" ? "/projects/"
        : path === "/professional/resume/" ? "/professional/" : null;
    const crumbs = ["/", ...(parent ? [parent] : []), path];
    const breadcrumbs = {
      "@type": "BreadcrumbList", "@id": `${url}#breadcrumbs`,
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem", position: index + 1,
        name: labels[crumb] || title, item: `${canonicalOrigin}${crumb}`,
      })),
    };
    graph.push(breadcrumbs);
    if (existingPage) {
      existingPage.value.breadcrumb = { "@id": breadcrumbs["@id"] };
    } else graph[0].breadcrumb = { "@id": breadcrumbs["@id"] };
  }
  if (["/blog/", "/projects/"].includes(path)) {
    const selector = path === "/blog/" ? "#blog-post-list h3 a[href]" : ".blog-post-list h2 a[href]";
    (existingPage?.value || graph[0]).mainEntity = {
      "@type": "ItemList",
      itemListElement: [...document.querySelectorAll(selector)].map((link, index) => ({
        "@type": "ListItem", position: index + 1,
        name: link.textContent.trim(), url: new URL(link.getAttribute("href"), url).href,
      })),
    };
  }
  if (path.startsWith("/blog/articles/")) graph[0].mainEntity = { "@id": `${url}#article` };
  if (existingPage) existingPage.script.textContent = jsonScript(existingPage.value);
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-seo", "");
  script.textContent = jsonScript({ "@context": "https://schema.org", "@graph": graph });
  document.head.append(script);
  const head = [...document.head.childNodes].map((node) => node.nodeName === "TITLE"
    ? `<title>${escapeHtml(title)}</title>` : node.toString()).join("");
  return html.replace(/<head>[\s\S]*?<\/head>/i, () => `<head>${head}</head>`);
}

export async function buildSeo(root, files) {
  for (const file of files.filter((path) => path.endsWith(".html"))) {
    const html = await readFile(file, "utf8");
    const enriched = enrichSeo(html, pagePath(relative(root, file)));
    if (enriched !== html) await writeFile(file, enriched);
  }
}

export function validateSeo(pages, sitemap) {
  const { document: xml } = parseHTML(sitemap);
  const urls = [...xml.querySelectorAll("url > loc")].map((node) => node.textContent.trim());
  if (!urls.length || new Set(urls).size !== urls.length) throw new Error("SEO: sitemap must contain unique page URLs.");
  const documents = new Map(pages.map(({ path, html }) => [path, parseHTML(html).document]));
  const titles = new Set();
  for (const url of urls) {
    const parsed = new URL(url);
    if (parsed.origin !== canonicalOrigin || parsed.search || parsed.hash) throw new Error(`SEO: noncanonical sitemap URL ${url}`);
    const document = documents.get(parsed.pathname);
    if (!document || isNoindex(document)) throw new Error(`SEO: sitemap URL is missing or noindex: ${url}`);
    if (document.querySelectorAll('link[rel="canonical"]').length !== 1
      || document.querySelector('link[rel="canonical"]').getAttribute("href") !== url) {
      throw new Error(`SEO: incorrect canonical for ${url}`);
    }
    const title = document.querySelector("title")?.textContent.trim();
    if (!title || titles.has(title) || !document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim()) {
      throw new Error(`SEO: missing/duplicate title or missing description for ${url}`);
    }
    titles.add(title);
    if (!document.querySelector("h1")) throw new Error(`SEO: missing static heading for ${url}`);
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    scripts.forEach((script) => JSON.parse(script.textContent));
    if (document.querySelector("script[data-seo]")) {
      for (const name of ["og:title", "og:description", "og:url", "og:image"]) {
        if (!document.querySelector(`meta[property="${name}"]`)?.getAttribute("content")) throw new Error(`SEO: missing ${name} for ${url}`);
      }
      if (document.querySelector('meta[property="og:url"]').getAttribute("content") !== url) throw new Error(`SEO: social URL differs from canonical for ${url}`);
    }
  }
  for (const [path, document] of documents) {
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    if (canonical && !isNoindex(document) && !urls.includes(canonical)) {
      throw new Error(`SEO: indexable page ${path} is absent from the sitemap.`);
    }
  }
  return urls.length;
}
