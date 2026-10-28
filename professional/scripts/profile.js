(() => {
  const themeSelect = document.querySelector("#profile-theme-select");
  const themes = window.BITS_INTERFACE_THEMES ?? [];
  if (!themeSelect || themes.length === 0) {
    return;
  }

  const formatThemeName = (name) => name
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\b(Rgb|Oled|Crt|Dos|Y2k|Macos|Xp)\b/g, (word) => (
      word === "Macos" ? "macOS" : word.toUpperCase()
    ))
    .replace(/\bYoutube\b/, "YouTube");
  themeSelect.replaceChildren(...(window.BITS_THEME_PREFERENCE?.buildOptions(formatThemeName)
    ?? themes.map((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = formatThemeName(theme.name);
      return option;
    })));
  themeSelect.value = document.documentElement.dataset.interfaceTheme ?? themes[0].id;
  themeSelect.closest("label").hidden = false;

  const applyTheme = (themeId) => {
    const theme = themes.find((entry) => entry.id === themeId);
    if (!theme) {
      return;
    }
    if (window.BITS_THEME_PREFERENCE?.apply) {
      window.BITS_THEME_PREFERENCE.apply(theme.id);
    } else {
      document.documentElement.dataset.interfaceTheme = theme.id;
      document.documentElement.classList.toggle("is-rgb-mode", theme.id === "rgb");
    }
    themeSelect.value = theme.id;
    if (window.BITS_THEME_PREFERENCE) {
      window.BITS_THEME_PREFERENCE.select(theme.id);
    } else {
      localStorage.setItem("bits-interface-theme", theme.id);
    }
  };

  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));

  const schemeSelect = document.querySelector("#profile-scheme-select");
  const randomButton = document.querySelector("#profile-theme-random");
  if (window.BITS_THEME_PREFERENCE?.bindColorSchemeSelect && schemeSelect) {
    schemeSelect.closest("label").hidden = false;
    window.BITS_THEME_PREFERENCE.bindColorSchemeSelect(
      schemeSelect,
      (label) => label.charAt(0) + label.slice(1).toLowerCase(),
    );
    window.BITS_THEME_PREFERENCE.bindVariantSelect?.(
      document.querySelector("#profile-variant-select"),
      (label) => label.split(" ").map((word) => (word.startsWith("(") ? word.charAt(0) + word.charAt(1) + word.slice(2).toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase())).join(" "),
    );
  }
  if (window.BITS_THEME_PREFERENCE?.pickRandom && randomButton) {
    randomButton.hidden = false;
    randomButton.addEventListener("click", () => {
      applyTheme(window.BITS_THEME_PREFERENCE.pickRandom());
    });
  }
})();

(() => {
  const timeline = document.querySelector("#profile-timeline");
  const fallback = document.querySelector("#profile-experience-fallback");
  const updated = document.querySelector("#profile-experience-updated");
  const location = document.querySelector("#profile-location");
  const availability = document.querySelector("#profile-availability");
  const availabilityRow = document.querySelector("#profile-availability-row");
  const educationList = document.querySelector("#profile-education");
  const certificationList = document.querySelector("#profile-certifications");

  if (!timeline || !window.CareerFormat || !window.CareerData) {
    return;
  }

  function createCertificationEntry(entry) {
    const item = document.createElement("li");
    const meta = document.createElement("p");
    const name = document.createElement("h4");
    meta.className = "profile-kicker";
    meta.textContent = `${entry.issuer} · ${entry.issued}`;
    name.textContent = entry.name;
    item.append(meta, name);
    if (entry.credential_id) {
      const id = document.createElement("p");
      id.className = "profile-certification-id";
      id.textContent = `Credential ID ${entry.credential_id}`;
      item.append(id);
    }
    if (window.CareerData.isSafeUrl(entry.credential_url)) {
      const link = document.createElement("a");
      link.className = "profile-text-link";
      link.href = entry.credential_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Verify credential ↗";
      item.append(link);
    }
    return item;
  }

  function createEducationEntry(entry) {
    const item = document.createElement("li");
    const meta = document.createElement("div");
    const period = document.createElement("p");
    const body = document.createElement("article");
    const credential = document.createElement("h3");
    const school = document.createElement("p");

    meta.className = "profile-timeline-meta";
    period.className = "profile-kicker";
    window.CareerFormat.buildPeriod(period, entry.period);
    meta.append(period);

    credential.textContent = entry.credential;
    school.className = "profile-subtitle";
    school.textContent = entry.school;
    body.append(credential, school);
    if (entry.details) {
      body.append(window.CareerFormat.buildSummary(entry.details, {
        list: "profile-timeline-bullets",
      }));
    }
    item.append(meta, body);
    return item;
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
    window.CareerFormat.buildPeriod(period, entry.period, { live: true });
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

  function render({ profile, entries, education, certifications }) {
    if (!profile) {
      return;
    }
    if (educationList && Array.isArray(education) && education.length > 0) {
      educationList.replaceChildren(...education.map(createEducationEntry));
    }
    if (certificationList && Array.isArray(certifications) && certifications.length > 0) {
      certificationList.replaceChildren(...certifications.map(createCertificationEntry));
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

  window.CareerData.load()
    .then(render)
    .catch((error) => {
      console.warn("Unable to load career history:", error);
    });
})();
