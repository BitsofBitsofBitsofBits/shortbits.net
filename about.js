const operatorTimeZone = "America/Chicago";
const operatorLocalTime = document.querySelector("#operator-local-time");
const operatorState = document.querySelector("#operator-state");
const personalityChecksum = document.querySelector("#personality-checksum");
const operatorQueryButton = document.querySelector("#operator-query-button");
const operatorQueryOutput = document.querySelector("#operator-query-output");

const operatorTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: operatorTimeZone,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

const operatorFacts = [
  "Has opinions about semicolons, but they are still compiling.",
  "May contain trace amounts of JavaScript.",
  "Powered by curiosity, autocomplete, and at least one open tab.",
  "Supports Minecraft Education and an unreasonable number of Bits.",
  "Owns several side projects currently marked DO_NOT_DELETE.",
  "Username exceeds the recommended daily allowance of Bits.",
  "CSS proficiency remains legally ambiguous.",
  "Can turn a simple profile page into a desktop environment.",
  "Responds to both Caleb and unexpected production incidents.",
  "Primary debugging technique: stare at it until it confesses.",
];
const operatorStates = [
  "FUNCTIONING WITHIN PARAMETERS",
  "RECOMPILING PERSONALITY",
  "PROCESSING SIDE QUESTS",
  "AWAITING CAFFEINE INTERRUPT",
  "RUNNING ON OPTIMISTIC ASSUMPTIONS",
  "BACKGROUND TASKS MULTIPLYING",
  "CACHE FULL OF FUN FACTS",
  "MAINTENANCE WINDOW IGNORED",
  "TOUCHING GRASS DRIVER NOT FOUND",
  "SYNCHRONIZING LOOSE BITS",
  "UPTIME TECHNICALLY IMPRESSIVE",
  "ONE TAB AWAY FROM STABILITY",
];

let lastOperatorFact = -1;
let lastOperatorState = -1;

function updateOperatorClock() {
  const now = new Date();
  operatorLocalTime.textContent = operatorTimeFormatter.format(now);
}

function randomizeOperatorState() {
  let nextState = Math.floor(Math.random() * operatorStates.length);
  if (operatorStates.length > 1 && nextState === lastOperatorState) {
    nextState = (nextState + 1) % operatorStates.length;
  }

  lastOperatorState = nextState;
  operatorState.textContent = operatorStates[nextState];
}

function createPersonalityChecksum(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  const hexadecimal = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `B17-${hexadecimal.slice(0, 4)}-${hexadecimal.slice(4)}-${value.length}B`;
}

operatorQueryButton.addEventListener("click", () => {
  let nextFact = Math.floor(Math.random() * operatorFacts.length);
  if (operatorFacts.length > 1 && nextFact === lastOperatorFact) {
    nextFact = (nextFact + 1) % operatorFacts.length;
  }

  lastOperatorFact = nextFact;
  operatorQueryOutput.textContent = `QUERY RESULT: ${operatorFacts[nextFact]}`;
});

personalityChecksum.textContent = createPersonalityChecksum("BitsofBitsofBits");
randomizeOperatorState();
updateOperatorClock();
window.setInterval(updateOperatorClock, 1_000);

window.addEventListener("desktop-window:opened", (event) => {
  if (event.detail?.windowId === "about-window") {
    randomizeOperatorState();
  }
});
