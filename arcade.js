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
const arcadeGames = new Set([
  "snake",
  "minesweeper",
  "bitsweeper",
  "tetris",
  "pong",
  "dodge",
  "cursor",
  "null-tac-toe",
  "breaker",
  "flappy",
]);
const rankingGames = new Set([
  "snake",
  "minesweeper-beginner",
  "minesweeper-intermediate",
  "minesweeper-expert",
  "bitsweeper",
  "tetris",
  "solitaire",
  "pong",
  "dodge",
  "cursor",
  "null-tac-toe",
  "breaker",
  "flappy",
]);
const playerNamePattern = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,23}$/;
const gameLabels = {
  snake: "SNAKE",
  minesweeper: "MINESWEEPER",
  bitsweeper: "BITSWEEPER",
  tetris: "BITRIS",
  solitaire: "BITITAIRE",
  pong: "BIT PONG",
  dodge: "PACKET DODGE",
  cursor: "CURSOR CHASE",
  "null-tac-toe": "NULL TAC TOE",
  breaker: "PACKET BREAKER",
  flappy: "FLAPPY BIT",
};
const mineDifficulties = {
  beginner: {
    rows: 9,
    columns: 9,
    mines: 10,
    baseScore: 10000,
  },
  intermediate: {
    rows: 16,
    columns: 16,
    mines: 40,
    baseScore: 25000,
  },
  expert: {
    rows: 16,
    columns: 30,
    mines: 99,
    baseScore: 50000,
  },
};
let activeGame = "snake";
let mineDifficulty = "beginner";
let pendingResult = null;
let arcadeSettings = {
  leaderboard_enabled: true,
  score_submissions_enabled: true,
};

function getRankingGame(game = activeGame) {
  return game === "minesweeper"
    ? `minesweeper-${mineDifficulty}`
    : game;
}

function getLeaderboardLabel() {
  if (activeGame === "minesweeper") {
    return `MINESWEEPER ${mineDifficulty.toUpperCase()}`;
  }
  return gameLabels[activeGame];
}

function readLocalBests() {
  try {
    const stored = JSON.parse(localStorage.getItem(arcadeStorageKey) || "{}");
    if (
      Number.isInteger(stored.minesweeper)
      && !Number.isInteger(stored["minesweeper-beginner"])
    ) {
      stored["minesweeper-beginner"] = stored.minesweeper;
    }
    return Object.fromEntries(
      [...rankingGames].map((game) => [
        game,
        Number.isInteger(stored[game]) && stored[game] >= 0 ? stored[game] : 0,
      ]),
    );
  } catch (error) {
    console.error("Unable to read Arcade high scores:", error);
    return Object.fromEntries([...rankingGames].map((game) => [game, 0]));
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
  arcadeLocalBest.textContent = localBests[getRankingGame()].toLocaleString();
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

async function loadArcadeSettings() {
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  if (!url || !anonKey) {
    throw new Error("Arcade settings are not configured.");
  }
  const response = await fetch(
    `${url}/rest/v1/arcade_settings?select=leaderboard_enabled,score_submissions_enabled&id=eq.global&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
  );
  const settings = await response.json();
  if (!response.ok || !Array.isArray(settings) || settings.length !== 1) {
    throw new Error(settings.message || "Arcade settings response is malformed.");
  }
  arcadeSettings = {
    leaderboard_enabled: settings[0].leaderboard_enabled === true,
    score_submissions_enabled: settings[0].score_submissions_enabled === true,
  };
  return arcadeSettings;
}

function isValidScoreRow(row) {
  return row
    && typeof row.id === "string"
    && rankingGames.has(row.game)
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
    const settings = await loadArcadeSettings();
    if (!settings.leaderboard_enabled) {
      leaderboardStatus.textContent = "Global leaderboard disabled by the operator.";
      leaderboardStatus.dataset.state = "";
      return;
    }
    const { endpoint, headers } = getArcadeConnection();
    const game = encodeURIComponent(getRankingGame());
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
  stopTetris();
  stopPong();
  stopDodge();
  stopCursorChase();
  stopNullTacToe();
  stopBreaker();
  stopFlappy();
  arcadeKeys.clear();
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
  leaderboardTitle.textContent = `${getLeaderboardLabel()} LEADERBOARD`;
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
    const settings = await loadArcadeSettings();
    if (!settings.score_submissions_enabled) {
      throw new Error("Score submissions are currently disabled by the operator.");
    }
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
      message: `${getLeaderboardLabel()} leaderboard updated.`,
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
    ink: styles.getPropertyValue("--ink").trim() || "#e9f4ee",
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
const mineDifficultyButtons = [
  ...document.querySelectorAll("[data-mine-difficulty]"),
];
let mineRows = mineDifficulties[mineDifficulty].rows;
let mineColumns = mineDifficulties[mineDifficulty].columns;
let mineCount = mineDifficulties[mineDifficulty].mines;
let mineCells = [];
let mineMode = "dig";
let mineStarted = false;
let mineFinished = false;
let mineSeconds = 0;
let mineTimer = null;

function mineIndex(row, column) {
  return (row * mineColumns) + column;
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
        && nextRow < mineRows
        && nextColumn >= 0
        && nextColumn < mineColumns
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
    Math.floor(safeIndex / mineColumns),
    safeIndex % mineColumns,
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
    const row = Math.floor(index / mineColumns);
    const column = index % mineColumns;
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
      const row = Math.floor(index / mineColumns);
      const column = index % mineColumns;
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
  const difficulty = mineDifficulties[mineDifficulty];
  const score = Math.max(1000, difficulty.baseScore - (mineSeconds * 100));
  finishGame(
    getRankingGame("minesweeper"),
    score,
    `${mineSeconds} SEC // ${mineColumns}x${mineRows}`,
    `${mineDifficulty.toUpperCase()} minefield cleared in ${mineSeconds} seconds.`,
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
  const difficulty = mineDifficulties[mineDifficulty];
  mineRows = difficulty.rows;
  mineColumns = difficulty.columns;
  mineCount = difficulty.mines;
  mineCells = Array.from({ length: mineRows * mineColumns }, () => ({
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
  minesweeperBoard.style.setProperty("--mine-columns", String(mineColumns));
  minesweeperBoard.style.setProperty("--mine-rows", String(mineRows));
  minesweeperBoard.setAttribute(
    "aria-label",
    `${mineDifficulty} Minesweeper board, ${mineColumns} by ${mineRows}`,
  );
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
  setArcadeStatus(
    `${mineDifficulty.toUpperCase()} minefield generated. First dig is always safe.`,
  );
}

minesweeperStart.addEventListener("click", startMinesweeper);
mineDifficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mineDifficulty = button.dataset.mineDifficulty;
    mineDifficultyButtons.forEach((difficultyButton) => {
      difficultyButton.setAttribute(
        "aria-pressed",
        String(difficultyButton.dataset.mineDifficulty === mineDifficulty),
      );
    });
    startMinesweeper();
    leaderboardTitle.textContent = `${getLeaderboardLabel()} LEADERBOARD`;
    updateLocalBest();
    loadLeaderboard();
  });
});
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

const tetrisCanvas = document.querySelector("#tetris-canvas");
const tetrisContext = tetrisCanvas.getContext("2d");
const tetrisScore = document.querySelector("#tetris-score");
const tetrisLines = document.querySelector("#tetris-lines");
const tetrisLevel = document.querySelector("#tetris-level");
const tetrisStart = document.querySelector("#tetris-start");
const tetrisColumns = 10;
const tetrisRows = 20;
const tetrisCellSize = tetrisCanvas.width / tetrisColumns;
const tetrominoes = [
  { color: "#4fd8ff", matrix: [[1, 1, 1, 1]] },
  { color: "#ffd84f", matrix: [[1, 1], [1, 1]] },
  { color: "#b98aff", matrix: [[0, 1, 0], [1, 1, 1]] },
  { color: "#58df7b", matrix: [[0, 1, 1], [1, 1, 0]] },
  { color: "#ff6573", matrix: [[1, 1, 0], [0, 1, 1]] },
  { color: "#5d88ff", matrix: [[1, 0, 0], [1, 1, 1]] },
  { color: "#ff9d4f", matrix: [[0, 0, 1], [1, 1, 1]] },
];
let tetrisBoard = [];
let tetrisPiece = null;
let tetrisPoints = 0;
let tetrisClearedLines = 0;
let tetrisCurrentLevel = 1;
let tetrisTimer = null;
let tetrisAchievementShown = false;

function createTetrisBoard() {
  return Array.from(
    { length: tetrisRows },
    () => Array(tetrisColumns).fill(null),
  );
}

function createTetrisPiece() {
  const template = tetrominoes[Math.floor(Math.random() * tetrominoes.length)];
  const matrix = template.matrix.map((row) => [...row]);
  return {
    color: template.color,
    matrix,
    x: Math.floor((tetrisColumns - matrix[0].length) / 2),
    y: 0,
  };
}

function rotateTetrisMatrix(matrix) {
  return matrix[0].map((_, column) => (
    matrix.map((row) => row[column]).reverse()
  ));
}

function tetrisCollides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  return matrix.some((row, rowIndex) => row.some((filled, columnIndex) => {
    if (!filled) {
      return false;
    }
    const x = piece.x + columnIndex + offsetX;
    const y = piece.y + rowIndex + offsetY;
    return (
      x < 0
      || x >= tetrisColumns
      || y >= tetrisRows
      || (y >= 0 && tetrisBoard[y][x])
    );
  }));
}

function drawTetrisCell(x, y, color) {
  tetrisContext.fillStyle = color;
  tetrisContext.fillRect(
    (x * tetrisCellSize) + 1,
    (y * tetrisCellSize) + 1,
    tetrisCellSize - 2,
    tetrisCellSize - 2,
  );
  tetrisContext.strokeStyle = "rgba(255, 255, 255, 0.28)";
  tetrisContext.strokeRect(
    (x * tetrisCellSize) + 3,
    (y * tetrisCellSize) + 3,
    tetrisCellSize - 6,
    tetrisCellSize - 6,
  );
}

function drawTetris() {
  const colors = arcadeColors();
  tetrisContext.fillStyle = colors.panel;
  tetrisContext.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);
  tetrisContext.strokeStyle = `${colors.muted}33`;
  tetrisContext.lineWidth = 1;
  for (let column = 0; column <= tetrisColumns; column += 1) {
    tetrisContext.beginPath();
    tetrisContext.moveTo(column * tetrisCellSize, 0);
    tetrisContext.lineTo(column * tetrisCellSize, tetrisCanvas.height);
    tetrisContext.stroke();
  }
  for (let row = 0; row <= tetrisRows; row += 1) {
    tetrisContext.beginPath();
    tetrisContext.moveTo(0, row * tetrisCellSize);
    tetrisContext.lineTo(tetrisCanvas.width, row * tetrisCellSize);
    tetrisContext.stroke();
  }
  tetrisBoard.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) {
        drawTetrisCell(x, y, color);
      }
    });
  });
  if (tetrisPiece) {
    tetrisPiece.matrix.forEach((row, rowIndex) => {
      row.forEach((filled, columnIndex) => {
        if (filled) {
          drawTetrisCell(
            tetrisPiece.x + columnIndex,
            tetrisPiece.y + rowIndex,
            tetrisPiece.color,
          );
        }
      });
    });
  }
}

