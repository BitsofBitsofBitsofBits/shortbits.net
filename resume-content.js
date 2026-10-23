(() => {
  const fields = {
    profile: ["headline", "summary", "location", "updated_at"],
    entries: ["role", "organization", "period", "summary", "technologies"],
    education: ["school", "credential", "period", "details"],
    certifications: ["name", "issuer", "issued", "credential_id", "credential_url"],
  };
  function record(value, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid public résumé record.");
    return Object.fromEntries(keys.map((key) => {
      const text = value[key] ?? "";
      if (typeof text !== "string") throw new Error(`Invalid public résumé field: ${key}.`);
      return [key, text];
    }));
  }
  function normalize(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid public résumé data.");
    const result = { profile: data.profile === null ? null : record(data.profile, fields.profile) };
    for (const key of ["entries", "education", "certifications"]) {
      if (!Array.isArray(data[key])) throw new Error(`Invalid public résumé ${key}.`);
      result[key] = data[key].map((entry) => record(entry, fields[key]));
    }
    return result;
  }
  function serialize(data) {
    return JSON.stringify(normalize(data));
  }
  function render(input) {
    const { profile, entries, education, certifications } = normalize(input);
    if (!profile) return false;
    const format = window.CareerFormat;
    function header(title, subtitle, periodValue) {
      const node = document.createElement("header");
      const group = document.createElement("div");
      const heading = document.createElement("h3");
      const organization = document.createElement("p");
      heading.textContent = title;
      organization.className = "resume-org";
      organization.textContent = subtitle;
      group.append(heading, organization);
      node.append(group);
      if (periodValue) {
        const period = document.createElement("p");
        period.className = "resume-period";
        format.buildPeriod(period, periodValue);
        node.append(period);
      }
      return node;
    }
    function experience(entry) {
      const item = document.createElement("li");
      item.append(header(entry.role, entry.organization, entry.period),
        format.buildSummary(entry.summary, { list: "resume-bullets" }));
      const technologies = format.splitTechnologies(entry.technologies);
      if (technologies.length) {
        const skills = document.createElement("p");
        skills.className = "resume-tech";
        skills.textContent = technologies.join(" \u00b7 ");
        item.append(skills);
      }
      return item;
    }
    function school(entry) {
      const item = document.createElement("li");
      item.append(header(entry.credential, entry.school, entry.period));
      if (entry.details) item.append(format.buildSummary(entry.details, { list: "resume-bullets" }));
      return item;
    }
    function certification(entry) {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = entry.name;
      const parts = [entry.issuer, entry.issued];
      if (entry.credential_id) parts.push(`ID ${entry.credential_id}`);
      item.append(name, ` \u00b7 ${parts.join(" \u00b7 ")}`);
      if (window.CareerData.isSafeUrl(entry.credential_url)) {
        const link = document.createElement("a");
        link.href = entry.credential_url;
        link.textContent = "Verify";
        item.append(" \u00b7 ", link);
      }
      return item;
    }
    for (const [key, id] of [["headline", "resume-headline"], ["summary", "resume-summary"], ["location", "resume-contact-location"]]) {
      if (profile[key]) document.getElementById(id).textContent = profile[key];
    }
    for (const [rows, id, create] of [
      [entries, "resume-experience", experience], [education, "resume-education", school],
      [certifications, "resume-certifications", certification],
    ]) {
      if (rows.length) document.getElementById(id).replaceChildren(...rows.map(create));
    }
    const updatedAt = new Date(profile.updated_at);
    if (!Number.isNaN(updatedAt.getTime())) {
      const label = updatedAt.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      document.getElementById("resume-updated").textContent =
        `Updated ${label} \u00b7 Current version at shortbits.net/professional/resume`;
    }
    return true;
  }
  window.ResumeContent = Object.freeze({ normalize, serialize, render });
})();
