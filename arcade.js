const arcadeWindow = document.querySelector("#arcade-window");
const arcadeTabs = [...document.querySelectorAll("[data-arcade-game]")];
const arcadePanels = [...document.querySelectorAll("[data-arcade-panel]")];
const arcadeStatus = document.querySelector("#arcade-status");
const arcadeLocalBest = document.querySelector("#arcade-local-best");
const leaderboardTitle = document.querySelector("#arcade-leaderboard-title");
const leaderboardStatus = document.querySelector("#arcade-leaderboard-status");
const leaderboardList = document.querySelector("#arcade-leaderboard-list");
const leaderboardRefresh = document.querySelector("#arcade-leaderboard-refresh");
const scoreForm = document.querySelector("#arcade-score-form");
const scoreSubmit = document.querySelector("#arcade-score-submit");
const resultScore = document.querySelector("#arcade-result-score");
const arcadeStorageKey = "bits-arcade-bests-v1";
const arcadeGames = new Set(["snake", "minesweeper", "bitsweeper"]);
const playerNamePattern = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,23}$/;
const gameLabels = {
  snake: "SNAKE",
  minesweeper: "MINESWEEPER",
  bitsweeper: "BITSWEEPER",
};
let activeGame = "snake";
let pendingResult = null;

function readLocalBests() {
  try {
    const stored = JSON.parse(localStorage.getItem(arcadeStorageKey) || "{}");
    return Object.fromEntries(
      [...arcadeGames].map((game) => [
        game,
        Number.isInteger(stored[game]) && stored[game] >= 0 ? stored[game] : 0,
      ]),
    );
  } catch (error) {
    console.error("Unable to read Arcade high scores:", error);
    return { snake: 0, minesweeper: 0, bitsweeper: 0 };
  }
}

let localBests = readLocalBests();

function setArcadeStatus(message, state = "") {
  arcadeStatus.textContent = message;
  arcadeStatus.dataset.state = state;
}

function saveLocalBest(game, score) {
  if (score <= localBests[game]) {
    return false;
  }
  localBests[game] = score;
  try {
    localStorage.setItem(arcadeStorageKey, JSON.stringify(localBests));
  } catch (error) {
    console.error("Unable to save Arcade high score:", error);
  }
  updateLocalBest();
  return true;
}

function updateLocalBest() {
  arcadeLocalBest.textContent = localBests[activeGame].toLocaleString();
}

function getArcadeConnection() {
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey) {
    throw new Error("Arcade leaderboard is not configured.");
  }
  return {
    endpoint: `${url}/rest/v1/arcade_scores`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  };
}

function isValidScoreRow(row) {
  return row
    && typeof row.id === "string"
    && arcadeGames.has(row.game)
    && typeof row.player_name === "string"
    && row.player_name.length > 0
    && row.player_name.length <= 24
    && Number.isInteger(row.score)
    && row.score >= 0
    && row.score <= 1000000
    && typeof row.detail === "string"
    && row.detail.length <= 80
    && Number.isFinite(Date.parse(row.created_at));
}

function createLeaderboardEntry(entry, index) {
  const item = document.createElement("li");
  const rank = document.createElement("strong");
  const identity = document.createElement("div");
  const name = document.createElement("span");
  const detail = document.createElement("small");
  const score = document.createElement("b");

  rank.textContent = String(index + 1).padStart(2, "0");
  name.textContent = entry.player_name;
  detail.textContent = entry.detail;
  score.textContent = entry.score.toLocaleString();
  identity.append(name, detail);
  item.append(rank, identity, score);
  return item;
}

async function loadLeaderboard() {
  leaderboardStatus.textContent = "Loading global scores...";
  leaderboardList.replaceChildren();
  try {
    const { endpoint, headers } = getArcadeConnection();
    const game = encodeURIComponent(activeGame);
    const response = await fetch(
      `${endpoint}?select=id,game,player_name,score,detail,created_at&game=eq.${game}&order=score.desc,created_at.asc&limit=10`,
      { headers },
    );
    const scores = await response.json();
    if (!response.ok) {
      throw new Error(scores.message || `Leaderboard returned ${response.status}.`);
    }
    if (!Array.isArray(scores) || scores.some((score) => !isValidScoreRow(score))) {
      throw new Error("Leaderboard response is malformed.");
    }
    leaderboardList.replaceChildren(...scores.map(createLeaderboardEntry));
    leaderboardStatus.textContent = scores.length
      ? `Top ${scores.length} global score${scores.length === 1 ? "" : "s"}.`
      : "No scores submitted. The leaderboard fears you.";
    leaderboardStatus.dataset.state = "success";
  } catch (error) {
    console.error("Unable to load Arcade leaderboard:", error);
    leaderboardStatus.textContent = "Global leaderboard signal unavailable.";
    leaderboardStatus.dataset.state = "error";
  }
}