function updateTetrisStats() {
  tetrisScore.textContent = tetrisPoints.toLocaleString();
  tetrisLines.textContent = String(tetrisClearedLines);
  tetrisLevel.textContent = String(tetrisCurrentLevel);
}

function stopTetris() {
  window.clearTimeout(tetrisTimer);
  tetrisTimer = null;
}

function scheduleTetrisTick() {
  stopTetris();
  const delay = Math.max(90, 780 - ((tetrisCurrentLevel - 1) * 65));
  tetrisTimer = window.setTimeout(() => {
    stepTetris();
    if (tetrisPiece) {
      scheduleTetrisTick();
    }
  }, delay);
}

function mergeTetrisPiece() {
  tetrisPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (filled) {
        const y = tetrisPiece.y + rowIndex;
        const x = tetrisPiece.x + columnIndex;
        if (y >= 0) {
          tetrisBoard[y][x] = tetrisPiece.color;
        }
      }
    });
  });
}

function clearTetrisLines() {
  let cleared = 0;
  tetrisBoard = tetrisBoard.filter((row) => {
    if (row.every(Boolean)) {
      cleared += 1;
      return false;
    }
    return true;
  });
  while (tetrisBoard.length < tetrisRows) {
    tetrisBoard.unshift(Array(tetrisColumns).fill(null));
  }
  if (!cleared) {
    return;
  }
  const lineScores = [0, 100, 300, 500, 800];
  tetrisPoints += lineScores[cleared] * tetrisCurrentLevel;
  tetrisClearedLines += cleared;
  tetrisCurrentLevel = Math.floor(tetrisClearedLines / 10) + 1;
  updateTetrisStats();
  if (!tetrisAchievementShown) {
    tetrisAchievementShown = true;
    window.BITS_ACHIEVEMENTS?.unlock(
      "tetris-line",
      "THE BITS HAVE FALLEN INTO PLACE",
      "ARCADE ACHIEVEMENT",
    );
  }
}

function finishTetris() {
  stopTetris();
  tetrisPiece = null;
  drawTetris();
  finishGame(
    "tetris",
    tetrisPoints,
    `${tetrisClearedLines} LINES // LVL ${tetrisCurrentLevel}`,
    `Stack overflow after ${tetrisClearedLines} cleared lines.`,
    null,
  );
}

function spawnTetrisPiece() {
  tetrisPiece = createTetrisPiece();
  if (tetrisCollides(tetrisPiece)) {
    finishTetris();
    return false;
  }
  return true;
}

function lockTetrisPiece() {
  mergeTetrisPiece();
  clearTetrisLines();
  if (!spawnTetrisPiece()) {
    return;
  }
  drawTetris();
}

