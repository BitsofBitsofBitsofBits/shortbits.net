(() => {
  window.SocialLinks.load().then(rows => {
    window.SocialLinks.renderProfessional(rows, document);
  }).catch(error => {
    console.error("Unable to refresh social links; retaining the saved links:", error);
    document.querySelectorAll("[data-social-links-status]").forEach(node => {
      node.textContent = "Social links could not refresh. Saved links are shown; reload to retry.";
    });
  });
})();
