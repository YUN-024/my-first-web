const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let W = 0, H = 0;

const startPanel = document.getElementById('snake-start-panel');
const hud = document.getElementById('snake-hud');
const stage = document.getElementById('snake-stage');
const nicknameInput = document.getElementById('snake-nickname');
const startBtn = document.getElementById('snake-start-btn');
const scoreEl = document.getElementById('snake-score');
const highScoreEl = document.getElementById('snake-high-score');
const overlay = document.getElementById('snake-overlay');
const finalScoreEl = document.getElementById('snake-final-score');
const newRecordEl = document.getElementById('snake-new-record');
const restartBtn = document.getElementById('snake-restart-btn');
const leaderboardList = document.getElementById('snake-leaderboard-list');

const HIGH_SCORE_KEY = 'pixel-site-snake-highscore';
const LEADERBOARD_KEY = 'pixel-site-snake-leaderboard';

let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
highScoreEl.textContent = highScore;

// ---------- tunable constants ----------
const SPEED = 2.4;              // px per frame, head moves at this constant speed
const TURN_RATE = 0.07;         // max radians the heading can change per frame
const SEG_SIZE = 8;              // pixel-art body block size
const SEG_GAP_FRAMES = 4;        // history frames between two body segments
const START_SEGMENTS = 6;
const FOOD_COUNT = 25;
const EAT_RADIUS = 11;
const SELF_COLLIDE_SKIP = 8;     // ignore this many segments nearest the head when checking self-collision
const CROSS_COLLIDE_RADIUS = SEG_SIZE * 0.8; // radius used when checking one snake's head against another snake

// ---------- AI bot tuning ----------
const BOT_COUNT = 4;
const BOT_START_SEGMENTS = 5;
const BOT_DETECT_RADIUS = 160;   // bots only chase food within this range
const BOT_WALL_MARGIN = 60;      // bots steer back toward center once this close to a wall
const BOT_WANDER_JITTER = 0.03;  // chance per frame a wandering bot nudges its heading
const BOT_RESPAWN_DELAY = 2500;  // ms before a dead bot respawns
const BOT_PALETTES = [
  { a: '--accent-yellow', b: '#ff8c42' }, // yellow / orange
  { a: '--accent-pink',   b: '#a855f7' }, // pink / purple
  { a: '--accent-cyan',   b: '#0ea5a5' }, // cyan / teal
  { a: '#22c55e',         b: '#3b82f6' }, // green / blue
  { a: '#f97316',         b: '#facc15' }  // extra: orange / gold (used if BOT_COUNT > 4)
];

let nickname = '플레이어';
let running = false;
let score = 0;
let player, bots, foods, mouse;

function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function getVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resolveColor(c) {
  return c.startsWith('--') ? getVar(c) : c;
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---------- canvas sizing (fills the available space in #snake-stage) ----------
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return; // stage is hidden (display:none) before the game starts
  W = w;
  H = h;
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
resize();

function spawnFood() {
  foods.push({
    x: 12 + Math.random() * (W - 24),
    y: 12 + Math.random() * (H - 24)
  });
}

function randomSpawnPoint() {
  const margin = 60;
  return {
    x: margin + Math.random() * Math.max(W - margin * 2, 1),
    y: margin + Math.random() * Math.max(H - margin * 2, 1)
  };
}

function createSnake(x, y, angle, numSegments) {
  return { head: { x, y }, angle, history: [], numSegments, alive: true };
}

function makeBot(index) {
  const p = randomSpawnPoint();
  const bot = createSnake(p.x, p.y, Math.random() * Math.PI * 2, BOT_START_SEGMENTS);
  bot.palette = BOT_PALETTES[index % BOT_PALETTES.length];
  bot.wanderAngle = bot.angle;
  bot.respawnAt = 0;
  return bot;
}

function respawnBot(bot) {
  const p = randomSpawnPoint();
  bot.head = { x: p.x, y: p.y };
  bot.angle = Math.random() * Math.PI * 2;
  bot.wanderAngle = bot.angle;
  bot.history = [];
  bot.numSegments = BOT_START_SEGMENTS;
  bot.alive = true;
}

function resetGame() {
  player = createSnake(W / 2, H / 2, -Math.PI / 2, START_SEGMENTS);
  mouse = { x: W / 2, y: H / 2 - 60 };
  score = 0;
  scoreEl.textContent = score;

  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) spawnFood();

  bots = [];
  for (let i = 0; i < BOT_COUNT; i++) bots.push(makeBot(i));
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});

