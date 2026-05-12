# Inventario de Camadas do Geoportal de Amambai

Este inventario documenta as camadas publicadas no Geoportal, sua finalidade publica, uso tecnico no front-end e avaliacao inicial de seguranca. Ele deve ser revisado antes da criacao de API, login, modulos internos ou publicacao de novos dados operacionais.

## 1. Objetivo

Registrar as camadas conhecidas pelo front-end, com base em `src/geoportal-config.js`, painel de camadas, legenda, busca e clique no mapa.

O inventario serve para:

- revisar seguranca e governanca de dados;
- identificar campos sensiveis expostos por WMS, WFS ou GetFeatureInfo;
- planejar views controladas no GeoServer/PostGIS;
- separar dados publicos, restritos e internos;
- apoiar modulos futuros como iluminacao publica, alvaras, viabilidade, meio ambiente e limpeza de lotes.

## 2. Criterios de classificacao

- **Publica**: pode aparecer ao cidadao no Geoportal publico.
- **Publica com revisao**: pode aparecer ao cidadao, mas campos, popup, legenda, WFS ou sensibilidade precisam revisao.
- **Restrita**: nao deve ser exposta diretamente sem view/API controlada.
- **Interna futura**: candidata a modulo operacional interno, com login, permissao e auditoria.

## 3. Campos do inventario

- **Chave interna**: identificador usado pelo front-end.
- **Nome publico**: texto exibido no painel ou legenda.
- **Grupo**: agrupamento no painel de camadas.
- **layerName GeoServer**: nome tecnico publicado no GeoServer.
- **Tipo de publicacao**: uso no front-end, como WMS, WFS e GetFeatureInfo.
- **Popup**: se participa da abertura de popup por clique.
- **Busca**: se participa de busca textual.
- **Legenda**: se ha `LEGEND_CONFIG` ou tratamento customizado.
- **Sensibilidade**: classificacao inicial.
- **Observacoes**: comportamento especial ou lacuna conhecida.
- **Revisao necessaria**: itens a validar manualmente.

## 4. Inventario inicial das camadas

