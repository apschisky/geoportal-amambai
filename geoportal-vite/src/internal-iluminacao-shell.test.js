import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INTERNAL_MUTATING_REQUEST_HEADER,
  buildInternalGoogleMapsRouteUrl,
  buildInternalWhatsappUrl,
  canUpdatePrioridade,
  createDetalheState,
  fetchUpdateSolicitacaoStatus,
  fetchUpdateSolicitacaoPrioridade,
  getPrioridadeFormValidationMessage,
  isMaintenanceLikeUser,
  normalizeSolicitacaoCoordinate,
  renderCoordinateRouteSection,
  renderModuleMenu,
  renderObservacoesPanel,
  renderPriorityUpdatePanel,
  renderSolicitacaoDetailLoaded,
  renderSolicitacoesPanel,
  renderStatusUpdatePanel
} from './internal-iluminacao-shell.js';

const prioridadePermission = 'iluminacao.solicitacoes.atualizar_prioridade';
const readPermission = 'iluminacao.solicitacoes.ler';
const commentPermission = 'iluminacao.solicitacoes.comentar';
const statusPermission = 'iluminacao.solicitacoes.atualizar_status';

function authenticatedState(permissions = []) {
  return {
    sessionState: 'authenticated',
    permissions
  };
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
    json: async () => payload
  };
}

afterEach(() => {
  vi.restoreAllMocks();
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
          status: 'em_triagem',
          atualizado_em: '2026-06-11T10:00:00Z',
          finalizado_em: null
        }
      })
    );

    const result = await fetchUpdateSolicitacaoStatus(
      10,
      'em_triagem',
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
      status: 'em_triagem',
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
      authenticatedState([readPermission, 'admin.usuarios.ler'])
    );

    expect(maintenanceMenu).toContain('Iluminação Pública');
    expect(maintenanceMenu).not.toContain('Início');
    expect(maintenanceMenu).not.toContain('Planejado');
    expect(maintenanceMenu).not.toContain('Permitido');
    expect(maintenanceMenu).not.toContain('Restrito');
    expect(adminMenu).toContain('Início');
    expect(adminMenu).toContain('Administração do Sistema');
    expect(adminMenu).toContain('Planejado');
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
