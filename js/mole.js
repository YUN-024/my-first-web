const gridEl = document.getElementById('mole-grid');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const highScoreEl = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');
const gridSizeSelect = document.getElementById('grid-size');
const overlay = document.getElementById('game-overlay');
const finalScoreEl = document.getElementById('final-score');
const newRecordEl = document.getElementById('new-record');
const restartBtn = document.getElementById('restart-btn');

const HIGH_SCORE_KEY = 'pixel-site-mole-highscore';
let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
highScoreEl.textContent = highScore;

const GOOD_EMOJI = '💗';
const BAD_EMOJI = '💣';
const BAD_CHANCE = 0.3;
const TOTAL_TIME = 30;

let holes = [];
let size = 3;
let score = 0;
let timeLeft = TOTAL_TIME;
let gameTimer = null;
let moleTimeoutId = null;
let activeHole = null;
let lastHole = null;
let running = false;

function buildGrid(n) {
  size = n;
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  holes = [];
  for (let i = 0; i < size * size; i++) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'mole-emoji';
    hole.appendChild(emojiSpan);
    hole.addEventListener('click', () => whack(i));
    gridEl.appendChild(hole);
    holes.push({ el: hole, emojiSpan, isBad: false });
  }
  activeHole = null;
  lastHole = null;
}

function currentInterval() {
  // speeds up as time runs out: starts ~750ms, drops toward ~280ms
  const progress = 1 - timeLeft / TOTAL_TIME;
  return Math.max(280, 750 - progress * 470);
}

function showRandomMole() {
  if (activeHole !== null) holes[activeHole].emojiSpan.classList.remove('up');
  if (holes.length > 1) {
    do {
      activeHole = Math.floor(Math.random() * holes.length);
    } while (activeHole === lastHole);
  } else {
    activeHole = 0;
  }
  lastHole = activeHole;
  const isBad = Math.random() < BAD_CHANCE;
  holes[activeHole].isBad = isBad;
  holes[activeHole].emojiSpan.textContent = isBad ? BAD_EMOJI : GOOD_EMOJI;
  holes[activeHole].emojiSpan.classList.add('up');

  moleTimeoutId = setTimeout(() => {
    if (!running) return;
    showRandomMole();
  }, currentInterval());
}

function whack(i) {
  if (!running) return;
  if (i === activeHole) {
    score += holes[i].isBad ? -1 : 1;
    scoreEl.textContent = score;
    holes[i].emojiSpan.classList.remove('up');
    activeHole = null;
  }
}

function startGame() {
  if (running) return;
  buildGrid(parseInt(gridSizeSelect.value, 10));
  running = true;
  score = 0;
  timeLeft = TOTAL_TIME;
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  overlay.classList.remove('visible');

  clearInterval(gameTimer);
  clearTimeout(moleTimeoutId);
  showRandomMole();
  gameTimer = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  running = false;
  clearInterval(gameTimer);
  clearTimeout(moleTimeoutId);
  holes.forEach(h => h.emojiSpan.classList.remove('up'));

  const isNewRecord = score > highScore;
  if (isNewRecord) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    highScoreEl.textContent = highScore;
  }
  finalScoreEl.textContent = `최종 점수: ${score}`;
  newRecordEl.textContent = isNewRecord ? '🎉 신기록!' : '';
  overlay.classList.add('visible');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
gridSizeSelect.addEventListener('change', () => {
  if (!running) buildGrid(parseInt(gridSizeSelect.value, 10));
});

buildGrid(parseInt(gridSizeSelect.value, 10));
