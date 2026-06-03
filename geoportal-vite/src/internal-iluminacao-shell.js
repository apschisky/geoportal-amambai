import './internal-iluminacao-shell.css';

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

const nextSteps = [
  'Conectar login interno validado.',
  'Consumir listagem e filtros com sessao interna.',
  'Abrir detalhe, historico e observacoes.',
  'Habilitar criacao de observacao com permissao e header mutavel.',
  'Habilitar alteracao normal de status com auditoria.'
];

const outOfScope = [
  'correcao ou reversao administrativa de status',
  'saida de status terminal',
  'anexos e upload de fotos',
  'dashboard e estatisticas',
  'gestao de usuarios ou permissoes',
  'proxy, Apache ou producao interna'
];

function renderStatusOptions() {
  return statusOptions
    .map((status) => `<option value="${status}">${status}</option>`)
    .join('');
}

function renderList(items) {
  return items.map((item) => `<li>${item}</li>`).join('');
}

function renderInternalIluminacaoShell(root) {
  root.innerHTML = `
    <main class="internal-page" aria-labelledby="internal-page-title">
      <header class="internal-header">
        <div>
          <p class="internal-kicker">Area interna em homologacao</p>
          <h1 id="internal-page-title">Geoportal Interno - Iluminacao Publica</h1>
          <p class="internal-subtitle">
            Shell estrutural para a primeira tela minima. Nenhuma API interna e consumida nesta fase.
          </p>
        </div>
        <div class="internal-status-box" aria-label="Estado da fase">
          <span>Fase 1</span>
          <strong>Visual sem dados reais</strong>
        </div>
      </header>

      <section class="internal-alert" aria-label="Aviso de seguranca">
        <strong>Homologacao local:</strong>
        esta tela nao executa login real, nao manipula cookie ou token e nao realiza POST, PATCH ou chamadas ao runtime interno.
      </section>

      <section class="internal-login-preview" aria-labelledby="login-preview-title">
        <div>
          <h2 id="login-preview-title">Acesso interno</h2>
          <p>
            O login interno existente sera integrado em fase posterior. Este bloco apenas reserva o espaco da experiencia.
          </p>
        </div>
        <button type="button" disabled>Login real pendente</button>
      </section>

      <div class="internal-workspace">
        <aside class="internal-filters" aria-labelledby="filters-title">
          <h2 id="filters-title">Filtros planejados</h2>
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
              <h2>Solicitacoes</h2>
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

      <section class="internal-next" aria-labelledby="next-title">
        <article>
          <h2 id="next-title">Proximas integracoes</h2>
          <ol>${renderList(nextSteps)}</ol>
        </article>
        <article>
          <h2>Fora da Fase 1</h2>
          <ul>${renderList(outOfScope)}</ul>
        </article>
      </section>

      <footer class="internal-footer">
        Geoportal publico preservado. Runtime interno, proxy e producao interna permanecem fora desta shell inicial.
      </footer>
    </main>
  `;
}

const root = document.getElementById('internal-iluminacao-root');

if (root) {
  renderInternalIluminacaoShell(root);
}
