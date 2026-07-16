const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

const gridCanvas = document.getElementById('grid-overlay');
const gctx = gridCanvas.getContext('2d');

const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');
const brushSizeLabel = document.getElementById('brush-size-label');
const gridToggle = document.getElementById('grid-toggle');
const snapToggle = document.getElementById('snap-toggle');
const paletteRow = document.getElementById('palette-row');
const pencilBtn = document.getElementById('tool-pencil');
const eraserBtn = document.getElementById('tool-eraser');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const GRID = 16; // logical pixel grid size in canvas units

let drawing = false;
let tool = 'pencil'; // 'pencil' | 'eraser'
let strokeStarted = false;

function setTool(next) {
  tool = next;
  pencilBtn.classList.toggle('btn-cyan', tool === 'pencil');
  eraserBtn.classList.toggle('btn-cyan', tool === 'eraser');
}
pencilBtn.addEventListener('click', () => setTool('pencil'));
eraserBtn.addEventListener('click', () => setTool('eraser'));

const PALETTE = [
  '#4ce0d2', '#ff5da2', '#ffd23f',
  '#000000', '#ffffff', '#9a9ac0',
  '#ff5555', '#ff9d4d', '#55ff9d',
  '#5da9ff', '#a06bd6', '#a0622d'
];

function buildPalette() {
  PALETTE.forEach(color => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-swatch' + (color === colorPicker.value ? ' active' : '');
    btn.style.background = color;
    btn.addEventListener('click', () => {
      colorPicker.value = color;
      Array.from(paletteRow.children).forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
    });
    paletteRow.appendChild(btn);
  });
}
buildPalette();

colorPicker.addEventListener('input', () => {
  Array.from(paletteRow.children).forEach(c => c.classList.remove('active'));
});

// ---------- grid overlay (separate layer, so toggling/saving never touches the drawing) ----------
function renderGridOverlay() {
  gctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  if (!gridToggle.checked) return;
  gctx.strokeStyle = 'rgba(0,0,0,0.08)';
  gctx.lineWidth = 1;
  for (let x = 0; x <= gridCanvas.width; x += GRID) {
    gctx.beginPath();
    gctx.moveTo(x + 0.5, 0);
    gctx.lineTo(x + 0.5, gridCanvas.height);
    gctx.stroke();
  }
  for (let y = 0; y <= gridCanvas.height; y += GRID) {
    gctx.beginPath();
    gctx.moveTo(0, y + 0.5);
    gctx.lineTo(gridCanvas.width, y + 0.5);
    gctx.stroke();
  }
}
gridToggle.addEventListener('change', renderGridOverlay);
renderGridOverlay();

brushSize.addEventListener('input', () => {
  brushSizeLabel.textContent = brushSize.value + 'px';
});

// ---------- undo / redo history ----------
const history = [];
const redoStack = [];
const MAX_HISTORY = 40;

function snapshot() {
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
function pushHistory() {
  history.push(snapshot());
  if (history.length > MAX_HISTORY) history.shift();
  redoStack.length = 0;
}
function undo() {
  if (!history.length) return;
  redoStack.push(snapshot());
  const prev = history.pop();
  ctx.putImageData(prev, 0, 0);
}
function redo() {
  if (!redoStack.length) return;
  history.push(snapshot());
  const next = redoStack.pop();
  ctx.putImageData(next, 0, 0);
}
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  } else if (e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  }
});

// ---------- drawing ----------
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
  ctx.fillStyle = tool === 'eraser' ? '#ffffff' : colorPicker.value;
  if (snapToggle.checked) {
    const cellX = Math.floor(x / GRID) * GRID;
    const cellY = Math.floor(y / GRID) * GRID;
    ctx.fillRect(cellX, cellY, GRID, GRID);
  } else {
    const size = parseInt(brushSize.value, 10); // fine-grained 1~10px thickness
    ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }
}

function start(e) {
  drawing = true;
  strokeStarted = false;
  const p = getPos(e);
  if (!strokeStarted) { pushHistory(); strokeStarted = true; }
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
  pushHistory();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});

document.getElementById('save-btn').addEventListener('click', () => {
  // grid lives on a separate overlay canvas, so the drawing canvas is always clean here
  const link = document.createElement('a');
  link.download = 'my-pixel-art.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
