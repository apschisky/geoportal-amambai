# Inventario do Banco de Dados do Geoportal de Amambai

Este documento registra a estrutura conhecida do banco `amambaiGis` para apoiar seguranca, governanca de dados, publicacao no GeoServer e planejamento de futuros modulos internos.

## 1. Objetivo

Documentar o universo do PostgreSQL/PostGIS usado pelo Geoportal, separando o que existe no banco daquilo que esta efetivamente publicado no GeoServer e consumido pelo front-end.

Este inventario deve apoiar:

- revisao de seguranca e governanca de dados;
- revisao de campos sensiveis;
- organizacao de schemas;
- publicacao segura no GeoServer;
- criacao de views publicas controladas;
- planejamento de API/FastAPI;
- modulos internos com login, permissoes e auditoria.

## 2. Origem das informacoes

Esta primeira versao foi baseada nos arquivos auxiliares informados:

- `schema_only_safe.sql`;
- `toc_backup.txt`.

Contexto identificado:

- banco: `amambaiGis`;
- backup criado em: `2026-05-04 06:00:00`;
- tecnologia: PostgreSQL/PostGIS;
- o arquivo TOC indica 1173 entradas;
- a documentacao deve ser complementada com consultas diretas ao banco em ambiente controlado.

Nenhuma senha, user mapping detalhado, string de conexao ou credencial deve ser registrada neste documento.

## 3. Schemas identificados

| Schema | Finalidade provavel | Observacoes |
|---|---|---|
| `public` | Extensoes e objetos gerais do PostgreSQL/PostGIS. | Pode conter objetos tecnicos, extensoes e objetos legados. Revisar privilegios padrao. |
| `plano` | Base tecnica/editavel/autoritativa. | Contem varias tabelas geograficas, publicadas e nao publicadas. Deve ser tratado como schema sensivel de origem. |
| `web_map` | Publicacao/sincronizacao para Geoportal/GeoServer. | Parece servir como schema de publicacao ou espelhamento para camadas consumidas pelo Geoportal. |
| `topology` | Objetos do PostGIS Topology. | Schema tecnico criado por extensao. Nao deve ser publicado diretamente. |

## 4. Extensoes e objetos tecnicos

Extensoes identificadas:

- `postgis`;
- `postgis_topology`;
- `postgres_fdw`.

Pontos de atencao:

- existe FDW/servidor externo identificado no backup;
- nao documentar credenciais;
- revisar se o FDW ainda e necessario;
- revisar permissoes, senha e exposicao;
- rotacionar credenciais se algum backup convertido, log ou arquivo intermediario tiver exposto segredo.

## 5. Funcoes identificadas no schema web_map

| Funcao | Schema | Finalidade provavel | Observacoes |
|---|---|---|---|
| `rotate_history(tbl text)` | `web_map` | Rotacionar historico de tabela sincronizada. | Relacionada a tabelas historicas como `_hist_1`, `_hist_2` e `_hist_3`. |
| `sync_table(source_schema text, table_name text)` | `web_map` | Sincronizar tabela de um schema de origem para `web_map`. | Parece apoiar publicacao controlada ou espelhamento de dados para o Geoportal. |

Foram identificadas tabelas historicas como `area_urbana_hist_1`, `area_urbana_hist_2`, `area_urbana_hist_3`, `EdificacoesDB_hist_1`, `EdificacoesDB_hist_2` e `EdificacoesDB_hist_3`. Isso sugere rotina de sincronizacao com rotacao de historico para camadas criticas.

## 6. Inventario inicial de tabelas por schema

### Schema `plano`

