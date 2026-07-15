(function () {
  'use strict';

  /* ======================================================================
     Constants
     ====================================================================== */
  var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  var PIECE_VALUE = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 };
  var SEARCH_DEPTH = 3; /* root move + this many plies of look-ahead */

  /* Small centre-preference table (0..3) so the AI does not shuffle aimlessly */
  var CENTER = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 2, 2, 1, 1, 0],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [0, 1, 1, 2, 2, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0]
  ];

  /* ======================================================================
     Game state
     ====================================================================== */
  var board = null;            /* board[row][col] -> piece or null. row 0 = top (black back rank) */
  var currentTurn = 'w';       /* 'w' | 'b' */
  var selected = null;         /* { r, c } or null */
  var legalMovesForSelected = [];
  var enPassantTarget = null;  /* { r, c } square that can be captured onto, or null */
  var lastMove = null;         /* { fromR, fromC, toR, toC } */
  var gameMode = null;         /* 'ai' | '2p' */
  var aiColor = 'b';           /* AI plays black when in ai mode */
  var gameOver = false;
  var aiThinking = false;
  var statusText = '대기 중'; /* "대기 중" */

  var capturedByWhite = [];    /* black pieces captured by white */
  var capturedByBlack = [];    /* white pieces captured by black */

  /* DOM refs */
  var boardEl, turnEl, statusEl, modeEl, modeOverlay, resultOverlay,
      resultTitle, resultMessage, restartBtn, modeAiBtn, mode2pBtn,
      capturedBlackTray, capturedWhiteTray;
  var squares = [];            /* squares[row][col] -> button element */

  /* ======================================================================
     Helpers
     ====================================================================== */
  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function opposite(color) {
    return color === 'w' ? 'b' : 'w';
  }

  function makePiece(type, color) {
    return { type: type, color: color, hasMoved: false };
  }

  function initialBoard() {
    var b = [];
    var r, c;
    for (r = 0; r < 8; r++) {
      b[r] = [];
      for (c = 0; c < 8; c++) b[r][c] = null;
    }
    var back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (c = 0; c < 8; c++) {
      b[0][c] = makePiece(back[c], 'b');
      b[1][c] = makePiece('p', 'b');
      b[6][c] = makePiece('p', 'w');
      b[7][c] = makePiece(back[c], 'w');
    }
    return b;
  }

  function cloneBoard(b) {
    var nb = [];
    for (var r = 0; r < 8; r++) {
      nb[r] = [];
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        nb[r][c] = p ? { type: p.type, color: p.color, hasMoved: p.hasMoved } : null;
      }
    }
    return nb;
  }

  function findKing(b, color) {
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (p && p.type === 'k' && p.color === color) return { r: r, c: c };
      }
    }
    return null;
  }

  /* ======================================================================
     Attack detection
     ====================================================================== */
  function isSquareAttacked(b, r, c, byColor) {
    var i, nr, nc, p;

    /* Pawn attacks: a byColor pawn attacks diagonally forward.
       White pawns move up (toward row 0), so they attack from row r+1.
       Black pawns move down, so they attack from row r-1. */
    var pawnRow = (byColor === 'w') ? r + 1 : r - 1;
    var dc;
    for (dc = -1; dc <= 1; dc += 2) {
      nr = pawnRow; nc = c + dc;
      if (inBounds(nr, nc)) {
        p = b[nr][nc];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }

    /* Knight */
    var knight = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (i = 0; i < knight.length; i++) {
      nr = r + knight[i][0]; nc = c + knight[i][1];
      if (inBounds(nr, nc)) {
        p = b[nr][nc];
        if (p && p.color === byColor && p.type === 'n') return true;
      }
    }

    /* King adjacency */
    var dr2, dc2;
    for (dr2 = -1; dr2 <= 1; dr2++) {
      for (dc2 = -1; dc2 <= 1; dc2++) {
        if (dr2 === 0 && dc2 === 0) continue;
        nr = r + dr2; nc = c + dc2;
        if (inBounds(nr, nc)) {
          p = b[nr][nc];
          if (p && p.color === byColor && p.type === 'k') return true;
        }
      }
    }

    /* Sliding diagonals: bishop / queen */
    var diag = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (i = 0; i < diag.length; i++) {
      nr = r + diag[i][0]; nc = c + diag[i][1];
      while (inBounds(nr, nc)) {
        p = b[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        nr += diag[i][0]; nc += diag[i][1];
      }
    }

    /* Sliding orthogonals: rook / queen */
    var orth = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (i = 0; i < orth.length; i++) {
      nr = r + orth[i][0]; nc = c + orth[i][1];
      while (inBounds(nr, nc)) {
        p = b[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        nr += orth[i][0]; nc += orth[i][1];
      }
    }

    return false;
  }

  /* ======================================================================
     Move generation
     ====================================================================== */
  function makeMove(fromR, fromC, toR, toC, flag) {
    return { fromR: fromR, fromC: fromC, toR: toR, toC: toC, flag: flag || 'normal' };
  }

  function slide(b, r, c, color, dirs, out) {
    for (var i = 0; i < dirs.length; i++) {
      var nr = r + dirs[i][0], nc = c + dirs[i][1];
      while (inBounds(nr, nc)) {
        var p = b[nr][nc];
        if (!p) {
          out.push(makeMove(r, c, nr, nc, 'normal'));
        } else {
          if (p.color !== color) out.push(makeMove(r, c, nr, nc, 'normal'));
          break;
        }
        nr += dirs[i][0]; nc += dirs[i][1];
      }
    }
  }

  function generatePseudoMoves(b, color, ep) {
    var moves = [];
    var r, c;
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p || p.color !== color) continue;
        generatePieceMoves(b, r, c, p, color, ep, moves);
      }
    }
    return moves;
  }

  function generatePieceMoves(b, r, c, p, color, ep, moves) {
    var i, nr, nc;

    if (p.type === 'p') {
      var dir = (color === 'w') ? -1 : 1;
      var startRow = (color === 'w') ? 6 : 1;
      /* forward one */
      nr = r + dir;
      if (inBounds(nr, c) && !b[nr][c]) {
        moves.push(makeMove(r, c, nr, c, 'normal'));
        /* forward two */
        if (r === startRow && !b[r + 2 * dir][c]) {
          moves.push(makeMove(r, c, r + 2 * dir, c, 'double'));
        }
      }
      /* captures */
      var dcp;
      for (dcp = -1; dcp <= 1; dcp += 2) {
        nc = c + dcp; nr = r + dir;
        if (!inBounds(nr, nc)) continue;
        var target = b[nr][nc];
        if (target && target.color !== color) {
          moves.push(makeMove(r, c, nr, nc, 'normal'));
        } else if (!target && ep && ep.r === nr && ep.c === nc) {
          moves.push(makeMove(r, c, nr, nc, 'enpassant'));
        }
      }
      return;
    }

    if (p.type === 'n') {
      var knight = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (i = 0; i < knight.length; i++) {
        nr = r + knight[i][0]; nc = c + knight[i][1];
        if (!inBounds(nr, nc)) continue;
        var t = b[nr][nc];
        if (!t || t.color !== color) moves.push(makeMove(r, c, nr, nc, 'normal'));
      }
      return;
    }

    if (p.type === 'b') {
      slide(b, r, c, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
      return;
    }
    if (p.type === 'r') {
      slide(b, r, c, color, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
      return;
    }
    if (p.type === 'q') {
      slide(b, r, c, color, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]], moves);
      return;
    }

    if (p.type === 'k') {
      var dr, dc;
      for (dr = -1; dr <= 1; dr++) {
        for (dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          nr = r + dr; nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          var tk = b[nr][nc];
          if (!tk || tk.color !== color) moves.push(makeMove(r, c, nr, nc, 'normal'));
        }
      }
      /* Castling (full legality checked here) */
      if (!p.hasMoved) {
        var opp = opposite(color);
        if (!isSquareAttacked(b, r, c, opp)) {
          /* kingside: rook at col 7, squares 5 & 6 empty and not attacked */
          var rk = b[r][7];
          if (rk && rk.type === 'r' && rk.color === color && !rk.hasMoved &&
              !b[r][5] && !b[r][6] &&
              !isSquareAttacked(b, r, 5, opp) && !isSquareAttacked(b, r, 6, opp)) {
            moves.push(makeMove(r, c, r, 6, 'castle-k'));
          }
          /* queenside: rook at col 0, squares 1,2,3 empty; king path 3 & 2 not attacked */
          var rq = b[r][0];
          if (rq && rq.type === 'r' && rq.color === color && !rq.hasMoved &&
              !b[r][1] && !b[r][2] && !b[r][3] &&
              !isSquareAttacked(b, r, 3, opp) && !isSquareAttacked(b, r, 2, opp)) {
            moves.push(makeMove(r, c, r, 2, 'castle-q'));
          }
        }
      }
      return;
    }
  }

  /* Apply a move to a board (mutates it). Returns the new en-passant target. */
  function applyMove(b, move, ep) {
    var piece = b[move.fromR][move.fromC];
    var newEp = null;

    if (move.flag === 'enpassant') {
      /* captured pawn sits on the moving pawn's starting row, in the destination column */
      b[move.fromR][move.toC] = null;
    }

    b[move.toR][move.toC] = piece;
    b[move.fromR][move.fromC] = null;
    if (piece) piece.hasMoved = true;

    /* promotion -> auto queen */
    if (piece && piece.type === 'p' && (move.toR === 0 || move.toR === 7)) {
      piece.type = 'q';
    }

    if (move.flag === 'double') {
      newEp = { r: (move.fromR + move.toR) / 2, c: move.fromC };
    }

    if (move.flag === 'castle-k') {
      var rook = b[move.fromR][7];
      b[move.fromR][5] = rook;
      b[move.fromR][7] = null;
      if (rook) rook.hasMoved = true;
    }
    if (move.flag === 'castle-q') {
      var rook2 = b[move.fromR][0];
      b[move.fromR][3] = rook2;
      b[move.fromR][0] = null;
      if (rook2) rook2.hasMoved = true;
    }

    return newEp;
  }

  /* Legal moves = pseudo-legal moves that do not leave own king in check */
  function generateLegalMoves(b, color, ep) {
    var pseudo = generatePseudoMoves(b, color, ep);
    var legal = [];
    for (var i = 0; i < pseudo.length; i++) {
      var scratch = cloneBoard(b);
      applyMove(scratch, pseudo[i], ep);
      var kp = findKing(scratch, color);
      if (kp && !isSquareAttacked(scratch, kp.r, kp.c, opposite(color))) {
        legal.push(pseudo[i]);
      }
    }
    return legal;
  }

  /* Determine which piece (if any) a move captures — before it is applied */
  function capturedByMove(b, move, ep) {
    if (move.flag === 'enpassant') return b[move.fromR][move.toC];
    return b[move.toR][move.toC];
  }

  /* ======================================================================
     AI — negamax with alpha-beta, material + light centre evaluation
     ====================================================================== */
  function evaluateMaterial(b) {
    var whiteScore = 0, blackScore = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p) continue;
        var v = PIECE_VALUE[p.type] + CENTER[r][c] * 4;
        if (p.color === 'w') whiteScore += v; else blackScore += v;
      }
    }
    return whiteScore - blackScore;
  }

  function evaluateFor(b, color) {
    var s = evaluateMaterial(b);
    return color === 'w' ? s : -s;
  }

  function negamax(b, color, ep, depth, alpha, beta) {
    var moves = generateLegalMoves(b, color, ep);
    if (moves.length === 0) {
      var kp = findKing(b, color);
      if (kp && isSquareAttacked(b, kp.r, kp.c, opposite(color))) {
        return -100000 - depth; /* checkmated — worse the sooner it happens */
      }
      return 0; /* stalemate */
    }
    if (depth === 0) {
      return evaluateFor(b, color);
    }
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var scratch = cloneBoard(b);
      var nep = applyMove(scratch, moves[i], ep);
      var score = -negamax(scratch, opposite(color), nep, depth - 1, -beta, -alpha);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseAiMove(b, color, ep) {
    var moves = generateLegalMoves(b, color, ep);
    if (moves.length === 0) return null;
    var bestScore = -Infinity;
    var bestMoves = [];
    for (var i = 0; i < moves.length; i++) {
      var scratch = cloneBoard(b);
      var nep = applyMove(scratch, moves[i], ep);
      var score = -negamax(scratch, opposite(color), nep, SEARCH_DEPTH - 1, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [moves[i]];
      } else if (score === bestScore) {
        bestMoves.push(moves[i]);
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  /* ======================================================================
     Rendering
     ====================================================================== */
  function buildBoard() {
    boardEl.innerHTML = '';
    squares = [];
    for (var r = 0; r < 8; r++) {
      squares[r] = [];
      for (var c = 0; c < 8; c++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chess-square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
        btn.setAttribute('data-r', r);
        btn.setAttribute('data-c', c);
        btn.addEventListener('click', (function (rr, cc) {
          return function () { handleSquareClick(rr, cc); };
        })(r, c));
        boardEl.appendChild(btn);
        squares[r][c] = btn;
      }
    }
  }

  function render() {
    var r, c;
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        var sq = squares[r][c];
        sq.className = 'chess-square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
        var p = board[r][c];
        sq.innerHTML = p
          ? '<span class="chess-piece ' + (p.color === 'w' ? 'white' : 'black') + '">' + GLYPH[p.type] + '</span>'
          : '';
      }
    }

    /* last move highlight */
    if (lastMove) {
      squares[lastMove.fromR][lastMove.fromC].classList.add('lastmove');
      squares[lastMove.toR][lastMove.toC].classList.add('lastmove');
    }

    /* king-in-check highlight (for the side to move) */
    var kp = findKing(board, currentTurn);
    if (kp && isSquareAttacked(board, kp.r, kp.c, opposite(currentTurn))) {
      squares[kp.r][kp.c].classList.add('in-check');
    }

    /* selection + legal-move markers */
    if (selected) {
      squares[selected.r][selected.c].classList.add('selected');
      for (var i = 0; i < legalMovesForSelected.length; i++) {
        var m = legalMovesForSelected[i];
        var tsq = squares[m.toR][m.toC];
        var isCapture = board[m.toR][m.toC] || m.flag === 'enpassant';
        tsq.classList.add(isCapture ? 'capture-dot' : 'move-dot');
        tsq.innerHTML += '<span class="move-marker"></span>';
      }
    }

    renderCaptured();
  }

  function renderCaptured() {
    capturedBlackTray.innerHTML = capturedByWhite.map(glyphSpan).join('');
    capturedWhiteTray.innerHTML = capturedByBlack.map(glyphSpan).join('');
  }

  function glyphSpan(p) {
    return '<span class="cap-piece">' + GLYPH[p.type] + '</span>';
  }

  function updateHud() {
    turnEl.textContent = currentTurn === 'w' ? '백' : '흑'; /* 백 / 흑 */
    statusEl.textContent = statusText;
    if (gameMode === 'ai') {
      modeEl.textContent = 'AI 대결'; /* AI 대결 */
    } else if (gameMode === '2p') {
      modeEl.textContent = '2인 대전'; /* 2인 대전 */
    } else {
      modeEl.textContent = '-';
    }
  }

  /* ======================================================================
     Interaction
     ====================================================================== */
  function handleSquareClick(r, c) {
    if (gameOver || aiThinking) return;
    if (gameMode === 'ai' && currentTurn === aiColor) return;

    var piece = board[r][c];

    if (selected) {
      /* clicking a highlighted legal destination -> move */
      var chosen = findMoveTo(r, c);
      if (chosen) {
        performMove(chosen);
        return;
      }
      /* clicking another own piece -> reselect */
      if (piece && piece.color === currentTurn && !(selected.r === r && selected.c === c)) {
        selectSquare(r, c);
        return;
      }
      /* otherwise deselect */
      selected = null;
      legalMovesForSelected = [];
      render();
      return;
    }

    /* nothing selected: select an own piece */
    if (piece && piece.color === currentTurn) {
      selectSquare(r, c);
    }
  }

  function findMoveTo(r, c) {
    for (var i = 0; i < legalMovesForSelected.length; i++) {
      if (legalMovesForSelected[i].toR === r && legalMovesForSelected[i].toC === c) {
        return legalMovesForSelected[i];
      }
    }
    return null;
  }

  function selectSquare(r, c) {
    selected = { r: r, c: c };
    var all = generateLegalMoves(board, currentTurn, enPassantTarget);
    legalMovesForSelected = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].fromR === r && all[i].fromC === c) legalMovesForSelected.push(all[i]);
    }
    render();
  }

  function performMove(move) {
    var captured = capturedByMove(board, move, enPassantTarget);
    enPassantTarget = applyMove(board, move, enPassantTarget);

    if (captured) {
      if (captured.color === 'b') capturedByWhite.push(captured);
      else capturedByBlack.push(captured);
    }

    lastMove = { fromR: move.fromR, fromC: move.fromC, toR: move.toR, toC: move.toC };
    selected = null;
    legalMovesForSelected = [];
    currentTurn = opposite(currentTurn);

    render();
    evaluateGameEnd();
    updateHud();

    if (!gameOver && gameMode === 'ai' && currentTurn === aiColor) {
      aiThinking = true;
      statusText = 'AI 계산 중...'; /* AI 계산 중... */
      statusEl.textContent = statusText;
      setTimeout(runAiTurn, 350);
    }
  }

  function runAiTurn() {
    var move = chooseAiMove(board, aiColor, enPassantTarget);
    aiThinking = false;
    if (!move) {
      evaluateGameEnd();
      updateHud();
      return;
    }
    performMove(move);
  }

  function evaluateGameEnd() {
    var moves = generateLegalMoves(board, currentTurn, enPassantTarget);
    var kp = findKing(board, currentTurn);
    var inCheck = kp && isSquareAttacked(board, kp.r, kp.c, opposite(currentTurn));

    if (moves.length === 0) {
      gameOver = true;
      if (inCheck) {
        var winner = opposite(currentTurn) === 'w' ? '백' : '흑'; /* 백 / 흑 */
        statusText = '체크메이트'; /* 체크메이트 */
        showResult('체크메이트!', winner + ' 승리!'); /* 체크메이트! / 승리! */
      } else {
        statusText = '스테일메이트'; /* 스테일메이트 */
        showResult('스테일메이트', '무승부입니다'); /* 스테일메이트 / 무승부입니다 */
      }
      return;
    }

    statusText = inCheck ? '체크!' : '진행 중'; /* 체크! / 진행 중 */
  }

  /* ======================================================================
     Overlays / game lifecycle
     ====================================================================== */
  function showResult(title, message) {
    resultTitle.textContent = title;
    resultMessage.textContent = message;
    resultOverlay.classList.add('visible');
  }

  function resetGame() {
    board = initialBoard();
    currentTurn = 'w';
    selected = null;
    legalMovesForSelected = [];
    enPassantTarget = null;
    lastMove = null;
    gameOver = false;
    aiThinking = false;
    capturedByWhite = [];
    capturedByBlack = [];
    statusText = '진행 중'; /* 진행 중 */
    resultOverlay.classList.remove('visible');
    render();
    updateHud();
  }

  function startMode(mode) {
    gameMode = mode;
    modeOverlay.classList.remove('visible');
    resetGame();
  }

  function backToModeSelect() {
    gameMode = null;
    resultOverlay.classList.remove('visible');
    modeOverlay.classList.add('visible');
    statusText = '대기 중'; /* 대기 중 */
    /* reset board visually to a fresh position behind the overlay */
    board = initialBoard();
    currentTurn = 'w';
    selected = null;
    legalMovesForSelected = [];
    enPassantTarget = null;
    lastMove = null;
    gameOver = false;
    aiThinking = false;
    capturedByWhite = [];
    capturedByBlack = [];
    render();
    updateHud();
  }

  /* ======================================================================
     Init
     ====================================================================== */
  function init() {
    boardEl = document.getElementById('chess-board');
    turnEl = document.getElementById('turn-indicator');
    statusEl = document.getElementById('status-text');
    modeEl = document.getElementById('mode-text');
    modeOverlay = document.getElementById('mode-overlay');
    resultOverlay = document.getElementById('result-overlay');
    resultTitle = document.getElementById('result-title');
    resultMessage = document.getElementById('result-message');
    restartBtn = document.getElementById('restart-btn');
    modeAiBtn = document.getElementById('mode-ai-btn');
    mode2pBtn = document.getElementById('mode-2p-btn');
    capturedBlackTray = document.getElementById('captured-black');
    capturedWhiteTray = document.getElementById('captured-white');

    buildBoard();
    board = initialBoard();
    render();
    updateHud();

    modeAiBtn.addEventListener('click', function () { startMode('ai'); });
    mode2pBtn.addEventListener('click', function () { startMode('2p'); });
    restartBtn.addEventListener('click', backToModeSelect);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
