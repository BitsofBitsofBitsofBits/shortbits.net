const resumeEmpty = document.querySelector("#resume-empty");
const resumeContent = document.querySelector("#resume-content");
const resumeHeadline = document.querySelector("#resume-headline");
const resumeSummary = document.querySelector("#resume-summary");
const resumeAvailability = document.querySelector("#resume-availability");
const resumeAvailabilityRow = document.querySelector("#resume-availability-row");
const resumeLocation = document.querySelector("#resume-location");
const resumeLocationRow = document.querySelector("#resume-location-row");
const resumeUpdated = document.querySelector("#resume-updated");
const resumeDownload = document.querySelector("#resume-download");
const resumeEntries = document.querySelector("#resume-entries");
const resumeEducationHeading = document.querySelector("#resume-education-heading");
const resumeEducation = document.querySelector("#resume-education");
const nowEmpty = document.querySelector("#now-empty");
const nowContent = document.querySelector("#now-content");
const nowHeadline = document.querySelector("#now-headline");
const nowSummary = document.querySelector("#now-summary");
const nowFields = document.querySelector("#now-fields");
const nowUpdated = document.querySelector("#now-updated");
const changelogEmpty = document.querySelector("#changelog-empty");
const changelogEntries = document.querySelector("#changelog-entries");
const gamesEmpty = document.querySelector("#games-empty");
const gamesList = document.querySelector("#games-list");
const publicContentWindowIds = new Set([
  "resume-window",
  "now-window",
  "changelog-window",
  "games-window",
]);
const publicContentCacheKey = "bits-public-content-v4";
const publicContentCacheDurationMs = 300_000;

let publicContentRequest;