| Tabela | Tipo/uso provavel | Publicada no front-end? | Sensibilidade inicial | Observacoes |
|---|---|---|---|---|
| `AEIA` | Plano diretor / area ambiental | Sim | Publica com revisao | Publicada como `layer_aeia`. |
| `AEIE` | Plano diretor / interesse economico | Sim | Publica com revisao | Publicada como `layer_aeie`. |
| `AEIS1` | Plano diretor / interesse social | Sim | Publica com revisao | Publicada como `layer_aeis1`. |
| `AEIS2` | Plano diretor / interesse social | Sim | Publica com revisao | Publicada como `layer_aeis2`. |
| `AEIU` | Plano diretor / interesse urbano | Sim | Publica com revisao | Publicada como `layer_aeiu`. |
| `APC` | Plano diretor / area especial | A confirmar | Publica com revisao | Confirmar relacao com camada publicada. |
| `Aldeias` | Terras indigenas / aldeias | Sim | Publica com revisao | Publicada como `layer5`; revisar fonte e sensibilidade. |
| `AldeiasIndigenas` | Terras indigenas / aldeias | A confirmar | Publica com revisao | Pode ser origem/versao alternativa. |
| `Amambai_Quadras` | Quadras urbanas | Nao identificada | Publica com revisao | Revisar relacao com lotes/cadastro urbano. |
| `AreaDeProtecaoCultural` | Area de protecao cultural | Sim | Publica com revisao | Publicada como `layer_area_protecao_cultural`. |
| `AreaExpansaoUrbana` | Area de expansao urbana | Sim | Publica com revisao | Publicada como `layer_apc`. |
| `Assistencia social` | Locais de assistencia social | Sim | Publica com revisao | Nome no banco pode conter acento; publicada como local de interesse. |
| `Bordeada` | A confirmar | Nao identificada | A confirmar | Finalidade nao inferida pelo front-end. |
| `Coleta` | Setores/rotas de coleta | Sim | Publica | Publicada como `layer_coleta`; possui popup. |
| `EdificacoesDB` | Edificacoes urbanas | Sim | Publica com revisao | Publicada como `layer_edificacoes`; possui popup. |
| `Educacao` | Equipamentos de educacao | A confirmar | Publica com revisao | Pode ser tabela anterior ou alternativa. |
| `Educacao_at` | Equipamentos de educacao atualizados | Sim | Publica com revisao | Publicada como `layer_educacao`. |
| `EixoDeAdensamento` | Plano diretor | Sim | Publica | Publicada como `layer2`; possui popup. |
| `Geologia` | Geologia | A confirmar | Publica | Confirmar relacao com `geologia`. |
| `Imoveis SIGEF 05_25` | Imoveis rurais SIGEF | Sim | Publica com revisao | Usada em busca rural; revisar sensibilidade fundiaria. |
| `Imoveis SNCI 05_25` | Imoveis rurais SNCI | Sim | Publica com revisao | Usada em busca rural; revisar sensibilidade fundiaria. |
| `MacrozonaUrbana` | Macrozoneamento urbano | A confirmar | Publica com revisao | Pode ser tabela historica/alternativa. |
| `Macrozoneamento` | Macrozoneamento | A confirmar | Publica | Pode ser origem/versao anterior. |
| `Macrozoneamento_novo` | Macrozoneamento | A confirmar | Publica | Pode ser versao intermediaria. |
| `Macrozoneamento_web` | Macrozoneamento publicado | Sim | Publica | Publicada como `layer_macrozoneamento`. |
| `Pavimentacao` | Pavimentacao urbana | Sim | Publica | Nome no banco pode conter acento. |
| `PerimetroUrbano` | Perimetro urbano | A confirmar | Publica | Confirmar relacao com camada padrao. |
| `PerimetroUrbano_PD_novo` | Perimetro urbano do plano diretor | A confirmar | Publica | Pode ser origem/versao alternativa. |
| `Perimetro de Amambai` | Perimetro municipal/urbano | Sim | Publica | Publicada como `layer1`; nome pode conter acento. |
| `Prefeitura` | Local/equipamento administrativo | Sim | Publica | Publicada como local de interesse. |
| `Rede de drenagem existente` | Drenagem urbana | A confirmar | Publica com revisao | Infraestrutura; revisar exposicao. |
| `RedeEsgoto` | Rede de esgoto | A confirmar | Publica com revisao / Restrita | Infraestrutura; revisar exposicao. |
| `RedeEsgoto2` | Rede de esgoto | A confirmar | Publica com revisao / Restrita | Possivel versao historica/alternativa. |
| `Rede_drenagem_2023_UTM` | Drenagem urbana | A confirmar | Publica com revisao | Infraestrutura; revisar exposicao. |
| `Reparticoes` | Reparticoes publicas | A confirmar | Publica com revisao | Pode alimentar locais de interesse. |
| `Rios e Corregos de Amambai` | Cursos d'agua | Sim | Publica | Publicada como `layer7`. |
| `RocioAmambai` | A confirmar | Nao identificada | A confirmar | Finalidade nao inferida pelo front-end. |
| `Ruas` | Sistema viario | A confirmar | Publica com revisao | Pode ser base cartografica. |
| `Saude` | Equipamentos de saude | A confirmar | Publica com revisao | Pode ser tabela anterior. |
| `Saude_at` | Equipamentos de saude | A confirmar | Publica com revisao | Verificar relacao com `Saude_atu`. |
| `Saude_atu` | Equipamentos de saude atuais | Sim | Publica com revisao | Publicada como `layer_saude`. |
| `Trechos de RDA` | Rede de agua | Sim | Publica com revisao / Restrita | Infraestrutura; revisar exposicao. |
| `Unidades de Conservacao` | Unidades de conservacao | A confirmar | Publica | Pode ser origem/versao alternativa. |
| `Vias` | Sistema viario | A confirmar | Publica | Revisar relacao com `Ruas`. |
| `Vilas` | Vilas/localidades | Sim | Publica | Publicada como `layer_vilas`. |
| `ZEIS` | Zonas especiais de interesse social | A confirmar | Publica com revisao | Pode se relacionar a AEIS. |
| `ZoneamentoUrbano_PD_novo` | Zoneamento urbano | Sim | Publica com revisao | Publicada como `layer4`; possui popup. |
| `aldeias_amambai` | Terras indigenas/aldeias | A confirmar | Publica com revisao | Possivel origem/versao alternativa. |
| `area_amambai` | Area municipal | A confirmar | Publica | Confirmar relacao com perimetro. |
| `area_urbana` | Lotes/cadastro urbano | Sim | Publica com revisao | Busca por BIC/endereco; revisar campos. |
| `areas_risco` | Areas de risco | Nao identificada | Publica com revisao / Restrita | Pode ser sensivel. |
| `bacia_rio_parana` | Bacias/sub-bacias | Sim | Publica | Publicada como `layer6`. |
| `captacao` | Captacao de agua | Nao identificada | Restrita | Infraestrutura sensivel. |
| `chacarasUrbanas` | Chacaras urbanas | Nao identificada | Publica com revisao | Revisar dados cadastrais. |
| `concentracao_trafego` | Trafego/mobilidade | Nao identificada | Publica com revisao | Pode apoiar planejamento viario. |
| `contorno` | Contorno viario | Sim | Publica | Publicada como `layer_contorno_viario`. |
| `convergencia_de_fluxo_agua` | Convergencia de fluxo | A confirmar | Publica | Relacionada a camada publicada com nome acentuado. |
| `cursos_dagua_amambai` | Cursos d'agua | A confirmar | Publica | Pode ser versao alternativa. |
| `curvas_em_nivel` | Curvas de nivel | Nao identificada | Publica | Base topografica. |
| `empreendimentos_potencial_impacto` | Licenciamento/impacto ambiental | Nao identificada | Restrita / Interna futura | Revisar antes de qualquer publicacao. |
| `faixa_dominio_20m` | Faixa de dominio | Nao identificada | Publica com revisao | Pode envolver rodovias/infraestrutura. |
| `geologia` | Geologia | Sim | Publica | Publicada como `layer_geologia`. |
| `imagens` | Imagens/catalogo | Nao identificada | Restrita | Verificar conteudo antes de publicar. |
| `lavra_mineracao` | Mineracao/lavra | Nao identificada | Publica com revisao / Restrita | Pode ter sensibilidade ambiental/licenciamento. |
| `locais` | Locais/equipamentos | A confirmar | Publica com revisao | Pode ser origem de locais de interesse. |
| `lotes` | Lotes urbanos | A confirmar | Publica com revisao | Pode ser origem/alternativa a `area_urbana`. |
| `lotes14000` | Lotes urbanos | A confirmar | Publica com revisao | Possivel versao historica/recorte. |
| `lotes_locais` | Lotes/localidades | A confirmar | Publica com revisao | Finalidade a confirmar. |
| `microbacias` | Microbacias | A confirmar | Publica | Relacionada a camadas ambientais. |
| `padrao_energia` | Padrao de energia | Nao identificada | Restrita / Interna futura | Dado operacional de infraestrutura. |
| `pavimentacao` | Pavimentacao urbana | A confirmar | Publica | Pode ser versao sem acento da camada publicada. |
| `pontos_saida_trans_coletivo` | Transporte coletivo | Nao identificada | Publica com revisao | Revisar atualidade. |
| `postes` | Postes | A confirmar | Interna futura | Relacionada a iluminacao publica. |
| `postes_ornamentais` | Postes ornamentais | Nao identificada | Interna futura | Candidata a modulo de iluminacao publica. |
| `quadras_energia` | Quadras/energia | Nao identificada | Restrita / Interna futura | Infraestrutura eletrica. |
| `rede_BT` | Rede eletrica baixa tensao | Nao identificada | Restrita | Infraestrutura sensivel. |
| `rede_agua_sanesul` | Rede de agua | Nao identificada | Restrita | Infraestrutura sensivel. |
| `rede_bt_subterranea` | Rede eletrica baixa tensao subterranea | Nao identificada | Restrita | Infraestrutura sensivel. |
| `rede_esgoto_2025_at` | Rede de esgoto atualizada | Sim | Publica com revisao / Restrita | Publicada como `layer_redeesgoto`; revisar exposicao. |
| `rede_mt` | Rede eletrica media tensao | Nao identificada | Restrita | Infraestrutura sensivel. |
| `rede_mt_particular` | Rede eletrica media tensao particular | Nao identificada | Restrita | Infraestrutura sensivel. |
| `rede_mt_subterranea` | Rede eletrica media tensao subterranea | Nao identificada | Restrita | Infraestrutura sensivel. |
| `rodovias_ms` | Rodovias estaduais | Nao identificada | Publica | Revisar origem oficial. |
| `rota1` | Rota | Nao identificada | Publica com revisao | Finalidade a confirmar. |
| `rota2` | Rota | Nao identificada | Publica com revisao | Finalidade a confirmar. |
| `rota3` | Rota | Nao identificada | Publica com revisao | Finalidade a confirmar. |
| `sanesul_Ligacoes` | Ligacoes de saneamento/agua | Nao identificada | Restrita | Pode conter dados individualizados. |
| `sanesul_lotes` | Lotes relacionados a saneamento | Nao identificada | Restrita | Revisar dados cadastrais/operacionais. |
| `setores_IPTU` | Setores IPTU | Nao identificada | Restrita / Publica com revisao | Pode conter informacao fiscal/cadastral. |
| `solo` | Solo | A confirmar | Publica | Verificar relacao com `tipos_solo_at`. |
| `tipologia` | Tipologia/uso | Nao identificada | Publica com revisao | Finalidade a confirmar. |
| `tipos_solo_at` | Tipos de solo | Sim | Publica | Publicada como `layer_tipos_solo`. |
| `unidades_conservacao_amambai` | Unidades de conservacao | A confirmar | Publica | Relacionada a `UCs Amambai`. |
| `uso_solo_rural` | Uso do solo rural | Nao identificada | Publica com revisao | Revisar fonte e sensibilidade. |
| `veg_dissolvido` | Vegetacao | Nao identificada | Publica | Finalidade ambiental. |
| `veg_dissolvido2` | Vegetacao | Nao identificada | Publica | Possivel versao alternativa. |
| `vegetacao_amambai` | Vegetacao | Nao identificada | Publica | Finalidade ambiental. |
| `zonemaento` | Zoneamento | Nao identificada | Publica com revisao | Nome parece conter erro de grafia; confirmar uso. |

