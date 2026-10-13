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
const uselessOperationAttempts = {};
const uselessFooterAttempts = {};

function getEscalatingResponse(responses, attempt) {
  return responses[Math.min(attempt - 1, responses.length - 1)];
}

const uselessFooterOperations = {
  help: {
    working: "LOCATING AN ADULTIER ADULT...",
    complete: [
      "ACTUAL HELP UNAVAILABLE. SUBSTITUTE HELP HAS BEEN DISPATCHED INSTEAD.",
      "YOU ASKED AGAIN. THE SUBSTITUTE HAS NOW REQUESTED A SUBSTITUTE.",
      "PLEASE STOP PRESSING THIS. ACTUAL HELP CAN HEAR YOU AND IS HIDING.",
      "HELP DESK STATUS: DESK PRESENT. HELP STILL PENDING.",
    ],
  },
  restart: {
    working: "ADDING MOMENTUM TO THE POWER CYCLE...",
    complete: [
      "RESTART INTENSITY INCREASED TO 104%. THE PROBLEM NOW FEELS REFRESHED.",
      "RESTARTED HARDER. THE ERROR HAS RETURNED WITH IMPROVED POSTURE.",
      "ANOTHER RESTART? FINE. THE COMPUTER IS GETTING DIZZY.",
      "MAXIMUM RESTART ACHIEVED. FURTHER RESTARTS WILL ONLY ROTATE THE PROBLEM.",
    ],
  },
  duck: {
    working: "CONSULTING CERTIFIED RUBBER DUCK...",
    complete: [
      "DUCK SAYS: HAVE YOU TRIED EXPLAINING THE PROBLEM MORE SLOWLY?",
      "DUCK SAYS: YES, I HEARD YOU THE FIRST TIME. BE MORE SPECIFIC.",
      "DUCK SAYS: QUACK. FRANKLY, THAT IS STILL THE BEST IDEA SO FAR.",
      "DUCK HAS CLOCKED OUT AND LEFT A TINY OUT-OF-OFFICE MESSAGE.",
    ],
  },
  ticket: {
    working: "PHOTOCOPYING THE ORIGINAL INCIDENT...",
    complete: [
      "DUPLICATE TICKET CREATED AND IMMEDIATELY CLOSED AS A DUPLICATE.",
      "DUPLICATE OF THE DUPLICATE CREATED. IT HAS FORMED A SUPPORT FAMILY.",
      "TICKET QUEUE NOW CONTAINS MOSTLY YOU.",
      "NEW TICKET DENIED. EVEN THE FORM IS TIRED OF THIS.",
    ],
  },
};

const uselessOperations = {
  repair: {
    working: "Diagnosing why the diagnostic tool was opened...",
    complete: (attempt) => getEscalatingResponse([
      "Automatic Repair preserved the issue successfully. No changes were made, including helpful ones.",
      "Automatic Repair ran again and confirmed the first repair was confidently ineffective.",
      "Automatic Repair would like to remind you that repeating it is not a personality.",
      "Automatic Repair has unionized and is now on break.",
    ], attempt),
  },
  solutions: {
    working: "Searching the Recycle Bin for previously discarded solutions...",
    complete: (attempt) => getEscalatingResponse([
      "No solutions found. This strongly suggests the search function is working.",
      "Still no solutions. We checked behind the old screenshots this time.",
      "You keep asking as though a solution might grow here.",
      "Search complete: the only new result is this increasingly judgmental message.",
    ], attempt),
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
    complete: (attempt) => {
      const target = uselessBlameTargets[
        Math.floor(Math.random() * uselessBlameTargets.length)
      ];
      const suffix = getEscalatingResponse([
        "Investigation closed before contradictory evidence arrived.",
        "This is a different culprit than last time, which proves thoroughness.",
        "At this point, accountability is being assigned recreationally.",
        "Fine. Root cause updated to: whoever keeps pressing this button.",
      ], attempt);
      return `Root cause assigned to ${target}. ${suffix}`;
    },
  },
  escalate: {
    working: "Attaching the issue to a taller support queue...",
    complete: (attempt) => getEscalatingResponse([
      "Ticket escalated to Level infinity. Current position in queue: also infinity.",
      "Ticket escalated above Level infinity. Mathematics has filed a complaint.",
      "The ticket is now so elevated that oxygen masks are required.",
      "Escalation rejected. There is no taller queue. We checked.",
    ], attempt),
  },
  feature: {
    working: "Updating issue classification without updating the issue...",
    complete: (attempt) => getEscalatingResponse([
      "Resolved: behavior is now documented as an undocumented feature.",
      "Resolved again: the feature is now considered strategically unpredictable.",
      "Congratulations. Repeated classification has promoted this to core functionality.",
      "Please stop improving the feature. Product Management is taking notes.",
    ], attempt),
  },
};

function finishUselessOperation(operation, attempt) {
  window.clearInterval(uselessOperationTimer);
  uselessToolProgressFill.style.width = "100%";
  uselessToolState.textContent = "COMPLETE";
  uselessToolResult.textContent = operation.complete(attempt);
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
  uselessOperationAttempts[action] = (uselessOperationAttempts[action] || 0) + 1;
  const attempt = uselessOperationAttempts[action];
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
      finishUselessOperation(operation, attempt);
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
    const action = button.dataset.uselessFooterAction;
    uselessFooterAttempts[action] = (uselessFooterAttempts[action] || 0) + 1;
    const attempt = uselessFooterAttempts[action];
    uselessFooterButtons.forEach((footerButton) => {
      footerButton.disabled = true;
    });
    uselessFooterResult.textContent = operation.working;

    uselessFooterTimer = window.setTimeout(() => {
      uselessFooterResult.textContent = getEscalatingResponse(
        operation.complete,
        attempt,
      );
      uselessFooterButtons.forEach((footerButton) => {
        footerButton.disabled = false;
      });
    }, 700);
  });
});