| Chave | Nome publico | Grupo | GeoServer layerName | Uso tecnico | Popup | Busca | Legenda | Classificacao inicial | Observacoes |
|---|---|---|---|---|---|---|---|---|---|
| `layer1` | Perimetro do Municipio | Gerais | `ne:Perimetro de Amambai` | WMS | Nao | Nao | Nao configurada | Publica | Ativa por padrao e preservada ao limpar camadas. |
| `layer2` | Eixo de Adensamento | Plano diretor | `ne:EixoDeAdensamento` | WMS, GetFeatureInfo | Sim | Nao | Nao configurada | Publica com revisao | Popup combinado com lote quando aplicavel. |
| `layer3` | Lotes Urbanos | Infraestrutura | `ne:area_urbana` | WMS, WFS, GetFeatureInfo | Sim | BIC, endereco | Nao configurada | Publica com revisao | Camada central para cadastro urbano; revisar campos expostos. |
| `layer_vilas` | Vilas | Infraestrutura | `ne:Vilas` | WMS | Nao | Nao | Sim | Publica | Sem popup especifico no codigo atual. |
| `layer_aeia` | Area interesse ambiental | Plano diretor | `ne:AEIA` | WMS | Nao | Nao | Sim | Publica | Revisar nomenclatura oficial. |
| `layer_aeie` | Area interesse economico | Plano diretor | `ne:AEIE` | WMS | Nao | Nao | Sim | Publica | Revisar nomenclatura oficial. |
| `layer_aeis1` | Area interesse social1 | Plano diretor | `ne:AEIS1` | WMS | Nao | Nao | Sim | Publica | Revisar nomenclatura oficial. |
| `layer_aeis2` | Area interesse social2 | Plano diretor | `ne:AEIS2` | WMS | Nao | Nao | Sim | Publica | Revisar nomenclatura oficial. |
| `layer_macrozoneamento` | Macrozoneamento | Plano diretor | `ne:Macrozoneamento_web` | WMS | Nao | Nao | Sim | Publica | Camada de planejamento territorial. |
| `layer4` | Zoneamento Urbano | Plano diretor | `ne:ZoneamentoUrbano_PD_novo` | WMS, GetFeatureInfo | Sim | Nao | Sim | Publica com revisao | Popup por clique; revisar campos tecnicos exibidos. |
| `layer5` | Terras Indigenas | Ambiental | `ne:Aldeias` | WMS | Nao | Nao | Sim | Publica com revisao | Revisar sensibilidade e fonte oficial. |
| `layer6` | Sub-bacias do Rio Parana | Ambiental | `ne:bacia_rio_parana` | WMS | Nao | Nao | Sim | Publica | Camada ambiental. |
| `layer7` | Cursos d'agua Amambai | Ambiental | `ne:Rios e Corregos de Amambai` | WMS | Nao | Nao | Nao configurada | Publica | Legenda nao encontrada em `LEGEND_CONFIG`. |
| `layer_convergencia_fluxo` | Linhas de escoamento da Chuva | Ambiental | `ne:Convergencia de fluxo de agua` | WMS | Nao | Nao | Sim | Publica | Camada ambiental/hidrologica. |
| `layer_microbacias_urbana` | Micro bacias urbanas | Ambiental | `ne:Microbacias area urbana` | WMS | Nao | Nao | Sim | Publica | Camada ambiental urbana. |
| `layer_aeiu` | Area interesse urbano | Plano diretor | `ne:AEIU` | WMS | Nao | Nao | Sim | Publica | Revisar nomenclatura oficial. |
| `layer_apc` | Area de Expansao Urbana | Plano diretor | `ne:AreaExpansaoUrbana` | WMS | Nao | Nao | Sim | Publica | Chave interna historica `apc`. |
| `layer_area_protecao_cultural` | Area de Protecao Cultural | Plano diretor | `ne:AreaDeProtecaoCultural` | WMS | Nao | Nao | Sim | Publica | Revisar campos e origem. |
| `layer_edificacoes` | Edificacoes | Infraestrutura | `ne:EdificacoesDB` | WMS, GetFeatureInfo | Sim | Nao | Sim | Publica com revisao | Popup proprio e combinado com lotes. |
| `layer_pavimentacao` | Pavimentacao | Infraestrutura | `ne:Pavimentacao` | WMS | Nao | Nao | Sim | Publica | Camada tambem relacionada a modulo especial. |
| `layer_unidades_conservacao` | Unidades de Conservacao | Ambiental | `ne:UCs Amambai` | WMS | Nao | Nao | Sim | Publica | Revisar fonte oficial. |
| `layer_tipos_solo` | Tipos de Solo | Ambiental | `ne:tipos_solo_at` | WMS | Nao | Nao | Sim | Publica | Camada ambiental. |
| `layer_geologia` | Geologia | Ambiental | `ne:geologia` | WMS | Nao | Nao | Sim | Publica | Camada ambiental. |
| `layer_trechosrda` | Rede de Agua | Infraestrutura | `ne:Trechos de RDA` | WMS | Nao | Nao | Sim | Publica com revisao | Revisar se atributos operacionais devem permanecer publicos. |
| `layer_redeesgoto` | Rede de Esgoto | Infraestrutura | `ne:rede_esgoto_2025_at` | WMS | Nao | Nao | Sim | Publica com revisao | Revisar sensibilidade de infraestrutura. |
| `layer_drenagem_urbana` | Drenagem Urbana | Infraestrutura | `ne:Rede de drenagem urbana` | WMS | Nao | Nao | Sim | Publica com revisao | Revisar sensibilidade de infraestrutura. |
| `layer_postes` | Postes da Rede Eletrica | Servicos | `ne:Postes - IDs - AU` | WMS, WFS | Sim | Poste | Sim | Publica com revisao / Interna futura | Base para modulo de iluminacao publica. |
| `layer_coleta` | Coleta de Lixo | Servicos | `ne:Coleta` | ImageWMS, GetFeatureInfo | Sim | Nao | Sim | Publica | Usa `singleImage` e popup combinado com lote. |
| `layer_coleta_seletiva` | Coleta Seletiva | Servicos | `ne:coleta_seletiva` | ImageWMS | Nao | Nao | Sim | Publica | Usa `singleImage`. |
| `layer_contorno_viario` | Contorno Viario | Infraestrutura | `ne:contorno` | WMS | Nao | Nao | Sim | Publica | Revisar finalidade publica. |
| `layer_assistencia_social` | Assistencia Social | Locais de interesse | `ne:Assistencia social` | WMS, GetFeatureInfo | Sim | Nao | Sim | Publica com revisao | Popup moderno com contato/rota. |
| `layer_educacao` | Educacao | Locais de interesse | `ne:Educacao_at` | WMS, GetFeatureInfo | Sim | Nao | Sim | Publica com revisao | Popup moderno com contato/rota. |
| `layer_prefeitura` | Prefeitura | Locais de interesse | `ne:Prefeitura` | WMS, GetFeatureInfo | Sim | Nao | Sim | Publica | Popup moderno com contato/rota. |
| `layer_saude` | Saude | Locais de interesse | `ne:Saude_atu` | WMS, GetFeatureInfo | Sim | Nao | Sim | Publica com revisao | Popup moderno com contato/rota; revisar dados de contato. |
| `layer_farmacias` | Farmacias | Locais de interesse | `ne:Farmacias` | WMS, GetFeatureInfo, camada vetorial de destaque | Sim | Nao | Sim/customizada | Publica com revisao | Popup moderno, rota, WhatsApp e destaque de plantao. |
| `layer_imoveis_sigef` | Imoveis Rurais (SIGEF) | Area rural | `ne:Imoveis SIGEF 05_25` | WMS, WFS, GetFeatureInfo | Sim | Fazenda/imovel rural | Sim | Publica com revisao | Campos ocultos no popup; revisar sensibilidade. |
| `layer_imoveis_snci` | Imoveis Rurais (SNCI) | Area rural | `ne:Imoveis SNCI 05_25` | WMS, WFS, GetFeatureInfo | Sim | Fazenda/imovel rural | Sim | Publica com revisao | Campos ocultos no popup; revisar sensibilidade. |

