'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

//comment
//comment 2
//commrnt 3 
//comment 4
const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // Nut - metallic gray
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const gameOverView = document.getElementById('game-over-view');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backFromControlsBtn = document.getElementById('back-from-controls-btn');
const startLevelSelect = document.getElementById('start-level-select');

const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const startLeaderboardList = document.getElementById('start-leaderboard-list');
const startBestComboEl = document.getElementById('start-best-combo');
const startMaxLinesEl = document.getElementById('start-max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const gameoverExtra = document.getElementById('gameover-extra');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayLeaderboardList = document.getElementById('overlay-leaderboard-list');
const overlayBestComboEl = document.getElementById('overlay-best-combo');
const overlayMaxLinesEl = document.getElementById('overlay-max-lines');

const LEADERBOARD_KEY = 'tetris-leaderboard';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';
const MAX_LEADERBOARD_ENTRIES = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, scoreSaved;
let bestCombo = getBestCombo();
let maxLines = getMaxLines();
let gameStarted = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);

    combo++;
    if (combo > bestCombo) {
      bestCombo = combo;
      safeSetItem(BEST_COMBO_KEY, String(bestCombo));
    }
    if (lines > maxLines) {
      maxLines = lines;
      safeSetItem(MAX_LINES_KEY, String(maxLines));
    }

    updateHUD();
  } else {
    combo = 0;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (e.g. private browsing quota) — fail silently,
    // in-memory state still reflects the current session.
  }
}

function getLeaderboard() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEADERBOARD_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(list) {
  safeSetItem(LEADERBOARD_KEY, JSON.stringify(list));
}

function getBestCombo() {
  return parseInt(localStorage.getItem(BEST_COMBO_KEY), 10) || 0;
}

function getMaxLines() {
  return parseInt(localStorage.getItem(MAX_LINES_KEY), 10) || 0;
}

function renderLeaderboard(listEl, entries, highlightEntry) {
  listEl.innerHTML = '';
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = 'Sin puntuaciones aún';
    listEl.appendChild(li);
    return;
  }
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'leaderboard-item' + (entry === highlightEntry ? ' highlight' : '');
    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'leaderboard-score';
    scoreSpan.textContent = entry.score.toLocaleString();
    li.append(rank, name, scoreSpan);
    listEl.appendChild(li);
  });
}

function refreshStartScreen() {
  renderLeaderboard(startLeaderboardList, getLeaderboard(), null);
  startBestComboEl.textContent = bestCombo;
  startMaxLinesEl.textContent = maxLines;
}

function showGameOverLeaderboard() {
  const lb = getLeaderboard();
  const previewEntry = { name: 'Tú', score };
  const combined = [...lb, previewEntry].sort((a, b) => b.score - a.score).slice(0, MAX_LEADERBOARD_ENTRIES);
  const madeIt = combined.includes(previewEntry);
  renderLeaderboard(overlayLeaderboardList, combined, madeIt ? previewEntry : null);
  overlayBestComboEl.textContent = bestCombo;
  overlayMaxLinesEl.textContent = maxLines;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function gridColor() {
  return getComputedStyle(document.body).getPropertyValue('--grid-color').trim() || '#22222e';
}

function drawGrid() {
  ctx.strokeStyle = gridColor();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!gameOver) {
    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  pauseMenu.classList.add('hidden');
  gameOverView.classList.remove('hidden');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  scoreSaved = false;
  nameInput.value = '';
  nameInput.disabled = false;
  saveScoreBtn.disabled = false;
  saveScoreBtn.textContent = 'Guardar';
  gameoverExtra.classList.remove('hidden');
  showGameOverLeaderboard();

  overlay.classList.remove('hidden');
}

function showPauseView(view) {
  pauseMain.classList.toggle('hidden', view !== 'main');
  pauseControls.classList.toggle('hidden', view !== 'controls');
}

function openPauseMenu() {
  gameOverView.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  showPauseView('main');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!gameStarted || gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function getStartLevel() {
  let startLevel = parseInt(localStorage.getItem('tetris-start-level'), 10);
  if (!Number.isInteger(startLevel) || startLevel < MIN_START_LEVEL || startLevel > MAX_START_LEVEL) {
    startLevel = 1;
  }
  return startLevel;
}

function init() {
  gameStarted = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = getStartLevel();
  combo = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  gameoverExtra.classList.add('hidden');
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  gameOverView.classList.remove('hidden');
  showPauseView('main');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (paused && !pauseControls.classList.contains('hidden')) {
      showPauseView('main');
    } else {
      togglePause();
    }
    return;
  }
  if (!gameStarted || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

pauseRestartBtn.addEventListener('click', init);

showControlsBtn.addEventListener('click', () => showPauseView('controls'));

backFromControlsBtn.addEventListener('click', () => showPauseView('main'));

for (let i = MIN_START_LEVEL; i <= MAX_START_LEVEL; i++) {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = i;
  startLevelSelect.appendChild(opt);
}

startLevelSelect.value = getStartLevel();

startLevelSelect.addEventListener('change', () => {
  localStorage.setItem('tetris-start-level', startLevelSelect.value);
});

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
}

applyTheme(localStorage.getItem('tetris-theme') || 'dark');

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem('tetris-theme', theme);
  applyTheme(theme);
});

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});

saveScoreBtn.addEventListener('click', () => {
  if (scoreSaved) return;
  const name = (nameInput.value || '').trim().slice(0, 10) || 'Jugador';
  const entry = { name, score };
  const lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  const trimmed = lb.slice(0, MAX_LEADERBOARD_ENTRIES);
  saveLeaderboard(trimmed);

  scoreSaved = true;
  nameInput.disabled = true;
  saveScoreBtn.disabled = true;
  saveScoreBtn.textContent = 'Guardado';

  const madeIt = trimmed.includes(entry);
  renderLeaderboard(overlayLeaderboardList, trimmed, madeIt ? entry : null);
  refreshStartScreen();
});

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveScoreBtn.click();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!window.confirm('¿Seguro que quieres borrar todos los récords?')) return;
  localStorage.removeItem(LEADERBOARD_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  bestCombo = 0;
  maxLines = 0;
  refreshStartScreen();
  if (gameOver) showGameOverLeaderboard();
});

refreshStartScreen();