function prepareScore(game, score, detail) {
  saveLocalBest(game, score);
  pendingResult = { game, score, detail };
  resultScore.textContent = score.toLocaleString();
  scoreForm.hidden = false;
  scoreSubmit.disabled = false;
  scoreSubmit.textContent = "SUBMIT_SCORE";
}

function finishGame(game, score, detail, message, achievement) {
  const personalBest = saveLocalBest(game, score);
  setArcadeStatus(
    `${message}${personalBest ? " // NEW LOCAL BEST" : ""}`,
    score > 0 ? "success" : "error",
  );
  if (score > 0) {
    prepareScore(game, score, detail);
  }
  if (achievement) {
    window.BITS_ACHIEVEMENTS?.unlock(
      achievement.id,
      achievement.message,
      achievement.label,
    );
  }
}

function selectGame(game) {
  if (!arcadeGames.has(game)) {
    return;
  }
  if (activeGame === "minesweeper" && mineStarted && !mineFinished) {
    startMinesweeper();
  }
  stopSnake();
  stopBitsweeper();
  activeGame = game;
  pendingResult = null;
  scoreForm.hidden = true;
  arcadeTabs.forEach((tab) => {
    const selected = tab.dataset.arcadeGame === game;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  arcadePanels.forEach((panel) => {
    panel.hidden = panel.dataset.arcadePanel !== game;
  });
  leaderboardTitle.textContent = `${gameLabels[game]} LEADERBOARD`;
  updateLocalBest();
  setArcadeStatus(`${gameLabels[game]} subsystem ready.`);
  loadLeaderboard();
}

arcadeTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectGame(tab.dataset.arcadeGame));
});
leaderboardRefresh.addEventListener("click", loadLeaderboard);

scoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingResult) {
    setArcadeStatus("Complete a game before submitting a score.", "error");
    return;
  }
  const formData = new FormData(scoreForm);
  const playerName = String(formData.get("player_name") || "").trim();
  const website = String(formData.get("website") || "").trim();
  if (website) {
    setArcadeStatus("Score rejected by spam protection.", "error");
    return;
  }
  if (playerName && !playerNamePattern.test(playerName)) {
    setArcadeStatus(
      "Names may use letters, numbers, spaces, periods, underscores, and hyphens.",
      "error",
    );
    return;
  }

  scoreSubmit.disabled = true;
  scoreSubmit.textContent = "UPLOADING...";
  try {
    const { endpoint, headers } = getArcadeConnection();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        game: pendingResult.game,
        player_name: playerName || "ANONYMOUS",
        score: pendingResult.score,
        detail: pendingResult.detail,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Score submission failed with status ${response.status}: ${await response.text()}`,
      );
    }
    scoreForm.reset();
    scoreForm.hidden = true;
    pendingResult = null;
    setArcadeStatus("Score transmitted to the global leaderboard.", "success");
    window.BITS_NOTIFICATIONS?.notify({
      title: "SCORE UPLOADED",
      message: `${gameLabels[activeGame]} leaderboard updated.`,
      type: "success",
    });
    await loadLeaderboard();
  } catch (error) {
    console.error("Unable to submit Arcade score:", error);
    setArcadeStatus("Global score upload failed. Local best preserved.", "error");
    scoreSubmit.disabled = false;
    scoreSubmit.textContent = "RETRY_SCORE";
  }
});

const snakeCanvas = document.querySelector("#snake-canvas");
const snakeContext = snakeCanvas.getContext("2d");
const snakeScore = document.querySelector("#snake-score");
const snakeStart = document.querySelector("#snake-start");
const snakeGridSize = 20;
const snakeCellSize = snakeCanvas.width / snakeGridSize;
let snake = [];
let snakeFood = { x: 14, y: 10 };
let snakeDirection = { x: 1, y: 0 };
let snakeQueuedDirection = { x: 1, y: 0 };
let snakePoints = 0;
let snakeTimer = null;

function arcadeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent: styles.getPropertyValue("--accent").trim() || "#66ff9a",
    panel: styles.getPropertyValue("--panel").trim() || "#0b1016",
    muted: styles.getPropertyValue("--muted").trim() || "#829087",
    danger: styles.getPropertyValue("--danger").trim() || "#ff5f67",
  };
}

function drawSnake() {
  const colors = arcadeColors();
  snakeContext.fillStyle = colors.panel;
  snakeContext.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  snakeContext.strokeStyle = `${colors.muted}33`;
  snakeContext.lineWidth = 1;
  for (let index = 0; index <= snakeGridSize; index += 1) {
    const offset = index * snakeCellSize;
    snakeContext.beginPath();
    snakeContext.moveTo(offset, 0);
    snakeContext.lineTo(offset, snakeCanvas.height);
    snakeContext.stroke();
    snakeContext.beginPath();
    snakeContext.moveTo(0, offset);
    snakeContext.lineTo(snakeCanvas.width, offset);
    snakeContext.stroke();
  }
  snakeContext.fillStyle = colors.danger;
  snakeContext.fillRect(
    snakeFood.x * snakeCellSize + 3,
    snakeFood.y * snakeCellSize + 3,
    snakeCellSize - 6,
    snakeCellSize - 6,
  );
  snake.forEach((part, index) => {
    snakeContext.fillStyle = index === 0 ? "#ffffff" : colors.accent;
    snakeContext.fillRect(
      part.x * snakeCellSize + 2,
      part.y * snakeCellSize + 2,
      snakeCellSize - 4,
      snakeCellSize - 4,
    );
  });
}

function placeSnakeFood() {
  const openCells = [];
  for (let y = 0; y < snakeGridSize; y += 1) {
    for (let x = 0; x < snakeGridSize; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y)) {
        openCells.push({ x, y });
      }
    }
  }
  snakeFood = openCells[Math.floor(Math.random() * openCells.length)];
}

function stopSnake() {
  window.clearInterval(snakeTimer);
  snakeTimer = null;
}

function endSnake() {
  stopSnake();
  finishGame(
    "snake",
    snakePoints,
    `${snake.length} BITS`,
    `Snake process ended with ${snakePoints.toLocaleString()} points.`,
    snakePoints > 0
      ? { id: "snake-byte", label: "ARCADE ACHIEVEMENT", message: "THE SNAKE ATE A BYTE" }
      : null,
  );
}

function tickSnake() {
  snakeDirection = snakeQueuedDirection;
  const head = {
    x: snake[0].x + snakeDirection.x,
    y: snake[0].y + snakeDirection.y,
  };
  const ateFood = head.x === snakeFood.x && head.y === snakeFood.y;
  const collisionBody = ateFood ? snake : snake.slice(0, -1);
  if (
    head.x < 0
    || head.x >= snakeGridSize
    || head.y < 0
    || head.y >= snakeGridSize
    || collisionBody.some((part) => part.x === head.x && part.y === head.y)
  ) {
    endSnake();
    return;
  }
  snake.unshift(head);
  if (ateFood) {
    snakePoints += 100;
    snakeScore.textContent = snakePoints.toLocaleString();
    placeSnakeFood();
  } else {
    snake.pop();
  }
  drawSnake();
}

function startSnake() {
  stopSnake();
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  snakeDirection = { x: 1, y: 0 };
  snakeQueuedDirection = { x: 1, y: 0 };
  snakePoints = 0;
  snakeScore.textContent = "0";
  scoreForm.hidden = true;
  pendingResult = null;
  placeSnakeFood();
  drawSnake();
  setArcadeStatus("Snake process running. Consume responsibly.");
  snakeTimer = window.setInterval(tickSnake, 120);
}

function setSnakeDirection(direction) {
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const next = directions[direction];
  if (
    next
    && !(next.x === -snakeDirection.x && next.y === -snakeDirection.y)
  ) {
    snakeQueuedDirection = next;
  }
}

snakeStart.addEventListener("click", startSnake);
document.querySelectorAll("[data-snake-direction]").forEach((button) => {
  button.addEventListener("click", () => {
    setSnakeDirection(button.dataset.snakeDirection);
  });
});

const minesweeperBoard = document.querySelector("#minesweeper-board");
const minesweeperMines = document.querySelector("#minesweeper-mines");
const minesweeperTime = document.querySelector("#minesweeper-time");
const minesweeperStart = document.querySelector("#minesweeper-start");
const mineModeButtons = [...document.querySelectorAll("[data-mine-mode]")];
const mineSize = 9;
const mineCount = 10;
let mineCells = [];
let mineMode = "dig";
let mineStarted = false;
let mineFinished = false;
let mineSeconds = 0;
let mineTimer = null;

function mineIndex(row, column) {
  return (row * mineSize) + column;
}

function mineNeighbors(row, column) {
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (
        (rowOffset !== 0 || columnOffset !== 0)
        && nextRow >= 0
        && nextRow < mineSize
        && nextColumn >= 0
        && nextColumn < mineSize
      ) {
        neighbors.push(mineIndex(nextRow, nextColumn));
      }
    }
  }
  return neighbors;
}

function updateMineCounter() {
  const flags = mineCells.filter((cell) => cell.flagged).length;
  minesweeperMines.textContent = String(Math.max(0, mineCount - flags));
}

function renderMineCell(cell, index) {
  const button = minesweeperBoard.children[index];
  button.className = "mine-cell";
  button.textContent = "";
  if (cell.revealed) {
    button.classList.add("is-revealed");
    button.disabled = true;
    if (cell.mine) {
      button.classList.add("is-mine");
      button.textContent = "✹";
      button.setAttribute("aria-label", "Mine");
    } else if (cell.adjacent > 0) {
      button.dataset.adjacent = String(cell.adjacent);
      button.textContent = String(cell.adjacent);
      button.setAttribute("aria-label", `${cell.adjacent} adjacent mines`);
    } else {
      button.setAttribute("aria-label", "Empty revealed cell");
    }
  } else if (cell.flagged) {
    button.classList.add("is-flagged");
    button.textContent = "⚑";
    button.setAttribute("aria-label", "Flagged hidden cell");
  } else {
    button.setAttribute("aria-label", "Hidden cell");
  }
}

function renderMinefield() {
  mineCells.forEach(renderMineCell);
  updateMineCounter();
}

function plantMines(safeIndex) {
  const excluded = new Set([safeIndex, ...mineNeighbors(
    Math.floor(safeIndex / mineSize),
    safeIndex % mineSize,
  )]);
  const candidates = mineCells
    .map((_, index) => index)
    .filter((index) => !excluded.has(index));
  for (let count = 0; count < mineCount; count += 1) {
    const candidateIndex = Math.floor(Math.random() * candidates.length);
    const [selected] = candidates.splice(candidateIndex, 1);
    mineCells[selected].mine = true;
  }
  mineCells.forEach((cell, index) => {
    const row = Math.floor(index / mineSize);
    const column = index % mineSize;
    cell.adjacent = mineNeighbors(row, column)
      .filter((neighbor) => mineCells[neighbor].mine)
      .length;
  });
}

function stopMineTimer() {
  window.clearInterval(mineTimer);
  mineTimer = null;
}

function revealMineCell(startIndex) {
  const queue = [startIndex];
  const visited = new Set();
  while (queue.length) {
    const index = queue.shift();
    const cell = mineCells[index];
    if (visited.has(index) || cell.flagged || cell.revealed) {
      continue;
    }
    visited.add(index);
    cell.revealed = true;
    if (!cell.mine && cell.adjacent === 0) {
      const row = Math.floor(index / mineSize);
      const column = index % mineSize;
      queue.push(...mineNeighbors(row, column));
    }
  }
}

function finishMinesweeper(won) {
  mineFinished = true;
  stopMineTimer();
  if (!won) {
    mineCells.forEach((cell) => {
      if (cell.mine) {
        cell.revealed = true;
      }
    });
    renderMinefield();
    setArcadeStatus("Minefield integrity compromised. New field recommended.", "error");
    return;
  }
  const score = Math.max(1000, 10000 - (mineSeconds * 100));
  finishGame(
    "minesweeper",
    score,
    `${mineSeconds} SEC // 9x9`,
    `Minefield cleared in ${mineSeconds} seconds.`,
    { id: "mine-clear", label: "ARCADE ACHIEVEMENT", message: "NO BITS WERE EXPLODED" },
  );
}

