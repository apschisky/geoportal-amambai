# Requisitos do Modulo de Iluminacao Publica

## 1. Objetivo

Este documento consolida os requisitos minimos da primeira versao do modulo de Iluminacao Publica / Manutencao de Postes, antes de qualquer implementacao em banco, API ou painel interno.

O objetivo e transformar as decisoes preliminares registradas no checklist de validacao operacional em uma base clara para revisao, homologacao e evolucao gradual, sem interromper o Geoportal publico em producao.

## 2. Principios do modulo

- Preservar o Geoportal publico funcionando.
- Desenvolver primeiro em homologacao.
- Manter Google Forms como fallback ate estabilidade comprovada.
- Nao expor dados pessoais no mapa publico.
- Aplicar menor privilegio.
- Auditar acoes internas.
- Validar permissoes no servidor.
- Evitar complexidade excessiva na primeira versao.
- Priorizar protocolo, status, mapa operacional, historico e rastreabilidade.

## 3. Escopo da primeira versao

- Solicitacao publica de reparo a partir do Geoportal.
- Captura do ID do poste e coordenada.
- Campo de tipo de problema.
- Descricao.
- Ponto de referencia.
- Indicacao de poste mais proximo quando o cidadao nao localizar o poste correto.
- Geracao de protocolo.
- Consulta publica simples por protocolo.
- Painel interno com lista de solicitacoes.
- Mapa operacional.
- Alteracao de status.
- Historico/auditoria.
- Filtros basicos.
- Indicadores simples.

## 4. Fora do escopo inicial

- Aplicativo mobile dedicado.
- Login do cidadao.
- Upload publico de foto na primeira versao.
- Integracao automatica com WhatsApp/e-mail.
- Ordens de servico complexas.
- Custos detalhados.
- Integracao automatica com almoxarifado.
- Retirada imediata do Google Forms.
- Exposicao de dados pessoais no mapa publico.
- Automacoes avancadas antes da estabilizacao.

## 5. Fluxo operacional minimo

1. Cidadao acessa o Geoportal.
2. Cidadao clica em um poste ou acessa a solicitacao de reparo.
3. Sistema leva ID do poste e coordenada quando possivel.
4. Cidadao informa tipo de problema, descricao e ponto de referencia.
5. Caso nao encontre o poste correto, informa o poste mais proximo ou referencia.
6. Sistema gera protocolo.
7. Solicitacao entra como Aberta.
8. Equipe/atendente faz triagem.
9. Solicitacao pode ser encaminhada, indeferida, cancelada, marcada como nao localizada ou aguardando material.
10. Equipe executa o servico.
11. Equipe/gestor/admin finaliza.
12. Cidadao consulta andamento basico pelo protocolo.
13. Gestor acompanha mapa e indicadores.

A triagem pode ser feita pela equipe de manutencao junto com secretario ou chefe de setor.

## 6. Status da solicitacao

Status preliminares:

- Aberta
- Em triagem
- Encaminhada
- Em execucao
- Aguardando material
- Nao localizado
- Resolvida
- Indeferida
- Cancelada

Regras:

- "Cancelada" pode ser usada para falso chamado ou duplicidade evidente.
- "Indeferida" pode ser usada quando nao houver seguranca para executar ou quando a solicitacao nao for de competencia do setor.
- "Nao localizado" deve ser usado quando o poste/problema nao for encontrado.
- "Aguardando material" deve indicar pendencia de insumos.
- Finalizacao pode ser feita pela equipe responsavel, gestor ou administrador.

## 7. Tipos de problema

Tipos iniciais:

- Lampada apagada
- Lampada piscando
- Lampada acesa durante o dia
- Poste danificado
- Braco/luminaria danificada
- Fiacao aparente
- Outro

Observacoes:

- Casos envolvendo seguranca publica, transito, risco a populacao ou risco a equipe podem receber prioridade alta.
- Foto pode ser recomendada em situacoes graves, mas nao deve ser obrigatoria no formulario publico da primeira versao.

## 8. Campos do formulario publico

Campos minimos:

