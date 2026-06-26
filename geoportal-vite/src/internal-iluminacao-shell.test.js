import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INTERNAL_MUTATING_REQUEST_HEADER,
  buildInternalGoogleMapsRouteUrl,
  buildRelatorioSolicitacoesCsvUrl,
  buildInternalWhatsappUrl,
  buildSolicitacoesUrl,
  buildUpdateSolicitacaoStatusCorrecaoUrl,
  canViewDashboardWidgets,
  canViewRelatorio,
  canUpdatePrioridade,
  canCorrectStatus,
  createDashboardState,
  createDetalheState,
  createSessionState,
  createRelatorioState,
  createAdminState,
  fetchAdminUsers,
  fetchAdminUserDetail,
  fetchAdminUserProfiles,
  fetchCreateAdminUser,
  fetchUnblockAdminUser,
  fetchResetAdminUserPassword,
  fetchDeactivateAdminUserProfile,
  fetchDashboardGeralWidgets,
  fetchRelatorioSolicitacoesCsv,
  fetchRelatorioSolicitacoesResumo,
  fetchSolicitacoesInternas,
  fetchUpdateSolicitacaoStatus,
  fetchUpdateSolicitacaoStatusCorrecao,
  fetchUpdateSolicitacaoPrioridade,
  getInternalActionTarget,
  getPrioridadeFormValidationMessage,
  getRelatorioValidationMessage,
  getStatusCorrectionFormValidationMessage,
  isMaintenanceLikeUser,
  normalizeSolicitacaoCoordinate,
  renderCoordinateRouteSection,
  renderDashboardPanel,
  renderAdminPanel,
  renderModuleMenu,
  renderObservacoesPanel,
  renderRelatorioPanel,
  renderPriorityUpdatePanel,
  renderStatusCorrectionPanel,
  renderSessionBox,
  renderSolicitacaoDetailLoaded,
  renderSolicitacoesPanel,
  renderSummaryCards,
  renderStatusUpdatePanel,
  resolveInitialActiveModule,
  scrollToSolicitacaoDetailSection,
  loadAdminUser,
  refreshAdminPanel,
  selectModule,
  shouldSyncRelatorioFormOnInput
} from './internal-iluminacao-shell.js';

const prioridadePermission = 'iluminacao.solicitacoes.atualizar_prioridade';
const readPermission = 'iluminacao.solicitacoes.ler';
const commentPermission = 'iluminacao.solicitacoes.comentar';
const statusPermission = 'iluminacao.solicitacoes.atualizar_status';
const statusCorrectionPermission = 'iluminacao.solicitacoes.corrigir_status';
const dashboardPermission = 'iluminacao.dashboard.ler';
const adminUsersReadPermission = 'admin.usuarios.ler';
const adminUsersCreatePermission = 'admin.usuarios.criar';
const adminUsersBlockPermission = 'admin.usuarios.bloquear';
const adminUsersResetPasswordPermission = 'admin.usuarios.redefinir_senha';
const adminUsersRemoveProfilesPermission = 'admin.usuarios.remover_perfis';
const adminProfilesReadPermission = 'admin.perfis.ler';

function authenticatedState(permissions = [], overrides = {}) {
  return {
    sessionState: 'authenticated',
    permissions,
    ...overrides
  };
}

function adminState() {
  return authenticatedState([readPermission, adminUsersReadPermission, dashboardPermission]);
}

function loadedDetail(overrides = {}) {
  return createDetalheState({
    status: 'loaded',
    item: {
      id: 10,
      prioridadeKey: 'normal',
      statusKey: 'aberta',
      ...overrides
    }
  });
}

function listItem(overrides = {}) {
  return {
    id: 10,
    protocolo: 'IP-2026-000009',
    status: 'Aberta',
    statusKey: 'aberta',
    tipoProblema: 'Lampada apagada',
    prioridade: 'Normal',
    prioridadeKey: 'normal',
    posteId: '3405',
    criadoEm: '10/06/2026 08:00',
    atualizadoEm: '10/06/2026 09:00',
    duplicidadeSuspeita: 'Nao',
    hasCoordinates: true,
    coordinates: {
      latitude: -23.105,
      longitude: -55.225
    },
    ...overrides
  };
}

function solicitacoesReadyState(permissions = [], itemOverrides = {}) {
  return {
    sessionState: 'authenticated',
    permissions,
    solicitacoes: {
      status: 'ready',
      items: [listItem(itemOverrides)],
      total: 1,
      limit: 20,
      offset: 0,
      message: 'Solicitacoes carregadas.'
    },
    detalhe: createDetalheState()
  };
}

function jsonResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => payload
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('internal auth me UX', () => {
  it('usa nome e login vindos de /me sem exibir autenticado ou perfis', () => {
    const html = renderSessionBox(createSessionState({
      sessionState: 'authenticated',
      usuarioId: 2,
      nome: 'Administrador Producao',
      login: 'admin.producao',
      profiles: ['administrador-interno-geoportal']
    }));

    expect(html).toContain('Administrador Producao');
    expect(html).toContain('admin.producao');
    expect(html).not.toContain('AUTENTICADO');
    expect(html).not.toContain('Autenticado');
    expect(html).not.toContain('Perfis:');
  });

  it('mantem fallback antigo quando /me nao informa nome login ou perfis', () => {
    const html = renderSessionBox(createSessionState({
      sessionState: 'authenticated',
      usuarioId: 7
    }));

    expect(html).toContain('Usuário interno #7');
    expect(html).not.toContain('Perfis:');
  });
});
describe('internal detail UX helpers', () => {
  it('rola ate a secao de detalhe quando ela estiver presente', () => {
    const scrollSpy = vi.fn();
    const detailSection = {
      scrollIntoView: scrollSpy
    };
    const root = {
      querySelector: vi.fn(() => detailSection)
    };

    expect(scrollToSolicitacaoDetailSection(root)).toBe(true);
    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start'
    });
  });

  it('nao tenta rolar quando a secao de detalhe nao existe', () => {
    const root = {
      querySelector: vi.fn(() => null)
    };

    expect(scrollToSolicitacaoDetailSection(root)).toBe(false);
  });
});

