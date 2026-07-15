(function () {
  var STORAGE_KEY = 'pixelsite-theme';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function applyIcon(btn, theme) {
    btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    applyIcon(toggle, currentTheme());

    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
      applyIcon(toggle, next);
    });
  });
})();
