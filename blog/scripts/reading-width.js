(() => {
  const key = "bits-blog-reading-width";
  const choices = ["comfortable", "wide", "full"];
  let value = "comfortable";
  let storageError = false;
  const valid = candidate => choices.includes(candidate) ? candidate : "comfortable";
  function apply(candidate) {
    value = valid(candidate);
    document.documentElement.dataset.blogReadingWidth = value;
    window.dispatchEvent(new CustomEvent("bits:blog-reading-width", { detail: { value, storageError } }));
  }
  function read() {
    try {
      storageError = false;
      return valid(localStorage.getItem(key));
    } catch (error) {
      storageError = true;
      console.warn("Blog reading width could not be read. Using this page's preference.", error);
      return value;
    }
  }
  apply(read());
  window.BITS_BLOG_READING_WIDTH = {
    key, choices,
    get value() { return value; },
    get storageError() { return storageError; },
    select(candidate) {
      const next = valid(candidate);
      try {
        localStorage.setItem(key, next);
        storageError = false;
      } catch (error) {
        storageError = true;
        console.warn("Blog reading width could not be saved. The choice applies only to this page.", error);
      }
      apply(next);
    },
  };
  window.addEventListener("storage", event => {
    if (event.key === null || event.key === key) apply(read());
  });
  window.addEventListener("pageshow", () => apply(read()));
})();
