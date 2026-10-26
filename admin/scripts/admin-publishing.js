(() => {
  const status = document.querySelector("#blog-deployment-status");
  if (!status) return;
  const details = document.querySelector("#blog-deployment-details");
  const refresh = document.querySelector("#blog-deployment-refresh");
  let sequence = 0;
  function report(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }
  function clear(message = "Sign in to compare saved posts with the deployed site.", state = "", allowRefresh = false) {
    sequence += 1;
    details.replaceChildren();
    refresh.disabled = !allowRefresh;
    report(message, state);
  }
  async function update(posts) {
    const request = ++sequence;
    refresh.disabled = true;
    details.replaceChildren();
    report("Comparing saved posts with the deployed snapshot...");
    try {
      const now = new Date();
      const [current, response] = await Promise.all([
        window.BITS_PUBLISHING.snapshot(posts, now),
        fetch(`/blog/content-manifest.json?checked=${now.getTime()}`, {
          cache: "no-store", signal: AbortSignal.timeout(15000),
        }),
      ]);
      if (!response.ok) throw new Error(`Deployed snapshot returned HTTP ${response.status}. Deploy the site, then check again.`);
      const deployed = window.BITS_PUBLISHING.validate(await response.json());
      const result = window.BITS_PUBLISHING.compare(current, deployed);
      if (request !== sequence) return;
      const pending = result.added.length + result.changed.length + result.removed.length;
      report(pending
        ? `Deployment needed: ${result.added.length} new, ${result.changed.length} changed, ${result.removed.length} removed article(s).`
        : "In sync: saved public posts match the deployed blog snapshot.", pending ? "warning" : "success");
      const lines = [
        `Static snapshot generated ${new Date(deployed.generatedAt).toLocaleString()}. Compared saved data at ${now.toLocaleString()}. Unsaved edits are not included.`,
      ];
      for (const [key, label] of [["added", "New"], ["changed", "Changed"], ["removed", "Still public until deployment removes them"]]) {
        if (result[key].length) lines.push(`${label}: ${result[key].slice(0, 20).join(", ")}${result[key].length > 20 ? " (and more)" : ""}.`);
      }
      const scheduled = posts.filter((post) => post.published && Date.parse(post.published_at) > now.getTime())
        .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
      if (scheduled.length) {
        lines.push(`${scheduled.length} scheduled post(s); next publication ${new Date(scheduled[0].published_at).toLocaleString()}. Check again and deploy after that time to include them in static pages and RSS.`);
      }
      for (const line of lines) {
        const item = document.createElement("li");
        item.textContent = line;
        details.append(item);
      }
    } catch (error) {
      if (request !== sequence) return;
      console.error("Publishing status comparison failed:", error);
      report(`Publishing status unavailable: ${error.message}`, "error");
    } finally {
      if (request === sequence) refresh.disabled = false;
    }
  }
  window.BITS_PUBLISHING_UI = Object.freeze({ update, clear });
  clear();
})();
