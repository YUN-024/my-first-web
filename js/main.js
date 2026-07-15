const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let W = 0, H = 0;
let stars = [];
let clouds = [];
let walker = { x: -20, dir: 1, frame: 0 };

function resize() {
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W;
  canvas.height = H;

  stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * W,
    y: Math.random() * Math.max(H - 60, 40),
    size: Math.random() < 0.5 ? 2 : 3,
    phase: Math.random() * Math.PI * 2
  }));

  clouds = Array.from({ length: 6 }, (_, i) => ({
    x: (i * (W / 6)) % W,
    y: 20 + (i % 3) * 24,
    speed: 0.15 + Math.random() * 0.15
  }));
}

window.addEventListener('resize', resize);
resize();

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
  drawPixelRect(x, y - 20, 12, 12, cyan);
  drawPixelRect(x + 2, y - 8, 8, 10, pink);
  if (step % 2 === 0) {
    drawPixelRect(x, y + 2, 4, 8, cyan);
    drawPixelRect(x + 8, y + 2, 4, 6, cyan);
  } else {
    drawPixelRect(x, y + 2, 4, 6, cyan);
    drawPixelRect(x + 8, y + 2, 4, 8, cyan);
  }
}

function loop(t) {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 500 + s.phase));
    ctx.globalAlpha = a;
    drawPixelRect(s.x, s.y, s.size, s.size, getComputedStyle(document.documentElement).getPropertyValue('--accent-yellow'));
  });
  ctx.globalAlpha = 1;

  clouds.forEach(c => {
    c.x += c.speed;
    if (c.x > W + 30) c.x = -30;
    drawCloud(c.x, c.y);
  });

  const groundY = H - 40;
  drawPixelRect(0, groundY + 20, W, 4, getComputedStyle(document.documentElement).getPropertyValue('--border'));

  walker.x += 0.8 * walker.dir;
  if (walker.x > W + 20) walker.dir = -1;
  if (walker.x < -20) walker.dir = 1;
  walker.frame = Math.floor(t / 150);
  const drawX = walker.dir === 1 ? walker.x : W - walker.x - 12;
  drawWalker(drawX, groundY + 18, walker.frame);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
