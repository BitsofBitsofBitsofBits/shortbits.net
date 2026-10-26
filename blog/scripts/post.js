(() => {
  const article = document.querySelector("#blog-post");
  const status = document.querySelector("#blog-post-status");
  const title = document.querySelector("#blog-post-title");
  const excerpt = document.querySelector("#blog-post-excerpt");
  const date = document.querySelector("#blog-post-date");
  const readingTime = document.querySelector("#blog-post-reading-time");
  const body = document.querySelector("#blog-post-body");
  const slug = new URLSearchParams(window.location.search).get("slug")?.trim();

  function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  async function loadPost() {
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      status.textContent = "This blog address is invalid.";
      return;
    }
    try {
      const { url, anonKey } = window.SUPABASE_CONFIG;
      const query = [
        "site_blog_posts?select=slug,title,excerpt,body_markdown,published_at",
        `slug=eq.${encodeURIComponent(slug)}`,
        "published=eq.true",
        `published_at=lte.${encodeURIComponent(new Date().toISOString())}`,
        "limit=1",
      ].join("&");
      const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}`, {
        headers: { apikey: anonKey },
      });
      if (!response.ok) {
        throw new Error(`Post request failed with HTTP ${response.status}.`);
      }
      const [post] = await response.json();
      if (!post) {
        status.textContent = "That post does not exist or is not published.";
        return;
      }
      title.textContent = post.title;
      excerpt.textContent = post.excerpt;
      date.dateTime = post.published_at;
      date.textContent = formatDate(post.published_at);
      readingTime.textContent = `${window.BITS_MARKDOWN.readingTime(post.body_markdown)} MIN READ`;
      body.replaceChildren(window.BITS_MARKDOWN.render(post.body_markdown));
      document.title = `${post.title} // BitsofBitsofBits`;
      const canonical = document.createElement("link");
      canonical.rel = "canonical";
      // Keep this live route for newly published posts and draft-aware legacy
      // links; the crawlable deployment snapshot lives at the canonical URL.
      canonical.href = `https://www.shortbits.net/blog/articles/${encodeURIComponent(post.slug)}/`;
      document.head.append(canonical);
      status.hidden = true;
      article.hidden = false;
    } catch (error) {
      console.error("Unable to load blog post:", error);
      status.textContent = "This post could not be loaded. Please try again later.";
    }
  }

  loadPost();
})();
