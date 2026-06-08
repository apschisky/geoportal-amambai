import './internal-iluminacao-shell.css';

const AUTH_ME_ENDPOINT = '/api/internal/auth/me';
const AUTH_LOGIN_ENDPOINT = '/api/internal/auth/login';
const INTERNAL_SOLICITACOES_ENDPOINT = '/api/internal/iluminacao/solicitacoes';
const SOLICITACOES_PAGE_SIZE = 20;

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
  'Validar listagem interna somente leitura apos login, sessao e permissao confirmados.',
  'Conectar detalhe, historico e observacoes em fases separadas.',
  'Habilitar POST/PATCH apenas em fases autenticadas e testadas.',
  'Planejar dashboard, mapa operacional e proxy separadamente.'
];

const outOfScope = [
  'logout completo',
  'token manual, localStorage ou sessionStorage',
  'detalhe, historico e observacoes de Iluminacao',
  'POST/PATCH de Iluminacao ou qualquer acao operacional',
  'dashboard, estatisticas e mapa operacional',
  'proxy, Apache ou producao interna'
];

function createSolicitacoesState(overrides = {}) {
  return {
    status: 'idle',
    items: [],
    total: 0,
    limit: SOLICITACOES_PAGE_SIZE,
    offset: 0,
    statusCode: null,
    message: 'Listagem somente leitura ainda nao carregada.',
    ...overrides
  };
}

const initialSessionState = {
  sessionState: 'checking_session',
  usuarioId: null,
  permissions: [],
  statusCode: null,
  message: 'Verificando sessao interna existente.',
  hasChecked: false,
  loginStatus: 'idle',
  loginMessage: '',
  loginValue: '',
  solicitacoes: createSolicitacoesState()
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
    solicitacoes: createSolicitacoesState(),
    ...overrides
  };
}

let currentState = createSessionState();

function renderApp(root, state) {
  currentState = {
    ...state,
    solicitacoes: state.solicitacoes || createSolicitacoesState()
  };
  renderInternalIluminacaoShell(root, currentState);
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

function isValidSolicitacoesPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Array.isArray(payload.items)
      && Number.isInteger(payload.limit)
      && Number.isInteger(payload.offset)
      && Number.isInteger(payload.total)
  );
}

