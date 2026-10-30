(() => {
  const list = document.querySelector("#blog-post-list");
  const status = document.querySelector("#blog-status");
  const count = document.querySelector("#blog-post-count");
  const search = document.querySelector("#blog-search");
  const staticSlugs = new Set(JSON.parse(list.dataset.staticSlugs || "[]"));
  let archiveStatus = status.textContent.trim();

  function filterPosts() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of list.children) {
      card.hidden = !card.textContent.toLocaleLowerCase().includes(query);
      if (!card.hidden) visible += 1;
    }
    count.textContent = `${visible} POST${visible === 1 ? "" : "S"}`;
    status.textContent = query
      ? `${visible} matching post${visible === 1 ? "" : "s"}.`
      : archiveStatus;
  }
  search.addEventListener("input", filterPosts);

  function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

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
    date.textContent = formatDate(post.published_at);
    metadata.className = "blog-post-card-meta";
    metadata.append(date);
    article.append(title, excerpt, metadata);
    return article;
  }

  async function loadPosts() {
    try {
      const { url, anonKey } = window.SUPABASE_CONFIG;
      const cutoff = new Date().toISOString();
      const posts = [];
      const seenSlugs = new Set();
      for (;;) {
        const query = window.BITS_BLOG_DATA.archive(cutoff, posts.length);
        const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}`, {
          headers: { apikey: anonKey },
        });
        if (!response.ok) {
          throw new Error(`Archive request failed with HTTP ${response.status}.`);
        }
        const page = await response.json();
        if (!Array.isArray(page)) throw new Error("Invalid archive response.");
        if (!page.length) break;
        for (const post of page) {
          if (seenSlugs.has(post.slug)) throw new Error("Archive pagination returned a repeated post.");
          seenSlugs.add(post.slug);
        }
        posts.push(...page);
        if (page.length < 500) break;
      }
      list.replaceChildren(...posts.map(createPostCard));
      archiveStatus = posts.length
        ? "Archive synchronized."
        : "No posts have been published yet.";
      filterPosts();
    } catch (error) {
      console.error("Unable to load blog posts:", error);
      archiveStatus = "Live updates are unavailable. Showing posts from the latest deployment.";
      filterPosts();
    }
  }

  loadPosts();
})();