describe('internal prioridade UI', () => {
  it('renderiza acao de prioridade apenas com permissao especifica', () => {
    const detail = loadedDetail();
    const withoutPermission = renderPriorityUpdatePanel(authenticatedState(), detail);
    const withPermission = renderPriorityUpdatePanel(
      authenticatedState([prioridadePermission]),
      detail
    );

    expect(canUpdatePrioridade(authenticatedState())).toBe(false);
    expect(withoutPermission).toContain('Alteração de prioridade indisponível');
    expect(withoutPermission).not.toContain('data-prioridade-form');
    expect(canUpdatePrioridade(authenticatedState([prioridadePermission]))).toBe(true);
    expect(withPermission).toContain('data-prioridade-form');
    expect(withPermission).toContain('Atualizar prioridade');
    expect(withPermission).toContain('Normal');
  });

  it('bloqueia observacao invalida antes do envio', () => {
    expect(getPrioridadeFormValidationMessage('normal', 'alta', ' ab ')).toContain(
      'ao menos 3 caracteres'
    );
    expect(getPrioridadeFormValidationMessage('normal', 'alta', 'Justificativa')).toBe(
      ''
    );
  });

  it('envia PATCH de prioridade com header mutavel obrigatorio e payload restrito', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        solicitacao: {
          id: 10,
          prioridade: 'alta',
          atualizado_em: '2026-06-11T10:00:00Z'
        }
      })
    );

    const result = await fetchUpdateSolicitacaoPrioridade(
      10,
      'alta',
      'Justificativa operacional'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/internal/iluminacao/solicitacoes/10/prioridade'
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
      }
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      prioridade: 'alta',
      observacao: 'Justificativa operacional'
    });
    expect(result.status).toBe('success');
  });

  it('envia PATCH de status com header mutavel obrigatorio e payload restrito', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        solicitacao: {
          id: 10,
          status: 'em_execucao',
          atualizado_em: '2026-06-11T10:00:00Z',
          finalizado_em: null
        }
      })
    );

    const result = await fetchUpdateSolicitacaoStatus(
      10,
      'em_execucao',
      'Justificativa operacional'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/internal/iluminacao/solicitacoes/10/status'
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
      }
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      status: 'em_execucao',
      observacao: 'Justificativa operacional'
    });
    expect(result.status).toBe('success');
  });

  it('traduz erros de prioridade para mensagens amigaveis', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));
    await expect(fetchUpdateSolicitacaoPrioridade(10, 'alta', 'Justificativa')).resolves
      .toMatchObject({ status: 'error', statusCode: 403 });

    fetchMock.mockResolvedValueOnce(jsonResponse(409, {}));
    await expect(fetchUpdateSolicitacaoPrioridade(10, 'alta', 'Justificativa')).resolves
      .toMatchObject({ status: 'error', statusCode: 409 });

    fetchMock.mockResolvedValueOnce(jsonResponse(422, {}));
    await expect(fetchUpdateSolicitacaoPrioridade(10, 'alta', 'Justificativa')).resolves
      .toMatchObject({ status: 'error', statusCode: 422 });
  });
});

describe('internal correcao administrativa de status', () => {
  it('renderiza acao administrativa apenas com permissao especifica', () => {
    const detail = loadedDetail();
    const withoutPermission = renderStatusCorrectionPanel(authenticatedState(), detail);
    const withPermission = renderStatusCorrectionPanel(
      authenticatedState([statusCorrectionPermission]),
      detail
    );

    expect(canCorrectStatus(authenticatedState())).toBe(false);
    expect(withoutPermission).toBe('');
    expect(canCorrectStatus(authenticatedState([statusCorrectionPermission]))).toBe(true);
    expect(withPermission).toContain('Ações administrativas');
    expect(withPermission).toContain('Corrigir status administrativamente');
    expect(withPermission).not.toContain('data-status-correction-form');
  });

  it('renderiza painel de confirmacao forte quando aberto', () => {
    const detail = createDetalheState({
      status: 'loaded',
      item: {
        id: 10,
        prioridadeKey: 'normal',
        statusKey: 'aberta'
      },
      statusCorrectionForm: {
        open: true,
        selectedStatus: 'em_execucao',
        justificativa: 'Correcao administrativa segura',
        confirmed: true
      }
    });
    const html = renderStatusCorrectionPanel(
      authenticatedState([statusCorrectionPermission]),
      detail
    );

    expect(html).toContain('data-status-correction-form');
    expect(html).toContain('Correção administrativa de status');
    expect(html).toContain('Confirmar correção administrativa');
    expect(html).toContain('data-status-correction-confirmation');
  });

  it('bloqueia justificativa curta e mesmo status no cliente', () => {
    expect(getStatusCorrectionFormValidationMessage(
      'aberta',
      'em_execucao',
      ' curta ',
      true
    )).toContain('ao menos 10 caracteres');
    expect(getStatusCorrectionFormValidationMessage(
      'aberta',
      'aberta',
      'Justificativa administrativa',
      true
    )).toContain('diferente do atual');
    expect(getStatusCorrectionFormValidationMessage(
      'aberta',
      'em_execucao',
      'Justificativa administrativa',
      false
    )).toContain('Confirme ciência');
    expect(getStatusCorrectionFormValidationMessage(
      'aberta',
      'em_execucao',
      'Justificativa administrativa',
      true
    )).toBe('');
  });

  it('envia PATCH de correcao com header mutavel obrigatorio e payload restrito', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        solicitacao: {
          id: 10,
          status: 'em_execucao',
          atualizado_em: '2026-06-17T10:00:00Z',
          finalizado_em: null
        }
      })
    );

    const result = await fetchUpdateSolicitacaoStatusCorrecao(
      10,
      'em_execucao',
      'Correcao administrativa segura'
    );

    expect(buildUpdateSolicitacaoStatusCorrecaoUrl(10)).toBe(
      '/api/internal/iluminacao/solicitacoes/10/status-correcao'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/internal/iluminacao/solicitacoes/10/status-correcao'
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [INTERNAL_MUTATING_REQUEST_HEADER]: '1'
      }
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      novo_status: 'em_execucao',
      justificativa: 'Correcao administrativa segura'
    });
    expect(result).toMatchObject({
      status: 'success',
      open: false
    });
  });

  it('traduz erros de correcao administrativa para mensagens amigaveis', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    await expect(fetchUpdateSolicitacaoStatusCorrecao(10, 'em_execucao', 'Justificativa'))
      .resolves.toMatchObject({ status: 'expired', statusCode: 401 });

    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));
    await expect(fetchUpdateSolicitacaoStatusCorrecao(10, 'em_execucao', 'Justificativa'))
      .resolves.toMatchObject({ status: 'error', statusCode: 403 });

    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));
    await expect(fetchUpdateSolicitacaoStatusCorrecao(10, 'em_execucao', 'Justificativa'))
      .resolves.toMatchObject({ status: 'error', statusCode: 404 });

    fetchMock.mockResolvedValueOnce(jsonResponse(409, {}));
    await expect(fetchUpdateSolicitacaoStatusCorrecao(10, 'em_execucao', 'Justificativa'))
      .resolves.toMatchObject({ status: 'error', statusCode: 409 });

    fetchMock.mockResolvedValueOnce(jsonResponse(422, {}));
    await expect(fetchUpdateSolicitacaoStatusCorrecao(10, 'em_execucao', 'Justificativa'))
      .resolves.toMatchObject({ status: 'error', statusCode: 422 });

    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));
    await expect(fetchUpdateSolicitacaoStatusCorrecao(10, 'em_execucao', 'Justificativa'))
      .resolves.toMatchObject({ status: 'error', statusCode: 503 });
  });
});

