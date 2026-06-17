# Geoportal Frontend

Frontend Vite do Geoportal Amambai, cobrindo tanto o Geoportal publico quanto a shell interna publicada em `/interno/`.

## Enderecos atuais

- Geoportal publico: `https://geoportal.amambai.ms.gov.br/`
- Shell interna: `https://geoserver.amambai.ms.gov.br/interno/`
- API publica consumida pelo ecossistema: `https://geoserver.amambai.ms.gov.br/api/`
- API interna consumida pela shell: `https://geoserver.amambai.ms.gov.br/api/internal/`

## Estado atual do frontend

O frontend hoje atende dois fluxos distintos:

1. Geoportal publico:
   - mapa, camadas, busca, locais de interesse, geolocalizacao, impressao e fluxo publico relacionado a Iluminacao.

2. Shell interna:
   - login/logout interno;
   - verificacao de sessao por `/api/internal/auth/me`;
   - listagem administrativa completa;
   - listagem ativa para manutencao com `ativos=true`;
   - detalhe, historico e observacoes sob demanda;
   - criacao de observacao interna;
   - alteracao normal de status;
   - alteracao de prioridade por permissao;
   - coordenadas, rota Google Maps e mapa simples no detalhe;
   - relatorio administrativo sanitizado.

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Testes

```bash
npm test
```

## Seguranca

- O frontend interno usa cookie HttpOnly e nao grava token em `localStorage` ou `sessionStorage`.
- O frontend orienta a UX por permissao, mas a autorizacao real continua no backend.
- Publico e interno devem continuar separados em deploy, validacao e rollback.

## Documentacao

Os documentos tecnicos ficam em `docs/`, incluindo arquitetura, deploy, runtime interno/publico, autenticacao/autorizacao, UX operacional, relatorios administrativos e o estado atual do modulo interno de Iluminacao Publica.
