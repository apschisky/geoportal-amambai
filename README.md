# Geoportal de Amambai - MS

Geoportal web municipal desenvolvido para Amambai/MS como parte de trabalho academico/TCC. O projeto evoluiu para uma arquitetura baseada em Vite, OpenLayers e JavaScript ES Modules, com integracao a servicos publicos WMS/WFS do GeoServer/PostGIS e, em paralelo, a um ambiente interno controlado para operacao municipal.

## Links principais

- Geoportal publico: `https://geoportal.amambai.ms.gov.br/`
- Area interna: `https://geoserver.amambai.ms.gov.br/interno/`
- API publica: `https://geoserver.amambai.ms.gov.br/api/`
- API interna: `https://geoserver.amambai.ms.gov.br/api/internal/`

## Estado atual do projeto

O projeto hoje opera com separacao entre ambiente publico e ambiente interno.

No publico, o Geoportal continua responsavel por mapa, camadas, busca, locais de interesse, rotas externas, geolocalizacao, impressao e fluxo publico de solicitacao de reparo.

No interno, o primeiro modulo validado e o de Iluminacao Publica, com:

- login e logout internos;
- sessao por cookie HttpOnly;
- `GET /api/internal/auth/me` com `authenticated`, `usuario_id`, `login`, `nome`, `perfis` e `permissoes`;
- listagem administrativa completa;
- listagem ativa para manutencao com `ativos=true`;
- detalhe da solicitacao;
- historico e observacoes sob demanda;
- criacao de observacao interna;
- alteracao normal de status;
- alteracao de prioridade operacional;
- coordenadas, rota Google Maps e mapa operacional simples no detalhe;
- relatorio administrativo sanitizado em CSV e resumo JSON.

## Funcionalidades publicas atuais

- Visualizacao de camadas tematicas via GeoServer.
- Mapas base.
- Painel de camadas.
- Barra publica com menus.
- Locais de interesse.
- Servicos.
- Busca por endereco, BIC, postes e imoveis/fazendas quando aplicavel.
- Popups informativos.
- Rotas externas via Google Maps.
- Farmacias com destaque de plantao.
- Postes com solicitacao de reparo via formulario externo provisoriamente mantido.
- Medicao de distancia e area.
- Geolocalizacao.
- Impressao.
- Legendas dinamicas.
- Layout responsivo/mobile.

## Estrutura principal

- `geoportal-vite/`: frontend atual do Geoportal e da shell interna.
- `geoportal-backend/`: backend FastAPI das APIs publica e interna.
- `geoportal-vite/docs/`: documentacao tecnica e operacional consolidada.
- `scripts/`: harnesses e rotinas operacionais versionadas.

## Como rodar localmente o frontend

Pre-requisito: Node.js instalado.

```bash
git clone https://github.com/apschisky/geoportal-amambai.git
cd geoportal-amambai/geoportal-vite
npm install
npm run dev
```

## Build do frontend

```bash
npm run build
```

A pasta `dist/` e gerada localmente e nao deve ser versionada.

## Testes do frontend

```bash
npm test
```

## Seguranca e dados sensiveis

- Nao versionar `.env`, backups, dumps SQL, credenciais, chaves, senhas, arquivos `.backup`, `.sql`, `.docx` ou dados internos.
- Endpoints WMS/WFS publicos do GeoServer aparecem no frontend porque sao necessarios ao funcionamento do Geoportal publico.
- O frontend interno nao armazena token em `localStorage` ou `sessionStorage`; a sessao usa cookie HttpOnly e a autorizacao real continua no backend.
- Evolucoes internas devem continuar passando por homologacao, backup, rollback e publicacao controlada, sem credenciais no Git.

## Documentacao

Os documentos tecnicos ficam em `geoportal-vite/docs/`, incluindo arquitetura, seguranca, deploy, runtime interno/publico, autenticacao/autorizacao, modulo interno de Iluminacao Publica, migracoes e governanca documental.

## Licenca

Este projeto esta licenciado sob a licenca Creative Commons Atribuicao 4.0 Internacional (CC BY 4.0).