function checkMineWin() {
  const hiddenSafeCells = mineCells.some((cell) => !cell.mine && !cell.revealed);
  if (!hiddenSafeCells) {
    finishMinesweeper(true);
  }
}

function interactWithMine(index, flagOnly = false) {
  if (mineFinished) {
    return;
  }
  if (!mineStarted && !flagOnly) {
    mineStarted = true;
    plantMines(index);
    mineTimer = window.setInterval(() => {
      mineSeconds += 1;
      minesweeperTime.textContent = String(mineSeconds);
    }, 1000);
  }
  const cell = mineCells[index];
  if (flagOnly) {
    if (!cell.revealed) {
      cell.flagged = !cell.flagged;
      renderMinefield();
    }
    return;
  }
  if (cell.flagged) {
    return;
  }
  if (cell.mine) {
    cell.revealed = true;
    finishMinesweeper(false);
    return;
  }
  revealMineCell(index);
  renderMinefield();
  checkMineWin();
}

function startMinesweeper() {
  stopMineTimer();
  mineCells = Array.from({ length: mineSize * mineSize }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adjacent: 0,
  }));
  mineStarted = false;
  mineFinished = false;
  mineSeconds = 0;
  minesweeperTime.textContent = "0";
  minesweeperMines.textContent = String(mineCount);
  scoreForm.hidden = true;
  pendingResult = null;
  minesweeperBoard.replaceChildren();
  mineCells.forEach((_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mine-cell";
    button.role = "gridcell";
    button.addEventListener("click", () => {
      interactWithMine(index, mineMode === "flag");
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      interactWithMine(index, true);
    });
    minesweeperBoard.append(button);
  });
  renderMinefield();
  setArcadeStatus("Fresh minefield generated. First dig is always safe.");
}

