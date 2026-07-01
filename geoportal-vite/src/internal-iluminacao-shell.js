import './internal-iluminacao-shell.css';
import 'ol/ol.css';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Point from 'ol/geom/Point.js';
import HeatmapLayer from 'ol/layer/Heatmap.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import CircleStyle from 'ol/style/Circle.js';
import RegularShape from 'ol/style/RegularShape.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import { buildGoogleMapsRouteUrl } from './geoportal-routes.js';

const AUTH_ME_ENDPOINT = '/api/internal/auth/me';
const AUTH_LOGIN_ENDPOINT = '/api/internal/auth/login';
const AUTH_LOGOUT_ENDPOINT = '/api/internal/auth/logout';
const INTERNAL_ADMIN_USERS_ENDPOINT = '/api/internal/admin/users';
const INTERNAL_ADMIN_PROFILES_ENDPOINT = '/api/internal/admin/profiles';
const INTERNAL_SOLICITACOES_ENDPOINT = '/api/internal/iluminacao/solicitacoes';
const INTERNAL_MAPA_OCORRENCIAS_ENDPOINT = '/api/internal/iluminacao/mapa/ocorrencias';
const INTERNAL_RELATORIO_SOLICITACOES_CSV_ENDPOINT =
  '/api/internal/iluminacao/relatorios/solicitacoes.csv';
const INTERNAL_RELATORIO_SOLICITACOES_RESUMO_ENDPOINT =
  '/api/internal/iluminacao/relatorios/solicitacoes/resumo';
const INTERNAL_DASHBOARD_RESUMO_ENDPOINT =
  '/api/internal/iluminacao/dashboard/resumo';
const INTERNAL_DASHBOARD_RANKING_ENDPOINT =
  '/api/internal/iluminacao/dashboard/ranking';
const INTERNAL_DASHBOARD_SERIES_SEMANAL_ENDPOINT =
  '/api/internal/iluminacao/dashboard/series?granularidade=semana';
const SOLICITACOES_PAGE_SIZE = 20;
const MAPA_OCORRENCIAS_LIMIT = 250;
const HISTORICO_PAGE_SIZE = 20;
const OBSERVACOES_PAGE_SIZE = 20;
const OBSERVACAO_MIN_LENGTH = 3;
const OBSERVACAO_MAX_LENGTH = 2000;
const STATUS_OBSERVACAO_MIN_LENGTH = 3;
const STATUS_OBSERVACAO_MAX_LENGTH = 1000;
const STATUS_CORRECAO_JUSTIFICATIVA_MIN_LENGTH = 10;
const STATUS_CORRECAO_JUSTIFICATIVA_MAX_LENGTH = 1000;
const PRIORIDADE_OBSERVACAO_MIN_LENGTH = 3;
const PRIORIDADE_OBSERVACAO_MAX_LENGTH = 1000;
const INTERNAL_MUTATING_REQUEST_HEADER = 'X-Geoportal-Internal-Request';
const OPERATIONAL_MAP_ZOOM = 17;
const OPERATIONAL_MAP_CENTER = [-55.225, -23.105];
const DETAIL_SECTION_SELECTOR = '[data-solicitacao-detail-section]';

const SESSION_STATES = {
  checking_session: {
    label: 'Verificando sessão',
    title: 'Sessão em verificação',
    text: 'Verificando se há uma sessão interna ativa.',
    tone: 'checking'
  },
  unauthenticated: {
    label: 'Não autenticado',
    title: 'Login interno necessário',
    text: 'Entre com suas credenciais internas para acessar o atendimento.',
    tone: 'neutral'
  },
  authenticated: {
    label: 'Autenticado',
    title: 'Sessão interna confirmada',
    text: 'Acesso interno confirmado.',
    tone: 'success'
  },
  forbidden: {
    label: 'Sem permissão',
    title: 'Acesso negado',
    text: 'Seu perfil não permite acessar este recurso.',
    tone: 'warning'
  },
  expired: {
    label: 'Sessão expirada',
    title: 'Sessão expirada ou inválida',
    text: 'Entre novamente para continuar.',
    tone: 'neutral'
  },
  technical_error: {
    label: 'Erro técnico seguro',
    title: 'Serviço interno indisponível',
    text: 'Não foi possível concluir a operação agora.',
    tone: 'danger'
  }
};

const PERMISSIONS = {
  iluminacaoRead: 'iluminacao.solicitacoes.ler',
  iluminacaoHistory: 'iluminacao.solicitacoes.ver_historico',
  iluminacaoObservations: 'iluminacao.solicitacoes.ver_observacoes',
  iluminacaoComment: 'iluminacao.solicitacoes.comentar',
  iluminacaoStatus: 'iluminacao.solicitacoes.atualizar_status',
  iluminacaoPriority: 'iluminacao.solicitacoes.atualizar_prioridade',
  iluminacaoStatusCorrection: 'iluminacao.solicitacoes.corrigir_status',
  iluminacaoDashboard: 'iluminacao.dashboard.ler',
  adminUsersRead: 'admin.usuarios.ler',
  adminUsersCreate: 'admin.usuarios.criar',
  adminUsersBlock: 'admin.usuarios.bloquear',
  adminUsersResetPassword: 'admin.usuarios.redefinir_senha',
  adminUsersAssignProfiles: 'admin.usuarios.atribuir_perfis',
  adminUsersRemoveProfiles: 'admin.usuarios.remover_perfis',
  adminProfilesRead: 'admin.perfis.ler',
  adminPermissionsRead: 'admin.permissoes.ler'
};

const plannedModules = [
  {
    key: 'dashboard',
    name: 'Início',
    description: 'Resumo futuro por permissões',
    kind: 'dashboard'
  },
  {
    key: 'iluminacao',
    name: 'Iluminação Pública',
    description: 'Primeiro módulo interno',
    kind: 'permission',
    permissions: [PERMISSIONS.iluminacaoRead]
  },
  {
    key: 'alvaras',
    name: 'Alvarás',
    description: 'Módulo futuro',
    kind: 'planned'
  },
  {
    key: 'viabilidade',
    name: 'Viabilidade',
    description: 'Módulo futuro',
    kind: 'planned'
  },
  {
    key: 'meio_ambiente',
    name: 'Meio Ambiente',
    description: 'Módulo futuro',
    kind: 'planned'
  },
  {
    key: 'limpeza_lotes',
    name: 'Limpeza de Lotes',
    description: 'Módulo futuro',
    kind: 'planned'
  },
  {
    key: 'admin',
    name: 'Administração do Sistema',
    description: 'Gestão interna de usuários e perfis',
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

const statusLabels = {
  aberta: 'Aberta',
  em_triagem: 'Em triagem',
  encaminhada: 'Encaminhada',
  em_execucao: 'Em execu\u00e7\u00e3o',
  aguardando_material: 'Aguardando material',
  nao_localizado: 'N\u00e3o localizado',
  resolvida: 'Resolvida',
  indeferida: 'Indeferida',
  cancelada: 'Cancelada'
};

const priorityLabels = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente'
};

const priorityOptions = [
  'baixa',
  'normal',
  'alta',
  'urgente'
];

const operationalMapStatusColors = {
  aberta: '#2563eb',
  em_triagem: '#7c3aed',
  encaminhada: '#0f766e',
  em_execucao: '#ea580c',
  aguardando_material: '#ca8a04',
  nao_localizado: '#64748b',
  resolvida: '#16a34a',
  indeferida: '#b91c1c',
  cancelada: '#475569'
};

const problemTypeLabels = {
  lampada_apagada: 'L\u00e2mpada apagada',
  lampada_piscando: 'L\u00e2mpada piscando',
  lampada_acesa_dia: 'L\u00e2mpada acesa durante o dia',
  poste_danificado: 'Poste danificado',
  braco_luminaria_danificada: 'Bra\u00e7o ou lumin\u00e1ria danificada',
  fiacao_aparente: 'Fia\u00e7\u00e3o aparente',
  outro: 'Outro'
};

const originLabels = {
  cidadao_web: 'Solicitante pelo Geoportal',
  usuario_interno: 'Usu\u00e1rio interno',
  sistema: 'Sistema'
};

const locationTypeLabels = {
  poste_mapa: 'Poste selecionado no mapa',
  coordenada_manual: 'Local indicado manualmente'
};

const statusTransitions = {
  aberta: ['em_triagem', 'em_execucao', 'cancelada', 'indeferida'],
  em_triagem: ['encaminhada', 'aguardando_material', 'nao_localizado', 'cancelada', 'indeferida'],
  encaminhada: ['em_execucao', 'aguardando_material', 'nao_localizado', 'cancelada'],
  em_execucao: ['aguardando_material', 'resolvida', 'nao_localizado'],
  aguardando_material: ['encaminhada', 'em_execucao', 'cancelada']
};

const terminalStatuses = [
  'resolvida',
  'cancelada',
  'indeferida',
  'nao_localizado'
];

const summaryCards = [
  {
    key: 'total',
    label: 'Solicitações na lista',
    value: '--',
    module: 'Iluminação Pública',
    note: 'Aguardando carregamento'
  },
  {
    key: 'active',
    label: 'Em atendimento',
    value: '--',
    module: 'Iluminação Pública',
    note: 'Status em andamento'
  },
  {
    key: 'finished',
    label: 'Finalizadas',
    value: '--',
    module: 'Iluminação Pública',
    note: 'Resolvidas ou encerradas'
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
  },
  {
    permission: PERMISSIONS.iluminacaoPriority,
    label: 'Alterar prioridade'
  }
];

const nextSteps = [
  'Validar login visual minimo com cookie HttpOnly e /api/internal/auth/me.',
  'Validar listagem interna somente leitura apos login, sessao e permissao confirmados.',
  'Validar detalhe somente leitura por selecao explicita da tabela.',
  'Validar historico somente leitura por botao explicito no detalhe.',
  'Validar observacoes internas somente leitura por botao explicito no detalhe.',
  'Validar criacao de observacao interna com header mutavel obrigatorio.',
  'Validar alteracao normal de status com matriz de transicoes e header mutavel obrigatorio.',
  'Validar alteracao de prioridade com justificativa e header mutavel obrigatorio.',
  'Planejar dashboard, mapa operacional e proxy separadamente.'
];

const outOfScope = [
  'logout completo',
  'token manual, localStorage ou sessionStorage',
  'edicao ou exclusao de observacao',
  'correcao administrativa ou reabertura de status terminal',
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
    sortBy: 'protocolo_desc',
    statusCode: null,
    message: 'Listagem somente leitura ainda não carregada.',
    ...overrides
  };
}

function createOperationalMapState(overrides = {}) {
  const defaultFilters = {
    status: '',
    prioridade: '',
    ativos: false,
    limit: MAPA_OCORRENCIAS_LIMIT
  };
  const defaultPopup = {
    status: 'idle',
    solicitacaoId: null,
    item: null,
    statusCode: null,
    message: 'Selecione um ponto no mapa para abrir o resumo operacional.'
  };

  return {
    status: 'idle',
    items: [],
    total: 0,
    limit: MAPA_OCORRENCIAS_LIMIT,
    offset: 0,
    statusCode: null,
    message: 'Mapa operacional ainda não carregado.',
    filters: defaultFilters,
    selectedIds: [],
    selectionMode: '',
    viewState: null,
    popup: defaultPopup,
    ...overrides,
    filters: {
      ...defaultFilters,
      ...(overrides.filters || {})
    },
    selectedIds: Array.isArray(overrides.selectedIds)
      ? Array.from(new Set(overrides.selectedIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)))
      : [],
    selectionMode: ['selection', 'viewport'].includes(overrides.selectionMode)
      ? overrides.selectionMode
      : '',
    viewState: overrides.viewState && Array.isArray(overrides.viewState.center)
      ? {
          center: overrides.viewState.center.map(Number).filter((value) => Number.isFinite(value)).slice(0, 2),
          zoom: Number.isFinite(Number(overrides.viewState.zoom)) ? Number(overrides.viewState.zoom) : null
        }
      : null,
    popup: {
      ...defaultPopup,
      ...(overrides.popup || {})
    }
  };
}


function createHistoricoState(overrides = {}) {
  return {
    status: 'idle',
    items: [],
    total: 0,
    limit: HISTORICO_PAGE_SIZE,
    offset: 0,
    statusCode: null,
    message: 'Histórico carregado somente sob demanda.',
    ...overrides
  };
}

function createObservacoesState(overrides = {}) {
  return {
    status: 'idle',
    items: [],
    total: 0,
    limit: OBSERVACOES_PAGE_SIZE,
    offset: 0,
    statusCode: null,
    message: 'Observações carregadas somente sob demanda.',
    ...overrides
  };
}

function createObservacaoFormState(overrides = {}) {
  return {
    status: 'idle',
    value: '',
    statusCode: null,
    message: 'Criação de observação disponível apenas por ação explícita.',
    ...overrides
  };
}

function createStatusFormState(overrides = {}) {
  return {
    status: 'idle',
    selectedStatus: '',
    observacao: '',
    statusCode: null,
    message: 'Alteração normal de status disponível apenas por ação explícita.',
    ...overrides
  };
}

function createStatusCorrectionFormState(overrides = {}) {
  return {
    status: 'idle',
    open: false,
    selectedStatus: '',
    justificativa: '',
    confirmed: false,
    statusCode: null,
    message: 'Correção administrativa disponível apenas para perfil autorizado.',
    ...overrides
  };
}

function createPrioridadeFormState(overrides = {}) {
  return {
    status: 'idle',
    selectedPriority: '',
    observacao: '',
    statusCode: null,
    message: 'Alteração de prioridade disponível apenas por ação explícita.',
    ...overrides
  };
}

function createRelatorioState(overrides = {}) {
  return {
    dataInicio: '',
    dataFim: '',
    statusFilter: '',
    prioridadeFilter: '',
    tipoFilter: '',
    exportStatus: 'idle',
    summaryStatus: 'idle',
    statusCode: null,
    message: 'Use datas para filtrar por periodo. Se deixar em branco, o relatorio sera geral.',
    summary: null,
    ...overrides
  };
}

function createDashboardState(overrides = {}) {
  const defaultFilters = {
    source: 'all',
    status: 'all',
    prioridade: 'all',
    tipo: 'all',
    dataInicio: '',
    dataFim: '',
    mapMode: 'points'
  };

  return {
    status: 'idle',
    filters: {
      ...defaultFilters,
      ...(overrides.filters || {})
    },
    statusCode: null,
    message: 'Dashboard geral carregado conforme permissoes.',
    resumo: null,
    ranking: null,
    series: null,
    ...overrides,
    filters: {
      ...defaultFilters,
      ...(overrides.filters || {})
    }
  };
}

function createDetalheState(overrides = {}) {
  const historico = createHistoricoState(overrides.historico || {});
  const observacoes = createObservacoesState(overrides.observacoes || {});
  const observacaoForm = createObservacaoFormState(overrides.observacaoForm || {});
  const statusForm = createStatusFormState(overrides.statusForm || {});
  const statusCorrectionForm = createStatusCorrectionFormState(
    overrides.statusCorrectionForm || {}
  );
  const prioridadeForm = createPrioridadeFormState(overrides.prioridadeForm || {});

  return {
    status: 'idle',
    item: null,
    solicitacaoId: null,
    statusCode: null,
    message: 'Selecione uma solicitação na tabela para carregar o detalhe somente leitura.',
    historico,
    observacoes,
    observacaoForm,
    statusForm,
    statusCorrectionForm,
    prioridadeForm,
    ...overrides,
    historico,
    observacoes,
    observacaoForm,
    statusForm,
    statusCorrectionForm,
    prioridadeForm
  };
}

const initialSessionState = {
  sessionState: 'checking_session',
  usuarioId: null,
  login: '',
  nome: '',
  profiles: [],
  permissions: [],
  statusCode: null,
  message: 'Verificando sessão interna existente.',
  hasChecked: false,
  loginStatus: 'idle',
  loginMessage: '',
  loginValue: '',
  activeModule: 'dashboard',
  dashboard: createDashboardState(),
  relatorio: createRelatorioState(),
  solicitacoes: createSolicitacoesState(),
  mapaOperacional: createOperationalMapState(),
  detalhe: createDetalheState(),
  admin: createAdminState()
};


function createAdminFormState(overrides = {}) {
  return {
    status: 'idle',
    statusCode: null,
    message: '',
    ...overrides
  };
}

function createAdminState(overrides = {}) {
  return {
    usersStatus: 'idle',
    users: [],
    selectedUserId: null,
    detailStatus: 'idle',
    user: null,
    userProfilesStatus: 'idle',
    userProfiles: [],
    availableProfilesStatus: 'idle',
    availableProfiles: [],
    statusCode: null,
    userSearchQuery: '',
    message: 'Administração carregada conforme permissões.',
    createForm: createAdminFormState({ message: 'Criação disponível para administradores autorizados.' }),
    blockForm: createAdminFormState(),
    unblockForm: createAdminFormState(),
    resetForm: createAdminFormState(),
    assignProfileForm: createAdminFormState(),
    deactivateProfileForm: createAdminFormState(),
    ...overrides
  };
}
function createSessionState(overrides = {}) {
  return {
    sessionState: 'checking_session',
    usuarioId: null,
    login: '',
    nome: '',
    profiles: [],
    permissions: [],
    statusCode: null,
    message: 'Verificando sessão interna existente.',
    hasChecked: false,
    loginStatus: 'idle',
    loginMessage: '',
    loginValue: '',
    logoutStatus: 'idle',
    logoutMessage: '',
    activeModule: 'dashboard',
    dashboard: createDashboardState(),
    relatorio: createRelatorioState(),
    solicitacoes: createSolicitacoesState(),
    mapaOperacional: createOperationalMapState(),
    detalhe: createDetalheState(),
    admin: createAdminState(),
    ...overrides
  };
}

function getSessionDisplayName(state) {
  if (typeof state.nome === 'string' && state.nome.trim()) {
    return state.nome.trim();
  }

  if (typeof state.login === 'string' && state.login.trim()) {
    return state.login.trim();
  }

  if (Number.isInteger(state.usuarioId) && state.usuarioId > 0) {
    return `Usuário interno #${state.usuarioId}`;
  }

  return 'Acesso interno';
}

function getSessionStatusMeta(state) {
  const parts = [];
  const displayName = getSessionDisplayName(state);

  if (
    typeof state.login === 'string'
    && state.login.trim()
    && state.login.trim() !== displayName
  ) {
    parts.push(state.login.trim());
  }

  if (Array.isArray(state.profiles) && state.profiles.length > 0) {
    parts.push(`Perfis: ${state.profiles.join(', ')}`);
  }

  return parts.join(' · ');
}

let currentState = createSessionState();
let operationalDetailMap = null;
let dashboardMap = null;
let internalOperationalMap = null;

function renderApp(root, state) {
  const normalizedState = {
    ...state,
    dashboard: state.dashboard || createDashboardState(),
    solicitacoes: state.solicitacoes || createSolicitacoesState(),
    mapaOperacional: state.mapaOperacional || createOperationalMapState(),
    detalhe: state.detalhe || createDetalheState(),
    admin: state.admin || createAdminState()
  };

  currentState = {
    ...normalizedState,
    activeModule: resolveInitialActiveModule(normalizedState, state.activeModule)
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

function normalizeProfile(profile) {
  if (typeof profile !== 'string') {
    return '';
  }

  return profile.trim().toLowerCase();
}

function normalizeProfiles(profiles) {
  return Array.from(
    new Set(profiles.map(normalizeProfile).filter(Boolean))
  ).sort();
}

function isValidMePayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && typeof payload.authenticated === 'boolean'
      && Number.isInteger(payload.usuario_id)
      && isOptionalText(payload.login)
      && isOptionalText(payload.nome)
      && (
        payload.perfis === undefined
        || (
          Array.isArray(payload.perfis)
          && payload.perfis.every((profile) => typeof profile === 'string')
        )
      )
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

function isValidMapaOcorrenciasPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Array.isArray(payload.items)
      && Number.isInteger(payload.limit)
      && Number.isInteger(payload.offset)
      && Number.isInteger(payload.total)
  );
}

function isValidMapaPopupPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Number.isInteger(payload.id)
      && isOptionalText(payload.protocolo)
      && isOptionalText(payload.status)
      && isOptionalText(payload.prioridade)
      && isOptionalText(payload.poste_id)
      && isOptionalText(payload.referencia_localizacao)
      && typeof payload.dados_pessoais_disponiveis === 'boolean'
      && isOptionalText(payload.nome_solicitante)
      && isOptionalText(payload.contato_solicitante)
  );
}


function isOptionalText(value) {
  return value === null || value === undefined || typeof value === 'string';
}

function isOptionalCoordinatePayloadValue(value) {
  return value === null
    || value === undefined
    || typeof value === 'number'
    || typeof value === 'string';
}

function parseCoordinateValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  const normalizedText = text.replace(',', '.');

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalizedText)) {
    return null;
  }

  const parsed = Number(normalizedText);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSolicitacaoCoordinate(latitudeValue, longitudeValue) {
  const latitude = parseCoordinateValue(latitudeValue);
  const longitude = parseCoordinateValue(longitudeValue);

  if (
    latitude === null
    || longitude === null
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function formatCoordinateValue(value) {
  return Number.isFinite(value) ? value.toFixed(6) : 'Não disponível';
}

function buildInternalGoogleMapsRouteUrl(coordinate) {
  if (!coordinate) {
    return '#';
  }

  return buildGoogleMapsRouteUrl([coordinate.longitude, coordinate.latitude], null);
}

function sanitizeInternalWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length < 10) {
    return null;
  }

  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }

  return null;
}

function buildInternalWhatsappUrl(value) {
  const sanitizedNumber = sanitizeInternalWhatsappNumber(value);
  return sanitizedNumber ? `https://wa.me/${sanitizedNumber}` : null;
}

function isValidSolicitacaoDetailPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Number.isInteger(payload.id)
      && payload.id > 0
      && typeof payload.protocolo === 'string'
      && typeof payload.origem === 'string'
      && typeof payload.localizacao_tipo === 'string'
      && isOptionalText(payload.poste_id)
      && typeof payload.tipo_problema === 'string'
      && typeof payload.descricao === 'string'
      && isOptionalText(payload.observacoes_localizacao)
      && isOptionalText(payload.ponto_referencia)
      && isOptionalText(payload.poste_proximo_informado)
      && typeof payload.nome_solicitante === 'string'
      && typeof payload.contato_solicitante === 'string'
      && typeof payload.status === 'string'
      && typeof payload.prioridade === 'string'
      && typeof payload.duplicidade_suspeita === 'boolean'
      && typeof payload.criado_em === 'string'
      && typeof payload.atualizado_em === 'string'
      && isOptionalText(payload.finalizado_em)
      && isOptionalCoordinatePayloadValue(payload.latitude)
      && isOptionalCoordinatePayloadValue(payload.longitude)
  );
}

function isValidHistoricoPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Array.isArray(payload.items)
      && Number.isInteger(payload.limit)
      && Number.isInteger(payload.offset)
      && Number.isInteger(payload.total)
  );
}

function isValidHistoricoEventPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Number.isInteger(payload.id)
      && Number.isInteger(payload.solicitacao_id)
      && typeof payload.acao === 'string'
      && isOptionalText(payload.status_anterior)
      && isOptionalText(payload.status_novo)
      && isOptionalText(payload.prioridade_anterior)
      && isOptionalText(payload.prioridade_nova)
      && isOptionalText(payload.usuario_id)
      && isOptionalText(payload.usuario_nome)
      && typeof payload.origem_acao === 'string'
      && isOptionalText(payload.observacao_resumida)
      && typeof payload.criado_em === 'string'
  );
}

function isValidObservacoesPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Array.isArray(payload.items)
      && Number.isInteger(payload.limit)
      && Number.isInteger(payload.offset)
      && Number.isInteger(payload.total)
  );
}

function isValidObservacaoPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Number.isInteger(payload.id)
      && Number.isInteger(payload.solicitacao_id)
      && typeof payload.observacao === 'string'
      && typeof payload.visibilidade === 'string'
      && isOptionalText(payload.usuario_id)
      && isOptionalText(payload.usuario_nome)
      && typeof payload.criado_em === 'string'
      && isOptionalText(payload.editado_em)
  );
}

function isValidStatusUpdateResponsePayload(payload) {
  const solicitacao = payload && typeof payload === 'object'
    ? payload.solicitacao
    : null;

  return Boolean(
    solicitacao
      && typeof solicitacao === 'object'
      && Number.isInteger(solicitacao.id)
      && solicitacao.id > 0
      && typeof solicitacao.status === 'string'
      && typeof solicitacao.atualizado_em === 'string'
      && isOptionalText(solicitacao.finalizado_em)
  );
}

function isValidPrioridadeUpdateResponsePayload(payload) {
  const solicitacao = payload && typeof payload === 'object'
    ? payload.solicitacao
    : null;

  return Boolean(
    solicitacao
      && typeof solicitacao === 'object'
      && Number.isInteger(solicitacao.id)
      && solicitacao.id > 0
      && typeof solicitacao.prioridade === 'string'
      && typeof solicitacao.atualizado_em === 'string'
  );
}

function isValidRelatorioResumoPayload(payload) {
  return Boolean(
    payload
      && typeof payload === 'object'
      && Number.isInteger(payload.total)
      && Number.isInteger(payload.abertas)
      && Number.isInteger(payload.em_triagem)
      && Number.isInteger(payload.em_andamento)
      && Number.isInteger(payload.resolvidas)
      && Number.isInteger(payload.canceladas)
      && Number.isInteger(payload.indeferidas)
      && Number.isInteger(payload.nao_localizadas)
      && payload.por_prioridade
      && typeof payload.por_prioridade === 'object'
      && !Array.isArray(payload.por_prioridade)
      && payload.por_tipo_problema
      && typeof payload.por_tipo_problema === 'object'
      && !Array.isArray(payload.por_tipo_problema)
  );
}