function safeText(value, fallback = 'Nao informado') {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function formatDateTime(value) {
  const text = safeText(value, '');

  if (!text) {
    return 'Nao informado';
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return 'Nao informado';
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function toDisplaySolicitacao(item) {
  const safeItem = item && typeof item === 'object' ? item : {};

  return {
    protocolo: safeText(safeItem.protocolo),
    status: safeText(safeItem.status),
    tipoProblema: safeText(safeItem.tipo_problema),
    prioridade: safeText(safeItem.prioridade),
    posteId: safeText(safeItem.poste_id, 'Sem poste'),
    criadoEm: formatDateTime(safeItem.criado_em),
    atualizadoEm: formatDateTime(safeItem.atualizado_em),
    duplicidadeSuspeita: safeItem.duplicidade_suspeita === true ? 'Sim' : 'Nao'
  };
}

function buildSolicitacoesUrl(offset = 0) {
  const params = new URLSearchParams({
    limit: String(SOLICITACOES_PAGE_SIZE),
    offset: String(Math.max(0, offset))
  });

  return `${INTERNAL_SOLICITACOES_ENDPOINT}?${params.toString()}`;
}

function canListSolicitacoes(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoRead);
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
      return 'Permissao iluminacao.solicitacoes.ler confirmada. A listagem somente leitura usa apenas campos minimos nao pessoais.';
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

function renderSolicitacoesRows(items) {
  return items
    .map((item) => `
      <div class="internal-table-row" role="row">
        <span data-label="Protocolo">${escapeHtml(item.protocolo)}</span>
        <span data-label="Status">${escapeHtml(item.status)}</span>
        <span data-label="Tipo">${escapeHtml(item.tipoProblema)}</span>
        <span data-label="Prioridade">${escapeHtml(item.prioridade)}</span>
        <span data-label="Poste">${escapeHtml(item.posteId)}</span>
        <span data-label="Criado em">${escapeHtml(item.criadoEm)}</span>
        <span data-label="Atualizado em">${escapeHtml(item.atualizadoEm)}</span>
        <span data-label="Duplicidade">${escapeHtml(item.duplicidadeSuspeita)}</span>
      </div>
    `)
    .join('');
}

function renderSolicitacoesTable(listState) {
  if (listState.status === 'loading') {
    return `
      <div class="internal-table-empty" role="row">
        Carregando solicitacoes internas somente leitura...
      </div>
    `;
  }

  if (listState.status === 'empty') {
    return `
      <div class="internal-table-empty" role="row">
        Nenhuma solicitacao encontrada para esta pagina.
      </div>
    `;
  }

  if (listState.status === 'ready') {
    return renderSolicitacoesRows(listState.items);
  }

  return `
    <div class="internal-table-empty" role="row">
      ${escapeHtml(listState.message || 'Listagem aguardando autenticacao e permissao.')}
    </div>
  `;
}

function getSolicitacoesStatusText(listState) {
  if (listState.status === 'loading') {
    return 'Carregando';
  }

  if (listState.status === 'ready' || listState.status === 'empty') {
    return `${listState.total} registro(s)`;
  }

  if (listState.statusCode) {
    return `HTTP ${listState.statusCode}`;
  }

  return 'Aguardando';
}

function renderSolicitacoesPanel(state) {
  const listState = state.solicitacoes || createSolicitacoesState();
  const canLoad = state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoRead);
  const isLoading = listState.status === 'loading';
  const previousOffset = Math.max(0, listState.offset - SOLICITACOES_PAGE_SIZE);
  const nextOffset = listState.offset + listState.limit;
  const hasPrevious = canLoad && listState.offset > 0 && !isLoading;
  const hasNext = canLoad && nextOffset < listState.total && !isLoading;
  const tableLabel = canLoad
    ? 'Lista somente leitura de solicitacoes internas'
    : 'Listagem bloqueada ate autenticacao e permissao';

  return `
    <section class="internal-main-panel" aria-label="Solicitacoes internas">
      <div class="internal-panel-header">
        <div>
          <h3>Solicitacoes</h3>
          <p>
            Listagem somente leitura com campos minimos. Dados pessoais, descricao, referencia e coordenadas nao aparecem nesta tabela.
          </p>
        </div>
        <span class="internal-pill">Somente leitura</span>
      </div>

      <div class="internal-list-toolbar" aria-label="Controles da listagem">
        <div>
          <strong>${escapeHtml(getSolicitacoesStatusText(listState))}</strong>
          <span>
            limit ${escapeHtml(listState.limit)} / offset ${escapeHtml(listState.offset)}
          </span>
        </div>
        <div class="internal-list-actions">
          <button
            type="button"
            class="internal-secondary-action"
            data-action="previous-solicitacoes"
            data-offset="${escapeHtml(previousOffset)}"
            ${hasPrevious ? '' : 'disabled'}
          >
            Pagina anterior
          </button>
          <button
            type="button"
            class="internal-secondary-action"
            data-action="refresh-solicitacoes"
            data-offset="${escapeHtml(listState.offset)}"
            ${canLoad && !isLoading ? '' : 'disabled'}
          >
            Atualizar listagem
          </button>
          <button
            type="button"
            class="internal-secondary-action"
            data-action="next-solicitacoes"
            data-offset="${escapeHtml(nextOffset)}"
            ${hasNext ? '' : 'disabled'}
          >
            Proxima pagina
          </button>
        </div>
      </div>

      <p class="internal-list-message" role="status">
        ${escapeHtml(listState.message)}
      </p>

      <div class="internal-table-wrap">
        <div class="internal-table-shell" role="table" aria-label="${escapeHtml(tableLabel)}">
          <div class="internal-table-row internal-table-head" role="row">
            <span>Protocolo</span>
            <span>Status</span>
            <span>Tipo</span>
            <span>Prioridade</span>
            <span>Poste</span>
            <span>Criado em</span>
            <span>Atualizado em</span>
            <span>Duplicidade</span>
          </div>
          ${renderSolicitacoesTable(listState)}
        </div>
      </div>
    </section>
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
        <label for="internal-login-usuario">
          Login
          <input
            id="internal-login-usuario"
            name="login"
            type="text"
            autocomplete="username"
            value="${escapeHtml(state.loginValue || '')}"
            required
            ${isSubmitting ? 'disabled' : ''}
          />
        </label>
        <label for="internal-login-senha">
          Senha
          <input
            id="internal-login-senha"
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
            Portal municipal multi-modulo. Esta fase usa sessao interna e listagem somente leitura de Iluminacao.
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
              <span>GET solicitacoes</span>
              <span>Credentials include</span>
              <span>Cookie HttpOnly</span>
              <span>Sem POST/PATCH</span>
            </div>
          </section>

          <section class="internal-summary" aria-labelledby="summary-title">
            <div class="internal-section-heading">
              <h2 id="summary-title">Inicio / Resumo futuro</h2>
              <p>Cards permanecem com marcador estrutural. Indicadores e dashboard real continuam fora desta fase.</p>
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
              <p>A listagem minima e somente leitura. Detalhe, historico, observacoes e status continuam desabilitados.</p>
            </div>

            <div class="internal-workspace">
              <aside class="internal-filters" aria-labelledby="filters-title">
                <h3 id="filters-title">Filtros planejados</h3>
                <label for="internal-filter-protocolo">
                  Protocolo
                  <input
                    id="internal-filter-protocolo"
                    name="protocolo"
                    type="text"
                    placeholder="IP-AAAA-NNNNNN"
                    disabled
                  />
                </label>
                <label for="internal-filter-status">
                  Status
                  <select id="internal-filter-status" name="status" disabled>
                    <option value="">Todos</option>
                    ${renderStatusOptions()}
                  </select>
                </label>
                <label for="internal-filter-tipo-problema">
                  Tipo
                  <input
                    id="internal-filter-tipo-problema"
                    name="tipo_problema"
                    type="text"
                    placeholder="lampada_apagada"
                    disabled
                  />
                </label>
                <label for="internal-filter-prioridade">
                  Prioridade
                  <input
                    id="internal-filter-prioridade"
                    name="prioridade"
                    type="text"
                    placeholder="normal"
                    disabled
                  />
                </label>
                <label for="internal-filter-poste">
                  Poste
                  <input
                    id="internal-filter-poste"
                    name="poste_id"
                    type="text"
                    placeholder="ID do poste"
                    disabled
                  />
                </label>
                <div class="internal-filter-grid">
                  <label for="internal-filter-criado-de">
                    Criado de
                    <input
                      id="internal-filter-criado-de"
                      name="criado_de"
                      type="date"
                      disabled
                    />
                  </label>
                  <label for="internal-filter-criado-ate">
                    Criado ate
                    <input
                      id="internal-filter-criado-ate"
                      name="criado_ate"
                      type="date"
                      disabled
                    />
                  </label>
                </div>
                <button type="button" disabled>Aplicar filtros em fase futura</button>
              </aside>

              ${renderSolicitacoesPanel(state)}

              <div class="internal-detail-grid">
                <article class="internal-card">
                  <h3>Detalhe da solicitacao</h3>
                  <p>
                    Futuro painel para protocolo, localizacao, descricao, solicitante, coordenadas WGS84 e status atual.
                  </p>
                  <dl>
                    <div>
                      <dt>Origem</dt>
                      <dd>Aguardando integracao de detalhe</dd>
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
                  <textarea
                    id="internal-placeholder-observacao"
                    name="observacao_placeholder"
                    disabled
                    placeholder="Criacao de observacao desabilitada nesta shell"
                  ></textarea>
                  <button type="button" disabled>Criar observacao em fase futura</button>
                </article>

                <article class="internal-card">
                  <h3>Alteracao normal de status</h3>
                  <p>
                    A tela futura deve orientar a operacao, mas a matriz de transicoes continua validada no backend.
                  </p>
                  <select
                    id="internal-placeholder-status"
                    name="status_placeholder"
                    disabled
                    aria-label="Status futuro da solicitacao"
                  >
                    ${renderStatusOptions()}
                  </select>
                  <textarea
                    id="internal-placeholder-status-observacao"
                    name="status_observacao_placeholder"
                    disabled
                    placeholder="Observacao obrigatoria no PATCH real"
                  ></textarea>
                  <button type="button" disabled>Alterar status em fase futura</button>
                </article>
              </div>
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

async function fetchSolicitacoesInternas(offset = 0) {
  const response = await fetch(buildSolicitacoesUrl(offset), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return createSolicitacoesState({
      status: 'unauthenticated',
      offset,
      statusCode: response.status,
      message: 'Sessao ausente ou expirada. Faca login novamente para listar solicitacoes.'
    });
  }

  if (response.status === 403) {
    return createSolicitacoesState({
      status: 'forbidden',
      offset,
      statusCode: response.status,
      message: 'Sem permissao para listar solicitacoes internas de Iluminacao.'
    });
  }

  if (response.status === 422) {
    return createSolicitacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Parametros de listagem invalidos. A consulta foi mantida sem detalhes tecnicos.'
    });
  }

  if (response.status === 503) {
    return createSolicitacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Servico interno temporariamente indisponivel para listar solicitacoes.'
    });
  }

  if (!response.ok) {
    return createSolicitacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Nao foi possivel carregar a listagem interna neste momento.'
    });
  }

  const payload = await response.json();

  if (!isValidSolicitacoesPayload(payload)) {
    return createSolicitacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Resposta de listagem em formato inesperado.'
    });
  }

  const safeLimit = Math.max(1, Math.min(100, payload.limit));
  const safeOffset = Math.max(0, payload.offset);
  const safeTotal = Math.max(0, payload.total);
  const items = payload.items.map(toDisplaySolicitacao);

  return createSolicitacoesState({
    status: items.length > 0 ? 'ready' : 'empty',
    items,
    total: safeTotal,
    limit: safeLimit,
    offset: safeOffset,
    statusCode: response.status,
    message: items.length > 0
      ? 'Listagem somente leitura carregada com campos minimos.'
      : 'Nenhuma solicitacao encontrada nesta pagina.'
  });
}

async function loadSolicitacoes(root, state, offset = 0) {
  if (!canListSolicitacoes(state)) {
    renderApp(root, {
      ...state,
      solicitacoes: createSolicitacoesState({
        status: state.sessionState === 'authenticated' ? 'forbidden' : 'idle',
        message: state.sessionState === 'authenticated'
          ? 'A listagem nao foi chamada porque a permissao de Iluminacao nao foi confirmada.'
          : 'A listagem nao foi chamada porque a sessao ainda nao foi autenticada.'
      })
    });
    return;
  }

  const loadingState = {
    ...state,
    solicitacoes: createSolicitacoesState({
      status: 'loading',
      offset,
      message: 'Carregando solicitacoes internas com limit=20 e offset seguro.'
    })
  };

  renderApp(root, loadingState);

  try {
    const solicitacoes = await fetchSolicitacoesInternas(offset);

    if (solicitacoes.status === 'unauthenticated') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessao expirada ao tentar carregar a listagem. Faca login novamente.',
        hasChecked: true,
        solicitacoes
      }));
      return;
    }

    renderApp(root, {
      ...loadingState,
      solicitacoes
    });
  } catch {
    renderApp(root, {
      ...state,
      solicitacoes: createSolicitacoesState({
        status: 'error',
        offset,
        message: 'Falha temporaria de conexao com o servico interno de listagem.'
      })
    });
  }
}

async function verifySession(root) {
  renderApp(root, initialSessionState);

  try {
    const nextState = await fetchCurrentSession();
    renderApp(root, nextState);

    if (canListSolicitacoes(nextState)) {
      await loadSolicitacoes(root, nextState, 0);
    }
  } catch {
    renderApp(root, createSessionState({
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

    renderApp(root, createSessionState({
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

  renderApp(root, createSessionState({
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
        renderApp(root, confirmedState);

        if (canListSolicitacoes(confirmedState)) {
          await loadSolicitacoes(root, confirmedState, 0);
        }

        return;
      }

      renderApp(root, {
        ...confirmedState,
        sessionState: 'unauthenticated',
        loginStatus: 'error',
        loginMessage: 'Login aceito, mas a sessao nao foi confirmada. Tente novamente.',
        loginValue: login
      });
      return;
    }

    if (response.status === 401) {
      renderApp(root, createSessionState({
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
      renderApp(root, createSessionState({
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
      renderApp(root, createSessionState({
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

    renderApp(root, createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Nao foi possivel concluir o login interno.',
      hasChecked: true,
      loginStatus: 'error',
      loginMessage: 'Nao foi possivel entrar agora.',
      loginValue: login
    }));
  } catch {
    renderApp(root, createSessionState({
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
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="refresh-solicitacoes"], [data-action="previous-solicitacoes"], [data-action="next-solicitacoes"]')
    ) {
      const requestedOffset = Number.parseInt(target.dataset.offset || '0', 10);
      const safeOffset = Number.isInteger(requestedOffset) && requestedOffset >= 0
        ? requestedOffset
        : 0;

      loadSolicitacoes(root, currentState, safeOffset);
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
