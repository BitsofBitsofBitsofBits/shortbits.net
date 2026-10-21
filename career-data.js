(() => {
  const sharedCacheKey = "bits-public-content-v5";
  const sharedCacheDurationMs = 300_000;

  function readSharedCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(sharedCacheKey) ?? "null");
      if (
        cached
        && typeof cached.cachedAt === "number"
        && Date.now() - cached.cachedAt < sharedCacheDurationMs
        && cached.payload
      ) {
        return {
          profile: cached.payload.resumeProfile,
          entries: cached.payload.resumeEntries ?? [],
          education: cached.payload.resumeEducation ?? [],
          certifications: cached.payload.resumeCertifications ?? [],
        };
      }
    } catch {
      // Ignore malformed cache data and fetch fresh content instead.
    }
    return null;
  }

  async function fetchTable(query) {
    const { url, anonKey } = window.SUPABASE_CONFIG ?? {};
    if (!url || !anonKey) {
      throw new Error("Supabase configuration is missing.");
    }
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}`, {
      headers: { apikey: anonKey },
    });
    if (!response.ok) {
      throw new Error(`Career request failed with HTTP ${response.status}.`);
    }
    return response.json();
  }

  function optional(promise, label) {
    return promise.catch((error) => {
      console.warn(`Unable to load ${label}:`, error);
      return [];
    });
  }

  let request = null;

  function load() {
    if (request) {
      return request;
    }
    const cached = readSharedCache();
    if (cached) {
      request = Promise.resolve(cached);
      return request;
    }
    request = Promise.all([
      fetchTable("site_resume_profile?select=headline,summary,availability,location,resume_url,updated_at&enabled=eq.true&id=eq.primary"),
      fetchTable("site_resume_entries?select=position,role,organization,period,summary,technologies&enabled=eq.true&order=position.asc"),
      optional(
        fetchTable("site_resume_education?select=position,school,credential,period,details&enabled=eq.true&order=position.asc"),
        "education",
      ),
      optional(
        fetchTable("site_resume_certifications?select=position,name,issuer,issued,credential_id,credential_url&enabled=eq.true&order=position.asc"),
        "certifications",
      ),
    ]).then(([profiles, entries, education, certifications]) => ({
      profile: profiles[0] ?? null,
      entries,
      education,
      certifications,
    }));
    request.catch(() => {
      request = null;
    });
    return request;
  }

  function isSafeUrl(value) {
    return typeof value === "string" && /^https:\/\//i.test(value);
  }

  window.CareerData = { load, isSafeUrl };
})();
