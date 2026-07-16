const PIECE_GLYPH = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

let board, turn, castling, enPassant, selected, legalTargets, gameOver;
let lastMove, capturedByWhite, capturedByBlack;

function initBoard() {
  board = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R'],
  ];
  turn = 'w';
  castling = { wK: true, wQ: true, bK: true, bQ: true };
  enPassant = null;
  selected = null;
  legalTargets = [];
  gameOver = false;
  lastMove = null;
  capturedByWhite = [];
  capturedByBlack = [];
  moveCount = 0;
  previousMode = modeAiEl && modeAiEl.checked ? 'ai' : 'pvp';
  document.getElementById('chess-message').textContent = '';
  document.getElementById('chess-overlay').classList.remove('visible');
  renderCaptured();
  render();
  updateTurnLabel();
}

function isWhite(p) { return p && p === p.toUpperCase(); }
function isBlack(p) { return p && p === p.toLowerCase(); }
function colorOf(p) { return isWhite(p) ? 'w' : 'b'; }
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function cloneState() {
  return {
    board: board.map(row => row.slice()),
    turn, castling: { ...castling }, enPassant
  };
}

function pseudoMoves(r, c, b, state) {
  const p = b[r][c];
  if (!p) return [];
  const color = colorOf(p);
  const dir = color === 'w' ? -1 : 1;
  const moves = [];
  const type = p.toUpperCase();

  const push = (nr, nc, special) => {
    if (!inBounds(nr, nc)) return;
    const target = b[nr][nc];
    if (target && colorOf(target) === color) return;
    moves.push({ r: nr, c: nc, special: special || null });
  };

  const slide = (dirs) => {
    dirs.forEach(([dr, dc]) => {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = b[nr][nc];
        if (!target) { moves.push({ r: nr, c: nc }); }
        else { if (colorOf(target) !== color) moves.push({ r: nr, c: nc }); break; }
        nr += dr; nc += dc;
      }
    });
  };

  if (type === 'P') {
    const startRow = color === 'w' ? 6 : 1;
    const oneR = r + dir;
    if (inBounds(oneR, c) && !b[oneR][c]) {
      const isPromo = oneR === 0 || oneR === 7;
      moves.push({ r: oneR, c, special: isPromo ? 'promo' : null });
      const twoR = r + 2 * dir;
      if (r === startRow && !b[twoR][c]) moves.push({ r: twoR, c, special: 'double' });
    }
    [c - 1, c + 1].forEach(nc => {
      if (!inBounds(oneR, nc)) return;
      const target = b[oneR][nc];
      const isPromo = oneR === 0 || oneR === 7;
      if (target && colorOf(target) !== color) moves.push({ r: oneR, c: nc, special: isPromo ? 'promo' : 'capture' });
      else if (state.enPassant && state.enPassant.r === oneR && state.enPassant.c === nc) {
        moves.push({ r: oneR, c: nc, special: 'enpassant' });
      }
    });
  } else if (type === 'N') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => push(r+dr, c+dc));
  } else if (type === 'B') {
    slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
  } else if (type === 'R') {
    slide([[-1,0],[1,0],[0,-1],[0,1]]);
  } else if (type === 'Q') {
    slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
  } else if (type === 'K') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => push(r+dr, c+dc));
    // castling
    const rights = color === 'w' ? { K: state.castling.wK, Q: state.castling.wQ, row: 7 } : { K: state.castling.bK, Q: state.castling.bQ, row: 0 };
    if (r === rights.row && c === 4) {
      if (rights.K && !b[rights.row][5] && !b[rights.row][6] && b[rights.row][7] && b[rights.row][7].toUpperCase() === 'R') {
        if (!isAttacked(rights.row, 4, opponent(color), b) && !isAttacked(rights.row, 5, opponent(color), b) && !isAttacked(rights.row, 6, opponent(color), b)) {
          moves.push({ r: rights.row, c: 6, special: 'castleK' });
        }
      }
      if (rights.Q && !b[rights.row][1] && !b[rights.row][2] && !b[rights.row][3] && b[rights.row][0] && b[rights.row][0].toUpperCase() === 'R') {
        if (!isAttacked(rights.row, 4, opponent(color), b) && !isAttacked(rights.row, 3, opponent(color), b) && !isAttacked(rights.row, 2, opponent(color), b)) {
          moves.push({ r: rights.row, c: 2, special: 'castleQ' });
        }
      }
    }
  }
  return moves;
}

function opponent(color) { return color === 'w' ? 'b' : 'w'; }

