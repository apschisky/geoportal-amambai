export function showGeoportalNotice({
  type = 'info',
  message = '',
  duration = 4500,
  position = 'bottom-right',
  cooldownKey = '',
  cooldownMs = 0
} = {}) {
  if (!message) return null;

  const now = Date.now();
  if (cooldownKey && cooldownMs > 0) {
    window.__geoportalNoticeCooldowns = window.__geoportalNoticeCooldowns || {};
    const lastShown = window.__geoportalNoticeCooldowns[cooldownKey] || 0;
    if (now - lastShown < cooldownMs) return null;
    window.__geoportalNoticeCooldowns[cooldownKey] = now;
  }

  const normalizedPosition = ['bottom-right', 'top-center'].includes(position)
    ? position
    : 'bottom-right';
  const containerClass = `geoportal-notice-container geoportal-notice-container-${normalizedPosition}`;
  let container = document.querySelector(`.geoportal-notice-container-${normalizedPosition}`);
  if (!container) {
    container = document.createElement('div');
    container.className = containerClass;
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }

  const normalizedType = ['info', 'warning', 'error', 'success'].includes(type)
    ? type
    : 'info';
  const notice = document.createElement('div');
  notice.className = `geoportal-notice geoportal-notice-${normalizedType}`;
  notice.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');
  notice.textContent = message;

  container.appendChild(notice);

  window.setTimeout(() => {
    notice.classList.add('is-leaving');
    notice.addEventListener('animationend', () => notice.remove(), { once: true });
  }, duration);

  return notice;
}