describe('internal dashboard geral', () => {
  function dashboardResumoPayload(overrides = {}) {
    return {
      total: 7,
      abertas: 5,
      em_triagem: 0,
      em_execucao: 1,
      encaminhadas: 1,
      finalizadas: 0,
      urgentes: 0,
      atrasadas: 6,
      tempo_medio_resolucao_segundos: null,
      por_status: {
        aberta: 5,
        em_execucao: 1,
        encaminhada: 1
      },
      por_prioridade: {
        normal: 7
      },
      por_tipo: {
        lampada_apagada: 7
      },
      ...overrides
    };
  }

  function dashboardRankingPayload(overrides = {}) {
    return {
      top_bairros: [],
      top_postes: [
        { chave: '3405', total: 2 },
        { chave: '4067', total: 1 }
      ],
      ...overrides
    };
  }

  function dashboardSeriesPayload(overrides = {}) {
    return {
      granularidade: 'semana',
      pontos: [
        {
          periodo: '2026-06-01',
          total: 3,
          por_status: { aberta: 2, em_execucao: 1 }
        }
      ],
      ...overrides
    };
  }

  it('substitui Inicio por Dashboard no menu lateral para usuario gerencial', () => {
    const html = renderModuleMenu(authenticatedState([readPermission, dashboardPermission]));

    expect(html).toContain('Dashboard');
    expect(html).toContain('data-action="select-module"');
    expect(html).toContain('data-module-key="dashboard"');
    expect(html).not.toContain('data-module-key="inicio"');
  });

  it('usa Dashboard como tela inicial somente com permissao gerencial', () => {
    const state = createSessionState({
      sessionState: 'authenticated',
      permissions: [readPermission, dashboardPermission]
    });

    expect(resolveInitialActiveModule(state)).toBe('dashboard');
    expect(renderDashboardPanel(state)).toContain('Dashboard do Geoportal Interno');
  });

  it('envia usuario operacional sem dashboard direto para Iluminacao Publica', () => {
    const state = createSessionState({
      sessionState: 'authenticated',
      permissions: [readPermission, statusPermission, commentPermission]
    });
    const menu = renderModuleMenu(state);

    expect(resolveInitialActiveModule(state)).toBe('iluminacao');
    expect(menu).not.toContain('data-module-key="dashboard"');
    expect(menu).not.toContain('Dashboard');
    expect(menu).toContain('data-module-key="iluminacao"');
    expect(menu).toContain('Ilumina');
  });

  it('mostra estado seguro quando nao ha dashboard nem modulo permitido', () => {
    const state = createSessionState({
      sessionState: 'authenticated',
      permissions: []
    });
    const menu = renderModuleMenu(state);

    expect(resolveInitialActiveModule(state)).toBe('none');
    expect(menu).not.toContain('data-module-key="dashboard"');
    expect(menu).toContain('data-module-key="iluminacao"');
    expect(menu).toContain('disabled');
  });

  it('marca Dashboard e Iluminacao Publica como navegacao alternavel na lateral', () => {
    const dashboardState = createSessionState({
      sessionState: 'authenticated',
      activeModule: 'dashboard',
      permissions: [readPermission, dashboardPermission]
    });
    const iluminacaoState = createSessionState({
      sessionState: 'authenticated',
      activeModule: 'iluminacao',
      permissions: [readPermission, dashboardPermission]
    });
    const dashboardMenu = renderModuleMenu(dashboardState);
    const iluminacaoMenu = renderModuleMenu(iluminacaoState);

    expect(dashboardMenu).toContain('data-module-key="dashboard"');
    expect(dashboardMenu).toContain('aria-current="page"');
    expect(iluminacaoMenu).toContain('data-module-key="iluminacao"');
    expect(iluminacaoMenu).toContain('Ilumina');
    expect(iluminacaoMenu).toContain('aria-current="page"');
  });

  it('resolve a navegacao quando o clique acontece no texto interno do botao', () => {
    const moduleButton = {
      matches: vi.fn((selector) => selector === '[data-action="select-module"]'),
      dataset: { moduleKey: 'iluminacao' }
    };
    const nestedText = {
      closest: vi.fn((selector) => (selector === '[data-action]' ? moduleButton : null))
    };

    expect(getInternalActionTarget(nestedText)).toBe(moduleButton);
    expect(nestedText.closest).toHaveBeenCalledWith('[data-action]');
  });

  it('mostra widgets de Iluminacao somente com iluminacao.dashboard.ler', () => {
    const withoutPermission = createSessionState({
      sessionState: 'authenticated',
      permissions: [readPermission],
      dashboard: createDashboardState({ status: 'idle' })
    });
    const withPermission = createSessionState({
      sessionState: 'authenticated',
      permissions: [readPermission, dashboardPermission],
      dashboard: createDashboardState({
        status: 'ready',
        resumo: dashboardResumoPayload(),
        ranking: dashboardRankingPayload(),
        series: dashboardSeriesPayload()
      })
    });

    expect(canViewDashboardWidgets(withoutPermission)).toBe(false);
    expect(renderDashboardPanel(withoutPermission)).toContain('Sem widgets gerenciais liberados');
    expect(renderDashboardPanel(withoutPermission)).not.toContain('Widgets gerenciais');

    expect(canViewDashboardWidgets(withPermission)).toBe(true);
    expect(renderDashboardPanel(withPermission)).toContain('Painel consolidado');
    expect(renderDashboardPanel(withPermission)).toContain('Iluminacao Publica');
    expect(renderDashboardPanel(withPermission)).toContain('Filtros e legenda');
    expect(renderDashboardPanel(withPermission)).not.toContain('Widgets gerenciais');
    expect(renderDashboardPanel(withPermission)).toContain('Ranking de postes');
  });

  it('chama os tres endpoints de dashboard com credentials include', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, dashboardResumoPayload()))
      .mockResolvedValueOnce(jsonResponse(200, dashboardRankingPayload()))
      .mockResolvedValueOnce(jsonResponse(200, dashboardSeriesPayload()));

    const result = await fetchDashboardGeralWidgets();

    expect(result.status).toBe('ready');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/internal/iluminacao/dashboard/resumo');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/internal/iluminacao/dashboard/ranking');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/internal/iluminacao/dashboard/series?granularidade=semana');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include'
    });
  });

  it('nao chama endpoints de dashboard para usuario sem permissao quando renderiza estado seguro', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const html = renderDashboardPanel(createSessionState({
      sessionState: 'authenticated',
      permissions: [readPermission]
    }));

    expect(html).toContain('Selecione um modulo na lateral');
    expect(html).not.toContain('Ranking de postes');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trata erro 403 e 503 dos widgets sem quebrar a shell', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));
    await expect(fetchDashboardGeralWidgets()).resolves.toMatchObject({
      status: 'error',
      statusCode: 403,
      message: expect.stringContaining('permissao')
    });

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));
    await expect(fetchDashboardGeralWidgets()).resolves.toMatchObject({
      status: 'error',
      statusCode: 503,
      message: expect.stringContaining('indisponivel')
    });
  });

  it('renderiza KPIs compactos e mapa territorial real a partir da listagem carregada', () => {
    const html = renderDashboardPanel(createSessionState({
      sessionState: 'authenticated',
      permissions: [readPermission, dashboardPermission],
      solicitacoes: solicitacoesReadyState([readPermission, dashboardPermission]).solicitacoes,
      dashboard: createDashboardState({
        status: 'ready',
        resumo: dashboardResumoPayload(),
        ranking: dashboardRankingPayload(),
        series: dashboardSeriesPayload()
      })
    }));

    expect(html).toContain('internal-dashboard-kpi-grid');
    expect(html).toContain('internal-dashboard-territory-grid');
    expect(html).toContain('Mapa territorial dos servicos');
    expect(html).toContain('Ocorrencias carregadas pela listagem operacional autorizada.');
    expect(html).toContain('internal-dashboard-real-map');
    expect(html).toContain('data-dashboard-map');
    expect(html).toContain('Pontos - 1/1 visiveis');
    expect(html).toContain('Modo do mapa');
    expect(html).toContain('Troque aqui entre Pontos e Calor.');
    expect(html).toContain('Pontos');
    expect(html).toContain('Calor');
    expect(html).toContain('data-dashboard-map-mode="points"');
    expect(html).toContain('Prioridade altera tamanho, borda e halo dos pontos.');
    expect(html).not.toContain('Fonte: listagem operacional autorizada, limitada ao recorte carregado.');
    expect(html).not.toContain('internal-dashboard-map-surface');
    expect(html).not.toContain('internal-dashboard-map-point');
    expect(html).not.toContain('-23.105');
    expect(html).not.toContain('-55.225');
  });

  it('aplica filtros locais de status prioridade tipo e fonte sobre o recorte carregado', () => {
    const solicitacoes = {
      status: 'ready',
      items: [
        listItem({
          id: 10,
          status: 'Aberta',
          statusKey: 'aberta',
          prioridadeKey: 'normal',
          tipoProblemaKey: 'lampada_apagada',
          coordinates: { latitude: -23.105, longitude: -55.225 }
        }),
        listItem({
          id: 11,
          protocolo: 'IP-2026-000010',
          status: 'Resolvida',
          statusKey: 'resolvida',
          prioridade: 'Alta',
          prioridadeKey: 'alta',
          tipoProblema: 'Poste apagado',
          tipoProblemaKey: 'poste_apagado',
          coordinates: { latitude: -23.11, longitude: -55.23 }
        })
      ],
      total: 2,
      limit: 20,
      offset: 0,
      message: 'Solicitacoes carregadas.'
    };

    const html = renderDashboardPanel(createSessionState({
      sessionState: 'authenticated',
      permissions: [readPermission, dashboardPermission],
      solicitacoes,
      dashboard: createDashboardState({
        status: 'ready',
        filters: {
          source: 'iluminacao',
          status: 'aberta',
          prioridade: 'normal',
          tipo: 'lampada_apagada',
          mapMode: 'heatmap'
        },
        resumo: dashboardResumoPayload(),
        ranking: dashboardRankingPayload(),
        series: dashboardSeriesPayload()
      })
    }));

    expect(html).toContain('data-dashboard-filter-form');
    expect(html).toContain('Todas as fontes');
    expect(html).toContain('Iluminacao Publica');
    expect(html).toContain('L\u00e2mpada apagada');
    expect(html).toContain('poste apagado');
    expect(html).toContain('Calor - 1/2 visiveis');
    expect(html).toContain('data-dashboard-map-mode="heatmap"');
    expect(html).toContain('Ocorrencias visiveis');
    expect(html).toContain('<dd>1</dd>');
    expect(html).toContain('Aberta');
    expect(html).not.toContain('Fonte territorial');
    expect(html).not.toContain('Privacidade');
  });

  it('mostra placeholder seguro quando nao ha pontos territoriais carregados', () => {
    const html = renderDashboardPanel(createSessionState({
      sessionState: 'authenticated',
      permissions: [dashboardPermission],
      solicitacoes: createSessionState().solicitacoes,
      dashboard: createDashboardState({
        status: 'ready',
        resumo: dashboardResumoPayload(),
        ranking: dashboardRankingPayload(),
        series: dashboardSeriesPayload()
      })
    }));

    expect(html).toContain('Mapa territorial sera habilitado quando houver solicitacoes recentes com coordenadas carregadas.');
    expect(html).toContain('internal-dashboard-map-placeholder');
  });

  it('mostra mensagem controlada quando top_bairros vem vazio', () => {
    const html = renderDashboardPanel(createSessionState({
      sessionState: 'authenticated',
      permissions: [dashboardPermission],
      dashboard: createDashboardState({
        status: 'ready',
        resumo: dashboardResumoPayload(),
        ranking: dashboardRankingPayload({ top_bairros: [] }),
        series: dashboardSeriesPayload()
      })
    }));

    expect(html).toContain('Bairros/regioes ainda nao disponiveis no cadastro atual.');
    expect(html).not.toContain('nome_solicitante');
    expect(html).not.toContain('contato_solicitante');
    expect(html).not.toContain('observacao_resumida');
  });

  it('nao usa storage do navegador para sessao ou token nos widgets', () => {
    expect(fetchDashboardGeralWidgets.toString()).not.toContain('localStorage');
    expect(fetchDashboardGeralWidgets.toString()).not.toContain('sessionStorage');
    expect(renderDashboardPanel.toString()).not.toContain('localStorage');
    expect(renderDashboardPanel.toString()).not.toContain('sessionStorage');
  });

  it('mantem estrutura CSS responsiva principal do Dashboard', () => {
    const css = readFileSync(new URL('./internal-iluminacao-shell.css', import.meta.url), 'utf8');

    expect(css).toContain('.internal-page.is-dashboard-mode .internal-shell-layout');
    expect(css).toContain('.internal-page.is-iluminacao-mode .internal-shell-layout');
    expect(css).toContain('width: min(1760px, 100%)');
    expect(css).toContain('grid-template-rows: auto minmax(430px, 1fr)');
    expect(css).toContain('@media (max-width: 920px)');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('@media (max-width: 420px)');
  });

  it('mantem modo calor com OpenLayers Heatmap e prioridade como peso visual', () => {
    const source = readFileSync(new URL('./internal-iluminacao-shell.js', import.meta.url), 'utf8');

    expect(source).toContain("import HeatmapLayer from 'ol/layer/Heatmap.js';");
    expect(source).toContain("weight: 'weight'");
    expect(source).toContain('getDashboardHeatmapWeight');
    expect(source).toContain('haloRadius');
    expect(source).not.toContain('/solicitacoes/${id}');
  });

  it('mantem Iluminacao Publica como modulo operacional com resumo contextual e lista', () => {
    const state = solicitacoesReadyState([readPermission, dashboardPermission]);
    const summaryHtml = renderSummaryCards(state);
    const listHtml = renderSolicitacoesPanel(state);

    expect(summaryHtml).toContain('Total retornado pela listagem');
    expect(listHtml).toContain('Solicita');
    expect(listHtml).toContain('IP-2026-000009');
    expect(listHtml).toContain('Ver detalhe');
    expect(renderDashboardPanel({
      ...state,
      dashboard: createDashboardState({
        status: 'ready',
        resumo: dashboardResumoPayload(),
        ranking: dashboardRankingPayload(),
        series: dashboardSeriesPayload()
      })
    })).not.toContain('Lista operacional');
  });
});

