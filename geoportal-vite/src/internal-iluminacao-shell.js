import './internal-iluminacao-shell.css';

const modules = [
  {
    name: 'Inicio',
    description: 'Resumo futuro por permissoes',
    state: 'planejado'
  },
  {
    name: 'Iluminacao Publica',
    description: 'Primeiro modulo interno',
    state: 'ativo'
  },
  {
    name: 'Alvaras',
    description: 'Modulo futuro',
    state: 'planejado'
  },
  {
    name: 'Viabilidade',
    description: 'Modulo futuro',
    state: 'planejado'
  },
  {
    name: 'Meio Ambiente',
    description: 'Modulo futuro',
    state: 'planejado'
  },
  {
    name: 'Limpeza de Lotes',
    description: 'Modulo futuro',
    state: 'planejado'
  },
  {
    name: 'Administracao do Sistema',
    description: 'Area futura restrita',
    state: 'restrito'
  }
];

const statusOptions = [
  'aberta',
  'em_triagem',
  'encaminhada',
  'em_execucao',
  'aguardando_material',
  'nao_localizado',
  'resolvida',
  'indeferida',
  'cancelada'
];

const summaryCards = [
  {
    label: 'Chamados abertos',
    value: '--',
    module: 'Iluminacao Publica',
    note: 'Pendente de integracao autenticada'
  },
  {
    label: 'Em execucao',
    value: '--',
    module: 'Iluminacao Publica',
    note: 'Sem dados reais nesta fase'
  },
  {
    label: 'Pendentes ou atrasados',
    value: '--',
    module: 'Resumo futuro',
    note: 'Dashboard fora da Fase 2A'
  },
  {
    label: 'Modulos permitidos',
    value: '--',
    module: 'Permissoes futuras',
    note: 'Menu real sera filtrado pelo backend'
  }
];

const authStates = [
  {
    title: 'Sessao nao verificada',
    text: 'Estado visual inicial da shell. Nenhuma chamada a /api/internal/auth/me e feita.'
  },
  {
    title: 'Nao autenticado',
    text: 'Mensagem futura para orientar login interno sem revelar detalhes tecnicos.'
  },
  {
    title: 'Autenticado',
    text: 'Estado futuro apos sessao valida, ainda dependente de permissao por modulo.'
  },
  {
    title: 'Sem permissao',
    text: 'Menus e botoes podem ser ocultados, mas a decisao real permanece no backend.'
  },
  {
    title: 'Sessao expirada',
    text: 'Estado futuro para solicitar novo login sem expor cookie, token ou segredo.'
  },
  {
    title: 'Erro tecnico seguro',
    text: 'Mensagem amigavel futura, sem SQL, stack trace, role ou configuracao sensivel.'
  }
];

const nextSteps = [
  'Evoluir a shell visual multi-modulo sem API real.',
  'Integrar login e sessao em fase propria.',
  'Conectar listagem interna somente apos sessao/permissao.',
  'Habilitar observacoes e status apenas em fases autenticadas.',
  'Planejar dashboard, mapa operacional e proxy separadamente.'
];

const outOfScope = [
  'login real, cookie ou token',
  'chamadas para /api/internal',
  'POST, PATCH ou qualquer acao mutavel',
  'dashboard, estatisticas e endpoints agregados',
  'mapa operacional interno',
  'anexos e upload de fotos',
  'correcao ou reversao administrativa',
  'proxy, Apache ou producao interna'
];

function renderModuleMenu() {
  return modules
    .map((module) => {
      const stateLabel = module.state === 'ativo'
        ? 'Ativo'
        : module.state === 'restrito'
          ? 'Restrito'
          : 'Planejado';

      return `
        <button
          type="button"
          class="internal-module-button ${module.state === 'ativo' ? 'is-active' : ''}"
          ${module.state === 'ativo' ? 'aria-current="page"' : 'disabled'}
        >
          <span>
            <strong>${module.name}</strong>
            <small>${module.description}</small>
          </span>
          <em>${stateLabel}</em>
        </button>
      `;
    })
    .join('');
}