function safeText(value, fallback = 'Não informado') {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function formatDateTime(value) {
  const text = safeText(value, '');

  if (!text) {
    return 'Não informado';
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return 'Não informado';
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export {
  INTERNAL_MUTATING_REQUEST_HEADER,
  buildInternalGoogleMapsRouteUrl,
  buildRelatorioSolicitacoesCsvUrl,
  buildRelatorioSolicitacoesResumoUrl,
  buildInternalWhatsappUrl,
  buildWhatsAppDispatchText,
  buildSolicitacoesUrl,
  buildMapaOcorrenciasUrl,
  buildMapaOcorrenciaPopupUrl,
  buildUpdateSolicitacaoPrioridadeUrl,
  buildUpdateSolicitacaoStatusCorrecaoUrl,
  canViewDashboardWidgets,
  canViewRelatorio,
  canUpdatePrioridade,
  canCorrectStatus,
  createDashboardState,
  createDetalheState,
  createSessionState,
  createRelatorioState,
  createPrioridadeFormState,
  createStatusCorrectionFormState,
  createAdminState,
  createOperationalMapState,
  fetchDashboardGeralWidgets,
  fetchRelatorioSolicitacoesCsv,
  fetchRelatorioSolicitacoesResumo,
  fetchSolicitacoesInternas,
  fetchMapaOcorrencias,
  fetchMapaOcorrenciaPopup,
  fetchUpdateSolicitacaoStatus,
  fetchUpdateSolicitacaoStatusCorrecao,
  fetchUpdateSolicitacaoPrioridade,
  fetchAdminUsers,
  fetchAdminUserDetail,
  fetchAdminAvailableProfiles,
  fetchAdminUserProfiles,
  fetchCreateAdminUser,
  fetchBlockAdminUser,
  fetchUnblockAdminUser,
  fetchResetAdminUserPassword,
  fetchAssignAdminUserProfile,
  fetchDeactivateAdminUserProfile,
  getInternalActionTarget,
  getPrioridadeFormValidationMessage,
  getRelatorioValidationMessage,
  getStatusCorrectionFormValidationMessage,
  isMaintenanceLikeUser,
  resolveInitialActiveModule,
  normalizeSolicitacaoCoordinate,
  filterSolicitacoesByMapSelection,
  mergeOperationalMapSelectionIds,
  renderCoordinateRouteSection,
  renderDashboardPanel,
  renderAdminPanel,
  renderModuleMenu,
  renderObservacoesPanel,
  renderRelatorioPanel,
  renderInternalOperationalMapPanel,
  renderMapaOcorrenciaPopup,
  renderPriorityUpdatePanel,
  renderStatusCorrectionPanel,
  renderSessionBox,
  renderSolicitacaoDetailLoaded,
  renderSolicitacoesPanel,
  renderSummaryCards,
  renderStatusUpdatePanel,
  scrollToSolicitacaoDetailSection,
  loadAdminUser,
  refreshAdminPanel,
  selectModule,
  shouldSyncRelatorioFormOnInput
};

function toDisplaySolicitacao(item) {
  const safeItem = item && typeof item === 'object' ? item : {};
  const id = Number.isInteger(safeItem.id) && safeItem.id > 0
    ? safeItem.id
    : null;
  const coordinates = normalizeSolicitacaoCoordinate(
    safeItem.latitude,
    safeItem.longitude
  );

  return {
    id,
    protocolo: safeText(safeItem.protocolo),
    statusKey: normalizeStatusKey(safeItem.status),
    status: formatStatusLabel(safeItem.status),
    tipoProblemaKey: safeText(safeItem.tipo_problema, ''),
    tipoProblema: formatProblemTypeLabel(safeItem.tipo_problema),
    prioridadeKey: safeText(safeItem.prioridade, ''),
    prioridade: formatPriorityLabel(safeItem.prioridade),
    posteId: safeText(safeItem.poste_id, 'Sem poste'),
    coordinates,
    hasCoordinates: Boolean(coordinates),
    criadoEm: formatDateTime(safeItem.criado_em),
    criadoEmRaw: safeText(safeItem.criado_em, ''),
    atualizadoEm: formatDateTime(safeItem.atualizado_em),
    atualizadoEmRaw: safeText(safeItem.atualizado_em, ''),
    duplicidadeSuspeita: safeItem.duplicidade_suspeita === true ? 'Sim' : 'Não'
  };
}

function toDisplayMapaOcorrencia(item) {
  const safeItem = item && typeof item === 'object' ? item : {};
  const id = Number.isInteger(safeItem.id) && safeItem.id > 0
    ? safeItem.id
    : null;
  const coordinates = normalizeSolicitacaoCoordinate(
    safeItem.latitude,
    safeItem.longitude
  );

  return {
    id,
    protocolo: safeText(safeItem.protocolo),
    statusKey: normalizeStatusKey(safeItem.status),
    status: formatStatusLabel(safeItem.status),
    tipoProblemaKey: safeText(safeItem.tipo_problema, ''),
    tipoProblema: formatProblemTypeLabel(safeItem.tipo_problema),
    prioridadeKey: safeText(safeItem.prioridade, ''),
    prioridade: formatPriorityLabel(safeItem.prioridade),
    origem: formatOriginLabel(safeItem.origem),
    localizacaoTipo: formatLocationTypeLabel(safeItem.localizacao_tipo),
    posteId: safeText(safeItem.poste_id, 'Sem poste'),
    referenciaLocalizacao: safeText(safeItem.referencia_localizacao, 'Não informada'),
    coordinates,
    hasCoordinates: Boolean(coordinates),
    criadoEm: formatDateTime(safeItem.criado_em),
    atualizadoEm: formatDateTime(safeItem.atualizado_em),
    finalizadoEm: formatDateTime(safeItem.finalizado_em)
  };
}

function buildWhatsAppDispatchText(routeUrl, protocolo, nomeSolicitante) {
  const safeRoute = safeText(routeUrl, '');
  const safeProtocolo = safeText(protocolo, 'Não informado');
  const safeSolicitante = safeText(nomeSolicitante, 'não disponível para este perfil')
    || 'não disponível para este perfil';

  return [
    safeRoute,
    `Protocolo: ${safeProtocolo}`,
    `Solicitante: ${safeSolicitante}`
  ].join('\n');
}

function renderWhatsappDispatchCopyButton(routeUrl, protocolo, nomeSolicitante, solicitacaoId = null) {
  if (!routeUrl) {
    return `
      <p class="internal-muted-note">
        Cópia para WhatsApp indisponível sem coordenada do chamado.
      </p>
    `;
  }

  return `
    <div class="internal-whatsapp-copy">
      <button
        type="button"
        class="internal-secondary-action"
        data-action="copy-whatsapp-dispatch"
        data-route-url="${escapeHtml(routeUrl)}"
        data-protocolo="${escapeHtml(protocolo)}"
        data-solicitante="${escapeHtml(nomeSolicitante || '')}"
        ${Number.isInteger(solicitacaoId) && solicitacaoId > 0 ? `data-solicitacao-id="${escapeHtml(solicitacaoId)}"` : ''}
      >
        Copiar para WhatsApp
      </button>
      <p class="internal-muted-note" data-whatsapp-copy-message>
        Copia rota, protocolo e solicitante autorizado para envio operacional.
      </p>
    </div>
  `;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

async function copyWhatsappDispatchMessage(button) {
  const routeUrl = safeText(button.dataset.routeUrl, '');
  const protocolo = safeText(button.dataset.protocolo, 'Não informado');
  const solicitante = safeText(button.dataset.solicitante, '') || 'não disponível para este perfil';
  const messageTarget = button.closest('.internal-whatsapp-copy')?.querySelector('[data-whatsapp-copy-message]');

  if (!routeUrl) {
    if (messageTarget) {
      messageTarget.textContent = 'Não foi possível copiar: rota indisponível.';
    }
    return;
  }

  try {
    const solicitacaoId = Number.parseInt(safeText(button.dataset.solicitacaoId, ''), 10);
    if (!solicitante && Number.isInteger(solicitacaoId) && solicitacaoId > 0) {
      if (messageTarget) {
        messageTarget.textContent = 'Buscando solicitante autorizado...';
      }
      const popup = await fetchMapaOcorrenciaPopup(solicitacaoId);
      if (popup.status === 'ready' && popup.item) {
        solicitante = safeText(popup.item.nomeSolicitante, '');
        button.dataset.solicitante = solicitante;
      }
    }

    await copyTextToClipboard(buildWhatsAppDispatchText(routeUrl, protocolo, solicitante));
    if (messageTarget) {
      messageTarget.textContent = 'Copiado para WhatsApp.';
    }
  } catch {
    if (messageTarget) {
      messageTarget.textContent = 'Não foi possível copiar.';
    }
  }
}

function toDisplayMapaPopup(item) {
  const safeItem = item && typeof item === 'object' ? item : {};
  const dadosPessoaisDisponiveis = safeItem.dados_pessoais_disponiveis === true;

  return {
    id: Number.isInteger(safeItem.id) && safeItem.id > 0 ? safeItem.id : null,
    protocolo: safeText(safeItem.protocolo),
    statusKey: normalizeStatusKey(safeItem.status),
    status: formatStatusLabel(safeItem.status),
    prioridadeKey: safeText(safeItem.prioridade, ''),
    prioridade: formatPriorityLabel(safeItem.prioridade),
    posteId: safeText(safeItem.poste_id, 'Sem poste'),
    referenciaLocalizacao: safeText(safeItem.referencia_localizacao, 'Não informada'),
    localizacaoTipo: formatLocationTypeLabel(safeItem.localizacao_tipo),
    dadosPessoaisDisponiveis,
    nomeSolicitante: dadosPessoaisDisponiveis ? safeText(safeItem.nome_solicitante, '') : '',
    contatoSolicitante: dadosPessoaisDisponiveis ? safeText(safeItem.contato_solicitante, '') : '',
    routeUrl: safeText(safeItem.route_url, '')
  };
}

function toDisplaySolicitacaoDetail(item) {
  const safeItem = item && typeof item === 'object' ? item : {};
  const coordinates = normalizeSolicitacaoCoordinate(
    safeItem.latitude,
    safeItem.longitude
  );

  return {
    id: Number.isInteger(safeItem.id) ? safeItem.id : null,
    protocolo: safeText(safeItem.protocolo),
    statusKey: normalizeStatusKey(safeItem.status),
    status: formatStatusLabel(safeItem.status),
    tipoProblemaKey: safeText(safeItem.tipo_problema, ''),
    tipoProblema: formatProblemTypeLabel(safeItem.tipo_problema),
    prioridadeKey: safeText(safeItem.prioridade, ''),
    prioridade: formatPriorityLabel(safeItem.prioridade),
    posteId: safeText(safeItem.poste_id, 'Sem poste'),
    coordinates,
    hasCoordinates: Boolean(coordinates),
    latitudeText: coordinates
      ? formatCoordinateValue(coordinates.latitude)
      : 'Não disponível',
    longitudeText: coordinates
      ? formatCoordinateValue(coordinates.longitude)
      : 'Não disponível',
    googleMapsRouteUrl: buildInternalGoogleMapsRouteUrl(coordinates),
    origem: formatOriginLabel(safeItem.origem),
    localizacaoTipo: formatLocationTypeLabel(safeItem.localizacao_tipo),
    duplicidadeSuspeita: safeItem.duplicidade_suspeita === true ? 'Sim' : 'Não',
    criadoEm: formatDateTime(safeItem.criado_em),
    atualizadoEm: formatDateTime(safeItem.atualizado_em),
    finalizadoEm: formatDateTime(safeItem.finalizado_em),
    nomeSolicitante: safeText(safeItem.nome_solicitante),
    contatoSolicitante: safeText(safeItem.contato_solicitante),
    descricao: safeText(safeItem.descricao),
    observacoesLocalizacao: safeText(safeItem.observacoes_localizacao),
    pontoReferencia: safeText(safeItem.ponto_referencia),
    posteProximoInformado: safeText(safeItem.poste_proximo_informado)
  };
}

function formatEventLabel(value) {
  return safeText(value).replaceAll('_', ' ');
}

function normalizeStatusKey(value) {
  const status = safeText(value, '').trim().toLowerCase();

  if (!status) {
    return '';
  }

  if (statusLabels[status]) {
    return status;
  }

  return status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

function formatStatusLabel(value) {
  const status = normalizeStatusKey(value);
  return statusLabels[status] || formatEventLabel(status);
}

function formatPriorityLabel(value) {
  const priority = safeText(value, '');
  return priorityLabels[priority] || formatEventLabel(priority);
}

function formatProblemTypeLabel(value) {
  const problemType = safeText(value, '');
  return problemTypeLabels[problemType] || formatEventLabel(problemType);
}

function formatOriginLabel(value) {
  const origin = safeText(value, '');
  return originLabels[origin] || formatEventLabel(origin);
}

function formatLocationTypeLabel(value) {
  const locationType = safeText(value, '');
  return locationTypeLabels[locationType] || formatEventLabel(locationType);
}

function toDisplayHistoricoEvent(event) {
  const safeEvent = event && typeof event === 'object' ? event : {};
  const usuarioNome = safeText(safeEvent.usuario_nome, '');
  const usuarioId = safeText(safeEvent.usuario_id, '');
  const usuario = usuarioNome || (usuarioId ? `Usuário interno #${usuarioId}` : 'Não informado');

  return {
    id: Number.isInteger(safeEvent.id) ? safeEvent.id : null,
    criadoEm: formatDateTime(safeEvent.criado_em),
    acao: formatEventLabel(safeEvent.acao),
    statusAnterior: safeEvent.status_anterior
      ? formatStatusLabel(safeEvent.status_anterior)
      : 'Sem status anterior',
    statusNovo: safeEvent.status_novo
      ? formatStatusLabel(safeEvent.status_novo)
      : 'Sem novo status',
    prioridadeAnterior: safeEvent.prioridade_anterior
      ? formatPriorityLabel(safeEvent.prioridade_anterior)
      : 'Sem prioridade anterior',
    prioridadeNova: safeEvent.prioridade_nova
      ? formatPriorityLabel(safeEvent.prioridade_nova)
      : 'Sem nova prioridade',
    origemAcao: formatOriginLabel(safeEvent.origem_acao),
    observacaoResumida: safeText(safeEvent.observacao_resumida, ''),
    usuario
  };
}

function toDisplayObservacao(observacao) {
  const safeObservation = observacao && typeof observacao === 'object'
    ? observacao
    : {};
  const usuarioNome = safeText(safeObservation.usuario_nome, '');
  const usuarioId = safeText(safeObservation.usuario_id, '');
  const usuario = usuarioNome || (usuarioId ? `Usuário interno #${usuarioId}` : 'Não informado');
  const editadoEm = formatDateTime(safeObservation.editado_em);

  return {
    id: Number.isInteger(safeObservation.id) ? safeObservation.id : null,
    criadoEm: formatDateTime(safeObservation.criado_em),
    editadoEm,
    foiEditada: editadoEm !== 'Não informado',
    usuario,
    visibilidade: safeText(safeObservation.visibilidade),
    texto: safeText(safeObservation.observacao, 'Sem texto informado')
  };
}

function normalizeObservacaoInput(value) {
  return String(value || '').trim();
}

function getObservacaoValidationMessage(value) {
  const normalized = normalizeObservacaoInput(value);

  if (normalized.length < OBSERVACAO_MIN_LENGTH) {
    return 'Informe ao menos 3 caracteres após remover espaços.';
  }

  if (normalized.length > OBSERVACAO_MAX_LENGTH) {
    return 'A observação deve ter no máximo 2000 caracteres após remover espaços.';
  }

  return '';
}

function isValidObservacaoInput(value) {
  return getObservacaoValidationMessage(value) === '';
}

function normalizeStatusObservacaoInput(value) {
  return String(value || '').trim();
}

function getAllowedNextStatuses(currentStatus) {
  return statusTransitions[currentStatus] || [];
}

function isTerminalStatus(status) {
  return terminalStatuses.includes(normalizeStatusKey(status));
}

function getStatusSelectionValidationMessage(currentStatus, selectedStatus) {
  const allowedStatuses = getAllowedNextStatuses(currentStatus);

  if (!selectedStatus) {
    return 'Selecione um novo status permitido.';
  }

  if (selectedStatus === currentStatus) {
    return 'Selecione um status diferente do atual.';
  }

  if (!allowedStatuses.includes(selectedStatus)) {
    return 'Transição de status não permitida nesta rota normal.';
  }

  return '';
}

function getStatusObservacaoValidationMessage(value) {
  const normalized = normalizeStatusObservacaoInput(value);

  if (normalized.length < STATUS_OBSERVACAO_MIN_LENGTH) {
    return 'Informe justificativa com ao menos 3 caracteres após remover espaços.';
  }

  if (normalized.length > STATUS_OBSERVACAO_MAX_LENGTH) {
    return 'A justificativa deve ter no máximo 1000 caracteres após remover espaços.';
  }

  return '';
}

function getStatusFormValidationMessage(currentStatus, selectedStatus, observacao) {
  return getStatusSelectionValidationMessage(currentStatus, selectedStatus)
    || getStatusObservacaoValidationMessage(observacao);
}

function normalizeStatusCorrectionJustificativaInput(value) {
  return String(value || '').trim();
}

function getStatusCorrectionSelectionValidationMessage(currentStatus, selectedStatus) {
  if (!selectedStatus) {
    return 'Selecione o novo status administrativo.';
  }

  if (!statusOptions.includes(selectedStatus)) {
    return 'Status inválido para correção administrativa.';
  }

  if (selectedStatus === currentStatus) {
    return 'Selecione um status diferente do atual.';
  }

  return '';
}

function getStatusCorrectionJustificativaValidationMessage(value) {
  const normalized = normalizeStatusCorrectionJustificativaInput(value);

  if (normalized.length < STATUS_CORRECAO_JUSTIFICATIVA_MIN_LENGTH) {
    return 'Informe justificativa com ao menos 10 caracteres após remover espaços.';
  }

  if (normalized.length > STATUS_CORRECAO_JUSTIFICATIVA_MAX_LENGTH) {
    return 'A justificativa deve ter no máximo 1000 caracteres após remover espaços.';
  }

  return '';
}

function getStatusCorrectionFormValidationMessage(
  currentStatus,
  selectedStatus,
  justificativa,
  confirmed = true
) {
  return getStatusCorrectionSelectionValidationMessage(currentStatus, selectedStatus)
    || getStatusCorrectionJustificativaValidationMessage(justificativa)
    || (confirmed ? '' : 'Confirme ciência antes de corrigir status administrativamente.');
}

function normalizePrioridadeObservacaoInput(value) {
  return String(value || '').trim();
}

function getPrioridadeSelectionValidationMessage(currentPriority, selectedPriority) {
  if (!selectedPriority) {
    return 'Selecione uma nova prioridade.';
  }

  if (!priorityOptions.includes(selectedPriority)) {
    return 'Prioridade inválida para esta solicitação.';
  }

  if (selectedPriority === currentPriority) {
    return 'Selecione uma prioridade diferente da atual.';
  }

  return '';
}

function getPrioridadeObservacaoValidationMessage(value) {
  const normalized = normalizePrioridadeObservacaoInput(value);

  if (normalized.length < PRIORIDADE_OBSERVACAO_MIN_LENGTH) {
    return 'Informe justificativa com ao menos 3 caracteres após remover espaços.';
  }

  if (normalized.length > PRIORIDADE_OBSERVACAO_MAX_LENGTH) {
    return 'A justificativa deve ter no máximo 1000 caracteres após remover espaços.';
  }

  return '';
}

function getPrioridadeFormValidationMessage(currentPriority, selectedPriority, observacao) {
  return getPrioridadeSelectionValidationMessage(currentPriority, selectedPriority)
    || getPrioridadeObservacaoValidationMessage(observacao);
}

function buildSolicitacoesUrl(offset = 0, options = {}) {
  const params = new URLSearchParams({
    limit: String(SOLICITACOES_PAGE_SIZE),
    offset: String(Math.max(0, offset))
  });

  if (options.ativos === true) {
    params.set('ativos', 'true');
  }

  return `${INTERNAL_SOLICITACOES_ENDPOINT}?${params.toString()}`;
}

function buildMapaOcorrenciasUrl(options = {}) {
  const limit = Number.parseInt(String(options.limit || MAPA_OCORRENCIAS_LIMIT), 10);
  const safeLimit = Number.isInteger(limit)
    ? Math.max(1, Math.min(500, limit))
    : MAPA_OCORRENCIAS_LIMIT;
  const offset = Number.parseInt(String(options.offset || 0), 10);
  const safeOffset = Number.isInteger(offset) && offset > 0 ? offset : 0;
  const params = new URLSearchParams({
    limit: String(safeLimit),
    offset: String(safeOffset)
  });
  const status = safeText(options.status, '').toLowerCase();
  const prioridade = safeText(options.prioridade, '').toLowerCase();

  if (status) {
    params.set('status', status);
  }

  if (prioridade) {
    params.set('prioridade', prioridade);
  }

  if (options.ativos === true) {
    params.set('ativos', 'true');
  }

  return `${INTERNAL_MAPA_OCORRENCIAS_ENDPOINT}?${params.toString()}`;
}

function buildMapaOcorrenciaPopupUrl(solicitacaoId) {
  return `${INTERNAL_MAPA_OCORRENCIAS_ENDPOINT}/${encodeURIComponent(String(solicitacaoId))}/popup`;
}


function getSolicitacoesListOptions(state) {
  return {
    ativos: isMaintenanceLikeUser(state.permissions || [])
  };
}

function buildSolicitacaoDetailUrl(solicitacaoId) {
  return `${INTERNAL_SOLICITACOES_ENDPOINT}/${encodeURIComponent(String(solicitacaoId))}`;
}

function buildSolicitacaoHistoricoUrl(solicitacaoId, offset = 0) {
  const params = new URLSearchParams({
    limit: String(HISTORICO_PAGE_SIZE),
    offset: String(Math.max(0, offset))
  });

  return `${buildSolicitacaoDetailUrl(solicitacaoId)}/historico?${params.toString()}`;
}

function buildSolicitacaoObservacoesUrl(solicitacaoId, offset = 0) {
  const params = new URLSearchParams({
    limit: String(OBSERVACOES_PAGE_SIZE),
    offset: String(Math.max(0, offset))
  });

  return `${buildSolicitacaoDetailUrl(solicitacaoId)}/observacoes?${params.toString()}`;
}

function buildCreateSolicitacaoObservacaoUrl(solicitacaoId) {
  return `${buildSolicitacaoDetailUrl(solicitacaoId)}/observacoes`;
}

function buildUpdateSolicitacaoStatusUrl(solicitacaoId) {
  return `${buildSolicitacaoDetailUrl(solicitacaoId)}/status`;
}

function buildUpdateSolicitacaoStatusCorrecaoUrl(solicitacaoId) {
  return `${buildSolicitacaoDetailUrl(solicitacaoId)}/status-correcao`;
}

function buildUpdateSolicitacaoPrioridadeUrl(solicitacaoId) {
  return `${buildSolicitacaoDetailUrl(solicitacaoId)}/prioridade`;
}

function normalizeRelatorioDateValue(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function buildRelatorioQueryParams(filters = {}) {
  const params = new URLSearchParams();
  const dataInicio = normalizeRelatorioDateValue(filters.dataInicio);
  const dataFim = normalizeRelatorioDateValue(filters.dataFim);
  const statusFilter = safeText(filters.statusFilter, '').trim();
  const prioridadeFilter = safeText(filters.prioridadeFilter, '').trim();
  const tipoFilter = safeText(filters.tipoFilter, '').trim();

  if (dataInicio) {
    params.set('data_inicio', dataInicio);
  }

  if (dataFim) {
    params.set('data_fim', dataFim);
  }

  if (statusFilter) {
    params.set('status', statusFilter);
  }

  if (prioridadeFilter) {
    params.set('prioridade', prioridadeFilter);
  }

  if (tipoFilter) {
    params.set('tipo', tipoFilter);
  }

  return params;
}

function buildRelatorioSolicitacoesCsvUrl(filters = {}) {
  const query = buildRelatorioQueryParams(filters).toString();
  return query
    ? `${INTERNAL_RELATORIO_SOLICITACOES_CSV_ENDPOINT}?${query}`
    : INTERNAL_RELATORIO_SOLICITACOES_CSV_ENDPOINT;
}

function buildRelatorioSolicitacoesResumoUrl(filters = {}) {
  const query = buildRelatorioQueryParams(filters).toString();
  return query
    ? `${INTERNAL_RELATORIO_SOLICITACOES_RESUMO_ENDPOINT}?${query}`
    : INTERNAL_RELATORIO_SOLICITACOES_RESUMO_ENDPOINT;
}

function canListSolicitacoes(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoRead);
}

function canViewHistorico(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoHistory);
}

function canViewObservacoes(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoObservations);
}

function canCreateObservacao(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoComment);
}

function canUpdateStatus(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoStatus);
}

function canUpdatePrioridade(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoPriority);
}

function canCorrectStatus(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoStatusCorrection);
}

function canViewDashboardWidgets(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoDashboard);
}

function canAccessIluminacaoModule(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoRead);
}


function canAccessAdminModule(state) {
  return state.sessionState === 'authenticated'
    && hasAnyPermission(state, [
      PERMISSIONS.adminUsersRead,
      PERMISSIONS.adminUsersCreate,
      PERMISSIONS.adminUsersBlock,
      PERMISSIONS.adminUsersResetPassword,
      PERMISSIONS.adminUsersAssignProfiles,
      PERMISSIONS.adminUsersRemoveProfiles,
      PERMISSIONS.adminProfilesRead
    ]);
}

function canCreateAdminUser(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.adminUsersCreate);
}

function canBlockAdminUser(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.adminUsersBlock);
}

function canResetAdminUserPassword(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.adminUsersResetPassword);
}

function canAssignAdminUserProfile(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.adminUsersAssignProfiles);
}

function canRemoveAdminUserProfile(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.adminUsersRemoveProfiles);
}

function canReadAdminProfiles(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.adminProfilesRead);
}
function resolveInitialActiveModule(state, requestedModule = state.activeModule) {
  if (requestedModule === 'dashboard' && canViewDashboardWidgets(state)) {
    return 'dashboard';
  }

  if (requestedModule === 'iluminacao' && canAccessIluminacaoModule(state)) {
    return 'iluminacao';
  }

  if (requestedModule === 'admin' && canAccessAdminModule(state)) {
    return 'admin';
  }

  if (canViewDashboardWidgets(state)) {
    return 'dashboard';
  }

  if (canAccessIluminacaoModule(state)) {
    return 'iluminacao';
  }

  if (canAccessAdminModule(state)) {
    return 'admin';
  }

  return 'none';
}

function canViewRelatorio(state) {
  return state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.adminUsersRead);
}

function normalizeDashboardCount(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatDashboardSeconds(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Sem dados';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}

function normalizeDashboardMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [safeText(key, ''), normalizeDashboardCount(count)])
      .filter(([key]) => Boolean(key))
  );
}

function normalizeDashboardRankingItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      chave: safeText(item?.chave, ''),
      total: normalizeDashboardCount(item?.total)
    }))
    .filter((item) => item.chave);
}

function normalizeDashboardSeriesPoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => ({
      periodo: safeText(point?.periodo, ''),
      total: normalizeDashboardCount(point?.total),
      por_status: normalizeDashboardMap(point?.por_status)
    }))
    .filter((point) => point.periodo);
}

function normalizeDashboardResumo(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    total: normalizeDashboardCount(source.total),
    abertas: normalizeDashboardCount(source.abertas),
    em_triagem: normalizeDashboardCount(source.em_triagem),
    em_execucao: normalizeDashboardCount(source.em_execucao),
    encaminhadas: normalizeDashboardCount(source.encaminhadas),
    finalizadas: normalizeDashboardCount(source.finalizadas),
    urgentes: normalizeDashboardCount(source.urgentes),
    atrasadas: normalizeDashboardCount(source.atrasadas),
    tempo_medio_resolucao_segundos: source.tempo_medio_resolucao_segundos,
    por_status: normalizeDashboardMap(source.por_status),
    por_prioridade: normalizeDashboardMap(source.por_prioridade),
    por_tipo: normalizeDashboardMap(source.por_tipo)
  };
}

function normalizeDashboardRanking(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    top_bairros: normalizeDashboardRankingItems(source.top_bairros),
    top_postes: normalizeDashboardRankingItems(source.top_postes)
  };
}

function normalizeDashboardSeries(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    granularidade: safeText(source.granularidade, 'semana'),
    pontos: normalizeDashboardSeriesPoints(source.pontos)
  };
}

function isMaintenanceLikeUser(permissions = []) {
  const normalizedPermissions = normalizePermissions(permissions);
  const canReadIluminacao = normalizedPermissions.includes(PERMISSIONS.iluminacaoRead);
  const hasAdminAccess = normalizedPermissions.some((permission) => (
    permission.startsWith('admin.')
  ));

  return canReadIluminacao && !hasAdminAccess;
}

function getModuleView(module, state) {
  if (module.kind === 'dashboard') {
    const allowed = canViewDashboardWidgets(state);

    return {
      state: allowed ? 'allowed' : 'denied',
      label: allowed ? 'Permitido' : 'Sem permissao',
      enabled: allowed,
      active: allowed && state.activeModule === module.key
    };
  }

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
        label: 'Aguardando sessão',
        enabled: false,
        active: false
      };
    }

    const allowed = hasAnyPermission(state, module.permissions);

    return {
      state: allowed ? 'allowed' : 'denied',
      label: allowed ? 'Permitido' : 'Sem permissão',
      enabled: allowed,
      active: allowed && state.activeModule === module.key
    };
  }

  if (module.kind === 'admin') {
    const allowed = state.sessionState === 'authenticated'
      && hasAnyPermission(state, module.permissions);

    return {
      state: allowed ? 'allowed' : 'restricted',
      label: allowed ? 'Permitido' : 'Restrito',
      enabled: allowed,
      active: allowed && state.activeModule === module.key
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
    return 'Verificando permissão para o módulo Iluminação Pública.';
  }

  if (state.sessionState === 'authenticated') {
    if (hasPermission(state, PERMISSIONS.iluminacaoRead)) {
      return 'Permissão de leitura confirmada. A listagem usa apenas campos mínimos.';
    }

    return 'Sessão confirmada, mas sem permissão para operar o módulo Iluminação.';
  }

  if (state.sessionState === 'forbidden') {
    return 'O sistema retornou acesso negado para a verificação solicitada.';
  }

  if (state.sessionState === 'technical_error') {
    return 'Não foi possível confirmar a sessão. A tela permanece visível e sem dados reais.';
  }

  return 'Sessão interna não confirmada. Faça login para continuar.';
}

function renderModuleMenu(state) {
  const maintenanceMode = isMaintenanceLikeUser(state.permissions || []);
  const modules = plannedModules.filter((module) => {
    const view = getModuleView(module, state);

    if (module.kind === 'dashboard') {
      return view.enabled;
    }

    if (maintenanceMode) {
      return view.enabled;
    }

    return true;
  });

  return modules
    .map((module) => {
      const view = getModuleView(module, state);
      const hideStateLabel = maintenanceMode;
      const moduleName = module.kind === 'dashboard' ? 'Dashboard' : module.name;
      const moduleDescription = module.kind === 'dashboard'
        ? 'Visao geral interna'
        : module.description;
      const classes = [
        'internal-module-button',
        hideStateLabel ? 'is-maintenance-visible' : '',
        `is-${view.state}`,
        view.active ? 'is-active' : ''
      ].filter(Boolean).join(' ');
      const ariaCurrent = view.active ? 'aria-current="page"' : '';
      const disabled = view.enabled ? '' : 'disabled';

      return `
        <button
          type="button"
          class="${classes}"
          data-action="select-module"
          data-module-key="${escapeHtml(module.key)}"
          ${ariaCurrent}
          ${disabled}
        >
          <span>
            <strong>${escapeHtml(moduleName)}</strong>
            <small>${escapeHtml(moduleDescription)}</small>
          </span>
          ${hideStateLabel ? '' : `<em>${escapeHtml(view.label)}</em>`}
        </button>
      `;
    })
    .join('');
}

function getSummaryCardViews(state) {
  const listState = state.solicitacoes || createSolicitacoesState();
  const listItems = Array.isArray(listState.items) ? listState.items : [];
  const mapItems = getOperationalMapItems(state);
  const listTotal = Number.isInteger(listState.total) ? listState.total : listItems.length;
  const hasCompleteMapSummary = mapItems.length > 0 && mapItems.length >= listTotal;
  const items = hasCompleteMapSummary ? mapItems : listItems;
  const loaded = hasCompleteMapSummary || listState.status === 'ready' || listState.status === 'empty';
  const summarySourceNote = hasCompleteMapSummary ? 'Base completa do mapa operacional' : 'Nesta página da listagem';
  const activeStatuses = ['aberta', 'em_triagem', 'encaminhada', 'em_execucao', 'aguardando_material'];
  const finishedStatuses = ['resolvida', 'cancelada', 'indeferida', 'nao_localizado'];
  const activeCount = items.filter((item) => activeStatuses.includes(item.statusKey)).length;
  const finishedCount = items.filter((item) => finishedStatuses.includes(item.statusKey)).length;
  const allowedModules = getAllowedModules(state);

  return summaryCards.map((card) => {
    if (card.key === 'total') {
      return {
        ...card,
        value: loaded ? listState.total : '--',
        note: loaded ? 'Total retornado pela listagem' : 'Carregue a listagem para atualizar'
      };
    }

    if (card.key === 'active') {
      return {
        ...card,
        value: loaded ? activeCount : '--',
        note: loaded ? summarySourceNote : 'Aguardando listagem'
      };
    }

    if (card.key === 'finished') {
      return {
        ...card,
        value: loaded ? finishedCount : '--',
        note: loaded ? summarySourceNote : 'Aguardando listagem'
      };
    }

    if (card.key === 'modules') {
      return {
        ...card,
        value: state.sessionState === 'authenticated' ? allowedModules.length : '--',
        note: state.sessionState === 'authenticated'
          ? 'Menu liberado por perfil'
          : 'Aguardando login'
      };
    }

    return card;
  });
}

function renderSummaryCards(state) {
  return getSummaryCardViews(state)
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

function renderDashboardMetricCard(label, value, note = '', marker = '') {
  return `
    <article class="internal-dashboard-kpi">
      <span>${marker ? `<i aria-hidden="true">${escapeHtml(marker)}</i>` : ''}${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      ${note ? `<small>${escapeHtml(note)}</small>` : ''}
    </article>
  `;
}

function renderDashboardBars(title, values, formatter = (value) => value) {
  const entries = Object.entries(values || {});

  if (entries.length === 0) {
    return `
      <article class="internal-dashboard-widget">
        <h3>${escapeHtml(title)}</h3>
        <p class="internal-list-message">Sem dados para este recorte.</p>
      </article>
    `;
  }

  const max = Math.max(...entries.map(([, value]) => normalizeDashboardCount(value)), 1);

  return `
    <article class="internal-dashboard-widget">
      <h3>${escapeHtml(title)}</h3>
      <div class="internal-dashboard-bars">
        ${entries.map(([key, value]) => {
    const count = normalizeDashboardCount(value);
    const width = Math.max(6, Math.round((count / max) * 100));

    return `
          <div class="internal-dashboard-bar-row">
            <span>${escapeHtml(formatter(key))}</span>
            <div class="internal-dashboard-bar-track" aria-hidden="true">
              <i style="width: ${width}%"></i>
            </div>
            <strong>${escapeHtml(String(count))}</strong>
          </div>
    `;
  }).join('')}
      </div>
    </article>
  `;
}

function renderDashboardRanking(title, items, emptyMessage) {
  if (!items || items.length === 0) {
    return `
      <article class="internal-dashboard-widget">
        <h3>${escapeHtml(title)}</h3>
        <p class="internal-list-message">${escapeHtml(emptyMessage)}</p>
      </article>
    `;
  }

  return `
    <article class="internal-dashboard-widget">
      <h3>${escapeHtml(title)}</h3>
      <ol class="internal-dashboard-ranking">
        ${items.map((item) => `
          <li>
            <span>${escapeHtml(item.chave)}</span>
            <strong>${escapeHtml(String(item.total))}</strong>
          </li>
        `).join('')}
      </ol>
    </article>
  `;
}

function renderDashboardSeries(series) {
  const points = Array.isArray(series?.pontos) ? series.pontos : [];

  if (points.length === 0) {
    return `
      <article class="internal-dashboard-widget internal-dashboard-widget-wide">
        <h3>Serie semanal</h3>
        <p class="internal-list-message">Sem pontos semanais para exibir.</p>
      </article>
    `;
  }

  const max = Math.max(...points.map((point) => normalizeDashboardCount(point.total)), 1);

  return `
    <article class="internal-dashboard-widget internal-dashboard-widget-wide">
      <h3>Serie semanal</h3>
      <div class="internal-dashboard-series">
        ${points.map((point) => {
    const total = normalizeDashboardCount(point.total);
    const width = Math.max(6, Math.round((total / max) * 100));

    return `
          <div class="internal-dashboard-series-row">
            <span>${escapeHtml(point.periodo)}</span>
            <div class="internal-dashboard-bar-track" aria-hidden="true">
              <i style="width: ${width}%"></i>
            </div>
            <strong>${escapeHtml(String(total))}</strong>
          </div>
    `;
  }).join('')}
      </div>
    </article>
  `;
}

function getDashboardFilters(state) {
  const dashboard = state.dashboard || createDashboardState();
  const filters = dashboard.filters || {};

  return {
    source: safeText(filters.source, 'all') || 'all',
    status: safeText(filters.status, 'all') || 'all',
    prioridade: safeText(filters.prioridade, 'all') || 'all',
    tipo: safeText(filters.tipo, 'all') || 'all',
    dataInicio: normalizeRelatorioDateValue(filters.dataInicio),
    dataFim: normalizeRelatorioDateValue(filters.dataFim),
    mapMode: safeText(filters.mapMode, 'points') || 'points'
  };
}

function getDashboardMapFetchOptions(filters = {}) {
  const normalized = {
    status: safeText(filters.status, 'all') || 'all',
    prioridade: safeText(filters.prioridade, 'all') || 'all'
  };
  const options = {
    limit: MAPA_OCORRENCIAS_LIMIT,
    ativos: normalized.status === 'active'
  };

  if (normalized.status && !['all', 'active'].includes(normalized.status)) {
    options.status = normalized.status;
  }

  if (normalized.prioridade && normalized.prioridade !== 'all') {
    options.prioridade = normalized.prioridade;
  }

  return options;
}

function getOperationalMapItems(state) {
  const mapState = state.mapaOperacional || createOperationalMapState();
  if (mapState.status !== 'ready' || !Array.isArray(mapState.items)) {
    return [];
  }

  return mapState.items;
}

function getDashboardMapPoints(state) {
  const mapItems = getOperationalMapItems(state);
  if (mapItems.length > 0) {
    return mapItems
      .filter((item) => item && item.hasCoordinates && item.coordinates)
      .slice(0, MAPA_OCORRENCIAS_LIMIT);
  }

  const listState = state.solicitacoes || createSolicitacoesState();
  const items = Array.isArray(listState.items) ? listState.items : [];

  return items
    .filter((item) => item && item.hasCoordinates && item.coordinates)
    .slice(0, SOLICITACOES_PAGE_SIZE);
}

function getDashboardItemDateValue(item) {
  const candidates = [
    item?.criadoEmRaw,
    item?.atualizadoEmRaw,
    item?.criadoEm,
    item?.atualizadoEm
  ];

  for (const candidate of candidates) {
    const value = safeText(candidate, '');
    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      return isoMatch[1];
    }

    const localMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (localMatch) {
      return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
    }
  }

  return '';
}

function isDashboardItemInDateRange(item, filters) {
  const dataInicio = normalizeRelatorioDateValue(filters.dataInicio);
  const dataFim = normalizeRelatorioDateValue(filters.dataFim);

  if (!dataInicio && !dataFim) {
    return true;
  }

  const itemDate = getDashboardItemDateValue(item);
  if (!itemDate) {
    return false;
  }

  if (dataInicio && itemDate < dataInicio) {
    return false;
  }

  if (dataFim && itemDate > dataFim) {
    return false;
  }

  return true;
}

function getDashboardFilterOptions(state) {
  const points = getDashboardMapPoints(state);
  const typeKeys = Array.from(new Set(
    points
      .map((item) => item.tipoProblemaKey)
      .filter(Boolean)
  )).sort();

  return {
    sources: [
      { value: 'all', label: 'Todas as fontes' },
      { value: 'iluminacao', label: 'Iluminacao Publica' }
    ],
    statuses: [
      { value: 'all', label: 'Todos (incluindo finalizadas)' },
      { value: 'active', label: 'Todos (somente abertas/ativas)' },
      { value: 'aberta', label: 'Aberta' },
      { value: 'em_triagem', label: 'Em triagem' },
      { value: 'em_execucao', label: 'Em execucao' },
      { value: 'encaminhada', label: 'Encaminhada' },
      { value: 'resolvida', label: 'Resolvida' },
      { value: 'cancelada', label: 'Cancelada' },
      { value: 'indeferida', label: 'Indeferida' },
      { value: 'nao_localizado', label: 'Nao localizado' }
    ],
    prioridades: [
      { value: 'all', label: 'Todas' },
      { value: 'baixa', label: 'Baixa' },
      { value: 'normal', label: 'Normal' },
      { value: 'alta', label: 'Alta' },
      { value: 'urgente', label: 'Urgente' }
    ],
    tipos: [
      { value: 'all', label: 'Todos' },
      ...typeKeys.map((key) => ({
        value: key,
        label: formatProblemTypeLabel(key)
      }))
    ],
    mapModes: [
      { value: 'points', label: 'Pontos' },
      { value: 'heatmap', label: 'Calor' }
    ]
  };
}

function isDashboardMapPointVisible(item, filters) {
  if (filters.source !== 'all' && filters.source !== 'iluminacao') {
    return false;
  }

  if (filters.status === 'active' && terminalStatuses.includes(item.statusKey)) {
    return false;
  }

  if (!['all', 'active'].includes(filters.status) && item.statusKey !== filters.status) {
    return false;
  }

  if (filters.prioridade !== 'all' && item.prioridadeKey !== filters.prioridade) {
    return false;
  }

  if (filters.tipo !== 'all' && item.tipoProblemaKey !== filters.tipo) {
    return false;
  }

  if (!isDashboardItemInDateRange(item, filters)) {
    return false;
  }

  return true;
}

function getFilteredDashboardMapPoints(state) {
  const filters = getDashboardFilters(state);
  return getDashboardMapPoints(state)
    .filter((item) => isDashboardMapPointVisible(item, filters));
}