### Schema `web_map`

| Tabela | Tipo/uso provavel | Publicada no front-end? | Sensibilidade inicial | Observacoes |
|---|---|---|---|---|
| Varias copias de tabelas do `plano` | Publicacao/sincronizacao | A confirmar | Conforme camada | O schema parece espelhar dados para o Geoportal/GeoServer. |
| `Farmacias` | Farmacias | Sim | Publica com revisao | Publicada como `layer_farmacias`; nome real pode conter acento. |
| `Postes - IDs - AU` | Postes publicados | Sim | Publica com revisao / Interna futura | Usada no front-end para busca e popup de postes. |
| `Convergencia de fluxo de agua` | Ambiental/hidrologia | Sim | Publica | Publicada como camada ambiental; nome real pode conter acento. |
| `Microbacias area urbana` | Ambiental urbana | Sim | Publica | Publicada como `layer_microbacias_urbana`; nome real pode conter acento. |
| `Rede de drenagem urbana` | Drenagem | Sim | Publica com revisao | Publicada como `layer_drenagem_urbana`. |
| `UCs Amambai` | Unidades de conservacao | Sim | Publica | Publicada como `layer_unidades_conservacao`. |
| `cs` | A confirmar | A confirmar | A confirmar | Finalidade nao inferida. |
| `fazendasgeral` | Imoveis/fazendas | A confirmar | Publica com revisao / Restrita | Revisar relacao com busca rural. |
| `area_urbana_hist_1` | Historico de `area_urbana` | Nao diretamente | Restrita | Nao publicar diretamente. |
| `area_urbana_hist_2` | Historico de `area_urbana` | Nao diretamente | Restrita | Nao publicar diretamente. |
| `area_urbana_hist_3` | Historico de `area_urbana` | Nao diretamente | Restrita | Nao publicar diretamente. |
| `EdificacoesDB_hist_1` | Historico de `EdificacoesDB` | Nao diretamente | Restrita | Nao publicar diretamente. |
| `EdificacoesDB_hist_2` | Historico de `EdificacoesDB` | Nao diretamente | Restrita | Nao publicar diretamente. |
| `EdificacoesDB_hist_3` | Historico de `EdificacoesDB` | Nao diretamente | Restrita | Nao publicar diretamente. |