describe('internal relatorio administrativo', () => {
  it('nao sincroniza o formulario no input de data para evitar fechar o calendario nativo', () => {
    const form = {
      matches: vi.fn((selector) => selector === '[data-relatorio-form]')
    };
    const dateInput = {
      type: 'date',
      form
    };
    const textInput = {
      type: 'text',
      form
    };

    expect(shouldSyncRelatorioFormOnInput(dateInput)).toBe(false);
    expect(shouldSyncRelatorioFormOnInput(textInput)).toBe(true);
  });

  it('renderiza area de relatorio apenas para perfil administrativo', () => {
    const adminHtml = renderRelatorioPanel({
      ...adminState(),
      relatorio: createRelatorioState()
    });
    const maintenanceHtml = renderRelatorioPanel({
      ...authenticatedState([readPermission, statusPermission]),
      relatorio: createRelatorioState()
    });

    expect(canViewRelatorio(adminState())).toBe(true);
    expect(adminHtml).toContain('Relatorio administrativo');
    expect(adminHtml).toContain('Exportar CSV');
    expect(adminHtml).toContain('Atualizar resumo');
    expect(canViewRelatorio(authenticatedState([readPermission, statusPermission]))).toBe(false);
    expect(maintenanceHtml).toBe('');
  });

  it('permite relatorio geral sem datas e orienta o filtro opcional', () => {
    expect(getRelatorioValidationMessage(createRelatorioState())).toBe('');

    const html = renderRelatorioPanel({
      ...adminState(),
      relatorio: createRelatorioState()
    });

    expect(html).toContain('Se deixar em branco, o relatorio sera geral');
    expect(html).toContain('value="csv"');
    expect(html).not.toContain('required');
  });

  it('monta URL de exportacao apenas com filtros administrativos seguros', () => {
    const fullUrl = buildRelatorioSolicitacoesCsvUrl({
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
      statusFilter: 'aberta',
      prioridadeFilter: 'normal',
      tipoFilter: 'lampada_apagada',
      nomeSolicitante: 'Nao deve ir',
      contatoSolicitante: '67999990000',
      observacao: 'Nao deve ir'
    });
    const noDatesUrl = buildRelatorioSolicitacoesCsvUrl({});
    const onlyStartUrl = buildRelatorioSolicitacoesCsvUrl({
      dataInicio: '2026-06-01'
    });
    const onlyEndUrl = buildRelatorioSolicitacoesCsvUrl({
      dataFim: '2026-06-30'
    });

    expect(fullUrl).toContain('/api/internal/iluminacao/relatorios/solicitacoes.csv?');
    expect(fullUrl).toContain('data_inicio=2026-06-01');
    expect(fullUrl).toContain('data_fim=2026-06-30');
    expect(fullUrl).toContain('status=aberta');
    expect(fullUrl).toContain('prioridade=normal');
    expect(fullUrl).toContain('tipo=lampada_apagada');
    expect(fullUrl).not.toContain('nomeSolicitante');
    expect(fullUrl).not.toContain('contatoSolicitante');
    expect(fullUrl).not.toContain('observacao');
    expect(noDatesUrl).toBe('/api/internal/iluminacao/relatorios/solicitacoes.csv');
    expect(noDatesUrl).not.toContain('data_inicio=');
    expect(noDatesUrl).not.toContain('data_fim=');
    expect(onlyStartUrl).toContain('data_inicio=2026-06-01');
    expect(onlyStartUrl).not.toContain('data_fim=');
    expect(onlyEndUrl).toContain('data_fim=2026-06-30');
    expect(onlyEndUrl).not.toContain('data_inicio=');
  });

  it('busca resumo com credentials include e trata erros amigavelmente', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      total: 4,
      abertas: 1,
      em_triagem: 1,
      em_andamento: 1,
      resolvidas: 1,
      canceladas: 0,
      indeferidas: 0,
      nao_localizadas: 0,
      por_prioridade: { normal: 2, alta: 2 },
      por_tipo_problema: { lampada_apagada: 4 }
    }));

    const success = await fetchRelatorioSolicitacoesResumo({
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30'
    });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    });
    expect(success.status).toBe('success');
    expect(success.summary.total).toBe(4);

    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));
    await expect(fetchRelatorioSolicitacoesResumo({})).resolves.toMatchObject({
      status: 'error',
      statusCode: 404,
      message: 'Relatorio indisponivel nesta versao. Verifique se a API interna foi atualizada.'
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));
    await expect(fetchRelatorioSolicitacoesResumo({
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30'
    })).resolves.toMatchObject({
      status: 'error',
      statusCode: 403,
      message: 'Relatorio indisponivel para este perfil.'
    });
  });

  it('exporta CSV com credentials include e sem dados sensiveis na URL', async () => {
    const blob = new Blob(['csv'], { type: 'text/csv' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-disposition': 'attachment; filename="relatorio_iluminacao_2026-06-01_2026-06-30.csv"'
      }),
      blob: async () => blob
    });

    const result = await fetchRelatorioSolicitacoesCsv({
      statusFilter: 'aberta',
      prioridadeFilter: 'normal',
      tipoFilter: 'lampada_apagada'
    });

    expect(fetchMock.mock.calls[0][0]).not.toContain('data_inicio=');
    expect(fetchMock.mock.calls[0][0]).not.toContain('data_fim=');
    expect(fetchMock.mock.calls[0][0]).not.toContain('nome_solicitante');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/csv'
      }
    });
    expect(result).toMatchObject({
      status: 'success',
      statusCode: 200,
      filename: 'relatorio_iluminacao_2026-06-01_2026-06-30.csv'
    });
  });
});

