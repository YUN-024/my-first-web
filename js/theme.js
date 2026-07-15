(function () {
  const stored = localStorage.getItem('pixel-site-theme');
  const initial = stored || 'dark';
  document.documentElement.setAttribute('data-theme', initial);

  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const update = () => {
      const t = document.documentElement.getAttribute('data-theme');
      btn.textContent = t === 'dark' ? 'LIGHT' : 'DARK';
    };
    update();
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pixel-site-theme', next);
      update();
    });
  });
})();