minesweeperStart.addEventListener("click", startMinesweeper);
mineModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mineMode = button.dataset.mineMode;
    mineModeButtons.forEach((modeButton) => {
      modeButton.setAttribute(
        "aria-pressed",
        String(modeButton.dataset.mineMode === mineMode),
      );
    });
  });
});

const bitsweeperCanvas = document.querySelector("#bitsweeper-canvas");
const bitsweeperContext = bitsweeperCanvas.getContext("2d");
const bitsweeperScore = document.querySelector("#bitsweeper-score");
const bitsweeperLives = document.querySelector("#bitsweeper-lives");
const bitsweeperTime = document.querySelector("#bitsweeper-time");
const bitsweeperInput = document.querySelector("#bitsweeper-input");
const bitsweeperStart = document.querySelector("#bitsweeper-start");
const bitsweeperWords = [
  "bit", "byte", "cache", "cloud", "codec", "cursor", "debug", "deploy",
  "ether", "firewall", "kernel", "matrix", "packet", "pixel", "prompt",
  "proxy", "reboot", "router", "script", "server", "socket", "stack",
  "syntax", "terminal", "thread", "token", "uptime", "vector",
];
let fallingWords = [];
let bitsweeperPoints = 0;
let bitsweeperHealth = 3;
let bitsweeperSeconds = 45;
let bitsweeperStartedAt = 0;
let bitsweeperLastFrame = 0;
let bitsweeperLastSpawn = 0;
let bitsweeperFrame = null;

function drawBitsweeper() {
  const colors = arcadeColors();
  bitsweeperContext.fillStyle = colors.panel;
  bitsweeperContext.fillRect(0, 0, bitsweeperCanvas.width, bitsweeperCanvas.height);
  bitsweeperContext.strokeStyle = colors.danger;
  bitsweeperContext.lineWidth = 3;
  bitsweeperContext.beginPath();
  bitsweeperContext.moveTo(0, bitsweeperCanvas.height - 24);
  bitsweeperContext.lineTo(bitsweeperCanvas.width, bitsweeperCanvas.height - 24);
  bitsweeperContext.stroke();
  bitsweeperContext.font = "bold 18px monospace";
  bitsweeperContext.textBaseline = "middle";
  fallingWords.forEach((target) => {
    bitsweeperContext.fillStyle = colors.accent;
    bitsweeperContext.fillText(target.word.toUpperCase(), target.x, target.y);
  });
}

function spawnBitsweeperWord(elapsedSeconds) {
  const word = bitsweeperWords[Math.floor(Math.random() * bitsweeperWords.length)];
  const estimatedWidth = word.length * 12;
  fallingWords.push({
    word,
    x: 12 + (Math.random() * (bitsweeperCanvas.width - estimatedWidth - 24)),
    y: 18,
    speed: 35 + (Math.random() * 25) + (elapsedSeconds * 0.7),
  });
}

function stopBitsweeper() {
  window.cancelAnimationFrame(bitsweeperFrame);
  bitsweeperFrame = null;
  bitsweeperInput.disabled = true;
}

function finishBitsweeper(message) {
  stopBitsweeper();
  finishGame(
    "bitsweeper",
    bitsweeperPoints,
    `${bitsweeperHealth} LIVES // ${45 - bitsweeperSeconds} SEC`,
    message,
    bitsweeperPoints > 0
      ? { id: "bitsweeper-defender", label: "ARCADE ACHIEVEMENT", message: "FIREWALL DEFENDED" }
      : null,
  );
}

