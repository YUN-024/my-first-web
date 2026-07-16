const BOARD_SIZE = 15;
const STONE_GLYPH = { b: '⚫', w: '⚪' };

let board, turn, gameOver, lastMove, moveCount, previousMode;

function inBounds(r, c) { return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }

function initBoard() {
  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  turn = 'b';
  gameOver = false;
  lastMove = null;
  moveCount = 0;
  previousMode = modeAiEl && modeAiEl.checked ? 'ai' : 'pvp';
  msgEl.textContent = '';
  document.getElementById('omok-overlay').classList.remove('visible');
  updateTurnLabel();
  render();
}

const boardEl = document.getElementById('omok-board');
const turnLabel = document.getElementById('turn-label');
const msgEl = document.getElementById('omok-message');
const vsCpu = { get checked() { return document.getElementById('mode-ai').checked; } };
const modePvpEl = document.getElementById('mode-pvp');
const modeAiEl = document.getElementById('mode-ai');

function showModal(message, buttons) {
  const overlay = document.getElementById('modal-overlay');
  const msg = document.getElementById('modal-message');
  const btnContainer = document.getElementById('modal-buttons');
  msg.textContent = message;
  btnContainer.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-cyan';
    btn.textContent = b.label;
    btn.addEventListener('click', () => {
      overlay.classList.remove('open');
      b.onClick();
    });
    btnContainer.appendChild(btn);
  });
  overlay.classList.add('open');
}

function handleModeChange(e) {
  if (moveCount > 0) {
    const requestedValue = e.target.value;
    showModal('진행 중인 게임이 있습니다. 새 게임을 시작하시겠습니까?', [
      { label: '새 게임 시작', onClick: () => { previousMode = requestedValue; initBoard(); } },
      { label: '계속하기', onClick: () => {
          if (previousMode === 'pvp') modePvpEl.checked = true; else modeAiEl.checked = true;
        } }
    ]);
  } else {
    previousMode = e.target.value;
  }
}
modePvpEl.addEventListener('change', handleModeChange);
modeAiEl.addEventListener('change', handleModeChange);

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (c === BOARD_SIZE - 1) cell.classList.add('col-last');
      if (r === BOARD_SIZE - 1) cell.classList.add('row-last');
      const v = board[r][c];
      if (v) {
        cell.textContent = STONE_GLYPH[v];
        cell.classList.add(v === 'b' ? 'stone-black' : 'stone-white');
      }
      if (lastMove && lastMove.r === r && lastMove.c === c) cell.classList.add('lastmove');
      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function updateTurnLabel() {
  turnLabel.textContent = turn === 'b' ? 'BLACK' : 'WHITE';
}

function showOmokOverlay(title, message) {
  document.getElementById('omok-result-title').textContent = title;
  document.getElementById('omok-result-message').textContent = message;
  document.getElementById('omok-overlay').classList.add('visible');
}

function checkWin(r, c) {
  const color = board[r][c];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    let rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) { count++; rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) { count++; rr -= dr; cc -= dc; }
    if (count >= 5) return true;
  }
  return false;
}

function isBoardFull() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) return false;
    }
  }
  return true;
}

function onCellClick(r, c) {
  if (gameOver) return;
  if (board[r][c]) return;
  if (vsCpu.checked && turn === 'w') return;
  placeStone(r, c);
}

function placeStone(r, c) {
  moveCount++;
  board[r][c] = turn;
  lastMove = { r, c };
  const won = checkWin(r, c);
  render();

  if (won) {
    gameOver = true;
    msgEl.textContent = '';
    showOmokOverlay(
      turn === 'b' ? '흑돌 승리!' : '백돌 승리!',
      turn === 'b' ? '검은 돌이 5개 이상 연결되었습니다.' : '흰 돌이 5개 이상 연결되었습니다.'
    );
    return;
  }
  if (isBoardFull()) {
    gameOver = true;
    msgEl.textContent = '';
    showOmokOverlay('무승부', '보드가 가득 찼습니다.');
    return;
  }

  turn = turn === 'b' ? 'w' : 'b';
  updateTurnLabel();
  if (turn === 'w' && vsCpu.checked) {
    msgEl.textContent = 'AI 계산 중...';
    setTimeout(cpuMove, 400);
  } else {
    msgEl.textContent = '';
  }
}

// ---- simple heuristic AI: score candidate cells by offense (own line strength)
// and defense (blocking opponent's line strength). No deep search, mirrors the
// scope of the site's other simple-heuristic game AIs. ----

function getCandidates() {
  const seen = new Set();
  const candidates = [];
  let any = false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) continue;
      any = true;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!inBounds(rr, cc) || board[rr][cc]) continue;
          const key = rr + ',' + cc;
          if (!seen.has(key)) { seen.add(key); candidates.push({ r: rr, c: cc }); }
        }
      }
    }
  }
  if (!any) return [{ r: 7, c: 7 }];
  return candidates;
}

function lineCountScore(count, openEnds) {
  if (count >= 5) return 100000;
  if (count === 4) return openEnds >= 1 ? 10000 : 0;
  if (count === 3) return openEnds === 2 ? 1000 : (openEnds === 1 ? 150 : 0);
  if (count === 2) return openEnds === 2 ? 100 : (openEnds === 1 ? 10 : 0);
  return openEnds === 2 ? 5 : 1;
}

function lineScore(r, c, color) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let score = 0;
  for (const [dr, dc] of dirs) {
    let count = 1, openEnds = 0;
    let rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) { count++; rr += dr; cc += dc; }
    if (inBounds(rr, cc) && !board[rr][cc]) openEnds++;
    rr = r - dr; cc = c - dc;
    while (inBounds(rr, cc) && board[rr][cc] === color) { count++; rr -= dr; cc -= dc; }
    if (inBounds(rr, cc) && !board[rr][cc]) openEnds++;
    score += lineCountScore(count, openEnds);
  }
  return score;
}

function chooseAiMove(aiColor) {
  const humanColor = aiColor === 'b' ? 'w' : 'b';
  const candidates = getCandidates();
  let bestScore = -Infinity, bestCells = [];
  for (const { r, c } of candidates) {
    const offense = lineScore(r, c, aiColor);
    const defense = lineScore(r, c, humanColor);
    const centerBias = -(Math.abs(r - 7) + Math.abs(c - 7)) * 0.1;
    const total = offense + defense * 0.95 + centerBias;
    if (total > bestScore + 1e-9) { bestScore = total; bestCells = [{ r, c }]; }
    else if (Math.abs(total - bestScore) < 1e-9) bestCells.push({ r, c });
  }
  if (!bestCells.length) return null;
  return bestCells[Math.floor(Math.random() * bestCells.length)];
}

function cpuMove() {
  if (gameOver) return;
  const mv = chooseAiMove('w');
  if (!mv) return;
  placeStone(mv.r, mv.c);
}

document.getElementById('omok-restart').addEventListener('click', initBoard);
document.getElementById('omok-restart-manual').addEventListener('click', initBoard);

initBoard();
