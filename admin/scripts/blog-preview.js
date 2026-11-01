(() => {
  const body = document.querySelector("#blog-markdown-preview");
  window.BITS_BLOG_PREVIEW = Object.freeze({
    render({ title, excerpt, markdown, theme, scheme, variant }) {
      document.querySelector("#blog-preview-title").textContent = title.trim() || "Untitled post";
      document.querySelector("#blog-preview-excerpt").textContent = excerpt;
      if (markdown.trim()) {
        body.replaceChildren(window.BITS_MARKDOWN.render(markdown));
      } else {
        const empty = document.createElement("p");
        empty.textContent = "Your rendered post will appear here.";
        body.replaceChildren(empty);
      }
      window.BITS_THEME_PREFERENCE.apply(theme, { scheme, variant });
    },
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("a")) event.preventDefault();
  });
})();
