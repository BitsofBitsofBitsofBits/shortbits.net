(() => {
  const list = document.querySelector("#blog-post-list");
  const status = document.querySelector("#blog-status");
  const count = document.querySelector("#blog-post-count");
  const search = document.querySelector("#blog-search");
  const taxonomy = window.BITS_BLOG_TAXONOMY;
  const route = window.location.pathname.match(/^\/blog\/(tags|series)\/([a-z0-9-]+)\/$/);
  const params = new URLSearchParams(window.location.search);
  const selectedTag = route?.[1] === "tags" ? route[2] : params.get("tag");
  const selectedSeries = route?.[1] === "series" ? route[2] : params.get("series");
  const browse = document.querySelector("#blog-taxonomy-browse");
  const staticGroups = JSON.parse(browse?.dataset.staticTaxonomies || '{"tags":[],"series":[]}');
  const staticSlugs = new Set(JSON.parse(list.dataset.staticSlugs || "[]"));
  let archiveStatus = status.textContent.trim();
  let loading = false;
  let synchronized = false;
  let lastArchive = null;

  function filterPosts() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of list.children) {
      card.hidden = !card.textContent.toLocaleLowerCase().includes(query)
        || Boolean(selectedTag && !JSON.parse(card.dataset.tags || "[]").includes(selectedTag))
        || Boolean(selectedSeries && card.dataset.series !== selectedSeries);
      if (!card.hidden) visible += 1;
    }
    count.textContent = `${visible} POST${visible === 1 ? "" : "S"}`;
    status.textContent = query
      ? `${visible} matching post${visible === 1 ? "" : "s"}.${archiveStatus.startsWith("Live updates are unavailable.") ? ` ${archiveStatus}` : ""}`
      : archiveStatus;
  }
  search.addEventListener("input", filterPosts);

  function createPostCard(post) {
    const article = document.createElement("article");
    const title = document.createElement("h3");
    const link = document.createElement("a");
    const excerpt = document.createElement("p");
    const metadata = document.createElement("p");
    const date = document.createElement("time");
    link.href = staticSlugs.has(post.slug)
      ? `/blog/articles/${encodeURIComponent(post.slug)}/`
      : `/blog/post.html?slug=${encodeURIComponent(post.slug)}`;
    link.textContent = post.title;
    title.append(link);
    excerpt.textContent = post.excerpt;
    date.dateTime = post.published_at;
    date.textContent = new Date(post.published_at).toLocaleDateString(undefined, {
      day: "numeric", month: "long", year: "numeric",
    });
    metadata.className = "blog-post-card-meta";
    metadata.append(date);
    const labels = document.createElement("div");
    labels.className = "blog-post-taxonomy";
    taxonomy.renderMetadata(labels, post, staticGroups);
    const organization = taxonomy.read(post);
    article.dataset.tags = JSON.stringify(organization.tags.map(tag => tag.slug));
    article.dataset.series = organization.series?.slug || "";
    article.append(title, excerpt, metadata, labels);
    return article;
  }

  async function loadPosts() {
    if (loading) return;
    loading = true;
    try {
      const { url, anonKey } = window.SUPABASE_CONFIG;
      const cutoff = new Date().toISOString();
      const posts = [];
      const seenSlugs = new Set();
      for (;;) {
        const query = window.BITS_BLOG_DATA.archive(cutoff, posts.length);
        const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}`, {
          headers: { apikey: anonKey },
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Archive request failed with HTTP ${response.status}.`);
        const page = await response.json();
        if (!Array.isArray(page)) throw new Error("Invalid archive response.");
        if (!page.length) break;
        for (const post of page) {
          if (!post || typeof post.slug !== "string" || post.slug.length > 100
            || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
            || ["title", "excerpt"].some((key) => typeof post[key] !== "string" || !post[key].trim())
            || !Number.isFinite(Date.parse(post.published_at))) {
            throw new Error("Invalid archive response.");
          }
          if (seenSlugs.has(post.slug)) throw new Error("Archive pagination returned a repeated post.");
          seenSlugs.add(post.slug);
          taxonomy.read(post);
        }
        posts.push(...page);
        if (page.length < 500) break;
      }
      const currentArchive = JSON.stringify(posts);
      if (currentArchive !== lastArchive) {
        const sorted = selectedSeries ? taxonomy.ordered(posts, selectedSeries) : posts;
        list.replaceChildren(...sorted.map(createPostCard));
        if (browse) {
          const groups = taxonomy.groups(posts);
          const sections = [];
          for (const kind of ["tags", "series"]) {
            if (!groups[kind].length) continue;
            const section = document.createElement("section");
            const heading = document.createElement("h2");
            heading.textContent = kind === "tags" ? "Browse tags" : "Browse series";
            section.append(heading);
            for (const item of groups[kind]) {
              const anchor = document.createElement("a");
              anchor.href = taxonomy.browsePath(kind, item.slug, staticGroups);
              anchor.textContent = item.name; section.append(anchor);
            }
            sections.push(section);
          }
          browse.replaceChildren(...sections);
          const selected = selectedTag ? groups.tags.find(item => item.slug === selectedTag)
            : selectedSeries ? groups.series.find(item => item.slug === selectedSeries) : null;
          if (selectedTag || selectedSeries) {
            document.querySelector(".blog-header h1").textContent = `${selectedTag ? "Tag" : "Series"}: ${selected?.name || selectedTag || selectedSeries}`;
          }
        }
        lastArchive = currentArchive;
      }
      synchronized = true;
      const matching = posts.filter(post => (!selectedTag || taxonomy.read(post).tags.some(tag => tag.slug === selectedTag))
        && (!selectedSeries || taxonomy.read(post).series?.slug === selectedSeries));
      archiveStatus = matching.length ? "Archive synchronized." : selectedTag || selectedSeries
        ? "No published posts match this tag or series." : "No posts have been published yet.";
      filterPosts();
    } catch (error) {
      console.error("Unable to load blog posts:", error);
      archiveStatus = synchronized
        ? "Live updates are unavailable. Showing the last synchronized archive. Retrying automatically."
        : "Live updates are unavailable. Showing posts from the latest deployment. Retrying automatically.";
      filterPosts();
    } finally {
      loading = false;
    }
  }

  const refresh = () => { if (!document.hidden) void loadPosts(); };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  window.setInterval(refresh, 60000);
  void loadPosts();
})();