- `poste_id`
- `coordenada`
- `tipo_problema`
- `descricao`
- `ponto_referencia`
- `poste_proximo_informado`
- `nome_solicitante` opcional
- `contato_solicitante` opcional

Regras:

- Nome nao obrigatorio.
- Contato nao obrigatorio.
- Contato pode ajudar se o poste nao for localizado.
- Foto publica nao entra na primeira versao.
- Descricao deve ter limite de tamanho.
- Entrada deve ser validada no servidor.
- Campos vindos do Geoportal nao devem ser aceitos cegamente sem validacao pela API.

Mensagem sugerida ao cidadao:

> Solicitacao realizada. Protocolo no IP-AAAA-NNNNNN.

## 9. Protocolo

Formato preliminar:

- `IP-AAAA-NNNNNN`
- Exemplo: `IP-2026-000001`

Requisitos:

- Deve conter prefixo do servico.
- Deve conter ano.
- Deve ser exibido apos envio.
- Deve permitir consulta publica sem login.
- Deve ter protecao contra enumeracao.
- Endpoint publico deve ter rate limit.
- Envio futuro por WhatsApp/e-mail pode ser avaliado, mas nao e obrigatorio na primeira versao.

Perguntas tecnicas a resolver antes da implementacao:

- O sequencial sera global por ano ou por modulo?
- O protocolo sera gerado no banco ou na API?
- Como evitar colisao em requisicoes simultaneas?
- Qual mensagem publica sera exibida para protocolo inexistente sem facilitar enumeracao?

## 10. Consulta publica por protocolo

Retorno publico permitido:

- protocolo
- status publico
- data de abertura
- ultima atualizacao
- mensagem simples

Nao retornar:

- nome do solicitante;
- contato;
- historico interno completo;
- observacoes internas;
- usuario responsavel;
- anexos internos;
- detalhes tecnicos do banco/API.

Perguntas para validacao:

- A consulta publica deve mostrar previsao de atendimento no futuro?
- Quais status internos devem ser agrupados em mensagens publicas mais simples?

## 11. Dados pessoais e LGPD

Requisitos:

- Coletar o minimo necessario.
- Nome e contato sao opcionais.
- Dados pessoais nao aparecem no mapa publico.
- Dados pessoais so podem ser acessados por perfis autorizados.
- Registrar finalidade da coleta.
- Evitar exportacao indiscriminada.
- Definir retencao minima.

Decisao preliminar:

- Dados pessoais devem ficar armazenados pelo menor tempo necessario, inicialmente ate a finalizacao do chamado, sujeito a validacao juridica/LGPD.

Perguntas para validacao juridica:

- Qual prazo oficial de retencao?
- O cidadao pode solicitar atendimento anonimo?
- O texto do formulario precisa de aceite/ciencia de finalidade?
- Quem e responsavel por responder solicitacoes de acesso/remocao de dados?

## 12. Perfis e permissoes

Perfis iniciais:

- Atendente/Triagem
- Equipe de Campo
- Gestor do Modulo
- Administrador
- Auditor/Consulta

Decisoes preliminares:

- Atendente/Triagem e Equipe de Campo podem ser a mesma pessoa na primeira versao.
- Equipe de campo, gestor e administrador podem ver todas as solicitacoes.
- Equipe de campo, gestor e administrador podem alterar status e finalizar.
- Gestor e administrador podem cancelar/indeferir.
- Equipe de campo, gestor e administrador podem anexar foto.
- Gestor e administrador podem ver dados pessoais.
- Administrador e auditor podem consultar auditoria.

| Acao | Atendente/Triagem | Equipe de Campo | Gestor | Administrador | Auditor |
|---|---|---|---|---|---|
| Listar solicitacoes | Sim | Sim | Sim | Sim | Limitado |
| Ver detalhe | Sim | Sim | Sim | Sim | Limitado |
| Ver dados pessoais | Nao | Nao | Sim | Sim | Nao |
| Alterar status | Sim | Sim | Sim | Sim | Nao |
| Finalizar | Nao | Sim | Sim | Sim | Nao |
| Cancelar/indeferir | Nao | Nao | Sim | Sim | Nao |
| Anexar foto | Nao | Sim | Sim | Sim | Nao |
| Ver auditoria | Nao | Nao | Nao | Sim | Sim |
| Gerenciar usuarios | Nao | Nao | Nao | Sim | Nao |

