(function () {
  var COLS = 20;
  var ROWS = 30;
  var STORAGE_KEY = 'pixelsite-avatar';

  /* ---------------------------------------------------------------------
     Grid helpers — parts are authored procedurally instead of hand-typed
     20x30 arrays, since simple geometric shapes are enough for a pixel-art
     avatar and this is far less error-prone than transcribing pixel data.

     The grid is a portrait 20x30 (2:3) canvas sized for a MapleStory-style
     3-head-tall (3등신) SD figure: rows 0-9 are the head (10 rows) and
     rows 10-29 are the body (20 rows = 2x head height), split roughly into
     torso+arms (10-19), legs (20-25) and feet/shoes (26-29).
     --------------------------------------------------------------------- */
  function emptyGrid() {
    var grid = [];
    for (var y = 0; y < ROWS; y++) grid.push(new Array(COLS).fill(0));
    return grid;
  }

  function fillRect(grid, x0, y0, x1, y1, value) {
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) grid[y][x] = value;
      }
    }
  }

  function fillCircle(grid, cx, cy, r, value) {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) grid[y][x] = value;
      }
    }
  }

  /* Always-drawn base figure (skin-toned head silhouette handled per-face-
     option, but torso/arms/legs/feet stubs are shared) so the silhouette
     reads as a full body even before any clothing is picked. Layered under
     the clothes, and only visible where clothing doesn't cover it (e.g.
     forearms below short sleeves, lower legs below a skirt). */
  function addBodyBase(g, value) {
    fillRect(g, 7, 10, 12, 19, value);   // torso
    fillRect(g, 4, 11, 6, 18, value);    // left arm stub
    fillRect(g, 13, 11, 15, 18, value);  // right arm stub
    fillRect(g, 7, 20, 8, 25, value);    // left leg
    fillRect(g, 11, 20, 12, 25, value);  // right leg
    fillRect(g, 6, 26, 9, 29, value);    // left foot
    fillRect(g, 10, 26, 13, 29, value);  // right foot
  }

  /* ---------------------------------------------------------------------
     Part definitions, keyed by category → array of options.
     z-order for compositing (back to front):
       face(skin) → bottom → shoes → top → mouth → eyes → hair → accessory
     --------------------------------------------------------------------- */
  var PART_CATEGORIES = ['face', 'bottom', 'shoes', 'top', 'mouth', 'eyes', 'hair', 'accessory'];

  var TAB_ORDER = [
    { key: 'face', label: '얼굴형' },
    { key: 'hair', label: '헤어' },
    { key: 'eyes', label: '눈' },
    { key: 'mouth', label: '입' },
    { key: 'top', label: '상의' },
    { key: 'bottom', label: '하의' },
    { key: 'shoes', label: '신발' },
    { key: 'accessory', label: '액세서리' }
  ];

  function makeFaceRound() {
    var g = emptyGrid();
    fillCircle(g, 9.5, 5, 5, 1);
    addBodyBase(g, 1);
    return g;
  }
  function makeFaceSquare() {
    var g = emptyGrid();
    fillRect(g, 4, 0, 15, 9, 1);
    addBodyBase(g, 1);
    return g;
  }

  function makeHairShort() {
    var g = emptyGrid();
    fillRect(g, 4, 0, 15, 3, 1);
    fillRect(g, 3, 3, 5, 7, 1);
    fillRect(g, 14, 3, 16, 7, 1);
    return g;
  }
  function makeHairLong() {
    var g = emptyGrid();
    fillRect(g, 4, 0, 15, 3, 1);
    fillRect(g, 3, 3, 5, 16, 1);
    fillRect(g, 14, 3, 16, 16, 1);
    return g;
  }

  function makeEyesDot() {
    var g = emptyGrid();
    fillRect(g, 6, 5, 7, 6, 1);
    fillRect(g, 12, 5, 13, 6, 1);
    return g;
  }
  function makeEyesHappy() {
    var g = emptyGrid();
    fillRect(g, 6, 6, 7, 6, 1);
    fillRect(g, 12, 6, 13, 6, 1);
    fillRect(g, 5, 5, 5, 5, 1);
    fillRect(g, 8, 5, 8, 5, 1);
    fillRect(g, 11, 5, 11, 5, 1);
    fillRect(g, 14, 5, 14, 5, 1);
    return g;
  }

  function makeMouthSmile() {
    var g = emptyGrid();
    fillRect(g, 8, 8, 11, 8, 1);
    fillRect(g, 7, 7, 7, 7, 1);
    fillRect(g, 12, 7, 12, 7, 1);
    return g;
  }
  function makeMouthFlat() {
    var g = emptyGrid();
    fillRect(g, 8, 8, 11, 8, 1);
    return g;
  }

  function makeTopShirt() {
    var g = emptyGrid();
    fillRect(g, 6, 10, 13, 19, 1);
    fillRect(g, 4, 11, 6, 15, 1);
    fillRect(g, 13, 11, 15, 15, 1);
    return g;
  }
  function makeTopHoodie() {
    var g = emptyGrid();
    fillRect(g, 5, 9, 14, 19, 1);
    fillRect(g, 4, 10, 6, 18, 1);
    fillRect(g, 13, 10, 15, 18, 1);
    fillRect(g, 6, 8, 13, 9, 1);
    return g;
  }

  function makeBottomPants() {
    var g = emptyGrid();
    fillRect(g, 7, 20, 8, 25, 1);
    fillRect(g, 11, 20, 12, 25, 1);
    return g;
  }
  function makeBottomSkirt() {
    var g = emptyGrid();
    fillRect(g, 6, 20, 13, 23, 1);
    return g;
  }

  function makeShoesSneakers() {
    var g = emptyGrid();
    fillRect(g, 6, 27, 9, 29, 1);
    fillRect(g, 10, 27, 13, 29, 1);
    return g;
  }
  function makeShoesBoots() {
    var g = emptyGrid();
    fillRect(g, 6, 25, 9, 29, 1);
    fillRect(g, 10, 25, 13, 29, 1);
    return g;
  }

  function makeGlasses() {
    var g = emptyGrid();
    fillRect(g, 5, 5, 8, 6, 1);
    fillRect(g, 11, 5, 14, 6, 1);
    fillRect(g, 9, 5, 10, 5, 1);
    return g;
  }
  function makeHat() {
    var g = emptyGrid();
    fillRect(g, 4, 0, 15, 2, 1);
    fillRect(g, 2, 2, 17, 3, 1);
    return g;
  }

  var PARTS = {
    face: [
      { id: 'round', label: '둥근형', colorable: false, palette: { 1: '#f2c9a0' }, grid: makeFaceRound() },
      { id: 'square', label: '각진형', colorable: false, palette: { 1: '#f2c9a0' }, grid: makeFaceSquare() }
    ],
    hair: [
      { id: 'short', label: '짧은머리', colorable: true, palette: { 1: '#5a3825' }, grid: makeHairShort() },
      { id: 'long', label: '긴머리', colorable: true, palette: { 1: '#5a3825' }, grid: makeHairLong() }
    ],
    eyes: [
      { id: 'dot', label: '동그란눈', colorable: false, palette: { 1: '#1a1a2e' }, grid: makeEyesDot() },
      { id: 'happy', label: '웃는눈', colorable: false, palette: { 1: '#1a1a2e' }, grid: makeEyesHappy() }
    ],
    mouth: [
      { id: 'smile', label: '미소', colorable: false, palette: { 1: '#7a3b2e' }, grid: makeMouthSmile() },
      { id: 'flat', label: '무표정', colorable: false, palette: { 1: '#7a3b2e' }, grid: makeMouthFlat() }
    ],
    top: [
      { id: 'shirt', label: '셔츠', colorable: true, palette: { 1: '#3d6cb9' }, grid: makeTopShirt() },
      { id: 'hoodie', label: '후드', colorable: true, palette: { 1: '#c23b3b' }, grid: makeTopHoodie() }
    ],
    bottom: [
      { id: 'pants', label: '바지', colorable: true, palette: { 1: '#2e2e42' }, grid: makeBottomPants() },
      { id: 'skirt', label: '치마', colorable: true, palette: { 1: '#a3467a' }, grid: makeBottomSkirt() }
    ],
    shoes: [
      { id: 'sneakers', label: '운동화', colorable: true, palette: { 1: '#e8e8e8' }, grid: makeShoesSneakers() },
      { id: 'boots', label: '부츠', colorable: true, palette: { 1: '#4a3324' }, grid: makeShoesBoots() }
    ],
    accessory: [
      { id: 'none', label: '없음', colorable: false, palette: {}, grid: null },
      { id: 'glasses', label: '안경', colorable: false, palette: { 1: '#1a1a2e' }, grid: makeGlasses() },
      { id: 'hat', label: '모자', colorable: true, palette: { 1: '#c23b3b' }, grid: makeHat() }
    ]
  };

  function findOption(category, id) {
    var list = PARTS[category];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  }

  /* ---------------------------------------------------------------------
     Shared renderer — same drawGrid used for the main stage, swatch
     thumbnails, and (via canvas.toDataURL) the downloaded PNG.
     --------------------------------------------------------------------- */
  function drawGrid(ctx, grid, palette, cellSize, ox, oy) {
    if (!grid) return;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var value = grid[y][x];
        if (!value) continue;
        ctx.fillStyle = palette[value] || '#000000';
        ctx.fillRect(ox + x * cellSize, oy + y * cellSize, cellSize, cellSize);
      }
    }
  }

  function resolvePalette(option, category) {
    var palette = {};
    for (var key in option.palette) palette[key] = option.palette[key];
    if (option.colorable && avatarState.colors[category]) {
      palette[1] = avatarState.colors[category];
    }
    return palette;
  }

  /* --------------------------------------------------------------------- */
  var defaultState = {
    face: 'round', hair: 'short', eyes: 'dot', mouth: 'smile',
    top: 'shirt', bottom: 'pants', shoes: 'sneakers', accessory: 'none',
    colors: {}
  };
  var avatarState = loadState();
  var activeCategory = 'face';

  var stageCanvas, stageCtx, tabsContainer, swatchRow, colorPickerRow, colorInput, downloadBtn;

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      var parsed = JSON.parse(raw);
      return {
        face: parsed.face || defaultState.face,
        hair: parsed.hair || defaultState.hair,
        eyes: parsed.eyes || defaultState.eyes,
        mouth: parsed.mouth || defaultState.mouth,
        top: parsed.top || defaultState.top,
        bottom: parsed.bottom || defaultState.bottom,
        shoes: parsed.shoes || defaultState.shoes,
        accessory: parsed.accessory || defaultState.accessory,
        colors: (parsed.colors && typeof parsed.colors === 'object') ? parsed.colors : {}
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(avatarState));
  }

  function renderAvatar() {
    stageCtx.clearRect(0, 0, stageCanvas.width, stageCanvas.height);
    var cellSize = stageCanvas.width / COLS;
    PART_CATEGORIES.forEach(function (category) {
      var option = findOption(category, avatarState[category]);
      if (!option.grid) return;
      var palette = resolvePalette(option, category);
      drawGrid(stageCtx, option.grid, palette, cellSize, 0, 0);
    });
  }

  function renderTabs() {
    tabsContainer.innerHTML = '';
    TAB_ORDER.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.className = 'pixel-btn' + (tab.key === activeCategory ? ' active' : '');
      btn.textContent = tab.label;
      btn.addEventListener('click', function () {
        activeCategory = tab.key;
        renderTabs();
        renderSwatches();
        renderColorPicker();
      });
      tabsContainer.appendChild(btn);
    });
  }

  function renderSwatches() {
    swatchRow.innerHTML = '';
    var options = PARTS[activeCategory];
    var thumbCell = 48 / COLS;
    options.forEach(function (option) {
      var btn = document.createElement('button');
      btn.className = 'swatch' + (avatarState[activeCategory] === option.id ? ' active' : '');
      btn.title = option.label;

      var thumb = document.createElement('canvas');
      thumb.width = 48;
      thumb.height = 48 * (ROWS / COLS);
      var tctx = thumb.getContext('2d');
      if (option.grid) {
        var palette = resolvePalette(option, activeCategory);
        drawGrid(tctx, option.grid, palette, thumbCell, 0, 0);
      }
      btn.appendChild(thumb);

      btn.addEventListener('click', function () {
        avatarState[activeCategory] = option.id;
        saveState();
        renderAvatar();
        renderSwatches();
        renderColorPicker();
      });

      swatchRow.appendChild(btn);
    });
  }

  function renderColorPicker() {
    var option = findOption(activeCategory, avatarState[activeCategory]);
    if (option.colorable) {
      colorPickerRow.style.display = 'flex';
      colorInput.value = avatarState.colors[activeCategory] || option.palette[1];
    } else {
      colorPickerRow.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    stageCanvas = document.getElementById('avatar-canvas');
    stageCtx = stageCanvas.getContext('2d');
    tabsContainer = document.getElementById('category-tabs');
    swatchRow = document.getElementById('swatch-row');
    colorPickerRow = document.getElementById('color-picker-row');
    colorInput = document.getElementById('part-color');
    downloadBtn = document.getElementById('download-btn');

    renderTabs();
    renderSwatches();
    renderColorPicker();
    renderAvatar();

    colorInput.addEventListener('input', function () {
      avatarState.colors[activeCategory] = colorInput.value;
      saveState();
      renderAvatar();
      renderSwatches();
    });

    downloadBtn.addEventListener('click', function () {
      var link = document.createElement('a');
      link.download = 'pixel-avatar.png';
      link.href = stageCanvas.toDataURL('image/png');
      link.click();
    });
  });
})();
