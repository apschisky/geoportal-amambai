import './internal-iluminacao-shell.css';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Point from 'ol/geom/Point.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import { buildGoogleMapsRouteUrl } from './geoportal-routes.js';

const AUTH_ME_ENDPOINT = '/api/internal/auth/me';
const AUTH_LOGIN_ENDPOINT = '/api/internal/auth/login';
const AUTH_LOGOUT_ENDPOINT = '/api/internal/auth/logout';
const INTERNAL_SOLICITACOES_ENDPOINT = '/api/internal/iluminacao/solicitacoes';
const SOLICITACOES_PAGE_SIZE = 20;
const HISTORICO_PAGE_SIZE = 20;
const OBSERVACOES_PAGE_SIZE = 20;
const OBSERVACAO_MIN_LENGTH = 3;
const OBSERVACAO_MAX_LENGTH = 2000;
const STATUS_OBSERVACAO_MIN_LENGTH = 3;
const STATUS_OBSERVACAO_MAX_LENGTH = 1000;
const PRIORIDADE_OBSERVACAO_MIN_LENGTH = 3;
const PRIORIDADE_OBSERVACAO_MAX_LENGTH = 1000;
const INTERNAL_MUTATING_REQUEST_HEADER = 'X-Geoportal-Internal-Request';
const OPERATIONAL_MAP_ZOOM = 17;

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
  adminUsersRead: 'admin.usuarios.ler',
  adminProfilesRead: 'admin.perfis.ler',
  adminPermissionsRead: 'admin.permissoes.ler'
};

