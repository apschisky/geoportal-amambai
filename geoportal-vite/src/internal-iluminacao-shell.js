import './internal-iluminacao-shell.css';

const AUTH_ME_ENDPOINT = '/api/internal/auth/me';
const AUTH_LOGIN_ENDPOINT = '/api/internal/auth/login';

const SESSION_STATES = {
  checking_session: {
    label: 'Verificando sessao',
    title: 'Sessao em verificacao',
    text: 'A shell esta consultando apenas /api/internal/auth/me com cookie de sessao, se existir.',
    tone: 'checking'
  },
  unauthenticated: {
    label: 'Nao autenticado',
    title: 'Login interno necessario',
    text: 'Nao foi confirmada uma sessao interna valida. Use o formulario interno para autenticar em homologacao.',
    tone: 'neutral'
  },
  authenticated: {
    label: 'Autenticado',
    title: 'Sessao interna confirmada',
    text: 'Permissoes efetivas foram carregadas pelo backend e usadas somente para orientar a interface.',
    tone: 'success'
  },
  forbidden: {
    label: 'Sem permissao',
    title: 'Acesso negado',
    text: 'A sessao foi reconhecida, mas o recurso consultado retornou acesso negado.',
    tone: 'warning'
  },
  expired: {
    label: 'Sessao expirada',
    title: 'Sessao expirada ou invalida',
    text: 'Quando o backend nao permitir diferenciar com seguranca, este estado e tratado como nao autenticado.',
    tone: 'neutral'
  },
  technical_error: {
    label: 'Erro tecnico seguro',
    title: 'Servico interno indisponivel',
    text: 'A verificacao de sessao nao foi concluida. Nenhum detalhe tecnico sensivel e exibido.',
    tone: 'danger'
  }
};

const PERMISSIONS = {
  iluminacaoRead: 'iluminacao.solicitacoes.ler',
  iluminacaoHistory: 'iluminacao.solicitacoes.ver_historico',
  iluminacaoObservations: 'iluminacao.solicitacoes.ver_observacoes',
  iluminacaoComment: 'iluminacao.solicitacoes.comentar',
  iluminacaoStatus: 'iluminacao.solicitacoes.atualizar_status',
  adminUsersRead: 'admin.usuarios.ler',
  adminProfilesRead: 'admin.perfis.ler',
  adminPermissionsRead: 'admin.permissoes.ler'
};

const plannedModules = [
  {
    key: 'inicio',
    name: 'Inicio',
    description: 'Resumo futuro por permissoes',
    kind: 'planned'
  },
  {
    key: 'iluminacao',
    name: 'Iluminacao Publica',
    description: 'Primeiro modulo interno',
    kind: 'permission',
    permissions: [PERMISSIONS.iluminacaoRead]
  },
  {
    key: 'alvaras',
    name: 'Alvaras',
    description: 'Modulo futuro',
    kind: 'planned'
  },
  {
    key: 'viabilidade',
    name: 'Viabilidade',
    description: 'Modulo futuro',
    kind: 'planned'
  },
  {
    key: 'meio_ambiente',
    name: 'Meio Ambiente',
    description: 'Modulo futuro',
    kind: 'planned'
  },
  {
    key: 'limpeza_lotes',
    name: 'Limpeza de Lotes',
    description: 'Modulo futuro',
    kind: 'planned'
  },
  {
    key: 'admin',
    name: 'Administracao do Sistema',
    description: 'Area restrita planejada',
    kind: 'admin',
    permissions: [
      PERMISSIONS.adminUsersRead,
      PERMISSIONS.adminProfilesRead,
      PERMISSIONS.adminPermissionsRead
    ]
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
    note: 'Pendente de integracao com listagem'
  },
  {
    label: 'Em execucao',
    value: '--',
    module: 'Iluminacao Publica',
    note: 'Sem dados operacionais nesta fase'
  },
  {
    label: 'Pendentes ou atrasados',
    value: '--',
    module: 'Resumo futuro',
    note: 'Dashboard fora desta fase'
  },
  {
    label: 'Modulos permitidos',
    value: '--',
    module: 'Permissoes carregadas',
    note: 'Menu deriva permissoes, sem dados reais'
  }
];

