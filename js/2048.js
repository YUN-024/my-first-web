// ---------- DOM refs ----------
const boardWrapEl = document.getElementById('board-wrap');
const gridBgEl = document.getElementById('grid-bg');
const tilesLayerEl = document.getElementById('tiles-layer');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const newGameBtn = document.getElementById('new-game-btn');
const winBannerEl = document.getElementById('win-banner');
const overlayEl = document.getElementById('game-overlay');
const finalScoreEl = document.getElementById('final-score');
const newRecordEl = document.getElementById('new-record');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

// ---------- high score ----------
const HIGH_SCORE_KEY = 'pixel-site-2048-highscore';
let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
highScoreEl.textContent = highScore;

// ---------- layout constants (must match the CSS on .grid-bg: padding + gap) ----------
const BOARD_PAD = 10;
const CELL_GAP = 8;
let cellSize = 72;

// ---------- game state ----------
const SIZE = 4;
let board = [];      // 4x4 array of tile refs or null
let tiles = [];       // flat list of live tile objects (+ briefly, "dead" merged-away tiles)
let tileElements = new Map(); // id -> DOM element
let nextId = 1;
let score = 0;
let running = true;
let hasWon = false;
let winBannerTimeout = null;

const VECTORS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

// ---------- tile colors ----------
// Fixed local hex colors (readable with a fixed dark/light text pick) for most tiers,
// a few tiers reuse the site's accent CSS vars with a dynamically-computed contrasting
// text color (since accent vars flip lightness between the light/dark theme).
const FIXED_COLORS = {
  2: ['#eee4da', '#5a5348'],
  4: ['#ede0c8', '#5a5348'],
  8: ['#f2b179', '#fff8f0'],
  16: ['#f59563', '#fff8f0'],
  32: ['#f67c5f', '#fff8f0'],
  128: ['#edcf72', '#3a2f18'],
  256: ['#edcc61', '#3a2f18'],
  1024: ['#e8b923', '#3a2f18'],
};
const ACCENT_TIERS = { 64: '--accent-cyan', 512: '--accent-pink', 2048: '--accent-yellow' };

function hexToRgb(hex) {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  if (h.length !== 6) return { r: 136, g: 136, b: 136 };
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0-255 heuristic, good enough for a text-color pick
}

function contrastTextColor(hexColor) {
  return relativeLuminance(hexToRgb(hexColor)) > 140 ? '#1b1b24' : '#f5f5f5';
}

function applyTileColor(el, value) {
  el.classList.toggle('tile-huge', value >= 4096);
  if (ACCENT_TIERS[value]) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(ACCENT_TIERS[value]).trim() || '#888888';
    el.style.background = raw;
    el.style.color = contrastTextColor(raw);
  } else if (FIXED_COLORS[value]) {
    const [bg, fg] = FIXED_COLORS[value];
    el.style.background = bg;
    el.style.color = fg;
  } else {
    // 4096 and beyond
    el.style.background = '#3c3a32';
    el.style.color = '#ffe9a8';
  }
}

// ---------- grid background (static cell frames, like mole.js's buildGrid pattern) ----------
function buildGridBackground() {
  gridBgEl.innerHTML = '';
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell-bg';
    gridBgEl.appendChild(cell);
  }
}

// ---------- layout ----------
function computeCellSize() {
  const wrapWidth = boardWrapEl.clientWidth;
  cellSize = (wrapWidth - BOARD_PAD * 2 - CELL_GAP * 3) / SIZE;
}

function positionTile(el, tile) {
  const left = BOARD_PAD + tile.col * (cellSize + CELL_GAP);
  const top = BOARD_PAD + tile.row * (cellSize + CELL_GAP);
  el.style.width = cellSize + 'px';
  el.style.height = cellSize + 'px';
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.style.fontSize = Math.max(14, cellSize * 0.36) + 'px';
}

// ---------- rendering ----------
function renderTiles() {
  const seen = new Set();
  tiles.forEach(tile => {
    seen.add(tile.id);
    let el = tileElements.get(tile.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'tile tile-spawn';
      tilesLayerEl.appendChild(el);
      tileElements.set(tile.id, el);
      // let the browser paint the initial (scaled-down) state once before transitioning in
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('tile-spawn')));
    }
    positionTile(el, tile);
    el.textContent = tile.value;
    applyTileColor(el, tile.value);
    if (tile.justMerged) {
      tile.justMerged = false;
      el.classList.add('tile-merge');
      setTimeout(() => el.classList.remove('tile-merge'), 160);
    }
  });
  tileElements.forEach((el, id) => {
    if (!seen.has(id)) {
      el.remove();
      tileElements.delete(id);
    }
  });
}

// removes tiles that were merged away last move (kept around for one render so they
// visually slide onto the surviving tile before disappearing)
function cleanupDeadTiles() {
  tiles = tiles.filter(tile => {
    if (tile.dead) {
      const el = tileElements.get(tile.id);
      if (el) { el.remove(); tileElements.delete(tile.id); }
      return false;
    }
    return true;
  });
}

// ---------- core game logic ----------
function withinBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