function stepTetris(manual = false) {
  if (!tetrisPiece) {
    return;
  }
  if (!tetrisCollides(tetrisPiece, 0, 1)) {
    tetrisPiece.y += 1;
    if (manual) {
      tetrisPoints += 1;
      updateTetrisStats();
    }
    drawTetris();
    return;
  }
  lockTetrisPiece();
}

function moveTetris(horizontal) {
  if (tetrisPiece && !tetrisCollides(tetrisPiece, horizontal, 0)) {
    tetrisPiece.x += horizontal;
    drawTetris();
  }
}

function rotateTetris() {
  if (!tetrisPiece) {
    return;
  }
  const rotated = rotateTetrisMatrix(tetrisPiece.matrix);
  const wallKick = [0, -1, 1, -2, 2].find(
    (offset) => !tetrisCollides(tetrisPiece, offset, 0, rotated),
  );
  if (wallKick !== undefined) {
    tetrisPiece.x += wallKick;
    tetrisPiece.matrix = rotated;
    drawTetris();
  }
}

function hardDropTetris() {
  if (!tetrisPiece) {
    return;
  }
  let dropped = 0;
  while (!tetrisCollides(tetrisPiece, 0, 1)) {
    tetrisPiece.y += 1;
    dropped += 1;
  }
  tetrisPoints += dropped * 2;
  updateTetrisStats();
  lockTetrisPiece();
}

function runTetrisAction(action) {
  if (!tetrisPiece) {
    return;
  }
  if (action === "left") {
    moveTetris(-1);
  } else if (action === "right") {
    moveTetris(1);
  } else if (action === "rotate") {
    rotateTetris();
  } else if (action === "down") {
    stepTetris(true);
  } else if (action === "drop") {
    hardDropTetris();
  }
}

function startTetris() {
  stopTetris();
  tetrisBoard = createTetrisBoard();
  tetrisPoints = 0;
  tetrisClearedLines = 0;
  tetrisCurrentLevel = 1;
  tetrisAchievementShown = false;
  scoreForm.hidden = true;
  pendingResult = null;
  updateTetrisStats();
  spawnTetrisPiece();
  drawTetris();
  setArcadeStatus("Stack processor online. Avoid overflow.");
  scheduleTetrisTick();
}

tetrisStart.addEventListener("click", startTetris);
document.querySelectorAll("[data-tetris-action]").forEach((button) => {
  button.addEventListener("click", () => {
    runTetrisAction(button.dataset.tetrisAction);
  });
});

const solitaireMoves = document.querySelector("#solitaire-moves");
const solitaireHomeCount = document.querySelector("#solitaire-home-count");
const solitaireStart = document.querySelector("#solitaire-start");
const solitaireFoundations = document.querySelector("#solitaire-foundations");
const solitaireTableau = document.querySelector("#solitaire-tableau");
const solitaireSuits = ["B", "I", "T", "S"];
let solitairePiles = [];
let solitaireHomes = {};
let solitaireSelection = null;
let solitaireMoveCount = 0;

function createSolitaireDeck() {
  const deck = solitaireSuits.flatMap((suit, suitIndex) => (
    Array.from({ length: 6 }, (_, index) => ({
      polarity: suitIndex % 2,
      rank: index + 1,
      suit,
    }))
  ));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }
  return deck;
}

function renderSolitaire() {
  const homeCount = Object.values(solitaireHomes)
    .reduce((total, cards) => total + cards.length, 0);
  solitaireMoves.textContent = String(solitaireMoveCount);
  solitaireHomeCount.textContent = String(homeCount);
  solitaireFoundations.replaceChildren(...solitaireSuits.map((suit) => {
    const cards = solitaireHomes[suit];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bititaire-foundation";
    button.dataset.solitaireFoundation = suit;
    button.textContent = cards.length
      ? `${suit} // ${cards.at(-1).rank}`
      : `${suit} // HOME`;
    button.setAttribute("aria-label", `${suit} home stack, rank ${cards.length}`);
    return button;
  }));
  solitaireTableau.replaceChildren(...solitairePiles.map((pile, pileIndex) => {
    const column = document.createElement("div");
    column.className = "bititaire-pile";
    column.dataset.solitairePile = String(pileIndex);
    pile.forEach((card, cardIndex) => {
      const button = document.createElement("button");
      const isTop = cardIndex === pile.length - 1;
      button.type = "button";
      button.className = "bititaire-card";
      button.dataset.polarity = String(card.polarity);
      button.dataset.solitaireCard = `${pileIndex}:${cardIndex}`;
      button.textContent = `${card.suit}${card.rank} // ${card.polarity}`;
      button.disabled = !isTop;
      if (
        solitaireSelection?.pileIndex === pileIndex
        && solitaireSelection?.cardIndex === cardIndex
      ) {
        button.classList.add("is-selected");
      }
      column.append(button);
    });
    if (!pile.length) {
      column.setAttribute("aria-label", `Empty tableau column ${pileIndex + 1}`);
    }
    return column;
  }));
}

function startSolitaire() {
  const deck = createSolitaireDeck();
  solitairePiles = Array.from({ length: 6 }, () => []);
  deck.forEach((card, index) => solitairePiles[index % solitairePiles.length].push(card));
  solitaireHomes = Object.fromEntries(solitaireSuits.map((suit) => [suit, []]));
  solitaireSelection = null;
  solitaireMoveCount = 0;
  scoreForm.hidden = true;
  pendingResult = null;
  renderSolitaire();
  setArcadeStatus("BITITAIRE dealt. Please sort your Bits responsibly.");
}

function selectSolitaireCard(pileIndex, cardIndex) {
  const pile = solitairePiles[pileIndex];
  if (!pile || cardIndex !== pile.length - 1) {
    return;
  }
  solitaireSelection = { cardIndex, pileIndex };
  renderSolitaire();
}

function finishSolitaireIfWon() {
  const homeCount = Object.values(solitaireHomes)
    .reduce((total, cards) => total + cards.length, 0);
  if (homeCount !== 24) {
    return;
  }
  const score = Math.max(1000, 12000 - (solitaireMoveCount * 75));
  finishGame(
    "solitaire",
    score,
    `${solitaireMoveCount} MOVES`,
    "All Bits successfully filed at home.",
    { id: "bititaire-sorted", label: "SOLITAIRE PROTOCOL", message: "EVERY BIT HAS A HOME" },
  );
}

solitaireTableau.addEventListener("click", (event) => {
  const cardButton = event.target.closest("[data-solitaire-card]");
  const pileElement = event.target.closest("[data-solitaire-pile]");
  if (!pileElement) {
    return;
  }
  const targetPileIndex = Number(pileElement.dataset.solitairePile);
  if (!solitaireSelection) {
    if (!cardButton) {
      return;
    }
    const [pileIndex, cardIndex] = cardButton.dataset.solitaireCard.split(":").map(Number);
    selectSolitaireCard(pileIndex, cardIndex);
    return;
  }
  const sourcePile = solitairePiles[solitaireSelection.pileIndex];
  const card = sourcePile.at(-1);
  const targetPile = solitairePiles[targetPileIndex];
  const targetCard = targetPile.at(-1);
  const canMove = targetPileIndex !== solitaireSelection.pileIndex && (
    (!targetCard && card.rank === 6)
    || (
      targetCard
      && targetCard.rank === card.rank + 1
      && targetCard.polarity !== card.polarity
    )
  );
  if (canMove) {
    targetPile.push(sourcePile.pop());
    solitaireMoveCount += 1;
    solitaireSelection = null;
  } else if (cardButton) {
    const [pileIndex, cardIndex] = cardButton.dataset.solitaireCard.split(":").map(Number);
    selectSolitaireCard(pileIndex, cardIndex);
    return;
  } else {
    solitaireSelection = null;
  }
  renderSolitaire();
});

