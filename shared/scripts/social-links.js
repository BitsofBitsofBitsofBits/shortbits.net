(() => {
  const icons = Object.freeze(Object.fromEntries(
    ["github", "bluesky", "youtube", "twitch", "discord", "linkedin", "spotify", "facebook", "reddit"]
      .map(name => [name, `/shared/images/${name}.svg`]),
  ));
  const defaults = [
    ["GITHUB", "Tiny Bits Production Factory", "https://github.com/BitsofBitsofBitsofBits", "GH", "github", "#66ff9a"],
    ["PROJECTS", "Things that escaped localhost", "https://github.com/BitsofBitsofBitsofBits?tab=repositories", "01", "", "#63d8ff"],
    ["BLOG.LOG", "Longer-form Bits and project notes", "/blog/", "BL", "", "#ffcf66"],
    ["BLUESKY", "Flying blue Bits in the Sky", "https://bsky.app/profile/shortbits.net", "BS", "bluesky", "#7aa7ff"],
    ["YOUTUBE", "Occasionally moving pixels", "https://www.youtube.com/@BitsofBitsofBits", "YT", "youtube", "#ff6d7a"],
    ["TWITCH", "Sometimes my Bits Twitch a little.", "https://www.twitch.tv/bitsofbitsofbits", "TV", "twitch", "#b99aff"],
    ["DISCORD", "Wumpus stole my bits :(", "https://discord.com/users/202220288459538442", "DC", "discord", "#5865f2"],
    ["LINKEDIN", "Professional Bits", "https://www.linkedin.com/in/calebkmasters/", "IN", "linkedin", "#0a66c2"],
    ["Spotify", "Musical Bits", "https://open.spotify.com/user/22fainfo6ycgibjw5xlhmp3ba", "SP", "spotify", "#1db954"],
    ["Facebook", "Bits with a book full of faces", "https://www.facebook.com/calebkmasters", "FB", "facebook", "#1877f2"],
    ["REDDIT", "Bits in the hivemind", "https://www.reddit.com/user/BitsofBitsofBits/", "RD", "reddit", "#ff4500"],
  ].map(([label, description, url, icon_text, icon, color], index) => ({
    position: index + 1, sort_order: index + 1, label, description, url, icon_text, icon,
    image_url: "", color, personal: true, professional: ["github", "linkedin"].includes(icon),
    new_tab: url.startsWith("https:"), enabled: true,
  }));
  const query = "site_social_links?select=position,label,description,url,icon,icon_text,image_url,color,personal,professional,new_tab,sort_order&enabled=eq.true&order=sort_order.asc,position.asc";

  function safeUrl(value) {
    if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch { return false; }
  }

  function validate(row) {
    if (!row || typeof row !== "object") return false;
    const text = (key, max) => row[key] == null || (typeof row[key] === "string" && row[key].length <= max);
    return text("label", 100) && text("description", 300) && text("icon_text", 8)
      && text("url", 2000) && text("image_url", 2000)
      && typeof row.label === "string" && Boolean(row.label.trim()) && safeUrl(row.url)
      && (!row.icon || Object.hasOwn(icons, row.icon))
      && (!row.image_url || safeUrl(row.image_url))
      && /^#[0-9a-f]{6}$/i.test(row.color)
      && ["personal", "professional", "new_tab"].every(key => typeof row[key] === "boolean")
      && Number.isInteger(row.sort_order) && row.sort_order >= 0 && row.sort_order <= 2147483647;
  }

  function ordered(rows, surface) {
    return rows.filter(row => row.enabled !== false && row[surface])
      .sort((a, b) => a.sort_order - b.sort_order || a.position - b.position);
  }

  function iconNode(row, document) {
    const node = document.createElement("span");
    node.className = "link-icon";
    node.setAttribute("aria-hidden", "true");
    node.textContent = row.icon_text || row.label.slice(0, 2);
    const source = row.image_url || icons[row.icon];
    if (source) {
      const image = document.createElement("img");
      image.className = "link-icon-image";
      image.alt = "";
      image.src = source;
      image.referrerPolicy = "no-referrer";
      node.replaceChildren(image);
      image.addEventListener("error", () => { node.textContent = row.icon_text || row.label.slice(0, 2); });
    }
    return node;
  }

  function anchor(row, document, card = false) {
    if (!validate(row)) throw new Error("Invalid social-link data.");
    const link = document.createElement("a");
    link.href = row.url;
    if (row.new_tab) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    link.append(iconNode(row, document));
    const copy = document.createElement("span");
    copy.className = card ? "link-copy" : "social-link-label";
    const title = document.createElement("span");
    title.className = "link-title";
    title.textContent = row.label;
    copy.append(title);
    if (card) {
      link.className = "link-card";
      link.style.setProperty("--card-accent", row.color);
      const description = document.createElement("span");
      description.className = "link-description";
      description.textContent = row.description || "";
      copy.append(description);
    }
    const arrow = document.createElement("span");
    arrow.className = "link-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = row.new_tab ? "\u2197" : "\u2192";
    link.append(copy, arrow);
    return link;
  }

  function renderProfessional(rows, document) {
    for (const container of document.querySelectorAll("[data-social-links]")) {
      container.replaceChildren(...ordered(rows, "professional").map(row => anchor(row, document)));
      container.hidden = !container.children.length;
    }
  }

  let request;
  function load() {
    if (request) return request;
    request = (async () => {
      const { url, anonKey } = window.SUPABASE_CONFIG ?? {};
      if (!url || !anonKey) throw new Error("Social links require public Supabase configuration.");
      const rows = [];
      for (;;) {
        const response = await fetch(`${url}/rest/v1/${query}&limit=500&offset=${rows.length}`, {
          headers: { apikey: anonKey }, signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Social links request failed (HTTP ${response.status}).`);
        const page = await response.json();
        if (!Array.isArray(page) || !page.every(validate)) throw new Error("Invalid social links response.");
        rows.push(...page);
        if (page.length < 500) return rows;
      }
    })();
    request.catch(() => { request = null; });
    return request;
  }
  function initial(document) {
    const snapshot = document.querySelector("#link-grid")?.getAttribute("data-social-links-snapshot");
    const rows = snapshot === null || snapshot === undefined ? defaults : JSON.parse(snapshot);
    if (!Array.isArray(rows) || !rows.every(validate)) throw new Error("Invalid saved social links.");
    return rows;
  }
  window.SocialLinks = { icons, defaults, query, safeUrl, validate, ordered, anchor, renderProfessional, load, initial };
})();