function renderSummaryCards() {
  return summaryCards
    .map((card) => `
      <article class="internal-summary-card">
        <span>${card.module}</span>
        <strong>${card.value}</strong>
        <h3>${card.label}</h3>
        <p>${card.note}</p>
      </article>
    `)
    .join('');
}

function renderStatusOptions() {
  return statusOptions
    .map((status) => `<option value="${status}">${status}</option>`)
    .join('');
}

function renderList(items) {
  return items.map((item) => `<li>${item}</li>`).join('');
}

function renderAuthStates() {
  return authStates
    .map((state) => `
      <article class="internal-state-card">
        <h3>${state.title}</h3>
        <p>${state.text}</p>
      </article>
    `)
    .join('');
}

function renderInternalIluminacaoShell(root) {
  root.innerHTML = `
    <main class="internal-page" aria-labelledby="internal-page-title">
      <header class="internal-topbar">
        <div>
          <p class="internal-kicker">Homologacao / Shell visual</p>
          <h1 id="internal-page-title">Geoportal Interno</h1>
          <p class="internal-subtitle">
            Portal municipal multi-modulo. Iluminacao Publica e o primeiro modulo ativo nesta fase estrutural.
          </p>
        </div>
        <aside class="internal-session-box" aria-label="Estado visual de sessao">
          <span>Estado visual</span>
          <strong>Sessao nao verificada</strong>
          <p>Sem login real, cookie, token ou consulta de sessao.</p>
        </aside>
      </header>

      <section class="internal-alert" aria-label="Aviso de seguranca">
        <strong>Fase 2A:</strong>
        shell visual multi-modulo, sem API real, sem login real, sem cookie/token e sem POST/PATCH. Permissoes reais serao validadas pelo backend.
      </section>

      <div class="internal-shell-layout">
        <aside class="internal-sidebar" aria-label="Menu planejado de modulos">
          <div class="internal-sidebar-heading">
            <h2>Modulos</h2>
            <p>Visibilidade futura por permissoes efetivas.</p>
          </div>
          <nav class="internal-module-nav" aria-label="Modulos planejados">
            ${renderModuleMenu()}
          </nav>
        </aside>

        <section class="internal-content" aria-label="Conteudo do modulo ativo">
          <section class="internal-hero-panel" aria-labelledby="active-module-title">
            <div>
              <p class="internal-kicker">Modulo ativo</p>
              <h2 id="active-module-title">Iluminacao Publica</h2>
              <p>
                Base visual para listagem, detalhe, historico, observacoes e alteracao normal de status em fases futuras autenticadas.
              </p>
            </div>
            <div class="internal-safety-list" aria-label="Controles mantidos nesta fase">
              <span>Sem /api/internal</span>
              <span>Sem /auth/me</span>
              <span>Sem POST/PATCH</span>
              <span>Sem dados reais</span>
            </div>
          </section>

          <section class="internal-summary" aria-labelledby="summary-title">
            <div class="internal-section-heading">
              <h2 id="summary-title">Inicio / Resumo futuro</h2>
              <p>Cards planejados por modulo. Valores usam marcador estrutural e nao representam dados reais.</p>
            </div>
            <div class="internal-summary-grid">
              ${renderSummaryCards()}
            </div>
          </section>

          <section class="internal-module-workspace" aria-labelledby="module-workspace-title">
            <div class="internal-section-heading">
              <h2 id="module-workspace-title">Operacao planejada de Iluminacao</h2>
              <p>Controles desabilitados ate integracao com sessao, permissoes e endpoints internos.</p>
            </div>

            <div class="internal-workspace">
              <aside class="internal-filters" aria-labelledby="filters-title">
                <h3 id="filters-title">Filtros planejados</h3>
                <label>
                  Protocolo
                  <input type="text" placeholder="IP-AAAA-NNNNNN" disabled />
                </label>
                <label>
                  Status
                  <select disabled>
                    <option value="">Todos</option>
                    ${renderStatusOptions()}
                  </select>
                </label>
                <label>
                  Tipo
                  <input type="text" placeholder="lampada_apagada" disabled />
                </label>
                <label>
                  Prioridade
                  <input type="text" placeholder="normal" disabled />
                </label>
                <label>
                  Poste
                  <input type="text" placeholder="ID do poste" disabled />
                </label>
                <div class="internal-filter-grid">
                  <label>
                    Criado de
                    <input type="date" disabled />
                  </label>
                  <label>
                    Criado ate
                    <input type="date" disabled />
                  </label>
                </div>
                <button type="button" disabled>Aplicar filtros em fase futura</button>
              </aside>

              <section class="internal-main-panel" aria-label="Solicitacoes internas">
                <div class="internal-panel-header">
                  <div>
                    <h3>Solicitacoes</h3>
                    <p>Espaco reservado para items, total, limit e offset dos endpoints internos ja validados.</p>
                  </div>
                  <span class="internal-pill">Sem fetch nesta fase</span>
                </div>

                <div class="internal-table-shell" role="table" aria-label="Lista estrutural sem dados reais">
                  <div class="internal-table-row internal-table-head" role="row">
                    <span>Protocolo</span>
                    <span>Status</span>
                    <span>Tipo</span>
                    <span>Poste</span>
                    <span>Atualizacao</span>
                  </div>
                  <div class="internal-table-empty" role="row">
                    Nenhum dado real carregado. A integracao com a API interna fica para fase posterior.
                  </div>
                </div>

                <div class="internal-detail-grid">
                  <article class="internal-card">
                    <h3>Detalhe da solicitacao</h3>
                    <p>
                      Futuro painel para protocolo, localizacao, descricao, solicitante, coordenadas WGS84 e status atual.
                    </p>
                    <dl>
                      <div>
                        <dt>Origem</dt>
                        <dd>Aguardando API interna</dd>
                      </div>
                      <div>
                        <dt>Localizacao</dt>
                        <dd>Latitude/longitude futuras</dd>
                      </div>
                      <div>
                        <dt>Dados pessoais</dt>
                        <dd>Somente quando necessario ao fluxo interno</dd>
                      </div>
                    </dl>
                  </article>

                  <article class="internal-card">
                    <h3>Historico</h3>
                    <p>
                      Leitura futura dos eventos auditados. A consulta publica nao deve exibir historico interno.
                    </p>
                    <ol class="internal-timeline">
                      <li>Eventos aparecerao aqui apos integracao autenticada.</li>
                    </ol>
                  </article>

                  <article class="internal-card">
                    <h3>Observacoes internas</h3>
                    <p>
                      Leitura e criacao serao habilitadas depois, usando permissao e header mutavel no backend.
                    </p>
                    <textarea disabled placeholder="Criacao de observacao desabilitada nesta shell"></textarea>
                    <button type="button" disabled>Criar observacao em fase futura</button>
                  </article>

                  <article class="internal-card">
                    <h3>Alteracao normal de status</h3>
                    <p>
                      A tela futura deve orientar a operacao, mas a matriz de transicoes continua validada no backend.
                    </p>
                    <select disabled>
                      ${renderStatusOptions()}
                    </select>
                    <textarea disabled placeholder="Observacao obrigatoria no PATCH real"></textarea>
                    <button type="button" disabled>Alterar status em fase futura</button>
                  </article>
                </div>
              </section>
            </div>
          </section>

          <section class="internal-states" aria-labelledby="states-title">
            <div class="internal-section-heading">
              <h2 id="states-title">Estados de autenticacao planejados</h2>
              <p>Estados visuais para UX futura. Nenhum deles controla fluxo real nesta fase.</p>
            </div>
            <div class="internal-state-grid">
              ${renderAuthStates()}
            </div>
          </section>

          <section class="internal-next" aria-labelledby="next-title">
            <article>
              <h2 id="next-title">Proximas integracoes</h2>
              <ol>${renderList(nextSteps)}</ol>
            </article>
            <article>
              <h2>Fora da Fase 2A</h2>
              <ul>${renderList(outOfScope)}</ul>
            </article>
          </section>
        </section>
      </div>

      <footer class="internal-footer">
        Geoportal publico preservado. Menus futuros serao filtrados por permissoes efetivas e a seguranca real permanecera no backend.
      </footer>
    </main>
  `;
}

const root = document.getElementById('internal-iluminacao-root');

if (root) {
  renderInternalIluminacaoShell(root);
}
