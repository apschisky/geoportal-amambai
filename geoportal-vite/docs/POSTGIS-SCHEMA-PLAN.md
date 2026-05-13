# Plano de Schema PostGIS para Modulos Internos

Este documento planeja a estrutura futura de schemas e tabelas PostGIS para modulos internos do Geoportal de Amambai. Ele nao executa alteracoes no banco e nao substitui um script SQL revisado.

## 1. Objetivo

Definir uma proposta inicial de organizacao de schemas, tabelas, views, permissoes, auditoria, geometria e anexos para os modulos internos, com foco inicial no modulo piloto de Iluminacao Publica / Manutencao de Postes.

Este plano deve ser validado antes de qualquer alteracao no banco de producao.

## 2. Principios de modelagem

- Separar dados publicos e operacionais.
- Aplicar menor privilegio.
- Manter tabelas operacionais fora do `web_map`.
- Publicar dados publicos apenas por views controladas.
- Planejar auditoria desde o inicio.
- Manter historico separado dos registros principais.
- Referenciar anexos, evitando armazenar arquivos diretamente na tabela principal quando possivel.
- Controlar e indexar geometrias.
- Evitar que tabelas internas sejam consumidas diretamente pelo front-end publico.
- Versionar scripts antes de qualquer criacao ou alteracao real.

## 3. Schemas propostos

- `web_map`: publicacao publica/GeoServer.
- `cadastro`: bases cadastrais e territoriais de referencia.
- `operacional`: dados operacionais compartilhados.
- `auth`: usuarios, perfis e permissoes, se armazenados no PostGIS.
- `auditoria`: logs e trilhas de auditoria.
- `mod_iluminacao`: modulo de iluminacao publica.
- `mod_alvaras`: futuro modulo de alvaras.
- `mod_viabilidade`: futuro modulo de viabilidade.
- `mod_meio_ambiente`: futuro modulo de meio ambiente.
- `mod_limpeza_lotes`: futuro modulo de limpeza de lotes.

Os nomes sao proposta inicial e devem ser validados com a equipe tecnica antes de implementacao.

## 4. Relacao com schemas existentes

Hoje foram identificados os schemas:

- `plano`;
- `web_map`;
- `public`;
- `topology`.

Leitura inicial:

- `plano` parece ser a base tecnica/editavel/autoritativa.
- `web_map` e usado para publicacao/sincronizacao.
- `public` contem extensoes e objetos gerais.
- `topology` contem objetos tecnicos do PostGIS Topology.

Modulos internos nao devem gravar diretamente em `web_map`. Tabelas operacionais devem ficar em schemas proprios, com views controladas quando alguma informacao precisar aparecer no Geoportal publico.

## 5. Modulo piloto: `mod_iluminacao`

Tabelas candidatas:

- `mod_iluminacao.solicitacoes`;
- `mod_iluminacao.solicitacao_historico`;
- `mod_iluminacao.solicitacao_anexos`;
- `mod_iluminacao.status_solicitacao`;
- `mod_iluminacao.tipo_problema`.

Esse schema deve concentrar dados operacionais do modulo de Iluminacao Publica / Manutencao de Postes.

## 6. Tabela `solicitacoes`

Campos conceituais:

- `id`;
- `protocolo`;
- `poste_id`;
- `geom`;
- `data_abertura`;
- `status_id`;
- `tipo_problema_id`;
- `descricao`;
- `ponto_referencia`;
- `poste_proximo_informado`;
- `solicitante_nome`;
- `solicitante_contato`;
- `prioridade`;
- `alerta_atraso` ou campo derivado equivalente;
- `dias_parado` ou calculo equivalente;
- `origem`;
- `data_ultima_atualizacao`;
- `data_conclusao`;
- `criado_por`;
- `atualizado_por`.

Diretrizes:

- Dados pessoais devem ser minimizados.
- `protocolo` deve ser unico.
- Protocolo sugerido: `IP-2026-000001`, com prefixo, ano e sequencial.
- `geom` deve ter SRID definido.
- `poste_id` deve referenciar o identificador publico do poste, sem depender diretamente da tabela publica.
- Criar indice espacial para `geom`.
- Criar indices por status, data e protocolo.
- Prazo inicial para alerta de atraso: 15 dias, preferencialmente calculado por view ou regra de aplicacao para evitar duplicidade desnecessaria.
- A tabela principal nao deve armazenar historico detalhado; historico fica em tabela propria.

## 7. Tabela `solicitacao_historico`

Campos conceituais:

- `id`;
- `solicitacao_id`;
- `data_evento`;
- `usuario_id`;
- `acao`;
- `status_anterior`;
- `status_novo`;
- `observacao`;
- `origem_ip`;
- `payload_resumo`.

Essa tabela e essencial para auditoria funcional do modulo. Ela deve registrar transicoes de status, encaminhamentos, observacoes relevantes e alteracoes importantes.

## 8. Tabela `solicitacao_anexos`

Campos conceituais:

- `id`;
- `solicitacao_id`;
- `nome_arquivo`;
- `caminho_arquivo`;
- `mime_type`;
- `tamanho_bytes`;
- `hash_arquivo`;
- `enviado_por`;
- `data_envio`.

Diretrizes:

- Arquivos nao devem ficar soltos sem rastreabilidade.
- Limitar tipo e tamanho.
- Preferir armazenamento controlado fora do banco, com metadados no banco.
- Registrar hash para verificacao de integridade.
- Avaliar antivirus/varredura antes de liberar upload em producao.

## 9. Tabelas de dominio

Tabelas:

- `mod_iluminacao.status_solicitacao`;
- `mod_iluminacao.tipo_problema`.

Campos conceituais:

- `id`;
- `codigo`;
- `nome`;
- `descricao`;
- `ativo`;
- `ordem`.

Essas tabelas evitam texto livre para status e tipo de problema, facilitando relatorios, filtros e auditoria.

Status iniciais validados preliminarmente:

- Aberta;
- Em triagem;
- Encaminhada;
- Em execucao;
- Aguardando material;
- Nao localizado;
- Resolvida;
- Indeferida;
- Cancelada.

Tipos de problema iniciais:

- Lampada apagada;
- Lampada piscando;
- Lampada acesa durante o dia;
- Poste danificado;
- Braco/luminaria danificada;
- Fiacao aparente;
- Outro.

## 10. Views publicas/controladas

Views sugeridas:

- `web_map.vw_iluminacao_status_publico`;
- `web_map.vw_iluminacao_mapa_publico`;
- `mod_iluminacao.vw_solicitacoes_internas`.

Diretrizes:

- Views publicas nao devem expor nome ou contato do cidadao.
- Views publicas devem mostrar apenas status agregado ou campos aprovados, como protocolo, status publico, datas e mensagem simples.
- Views internas podem conter dados operacionais, protegidas por permissao e API.
- GeoServer publico deve consumir preferencialmente views publicas, nao tabelas operacionais.

## 11. Permissoes de banco

Papeis conceituais:

- `geoportal_readonly`;
- `api_iluminacao`;
- `api_admin`;
- `geoserver_public`;
- `analista_interno`.

Diretrizes:

- GeoServer publico deve preferencialmente ler apenas views publicas.
- API deve ter permissao de escrita apenas no schema do modulo.
- Usuarios humanos nao devem usar conta da API.
- Evitar superuser em servicos.
- Revisar grants por schema, tabela, sequence e view.

## 12. Auditoria

Camadas de auditoria:

- auditoria funcional via `mod_iluminacao.solicitacao_historico`;
- auditoria tecnica futura em schema `auditoria`.

Registrar:

- usuario;
- acao;
- data/hora;
- IP/origem;
- mudancas de status;
- resumo de payload quando aplicavel.

Logs e historicos nao devem ser editaveis por usuarios comuns.

## 13. Geometria e SRID

- Definir SRID padrao antes da implementacao.
- Manter consistencia com camadas atuais.
- Criar indice GiST para geometria.
- Evitar misturar SRIDs sem transformacao controlada.
- Validar geometrias antes de gravar.
- Documentar se a geometria representa o poste, o ponto informado pelo cidadao ou a localizacao da ocorrencia.

## 14. Anexos

- Nao iniciar com upload irrestrito.
- Definir pasta/armazenamento.
- Restringir tipos de arquivo.
- Limitar tamanho.
- Considerar antivirus/varredura.
- Registrar hash e metadados.
- Controlar acesso por permissao.
- Evitar URL publica direta para anexos internos.

## 15. Estrategia de migracao

- Nunca criar direto em producao sem script revisado.
- Criar scripts versionados.
- Testar em homologacao.
- Fazer backup antes.
- Planejar rollback.
- Registrar versao do schema.
- Separar scripts de criacao, alteracao, carga inicial e rollback.
- Validar permissoes depois da migracao.

## 16. Lacunas antes de implementar

- Definir SRID.
- Validar campos com setor responsavel.
- Confirmar status oficiais a partir da validacao preliminar.
- Confirmar tipos de problema a partir da validacao preliminar.
- Definir politica de anexos.
- Definir papeis reais de banco.
- Definir ambiente de homologacao.
- Definir se autenticacao ficara no PostGIS ou fora dele.
- Definir padrao de protocolo.
- Validar retencao de dados pessoais, com sugestao inicial de manter ate a finalizacao do chamado.
- Confirmar regra de alerta de atraso, inicialmente 15 dias.
- Definir retencao de historico e anexos.
- Definir quais dados podem aparecer em views publicas.

## 17. Relacao com documentos existentes

Este plano complementa:

- `docs/MODULE-ILUMINACAO-PUBLICA.md`;
- `docs/INTERNAL-MODULES-ARCHITECTURE.md`;
- `docs/DATABASE-INVENTORY.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/LAYER-INVENTORY.md`.

## 18. Proximos documentos recomendados

- `docs/API-ARCHITECTURE.md`
- `docs/AUTH-PERMISSIONS-PLAN.md`
- futuro script SQL em pasta separada, somente apos aprovacao.
