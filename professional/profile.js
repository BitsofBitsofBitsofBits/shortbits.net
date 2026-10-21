(() => {
  const timeline = document.querySelector("#profile-timeline");
  const fallback = document.querySelector("#profile-experience-fallback");
  const updated = document.querySelector("#profile-experience-updated");
  const location = document.querySelector("#profile-location");
  const availability = document.querySelector("#profile-availability");
  const availabilityRow = document.querySelector("#profile-availability-row");
  const sharedCacheKey = "bits-public-content-v3";
  const sharedCacheDurationMs = 300_000;

  if (!timeline || !window.CareerFormat) {
    return;
  }

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

  async function loadCareer() {
    const cached = readSharedCache();
    if (cached) {
      return cached;
    }
    const [profiles, entries] = await Promise.all([
      fetchTable("site_resume_profile?select=headline,summary,availability,location,resume_url,updated_at&enabled=eq.true&id=eq.primary"),
      fetchTable("site_resume_entries?select=position,role,organization,period,summary,technologies&enabled=eq.true&order=position.asc"),
    ]);
    return { profile: profiles[0] ?? null, entries };
  }

  function createEntry(entry, index) {
    const item = document.createElement("li");
    const meta = document.createElement("div");
    const number = document.createElement("span");
    const period = document.createElement("p");
    const body = document.createElement("article");
    const role = document.createElement("h3");
    const organization = document.createElement("p");

    meta.className = "profile-timeline-meta";
    number.className = "profile-card-index";
    number.setAttribute("aria-hidden", "true");
    number.textContent = `${String(index + 1).padStart(2, "0")} /`;
    period.className = "profile-kicker";
    window.CareerFormat.buildPeriod(period, entry.period);
    meta.append(number, period);

    role.textContent = entry.role;
    organization.className = "profile-subtitle";
    organization.textContent = entry.organization;
    body.append(
      role,
      organization,
      window.CareerFormat.buildSummary(entry.summary, {
        list: "profile-timeline-bullets",
      }),
    );
    const tags = window.CareerFormat.buildTechnologyList(
      entry.technologies,
      "profile-tags",
      `Skills used as ${entry.role}`,
    );
    if (tags) {
      body.append(tags);
    }
    item.append(meta, body);
    return item;
  }

  function render({ profile, entries }) {
    if (!profile) {
      return;
    }
    if (profile.location) {
      location.textContent = profile.location;
    }
    availability.textContent = profile.availability ?? "";
    availabilityRow.hidden = !profile.availability;

    if (!Array.isArray(entries) || entries.length === 0) {
      return;
    }
    timeline.replaceChildren(...entries.map(createEntry));
    timeline.hidden = false;
    fallback.hidden = true;

    const updatedAt = new Date(profile.updated_at);
    if (!Number.isNaN(updatedAt.getTime())) {
      updated.textContent = `Last updated ${updatedAt.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })}`;
      updated.hidden = false;
    }
  }

  loadCareer()
    .then(render)
    .catch((error) => {
      console.warn("Unable to load career history:", error);
    });
})();