solitaireFoundations.addEventListener("click", (event) => {
  const foundation = event.target.closest("[data-solitaire-foundation]");
  if (!foundation || !solitaireSelection) {
    return;
  }
  const sourcePile = solitairePiles[solitaireSelection.pileIndex];
  const card = sourcePile.at(-1);
  const home = solitaireHomes[foundation.dataset.solitaireFoundation];
  if (card.suit === foundation.dataset.solitaireFoundation && card.rank === home.length + 1) {
    home.push(sourcePile.pop());
    solitaireMoveCount += 1;
    solitaireSelection = null;
    renderSolitaire();
    finishSolitaireIfWon();
  } else {
    setArcadeStatus("That Bit cannot go home yet.", "error");
  }
});

solitaireStart.addEventListener("click", startSolitaire);

const flappyCanvas = document.querySelector("#flappy-canvas");
const flappyContext = flappyCanvas.getContext("2d");
const flappyScore = document.querySelector("#flappy-score");
const flappyStart = document.querySelector("#flappy-start");
let flappyFrame = 0;
let flappyPreviousTime = 0;
let flappyBird = { velocity: 0, y: 220 };
let flappyPipes = [];
let flappyPoints = 0;

function drawFlappy() {
  const colors = arcadeColors();
  flappyContext.fillStyle = "#09121d";
  flappyContext.fillRect(0, 0, flappyCanvas.width, flappyCanvas.height);
  flappyContext.fillStyle = colors.accent;
  flappyContext.fillRect(105, flappyBird.y, 28, 28);
  flappyContext.fillStyle = colors.ink;
  flappyContext.font = "bold 15px monospace";
  flappyContext.fillText("1", 114, flappyBird.y + 19);
  flappyPipes.forEach((pipe) => {
    flappyContext.fillStyle = colors.muted;
    flappyContext.fillRect(pipe.x, 0, 64, pipe.gapY - 78);
    flappyContext.fillRect(pipe.x, pipe.gapY + 78, 64, flappyCanvas.height);
    flappyContext.fillStyle = colors.accent;
    flappyContext.fillText("FIREWALL", pipe.x - 5, Math.max(18, pipe.gapY - 88));
  });
}

function stopFlappy() {
  if (flappyFrame) {
    cancelAnimationFrame(flappyFrame);
  }
  flappyFrame = 0;
}

function finishFlappy() {
  stopFlappy();
  finishGame(
    "flappy",
    flappyPoints * 100,
    `${flappyPoints} FIREWALLS`,
    `SEGFAULT after ${flappyPoints} firewall${flappyPoints === 1 ? "" : "s"}.`,
    flappyPoints >= 5
      ? { id: "flappy-firewall", label: "PACKET AVIATOR", message: "FIVE FIREWALLS EVADED" }
      : null,
  );
}

function runFlappy(timestamp) {
  const delta = Math.min(32, timestamp - (flappyPreviousTime || timestamp));
  flappyPreviousTime = timestamp;
  flappyBird.velocity += 0.0017 * delta;
  flappyBird.y += flappyBird.velocity * delta;
  flappyPipes.forEach((pipe) => {
    pipe.x -= 0.22 * delta;
    if (!pipe.scored && pipe.x + 64 < 105) {
      pipe.scored = true;
      flappyPoints += 1;
      flappyScore.textContent = String(flappyPoints);
    }
  });
  if (!flappyPipes.length || flappyPipes.at(-1).x < 470) {
    flappyPipes.push({
      gapY: 120 + (Math.random() * 240),
      scored: false,
      x: 760,
    });
  }
  flappyPipes = flappyPipes.filter((pipe) => pipe.x > -70);
  const hitPipe = flappyPipes.some((pipe) => (
    pipe.x < 133
    && pipe.x + 64 > 105
    && (flappyBird.y < pipe.gapY - 78 || flappyBird.y + 28 > pipe.gapY + 78)
  ));
  if (flappyBird.y < 0 || flappyBird.y + 28 > flappyCanvas.height || hitPipe) {
    finishFlappy();
    return;
  }
  drawFlappy();
  flappyFrame = requestAnimationFrame(runFlappy);
}

function startFlappy() {
  stopFlappy();
  flappyBird = { velocity: 0, y: 220 };
  flappyPipes = [];
  flappyPoints = 0;
  flappyScore.textContent = "0";
  flappyPreviousTime = 0;
  scoreForm.hidden = true;
  pendingResult = null;
  drawFlappy();
  setArcadeStatus("FLAPPY BIT airborne. Space bar negotiates with gravity.");
  flappyFrame = requestAnimationFrame(runFlappy);
}

function flapBit() {
  if (flappyFrame) {
    flappyBird.velocity = -0.55;
  }
}

flappyCanvas.addEventListener("pointerdown", flapBit);
flappyStart.addEventListener("click", startFlappy);

const arcadeKeys = new Set();
const pongCanvas = document.querySelector("#pong-canvas");
const pongContext = pongCanvas.getContext("2d");
const pongPlayerScore = document.querySelector("#pong-player-score");
const pongCpuScore = document.querySelector("#pong-cpu-score");
const pongStart = document.querySelector("#pong-start");
let pongFrame = 0;
let pongPreviousTime = 0;
let pongPlayerY = 170;
let pongCpuY = 170;
let pongBall = { x: 360, y: 210, vx: 0.31, vy: 0.18 };
let pongPoints = { player: 0, cpu: 0 };

function drawPong() {
  const colors = arcadeColors();
  pongContext.fillStyle = "#07111a";
  pongContext.fillRect(0, 0, pongCanvas.width, pongCanvas.height);
  pongContext.strokeStyle = colors.muted;
  pongContext.setLineDash([8, 12]);
  pongContext.beginPath();
  pongContext.moveTo(pongCanvas.width / 2, 0);
  pongContext.lineTo(pongCanvas.width / 2, pongCanvas.height);
  pongContext.stroke();
  pongContext.setLineDash([]);
  pongContext.fillStyle = colors.accent;
  pongContext.fillRect(24, pongPlayerY, 14, 80);
  pongContext.fillStyle = colors.muted;
  pongContext.fillRect(pongCanvas.width - 38, pongCpuY, 14, 80);
  pongContext.fillStyle = colors.ink;
  pongContext.fillRect(pongBall.x - 8, pongBall.y - 8, 16, 16);
}

function resetPongBall(direction = 1) {
  pongBall = {
    x: pongCanvas.width / 2,
    y: 80 + (Math.random() * (pongCanvas.height - 160)),
    vx: direction * (0.3 + (Math.random() * 0.06)),
    vy: (Math.random() - 0.5) * 0.36,
  };
}

