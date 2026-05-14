# Geoportal de Amambai - MS

Geoportal web municipal desenvolvido para Amambai/MS como parte de trabalho acadêmico/TCC. O projeto evoluiu para uma arquitetura baseada em Vite, OpenLayers e JavaScript ES Modules, com integração a serviços públicos WMS/WFS do GeoServer/PostGIS.

## Link de produção

https://geoportal.amambai.ms.gov.br

## Autores

- Ana Carla de Queiroz Paiva¹ (Prefeitura Municipal de Fortaleza, ORCID: https://orcid.org/0009-0006-8826-6285)
- Anderson Pschisky² (Prefeitura Municipal de Amambai-MS, ORCID: https://orcid.org/0009-0007-0768-1135)
- Daniel Luan P. Espindola³ (Prefeitura Municipal de Amambai-MS, ORCID: https://orcid.org/0000-0000-0000-0000)
- Eduardo Augusto Andreatta⁴ (Prefeitura de Santo André, ORCID: https://orcid.org/0009-4886-1598)
- Rafael Alves Esteves Julio⁵ (UFABC, ORCID: https://orcid.org/0009-0005-9434-8570)
- Rafael Ronconi Bezerra⁶ (Prefeitura Municipal de Porto Velho, ORCID: https://orcid.org/0000-0002-2692-5752)
- Orientador: Alexandro Gularte Schafer (ORCID: https://orcid.org/0000-0001-8700-0860)

## Resumo

O webmapping permite a visualização e a gestão de dados geográficos online, promovendo eficiência administrativa, transparência e planejamento urbano. Este projeto propõe um geoportal para o município de Amambai-MS, centralizando dados espaciais em uma plataforma interativa e replicável, utilizando tecnologias abertas.

## Funcionalidades atuais

- Visualização de camadas temáticas via GeoServer.
- Mapas base.
- Painel de camadas.
- Barra pública com menus.
- Locais de interesse.
- Serviços.
- Busca por endereço, BIC, postes e imóveis/fazendas quando aplicável.
- Popups informativos.
- Rotas externas via Google Maps.
- Farmácias com destaque de plantão.
- Postes com solicitação de reparo via formulário externo provisório.
- Medição de distância e área.
- Geolocalização.
- Impressão.
- Legendas dinâmicas.
- Layout responsivo/mobile.
- Documentação técnica em `geoportal-vite/docs/`.

## Tecnologias utilizadas

- [Vite](https://vitejs.dev/)
- [OpenLayers](https://openlayers.org/)
- JavaScript ES Modules
- GeoServer/PostGIS via WMS/WFS públicos
- HTML e CSS

## Estrutura atual

- `geoportal-vite/`: projeto atual do Geoportal.
- `geoportal-vite/src/`: módulos JavaScript da aplicação.
- `geoportal-vite/docs/`: documentação técnica e planejamento.
- `geoportal-vite/public/`: assets públicos.
- `geoportal-vite/index.html`: entrada da aplicação.
- `geoportal-vite/style.css`: estilos globais.
- `geoportal-vite/package.json`: scripts e dependências do projeto.
- Arquivos antigos fora de `geoportal-vite/` foram removidos do versionamento público.

## Como rodar localmente

Pré-requisito: Node.js instalado.

```bash
git clone https://github.com/apschisky/geoportal-amambai.git
cd geoportal-amambai/geoportal-vite
npm install
npm run dev
```

O Vite indicará a URL local no terminal.

## Como gerar build

```bash
npm run build
```

A pasta `dist/` é gerada localmente e não deve ser versionada.

## Testes

```bash
npm test
```

## Segurança e dados sensíveis

- Não versionar `.env`, backups, dumps SQL, credenciais, chaves, senhas, arquivos `.backup`, `.sql`, `.docx` ou dados internos.
- Endpoints WMS/WFS públicos do GeoServer aparecem no front-end porque são necessários para o funcionamento do Geoportal público.
- Futuras APIs internas, login e módulos operacionais devem ser desenvolvidos em ambiente separado/homologação e com credenciais fora do Git.

## Documentação

Os documentos técnicos ficam em `geoportal-vite/docs/`, incluindo arquitetura, segurança, banco, API futura, permissões, módulo de iluminação pública e governança documental.

## Licença

Este projeto está licenciado sob a licença Creative Commons Atribuição 4.0 Internacional (CC BY 4.0).

## Créditos

Projeto desenvolvido no contexto do trabalho "A Importância do Webmapping para Amambai, Mato Grosso do Sul: Concepção e Replicabilidade", com uso de tecnologias abertas e serviços geográficos para apoio à gestão municipal e à transparência pública.