function getDashboardPointCounts(points, key) {
  return points.reduce((accumulator, item) => {
    const value = safeText(item[key], 'sem_informacao') || 'sem_informacao';
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}


function renderDashboardDateFilter(name, label, value) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input type="date" name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-dashboard-filter>
    </label>
  `;
}

function formatDashboardPeriodNote(filters = {}) {
  const dataInicio = normalizeRelatorioDateValue(filters.dataInicio);
  const dataFim = normalizeRelatorioDateValue(filters.dataFim);

  if (dataInicio && dataFim) {
    return `Período selecionado: ${dataInicio} a ${dataFim}`;
  }

  if (dataInicio) {
    return `Período selecionado: a partir de ${dataInicio}`;
  }

  if (dataFim) {
    return `Período selecionado: até ${dataFim}`;
  }

  return 'Tempo médio - total';
}

function renderDashboardFilterSelect(name, label, options, selectedValue) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" data-dashboard-filter>
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

function renderDashboardFilters(state) {
  const filters = getDashboardFilters(state);
  const options = getDashboardFilterOptions(state);

  return `
    <form class="internal-dashboard-filter-form" data-dashboard-filter-form>
      ${renderDashboardDateFilter('dataInicio', 'Data inicial', filters.dataInicio)}
      ${renderDashboardDateFilter('dataFim', 'Data final', filters.dataFim)}
      ${renderDashboardFilterSelect('source', 'Fonte', options.sources, filters.source)}
      ${renderDashboardFilterSelect('status', 'Status', options.statuses, filters.status)}
      ${renderDashboardFilterSelect('prioridade', 'Prioridade', options.prioridades, filters.prioridade)}
      ${renderDashboardFilterSelect('tipo', 'Tipo', options.tipos, filters.tipo)}
      ${renderDashboardFilterSelect('mapMode', 'Modo do mapa', options.mapModes, filters.mapMode)}
      <div class="internal-dashboard-filter-actions">
        <button type="submit" class="internal-secondary-action" value="apply">Atualizar período</button>
        <button type="submit" class="internal-secondary-action" value="reset" formnovalidate>Limpar filtros</button>
      </div>
      <p class="internal-dashboard-mode-help">Troque aqui entre Pontos e Calor. Use datas e filtros para recalcular indicadores e mapa, ou deixe em branco para o tempo total.</p>
    </form>
  `;
}

function renderDashboardStatusLegend(points, aggregateCounts = null) {
  const counts = aggregateCounts && typeof aggregateCounts === 'object'
    ? normalizeDashboardMap(aggregateCounts)
    : getDashboardPointCounts(points, 'statusKey');
  const entries = Object.entries(counts).filter(([, total]) => normalizeDashboardCount(total) > 0);

  if (entries.length === 0) {
    return '<p class="internal-muted-note">Sem ocorrencias visiveis para os filtros atuais.</p>';
  }

  return `
    <div class="internal-dashboard-status-legend">
      ${entries.map(([status, total]) => `
        <span>
          <i style="background: ${escapeHtml(getOperationalMapStatusColor(normalizeStatusKey(status)))}"></i>
          ${escapeHtml(formatStatusLabel(status))}
          <strong>${escapeHtml(String(normalizeDashboardCount(total)))}</strong>
        </span>
      `).join('')}
    </div>
  `;
}

function renderDashboardPrioritySummary(points, aggregateCounts = null, visibleTotal = null) {
  const counts = aggregateCounts && typeof aggregateCounts === 'object'
    ? normalizeDashboardMap(aggregateCounts)
    : getDashboardPointCounts(points, 'prioridadeKey');
  const priorities = ['urgente', 'alta', 'normal', 'baixa'];

  return `
    <dl class="internal-dashboard-quick-facts">
      <div>
        <dt>Ocorrencias visiveis</dt>
        <dd>${escapeHtml(String(Number.isInteger(visibleTotal) ? visibleTotal : points.length))}</dd>
      </div>
      ${priorities.map((priority) => `
        <div>
          <dt>${escapeHtml(formatPriorityLabel(priority))}</dt>
          <dd>${escapeHtml(String(counts[priority] || 0))}</dd>
        </div>
      `).join('')}
    </dl>
    <p class="internal-dashboard-priority-note">Prioridade altera tamanho, borda e halo dos pontos.</p>
  `;
}

function renderDashboardTerritorialPanel(state) {
  const allPoints = getDashboardMapPoints(state);
  const filteredPoints = getFilteredDashboardMapPoints(state);
  const filters = getDashboardFilters(state);
  const mapModeLabel = filters.mapMode === 'heatmap' ? 'Calor' : 'Pontos';
  const listState = state.solicitacoes || createSolicitacoesState();

  if (allPoints.length === 0) {
    const message = listState.status === 'ready'
      ? 'Solicitacoes recentes carregadas ainda nao possuem coordenadas validas para o mapa.'
      : 'Mapa territorial sera habilitado quando houver solicitacoes recentes com coordenadas carregadas.';

    return `
      <article class="internal-dashboard-map-card is-placeholder">
        <div class="internal-dashboard-widget-heading">
          <div>
            <h3>Mapa territorial dos servicos</h3>
            <p>Area preparada para ocorrencias georreferenciadas autorizadas.</p>
          </div>
          <span>Sem pontos</span>
        </div>
        <div class="internal-dashboard-map-placeholder" role="img" aria-label="Mapa territorial sem pontos carregados">
          <strong>Mapa territorial</strong>
          <p>${escapeHtml(message)}</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="internal-dashboard-map-card">
      <div class="internal-dashboard-widget-heading">
        <div>
          <h3>Mapa territorial dos servicos</h3>
          <p>Ocorrencias carregadas pela listagem operacional autorizada.</p>
        </div>
        <span>${escapeHtml(mapModeLabel)} - ${escapeHtml(String(filteredPoints.length))}/${escapeHtml(String(allPoints.length))} visiveis</span>
      </div>
      <div
        class="internal-dashboard-real-map"
        data-dashboard-map
        data-dashboard-map-mode="${escapeHtml(filters.mapMode)}"
        role="img"
        aria-label="Mapa cartografico com ocorrencias recentes carregadas"
      ></div>
    </article>
  `;
}
function renderDashboardPanel(state) {
  const dashboard = state.dashboard || createDashboardState();

  if (state.sessionState !== 'authenticated') {
    return `
      <section class="internal-module-workspace" aria-labelledby="dashboard-title">
        <div class="internal-section-heading">
          <h2 id="dashboard-title">Dashboard do Geoportal Interno</h2>
          <p>Visao geral dos servicos internos conforme suas permissoes.</p>
        </div>
        <article class="internal-state-card">
          <h3>Login interno necessario</h3>
          <p>Entre para visualizar os modulos e widgets liberados ao seu perfil.</p>
        </article>
      </section>
    `;
  }

  if (!canViewDashboardWidgets(state)) {
    return `
      <section class="internal-module-workspace" aria-labelledby="dashboard-title">
        <div class="internal-section-heading">
          <h2 id="dashboard-title">Dashboard do Geoportal Interno</h2>
          <p>Visao geral dos servicos internos conforme suas permissoes.</p>
        </div>
        <article class="internal-state-card">
          <h3>Sem widgets gerenciais liberados</h3>
          <p>Voce possui acesso aos modulos operacionais liberados. Selecione um modulo na lateral para iniciar.</p>
        </article>
      </section>
    `;
  }

  if (dashboard.status === 'loading') {
    return `
      <section class="internal-module-workspace" aria-labelledby="dashboard-title">
        <div class="internal-section-heading">
          <h2 id="dashboard-title">Dashboard do Geoportal Interno</h2>
          <p>Carregando indicadores do Dashboard geral.</p>
        </div>
        <article class="internal-state-card">
          <h3>Carregando dashboard</h3>
          <p>Buscando agregados internos sanitizados.</p>
        </article>
      </section>
    `;
  }

  if (dashboard.status === 'error') {
    return `
      <section class="internal-module-workspace" aria-labelledby="dashboard-title">
        <div class="internal-section-heading">
          <h2 id="dashboard-title">Dashboard do Geoportal Interno</h2>
          <p>Visao geral dos servicos internos conforme suas permissoes.</p>
        </div>
        <article class="internal-state-card is-warning">
          <h3>Dashboard indisponivel</h3>
          <p>${escapeHtml(dashboard.message || 'Nao foi possivel carregar os widgets agora.')}</p>
        </article>
      </section>
    `;
  }

  const resumo = dashboard.resumo || normalizeDashboardResumo({});
  const ranking = dashboard.ranking || normalizeDashboardRanking({});
  const series = dashboard.series || normalizeDashboardSeries({});
  const dashboardFilters = getDashboardFilters(state);
  const tempoMedioNote = formatDashboardPeriodNote(dashboardFilters);
  const filteredMapPoints = getFilteredDashboardMapPoints(state);

  return `
    <section class="internal-module-workspace internal-dashboard-workspace" aria-labelledby="dashboard-title">
      <div class="internal-section-heading internal-dashboard-title-row">
        <h2 id="dashboard-title">Dashboard do Geoportal Interno</h2>
        <p>Indicadores autorizados por modulo.</p>
      </div>

      <div class="internal-dashboard-hero">
        <div>
          <span>Painel consolidado</span>
          <h3>Indicadores autorizados por modulo</h3>
        </div>
        <strong>Iluminacao Publica na v1</strong>
      </div>

      <div class="internal-dashboard-kpi-grid">
        ${renderDashboardMetricCard('Total', resumo.total, 'Chamados', 'T')}
        ${renderDashboardMetricCard('Abertas', resumo.abertas, 'Aguardando acao', 'A')}
        ${renderDashboardMetricCard('Em triagem', resumo.em_triagem, 'Analise', 'T')}
        ${renderDashboardMetricCard('Em execucao', resumo.em_execucao, 'Campo', 'E')}
        ${renderDashboardMetricCard('Encaminhadas', resumo.encaminhadas, 'Direcionadas', 'N')}
        ${renderDashboardMetricCard('Finalizadas', resumo.finalizadas, 'Concluidas', 'F')}
        ${renderDashboardMetricCard('Atrasadas', resumo.atrasadas, 'Acompanhar', '!')}
        ${renderDashboardMetricCard('Tempo médio', formatDashboardSeconds(resumo.tempo_medio_resolucao_segundos), tempoMedioNote, 'M')}
      </div>

      <div class="internal-dashboard-territory-grid">
        ${renderDashboardTerritorialPanel(state)}
        <aside class="internal-dashboard-side-card" aria-label="Filtros e legenda do Dashboard">
          <div class="internal-dashboard-widget-heading">
            <div>
              <h3>Filtros e legenda</h3>
              <p>Recorte local sobre as ocorrencias carregadas.</p>
            </div>
            <span>Read-only</span>
          </div>
          ${renderDashboardFilters(state)}
          ${renderDashboardStatusLegend(filteredMapPoints, resumo.por_status)}
          ${renderDashboardPrioritySummary(filteredMapPoints, resumo.por_prioridade, resumo.total)}
        </aside>
      </div>

      <div class="internal-dashboard-widget-grid">
        ${renderDashboardBars('Chamados por status', resumo.por_status, formatStatusLabel)}
        ${renderDashboardBars('Chamados por prioridade', resumo.por_prioridade, formatPriorityLabel)}
        ${renderDashboardBars('Chamados por tipo', resumo.por_tipo, formatProblemTypeLabel)}
        ${renderDashboardRanking('Ranking de postes', ranking.top_postes, 'Nenhum poste agregado no recorte atual.')}
        ${renderDashboardRanking('Bairros/regioes', ranking.top_bairros, 'Bairros/regioes ainda nao disponiveis no cadastro atual.')}
        ${renderDashboardSeries(series)}
      </div>
    </section>
  `;
}

function getRelatorioValidationMessage(relatorioState) {
  return '';
}

function renderRelatorioSummaryCards(summary) {
  if (!summary) {
    return '';
  }

  const cards = [
    ['Total no periodo', summary.total],
    ['Abertas', summary.abertas],
    ['Em triagem', summary.em_triagem],
    ['Em andamento', summary.em_andamento],
    ['Resolvidas', summary.resolvidas],
    ['Canceladas', summary.canceladas],
    ['Indeferidas', summary.indeferidas],
    ['Nao localizadas', summary.nao_localizadas]
  ];

  return cards
    .map(([label, value]) => `
      <article class="internal-report-card">
        <strong>${escapeHtml(String(value))}</strong>
        <span>${escapeHtml(label)}</span>
      </article>
    `)
    .join('');
}

function renderRelatorioPanel(state) {
  if (!canViewRelatorio(state)) {
    return '';
  }

  const relatorio = state.relatorio || createRelatorioState();
  const isBusy = relatorio.summaryStatus === 'loading' || relatorio.exportStatus === 'submitting';

  return `
    <section class="internal-main-panel internal-report-panel" aria-labelledby="internal-report-title">
      <div class="internal-panel-header">
        <div>
          <h3 id="internal-report-title">Relatorio administrativo</h3>
          <p>
            Use datas para filtrar por periodo. Se deixar em branco, o relatorio sera geral.
          </p>
        </div>
        <span class="internal-pill">CSV v1</span>
      </div>

      <form class="internal-report-form" data-relatorio-form>
        <label>
          <span>Data inicial</span>
          <input type="date" name="data_inicio" value="${escapeHtml(relatorio.dataInicio)}" />
        </label>
        <label>
          <span>Data final</span>
          <input type="date" name="data_fim" value="${escapeHtml(relatorio.dataFim)}" />
        </label>
        <label>
          <span>Status</span>
          <select name="status">
            ${renderStatusFilterOptions(relatorio.statusFilter)}
          </select>
        </label>
        <label>
          <span>Prioridade</span>
          <select name="prioridade">
            ${renderPriorityFilterOptions(relatorio.prioridadeFilter)}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select name="tipo">
            ${renderProblemTypeFilterOptions(relatorio.tipoFilter)}
          </select>
        </label>
        <div class="internal-report-actions">
          <button
            type="submit"
            class="internal-secondary-action"
            name="relatorio_acao"
            value="resumo"
            ${!isBusy ? '' : 'disabled'}
          >
            Atualizar resumo
          </button>
          <button
            type="submit"
            class="internal-primary-action"
            name="relatorio_acao"
            value="csv"
            ${!isBusy ? '' : 'disabled'}
          >
            Exportar CSV
          </button>
        </div>
      </form>

      <p class="internal-list-message${relatorio.statusCode ? ' is-error' : ''}" role="status">
        ${escapeHtml(relatorio.message)}
      </p>

      ${relatorio.summary
        ? `
          <div class="internal-report-summary-grid">
            ${renderRelatorioSummaryCards(relatorio.summary)}
          </div>
        `
        : ''}
    </section>
  `;
}

function renderStatusOptions() {
  return statusOptions
    .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(formatStatusLabel(status))}</option>`)
    .join('');
}

function renderStatusFilterOptions(selectedValue = '') {
  return `
    <option value="">Todos os status</option>
    ${statusOptions
    .map((status) => `
      <option value="${escapeHtml(status)}" ${selectedValue === status ? 'selected' : ''}>
        ${escapeHtml(formatStatusLabel(status))}
      </option>
    `)
    .join('')}
  `;
}

function renderPriorityFilterOptions(selectedValue = '') {
  return `
    <option value="">Todas as prioridades</option>
    ${priorityOptions
    .map((priority) => `
      <option value="${escapeHtml(priority)}" ${selectedValue === priority ? 'selected' : ''}>
        ${escapeHtml(formatPriorityLabel(priority))}
      </option>
    `)
    .join('')}
  `;
}

