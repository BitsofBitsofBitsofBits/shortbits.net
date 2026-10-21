(() => {
  const bulletPattern = /^\s*[•\-*]\s+/;

  function splitTechnologies(value) {
    if (!value) {
      return [];
    }
    const seen = new Set();
    return value
      .split(/\s{2,}|[,;|•\n]/)
      .map((item) => item.trim())
      .filter((item) => {
        const key = item.toLowerCase();
        if (!item || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  function buildSummary(value, classes = {}) {
    const fragment = document.createDocumentFragment();
    let list = null;

    (value ?? "").split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        list = null;
        return;
      }
      if (bulletPattern.test(line)) {
        if (!list) {
          list = document.createElement("ul");
          if (classes.list) {
            list.className = classes.list;
          }
          fragment.append(list);
        }
        const item = document.createElement("li");
        item.textContent = line.replace(bulletPattern, "");
        list.append(item);
        return;
      }
      list = null;
      const paragraph = document.createElement("p");
      if (classes.paragraph) {
        paragraph.className = classes.paragraph;
      }
      paragraph.textContent = line;
      fragment.append(paragraph);
    });
    return fragment;
  }

  function buildTechnologyList(value, className, label) {
    const technologies = splitTechnologies(value);
    if (technologies.length === 0) {
      return null;
    }
    const list = document.createElement("ul");
    list.className = className;
    if (label) {
      list.setAttribute("aria-label", label);
    }
    technologies.forEach((technology) => {
      const item = document.createElement("li");
      item.textContent = technology;
      list.append(item);
    });
    return list;
  }

  const durationPattern = /^(.*?)\s*(?:[·•|]\s*)?((?:\d+\s*(?:yrs?|years?|mos?|months?)\s*)+)$/i;

  function buildPeriod(element, value) {
    const text = (value ?? "").trim();
    const [range, duration] = text.includes("·")
      ? text.split(/\s*·\s*/, 2)
      : (() => {
          const match = text.match(durationPattern);
          return match && match[1] ? [match[1], match[2].trim()] : [text, ""];
        })();
    const rangeLine = document.createElement("span");
    rangeLine.className = "career-period-range";
    rangeLine.textContent = range;
    element.replaceChildren(rangeLine);
    if (duration) {
      const durationLine = document.createElement("span");
      durationLine.className = "career-period-duration";
      durationLine.textContent = duration;
      element.append(durationLine);
    }
    return element;
  }

  window.CareerFormat = Object.freeze({
    buildPeriod,
    buildSummary,
    buildTechnologyList,
    splitTechnologies,
  });
})();
