const achievementStorageKey = "bits-achievements";
const achievementId = "page-not-found";
const achievementLabel = "ACTUAL 404 DISCOVERED";
const achievementMessage = "BIT_NOT_FOUND";

document.querySelector("#error-path").textContent = `PATH: ${window.location.pathname}`;

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
    document.querySelector("#error-achievement").textContent =
      `ACHIEVEMENT UNLOCKED // ${achievementLabel}`;
  } else {
    document.querySelector("#error-achievement").textContent =
      `ACHIEVEMENT ALREADY RECOVERED // ${achievementMessage}`;
  }
} catch (error) {
  console.error("Unable to record the 404 achievement:", error);
  document.querySelector("#error-achievement").textContent =
    "ACHIEVEMENT CACHE UNAVAILABLE";
}
