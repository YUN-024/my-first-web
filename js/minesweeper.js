const gridEl = document.getElementById('ms-grid');
const minesLeftEl = document.getElementById('mines-left');
const timeEl = document.getElementById('time');
const bestTimeEl = document.getElementById('best-time');
const difficultySelect = document.getElementById('difficulty');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('game-overlay');
const overlayTitleEl = document.getElementById('overlay-title');
const overlayMessageEl = document.getElementById('overlay-message');
const newRecordEl = document.getElementById('new-record');
const restartBtn = document.getElementById('restart-btn');

const PRESETS = {
  easy:   { rows: 9,  cols: 9,  mines: 10, cellSize: 38 },
  medium: { rows: 16, cols: 16, mines: 40, cellSize: 30 },
  hard:   { rows: 16, cols: 30, mines: 99, cellSize: 20 },
};

const BEST_TIME_KEYS = {
  easy: 'pixel-site-minesweeper-besttime-easy',
  medium: 'pixel-site-minesweeper-besttime-medium',
  hard: 'pixel-site-minesweeper-besttime-hard',
};

const NUMBER_COLORS = {
  1: 'var(--accent-cyan)',
  2: 'var(--accent-yellow)',
  3: 'var(--accent-pink)',
  4: '#8a7fff',
  5: '#ff8c42',
  6: '#20c997',
  7: '#d63384',
  8: '#6c757d',
};

let rows = 9;
let cols = 9;
let totalMines = 10;
let currentDifficulty = 'medium';
let cells = [];
let firstClickDone = false;
let flagCount = 0;
let revealedCount = 0;
let elapsed = 0;
let timerInterval = null;
let gameActive = false;

function neighbors(idx) {
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        result.push(nr * cols + nc);
      }
    }
  }
  return result;
}

function getBestTime(difficulty) {
  const raw = localStorage.getItem(BEST_TIME_KEYS[difficulty]);
  return raw === null ? null : parseInt(raw, 10);
}

function updateBestTimeDisplay() {
  const best = getBestTime(currentDifficulty);
  bestTimeEl.textContent = best === null ? '--' : best;
}

function buildBoard(difficulty) {
  currentDifficulty = difficulty;
  const preset = PRESETS[difficulty];
  rows = preset.rows;
  cols = preset.cols;
  totalMines = preset.mines;

  clearInterval(timerInterval);
  elapsed = 0;
  timeEl.textContent = elapsed;
  flagCount = 0;
  revealedCount = 0;
  firstClickDone = false;
  gameActive = true;
  minesLeftEl.textContent = totalMines;
  overlay.classList.remove('visible');
  updateBestTimeDisplay();

  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${cols}, ${preset.cellSize}px)`;
  gridEl.style.fontSize = `${Math.round(preset.cellSize * 0.55)}px`;

  cells = [];
  for (let i = 0; i < rows * cols; i++) {
    const el = document.createElement('div');
    el.className = 'ms-cell';
    el.addEventListener('click', () => onLeftClick(i));
    el.addEventListener('contextmenu', (e) => onRightClick(e, i));
    gridEl.appendChild(el);
    cells.push({ el, mine: false, revealed: false, flagged: false, adjacent: 0, boom: false });
  }
}

function placeMines(safeIdx) {
  const forbidden = new Set([safeIdx, ...neighbors(safeIdx)]);
  let placed = 0;
  const total = rows * cols;
  while (placed < totalMines) {
    const idx = Math.floor(Math.random() * total);
    if (cells[idx].mine || forbidden.has(idx)) continue;
    cells[idx].mine = true;
    placed++;
  }
  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue;
    let count = 0;
    for (const n of neighbors(i)) {
      if (cells[n].mine) count++;
    }
    cells[i].adjacent = count;
  }
}

function renderCell(idx) {
  const cell = cells[idx];
  const el = cell.el;
  el.classList.remove('revealed', 'mine', 'flag', 'boom');
  el.style.color = '';
  if (cell.revealed) {
    el.classList.add('revealed');
    if (cell.mine) {
      el.classList.add('mine');
      if (cell.boom) el.classList.add('boom');
      el.textContent = '💣';
    } else {
      el.textContent = cell.adjacent > 0 ? String(cell.adjacent) : '';
      if (cell.adjacent > 0) el.style.color = NUMBER_COLORS[cell.adjacent];
    }
  } else if (cell.flagged) {
    el.classList.add('flag');
    el.textContent = '🚩';
  } else {
    el.textContent = '';
  }
}

function floodReveal(startIdx) {
  const queue = [startIdx];
  const seen = new Set([startIdx]);
  while (queue.length) {
    const idx = queue.shift();
    const cell = cells[idx];
    if (!cell.revealed) {
      cell.revealed = true;
      revealedCount++;
      renderCell(idx);
    }
    if (cell.adjacent === 0) {
      for (const n of neighbors(idx)) {
        if (!seen.has(n) && !cells[n].mine && !cells[n].revealed && !cells[n].flagged) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
  }
}

function revealAllMines(explodedIdx) {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].mine && !cells[i].revealed) {
      cells[i].revealed = true;
      if (i === explodedIdx) cells[i].boom = true;
      renderCell(i);
    }
  }
}

function onLeftClick(idx) {
  if (!gameActive) return;
  const cell = cells[idx];
  if (cell.flagged || cell.revealed) return;

  if (!firstClickDone) {
    firstClickDone = true;
    placeMines(idx);
    startTimer();
  }

  if (cell.mine) {
    loseGame(idx);
    return;
  }

  floodReveal(idx);
  checkWin();
}

function onRightClick(e, idx) {
  e.preventDefault();
  if (!gameActive) return;
  const cell = cells[idx];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  minesLeftEl.textContent = totalMines - flagCount;
  renderCell(idx);
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elapsed++;
    timeEl.textContent = elapsed;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function loseGame(explodedIdx) {
  gameActive = false;
  stopTimer();
  revealAllMines(explodedIdx);
  overlayTitleEl.textContent = '게임 오버';
  overlayMessageEl.textContent = '지뢰를 밟았습니다!';
  newRecordEl.textContent = '';
  overlay.classList.add('visible');
}

function checkWin() {
  if (revealedCount === rows * cols - totalMines) {
    winGame();
  }
}

function winGame() {
  gameActive = false;
  stopTimer();

  const best = getBestTime(currentDifficulty);
  const isNewRecord = best === null || elapsed < best;
  if (isNewRecord) {
    localStorage.setItem(BEST_TIME_KEYS[currentDifficulty], String(elapsed));
    updateBestTimeDisplay();
  }

  overlayTitleEl.textContent = '클리어!';
  overlayMessageEl.textContent = `클리어 시간: ${elapsed}s`;
  newRecordEl.textContent = isNewRecord ? '🎉 최고 기록!' : '';
  overlay.classList.add('visible');
}

startBtn.addEventListener('click', () => buildBoard(difficultySelect.value));
restartBtn.addEventListener('click', () => buildBoard(currentDifficulty));
difficultySelect.addEventListener('change', () => {
  if (!gameActive || !firstClickDone) buildBoard(difficultySelect.value);
});

buildBoard(difficultySelect.value);
