((root) => {
  const table = "site_blog_public_posts";
  const archiveFields = "slug,title,excerpt,published_at,tags,series,series_order";
  const postFields = "slug,title,excerpt,body_markdown,body_rich,published_at,updated_at,tags,series,series_order";
  const buildFields = "slug,title,excerpt,body_markdown,body_rich,published,published_at,updated_at,tags,series,series_order";
  const order = "published_at.desc,slug.asc";

  function publicQuery(fields, cutoff) {
    const query = new URLSearchParams({
      select: fields,
      published: "eq.true",
    });
    // Live eligibility is atomic in the view; a browser clock must not hide a due replacement.
    if (cutoff) query.set("published_at", `lte.${cutoff}`);
    return query;
  }

  function archive(cutoff, offset) {
    const query = publicQuery(archiveFields);
    query.set("order", order);
    query.set("limit", "500");
    query.set("offset", String(offset));
    return `${table}?${query}`;
  }

  function post(cutoff, slug) {
    const query = publicQuery(postFields);
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

  function series(slug, offset) {
    const query = publicQuery(archiveFields);
    query.set("series->>slug", `eq.${slug}`);
    query.set("order", "series_order.asc,published_at.asc,slug.asc");
    query.set("limit", "500");
    query.set("offset", String(offset));
    return `${table}?${query}`;
  }
  const api = Object.freeze({ archive, post, build, series });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BITS_BLOG_DATA = api;
})(typeof window === "undefined" ? globalThis : window);
