((root) => {
  function render(document, project) {
    const section = document.querySelector("#featured-project-section");
    if (!section) throw new Error("Featured project section is missing.");
    if (!project) {
      section.hidden = true;
      return;
    }
    const url = new URL(project.link_url);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Featured project requires an HTTPS link without credentials.");
    }
    for (const field of ["title", "summary", "status", "tags", "link_label"]) {
      if (typeof project[field] !== "string") throw new Error(`Invalid featured project ${field}.`);
    }
    document.querySelector("#featured-project-title").textContent = project.title;
    document.querySelector("#featured-project-summary").textContent = project.summary;
    const status = document.querySelector("#featured-project-status");
    status.textContent = project.status;
    status.hidden = !project.status;
    const tags = document.querySelector("#featured-project-tags");
    tags.replaceChildren(...project.tags.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => {
      const item = document.createElement("li");
      item.textContent = tag;
      return item;
    }));
    tags.hidden = !tags.childElementCount;
    const link = document.querySelector("#featured-project-link");
    link.href = url.href;
    link.textContent = project.link_label;
    section.hidden = false;
  }

  const api = Object.freeze({ render });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BITS_FEATURED_PROJECT = api;
})(typeof window === "undefined" ? globalThis : window);
