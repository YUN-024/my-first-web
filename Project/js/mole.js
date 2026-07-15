const grid = document.getElementById('mole-grid');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const resultEl = document.getElementById('result');
const startBtn = document.getElementById('start-btn');

const HOLE_COUNT = 9;
let holes = [];
let score = 0;
let timeLeft = 30;
let gameTimer = null;
let moleTimer = null;
let activeHole = null;
let running = false;

for (let i = 0; i < HOLE_COUNT; i++) {
  const hole = document.createElement('div');
  hole.className = 'hole';
  const mole = document.createElement('div');
  mole.className = 'mole';
  mole.style.display = 'none';
  hole.appendChild(mole);
  hole.addEventListener('click', () => whack(i));
  grid.appendChild(hole);
  holes.push({ el: hole, mole });
}

function showRandomMole() {
  if (activeHole !== null) holes[activeHole].mole.style.display = 'none';
  activeHole = Math.floor(Math.random() * HOLE_COUNT);
  holes[activeHole].mole.style.display = 'block';
}

function whack(i) {
  if (!running) return;
  if (i === activeHole) {
    score++;
    scoreEl.textContent = score;
    holes[i].mole.style.display = 'none';
    activeHole = null;
  }
}

function startGame() {
  if (running) return;
  running = true;
  score = 0;
  timeLeft = 30;
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  resultEl.textContent = '';

  moleTimer = setInterval(showRandomMole, 700);
  gameTimer = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  running = false;
  clearInterval(gameTimer);
  clearInterval(moleTimer);
  holes.forEach(h => h.mole.style.display = 'none');
  resultEl.textContent = `게임 종료! 최종 점수: ${score}`;
}

startBtn.addEventListener('click', startGame);
