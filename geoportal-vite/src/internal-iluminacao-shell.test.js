import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INTERNAL_MUTATING_REQUEST_HEADER,
  canUpdatePrioridade,
  createDetalheState,
  fetchUpdateSolicitacaoPrioridade,
  getPrioridadeFormValidationMessage,
  renderPriorityUpdatePanel
} from './internal-iluminacao-shell.js';

const prioridadePermission = 'iluminacao.solicitacoes.atualizar_prioridade';

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
    expect(withoutPermission).toContain('Alteracao de prioridade indisponivel');
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
