const STORAGE_KEY = 'geoportal-initial-notices-dismissed';

function wasDismissedInSession() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissedInSession() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // no-op
  }
}

function renderTutorialLink(href) {
  if (!href || href === '#') {
    return `<a href="#" class="welcome-notice-link is-disabled" aria-disabled="true" data-disabled-tutorial="true">Assistir tutorial</a>`;
  }

  return `<a href="${href}" class="welcome-notice-link" target="_blank" rel="noopener noreferrer">Assistir tutorial</a>`;
}

export function setupWelcomeNotices({
  tutorialLinks = {},
  onActivateLighting,
  onActivateFarmacia
} = {}) {
  if (wasDismissedInSession()) return;

  const links = {
    main: '#',
    ...tutorialLinks
  };

  const tutorialHref = links.main || '#';

  const overlay = document.createElement('div');
  overlay.className = 'welcome-notice-overlay';
  overlay.innerHTML = `
    <div class="welcome-notice-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-notice-title">
      <div class="welcome-notice-header">
        <div>
          <h2 id="welcome-notice-title">Serviços no Geoportal</h2>
          <p>O Geoportal também ajuda no dia a dia com serviços úteis para a população.</p>
        </div>
        <button type="button" class="welcome-notice-close" aria-label="Fechar aviso">&times;</button>
      </div>

      <div class="welcome-notice-cards">
        <section class="welcome-notice-card">
          <span class="welcome-notice-badge">Iluminação pública</span>
          <p>
            Agora você pode solicitar manutenção da iluminação pública pelo Geoportal:
          </p>
          <ul class="welcome-notice-list">
            <li>Ative <strong>Postes da Rede Elétrica</strong>.</li>
            <li>Se estiver no celular, toque no botão de <strong>localização</strong>.</li>
            <li>Toque no poste com problema no mapa.</li>
            <li>Clique em <strong>Solicitar Reparo</strong> para abrir o formulário.</li>
          </ul>
          <div class="welcome-notice-actions">
            <button type="button" class="welcome-notice-primary" data-action="lighting">Ativar Postes</button>
          </div>
        </section>

        <section class="welcome-notice-card">
          <span class="welcome-notice-badge">Farmácia de plantão</span>
          <p>
            Veja rapidamente qual é a farmácia de plantão do dia:
          </p>
          <ul class="welcome-notice-list">
            <li>Clique em <strong>Ver Farmácia de Plantão</strong>.</li>
            <li>O mapa será ajustado automaticamente.</li>
          </ul>
          <div class="welcome-notice-actions">
            <button type="button" class="welcome-notice-primary is-secondary" data-action="farmacia">Ver Farmácia de Plantão</button>
          </div>
        </section>
      </div>

      <div class="welcome-notice-footer">
        ${renderTutorialLink(tutorialHref)}
        <button type="button" class="welcome-notice-muted" data-action="close">Fechar e continuar</button>
      </div>
    </div>
  `;

  const close = () => {
    markDismissedInSession();
    overlay.remove();
  };

  overlay.querySelector('.welcome-notice-close').addEventListener('click', close);
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll('[data-disabled-tutorial="true"]').forEach((link) => {
    link.addEventListener('click', (e) => e.preventDefault());
  });

  overlay.querySelector('[data-action="lighting"]').addEventListener('click', () => {
    onActivateLighting?.();
    close();
  });

  overlay.querySelector('[data-action="farmacia"]').addEventListener('click', () => {
    onActivateFarmacia?.();
    close();
  });

  document.body.appendChild(overlay);
}