const authStates = [
  {
    key: 'checking_session',
    title: 'Verificando sessao',
    text: 'Chamada unica permitida: GET /api/internal/auth/me com credentials include.'
  },
  {
    key: 'unauthenticated',
    title: 'Nao autenticado',
    text: 'Mostra formulario interno minimo e chama apenas POST /api/internal/auth/login.'
  },
  {
    key: 'authenticated',
    title: 'Autenticado',
    text: 'Usa usuario_id e permissoes retornadas para orientar o menu.'
  },
  {
    key: 'forbidden',
    title: 'Sem permissao',
    text: 'Frontend orienta a UX, mas o bloqueio real continua no backend.'
  },
  {
    key: 'expired',
    title: 'Sessao expirada',
    text: 'Tratada de forma segura como sessao ausente quando nao houver distincao.'
  },
  {
    key: 'technical_error',
    title: 'Erro tecnico seguro',
    text: 'Mantem a tela renderizada sem expor detalhes internos.'
  }
];

const futureCapabilities = [
  {
    permission: PERMISSIONS.iluminacaoHistory,
    label: 'Historico'
  },
  {
    permission: PERMISSIONS.iluminacaoObservations,
    label: 'Observacoes'
  },
  {
    permission: PERMISSIONS.iluminacaoComment,
    label: 'Comentar'
  },
  {
    permission: PERMISSIONS.iluminacaoStatus,
    label: 'Alterar status'
  }
];

const nextSteps = [
  'Validar login visual minimo com cookie HttpOnly e /api/internal/auth/me.',
  'Integrar listagem interna somente depois de login, sessao e permissao validados.',
  'Conectar detalhe, historico e observacoes em fases separadas.',
  'Habilitar POST/PATCH apenas em fases autenticadas e testadas.',
  'Planejar dashboard, mapa operacional e proxy separadamente.'
];

const outOfScope = [
  'logout completo',
  'token manual, localStorage ou sessionStorage',
  'chamadas para /api/internal/iluminacao/solicitacoes',
  'POST/PATCH de Iluminacao ou qualquer acao operacional',
  'dashboard, estatisticas e mapa operacional',
  'proxy, Apache ou producao interna'
];

const initialSessionState = {
  sessionState: 'checking_session',
  usuarioId: null,
  permissions: [],
  statusCode: null,
  message: 'Verificando sessao interna existente.',
  hasChecked: false,
  loginStatus: 'idle',
  loginMessage: '',
  loginValue: ''
};

function createSessionState(overrides = {}) {
  return {
    sessionState: 'checking_session',
    usuarioId: null,
    permissions: [],
    statusCode: null,
    message: 'Verificando sessao interna existente.',
    hasChecked: false,
    loginStatus: 'idle',
    loginMessage: '',
    loginValue: '',
    ...overrides
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function hasPermission(state, permission) {
  return state.permissions.includes(permission);
}

function hasAnyPermission(state, permissions) {
  return permissions.some((permission) => hasPermission(state, permission));
}

function getAllowedModules(state) {
  if (state.sessionState !== 'authenticated') {
    return [];
  }

  return plannedModules
    .filter((module) => {
      if (module.kind === 'permission' || module.kind === 'admin') {
        return hasAnyPermission(state, module.permissions);
      }

      return false;
    })
    .map((module) => module.name);
}

function normalizePermission(permission) {
  return permission.trim().toLowerCase();
}

function normalizePermissions(permissions) {
  return Array.from(
    new Set(permissions.map(normalizePermission).filter(Boolean))
  ).sort();
}

function isValidMePayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && typeof payload.authenticated === 'boolean'
      && Number.isInteger(payload.usuario_id)
      && Array.isArray(payload.permissoes)
      && payload.permissoes.every((permission) => typeof permission === 'string')
  );
}

function getModuleView(module, state) {
  if (module.kind === 'permission') {
    if (state.sessionState === 'checking_session') {
      return {
        state: 'checking',
        label: 'Verificando',
        enabled: false,
        active: false
      };
    }

    if (state.sessionState !== 'authenticated') {
      return {
        state: 'locked',
        label: 'Aguardando sessao',
        enabled: false,
        active: false
      };
    }

    const allowed = hasAnyPermission(state, module.permissions);

    return {
      state: allowed ? 'allowed' : 'denied',
      label: allowed ? 'Permitido' : 'Sem permissao',
      enabled: allowed,
      active: allowed
    };
  }

  if (module.kind === 'admin') {
    const allowed = state.sessionState === 'authenticated'
      && hasAnyPermission(state, module.permissions);

    return {
      state: allowed ? 'allowed' : 'restricted',
      label: allowed ? 'Permitido' : 'Restrito',
      enabled: false,
      active: false
    };
  }

  return {
    state: 'planned',
    label: 'Planejado',
    enabled: false,
    active: false
  };
}