function stopPong() {
  cancelAnimationFrame(pongFrame);
  pongFrame = 0;
}

function finishPong(playerWon) {
  stopPong();
  const score = (pongPoints.player * 300) + (playerWon ? 1000 : 0);
  finishGame(
    "pong",
    score,
    `${pongPoints.player}-${pongPoints.cpu}`,
    playerWon ? "CPU process bounced out of memory." : "CPU process owns the socket.",
  );
}

function runPong(timestamp) {
  const delta = Math.min(32, timestamp - (pongPreviousTime || timestamp));
  pongPreviousTime = timestamp;
  if (arcadeKeys.has("ArrowUp") || arcadeKeys.has("w") || arcadeKeys.has("W")) {
    pongPlayerY -= 0.42 * delta;
  }
  if (arcadeKeys.has("ArrowDown") || arcadeKeys.has("s") || arcadeKeys.has("S")) {
    pongPlayerY += 0.42 * delta;
  }
  pongPlayerY = Math.max(0, Math.min(pongCanvas.height - 80, pongPlayerY));
  const cpuTarget = pongBall.y - 40;
  pongCpuY += Math.sign(cpuTarget - pongCpuY) * Math.min(Math.abs(cpuTarget - pongCpuY), 0.26 * delta);
  pongCpuY = Math.max(0, Math.min(pongCanvas.height - 80, pongCpuY));
  pongBall.x += pongBall.vx * delta;
  pongBall.y += pongBall.vy * delta;
  if (pongBall.y < 8 || pongBall.y > pongCanvas.height - 8) {
    pongBall.y = Math.max(8, Math.min(pongCanvas.height - 8, pongBall.y));
    pongBall.vy *= -1;
  }
  const hitPlayer = pongBall.vx < 0
    && pongBall.x - 8 <= 38
    && pongBall.x > 20
    && pongBall.y >= pongPlayerY
    && pongBall.y <= pongPlayerY + 80;
  const hitCpu = pongBall.vx > 0
    && pongBall.x + 8 >= pongCanvas.width - 38
    && pongBall.x < pongCanvas.width - 20
    && pongBall.y >= pongCpuY
    && pongBall.y <= pongCpuY + 80;
  if (hitPlayer || hitCpu) {
    const paddleY = hitPlayer ? pongPlayerY : pongCpuY;
    pongBall.vx = Math.sign(-pongBall.vx) * Math.min(0.62, Math.abs(pongBall.vx) * 1.055);
    pongBall.vy = ((pongBall.y - (paddleY + 40)) / 40) * 0.42;
    pongBall.x = hitPlayer ? 47 : pongCanvas.width - 47;
  }
  if (pongBall.x < -20 || pongBall.x > pongCanvas.width + 20) {
    const playerScored = pongBall.x > pongCanvas.width;
    pongPoints[playerScored ? "player" : "cpu"] += 1;
    pongPlayerScore.textContent = String(pongPoints.player);
    pongCpuScore.textContent = String(pongPoints.cpu);
    if (pongPoints.player >= 7 || pongPoints.cpu >= 7) {
      finishPong(pongPoints.player >= 7);
      return;
    }
    resetPongBall(playerScored ? -1 : 1);
  }
  drawPong();
  pongFrame = requestAnimationFrame(runPong);
}

function startPong() {
  stopPong();
  pongPoints = { player: 0, cpu: 0 };
  pongPlayerY = 170;
  pongCpuY = 170;
  pongPlayerScore.textContent = "0";
  pongCpuScore.textContent = "0";
  pongPreviousTime = 0;
  resetPongBall(Math.random() < 0.5 ? -1 : 1);
  scoreForm.hidden = true;
  pendingResult = null;
  setArcadeStatus("BIT PONG socket open. First process to seven wins.");
  pongFrame = requestAnimationFrame(runPong);
}

pongCanvas.addEventListener("pointermove", (event) => {
  const rect = pongCanvas.getBoundingClientRect();
  pongPlayerY = ((event.clientY - rect.top) / rect.height) * pongCanvas.height - 40;
});
pongStart.addEventListener("click", startPong);

const dodgeCanvas = document.querySelector("#dodge-canvas");
const dodgeContext = dodgeCanvas.getContext("2d");
const dodgeScore = document.querySelector("#dodge-score");
const dodgeCollectedOutput = document.querySelector("#dodge-collected");
const dodgeComboOutput = document.querySelector("#dodge-combo");
const dodgeLivesOutput = document.querySelector("#dodge-lives");
const dodgeStart = document.querySelector("#dodge-start");
let dodgeFrame = 0;
let dodgePreviousTime = 0;
let dodgePlayerX = 336;
let dodgePackets = [];
let dodgePoints = 0;
let dodgeCollected = 0;
let dodgeCombo = 0;
let dodgeAvoided = 0;
let dodgeLives = 3;
let dodgeSpawnTimer = 0;

function drawDodge() {
  const colors = arcadeColors();
  dodgeContext.fillStyle = "#07111a";
  dodgeContext.fillRect(0, 0, dodgeCanvas.width, dodgeCanvas.height);
  dodgeContext.fillStyle = colors.accent;
  dodgeContext.fillRect(dodgePlayerX, 374, 48, 22);
  dodgeContext.fillStyle = colors.ink;
  dodgeContext.font = "bold 14px monospace";
  dodgeContext.fillText("SAFE", dodgePlayerX + 6, 390);
  dodgePackets.forEach((packet) => {
    dodgeContext.fillStyle = packet.danger ? "#ff5267" : "#f4fbff";
    dodgeContext.fillRect(packet.x, packet.y, packet.size, packet.size);
    dodgeContext.fillStyle = "#07111a";
    dodgeContext.fillText(packet.danger ? "!" : "+", packet.x + 8, packet.y + 20);
  });
}

function stopDodge() {
  cancelAnimationFrame(dodgeFrame);
  dodgeFrame = 0;
}

function finishDodge() {
  stopDodge();
  finishGame(
    "dodge",
    dodgePoints,
    `${dodgeCollected} WHITE // ${dodgeAvoided} RED`,
    `${dodgeCollected} white packets cached and ${dodgeAvoided} corrupt packets avoided.`,
  );
}

