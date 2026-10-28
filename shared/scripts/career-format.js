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
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function splitPeriod(value) {
    const text = (value ?? "").trim();
    return text.includes("·")
      ? text.split(/\s*·\s*/, 2)
      : (() => {
          const match = text.match(durationPattern);
          return match && match[1] ? [match[1], match[2].trim()] : [text, ""];
        })();
  }

  function monthNumber(value) {
    if (!/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(value)) return null;
    const [year, month] = value.split("-").map(Number);
    return year * 12 + month - 1;
  }

  function parseRolePeriod(value) {
    const [range] = splitPeriod(value);
    const match = range.match(/^([a-z]+)\s+([1-9]\d{3})\s*[-–—]\s*(?:(present|current|now)|([a-z]+)\s+([1-9]\d{3}))$/i);
    if (!match) return null;
    function monthValue(name, year) {
      const month = months.findIndex((label) => [label.toLowerCase(), label.slice(0, 3).toLowerCase(),
        ...(label === "September" ? ["sept"] : [])].includes(name.toLowerCase()));
      return month < 0 ? null : `${year}-${String(month + 1).padStart(2, "0")}`;
    }
    const start = monthValue(match[1], match[2]);
    const current = Boolean(match[3]);
    const end = current ? "" : monthValue(match[4], match[5]);
    if (!start || (!current && (!end || monthNumber(end) < monthNumber(start)))) return null;
    return { start, end, current };
  }

  function formatRolePeriod(start, end, current) {
    if (monthNumber(start) === null || (!current && (monthNumber(end) === null || end < start))) {
      throw new Error("A role needs a valid start month and an end month on or after it, or an active-role selection.");
    }
    function label(value) {
      const [year, month] = value.split("-").map(Number);
      return `${months[month - 1].slice(0, 3)} ${year}`;
    }
    return `${label(start)} - ${current ? "Present" : label(end)}`;
  }

  function buildPeriod(element, value, { live = false, now = new Date() } = {}) {
    const [range, authoredDuration = ""] = splitPeriod(value);
    let duration = authoredDuration;
    if (live) {
      element.dataset.careerPeriod = value ?? "";
      const dates = parseRolePeriod(value);
      if (dates) {
        const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
        const start = monthNumber(dates.start);
        const end = dates.current ? currentMonth : monthNumber(dates.end);
        duration = "";
        if (start <= currentMonth && end <= currentMonth) {
          // Month-level career dates include both the starting and ending month.
          const total = end - start + 1;
          const years = Math.floor(total / 12);
          const remainder = total % 12;
          duration = [
            years ? `${years} ${years === 1 ? "yr" : "yrs"}` : "",
            remainder ? `${remainder} ${remainder === 1 ? "mo" : "mos"}` : "",
          ].filter(Boolean).join(" ");
        }
      }
    } else {
      delete element.dataset.careerPeriod;
    }
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

  function refreshPeriods() {
    document.querySelectorAll("[data-career-period]").forEach((element) => {
      buildPeriod(element, element.dataset.careerPeriod, { live: true });
    });
  }

  window.CareerFormat = Object.freeze({
    buildPeriod,
    buildSummary,
    buildTechnologyList,
    formatRolePeriod,
    parseRolePeriod,
    refreshPeriods,
    splitTechnologies,
  });

  if (typeof window.setInterval === "function") {
    refreshPeriods();
    window.addEventListener("beforeprint", refreshPeriods);
    window.addEventListener("pageshow", refreshPeriods);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshPeriods();
    });
    window.setInterval(() => {
      if (!document.hidden) refreshPeriods();
    }, 60_000);
  }
})();
