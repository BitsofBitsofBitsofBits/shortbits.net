const operatorTimeZone = "America/Chicago";
const operatorLocalTime = document.querySelector("#operator-local-time");
const operatorState = document.querySelector("#operator-state");
const operatorAge = document.querySelector("#operator-age");
const personalityChecksum = document.querySelector("#personality-checksum");
const operatorQueryButton = document.querySelector("#operator-query-button");
const operatorQueryOutput = document.querySelector("#operator-query-output");

const operatorWindow = document.querySelector("#about-window");
let operatorTimeFormatter;
let operatorYearFormatter;

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

function getCentralBirthdayInstant(year) {
  return new Date(`${year}-06-26T00:31:00-05:00`);
}

function updateOperatorAge(now) {
  const currentYear = Number(operatorYearFormatter.format(now));
  let years = currentYear - 2002;
  let anniversary = getCentralBirthdayInstant(currentYear);

  if (now < anniversary) {
    years -= 1;
    anniversary = getCentralBirthdayInstant(currentYear - 1);
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - anniversary.getTime()) / 1_000),
  );
  const days = Math.floor(elapsedSeconds / 86_400);
  const hours = Math.floor((elapsedSeconds % 86_400) / 3_600);
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
  const seconds = elapsedSeconds % 60;

  operatorAge.textContent = [
    `${years}Y`,
    `${days}D`,
    `${String(hours).padStart(2, "0")}H`,
    `${String(minutes).padStart(2, "0")}M`,
    `${String(seconds).padStart(2, "0")}S`,
  ].join(" ");
}

function updateOperatorClock() {
  if (document.hidden || operatorWindow.hidden
    || operatorWindow.classList.contains("is-minimized")) return;
  operatorTimeFormatter ??= new Intl.DateTimeFormat("en-US", {
    timeZone: operatorTimeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  operatorYearFormatter ??= new Intl.DateTimeFormat("en-US", {
    timeZone: operatorTimeZone,
    year: "numeric",
  });
  const now = new Date();
  operatorLocalTime.textContent = operatorTimeFormatter.format(now);
  updateOperatorAge(now);
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
    updateOperatorClock();
  }
});
document.addEventListener("visibilitychange", updateOperatorClock);