function isAttacked(r, c, byColor, b) {
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const p = b[rr][cc];
      if (!p || colorOf(p) !== byColor) continue;
      const type = p.toUpperCase();
      if (type === 'P') {
        const dir = byColor === 'w' ? -1 : 1;
        if (rr + dir === r && (cc - 1 === c || cc + 1 === c)) return true;
      } else if (type === 'N') {
        if ([[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].some(([dr,dc]) => rr+dr===r && cc+dc===c)) return true;
      } else if (type === 'K') {
        if (Math.abs(rr-r) <= 1 && Math.abs(cc-c) <= 1) return true;
      } else if (type === 'B' || type === 'R' || type === 'Q') {
        const dirs = type === 'B' ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                     type === 'R' ? [[-1,0],[1,0],[0,-1],[0,1]] :
                     [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          let nr = rr + dr, nc = cc + dc;
          while (inBounds(nr, nc)) {
            if (nr === r && nc === c) return true;
            if (b[nr][nc]) break;
            nr += dr; nc += dc;
          }
        }
      }
    }
  }
  return false;
}

function findKing(color, b) {
  const target = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === target) return { r, c };
  return null;
}

function applyMove(state, from, to, promoChoice) {
  const b = state.board.map(row => row.slice());
  const p = b[from.r][from.c];
  const color = colorOf(p);
  let newEnPassant = null;

  if (to.special === 'enpassant') {
    b[from.r][to.c] = null; // captured pawn is beside, same row as from
  }
  if (to.special === 'double') {
    newEnPassant = { r: (from.r + to.r) / 2, c: from.c };
  }
  if (to.special === 'castleK') {
    b[from.r][5] = b[from.r][7]; b[from.r][7] = null;
  }
  if (to.special === 'castleQ') {
    b[from.r][3] = b[from.r][0]; b[from.r][0] = null;
  }

  b[to.r][to.c] = p;
  b[from.r][from.c] = null;

  if (to.special === 'promo') {
    b[to.r][to.c] = color === 'w' ? (promoChoice || 'Q') : (promoChoice || 'Q').toLowerCase();
  }

  const newCastling = { ...state.castling };
  if (p.toUpperCase() === 'K') {
    if (color === 'w') { newCastling.wK = false; newCastling.wQ = false; }
    else { newCastling.bK = false; newCastling.bQ = false; }
  }
  if (from.r === 7 && from.c === 0) newCastling.wQ = false;
  if (from.r === 7 && from.c === 7) newCastling.wK = false;
  if (from.r === 0 && from.c === 0) newCastling.bQ = false;
  if (from.r === 0 && from.c === 7) newCastling.bK = false;

  return { board: b, turn: opponent(state.turn), castling: newCastling, enPassant: newEnPassant };
}

function legalMovesFor(r, c, state) {
  const p = state.board[r][c];
  if (!p) return [];
  const color = colorOf(p);
  const pseudo = pseudoMoves(r, c, state.board, state);
  return pseudo.filter(m => {
    const next = applyMove(state, { r, c }, m);
    const kingPos = findKing(color, next.board);
    if (!kingPos) return false;
    return !isAttacked(kingPos.r, kingPos.c, opponent(color), next.board);
  });
}

function allLegalMoves(color, state) {
  const all = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && colorOf(p) === color) {
        legalMovesFor(r, c, state).forEach(m => all.push({ from: { r, c }, to: m }));
      }
    }
  }
  return all;
}

function isInCheck(color, state) {
  const k = findKing(color, state.board);
  if (!k) return false;
  return isAttacked(k.r, k.c, opponent(color), state.board);
}

const boardEl = document.getElementById('chess-board');
const turnLabel = document.getElementById('turn-label');
const msgEl = document.getElementById('chess-message');
const vsCpu = { get checked() { return document.getElementById('mode-ai').checked; } };
const modePvpEl = document.getElementById('mode-pvp');
const modeAiEl = document.getElementById('mode-ai');
let moveCount = 0;
let previousMode = 'pvp';

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
  const state = { board, turn, castling, enPassant };
  const checkedKingPos = isInCheck(turn, state) ? findKing(turn, board) : null;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.r = r; sq.dataset.c = c;
      const p = board[r][c];
      if (p) {
        sq.textContent = PIECE_GLYPH[p];
        sq.classList.add(isWhite(p) ? 'white-piece' : 'black-piece');
      }
      if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
      if (legalTargets.some(m => m.r === r && m.c === c)) {
        sq.classList.add(board[r][c] ? 'capturable' : 'movable');
      }
      if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
        sq.classList.add('lastmove');
      }
      if (checkedKingPos && checkedKingPos.r === r && checkedKingPos.c === c) {
        sq.classList.add('in-check');
      }
      sq.addEventListener('click', () => onSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }
}

function renderCaptured() {
  document.getElementById('captured-white').textContent = capturedByWhite.map(p => PIECE_GLYPH[p]).join(' ');
  document.getElementById('captured-black').textContent = capturedByBlack.map(p => PIECE_GLYPH[p]).join(' ');
}

function showChessOverlay(title, message) {
  document.getElementById('chess-result-title').textContent = title;
  document.getElementById('chess-result-message').textContent = message;
  document.getElementById('chess-overlay').classList.add('visible');
}

