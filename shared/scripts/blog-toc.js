(function (root) {
  function render(body, document = root.document) {
    const headings = [];
    function visit(node) {
      for (const child of node.children) {
        if (/^H[1-6]$/.test(child.tagName)) headings.push(child);
        visit(child);
      }
    }
    visit(body);
    if (!headings.length) return null;
    const details = document.createElement("details");
    details.className = "blog-toc";
    const summary = document.createElement("summary");
    summary.textContent = "Table of Contents";
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Article sections");
    const list = document.createElement("ul");
    const used = new Set();
    const parents = [];
    for (const heading of headings) {
      const label = heading.textContent.trim().replace(/\s+/g, " ") || "Section";
      const slug = label.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
      const base = `blog-heading-${slug}`;
      let id = base;
      for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}`;
      used.add(id);
      heading.id = id;
      heading.tabIndex = -1;
      const level = Number(heading.tagName.slice(1));
      while (parents.length && parents.at(-1).level >= level) parents.pop();
      const parent = parents.at(-1);
      if (parent && !parent.list) {
        parent.list = document.createElement("ul");
        parent.item.append(parent.list);
      }
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent = label;
      item.append(link);
      (parent ? parent.list : list).append(item);
      parents.push({ level, item });
    }
    nav.append(list);
    details.append(summary, nav);
    return details;
  }
  const api = Object.freeze({ render });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BITS_BLOG_TOC = api;
})(typeof window === "undefined" ? globalThis : window);
