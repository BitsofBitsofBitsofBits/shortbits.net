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
const operatorHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: operatorTimeZone,
  hour: "numeric",
  hourCycle: "h23",
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

let lastOperatorFact = -1;

function getOperatorState(hour) {
  if (hour < 6) {
    return "SHOULD BE ASLEEP";
  }
  if (hour < 9) {
    return "BOOTING WITH CAFFEINE";
  }
  if (hour < 17) {
    return "FUNCTIONING WITHIN PARAMETERS";
  }
  if (hour < 22) {
    return "AFTER-HOURS PROCESSING";
  }
  return "CONSIDERING SLEEP MODE";
}

function updateOperatorClock() {
  const now = new Date();
  const operatorHour = Number(operatorHourFormatter.format(now));
  operatorLocalTime.textContent = operatorTimeFormatter.format(now);
  operatorState.textContent = getOperatorState(operatorHour);
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
updateOperatorClock();
window.setInterval(updateOperatorClock, 1_000);
