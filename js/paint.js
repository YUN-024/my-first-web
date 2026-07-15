const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');
const brushSizeLabel = document.getElementById('brush-size-label');
const gridToggle = document.getElementById('grid-toggle');
const GRID = 16; // logical pixel grid size in canvas units

let drawing = false;

function drawGrid() {
  if (!gridToggle.checked) return;
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}
drawGrid();

gridToggle.addEventListener('change', () => {
  // redraw grid overlay by re-rendering (simple approach: draw/erase grid lines only)
  drawGrid();
});

brushSize.addEventListener('input', () => {
  brushSizeLabel.textContent = brushSize.value + 'px';
});

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function paintAt(x, y) {
  const size = parseInt(brushSize.value, 10); // fine-grained 1~10px thickness
  ctx.fillStyle = colorPicker.value;
  ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

function start(e) {
  drawing = true;
  const p = getPos(e);
  paintAt(p.x, p.y);
  e.preventDefault();
}
function move(e) {
  if (!drawing) return;
  const p = getPos(e);
  paintAt(p.x, p.y);
  e.preventDefault();
}
function end() { drawing = false; }

canvas.addEventListener('mousedown', start);
canvas.addEventListener('mousemove', move);
window.addEventListener('mouseup', end);
canvas.addEventListener('touchstart', start, { passive: false });
canvas.addEventListener('touchmove', move, { passive: false });
canvas.addEventListener('touchend', end);

document.getElementById('clear-btn').addEventListener('click', () => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
});

document.getElementById('save-btn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'my-pixel-art.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