### Schema `public`

| Tabela/objeto | Tipo/uso provavel | Publicada no front-end? | Sensibilidade inicial | Observacoes |
|---|---|---|---|---|
| Objetos PostGIS | Extensao espacial | Nao | Tecnica | Inclui metadados e funcoes de suporte. |
| Objetos `postgis_topology` | Extensao topology | Nao | Tecnica | Relacionado ao schema `topology`. |
| Objetos `postgres_fdw` | Foreign data wrapper | Nao | Sensivel | Revisar servidor externo, user mappings e permissoes sem documentar credenciais. |
| Outros objetos gerais | A confirmar | A confirmar | A confirmar | Completar com consulta direta ao banco. |

## 7. Tabelas publicadas x universo do banco

`docs/LAYER-INVENTORY.md` representa o que esta publicado ou consumido pelo front-end/GeoServer.

`docs/DATABASE-INVENTORY.md` representa o universo maior do banco. Nem toda tabela no banco deve ser publicada.

Regras:

- tabelas sensiveis devem ir para view publica controlada, API autenticada ou modulo interno;
- tabelas operacionais nao devem ser expostas diretamente por WMS/WFS publico;
- o GeoServer deve consumir preferencialmente views revisadas quando houver risco de campos indevidos;
- WFS deve ser restrito quando nao for necessario ao front-end publico.

