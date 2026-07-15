(function () {
  var GRID_SIZE = 32;
  var CELL_SIZE = 16; // canvas is 512x512 internally, regardless of CSS display size

  var PALETTE = [
    '#1a1a2e', '#f2f2f2', '#ff5555', '#ffd447', '#55ff9d', '#5da9ff',
    '#ff5da2', '#a0622d', '#c23b3b', '#3d6cb9', '#7a3b2e', '#9a9ac0',
    '#ffffff', '#000000'
  ];

  var canvas, ctx, gridOverlay, toggleGridBtn, clearBtn, saveBtn, paletteRow, customColorInput;
  var brushButtons;
  var currentColor = PALETTE[0];
  var brushSize = 1;
  var isDrawing = false;

  function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function cellFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (e.clientX - rect.left) * scaleX;
    var y = (e.clientY - rect.top) * scaleY;
    var col = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(x / CELL_SIZE)));
    var row = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(y / CELL_SIZE)));
    return { row: row, col: col };
  }

  function paintAt(row, col) {
    var half = Math.floor(brushSize / 2);
    for (var r = row - half; r < row - half + brushSize; r++) {
      for (var c = col - half; c < col - half + brushSize; c++) {
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
        ctx.fillStyle = currentColor;
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  function handlePointer(e) {
    var cell = cellFromEvent(e);
    paintAt(cell.row, cell.col);
  }

  function buildPalette() {
    PALETTE.forEach(function (color, index) {
      var swatch = document.createElement('div');
      swatch.className = 'color-swatch' + (index === 0 ? ' active' : '');
      swatch.style.backgroundColor = color;
      swatch.addEventListener('click', function () {
        setActiveColor(color, swatch);
      });
      paletteRow.appendChild(swatch);
    });
  }

  function setActiveColor(color, swatchEl) {
    currentColor = color;
    var all = paletteRow.querySelectorAll('.color-swatch');
    all.forEach(function (s) { s.classList.remove('active'); });
    if (swatchEl) swatchEl.classList.add('active');
  }

  document.addEventListener('DOMContentLoaded', function () {
    canvas = document.getElementById('paint-canvas');
    ctx = canvas.getContext('2d');
    gridOverlay = document.getElementById('grid-overlay');
    toggleGridBtn = document.getElementById('toggle-grid-btn');
    clearBtn = document.getElementById('clear-btn');
    saveBtn = document.getElementById('save-btn');
    paletteRow = document.getElementById('palette-row');
    customColorInput = document.getElementById('custom-color');
    brushButtons = document.querySelectorAll('.brush-row .pixel-btn');

    clearCanvas();
    buildPalette();

    canvas.addEventListener('mousedown', function (e) {
      isDrawing = true;
      handlePointer(e);
    });
    canvas.addEventListener('mousemove', function (e) {
      if (isDrawing) handlePointer(e);
    });
    window.addEventListener('mouseup', function () {
      isDrawing = false;
    });

    toggleGridBtn.addEventListener('click', function () {
      var hidden = gridOverlay.classList.toggle('hidden');
      toggleGridBtn.textContent = hidden ? '격자 켜기' : '격자 끄기';
    });

    clearBtn.addEventListener('click', function () {
      clearCanvas();
    });

    customColorInput.addEventListener('input', function () {
      setActiveColor(customColorInput.value, null);
      paletteRow.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('active'); });
    });

    brushButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        brushSize = Number(btn.getAttribute('data-size'));
        brushButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    saveBtn.addEventListener('click', function () {
      var link = document.createElement('a');
      link.download = 'pixel-art.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  });
})();
