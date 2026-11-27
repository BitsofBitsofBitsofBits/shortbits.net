((root) => {
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  function item(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join() !== "name,slug"
      || typeof value.name !== "string" || !value.name.trim() || value.name !== value.name.trim()
      || Array.from(value.name).length > 80 || /[\u0000-\u001f\u007f]/.test(value.name)
      || typeof value.slug !== "string" || value.slug.length > 80 || !slugPattern.test(value.slug)) {
      throw new Error("Invalid blog tag or series.");
    }
    return { name: value.name, slug: value.slug };
  }
  function read(post) {
    const tags = post.tags === undefined ? [] : post.tags;
    const series = post.series === undefined ? null : post.series;
    const position = post.series_order === undefined ? null : post.series_order;
    if (!Array.isArray(tags) || tags.length > 10) throw new Error("Use at most ten blog tags.");
    const normalized = tags.map(item);
    if (normalized.some(tag => tag.name.includes(","))
      || new Set(normalized.map(tag => tag.slug)).size !== tags.length
      || new Set(normalized.map(tag => tag.name.toLowerCase())).size !== tags.length) {
      throw new Error("Blog tags must be unique; tag names cannot contain commas.");
    }
    if (series === null ? position !== null : !Number.isInteger(position) || position < 1 || position > 100000) {
      throw new Error("Choose a series reading order between 1 and 100000.");
    }
    return { tags: normalized.sort((a, b) => a.slug.localeCompare(b.slug)), series: series === null ? null : item(series), series_order: position };
  }
  function named(name, known) {
    const existing = known.find(entry => entry.name.toLowerCase() === name.toLowerCase());
    const slug = existing?.slug || name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { name, slug };
  }
  function captureFields(form, previous = {}, catalog = { tags: [], series: [] }) {
    const known = read(previous);
    const names = form.elements.tags.value.split(",").map(value => value.trim()).filter(Boolean);
    const seriesName = form.elements.series.value.trim();
    return {
      tags: names.map(name => named(name, [...known.tags, ...catalog.tags])),
      series: seriesName ? named(seriesName, [...(known.series ? [known.series] : []), ...catalog.series]) : null,
      series_order: seriesName ? Number(form.elements.series_order.value) : null,
    };
  }
  function fields(form, previous, catalog) {
    return read(captureFields(form, previous, catalog));
  }
  function populate(form, post) {
    const metadata = read(post);
    form.elements.tags.value = metadata.tags.map(tag => tag.name).join(", ");
    form.elements.series.value = metadata.series?.name || "";
    form.elements.series_order.value = metadata.series_order ?? "";
  }
  function suggestions(form, catalog) {
    if (!catalog || !Array.isArray(catalog.tags) || !Array.isArray(catalog.series)) throw new Error("Invalid blog taxonomy suggestions.");
    for (const kind of ["tags", "series"]) {
      const list = form.querySelector(`[data-taxonomy-suggestions="${kind}"]`);
      list.replaceChildren(...catalog[kind].map(value => {
        const option = form.ownerDocument.createElement("option");
        option.value = item(value).name;
        return option;
      }));
    }
  }
  function ordered(posts, slug) {
    return posts.filter(post => read(post).series?.slug === slug)
      .sort((a, b) => a.series_order - b.series_order || Date.parse(a.published_at) - Date.parse(b.published_at) || a.slug.localeCompare(b.slug));
  }
  function path(kind, slug) {
    if (!["tags", "series"].includes(kind) || !slugPattern.test(slug) || slug.length > 80) throw new Error("Invalid taxonomy address.");
    return `/blog/${kind}/${encodeURIComponent(slug)}/`;
  }
  function groups(posts) {
    const tags = new Map(), series = new Map();
    for (const post of posts) {
      const metadata = read(post);
      for (const tag of metadata.tags) if (!tags.has(tag.slug)) tags.set(tag.slug, tag);
      if (metadata.series && !series.has(metadata.series.slug)) series.set(metadata.series.slug, metadata.series);
    }
    const sorted = map => [...map.values()].sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
    return { tags: sorted(tags), series: sorted(series) };
  }
  function browsePath(kind, slug, staticGroups) {
    const canonical = path(kind, slug);
    return staticGroups?.[kind]?.some(entry => (typeof entry === "string" ? entry : entry.slug) === slug)
      ? canonical : `/blog/?${kind === "tags" ? "tag" : "series"}=${encodeURIComponent(slug)}`;
  }
  function metadataLinks(post, staticGroups) {
    const metadata = read(post);
    return [...metadata.tags.map(tag => ({ name: tag.name, href: browsePath("tags", tag.slug, staticGroups) })),
      ...(metadata.series ? [{ name: `Series: ${metadata.series.name}`, href: browsePath("series", metadata.series.slug, staticGroups) }] : [])];
  }
  function renderMetadata(container, post, staticGroups) {
    container.replaceChildren(...metadataLinks(post, staticGroups).map(link => {
      const anchor = container.ownerDocument.createElement("a");
      anchor.textContent = link.name; anchor.href = link.href;
      return anchor;
    }));
  }
  const api = Object.freeze({ read, captureFields, fields, populate, suggestions, ordered, path, groups, browsePath, metadataLinks, renderMetadata });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BITS_BLOG_TAXONOMY = api;
})(typeof window === "undefined" ? globalThis : window);