## 13. Painel interno

Requisitos minimos:

- Lista de solicitacoes.
- Filtros.
- Detalhe da solicitacao.
- Alteracao de status.
- Mapa operacional.
- Indicadores simples.

Filtros uteis:

- status;
- periodo;
- tipo de problema;
- prioridade;
- bairro/regiao;
- poste_id;
- protocolo.

Perguntas de UX:

- Quais colunas sao indispensaveis na lista?
- A tela inicial deve abrir em lista ou mapa?
- O setor precisa exportar CSV/PDF futuramente?
- O painel deve destacar atrasadas automaticamente?

## 14. Mapa operacional

Requisitos:

- Mostrar solicitacoes abertas no mapa.
- Mostrar cores por status.
- Permitir filtro por periodo.
- Indicar reincidencia por poste.
- Nao mostrar dados pessoais.
- Permitir abrir detalhe da solicitacao a partir do mapa.

Perguntas de avanco:

- Quais cores devem representar cada status?
- A reincidencia sera calculada por quantidade de chamados no mesmo poste em determinado periodo?
- Deve haver camada separada para solicitacoes atrasadas?
- O mapa interno deve usar GeoServer, API GeoJSON ou ambos?

## 15. Prazos e prioridade

Decisoes preliminares:

- Prazo ideal deve existir, mas pode nao ser formalizado no inicio.
- Existem solicitacoes urgentes.
- Prioridade alta para casos envolvendo seguranca publica ou transito.
- Alertar solicitacoes paradas ha mais de 15 dias.
- Prazo inicial para considerar atrasada: 15 dias.

Requisitos:

- Campo de prioridade.
- Calculo de dias parados.
- Indicador de atraso.
- Filtro de atrasadas.

Perguntas:

- O prazo de 15 dias vale para todos os tipos?
- Casos de seguranca devem ter prazo menor?
- Aguardando material pausa o prazo ou continua contando?
- "Nao localizado" encerra ou suspende o chamado?

## 16. Anexos e fotos

Decisoes preliminares:

- Cidadao nao envia foto na primeira versao.
- Equipe pode enviar foto antes/depois apenas em casos mais graves.
- Tipo inicial aceito: jpg.
- Tamanho maximo inicial: 5 MB.
- Equipe, gestor e administrador podem visualizar anexos.
- Upload publico pode ser adicionado em etapa futura.

Requisitos de seguranca:

- Validar extensao e MIME type.
- Limitar tamanho.
- Nao expor caminho fisico.
- Armazenar metadados.
- Planejar varredura antivirus.
- Controlar acesso por perfil.
- Registrar upload em auditoria.

Perguntas:

- Fotos internas devem ser obrigatorias em caso de poste danificado ou fiacao aparente?
- Onde os anexos serao armazenados na homologacao?
- Qual politica de retencao dos anexos?

## 17. Indicadores minimos

Indicadores iniciais:

- solicitacoes abertas;
- solicitacoes resolvidas;
- solicitacoes por tipo;
- solicitacoes por regiao;
- reincidencia por poste;
- atrasadas;
- tempo medio de atendimento.

Decisao preliminar:

- Relatorio/exportacao nao e necessario no inicio.
- Periodo de analise mais usado: semanal.

Perguntas:

- O gestor precisa de visao mensal alem da semanal?
- O indicador de tempo medio deve ignorar chamados cancelados/indeferidos?
- Como tratar chamados "Aguardando material"?

## 18. Integracao com Geoportal publico

Requisitos:

- Manter botao atual com Google Forms ate modulo proprio estar estavel.
- Substituicao deve ser gradual.
- Deve existir fallback para voltar ao Forms.
- Camada publica de postes continua sendo base visual.
- Integracao futura deve preservar popup, rota e busca de postes.
- Qualquer alteracao publica deve ser testada em homologacao antes de producao.

## 19. Integracao com API futura

Requisitos conceituais:

- Endpoints publicos para criar solicitacao e consultar protocolo.
- Endpoints internos autenticados para listar, detalhar, alterar status, anexar, finalizar e cancelar.
- Validacao no servidor.
- Rate limit nos endpoints publicos.
- Autenticacao e autorizacao nos endpoints internos.
- Auditoria em acoes internas.
- Respostas publicas sem dados sensiveis.

Referencia: `docs/API-ENDPOINTS-ILUMINACAO.md`.

## 20. Integracao com PostGIS futuro

Requisitos conceituais:

- Criar schema proprio do modulo, como `mod_iluminacao`.
- Nao gravar operacao em `web_map`.
- Solicitacoes devem referenciar `poste_id`.
- Dados pessoais nao devem aparecer em views publicas.
- Criar historico/auditoria.
- Criar indices por status, protocolo, `poste_id`, data e geometria.
- Criar views controladas para painel e, se necessario, visualizacao publica.

Referencia: `docs/POSTGIS-SCHEMA-PLAN.md`.

## 21. Seguranca minima obrigatoria

- HTTPS obrigatorio.
- Credenciais fora do Git.
- Sem superuser em aplicacao.
- Usuario do GeoServer somente leitura.
- Usuario da API com menor privilegio.
- Validacao de entrada.
- Rate limit.
- Logs e auditoria.
- Tratamento generico de erro publico.
- Protecao contra enumeracao de protocolo.
- Backups antes de migrations.
- Homologacao antes de producao.

## 22. Criterios para iniciar SQL/API em homologacao

- [ ] Requisitos minimos aprovados.
- [ ] Status aprovados.
- [ ] Tipos de problema aprovados.
- [ ] Campos publicos aprovados.
- [ ] Formato de protocolo aprovado.
- [ ] Permissoes aprovadas.
- [ ] Politica de dados pessoais validada.
- [ ] Politica de anexos definida.
- [ ] SRID operacional definido.
- [ ] Ambiente de homologacao definido.
- [ ] Estrategia de subdominio ou rota definida.
- [ ] Rollback definido.
- [ ] Fallback com Google Forms confirmado.

## 23. Perguntas pendentes para amadurecimento

- O modulo deve futuramente permitir avaliacao do atendimento pelo cidadao?
- A reincidencia por poste deve gerar alerta automatico?
- O painel deve indicar regioes com maior demanda?
- O sistema deve permitir planejamento preventivo de troca de lampadas?
- O modulo deve futuramente integrar inventario de luminarias, potencia, tipo de lampada e consumo estimado?
- O modulo deve futuramente integrar ordem de servico formal?
- O modulo deve futuramente permitir SLA por tipo de problema?
- O modulo deve futuramente publicar indicadores abertos, sem dados pessoais, para transparencia?
- O modulo deve futuramente integrar outros servicos urbanos no mesmo padrao?
- Quais dados podem ser abertos ao cidadao sem comprometer seguranca, privacidade ou operacao?

## 24. Relacao com documentos existentes

- `docs/MODULE-ILUMINACAO-PUBLICA.md`
- `docs/ILUMINACAO-VALIDATION-CHECKLIST.md`
- `docs/API-ENDPOINTS-ILUMINACAO.md`
- `docs/POSTGIS-SCHEMA-PLAN.md`
- `docs/AUTH-PERMISSIONS-PLAN.md`
- `docs/INTERNAL-DASHBOARD-UX.md`
- `docs/SQL-MIGRATION-PLAN.md`
- `docs/SECURITY-HARDENING-PLAN.md`
- `docs/DOCUMENTATION-GOVERNANCE.md`

## 25. Proximos passos

1. Revisar este documento com o setor responsavel.
2. Atualizar documentos relacionados caso haja mudanca.
3. Definir SRID operacional.
4. Definir homologacao.
5. Definir subdominio ou rota para API/painel interno.
6. Preparar primeira migration SQL apenas em homologacao.
7. Preparar prova de conceito FastAPI apenas em homologacao.
8. Testar sem alterar o Geoportal publico.
9. Integrar ao botao publico somente apos estabilidade e fallback definido.
