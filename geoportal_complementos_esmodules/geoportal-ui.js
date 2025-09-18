export function setupUIHandlers() {
  function toggleExpandBox(selector) {
    if(selector === '.print-box') return;
    document.querySelectorAll(selector).forEach(box => {
      box.addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
        document.querySelectorAll(selector).forEach(other => {
          if (other !== box) other.classList.remove('expanded');
        });
        box.classList.toggle('expanded');
      });
    });
  }
  toggleExpandBox('.measurement-box');
  toggleExpandBox('.search-box');
  toggleExpandBox('.layer-controls-box');
  document.addEventListener('click', function(e) {
    const selectors = ['.measurement-box','.search-box','.layer-controls-box'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(box => {
        if (!box.contains(e.target)) {
          box.classList.remove('expanded');
        }
      });
    });
  });

  const btn = document.getElementById('fullscreen-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 180);
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }
}