// returns the current body segments (closest to head first), based on
// resampling a snake's head-position history at fixed intervals
function getSegments(snake) {
  const segs = [];
  for (let k = 1; k <= snake.numSegments; k++) {
    const idx = snake.history.length - 1 - k * SEG_GAP_FRAMES;
    if (idx < 0) break;
    segs.push(snake.history[idx]);
  }
  return segs;
}

function steerToward(snake, targetAngle) {
  let diff = normalizeAngle(targetAngle - snake.angle);
  if (diff > TURN_RATE) diff = TURN_RATE;
  if (diff < -TURN_RATE) diff = -TURN_RATE;
  snake.angle = normalizeAngle(snake.angle + diff);
}

function advance(snake) {
  snake.head.x += Math.cos(snake.angle) * SPEED;
  snake.head.y += Math.sin(snake.angle) * SPEED;

  snake.history.push({ x: snake.head.x, y: snake.head.y });
  const neededLen = snake.numSegments * SEG_GAP_FRAMES + SEG_GAP_FRAMES + 4;
  if (snake.history.length > neededLen) snake.history.splice(0, snake.history.length - neededLen);
}

function outOfBounds(pt) {
  return pt.x < 0 || pt.x > W || pt.y < 0 || pt.y > H;
}

function selfCollides(snake) {
  const segs = getSegments(snake);
  const r = SEG_SIZE * 0.7;
  for (let i = SELF_COLLIDE_SKIP; i < segs.length; i++) {
    const s = segs[i];
    const dx = s.x - snake.head.x, dy = s.y - snake.head.y;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// true if `snake`'s head touches `other`'s head or body
function headHitsOther(snake, other) {
  const r = CROSS_COLLIDE_RADIUS;
  const dxh = other.head.x - snake.head.x, dyh = other.head.y - snake.head.y;
  if (dxh * dxh + dyh * dyh < r * r) return true;
  const segs = getSegments(other);
  for (const s of segs) {
    const dx = s.x - snake.head.x, dy = s.y - snake.head.y;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

function tryEatFood(snake, onEat) {
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    const dx = f.x - snake.head.x, dy = f.y - snake.head.y;
    if (dx * dx + dy * dy < EAT_RADIUS * EAT_RADIUS) {
      foods.splice(i, 1);
      spawnFood();
      snake.numSegments++;
      if (onEat) onEat();
    }
  }
}

// simple AI: chase the nearest food within detection range, steer back to
// center when close to a wall, otherwise wander with occasional random turns
function botTargetAngle(bot) {
  if (bot.head.x < BOT_WALL_MARGIN || bot.head.x > W - BOT_WALL_MARGIN ||
      bot.head.y < BOT_WALL_MARGIN || bot.head.y > H - BOT_WALL_MARGIN) {
    const toCenter = Math.atan2(H / 2 - bot.head.y, W / 2 - bot.head.x);
    bot.wanderAngle = toCenter;
    return toCenter;
  }

  let nearest = null, nearestD2 = BOT_DETECT_RADIUS * BOT_DETECT_RADIUS;
  for (const f of foods) {
    const dx = f.x - bot.head.x, dy = f.y - bot.head.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD2) { nearestD2 = d2; nearest = f; }
  }
  if (nearest) return Math.atan2(nearest.y - bot.head.y, nearest.x - bot.head.x);

  if (Math.random() < BOT_WANDER_JITTER) {
    bot.wanderAngle = normalizeAngle(bot.wanderAngle + (Math.random() - 0.5) * 1.4);
  }
  return bot.wanderAngle;
}

// a bot died (wall / self / cut off by another snake): scatter food along its
// body and schedule a respawn elsewhere, slither.io-style
function killBot(bot) {
  if (!bot.alive) return;
  const dropPoints = [bot.head, ...getSegments(bot)];
  dropPoints.forEach((p, i) => {
    if (i % 2 !== 0) return; // don't drop food at every single segment
    foods.push({
      x: Math.min(W - 6, Math.max(6, p.x + (Math.random() - 0.5) * 6)),
      y: Math.min(H - 6, Math.max(6, p.y + (Math.random() - 0.5) * 6))
    });
  });
  bot.alive = false;
  bot.respawnAt = performance.now() + BOT_RESPAWN_DELAY;
}

function update() {
  const now = performance.now();

  // ---- player: mouse-follow steering ----
  const targetAngle = Math.atan2(mouse.y - player.head.y, mouse.x - player.head.x);
  steerToward(player, targetAngle);
  advance(player);

  if (outOfBounds(player.head)) { endGame(); return; }

  tryEatFood(player, () => {
    score += 10;
    scoreEl.textContent = score;
  });

  if (selfCollides(player)) { endGame(); return; }

  // ---- bots: AI steering, movement, wall/self collision, respawn ----
  bots.forEach(bot => {
    if (!bot.alive) {
      if (now >= bot.respawnAt) respawnBot(bot);
      return;
    }

    steerToward(bot, botTargetAngle(bot));
    advance(bot);

    if (outOfBounds(bot.head)) { killBot(bot); return; }

    tryEatFood(bot);

    if (selfCollides(bot)) killBot(bot);
  });

  // ---- cross-snake collisions ----
  // player touching any bot (head or body) ends the player's game
  for (const bot of bots) {
    if (bot.alive && headHitsOther(player, bot)) { endGame(); return; }
  }
  // a bot touching the player's body (cut off) or another bot dies and respawns
  for (const bot of bots) {
    if (!bot.alive) continue;
    if (headHitsOther(bot, player)) { killBot(bot); continue; }
    for (const other of bots) {
      if (other === bot || !other.alive) continue;
      if (headHitsOther(bot, other)) { killBot(bot); break; }
    }
  }
}

function drawSnakeBody(snake, colorA, colorB, headColor) {
  const segs = getSegments(snake);
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const color = i % 2 === 0 ? colorA : colorB;
    drawPixelRect(s.x - SEG_SIZE / 2, s.y - SEG_SIZE / 2, SEG_SIZE, SEG_SIZE, color);
  }
  drawPixelRect(snake.head.x - SEG_SIZE / 2 - 1, snake.head.y - SEG_SIZE / 2 - 1, SEG_SIZE + 2, SEG_SIZE + 2, headColor);
}

function draw() {
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(0, 0, W, H);

  const cyan = getVar('--accent-cyan');
  const pink = getVar('--accent-pink');
  const yellow = getVar('--accent-yellow');

  // food dots
  foods.forEach(f => {
    drawPixelRect(f.x - 3, f.y - 3, 6, 6, yellow);
  });

  // bots drawn first, so the player always ends up on top
  bots.forEach(bot => {
    if (!bot.alive) return;
    const colorA = resolveColor(bot.palette.a);
    const colorB = resolveColor(bot.palette.b);
    drawSnakeBody(bot, colorA, colorB, colorA);
  });

  // player: cyan/pink body, white head (kept unique so it always reads as "you")
  drawSnakeBody(player, cyan, pink, '#ffffff');
}

function loop() {
  if (running) {
    update();
    draw();
  }
  requestAnimationFrame(loop);
}

function startGame() {
  stage.style.display = 'block';
  resize();
  resetGame();
  running = true;
  overlay.classList.remove('visible');
  startPanel.style.display = 'none';
  hud.style.display = 'flex';
}

function endGame() {
  running = false;
  const isNewRecord = score > highScore;
  if (isNewRecord) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    highScoreEl.textContent = highScore;
  }
  finalScoreEl.textContent = `최종 점수: ${score}`;
  newRecordEl.textContent = isNewRecord ? '🎉 신기록!' : '';
  updateLeaderboard(nickname, score);
  overlay.classList.add('visible');
}

function readLeaderboard() {
  try {
    const list = JSON.parse(localStorage.getItem(LEADERBOARD_KEY));
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function updateLeaderboard(name, finalScore) {
  const list = readLeaderboard();
  list.push({ name, score: finalScore });
  list.sort((a, b) => b.score - a.score);
  const top5 = list.slice(0, 5);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top5));
  renderLeaderboard(top5);
}

function renderLeaderboard(list) {
  const data = list || readLeaderboard();
  leaderboardList.innerHTML = '';
  if (data.length === 0) {
    const li = document.createElement('li');
    li.style.color = 'var(--text-dim)';
    li.style.justifyContent = 'center';
    li.textContent = '아직 기록이 없습니다';
    leaderboardList.appendChild(li);
    return;
  }
  data.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === 0) li.classList.add('rank-1');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${i + 1}. ${entry.name}`;
    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = entry.score;
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    leaderboardList.appendChild(li);
  });
}

startBtn.addEventListener('click', () => {
  const val = nicknameInput.value.trim();
  nickname = val || '플레이어';
  startGame();
});

nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startBtn.click();
});

restartBtn.addEventListener('click', startGame);

renderLeaderboard();
requestAnimationFrame(loop);
