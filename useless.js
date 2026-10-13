const uselessToolButtons = [...document.querySelectorAll("[data-useless-action]")];
const uselessToolConsole = document.querySelector("#useless-tool-console");
const uselessToolState = document.querySelector("#useless-tool-state");
const uselessToolResult = document.querySelector("#useless-tool-result");
const uselessToolProgress = document.querySelector("#useless-tool-progress");
const uselessToolProgressFill = uselessToolProgress.querySelector("span");
const uselessFooterButtons = [
  ...document.querySelectorAll("[data-useless-footer-action]"),
];
const uselessFooterResult = document.querySelector("#useless-footer-result");
const uselessBlameTargets = [
  "the most recent update",
  "the next update",
  "a driver nobody remembers installing",
  "cosmic rays near the break room",
  "a printer on another network",
  "the user, provisionally",
];

let downloadedBits = 0;
let uselessOperationTimer;
let uselessFooterTimer;

const uselessFooterOperations = {
  help: {
    working: "LOCATING AN ADULTIER ADULT...",
    complete: "ACTUAL HELP UNAVAILABLE. SUBSTITUTE HELP HAS BEEN DISPATCHED INSTEAD.",
  },
  restart: {
    working: "ADDING MOMENTUM TO THE POWER CYCLE...",
    complete: "RESTART INTENSITY INCREASED TO 104%. THE PROBLEM NOW FEELS REFRESHED.",
  },
  duck: {
    working: "CONSULTING CERTIFIED RUBBER DUCK...",
    complete: "DUCK SAYS: HAVE YOU TRIED EXPLAINING THE PROBLEM MORE SLOWLY?",
  },
  ticket: {
    working: "PHOTOCOPYING THE ORIGINAL INCIDENT...",
    complete: "DUPLICATE TICKET CREATED AND IMMEDIATELY CLOSED AS A DUPLICATE.",
  },
};

const uselessOperations = {
  repair: {
    working: "Diagnosing why the diagnostic tool was opened...",
    complete: () => "Automatic Repair preserved the issue successfully. No changes were made, including helpful ones.",
  },
  solutions: {
    working: "Searching the Recycle Bin for previously discarded solutions...",
    complete: () => "No solutions found. This strongly suggests the search function is working.",
  },
  bits: {
    working: "Downloading unsigned Bits from a completely trustworthy rectangle...",
    complete: () => {
      downloadedBits += 8;
      return `${downloadedBits} additional Bits installed to /dev/null. Available storage remains exactly the same.`;
    },
  },
  blame: {
    working: "Comparing timestamps, vibes, and circumstantial evidence...",
    complete: () => {
      const target = uselessBlameTargets[
        Math.floor(Math.random() * uselessBlameTargets.length)
      ];
      return `Root cause assigned to ${target}. Investigation closed before contradictory evidence arrived.`;
    },
  },
  escalate: {
    working: "Attaching the issue to a taller support queue...",
    complete: () => "Ticket escalated to Level ∞. Current position in queue: also ∞.",
  },
  feature: {
    working: "Updating issue classification without updating the issue...",
    complete: () => "Resolved: behavior is now documented as an undocumented feature.",
  },
};

function finishUselessOperation(operation) {
  window.clearInterval(uselessOperationTimer);
  uselessToolProgressFill.style.width = "100%";
  uselessToolState.textContent = "COMPLETE";
  uselessToolResult.textContent = operation.complete();
  uselessToolConsole.removeAttribute("aria-busy");
  uselessToolButtons.forEach((button) => {
    button.disabled = false;
  });
  window.setTimeout(() => {
    uselessToolProgress.hidden = true;
    uselessToolProgressFill.style.width = "0%";
  }, 450);
}

function runUselessOperation(action) {
  const operation = uselessOperations[action];
  if (!operation) {
    throw new Error(`Unknown useless support operation: ${action}`);
  }

  window.clearInterval(uselessOperationTimer);
  uselessToolButtons.forEach((button) => {
    button.disabled = true;
  });
  uselessToolConsole.setAttribute("aria-busy", "true");
  uselessToolState.textContent = "WORKING";
  uselessToolResult.textContent = operation.working;
  uselessToolProgress.hidden = false;
  uselessToolProgressFill.style.width = "0%";

  let progress = 0;
  uselessOperationTimer = window.setInterval(() => {
    progress += 10;
    uselessToolProgressFill.style.width = `${progress}%`;
    if (progress >= 100) {
      finishUselessOperation(operation);
    }
  }, 110);
}

uselessToolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    runUselessOperation(button.dataset.uselessAction);
  });
});

uselessFooterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const operation = uselessFooterOperations[button.dataset.uselessFooterAction];
    if (!operation) {
      throw new Error(
        `Unknown useless footer operation: ${button.dataset.uselessFooterAction}`,
      );
    }

    window.clearTimeout(uselessFooterTimer);
    uselessFooterButtons.forEach((footerButton) => {
      footerButton.disabled = true;
    });
    uselessFooterResult.textContent = operation.working;

    uselessFooterTimer = window.setTimeout(() => {
      uselessFooterResult.textContent = operation.complete;
      uselessFooterButtons.forEach((footerButton) => {
        footerButton.disabled = false;
      });
    }, 700);
  });
});