function getIluminacaoAccessMessage(state) {
  if (state.sessionState === 'checking_session') {
    return 'Verificando permissao para o modulo Iluminacao Publica.';
  }

  if (state.sessionState === 'authenticated') {
    if (hasPermission(state, PERMISSIONS.iluminacaoRead)) {
      return 'Permissao iluminacao.solicitacoes.ler confirmada. A listagem real ainda nao e carregada nesta fase.';
    }

    return 'Sessao confirmada, mas sem permissao iluminacao.solicitacoes.ler para operar o modulo Iluminacao.';
  }

  if (state.sessionState === 'forbidden') {
    return 'O backend retornou acesso negado para a verificacao solicitada.';
  }

  if (state.sessionState === 'technical_error') {
    return 'Nao foi possivel confirmar a sessao. A shell permanece visivel e sem dados reais.';
  }

  return 'Sessao interna nao confirmada. Login real sera tratado em fase propria.';
}

function renderModuleMenu(state) {
  return plannedModules
    .map((module) => {
      const view = getModuleView(module, state);
      const classes = [
        'internal-module-button',
        `is-${view.state}`,
        view.active ? 'is-active' : ''
      ].filter(Boolean).join(' ');
      const ariaCurrent = view.active ? 'aria-current="page"' : '';
      const disabled = view.enabled ? '' : 'disabled';

      return `
        <button
          type="button"
          class="${classes}"
          ${ariaCurrent}
          ${disabled}
        >
          <span>
            <strong>${escapeHtml(module.name)}</strong>
            <small>${escapeHtml(module.description)}</small>
          </span>
          <em>${escapeHtml(view.label)}</em>
        </button>
      `;
    })
    .join('');
}

function renderSummaryCards() {
  return summaryCards
    .map((card) => `
      <article class="internal-summary-card">
        <span>${escapeHtml(card.module)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <h3>${escapeHtml(card.label)}</h3>
        <p>${escapeHtml(card.note)}</p>
      </article>
    `)
    .join('');
}