## 8. Sensibilidade inicial por grupo de dados

| Grupo | Exemplos | Sensibilidade inicial | Revisao necessaria |
|---|---|---|---|
| Cadastro urbano | `area_urbana`, `lotes`, `EdificacoesDB` | Publica com revisao | Revisar campos cadastrais, identificadores e atributos exibidos. |
| Infraestrutura | rede de agua, esgoto, drenagem, energia, postes | Publica com revisao / Restrita | Evitar exposicao direta de redes sensiveis; preferir views simplificadas. |
| Ambiental | bacias, rios, solo, geologia, unidades de conservacao | Publica | Confirmar fonte oficial e atualizacao. |
| Fundiario/rural | SIGEF, SNCI, fazendas, chacaras | Publica com revisao / Restrita | Revisar dados fundiarios e campos sensiveis. |
| Servicos publicos | coleta, saude, educacao, assistencia social, prefeitura | Publica com revisao | Revisar contatos, enderecos e atualizacao. |
| Risco/licenciamento | `areas_risco`, `empreendimentos_potencial_impacto`, `lavra_mineracao` | Restrita / Publica com revisao | Publicar somente apos avaliacao juridica/tecnica. |
| Operacional futura | iluminacao publica, alvaras, viabilidade, meio ambiente, limpeza de lotes | Interna futura | Requer API, login, permissoes e auditoria. |

