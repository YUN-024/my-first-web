const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
ctx.imageSmoothingEnabled = false;

// twinkling stars
const stars = Array.from({ length: 40 }, () => ({
  x: Math.random() * W,
  y: Math.random() * (H - 60),
  size: Math.random() < 0.5 ? 2 : 3,
  phase: Math.random() * Math.PI * 2
}));

// drifting pixel clouds
const clouds = Array.from({ length: 4 }, (_, i) => ({
  x: (i * 150) % W,
  y: 20 + i * 15,
  speed: 0.15 + Math.random() * 0.1
}));

// simple walking pixel explorer (4px blocks), not a slime
const groundY = H - 40;
let walker = { x: -20, dir: 1, frame: 0 };

function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawCloud(x, y) {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--surface-2');
  drawPixelRect(x, y, 24, 6, c);
  drawPixelRect(x + 6, y - 6, 18, 6, c);
  drawPixelRect(x - 6, y + 6, 30, 6, c);
}

function drawWalker(x, y, step) {
  const cyan = getComputedStyle(document.documentElement).getPropertyValue('--accent-cyan');
  const pink = getComputedStyle(document.documentElement).getPropertyValue('--accent-pink');
  // body
  drawPixelRect(x, y - 20, 12, 12, cyan);   // head
  drawPixelRect(x + 2, y - 8, 8, 10, pink); // torso
  // legs alternate
  if (step % 2 === 0) {
    drawPixelRect(x, y + 2, 4, 8, cyan);
    drawPixelRect(x + 8, y + 2, 4, 6, cyan);
  } else {
    drawPixelRect(x, y + 2, 4, 6, cyan);
    drawPixelRect(x + 8, y + 2, 4, 8, cyan);
  }
}

function loop(t) {
  ctx.clearRect(0, 0, W, H);
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // stars
  stars.forEach(s => {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 500 + s.phase));
    ctx.globalAlpha = a;
    drawPixelRect(s.x, s.y, s.size, s.size, getComputedStyle(document.documentElement).getPropertyValue('--accent-yellow'));
  });
  ctx.globalAlpha = 1;

  // clouds
  clouds.forEach(c => {
    c.x += c.speed;
    if (c.x > W + 30) c.x = -30;
    drawCloud(c.x, c.y);
  });

  // ground
  drawPixelRect(0, groundY + 20, W, 4, getComputedStyle(document.documentElement).getPropertyValue('--border'));

  // walker
  walker.x += 0.8 * walker.dir;
  if (walker.x > W + 20) walker.dir = -1;
  if (walker.x < -20) walker.dir = 1;
  walker.frame = Math.floor(t / 150);
  const drawX = walker.dir === 1 ? walker.x : W - walker.x - 12;
  drawWalker(drawX, groundY + 18, walker.frame);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