## 5. Camadas especiais

### Lotes / Area Urbana

- Chave: `layer3`.
- GeoServer: `ne:area_urbana`.
- Usa WMS, WFS e GetFeatureInfo.
- Tem popup cadastral e busca por BIC/endereco.
- Ativada automaticamente em alguns fluxos de busca.
- Atencao: revisar campos expostos no popup e no WFS, especialmente dados cadastrais.

### Edificacoes

- Chave: `layer_edificacoes`.
- GeoServer: `ne:EdificacoesDB`.
- Usa WMS e GetFeatureInfo.
- Tem popup proprio e tambem aparece combinado com Lotes.
- Atencao: revisar atributos tecnicos e garantir que nao haja dado sensivel.

### Postes da Rede Eletrica

- Chave: `layer_postes`.
- GeoServer: `ne:Postes - IDs - AU`.
- Usa WMS e WFS.
- Tem popup, busca por ID, rota e botao Solicitar Reparo via Google Forms.
- E candidata natural ao modulo interno de Iluminacao Publica / Manutencao de Postes.
- Atencao: separar dados publicos de dados operacionais futuros, como status, ordem de servico, responsavel, prioridade e historico.

### Farmacias

- Chave: `layer_farmacias`.
- GeoServer: `ne:Farmacias`.
- Usa WMS, GetFeatureInfo e camada vetorial de destaque para farmacia de plantao.
- Tem popup moderno com contato, WhatsApp e rota.
- Legenda combina item manual de farmacia de plantao e legenda GeoServer para demais farmacias.
- Atencao: revisar telefones, WhatsApp e regra de farmacia de plantao.

