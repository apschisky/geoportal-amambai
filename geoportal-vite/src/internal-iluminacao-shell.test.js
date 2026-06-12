import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INTERNAL_MUTATING_REQUEST_HEADER,
  buildInternalGoogleMapsRouteUrl,
  canUpdatePrioridade,
  createDetalheState,
  fetchUpdateSolicitacaoPrioridade,
  getPrioridadeFormValidationMessage,
  isMaintenanceLikeUser,
  normalizeSolicitacaoCoordinate,
  renderCoordinateRouteSection,
  renderObservacoesPanel,
  renderPriorityUpdatePanel,
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
});
