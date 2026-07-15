// ---------- maze definition (19 cols x 21 rows) ----------
// # wall, . dot, o power pellet, ' ' empty path, = ghost gate, G ghost house, P pacman start
const RAW_MAZE = [
  "###################",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.###.#.###.####",
  "   #.#       #.#   ",
  "####.# ##=## #.####",
  "    .  #GGG#  .    ",
  "####.# ##### #.####",
  "   #.#       #.#   ",
  "####.#.#####.#.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o.#.....P.....#.o#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "###################",
];

const COLS = 19, ROWS = 21, CELL = 20;
let grid = [];
let totalPellets = 0;

function loadMaze() {
  grid = RAW_MAZE.map(row => row.split(''));
  totalPellets = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === '.' || grid[r][c] === 'o') totalPellets++;
    }
  }
}

function isWallFor(entity, r, c) {
  if (c < 0 || c >= COLS) return false; // tunnel wrap handled separately
  if (r < 0 || r >= ROWS) return false;
  const ch = grid[r][c];
  if (ch === '#') return true;
  if (ch === '=') return entity === 'pacman';
  if (ch === 'G') return entity === 'pacman';
  return false;
}

const canvas = document.getElementById('pacman-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const scoreEl = document.getElementById('pac-score');
const livesEl = document.getElementById('pac-lives');
const msgEl = document.getElementById('pac-message');

let score = 0, lives = 3, pelletsLeft = 0, running = true;

const DIRS = {
  up: { dr: -1, dc: 0 }, down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 }, right: { dr: 0, dc: 1 }, none: { dr: 0, dc: 0 }
};

function cellCenter(r, c) { return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }; }

class Mover {
  constructor(startR, startC) {
    this.r = startR; this.c = startC;
    this.x = startC * CELL + CELL / 2;
    this.y = startR * CELL + CELL / 2;
    this.dir = 'none'; this.nextDir = 'none';
    this.speed = 1.6;
  }
  atCenter() {
    const cc = cellCenter(this.r, this.c);
    return Math.abs(this.x - cc.x) < 1 && Math.abs(this.y - cc.y) < 1;
  }
  canGo(dirKey, entity) {
    const d = DIRS[dirKey];
    let nr = this.r + d.dr, nc = this.c + d.dc;
    if (nc < 0) nc = COLS - 1;
    if (nc >= COLS) nc = 0;
    return !isWallFor(entity, nr, nc);
  }
}

let pacStart = { r: 16, c: 9 };
let pac;

const ghostColors = ['#ff5da2', '#ffd23f', '#4ce0d2'];
let ghosts = [];
const ghostHome = [{ r: 10, c: 8 }, { r: 10, c: 9 }, { r: 10, c: 10 }];
const ghostReleaseDelay = [0, 120, 240];
let frameCount = 0;

function resetPositions() {
  pac = new Mover(pacStart.r, pacStart.c);
  ghosts = ghostHome.map((h, i) => {
    const g = new Mover(h.r, h.c);
    g.color = ghostColors[i];
    g.released = i === 0;
    g.releaseAt = ghostReleaseDelay[i];
    g.frightened = 0;
    return g;
  });
  frameCount = 0;
}

function initGame() {
  loadMaze();
  pelletsLeft = totalPellets;
  score = 0; lives = 3; running = true;
  scoreEl.textContent = score; livesEl.textContent = lives; msgEl.textContent = '';
  resetPositions();
}

function move(entity, isGhost) {
  if (entity.atCenter()) {
    const r = entity.r, c = entity.c;
    if (entity.nextDir !== 'none' && entity.canGo(entity.nextDir, isGhost ? 'ghost' : 'pacman')) {
      entity.dir = entity.nextDir;
    }
    if (!entity.canGo(entity.dir, isGhost ? 'ghost' : 'pacman')) {
      entity.dir = 'none';
    }
    entity.r = r; entity.c = c;
  }

  const d = DIRS[entity.dir];
  entity.x += d.dc * entity.speed;
  entity.y += d.dr * entity.speed;

  if (entity.x < 0) entity.x = COLS * CELL;
  if (entity.x > COLS * CELL) entity.x = 0;

  entity.c = Math.floor(entity.x / CELL);
  entity.r = Math.floor(entity.y / CELL);
}

