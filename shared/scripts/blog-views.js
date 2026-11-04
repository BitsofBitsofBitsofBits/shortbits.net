(() => {
  function dailyToken(slug) {
    const key = `bits-blog-view-${slug}`;
    const day = new Date().toISOString().slice(0, 10);
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved?.day === day && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(saved.token)) {
        return saved.token;
      }
      const token = crypto.randomUUID();
      localStorage.setItem(key, JSON.stringify({ day, token }));
      return token;
    } catch (error) {
      console.error("Unable to save daily blog view state; this visit will not be counted:", error);
      return null;
    }
  }

  async function show(slug, element) {
    if (!element || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
    if (document.hidden) {
      const onVisible = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", onVisible);
        void show(slug, element);
      };
      document.addEventListener("visibilitychange", onVisible);
      return;
    }
    try {
      const disabled = navigator.globalPrivacyControl === true
        || navigator.doNotTrack === "1" || window.doNotTrack === "1";
      const token = disabled ? null : await (navigator.locks
        ? navigator.locks.request(`bits-blog-view-${slug}`, () => dailyToken(slug))
        : dailyToken(slug));
      const { url, anonKey } = window.SUPABASE_CONFIG;
      const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/get_blog_post_views`, {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_slug: slug, p_token: token }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Blog view request failed with HTTP ${response.status}.`);
      const views = await response.json();
      if (!Number.isSafeInteger(views) || views < 0) throw new Error("Blog view response is unavailable or malformed.");
      element.textContent = `${views.toLocaleString()} VIEW${views === 1 ? "" : "S"}`;
      element.title = "Approximate readership: once per post per browser each UTC day, not unique people.";
    } catch (error) {
      console.error("Unable to update blog post views:", error);
      element.textContent = "VIEWS UNAVAILABLE";
    }
  }

  window.BITS_BLOG_VIEWS = Object.freeze({ show });
  const article = document.querySelector("[data-blog-slug]");
  if (article) void show(article.dataset.blogSlug, document.querySelector("#blog-post-views"));
})();