describe('internal coordenadas e rota', () => {
  it('aceita coordenada numerica valida e string numerica sanitizada', () => {
    expect(normalizeSolicitacaoCoordinate(-23.105, -55.225)).toEqual({
      latitude: -23.105,
      longitude: -55.225
    });
    expect(normalizeSolicitacaoCoordinate(' -23.105 ', ' -55.225 ')).toEqual({
      latitude: -23.105,
      longitude: -55.225
    });
  });

  it('rejeita coordenadas ausentes, fora da faixa ou arbitrarias', () => {
    expect(normalizeSolicitacaoCoordinate(null, -55.225)).toBeNull();
    expect(normalizeSolicitacaoCoordinate(-91, -55.225)).toBeNull();
    expect(normalizeSolicitacaoCoordinate(-23.105, -181)).toBeNull();
    expect(normalizeSolicitacaoCoordinate('abc', -55.225)).toBeNull();
    expect(normalizeSolicitacaoCoordinate(Number.NaN, -55.225)).toBeNull();
    expect(normalizeSolicitacaoCoordinate(-23.105, { lon: -55.225 })).toBeNull();
  });

  it('monta rota Google Maps somente com destino lat/lon', () => {
    const coordinate = normalizeSolicitacaoCoordinate(-23.105, -55.225);
    const url = buildInternalGoogleMapsRouteUrl(coordinate);

    expect(url).toContain('https://www.google.com/maps/dir/?api=1');
    expect(url).toContain('destination=-23.105000,-55.225000');
    expect(url).not.toContain('Nome');
    expect(url).not.toContain('Contato');
    expect(url).not.toContain('observacao');
  });

  it('renderiza link externo seguro quando existe coordenada valida', () => {
    const html = renderCoordinateRouteSection({
      hasCoordinates: true,
      coordinates: { latitude: -23.105, longitude: -55.225 },
      latitudeText: '-23.105000',
      longitudeText: '-55.225000',
      googleMapsRouteUrl: buildInternalGoogleMapsRouteUrl({
        latitude: -23.105,
        longitude: -55.225
      }),
      nomeSolicitante: 'Nome de Teste',
      contatoSolicitante: 'Contato de Teste',
      observacoesLocalizacao: 'Observacao interna de teste'
    });

    expect(html).toContain('data-google-maps-route');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('destination=-23.105000,-55.225000');
    expect(html).not.toContain('Nome de Teste');
    expect(html).not.toContain('Contato de Teste');
    expect(html).not.toContain('Observacao interna de teste');
  });

  it('nao renderiza link ativo sem coordenada valida', () => {
    const html = renderCoordinateRouteSection({
      hasCoordinates: false,
      coordinates: null
    });

    expect(html).toContain('Coordenada');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('data-google-maps-route');
  });
});

