const achievementStorageKey = "bits-achievements";
const achievementId = "page-not-found";
const achievementLabel = "ACTUAL 404 DISCOVERED";
const achievementMessage = "BIT_NOT_FOUND";
const shortLinkPathPattern = /^\/go\/([^/]+)\/?$/;
const shortLinkSlugPattern = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const errorKicker = document.querySelector("#error-kicker");
const errorCode = document.querySelector("#error-code");
const errorHeading = document.querySelector("#error-heading");
const errorCopy = document.querySelector("#error-copy");
const errorPath = document.querySelector("#error-path");
const errorAchievement = document.querySelector("#error-achievement");

errorPath.textContent = `PATH: ${window.location.pathname}`;

function recordNotFoundAchievement() {
  try {
    const stored = localStorage.getItem(achievementStorageKey);
    const achievements = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(achievements)) {
      throw new Error("Achievement storage does not contain an array.");
    }

    if (!achievements.some((entry) => entry?.id === achievementId)) {
      achievements.push({
        id: achievementId,
        label: achievementLabel,
        message: achievementMessage,
        unlockedAt: new Date().toISOString(),
      });
      localStorage.setItem(achievementStorageKey, JSON.stringify(achievements));
      errorAchievement.textContent =
        `ACHIEVEMENT UNLOCKED // ${achievementLabel}`;
    } else {
      errorAchievement.textContent =
        `ACHIEVEMENT ALREADY RECOVERED // ${achievementMessage}`;
    }
  } catch (error) {
    console.error("Unable to record the 404 achievement:", error);
    errorAchievement.textContent = "ACHIEVEMENT CACHE UNAVAILABLE";
  }
}

function showShortLinkFailure(message, path) {
  document.title = "SHORTBIT // NOT FOUND";
  errorKicker.textContent = "REDIRECT LOOKUP FAILED";
  errorCode.textContent = "404";
  errorCode.setAttribute("aria-label", "ShortBit not found");
  errorHeading.textContent = "SHORTBIT_NOT_FOUND";
  errorCopy.textContent = message;
  errorPath.textContent = `ALIAS: ${path}`;
  errorAchievement.textContent = "NO REDIRECT WAS PERFORMED";
}

async function resolveShortLink(slug) {
  document.title = "RESOLVING SHORTBIT // SHORTBITS.NET";
  errorKicker.textContent = "SHORTBIT ROUTER";
  errorCode.textContent = "→";
  errorCode.setAttribute("aria-label", "Resolving ShortBit");
  errorHeading.textContent = "RESOLVING_SHORTBIT";
  errorCopy.textContent = "Looking up the requested destination...";
  errorPath.textContent = `ALIAS: ${slug}`;
  errorAchievement.textContent = "PLEASE STAND BY";

  const { url, anonKey } = window.SUPABASE_CONFIG ?? {};
  if (!url || !anonKey) {
    throw new Error("Supabase configuration is unavailable.");
  }

  const response = await fetch(`${url}/rest/v1/rpc/resolve_short_link`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_slug: slug }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload?.message || `ShortBit lookup returned ${response.status}.`,
    );
  }

  const destination = Array.isArray(payload)
    ? payload[0]?.destination_url
    : payload?.destination_url;
  if (!destination) {
    showShortLinkFailure(
      "This alias does not exist, is disabled, or has expired.",
      slug,
    );
    return;
  }

  const destinationUrl = new URL(destination);
  if (destinationUrl.protocol !== "https:") {
    throw new Error("Resolved ShortBit destination is not HTTPS.");
  }

  errorHeading.textContent = "REDIRECT_CONFIRMED";
  errorCopy.textContent = `Transferring to ${destinationUrl.hostname}...`;
  errorAchievement.textContent = "DESTINATION VERIFIED";
  window.setTimeout(() => {
    window.location.replace(destinationUrl.href);
  }, 350);
}

const shortLinkMatch = window.location.pathname.match(shortLinkPathPattern);
if (!shortLinkMatch) {
  recordNotFoundAchievement();
} else {
  let slug;
  try {
    slug = decodeURIComponent(shortLinkMatch[1]).toLowerCase();
  } catch (error) {
    console.error("Unable to decode ShortBit alias:", error);
    showShortLinkFailure("This alias contains invalid URL encoding.", "INVALID");
  }

  if (slug && !shortLinkSlugPattern.test(slug)) {
    showShortLinkFailure(
      "Aliases use 3-64 lowercase letters, numbers, hyphens, or underscores.",
      slug,
    );
  } else if (slug) {
    resolveShortLink(slug).catch((error) => {
      console.error("Unable to resolve ShortBit:", error);
      document.title = "SHORTBIT // UNAVAILABLE";
      errorKicker.textContent = "REDIRECT SERVICE ERROR";
      errorCode.textContent = "503";
      errorCode.setAttribute("aria-label", "Redirect service unavailable");
      errorHeading.textContent = "SHORTBIT_UNAVAILABLE";
      errorCopy.textContent =
        "The redirect service is temporarily unavailable. Please try again.";
      errorPath.textContent = `ALIAS: ${slug}`;
      errorAchievement.textContent = "NO REDIRECT WAS PERFORMED";
    });
  }
}
