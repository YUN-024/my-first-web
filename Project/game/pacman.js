(function () {
  var COLS = 19;
  var ROWS = 19;
  var CELL = 24;
  var TICK_MS = 180;
  var START_LIVES = 3;
  var HIGH_SCORE_KEY = 'pixelsite-pacman-highscore';

  var WALL = 0, DOT = 1, EMPTY = 2, POWER = 3;

  var DIRS = {
    up: { dr: -1, dc: 0 },
    down: { dr: 1, dc: 0 },
    left: { dr: 0, dc: -1 },
    right: { dr: 0, dc: 1 }
  };
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // Ghost personalities: one greedy chaser, one ambusher (targets ahead of the
  // player), one patroller (random wandering, closest to the original ghosts).
  var GHOST_COLORS = ['#ff5555', '#ff7edb', '#ffa94d'];
  var GHOST_TYPES = ['chaser', 'ambusher', 'patroller'];
  var FRIGHTENED_COLOR = '#4d6bff';
  var FRIGHTENED_FLASH_COLOR = '#f5f7ff';
  var EATEN_COLOR = '#5a5a6e';

  var FRIGHTENED_TICKS = Math.round(9000 / TICK_MS);
  var EATEN_TICKS = Math.round(1500 / TICK_MS);
  var AMBUSH_LOOKAHEAD = 4;
  var LOOP_CHANCE = 0.15;

  // Logical maze grid is COLS/ROWS mapped 2:1 (odd coordinates are cell
  // centers, even coordinates are the walls/passages between them). The
  // center 3x3 block of logical cells is reserved for the ghost den.
  var LOGICAL_N = (COLS - 1) / 2; // === (ROWS - 1) / 2, grid is square
  var DEN_LO = 3, DEN_HI = 5;
  var DEN_BOX = { top: 2 * DEN_LO, bottom: 2 * DEN_HI + 2, left: 2 * DEN_LO, right: 2 * DEN_HI + 2 };
  var DEN_DOOR_COL = Math.floor((DEN_BOX.left + DEN_BOX.right) / 2);
  var DEN_DOOR = { r: DEN_BOX.top, c: DEN_DOOR_COL };
  var DEN_CENTER = { r: Math.floor((DEN_BOX.top + DEN_BOX.bottom) / 2), c: DEN_DOOR_COL };
  var TUNNEL_ROW = 2 * 4 + 1; // middle row, same row band as the den

  var GHOST_SPAWNS = [{ r: 9, c: 8 }, { r: 9, c: 9 }, { r: 9, c: 10 }];
  var PLAYER_SPAWN = { r: ROWS - 2, c: 1 };

  var canvas, ctx, scoreEl, livesEl, highScoreEl, powerEl, overlay, resultTitleEl, finalScoreEl, newRecordEl, startBtn, restartBtn;

  var maze = [];
  var dotsRemaining = 0;
  var score = 0;
  var lives = START_LIVES;
  var highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  var gameActive = false;
  var tickIntervalId = null;
  var frightenedTimer = 0;

  var player = { r: 0, c: 0, dir: 'left', desiredDir: 'left' };
  var ghosts = [];

  function shuffle(arr) {
    for (var k = arr.length - 1; k > 0; k--) {
      var m = Math.floor(Math.random() * (k + 1));
      var tmp = arr[k]; arr[k] = arr[m]; arr[m] = tmp;
    }
    return arr;
  }

  function isDenLogicalCell(i, j) {
    return i >= DEN_LO && i <= DEN_HI && j >= DEN_LO && j <= DEN_HI;
  }

  function realOf(i, j) {
    return { r: 2 * i + 1, c: 2 * j + 1 };
  }

  // Builds a real maze: a recursive-backtracker spanning tree carved through
  // every logical cell except the reserved center block (guarantees full
  // connectivity by construction), then a few random extra passages for
  // loops, then the ghost den box, border, and warp tunnel are stamped on.
  function buildMaze() {
    var grid = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(WALL);
      grid.push(row);
    }

    var visited = [];
    for (var i = 0; i < LOGICAL_N; i++) visited.push(new Array(LOGICAL_N).fill(false));

    var neighborDeltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var stack = [[0, 0]];
    visited[0][0] = true;
    var start = realOf(0, 0);
    grid[start.r][start.c] = DOT;

    while (stack.length) {
      var cur = stack[stack.length - 1];
      var ci = cur[0], cj = cur[1];
      var dirs = shuffle(neighborDeltas.slice());
      var moved = false;
      for (var d = 0; d < dirs.length; d++) {
        var ni = ci + dirs[d][0], nj = cj + dirs[d][1];
        if (ni < 0 || ni >= LOGICAL_N || nj < 0 || nj >= LOGICAL_N) continue;
        if (isDenLogicalCell(ni, nj)) continue;
        if (visited[ni][nj]) continue;
        visited[ni][nj] = true;
        var curReal = realOf(ci, cj), nReal = realOf(ni, nj);
        var betweenR = (curReal.r + nReal.r) / 2, betweenC = (curReal.c + nReal.c) / 2;
        grid[nReal.r][nReal.c] = DOT;
        grid[betweenR][betweenC] = DOT;
        stack.push([ni, nj]);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }

    // Knock down a handful of extra walls between already-connected donut
    // cells to add loops/circular corridors (never disconnects anything,
    // since the cells on both sides are already reachable via the tree).
    for (var i2 = 0; i2 < LOGICAL_N; i2++) {
      for (var j2 = 0; j2 < LOGICAL_N; j2++) {
        if (isDenLogicalCell(i2, j2)) continue;
        if (j2 + 1 < LOGICAL_N && !isDenLogicalCell(i2, j2 + 1)) {
          var a = realOf(i2, j2), b = realOf(i2, j2 + 1);
          var br = (a.r + b.r) / 2, bc = (a.c + b.c) / 2;
          if (grid[br][bc] === WALL && Math.random() < LOOP_CHANCE) grid[br][bc] = DOT;
        }
        if (i2 + 1 < LOGICAL_N && !isDenLogicalCell(i2 + 1, j2)) {
          var a2 = realOf(i2, j2), b2 = realOf(i2 + 1, j2);
          var br2 = (a2.r + b2.r) / 2, bc2 = (a2.c + b2.c) / 2;
          if (grid[br2][bc2] === WALL && Math.random() < LOOP_CHANCE) grid[br2][bc2] = DOT;
        }
      }
    }

    // Ghost den: open interior room, walled perimeter, single door at top.
    for (var r4 = DEN_BOX.top + 1; r4 < DEN_BOX.bottom; r4++) {
      for (var c4 = DEN_BOX.left + 1; c4 < DEN_BOX.right; c4++) grid[r4][c4] = EMPTY;
    }
    for (var c5 = DEN_BOX.left; c5 <= DEN_BOX.right; c5++) {
      grid[DEN_BOX.top][c5] = WALL;
      grid[DEN_BOX.bottom][c5] = WALL;
    }
    for (var r5 = DEN_BOX.top; r5 <= DEN_BOX.bottom; r5++) {
      grid[r5][DEN_BOX.left] = WALL;
      grid[r5][DEN_BOX.right] = WALL;
    }
    grid[DEN_DOOR.r][DEN_DOOR.c] = EMPTY;

    // Outer border.
    for (var c6 = 0; c6 < COLS; c6++) { grid[0][c6] = WALL; grid[ROWS - 1][c6] = WALL; }
    for (var r6 = 0; r6 < ROWS; r6++) { grid[r6][0] = WALL; grid[r6][COLS - 1] = WALL; }

    // Warp tunnel: left/right edges of the tunnel row connect to each other.
    grid[TUNNEL_ROW][0] = EMPTY;
    grid[TUNNEL_ROW][COLS - 1] = EMPTY;

    // Clear spawn tiles before placing power pellets so a pellet never gets
    // silently overwritten by a spawn point.
    grid[PLAYER_SPAWN.r][PLAYER_SPAWN.c] = EMPTY;
    GHOST_SPAWNS.forEach(function (spot) { grid[spot.r][spot.c] = EMPTY; });

    // Power pellets near the four far corners (whichever are still dots).
    var corners = [[1, 1], [1, COLS - 2], [ROWS - 2, 1], [ROWS - 2, COLS - 2]];
    corners.forEach(function (pos) {
      if (grid[pos[0]][pos[1]] === DOT) grid[pos[0]][pos[1]] = POWER;
    });

    return grid;
  }

  function countDots(grid) {
    var count = 0;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (grid[r][c] === DOT || grid[r][c] === POWER) count++;
      }
    }
    return count;
  }

  function isWall(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    return maze[r][c] === WALL;
  }

  function isInDen(r, c) {
    return r > DEN_BOX.top && r < DEN_BOX.bottom && c > DEN_BOX.left && c < DEN_BOX.right;
  }

  // Applies a move in a direction, wrapping around the warp tunnel row.
  function stepPos(pos, dirName) {
    var d = DIRS[dirName];
    var nc = pos.c + d.dc;
    if (pos.r === TUNNEL_ROW && d.dr === 0) {
      if (nc < 0) nc = COLS - 1;
      else if (nc >= COLS) nc = 0;
    }
    return { r: pos.r + d.dr, c: nc };
  }

  function validDirections(pos, excludeDir) {
    var dirs = [];
    for (var name in DIRS) {
      if (name === excludeDir) continue;
      var np = stepPos(pos, name);
      if (!isWall(np.r, np.c)) dirs.push(name);
    }
    return dirs;
  }

  function resetPositions() {
    player.r = PLAYER_SPAWN.r;
    player.c = PLAYER_SPAWN.c;
    player.dir = 'left';
    player.desiredDir = 'left';
    frightenedTimer = 0;

    ghosts = GHOST_SPAWNS.map(function (spot, i) {
      return {
        r: spot.r, c: spot.c, dir: 'up',
        color: GHOST_COLORS[i % GHOST_COLORS.length],
        type: GHOST_TYPES[i % GHOST_TYPES.length],
        eaten: false, eatenTimer: 0
      };
    });
  }

  function movePlayer() {
    var desiredNp = stepPos(player, player.desiredDir);
    if (DIRS[player.desiredDir] && !isWall(desiredNp.r, desiredNp.c)) {
      player.dir = player.desiredDir;
    }
    var np = stepPos(player, player.dir);
    if (!isWall(np.r, np.c)) {
      player.r = np.r;
      player.c = np.c;
    }

    if (maze[player.r][player.c] === DOT) {
      maze[player.r][player.c] = EMPTY;
      dotsRemaining--;
      score += 10;
      scoreEl.textContent = score;
    } else if (maze[player.r][player.c] === POWER) {
      maze[player.r][player.c] = EMPTY;
      dotsRemaining--;
      score += 10;
      scoreEl.textContent = score;
      frightenedTimer = FRIGHTENED_TICKS;
    }
  }

  function moveGhostRandom(ghost) {
    var candidates = validDirections(ghost, null);
    var nonReverse = candidates.filter(function (d) { return d !== OPPOSITE[ghost.dir]; });
    var pool = nonReverse.length ? nonReverse : candidates;
    if (!pool.length) return;
    ghost.dir = pool[Math.floor(Math.random() * pool.length)];
    var np = stepPos(ghost, ghost.dir);
    ghost.r = np.r;
    ghost.c = np.c;
  }

  // Greedily picks the valid, non-reversing direction that minimizes
  // Manhattan distance to `target` - a simple, well-known approximation of
  // classic Pac-Man ghost AI that doesn't require real pathfinding.
  function moveGhostGreedy(ghost, target) {
    var candidates = validDirections(ghost, null);
    var nonReverse = candidates.filter(function (d) { return d !== OPPOSITE[ghost.dir]; });
    var pool = nonReverse.length ? nonReverse : candidates;
    if (!pool.length) return;
    pool = shuffle(pool.slice());

    var best = pool[0], bestDist = Infinity;
    pool.forEach(function (dirName) {
      var np = stepPos(ghost, dirName);
      var dist = Math.abs(np.r - target.r) + Math.abs(np.c - target.c);
      if (dist < bestDist) {
        bestDist = dist;
        best = dirName;
      }
    });
    ghost.dir = best;
    var np = stepPos(ghost, best);
    ghost.r = np.r;
    ghost.c = np.c;
  }

  function computeAmbushTarget() {
    var d = DIRS[player.dir];
    var tr = player.r + d.dr * AMBUSH_LOOKAHEAD;
    var tc = player.c + d.dc * AMBUSH_LOOKAHEAD;
    if (tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS || maze[tr][tc] === WALL) {
      return { r: player.r, c: player.c };
    }
    return { r: tr, c: tc };
  }

  function moveGhosts() {
    ghosts.forEach(function (ghost) {
      if (ghost.eaten) {
        ghost.eatenTimer--;
        if (ghost.eatenTimer <= 0) ghost.eaten = false;
        return;
      }
      if (isInDen(ghost.r, ghost.c)) {
        moveGhostGreedy(ghost, DEN_DOOR);
        return;
      }
      if (frightenedTimer > 0) {
        moveGhostRandom(ghost);
        return;
      }
      if (ghost.type === 'chaser') {
        moveGhostGreedy(ghost, { r: player.r, c: player.c });
      } else if (ghost.type === 'ambusher') {
        moveGhostGreedy(ghost, computeAmbushTarget());
      } else {
        moveGhostRandom(ghost);
      }
    });
  }

  // Resolves player/ghost overlaps. Returns early after any life-losing hit
  // since positions get reset (stale ghost references shouldn't be reused).
  function processCollisions() {
    for (var i = 0; i < ghosts.length; i++) {
      var ghost = ghosts[i];
      if (ghost.eaten) continue;
      if (ghost.r === player.r && ghost.c === player.c) {
        if (frightenedTimer > 0) {
          score += 50;
          scoreEl.textContent = score;
          ghost.eaten = true;
          ghost.eatenTimer = EATEN_TICKS;
          ghost.r = DEN_CENTER.r;
          ghost.c = DEN_CENTER.c;
        } else {
          lives--;
          updateLivesDisplay();
          if (lives <= 0) {
            endGame(false);
            return;
          }
          resetPositions();
          return;
        }
      }
    }
  }

  function updateLivesDisplay() {
    var hearts = '';
    for (var i = 0; i < lives; i++) hearts += '❤';
    livesEl.textContent = hearts || '-';
  }

  function updatePowerDisplay() {
    if (!powerEl) return;
    powerEl.textContent = frightenedTimer > 0 ? Math.ceil(frightenedTimer * TICK_MS / 1000) + '초' : '-';
  }

  function tick() {
    movePlayer();
    processCollisions();
    if (!gameActive) return;

    if (dotsRemaining <= 0) {
      endGame(true);
      return;
    }

    if (frightenedTimer > 0) frightenedTimer--;

    moveGhosts();
    processCollisions();
    if (!gameActive) return;

    render();
  }

  function drawCellSquare(r, c, color, inset) {
    ctx.fillStyle = color;
    ctx.fillRect(c * CELL + inset, r * CELL + inset, CELL - inset * 2, CELL - inset * 2);
  }

  function drawPowerPellet(r, c) {
    var cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
    ctx.fillStyle = '#ffefa1';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  function ghostRenderColor(ghost) {
    if (ghost.eaten) return EATEN_COLOR;
    if (frightenedTimer > 0) {
      if (frightenedTimer < 15 && Math.floor(frightenedTimer / 3) % 2 === 0) return FRIGHTENED_FLASH_COLOR;
      return FRIGHTENED_COLOR;
    }
    return ghost.color;
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (maze[r][c] === WALL) {
          drawCellSquare(r, c, '#3d6cb9', 1);
        } else if (maze[r][c] === DOT) {
          drawCellSquare(r, c, '#ffd447', 10);
        } else if (maze[r][c] === POWER) {
          drawPowerPellet(r, c);
        }
      }
    }

    ghosts.forEach(function (ghost) {
      drawCellSquare(ghost.r, ghost.c, ghostRenderColor(ghost), 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ghost.c * CELL + 6, ghost.r * CELL + 8, 4, 4);
      ctx.fillRect(ghost.c * CELL + CELL - 10, ghost.r * CELL + 8, 4, 4);
    });

    drawCellSquare(player.r, player.c, '#ffd447', 3);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(player.c * CELL + 6, player.r * CELL + 8, 4, 4);
    ctx.fillRect(player.c * CELL + CELL - 10, player.r * CELL + 8, 4, 4);

    updatePowerDisplay();
  }

  function startGame() {
    maze = buildMaze();
    dotsRemaining = countDots(maze);
    score = 0;
    lives = START_LIVES;
    frightenedTimer = 0;
    gameActive = true;

    scoreEl.textContent = score;
    highScoreEl.textContent = highScore;
    updateLivesDisplay();
    overlay.classList.remove('visible');

    resetPositions();
    render();

    clearInterval(tickIntervalId);
    tickIntervalId = setInterval(tick, TICK_MS);
  }

  function endGame(won) {
    gameActive = false;
    clearInterval(tickIntervalId);

    var isNewRecord = score > highScore;
    if (isNewRecord) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    }
    highScoreEl.textContent = highScore;

    resultTitleEl.textContent = won ? '클리어!' : '게임 오버';
    finalScoreEl.textContent = '최종 점수: ' + score;
    newRecordEl.textContent = isNewRecord ? '🎉 신기록!' : '';
    overlay.classList.add('visible');
    render();
  }

  function setDesiredDirection(name) {
    player.desiredDir = name;
  }

  function handleKeydown(e) {
    var map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right'
    };
    var dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    setDesiredDirection(dir);
  }

  function attachSwipeControls() {
    var startX = null, startY = null;

    canvas.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      startX = t.clientX;
      startY = t.clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        setDesiredDirection(dx > 0 ? 'right' : 'left');
      } else {
        setDesiredDirection(dy > 0 ? 'down' : 'up');
      }
      startX = null;
      startY = null;
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    canvas = document.getElementById('pacman-canvas');
    ctx = canvas.getContext('2d');
    scoreEl = document.getElementById('score');
    livesEl = document.getElementById('lives');
    highScoreEl = document.getElementById('high-score');
    powerEl = document.getElementById('power-timer');
    overlay = document.getElementById('game-overlay');
    resultTitleEl = document.getElementById('result-title');
    finalScoreEl = document.getElementById('final-score');
    newRecordEl = document.getElementById('new-record');
    startBtn = document.getElementById('start-btn');
    restartBtn = document.getElementById('restart-btn');

    highScoreEl.textContent = highScore;

    maze = buildMaze();
    dotsRemaining = countDots(maze);
    resetPositions();
    render();

    document.addEventListener('keydown', handleKeydown);
    attachSwipeControls();

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
  });
})();
