((root) => {
  const table = "site_blog_posts";
  const archiveFields = "slug,title,excerpt,published_at";
  const postFields = "slug,title,excerpt,body_markdown,published_at";
  const buildFields = "slug,title,excerpt,body_markdown,published,published_at,updated_at";
  const order = "published_at.desc,slug.asc";

  function publicQuery(fields, cutoff) {
    return new URLSearchParams({
      select: fields,
      published: "eq.true",
      published_at: `lte.${cutoff}`,
    });
  }

  function archive(cutoff, offset) {
    const query = publicQuery(archiveFields, cutoff);
    query.set("order", order);
    query.set("limit", "500");
    query.set("offset", String(offset));
    return `${table}?${query}`;
  }

  function post(cutoff, slug) {
    const query = publicQuery(postFields, cutoff);
    query.set("slug", `eq.${slug}`);
    query.set("limit", "1");
    return `${table}?${query}`;
  }

  function build(cutoff, offset) {
    const query = publicQuery(buildFields, cutoff);
    query.set("order", order);
    query.set("limit", "500");
    query.set("offset", String(offset));
    return `${table}?${query}`;
  }

  const api = Object.freeze({ archive, post, build });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BITS_BLOG_DATA = api;
})(typeof window === "undefined" ? globalThis : window);
