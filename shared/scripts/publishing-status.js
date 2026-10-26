((root) => {
  function normalizePosts(posts, now = new Date()) {
    if (!Array.isArray(posts)) throw new Error("Content build: published-post response was not an array.");
    const slugs = new Set();
    return posts.filter((post) => {
      if (!post || typeof post !== "object" || typeof post.published !== "boolean") {
        throw new Error("Content build: invalid post publication state.");
      }
      if (!post.published) return false;
      if (!Number.isFinite(Date.parse(post.published_at))) throw new Error("Content build: invalid publication date.");
      return Date.parse(post.published_at) <= now.getTime();
    }).map((post) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || post.slug.length > 100 || slugs.has(post.slug)) {
        throw new Error("Content build: invalid or duplicate post slug.");
      }
      for (const key of ["title", "excerpt", "body_markdown"]) {
        if (typeof post[key] !== "string" || !post[key].trim()) throw new Error(`Content build: invalid post ${key}.`);
      }
      slugs.add(post.slug);
      return post;
    }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || a.slug.localeCompare(b.slug));
  }

  async function snapshot(posts, now = new Date()) {
    const entries = await Promise.all(normalizePosts(posts, now).map(async (post) => {
      const content = JSON.stringify([
        post.slug, post.title, post.excerpt, post.body_markdown,
        new Date(post.published_at).toISOString(),
        Number.isFinite(Date.parse(post.updated_at)) ? new Date(post.updated_at).toISOString() : null,
      ]);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
      return {
        slug: post.slug,
        fingerprint: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
      };
    }));
    return { version: 1, generatedAt: now.toISOString(), posts: entries.sort((a, b) => a.slug.localeCompare(b.slug)) };
  }

  function validate(manifest) {
    if (!manifest || manifest.version !== 1 || !Number.isFinite(Date.parse(manifest.generatedAt))
      || !Array.isArray(manifest.posts)) {
      throw new Error("The deployed publishing snapshot is missing or unsupported. Deploy the site, then check again.");
    }
    const slugs = new Set();
    for (const entry of manifest.posts) {
      if (!entry || typeof entry.slug !== "string" || entry.slug.length > 100
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)
        || !/^[a-f0-9]{64}$/.test(entry.fingerprint) || slugs.has(entry.slug)) {
        throw new Error("The deployed publishing snapshot contains invalid article entries.");
      }
      slugs.add(entry.slug);
    }
    return manifest;
  }

  function compare(current, deployed) {
    validate(current);
    validate(deployed);
    const live = new Map(deployed.posts.map((entry) => [entry.slug, entry.fingerprint]));
    const saved = new Map(current.posts.map((entry) => [entry.slug, entry.fingerprint]));
    return {
      added: current.posts.filter((entry) => !live.has(entry.slug)).map((entry) => entry.slug),
      changed: current.posts.filter((entry) => live.has(entry.slug) && live.get(entry.slug) !== entry.fingerprint).map((entry) => entry.slug),
      removed: deployed.posts.filter((entry) => !saved.has(entry.slug)).map((entry) => entry.slug),
    };
  }

  const api = Object.freeze({ normalizePosts, snapshot, validate, compare });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BITS_PUBLISHING = api;
})(globalThis);
