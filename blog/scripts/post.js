(() => {
  const article = document.querySelector("#blog-post");
  const status = document.querySelector("#blog-post-status");
  const title = document.querySelector("#blog-post-title");
  const excerpt = document.querySelector("#blog-post-excerpt");
  const date = document.querySelector("#blog-post-date");
  const readingTime = document.querySelector("#blog-post-reading-time");
  const body = document.querySelector("#blog-post-body");
  const contents = document.querySelector("#blog-post-toc");
  const taxonomy = window.BITS_BLOG_TAXONOMY;
  const labels = document.querySelector("#blog-post-taxonomy");
  const seriesNavigation = document.querySelector("#blog-series-navigation");
  const staticGroups = JSON.parse(article.dataset.staticTaxonomies || '{"tags":[],"series":[]}');
  const staticSlugs = new Set(JSON.parse(article.dataset.staticSlugs || "[]"));
  const slug = article.dataset.blogSlug || new URLSearchParams(window.location.search).get("slug")?.trim();
  const schema = document.querySelector("[data-blog-schema]");
  const initialSchema = schema ? JSON.parse(schema.textContent) : null;
  const seoSchema = document.querySelector("script[data-seo]");
  const initialSeo = seoSchema ? JSON.parse(seoSchema.textContent) : null;
  const isSnapshot = Boolean(article.dataset.blogSlug);
  let hasContent = !article.hidden;
  let synchronized = false;
  let loading = false;
  let viewsLoaded = false;
  let lastBodyMarkdown = null;
  let colorFrame = 0;

  function report(message) {
    status.textContent = message;
    status.hidden = false;
  }

  function refreshColors() {
    if (article.hidden) return;
    try {
      window.BITS_MARKDOWN.applyReadableColors(body);
    } catch (error) {
      console.error("Unable to adapt article colors:", error);
      report("Some article colors could not be adjusted for readability in this theme.");
    }
  }

  function scheduleColors() {
    window.cancelAnimationFrame(colorFrame);
    colorFrame = window.requestAnimationFrame(refreshColors);
  }

  function metadata(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.content = value;
  }

  function updateMetadata(post) {
    document.title = post ? `${post.title} // BitsofBitsofBits` : "Post unavailable // BitsofBitsofBits";
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      metadata(selector, post?.excerpt || "That post does not exist or is not published.");
    }
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      metadata(selector, post?.title || "Post unavailable");
    }
    metadata('meta[property="article:published_time"]', post?.published_at || "");
    if (schema) {
      schema.textContent = post ? JSON.stringify({
        ...initialSchema, headline: post.title, description: post.excerpt,
        datePublished: post.published_at, dateModified: post.updated_at || post.published_at,
        keywords: taxonomy.read(post).tags.map(tag => tag.name),
        isPartOf: post.series ? { "@type": "CreativeWorkSeries", name: post.series.name,
          url: `https://www.shortbits.net${taxonomy.browsePath("series", post.series.slug, staticGroups)}` } : undefined,
      }).replace(/</g, "\\u003c") : "null";
    }

    if (seoSchema) {
      seoSchema.textContent = post ? JSON.stringify({
        ...initialSeo,
        "@graph": initialSeo["@graph"].map(entry => entry["@type"] === "WebPage"
          ? { ...entry, name: document.title, description: post.excerpt } : entry),
      }).replace(/</g, "\\u003c") : "null";
    }
    let robots = document.querySelector('meta[name="robots"]');
    if (!post && !robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.append(robots);
    }
    if (robots) robots.content = post && isSnapshot ? "index, follow" : "noindex, follow";
  }

  async function updateSeries(post) {
      const metadata = taxonomy.read(post);
      if (!metadata.series) { seriesNavigation.replaceChildren(); seriesNavigation.removeAttribute("data-series"); return; }
      try {
        const members = [], seen = new Set();
        const { url, anonKey } = window.SUPABASE_CONFIG;
        for (;;) {
          const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${window.BITS_BLOG_DATA.series(metadata.series.slug, members.length)}`, {
            headers: { apikey: anonKey }, cache: "no-store", signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error(`Series request failed with HTTP ${response.status}.`);
          const page = await response.json();
          if (!Array.isArray(page)) throw new Error("Invalid series response.");
          for (const member of page) {
            taxonomy.read(member);
            if (typeof member.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(member.slug)
              || member.slug.length > 100 || typeof member.title !== "string" || !member.title.trim()
              || !Number.isFinite(Date.parse(member.published_at)) || seen.has(member.slug)) throw new Error("Invalid series member.");
            seen.add(member.slug);
          }
          members.push(...page);
          if (page.length < 500) break;
        }
        const ordered = taxonomy.ordered(members, metadata.series.slug);
        const index = ordered.findIndex(member => member.slug === post.slug);
        seriesNavigation.replaceChildren();
        seriesNavigation.dataset.series = metadata.series.slug;
        const indexLink = document.createElement("a");
        indexLink.textContent = metadata.series.name;
        indexLink.href = taxonomy.browsePath("series", metadata.series.slug, staticGroups);
        seriesNavigation.append(indexLink);
        if (index < 0) {
          const message = document.createElement("p"); message.setAttribute("role", "status");
          message.textContent = "Series membership is updating. Navigation will refresh automatically.";
          seriesNavigation.append(message); return;
        }
        const position = document.createElement("p"); position.textContent = `Part ${index + 1} of ${ordered.length}`;
        seriesNavigation.append(position);
        for (const [label, member, rel] of [["Previous", ordered[index - 1], "prev"], ["Next", ordered[index + 1], "next"]]) {
          if (!member) continue;
          const anchor = document.createElement("a");
          anchor.textContent = `${label}: ${member.title}`; anchor.rel = rel;
          anchor.href = staticSlugs.has(member.slug) ? `/blog/articles/${encodeURIComponent(member.slug)}/`
            : `/blog/post.html?slug=${encodeURIComponent(member.slug)}`;
          seriesNavigation.append(anchor);
        }
      } catch (error) {
        console.error("Unable to refresh blog series:", error);
        if (seriesNavigation.dataset.series !== metadata.series.slug) seriesNavigation.replaceChildren();
        seriesNavigation.querySelector('[data-series-error]')?.remove();
        const message = document.createElement("p"); message.dataset.seriesError = ""; message.setAttribute("role", "status");
        message.textContent = "Series navigation could not be refreshed and may be out of date. Retrying automatically.";
        seriesNavigation.append(message);
      }
  }

  async function loadPost() {
    if (loading) return;
    if (!slug || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      report("This blog address is invalid.");
      return;
    }
    loading = true;
    try {
      const { url, anonKey } = window.SUPABASE_CONFIG;
      const query = window.BITS_BLOG_DATA.post(new Date().toISOString(), slug);
      const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}`, {
        headers: { apikey: anonKey },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Post request failed with HTTP ${response.status}.`);
      const posts = await response.json();
      if (!Array.isArray(posts) || posts.length > 1) throw new Error("Invalid post response.");
      const [post] = posts;
      if (!post) {
        article.hidden = true;
        hasContent = false;
        viewsLoaded = false;
        body.replaceChildren();
        contents.replaceChildren();
        labels.replaceChildren(); seriesNavigation.replaceChildren();
        lastBodyMarkdown = null;
        title.textContent = "";
        excerpt.textContent = "";
        document.querySelector("#blog-post-views").textContent = "";
        updateMetadata(null);
        report("That post does not exist or is not published.");
        return;
      }
      if (post.slug !== slug || ["title", "excerpt"].some((key) => typeof post[key] !== "string" || !post[key].trim())
        || typeof post.body_markdown !== "string" || (!post.body_rich && !post.body_markdown.trim())
        || !Number.isFinite(Date.parse(post.published_at))) {
        throw new Error("Invalid post response.");
      }
      taxonomy.read(post);
      const contentKey = JSON.stringify([post.body_markdown, post.body_rich ?? null]);
      if (contentKey !== lastBodyMarkdown) {
        const rendered = window.BITS_BLOG_CONTENT.renderPost(post, { readableColors: true });
        const toc = window.BITS_BLOG_TOC.render(rendered);
        if (toc) toc.open = Boolean(contents.firstElementChild?.open);
        contents.replaceChildren(...(toc ? [toc] : []));
        body.replaceChildren(rendered);
        lastBodyMarkdown = contentKey;
      }
      title.textContent = post.title;
      taxonomy.renderMetadata(labels, post, staticGroups);
      excerpt.textContent = post.excerpt;
      date.dateTime = post.published_at;
      date.textContent = new Date(post.published_at).toLocaleDateString(undefined, {
        day: "numeric", month: "long", year: "numeric",
      });
      readingTime.textContent = `${window.BITS_BLOG_CONTENT.readingTime(post)} MIN READ`;
      updateMetadata(post);
      if (!document.querySelector('link[rel="canonical"]')) {
        const canonical = document.createElement("link");
        canonical.rel = "canonical";
        canonical.href = `https://www.shortbits.net/blog/articles/${encodeURIComponent(post.slug)}/`;
        document.head.append(canonical);
      }
      status.hidden = true;
      article.hidden = false;
      refreshColors();
      hasContent = true;
      synchronized = true;
      await updateSeries(post);
      if (!viewsLoaded) {
        viewsLoaded = true;
        void window.BITS_BLOG_VIEWS.show(post.slug, document.querySelector("#blog-post-views"));
      }
    } catch (error) {
      console.error("Unable to load blog post:", error);
      report(hasContent
        ? `Live updates are unavailable. Showing ${synchronized ? "the last synchronized article" : "the article from the latest deployment"}. Retrying automatically.`
        : "This post could not be loaded. Retrying automatically; please try again later.");
    } finally {
      loading = false;
    }
  }

  const refresh = () => { if (!document.hidden) void loadPost(); };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("bits:theme-applied", scheduleColors);
  window.addEventListener("resize", scheduleColors);
  document.addEventListener("load", event => {
    if (event.target.id === "bits-theme-stylesheet") scheduleColors();
  }, true);
  window.addEventListener("focus", refresh);
  window.setInterval(refresh, 60000);
  void loadPost();
  scheduleColors();
})();
