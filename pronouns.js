const defaultPronounProfile = {
  display_name: "Caleb K Masters",
  subject_pronoun: "they",
  object_pronoun: "them",
  possessive_determiner: "their",
  possessive_pronoun: "theirs",
  reflexive_pronoun: "themself",
  honorifics: "Ask me",
  gendered_terms: "Ask me",
  compliments: "Ask me",
  relationship_terms: "Ask me",
};

const pronounProfileFields = Object.keys(defaultPronounProfile);
const pronounProfileName = document.querySelector("#pronoun-profile-name");
const pronounProfileSet = document.querySelector("#pronoun-profile-set");
const pronounProfileStatus = document.querySelector("#pronoun-profile-status");
const pronounLaunchers = document.querySelectorAll('[data-window-target="pronouns-window"]');

function capitalizePronoun(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isValidPronounProfile(profile) {
  return profile
    && pronounProfileFields.every((field) => (
      typeof profile[field] === "string"
      && profile[field].trim().length > 0
      && profile[field].length <= (
        field === "display_name"
          ? 80
          : field.includes("pronoun") || field === "possessive_determiner"
            ? 30
            : field === "honorifics"
              ? 200
              : 500
      )
    ));
}

function renderPronounProfile(profile, statusMessage = "") {
  const subject = profile.subject_pronoun.trim();
  const object = profile.object_pronoun.trim();
  const determiner = profile.possessive_determiner.trim();
  const possessive = profile.possessive_pronoun.trim();
  const reflexive = profile.reflexive_pronoun.trim();
  const pronounSet = `${subject}/${object}`;

  pronounProfileName.textContent = profile.display_name.trim().toUpperCase();
  pronounProfileSet.textContent = pronounSet.toUpperCase();
  document.querySelector("#pronoun-example-subject").textContent =
    `${capitalizePronoun(subject)} fixed the bug.`;
  document.querySelector("#pronoun-example-object").textContent =
    `I paged ${object}.`;
  document.querySelector("#pronoun-example-determiner").textContent =
    `${capitalizePronoun(determiner)} deploy passed.`;
  document.querySelector("#pronoun-example-possessive").textContent =
    `The keyboard is ${possessive}.`;
  document.querySelector("#pronoun-example-reflexive").textContent =
    `${capitalizePronoun(subject)} did it ${reflexive}.`;
  document.querySelector("#pronoun-honorifics").textContent = profile.honorifics.trim();
  document.querySelector("#pronoun-gendered-terms").textContent = profile.gendered_terms.trim();
  document.querySelector("#pronoun-compliments").textContent = profile.compliments.trim();
  document.querySelector("#pronoun-relationship-terms").textContent =
    profile.relationship_terms.trim();
  pronounProfileStatus.textContent = statusMessage;
  pronounLaunchers.forEach((launcher) => {
    launcher.textContent = pronounSet;
  });
}

async function loadPronounProfile() {
  renderPronounProfile(defaultPronounProfile, "Synchronizing identity reference...");
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey) {
    pronounProfileStatus.textContent = "Profile signal unavailable. Showing local defaults.";
    return;
  }

  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/pronoun_profiles?id=eq.primary&select=${pronounProfileFields.join(",")}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      },
    );
    const profiles = await response.json();
    if (!response.ok) {
      throw new Error(profiles.message || `Profile request returned ${response.status}.`);
    }
    if (!Array.isArray(profiles) || !isValidPronounProfile(profiles[0])) {
      throw new Error("Pronoun profile response is malformed.");
    }
    renderPronounProfile(profiles[0], "Identity reference synchronized.");
  } catch (error) {
    console.error("Unable to load pronoun profile:", error);
    pronounProfileStatus.textContent = "Profile signal unavailable. Showing local defaults.";
  }
}

loadPronounProfile();