function updateTurnLabel() {
  turnLabel.textContent = turn === 'w' ? 'WHITE' : 'BLACK';
}

function onSquareClick(r, c) {
  if (gameOver) return;
  const state = { board, turn, castling, enPassant };
  const p = board[r][c];

  if (selected) {
    const move = legalTargets.find(m => m.r === r && m.c === c);
    if (move) {
      const from = selected;
      selected = null; legalTargets = [];
      doMove(from, move);
      return;
    }
    if (p && colorOf(p) === turn) {
      selected = { r, c };
      legalTargets = legalMovesFor(r, c, state);
      render();
      return;
    }
    selected = null; legalTargets = [];
    render();
    return;
  }

  if (p && colorOf(p) === turn) {
    selected = { r, c };
    legalTargets = legalMovesFor(r, c, state);
    render();
  }
}

function capturedPieceOf(from, to) {
  if (to.special === 'enpassant') return board[from.r][to.c];
  return board[to.r][to.c];
}

function doMove(from, to) {
  moveCount++;
  if (to.special === 'promo') {
    showModal('프로모션할 기물을 선택하세요', [
      { label: '퀸', onClick: () => executeMove(from, to, 'Q') },
      { label: '룩', onClick: () => executeMove(from, to, 'R') },
      { label: '비숍', onClick: () => executeMove(from, to, 'B') },
      { label: '나이트', onClick: () => executeMove(from, to, 'N') }
    ]);
  } else {
    executeMove(from, to, null);
  }
}

function executeMove(from, to, promoChoice) {
  const captured = capturedPieceOf(from, to);
  if (captured) {
    if (isWhite(captured)) capturedByBlack.push(captured);
    else capturedByWhite.push(captured);
  }
  const state = { board, turn, castling, enPassant };
  const next = applyMove(state, from, to, promoChoice);
  board = next.board; turn = next.turn; castling = next.castling; enPassant = next.enPassant;
  lastMove = { from, to };
  renderCaptured();
  updateTurnLabel();
  checkGameEnd();
  render();
  if (!gameOver && turn === 'b' && vsCpu.checked) {
    msgEl.textContent = 'AI 계산 중...';
    setTimeout(cpuMove, 400);
  }
}

function checkGameEnd() {
  const moves = allLegalMoves(turn, { board, turn, castling, enPassant });
  const check = isInCheck(turn, { board, turn, castling, enPassant });
  if (moves.length === 0) {
    gameOver = true;
    msgEl.textContent = '';
    if (check) {
      showChessOverlay('체크메이트!', (turn === 'w' ? '흑' : '백') + ' 승리');
    } else {
      showChessOverlay('스테일메이트', '무승부');
    }
  } else if (check) {
    msgEl.textContent = (turn === 'w' ? '백' : '흑') + ' 체크!';
  } else {
    msgEl.textContent = '';
  }
}

// ---- simple negamax + alpha-beta AI (built entirely on the existing pure move functions above) ----
const PIECE_VALUE = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 };
const CENTER = [
  [0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,2,2,2,1,0],
  [0,1,2,3,3,2,1,0],
  [0,1,2,3,3,2,1,0],
  [0,1,2,2,2,2,1,0],
  [0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0],
];
const SEARCH_DEPTH = 3;

function evaluateMaterial(b) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const v = PIECE_VALUE[p.toLowerCase()] + CENTER[r][c] * 4;
      score += isWhite(p) ? v : -v;
    }
  }
  return score;
}

function evaluateFor(b, color) {
  const s = evaluateMaterial(b);
  return color === 'w' ? s : -s;
}

function negamax(state, depth, alpha, beta) {
  const moves = allLegalMoves(state.turn, state);
  if (moves.length === 0) {
    const kp = findKing(state.turn, state.board);
    return isAttacked(kp.r, kp.c, opponent(state.turn), state.board) ? -100000 - depth : 0;
  }
  if (depth === 0) return evaluateFor(state.board, state.turn);
  let best = -Infinity;
  for (const mv of moves) {
    const next = applyMove(state, mv.from, mv.to, 'Q');
    const score = -negamax(next, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function chooseAiMove(state) {
  const moves = allLegalMoves(state.turn, state);
  let bestScore = -Infinity, bestMoves = [];
  for (const mv of moves) {
    const next = applyMove(state, mv.from, mv.to, 'Q');
    const score = -negamax(next, SEARCH_DEPTH - 1, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; bestMoves = [mv]; }
    else if (score === bestScore) bestMoves.push(mv);
  }
  if (!bestMoves.length) return null;
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function cpuMove() {
  const state = { board, turn, castling, enPassant };
  const mv = chooseAiMove(state);
  if (!mv) return;
  moveCount++;
  executeMove(mv.from, mv.to, 'Q');
}

document.getElementById('chess-restart').addEventListener('click', initBoard);
document.getElementById('chess-restart-manual').addEventListener('click', initBoard);

initBoard();
