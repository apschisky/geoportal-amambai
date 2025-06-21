# Geoportal de Amambai - MS

Este projeto é um geoportal web desenvolvido para a Prefeitura de Amambai - MS, como parte do trabalho "A Importância do Webmapping para Amambai, Mato Grosso do Sul: Concepção e Replicabilidade".

**Autores:**
- Ana Carla de Queiroz Paiva¹ (Prefeitura Municipal de Fortaleza, ORCID: https://orcid.org/0009-0006-8826-6285)
- Anderson Pschisky² (Prefeitura Municipal de Amambai-MS, ORCID: https://orcid.org/0009-0007-0768-1135)
- Daniel Luan P. Espindola³ (Prefeitura Municipal de Amambai-MS, ORCID: https://orcid.org/0000-0000-0000-0000)
- Eduardo Augusto Andreatta⁴ (Prefeitura de Santo André, ORCID: https://orcid.org/0009-4886-1598)
- Rafael Alves Esteves Julio⁵ (UFABC, ORCID: https://orcid.org/0009-0005-9434-8570)
- Rafael Ronconi Bezerra⁶ (Prefeitura Municipal de Porto Velho, ORCID: https://orcid.org/0000-0002-2692-5752)
- Orientador: Alexandro Gularte Schafer (ORCID: https://orcid.org/0000-0001-8700-0860)

## Resumo
O avanço tecnológico global transformou áreas como comunicação, transporte e gestão pública, consolidando um mundo interconectado. No Brasil, os municípios buscam integrar suas gestões ao ambiente digital, destacando-se o governo digital. O webmapping surge como ferramenta essencial, permitindo a visualização e gestão de dados geográficos em plataformas acessíveis. Ele otimiza o uso de recursos, promove transparência e auxilia na identificação de problemas urbanos, beneficiando gestores no planejamento de infraestrutura, saúde e educação, e a população, com maior acesso a informações sobre serviços. Em Amambai, Mato Grosso do Sul, a ausência de um sistema de webmapping limita a eficiência administrativa. Este trabalho propõe a criação de um sistema de webmapping para o município, utilizando ferramentas de código aberto. O sistema centralizará dados geográficos, como infraestrutura e serviços públicos. Além disso, o estudo busca desenvolver um modelo replicável, inspirando outros municípios brasileiros a adotarem soluções semelhantes.

## Funcionalidades
- Visualização de diversas camadas temáticas (lotes urbanos, edificações, zoneamento, infraestrutura, áreas de interesse, etc)
- Popups informativos ao clicar em feições das camadas principais (lotes, zoneamento, edificações)
- Ferramentas de medição de distância e área
- Busca de endereço integrada ao OpenStreetMap
- Impressão do mapa
- Geolocalização do usuário
- Controle de legendas dinâmicas conforme as camadas ativas
- Painel lateral com grupos de camadas expansíveis
- Alternância entre mapas base (OpenStreetMap e Satélite)

## Estrutura dos arquivos
- `index.html`: Estrutura da interface web e integração dos scripts
- `style.css`: Estilos visuais e responsividade
- `main.js`: Lógica do mapa, integração com GeoServer, ferramentas e popups
- `logo.png`: Logotipo da Prefeitura de Amambai

## Como rodar localmente
1. Clone este repositório:
   ```
   git clone https://github.com/SEU_USUARIO/geoportal-amambai.git
   ```
2. Acesse a pasta do projeto:
   ```
   cd geoportal-amambai
   ```
3. Abra o arquivo `index.html` em seu navegador (basta dar duplo clique ou usar o menu "Abrir com" do navegador).

> Não é necessário backend, apenas um navegador moderno. O acesso aos dados depende do GeoServer público configurado no código.

## Como foi elaborado
O geoportal foi desenvolvido utilizando HTML, CSS e JavaScript puro, com a biblioteca OpenLayers para renderização do mapa e integração com serviços WMS do GeoServer. O código está organizado para facilitar a manutenção e a adição de novas camadas ou ferramentas.

- As camadas são configuradas no arquivo `main.js`, com controle de visibilidade via painel lateral.
- O popup de informações é exibido ao clicar sobre feições das camadas principais, mostrando os atributos retornados pelo GeoServer.
- O painel de legendas é dinâmico e exibe apenas as legendas das camadas ativas.
- O layout é responsivo e otimizado para uso em desktop.

## Requisitos
- Navegador moderno (Chrome, Firefox, Edge, etc)
- Acesso à internet para consumir o GeoServer e o OpenLayers CDN

## Licença
Este projeto está licenciado sob a [Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)](LICENSE). O uso, adaptação e replicação são permitidos, inclusive para fins comerciais, desde que seja feita a devida atribuição aos autores e à Prefeitura de Amambai - MS.

## Créditos
Desenvolvido por Ana Carla de Queiroz Paiva, Anderson Pschisky, Daniel Luan P. Espindola, Eduardo Augusto Andreatta, Rafael Alves Esteves Julio, Rafael Ronconi Bezerra e orientador Alexandro Gularte Schafer.

---

**Este repositório pode ser utilizado como referência para projetos de geoportais municipais, integração OpenLayers + GeoServer e organização de mapas temáticos urbanos e rurais.**
