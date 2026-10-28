import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { publicConfig } from "./build-content.mjs";

export async function buildSocialLinks(root, { offline = false, fetchImpl = fetch } = {}) {
  const { document, window } = parseHTML(await readFile(join(root, "professional", "index.html"), "utf8"));
  vm.runInNewContext(await readFile(join(root, "shared", "scripts", "social-links.js"), "utf8"), {
    window, URL, fetch: fetchImpl, AbortSignal,
  });
  const api = window.SocialLinks;
  let rows = api.defaults;
  if (!offline) {
    window.SUPABASE_CONFIG = await publicConfig(root);
    rows = await api.load();
  }
  api.renderProfessional(rows, document);
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(script.textContent);
    if (data["@type"] === "ProfilePage" && data.mainEntity) {
      data.mainEntity.sameAs = api.ordered(rows, "professional").map(row => row.url).filter(url => url.startsWith("https:"));
      script.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
    }
  }
  await writeFile(join(root, "professional", "index.html"), document.toString());
  const onlineFile = join(root, "online", "index.html");
  const { document: online } = parseHTML(await readFile(onlineFile, "utf8"));
  const grid = online.querySelector("#link-grid");
  if (!grid) throw new Error("Social links build requires the personal link grid.");
  const personal = api.ordered(rows, "personal");
  grid.replaceChildren(...personal.map(row => api.anchor(row, online, true)));
  grid.setAttribute("data-social-links-snapshot", JSON.stringify(personal));
  online.querySelector("#link-count").textContent = `${String(personal.length).padStart(2, "0")} NODES`;
  await writeFile(onlineFile, online.toString());
  console.log(`Built professional social links from ${rows.length} published link(s).`);
}
