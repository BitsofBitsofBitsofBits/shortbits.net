(() => {
  const contact = {
    email: ["CalebKmasters", "outlook.com"],
    phone: ["785", "304", "4404"],
  };
  const status = document.querySelector("#resume-status");
  const printButton = document.querySelector("#resume-print");
  const sheet = document.querySelector(".resume-sheet");
  const emailItem = document.querySelector("#resume-contact-email");
  const phoneItem = document.querySelector("#resume-contact-phone");

  function reveal() {
    sheet.classList.remove("is-loading");
    sheet.removeAttribute("aria-busy");
  }
  const revealTimer = window.setTimeout(reveal, 2500);

  // Assembled at runtime so the address and number are not sitting in the HTML for scrapers.
  const email = contact.email.join("@");
  const emailLink = document.createElement("a");
  emailLink.href = `mailto:${email}`;
  emailLink.textContent = email;
  emailItem.replaceChildren(emailLink);

  const phoneLink = document.createElement("a");
  phoneLink.href = `tel:+1${contact.phone.join("")}`;
  phoneLink.textContent = `(${contact.phone[0]}) ${contact.phone[1]}-${contact.phone[2]}`;
  phoneItem.replaceChildren(phoneLink);

  const screenTitle = document.title;
  window.addEventListener("beforeprint", () => {
    document.title = "Caleb K Masters - Resume";
  });
  window.addEventListener("afterprint", () => {
    document.title = screenTitle;
  });
  printButton.addEventListener("click", () => window.print());

  function setStatus(message) {
    status.textContent = message;
  }

  function createHeader(title, subtitle, periodValue) {
    const header = document.createElement("header");
    const group = document.createElement("div");
    const heading = document.createElement("h3");
    const org = document.createElement("p");
    heading.textContent = title;
    org.className = "resume-org";
    org.textContent = subtitle;
    group.append(heading, org);
    header.append(group);
    if (periodValue) {
      const period = document.createElement("p");
      period.className = "resume-period";
      window.CareerFormat.buildPeriod(period, periodValue);
      header.append(period);
    }
    return header;
  }

  function createExperience(entry) {
    const item = document.createElement("li");
    item.append(
      createHeader(entry.role, entry.organization, entry.period),
      window.CareerFormat.buildSummary(entry.summary, { list: "resume-bullets" }),
    );
    const technologies = window.CareerFormat.splitTechnologies(entry.technologies);
    if (technologies.length) {
      const skills = document.createElement("p");
      skills.className = "resume-tech";
      skills.textContent = technologies.join(" · ");
      item.append(skills);
    }
    return item;
  }

  function createEducation(entry) {
    const item = document.createElement("li");
    item.append(createHeader(entry.credential, entry.school, entry.period));
    if (entry.details) {
      item.append(window.CareerFormat.buildSummary(entry.details, { list: "resume-bullets" }));
    }
    return item;
  }

  function createCertification(entry) {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const parts = [entry.issuer, entry.issued];
    if (entry.credential_id) {
      parts.push(`ID ${entry.credential_id}`);
    }
    item.append(name, ` · ${parts.join(" · ")}`);
    if (window.CareerData.isSafeUrl(entry.credential_url)) {
      const link = document.createElement("a");
      link.href = entry.credential_url;
      link.textContent = "Verify";
      item.append(" · ", link);
    }
    return item;
  }

  function render({ profile, entries, education, certifications }) {
    if (!profile) {
      setStatus("Showing the saved version.");
      return;
    }
    if (profile.headline) {
      document.querySelector("#resume-headline").textContent = profile.headline;
    }
    if (profile.summary) {
      document.querySelector("#resume-summary").textContent = profile.summary;
    }
    if (profile.location) {
      document.querySelector("#resume-contact-location").textContent = profile.location;
    }
    if (entries.length) {
      document.querySelector("#resume-experience").replaceChildren(...entries.map(createExperience));
    }
    if (education.length) {
      document.querySelector("#resume-education").replaceChildren(...education.map(createEducation));
    }
    if (certifications.length) {
      document.querySelector("#resume-certifications")
        .replaceChildren(...certifications.map(createCertification));
    }
    const updatedAt = new Date(profile.updated_at);
    if (!Number.isNaN(updatedAt.getTime())) {
      const label = updatedAt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      document.querySelector("#resume-updated").textContent =
        `Updated ${label} · Current version at shortbits.net/professional/resume`;
    }
    setStatus("Up to date.");
  }

  if (!window.CareerFormat || !window.CareerData) {
    setStatus("Showing the saved version.");
    reveal();
    return;
  }

  window.CareerData.load()
    .then(render)
    .catch((error) => {
      console.warn("Unable to load résumé data:", error);
      setStatus("Showing the saved version.");
    })
    .finally(() => {
      window.clearTimeout(revealTimer);
      reveal();
    });
})();