## 9. Pontos de atencao de seguranca

- [ ] Revisar permissoes dos schemas `plano` e `web_map`.
- [ ] Garantir que o GeoServer use usuario de menor privilegio.
- [ ] Revisar WFS para camadas que nao precisam expor atributos.
- [ ] Evitar publicacao direta de tabelas operacionais.
- [ ] Usar views publicas controladas.
- [ ] Revisar tabelas de infraestrutura.
- [ ] Revisar tabelas fundiarias/rurais.
- [ ] Revisar tabelas de risco/licenciamento.
- [ ] Revisar FDW/`postgres_fdw` e user mappings.
- [ ] Nao documentar nem versionar senhas.
- [ ] Rotacionar credenciais caso tenham sido expostas em backup convertido.

## 10. Consultas SQL recomendadas para completar o inventario

Listar tabelas por schema:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'plano', 'web_map', 'topology')
  and table_type = 'BASE TABLE'
order by table_schema, table_name;
```

Listar colunas e tipos:

```sql
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema in ('plano', 'web_map')
order by table_schema, table_name, ordinal_position;
```

Listar geometrias:

```sql
select f_table_schema, f_table_name, f_geometry_column, type, srid
from public.geometry_columns
where f_table_schema in ('plano', 'web_map')
order by f_table_schema, f_table_name;
```

Listar permissoes:

```sql
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema in ('plano', 'web_map')
order by table_schema, table_name, grantee, privilege_type;
```

Identificar tabelas sem chave primaria:

```sql
select n.nspname as schema_name, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname in ('plano', 'web_map')
  and not exists (
    select 1
    from pg_index i
    where i.indrelid = c.oid
      and i.indisprimary
  )
order by n.nspname, c.relname;
```

Identificar tabelas publicadas em `web_map`:

```sql
select table_name
from information_schema.tables
where table_schema = 'web_map'
  and table_type = 'BASE TABLE'
order by table_name;
```

Cruzar tabelas `plano` x `web_map`:

```sql
select
  p.table_name as plano_table,
  w.table_name as web_map_table
from information_schema.tables p
full outer join information_schema.tables w
  on lower(p.table_name) = lower(w.table_name)
 and w.table_schema = 'web_map'
where p.table_schema = 'plano'
   or w.table_schema = 'web_map'
order by coalesce(p.table_name, w.table_name);
```

## 11. Relacao com documentos existentes

Este documento complementa:

- `docs/LAYER-INVENTORY.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/GEOPORTAL-MATURITY-CHECKLIST.md`;
- `docs/FRONTEND-ARCHITECTURE.md`;
- futuro `docs/INTERNAL-MODULES-ARCHITECTURE.md`;
- futuro `docs/MODULE-ILUMINACAO-PUBLICA.md`.

## 12. Proximos passos

- [ ] Gerar relatorios SQL diretos do banco.
- [ ] Confirmar tipo geometrico e SRID de cada tabela.
- [ ] Cruzar `web_map` com camadas realmente publicadas no GeoServer.
- [ ] Cruzar camadas publicadas com `docs/LAYER-INVENTORY.md`.
- [ ] Revisar permissoes dos schemas `plano` e `web_map`.
- [ ] Definir quais tabelas devem permanecer publicas.
- [ ] Definir quais tabelas devem virar views publicas.
- [ ] Definir quais tabelas devem ficar restritas/internas.
- [ ] Priorizar modulo piloto de iluminacao publica.
- [ ] Planejar schemas operacionais futuros.
