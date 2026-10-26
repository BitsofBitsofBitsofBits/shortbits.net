(() => {
  const contact = {
    email: ["CalebKmasters", "outlook.com"],
    phone: ["785", "304", "4404"],
  };
  const status = document.querySelector("#resume-status");
  const printButton = document.querySelector("#resume-print");
  const refreshButton = document.querySelector("#resume-refresh");
  const sheet = document.querySelector(".resume-sheet");
  const emailItem = document.querySelector("#resume-contact-email");
  const phoneItem = document.querySelector("#resume-contact-phone");

  function reveal() {
    sheet.classList.remove("is-loading");
    sheet.removeAttribute("aria-busy");
  }
  const savedSnapshot = sheet.dataset.resumeSnapshot;
  const revealTimer = savedSnapshot ? null : window.setTimeout(reveal, 2500);
  let pending = null;

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

  if (!window.CareerFormat || !window.CareerData || !window.ResumeContent) {
    setStatus("Showing the saved version.");
    reveal();
    return;
  }

  refreshButton.addEventListener("click", () => {
    if (!pending) return;
    window.ResumeContent.render(pending);
    pending = null;
    refreshButton.disabled = true;
    setStatus("Updated to the latest saved data.");
  });

  setStatus("Checking for updates...");
  window.CareerData.load({ fresh: Boolean(savedSnapshot) })
    .then(async (data) => {
      if (!data.profile || data.unavailable?.length) {
        setStatus("Update check incomplete. Saved version shown.");
        return;
      }
      if (!savedSnapshot) {
        window.ResumeContent.render(data);
        setStatus("Up to date.");
        return;
      }
      const digest = await crypto.subtle.digest("SHA-256",
        new TextEncoder().encode(window.ResumeContent.serialize(data)));
      const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (fingerprint === savedSnapshot) {
        setStatus("Saved resume is current.");
      } else {
        pending = data;
        refreshButton.disabled = false;
        setStatus("New data available. Update when ready.");
      }
    })
    .catch((error) => {
      console.warn("Unable to load résumé data:", error);
      setStatus("Update check failed. Saved version shown.");
    })
    .finally(() => {
      window.clearTimeout(revealTimer);
      reveal();
    });
})();
