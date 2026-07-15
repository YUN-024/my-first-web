(function () {
  var STAR_COUNT = 60;
  var CLOUD_COUNT = 5;

  function createStars() {
    var container = document.getElementById('stars');
    if (!container) return;

    for (var i = 0; i < STAR_COUNT; i++) {
      var star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 70 + '%';
      var duration = 1.5 + Math.random() * 2.5;
      star.style.animationDuration = duration + 's';
      star.style.animationDelay = '-' + (Math.random() * duration) + 's';
      container.appendChild(star);
    }
  }

  function createClouds() {
    var container = document.getElementById('clouds');
    if (!container) return;

    for (var i = 0; i < CLOUD_COUNT; i++) {
      var cloud = document.createElement('div');
      cloud.className = 'cloud';
      var scale = 0.7 + Math.random() * 0.8;
      cloud.style.top = 5 + Math.random() * 55 + '%';
      cloud.style.setProperty('--cloud-scale', scale.toFixed(2));
      var duration = 22 + Math.random() * 18;
      cloud.style.animationDuration = duration + 's';
      cloud.style.animationDelay = '-' + (Math.random() * duration) + 's';
      container.appendChild(cloud);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    createStars();
    createClouds();
  });
})();
