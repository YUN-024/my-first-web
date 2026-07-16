// ---------- board setup ----------
const COLS = 10, ROWS = 20, CELL = 20;
const PREVIEW_CELL = 16;

const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const nextCanvas = document.getElementById('tetris-next-canvas');
const nextCtx = nextCanvas.getContext('2d');
nextCtx.imageSmoothingEnabled = false;

const scoreEl = document.getElementById('tetris-score');
const linesEl = document.getElementById('tetris-lines');
const levelEl = document.getElementById('tetris-level');
const highScoreEl = document.getElementById('tetris-high-score');
const overlayEl = document.getElementById('tetris-overlay');
const resultTitleEl = document.getElementById('tetris-result-title');
const finalScoreEl = document.getElementById('tetris-final-score');
const newRecordEl = document.getElementById('tetris-new-record');
const restartBtn = document.getElementById('tetris-restart');

const HIGH_SCORE_KEY = 'pixel-site-tetris-highscore';
let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
highScoreEl.textContent = highScore;

// ---------- tetromino definitions ----------
const SHAPES = {
  I: { size: 4, cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#4ce0d2' },
  O: { size: 2, cells: [[1,1],[1,1]], color: '#ffd23f' },
  T: { size: 3, cells: [[0,1,0],[1,1,1],[0,0,0]], color: '#ff5da2' },
  S: { size: 3, cells: [[0,1,1],[1,1,0],[0,0,0]], color: '#5ce65c' },
  Z: { size: 3, cells: [[1,1,0],[0,1,1],[0,0,0]], color: '#ff5c5c' },
  J: { size: 3, cells: [[1,0,0],[1,1,1],[0,0,0]], color: '#5c8dff' },
  L: { size: 3, cells: [[0,0,1],[1,1,1],[0,0,0]], color: '#ff9d4c' },
};
const TYPES = Object.keys(SHAPES);

const SCORE_TABLE = { 1: 100, 2: 300, 3: 500, 4: 800 };
const BASE_INTERVAL = 900;
const MIN_INTERVAL = 100;

let board = [];
let current = null;
let nextType = null;
let bag = [];
let score = 0, totalLines = 0, level = 1, dropInterval = BASE_INTERVAL;
let running = false;
let dropCounter = 0;
let lastTime = null;

function cloneMatrix(cells) { return cells.map(row => row.slice()); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextBagType() {
  if (bag.length === 0) bag = shuffle(TYPES.slice());
  return bag.pop();
}

function makePiece(type) {
  const shape = SHAPES[type];
  const size = shape.size;
  return {
    type,
    matrix: cloneMatrix(shape.cells),
    size,
    row: 0,
    col: Math.floor((COLS - size) / 2),
    color: shape.color,
  };
}

function rotateMatrixCW(matrix, size) {
  const result = [];
  for (let r = 0; r < size; r++) result.push(new Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      result[c][size - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

function canPlace(matrix, size, row, col) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!matrix[r][c]) continue;
      const br = row + r, bc = col + c;
      if (bc < 0 || bc >= COLS || br >= ROWS) return false;
      if (br >= 0 && board[br][bc]) return false;
    }
  }
  return true;
}

function moveIfPossible(dr, dc) {
  const newRow = current.row + dr, newCol = current.col + dc;
  if (canPlace(current.matrix, current.size, newRow, newCol)) {
    current.row = newRow;
    current.col = newCol;
    return true;
  }
  return false;
}

function rotate() {
  const rotated = rotateMatrixCW(current.matrix, current.size);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (canPlace(rotated, current.size, current.row, current.col + k)) {
      current.matrix = rotated;
      current.col += k;
      return;
    }
  }
  // rotation not possible anywhere nearby; ignore
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell)) {
      for (let rr = r; rr > 0; rr--) board[rr] = board[rr - 1];
      board[0] = new Array(COLS).fill(null);
      cleared++;
      r++; // recheck same row index (new content shifted in)
    }
  }
  return cleared;
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = totalLines;
  levelEl.textContent = level;
}