function renderStatusOptions() {
  return statusOptions
    .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`)
    .join('');
}

function renderList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderAuthStates(state) {
  return authStates
    .map((authState) => {
      const currentClass = authState.key === state.sessionState ? ' is-current' : '';

      return `
        <article class="internal-state-card${currentClass}">
          <h3>${escapeHtml(authState.title)}</h3>
          <p>${escapeHtml(authState.text)}</p>
        </article>
      `;
    })
    .join('');
}

function renderCapabilityIndicators(state) {
  return futureCapabilities
    .map((capability) => {
      const allowed = hasPermission(state, capability.permission);
      const label = allowed ? 'Permissao carregada' : 'Nao carregada';

      return `
        <span class="internal-capability ${allowed ? 'is-allowed' : 'is-missing'}">
          <strong>${escapeHtml(capability.label)}</strong>
          <small>${escapeHtml(label)}</small>
        </span>
      `;
    })
    .join('');
}

function renderPermissionSummary(state) {
  if (state.sessionState !== 'authenticated') {
    return `
      <p>Permissoes ainda nao carregadas.</p>
      <p class="internal-muted-note">
        A lista tecnica completa nao e exibida na interface comum.
      </p>
    `;
  }

  const allowedModules = getAllowedModules(state);
  const modulesText = allowedModules.length > 0
    ? allowedModules.join(', ')
    : 'Nenhum modulo operacional permitido';

  return `
    <dl class="internal-safe-summary">
      <div>
        <dt>Sessao</dt>
        <dd>Autenticada</dd>
      </div>
      <div>
        <dt>Usuario</dt>
        <dd>#${escapeHtml(state.usuarioId)}</dd>
      </div>
      <div>
        <dt>Permissoes carregadas</dt>
        <dd>${escapeHtml(state.permissions.length)}</dd>
      </div>
      <div>
        <dt>Modulos permitidos</dt>
        <dd>${escapeHtml(modulesText)}</dd>
      </div>
    </dl>
    <p class="internal-muted-note">
      A interface usa permissoes apenas para orientar a navegacao. A autorizacao real continua no backend.
    </p>
  `;
}

function renderLoginPanel(state) {
  if (state.sessionState !== 'unauthenticated') {
    return '';
  }

  const isSubmitting = state.loginStatus === 'submitting';
  const statusClass = state.loginStatus === 'error' ? ' is-error' : '';
  const message = state.loginMessage
    || 'Informe suas credenciais internas de homologacao. O token retornado pelo backend sera ignorado pela shell.';

  return `
    <section class="internal-login-panel" aria-labelledby="internal-login-title">
      <div>
        <p class="internal-kicker">Area restrita</p>
        <h2 id="internal-login-title">Login interno</h2>
        <p>
          O Geoportal publico permanece separado. Esta autenticacao acontece apenas dentro da shell interna.
        </p>
      </div>
      <form class="internal-login-form" data-internal-login-form>
        <label>
          Login
          <input
            name="login"
            type="text"
            autocomplete="username"
            value="${escapeHtml(state.loginValue || '')}"
            required
            ${isSubmitting ? 'disabled' : ''}
          />
        </label>
        <label>
          Senha
          <input
            name="senha"
            type="password"
            autocomplete="current-password"
            required
            ${isSubmitting ? 'disabled' : ''}
          />
        </label>
        <p class="internal-login-message${statusClass}" role="status">
          ${escapeHtml(message)}
        </p>
        <button type="submit" ${isSubmitting ? 'disabled' : ''}>
          ${isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </section>
  `;
}

function renderSessionBox(state) {
  const stateInfo = SESSION_STATES[state.sessionState] || SESSION_STATES.technical_error;
  const userText = state.sessionState === 'authenticated'
    ? `Usuario interno #${state.usuarioId}`
    : stateInfo.title;
  const statusText = state.statusCode ? `HTTP ${state.statusCode}` : 'Sem status HTTP';

  return `
    <aside class="internal-session-box is-${stateInfo.tone}" aria-label="Estado de sessao">
      <span>${escapeHtml(stateInfo.label)}</span>
      <strong>${escapeHtml(userText)}</strong>
      <p>${escapeHtml(state.message || stateInfo.text)}</p>
      <small>${escapeHtml(statusText)}</small>
    </aside>
  `;
}

function renderInternalIluminacaoShell(root, state) {
  const stateInfo = SESSION_STATES[state.sessionState] || SESSION_STATES.technical_error;
  const canReadIluminacao = hasPermission(state, PERMISSIONS.iluminacaoRead);

  root.innerHTML = `
    <main class="internal-page" aria-labelledby="internal-page-title">
      <header class="internal-topbar">
        <div>
          <p class="internal-kicker">Homologacao / Integracao de sessao</p>
          <h1 id="internal-page-title">Geoportal Interno</h1>
          <p class="internal-subtitle">
            Portal municipal multi-modulo. Esta fase consulta apenas a sessao existente em /api/internal/auth/me.
          </p>
        </div>
        ${renderSessionBox(state)}
      </header>

      <section class="internal-alert is-${stateInfo.tone}" aria-label="Aviso de seguranca">
        <strong>${escapeHtml(stateInfo.title)}:</strong>
        ${escapeHtml(stateInfo.text)}
      </section>

      ${renderLoginPanel(state)}

      <div class="internal-shell-layout">
        <aside class="internal-sidebar" aria-label="Menu de modulos por permissao">
          <div class="internal-sidebar-heading">
            <h2>Modulos</h2>
            <p>Menu derivado das permissoes efetivas retornadas pelo backend.</p>
          </div>
          <nav class="internal-module-nav" aria-label="Modulos planejados">
            ${renderModuleMenu(state)}
          </nav>
        </aside>

        <section class="internal-content" aria-label="Conteudo do modulo ativo">
          <section class="internal-hero-panel" aria-labelledby="active-module-title">
            <div>
              <p class="internal-kicker">Modulo Iluminacao</p>
              <h2 id="active-module-title">Iluminacao Publica</h2>
              <p>${escapeHtml(getIluminacaoAccessMessage(state))}</p>
            </div>
            <div class="internal-safety-list" aria-label="Controles mantidos nesta fase">
              <span>GET /auth/me</span>
              <span>Credentials include</span>
              <span>Cookie HttpOnly</span>
              <span>Sem POST/PATCH</span>
            </div>
          </section>

          <section class="internal-summary" aria-labelledby="summary-title">
            <div class="internal-section-heading">
              <h2 id="summary-title">Inicio / Resumo futuro</h2>
              <p>Cards permanecem com marcador estrutural. Nenhuma listagem ou indicador operacional e carregado.</p>
            </div>
            <div class="internal-summary-grid">
              ${renderSummaryCards()}
            </div>
          </section>

          <section class="internal-auth-panel" aria-labelledby="auth-panel-title">
            <div class="internal-section-heading">
              <h2 id="auth-panel-title">Sessao e permissoes</h2>
              <p>Contrato real usado: authenticated, usuario_id e permissoes. O backend continua sendo a autoridade.</p>
            </div>
            <div class="internal-auth-grid">
              <article class="internal-card">
                <h3>Resultado da verificacao</h3>
                <dl>
                  <div>
                    <dt>Estado</dt>
                    <dd>${escapeHtml(stateInfo.label)}</dd>
                  </div>
                  <div>
                    <dt>Usuario</dt>
                    <dd>${state.usuarioId ? `#${escapeHtml(state.usuarioId)}` : 'Nao confirmado'}</dd>
                  </div>
                  <div>
                    <dt>Permissao para Iluminacao</dt>
                    <dd>${canReadIluminacao ? 'Confirmada' : 'Nao confirmada'}</dd>
                  </div>
                </dl>
                <button type="button" class="internal-secondary-action" data-action="check-session">
                  Verificar sessao novamente
                </button>
              </article>

              <article class="internal-card">
                <h3>Permissoes conhecidas</h3>
                <div class="internal-capability-grid">
                  ${renderCapabilityIndicators(state)}
                </div>
              </article>

              <article class="internal-card">
                <h3>Resumo seguro</h3>
                ${renderPermissionSummary(state)}
              </article>
            </div>
          </section>

          <section class="internal-module-workspace" aria-labelledby="module-workspace-title">
            <div class="internal-section-heading">
              <h2 id="module-workspace-title">Operacao planejada de Iluminacao</h2>
              <p>Controles continuam desabilitados. Esta fase nao consome endpoints de Iluminacao.</p>
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
                  <span class="internal-pill">Sem listagem real</span>
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
                    Nenhum dado real carregado. A fase atual consulta somente /api/internal/auth/me.
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
                        <dd>Aguardando API interna de Iluminacao</dd>
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
                      <li>Eventos aparecerao aqui apos integracao autenticada posterior.</li>
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
              <h2 id="states-title">Estados de autenticacao</h2>
              <p>O estado atual e destacado. Nenhum estado habilita acao mutavel nesta fase.</p>
            </div>
            <div class="internal-state-grid">
              ${renderAuthStates(state)}
            </div>
          </section>

          <section class="internal-next" aria-labelledby="next-title">
            <article>
              <h2 id="next-title">Proximas integracoes</h2>
              <ol>${renderList(nextSteps)}</ol>
            </article>
            <article>
              <h2>Fora desta fase</h2>
              <ul>${renderList(outOfScope)}</ul>
            </article>
          </section>
        </section>
      </div>

      <footer class="internal-footer">
        Geoportal publico preservado. Permissoes reais sao validadas no backend; esta shell nao armazena token nem executa POST/PATCH.
      </footer>
    </main>
  `;
}

async function fetchCurrentSession() {
  const response = await fetch(AUTH_ME_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return createSessionState({
      sessionState: 'unauthenticated',
      statusCode: response.status,
      message: 'Sessao ausente, expirada ou invalida. Login interno disponivel nesta shell.',
      hasChecked: true
    });
  }

  if (response.status === 403) {
    return createSessionState({
      sessionState: 'forbidden',
      statusCode: response.status,
      message: 'Acesso negado pelo backend para a verificacao de sessao.',
      hasChecked: true
    });
  }

  if (response.status === 429) {
    return createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.',
      hasChecked: true
    });
  }

  if (response.status === 503) {
    return createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Servico interno temporariamente indisponivel.',
      hasChecked: true
    });
  }

  if (!response.ok) {
    return createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Nao foi possivel verificar a sessao interna neste momento.',
      hasChecked: true
    });
  }

  const payload = await response.json();

  if (!isValidMePayload(payload)) {
    return createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Resposta de sessao em formato inesperado.',
      hasChecked: true
    });
  }

  if (payload.authenticated !== true) {
    return createSessionState({
      sessionState: 'unauthenticated',
      statusCode: response.status,
      message: 'Sessao interna nao autenticada.',
      hasChecked: true
    });
  }

  return createSessionState({
    sessionState: 'authenticated',
    usuarioId: payload.usuario_id,
    permissions: normalizePermissions(payload.permissoes),
    statusCode: response.status,
    message: 'Sessao interna confirmada por /api/internal/auth/me.',
    hasChecked: true
  });
}

async function verifySession(root) {
  renderInternalIluminacaoShell(root, initialSessionState);

  try {
    const nextState = await fetchCurrentSession();
    renderInternalIluminacaoShell(root, nextState);
  } catch {
    renderInternalIluminacaoShell(root, createSessionState({
      sessionState: 'technical_error',
      message: 'Nao foi possivel conectar ao servico interno. Isso pode ocorrer em desenvolvimento sem backend/proxy ativo.',
      hasChecked: true
    }));
  }
}

async function submitLogin(root, form) {
  const formData = new FormData(form);
  const login = String(formData.get('login') || '').trim();
  const senha = String(formData.get('senha') || '');
  const passwordInput = form.elements.senha;

  if (!login || !senha) {
    if (passwordInput instanceof HTMLInputElement) {
      passwordInput.value = '';
    }

    renderInternalIluminacaoShell(root, createSessionState({
      sessionState: 'unauthenticated',
      statusCode: null,
      message: 'Preencha login e senha para continuar.',
      hasChecked: true,
      loginStatus: 'error',
      loginMessage: 'Preencha login e senha.',
      loginValue: login
    }));
    return;
  }

  renderInternalIluminacaoShell(root, createSessionState({
    sessionState: 'unauthenticated',
    statusCode: null,
    message: 'Enviando credenciais ao endpoint interno de login.',
    hasChecked: true,
    loginStatus: 'submitting',
    loginMessage: 'Validando credenciais internas...',
    loginValue: login
  }));

  try {
    const response = await fetch(AUTH_LOGIN_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login,
        senha
      })
    });

    if (response.ok) {
      const confirmedState = await fetchCurrentSession();

      if (confirmedState.sessionState === 'authenticated') {
        renderInternalIluminacaoShell(root, confirmedState);
        return;
      }

      renderInternalIluminacaoShell(root, {
        ...confirmedState,
        sessionState: 'unauthenticated',
        loginStatus: 'error',
        loginMessage: 'Login aceito, mas a sessao nao foi confirmada. Tente novamente.',
        loginValue: login
      });
      return;
    }

    if (response.status === 401) {
      renderInternalIluminacaoShell(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: response.status,
        message: 'Credenciais nao autenticadas pelo backend.',
        hasChecked: true,
        loginStatus: 'error',
        loginMessage: 'Login ou senha invalidos.',
        loginValue: login
      }));
      return;
    }

    if (response.status === 429) {
      renderInternalIluminacaoShell(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: response.status,
        message: 'Muitas tentativas de login em pouco tempo.',
        hasChecked: true,
        loginStatus: 'error',
        loginMessage: 'Muitas tentativas. Aguarde antes de tentar novamente.',
        loginValue: login
      }));
      return;
    }

    if (response.status === 503) {
      renderInternalIluminacaoShell(root, createSessionState({
        sessionState: 'technical_error',
        statusCode: response.status,
        message: 'Servico interno temporariamente indisponivel.',
        hasChecked: true,
        loginStatus: 'error',
        loginMessage: 'Servico temporariamente indisponivel.',
        loginValue: login
      }));
      return;
    }

    renderInternalIluminacaoShell(root, createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Nao foi possivel concluir o login interno.',
      hasChecked: true,
      loginStatus: 'error',
      loginMessage: 'Nao foi possivel entrar agora.',
      loginValue: login
    }));
  } catch {
    renderInternalIluminacaoShell(root, createSessionState({
      sessionState: 'technical_error',
      statusCode: null,
      message: 'Nao foi possivel conectar ao servico interno de autenticacao.',
      hasChecked: true,
      loginStatus: 'error',
      loginMessage: 'Servico interno indisponivel no momento.',
      loginValue: login
    }));
  } finally {
    if (passwordInput instanceof HTMLInputElement) {
      passwordInput.value = '';
    }
  }
}

const root = document.getElementById('internal-iluminacao-root');

if (root) {
  verifySession(root);

  root.addEventListener('click', (event) => {
    const target = event.target;

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="check-session"]')
    ) {
      verifySession(root);
    }
  });

  root.addEventListener('submit', (event) => {
    const target = event.target;

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-internal-login-form]')
    ) {
      event.preventDefault();
      submitLogin(root, target);
    }
  });
}
