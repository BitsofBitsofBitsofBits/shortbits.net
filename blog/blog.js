(() => {
  const list = document.querySelector("#blog-post-list");
  const status = document.querySelector("#blog-status");
  const count = document.querySelector("#blog-post-count");

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
    link.href = `/blog/post.html?slug=${encodeURIComponent(post.slug)}`;
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
      const query = [
        "site_blog_posts?select=slug,title,excerpt,published_at",
        "published=eq.true",
        `published_at=lte.${encodeURIComponent(new Date().toISOString())}`,
        "order=published_at.desc",
      ].join("&");
      const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}`, {
        headers: { apikey: anonKey },
      });
      if (!response.ok) {
        throw new Error(`Archive request failed with HTTP ${response.status}.`);
      }
      const posts = await response.json();
      list.replaceChildren(...posts.map(createPostCard));
      count.textContent = `${posts.length} POST${posts.length === 1 ? "" : "S"}`;
      status.textContent = posts.length
        ? "Archive synchronized."
        : "No posts have been published yet.";
    } catch (error) {
      console.error("Unable to load blog posts:", error);
      count.textContent = "OFFLINE";
      status.textContent = "The blog archive could not be loaded. Please try again later.";
    }
  }

  loadPosts();
})();