### Locais de Interesse

- Chaves: `layer_assistencia_social`, `layer_educacao`, `layer_prefeitura`, `layer_saude`.
- Usam WMS e GetFeatureInfo.
- Tem popup moderno com contato e rota.
- Atencao: revisar dados de telefone, WhatsApp, endereco e links antes de publicar novas categorias.

### Coleta de Lixo

- Chave: `layer_coleta`.
- GeoServer: `ne:Coleta`.
- Usa ImageWMS e GetFeatureInfo.
- Tem popup, inclusive combinado com lote.
- Atencao: revisar se horarios/setores estao atualizados e se o popup usa nomes amigaveis.

### Coleta Seletiva

- Chave: `layer_coleta_seletiva`.
- GeoServer: `ne:coleta_seletiva`.
- Usa ImageWMS.
- Nao ha popup especifico identificado no codigo atual.
- Atencao: revisar se precisa de popup ou apenas legenda.

### Imoveis rurais / SIGEF / SNCI

- Chaves: `layer_imoveis_sigef`, `layer_imoveis_snci`.
- Usam WMS, WFS e GetFeatureInfo.
- Busca por fazenda/imovel rural consulta SIGEF e SNCI.
- O popup oculta alguns campos tecnicos.
- Atencao: revisar sensibilidade de dados fundiarios, responsavel pelo dado, origem oficial e campos expostos.

### Perimetro Urbano / Municipio

- Chave: `layer1`.
- GeoServer: `ne:Perimetro de Amambai`.
- Camada WMS ativa por padrao.
- A limpeza de camadas preserva essa camada quando ela ja esta ativa.
- Atencao: confirmar se o nome publico deve ser Perimetro do Municipio ou Perimetro Urbano, pois a nomenclatura aparece de forma variavel em conversas e documentacao.

## 6. Pontos de atencao de seguranca

- [ ] Revisar campos expostos por GetFeatureInfo.
- [ ] Revisar campos expostos por WFS.
- [ ] Evitar dados pessoais ou sensiveis em popups.
- [ ] Separar dados publicos de dados operacionais.
- [ ] Preferir views controladas para publicacao publica.
- [ ] Restringir WFS quando nao for necessario.
- [ ] Revisar camadas de infraestrutura antes de manter exposicao publica.
- [ ] Revisar camadas rurais quanto a dados fundiarios sensiveis.
- [ ] Revisar camadas antes de iniciar modulos internos.

## 7. Lacunas a preencher manualmente

Informacoes que provavelmente nao estao no codigo e devem ser preenchidas por governanca de dados:

- schema/tabela PostGIS real;
- origem oficial dos dados;
- responsavel pelo dado;
- periodicidade de atualizacao;
- data da ultima atualizacao;
- campos sensiveis;
- regra de acesso;
- responsavel por autorizar publicacao;
- se a camada sera publica, restrita ou interna;
- quais campos devem ser expostos por popup, WFS e GetFeatureInfo;
- se deve existir view publica separada da tabela operacional.

## 8. Relacao com seguranca e modulos futuros

Este inventario e base para:

- revisao de seguranca;
- desenho de schemas;
- criacao de views publicas controladas;
- planejamento de API/FastAPI;
- separacao entre dados publicos e operacionais;
- desenho de permissoes e auditoria;
- modulos internos como iluminacao publica, alvaras, viabilidade, meio ambiente e limpeza de lotes.

Antes de criar modulos internos, este inventario deve ser revisado junto com:

- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/GEOPORTAL-MATURITY-CHECKLIST.md`;
- futuro `docs/INTERNAL-MODULES-ARCHITECTURE.md`;
- futuro `docs/MODULE-ILUMINACAO-PUBLICA.md`.