function runDodge(timestamp) {
  const delta = Math.min(32, timestamp - (dodgePreviousTime || timestamp));
  dodgePreviousTime = timestamp;
  if (arcadeKeys.has("ArrowLeft") || arcadeKeys.has("a") || arcadeKeys.has("A")) {
    dodgePlayerX -= 0.48 * delta;
  }
  if (arcadeKeys.has("ArrowRight") || arcadeKeys.has("d") || arcadeKeys.has("D")) {
    dodgePlayerX += 0.48 * delta;
  }
  dodgePlayerX = Math.max(0, Math.min(dodgeCanvas.width - 48, dodgePlayerX));
  dodgeSpawnTimer -= delta;
  if (dodgeSpawnTimer <= 0) {
    const size = 26 + Math.floor(Math.random() * 12);
    dodgePackets.push({
      danger: Math.random() < 0.68,
      size,
      speed: 0.14 + (dodgePoints * 0.004) + (Math.random() * 0.12),
      x: Math.random() * (dodgeCanvas.width - size),
      y: -size,
    });
    dodgeSpawnTimer = Math.max(230, 650 - (dodgePoints * 9));
  }
  dodgePackets.forEach((packet) => {
    packet.y += packet.speed * delta;
  });
  dodgePackets = dodgePackets.filter((packet) => {
    if (dodgeLives <= 0) {
      return false;
    }
    const hit = (
      packet.y + packet.size >= 374
      && packet.y < 396
      && packet.x + packet.size > dodgePlayerX
      && packet.x < dodgePlayerX + 48
    );
    if (hit) {
      if (packet.danger) {
        dodgeLives -= 1;
        dodgeCombo = 0;
        dodgeLivesOutput.textContent = String(dodgeLives);
        dodgeComboOutput.textContent = "×1";
        if (dodgeLives <= 0) {
          finishDodge();
        }
      } else {
        dodgeCombo += 1;
        dodgeCollected += 1;
        const comboMultiplier = Math.min(5, dodgeCombo);
        dodgePoints += 150 * comboMultiplier;
        dodgeScore.textContent = String(dodgePoints);
        dodgeCollectedOutput.textContent = String(dodgeCollected);
        dodgeComboOutput.textContent = `×${comboMultiplier}`;
      }
      return false;
    }
    if (packet.y > dodgeCanvas.height) {
      if (packet.danger) {
        dodgeAvoided += 1;
        dodgePoints += 25;
        dodgeScore.textContent = String(dodgePoints);
      } else {
        dodgeCombo = 0;
        dodgeComboOutput.textContent = "×1";
      }
      return false;
    }
    return true;
  });
  if (!dodgeFrame) {
    return;
  }
  drawDodge();
  dodgeFrame = requestAnimationFrame(runDodge);
}

function startDodge() {
  stopDodge();
  dodgePlayerX = 336;
  dodgePackets = [];
  dodgePoints = 0;
  dodgeCollected = 0;
  dodgeCombo = 0;
  dodgeAvoided = 0;
  dodgeLives = 3;
  dodgeSpawnTimer = 0;
  dodgePreviousTime = 0;
  dodgeScore.textContent = "0";
  dodgeCollectedOutput.textContent = "0";
  dodgeComboOutput.textContent = "×1";
  dodgeLivesOutput.textContent = "3";
  scoreForm.hidden = true;
  pendingResult = null;
  setArcadeStatus("PACKET DODGE started. Collect white packets; avoid red corruption.");
  dodgeFrame = requestAnimationFrame(runDodge);
}

dodgeCanvas.addEventListener("pointermove", (event) => {
  const rect = dodgeCanvas.getBoundingClientRect();
  dodgePlayerX = ((event.clientX - rect.left) / rect.width) * dodgeCanvas.width - 24;
});
dodgeStart.addEventListener("click", startDodge);

const cursorCanvas = document.querySelector("#cursor-canvas");
const cursorContext = cursorCanvas.getContext("2d");
const cursorScore = document.querySelector("#cursor-score");
const cursorTime = document.querySelector("#cursor-time");
const cursorStart = document.querySelector("#cursor-start");
let cursorFrame = 0;
let cursorStartedAt = 0;
let cursorTarget = { x: 330, y: 180, size: 48 };
let cursorCatches = 0;

function moveCursorTarget() {
  cursorTarget.size = Math.max(24, 48 - cursorCatches);
  cursorTarget.x = 8 + (Math.random() * (cursorCanvas.width - cursorTarget.size - 16));
  cursorTarget.y = 8 + (Math.random() * (cursorCanvas.height - cursorTarget.size - 16));
}

function drawCursorChase() {
  const colors = arcadeColors();
  cursorContext.fillStyle = "#07111a";
  cursorContext.fillRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  cursorContext.strokeStyle = colors.muted;
  for (let x = 0; x < cursorCanvas.width; x += 40) {
    cursorContext.beginPath();
    cursorContext.moveTo(x, 0);
    cursorContext.lineTo(x, cursorCanvas.height);
    cursorContext.stroke();
  }
  cursorContext.fillStyle = colors.accent;
  cursorContext.fillRect(cursorTarget.x, cursorTarget.y, cursorTarget.size, cursorTarget.size);
  cursorContext.fillStyle = "#07111a";
  cursorContext.font = `bold ${Math.max(14, cursorTarget.size * 0.46)}px monospace`;
  cursorContext.fillText("1", cursorTarget.x + (cursorTarget.size * 0.34), cursorTarget.y + (cursorTarget.size * 0.68));
}

function stopCursorChase() {
  cancelAnimationFrame(cursorFrame);
  cursorFrame = 0;
}

function finishCursorChase() {
  stopCursorChase();
  finishGame(
    "cursor",
    cursorCatches * 100,
    `${cursorCatches} CATCHES`,
    `Rogue Bit caught ${cursorCatches} time${cursorCatches === 1 ? "" : "s"}.`,
  );
}

function runCursorChase(timestamp) {
  const remaining = Math.max(0, 20000 - (timestamp - cursorStartedAt));
  cursorTime.textContent = (remaining / 1000).toFixed(1);
  drawCursorChase();
  if (remaining <= 0) {
    finishCursorChase();
    return;
  }
  cursorFrame = requestAnimationFrame(runCursorChase);
}

function startCursorChase() {
  stopCursorChase();
  cursorCatches = 0;
  cursorScore.textContent = "0";
  cursorTime.textContent = "20.0";
  moveCursorTarget();
  scoreForm.hidden = true;
  pendingResult = null;
  setArcadeStatus("CURSOR CHASE active. Catch the rogue Bit.");
  cursorStartedAt = performance.now();
  cursorFrame = requestAnimationFrame(runCursorChase);
}

cursorCanvas.addEventListener("pointerdown", (event) => {
  if (!cursorFrame) {
    return;
  }
  const rect = cursorCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * cursorCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * cursorCanvas.height;
  if (
    x >= cursorTarget.x
    && x <= cursorTarget.x + cursorTarget.size
    && y >= cursorTarget.y
    && y <= cursorTarget.y + cursorTarget.size
  ) {
    cursorCatches += 1;
    cursorScore.textContent = String(cursorCatches);
    moveCursorTarget();
    drawCursorChase();
  }
});
cursorStart.addEventListener("click", startCursorChase);

const nullBoard = document.querySelector("#null-board");
const nullCells = [...nullBoard.querySelectorAll("[data-null-cell]")];
const nullStatus = document.querySelector("#null-status");
const nullStart = document.querySelector("#null-start");
const nullWins = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
let nullGrid = Array(9).fill("");
let nullFinished = false;
let nullMoves = 0;
let nullCpuTimer = 0;

function nullWinner(grid = nullGrid) {
  return nullWins.find((line) => line.every((index) => grid[index] && grid[index] === grid[line[0]]));
}

