(() => {
  const root = document.documentElement;
  const deferred = [...document.querySelectorAll('script[type="application/x-bits-runtime"][src]')];
  const queued = [];
  const failures = new Set();
  let notice;
  let settled = false;
  let timeout;
  root.dataset.runtime = "pending";

  function showNotice(failed = false, message = "Loading controls… Your action is queued.") {
    if (!document.body) {
      return;
    }
    if (failed && notice?.getAttribute("role") === "alert") {
      return;
    }
    if (!notice) {
      notice = document.createElement("aside");
      notice.id = "bits-runtime-status";
      notice.style.cssText = "position:fixed;z-index:2147483647;right:12px;bottom:12px;max-width:320px;padding:10px 14px;border:1px solid var(--accent,#63d8ff);background:var(--panel,#0b1218);color:var(--ink,#e9f4ee);font:12px/1.5 monospace;box-shadow:0 4px 20px #0008";
      document.body.append(notice);
    }
    notice.setAttribute("role", failed ? "alert" : "status");
    notice.replaceChildren(document.createTextNode(failed
      ? "Some controls could not initialize. Reload to retry safely. "
      : message));
    if (failed) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.id = "bits-runtime-retry";
      retry.textContent = "Reload and retry";
      retry.style.cssText = "display:block;margin-top:8px;padding:6px 10px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer";
      retry.addEventListener("click", () => window.location.reload());
      notice.append(retry);
    }
  }

  function intercept(event) {
    const launcherShortcut = event.type === "keydown" && (event.ctrlKey || event.metaKey)
      && !event.altKey && event.key.toLowerCase() === "k";
    if (notice?.contains(event.target) || (event.target.closest?.("#boot-screen") && !launcherShortcut)) {
      return;
    }
    const control = event.target.closest?.("button, [role=button], [data-window-target]");
    if (event.type === "keydown") {
      if (!launcherShortcut) return;
    } else if (event.type !== "submit" && !control) {
      return;
    }
    if (event.type === "pointerdown") {
      event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (settled || failures.size) {
      showNotice(true);
      return;
    }
    if (event.type === "submit") {
      queued.push(() => {
        if (event.target.isConnected) {
          event.target.requestSubmit(event.submitter?.isConnected ? event.submitter : undefined);
          return true;
        }
        return false;
      });
    } else if (event.type === "click") {
      queued.push(() => {
        if (control.isConnected) {
          control.click();
          return true;
        }
        return false;
      });
    } else {
      const options = {
        key: event.key, code: event.code, ctrlKey: event.ctrlKey,
        altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey,
        bubbles: true, cancelable: true,
      };
      const target = event.target;
      queued.push(() => (target.isConnected ? target : document).dispatchEvent(new KeyboardEvent("keydown", options)));
    }
    showNotice();
  }

  const eventTypes = ["click", "pointerdown", "keydown", "submit"];
  eventTypes.forEach((type) => document.addEventListener?.(type, intercept, true));

  function recordFailure(source) {
    failures.add(source);
    root.dataset.runtime = "error";
    showNotice(true);
  }

  function handleRuntimeError(event) {
    if (deferred.some((placeholder) => placeholder.src === event.filename)) {
      recordFailure(event.filename);
    }
  }
  window.addEventListener?.("error", handleRuntimeError);

  function startRuntime() {
    const stylesheet = document.querySelector?.("[data-online-styles]");
    if (stylesheet && stylesheet.media !== "all") {
      stylesheet.media = "all";
      if (!stylesheet.sheet) {
        timeout = window.setTimeout?.(() => {
          recordFailure("Full stylesheet loading timed out");
          finishRuntime();
        }, 15000);
        stylesheet.addEventListener("load", () => {
          window.clearTimeout?.(timeout);
          if (!settled) startRuntime();
        }, { once: true });
        stylesheet.addEventListener("error", () => {
          recordFailure("Full stylesheet failed to load");
          finishRuntime();
        }, { once: true });
        return;
      }
    }
    if (deferred.length === 0) {
      finishRuntime();
      return;
    }
    let remaining = deferred.length;
    timeout = window.setTimeout?.(() => {
      recordFailure("Initialization timed out");
      finishRuntime();
    }, 15000);
    deferred.forEach((placeholder) => {
      const script = document.createElement("script");
      script.src = placeholder.src;
      // Dynamic scripts otherwise execute in download order, breaking shared globals.
      script.async = false;
      const complete = () => {
        remaining -= 1;
        if (remaining === 0) {
          finishRuntime();
        }
      };
      script.addEventListener("load", complete, { once: true });
      script.addEventListener("error", () => {
        recordFailure(script.src);
        complete();
      }, { once: true });
      document.head.append(script);
    });
  }

  function finishRuntime() {
    if (settled) {
      return;
    }
    settled = true;
    window.clearTimeout?.(timeout);
    window.removeEventListener?.("error", handleRuntimeError);
    if (failures.size) {
      queued.length = 0;
      window.dispatchEvent(new CustomEvent("bits:runtime-error", {
        detail: { sources: [...failures] },
      }));
      return;
    }
    root.dataset.runtime = "ready";
    eventTypes.forEach((type) => document.removeEventListener?.(type, intercept, true));
    notice?.remove();
    window.dispatchEvent(new CustomEvent("bits:runtime-ready"));
    queued.splice(0).forEach((replay) => {
      if (replay() === false) {
        showNotice(false, "Controls changed while loading. Please try the action again.");
      }
    });
  }

  // Animation frames can run before text is presented; wait for real content.
  if (typeof PerformanceObserver !== "undefined"
    && PerformanceObserver.supportedEntryTypes?.includes("paint")) {
    const observer = new PerformanceObserver((entries) => {
      if (entries.getEntries().some((entry) => entry.name === "first-contentful-paint")) {
        observer.disconnect();
        startRuntime();
      }
    });
    observer.observe({ type: "paint", buffered: true });
  } else {
    window.requestAnimationFrame(() => window.requestAnimationFrame(startRuntime));
  }
})();