function renderProblemTypeFilterOptions(selectedValue = '') {
  return `
    <option value="">Todos os tipos</option>
    ${Object.keys(problemTypeLabels)
    .map((problemType) => `
      <option value="${escapeHtml(problemType)}" ${selectedValue === problemType ? 'selected' : ''}>
        ${escapeHtml(formatProblemTypeLabel(problemType))}
      </option>
    `)
    .join('')}
  `;
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
      const label = allowed ? 'Permissão carregada' : 'Não carregada';

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
      <p>Permissões ainda não carregadas.</p>
      <p class="internal-muted-note">
        A lista técnica completa não é exibida na interface comum.
      </p>
    `;
  }

  const allowedModules = getAllowedModules(state);
  const modulesText = allowedModules.length > 0
    ? allowedModules.join(', ')
    : 'Nenhum módulo operacional permitido';

  return `
    <dl class="internal-safe-summary">
      <div>
        <dt>Sessão</dt>
        <dd>Autenticada</dd>
      </div>
      <div>
        <dt>Usuário</dt>
        <dd>#${escapeHtml(state.usuarioId)}</dd>
      </div>
      <div>
        <dt>Permissões carregadas</dt>
        <dd>${escapeHtml(state.permissions.length)}</dd>
      </div>
      <div>
        <dt>Módulos permitidos</dt>
        <dd>${escapeHtml(modulesText)}</dd>
      </div>
    </dl>
    <p class="internal-muted-note">
      A interface usa permissões apenas para orientar a navegação. A autorização real continua no backend.
    </p>
  `;
}

function renderListRouteAction(item) {
  if (!item.hasCoordinates || !item.coordinates) {
    return '';
  }

  const routeUrl = buildInternalGoogleMapsRouteUrl(item.coordinates);

  if (!routeUrl) {
    return '';
  }

  return `
    <a
      class="internal-route-action is-compact"
      href="${escapeHtml(routeUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      data-list-google-maps-route
    >
      Traçar rota
    </a>
    ${renderWhatsappDispatchCopyButton(routeUrl, item.protocolo, '', item.id)}
  `;
}

function renderMaintenanceStatusQuickForm(item, state) {
  if (!canUpdateStatus(state)) {
    return '';
  }

  if (!Number.isInteger(item.id) || item.id <= 0) {
    return '';
  }

  if (isTerminalStatus(item.statusKey)) {
    return `
      <p class="internal-maintenance-note">
        Status finalizado. Reabertura exige fluxo administrativo.
      </p>
    `;
  }

  const allowedStatuses = getAllowedNextStatuses(item.statusKey);

  if (allowedStatuses.length === 0) {
    return '';
  }

  return `
    <details class="internal-maintenance-status">
      <summary>Alterar fase</summary>
      <form
        class="internal-list-status-form"
        data-status-form
        data-list-status-form
        data-current-status="${escapeHtml(item.statusKey)}"
        data-solicitacao-id="${escapeHtml(item.id)}"
      >
        <label for="list-status-select-${escapeHtml(item.id)}">Nova fase</label>
        <select id="list-status-select-${escapeHtml(item.id)}" name="status" data-status-select>
          <option value="">Selecione</option>
          ${renderAllowedStatusOptions(item.statusKey, '')}
        </select>

        <label for="list-status-observacao-${escapeHtml(item.id)}">Justificativa</label>
        <textarea
          id="list-status-observacao-${escapeHtml(item.id)}"
          name="observacao"
          maxlength="${STATUS_OBSERVACAO_MAX_LENGTH}"
          data-status-observacao-textarea
          placeholder="Informe o motivo da alteração"
        ></textarea>

        <div class="internal-field-meta">
          <span data-status-counter>0/${STATUS_OBSERVACAO_MAX_LENGTH}</span>
          <span data-status-validation>Informe ao menos ${STATUS_OBSERVACAO_MIN_LENGTH} caracteres.</span>
        </div>

        <button type="submit" class="internal-primary-action" data-status-submit disabled>
          Atualizar fase
        </button>
        <p class="internal-form-message" data-list-status-message role="status"></p>
      </form>
    </details>
  `;
}

function renderMaintenanceObservationQuickForm(item, state) {
  if (!canCreateObservacao(state)) {
    return '';
  }

  if (!Number.isInteger(item.id) || item.id <= 0) {
    return '';
  }

  return `
    <details class="internal-maintenance-observation">
      <summary>Registrar observação</summary>
      <form
        class="internal-list-observation-form"
        data-observacao-form
        data-list-observacao-form
        data-solicitacao-id="${escapeHtml(item.id)}"
      >
        <label for="list-observacao-${escapeHtml(item.id)}">Observação interna</label>
        <textarea
          id="list-observacao-${escapeHtml(item.id)}"
          name="observacao"
          maxlength="${OBSERVACAO_MAX_LENGTH}"
          data-observacao-textarea
          placeholder="Ex.: troca realizada, potência da lâmpada ou material usado"
        ></textarea>

        <div class="internal-field-meta">
          <span data-observacao-counter>0/${OBSERVACAO_MAX_LENGTH}</span>
          <span data-observacao-validation>Informe ao menos ${OBSERVACAO_MIN_LENGTH} caracteres.</span>
        </div>

        <button type="submit" class="internal-secondary-action" data-observacao-submit disabled>
          Salvar observação
        </button>
        <p class="internal-form-message" data-list-observacao-message role="status"></p>
      </form>
    </details>
  `;
}

function renderMaintenanceSolicitacoesRows(items, state) {
  return items
    .map((item) => {
      const hasValidId = Number.isInteger(item.id) && item.id > 0;
      const detailButton = hasValidId
        ? `
          <button
            type="button"
            class="internal-row-action"
            data-action="load-solicitacao-detail"
            data-solicitacao-id="${escapeHtml(item.id)}"
          >
            Ver detalhe
          </button>
        `
        : '<button type="button" class="internal-row-action" disabled>Indisponível</button>';

      return `
        <article class="internal-maintenance-card" role="listitem">
          <div class="internal-maintenance-card-main">
            <div>
              <strong>${escapeHtml(item.protocolo)}</strong>
              <span>${escapeHtml(item.status)} - ${escapeHtml(item.prioridade)}</span>
            </div>
            <p>${escapeHtml(item.tipoProblema)}</p>
            <small>Poste ${escapeHtml(item.posteId)}</small>
          </div>

          <div class="internal-maintenance-actions" aria-label="Ações da solicitação">
            ${detailButton}
            ${renderListRouteAction(item)}
          </div>

          ${renderMaintenanceStatusQuickForm(item, state)}
          ${renderMaintenanceObservationQuickForm(item, state)}
        </article>
      `;
    })
    .join('');
}

function renderMaintenanceSolicitacoesCards(items, state) {
  return items
    .map((item) => {
      const hasValidId = Number.isInteger(item.id) && item.id > 0;
      const detailButton = hasValidId
        ? `
          <button
            type="button"
            class="internal-row-action"
            data-action="load-solicitacao-detail"
            data-solicitacao-id="${escapeHtml(item.id)}"
          >
            Ver detalhe
          </button>
        `
        : '<button type="button" class="internal-row-action" disabled>Indisponível</button>';

      return `
        <article class="internal-maintenance-card" role="listitem">
          <div class="internal-maintenance-card-main">
            <div>
              <strong>${escapeHtml(item.protocolo)}</strong>
              <span>${escapeHtml(item.status)} - ${escapeHtml(item.prioridade)}</span>
            </div>
            <p>${escapeHtml(item.tipoProblema)}</p>
            <small>Poste ${escapeHtml(item.posteId)}</small>
          </div>

          <div class="internal-maintenance-actions" aria-label="Ações da solicitação">
            ${detailButton}
            ${renderListRouteAction(item)}
          </div>

          ${renderMaintenanceStatusQuickForm(item, state)}
          ${renderMaintenanceObservationQuickForm(item, state)}
        </article>
      `;
    })
    .join('');
}

function renderSolicitacoesRows(items) {
  return items
    .map((item) => {
      const hasValidId = Number.isInteger(item.id) && item.id > 0;
      const actionButton = hasValidId
        ? `
          <button
            type="button"
            class="internal-row-action"
            data-action="load-solicitacao-detail"
            data-solicitacao-id="${escapeHtml(item.id)}"
          >
            Ver detalhe
          </button>
        `
        : '<button type="button" class="internal-row-action" disabled>Indisponível</button>';

      return `
      <div class="internal-table-row" role="row">
        <span data-label="Protocolo">${escapeHtml(item.protocolo)}</span>
        <span data-label="Status">${escapeHtml(item.status)}</span>
        <span data-label="Tipo">${escapeHtml(item.tipoProblema)}</span>
        <span data-label="Prioridade">${escapeHtml(item.prioridade)}</span>
        <span data-label="Poste">${escapeHtml(item.posteId)}</span>
        <span data-label="Criado em">${escapeHtml(item.criadoEm)}</span>
        <span data-label="Atualizado em">${escapeHtml(item.atualizadoEm)}</span>
        <span data-label="Duplicidade">${escapeHtml(item.duplicidadeSuspeita)}</span>
        <span data-label="Ações">${actionButton}</span>
      </div>
    `;
    })
    .join('');
}


function getSolicitacoesSortOptions() {
  return [
    { value: 'protocolo_desc', label: 'Protocolo mais recente' },
    { value: 'protocolo_asc', label: 'Protocolo mais antigo' },
    { value: 'status_asc', label: 'Status' },
    { value: 'prioridade_desc', label: 'Prioridade operacional' },
    { value: 'poste_asc', label: 'Poste' },
    { value: 'criado_desc', label: 'Criado em mais recente' },
    { value: 'criado_asc', label: 'Criado em mais antigo' },
    { value: 'atualizado_desc', label: 'Atualizado em mais recente' },
    { value: 'atualizado_asc', label: 'Atualizado em mais antigo' }
  ];
}

function getPrioritySortWeight(priorityKey) {
  return {
    urgente: 4,
    alta: 3,
    normal: 2,
    baixa: 1
  }[safeText(priorityKey, '').toLowerCase()] || 0;
}

function getProtocolSortNumber(protocolo) {
  const match = safeText(protocolo, '').match(/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function getSolicitacaoSortTime(item, key) {
  const rawValue = key === 'atualizado' ? item.atualizadoEmRaw : item.criadoEmRaw;
  const fallbackValue = key === 'atualizado' ? item.atualizadoEm : item.criadoEm;
  const rawTime = Date.parse(safeText(rawValue, ''));

  if (Number.isFinite(rawTime)) {
    return rawTime;
  }

  const fallback = safeText(fallbackValue, '').match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})/);
  if (!fallback) {
    return 0;
  }

  return Date.UTC(
    Number.parseInt(fallback[3], 10),
    Number.parseInt(fallback[2], 10) - 1,
    Number.parseInt(fallback[1], 10),
    Number.parseInt(fallback[4], 10),
    Number.parseInt(fallback[5], 10)
  );
}

function sortSolicitacoesItems(items, sortBy = 'protocolo_desc') {
  const sorted = [...items];

  sorted.sort((left, right) => {
    if (sortBy === 'protocolo_asc') {
      return getProtocolSortNumber(left.protocolo) - getProtocolSortNumber(right.protocolo);
    }

    if (sortBy === 'status_asc') {
      return left.status.localeCompare(right.status, 'pt-BR') || getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
    }

    if (sortBy === 'prioridade_desc') {
      return getPrioritySortWeight(right.prioridadeKey) - getPrioritySortWeight(left.prioridadeKey)
        || getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
    }

    if (sortBy === 'poste_asc') {
      return left.posteId.localeCompare(right.posteId, 'pt-BR', { numeric: true })
        || getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
    }

    if (sortBy === 'criado_desc') {
      return getSolicitacaoSortTime(right, 'criado') - getSolicitacaoSortTime(left, 'criado')
        || getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
    }

    if (sortBy === 'criado_asc') {
      return getSolicitacaoSortTime(left, 'criado') - getSolicitacaoSortTime(right, 'criado')
        || getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
    }

    if (sortBy === 'atualizado_desc') {
      return getSolicitacaoSortTime(right, 'atualizado') - getSolicitacaoSortTime(left, 'atualizado')
        || getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
    }

    if (sortBy === 'atualizado_asc') {
      return getSolicitacaoSortTime(left, 'atualizado') - getSolicitacaoSortTime(right, 'atualizado')
        || getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
    }

    return getProtocolSortNumber(right.protocolo) - getProtocolSortNumber(left.protocolo);
  });

  return sorted;
}

function applySolicitacoesSort(listState) {
  if (listState.status !== 'ready' || !Array.isArray(listState.items)) {
    return listState;
  }

  return {
    ...listState,
    items: sortSolicitacoesItems(listState.items, listState.sortBy)
  };
}

function renderSolicitacoesSortControl(listState, canLoad, isLoading) {
  const sortBy = safeText(listState.sortBy, 'protocolo_desc') || 'protocolo_desc';

  return `
    <label class="internal-list-sort-control">
      <span>Ordenar protocolos</span>
      <select name="sortBy" data-solicitacoes-sort ${canLoad && !isLoading ? '' : 'disabled'}>
        ${getSolicitacoesSortOptions().map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === sortBy ? 'selected' : ''}>${escapeHtml(option.label)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

function renderSolicitacoesTable(listState, state) {
  if (listState.status === 'loading') {
    return `
      <div class="internal-table-empty" role="row">
        Carregando solicitações internas somente leitura...
      </div>
    `;
  }

  if (listState.status === 'empty') {
    return `
      <div class="internal-table-empty" role="row">
        Nenhuma solicitação encontrada para esta página.
      </div>
    `;
  }

  if (listState.status === 'ready') {
    if (isMaintenanceLikeUser(state.permissions || [])) {
      const activeItems = listState.items.filter((item) => !isTerminalStatus(item.statusKey));

      if (activeItems.length === 0) {
        return `
          <div class="internal-table-empty" role="listitem">
            Nenhuma solicitação ativa nesta página. Chamados finalizados ficam fora da visão de manutenção.
          </div>
        `;
      }

      return renderMaintenanceSolicitacoesCards(activeItems, state);
    }

    return renderSolicitacoesRows(listState.items);
  }

  return `
    <div class="internal-table-empty" role="row">
      ${escapeHtml(listState.message || 'Listagem aguardando autenticação e permissão.')}
    </div>
  `;
}

function getSolicitacoesStatusText(listState, maintenanceMode = false) {
  if (listState.status === 'loading') {
    return 'Carregando';
  }

  if (listState.status === 'ready' || listState.status === 'empty') {
    if (maintenanceMode && Array.isArray(listState.items)) {
      const activeCount = listState.items.filter((item) => !isTerminalStatus(item.statusKey)).length;
      return `${activeCount} ativo(s) nesta página`;
    }

    return `${listState.total} registro(s)`;
  }

  if (listState.statusCode) {
    return `Código ${listState.statusCode}`;
  }

  return 'Aguardando';
}

function mergeOperationalMapSelectionIds(currentIds = [], nextIds = []) {
  const merged = [];
  [...currentIds, ...nextIds].forEach((id) => {
    const normalizedId = Number(id);
    if (Number.isInteger(normalizedId) && normalizedId > 0 && !merged.includes(normalizedId)) {
      merged.push(normalizedId);
    }
  });
  return merged;
}

function areOperationalMapIdListsEqual(left = [], right = []) {
  const normalizedLeft = mergeOperationalMapSelectionIds([], left);
  const normalizedRight = mergeOperationalMapSelectionIds([], right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((id, index) => id === normalizedRight[index]);
}

function getOperationalMapViewState(map) {
  if (!map || typeof map.getView !== 'function') {
    return null;
  }

  const view = map.getView();
  const center = view.getCenter();
  const zoom = view.getZoom();

  return Array.isArray(center) && center.length >= 2
    ? { center: [Number(center[0]), Number(center[1])], zoom: Number(zoom) }
    : null;
}

function getOperationalMapVisibleIds(map, items = []) {
  if (!map || typeof map.getView !== 'function' || typeof map.getSize !== 'function') {
    return [];
  }

  const size = map.getSize();
  if (!Array.isArray(size) || size.length < 2 || size.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0)) {
    return [];
  }

  const extent = map.getView().calculateExtent(size);
  if (!Array.isArray(extent) || extent.length < 4) {
    return [];
  }

  return items
    .filter((item) => item.hasCoordinates && item.coordinates)
    .filter((item) => {
      const coordinate = fromLonLat([item.coordinates.longitude, item.coordinates.latitude]);
      return coordinate[0] >= extent[0]
        && coordinate[0] <= extent[2]
        && coordinate[1] >= extent[1]
        && coordinate[1] <= extent[3];
    })
    .map((item) => item.id)
    .filter((id) => Number.isInteger(id) && id > 0);
}

function filterSolicitacoesByMapSelection(listState, mapState) {
  const selectedIds = Array.isArray(mapState?.selectedIds)
    ? mapState.selectedIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  const selectionMode = ['selection', 'viewport'].includes(mapState?.selectionMode)
    ? mapState.selectionMode
    : selectedIds.length > 0 ? 'selection' : '';

  if (!selectionMode || listState.status !== 'ready') {
    return listState;
  }

  const selectedSet = new Set(selectedIds);
  const items = (listState.items || []).filter((item) => selectedSet.has(item.id));

  return {
    ...listState,
    items,
    total: items.length,
    status: items.length > 0 ? 'ready' : 'empty',
    message: items.length > 0
      ? selectionMode === 'viewport'
        ? 'Lista filtrada pelos pontos visíveis no mapa na página atual.'
        : 'Lista filtrada pela seleção do mapa na página atual.'
      : selectionMode === 'viewport'
        ? 'Nenhuma solicitação da página atual está visível no recorte atual do mapa.'
        : 'Nenhuma solicitação da página atual corresponde à seleção do mapa.'
  };
}

function renderOperationalMapStatus(mapState) {
  if (mapState.statusCode) {
    return `Código ${mapState.statusCode}`;
  }

  if (mapState.status === 'ready' || mapState.status === 'empty') {
    return `${mapState.total} ponto(s)`;
  }

  if (mapState.status === 'loading') {
    return 'Carregando';
  }

  return 'Aguardando';
}

function renderOperationalMapFilterOptions(options, selectedValue) {
  return options.map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>
  `).join('');
}

function renderMapaOcorrenciaPopup(popupState = createOperationalMapState().popup) {
  if (popupState.status === 'loading') {
    return '<p class="internal-operational-popup-message">Carregando resumo do ponto selecionado...</p>';
  }

  if (popupState.status === 'idle') {
    return `<p class="internal-operational-popup-message">${escapeHtml(popupState.message)}</p>`;
  }

  if (popupState.status !== 'ready' || !popupState.item) {
    return `<p class="internal-operational-popup-message is-error">${escapeHtml(popupState.message || 'Popup indisponível.')}</p>`;
  }

  const item = popupState.item;
  const hasContact = Boolean(item.nomeSolicitante || item.contatoSolicitante);

  return `
    <article class="internal-operational-popup-card">
      <div class="internal-operational-popup-heading">
        <span>Protocolo</span>
        <strong>${escapeHtml(item.protocolo)}</strong>
      </div>
      <dl class="internal-operational-popup-list">
        <div><dt>Status</dt><dd>${escapeHtml(item.status)}</dd></div>
        <div><dt>Prioridade</dt><dd>${escapeHtml(item.prioridade)}</dd></div>
        <div><dt>Poste</dt><dd>${escapeHtml(item.posteId)}</dd></div>
        <div><dt>Localização</dt><dd>${escapeHtml(item.referenciaLocalizacao)}</dd></div>
      </dl>
      ${hasContact ? `
        <div class="internal-operational-popup-contact">
          <strong>Contato autorizado</strong>
          ${item.nomeSolicitante ? `<span>${escapeHtml(item.nomeSolicitante)}</span>` : ''}
          ${item.contatoSolicitante ? `<span>${escapeHtml(item.contatoSolicitante)}</span>` : ''}
        </div>
      ` : `
        <p class="internal-operational-popup-message">Contato não disponível para este perfil.</p>
      `}
      <button
        type="button"
        class="internal-row-action"
        data-action="load-solicitacao-detail"
        data-solicitacao-id="${escapeHtml(item.id)}"
      >
        Abrir detalhe interno
      </button>
      ${renderWhatsappDispatchCopyButton(item.routeUrl, item.protocolo, item.nomeSolicitante, item.id)}
    </article>
  `;
}

function renderOperationalMapCanvas(mapState) {
  if (mapState.status === 'ready' && mapState.items.length > 0) {
    return `
      <div
        class="internal-dashboard-real-map internal-operational-map-canvas"
        data-internal-operational-map
        role="img"
        aria-label="Mapa cartografico com pontos de chamados de Iluminação Pública"
      ></div>
    `;
  }

  const message = mapState.status === 'loading'
    ? 'Carregando pontos do mapa...'
    : mapState.status === 'empty'
    ? 'Nenhum ponto com coordenada para este filtro.'
    : mapState.status === 'forbidden'
    ? 'Sem permissão para visualizar o mapa operacional.'
    : mapState.status === 'error'
    ? mapState.message
    : 'Use Atualizar mapa ou aplique filtros para carregar os pontos.';

  return `
    <div class="internal-dashboard-map-placeholder internal-operational-map-placeholder" role="img" aria-label="Mapa operacional sem pontos carregados">
      <strong>Mapa operacional</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderInternalOperationalMapPanel(state) {
  const mapState = state.mapaOperacional || createOperationalMapState();
  const canLoad = canListSolicitacoes(state);
  const isLoading = mapState.status === 'loading';
  const selectedCount = Array.isArray(mapState.selectedIds) ? mapState.selectedIds.length : 0;
  const filters = mapState.filters || createOperationalMapState().filters;
  const statusOptionsForMap = [
    { value: '', label: 'Todos' },
    ...statusOptions.map((status) => ({ value: status, label: formatStatusLabel(status) }))
  ];
  const priorityOptionsForMap = [
    { value: '', label: 'Todas' },
    ...priorityOptions.map((priority) => ({ value: priority, label: formatPriorityLabel(priority) }))
  ];
  const visiblePoints = mapState.status === 'ready' ? mapState.items.length : 0;
  const selectionMode = ['selection', 'viewport'].includes(mapState.selectionMode) ? mapState.selectionMode : '';
  const selectionLabel = selectionMode === 'viewport'
    ? `${selectedCount} ponto(s) visível(is) no mapa filtrando a lista carregada.`
    : `${selectedCount} ponto(s) selecionado(s). A lista abaixo mostra correspondências da página atual.`;
  const clearSelectionLabel = selectionMode === 'viewport' ? 'Limpar filtro do mapa' : 'Limpar seleção do mapa';

  return `
    <section class="internal-main-panel internal-operational-map-panel" aria-label="Mapa operacional de Iluminação Pública">
      <div class="internal-panel-header">
        <div>
          <h3>Mapa operacional</h3>
          <p>Chamados com coordenadas, sem dados pessoais na coleção de pontos.</p>
        </div>
        <span class="internal-pill">${escapeHtml(renderOperationalMapStatus(mapState))}</span>
      </div>

      <form class="internal-operational-map-filters" data-operational-map-filter-form>
        <label>
          <span>Status</span>
          <select name="status" ${canLoad && !isLoading ? '' : 'disabled'}>
            ${renderOperationalMapFilterOptions(statusOptionsForMap, filters.status || '')}
          </select>
        </label>
        <label>
          <span>Prioridade</span>
          <select name="prioridade" ${canLoad && !isLoading ? '' : 'disabled'}>
            ${renderOperationalMapFilterOptions(priorityOptionsForMap, filters.prioridade || '')}
          </select>
        </label>
        <label>
          <span>Limite</span>
          <input name="limit" type="number" min="1" max="500" value="${escapeHtml(filters.limit || MAPA_OCORRENCIAS_LIMIT)}" ${canLoad && !isLoading ? '' : 'disabled'}>
        </label>
        <label class="internal-operational-map-check">
          <input name="ativos" type="checkbox" value="true" ${filters.ativos ? 'checked' : ''} ${canLoad && !isLoading ? '' : 'disabled'}>
          <span>Somente ativos</span>
        </label>
        <div class="internal-operational-map-actions">
          <button type="submit" class="internal-secondary-action" value="apply" ${canLoad && !isLoading ? '' : 'disabled'}>Aplicar filtros</button>
          <button type="submit" class="internal-secondary-action" value="reset" ${canLoad && !isLoading ? '' : 'disabled'}>Limpar tudo</button>
          <button type="button" class="internal-secondary-action" data-action="refresh-operational-map" ${canLoad && !isLoading ? '' : 'disabled'}>Atualizar mapa</button>
          <button type="button" class="internal-secondary-action" data-action="filter-operational-map-visible" ${canLoad && !isLoading && mapState.status === 'ready' && mapState.items.length > 0 ? '' : 'disabled'}>Filtrar lista pelo mapa visível</button>
        </div>
      </form>

      ${selectedCount > 0 ? `
        <div class="internal-map-selection-bar" role="status">
          <span>${escapeHtml(selectionLabel)}</span>
          <button type="button" class="internal-secondary-action" data-action="clear-operational-map-selection">${escapeHtml(clearSelectionLabel)}</button>
        </div>
      ` : ''}

      <div class="internal-dashboard-territory-grid internal-operational-map-grid">
        <article class="internal-dashboard-map-card internal-operational-map-shell">
          <div class="internal-dashboard-widget-heading">
            <div>
              <h3>Mapa operacional do módulo</h3>
              <p>Mesma base cartográfica do Dashboard, filtrada pelas ocorrências autorizadas de Iluminação.</p>
            </div>
            <span>Pontos - ${escapeHtml(String(visiblePoints))}/${escapeHtml(String(mapState.total || visiblePoints))} visíveis</span>
          </div>
          ${renderOperationalMapCanvas(mapState)}
          <div class="internal-map-legend" aria-label="Legenda de status">
            ${statusOptions.slice(0, 6).map((status) => `
              <span><i style="background:${escapeHtml(getOperationalMapStatusColor(status))}" aria-hidden="true"></i>${escapeHtml(formatStatusLabel(status))}</span>
            `).join('')}
          </div>
        </article>
        <aside class="internal-dashboard-side-card internal-operational-popup" data-internal-operational-popup aria-label="Resumo do ponto selecionado">
          <div class="internal-dashboard-widget-heading">
            <div>
              <h3>Resumo do ponto</h3>
              <p>Contato aparece somente se o backend liberar para o perfil.</p>
            </div>
            <span>Popup</span>
          </div>
          ${renderMapaOcorrenciaPopup(mapState.popup)}
        </aside>
      </div>

      <p class="internal-list-message" role="status">${escapeHtml(mapState.message)}</p>
    </section>
  `;
}

function renderSolicitacoesPanel(state) {
  const listState = state.solicitacoes || createSolicitacoesState();
  const mapState = state.mapaOperacional || createOperationalMapState();
  const visibleListState = applySolicitacoesSort(filterSolicitacoesByMapSelection(listState, mapState));
  const selectedMapCount = Array.isArray(mapState.selectedIds) ? mapState.selectedIds.length : 0;
  const mapSelectionMode = ['selection', 'viewport'].includes(mapState.selectionMode) ? mapState.selectionMode : '';
  const mapSelectionMessage = mapSelectionMode === 'viewport'
    ? `Filtro ativo pelo mapa visível: ${selectedMapCount} ponto(s) na página/lista carregada.`
    : `Filtro ativo por seleção do mapa: ${selectedMapCount} ponto(s).`;
  const clearMapSelectionLabel = mapSelectionMode === 'viewport' ? 'Limpar filtro' : 'Limpar seleção';
  const maintenanceMode = isMaintenanceLikeUser(state.permissions || []);
  const canLoad = state.sessionState === 'authenticated'
    && hasPermission(state, PERMISSIONS.iluminacaoRead);
  const isLoading = listState.status === 'loading';
  const previousOffset = Math.max(0, listState.offset - SOLICITACOES_PAGE_SIZE);
  const nextOffset = listState.offset + listState.limit;
  const hasPrevious = canLoad && listState.offset > 0 && !isLoading;
  const hasNext = canLoad && nextOffset < listState.total && !isLoading;
  const effectiveTableLabel = canLoad && maintenanceMode
    ? 'Lista compacta de solicitações para manutenção'
    : canLoad
    ? 'Lista somente leitura de solicitações internas'
    : 'Listagem bloqueada até autenticação e permissão';
  const tableLabel = canLoad
    ? 'Lista somente leitura de solicitações internas'
    : 'Listagem bloqueada até autenticação e permissão';

  return `
    <section class="internal-main-panel" aria-label="Solicitações internas">
      <div class="internal-panel-header">
        <div>
          <h3>Solicitações</h3>
          <p>
            Lista operacional com campos essenciais. Dados pessoais e coordenadas ficam apenas no detalhe quando necessário.
          </p>
        </div>
        <span class="internal-pill">Somente leitura</span>
      </div>

      <div class="internal-list-toolbar" aria-label="Controles da listagem">
        <div>
          <strong>${escapeHtml(getSolicitacoesStatusText(visibleListState, maintenanceMode))}</strong>
          <span>
            Página com até ${escapeHtml(listState.limit)} registros
          </span>
        </div>
        ${renderSolicitacoesSortControl(listState, canLoad, isLoading)}
        <div class="internal-list-actions">
          <button
            type="button"
            class="internal-secondary-action"
            data-action="previous-solicitacoes"
            data-offset="${escapeHtml(previousOffset)}"
            ${hasPrevious ? '' : 'disabled'}
          >
            Página anterior
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
            Próxima página
          </button>
        </div>
      </div>

      <p class="internal-list-message" role="status">
        ${escapeHtml(visibleListState.message)}
      </p>

      ${selectedMapCount > 0 ? `
        <div class="internal-map-selection-inline" role="status">
          <span>${escapeHtml(mapSelectionMessage)}</span>
          <button type="button" class="internal-secondary-action" data-action="clear-operational-map-selection">
            ${escapeHtml(clearMapSelectionLabel)}
          </button>
        </div>
      ` : ''}

      <div class="internal-table-wrap${maintenanceMode ? ' internal-maintenance-list-wrap' : ''}">
        <div
          class="internal-table-shell${maintenanceMode ? ' internal-maintenance-list' : ''}"
          role="${maintenanceMode ? 'list' : 'table'}"
          aria-label="${escapeHtml(effectiveTableLabel)}"
        >
          ${maintenanceMode ? '' : `
          <div class="internal-table-row internal-table-head" role="row">
            <span>Protocolo</span>
            <span>Status</span>
            <span>Tipo</span>
            <span>Prioridade</span>
            <span>Poste</span>
            <span>Criado em</span>
            <span>Atualizado em</span>
            <span>Duplicidade</span>
            <span>Ações</span>
          </div>
          `}
          ${renderSolicitacoesTable(visibleListState, state)}
        </div>
      </div>
    </section>
  `;
}

function renderDetailDefinitionList(items) {
  return `
    <dl>
      ${items.map((item) => `
        <div>
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderHistoricoItems(items) {
  return items
    .map((event) => `
      <li class="internal-history-event">
        <div class="internal-history-event-header">
          <strong>${escapeHtml(event.acao)}</strong>
          <time>${escapeHtml(event.criadoEm)}</time>
        </div>
        <dl>
          <div>
            <dt>Origem</dt>
            <dd>${escapeHtml(event.origemAcao)}</dd>
          </div>
          <div>
            <dt>Usuário</dt>
            <dd>${escapeHtml(event.usuario)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>${escapeHtml(event.statusAnterior)} para ${escapeHtml(event.statusNovo)}</dd>
          </div>
          <div>
            <dt>Prioridade</dt>
            <dd>${escapeHtml(event.prioridadeAnterior)} para ${escapeHtml(event.prioridadeNova)}</dd>
          </div>
        </dl>
        ${event.observacaoResumida
          ? `<p class="internal-history-note">${escapeHtml(event.observacaoResumida)}</p>`
          : ''}
      </li>
    `)
    .join('');
}

function renderHistoricoPanel(state, detail) {
  const historico = detail.historico || createHistoricoState();
  const hasLoadedDetail = detail.status === 'loaded' && detail.item;
  const hasHistoryPermission = canViewHistorico(state);
  const isLoading = historico.status === 'loading';
  const previousOffset = Math.max(0, historico.offset - HISTORICO_PAGE_SIZE);
  const nextOffset = historico.offset + historico.limit;
  const hasPrevious = hasLoadedDetail && hasHistoryPermission && historico.offset > 0 && !isLoading;
  const hasNext = hasLoadedDetail && hasHistoryPermission && nextOffset < historico.total && !isLoading;
  const canLoad = hasLoadedDetail && hasHistoryPermission && !isLoading;

  if (!hasHistoryPermission) {
    return `
      <article class="internal-card internal-history-card">
        <h3>Histórico</h3>
        <p>Histórico indisponível para este perfil.</p>
        <p class="internal-muted-note">
          A permissão de histórico é exigida para esta consulta.
        </p>
      </article>
    `;
  }

  const statusText = historico.statusCode
    ? `Código ${historico.statusCode}`
    : `${historico.total} evento(s)`;

  return `
    <article class="internal-card internal-history-card">
      <div class="internal-history-heading">
        <div>
          <h3>Histórico</h3>
          <p>Linha do tempo carregada sob demanda.</p>
        </div>
        <span class="internal-pill">Sob demanda</span>
      </div>

      <div class="internal-list-toolbar" aria-label="Controles do histórico">
        <div>
          <strong>${escapeHtml(statusText)}</strong>
          <span>Página com até ${escapeHtml(historico.limit)} eventos</span>
        </div>
        <div class="internal-list-actions">
          <button
            type="button"
            class="internal-secondary-action"
            data-action="previous-historico"
            data-offset="${escapeHtml(previousOffset)}"
            ${hasPrevious ? '' : 'disabled'}
          >
            Página anterior
          </button>
          <button
            type="button"
            class="internal-secondary-action"
            data-action="load-historico"
            data-offset="${escapeHtml(historico.offset)}"
            ${canLoad ? '' : 'disabled'}
          >
            ${historico.status === 'idle' ? 'Ver histórico' : 'Atualizar histórico'}
          </button>
          <button
            type="button"
            class="internal-secondary-action"
            data-action="next-historico"
            data-offset="${escapeHtml(nextOffset)}"
            ${hasNext ? '' : 'disabled'}
          >
            Próxima página
          </button>
        </div>
      </div>

      <p class="internal-list-message" role="status">
        ${escapeHtml(historico.message)}
      </p>

      ${historico.status === 'loading'
        ? '<div class="internal-table-empty">Carregando histórico somente leitura...</div>'
        : ''}
      ${historico.status === 'empty'
        ? '<div class="internal-table-empty">Nenhum evento de histórico encontrado.</div>'
        : ''}
      ${historico.status === 'ready'
        ? `<ol class="internal-timeline">${renderHistoricoItems(historico.items)}</ol>`
        : ''}
    </article>
  `;
}

function renderObservacoesItems(items) {
  return items
    .map((observacao) => `
      <article class="internal-observation-card">
        <div class="internal-history-event-header">
          <strong>${escapeHtml(observacao.usuario)}</strong>
          <time>${escapeHtml(observacao.criadoEm)}</time>
        </div>
        <p class="internal-observation-text">
          ${escapeHtml(observacao.texto)}
        </p>
        <dl>
          <div>
            <dt>Visibilidade</dt>
            <dd>${escapeHtml(observacao.visibilidade)}</dd>
          </div>
          <div>
            <dt>Edição</dt>
            <dd>${escapeHtml(observacao.foiEditada ? observacao.editadoEm : 'Não editada')}</dd>
          </div>
        </dl>
      </article>
    `)
    .join('');
}

function renderObservacaoCreatePanel(state, detail) {
  const formState = detail.observacaoForm || createObservacaoFormState();
  const hasCommentPermission = canCreateObservacao(state);
  const hasLoadedDetail = detail.status === 'loaded' && detail.item;

  if (!hasCommentPermission) {
    return `
      <section class="internal-observation-form-panel internal-action-card" aria-label="Criação de observação interna indisponível">
        <h4>Nova observação interna</h4>
        <p>Criação de observação indisponível para este perfil.</p>
        <p class="internal-muted-note">
          É necessário ter permissão para comentar nesta solicitação.
        </p>
      </section>
    `;
  }

  const normalizedLength = normalizeObservacaoInput(formState.value).length;
  const validationMessage = getObservacaoValidationMessage(formState.value);
  const isSubmitting = formState.status === 'submitting';
  const canSubmit = hasLoadedDetail && !validationMessage && !isSubmitting;
  const messageClass = formState.status === 'error'
    ? ' is-error'
    : formState.status === 'success'
      ? ' is-success'
      : '';

  return `
    <section class="internal-observation-form-panel internal-action-card" aria-label="Criação de observação interna">
      <h4>Nova observação interna</h4>
      <p class="internal-sensitive-note">
        Texto livre operacional interno. Não inclua dados desnecessários ou informação fora do atendimento.
      </p>
      <form class="internal-observation-form" data-observacao-form>
        <label for="internal-new-observacao">
          Observação
          <textarea
            id="internal-new-observacao"
            name="observacao"
            data-observacao-textarea
            rows="5"
            placeholder="Registre uma observação operacional interna"
            aria-describedby="internal-new-observacao-help internal-new-observacao-counter"
            ${isSubmitting ? 'disabled' : ''}
          >${escapeHtml(formState.value)}</textarea>
        </label>
        <div class="internal-observation-form-footer">
          <span id="internal-new-observacao-counter" data-observacao-counter>
            ${escapeHtml(normalizedLength)}/${escapeHtml(OBSERVACAO_MAX_LENGTH)}
          </span>
          <span id="internal-new-observacao-help" data-observacao-validation>
            ${escapeHtml(validationMessage || 'Pronto para salvar como observação interna.')}
          </span>
        </div>
        <button
          type="submit"
          class="internal-secondary-action"
          data-observacao-submit
          ${canSubmit ? '' : 'disabled'}
        >
          ${isSubmitting ? 'Salvando observação...' : 'Salvar observação'}
        </button>
        <p class="internal-form-message${messageClass}" role="status">
          ${escapeHtml(formState.message)}
        </p>
      </form>
      <p class="internal-muted-note">
        Salvar uma observação não altera o status do chamado.
      </p>
    </section>
  `;
}

function renderObservacoesPanel(state, detail) {
  const observacoes = detail.observacoes || createObservacoesState();
  const hasLoadedDetail = detail.status === 'loaded' && detail.item;
  const hasObservationsPermission = canViewObservacoes(state);
  const hasCommentPermission = canCreateObservacao(state);
  const isLoading = observacoes.status === 'loading';
  const previousOffset = Math.max(0, observacoes.offset - OBSERVACOES_PAGE_SIZE);
  const nextOffset = observacoes.offset + observacoes.limit;
  const hasPrevious = hasLoadedDetail && hasObservationsPermission && observacoes.offset > 0 && !isLoading;
  const hasNext = hasLoadedDetail && hasObservationsPermission && nextOffset < observacoes.total && !isLoading;
  const canLoad = hasLoadedDetail && hasObservationsPermission && !isLoading;

  if (!hasObservationsPermission && !hasCommentPermission) {
    return `
      <article class="internal-card internal-observations-card">
        <h3>Observações internas</h3>
        <p>Observações indisponíveis para este perfil.</p>
        <p class="internal-muted-note">
          Seu perfil precisa permitir leitura ou registro de observações internas.
        </p>
      </article>
    `;
  }

  const statusText = observacoes.statusCode
    ? `Código ${observacoes.statusCode}`
    : `${observacoes.total} observação(ões)`;

  return `
    <article class="internal-card internal-observations-card">
      <div class="internal-history-heading">
        <div>
          <h3>Observações internas</h3>
          <p>Leitura sob demanda de registros internos do atendimento.</p>
        </div>
        <span class="internal-pill">Sob demanda</span>
      </div>

      ${hasObservationsPermission
        ? `
          <div class="internal-list-toolbar" aria-label="Controles das observações internas">
            <div>
              <strong>${escapeHtml(statusText)}</strong>
              <span>Página com até ${escapeHtml(observacoes.limit)} observações</span>
            </div>
            <div class="internal-list-actions">
              <button
                type="button"
                class="internal-secondary-action"
                data-action="previous-observacoes"
                data-offset="${escapeHtml(previousOffset)}"
                ${hasPrevious ? '' : 'disabled'}
              >
                Página anterior
              </button>
              <button
                type="button"
                class="internal-secondary-action"
                data-action="load-observacoes"
                data-offset="${escapeHtml(observacoes.offset)}"
                ${canLoad ? '' : 'disabled'}
              >
                ${observacoes.status === 'idle' ? 'Ver observações' : 'Atualizar observações'}
              </button>
              <button
                type="button"
                class="internal-secondary-action"
                data-action="next-observacoes"
                data-offset="${escapeHtml(nextOffset)}"
                ${hasNext ? '' : 'disabled'}
              >
                Próxima página
              </button>
            </div>
          </div>

          <p class="internal-list-message" role="status">
            ${escapeHtml(observacoes.message)}
          </p>
          <p class="internal-sensitive-note">
            Observação é texto livre operacional interno. Evite dados desnecessários.
          </p>

          ${observacoes.status === 'loading'
            ? '<div class="internal-table-empty">Carregando observações somente leitura...</div>'
            : ''}
          ${observacoes.status === 'empty'
            ? '<div class="internal-table-empty">Nenhuma observação interna encontrada.</div>'
            : ''}
          ${observacoes.status === 'ready'
            ? `<div class="internal-observations-list">${renderObservacoesItems(observacoes.items)}</div>`
            : ''}
        `
        : `
          <p>Leitura de observações indisponível para este perfil.</p>
          <p class="internal-muted-note">
            É necessário ter permissão para consultar observações internas.
          </p>
        `}

      ${renderObservacaoCreatePanel(state, detail)}
    </article>
  `;
}

function renderAllowedStatusOptions(currentStatus, selectedStatus) {
  return getAllowedNextStatuses(currentStatus)
    .map((status) => `
      <option value="${escapeHtml(status)}" ${selectedStatus === status ? 'selected' : ''}>
        ${escapeHtml(formatStatusLabel(status))}
      </option>
    `)
    .join('');
}

function renderStatusCorrectionOptions(currentStatus, selectedStatus) {
  return statusOptions
    .map((status) => {
      const disabled = status === currentStatus ? 'disabled' : '';
      const selected = selectedStatus === status ? 'selected' : '';

      return `
        <option value="${escapeHtml(status)}" ${selected} ${disabled}>
          ${escapeHtml(formatStatusLabel(status))}
        </option>
      `;
    })
    .join('');
}

function renderPriorityOptions(currentPriority, selectedPriority) {
  return priorityOptions
    .map((priority) => {
      const disabled = priority === currentPriority ? 'disabled' : '';
      const selected = selectedPriority === priority ? 'selected' : '';

      return `
        <option value="${escapeHtml(priority)}" ${selected} ${disabled}>
          ${escapeHtml(formatPriorityLabel(priority))}
        </option>
      `;
    })
    .join('');
}

function renderPriorityUpdatePanel(state, detail) {
  const formState = detail.prioridadeForm || createPrioridadeFormState();
  const hasPriorityPermission = canUpdatePrioridade(state);
  const hasLoadedDetail = detail.status === 'loaded' && detail.item;
  const currentPriority = hasLoadedDetail ? detail.item.prioridadeKey : '';
  const currentStatus = hasLoadedDetail ? detail.item.statusKey : '';
  const terminal = isTerminalStatus(currentStatus);

  if (!hasPriorityPermission) {
    return `
      <article class="internal-card internal-priority-card internal-action-card">
        <div class="internal-history-heading">
          <div>
            <h3>Alteração de prioridade</h3>
            <p>Alteração de prioridade indisponível para este perfil.</p>
          </div>
          <span class="internal-pill">Acesso restrito</span>
        </div>
        <p class="internal-muted-note">
          Seu perfil não permite alterar a prioridade operacional desta solicitação.
        </p>
      </article>
    `;
  }

  if (terminal) {
    const terminalMessageClass = formState.status === 'error'
      ? ' is-error'
      : formState.status === 'success'
        ? ' is-success'
        : '';

    return `
      <article class="internal-card internal-priority-card internal-action-card">
        <div class="internal-history-heading">
          <div>
            <h3>Alteração de prioridade</h3>
            <p>Prioridade atual: ${escapeHtml(formatPriorityLabel(currentPriority))}.</p>
          </div>
          <span class="internal-pill">Status finalizado</span>
        </div>
        <p class="internal-sensitive-note">
          Status finalizado. Alteração de prioridade exige fluxo administrativo próprio.
        </p>
        <p class="internal-form-message${terminalMessageClass}" role="status">
          ${escapeHtml(formState.message)}
        </p>
      </article>
    `;
  }

  const normalizedLength = normalizePrioridadeObservacaoInput(formState.observacao).length;
  const validationMessage = getPrioridadeFormValidationMessage(
    currentPriority,
    formState.selectedPriority,
    formState.observacao
  );
  const isSubmitting = formState.status === 'submitting';
  const canSubmit = hasLoadedDetail && !validationMessage && !isSubmitting;
  const messageClass = formState.status === 'error'
    ? ' is-error'
    : formState.status === 'success'
      ? ' is-success'
      : '';

  return `
    <article class="internal-card internal-priority-card internal-action-card">
      <div class="internal-history-heading">
        <div>
          <h3>Alteração de prioridade</h3>
          <p>Classifique a criticidade operacional sem alterar o status do chamado.</p>
        </div>
        <span class="internal-pill">Ação de triagem</span>
      </div>
      <dl>
        <div>
          <dt>Prioridade atual</dt>
          <dd>${escapeHtml(formatPriorityLabel(currentPriority))}</dd>
        </div>
        <div>
          <dt>Status atual</dt>
          <dd>${escapeHtml(formatStatusLabel(currentStatus))}</dd>
        </div>
      </dl>
      <form
        class="internal-priority-form internal-status-form"
        data-prioridade-form
        data-current-priority="${escapeHtml(currentPriority)}"
      >
        <label for="internal-prioridade-next">
          Nova prioridade
          <select
            id="internal-prioridade-next"
            name="prioridade"
            data-prioridade-select
            aria-describedby="internal-prioridade-help"
            ${isSubmitting ? 'disabled' : ''}
          >
            <option value="">Selecione</option>
            ${renderPriorityOptions(currentPriority, formState.selectedPriority)}
          </select>
        </label>
        <label for="internal-prioridade-observacao">
          Justificativa da alteração
          <textarea
            id="internal-prioridade-observacao"
            name="observacao"
            data-prioridade-observacao-textarea
            rows="5"
            maxlength="${escapeHtml(PRIORIDADE_OBSERVACAO_MAX_LENGTH)}"
            placeholder="Registre uma justificativa operacional sintética"
            aria-describedby="internal-prioridade-help internal-prioridade-counter"
            ${isSubmitting ? 'disabled' : ''}
          >${escapeHtml(formState.observacao)}</textarea>
        </label>
        <div class="internal-observation-form-footer">
          <span id="internal-prioridade-counter" data-prioridade-counter>
            ${escapeHtml(normalizedLength)}/${escapeHtml(PRIORIDADE_OBSERVACAO_MAX_LENGTH)}
          </span>
          <span id="internal-prioridade-help" data-prioridade-validation>
            ${escapeHtml(validationMessage || 'Informe apenas a nova prioridade e a justificativa.')}
          </span>
        </div>
        <button
          type="submit"
          class="internal-secondary-action"
          data-prioridade-submit
          ${canSubmit ? '' : 'disabled'}
        >
          ${isSubmitting ? 'Atualizando prioridade...' : 'Atualizar prioridade'}
        </button>
        <p class="internal-form-message${messageClass}" role="status">
          ${escapeHtml(formState.message)}
        </p>
      </form>
      <p class="internal-muted-note">
        Alterar prioridade não altera status e não cria observação separada.
      </p>
    </article>
  `;
}

function renderStatusUpdatePanel(state, detail) {
  const formState = detail.statusForm || createStatusFormState();
  const hasStatusPermission = canUpdateStatus(state);
  const hasLoadedDetail = detail.status === 'loaded' && detail.item;
  const currentStatus = hasLoadedDetail ? detail.item.statusKey : '';
  const allowedStatuses = getAllowedNextStatuses(currentStatus);
  const terminal = isTerminalStatus(currentStatus);

  if (!hasStatusPermission) {
    return `
      <article class="internal-card internal-status-card internal-action-card">
        <div class="internal-history-heading">
          <div>
            <h3>Alteração normal de status</h3>
            <p>Alteração de status indisponível para este perfil.</p>
          </div>
          <span class="internal-pill">Acesso restrito</span>
        </div>
        <p class="internal-muted-note">
          Seu perfil não permite atualizar o andamento desta solicitação.
        </p>
      </article>
    `;
  }

  if (terminal) {
    const terminalMessageClass = formState.status === 'error'
      ? ' is-error'
      : formState.status === 'success'
        ? ' is-success'
        : '';

    return `
      <article class="internal-card internal-status-card internal-action-card">
        <div class="internal-history-heading">
          <div>
            <h3>Alteração normal de status</h3>
            <p>Status atual: ${escapeHtml(formatStatusLabel(currentStatus))}.</p>
          </div>
          <span class="internal-pill">Status finalizado</span>
        </div>
        <p class="internal-sensitive-note">
          Status finalizado. Reabertura ou correção administrativa exigirá fluxo específico.
        </p>
        <p class="internal-form-message${terminalMessageClass}" role="status">
          ${escapeHtml(formState.message)}
        </p>
      </article>
    `;
  }

  const normalizedLength = normalizeStatusObservacaoInput(formState.observacao).length;
  const validationMessage = getStatusFormValidationMessage(
    currentStatus,
    formState.selectedStatus,
    formState.observacao
  );
  const isSubmitting = formState.status === 'submitting';
  const canSubmit = hasLoadedDetail
    && allowedStatuses.length > 0
    && !validationMessage
    && !isSubmitting;
  const messageClass = formState.status === 'error'
    ? ' is-error'
    : formState.status === 'success'
      ? ' is-success'
      : '';

  return `
    <article class="internal-card internal-status-card internal-action-card">
      <div class="internal-history-heading">
          <div>
            <h3>Alteração normal de status</h3>
            <p>Atualize o andamento do atendimento sem alterar prioridade ou dados do solicitante.</p>
          </div>
        <span class="internal-pill">Ação de andamento</span>
      </div>
      <dl>
        <div>
          <dt>Status atual</dt>
          <dd>${escapeHtml(formatStatusLabel(currentStatus))}</dd>
        </div>
        <div>
          <dt>Transições disponíveis</dt>
          <dd>${allowedStatuses.length > 0
            ? escapeHtml(allowedStatuses.map(formatStatusLabel).join(', '))
            : 'Nenhuma transição normal disponível'}
          </dd>
        </div>
      </dl>
      <form
        class="internal-status-form"
        data-status-form
        data-current-status="${escapeHtml(currentStatus)}"
      >
        <label for="internal-status-next">
          Novo status
          <select
            id="internal-status-next"
            name="status"
            data-status-select
            aria-describedby="internal-status-help"
            ${isSubmitting || allowedStatuses.length === 0 ? 'disabled' : ''}
          >
            <option value="">Selecione</option>
            ${renderAllowedStatusOptions(currentStatus, formState.selectedStatus)}
          </select>
        </label>
        <label for="internal-status-observacao">
          Justificativa da alteração
          <textarea
            id="internal-status-observacao"
            name="observacao"
            data-status-observacao-textarea
            rows="5"
            maxlength="${escapeHtml(STATUS_OBSERVACAO_MAX_LENGTH)}"
            placeholder="Registre uma justificativa operacional sintética"
            aria-describedby="internal-status-help internal-status-counter"
            ${isSubmitting ? 'disabled' : ''}
          >${escapeHtml(formState.observacao)}</textarea>
        </label>
        <div class="internal-observation-form-footer">
          <span id="internal-status-counter" data-status-counter>
            ${escapeHtml(normalizedLength)}/${escapeHtml(STATUS_OBSERVACAO_MAX_LENGTH)}
          </span>
          <span id="internal-status-help" data-status-validation>
            ${escapeHtml(validationMessage || 'Informe apenas o novo status e a justificativa.')}
          </span>
        </div>
        <button
          type="submit"
          class="internal-secondary-action"
          data-status-submit
          ${canSubmit ? '' : 'disabled'}
        >
          ${isSubmitting ? 'Atualizando status...' : 'Atualizar status'}
        </button>
        <p class="internal-form-message${messageClass}" role="status">
          ${escapeHtml(formState.message)}
        </p>
      </form>
      <p class="internal-muted-note">
        A alteração de status não cria observação separada. O sistema continua validando perfil e transições permitidas.
      </p>
    </article>
  `;
}

function renderStatusCorrectionPanel(state, detail) {
  if (!canCorrectStatus(state)) {
    return '';
  }

  const formState = detail.statusCorrectionForm || createStatusCorrectionFormState();
  const hasLoadedDetail = detail.status === 'loaded' && detail.item;
  const currentStatus = hasLoadedDetail ? detail.item.statusKey : '';
  const normalizedLength = normalizeStatusCorrectionJustificativaInput(
    formState.justificativa
  ).length;
  const validationMessage = getStatusCorrectionFormValidationMessage(
    currentStatus,
    formState.selectedStatus,
    formState.justificativa,
    formState.confirmed
  );
  const isSubmitting = formState.status === 'submitting';
  const canSubmit = hasLoadedDetail
    && formState.open
    && !validationMessage
    && !isSubmitting;
  const messageClass = formState.status === 'error'
    ? ' is-error'
    : formState.status === 'success'
      ? ' is-success'
      : '';

  return `
    <article class="internal-card internal-status-card internal-action-card">
      <div class="internal-history-heading">
        <div>
          <h3>Ações administrativas</h3>
          <p>Correção excepcional de status com auditoria e justificativa obrigatória.</p>
        </div>
        <span class="internal-pill">Administrativo</span>
      </div>
      <p class="internal-sensitive-note">
        Correção administrativa de status: esta ação é auditável e pode reabrir chamados finalizados.
      </p>
      <dl>
        <div>
          <dt>Status atual</dt>
          <dd>${escapeHtml(formatStatusLabel(currentStatus))}</dd>
        </div>
      </dl>
      ${formState.open
        ? `
          <form
            class="internal-status-form"
            data-status-correction-form
            data-current-status="${escapeHtml(currentStatus)}"
          >
            <label for="internal-status-correction-next">
              Novo status
              <select
                id="internal-status-correction-next"
                name="novo_status"
                data-status-correction-select
                aria-describedby="internal-status-correction-help"
                ${isSubmitting ? 'disabled' : ''}
              >
                <option value="">Selecione</option>
                ${renderStatusCorrectionOptions(currentStatus, formState.selectedStatus)}
              </select>
            </label>
            <label for="internal-status-correction-justificativa">
              Justificativa obrigatória
              <textarea
                id="internal-status-correction-justificativa"
                name="justificativa"
                data-status-correction-justificativa-textarea
                rows="5"
                maxlength="${escapeHtml(STATUS_CORRECAO_JUSTIFICATIVA_MAX_LENGTH)}"
                placeholder="Informe a justificativa administrativa da correção"
                aria-describedby="internal-status-correction-help internal-status-correction-counter"
                ${isSubmitting ? 'disabled' : ''}
              >${escapeHtml(formState.justificativa)}</textarea>
            </label>
            <label class="internal-checkbox-field">
              <input
                type="checkbox"
                name="confirmado"
                value="1"
                data-status-correction-confirmation
                ${formState.confirmed ? 'checked' : ''}
                ${isSubmitting ? 'disabled' : ''}
              >
              Confirmo que esta correção administrativa será registrada no histórico.
            </label>
            <div class="internal-observation-form-footer">
              <span id="internal-status-correction-counter" data-status-correction-counter>
                ${escapeHtml(normalizedLength)}/${escapeHtml(STATUS_CORRECAO_JUSTIFICATIVA_MAX_LENGTH)}
              </span>
              <span id="internal-status-correction-help" data-status-correction-validation>
                ${escapeHtml(validationMessage || 'Pronto para confirmar a correção administrativa.')}
              </span>
            </div>
            <div class="internal-list-actions">
              <button
                type="submit"
                class="internal-primary-action"
                data-status-correction-submit
                ${canSubmit ? '' : 'disabled'}
              >
                ${isSubmitting ? 'Confirmando correção...' : 'Confirmar correção administrativa'}
              </button>
              <button
                type="button"
                class="internal-secondary-action"
                data-action="cancel-status-correction"
                ${isSubmitting ? 'disabled' : ''}
              >
                Cancelar
              </button>
            </div>
          </form>
        `
        : `
          <button
            type="button"
            class="internal-secondary-action"
            data-action="open-status-correction"
          >
            Corrigir status administrativamente
          </button>
        `}
      <p class="internal-form-message${messageClass}" role="status">
        ${escapeHtml(formState.message)}
      </p>
    </article>
  `;
}

function renderCoordinateRouteSection(item) {
  if (!item.hasCoordinates || !item.coordinates) {
    return `
      <section class="internal-detail-section internal-coordinate-section" aria-label="Coordenadas e rota">
        <h4>Coordenadas e rota</h4>
        <p class="internal-sensitive-note">
          Coordenada não disponível para este chamado.
        </p>
        <span class="internal-route-disabled" aria-disabled="true">
          Abrir rota no Google Maps
        </span>
      </section>
    `;
  }

  return `
    <section class="internal-detail-section internal-coordinate-section" aria-label="Coordenadas e rota">
      <h4>Coordenadas e rota</h4>
      ${renderDetailDefinitionList([
        { label: 'Latitude', value: item.latitudeText },
        { label: 'Longitude', value: item.longitudeText }
      ])}
      <a
        class="internal-route-action"
        href="${escapeHtml(item.googleMapsRouteUrl)}"
        target="_blank"
        rel="noopener noreferrer"
        data-google-maps-route
      >
        Abrir rota no Google Maps
      </a>
      <p class="internal-muted-note">
        A rota usa apenas a coordenada do chamado. Dados pessoais e observações internas não entram no link.
      </p>
    </section>
  `;
}

function renderSolicitanteWhatsappAction(item) {
  const whatsappUrl = buildInternalWhatsappUrl(item.contatoSolicitante);

  if (!whatsappUrl) {
    return '';
  }

  return `
    <a
      class="internal-whatsapp-action"
      href="${escapeHtml(whatsappUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      data-internal-whatsapp
    >
      Abrir WhatsApp
    </a>
    <p class="internal-muted-note">
      O link usa apenas o número sanitizado e não inclui mensagem automática.
    </p>
  `;
}

function renderOperationalMapPanel(item) {
  if (!item.hasCoordinates || !item.coordinates) {
    return '';
  }

  return `
    <section class="internal-card internal-operational-map-card" aria-label="Mapa operacional do chamado">
      <div class="internal-history-heading">
        <div>
          <h3>Mapa operacional</h3>
          <p>Ponto do chamado centralizado para apoio ao deslocamento.</p>
        </div>
        <span class="internal-pill">${escapeHtml(item.status)}</span>
      </div>
      <div
        class="internal-operational-map"
        data-operational-map
        data-latitude="${escapeHtml(item.coordinates.latitude)}"
        data-longitude="${escapeHtml(item.coordinates.longitude)}"
        data-status="${escapeHtml(item.statusKey)}"
        role="img"
        aria-label="Mapa com a localização aproximada do chamado"
      ></div>
      <p class="internal-muted-note">
        Mapa simples com base pública. Camadas internas, dados pessoais e observações não são carregados no mapa.
      </p>
    </section>
  `;
}

function renderSolicitacaoDetailLoaded(state, detail) {
  const item = detail.item;

  return `
    <article class="internal-card internal-detail-card">
      <div class="internal-detail-card-header">
        <div>
          <h3>Detalhe da solicitação</h3>
          <p>Informações operacionais do chamado selecionado.</p>
        </div>
        <button
          type="button"
          class="internal-secondary-action"
          data-action="clear-solicitacao-detail"
        >
          Fechar detalhe
        </button>
      </div>

      <div class="internal-detail-sections">
        <section class="internal-detail-section" aria-label="Identificação da solicitação">
          <h4>Identificação</h4>
          ${renderDetailDefinitionList([
            { label: 'Protocolo', value: item.protocolo },
            { label: 'Status', value: item.status },
            { label: 'Prioridade', value: item.prioridade },
            { label: 'Tipo de problema', value: item.tipoProblema },
            { label: 'Poste', value: item.posteId },
            { label: 'Duplicidade suspeita', value: item.duplicidadeSuspeita }
          ])}
        </section>

        <section class="internal-detail-section" aria-label="Origem e localização operacional">
          <h4>Origem e localização operacional</h4>
          ${renderDetailDefinitionList([
            { label: 'Origem', value: item.origem },
            { label: 'Tipo de localização', value: item.localizacaoTipo },
            { label: 'Ponto de referência', value: item.pontoReferencia },
            { label: 'Poste próximo informado', value: item.posteProximoInformado }
          ])}
        </section>

        ${renderCoordinateRouteSection(item)}

        <section class="internal-detail-section" aria-label="Dados do solicitante">
          <h4>Dados do solicitante</h4>
          ${renderDetailDefinitionList([
            { label: 'Nome', value: item.nomeSolicitante },
            { label: 'Contato', value: item.contatoSolicitante }
          ])}
          ${renderSolicitanteWhatsappAction(item)}
          <p class="internal-sensitive-note">
            Dados pessoais exibidos apenas no detalhe interno e para uso operacional restrito.
          </p>
        </section>

        <section class="internal-detail-section" aria-label="Descrição e observações">
          <h4>Descrição</h4>
          ${renderDetailDefinitionList([
            { label: 'Descrição', value: item.descricao },
            { label: 'Observações de localização', value: item.observacoesLocalizacao }
          ])}
        </section>

        <section class="internal-detail-section" aria-label="Datas da solicitacao">
          <h4>Datas</h4>
          ${renderDetailDefinitionList([
            { label: 'Criado em', value: item.criadoEm },
            { label: 'Atualizado em', value: item.atualizadoEm },
            { label: 'Finalizado em', value: item.finalizadoEm }
          ])}
        </section>
      </div>
    </article>
    ${renderOperationalMapPanel(item)}
    ${renderStatusUpdatePanel(state, detail)}
    ${renderPriorityUpdatePanel(state, detail)}
    ${renderStatusCorrectionPanel(state, detail)}
    ${renderHistoricoPanel(state, detail)}
    ${renderObservacoesPanel(state, detail)}
  `;
}

function renderSolicitacaoDetailPanel(state) {
  const detail = state.detalhe || createDetalheState();

  if (detail.status === 'loaded' && detail.item) {
    return renderSolicitacaoDetailLoaded(state, detail);
  }

  const statusMessages = {
    idle: {
      title: 'Detalhe da solicitação',
      text: detail.message
    },
    loading: {
      title: 'Carregando detalhe',
      text: 'Carregando as informacoes do chamado selecionado.'
    },
    forbidden: {
      title: 'Sem permissão',
      text: detail.message
    },
    not_found: {
      title: 'Solicitação não encontrada',
      text: detail.message
    },
    expired: {
      title: 'Sessão expirada',
      text: detail.message
    },
    error: {
      title: 'Detalhe indisponível',
      text: detail.message
    }
  };
  const content = statusMessages[detail.status] || statusMessages.error;
  const canClear = detail.status !== 'idle' && detail.status !== 'loading';

  return `
    <article class="internal-card internal-detail-card">
      <div class="internal-detail-card-header">
        <div>
          <h3>${escapeHtml(content.title)}</h3>
          <p>${escapeHtml(content.text)}</p>
        </div>
        <button
          type="button"
          class="internal-secondary-action"
          data-action="clear-solicitacao-detail"
          ${canClear ? '' : 'disabled'}
        >
          Limpar seleção
        </button>
      </div>
      <dl>
        <div>
          <dt>Como usar</dt>
          <dd>Selecione uma solicitação na tabela para abrir o atendimento.</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>${escapeHtml(detail.statusCode ? `Código ${detail.statusCode}` : 'Aguardando seleção')}</dd>
        </div>
        <div>
          <dt>Restrições</dt>
          <dd>Reabertura, correção administrativa e mapa operacional ficam fora desta tela.</dd>
        </div>
      </dl>
    </article>
  `;
}

function scrollToSolicitacaoDetailSection(root) {
  if (!root || typeof root.querySelector !== 'function') {
    return false;
  }

  const detailSection = root.querySelector(DETAIL_SECTION_SELECTOR);

  if (!detailSection || typeof detailSection.scrollIntoView !== 'function') {
    return false;
  }

  detailSection.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  return true;
}

function renderLoginPanel(state) {
  if (state.sessionState !== 'unauthenticated') {
    return '';
  }

  const isSubmitting = state.loginStatus === 'submitting';
  const statusClass = state.loginStatus === 'error' ? ' is-error' : '';
  const message = state.loginMessage
    || 'Informe suas credenciais internas para continuar.';

  return `
    <section class="internal-login-panel" aria-labelledby="internal-login-title">
      <div>
        <p class="internal-kicker">Área restrita</p>
        <h2 id="internal-login-title">Login interno</h2>
        <p>
          O Geoportal público permanece separado. Esta autenticação acontece apenas dentro da shell interna.
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
  const isAuthenticated = state.sessionState === 'authenticated';
  const isLoggingOut = state.logoutStatus === 'submitting';
  const compactSessionUserText = isAuthenticated
    ? getSessionDisplayName(state)
    : 'Acesso interno';
  const compactSessionLoginText = isAuthenticated
    && typeof state.login === 'string'
    && state.login.trim()
    && state.login.trim() !== compactSessionUserText
    ? state.login.trim()
    : '';
  const sessionIdentity = {
    userText: state.sessionState === 'authenticated'
      ? getSessionDisplayName(state)
      : 'Acesso interno',
    statusText: state.sessionState === 'authenticated'
      ? (getSessionStatusMeta(state) || 'Sessão ativa')
      : stateInfo.label
  };
  const userText = state.sessionState === 'authenticated'
    ? `Usuário interno #${state.usuarioId}`
    : 'Acesso interno';
  const statusText = state.sessionState === 'authenticated'
    ? 'Sessão ativa'
    : stateInfo.label;

  return `
    <aside class="internal-session-box is-${stateInfo.tone}" aria-label="Estado de sessão">
      ${isAuthenticated ? '' : `<span>${escapeHtml(stateInfo.label)}</span>`}
      <strong>${escapeHtml(compactSessionUserText)}</strong>
      ${compactSessionLoginText
        ? `<p class="internal-session-login">${escapeHtml(compactSessionLoginText)}</p>`
        : ''}
      ${isAuthenticated
        ? `
          <button
            type="button"
            class="internal-logout-button"
            data-action="logout"
            ${isLoggingOut ? 'disabled' : ''}
          >
            ${isLoggingOut ? 'Saindo...' : 'Sair'}
          </button>
        `
        : ''}
      ${state.logoutMessage
        ? `<p class="internal-logout-message ${state.logoutStatus === 'error' ? 'is-error' : ''}" role="status">${escapeHtml(state.logoutMessage)}</p>`
        : ''}
    </aside>
  `;
}

function disposeOperationalDetailMap() {
  if (operationalDetailMap) {
    operationalDetailMap.setTarget(undefined);
    operationalDetailMap = null;
  }
}

function getOperationalMapStatusColor(statusKey) {
  return operationalMapStatusColors[statusKey] || '#2563eb';
}

function disposeDashboardMap() {
  if (dashboardMap) {
    dashboardMap.setTarget(undefined);
    dashboardMap = null;
  }
}

function getDashboardPriorityVisual(priorityKey) {
  const priority = safeText(priorityKey, '').toLowerCase();

  if (priority === 'urgente') {
    return {
      radiusDelta: 4,
      strokeWidth: 4,
      haloRadius: 20,
      haloColor: 'rgba(200, 70, 60, 0.28)',
      heatmapWeight: 1
    };
  }

  if (priority === 'alta') {
    return {
      radiusDelta: 2,
      strokeWidth: 4,
      haloRadius: 17,
      haloColor: 'rgba(217, 80, 69, 0.18)',
      heatmapWeight: 0.82
    };
  }

  if (priority === 'baixa') {
    return {
      radiusDelta: -1,
      strokeWidth: 2,
      haloRadius: 0,
      haloColor: 'rgba(47, 125, 149, 0)',
      heatmapWeight: 0.42
    };
  }

  return {
    radiusDelta: 0,
    strokeWidth: 3,
    haloRadius: 0,
    haloColor: 'rgba(47, 125, 149, 0)',
    heatmapWeight: 0.62
  };
}

function getDashboardHeatmapWeight(item) {
  return getDashboardPriorityVisual(item.prioridadeKey).heatmapWeight;
}

function getDashboardMapFeatureStyle(item) {
  const markerColor = getOperationalMapStatusColor(item.statusKey);
  const type = safeText(item.tipoProblemaKey || item.tipoProblema, '').toLowerCase();
  const priorityVisual = getDashboardPriorityVisual(item.prioridadeKey);
  const baseRadius = type.includes('poste') ? 9 : 10;
  const markerRadius = Math.max(7, baseRadius + priorityVisual.radiusDelta);
  const baseStyle = {
    fill: new Fill({ color: markerColor }),
    stroke: new Stroke({ color: '#ffffff', width: priorityVisual.strokeWidth })
  };
  const styles = [];

  if (priorityVisual.haloRadius > 0) {
    styles.push(new Style({
      image: new CircleStyle({
        radius: priorityVisual.haloRadius,
        fill: new Fill({ color: priorityVisual.haloColor }),
        stroke: new Stroke({ color: priorityVisual.haloColor, width: 1 })
      })
    }));
  }

  if (type.includes('piscando')) {
    styles.push(new Style({
      image: new RegularShape({
        ...baseStyle,
        points: 4,
        radius: markerRadius,
        angle: Math.PI / 4
      })
    }));
    return styles;
  }

  if (type.includes('poste')) {
    styles.push(new Style({
      image: new RegularShape({
        ...baseStyle,
        points: 4,
        radius: markerRadius,
        angle: Math.PI / 4
      })
    }));
    return styles;
  }

  if (type.includes('fotocelula') || type.includes('rele')) {
    styles.push(new Style({
      image: new RegularShape({
        ...baseStyle,
        points: 6,
        radius: markerRadius
      })
    }));
    return styles;
  }

  styles.push(new Style({
    image: new CircleStyle({
      radius: markerRadius,
      ...baseStyle
    })
  }));
  return styles;
}
function renderDashboardMapIntoTarget(target, points, mapMode = 'points') {
  const features = points.map((item) => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([item.coordinates.longitude, item.coordinates.latitude]))
    });
    feature.set('weight', getDashboardHeatmapWeight(item));
    feature.setStyle(getDashboardMapFeatureStyle(item));
    return feature;
  });
  const centers = features.map((feature) => feature.getGeometry().getCoordinates());
  const center = centers.reduce((accumulator, coordinate) => [
    accumulator[0] + coordinate[0],
    accumulator[1] + coordinate[1]
  ], [0, 0]).map((value) => value / centers.length);
  const extent = centers.reduce((accumulator, coordinate) => [
    Math.min(accumulator[0], coordinate[0]),
    Math.min(accumulator[1], coordinate[1]),
    Math.max(accumulator[2], coordinate[0]),
    Math.max(accumulator[3], coordinate[1])
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  const vectorSource = new VectorSource({ features });
  const occurrenceLayer = mapMode === 'heatmap'
    ? new HeatmapLayer({
      source: vectorSource,
      blur: 18,
      radius: 14,
      weight: 'weight'
    })
    : new VectorLayer({
      source: vectorSource
    });

  dashboardMap = new Map({
    target,
    layers: [
      new TileLayer({
        source: new OSM()
      }),
      occurrenceLayer
    ],
    view: new View({
      center,
      zoom: OPERATIONAL_MAP_ZOOM - 1
    }),
    controls: []
  });

  if (features.length > 1) {
    dashboardMap.getView().fit(extent, {
      padding: [36, 36, 36, 36],
      maxZoom: OPERATIONAL_MAP_ZOOM + 1
    });
  }

  window.requestAnimationFrame(() => {
    if (dashboardMap) {
      dashboardMap.updateSize();
    }
  });
}
function syncDashboardMap(root, state) {
  const target = root.querySelector('[data-dashboard-map]');
  const points = getFilteredDashboardMapPoints(state);
  const filters = getDashboardFilters(state);

  disposeDashboardMap();

  if (!target || points.length === 0) {
    return;
  }

  try {
    renderDashboardMapIntoTarget(target, points, filters.mapMode);
  } catch {
    target.innerHTML = '<p class="internal-map-fallback">Mapa indisponivel neste navegador.</p>';
  }
}

function disposeInternalOperationalMap() {
  if (internalOperationalMap) {
    internalOperationalMap.setTarget(undefined);
    internalOperationalMap = null;
  }
}

function getInternalOperationalMapFeatureStyle(item, selected = false) {
  const markerColor = getOperationalMapStatusColor(item.statusKey);

  return new Style({
    image: new CircleStyle({
      radius: selected ? 11 : 8,
      fill: new Fill({ color: markerColor }),
      stroke: new Stroke({
        color: selected ? '#f8fafc' : '#ffffff',
        width: selected ? 5 : 3
      })
    })
  });
}

function renderInternalOperationalMapIntoTarget(target, items, selectedIds = [], onSelect = () => {}, options = {}) {
  const selectedSet = new Set(selectedIds);
  target.innerHTML = '';
  const features = items
    .filter((item) => item.hasCoordinates && item.coordinates)
    .map((item) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([item.coordinates.longitude, item.coordinates.latitude]))
      });
      feature.set('solicitacaoId', item.id);
      feature.setStyle(getInternalOperationalMapFeatureStyle(item, selectedSet.has(item.id)));
      return feature;
    });

  if (features.length === 0) {
    return;
  }

  const centers = features.map((feature) => feature.getGeometry().getCoordinates());
  const center = centers.reduce((accumulator, coordinate) => [
    accumulator[0] + coordinate[0],
    accumulator[1] + coordinate[1]
  ], [0, 0]).map((value) => value / centers.length);
  const extent = centers.reduce((accumulator, coordinate) => [
    Math.min(accumulator[0], coordinate[0]),
    Math.min(accumulator[1], coordinate[1]),
    Math.max(accumulator[2], coordinate[0]),
    Math.max(accumulator[3], coordinate[1])
  ], [Infinity, Infinity, -Infinity, -Infinity]);

  internalOperationalMap = new Map({
    target,
    layers: [
      new TileLayer({ source: new OSM() }),
      new VectorLayer({ source: new VectorSource({ features }) })
    ],
    view: new View({
      center: options.viewState && Array.isArray(options.viewState.center) && options.viewState.center.length === 2
        ? options.viewState.center
        : center.length === 2 ? center : fromLonLat(OPERATIONAL_MAP_CENTER),
      zoom: options.viewState && Number.isFinite(Number(options.viewState.zoom))
        ? Number(options.viewState.zoom)
        : OPERATIONAL_MAP_ZOOM - 1
    }),
    controls: []
  });

  if (features.length > 1 && !options.viewState) {
    internalOperationalMap.getView().fit(extent, {
      padding: [36, 36, 36, 36],
      maxZoom: OPERATIONAL_MAP_ZOOM + 1
    });
  }

  internalOperationalMap.on('moveend', () => {
    if (typeof options.onViewportChange === 'function') {
      options.onViewportChange(getOperationalMapVisibleIds(internalOperationalMap, items), getOperationalMapViewState(internalOperationalMap));
    }
  });

  internalOperationalMap.on('singleclick', (event) => {
    const selectedFeatureIds = (internalOperationalMap.getFeaturesAtPixel(event.pixel, {
      hitTolerance: 12
    }) || [])
      .map((feature) => feature.get('solicitacaoId'))
      .filter((solicitacaoId) => Number.isInteger(solicitacaoId) && solicitacaoId > 0);

    if (selectedFeatureIds.length > 0) {
      onSelect(Array.from(new Set(selectedFeatureIds)));
    }
  });

  window.requestAnimationFrame(() => {
    if (internalOperationalMap) {
      internalOperationalMap.updateSize();
      window.setTimeout(() => {
        if (internalOperationalMap) {
          internalOperationalMap.updateSize();
        }
      }, 0);
    }
  });
}