function ghostChooseDirection(g) {
  if (!g.atCenter()) return;
  const opts = ['up', 'down', 'left', 'right'].filter(dk => {
    const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (g.dir !== 'none' && dk === reverse[g.dir]) return false;
    return g.canGo(dk, 'ghost');
  });
  let candidates = opts.length ? opts : ['up', 'down', 'left', 'right'].filter(dk => g.canGo(dk, 'ghost'));
  if (!candidates.length) return;

  if (g.frightened > 0) {
    g.nextDir = candidates[Math.floor(Math.random() * candidates.length)];
    return;
  }
  let best = candidates[0], bestDist = Infinity;
  candidates.forEach(dk => {
    const d = DIRS[dk];
    const nr = g.r + d.dr, nc = g.c + d.dc;
    const dist = Math.hypot(nr - pac.r, nc - pac.c);
    if (dist < bestDist) { bestDist = dist; best = dk; }
  });
  g.nextDir = Math.random() < 0.2 ? candidates[Math.floor(Math.random() * candidates.length)] : best;
}

function eatPellet() {
  const ch = grid[pac.r][pac.c];
  if (ch === '.') {
    grid[pac.r][pac.c] = ' ';
    score += 10; pelletsLeft--;
  } else if (ch === 'o') {
    grid[pac.r][pac.c] = ' ';
    score += 50; pelletsLeft--;
    ghosts.forEach(g => g.frightened = 480);
  }
  scoreEl.textContent = score;
  if (pelletsLeft <= 0) {
    running = false;
    msgEl.textContent = '클리어! 모든 코인을 모았습니다.';
  }
}

function checkGhostCollision() {
  ghosts.forEach(g => {
    if (!g.released) return;
    const dist = Math.hypot(g.x - pac.x, g.y - pac.y);
    if (dist < CELL * 0.6) {
      if (g.frightened > 0) {
        score += 200; scoreEl.textContent = score;
        g.r = ghostHome[0].r; g.c = ghostHome[0].c;
        g.x = g.c * CELL + CELL / 2; g.y = g.r * CELL + CELL / 2;
        g.frightened = 0;
      } else {
        lives--; livesEl.textContent = lives;
        if (lives <= 0) {
          running = false;
          msgEl.textContent = '게임 오버! 최종 점수: ' + score;
        } else {
          resetPositions();
        }
      }
    }
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      const x = c * CELL, y = r * CELL;
      if (ch === '#') {
        ctx.fillStyle = '#1c3fae';
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      } else if (ch === '.') {
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + CELL / 2 - 2, y + CELL / 2 - 2, 4, 4);
      } else if (ch === 'o') {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(pac.x, pac.y, CELL / 2 - 2, 0.25 * Math.PI, 1.75 * Math.PI);
  ctx.lineTo(pac.x, pac.y);
  ctx.fill();

  ghosts.forEach(g => {
    ctx.fillStyle = g.frightened > 0 ? '#2b2bff' : g.color;
    ctx.fillRect(g.x - CELL / 2 + 2, g.y - CELL / 2 + 2, CELL - 4, CELL - 4);
  });
}

document.addEventListener('keydown', (e) => {
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (map[e.key]) { pac.nextDir = map[e.key]; e.preventDefault(); }
});

document.querySelectorAll('[data-dir]').forEach(btn => {
  btn.addEventListener('click', () => { pac.nextDir = btn.dataset.dir; });
});

document.getElementById('pac-restart').addEventListener('click', initGame);

function loop() {
  frameCount++;
  if (running) {
    move(pac, false);
    eatPellet();

    ghosts.forEach(g => {
      if (!g.released && frameCount >= g.releaseAt) g.released = true;
      if (!g.released) return;
      if (g.frightened > 0) g.frightened--;
      ghostChooseDirection(g);
      move(g, true);
    });

    checkGhostCollision();
  }
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