describe('internal modo manutencao', () => {
  it('classifica usuario operacional sem permissao administrativa', () => {
    expect(isMaintenanceLikeUser([readPermission, statusPermission])).toBe(true);
    expect(isMaintenanceLikeUser([readPermission, 'admin.usuarios.ler'])).toBe(false);
    expect(isMaintenanceLikeUser([statusPermission])).toBe(false);
  });

  it('renderiza listagem compacta para usuario manutencao sem datas completas', () => {
    const html = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, statusPermission])
    );

    expect(html).toContain('IP-2026-000009');
    expect(html).toContain('Aberta');
    expect(html).toContain('Lampada apagada');
    expect(html).toContain('Normal');
    expect(html).toContain('Aberta - Normal');
    expect(html).toContain('Poste 3405');
    expect(html).toContain('internal-maintenance-card');
    expect(html).not.toContain('Â·');
    expect(html).not.toContain('Criado em');
    expect(html).not.toContain('Atualizado em');
    expect(html).not.toContain('Duplicidade');
  });

  it('oculta status terminal da listagem de manutencao', () => {
    const html = renderSolicitacoesPanel({
      sessionState: 'authenticated',
      permissions: [readPermission, statusPermission],
      solicitacoes: {
        status: 'ready',
        items: [
          listItem(),
          listItem({
            id: 11,
            protocolo: 'IP-2026-000010',
            status: 'Resolvida',
            statusKey: 'Resolvida',
            prioridade: 'Normal'
          }),
          listItem({
            id: 12,
            protocolo: 'IP-2026-000011',
            status: 'Não localizado',
            statusKey: 'Não localizado',
            prioridade: 'Alta'
          })
        ],
        total: 3,
        limit: 20,
        offset: 0,
        message: 'Solicitacoes carregadas.'
      },
      detalhe: createDetalheState()
    });

    expect(html).toContain('IP-2026-000009');
    expect(html).not.toContain('IP-2026-000010');
    expect(html).not.toContain('IP-2026-000011');
    expect(html).toContain('1 ativo(s) nesta página');
  });

  it('mantem status terminal visivel para usuario administrativo', () => {
    const html = renderSolicitacoesPanel({
      sessionState: 'authenticated',
      permissions: [readPermission, 'admin.usuarios.ler'],
      solicitacoes: {
        status: 'ready',
        items: [
          listItem({
            id: 11,
            protocolo: 'IP-2026-000010',
            status: 'Resolvida',
            statusKey: 'resolvida',
            prioridade: 'Normal'
          })
        ],
        total: 1,
        limit: 20,
        offset: 0,
        message: 'Solicitacoes carregadas.'
      },
      detalhe: createDetalheState()
    });

    expect(html).toContain('IP-2026-000010');
    expect(html).toContain('Resolvida');
    expect(html).toContain('1 registro(s)');
  });

  it('mantem visual completo para usuario administrativo', () => {
    const html = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, 'admin.usuarios.ler'])
    );

    expect(html).not.toContain('internal-maintenance-card');
    expect(html).toContain('Criado em');
    expect(html).toContain('Atualizado em');
    expect(html).toContain('Duplicidade');
  });

  it('exibe rota na listagem apenas com coordenada valida e sem dados pessoais', () => {
    const html = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, statusPermission], {
        nomeSolicitante: 'Pessoa Teste',
        contatoSolicitante: '(67) 99999-0000',
        descricao: 'Descricao pessoal de teste'
      })
    );

    expect(html).toContain('data-list-google-maps-route');
    expect(html).toContain('Traçar rota');
    expect(html).not.toContain('TraÃ');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('destination=-23.105000,-55.225000');
    expect(html).not.toContain('Pessoa Teste');
    expect(html).not.toContain('99999-0000');
    expect(html).not.toContain('Descricao pessoal de teste');

    const withoutCoordinateHtml = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, statusPermission], {
        hasCoordinates: false,
        coordinates: null
      })
    );

    expect(withoutCoordinateHtml).not.toContain('data-list-google-maps-route');
  });

  it('exibe alteracao rapida de fase apenas com permissao de status', () => {
    const withoutPermission = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission])
    );
    const withPermission = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, statusPermission])
    );

    expect(withoutPermission).not.toContain('data-list-status-form');
    expect(withPermission).toContain('data-list-status-form');
    expect(withPermission).toContain('Alterar fase');
    expect(withPermission).toContain('Informe o motivo da alteração');
    expect(withPermission).not.toContain('alteraÃ');
  });

  it('exibe observacao rapida na listagem apenas com permissao de comentar', () => {
    const withoutPermission = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, statusPermission])
    );
    const withPermission = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, statusPermission, commentPermission])
    );

    expect(withoutPermission).not.toContain('data-list-observacao-form');
    expect(withPermission).toContain('data-list-observacao-form');
    expect(withPermission).toContain('Registrar observação');
    expect(withPermission).toContain('potência da lâmpada');
  });

  it('filtra menu de modulos para usuario manutencao e mantem completo para admin', () => {
    const maintenanceMenu = renderModuleMenu(
      authenticatedState([readPermission, statusPermission, commentPermission])
    );
    const adminMenu = renderModuleMenu(
      authenticatedState([readPermission, 'admin.usuarios.ler', dashboardPermission])
    );

    expect(maintenanceMenu).toContain('Ilumina');
    expect(maintenanceMenu).not.toContain('data-module-key="inicio"');
    expect(maintenanceMenu).not.toContain('Dashboard');
    expect(maintenanceMenu).not.toContain('Planejado');
    expect(maintenanceMenu).not.toContain('Permitido');
    expect(maintenanceMenu).not.toContain('Restrito');
    expect(adminMenu).toContain('Dashboard');
    expect(adminMenu).not.toContain('Inicio');
    expect(adminMenu).toContain('Administra');
    expect(adminMenu).toContain('Planejado');
  });

  it('monta URL da listagem ativa somente quando solicitado', () => {
    const maintenanceUrl = buildSolicitacoesUrl(0, { ativos: true });
    const adminUrl = buildSolicitacoesUrl(20, { ativos: false });

    expect(maintenanceUrl).toBe(
      '/api/internal/iluminacao/solicitacoes?limit=20&offset=0&ativos=true'
    );
    expect(adminUrl).toBe(
      '/api/internal/iluminacao/solicitacoes?limit=20&offset=20'
    );
  });

  it('chama listagem com ativos true para manutencao e sem filtro para admin', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, {
        items: [],
        limit: 20,
        offset: 0,
        total: 0
      }));

    await fetchSolicitacoesInternas(0, { ativos: true });
    await fetchSolicitacoesInternas(0, { ativos: false });

    expect(fetchMock.mock.calls[0][0]).toContain('ativos=true');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include'
    });
    expect(fetchMock.mock.calls[1][0]).not.toContain('ativos=');
  });

  it('mantem controle de prioridade oculto na listagem sem permissao especifica', () => {
    const html = renderSolicitacoesPanel(
      solicitacoesReadyState([readPermission, statusPermission])
    );

    expect(html).not.toContain('data-prioridade-form');
    expect(html).not.toContain('Atualizar prioridade');
  });

  it('mantem formulario de observacao oculto sem permissao de comentar', () => {
    const detail = loadedDetail();
    const html = renderObservacoesPanel(
      authenticatedState(['iluminacao.solicitacoes.ver_observacoes']),
      detail
    );

    expect(html).not.toContain('data-observacao-form');
    expect(html).toContain('Cria');
  });

  it('mantem controles de status e prioridade ocultos sem permissoes especificas', () => {
    const detail = loadedDetail();
    const statusHtml = renderStatusUpdatePanel(authenticatedState(), detail);
    const prioridadeHtml = renderPriorityUpdatePanel(authenticatedState(), detail);

    expect(statusHtml).not.toContain('data-status-form');
    expect(prioridadeHtml).not.toContain('data-prioridade-form');
  });

  it('renderiza formularios operacionais quando as permissoes existem', () => {
    const detail = loadedDetail();
    const observacoesHtml = renderObservacoesPanel(
      authenticatedState([
        'iluminacao.solicitacoes.ver_observacoes',
        commentPermission
      ]),
      detail
    );
    const statusHtml = renderStatusUpdatePanel(
      authenticatedState([statusPermission]),
      detail
    );
    const prioridadeHtml = renderPriorityUpdatePanel(
      authenticatedState([prioridadePermission]),
      detail
    );

    expect(observacoesHtml).toContain('data-observacao-form');
    expect(statusHtml).toContain('data-status-form');
    expect(prioridadeHtml).toContain('data-prioridade-form');
  });

  it('permite selecionar Em execucao como alteracao normal quando o status atual e aberta', () => {
    const detail = loadedDetail({
      statusKey: 'aberta'
    });
    const statusHtml = renderStatusUpdatePanel(
      authenticatedState([statusPermission]),
      detail
    );

    expect(statusHtml).toContain('Em triagem');
    expect(statusHtml).toContain('Em execu');
  });

  it('renderiza WhatsApp somente no detalhe com contato valido', () => {
    expect(buildInternalWhatsappUrl('(67) 99999-0000')).toBe(
      'https://wa.me/5567999990000'
    );
    expect(buildInternalWhatsappUrl('abc')).toBeNull();

    const detail = loadedDetail({
      protocolo: 'IP-2026-000009',
      contatoSolicitante: '(67) 99999-0000',
      nomeSolicitante: 'Pessoa Teste',
      descricao: 'Descricao de teste'
    });
    const html = renderSolicitacaoDetailLoaded(
      authenticatedState([readPermission]),
      detail
    );

    expect(html).toContain('data-internal-whatsapp');
    expect(html).toContain('https://wa.me/5567999990000');
    expect(html).not.toContain('https://wa.me/5567999990000?text=');

    const invalidDetail = loadedDetail({
      contatoSolicitante: 'sem telefone'
    });
    const invalidHtml = renderSolicitacaoDetailLoaded(
      authenticatedState([readPermission]),
      invalidDetail
    );

    expect(invalidHtml).not.toContain('data-internal-whatsapp');
  });
});

