# Checklist de Maturidade do Geoportal Público de Amambai

Este checklist define criterios para consolidar o Geoportal publico como base estavel antes da implantacao de modulos internos, APIs operacionais, login e fluxos administrativos.

## 1. Objetivo

Garantir que o Geoportal publico esteja solido, previsivel e seguro antes de iniciar frentes mais pesadas, como FastAPI, autenticacao, paineis internos e modulos municipais operacionais.

O foco desta etapa e proteger a base publica: mapa, camadas, busca, popups, rotas, mobile, documentacao, testes e processo de publicacao.

## 2. Estado atual resumido

O Geoportal ja possui:

- [x] mapa publico em producao;
- [x] front-end com Vite, OpenLayers e JavaScript ES Modules;
- [x] camadas WMS/WFS via GeoServer;
- [x] base espacial em PostGIS;
- [x] busca por BIC, endereco, poste e imovel rural;
- [x] popups modernos para lotes, edificacoes, farmacias, locais de interesse e postes;
- [x] rotas com Google Maps;
- [x] solicitacao de reparo de postes via Google Forms;
- [x] suporte mobile refinado;
- [x] testes unitarios com Vitest;
- [x] documentacao tecnica em `docs/FRONTEND-ARCHITECTURE.md`;
- [x] plano de testes em `docs/TESTING-PLAN.md`.

## 3. Criterios de estabilidade do front-end

- [ ] `npm.cmd test` passando antes de publicar.
- [ ] `npm.cmd run build` passando antes de publicar.
- [ ] Checklist manual executado em desktop.
- [ ] Checklist manual executado em mobile real quando houver mudanca de interacao.
- [ ] Popups de lote, edificacao, farmacia, local de interesse e poste funcionando.
- [ ] Busca por BIC funcionando.
- [ ] Busca por endereco exato e aproximado funcionando.
- [ ] Busca por poste funcionando.
- [ ] Busca por imovel rural funcionando quando aplicavel.
- [ ] Ativar/desativar camadas sem regressao visual.
- [ ] Legendas coerentes com as camadas ativas.
- [ ] Rotas externas abrindo corretamente.
- [ ] Medicao de distancia e area funcionando, sem popup residual durante medicao.
- [ ] Geolocalizacao funcionando quando o navegador permite.
- [ ] Impressao atual validada como funcional/provisoria.
- [ ] Nenhuma alteracao profunda em impressao sem etapa planejada.

## 4. Criterios de seguranca publica

- [ ] Dados exibidos em popup passam por `escapeHtml` quando vierem do GeoServer.
- [ ] Popups nao exibem dados sensiveis, pessoais ou operacionais indevidos.
- [ ] Nenhum token, segredo, credencial ou chave privada fica no front-end.
- [ ] Links externos usam `target="_blank"` com `rel="noopener noreferrer"`.
- [ ] URLs externas sao montadas com APIs seguras, como `URLSearchParams`, quando aplicavel.
- [ ] Camadas publicas foram revisadas quanto a conteudo sensivel.
- [ ] Dados publicos e dados operacionais internos estao separados.
- [ ] Dados sensiveis futuros devem ser publicados apenas por views, APIs ou permissoes controladas.

## 5. Criterios de dados e camadas

- [ ] Cada camada possui nome publico amigavel.
- [ ] Cada camada possui chave interna documentada.
- [ ] Cada camada possui `layerName` GeoServer revisado.
- [ ] Legenda correta e compreensivel.
- [ ] Popup padronizado quando a camada for clicavel.
- [ ] Campos exibidos no popup revisados.
- [ ] Campos tecnicos ou desnecessarios ocultados.
- [ ] Performance aceitavel em WMS/WFS.
- [ ] Escala e zoom adequados ao uso da camada.
- [ ] Origem dos dados documentada.
- [ ] Periodicidade de atualizacao documentada quando relevante.
- [ ] Sensibilidade marcada como publica, restrita ou interna.

## 6. Criterios de UX e acessibilidade pratica

- [ ] Interface utilizavel em celular real.
- [ ] Botoes e atalhos com texto claro.
- [ ] Mensagens/toasts amigaveis para erros e validacoes.
- [ ] Nomes de camadas compreensiveis para cidadao nao tecnico.
- [ ] Camadas agrupadas de forma logica.
- [ ] Acao de limpar camadas preserva comportamentos esperados.
- [ ] Feedback claro quando busca nao encontra resultado.
- [ ] Popups legiveis em desktop e mobile.
- [ ] Rotas, WhatsApp e Formularios externos identificaveis.
- [ ] Usabilidade validada por alguem fora da equipe tecnica quando possivel.

## 7. Criterios de manutencao tecnica

- [ ] `docs/FRONTEND-ARCHITECTURE.md` atualizado apos mudancas estruturais.
- [ ] `docs/TESTING-PLAN.md` atualizado apos novas frentes de teste.
- [ ] Testes unitarios atualizados quando helpers puros forem extraidos.
- [ ] Mudancas pequenas e revisaveis.
- [ ] Commits com descricao clara do escopo.
- [ ] `npm.cmd test` executado antes de publicar.
- [ ] `npm.cmd run build` executado antes de publicar.
- [ ] Publicacao feita a partir de `dist`.
- [ ] Procedimento de rollback conhecido.
- [ ] Versao publicada registrada, por commit, tag ou anotacao operacional.

## 8. Criterios para iniciar API/FastAPI

Iniciar API, FastAPI, login ou modulos internos somente quando:

- [ ] Geoportal publico estiver estavel em producao.
- [ ] Inventario de camadas estiver revisado.
- [ ] Camadas publicas e dados internos estiverem separados.
- [ ] Dados sensiveis tiverem regra clara de acesso.
- [ ] Modulo piloto estiver definido.
- [ ] Schema operacional do modulo piloto estiver planejado.
- [ ] Fluxo minimo de autenticacao estiver desenhado.
- [ ] Fluxo minimo de auditoria estiver desenhado.
- [ ] Papéis de usuario e permissoes estiverem definidos em alto nivel.
- [ ] Estrategia de backup e rollback estiver considerada.

## 9. Modulos internos futuros

Modulos previstos ou candidatos:

- Iluminacao Publica / Manutencao de Postes;
- Alvaras;
- Viabilidade;
- Meio Ambiente;
- Limpeza de Lotes;
- Outros servicos municipais.

Cada modulo deve nascer com escopo, dados, permissoes, telas, API, auditoria e relatorios minimamente planejados antes da implementacao.

## 10. Proximos documentos recomendados

- `docs/INTERNAL-MODULES-ARCHITECTURE.md`
- `docs/MODULE-ILUMINACAO-PUBLICA.md`
- `docs/LAYER-INVENTORY.md`