function syncInternalOperationalMap(root, state) {
  const target = root.querySelector('[data-internal-operational-map]');
  const mapState = state.mapaOperacional || createOperationalMapState();

  disposeInternalOperationalMap();

  if (!target || mapState.status !== 'ready' || mapState.items.length === 0) {
    return;
  }

  try {
    renderInternalOperationalMapIntoTarget(
      target,
      mapState.items,
      mapState.selectedIds,
      (solicitacaoIds) => selectOperationalMapOccurrences(root, currentState, solicitacaoIds),
      {
        viewState: mapState.viewState,
        onViewportChange: (visibleIds, viewState) => updateOperationalMapViewportSelection(root, currentState, visibleIds, viewState)
      }
    );
  } catch {
    target.innerHTML = '<p class="internal-map-fallback">Mapa operacional indisponível neste navegador.</p>';
  }
}
function renderOperationalMapIntoTarget(target, item) {
  const center = fromLonLat([item.coordinates.longitude, item.coordinates.latitude]);
  const marker = new Feature({
    geometry: new Point(center)
  });
  const markerColor = getOperationalMapStatusColor(item.statusKey);

  marker.setStyle(new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color: markerColor }),
      stroke: new Stroke({
        color: '#ffffff',
        width: 3
      })
    })
  }));

  operationalDetailMap = new Map({
    target,
    layers: [
      new TileLayer({
        source: new OSM()
      }),
      new VectorLayer({
        source: new VectorSource({
          features: [marker]
        })
      })
    ],
    view: new View({
      center,
      zoom: OPERATIONAL_MAP_ZOOM
    }),
    controls: []
  });

  window.requestAnimationFrame(() => {
    if (operationalDetailMap) {
      operationalDetailMap.updateSize();
    }
  });
}

function syncOperationalDetailMap(root, state) {
  const target = root.querySelector('[data-operational-map]');
  const item = state.detalhe && state.detalhe.status === 'loaded'
    ? state.detalhe.item
    : null;

  disposeOperationalDetailMap();

  if (!target || !item || !item.coordinates) {
    return;
  }

  try {
    renderOperationalMapIntoTarget(target, item);
  } catch {
    target.innerHTML = '<p class="internal-map-fallback">Mapa indisponível neste navegador.</p>';
  }
}

function renderNoAvailableModulePanel() {
  return `
    <section class="internal-module-workspace" aria-labelledby="module-workspace-title">
      <div class="internal-section-heading">
        <h2 id="module-workspace-title">Nenhum modulo disponivel</h2>
        <p>Seu perfil interno nao possui um modulo operacional liberado nesta versao.</p>
      </div>
      <div class="internal-empty-state">
        <strong>Acesso restrito</strong>
        <p>Solicite a revisao das permissoes internas caso precise operar algum modulo.</p>
      </div>
    </section>
  `;
}


function buildAdminUserDetailUrl(usuarioId) {
  return `${INTERNAL_ADMIN_USERS_ENDPOINT}/${encodeURIComponent(String(usuarioId))}`;
}

function buildAdminUserProfilesUrl(usuarioId) {
  return `${buildAdminUserDetailUrl(usuarioId)}/profiles`;
}

function buildAdminUserBlockUrl(usuarioId) {
  return `${buildAdminUserDetailUrl(usuarioId)}/block`;
}

function buildAdminUserUnblockUrl(usuarioId) {
  return `${buildAdminUserDetailUrl(usuarioId)}/unblock`;
}

function buildAdminUserResetPasswordUrl(usuarioId) {
  return `${buildAdminUserDetailUrl(usuarioId)}/reset-password`;
}

function buildAdminUserProfileDeactivateUrl(usuarioId, perfilId) {
  return `${buildAdminUserProfilesUrl(usuarioId)}/${encodeURIComponent(String(perfilId))}/deactivate`;
}

function normalizeAdminUser(source = {}) {
  const id = Number(source.id ?? source.usuario_id);
  return {
    id: Number.isInteger(id) && id > 0 ? id : null,
    login: safeText(source.login, ''),
    nome: safeText(source.nome, ''),
    email: source.email == null ? '' : safeText(source.email, ''),
    ativo: source.ativo === true,
    bloqueado: source.bloqueado === true,
    criadoEm: safeText(source.criado_em, '')
  };
}

function normalizeAdminProfile(source = {}) {
  const id = Number(source.id ?? source.perfil_id);
  return {
    id: Number.isInteger(id) && id > 0 ? id : null,
    perfilId: Number.isInteger(id) && id > 0 ? id : null,
    chave: safeText(source.chave, ''),
    nome: safeText(source.nome, ''),
    modulo: source.modulo == null ? null : safeText(source.modulo, ''),
    ativo: source.ativo !== false,
    criadoEm: safeText(source.criado_em, '')
  };
}

function getPayloadArray(payload, keys) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return [];
}

function getAdminErrorMessage(statusCode, action = 'operação') {
  if (statusCode === 401) {
    return 'Sessão expirada. Faça login novamente.';
  }

  if (statusCode === 403) {
    return 'Seu perfil não possui permissão para esta ação.';
  }

  if (statusCode === 409) {
    return action === 'deactivate-profile'
      ? 'Vínculo já está inativo.'
      : 'Conflito de dados. Atualize a tela e tente novamente.';
  }

  if (statusCode === 422) {
    return 'Revise os campos informados antes de continuar.';
  }

  if (statusCode === 404) {
    return 'Registro não encontrado ou indisponível.';
  }

  return 'Não foi possível concluir a operação administrativa agora.';
}

async function parseAdminJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function createAdminFetchError(response, action) {
  return {
    status: response.status === 401 ? 'expired' : 'error',
    statusCode: response.status,
    message: getAdminErrorMessage(response.status, action)
  };
}

async function fetchAdminUsers() {
  const response = await fetch(INTERNAL_ADMIN_USERS_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'list-users');
  }

  const payload = await parseAdminJson(response);
  const users = getPayloadArray(payload, ['usuarios', 'users', 'items'])
    .map(normalizeAdminUser)
    .filter((user) => Number.isInteger(user.id));

  return {
    status: users.length > 0 ? 'ready' : 'empty',
    statusCode: response.status,
    users,
    message: users.length > 0 ? 'Usuários internos carregados.' : 'Nenhum usuário interno retornado.'
  };
}

async function fetchAdminUserDetail(usuarioId) {
  const response = await fetch(buildAdminUserDetailUrl(usuarioId), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'user-detail');
  }

  const payload = await parseAdminJson(response);
  const user = normalizeAdminUser(payload.usuario || payload.user || payload);

  return {
    status: Number.isInteger(user.id) ? 'ready' : 'error',
    statusCode: response.status,
    user: Number.isInteger(user.id) ? user : null,
    message: Number.isInteger(user.id) ? 'Detalhe do usuário carregado.' : 'Resposta de usuário em formato inesperado.'
  };
}

async function fetchAdminAvailableProfiles() {
  const response = await fetch(INTERNAL_ADMIN_PROFILES_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'list-profiles');
  }

  const payload = await parseAdminJson(response);
  const profiles = getPayloadArray(payload, ['perfis', 'profiles', 'items'])
    .map(normalizeAdminProfile)
    .filter((profile) => Number.isInteger(profile.id));

  return {
    status: profiles.length > 0 ? 'ready' : 'empty',
    statusCode: response.status,
    profiles,
    message: profiles.length > 0 ? 'Perfis carregados.' : 'Nenhum perfil disponível retornado.'
  };
}

async function fetchAdminUserProfiles(usuarioId) {
  const response = await fetch(buildAdminUserProfilesUrl(usuarioId), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'user-profiles');
  }

  const payload = await parseAdminJson(response);
  const profiles = getPayloadArray(payload, ['vinculos', 'perfis', 'profiles', 'items'])
    .map(normalizeAdminProfile)
    .filter((profile) => Number.isInteger(profile.perfilId));

  return {
    status: profiles.length > 0 ? 'ready' : 'empty',
    statusCode: response.status,
    profiles,
    message: profiles.length > 0 ? 'Vínculos carregados.' : 'Nenhum vínculo usuário/perfil retornado.'
  };
}

async function fetchCreateAdminUser(payload) {
  const response = await fetch(INTERNAL_ADMIN_USERS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'create-user');
  }

  const body = await parseAdminJson(response);
  return {
    status: 'success',
    statusCode: response.status,
    user: normalizeAdminUser(body.usuario || body.user || body),
    message: 'Usuário criado com sucesso.'
  };
}

async function fetchBlockAdminUser(usuarioId) {
  const response = await fetch(buildAdminUserBlockUrl(usuarioId), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    }
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'block-user');
  }

  const body = await parseAdminJson(response);
  return {
    status: 'success',
    statusCode: response.status,
    user: normalizeAdminUser(body.usuario || body.user || body),
    message: 'Usuário bloqueado com sucesso.'
  };
}

async function fetchUnblockAdminUser(usuarioId) {
  const response = await fetch(buildAdminUserUnblockUrl(usuarioId), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    }
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'unblock-user');
  }

  const body = await parseAdminJson(response);
  return {
    status: 'success',
    statusCode: response.status,
    user: normalizeAdminUser(body.usuario || body.user || body),
    message: 'Usuário desbloqueado com sucesso.'
  };
}

async function fetchResetAdminUserPassword(usuarioId, novaSenha, confirmarNovaSenha) {
  const response = await fetch(buildAdminUserResetPasswordUrl(usuarioId), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify({
      nova_senha: novaSenha,
      confirmar_nova_senha: confirmarNovaSenha
    })
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'reset-password');
  }

  return {
    status: 'success',
    statusCode: response.status,
    message: 'Senha redefinida com sucesso. O usuário deve usar a nova senha no próximo login.'
  };
}

async function fetchAssignAdminUserProfile(usuarioId, perfilId, modulo = '') {
  const payload = { perfil_id: perfilId };
  const normalizedModulo = String(modulo || '').trim();

  if (normalizedModulo) {
    payload.modulo = normalizedModulo;
  }

  const response = await fetch(buildAdminUserProfilesUrl(usuarioId), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'assign-profile');
  }

  return {
    status: 'success',
    statusCode: response.status,
    message: response.status === 201 ? 'Perfil atribuído ao usuário.' : 'Vínculo de perfil já estava ativo.'
  };
}

async function fetchDeactivateAdminUserProfile(usuarioId, perfilId, modulo, justificativa) {
  const payload = { justificativa };
  const normalizedModulo = String(modulo || '').trim();

  if (normalizedModulo) {
    payload.modulo = normalizedModulo;
  }

  const response = await fetch(buildAdminUserProfileDeactivateUrl(usuarioId, perfilId), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return createAdminFetchError(response, 'deactivate-profile');
  }

  return {
    status: 'success',
    statusCode: response.status,
    message: 'Vínculo usuário/perfil desativado.'
  };
}

function normalizeAdminSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getAdminVisibleUsers(admin, limitWhenEmpty = 6) {
  const users = Array.isArray(admin?.users) ? admin.users : [];
  const query = normalizeAdminSearchText(admin?.userSearchQuery);

  if (!query) {
    return users.slice(0, limitWhenEmpty);
  }

  return users.filter((user) => [user.nome, user.login, user.email]
    .some((value) => normalizeAdminSearchText(value).includes(query)))
    .slice(0, 20);
}

function renderAdminStatusMessage(formState) {
  if (!formState || !formState.message) {
    return '';
  }

  const tone = formState.status === 'success' ? 'success'
    : formState.status === 'error' || formState.status === 'expired' ? 'danger'
      : 'neutral';

  return `<p class="internal-admin-form-message is-${tone}">${escapeHtml(formState.message)}</p>`;
}

function renderAdminUserList(state) {
  const admin = state.admin || createAdminState();
  const users = Array.isArray(admin.users) ? admin.users : [];
  const searchQuery = safeText(admin.userSearchQuery, '');
  const visibleUsers = getAdminVisibleUsers(admin);
  const hasSearch = normalizeAdminSearchText(searchQuery).length > 0;

  const searchBox = `
    <div class="internal-admin-search">
      <label for="internal-admin-user-search">Pesquisar usuário</label>
      <input
        id="internal-admin-user-search"
        type="search"
        value="${escapeHtml(searchQuery)}"
        placeholder="Digite nome, login ou e-mail"
        autocomplete="off"
        data-admin-user-search
      >
      <p>${hasSearch
        ? `${visibleUsers.length} resultado(s) encontrado(s).`
        : users.length > visibleUsers.length
          ? 'Digite para filtrar ou escolha um dos primeiros usuários carregados.'
          : 'Digite para filtrar por nome, login ou e-mail.'}</p>
    </div>
  `;

  if (admin.usersStatus === 'loading') {
    return `${searchBox}<p class="internal-muted-note">Carregando usuários internos...</p>`;
  }

  if (admin.usersStatus === 'error' || admin.usersStatus === 'expired') {
    return `${searchBox}<p class="internal-muted-note">${escapeHtml(admin.message || 'Não foi possível carregar usuários.')}</p>`;
  }

  if (users.length === 0) {
    return `${searchBox}<p class="internal-muted-note">Nenhum usuário carregado ainda.</p>`;
  }

  if (visibleUsers.length === 0) {
    return `${searchBox}<p class="internal-muted-note">Nenhum usuário encontrado para a pesquisa informada.</p>`;
  }

  return `
    ${searchBox}
    <div class="internal-admin-user-list" role="list" aria-label="Resultados de usuários internos">
      ${visibleUsers.map((user) => `
        <button
          type="button"
          class="internal-admin-user-row${admin.selectedUserId === user.id ? ' is-active' : ''}"
          data-action="select-admin-user"
          data-admin-user-id="${escapeHtml(String(user.id))}"
        >
          <span>
            <strong>${escapeHtml(user.nome || user.login || `Usuário #${user.id}`)}</strong>
            <small>${escapeHtml(user.login || 'login não informado')}</small>
          </span>
          <em>${user.bloqueado ? 'Bloqueado' : user.ativo ? 'Ativo' : 'Inativo'}</em>
        </button>
      `).join('')}
    </div>
  `;
}

function renderAdminUserDetail(state) {
  const admin = state.admin || createAdminState();
  const user = admin.user;

  if (admin.detailStatus === 'loading') {
    return '<p class="internal-muted-note">Carregando detalhe do usuário...</p>';
  }

  if (admin.detailStatus === 'error') {
    return `<p class="internal-muted-note">${escapeHtml(admin.message || 'Não foi possível carregar o detalhe do usuário.')}</p>`;
  }

  if (!user) {
    return '<p class="internal-muted-note">Selecione um usuário para ver detalhe, vínculos e ações.</p>';
  }

  return `
    <div class="internal-admin-detail-card">
      <div class="internal-history-heading">
        <div>
          <h3>${escapeHtml(user.nome || user.login || `Usuário #${user.id}`)}</h3>
          <p>${escapeHtml(user.login || 'login não informado')}</p>
        </div>
        <span class="internal-status-pill ${user.bloqueado ? 'is-cancelada' : 'is-aberta'}">${user.bloqueado ? 'Bloqueado' : user.ativo ? 'Ativo' : 'Inativo'}</span>
      </div>
      <dl class="internal-admin-detail-list">
        <div><dt>ID</dt><dd>${escapeHtml(String(user.id))}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(user.email || 'Não informado')}</dd></div>
        <div><dt>Criado em</dt><dd>${escapeHtml(formatDateTime(user.criadoEm))}</dd></div>
      </dl>
    </div>
  `;
}

function renderAdminUserProfiles(state) {
  const admin = state.admin || createAdminState();

  if (!admin.user && admin.detailStatus !== 'loading') {
    return '';
  }

  if (admin.userProfilesStatus === 'loading') {
    return '<p class="internal-muted-note">Carregando vínculos usuário/perfil...</p>';
  }

  if (admin.userProfilesStatus === 'error') {
    return `<p class="internal-muted-note">${escapeHtml(admin.message || 'Não foi possível carregar vínculos usuário/perfil.')}</p>`;
  }

  if (!Array.isArray(admin.userProfiles) || admin.userProfiles.length === 0) {
    return '<p class="internal-muted-note">Nenhum vínculo usuário/perfil retornado.</p>';
  }

  return `
    <div class="internal-admin-profile-list">
      ${admin.userProfiles.map((profile) => `
        <article class="internal-admin-profile-row">
          <div>
            <strong>${escapeHtml(profile.nome || profile.chave || `Perfil #${profile.perfilId}`)}</strong>
            <small>${escapeHtml(profile.chave || 'chave não informada')} ${profile.modulo ? `- ${escapeHtml(profile.modulo)}` : '- global'}</small>
          </div>
          <span class="internal-admin-profile-status">${profile.ativo ? 'Ativo' : 'Inativo'}</span>
          ${profile.ativo && canRemoveAdminUserProfile(state) ? `
            <form class="internal-admin-inline-form" data-admin-deactivate-profile-form>
              <input type="hidden" name="perfil_id" value="${escapeHtml(String(profile.perfilId))}">
              <input type="hidden" name="modulo" value="${escapeHtml(profile.modulo || '')}">
              <label>
                <span>Justificativa</span>
                <input name="justificativa" type="text" minlength="10" maxlength="1000" required placeholder="Motivo administrativo">
              </label>
              <label>
                <span>Confirme</span>
                <input name="confirmacao" type="text" required placeholder="DESATIVAR">
              </label>
              <button type="submit">Desativar vínculo</button>
            </form>
          ` : ''}
        </article>
      `).join('')}
    </div>
  `;
}

function renderAdminCreateUserPanel(state) {
  if (!canCreateAdminUser(state)) {
    return '<p class="internal-muted-note">Criação de usuário indisponível para este perfil.</p>';
  }

  const admin = state.admin || createAdminState();
  return `
    <form class="internal-action-card internal-admin-form" data-admin-create-user-form>
      <h4>Criar usuário</h4>
      <label><span>Login</span><input name="login" autocomplete="off" required></label>
      <label><span>Nome</span><input name="nome" autocomplete="off" required></label>
      <label><span>Email opcional</span><input name="email" type="email" autocomplete="off"></label>
      <label><span>Senha inicial</span><input name="senha_inicial" type="password" autocomplete="new-password" required></label>
      <button type="submit" ${admin.createForm.status === 'submitting' ? 'disabled' : ''}>Criar usuário</button>
      ${renderAdminStatusMessage(admin.createForm)}
    </form>
  `;
}

function renderAdminBlockControl(state) {
  const admin = state.admin || createAdminState();
  const user = admin.user;

  if (!user || !canBlockAdminUser(state)) {
    return '';
  }

  if (user.bloqueado) {
    return `
      <form class="internal-action-card internal-admin-form" data-admin-unblock-user-form>
        <h4>Desbloquear usuário</h4>
        <p class="internal-sensitive-note">Desbloqueio reabilita o acesso conforme validação do backend.</p>
        <label><span>Confirme</span><input name="confirmacao" type="text" required placeholder="DESBLOQUEAR"></label>
        <button type="submit" ${(admin.unblockForm || createAdminFormState()).status === 'submitting' ? 'disabled' : ''}>Desbloquear usuário</button>
        ${renderAdminStatusMessage(admin.unblockForm || createAdminFormState())}
      </form>
    `;
  }

  return `
    <form class="internal-action-card internal-admin-form" data-admin-block-user-form>
      <h4>Bloquear usuário</h4>
      <p class="internal-sensitive-note">Bloqueio revoga acesso futuro conforme regra do backend.</p>
      <label><span>Confirme</span><input name="confirmacao" type="text" required placeholder="BLOQUEAR"></label>
      <button type="submit" ${(admin.blockForm || createAdminFormState()).status === 'submitting' ? 'disabled' : ''}>Bloquear usuário</button>
      ${renderAdminStatusMessage(admin.blockForm || createAdminFormState())}
    </form>
  `;
}

function renderAdminSensitiveActions(state) {
  const admin = state.admin || createAdminState();

  if (!admin.user) {
    return '';
  }

  return `
    <div class="internal-admin-actions-grid">
      ${renderAdminBlockControl(state)}
      ${canResetAdminUserPassword(state) ? `
        <form class="internal-action-card internal-admin-form" data-admin-reset-password-form>
          <h4>Redefinir senha</h4>
          <label><span>Nova senha</span><input name="nova_senha" type="password" autocomplete="new-password" required></label>
          <label><span>Confirmar senha</span><input name="confirmar_nova_senha" type="password" autocomplete="new-password" required></label>
          <button type="submit" ${admin.resetForm.status === 'submitting' ? 'disabled' : ''}>Redefinir senha</button>
          ${renderAdminStatusMessage(admin.resetForm)}
        </form>
      ` : ''}
    </div>
  `;
}
function renderAdminAssignProfilePanel(state) {
  const admin = state.admin || createAdminState();

  if (!admin.user) {
    return '';
  }

  if (!canAssignAdminUserProfile(state)) {
    return '<p class="internal-muted-note">Atribuição de perfil indisponível para este perfil.</p>';
  }

  if (!canReadAdminProfiles(state)) {
    return '<p class="internal-muted-note">Para atribuir perfis, também é necessário listar perfis.</p>';
  }

  return `
    <form class="internal-action-card internal-admin-form" data-admin-assign-profile-form>
      <h4>Atribuir perfil</h4>
      <label>
        <span>Perfil</span>
        <select name="perfil_id" required>
          <option value="">Selecione</option>
          ${(admin.availableProfiles || []).map((profile) => `
            <option value="${escapeHtml(String(profile.id))}">${escapeHtml(profile.nome || profile.chave || `Perfil #${profile.id}`)}</option>
          `).join('')}
        </select>
      </label>
      <label><span>Módulo opcional</span><input name="modulo" autocomplete="off" placeholder="global se vazio"></label>
      <button type="submit" ${admin.assignProfileForm.status === 'submitting' ? 'disabled' : ''}>Atribuir perfil</button>
      ${renderAdminStatusMessage(admin.assignProfileForm)}
    </form>
  `;
}

function renderAdminPanel(state) {
  const admin = state.admin || createAdminState();

  if (!canAccessAdminModule(state)) {
    return `
      <section class="internal-module-workspace" aria-labelledby="admin-title">
        <div class="internal-section-heading">
          <h2 id="admin-title">Administração</h2>
          <p>Seu perfil não possui permissão administrativa.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="internal-module-workspace internal-admin-workspace" aria-labelledby="admin-title">
      <div class="internal-section-heading">
        <h2 id="admin-title">Administração</h2>
        <p>Gestão interna de usuários e vínculos usuário/perfil.</p>
      </div>
      <div class="internal-admin-layout">
        <aside class="internal-admin-list-panel">
          <div class="internal-history-heading internal-admin-heading-row">
            <div>
              <h3>Usuários internos</h3>
              <p>${escapeHtml(admin.message || 'Pesquise e selecione um usuário para administrar.')}</p>
            </div>
            <button type="button" class="internal-secondary-action" data-action="refresh-admin-users">Atualizar</button>
          </div>
          ${renderAdminUserList(state)}
          ${renderAdminCreateUserPanel(state)}
        </aside>
        <section class="internal-admin-detail-panel" aria-label="Detalhe administrativo do usuário">
          ${renderAdminUserDetail(state)}
          <article class="internal-action-card internal-admin-profiles-card">
            <div class="internal-history-heading">
              <div>
                <h4>Vínculos usuário/perfil</h4>
                <p>Desativação lógica usa auditoria e validação no backend.</p>
              </div>
            </div>
            ${renderAdminUserProfiles(state)}
            ${renderAdminStatusMessage(admin.deactivateProfileForm)}
          </article>
          ${renderAdminAssignProfilePanel(state)}
          ${renderAdminSensitiveActions(state)}
        </section>
      </div>
    </section>
  `;
}
function renderInternalIluminacaoShell(root, state) {
  const stateInfo = SESSION_STATES[state.sessionState] || SESSION_STATES.technical_error;
  const maintenanceMode = isMaintenanceLikeUser(state.permissions || []);

  root.innerHTML = `
    <main class="internal-page${maintenanceMode ? ' is-maintenance-mode' : ''}${state.activeModule === 'dashboard' ? ' is-dashboard-mode' : ''}${state.activeModule === 'iluminacao' ? ' is-iluminacao-mode' : ''}${state.activeModule === 'admin' ? ' is-admin-mode' : ''}" aria-labelledby="internal-page-title">
      <header class="internal-topbar">
        <div>
          <p class="internal-kicker">Homologação / Integração de sessão</p>
          <h1 id="internal-page-title">Geoportal Interno</h1>
          <p class="internal-subtitle">
            Atendimento interno de Iluminação Pública com acesso por perfil e operações registradas.
          </p>
        </div>
        ${renderSessionBox(state)}
      </header>

      ${state.sessionState !== 'authenticated'
        ? `
          <section class="internal-alert is-${stateInfo.tone}" aria-label="Aviso de segurança">
            <strong>${escapeHtml(stateInfo.title)}:</strong>
            ${escapeHtml(state.message || stateInfo.text)}
          </section>
        `
        : ''}

      ${renderLoginPanel(state)}

      <div class="internal-shell-layout">
        <aside class="internal-sidebar" aria-label="Menu de módulos por permissão">
          <div class="internal-sidebar-heading">
            <h2>Módulos</h2>
            <p>Acesso conforme perfil interno.</p>
          </div>
          <nav class="internal-module-nav" aria-label="Módulos planejados">
            ${renderModuleMenu(state)}
          </nav>
        </aside>

        <section class="internal-content" aria-label="Conteúdo do módulo ativo">
          ${currentState.activeModule !== 'iluminacao' || maintenanceMode
            ? ''
            : `
              <section class="internal-summary" aria-labelledby="summary-title">
                <div class="internal-section-heading">
                  <h2 id="summary-title">Resumo</h2>
                  <p>Indicadores simples calculados a partir da listagem carregada.</p>
                </div>
                <div class="internal-summary-grid">
                  ${renderSummaryCards(state)}
                </div>
              </section>
            `}

          ${currentState.activeModule === 'dashboard'
    ? renderDashboardPanel(currentState)
    : currentState.activeModule === 'iluminacao'
      ? `
          <section class="internal-module-workspace" aria-labelledby="module-workspace-title">
            <div class="internal-section-heading">
              <h2 id="module-workspace-title">Solicitações de Iluminação</h2>
              <p>${maintenanceMode
                ? 'Acompanhe protocolos, fase do atendimento, observações, coordenadas e rota.'
                : 'Consulte chamados, abra detalhes e registre interações internas conforme seu perfil.'}</p>
            </div>

            <div class="internal-workspace">
              ${renderRelatorioPanel(state)}
              ${renderInternalOperationalMapPanel(state)}
              ${renderSolicitacoesPanel(state)}

              <div
                class="internal-detail-grid"
                id="internal-iluminacao-detalhe"
                data-solicitacao-detail-section
              >
                ${renderSolicitacaoDetailPanel(state)}
              </div>
            </div>
          </section>
    `
      : currentState.activeModule === 'admin'
        ? renderAdminPanel(currentState)
        : renderNoAvailableModulePanel()}
        </section>
      </div>

      <footer class="internal-footer">
        Geoportal público preservado. A autorização real continua no backend; esta shell não armazena token.
      </footer>
    </main>
  `;

  syncOperationalDetailMap(root, state);
  syncDashboardMap(root, state);
  syncInternalOperationalMap(root, state);
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
      message: 'Sessão ausente, expirada ou inválida. Login interno disponível nesta tela.',
      hasChecked: true
    });
  }

  if (response.status === 403) {
    return createSessionState({
      sessionState: 'forbidden',
      statusCode: response.status,
      message: 'Acesso negado pelo sistema para a verificação de sessão.',
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
      message: 'Serviço interno temporariamente indisponível.',
      hasChecked: true
    });
  }

  if (!response.ok) {
    return createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Não foi possível verificar a sessão interna neste momento.',
      hasChecked: true
    });
  }

  const payload = await response.json();

  if (!isValidMePayload(payload)) {
    return createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Resposta de sessão em formato inesperado.',
      hasChecked: true
    });
  }

  if (payload.authenticated !== true) {
    return createSessionState({
      sessionState: 'unauthenticated',
      statusCode: response.status,
      message: 'Sessão interna não autenticada.',
      hasChecked: true
    });
  }

  return createSessionState({
    sessionState: 'authenticated',
    usuarioId: payload.usuario_id,
    login: typeof payload.login === 'string' ? payload.login.trim() : '',
    nome: typeof payload.nome === 'string' ? payload.nome.trim() : '',
    profiles: Array.isArray(payload.perfis) ? normalizeProfiles(payload.perfis) : [],
    permissions: normalizePermissions(payload.permissoes),
    statusCode: response.status,
    message: 'Sessão interna confirmada.',
    hasChecked: true
  });
}