describe('internal admin MVP', () => {
  function adminPanelState(permissions = [adminUsersReadPermission], overrides = {}) {
    return createSessionState({
      sessionState: 'authenticated',
      permissions,
      activeModule: 'admin',
      admin: createAdminState({
        usersStatus: 'ready',
        users: [{ id: 1, login: 'admin.producao', nome: 'Admin Producao', email: '', ativo: true, bloqueado: false, criadoEm: '' }],
        selectedUserId: 1,
        detailStatus: 'ready',
        user: { id: 1, login: 'admin.producao', nome: 'Admin Producao', email: '', ativo: true, bloqueado: false, criadoEm: '' },
        userProfilesStatus: 'ready',
        userProfiles: [{ perfilId: 1, id: 1, chave: 'administrador-interno-geoportal', nome: 'Administrador', modulo: null, ativo: true, criadoEm: '' }],
        availableProfilesStatus: 'ready',
        availableProfiles: [{ id: 2, perfilId: 2, chave: 'manutencao-iluminacao', nome: 'Manutencao', modulo: null, ativo: true, criadoEm: '' }],
        ...overrides.admin
      }),
      ...overrides
    });
  }

  it('mostra Administracao no menu para usuario com permissao admin', () => {
    const html = renderModuleMenu(adminPanelState([adminUsersReadPermission]));

    expect(html).toContain('data-module-key="admin"');
    expect(html).toContain('Administra');
    expect(html).toContain('Gestão interna de usuários e perfis');
    expect(html).toContain('Permitido');
    expect(html).toMatch(/data-module-key="admin"[\s\S]*?>/);
    expect(html.match(/data-module-key="admin"[\s\S]*?>/)?.[0]).not.toContain('disabled');
  });

  it('resolve modulo admin quando so ha permissao administrativa', () => {
    const state = adminPanelState([adminUsersReadPermission], { activeModule: 'admin' });

    expect(resolveInitialActiveModule(state)).toBe('admin');
  });

  it('abre painel de Administracao ao selecionar o modulo admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { usuarios: [{ id: 1, login: 'admin.producao', nome: 'Admin', ativo: true, bloqueado: false }] })
    );
    const root = {
      innerHTML: '',
      querySelector: vi.fn(() => null)
    };

    await selectModule(root, adminPanelState([adminUsersReadPermission], { activeModule: 'dashboard' }), 'admin');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/internal/admin/users');
    expect(root.innerHTML).toContain('internal-admin-workspace');
    expect(root.innerHTML).toContain('Usuários internos');
    expect(root.innerHTML).toContain('aria-current="page"');
  });
  it('carrega detalhe e vínculos ao selecionar usuário', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { usuario: { id: 2, login: 'manutencao.producao', nome: 'Manutenção Produção', ativo: true, bloqueado: false } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { vinculos: [{ perfil_id: 2, chave: 'manutencao-iluminacao', nome: 'Manutenção', ativo: true }] }));
    const root = { innerHTML: '', querySelector: vi.fn(() => null) };

    await loadAdminUser(root, adminPanelState([adminUsersReadPermission]), 2);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/internal/admin/users/2',
      '/api/internal/admin/users/2/profiles'
    ]);
    expect(fetchMock.mock.calls.every((call) => call[1].credentials === 'include')).toBe(true);
    expect(root.innerHTML).toContain('Manutenção Produção');
    expect(root.innerHTML).toContain('manutencao-iluminacao');
  });

  it('botão Atualizar recarrega lista, detalhe e vínculos do usuário selecionado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { usuarios: [{ id: 1, login: 'admin.producao', nome: 'Admin Atualizado', ativo: true, bloqueado: false }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { usuario: { id: 1, login: 'admin.producao', nome: 'Admin Atualizado', ativo: true, bloqueado: false } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { vinculos: [{ perfil_id: 1, chave: 'administrador-interno-geoportal', nome: 'Administrador', ativo: true }] }));
    const root = { innerHTML: '', querySelector: vi.fn(() => null) };

    await refreshAdminPanel(root, adminPanelState([adminUsersReadPermission]));

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/internal/admin/users',
      '/api/internal/admin/users/1',
      '/api/internal/admin/users/1/profiles'
    ]);
    expect(root.innerHTML).toContain('Admin Atualizado');
    expect(root.innerHTML).toContain('administrador-interno-geoportal');
  });

  it('desbloqueio aparece somente para usuário bloqueado com permissão', () => {
    const activeHtml = renderAdminPanel(adminPanelState([adminUsersReadPermission, adminUsersBlockPermission]));
    const blockedHtml = renderAdminPanel(adminPanelState([adminUsersReadPermission, adminUsersBlockPermission], {
      admin: {
        user: { id: 1, login: 'admin.producao', nome: 'Admin Produção', email: '', ativo: true, bloqueado: true, criadoEm: '' },
        users: [{ id: 1, login: 'admin.producao', nome: 'Admin Produção', email: '', ativo: true, bloqueado: true, criadoEm: '' }]
      }
    }));
    const blockedWithoutPermission = renderAdminPanel(adminPanelState([adminUsersReadPermission], {
      admin: {
        user: { id: 1, login: 'admin.producao', nome: 'Admin Produção', email: '', ativo: true, bloqueado: true, criadoEm: '' }
      }
    }));

    expect(activeHtml).toContain('data-admin-block-user-form');
    expect(activeHtml).not.toContain('data-admin-unblock-user-form');
    expect(blockedHtml).toContain('data-admin-unblock-user-form');
    expect(blockedHtml).toContain('Desbloquear usuário');
    expect(blockedHtml).not.toContain('data-admin-block-user-form');
    expect(blockedWithoutPermission).not.toContain('data-admin-unblock-user-form');
  });

  it('desbloqueio envia header interno e cookie de sessão', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { usuario: { id: 1, login: 'admin.producao', nome: 'Admin Produção', ativo: true, bloqueado: false } })
    );

    const result = await fetchUnblockAdminUser(1);

    expect(result).toMatchObject({ status: 'success' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/internal/admin/users/1/unblock');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(fetchMock.mock.calls[0][1].headers[INTERNAL_MUTATING_REQUEST_HEADER]).toBe('1');
  });
  it('pesquisa filtra usuários por nome e login', () => {
    const htmlByName = renderAdminPanel(adminPanelState([adminUsersReadPermission], {
      admin: {
        userSearchQuery: 'manutenção',
        users: [
          { id: 1, login: 'admin.producao', nome: 'Admin Produção', email: '', ativo: true, bloqueado: false, criadoEm: '' },
          { id: 2, login: 'manutencao.producao', nome: 'Manutenção Produção', email: '', ativo: true, bloqueado: false, criadoEm: '' }
        ]
      }
    }));
    const htmlByLogin = renderAdminPanel(adminPanelState([adminUsersReadPermission], {
      admin: {
        userSearchQuery: 'admin.producao',
        users: [
          { id: 1, login: 'admin.producao', nome: 'Admin Produção', email: '', ativo: true, bloqueado: false, criadoEm: '' },
          { id: 2, login: 'manutencao.producao', nome: 'Manutenção Produção', email: '', ativo: true, bloqueado: false, criadoEm: '' }
        ]
      }
    }));

    expect(htmlByName).toContain('Manutenção Produção');
    expect(htmlByName).not.toContain('Admin Produção</strong>');
    expect(htmlByLogin).toContain('Admin Produção');
    expect(htmlByLogin).not.toContain('Manutenção Produção</strong>');
  });

  it('pesquisa filtra usuários por e-mail', () => {
    const html = renderAdminPanel(adminPanelState([adminUsersReadPermission], {
      admin: {
        userSearchQuery: 'fiscalizacao@amambai.ms.gov.br',
        users: [
          { id: 1, login: 'admin.producao', nome: 'Admin Produção', email: 'admin@amambai.ms.gov.br', ativo: true, bloqueado: false, criadoEm: '' },
          { id: 2, login: 'fiscal.producao', nome: 'Fiscalização Produção', email: 'fiscalizacao@amambai.ms.gov.br', ativo: true, bloqueado: false, criadoEm: '' }
        ]
      }
    }));

    expect(html).toContain('Fiscalização Produção');
    expect(html).toContain('fiscal.producao');
    expect(html).not.toContain('Admin Produção</strong>');
  });
  it('não mostra todos os usuários quando a pesquisa está vazia', () => {
    const users = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      login: `usuario${index + 1}.producao`,
      nome: `Usuário ${index + 1}`,
      email: '',
      ativo: true,
      bloqueado: false,
      criadoEm: ''
    }));
    const html = renderAdminPanel(adminPanelState([adminUsersReadPermission], {
      admin: { userSearchQuery: '', users }
    }));

    expect(html).toContain('Pesquisar usuário');
    expect(html).toContain('Digite para filtrar');
    expect(html).toContain('Usuário 1');
    expect(html).toContain('Usuário 6');
    expect(html).not.toContain('Usuário 7');
    expect(html).not.toContain('Usuário 8');
  });

  it('mantém textos principais com acentuação correta', () => {
    const html = renderAdminPanel(adminPanelState([adminUsersReadPermission, adminProfilesReadPermission, adminUsersCreatePermission]));

    expect(html).toContain('Administração');
    expect(html).toContain('Gestão interna de usuários e vínculos usuário/perfil.');
    expect(html).toContain('Usuários internos');
    expect(html).toContain('Pesquisar usuário');
    expect(html).toContain('Criar usuário');
    expect(html).toContain('Vínculos usuário/perfil');
    expect(html).toContain('Desativação lógica');
    expect(html).not.toMatch(/Ã|Â/);
  });
  it('lista usuarios com cookie de sessao', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { usuarios: [{ id: 1, login: 'admin.producao', nome: 'Admin', ativo: true, bloqueado: false }] })
    );

    const result = await fetchAdminUsers();

    expect(result).toMatchObject({ status: 'ready' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/internal/admin/users');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('envia header mutavel nas mutacoes administrativas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { usuario: { id: 3, login: 'novo', nome: 'Novo', ativo: true, bloqueado: false } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await fetchCreateAdminUser({ login: 'novo', nome: 'Novo', email: null, senha_inicial: 'Senha123' });
    await fetchResetAdminUserPassword(3, 'Outra123', 'Outra123');
    await fetchDeactivateAdminUserProfile(3, 2, '', 'Justificativa segura');

    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ credentials: 'include' });
      expect(call[1].headers[INTERNAL_MUTATING_REQUEST_HEADER]).toBe('1');
    }
  });

  it('nao exibe desativacao de vinculo sem permissao de remover perfis', () => {
    const html = renderAdminPanel(adminPanelState([adminUsersReadPermission, adminProfilesReadPermission, adminUsersCreatePermission]));

    expect(html).toContain('Vínculos usuário/perfil');
    expect(html).not.toContain('data-admin-deactivate-profile-form');
  });

  it('exibe desativacao de vinculo com permissao propria', () => {
    const html = renderAdminPanel(adminPanelState([
      adminUsersReadPermission,
      adminProfilesReadPermission,
      adminUsersRemoveProfilesPermission
    ]));

    expect(html).toContain('data-admin-deactivate-profile-form');
  });

  it('nao retorna senha em resultados de criacao ou reset', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { usuario: { id: 4, login: 'novo', nome: 'Novo', ativo: true, bloqueado: false } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const createResult = await fetchCreateAdminUser({ login: 'novo', nome: 'Novo', email: null, senha_inicial: 'Senha123' });
    const resetResult = await fetchResetAdminUserPassword(4, 'Outra123', 'Outra123');

    expect(JSON.stringify(createResult)).not.toContain('Senha123');
    expect(JSON.stringify(resetResult)).not.toContain('Outra123');
  });

  it('traduz erros administrativos esperados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    await expect(fetchAdminUsers()).resolves.toMatchObject({ status: 'expired', statusCode: 401 });

    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));
    await expect(fetchCreateAdminUser({ login: 'a', nome: 'A', senha_inicial: 'Senha123' })).resolves.toMatchObject({ status: 'error', statusCode: 403 });

    fetchMock.mockResolvedValueOnce(jsonResponse(409, {}));
    await expect(fetchDeactivateAdminUserProfile(1, 2, '', 'Justificativa segura')).resolves.toMatchObject({ status: 'error', statusCode: 409, message: 'Vínculo já está inativo.' });

    fetchMock.mockResolvedValueOnce(jsonResponse(422, {}));
    await expect(fetchResetAdminUserPassword(1, 'x', 'x')).resolves.toMatchObject({ status: 'error', statusCode: 422 });
  });

  it('rotinas admin nao usam storage do navegador', () => {
    expect(fetchAdminUsers.toString()).not.toContain('localStorage');
    expect(fetchAdminUsers.toString()).not.toContain('sessionStorage');
    expect(fetchCreateAdminUser.toString()).not.toContain('localStorage');
    expect(fetchResetAdminUserPassword.toString()).not.toContain('sessionStorage');
    expect(fetchUnblockAdminUser.toString()).not.toContain('localStorage');
    expect(fetchUnblockAdminUser.toString()).not.toContain('sessionStorage');
    expect(renderAdminPanel.toString()).not.toContain('localStorage');
    expect(renderAdminPanel.toString()).not.toContain('sessionStorage');
  });
});