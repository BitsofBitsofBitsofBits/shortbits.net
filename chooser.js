(() => {
  const storageKey = "bits-site-choice";
  const destinations = {
    online: "/online/",
    professional: "/professional/",
  };
  const params = new URLSearchParams(window.location.search);

  // Links shared before the split (e.g. /?window=resume or /#contact) belong to the playful site.
  if (params.has("window") || params.has("windows") || window.location.hash) {
    window.location.replace(`/online/${window.location.search}${window.location.hash}`);
    return;
  }

  let savedChoice = null;
  try {
    savedChoice = localStorage.getItem(storageKey);
  } catch {
    // Storage can be unavailable in private browsing; fall back to the chooser.
  }

  if (!params.has("choose") && Object.hasOwn(destinations, savedChoice)) {
    window.location.replace(destinations[savedChoice]);
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const options = [...document.querySelectorAll("[data-site-choice]")];
    const remember = document.querySelector("#chooser-remember");

    if (params.has("choose")) {
      window.history.replaceState(null, "", "/");
    }

    const lastChoice = options.find((option) => option.dataset.siteChoice === savedChoice);
    if (lastChoice) {
      lastChoice.classList.add("is-last-choice");
      remember.checked = true;
    }

    options.forEach((option) => {
      option.addEventListener("click", () => {
        try {
          if (remember.checked) {
            localStorage.setItem(storageKey, option.dataset.siteChoice);
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch {
          // Navigation still works without a saved preference.
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const numbered = options[Number(event.key) - 1];
      if (numbered) {
        event.preventDefault();
        numbered.click();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }
      event.preventDefault();
      const current = options.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current === -1
        ? (step === 1 ? 0 : options.length - 1)
        : (current + step + options.length) % options.length;
      options[next].focus();
    });
  });
})();