function createLoggedOutState(message = 'Sessão encerrada.', statusCode = null) {
  return createSessionState({
    sessionState: 'unauthenticated',
    statusCode,
    message,
    hasChecked: true,
    loginStatus: 'idle',
    loginMessage: message,
    loginValue: ''
  });
}

async function fetchLogoutInternalSession() {
  const response = await fetch(AUTH_LOGOUT_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    }
  });

  if (response.ok || response.status === 401) {
    return {
      loggedOut: true,
      statusCode: response.status,
      message: 'Sessão encerrada.'
    };
  }

  if (response.status === 403) {
    return {
      loggedOut: false,
      statusCode: response.status,
      message: 'Não foi possível encerrar a sessão. Requisição interna inválida.'
    };
  }

  if (response.status === 503) {
    return {
      loggedOut: false,
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para encerrar a sessão.'
    };
  }

  return {
    loggedOut: false,
    statusCode: response.status,
    message: 'Não foi possível encerrar a sessão agora.'
  };
}

function dashboardErrorMessage(statusCode) {
  if (statusCode === 401) {
    return 'Sessao expirada. Faca login novamente para ver o dashboard.';
  }

  if (statusCode === 403) {
    return 'Voce nao tem permissao para visualizar indicadores gerenciais deste modulo.';
  }

  if (statusCode === 404) {
    return 'Dashboard indisponivel nesta versao da API interna.';
  }

  if (statusCode === 422) {
    return 'Parametros invalidos para o dashboard.';
  }

  if (statusCode === 503) {
    return 'Servico temporariamente indisponivel para carregar o dashboard.';
  }

  return 'Nao foi possivel carregar o dashboard agora.';
}


function buildDashboardEndpointUrl(endpoint, filters = {}, allowed = []) {
  const [base, query = ''] = endpoint.split('?');
  const params = new URLSearchParams(query);
  const dataInicio = safeText(filters.dataInicio, '');
  const dataFim = safeText(filters.dataFim, '');
  const status = safeText(filters.status, 'all');
  const prioridade = safeText(filters.prioridade, 'all');
  const tipo = safeText(filters.tipo, 'all');

  if (allowed.includes('data_inicio') && dataInicio) {
    params.set('data_inicio', dataInicio);
  }

  if (allowed.includes('data_fim') && dataFim) {
    params.set('data_fim', dataFim);
  }

  if (allowed.includes('ativos') && status === 'active') {
    params.set('ativos', 'true');
  } else if (allowed.includes('status') && status && status !== 'all' && status !== 'active') {
    params.set('status', status);
  }

  if (allowed.includes('prioridade') && prioridade && prioridade !== 'all') {
    params.set('prioridade', prioridade);
  }

  if (allowed.includes('tipo') && tipo && tipo !== 'all') {
    params.set('tipo', tipo);
  }

  const queryText = params.toString();
  return queryText ? `${base}?${queryText}` : base;
}

async function fetchDashboardJson(endpoint, normalizer) {
  const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return {
      status: 'unauthenticated',
      statusCode: response.status,
      message: dashboardErrorMessage(response.status)
    };
  }

  if (!response.ok) {
    return {
      status: 'error',
      statusCode: response.status,
      message: dashboardErrorMessage(response.status)
    };
  }

  const payload = await response.json();

  return {
    status: 'ready',
    statusCode: response.status,
    data: normalizer(payload)
  };
}

async function fetchDashboardGeralWidgets(filters = {}) {
  const resumo = await fetchDashboardJson(
    buildDashboardEndpointUrl(INTERNAL_DASHBOARD_RESUMO_ENDPOINT, filters, ['data_inicio', 'data_fim', 'status', 'ativos', 'prioridade', 'tipo']),
    normalizeDashboardResumo
  );

  if (resumo.status !== 'ready') {
    return resumo;
  }

  const ranking = await fetchDashboardJson(
    buildDashboardEndpointUrl(INTERNAL_DASHBOARD_RANKING_ENDPOINT, filters, ['data_inicio', 'data_fim', 'status', 'prioridade', 'tipo']),
    normalizeDashboardRanking
  );

  if (ranking.status !== 'ready') {
    return ranking;
  }

  const series = await fetchDashboardJson(
    buildDashboardEndpointUrl(INTERNAL_DASHBOARD_SERIES_SEMANAL_ENDPOINT, filters, ['data_inicio', 'data_fim', 'status']),
    normalizeDashboardSeries
  );

  if (series.status !== 'ready') {
    return series;
  }

  return {
    status: 'ready',
    statusCode: 200,
    resumo: resumo.data,
    ranking: ranking.data,
    series: series.data,
    message: 'Dashboard carregado.'
  };
}

async function fetchSolicitacoesInternas(offset = 0, options = {}) {
  const response = await fetch(buildSolicitacoesUrl(offset, options), {
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
      message: 'Sessão ausente ou expirada. Faça login novamente para listar solicitações.'
    });
  }

  if (response.status === 403) {
    return createSolicitacoesState({
      status: 'forbidden',
      offset,
      statusCode: response.status,
      message: 'Sem permissão para listar solicitações internas de Iluminação.'
    });
  }

  if (response.status === 422) {
    return createSolicitacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Parâmetros de listagem inválidos. A consulta foi mantida sem detalhes técnicos.'
    });
  }

  if (response.status === 503) {
    return createSolicitacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para listar solicitações.'
    });
  }

  if (!response.ok) {
    return createSolicitacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Não foi possível carregar a listagem interna neste momento.'
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
      ? 'Listagem somente leitura carregada com campos mínimos.'
      : 'Nenhuma solicitação encontrada nesta página.'
  });
}

function getRelatorioFriendlyErrorMessage(statusCode) {
  if (statusCode === 401) {
    return 'Sessao expirada. Entre novamente para gerar o relatorio.';
  }

  if (statusCode === 403) {
    return 'Relatorio indisponivel para este perfil.';
  }

  if (statusCode === 404) {
    return 'Relatorio indisponivel nesta versao. Verifique se a API interna foi atualizada.';
  }

  if (statusCode === 422) {
    return 'Periodo ou filtros invalidos para o relatorio.';
  }

  if (statusCode === 503) {
    return 'Servico temporariamente indisponivel para gerar o relatorio.';
  }

  return 'Nao foi possivel concluir o relatorio agora.';
}

function extractDownloadFilename(response, fallbackName) {
  const header = response.headers.get('content-disposition') || '';
  const match = header.match(/filename=\"([^\"]+)\"/i);
  return match && match[1] ? match[1] : fallbackName;
}

function buildRelatorioFallbackFilename(filters = {}) {
  const dataInicio = normalizeRelatorioDateValue(filters.dataInicio);
  const dataFim = normalizeRelatorioDateValue(filters.dataFim);

  if (dataInicio && dataFim) {
    return `relatorio_iluminacao_${dataInicio}_${dataFim}.csv`;
  }

  if (dataInicio) {
    return `relatorio_iluminacao_desde_${dataInicio}.csv`;
  }

  if (dataFim) {
    return `relatorio_iluminacao_ate_${dataFim}.csv`;
  }

  return 'relatorio_iluminacao_geral.csv';
}

async function fetchRelatorioSolicitacoesResumo(filters) {
  const response = await fetch(buildRelatorioSolicitacoesResumoUrl(filters), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    return {
      status: response.status === 401 ? 'expired' : 'error',
      statusCode: response.status,
      message: getRelatorioFriendlyErrorMessage(response.status),
      summary: null
    };
  }

  const payload = await response.json();

  if (!isValidRelatorioResumoPayload(payload)) {
    return {
      status: 'error',
      statusCode: response.status,
      message: 'Resumo do relatorio em formato inesperado.',
      summary: null
    };
  }

  return {
    status: 'success',
    statusCode: response.status,
    message: 'Resumo administrativo atualizado.',
    summary: payload
  };
}

async function fetchRelatorioSolicitacoesCsv(filters) {
  const fallbackName = buildRelatorioFallbackFilename(filters);
  const response = await fetch(buildRelatorioSolicitacoesCsvUrl(filters), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'text/csv'
    }
  });

  if (!response.ok) {
    return {
      status: response.status === 401 ? 'expired' : 'error',
      statusCode: response.status,
      message: getRelatorioFriendlyErrorMessage(response.status)
    };
  }

  return {
    status: 'success',
    statusCode: response.status,
    message: 'Relatorio exportado com sucesso.',
    blob: await response.blob(),
    filename: extractDownloadFilename(response, fallbackName)
  };
}


async function fetchMapaOcorrencias(options = {}) {
  const response = await fetch(buildMapaOcorrenciasUrl(options), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return createOperationalMapState({
      status: 'unauthenticated',
      statusCode: response.status,
      filters: options,
      message: 'Sessão expirada. Faça login novamente para carregar o mapa operacional.'
    });
  }

  if (response.status === 403) {
    return createOperationalMapState({
      status: 'forbidden',
      statusCode: response.status,
      filters: options,
      message: 'Sem permissão para carregar o mapa operacional de Iluminação.'
    });
  }

  if (response.status === 422) {
    return createOperationalMapState({
      status: 'error',
      statusCode: response.status,
      filters: options,
      message: 'Filtros do mapa inválidos. Ajuste os parâmetros e tente novamente.'
    });
  }

  if (response.status === 503) {
    return createOperationalMapState({
      status: 'error',
      statusCode: response.status,
      filters: options,
      message: 'Serviço interno temporariamente indisponível para o mapa operacional.'
    });
  }

  if (!response.ok) {
    return createOperationalMapState({
      status: 'error',
      statusCode: response.status,
      filters: options,
      message: 'Não foi possível carregar o mapa operacional neste momento.'
    });
  }

  const payload = await response.json();

  if (!isValidMapaOcorrenciasPayload(payload)) {
    return createOperationalMapState({
      status: 'error',
      statusCode: response.status,
      filters: options,
      message: 'Resposta do mapa em formato inesperado.'
    });
  }

  const items = payload.items
    .map(toDisplayMapaOcorrencia)
    .filter((item) => item.id && item.hasCoordinates);
  const safeLimit = Math.max(1, Math.min(500, payload.limit));
  const safeOffset = Math.max(0, payload.offset);
  const safeTotal = Math.max(0, payload.total);

  return createOperationalMapState({
    status: items.length > 0 ? 'ready' : 'empty',
    items,
    total: safeTotal,
    limit: safeLimit,
    offset: safeOffset,
    statusCode: response.status,
    filters: options,
    message: items.length > 0
      ? 'Mapa operacional carregado sem dados pessoais na coleção de pontos.'
      : 'Nenhuma ocorrência com coordenada encontrada para o filtro atual.'
  });
}

async function fetchMapaOcorrenciaPopup(solicitacaoId) {
  const response = await fetch(buildMapaOcorrenciaPopupUrl(solicitacaoId), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return {
      status: 'unauthenticated',
      solicitacaoId,
      item: null,
      statusCode: response.status,
      message: 'Sessão expirada. Faça login novamente para abrir o popup.'
    };
  }

  if (response.status === 403) {
    return {
      status: 'forbidden',
      solicitacaoId,
      item: null,
      statusCode: response.status,
      message: 'Sem permissão para abrir o resumo operacional.'
    };
  }

  if (response.status === 404) {
    return {
      status: 'error',
      solicitacaoId,
      item: null,
      statusCode: response.status,
      message: 'Ocorrência não encontrada ou indisponível.'
    };
  }

  if (response.status === 422) {
    return {
      status: 'error',
      solicitacaoId,
      item: null,
      statusCode: response.status,
      message: 'Identificador da ocorrência inválido.'
    };
  }

  if (!response.ok) {
    return {
      status: 'error',
      solicitacaoId,
      item: null,
      statusCode: response.status,
      message: 'Não foi possível abrir o popup operacional.'
    };
  }

  const payload = await response.json();

  if (!isValidMapaPopupPayload(payload)) {
    return {
      status: 'error',
      solicitacaoId,
      item: null,
      statusCode: response.status,
      message: 'Resposta do popup em formato inesperado.'
    };
  }

  return {
    status: 'ready',
    solicitacaoId,
    item: toDisplayMapaPopup(payload),
    statusCode: response.status,
    message: 'Resumo operacional carregado.'
  };
}

async function fetchSolicitacaoDetail(solicitacaoId) {
  const response = await fetch(buildSolicitacaoDetailUrl(solicitacaoId), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return createDetalheState({
      status: 'expired',
      solicitacaoId,
      statusCode: response.status,
      message: 'Sessão ausente ou expirada ao consultar o detalhe. Faça login novamente.'
    });
  }

  if (response.status === 403) {
    return createDetalheState({
      status: 'forbidden',
      solicitacaoId,
      statusCode: response.status,
      message: 'Sem permissão para visualizar o detalhe desta solicitação.'
    });
  }

  if (response.status === 404) {
    return createDetalheState({
      status: 'not_found',
      solicitacaoId,
      statusCode: response.status,
      message: 'Solicitação não encontrada ou removida logicamente.'
    });
  }

  if (response.status === 422) {
    return createDetalheState({
      status: 'error',
      solicitacaoId,
      statusCode: response.status,
      message: 'Identificador da solicitação inválido.'
    });
  }

  if (response.status === 503) {
    return createDetalheState({
      status: 'error',
      solicitacaoId,
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para carregar o detalhe.'
    });
  }

  if (!response.ok) {
    return createDetalheState({
      status: 'error',
      solicitacaoId,
      statusCode: response.status,
      message: 'Não foi possível carregar o detalhe neste momento.'
    });
  }

  const payload = await response.json();

  if (!isValidSolicitacaoDetailPayload(payload)) {
    return createDetalheState({
      status: 'error',
      solicitacaoId,
      statusCode: response.status,
      message: 'Resposta de detalhe em formato inesperado.'
    });
  }

  return createDetalheState({
    status: 'loaded',
    item: toDisplaySolicitacaoDetail(payload),
    solicitacaoId,
    statusCode: response.status,
      message: 'Detalhe somente leitura carregado.'
  });
}

async function fetchSolicitacaoHistorico(solicitacaoId, offset = 0) {
  const response = await fetch(buildSolicitacaoHistoricoUrl(solicitacaoId, offset), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return createHistoricoState({
      status: 'expired',
      offset,
      statusCode: response.status,
      message: 'Sessão ausente ou expirada ao consultar o histórico. Faça login novamente.'
    });
  }

  if (response.status === 403) {
    return createHistoricoState({
      status: 'forbidden',
      offset,
      statusCode: response.status,
      message: 'Sem permissão para visualizar o histórico desta solicitação.'
    });
  }

  if (response.status === 404) {
    return createHistoricoState({
      status: 'not_found',
      offset,
      statusCode: response.status,
      message: 'Solicitação não encontrada ou removida logicamente.'
    });
  }

  if (response.status === 422) {
    return createHistoricoState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Identificador ou paginação de histórico inválidos.'
    });
  }

  if (response.status === 503) {
    return createHistoricoState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para carregar o histórico.'
    });
  }

  if (!response.ok) {
    return createHistoricoState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Não foi possível carregar o histórico neste momento.'
    });
  }

  const payload = await response.json();

  if (
    !isValidHistoricoPayload(payload)
    || !payload.items.every(isValidHistoricoEventPayload)
  ) {
    return createHistoricoState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Resposta de histórico em formato inesperado.'
    });
  }

  const safeLimit = Math.max(1, Math.min(100, payload.limit));
  const safeOffset = Math.max(0, payload.offset);
  const safeTotal = Math.max(0, payload.total);
  const items = payload.items.map(toDisplayHistoricoEvent);

  return createHistoricoState({
    status: items.length > 0 ? 'ready' : 'empty',
    items,
    total: safeTotal,
    limit: safeLimit,
    offset: safeOffset,
    statusCode: response.status,
    message: items.length > 0
      ? 'Histórico somente leitura carregado em ordem cronológica.'
      : 'Nenhum evento de histórico encontrado para esta página.'
  });
}

async function fetchSolicitacaoObservacoes(solicitacaoId, offset = 0) {
  const response = await fetch(buildSolicitacaoObservacoesUrl(solicitacaoId, offset), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 401) {
    return createObservacoesState({
      status: 'expired',
      offset,
      statusCode: response.status,
      message: 'Sessão ausente ou expirada ao consultar observações. Faça login novamente.'
    });
  }

  if (response.status === 403) {
    return createObservacoesState({
      status: 'forbidden',
      offset,
      statusCode: response.status,
      message: 'Sem permissão para visualizar observações desta solicitação.'
    });
  }

  if (response.status === 404) {
    return createObservacoesState({
      status: 'not_found',
      offset,
      statusCode: response.status,
      message: 'Solicitação não encontrada ou removida logicamente.'
    });
  }

  if (response.status === 422) {
    return createObservacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Identificador ou paginação de observações inválidos.'
    });
  }

  if (response.status === 503) {
    return createObservacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para carregar observações.'
    });
  }

  if (!response.ok) {
    return createObservacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Não foi possível carregar observações neste momento.'
    });
  }

  const payload = await response.json();

  if (
    !isValidObservacoesPayload(payload)
    || !payload.items.every(isValidObservacaoPayload)
  ) {
    return createObservacoesState({
      status: 'error',
      offset,
      statusCode: response.status,
      message: 'Resposta de observações em formato inesperado.'
    });
  }

  const safeLimit = Math.max(1, Math.min(100, payload.limit));
  const safeOffset = Math.max(0, payload.offset);
  const safeTotal = Math.max(0, payload.total);
  const items = payload.items.map(toDisplayObservacao);

  return createObservacoesState({
    status: items.length > 0 ? 'ready' : 'empty',
    items,
    total: safeTotal,
    limit: safeLimit,
    offset: safeOffset,
    statusCode: response.status,
    message: items.length > 0
      ? 'Observações internas somente leitura carregadas em ordem cronológica.'
      : 'Nenhuma observação interna encontrada para esta página.'
  });
}

async function fetchCreateSolicitacaoObservacao(solicitacaoId, observacao) {
  const response = await fetch(buildCreateSolicitacaoObservacaoUrl(solicitacaoId), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify({
      observacao
    })
  });

  if (response.status === 401) {
    return createObservacaoFormState({
      status: 'expired',
      statusCode: response.status,
      message: 'Sessão ausente ou expirada ao salvar observação. Faça login novamente.'
    });
  }

  if (response.status === 403) {
    return createObservacaoFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Sem permissão para comentar ou requisição interna inválida.'
    });
  }

  if (response.status === 404) {
    return createObservacaoFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Solicitação não encontrada ou removida logicamente.'
    });
  }

  if (response.status === 422) {
    return createObservacaoFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Observação inválida. Use texto entre 3 e 2000 caracteres.'
    });
  }

  if (response.status === 503) {
    return createObservacaoFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para salvar observação.'
    });
  }

  if (response.status !== 201) {
    return createObservacaoFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Não foi possível salvar a observação neste momento.'
    });
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    return createObservacaoFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Resposta de criação de observação em formato inesperado.'
    });
  }

  if (!isValidObservacaoPayload(payload)) {
    return createObservacaoFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Resposta de criação de observação em formato inesperado.'
    });
  }

  return createObservacaoFormState({
    status: 'success',
    value: '',
    statusCode: response.status,
    message: 'Observação interna criada. Observações recarregadas quando a leitura estiver permitida.'
  });
}

async function fetchUpdateSolicitacaoStatus(solicitacaoId, status, observacao) {
  const response = await fetch(buildUpdateSolicitacaoStatusUrl(solicitacaoId), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify({
      status,
      observacao
    })
  });

  if (response.status === 401) {
    return createStatusFormState({
      status: 'expired',
      statusCode: response.status,
      message: 'Sessão ausente ou expirada ao atualizar status. Faça login novamente.'
    });
  }

  if (response.status === 403) {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Sem permissão para alterar status ou requisição interna inválida.'
    });
  }

  if (response.status === 404) {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Solicitação não encontrada ou removida logicamente.'
    });
  }

  if (response.status === 409) {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Transição de status não permitida. Recarregue o detalhe antes de tentar novamente.'
    });
  }

  if (response.status === 422) {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Status ou justificativa inválidos para a alteração normal.'
    });
  }

  if (response.status === 503) {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para atualizar status.'
    });
  }

  if (response.status !== 200) {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Não foi possível atualizar o status neste momento.'
    });
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Resposta de alteração de status em formato inesperado.'
    });
  }

  if (!isValidStatusUpdateResponsePayload(payload)) {
    return createStatusFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Resposta de alteração de status em formato inesperado.'
    });
  }

  return createStatusFormState({
    status: 'success',
    selectedStatus: '',
    observacao: '',
    statusCode: response.status,
    message: 'Status atualizado. Detalhe e listagem foram recarregados; histórico foi recarregado se já estava aberto.'
  });
}

async function fetchUpdateSolicitacaoStatusCorrecao(
  solicitacaoId,
  novoStatus,
  justificativa
) {
  const response = await fetch(buildUpdateSolicitacaoStatusCorrecaoUrl(solicitacaoId), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify({
      novo_status: novoStatus,
      justificativa
    })
  });

  if (response.status === 401) {
    return createStatusCorrectionFormState({
      status: 'expired',
      open: true,
      statusCode: response.status,
      message: 'Sessão expirada. Faça login novamente.'
    });
  }

  if (response.status === 403) {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Você não tem permissão para corrigir status administrativamente ou a requisição interna foi recusada.'
    });
  }

  if (response.status === 404) {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Solicitação não encontrada.'
    });
  }

  if (response.status === 409) {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Correção administrativa não permitida para o estado atual da solicitação.'
    });
  }

  if (response.status === 422) {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Dados inválidos. Confira o novo status e a justificativa.'
    });
  }

  if (response.status === 503) {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Serviço indisponível. Tente novamente ou acione o suporte.'
    });
  }

  if (response.status !== 200) {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Não foi possível corrigir o status administrativamente neste momento.'
    });
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Resposta de correção administrativa em formato inesperado.'
    });
  }

  if (!isValidStatusUpdateResponsePayload(payload)) {
    return createStatusCorrectionFormState({
      status: 'error',
      open: true,
      statusCode: response.status,
      message: 'Resposta de correção administrativa em formato inesperado.'
    });
  }

  return createStatusCorrectionFormState({
    status: 'success',
    open: false,
    selectedStatus: '',
    justificativa: '',
    confirmed: false,
    statusCode: response.status,
    message: 'Correção administrativa aplicada. Detalhe e histórico foram recarregados.'
  });
}

async function fetchUpdateSolicitacaoPrioridade(solicitacaoId, prioridade, observacao) {
  const response = await fetch(buildUpdateSolicitacaoPrioridadeUrl(solicitacaoId), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify({
      prioridade,
      observacao
    })
  });

  if (response.status === 401) {
    return createPrioridadeFormState({
      status: 'expired',
      statusCode: response.status,
      message: 'Sessão ausente ou expirada ao atualizar prioridade. Faça login novamente.'
    });
  }

  if (response.status === 403) {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Sem permissão para alterar prioridade ou requisição interna inválida.'
    });
  }

  if (response.status === 404) {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Solicitação não encontrada ou removida logicamente.'
    });
  }

  if (response.status === 409) {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Solicitação em status finalizado. Prioridade não pode ser alterada por este fluxo.'
    });
  }

  if (response.status === 422) {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Prioridade ou justificativa inválidas para a alteração.'
    });
  }

  if (response.status === 503) {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Serviço interno temporariamente indisponível para atualizar prioridade.'
    });
  }

  if (response.status !== 200) {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Não foi possível atualizar a prioridade neste momento.'
    });
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Resposta de alteração de prioridade em formato inesperado.'
    });
  }

  if (!isValidPrioridadeUpdateResponsePayload(payload)) {
    return createPrioridadeFormState({
      status: 'error',
      statusCode: response.status,
      message: 'Resposta de alteração de prioridade em formato inesperado.'
    });
  }

  return createPrioridadeFormState({
    status: 'success',
    selectedPriority: '',
    observacao: '',
    statusCode: response.status,
    message: 'Prioridade atualizada. Detalhe, listagem e histórico foram recarregados.'
  });
}


function readOperationalMapFilterFormState(form, currentMap = createOperationalMapState()) {
  const formData = new FormData(form);
  const limit = Number.parseInt(String(formData.get('limit') || MAPA_OCORRENCIAS_LIMIT), 10);

  return createOperationalMapState({
    ...currentMap,
    filters: {
      status: safeText(formData.get('status'), ''),
      prioridade: safeText(formData.get('prioridade'), ''),
      ativos: formData.get('ativos') === 'true',
      limit: Number.isInteger(limit) ? Math.max(1, Math.min(500, limit)) : MAPA_OCORRENCIAS_LIMIT
    },
    selectedIds: [],
    selectionMode: '',
    viewState: null,
    popup: createOperationalMapState().popup
  });
}

function filterOperationalMapVisiblePoints(root, state) {
  const mapState = state.mapaOperacional || createOperationalMapState();
  const visibleIds = getOperationalMapVisibleIds(internalOperationalMap, mapState.items || []);
  const viewState = getOperationalMapViewState(internalOperationalMap) || mapState.viewState;

  renderApp(root, {
    ...state,
    activeModule: 'iluminacao',
    mapaOperacional: createOperationalMapState({
      ...mapState,
      selectedIds: visibleIds,
      selectionMode: 'viewport',
      viewState,
      message: visibleIds.length > 0
        ? `${visibleIds.length} ponto(s) visível(is) filtrando a lista carregada.`
        : 'Nenhum ponto visível no recorte atual do mapa.'
    })
  });
}

function updateOperationalMapViewportSelection(root, state, visibleIds, viewState) {
  const mapState = state.mapaOperacional || createOperationalMapState();

  if (mapState.selectionMode !== 'viewport') {
    currentState = {
      ...currentState,
      mapaOperacional: createOperationalMapState({
        ...(currentState.mapaOperacional || mapState),
        viewState
      })
    };
    return;
  }

  if (areOperationalMapIdListsEqual(mapState.selectedIds || [], visibleIds || []) && JSON.stringify(mapState.viewState || null) === JSON.stringify(viewState || null)) {
    return;
  }

  renderApp(root, {
    ...state,
    activeModule: 'iluminacao',
    mapaOperacional: createOperationalMapState({
      ...mapState,
      selectedIds: visibleIds,
      selectionMode: 'viewport',
      viewState,
      message: visibleIds.length > 0
        ? `${visibleIds.length} ponto(s) visível(is) filtrando a lista carregada.`
        : 'Nenhum ponto visível no recorte atual do mapa.'
    })
  });
}

async function loadOperationalMap(root, state, nextMapState = null) {
  const currentMap = nextMapState || state.mapaOperacional || createOperationalMapState();

  if (!canListSolicitacoes(state)) {
    renderApp(root, {
      ...state,
      mapaOperacional: createOperationalMapState({
        ...currentMap,
        status: state.sessionState === 'authenticated' ? 'forbidden' : 'idle',
        statusCode: state.sessionState === 'authenticated' ? 403 : null,
        message: state.sessionState === 'authenticated'
          ? 'Mapa operacional indisponível para este perfil.'
          : 'Mapa operacional aguarda autenticação.'
      })
    });
    return;
  }

  renderApp(root, {
    ...state,
    activeModule: 'iluminacao',
    mapaOperacional: createOperationalMapState({
      ...currentMap,
      status: 'loading',
      message: 'Carregando mapa operacional.'
    })
  });

  try {
    const result = await fetchMapaOcorrencias(currentMap.filters || {});

    if (result.status === 'unauthenticated') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: result.message,
        hasChecked: true,
        mapaOperacional: createOperationalMapState({
          ...result,
          filters: currentMap.filters,
          viewState: currentMap.viewState
        })
      }));
      return;
    }

    renderApp(root, {
      ...currentState,
      activeModule: 'iluminacao',
      mapaOperacional: createOperationalMapState({
        ...result,
        filters: currentMap.filters,
        viewState: currentMap.viewState
      })
    });
  } catch {
    renderApp(root, {
      ...state,
      activeModule: 'iluminacao',
      mapaOperacional: createOperationalMapState({
        ...currentMap,
        status: 'error',
        message: 'Falha temporária de conexão ao carregar o mapa operacional.'
      })
    });
  }
}

async function selectOperationalMapOccurrences(root, state, solicitacaoIds) {
  const currentMap = state.mapaOperacional || createOperationalMapState();
  const clickedIds = (Array.isArray(solicitacaoIds) ? solicitacaoIds : [solicitacaoIds])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const selectedIds = mergeOperationalMapSelectionIds(currentMap.selectedIds || [], clickedIds);
  const popupSolicitacaoId = clickedIds[clickedIds.length - 1] || null;

  if (!popupSolicitacaoId) {
    return;
  }

  renderApp(root, {
    ...state,
    activeModule: 'iluminacao',
    mapaOperacional: createOperationalMapState({
      ...currentMap,
      selectedIds,
      selectionMode: 'selection',
      popup: {
        status: 'loading',
        solicitacaoId: popupSolicitacaoId,
        item: null,
        statusCode: null,
        message: 'Carregando resumo operacional.'
      }
    })
  });

  try {
    const popup = await fetchMapaOcorrenciaPopup(popupSolicitacaoId);
    const selectedPoint = (currentMap.items || []).find((item) => item.id === popupSolicitacaoId);
    const routeUrl = selectedPoint?.coordinates
      ? buildInternalGoogleMapsRouteUrl(selectedPoint.coordinates)
      : '';
    const enrichedPopup = popup.item
      ? {
          ...popup,
          item: {
            ...popup.item,
            routeUrl
          }
        }
      : popup;

    if (enrichedPopup.status === 'unauthenticated') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: enrichedPopup.message,
        hasChecked: true,
        mapaOperacional: createOperationalMapState({
          ...currentMap,
          selectedIds,
          selectionMode: 'selection',
          popup: enrichedPopup
        })
      }));
      return;
    }

    renderApp(root, {
      ...currentState,
      activeModule: 'iluminacao',
      mapaOperacional: createOperationalMapState({
        ...(currentState.mapaOperacional || currentMap),
        selectedIds,
        selectionMode: 'selection',
        popup: enrichedPopup
      })
    });
  } catch {
    renderApp(root, {
      ...currentState,
      activeModule: 'iluminacao',
      mapaOperacional: createOperationalMapState({
        ...(currentState.mapaOperacional || currentMap),
        selectedIds,
        selectionMode: 'selection',
        popup: {
          status: 'error',
          solicitacaoId: popupSolicitacaoId,
          item: null,
          statusCode: null,
          message: 'Falha temporária de conexão ao abrir o popup.'
        }
      })
    });
  }
}

async function selectOperationalMapOccurrence(root, state, solicitacaoId) {
  return selectOperationalMapOccurrences(root, state, [solicitacaoId]);
}
function clearOperationalMapSelection(root, state) {
  const mapState = state.mapaOperacional || createOperationalMapState();
  renderApp(root, {
    ...state,
    activeModule: 'iluminacao',
    mapaOperacional: createOperationalMapState({
      ...mapState,
      selectedIds: [],
      selectionMode: '',
      popup: createOperationalMapState().popup
    })
  });
}

function submitOperationalMapFilters(root, state, form, action = 'apply') {
  const baseMap = action === 'reset'
    ? createOperationalMapState()
    : readOperationalMapFilterFormState(form, state.mapaOperacional || createOperationalMapState());

  loadOperationalMap(root, state, baseMap);
}

async function loadSolicitacoes(root, state, offset = 0) {
  if (!canListSolicitacoes(state)) {
    renderApp(root, {
      ...state,
      solicitacoes: createSolicitacoesState({
        status: state.sessionState === 'authenticated' ? 'forbidden' : 'idle',
        message: state.sessionState === 'authenticated'
          ? 'A listagem não foi chamada porque a permissão de Iluminação não foi confirmada.'
          : 'A listagem não foi chamada porque a sessão ainda não foi autenticada.'
      }),
      detalhe: createDetalheState()
    });
    return;
  }

  const loadingState = {
    ...state,
    solicitacoes: createSolicitacoesState({
      status: 'loading',
      offset,
      message: 'Carregando solicitações internas.'
    }),
    detalhe: createDetalheState({
      message: 'Seleção de detalhe limpa durante a atualização da listagem.'
    })
  };

  renderApp(root, loadingState);

  try {
    const solicitacoes = await fetchSolicitacoesInternas(
      offset,
      getSolicitacoesListOptions(state)
    );

    if (solicitacoes.status === 'unauthenticated') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar carregar a listagem. Faça login novamente.',
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
        message: 'Falha temporária de conexão com o serviço interno de listagem.'
      }),
      detalhe: createDetalheState()
    });
  }
}

async function loadSolicitacaoDetail(root, state, solicitacaoId) {
  if (!canListSolicitacoes(state)) {
    renderApp(root, {
      ...state,
      detalhe: createDetalheState({
        status: state.sessionState === 'authenticated' ? 'forbidden' : 'idle',
        statusCode: state.sessionState === 'authenticated' ? 403 : null,
        message: state.sessionState === 'authenticated'
          ? 'O detalhe não foi chamado porque a permissão de Iluminação não foi confirmada.'
          : 'O detalhe não foi chamado porque a sessão ainda não foi autenticada.'
      })
    });
    return;
  }

  if (!Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    renderApp(root, {
      ...state,
      detalhe: createDetalheState({
        status: 'error',
        statusCode: 422,
        message: 'Identificador da solicitação inválido.'
      })
    });
    return;
  }

  const loadingState = {
    ...state,
    detalhe: createDetalheState({
      status: 'loading',
      solicitacaoId,
      message: 'Carregando detalhe somente leitura.'
    })
  };

  renderApp(root, loadingState);

  try {
    const detalhe = await fetchSolicitacaoDetail(solicitacaoId);

    if (detalhe.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar carregar o detalhe. Faça login novamente.',
        hasChecked: true,
        detalhe
      }));
      return;
    }

    renderApp(root, {
      ...loadingState,
      detalhe
    });
    scrollToSolicitacaoDetailSection(root);
  } catch {
    renderApp(root, {
      ...state,
      detalhe: createDetalheState({
        status: 'error',
        solicitacaoId,
        message: 'Falha temporária de conexão com o serviço interno de detalhe.'
      })
    });
  }
}