function runBitsweeper(timestamp) {
  if (!bitsweeperLastFrame) {
    bitsweeperLastFrame = timestamp;
  }
  const delta = Math.min(0.05, (timestamp - bitsweeperLastFrame) / 1000);
  const elapsed = (timestamp - bitsweeperStartedAt) / 1000;
  bitsweeperLastFrame = timestamp;
  bitsweeperSeconds = Math.max(0, 45 - Math.floor(elapsed));
  bitsweeperTime.textContent = String(bitsweeperSeconds);

  if (timestamp - bitsweeperLastSpawn > Math.max(420, 1050 - (elapsed * 10))) {
    spawnBitsweeperWord(elapsed);
    bitsweeperLastSpawn = timestamp;
  }
  fallingWords.forEach((target) => {
    target.y += target.speed * delta;
  });
  const breached = fallingWords.filter(
    (target) => target.y >= bitsweeperCanvas.height - 28,
  );
  if (breached.length) {
    bitsweeperHealth = Math.max(0, bitsweeperHealth - breached.length);
    bitsweeperLives.textContent = String(bitsweeperHealth);
    fallingWords = fallingWords.filter(
      (target) => target.y < bitsweeperCanvas.height - 28,
    );
  }
  drawBitsweeper();
  if (bitsweeperHealth <= 0) {
    finishBitsweeper("Firewall breached. Typing defense terminated.");
    return;
  }
  if (bitsweeperSeconds <= 0) {
    finishBitsweeper("Firewall survived the full attack window.");
    return;
  }
  bitsweeperFrame = window.requestAnimationFrame(runBitsweeper);
}

function startBitsweeper() {
  stopBitsweeper();
  fallingWords = [];
  bitsweeperPoints = 0;
  bitsweeperHealth = 3;
  bitsweeperSeconds = 45;
  bitsweeperStartedAt = performance.now();
  bitsweeperLastFrame = 0;
  bitsweeperLastSpawn = 0;
  bitsweeperScore.textContent = "0";
  bitsweeperLives.textContent = "3";
  bitsweeperTime.textContent = "45";
  bitsweeperInput.value = "";
  bitsweeperInput.disabled = false;
  scoreForm.hidden = true;
  pendingResult = null;
  setArcadeStatus("Typing defense online. Protect the red firewall.");
  bitsweeperInput.focus();
  bitsweeperFrame = window.requestAnimationFrame(runBitsweeper);
}

bitsweeperStart.addEventListener("click", startBitsweeper);
bitsweeperInput.addEventListener("input", () => {
  const typed = bitsweeperInput.value.trim().toLowerCase();
  const targetIndex = fallingWords.findIndex((target) => target.word === typed);
  if (targetIndex < 0) {
    return;
  }
  const [target] = fallingWords.splice(targetIndex, 1);
  bitsweeperPoints += 100 + (target.word.length * 10);
  bitsweeperScore.textContent = bitsweeperPoints.toLocaleString();
  bitsweeperInput.value = "";
  drawBitsweeper();
});

document.addEventListener("keydown", (event) => {
  if (
    arcadeWindow.hidden
    || activeGame !== "snake"
    || !snakeTimer
    || event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
  ) {
    return;
  }
  const keyDirections = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };
  const direction = keyDirections[event.key];
  if (direction) {
    event.preventDefault();
    setSnakeDirection(direction);
  }
});

function suspendArcadeGame() {
  const gameWasRunning = Boolean(
    snakeTimer
    || bitsweeperFrame
    || (mineStarted && !mineFinished),
  );
  if (!gameWasRunning) {
    return;
  }
  stopSnake();
  stopBitsweeper();
  if (mineStarted && !mineFinished) {
    startMinesweeper();
  }
  setArcadeStatus("Game suspended. Press the game start control to restart.");
}

const arcadeVisibilityObserver = new MutationObserver(() => {
  if (arcadeWindow.hidden || arcadeWindow.classList.contains("is-minimized")) {
    suspendArcadeGame();
  }
});
arcadeVisibilityObserver.observe(arcadeWindow, {
  attributes: true,
  attributeFilter: ["class", "hidden"],
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    suspendArcadeGame();
  }
});

startMinesweeper();
drawSnake();
drawBitsweeper();
selectGame("snake");
