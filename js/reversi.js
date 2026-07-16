const BLACK = 'B';
const WHITE = 'W';
const AI_COLOR = WHITE;   // AI always plays white; human plays black
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

let board, turn, legalTargets, gameOver, lastMove, moveCount, previousMode;

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function opponent(color) { return color === BLACK ? WHITE : BLACK; }
function colorName(color) { return color === BLACK ? '흑돌' : '백돌'; }

function initBoard() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[3][3] = WHITE; board[3][4] = BLACK;
  board[4][3] = BLACK; board[4][4] = WHITE;
  turn = BLACK;
  gameOver = false;
  lastMove = null;
  moveCount = 0;
  previousMode = modeAiEl && modeAiEl.checked ? 'ai' : 'pvp';
  legalTargets = legalMoves(board, turn);
  document.getElementById('reversi-message').textContent = '';
  document.getElementById('reversi-overlay').classList.remove('visible');
  updateScore();
  updateTurnLabel();
  render();
}

function getFlipsForMove(b, r, c, color) {
  if (b[r][c]) return [];
  const opp = opponent(color);
  const flips = [];
  for (const [dr, dc] of DIRS) {
    let nr = r + dr, nc = c + dc;
    const line = [];
    while (inBounds(nr, nc) && b[nr][nc] === opp) {
      line.push({ r: nr, c: nc });
      nr += dr; nc += dc;
    }
    if (line.length > 0 && inBounds(nr, nc) && b[nr][nc] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

function legalMoves(b, color) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c]) continue;
      const flips = getFlipsForMove(b, r, c, color);
      if (flips.length > 0) moves.push({ r, c, flips });
    }
  }
  return moves;
}

function countDiscs(b) {
  let black = 0, white = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] === BLACK) black++;
      else if (b[r][c] === WHITE) white++;
    }
  }
  return { black, white };
}

function isCorner(r, c) { return (r === 0 || r === 7) && (c === 0 || c === 7); }
const CORNER_ADJ = new Set(['0,1', '1,0', '1,1', '0,6', '1,7', '1,6', '6,0', '7,1', '6,1', '6,7', '7,6', '6,6']);
function isAdjacentToCorner(r, c) { return CORNER_ADJ.has(r + ',' + c); }
function isEdge(r, c) { return r === 0 || r === 7 || c === 0 || c === 7; }

function scoreMove(move) {
  let s = move.flips.length;
  if (isCorner(move.r, move.c)) s += 50;
  else if (isAdjacentToCorner(move.r, move.c)) s -= 20;
  else if (isEdge(move.r, move.c)) s += 6;
  return s;
}

const boardEl = document.getElementById('reversi-board');
const turnLabelEl = document.getElementById('turn-label');
const msgEl = document.getElementById('reversi-message');
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
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq' + (c === 7 ? ' col-last' : '') + (r === 7 ? ' row-last' : '');
      sq.dataset.r = r; sq.dataset.c = c;
      const p = board[r][c];
      if (p) {
        sq.textContent = p === BLACK ? '⚫' : '⚪';
        sq.classList.add(p === BLACK ? 'stone-black' : 'stone-white');
      } else if (!gameOver && legalTargets.some(m => m.r === r && m.c === c)) {
        sq.classList.add('legal');
      }
      if (lastMove && lastMove.r === r && lastMove.c === c) sq.classList.add('lastmove');
      sq.addEventListener('click', () => onSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }
}

function updateScore() {
  const { black, white } = countDiscs(board);
  document.getElementById('score-display').textContent = '⚫ ' + black + ' : ' + white + ' ⚪';
}

function updateTurnLabel() {
  turnLabelEl.textContent = turn === BLACK ? 'BLACK' : 'WHITE';
}

function showReversiOverlay(title, message) {
  document.getElementById('reversi-result-title').textContent = title;
  document.getElementById('reversi-result-message').textContent = message;
  document.getElementById('reversi-overlay').classList.add('visible');
}

function endGame() {
  const { black, white } = countDiscs(board);
  let title;
  if (black > white) title = '⚫ 흑돌 승리!';
  else if (white > black) title = '⚪ 백돌 승리!';
  else title = '무승부';
  showReversiOverlay(title, '최종 스코어 ⚫ ' + black + ' : ' + white + ' ⚪');
}

// Determines whose turn is next after `mover` has played, handling forced
// pass-turn skips when a side has no legal move, and detecting game end
// when neither side can move.
function resolveNextTurn(mover) {
  const other = opponent(mover);
  const otherMoves = legalMoves(board, other);
  if (otherMoves.length > 0) {
    turn = other;
    legalTargets = otherMoves;
    return { skipped: false };
  }
  const moverMoves = legalMoves(board, mover);
  if (moverMoves.length > 0) {
    turn = mover;
    legalTargets = moverMoves;
    return { skipped: true, skippedColor: other };
  }
  gameOver = true;
  legalTargets = [];
  return { skipped: false };
}

function afterMove(mover) {
  const result = resolveNextTurn(mover);
  updateScore();
  updateTurnLabel();
  render();

  if (gameOver) {
    endGame();
    return;
  }

  msgEl.textContent = result.skipped
    ? colorName(result.skippedColor) + '은 둘 곳이 없어 턴을 건너뜁니다.'
    : '';

  if (modeAiEl.checked && turn === AI_COLOR) {
    msgEl.textContent = (result.skipped ? msgEl.textContent + ' ' : '') + 'AI 생각 중...';
    setTimeout(cpuMove, 400);
  }
}

function applyMoveToBoard(move, mover) {
  moveCount++;
  board[move.r][move.c] = mover;
  move.flips.forEach(f => { board[f.r][f.c] = mover; });
  lastMove = { r: move.r, c: move.c };
  afterMove(mover);
}

function onSquareClick(r, c) {
  if (gameOver) return;
  if (modeAiEl.checked && turn === AI_COLOR) return; // AI's turn, ignore clicks
  const move = legalTargets.find(m => m.r === r && m.c === c);
  if (!move) return;
  applyMoveToBoard(move, turn);
}

// ---- simple heuristic AI: maximize flips this turn, weighted heavily
// toward corners/edges and away from cells that hand the opponent a corner ----
function chooseAiMove(moves) {
  let best = -Infinity, bestMoves = [];
  moves.forEach(m => {
    const s = scoreMove(m);
    if (s > best) { best = s; bestMoves = [m]; }
    else if (s === best) bestMoves.push(m);
  });
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function cpuMove() {
  if (gameOver) return;
  if (!(modeAiEl.checked && turn === AI_COLOR)) return;
  const moves = legalTargets;
  if (!moves.length) return;
  const mv = chooseAiMove(moves);
  applyMoveToBoard(mv, turn);
}

document.getElementById('reversi-restart').addEventListener('click', initBoard);
document.getElementById('reversi-restart-manual').addEventListener('click', initBoard);

initBoard();
