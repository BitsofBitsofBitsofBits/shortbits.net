(() => {
  const sharedCacheKey = "bits-public-content-v5";
  const sharedCacheDurationMs = 300_000;
  const queries = Object.freeze({
    profile: "site_resume_profile?select=headline,summary,availability,location,resume_url,updated_at&enabled=eq.true&id=eq.primary",
    entries: "site_resume_entries?select=position,role,organization,period,summary,technologies&enabled=eq.true&order=position.asc",
    education: "site_resume_education?select=position,school,credential,period,details&enabled=eq.true&order=position.asc",
    certifications: "site_resume_certifications?select=position,name,issuer,issued,credential_id,credential_url&enabled=eq.true&order=position.asc",
  });

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
    const rows = [];
    for (;;) {
      const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}&limit=500&offset=${rows.length}`, {
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Career request failed with HTTP ${response.status}.`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Career response was not an array.");
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }

  function optional(promise, label, unavailable) {
    return promise.catch((error) => {
      console.warn(`Unable to load ${label}:`, error);
      unavailable.push(label);
      return [];
    });
  }

  let request = null;

  function load({ fresh = false } = {}) {
    if (request) {
      return request;
    }
    const cached = fresh ? null : readSharedCache();
    if (cached) {
      return Promise.resolve(cached);
    }
    const unavailable = [];
    request = Promise.all([
      fetchTable(queries.profile),
      fetchTable(queries.entries),
      optional(
        fetchTable(queries.education),
        "education",
        unavailable,
      ),
      optional(
        fetchTable(queries.certifications),
        "certifications",
        unavailable,
      ),
    ]).then(([profiles, entries, education, certifications]) => ({
      profile: profiles[0] ?? null,
      entries,
      education,
      certifications,
      unavailable,
    }));
    request.catch(() => {
      request = null;
    });
    return request;
  }

  function isSafeUrl(value) {
    return typeof value === "string" && /^https:\/\//i.test(value);
  }

  window.CareerData = { load, isSafeUrl, queries };
})();