function renderNullTacToe() {
  nullCells.forEach((cell, index) => {
    cell.textContent = nullGrid[index];
    cell.dataset.value = nullGrid[index];
    cell.disabled = nullFinished || Boolean(nullGrid[index]);
    cell.setAttribute("aria-label", nullGrid[index] ? `Cell ${index + 1}: ${nullGrid[index]}` : `Empty cell ${index + 1}`);
  });
}

function stopNullTacToe() {
  const cpuWasThinking = Boolean(nullCpuTimer);
  clearTimeout(nullCpuTimer);
  nullCpuTimer = 0;
  if (cpuWasThinking) {
    nullFinished = true;
    nullStatus.textContent = "RESET REQUIRED";
    renderNullTacToe();
  }
}

function finishNullTacToe(result) {
  stopNullTacToe();
  nullFinished = true;
  renderNullTacToe();
  if (result === "0") {
    nullStatus.textContent = "0 PROCESS WINS";
    finishGame("null-tac-toe", 1200 - (nullMoves * 80), `${nullMoves} MOVES`, "0 process completed a valid row.");
  } else if (result === "1") {
    nullStatus.textContent = "1 PROCESS WINS";
    setArcadeStatus("The 1 process owns this grid.", "error");
  } else {
    nullStatus.textContent = "BOOLEAN DEADLOCK";
    finishGame("null-tac-toe", 300, "DRAW", "BOOLEAN DEADLOCK: no writable cells remain.");
  }
}

function findNullMove(value) {
  return nullGrid.findIndex((cell, index) => {
    if (cell) {
      return false;
    }
    const test = [...nullGrid];
    test[index] = value;
    return Boolean(nullWinner(test));
  });
}

function runNullCpu() {
  nullCpuTimer = 0;
  if (nullFinished) {
    return;
  }
  const open = nullGrid.map((cell, index) => (cell ? -1 : index)).filter((index) => index >= 0);
  const move = findNullMove("1") >= 0
    ? findNullMove("1")
    : findNullMove("0") >= 0
      ? findNullMove("0")
      : !nullGrid[4]
        ? 4
        : open[Math.floor(Math.random() * open.length)];
  nullGrid[move] = "1";
  nullMoves += 1;
  if (nullWinner()) {
    finishNullTacToe("1");
  } else if (nullGrid.every(Boolean)) {
    finishNullTacToe("draw");
  } else {
    nullStatus.textContent = "YOUR TURN";
    renderNullTacToe();
  }
}

function startNullTacToe() {
  stopNullTacToe();
  nullGrid = Array(9).fill("");
  nullFinished = false;
  nullMoves = 0;
  nullStatus.textContent = "YOUR TURN";
  scoreForm.hidden = true;
  pendingResult = null;
  renderNullTacToe();
  setArcadeStatus("NULL TAC TOE initialized. You are the 0 process.");
}

nullBoard.addEventListener("click", (event) => {
  const cell = event.target.closest("[data-null-cell]");
  if (!cell || nullFinished || nullGrid[Number(cell.dataset.nullCell)]) {
    return;
  }
  nullGrid[Number(cell.dataset.nullCell)] = "0";
  nullMoves += 1;
  renderNullTacToe();
  if (nullWinner()) {
    finishNullTacToe("0");
  } else if (nullGrid.every(Boolean)) {
    finishNullTacToe("draw");
  } else {
    nullStatus.textContent = "CPU THINKING";
    nullCells.forEach((button) => {
      button.disabled = true;
    });
    nullCpuTimer = window.setTimeout(runNullCpu, 280);
  }
});
nullStart.addEventListener("click", startNullTacToe);

const breakerCanvas = document.querySelector("#breaker-canvas");
const breakerContext = breakerCanvas.getContext("2d");
const breakerScore = document.querySelector("#breaker-score");
const breakerWaveOutput = document.querySelector("#breaker-wave");
const breakerLivesOutput = document.querySelector("#breaker-lives");
const breakerValueOutput = document.querySelector("#breaker-value");
const breakerStart = document.querySelector("#breaker-start");
let breakerFrame = 0;
let breakerPreviousTime = 0;
let breakerPaddleX = 310;
let breakerPaddleWidth = 100;
let breakerBall = { x: 360, y: 340, vx: 0.23, vy: -0.28 };
let breakerBricks = [];
let breakerPoints = 0;
let breakerLives = 3;
let breakerWave = 1;
let breakerPacketsBroken = 0;

function breakerValueMultiplier() {
  return [0, 0.35, 0.65, 1][breakerLives] || 0;
}

function updateBreakerReadouts() {
  breakerScore.textContent = String(breakerPoints);
  breakerWaveOutput.textContent = String(breakerWave);
  breakerLivesOutput.textContent = String(breakerLives);
  breakerValueOutput.textContent = `${Math.round(breakerValueMultiplier() * 100)}%`;
}

function createBreakerBricks() {
  const rows = Math.min(8, 4 + Math.ceil(breakerWave / 2));
  const bricks = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const patternedGap = breakerWave > 1
        && (row + (column * 2) + breakerWave) % (5 + (breakerWave % 2)) === 0;
      if (patternedGap) {
        continue;
      }
      const reinforced = breakerWave >= 3 && (row + column + breakerWave) % 4 === 0;
      const hardened = breakerWave >= 7 && row < Math.min(3, Math.floor(breakerWave / 4));
      const health = 1 + Number(reinforced) + Number(hardened);
      bricks.push({
        active: true,
        column,
        health,
        maxHealth: health,
        row,
      });
    }
  }
  return bricks;
}

function drawBreaker() {
  const colors = arcadeColors();
  breakerContext.fillStyle = "#07111a";
  breakerContext.fillRect(0, 0, breakerCanvas.width, breakerCanvas.height);
  breakerBricks.forEach((brick) => {
    if (!brick.active) {
      return;
    }
    const x = 20 + (brick.column * 76);
    const y = 24 + (brick.row * 30);
    breakerContext.fillStyle = brick.health >= 3
      ? "#ff5267"
      : brick.health === 2
        ? colors.muted
        : colors.accent;
    breakerContext.fillRect(x, y, 68, 20);
    if (brick.health > 1) {
      breakerContext.fillStyle = "#07111a";
      breakerContext.font = "bold 12px monospace";
      breakerContext.fillText(String(brick.health), x + 30, y + 15);
    }
  });
  breakerContext.fillStyle = colors.accent;
  breakerContext.fillRect(breakerPaddleX, 390, breakerPaddleWidth, 14);
  breakerContext.fillStyle = colors.ink;
  breakerContext.fillRect(breakerBall.x - 7, breakerBall.y - 7, 14, 14);
}

function resetBreakerBall() {
  const horizontalSpeed = Math.min(0.42, 0.23 + ((breakerWave - 1) * 0.014));
  const verticalSpeed = Math.min(0.5, 0.28 + ((breakerWave - 1) * 0.018));
  breakerBall = {
    x: breakerPaddleX + (breakerPaddleWidth / 2),
    y: 370,
    vx: (Math.random() < 0.5 ? -1 : 1) * horizontalSpeed,
    vy: -verticalSpeed,
  };
}

function stopBreaker() {
  cancelAnimationFrame(breakerFrame);
  breakerFrame = 0;
}

