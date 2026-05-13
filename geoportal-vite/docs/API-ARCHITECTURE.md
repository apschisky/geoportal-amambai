# Arquitetura da API/FastAPI do Geoportal de Amambai

Este documento define a arquitetura futura da API/FastAPI para conectar o Geoportal publico, modulos internos, PostGIS operacional, autenticacao, permissoes e auditoria.

## 1. Objetivo

Planejar uma API segura, revisavel e gradual para os modulos internos do Geoportal/SIG Municipal, sem implementar codigo nesta etapa.

A API deve servir como camada controlada entre front-ends, paineis internos e banco PostGIS, evitando acesso direto a tabelas operacionais.

## 2. Papel da API na arquitetura

A API deve atuar como:

- camada de regras de negocio;
- barreira entre front-end publico/interno e banco;
- ponto unico de gravacao operacional;
- camada de validacao de entrada;
- camada de auditoria;
- protecao contra acesso direto a tabelas operacionais;
- integracao entre PostGIS, ambiente interno e Geoportal publico.

## 3. Separacao entre API publica e API interna

| Tipo | Acesso | Exemplos | Seguranca |
|---|---|---|---|
| Publica | Sem login ou com protecao leve | Criar solicitacao, consultar protocolo | Validacao, rate limit, dados minimos |
| Interna | Login obrigatorio | Listar solicitacoes, alterar status, anexar arquivos | Autenticacao, permissao, auditoria |

Endpoints publicos devem expor apenas o necessario. Endpoints internos devem exigir autenticacao, autorizacao e registro de auditoria.

## 4. Modulo piloto: Iluminacao Publica

Endpoints conceituais publicos:

- `POST /api/public/iluminacao/solicitacoes`
- `GET /api/public/iluminacao/protocolo/{protocolo}`

Endpoints conceituais internos:

- `GET /api/internal/iluminacao/solicitacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`
- `POST /api/internal/iluminacao/solicitacoes/{id}/anexos`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/finalizar`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/cancelar`

Estes endpoints sao apenas desenho conceitual. Nenhum codigo deve ser criado antes da validacao de schema, autenticacao, permissoes, auditoria e anexos.

## 5. Estrutura sugerida do projeto FastAPI

Organizacao conceitual:

```text
app/
  main.py
  core/
  db/
  auth/
  modules/
    iluminacao/
    alvaras/
    viabilidade/
    meio_ambiente/
    limpeza_lotes/
  shared/
  audit/
```

Finalidade:

- `main.py`: inicializacao da aplicacao e registro de rotas.
- `core/`: configuracoes, variaveis de ambiente, seguranca e inicializacao.
- `db/`: conexao, pool, transacoes e utilitarios de banco.
- `auth/`: login, tokens/sessoes, usuarios e permissoes.
- `modules/`: regras, rotas e schemas por modulo.
- `shared/`: utilitarios compartilhados, validadores e modelos comuns.
- `audit/`: registro e consulta de eventos de auditoria.

## 6. Banco de dados e conexao

- Usar usuario proprio da API.
- Guardar credenciais em variaveis de ambiente.
- Nunca hardcode de usuario, senha, host ou token.
- Usar pool de conexao.
- API com permissao minima.
- Separar leitura publica, escrita operacional e administracao.
- Evitar superuser em servicos.
- Registrar erros tecnicos em log interno, sem expor detalhes ao usuario.

## 7. Validacao de entrada

A API deve validar:

- schemas de entrada;
- campos obrigatorios;
- sanitizacao de texto;
- limites de tamanho;
- coordenadas;
- protocolo;
- anexos;
- tipos permitidos;
- valores enumerados;
- campos inesperados.

Entradas invalidas devem ser rejeitadas com mensagens simples e seguras.

## 8. Autenticacao e autorizacao

- Login obrigatorio para ambiente interno.
- Token ou sessao segura.
- Perfis por secretaria/modulo.
- Permissoes por acao.
- Endpoints internos sempre protegidos.
- Bloqueio/desativacao de usuarios desligados.
- Avaliacao futura de 2FA para perfis sensiveis.

Permissoes devem considerar acoes como visualizar, criar, editar, encaminhar, finalizar, anexar e excluir/cancelar.

## 9. Auditoria

Toda operacao interna relevante deve registrar:

- usuario;
- acao;
- data/hora;
- IP/origem;
- recurso alterado;
- status anterior e novo;
- resumo da alteracao;
- anexo enviado, quando houver.

Auditoria deve ser obrigatoria para mudancas de status, observacoes, anexos, finalizacao, cancelamento e alteracoes administrativas.

## 10. Tratamento de erros

- Erros tecnicos nao devem aparecer para o cidadao.
- Logs internos devem guardar detalhes suficientes para diagnostico.
- Respostas publicas devem ser simples.
- Usar codigos HTTP adequados.
- Evitar vazamento de stack trace.
- Evitar vazamento de SQL.
- Evitar vazamento de caminho de arquivo.
- Evitar vazamento de credenciais ou configuracoes internas.

## 11. Rate limit e protecao contra abuso

- Limitar criacao de solicitacoes publicas.
- Proteger consulta de protocolo.
- Evitar enumeracao de protocolos.
- Registrar tentativas suspeitas.
- Considerar CAPTCHA ou desafio leve se houver abuso.
- Bloquear anexos perigosos.
- Monitorar volume anormal por IP/origem.

## 12. CORS e origem permitida

- CORS restrito aos dominios oficiais.
- Nao usar wildcard em producao.
- Separar configuracao de desenvolvimento e producao.
- Permitir apenas metodos e headers necessarios.
- Revisar CORS antes de publicar endpoints internos.

## 13. Anexos

- Definir tipos permitidos.
- Definir tamanho maximo.
- Usar armazenamento controlado.
- Registrar hash.
- Considerar varredura antivirus.
- Proteger acesso por permissao.
- Nao expor caminho fisico.
- Nao servir anexo interno publicamente sem autorizacao.
- Registrar metadados no banco.

## 14. Integracao com Geoportal publico

- O Geoportal publico pode chamar endpoints publicos.
- Dados internos nao devem ser chamados diretamente pelo front-end publico.
- Visualizacoes publicas devem vir de views controladas ou endpoints publicos filtrados.
- Manter compatibilidade com GeoServer para camadas publicas.
- Fluxos publicos devem coletar apenas dados necessarios.

## 15. Integracao com ambiente interno

- Painel interno consome endpoints internos.
- Cada acao deve respeitar permissao.
- Filtros por status, data, bairro, tipo e prioridade.
- Relatorios e indicadores via endpoints especificos.
- Operacoes de escrita devem gerar auditoria.
- Dados pessoais e anexos devem respeitar permissao.

## 16. Seguranca operacional

- Logs estruturados.
- Backup planejado.
- Rollback planejado.
- Versionamento de API.
- Variaveis de ambiente.
- Segredos fora do Git.
- Ambiente de homologacao.
- HTTPS obrigatorio.
- Reverse proxy com Apache.
- Revisao de dependencias.
- Separacao clara entre desenvolvimento, homologacao e producao.

## 17. Estrategia de implantacao

1. API minima em homologacao.
2. Conexao segura com PostGIS.
3. Endpoint publico de criacao.
4. Endpoint de consulta de protocolo.
5. Login interno.
6. Listagem interna.
7. Atualizacao de status.
8. Auditoria.
9. Anexos.
10. Publicacao controlada.

Cada fase deve ter teste, revisao de permissao e possibilidade de rollback.

## 18. Criterios antes de implementar

- [ ] Schema validado.
- [ ] Autenticacao definida.
- [ ] Permissoes definidas.
- [ ] Endpoints desenhados.
- [ ] Politica de anexos definida.
- [ ] Estrategia de logs definida.
- [ ] Ambiente de homologacao pronto.
- [ ] Backup/rollback planejado.
- [ ] CORS planejado.
- [ ] Segredos definidos fora do codigo.

## 19. Relacao com documentos existentes

Este documento complementa:

- `docs/POSTGIS-SCHEMA-PLAN.md`;
- `docs/MODULE-ILUMINACAO-PUBLICA.md`;
- `docs/INTERNAL-MODULES-ARCHITECTURE.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/DATABASE-INVENTORY.md`;
- `docs/LAYER-INVENTORY.md`.

## 20. Proximos documentos recomendados

- `docs/AUTH-PERMISSIONS-PLAN.md`
- futuro `docs/API-ENDPOINTS-ILUMINACAO.md`
- futuro script SQL versionado
- futura prova de conceito FastAPI em homologacao