async function loadSolicitacaoHistorico(root, state, offset = 0) {
  const detail = state.detalhe || createDetalheState();
  const solicitacaoId = detail.item && Number.isInteger(detail.item.id)
    ? detail.item.id
    : detail.solicitacaoId;

  if (!canViewHistorico(state)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        historico: createHistoricoState({
          status: 'forbidden',
          statusCode: state.sessionState === 'authenticated' ? 403 : null,
          message: state.sessionState === 'authenticated'
            ? 'Histórico indisponível para este perfil.'
            : 'O histórico não foi chamado porque a sessão ainda não foi autenticada.'
        })
      }
    });
    return;
  }

  if (detail.status !== 'loaded' || !Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        historico: createHistoricoState({
          status: 'error',
          statusCode: 422,
          message: 'Selecione uma solicitação válida antes de carregar o histórico.'
        })
      }
    });
    return;
  }

  const loadingDetail = {
    ...detail,
    historico: createHistoricoState({
      status: 'loading',
      offset,
      message: 'Carregando histórico somente leitura.'
    })
  };
  const loadingState = {
    ...state,
    detalhe: loadingDetail
  };

  renderApp(root, loadingState);

  try {
    const historico = await fetchSolicitacaoHistorico(solicitacaoId, offset);

    if (historico.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar carregar o histórico. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          historico
        }
      }));
      return;
    }

    renderApp(root, {
      ...loadingState,
      detalhe: {
        ...loadingDetail,
        historico
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        historico: createHistoricoState({
          status: 'error',
          offset,
          message: 'Falha temporária de conexão com o serviço interno de histórico.'
        })
      }
    });
  }
}

function openStatusCorrectionPanel(root, state) {
  const detail = state.detalhe || createDetalheState();

  if (detail.status !== 'loaded' || !detail.item || !canCorrectStatus(state)) {
    return;
  }

  renderApp(root, {
    ...state,
    detalhe: {
      ...detail,
      statusCorrectionForm: createStatusCorrectionFormState({
        ...(detail.statusCorrectionForm || {}),
        status: 'idle',
        open: true,
        statusCode: null,
        message: 'Revise status atual, novo status e justificativa antes de confirmar.'
      })
    }
  });
}

function cancelStatusCorrectionPanel(root, state) {
  const detail = state.detalhe || createDetalheState();

  renderApp(root, {
    ...state,
    detalhe: {
      ...detail,
      statusCorrectionForm: createStatusCorrectionFormState()
    }
  });
}

async function loadSolicitacaoObservacoes(root, state, offset = 0) {
  const detail = state.detalhe || createDetalheState();
  const solicitacaoId = detail.item && Number.isInteger(detail.item.id)
    ? detail.item.id
    : detail.solicitacaoId;

  if (!canViewObservacoes(state)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacoes: createObservacoesState({
          status: 'forbidden',
          statusCode: state.sessionState === 'authenticated' ? 403 : null,
          message: state.sessionState === 'authenticated'
            ? 'Observações indisponíveis para este perfil.'
            : 'As observações não foram chamadas porque a sessão ainda não foi autenticada.'
        })
      }
    });
    return;
  }

  if (detail.status !== 'loaded' || !Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacoes: createObservacoesState({
          status: 'error',
          statusCode: 422,
          message: 'Selecione uma solicitação válida antes de carregar observações.'
        })
      }
    });
    return;
  }

  const loadingDetail = {
    ...detail,
    observacoes: createObservacoesState({
      status: 'loading',
      offset,
      message: 'Carregando observações somente leitura.'
    })
  };
  const loadingState = {
    ...state,
    detalhe: loadingDetail
  };

  renderApp(root, loadingState);

  try {
    const observacoes = await fetchSolicitacaoObservacoes(solicitacaoId, offset);

    if (observacoes.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar carregar observações. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          observacoes
        }
      }));
      return;
    }

    renderApp(root, {
      ...loadingState,
      detalhe: {
        ...loadingDetail,
        observacoes
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacoes: createObservacoesState({
          status: 'error',
          offset,
          message: 'Falha temporária de conexão com o serviço interno de observações.'
        })
      }
    });
  }
}

function updateObservacaoFormControls(textarea) {
  const form = textarea.closest('[data-observacao-form]');

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const normalizedLength = normalizeObservacaoInput(textarea.value).length;
  const validationMessage = getObservacaoValidationMessage(textarea.value);
  const counter = form.querySelector('[data-observacao-counter]');
  const validation = form.querySelector('[data-observacao-validation]');
  const submit = form.querySelector('[data-observacao-submit]');

  if (counter) {
    counter.textContent = `${normalizedLength}/${OBSERVACAO_MAX_LENGTH}`;
  }

  if (validation) {
    validation.textContent = validationMessage || 'Pronto para salvar como observação interna.';
  }

  if (submit instanceof HTMLButtonElement) {
    submit.disabled = Boolean(validationMessage);
  }
}

function updateStatusFormControls(control) {
  const form = control.closest('[data-status-form]');

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const currentStatus = form.dataset.currentStatus || '';
  const select = form.querySelector('[data-status-select]');
  const textarea = form.querySelector('[data-status-observacao-textarea]');
  const selectedStatus = select instanceof HTMLSelectElement ? select.value : '';
  const observacao = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
  const normalizedLength = normalizeStatusObservacaoInput(observacao).length;
  const validationMessage = getStatusFormValidationMessage(
    currentStatus,
    selectedStatus,
    observacao
  );
  const counter = form.querySelector('[data-status-counter]');
  const validation = form.querySelector('[data-status-validation]');
  const submit = form.querySelector('[data-status-submit]');

  if (counter) {
    counter.textContent = `${normalizedLength}/${STATUS_OBSERVACAO_MAX_LENGTH}`;
  }

  if (validation) {
    validation.textContent = validationMessage || 'Pronto para atualizar o status.';
  }

  if (submit instanceof HTMLButtonElement) {
    submit.disabled = Boolean(validationMessage);
  }
}

function updatePrioridadeFormControls(control) {
  const form = control.closest('[data-prioridade-form]');

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const currentPriority = form.dataset.currentPriority || '';
  const select = form.querySelector('[data-prioridade-select]');
  const textarea = form.querySelector('[data-prioridade-observacao-textarea]');
  const selectedPriority = select instanceof HTMLSelectElement ? select.value : '';
  const observacao = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
  const normalizedLength = normalizePrioridadeObservacaoInput(observacao).length;
  const validationMessage = getPrioridadeFormValidationMessage(
    currentPriority,
    selectedPriority,
    observacao
  );
  const counter = form.querySelector('[data-prioridade-counter]');
  const validation = form.querySelector('[data-prioridade-validation]');
  const submit = form.querySelector('[data-prioridade-submit]');

  if (counter) {
    counter.textContent = `${normalizedLength}/${PRIORIDADE_OBSERVACAO_MAX_LENGTH}`;
  }

  if (validation) {
    validation.textContent = validationMessage || 'Pronto para atualizar a prioridade.';
  }

  if (submit instanceof HTMLButtonElement) {
    submit.disabled = Boolean(validationMessage);
  }
}

function updateStatusCorrectionFormControls(control) {
  const form = control.closest('[data-status-correction-form]');

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const currentStatus = form.dataset.currentStatus || '';
  const select = form.querySelector('[data-status-correction-select]');
  const textarea = form.querySelector('[data-status-correction-justificativa-textarea]');
  const checkbox = form.querySelector('[data-status-correction-confirmation]');
  const selectedStatus = select instanceof HTMLSelectElement ? select.value : '';
  const justificativa = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
  const confirmed = checkbox instanceof HTMLInputElement ? checkbox.checked : false;
  const normalizedLength = normalizeStatusCorrectionJustificativaInput(justificativa).length;
  const validationMessage = getStatusCorrectionFormValidationMessage(
    currentStatus,
    selectedStatus,
    justificativa,
    confirmed
  );
  const counter = form.querySelector('[data-status-correction-counter]');
  const validation = form.querySelector('[data-status-correction-validation]');
  const submit = form.querySelector('[data-status-correction-submit]');

  if (counter) {
    counter.textContent = `${normalizedLength}/${STATUS_CORRECAO_JUSTIFICATIVA_MAX_LENGTH}`;
  }

  if (validation) {
    validation.textContent = validationMessage || 'Pronto para confirmar a correção administrativa.';
  }

  if (submit instanceof HTMLButtonElement) {
    submit.disabled = Boolean(validationMessage);
  }
}

function shouldRefreshHistoricoAfterStatus(historico) {
  return Boolean(
    historico
      && (historico.status === 'ready' || historico.status === 'empty')
  );
}

async function submitStatusUpdate(root, state, form) {
  const detail = state.detalhe || createDetalheState();
  const formState = detail.statusForm || createStatusFormState();
  const solicitacaoId = detail.item && Number.isInteger(detail.item.id)
    ? detail.item.id
    : detail.solicitacaoId;
  const formData = new FormData(form);
  const currentStatus = detail.item ? detail.item.statusKey : '';
  const selectedStatus = String(formData.get('status') || '').trim();
  const rawObservacao = String(formData.get('observacao') || '');
  const normalizedObservacao = normalizeStatusObservacaoInput(rawObservacao);

  if (formState.status === 'submitting') {
    return;
  }

  if (!canUpdateStatus(state)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusForm: createStatusFormState({
          status: 'error',
          statusCode: state.sessionState === 'authenticated' ? 403 : null,
          selectedStatus,
          observacao: rawObservacao,
          message: state.sessionState === 'authenticated'
            ? 'Alteração de status indisponível para este perfil.'
            : 'O status não foi enviado porque a sessão ainda não foi autenticada.'
        })
      }
    });
    return;
  }

  if (detail.status !== 'loaded' || !Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusForm: createStatusFormState({
          status: 'error',
          statusCode: 422,
          selectedStatus,
          observacao: rawObservacao,
          message: 'Selecione uma solicitação válida antes de atualizar status.'
        })
      }
    });
    return;
  }

  if (isTerminalStatus(currentStatus)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusForm: createStatusFormState({
          status: 'error',
          statusCode: 409,
          selectedStatus,
          observacao: rawObservacao,
          message: 'Status finalizado. Reabertura ou correção administrativa exigirá fluxo específico.'
        })
      }
    });
    return;
  }

  const validationMessage = getStatusFormValidationMessage(
    currentStatus,
    selectedStatus,
    rawObservacao
  );

  if (validationMessage) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusForm: createStatusFormState({
          status: 'error',
          selectedStatus,
          observacao: rawObservacao,
          message: validationMessage
        })
      }
    });
    return;
  }

  const loadingDetail = {
    ...detail,
    statusForm: createStatusFormState({
      status: 'submitting',
      selectedStatus,
      observacao: rawObservacao,
      message: 'Atualizando status...'
    })
  };

  renderApp(root, {
    ...state,
    detalhe: loadingDetail
  });

  try {
    const nextFormState = await fetchUpdateSolicitacaoStatus(
      solicitacaoId,
      selectedStatus,
      normalizedObservacao
    );

    if (nextFormState.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar atualizar status. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          statusForm: nextFormState
        }
      }));
      return;
    }

    if (nextFormState.status !== 'success') {
      renderApp(root, {
        ...state,
        detalhe: {
          ...detail,
          statusForm: {
            ...nextFormState,
            selectedStatus,
            observacao: rawObservacao
          }
        }
      });
      return;
    }

    let solicitacoes = state.solicitacoes || createSolicitacoesState();
    let refreshedDetail = null;
    let historico = detail.historico || createHistoricoState();
    const shouldRefreshHistorico = canViewHistorico(state)
      && shouldRefreshHistoricoAfterStatus(historico);

    try {
      refreshedDetail = await fetchSolicitacaoDetail(solicitacaoId);
    } catch {
      refreshedDetail = createDetalheState({
        status: 'error',
        solicitacaoId,
        message: 'Status atualizado, mas não foi possível recarregar o detalhe automaticamente.'
      });
    }

    if (refreshedDetail.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao recarregar o detalhe. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          statusForm: nextFormState
        }
      }));
      return;
    }

    if (canListSolicitacoes(state)) {
      try {
        solicitacoes = await fetchSolicitacoesInternas(
          solicitacoes.offset || 0,
          getSolicitacoesListOptions(state)
        );
      } catch {
        solicitacoes = createSolicitacoesState({
          status: 'error',
          offset: solicitacoes.offset || 0,
          message: 'Status atualizado, mas não foi possível recarregar a listagem automaticamente.'
        });
      }
    }

    if (shouldRefreshHistorico) {
      try {
        historico = await fetchSolicitacaoHistorico(solicitacaoId, historico.offset || 0);
      } catch {
        historico = createHistoricoState({
          status: 'error',
          offset: historico.offset || 0,
          message: 'Status atualizado, mas não foi possível recarregar o histórico automaticamente.'
        });
      }

      if (historico.status === 'expired') {
        renderApp(root, createSessionState({
          sessionState: 'unauthenticated',
          statusCode: 401,
          message: 'Sessão expirada ao recarregar o histórico. Faça login novamente.',
          hasChecked: true,
          detalhe: {
            ...loadingDetail,
            historico,
            statusForm: nextFormState
          }
        }));
        return;
      }
    }

    const baseDetail = refreshedDetail.status === 'loaded'
      ? refreshedDetail
      : detail;

    renderApp(root, {
      ...state,
      solicitacoes,
      detalhe: {
        ...baseDetail,
        historico,
        observacoes: detail.observacoes || createObservacoesState(),
        observacaoForm: detail.observacaoForm || createObservacaoFormState(),
        statusForm: nextFormState,
        prioridadeForm: detail.prioridadeForm || createPrioridadeFormState(),
        statusCorrectionForm: detail.statusCorrectionForm || createStatusCorrectionFormState()
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusForm: createStatusFormState({
          status: 'error',
          selectedStatus,
          observacao: rawObservacao,
          message: 'Falha temporária de conexão ao atualizar status.'
        })
      }
    });
  }
}

async function submitListStatusUpdate(root, state, form) {
  if (form.dataset.submitting === 'true') {
    return;
  }

  const formData = new FormData(form);
  const solicitacaoId = Number.parseInt(form.dataset.solicitacaoId || '', 10);
  const currentStatus = form.dataset.currentStatus || '';
  const selectedStatus = String(formData.get('status') || '').trim();
  const rawObservacao = String(formData.get('observacao') || '');
  const normalizedObservacao = normalizeStatusObservacaoInput(rawObservacao);
  const messageElement = form.querySelector('[data-list-status-message]');
  const submitButton = form.querySelector('[data-status-submit]');

  const setMessage = (message, isError = false) => {
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.classList.toggle('is-error', isError);
    }
  };

  if (!canUpdateStatus(state)) {
    setMessage('Alteração de fase indisponível para este perfil.', true);
    return;
  }

  if (!Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    setMessage('Solicitação inválida para alteração de fase.', true);
    return;
  }

  const validationMessage = getStatusFormValidationMessage(
    currentStatus,
    selectedStatus,
    rawObservacao
  );

  if (validationMessage) {
    setMessage(validationMessage, true);
    return;
  }

  form.dataset.submitting = 'true';

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
  }

  setMessage('Atualizando fase...');

  try {
    const nextFormState = await fetchUpdateSolicitacaoStatus(
      solicitacaoId,
      selectedStatus,
      normalizedObservacao
    );

    if (nextFormState.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar atualizar fase. Faça login novamente.',
        hasChecked: true
      }));
      return;
    }

    if (nextFormState.status !== 'success') {
      setMessage(nextFormState.message || 'Não foi possível atualizar a fase.', true);
      form.dataset.submitting = 'false';
      updateStatusFormControls(form);
      return;
    }

    let solicitacoes = state.solicitacoes || createSolicitacoesState();
    let nextDetail = state.detalhe || createDetalheState();
    const currentDetailMatches = nextDetail.status === 'loaded'
      && nextDetail.item
      && nextDetail.item.id === solicitacaoId;

    if (canListSolicitacoes(state)) {
      solicitacoes = await fetchSolicitacoesInternas(
        solicitacoes.offset || 0,
        getSolicitacoesListOptions(state)
      );
      solicitacoes = {
        ...solicitacoes,
        message: 'Fase atualizada. Listagem recarregada.'
      };
    }

    if (currentDetailMatches) {
      const refreshedDetail = await fetchSolicitacaoDetail(solicitacaoId);

      if (refreshedDetail.status === 'expired') {
        renderApp(root, createSessionState({
          sessionState: 'unauthenticated',
          statusCode: 401,
          message: 'Sessão expirada ao recarregar o detalhe. Faça login novamente.',
          hasChecked: true
        }));
        return;
      }

      let historico = nextDetail.historico || createHistoricoState();
      const shouldRefreshHistorico = canViewHistorico(state)
        && shouldRefreshHistoricoAfterStatus(historico);

      if (shouldRefreshHistorico) {
        historico = await fetchSolicitacaoHistorico(solicitacaoId, historico.offset || 0);
      }

      nextDetail = refreshedDetail.status === 'loaded'
        ? {
          ...refreshedDetail,
          historico,
          observacoes: nextDetail.observacoes || createObservacoesState(),
          observacaoForm: nextDetail.observacaoForm || createObservacaoFormState(),
          statusForm: nextFormState,
          prioridadeForm: nextDetail.prioridadeForm || createPrioridadeFormState(),
          statusCorrectionForm: nextDetail.statusCorrectionForm || createStatusCorrectionFormState()
        }
        : nextDetail;
    }

    renderApp(root, {
      ...state,
      solicitacoes,
      detalhe: nextDetail
    });
  } catch {
    setMessage('Falha temporária de conexão ao atualizar fase.', true);
    form.dataset.submitting = 'false';
    updateStatusFormControls(form);
  }
}

async function submitPrioridadeUpdate(root, state, form) {
  const detail = state.detalhe || createDetalheState();
  const formState = detail.prioridadeForm || createPrioridadeFormState();
  const solicitacaoId = detail.item && Number.isInteger(detail.item.id)
    ? detail.item.id
    : detail.solicitacaoId;
  const formData = new FormData(form);
  const currentPriority = detail.item ? detail.item.prioridadeKey : '';
  const currentStatus = detail.item ? detail.item.statusKey : '';
  const selectedPriority = String(formData.get('prioridade') || '').trim();
  const rawObservacao = String(formData.get('observacao') || '');
  const normalizedObservacao = normalizePrioridadeObservacaoInput(rawObservacao);

  if (formState.status === 'submitting') {
    return;
  }

  if (!canUpdatePrioridade(state)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        prioridadeForm: createPrioridadeFormState({
          status: 'error',
          statusCode: state.sessionState === 'authenticated' ? 403 : null,
          selectedPriority,
          observacao: rawObservacao,
          message: state.sessionState === 'authenticated'
            ? 'Alteração de prioridade indisponível para este perfil.'
            : 'A prioridade não foi enviada porque a sessão ainda não foi autenticada.'
        })
      }
    });
    return;
  }

  if (detail.status !== 'loaded' || !Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        prioridadeForm: createPrioridadeFormState({
          status: 'error',
          statusCode: 422,
          selectedPriority,
          observacao: rawObservacao,
          message: 'Selecione uma solicitação válida antes de atualizar prioridade.'
        })
      }
    });
    return;
  }

  if (isTerminalStatus(currentStatus)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        prioridadeForm: createPrioridadeFormState({
          status: 'error',
          statusCode: 409,
          selectedPriority,
          observacao: rawObservacao,
          message: 'Solicitação em status finalizado. Prioridade não pode ser alterada por este fluxo.'
        })
      }
    });
    return;
  }

  const validationMessage = getPrioridadeFormValidationMessage(
    currentPriority,
    selectedPriority,
    rawObservacao
  );

  if (validationMessage) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        prioridadeForm: createPrioridadeFormState({
          status: 'error',
          selectedPriority,
          observacao: rawObservacao,
          message: validationMessage
        })
      }
    });
    return;
  }

  const loadingDetail = {
    ...detail,
    prioridadeForm: createPrioridadeFormState({
      status: 'submitting',
      selectedPriority,
      observacao: rawObservacao,
      message: 'Atualizando prioridade...'
    })
  };

  renderApp(root, {
    ...state,
    detalhe: loadingDetail
  });

  try {
    const nextFormState = await fetchUpdateSolicitacaoPrioridade(
      solicitacaoId,
      selectedPriority,
      normalizedObservacao
    );

    if (nextFormState.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar atualizar prioridade. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          prioridadeForm: nextFormState
        }
      }));
      return;
    }

    if (nextFormState.status !== 'success') {
      renderApp(root, {
        ...state,
        detalhe: {
          ...detail,
          prioridadeForm: {
            ...nextFormState,
            selectedPriority,
            observacao: rawObservacao
          }
        }
      });
      return;
    }

    let solicitacoes = state.solicitacoes || createSolicitacoesState();
    let refreshedDetail = null;
    let historico = detail.historico || createHistoricoState();

    try {
      refreshedDetail = await fetchSolicitacaoDetail(solicitacaoId);
    } catch {
      refreshedDetail = createDetalheState({
        status: 'error',
        solicitacaoId,
        message: 'Prioridade atualizada, mas não foi possível recarregar o detalhe automaticamente.'
      });
    }

    if (refreshedDetail.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao recarregar o detalhe. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          prioridadeForm: nextFormState
        }
      }));
      return;
    }

    if (canListSolicitacoes(state)) {
      try {
        solicitacoes = await fetchSolicitacoesInternas(
          solicitacoes.offset || 0,
          getSolicitacoesListOptions(state)
        );
      } catch {
        solicitacoes = createSolicitacoesState({
          status: 'error',
          offset: solicitacoes.offset || 0,
          message: 'Prioridade atualizada, mas não foi possível recarregar a listagem automaticamente.'
        });
      }
    }

    if (canViewHistorico(state)) {
      try {
        historico = await fetchSolicitacaoHistorico(solicitacaoId, historico.offset || 0);
      } catch {
        historico = createHistoricoState({
          status: 'error',
          offset: historico.offset || 0,
          message: 'Prioridade atualizada, mas não foi possível recarregar o histórico automaticamente.'
        });
      }

      if (historico.status === 'expired') {
        renderApp(root, createSessionState({
          sessionState: 'unauthenticated',
          statusCode: 401,
          message: 'Sessão expirada ao recarregar o histórico. Faça login novamente.',
          hasChecked: true,
          detalhe: {
            ...loadingDetail,
            historico,
            prioridadeForm: nextFormState
          }
        }));
        return;
      }
    }

    const baseDetail = refreshedDetail.status === 'loaded'
      ? refreshedDetail
      : detail;

    renderApp(root, {
      ...state,
      solicitacoes,
      detalhe: {
        ...baseDetail,
        historico,
        observacoes: detail.observacoes || createObservacoesState(),
        observacaoForm: detail.observacaoForm || createObservacaoFormState(),
        statusForm: detail.statusForm || createStatusFormState(),
        prioridadeForm: nextFormState,
        statusCorrectionForm: detail.statusCorrectionForm || createStatusCorrectionFormState()
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        prioridadeForm: createPrioridadeFormState({
          status: 'error',
          selectedPriority,
          observacao: rawObservacao,
          message: 'Falha temporária de conexão ao atualizar prioridade.'
        })
      }
    });
  }
}

async function submitStatusCorrectionUpdate(root, state, form) {
  const detail = state.detalhe || createDetalheState();
  const formState = detail.statusCorrectionForm || createStatusCorrectionFormState();
  const solicitacaoId = detail.item && Number.isInteger(detail.item.id)
    ? detail.item.id
    : detail.solicitacaoId;
  const formData = new FormData(form);
  const currentStatus = detail.item ? detail.item.statusKey : '';
  const selectedStatus = String(formData.get('novo_status') || '').trim();
  const rawJustificativa = String(formData.get('justificativa') || '');
  const normalizedJustificativa = normalizeStatusCorrectionJustificativaInput(
    rawJustificativa
  );
  const confirmed = formData.get('confirmado') === '1';

  if (formState.status === 'submitting') {
    return;
  }

  if (!canCorrectStatus(state)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusCorrectionForm: createStatusCorrectionFormState({
          status: 'error',
          open: true,
          statusCode: state.sessionState === 'authenticated' ? 403 : null,
          selectedStatus,
          justificativa: rawJustificativa,
          confirmed,
          message: state.sessionState === 'authenticated'
            ? 'Correção administrativa indisponível para este perfil.'
            : 'A correção não foi enviada porque a sessão ainda não foi autenticada.'
        })
      }
    });
    return;
  }

  if (detail.status !== 'loaded' || !Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusCorrectionForm: createStatusCorrectionFormState({
          status: 'error',
          open: true,
          statusCode: 422,
          selectedStatus,
          justificativa: rawJustificativa,
          confirmed,
          message: 'Selecione uma solicitação válida antes de corrigir status.'
        })
      }
    });
    return;
  }

  const validationMessage = getStatusCorrectionFormValidationMessage(
    currentStatus,
    selectedStatus,
    rawJustificativa,
    confirmed
  );

  if (validationMessage) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusCorrectionForm: createStatusCorrectionFormState({
          status: 'error',
          open: true,
          selectedStatus,
          justificativa: rawJustificativa,
          confirmed,
          message: validationMessage
        })
      }
    });
    return;
  }

  const loadingDetail = {
    ...detail,
    statusCorrectionForm: createStatusCorrectionFormState({
      status: 'submitting',
      open: true,
      selectedStatus,
      justificativa: rawJustificativa,
      confirmed,
      message: 'Confirmando correção administrativa...'
    })
  };

  renderApp(root, {
    ...state,
    detalhe: loadingDetail
  });

  try {
    const nextFormState = await fetchUpdateSolicitacaoStatusCorrecao(
      solicitacaoId,
      selectedStatus,
      normalizedJustificativa
    );

    if (nextFormState.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar corrigir status. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          statusCorrectionForm: nextFormState
        }
      }));
      return;
    }

    if (nextFormState.status !== 'success') {
      renderApp(root, {
        ...state,
        detalhe: {
          ...detail,
          statusCorrectionForm: {
            ...nextFormState,
            selectedStatus,
            justificativa: rawJustificativa,
            confirmed
          }
        }
      });
      return;
    }

    let solicitacoes = state.solicitacoes || createSolicitacoesState();
    let refreshedDetail = null;
    let historico = detail.historico || createHistoricoState();

    try {
      refreshedDetail = await fetchSolicitacaoDetail(solicitacaoId);
    } catch {
      refreshedDetail = createDetalheState({
        status: 'error',
        solicitacaoId,
        message: 'Correção aplicada, mas não foi possível recarregar o detalhe automaticamente.'
      });
    }

    if (refreshedDetail.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao recarregar o detalhe. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          statusCorrectionForm: nextFormState
        }
      }));
      return;
    }

    if (canListSolicitacoes(state)) {
      try {
        solicitacoes = await fetchSolicitacoesInternas(
          solicitacoes.offset || 0,
          getSolicitacoesListOptions(state)
        );
      } catch {
        solicitacoes = createSolicitacoesState({
          status: 'error',
          offset: solicitacoes.offset || 0,
          message: 'Correção aplicada, mas não foi possível recarregar a listagem automaticamente.'
        });
      }
    }

    if (canViewHistorico(state)) {
      try {
        historico = await fetchSolicitacaoHistorico(solicitacaoId, historico.offset || 0);
      } catch {
        historico = createHistoricoState({
          status: 'error',
          offset: historico.offset || 0,
          message: 'Correção aplicada, mas não foi possível recarregar o histórico automaticamente.'
        });
      }

      if (historico.status === 'expired') {
        renderApp(root, createSessionState({
          sessionState: 'unauthenticated',
          statusCode: 401,
          message: 'Sessão expirada ao recarregar o histórico. Faça login novamente.',
          hasChecked: true,
          detalhe: {
            ...loadingDetail,
            historico,
            statusCorrectionForm: nextFormState
          }
        }));
        return;
      }
    }

    const baseDetail = refreshedDetail.status === 'loaded'
      ? refreshedDetail
      : detail;

    renderApp(root, {
      ...state,
      solicitacoes,
      detalhe: {
        ...baseDetail,
        historico,
        observacoes: detail.observacoes || createObservacoesState(),
        observacaoForm: detail.observacaoForm || createObservacaoFormState(),
        statusForm: detail.statusForm || createStatusFormState(),
        prioridadeForm: detail.prioridadeForm || createPrioridadeFormState(),
        statusCorrectionForm: nextFormState
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        statusCorrectionForm: createStatusCorrectionFormState({
          status: 'error',
          open: true,
          selectedStatus,
          justificativa: rawJustificativa,
          confirmed,
          message: 'Falha temporária de conexão ao corrigir status administrativamente.'
        })
      }
    });
  }
}

async function submitObservacao(root, state, form) {
  const detail = state.detalhe || createDetalheState();
  const formState = detail.observacaoForm || createObservacaoFormState();
  const solicitacaoId = detail.item && Number.isInteger(detail.item.id)
    ? detail.item.id
    : detail.solicitacaoId;
  const formData = new FormData(form);
  const rawValue = String(formData.get('observacao') || '');
  const normalizedValue = normalizeObservacaoInput(rawValue);

  if (formState.status === 'submitting') {
    return;
  }

  if (!canCreateObservacao(state)) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacaoForm: createObservacaoFormState({
          status: 'error',
          statusCode: state.sessionState === 'authenticated' ? 403 : null,
          value: rawValue,
          message: state.sessionState === 'authenticated'
            ? 'Criação de observação indisponível para este perfil.'
            : 'A observação não foi enviada porque a sessão ainda não foi autenticada.'
        })
      }
    });
    return;
  }

  if (detail.status !== 'loaded' || !Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacaoForm: createObservacaoFormState({
          status: 'error',
          statusCode: 422,
          value: rawValue,
          message: 'Selecione uma solicitação válida antes de salvar observação.'
        })
      }
    });
    return;
  }

  const validationMessage = getObservacaoValidationMessage(rawValue);

  if (validationMessage) {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacaoForm: createObservacaoFormState({
          status: 'error',
          value: rawValue,
          message: validationMessage
        })
      }
    });
    return;
  }

  const loadingDetail = {
    ...detail,
    observacaoForm: createObservacaoFormState({
      status: 'submitting',
      value: rawValue,
      message: 'Salvando observação interna...'
    })
  };

  renderApp(root, {
    ...state,
    detalhe: loadingDetail
  });

  try {
    const nextFormState = await fetchCreateSolicitacaoObservacao(solicitacaoId, normalizedValue);

    if (nextFormState.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar salvar observação. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          observacaoForm: nextFormState
        }
      }));
      return;
    }

    if (nextFormState.status !== 'success') {
      renderApp(root, {
        ...state,
        detalhe: {
          ...detail,
          observacaoForm: {
            ...nextFormState,
            value: rawValue
          }
        }
      });
      return;
    }

    if (!canViewObservacoes(state)) {
      renderApp(root, {
        ...state,
        detalhe: {
          ...detail,
          observacoes: createObservacoesState({
            status: 'forbidden',
            statusCode: 403,
            message: 'Observação criada, mas a leitura de observações não está disponível para este perfil.'
          }),
          observacaoForm: nextFormState
        }
      });
      return;
    }

    let observacoes = null;

    try {
      observacoes = await fetchSolicitacaoObservacoes(solicitacaoId, 0);
    } catch {
      observacoes = createObservacoesState({
        status: 'error',
        message: 'Observação criada, mas não foi possível recarregar observações automaticamente.'
      });
    }

    if (observacoes.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao recarregar observações. Faça login novamente.',
        hasChecked: true,
        detalhe: {
          ...loadingDetail,
          observacoes,
          observacaoForm: nextFormState
        }
      }));
      return;
    }

    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacoes,
        observacaoForm: nextFormState
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      detalhe: {
        ...detail,
        observacaoForm: createObservacaoFormState({
          status: 'error',
          value: rawValue,
          message: 'Falha temporária de conexão ao salvar observação interna.'
        })
      }
    });
  }
}

async function submitListObservacao(root, state, form) {
  if (form.dataset.submitting === 'true') {
    return;
  }

  const formData = new FormData(form);
  const solicitacaoId = Number.parseInt(form.dataset.solicitacaoId || '', 10);
  const rawValue = String(formData.get('observacao') || '');
  const normalizedValue = normalizeObservacaoInput(rawValue);
  const messageElement = form.querySelector('[data-list-observacao-message]');
  const submitButton = form.querySelector('[data-observacao-submit]');

  const setMessage = (message, isError = false) => {
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.classList.toggle('is-error', isError);
      messageElement.classList.toggle('is-success', !isError && Boolean(message));
    }
  };

  if (!canCreateObservacao(state)) {
    setMessage('Criação de observação indisponível para este perfil.', true);
    return;
  }

  if (!Number.isInteger(solicitacaoId) || solicitacaoId < 1) {
    setMessage('Solicitação inválida para registrar observação.', true);
    return;
  }

  const validationMessage = getObservacaoValidationMessage(rawValue);

  if (validationMessage) {
    setMessage(validationMessage, true);
    return;
  }

  form.dataset.submitting = 'true';

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
  }

  setMessage('Salvando observação...');

  try {
    const nextFormState = await fetchCreateSolicitacaoObservacao(
      solicitacaoId,
      normalizedValue
    );

    if (nextFormState.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessão expirada ao tentar salvar observação. Faça login novamente.',
        hasChecked: true
      }));
      return;
    }

    if (nextFormState.status !== 'success') {
      setMessage(nextFormState.message || 'Não foi possível salvar a observação.', true);
      form.dataset.submitting = 'false';
      const textarea = form.querySelector('[data-observacao-textarea]');

      if (textarea instanceof HTMLTextAreaElement) {
        updateObservacaoFormControls(textarea);
      }
      return;
    }

    let solicitacoes = state.solicitacoes || createSolicitacoesState();
    let nextDetail = state.detalhe || createDetalheState();
    const currentDetailMatches = nextDetail.status === 'loaded'
      && nextDetail.item
      && nextDetail.item.id === solicitacaoId;

    solicitacoes = {
      ...solicitacoes,
      message: 'Observação registrada para o chamado.'
    };

    if (currentDetailMatches && canViewObservacoes(state)) {
      let observacoes = nextDetail.observacoes || createObservacoesState();

      if (observacoes.status === 'ready' || observacoes.status === 'empty') {
        observacoes = await fetchSolicitacaoObservacoes(solicitacaoId, 0);
      }

      nextDetail = {
        ...nextDetail,
        observacoes,
        observacaoForm: nextFormState
      };
    }

    renderApp(root, {
      ...state,
      solicitacoes,
      detalhe: nextDetail
    });
  } catch {
    setMessage('Falha temporária de conexão ao salvar observação.', true);
    form.dataset.submitting = 'false';
    const textarea = form.querySelector('[data-observacao-textarea]');

    if (textarea instanceof HTMLTextAreaElement) {
      updateObservacaoFormControls(textarea);
    }
  }
}

function clearSolicitacaoDetail(root, state) {
  renderApp(root, {
    ...state,
    detalhe: createDetalheState()
  });
}

function readRelatorioFormState(form, currentRelatorio = createRelatorioState()) {
  const formData = new FormData(form);

  return createRelatorioState({
    ...currentRelatorio,
    dataInicio: normalizeRelatorioDateValue(formData.get('data_inicio')),
    dataFim: normalizeRelatorioDateValue(formData.get('data_fim')),
    statusFilter: String(formData.get('status') || '').trim(),
    prioridadeFilter: String(formData.get('prioridade') || '').trim(),
    tipoFilter: String(formData.get('tipo') || '').trim()
  });
}

function syncRelatorioForm(root, state, form) {
  renderApp(root, {
    ...state,
    relatorio: readRelatorioFormState(form, state.relatorio || createRelatorioState())
  });
}

function readDashboardFilterFormState(form, currentDashboard = createDashboardState()) {
  const formData = new FormData(form);

  return createDashboardState({
    ...currentDashboard,
    filters: {
      source: safeText(formData.get('source'), 'all') || 'all',
      status: safeText(formData.get('status'), 'all') || 'all',
      prioridade: safeText(formData.get('prioridade'), 'all') || 'all',
      tipo: safeText(formData.get('tipo'), 'all') || 'all',
      dataInicio: normalizeRelatorioDateValue(formData.get('dataInicio')),
      dataFim: normalizeRelatorioDateValue(formData.get('dataFim')),
      mapMode: safeText(formData.get('mapMode'), 'points') || 'points'
    }
  });
}


function syncSolicitacoesSort(root, state, sortBy) {
  const solicitacoes = state.solicitacoes || createSolicitacoesState();
  renderApp(root, {
    ...state,
    solicitacoes: createSolicitacoesState({
      ...solicitacoes,
      sortBy: safeText(sortBy, 'protocolo_desc') || 'protocolo_desc'
    })
  });
}