function lockPiece() {
  for (let r = 0; r < current.size; r++) {
    for (let c = 0; c < current.size; c++) {
      if (!current.matrix[r][c]) continue;
      const br = current.row + r, bc = current.col + c;
      if (br >= 0) board[br][bc] = current.color;
    }
  }
  const cleared = clearLines();
  if (cleared > 0) {
    score += (SCORE_TABLE[cleared] || 0) * level;
    totalLines += cleared;
    level = Math.floor(totalLines / 10) + 1;
    dropInterval = Math.max(MIN_INTERVAL, BASE_INTERVAL - (level - 1) * 70);
  }
  updateStats();
  spawnNext();
}

function spawnNext() {
  current = makePiece(nextType);
  nextType = nextBagType();
  drawNextPreview();
  if (!canPlace(current.matrix, current.size, current.row, current.col)) {
    endGame();
  }
}

function hardDrop() {
  while (moveIfPossible(1, 0)) { /* keep dropping */ }
  dropCounter = 0;
  lockPiece();
}

function initGame() {
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  score = 0; totalLines = 0; level = 1; dropInterval = BASE_INTERVAL;
  dropCounter = 0; lastTime = null;
  bag = [];
  current = makePiece(nextBagType());
  nextType = nextBagType();
  running = true;
  updateStats();
  drawNextPreview();
  overlayEl.classList.remove('visible');
  if (!canPlace(current.matrix, current.size, current.row, current.col)) {
    endGame();
  }
}

function endGame() {
  running = false;
  const isNewRecord = score > highScore;
  if (isNewRecord) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    highScoreEl.textContent = highScore;
  }
  resultTitleEl.textContent = '게임 오버';
  finalScoreEl.textContent = '최종 점수: ' + score;
  newRecordEl.textContent = isNewRecord ? '🎉 신기록!' : '';
  overlayEl.classList.add('visible');
}

// ---------- drawing ----------
function drawCell(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = board[r][c];
      if (color) drawCell(ctx, c * CELL, r * CELL, CELL, color);
    }
  }

  if (current) {
    for (let r = 0; r < current.size; r++) {
      for (let c = 0; c < current.size; c++) {
        if (!current.matrix[r][c]) continue;
        const br = current.row + r, bc = current.col + c;
        if (br < 0) continue;
        drawCell(ctx, bc * CELL, br * CELL, CELL, current.color);
      }
    }
  }
}

function drawNextPreview() {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextType) return;
  const shape = SHAPES[nextType];
  const size = shape.size;
  const offsetX = (nextCanvas.width - size * PREVIEW_CELL) / 2;
  const offsetY = (nextCanvas.height - size * PREVIEW_CELL) / 2;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!shape.cells[r][c]) continue;
      drawCell(nextCtx, offsetX + c * PREVIEW_CELL, offsetY + r * PREVIEW_CELL, PREVIEW_CELL, shape.color);
    }
  }
}

// ---------- input ----------
document.addEventListener('keydown', (e) => {
  if (!running) return;
  switch (e.key) {
    case 'ArrowLeft':
      moveIfPossible(0, -1);
      e.preventDefault();
      break;
    case 'ArrowRight':
      moveIfPossible(0, 1);
      e.preventDefault();
      break;
    case 'ArrowUp':
      rotate();
      e.preventDefault();
      break;
    case 'ArrowDown':
      if (!moveIfPossible(1, 0)) lockPiece();
      dropCounter = 0;
      e.preventDefault();
      break;
    case ' ':
      hardDrop();
      e.preventDefault();
      break;
  }
});

restartBtn.addEventListener('click', initGame);

// ---------- main loop ----------
function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if (running) {
    dropCounter += delta;
    if (dropCounter >= dropInterval) {
      dropCounter = 0;
      if (!moveIfPossible(1, 0)) lockPiece();
    }
  }

  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