function loadNextBreakerWave() {
  const waveBonus = Math.round((500 + (breakerWave * 100)) * breakerValueMultiplier());
  breakerPoints = Math.min(999999, breakerPoints + waveBonus);
  breakerWave += 1;
  breakerPaddleWidth = Math.max(58, 100 - ((breakerWave - 1) * 4));
  breakerPaddleX = Math.max(0, Math.min(breakerCanvas.width - breakerPaddleWidth, breakerPaddleX));
  breakerBricks = createBreakerBricks();
  breakerPreviousTime = 0;
  resetBreakerBall();
  updateBreakerReadouts();
  setArcadeStatus(`FIREWALL WAVE ${breakerWave} loaded // ${Math.round(breakerValueMultiplier() * 100)}% packet value.`);
}

function finishBreaker() {
  stopBreaker();
  finishGame(
    "breaker",
    breakerPoints,
    `WAVE ${breakerWave} // ${breakerPacketsBroken} PACKETS`,
    `Buffer exhausted during firewall wave ${breakerWave}.`,
  );
}

function runBreaker(timestamp) {
  const delta = Math.min(32, timestamp - (breakerPreviousTime || timestamp));
  breakerPreviousTime = timestamp;
  if (arcadeKeys.has("ArrowLeft") || arcadeKeys.has("a") || arcadeKeys.has("A")) {
    breakerPaddleX -= 0.5 * delta;
  }
  if (arcadeKeys.has("ArrowRight") || arcadeKeys.has("d") || arcadeKeys.has("D")) {
    breakerPaddleX += 0.5 * delta;
  }
  breakerPaddleX = Math.max(0, Math.min(breakerCanvas.width - breakerPaddleWidth, breakerPaddleX));
  breakerBall.x += breakerBall.vx * delta;
  breakerBall.y += breakerBall.vy * delta;
  if (breakerBall.x < 7 || breakerBall.x > breakerCanvas.width - 7) {
    breakerBall.x = Math.max(7, Math.min(breakerCanvas.width - 7, breakerBall.x));
    breakerBall.vx *= -1;
  }
  if (breakerBall.y < 7) {
    breakerBall.y = 7;
    breakerBall.vy = Math.abs(breakerBall.vy);
  }
  if (
    breakerBall.vy > 0
    && breakerBall.y + 7 >= 390
    && breakerBall.y < 406
    && breakerBall.x >= breakerPaddleX
    && breakerBall.x <= breakerPaddleX + breakerPaddleWidth
  ) {
    breakerBall.y = 382;
    breakerBall.vy = -Math.abs(breakerBall.vy);
    breakerBall.vx = (
      (breakerBall.x - (breakerPaddleX + (breakerPaddleWidth / 2)))
      / (breakerPaddleWidth / 2)
    ) * Math.min(0.5, 0.36 + ((breakerWave - 1) * 0.012));
  }
  const hitBrick = breakerBricks.find((brick) => {
    if (!brick.active) {
      return false;
    }
    const x = 20 + (brick.column * 76);
    const y = 24 + (brick.row * 30);
    return (
      breakerBall.x + 7 >= x
      && breakerBall.x - 7 <= x + 68
      && breakerBall.y + 7 >= y
      && breakerBall.y - 7 <= y + 20
    );
  });
  if (hitBrick) {
    const brickY = 24 + (hitBrick.row * 30);
    hitBrick.health -= 1;
    breakerBall.vy *= -1;
    breakerBall.y = breakerBall.vy > 0 ? brickY + 27 : brickY - 7;
    if (hitBrick.health <= 0) {
      hitBrick.active = false;
      breakerPacketsBroken += 1;
      const packetValue = Math.round((100 + (breakerWave * 15)) * breakerValueMultiplier());
      breakerPoints = Math.min(999999, breakerPoints + packetValue);
      breakerScore.textContent = String(breakerPoints);
    }
  }
  if (breakerBricks.every((brick) => !brick.active)) {
    loadNextBreakerWave();
    drawBreaker();
    breakerFrame = requestAnimationFrame(runBreaker);
    return;
  }
  if (breakerBall.y > breakerCanvas.height + 10) {
    breakerLives -= 1;
    updateBreakerReadouts();
    if (breakerLives <= 0) {
      finishBreaker();
      return;
    }
    resetBreakerBall();
  }
  drawBreaker();
  breakerFrame = requestAnimationFrame(runBreaker);
}

function startBreaker() {
  stopBreaker();
  breakerPaddleX = 310;
  breakerPaddleWidth = 100;
  breakerWave = 1;
  breakerBricks = createBreakerBricks();
  breakerPoints = 0;
  breakerLives = 3;
  breakerPacketsBroken = 0;
  breakerPreviousTime = 0;
  updateBreakerReadouts();
  resetBreakerBall();
  scoreForm.hidden = true;
  pendingResult = null;
  setArcadeStatus("PACKET BREAKER endless breach started // full packet value.");
  breakerFrame = requestAnimationFrame(runBreaker);
}

breakerCanvas.addEventListener("pointermove", (event) => {
  const rect = breakerCanvas.getBoundingClientRect();
  breakerPaddleX = (
    ((event.clientX - rect.left) / rect.width) * breakerCanvas.width
  ) - (breakerPaddleWidth / 2);
});
breakerStart.addEventListener("click", startBreaker);

document.addEventListener("keydown", (event) => {
  if (
    arcadeWindow.hidden
    || event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
  ) {
    return;
  }
  arcadeKeys.add(event.key);
  if (
    ["pong", "dodge", "breaker"].includes(activeGame)
    && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "W", "a", "A", "s", "S", "d", "D"].includes(event.key)
  ) {
    event.preventDefault();
    return;
  }
  if (activeGame === "flappy" && flappyFrame && event.key === " ") {
    event.preventDefault();
    flapBit();
    return;
  }
  if (activeGame === "tetris" && tetrisPiece) {
    const tetrisActions = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "rotate",
      ArrowDown: "down",
      " ": "drop",
    };
    const action = tetrisActions[event.key];
    if (action) {
      event.preventDefault();
      runTetrisAction(action);
    }
    return;
  }
  if (activeGame !== "snake" || !snakeTimer) {
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

document.addEventListener("keyup", (event) => {
  arcadeKeys.delete(event.key);
});

function suspendArcadeGame() {
  const gameWasRunning = Boolean(
    snakeTimer
    || bitsweeperFrame
    || tetrisTimer
    || pongFrame
    || dodgeFrame
    || cursorFrame
    || nullCpuTimer
    || breakerFrame
    || flappyFrame
    || (mineStarted && !mineFinished),
  );
  if (!gameWasRunning) {
    return;
  }
  stopSnake();
  stopBitsweeper();
  stopTetris();
  stopPong();
  stopDodge();
  stopCursorChase();
  stopNullTacToe();
  stopBreaker();
  stopFlappy();
  arcadeKeys.clear();
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
tetrisBoard = createTetrisBoard();
drawTetris();
drawPong();
drawDodge();
drawCursorChase();
startNullTacToe();
breakerBricks = createBreakerBricks();
drawBreaker();
drawFlappy();
selectGame("snake");