function syncDashboardFilterForm(root, state, form) {
  renderApp(root, {
    ...state,
    dashboard: readDashboardFilterFormState(form, state.dashboard || createDashboardState())
  });
}

function shouldSyncRelatorioFormOnInput(target) {
  return Boolean(
    target
      && typeof target.type === 'string'
      && target.form
      && typeof target.form.matches === 'function'
      && target.form.matches('[data-relatorio-form]')
      && target.type !== 'date'
  );
}

function getInternalActionTarget(target) {
  if (!target || typeof target.closest !== 'function') {
    return null;
  }

  const actionTarget = target.closest('[data-action]');
  return actionTarget && typeof actionTarget.matches === 'function'
    ? actionTarget
    : null;
}

function downloadRelatorioBlob(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

async function submitRelatorio(root, state, form, action) {
  const currentRelatorio = state.relatorio || createRelatorioState();
  const relatorio = readRelatorioFormState(form, currentRelatorio);
  const validationMessage = getRelatorioValidationMessage(relatorio);

  if (!canViewRelatorio(state)) {
    renderApp(root, {
      ...state,
      relatorio: createRelatorioState({
        ...relatorio,
        statusCode: 403,
        message: 'Relatorio indisponivel para este perfil.'
      })
    });
    return;
  }

  if (validationMessage) {
    renderApp(root, {
      ...state,
      relatorio: createRelatorioState({
        ...relatorio,
        statusCode: 422,
        message: validationMessage
      })
    });
    return;
  }

  const loadingRelatorio = createRelatorioState({
    ...relatorio,
    exportStatus: action === 'csv' ? 'submitting' : 'idle',
    summaryStatus: action === 'resumo' ? 'loading' : currentRelatorio.summaryStatus,
    message: action === 'csv'
      ? 'Preparando exportacao CSV...'
      : 'Atualizando resumo administrativo...',
    summary: currentRelatorio.summary
  });

  renderApp(root, {
    ...state,
    relatorio: loadingRelatorio
  });

  try {
    if (action === 'csv') {
      const result = await fetchRelatorioSolicitacoesCsv(relatorio);

      if (result.status === 'expired') {
        renderApp(root, createSessionState({
          sessionState: 'unauthenticated',
          statusCode: 401,
          message: 'Sessao expirada ao gerar o relatorio. Faca login novamente.',
          hasChecked: true,
          relatorio: createRelatorioState({
            ...relatorio,
            statusCode: 401,
            message: result.message
          })
        }));
        return;
      }

      if (result.status !== 'success') {
        renderApp(root, {
          ...state,
          relatorio: createRelatorioState({
            ...relatorio,
            exportStatus: 'error',
            statusCode: result.statusCode,
            message: result.message,
            summary: currentRelatorio.summary
          })
        });
        return;
      }

      downloadRelatorioBlob(result.blob, result.filename);
      renderApp(root, {
        ...state,
        relatorio: createRelatorioState({
          ...relatorio,
          exportStatus: 'success',
          statusCode: result.statusCode,
          message: result.message,
          summary: currentRelatorio.summary
        })
      });
      return;
    }

    const result = await fetchRelatorioSolicitacoesResumo(relatorio);

    if (result.status === 'expired') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: 401,
        message: 'Sessao expirada ao consultar o resumo. Faca login novamente.',
        hasChecked: true,
        relatorio: createRelatorioState({
          ...relatorio,
          statusCode: 401,
          message: result.message
        })
      }));
      return;
    }

    renderApp(root, {
      ...state,
      relatorio: createRelatorioState({
        ...relatorio,
        summaryStatus: result.status === 'success' ? 'ready' : 'error',
        statusCode: result.statusCode,
        message: result.message,
        summary: result.summary
      })
    });
  } catch {
    renderApp(root, {
      ...state,
      relatorio: createRelatorioState({
        ...relatorio,
        exportStatus: action === 'csv' ? 'error' : 'idle',
        summaryStatus: action === 'resumo' ? 'error' : 'idle',
        message: 'Falha temporaria de conexao ao gerar o relatorio.',
        summary: currentRelatorio.summary
      })
    });
  }
}

async function loadDashboard(root, state) {
  const baseState = {
    ...state,
    activeModule: 'dashboard'
  };

  if (!canViewDashboardWidgets(baseState)) {
    renderApp(root, {
      ...baseState,
      dashboard: createDashboardState({
        status: 'idle',
        message: 'Sem widgets gerenciais liberados para este perfil.'
      })
    });
    return;
  }

  renderApp(root, {
    ...baseState,
    dashboard: createDashboardState({
      ...(baseState.dashboard || createDashboardState()),
      status: 'loading',
      message: 'Carregando indicadores do Dashboard geral.'
    })
  });

  try {
    const result = await fetchDashboardGeralWidgets(getDashboardFilters(baseState));

    if (result.status === 'unauthenticated') {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: result.statusCode,
        message: result.message,
        hasChecked: true
      }));
      return;
    }

    if (result.status !== 'ready') {
      renderApp(root, {
        ...baseState,
        dashboard: createDashboardState({
          ...(baseState.dashboard || createDashboardState()),
          status: 'error',
          statusCode: result.statusCode,
          message: result.message
        })
      });
      return;
    }

    let dashboardSolicitacoes = baseState.solicitacoes || createSolicitacoesState();
    let dashboardMapState = baseState.mapaOperacional || createOperationalMapState();

    if (canListSolicitacoes(baseState)) {
      try {
        const solicitacoesResult = await fetchSolicitacoesInternas(
          0,
          getSolicitacoesListOptions(baseState)
        );

        if (solicitacoesResult.status === 'unauthenticated') {
          renderApp(root, createSessionState({
            sessionState: 'unauthenticated',
            statusCode: 401,
            message: 'Sessao expirada ao carregar o mapa territorial. Faca login novamente.',
            hasChecked: true,
            solicitacoes: solicitacoesResult
          }));
          return;
        }

        dashboardSolicitacoes = solicitacoesResult;
      } catch {
        dashboardSolicitacoes = createSolicitacoesState({
          status: 'error',
          message: 'Mapa territorial indisponivel temporariamente.'
        });
      }

      try {
        const mapaResult = await fetchMapaOcorrencias(getDashboardMapFetchOptions(getDashboardFilters(baseState)));
        if (mapaResult.status === 'unauthenticated') {
          renderApp(root, createSessionState({
            sessionState: 'unauthenticated',
            statusCode: 401,
            message: 'Sessao expirada ao carregar o mapa territorial. Faca login novamente.',
            hasChecked: true,
            mapaOperacional: mapaResult
          }));
          return;
        }
        dashboardMapState = mapaResult;
      } catch {
        dashboardMapState = createOperationalMapState({
          status: 'error',
          message: 'Mapa territorial indisponivel temporariamente.'
        });
      }
    }

    renderApp(root, {
      ...baseState,
      solicitacoes: dashboardSolicitacoes,
      mapaOperacional: dashboardMapState,
      dashboard: createDashboardState({
        ...(baseState.dashboard || createDashboardState()),
        status: 'ready',
        statusCode: result.statusCode,
        message: result.message,
        resumo: result.resumo,
        ranking: result.ranking,
        series: result.series
      })
    });
  } catch {
    renderApp(root, {
      ...baseState,
      dashboard: createDashboardState({
        ...(baseState.dashboard || createDashboardState()),
        status: 'error',
        message: 'Falha temporaria de conexao ao carregar o dashboard.'
      })
    });
  }
}


function renderAdminExpired(root, state, message) {
  renderApp(root, createSessionState({
    ...state,
    sessionState: 'unauthenticated',
    statusCode: 401,
    message,
    hasChecked: true,
    admin: state.admin || createAdminState()
  }));
}

async function loadAdminPanel(root, state) {
  if (!canAccessAdminModule(state)) {
    renderApp(root, {
      ...state,
      activeModule: 'admin',
      admin: createAdminState({
        usersStatus: 'forbidden',
        message: 'Seu perfil não possui permissão administrativa.'
      })
    });
    return;
  }

  const currentAdmin = state.admin || createAdminState();
  renderApp(root, {
    ...state,
    activeModule: 'admin',
    admin: {
      ...currentAdmin,
      usersStatus: 'loading',
      availableProfilesStatus: canReadAdminProfiles(state) ? 'loading' : currentAdmin.availableProfilesStatus,
      message: 'Carregando área administrativa.'
    }
  });

  try {
    const usersResult = hasPermission(state, PERMISSIONS.adminUsersRead)
      ? await fetchAdminUsers()
      : { status: 'error', statusCode: 403, users: [], message: 'Listagem de usuários indisponível para este perfil.' };

    if (usersResult.status === 'expired') {
      renderAdminExpired(root, state, usersResult.message);
      return;
    }

    let profilesResult = { status: currentAdmin.availableProfilesStatus || 'idle', profiles: currentAdmin.availableProfiles || [], message: '' };
    if (canReadAdminProfiles(state)) {
      profilesResult = await fetchAdminAvailableProfiles();
      if (profilesResult.status === 'expired') {
        renderAdminExpired(root, state, profilesResult.message);
        return;
      }
    }

    renderApp(root, {
      ...state,
      activeModule: 'admin',
      admin: {
        ...currentAdmin,
        usersStatus: usersResult.status,
        users: usersResult.users || [],
        availableProfilesStatus: profilesResult.status,
        availableProfiles: profilesResult.profiles || [],
        statusCode: usersResult.statusCode || profilesResult.statusCode || null,
        message: usersResult.message || profilesResult.message || 'Administração carregada.'
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      activeModule: 'admin',
      admin: {
        ...currentAdmin,
        usersStatus: 'error',
        message: 'Falha temporária de conexão ao carregar administração.'
      }
    });
  }
}

async function loadAdminUser(root, state, usuarioId) {
  const currentAdmin = state.admin || createAdminState();

  if (!Number.isInteger(usuarioId) || usuarioId < 1) {
    return;
  }

  const shouldLoadProfileCatalog = canReadAdminProfiles(state)
    && canAssignAdminUserProfile(state)
    && currentAdmin.availableProfilesStatus !== 'ready';

  renderApp(root, {
    ...state,
    activeModule: 'admin',
    admin: {
      ...currentAdmin,
      selectedUserId: usuarioId,
      detailStatus: 'loading',
      userProfilesStatus: 'loading',
      availableProfilesStatus: shouldLoadProfileCatalog ? 'loading' : currentAdmin.availableProfilesStatus,
      message: 'Carregando usuário selecionado.'
    }
  });

  try {
    const [detailResult, profilesResult, availableProfilesResult] = await Promise.all([
      fetchAdminUserDetail(usuarioId),
      fetchAdminUserProfiles(usuarioId),
      shouldLoadProfileCatalog
        ? fetchAdminAvailableProfiles()
        : Promise.resolve({
          status: currentAdmin.availableProfilesStatus,
          profiles: currentAdmin.availableProfiles,
          message: ''
        })
    ]);

    if ([detailResult, profilesResult, availableProfilesResult].some((result) => result.status === 'expired')) {
      renderAdminExpired(root, state, 'Sessão expirada. Faça login novamente.');
      return;
    }

    const fallbackUser = (currentAdmin.users || []).find((user) => user.id === usuarioId) || null;

    const failedResult = [detailResult, profilesResult, availableProfilesResult]

      .find((result) => result.status === 'error');

    renderApp(root, {
      ...state,
      activeModule: 'admin',
      admin: {
        ...currentAdmin,
        selectedUserId: usuarioId,
        detailStatus: detailResult.status,
        user: detailResult.user || fallbackUser,
        userProfilesStatus: profilesResult.status,
        userProfiles: profilesResult.profiles || [],
        availableProfilesStatus: availableProfilesResult.status || currentAdmin.availableProfilesStatus,
        availableProfiles: availableProfilesResult.profiles || currentAdmin.availableProfiles || [],
        statusCode: detailResult.statusCode || profilesResult.statusCode || availableProfilesResult.statusCode || null,
        message: failedResult?.message || detailResult.message || profilesResult.message || 'Usuário selecionado.'
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      activeModule: 'admin',
      admin: {
        ...currentAdmin,
        selectedUserId: usuarioId,
        detailStatus: 'error',
        userProfilesStatus: 'error',
        message: 'Falha temporária de conexão ao carregar usuário.'
      }
    });
  }
}

async function refreshAdminPanel(root, state) {
  const admin = state.admin || createAdminState();
  const selectedUserId = admin.selectedUserId;
  const hasSelectedUser = Number.isInteger(selectedUserId) && selectedUserId > 0;

  renderApp(root, {
    ...state,
    activeModule: 'admin',
    admin: {
      ...admin,
      usersStatus: 'loading',
      detailStatus: hasSelectedUser ? 'loading' : admin.detailStatus,
      userProfilesStatus: hasSelectedUser ? 'loading' : admin.userProfilesStatus,
      availableProfilesStatus: canReadAdminProfiles(state) ? 'loading' : admin.availableProfilesStatus,
      message: hasSelectedUser
        ? 'Atualizando usuários, detalhe e vínculos.'
        : 'Atualizando usuários internos.'
    }
  });

  try {
    const usersPromise = hasPermission(state, PERMISSIONS.adminUsersRead)
      ? fetchAdminUsers()
      : Promise.resolve({ status: 'error', statusCode: 403, users: admin.users, message: 'Listagem de usuários indisponível para este perfil.' });
    const catalogPromise = canReadAdminProfiles(state)
      ? fetchAdminAvailableProfiles()
      : Promise.resolve({ status: admin.availableProfilesStatus, profiles: admin.availableProfiles, message: '' });
    const detailPromise = hasSelectedUser
      ? fetchAdminUserDetail(selectedUserId)
      : Promise.resolve({ status: admin.detailStatus, user: admin.user, message: '' });
    const profilesPromise = hasSelectedUser
      ? fetchAdminUserProfiles(selectedUserId)
      : Promise.resolve({ status: admin.userProfilesStatus, profiles: admin.userProfiles, message: '' });

    const [usersResult, catalogResult, detailResult, profilesResult] = await Promise.all([
      usersPromise,
      catalogPromise,
      detailPromise,
      profilesPromise
    ]);

    if ([usersResult, catalogResult, detailResult, profilesResult].some((result) => result.status === 'expired')) {
      renderAdminExpired(root, state, 'Sessão expirada. Faça login novamente.');
      return;
    }

    const fallbackUser = (usersResult.users || admin.users || []).find((user) => user.id === selectedUserId) || admin.user;

    const failedResult = [usersResult, catalogResult, detailResult, profilesResult]

      .find((result) => result.status === 'error');

    renderApp(root, {
      ...state,
      activeModule: 'admin',
      admin: {
        ...admin,
        usersStatus: usersResult.status || admin.usersStatus,
        users: usersResult.users || admin.users,
        availableProfilesStatus: catalogResult.status || admin.availableProfilesStatus,
        availableProfiles: catalogResult.profiles || admin.availableProfiles,
        detailStatus: detailResult.status || admin.detailStatus,
        user: detailResult.user || fallbackUser || null,
        userProfilesStatus: profilesResult.status || admin.userProfilesStatus,
        userProfiles: profilesResult.profiles || admin.userProfiles,
        statusCode: usersResult.statusCode || catalogResult.statusCode || detailResult.statusCode || profilesResult.statusCode || null,
        message: failedResult?.message || (hasSelectedUser ? 'Usuário e vínculos atualizados.' : usersResult.message || 'Usuários internos atualizados.')
      }
    });
  } catch {
    renderApp(root, {
      ...state,
      activeModule: 'admin',
      admin: {
        ...admin,
        usersStatus: 'error',
        detailStatus: hasSelectedUser ? 'error' : admin.detailStatus,
        userProfilesStatus: hasSelectedUser ? 'error' : admin.userProfilesStatus,
        message: 'Falha temporária de conexão ao atualizar administração.'
      }
    });
  }
}
async function refreshAdminAfterMutation(root, state, formStateKey, formState) {
  const admin = state.admin || createAdminState();
  const selectedUserId = admin.selectedUserId;
  const usersResult = hasPermission(state, PERMISSIONS.adminUsersRead)
    ? await fetchAdminUsers()
    : { status: 'error', users: admin.users, message: '' };

  let detailResult = { status: admin.detailStatus, user: admin.user };
  let profilesResult = { status: admin.userProfilesStatus, profiles: admin.userProfiles };

  if (Number.isInteger(selectedUserId) && selectedUserId > 0) {
    detailResult = await fetchAdminUserDetail(selectedUserId);
    profilesResult = await fetchAdminUserProfiles(selectedUserId);
  }

  if ([usersResult, detailResult, profilesResult].some((result) => result.status === 'expired')) {
    renderAdminExpired(root, state, 'Sessão expirada. Faça login novamente.');
    return;
  }

  renderApp(root, {
    ...state,
    activeModule: 'admin',
    admin: {
      ...admin,
      usersStatus: usersResult.status || admin.usersStatus,
      users: usersResult.users || admin.users,
      detailStatus: detailResult.status || admin.detailStatus,
      user: detailResult.user || admin.user,
      userProfilesStatus: profilesResult.status || admin.userProfilesStatus,
      userProfiles: profilesResult.profiles || admin.userProfiles,
      [formStateKey]: formState,
      message: formState.message || 'Administração atualizada.'
    }
  });
}

async function submitAdminCreateUser(root, state, form) {
  const admin = state.admin || createAdminState();
  const formData = new FormData(form);
  const login = String(formData.get('login') || '').trim();
  const nome = String(formData.get('nome') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const senhaInicial = String(formData.get('senha_inicial') || '');

  if (!canCreateAdminUser(state)) {
    renderApp(root, { ...state, admin: { ...admin, createForm: createAdminFormState({ status: 'error', statusCode: 403, message: getAdminErrorMessage(403) }) } });
    return;
  }

  if (!login || !nome || !senhaInicial) {
    renderApp(root, { ...state, admin: { ...admin, createForm: createAdminFormState({ status: 'error', statusCode: 422, message: getAdminErrorMessage(422) }) } });
    return;
  }

  renderApp(root, { ...state, admin: { ...admin, createForm: createAdminFormState({ status: 'submitting', message: 'Criando usuário...' }) } });

  try {
    const result = await fetchCreateAdminUser({ login, nome, email: email || null, senha_inicial: senhaInicial });
    form.reset();

    if (result.status === 'expired') {
      renderAdminExpired(root, state, result.message);
      return;
    }

    await refreshAdminAfterMutation(root, state, 'createForm', createAdminFormState({
      status: result.status === 'success' ? 'success' : 'error',
      statusCode: result.statusCode,
      message: result.message
    }));
  } catch {
    form.reset();
    renderApp(root, { ...state, admin: { ...admin, createForm: createAdminFormState({ status: 'error', message: 'Falha temporária ao criar usuário.' }) } });
  }
}

async function submitAdminBlockUser(root, state, form) {
  const admin = state.admin || createAdminState();
  const confirmacao = String(new FormData(form).get('confirmacao') || '').trim().toUpperCase();

  if (!admin.selectedUserId || confirmacao !== 'BLOQUEAR') {
    renderApp(root, { ...state, admin: { ...admin, blockForm: createAdminFormState({ status: 'error', statusCode: 422, message: 'Digite BLOQUEAR para confirmar.' }) } });
    return;
  }

  renderApp(root, { ...state, admin: { ...admin, blockForm: createAdminFormState({ status: 'submitting', message: 'Bloqueando usuário...' }) } });
  const result = await fetchBlockAdminUser(admin.selectedUserId);
  form.reset();

  if (result.status === 'expired') {
    renderAdminExpired(root, state, result.message);
    return;
  }

  await refreshAdminAfterMutation(root, state, 'blockForm', createAdminFormState({
    status: result.status === 'success' ? 'success' : 'error',
    statusCode: result.statusCode,
    message: result.message
  }));
}

async function submitAdminUnblockUser(root, state, form) {
  const admin = state.admin || createAdminState();
  const confirmacao = String(new FormData(form).get('confirmacao') || '').trim().toUpperCase();

  if (!admin.selectedUserId || confirmacao !== 'DESBLOQUEAR') {
    renderApp(root, { ...state, admin: { ...admin, unblockForm: createAdminFormState({ status: 'error', statusCode: 422, message: 'Digite DESBLOQUEAR para confirmar.' }) } });
    return;
  }

  renderApp(root, { ...state, admin: { ...admin, unblockForm: createAdminFormState({ status: 'submitting', message: 'Desbloqueando usuário...' }) } });
  const result = await fetchUnblockAdminUser(admin.selectedUserId);
  form.reset();

  if (result.status === 'expired') {
    renderAdminExpired(root, state, result.message);
    return;
  }

  await refreshAdminAfterMutation(root, state, 'unblockForm', createAdminFormState({
    status: result.status === 'success' ? 'success' : 'error',
    statusCode: result.statusCode,
    message: result.message
  }));
}
async function submitAdminResetPassword(root, state, form) {
  const admin = state.admin || createAdminState();
  const formData = new FormData(form);
  const novaSenha = String(formData.get('nova_senha') || '');
  const confirmarNovaSenha = String(formData.get('confirmar_nova_senha') || '');

  if (!admin.selectedUserId || !novaSenha || novaSenha !== confirmarNovaSenha) {
    form.reset();
    renderApp(root, { ...state, admin: { ...admin, resetForm: createAdminFormState({ status: 'error', statusCode: 422, message: 'Revise e confirme a nova senha.' }) } });
    return;
  }

  renderApp(root, { ...state, admin: { ...admin, resetForm: createAdminFormState({ status: 'submitting', message: 'Redefinindo senha...' }) } });
  const result = await fetchResetAdminUserPassword(admin.selectedUserId, novaSenha, confirmarNovaSenha);
  form.reset();

  if (result.status === 'expired') {
    renderAdminExpired(root, state, result.message);
    return;
  }

  renderApp(root, {
    ...state,
    admin: {
      ...admin,
      resetForm: createAdminFormState({
        status: result.status === 'success' ? 'success' : 'error',
        statusCode: result.statusCode,
        message: result.message
      })
    }
  });
}

async function submitAdminAssignProfile(root, state, form) {
  const admin = state.admin || createAdminState();
  const formData = new FormData(form);
  const perfilId = Number.parseInt(String(formData.get('perfil_id') || ''), 10);
  const modulo = String(formData.get('modulo') || '').trim();

  if (!admin.selectedUserId || !Number.isInteger(perfilId) || perfilId < 1) {
    renderApp(root, { ...state, admin: { ...admin, assignProfileForm: createAdminFormState({ status: 'error', statusCode: 422, message: getAdminErrorMessage(422) }) } });
    return;
  }

  renderApp(root, { ...state, admin: { ...admin, assignProfileForm: createAdminFormState({ status: 'submitting', message: 'Atribuindo perfil...' }) } });
  const result = await fetchAssignAdminUserProfile(admin.selectedUserId, perfilId, modulo);
  form.reset();

  if (result.status === 'expired') {
    renderAdminExpired(root, state, result.message);
    return;
  }

  await refreshAdminAfterMutation(root, state, 'assignProfileForm', createAdminFormState({
    status: result.status === 'success' ? 'success' : 'error',
    statusCode: result.statusCode,
    message: result.message
  }));
}

async function submitAdminDeactivateProfile(root, state, form) {
  const admin = state.admin || createAdminState();
  const formData = new FormData(form);
  const perfilId = Number.parseInt(String(formData.get('perfil_id') || ''), 10);
  const modulo = String(formData.get('modulo') || '').trim();
  const justificativa = String(formData.get('justificativa') || '').trim();
  const confirmacao = String(formData.get('confirmacao') || '').trim().toUpperCase();

  if (!admin.selectedUserId || !Number.isInteger(perfilId) || perfilId < 1 || justificativa.length < 10 || confirmacao !== 'DESATIVAR') {
    renderApp(root, { ...state, admin: { ...admin, deactivateProfileForm: createAdminFormState({ status: 'error', statusCode: 422, message: 'Informe justificativa e digite DESATIVAR.' }) } });
    return;
  }

  renderApp(root, { ...state, admin: { ...admin, deactivateProfileForm: createAdminFormState({ status: 'submitting', message: 'Desativando vínculo...' }) } });
  const result = await fetchDeactivateAdminUserProfile(admin.selectedUserId, perfilId, modulo, justificativa);
  form.reset();

  if (result.status === 'expired') {
    renderAdminExpired(root, state, result.message);
    return;
  }

  await refreshAdminAfterMutation(root, state, 'deactivateProfileForm', createAdminFormState({
    status: result.status === 'success' ? 'success' : 'error',
    statusCode: result.statusCode,
    message: result.message
  }));
}
function syncAdminUserSearch(root, state, searchQuery, cursorPosition = null) {
  const admin = state.admin || createAdminState();
  const nextSearchQuery = String(searchQuery || '');

  renderApp(root, {
    ...state,
    activeModule: 'admin',
    admin: {
      ...admin,
      userSearchQuery: nextSearchQuery
    }
  });

  const searchInput = root.querySelector('[data-admin-user-search]');
  if (searchInput instanceof HTMLInputElement) {
    const safeCursorPosition = Number.isInteger(cursorPosition)
      ? Math.max(0, Math.min(cursorPosition, nextSearchQuery.length))
      : nextSearchQuery.length;

    searchInput.focus();
    searchInput.setSelectionRange(safeCursorPosition, safeCursorPosition);
  }
}
async function selectModule(root, state, moduleKey) {
  if (moduleKey === 'dashboard') {
    if (canViewDashboardWidgets(state)) {
      await loadDashboard(root, state);
      return;
    }

    renderApp(root, {
      ...state,
      activeModule: resolveInitialActiveModule(state)
    });
    return;
  }

  if (moduleKey === 'iluminacao') {
    const nextState = {
      ...state,
      activeModule: 'iluminacao'
    };

    renderApp(root, nextState);

    if (canListSolicitacoes(nextState)) {
      await loadSolicitacoes(root, nextState, nextState.solicitacoes?.offset || 0);
      await loadOperationalMap(root, { ...currentState, activeModule: 'iluminacao' });
    }
    return;
  }

  if (moduleKey === 'admin') {
    if (canAccessAdminModule(state)) {
      await loadAdminPanel(root, state);
      return;
    }

    renderApp(root, {
      ...state,
      activeModule: resolveInitialActiveModule(state)
    });
  }
}

async function verifySession(root) {
  renderApp(root, initialSessionState);

  try {
    const nextState = await fetchCurrentSession();
    if (nextState.sessionState === 'authenticated') {
      const initialModule = resolveInitialActiveModule(nextState);

      if (initialModule === 'dashboard') {
        await loadDashboard(root, nextState);
        return;
      }

      if (initialModule === 'iluminacao') {
        await selectModule(root, {
          ...nextState,
          activeModule: 'iluminacao'
        }, 'iluminacao');
        return;
      }

      if (initialModule === 'admin') {
        await loadAdminPanel(root, nextState);
        return;
      }

      renderApp(root, {
        ...nextState,
        activeModule: initialModule
      });
      return;
    }

    renderApp(root, nextState);
  } catch {
    renderApp(root, createSessionState({
      sessionState: 'technical_error',
      message: 'Não foi possível conectar ao serviço interno. Isso pode ocorrer em desenvolvimento sem backend/proxy ativo.',
      hasChecked: true
    }));
  }
}

async function logoutInternalSession(root, state) {
  if (state.sessionState !== 'authenticated') {
    renderApp(root, createLoggedOutState());
    return;
  }

  if (state.logoutStatus === 'submitting') {
    return;
  }

  renderApp(root, {
    ...state,
    logoutStatus: 'submitting',
    logoutMessage: 'Encerrando sessão...'
  });

  try {
    const result = await fetchLogoutInternalSession();

    if (result.loggedOut) {
      renderApp(root, createLoggedOutState(result.message, result.statusCode));
      return;
    }

    renderApp(root, {
      ...state,
      logoutStatus: 'error',
      logoutMessage: result.message,
      statusCode: result.statusCode,
      message: result.message
    });
  } catch {
    renderApp(root, {
      ...state,
      logoutStatus: 'error',
      logoutMessage: 'Falha temporária ao encerrar a sessão.',
      message: 'Falha temporária ao encerrar a sessão.'
    });
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
    message: 'Validando credenciais internas.',
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
        await loadDashboard(root, confirmedState);
        return;
      }

      renderApp(root, {
        ...confirmedState,
        sessionState: 'unauthenticated',
        loginStatus: 'error',
        loginMessage: 'Login aceito, mas a sessão não foi confirmada. Tente novamente.',
        loginValue: login
      });
      return;
    }

    if (response.status === 401) {
      renderApp(root, createSessionState({
        sessionState: 'unauthenticated',
        statusCode: response.status,
        message: 'Credenciais não autenticadas pelo sistema.',
        hasChecked: true,
        loginStatus: 'error',
        loginMessage: 'Login ou senha inválidos.',
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
        message: 'Serviço interno temporariamente indisponível.',
        hasChecked: true,
        loginStatus: 'error',
        loginMessage: 'Serviço temporariamente indisponível.',
        loginValue: login
      }));
      return;
    }

    renderApp(root, createSessionState({
      sessionState: 'technical_error',
      statusCode: response.status,
      message: 'Não foi possível concluir o login interno.',
      hasChecked: true,
      loginStatus: 'error',
      loginMessage: 'Não foi possível entrar agora.',
      loginValue: login
    }));
  } catch {
    renderApp(root, createSessionState({
      sessionState: 'technical_error',
      statusCode: null,
      message: 'Não foi possível conectar ao serviço interno de autenticação.',
      hasChecked: true,
      loginStatus: 'error',
      loginMessage: 'Serviço interno indisponível no momento.',
      loginValue: login
    }));
  } finally {
    if (passwordInput instanceof HTMLInputElement) {
      passwordInput.value = '';
    }
  }
}

const root = typeof document !== 'undefined'
  ? document.getElementById('internal-iluminacao-root')
  : null;

if (root) {
  verifySession(root);

  root.addEventListener('click', (event) => {
    const target = getInternalActionTarget(event.target);

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="check-session"]')
    ) {
      verifySession(root);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="logout"]')
    ) {
      logoutInternalSession(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="select-module"]')
    ) {
      selectModule(root, currentState, target.dataset.moduleKey || '');
      return;
    }
    if (
      target instanceof HTMLElement
      && target.matches('[data-action="refresh-admin-users"]')
    ) {
      refreshAdminPanel(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="select-admin-user"]')
    ) {
      const requestedId = Number.parseInt(target.dataset.adminUserId || '0', 10);
      const safeId = Number.isInteger(requestedId) && requestedId > 0
        ? requestedId
        : 0;

      loadAdminUser(root, currentState, safeId);
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
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="copy-whatsapp-dispatch"]')
    ) {
      copyWhatsappDispatchMessage(target);
      return;
    }
    if (
      target instanceof HTMLElement
      && target.matches('[data-action="refresh-operational-map"]')
    ) {
      loadOperationalMap(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="clear-operational-map-selection"]')
    ) {
      clearOperationalMapSelection(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="filter-operational-map-visible"]')
    ) {
      filterOperationalMapVisiblePoints(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="load-solicitacao-detail"]')
    ) {
      const requestedId = Number.parseInt(target.dataset.solicitacaoId || '0', 10);
      const safeId = Number.isInteger(requestedId) && requestedId > 0
        ? requestedId
        : 0;

      loadSolicitacaoDetail(root, currentState, safeId);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="clear-solicitacao-detail"]')
    ) {
      clearSolicitacaoDetail(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="open-status-correction"]')
    ) {
      openStatusCorrectionPanel(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="cancel-status-correction"]')
    ) {
      cancelStatusCorrectionPanel(root, currentState);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="load-historico"], [data-action="previous-historico"], [data-action="next-historico"]')
    ) {
      const requestedOffset = Number.parseInt(target.dataset.offset || '0', 10);
      const safeOffset = Number.isInteger(requestedOffset) && requestedOffset >= 0
        ? requestedOffset
        : 0;

      loadSolicitacaoHistorico(root, currentState, safeOffset);
      return;
    }

    if (
      target instanceof HTMLElement
      && target.matches('[data-action="load-observacoes"], [data-action="previous-observacoes"], [data-action="next-observacoes"]')
    ) {
      const requestedOffset = Number.parseInt(target.dataset.offset || '0', 10);
      const safeOffset = Number.isInteger(requestedOffset) && requestedOffset >= 0
        ? requestedOffset
        : 0;

      loadSolicitacaoObservacoes(root, currentState, safeOffset);
    }
  });

  root.addEventListener('input', (event) => {
    const target = event.target;

    if (shouldSyncRelatorioFormOnInput(target)) {
      syncRelatorioForm(root, currentState, target.form);
      return;
    }
    if (
      target instanceof HTMLInputElement
      && target.matches('[data-admin-user-search]')
    ) {
      syncAdminUserSearch(root, currentState, target.value, target.selectionStart);
      return;
    }

    if (
      target instanceof HTMLTextAreaElement
      && target.matches('[data-observacao-textarea]')
    ) {
      updateObservacaoFormControls(target);
      return;
    }

    if (
      target instanceof HTMLTextAreaElement
      && target.matches('[data-status-observacao-textarea]')
    ) {
      updateStatusFormControls(target);
      return;
    }

    if (
      target instanceof HTMLTextAreaElement
      && target.matches('[data-prioridade-observacao-textarea]')
    ) {
      updatePrioridadeFormControls(target);
      return;
    }

    if (
      target instanceof HTMLTextAreaElement
      && target.matches('[data-status-correction-justificativa-textarea]')
    ) {
      updateStatusCorrectionFormControls(target);
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
      && target.form instanceof HTMLFormElement
      && target.form.matches('[data-relatorio-form]')
    ) {
      syncRelatorioForm(root, currentState, target.form);
      return;
    }

    if (
      target instanceof HTMLSelectElement
      && target.matches('[data-solicitacoes-sort]')
    ) {
      syncSolicitacoesSort(root, currentState, target.value);
      return;
    }

    if (
      (target instanceof HTMLSelectElement || target instanceof HTMLInputElement)
      && target.form instanceof HTMLFormElement
      && target.form.matches('[data-dashboard-filter-form]')
    ) {
      syncDashboardFilterForm(root, currentState, target.form);
      return;
    }

    if (
      target instanceof HTMLSelectElement
      && target.matches('[data-status-select]')
    ) {
      updateStatusFormControls(target);
      return;
    }

    if (
      target instanceof HTMLSelectElement
      && target.matches('[data-prioridade-select]')
    ) {
      updatePrioridadeFormControls(target);
      return;
    }

    if (
      (target instanceof HTMLSelectElement || target instanceof HTMLInputElement)
      && (
        target.matches('[data-status-correction-select]')
          || target.matches('[data-status-correction-confirmation]')
      )
    ) {
      updateStatusCorrectionFormControls(target);
    }
  });

  root.addEventListener('submit', (event) => {
    const target = event.target;

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-dashboard-filter-form]')
    ) {
      event.preventDefault();
      const submitAction = event.submitter instanceof HTMLButtonElement
        ? safeText(event.submitter.value, 'apply')
        : 'apply';
      const dashboard = submitAction === 'reset'
        ? createDashboardState({
          ...(currentState.dashboard || createDashboardState()),
          filters: createDashboardState().filters
        })
        : readDashboardFilterFormState(target, currentState.dashboard || createDashboardState());
      loadDashboard(root, { ...currentState, dashboard });
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-relatorio-form]')
    ) {
      event.preventDefault();
      const action = event.submitter instanceof HTMLButtonElement
        ? event.submitter.value
        : 'resumo';
      submitRelatorio(root, currentState, target, action);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-operational-map-filter-form]')
    ) {
      event.preventDefault();
      const action = event.submitter instanceof HTMLButtonElement
        ? event.submitter.value
        : 'apply';
      submitOperationalMapFilters(root, currentState, target, action);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-internal-login-form]')
    ) {
      event.preventDefault();
      submitLogin(root, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-list-observacao-form]')
    ) {
      event.preventDefault();
      submitListObservacao(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-observacao-form]')
    ) {
      event.preventDefault();
      submitObservacao(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-list-status-form]')
    ) {
      event.preventDefault();
      submitListStatusUpdate(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-status-form]')
    ) {
      event.preventDefault();
      submitStatusUpdate(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-prioridade-form]')
    ) {
      event.preventDefault();
      submitPrioridadeUpdate(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-status-correction-form]')
    ) {
      event.preventDefault();
      submitStatusCorrectionUpdate(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-admin-create-user-form]')
    ) {
      event.preventDefault();
      submitAdminCreateUser(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-admin-block-user-form]')
    ) {
      event.preventDefault();
      submitAdminBlockUser(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-admin-reset-password-form]')
    ) {
      event.preventDefault();
      submitAdminResetPassword(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-admin-unblock-user-form]')
    ) {
      event.preventDefault();
      submitAdminUnblockUser(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-admin-assign-profile-form]')
    ) {
      event.preventDefault();
      submitAdminAssignProfile(root, currentState, target);
      return;
    }

    if (
      target instanceof HTMLFormElement
      && target.matches('[data-admin-deactivate-profile-form]')
    ) {
      event.preventDefault();
      submitAdminDeactivateProfile(root, currentState, target);
    }
  });
}