function findFarthestPosition(r, c, vec) {
  let prevR = r, prevC = c;
  let nr = r + vec.dr, nc = c + vec.dc;
  while (withinBounds(nr, nc) && !board[nr][nc]) {
    prevR = nr; prevC = nc;
    nr += vec.dr; nc += vec.dc;
  }
  return {
    farthest: { r: prevR, c: prevC },
    next: withinBounds(nr, nc) ? { r: nr, c: nc } : null,
  };
}

function spawnRandomTile() {
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) empty.push({ r, c });
    }
  }
  if (!empty.length) return;
  const { r, c } = empty[Math.floor(Math.random() * empty.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile = { id: nextId++, row: r, col: c, value, dead: false, justMerged: false };
  board[r][c] = tile;
  tiles.push(tile);
}

function canMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = board[r][c];
      if (!t) return true;
      if (c < SIZE - 1 && board[r][c + 1] && board[r][c + 1].value === t.value) return true;
      if (r < SIZE - 1 && board[r + 1][c] && board[r + 1][c].value === t.value) return true;
    }
  }
  return false;
}

function showWinBanner() {
  winBannerEl.classList.add('show');
  clearTimeout(winBannerTimeout);
  winBannerTimeout = setTimeout(() => winBannerEl.classList.remove('show'), 2600);
}

function handleMove(dir) {
  if (!running) return;
  cleanupDeadTiles();

  const vec = VECTORS[dir];
  const rows = [0, 1, 2, 3]; if (vec.dr === 1) rows.reverse();
  const cols = [0, 1, 2, 3]; if (vec.dc === 1) cols.reverse();

  let moved = false;
  let gained = 0;
  const mergedThisMove = new Set(); // tile ids that already absorbed a merge this move

  for (const r of rows) {
    for (const c of cols) {
      const tile = board[r][c];
      if (!tile) continue;

      const { farthest, next } = findFarthestPosition(r, c, vec);
      const nextTile = next ? board[next.r][next.c] : null;

      if (nextTile && nextTile.value === tile.value && !mergedThisMove.has(nextTile.id)) {
        // merge `tile` into `nextTile`
        board[r][c] = null;
        nextTile.value *= 2;
        nextTile.justMerged = true;
        mergedThisMove.add(nextTile.id);
        gained += nextTile.value;
        tile.row = next.r; tile.col = next.c; // slide the consumed tile onto the target for the animation
        tile.dead = true;
        moved = true;
        if (nextTile.value >= 2048 && !hasWon) {
          hasWon = true;
          showWinBanner();
        }
      } else if (farthest.r !== r || farthest.c !== c) {
        board[r][c] = null;
        board[farthest.r][farthest.c] = tile;
        tile.row = farthest.r; tile.col = farthest.c;
        moved = true;
      }
    }
  }

  if (!moved) return; // nothing changed: no spawn, no wasted turn

  score += gained;
  scoreEl.textContent = score;

  spawnRandomTile();
  computeCellSize();
  renderTiles();

  if (!canMove()) triggerGameOver();
}

function triggerGameOver() {
  running = false;
  const isNewRecord = score > highScore;
  if (isNewRecord) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    highScoreEl.textContent = highScore;
  }
  finalScoreEl.textContent = `최종 점수: ${score}`;
  newRecordEl.textContent = isNewRecord ? '🎉 신기록!' : '';
  overlayEl.classList.add('visible');
}

function newGame() {
  clearTimeout(winBannerTimeout);
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  tiles = [];
  tileElements.forEach(el => el.remove());
  tileElements.clear();
  nextId = 1;
  score = 0;
  hasWon = false;
  running = true;

  scoreEl.textContent = '0';
  overlayEl.classList.remove('visible');
  winBannerEl.classList.remove('show');

  spawnRandomTile();
  spawnRandomTile();

  computeCellSize();
  renderTiles();
}

// ---------- input: keyboard ----------
document.addEventListener('keydown', (e) => {
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const dir = map[e.key];
  if (!dir) return;
  e.preventDefault();
  handleMove(dir);
});

// ---------- input: touch / pointer swipe (for mobile, since this game is otherwise keyboard-only) ----------
let pointerStart = null;
const SWIPE_THRESHOLD = 24;

boardWrapEl.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY };
});
boardWrapEl.addEventListener('pointerup', (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  pointerStart = null;

  const absX = Math.abs(dx), absY = Math.abs(dy);
  if (Math.max(absX, absY) < SWIPE_THRESHOLD) return;

  const dir = absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  handleMove(dir);
});
boardWrapEl.addEventListener('pointercancel', () => { pointerStart = null; });

// ---------- misc ----------
window.addEventListener('resize', () => { computeCellSize(); renderTiles(); });
newGameBtn.addEventListener('click', newGame);
restartBtn.addEventListener('click', newGame);
if (themeToggleBtn) {
  // tile backgrounds for the accent-var tiers depend on the resolved theme color
  themeToggleBtn.addEventListener('click', () => setTimeout(renderTiles, 30));
}

// ---------- init ----------
buildGridBackground();
newGame();