function formatContentDate(value, includeTime = false) {
  const parsed = includeTime
    ? new Date(value)
    : new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return includeTime
    ? parsed.toLocaleString()
    : parsed.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getCachedPublicContent() {
  const cachedValue = localStorage.getItem(publicContentCacheKey);
  if (!cachedValue) {
    return null;
  }

  try {
    const cached = JSON.parse(cachedValue);
    if (
      typeof cached.cachedAt === "number"
      && Date.now() - cached.cachedAt < publicContentCacheDurationMs
      && cached.payload
    ) {
      return cached.payload;
    }
  } catch (error) {
    console.warn("Unable to read cached public content:", error);
  }
  localStorage.removeItem(publicContentCacheKey);
  return null;
}

async function fetchPublicContentTable(query) {
  const { url, anonKey } = window.SUPABASE_CONFIG;
  if (!url || !anonKey) {
    throw new Error("Supabase public content configuration is missing.");
  }
  const response = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/${query}`,
    { headers: { apikey: anonKey } },
  );
  if (!response.ok) {
    throw new Error(`Public content request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

async function requestPublicContent() {
  const cached = getCachedPublicContent();
  if (cached) {
    return cached;
  }

  const [resumeProfiles, resumeItems, educationItems, nowProfiles, changelogItems, gameItems] =
    await Promise.all([
      fetchPublicContentTable(
        "site_resume_profile?select=headline,summary,availability,location,resume_url,updated_at&enabled=eq.true&id=eq.primary",
      ),
      fetchPublicContentTable(
        "site_resume_entries?select=position,role,organization,period,summary,technologies&enabled=eq.true&order=position.asc",
      ),
      fetchPublicContentTable(
        "site_resume_education?select=position,school,credential,period,details&enabled=eq.true&order=position.asc",
      ).catch((error) => {
        console.warn("Unable to load education:", error);
        return [];
      }),
      fetchPublicContentTable(
        "site_now?select=headline,summary,building,learning,playing,reading,updated_at&enabled=eq.true&id=eq.primary",
      ),
      fetchPublicContentTable(
        "site_changelog?select=position,entry_date,title,summary&enabled=eq.true&order=position.asc",
      ),
      fetchPublicContentTable(
        "site_favorite_games?select=position,title,platform,store_url,note&enabled=eq.true&order=position.asc",
      ),
    ]);
  const payload = {
    resumeProfile: resumeProfiles[0] ?? null,
    resumeEntries: resumeItems,
    resumeEducation: educationItems,
    nowProfile: nowProfiles[0] ?? null,
    changelogEntries: changelogItems,
    favoriteGames: gameItems,
  };
  localStorage.setItem(publicContentCacheKey, JSON.stringify({
    cachedAt: Date.now(),
    payload,
  }));
  return payload;
}

function createResumeEntry(entry) {
  const item = document.createElement("li");
  const header = document.createElement("header");
  const titleGroup = document.createElement("div");
  const role = document.createElement("h3");
  const organization = document.createElement("p");
  const period = document.createElement("p");
  role.textContent = entry.role;
  organization.textContent = entry.organization;
  if (window.CareerFormat) {
    window.CareerFormat.buildPeriod(period, entry.period);
  } else {
    period.textContent = entry.period;
  }
  titleGroup.append(role, organization);
  header.append(titleGroup, period);
  item.append(header);

  const format = window.CareerFormat;
  if (format) {
    item.append(format.buildSummary(entry.summary, {
      list: "resume-entry-bullets",
    }));
    const technologies = format.buildTechnologyList(
      entry.technologies,
      "resume-entry-technologies",
      `${entry.role} skills`,
    );
    if (technologies) {
      item.append(technologies);
    }
    return item;
  }

  const summary = document.createElement("p");
  summary.textContent = entry.summary;
  item.append(summary);
  if (entry.technologies) {
    const technologies = document.createElement("p");
    technologies.className = "resume-entry-technologies";
    technologies.textContent = entry.technologies;
    item.append(technologies);
  }
  return item;
}

function createEducationEntry(entry) {
  const item = document.createElement("li");
  const header = document.createElement("header");
  const titleGroup = document.createElement("div");
  const credential = document.createElement("h3");
  const school = document.createElement("p");
  const period = document.createElement("p");
  credential.textContent = entry.credential;
  school.textContent = entry.school;
  if (window.CareerFormat) {
    window.CareerFormat.buildPeriod(period, entry.period);
  } else {
    period.textContent = entry.period;
  }
  titleGroup.append(credential, school);
  header.append(titleGroup, period);
  item.append(header);
  if (entry.details) {
    if (window.CareerFormat) {
      item.append(window.CareerFormat.buildSummary(entry.details, {
        list: "resume-entry-bullets",
      }));
    } else {
      const details = document.createElement("p");
      details.textContent = entry.details;
      item.append(details);
    }
  }
  return item;
}

function renderResume(profile, entries, education = []) {
  if (!profile) {
    resumeEmpty.textContent = "Résumé data is awaiting operator input.";
    resumeEmpty.hidden = false;
    resumeContent.hidden = true;
    return;
  }

  resumeHeadline.textContent = profile.headline;
  resumeSummary.textContent = profile.summary;
  resumeAvailability.textContent = profile.availability ?? "";
  resumeAvailabilityRow.hidden = !profile.availability;
  resumeLocation.textContent = profile.location ?? "";
  resumeLocationRow.hidden = !profile.location;
  resumeUpdated.textContent = formatContentDate(profile.updated_at, true);
  resumeDownload.hidden = !profile.resume_url;
  if (profile.resume_url) {
    resumeDownload.href = profile.resume_url;
  } else {
    resumeDownload.removeAttribute("href");
  }
  resumeEntries.replaceChildren(
    ...entries.map(createResumeEntry),
  );
  resumeEntries.hidden = entries.length === 0;
  if (resumeEducation) {
    resumeEducation.replaceChildren(...education.map(createEducationEntry));
    resumeEducation.hidden = education.length === 0;
    resumeEducationHeading.hidden = education.length === 0;
  }
  resumeEmpty.hidden = true;
  resumeContent.hidden = false;
}

function renderNow(profile) {
  if (!profile) {
    nowEmpty.textContent = "NOW.TXT is awaiting operator input.";
    nowEmpty.hidden = false;
    nowContent.hidden = true;
    return;
  }

  nowHeadline.textContent = profile.headline;
  nowSummary.textContent = profile.summary;
  nowFields.replaceChildren();
  [
    ["BUILDING", profile.building],
    ["LEARNING", profile.learning],
    ["PLAYING", profile.playing],
    ["READING / WATCHING", profile.reading],
  ].forEach(([label, value]) => {
    if (!value) {
      return;
    }
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    nowFields.append(row);
  });
  nowUpdated.textContent = formatContentDate(profile.updated_at, true);
  nowEmpty.hidden = true;
  nowContent.hidden = false;
}

function createChangelogEntry(entry) {
  const item = document.createElement("li");
  const date = document.createElement("time");
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  const summary = document.createElement("p");
  date.dateTime = entry.entry_date;
  date.textContent = formatContentDate(entry.entry_date);
  title.textContent = entry.title;
  summary.textContent = entry.summary;
  copy.append(title, summary);
  item.append(date, copy);
  return item;
}

function renderChangelog(entries) {
  changelogEntries.replaceChildren(...entries.map(createChangelogEntry));
  changelogEntries.hidden = entries.length === 0;
  changelogEmpty.hidden = entries.length > 0;
  changelogEmpty.textContent = "Changelog entries are awaiting operator input.";
}

function createFavoriteGame(game) {
  const item = document.createElement("li");
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  const platform = document.createElement("p");
  const link = document.createElement("a");

  title.textContent = game.title;
  platform.textContent = game.platform;
  link.href = game.store_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "OPEN PAGE ↗";
  copy.append(title, platform);

  if (game.note) {
    const note = document.createElement("p");
    note.className = "favorite-game-note";
    note.textContent = game.note;
    copy.append(note);
  }

  item.append(copy, link);
  return item;
}

function renderFavoriteGames(games) {
  gamesList.replaceChildren(...games.map(createFavoriteGame));
  gamesList.hidden = games.length === 0;
  gamesEmpty.hidden = games.length > 0;
  gamesEmpty.textContent = "Favorite games are awaiting operator input.";
}

async function loadPublicContent() {
  if (!publicContentRequest) {
    resumeEmpty.textContent = "Synchronizing résumé data...";
    nowEmpty.textContent = "Synchronizing NOW.TXT...";
    changelogEmpty.textContent = "Synchronizing changelog entries...";
    gamesEmpty.textContent = "Synchronizing favorite games...";
    publicContentRequest = requestPublicContent()
      .then((content) => {
        renderResume(
          content.resumeProfile,
          content.resumeEntries,
          content.resumeEducation ?? [],
        );
        renderNow(content.nowProfile);
        renderChangelog(content.changelogEntries);
        renderFavoriteGames(content.favoriteGames);
      })
      .catch((error) => {
        console.error("Unable to load public content:", error);
        resumeEmpty.textContent = "Résumé data is temporarily unavailable.";
        nowEmpty.textContent = "NOW.TXT is temporarily unavailable.";
        changelogEmpty.textContent = "Changelog data is temporarily unavailable.";
        gamesEmpty.textContent = "Favorite games are temporarily unavailable.";
        publicContentRequest = null;
        throw error;
      });
  }
  return publicContentRequest;
}

window.addEventListener("desktop-window:opened", (event) => {
  if (publicContentWindowIds.has(event.detail.windowId)) {
    loadPublicContent().catch(() => {});
  }
});

if (
  [...publicContentWindowIds].some(
    (windowId) => !document.getElementById(windowId).hidden,
  )
) {
  loadPublicContent().catch(() => {});
}