const plannedModules = [
  {
    key: 'inicio',
    name: 'Início',
    description: 'Resumo futuro por permissões',
    kind: 'planned'
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
    description: 'Área restrita planejada',
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
  aberta: ['em_triagem', 'cancelada', 'indeferida'],
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
    statusCode: null,
    message: 'Listagem somente leitura ainda não carregada.',
    ...overrides
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

function createDetalheState(overrides = {}) {
  const historico = createHistoricoState(overrides.historico || {});
  const observacoes = createObservacoesState(overrides.observacoes || {});
  const observacaoForm = createObservacaoFormState(overrides.observacaoForm || {});
  const statusForm = createStatusFormState(overrides.statusForm || {});
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
    prioridadeForm,
    ...overrides,
    historico,
    observacoes,
    observacaoForm,
    statusForm,
    prioridadeForm
  };
}

const initialSessionState = {
  sessionState: 'checking_session',
  usuarioId: null,
  permissions: [],
  statusCode: null,
  message: 'Verificando sessão interna existente.',
  hasChecked: false,
  loginStatus: 'idle',
  loginMessage: '',
  loginValue: '',
  solicitacoes: createSolicitacoesState(),
  detalhe: createDetalheState()
};

function createSessionState(overrides = {}) {
  return {
    sessionState: 'checking_session',
    usuarioId: null,
    permissions: [],
    statusCode: null,
    message: 'Verificando sessão interna existente.',
    hasChecked: false,
    loginStatus: 'idle',
    loginMessage: '',
    loginValue: '',
    logoutStatus: 'idle',
    logoutMessage: '',
    solicitacoes: createSolicitacoesState(),
    detalhe: createDetalheState(),
    ...overrides
  };
}

let currentState = createSessionState();
let operationalDetailMap = null;

function renderApp(root, state) {
  currentState = {
    ...state,
    solicitacoes: state.solicitacoes || createSolicitacoesState(),
    detalhe: state.detalhe || createDetalheState()
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
  buildUpdateSolicitacaoPrioridadeUrl,
  canUpdatePrioridade,
  createDetalheState,
  createPrioridadeFormState,
  fetchUpdateSolicitacaoPrioridade,
  getPrioridadeFormValidationMessage,
  isMaintenanceLikeUser,
  normalizeSolicitacaoCoordinate,
  renderCoordinateRouteSection,
  renderObservacoesPanel,
  renderPriorityUpdatePanel,
  renderStatusUpdatePanel
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
    statusKey: safeText(safeItem.status, ''),
    status: formatStatusLabel(safeItem.status),
    tipoProblemaKey: safeText(safeItem.tipo_problema, ''),
    tipoProblema: formatProblemTypeLabel(safeItem.tipo_problema),
    prioridadeKey: safeText(safeItem.prioridade, ''),
    prioridade: formatPriorityLabel(safeItem.prioridade),
    posteId: safeText(safeItem.poste_id, 'Sem poste'),
    coordinates,
    hasCoordinates: Boolean(coordinates),
    criadoEm: formatDateTime(safeItem.criado_em),
    atualizadoEm: formatDateTime(safeItem.atualizado_em),
    duplicidadeSuspeita: safeItem.duplicidade_suspeita === true ? 'Sim' : 'Não'
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
    statusKey: safeText(safeItem.status, ''),
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

function formatStatusLabel(value) {
  const status = safeText(value, '');
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
  return terminalStatuses.includes(status);
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

function buildSolicitacoesUrl(offset = 0) {
  const params = new URLSearchParams({
    limit: String(SOLICITACOES_PAGE_SIZE),
    offset: String(Math.max(0, offset))
  });

  return `${INTERNAL_SOLICITACOES_ENDPOINT}?${params.toString()}`;
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

function buildUpdateSolicitacaoPrioridadeUrl(solicitacaoId) {
  return `${buildSolicitacaoDetailUrl(solicitacaoId)}/prioridade`;
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

function isMaintenanceLikeUser(permissions = []) {
  const normalizedPermissions = normalizePermissions(permissions);
  const canReadIluminacao = normalizedPermissions.includes(PERMISSIONS.iluminacaoRead);
  const hasAdminAccess = normalizedPermissions.some((permission) => (
    permission.startsWith('admin.')
  ));

  return canReadIluminacao && !hasAdminAccess;
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

function getSummaryCardViews(state) {
  const listState = state.solicitacoes || createSolicitacoesState();
  const items = Array.isArray(listState.items) ? listState.items : [];
  const loaded = listState.status === 'ready' || listState.status === 'empty';
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
        note: loaded ? 'Nesta página da listagem' : 'Aguardando listagem'
      };
    }

    if (card.key === 'finished') {
      return {
        ...card,
        value: loaded ? finishedCount : '--',
        note: loaded ? 'Nesta página da listagem' : 'Aguardando listagem'
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

function renderStatusOptions() {
  return statusOptions
    .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(formatStatusLabel(status))}</option>`)
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

function renderSolicitacoesTable(listState) {
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
    return renderSolicitacoesRows(listState.items);
  }

  return `
    <div class="internal-table-empty" role="row">
      ${escapeHtml(listState.message || 'Listagem aguardando autenticação e permissão.')}
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
    return `Código ${listState.statusCode}`;
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
          <strong>${escapeHtml(getSolicitacoesStatusText(listState))}</strong>
          <span>
            Página com até ${escapeHtml(listState.limit)} registros
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
            <span>Ações</span>
          </div>
          ${renderSolicitacoesTable(listState)}
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
  const userText = state.sessionState === 'authenticated'
    ? `Usuário interno #${state.usuarioId}`
    : 'Acesso interno';
  const statusText = state.sessionState === 'authenticated'
    ? 'Sessão ativa'
    : stateInfo.label;

  return `
    <aside class="internal-session-box is-${stateInfo.tone}" aria-label="Estado de sessão">
      <span>${escapeHtml(stateInfo.label)}</span>
      <strong>${escapeHtml(userText)}</strong>
      <p>${escapeHtml(statusText)}</p>
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

function renderInternalIluminacaoShell(root, state) {
  const stateInfo = SESSION_STATES[state.sessionState] || SESSION_STATES.technical_error;
  const maintenanceMode = isMaintenanceLikeUser(state.permissions || []);

  root.innerHTML = `
    <main class="internal-page${maintenanceMode ? ' is-maintenance-mode' : ''}" aria-labelledby="internal-page-title">
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
          ${maintenanceMode
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

          <section class="internal-module-workspace" aria-labelledby="module-workspace-title">
            <div class="internal-section-heading">
              <h2 id="module-workspace-title">Solicitações de Iluminação</h2>
              <p>${maintenanceMode
                ? 'Acompanhe protocolos, fase do atendimento, observações, coordenadas e rota.'
                : 'Consulte chamados, abra detalhes e registre interações internas conforme seu perfil.'}</p>
            </div>

            <div class="internal-workspace">
              ${renderSolicitacoesPanel(state)}

              <div class="internal-detail-grid">
                ${renderSolicitacaoDetailPanel(state)}
              </div>
            </div>
          </section>
        </section>
      </div>

      <footer class="internal-footer">
        Geoportal público preservado. A autorização real continua no backend; esta shell não armazena token.
      </footer>
    </main>
  `;

  syncOperationalDetailMap(root, state);
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
    const solicitacoes = await fetchSolicitacoesInternas(offset);

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
        solicitacoes = await fetchSolicitacoesInternas(solicitacoes.offset || 0);
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
        statusForm: nextFormState
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
        solicitacoes = await fetchSolicitacoesInternas(solicitacoes.offset || 0);
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
        prioridadeForm: nextFormState
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

function clearSolicitacaoDetail(root, state) {
  renderApp(root, {
    ...state,
    detalhe: createDetalheState()
  });
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
      && target.matches('[data-action="logout"]')
    ) {
      logoutInternalSession(root, currentState);
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
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;

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
    }
  });
}
