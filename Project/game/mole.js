(function () {
  var HOLE_COUNT = 9;
  var GAME_DURATION = 30;
  var HIGH_SCORE_KEY = 'pixelsite-highscore';

  var score = 0;
  var timeLeft = GAME_DURATION;
  var gameActive = false;
  var highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  var moleTimeoutId = null;
  var despawnTimeoutId = null;
  var countdownIntervalId = null;
  var activeHoleIndex = null;

  var scoreEl, timeLeftEl, highScoreEl, moleGrid, overlay, finalScoreEl, newRecordEl, startBtn, restartBtn;
  var holes = [];

  function buildGrid() {
    for (var i = 0; i < HOLE_COUNT; i++) {
      var hole = document.createElement('div');
      hole.className = 'hole';
      var mole = document.createElement('div');
      mole.className = 'mole';
      hole.appendChild(mole);
      hole.addEventListener('click', (function (index) {
        return function () {
          handleHoleClick(index);
        };
      })(i));
      moleGrid.appendChild(hole);
      holes.push(mole);
    }
  }

  function handleHoleClick(index) {
    if (!gameActive) return;
    var mole = holes[index];
    if (mole.classList.contains('up')) {
      score++;
      mole.classList.remove('up');
      activeHoleIndex = null;
      scoreEl.textContent = score;
    }
  }

  function scheduleNextMole() {
    var delay = 500 + Math.random() * 700;
    moleTimeoutId = setTimeout(function () {
      spawnMole();
      scheduleNextMole();
    }, delay);
  }

  function spawnMole() {
    var index;
    do {
      index = Math.floor(Math.random() * HOLE_COUNT);
    } while (index === activeHoleIndex && HOLE_COUNT > 1);

    if (activeHoleIndex !== null) {
      holes[activeHoleIndex].classList.remove('up');
    }
    activeHoleIndex = index;
    holes[index].classList.add('up');

    clearTimeout(despawnTimeoutId);
    var upDuration = 700 + Math.random() * 300;
    despawnTimeoutId = setTimeout(function () {
      holes[index].classList.remove('up');
      if (activeHoleIndex === index) activeHoleIndex = null;
    }, upDuration);
  }

  function tick() {
    timeLeft--;
    timeLeftEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      endGame();
    }
  }

  function startGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    gameActive = true;
    activeHoleIndex = null;
    scoreEl.textContent = score;
    timeLeftEl.textContent = timeLeft;
    overlay.classList.remove('visible');
    holes.forEach(function (m) { m.classList.remove('up'); });

    clearInterval(countdownIntervalId);
    clearTimeout(moleTimeoutId);
    clearTimeout(despawnTimeoutId);

    countdownIntervalId = setInterval(tick, 1000);
    scheduleNextMole();
  }

  function endGame() {
    gameActive = false;
    clearInterval(countdownIntervalId);
    clearTimeout(moleTimeoutId);
    clearTimeout(despawnTimeoutId);
    holes.forEach(function (m) { m.classList.remove('up'); });

    var isNewRecord = score > highScore;
    if (isNewRecord) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    }
    highScoreEl.textContent = highScore;

    finalScoreEl.textContent = '최종 점수: ' + score;
    newRecordEl.textContent = isNewRecord ? '🎉 신기록!' : '';
    overlay.classList.add('visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    scoreEl = document.getElementById('score');
    timeLeftEl = document.getElementById('time-left');
    highScoreEl = document.getElementById('high-score');
    moleGrid = document.getElementById('mole-grid');
    overlay = document.getElementById('game-overlay');
    finalScoreEl = document.getElementById('final-score');
    newRecordEl = document.getElementById('new-record');
    startBtn = document.getElementById('start-btn');
    restartBtn = document.getElementById('restart-btn');

    highScoreEl.textContent = highScore;

    buildGrid();

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
  });
})();
