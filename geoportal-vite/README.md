# Geoportal de Amambai - MS

Este projeto é um geoportal web desenvolvido para a Prefeitura de Amambai - MS, como parte do trabalho "A Importância do Webmapping para Amambai, Mato Grosso do Sul: Concepção e Replicabilidade".

## ✍️ Autores
- Ana Carla de Queiroz Paiva¹ (Prefeitura Municipal de Fortaleza, ORCID: https://orcid.org/0009-0006-8826-6285)  
- Anderson Pschisky² (Prefeitura Municipal de Amambai-MS, ORCID: https://orcid.org/0009-0007-0768-1135)  
- Daniel Luan P. Espindola³ (Prefeitura Municipal de Amambai-MS, ORCID: https://orcid.org/0000-0000-0000-0000)  
- Eduardo Augusto Andreatta⁴ (Prefeitura de Santo André, ORCID: https://orcid.org/0009-4886-1598)  
- Rafael Alves Esteves Julio⁵ (UFABC, ORCID: https://orcid.org/0009-0005-9434-8570)  
- Rafael Ronconi Bezerra⁶ (Prefeitura Municipal de Porto Velho, ORCID: https://orcid.org/0000-0002-2692-5752)  
- Orientador: Alexandro Gularte Schafer (ORCID: https://orcid.org/0000-0001-8700-0860)

---

## 🔍 Resumo

O webmapping permite a visualização e gestão de dados geográficos online, promovendo eficiência administrativa, transparência e planejamento urbano. Este projeto propõe um geoportal para o município de Amambai-MS, centralizando dados espaciais em uma plataforma interativa e replicável, utilizando tecnologias abertas.

---

## 🚀 Funcionalidades

- Visualização de diversas camadas temáticas (lotes, edificações, zoneamento, infraestrutura, etc.)
- Popups com atributos das feições clicadas
- Ferramentas de medição de área e distância
- Impressão do mapa em diferentes formatos
- Busca de endereços via OpenStreetMap
- Geolocalização do usuário
- Legendas dinâmicas com base nas camadas ativas
- Alternância entre mapas base (OSM, Satélite)
- Painel lateral com agrupamento de camadas

---

## 🧠 Tecnologias utilizadas

- [OpenLayers](https://openlayers.org/) (renderização e ferramentas geográficas)
- [GeoServer](http://geoserver.org/) (serviço de mapas WMS/WFS)
- [Vite](https://vitejs.dev/) (empacotador moderno e rápido para projetos JS)
- HTML, CSS e JavaScript ES Modules

---

## 📁 Estrutura de arquivos

| Caminho / Arquivo          | Descrição |
|----------------------------|-----------|
| `index.html`               | Estrutura base do site |
| `style.css`                | Estilo visual e responsividade |
| `src/main.js`              | Arquivo principal, integra e inicializa os módulos |
| `src/geoportal-*.js`       | Módulos JS separados por funcionalidade (camadas, mapa, busca, popup, etc.) |
| `logo.png`                 | Logotipo do projeto |
| `vite.config.js`           | Configuração do Vite (com base relativa para publicação via FileZilla) |
| `dist/` (gerado via build) | Versão final do site para subir no domínio |

---

## 🖥️ Como rodar localmente (modo desenvolvimento)

### Pré-requisitos:
- [Node.js](https://nodejs.org/) (versão 16 ou superior)

### Etapas:
```bash
# 1. Clone este repositório
git clone https://github.com/SEU_USUARIO/geoportal-amambai.git

# 2. Acesse o diretório do projeto
cd geoportal-amambai

# 3. Instale as dependências
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

---

## 📦 Como gerar o build de produção

1. Abra o terminal na pasta do projeto (onde está o arquivo `package.json`).
2. Execute o comando:

    npm run build

3. Os arquivos otimizados serão gerados automaticamente na pasta `dist/`.
4. Publique ou sirva o conteúdo da pasta `dist/` em seu servidor web.
