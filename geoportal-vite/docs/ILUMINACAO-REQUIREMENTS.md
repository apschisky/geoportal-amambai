# Requisitos do Módulo de Iluminação Pública

## 1. Objetivo

Este documento consolida os requisitos mínimos da primeira versão do módulo de Iluminação Pública / Manutenção de Postes, antes de qualquer implementação em banco, API ou painel interno.

O objetivo é transformar as decisões preliminares registradas no checklist de validação operacional em uma base clara para revisão, homologação e evolução gradual, sem interromper o Geoportal público em produção.

## 2. Princípios do módulo

- Preservar o Geoportal público funcionando.
- Desenvolver primeiro em homologação.
- Manter Google Forms como fallback até estabilidade comprovada.
- Não expor dados pessoais no mapa público.
- Aplicar menor privilégio.
- Auditar ações internas.
- Validar permissões no servidor.
- Evitar complexidade excessiva na primeira versão.
- Priorizar protocolo, status, mapa operacional, histórico e rastreabilidade.

## 3. Escopo da primeira versão

- Solicitação pública de reparo a partir do Geoportal.
- Captura do ID do poste e coordenada.
- Campo de tipo de problema.
- Descrição.
- Ponto de referência.
- Indicação de poste mais próximo quando o cidadão não localizar o poste correto.
- Geração de protocolo.
- Consulta pública simples por protocolo.
- Painel interno com lista de solicitações.
- Mapa operacional.
- Alteração de status.
- Histórico/auditoria.
- Filtros básicos.
- Indicadores simples.

## 4. Fora do escopo inicial

- Aplicativo mobile dedicado.
- Login do cidadão.
- Upload público de foto na primeira versão.
- Integração automática com WhatsApp/e-mail.
- Ordens de serviço complexas.
- Custos detalhados.
- Integração automática com almoxarifado.
- Retirada imediata do Google Forms.
- Exposição de dados pessoais no mapa público.
- Automações avançadas antes da estabilização.

## 5. Fluxo operacional mínimo

1. Cidadão acessa o Geoportal.
2. Cidadão clica em um poste ou acessa a solicitação de reparo.
3. Sistema leva ID do poste e coordenada quando possível.
4. Cidadão informa tipo de problema, descrição e ponto de referência.
5. Caso não encontre o poste correto, informa o poste mais próximo ou referência.
6. Sistema gera protocolo.
7. Solicitação entra como Aberta.
8. Equipe/atendente faz triagem.
9. Solicitação pode ser encaminhada, indeferida, cancelada, marcada como não localizada ou aguardando material.
10. Equipe executa o serviço.
11. Equipe/gestor/admin finaliza.
12. Cidadão consulta andamento básico pelo protocolo.
13. Gestor acompanha mapa e indicadores.

A triagem pode ser feita pela equipe de manutenção junto com secretário ou chefe de setor.

## 6. Status da solicitação

Status preliminares:

- Aberta
- Em triagem
- Encaminhada
- Em execução
- Aguardando material
- Não localizado
- Resolvida
- Indeferida
- Cancelada

Regras:

- "Cancelada" pode ser usada para falso chamado ou duplicidade evidente.
- "Indeferida" pode ser usada quando não houver segurança para executar ou quando a solicitação não for de competência do setor.
- "Não localizado" deve ser usado quando o poste/problema não for encontrado.
- "Aguardando material" deve indicar pendência de insumos.
- Finalização pode ser feita pela equipe responsável, gestor ou administrador.

## 7. Tipos de problema

Tipos iniciais:

- Lâmpada apagada
- Lâmpada piscando
- Lâmpada acesa durante o dia
- Poste danificado
- Braço/luminária danificada
- Fiação aparente
- Outro

Observações:

- Casos envolvendo segurança pública, trânsito, risco à população ou risco à equipe podem receber prioridade alta.
- Foto pode ser recomendada em situações graves, mas não deve ser obrigatória no formulário público da primeira versão.

## 8. Campos do formulário público

Campos mínimos:

- `localizacao_tipo`
- `poste_id`
- `coordenada`
- `tipo_problema`
- `descricao`
- `ponto_referencia`
- `poste_proximo_informado`
- `nome_solicitante`
- `contato_solicitante`

Regras:

- Nome e contato sao obrigatorios na primeira versao sem login.
- Nome e contato sao usados para retorno/esclarecimento e nao devem aparecer no mapa publico.
- Foto pública não entra na primeira versão.
- Descrição deve ter limite de tamanho.
- Entrada deve ser validada no servidor.
- Campos vindos do Geoportal não devem ser aceitos cegamente sem validação pela API.

Fluxo de localizacao manual:

- Quando o poste nao estiver no mapa, o fluxo deve oferecer "O poste nao esta no mapa? Marcar local do poste".
- O cidadao deve posicionar um pin manualmente.
- A coordenada marcada manualmente deve ser usada quando o poste nao estiver cadastrado ou nao for encontrado.

Mensagem sugerida ao cidadão:

> Solicitação realizada. Protocolo nº IP-AAAA-NNNNNN.

## 9. Protocolo

Formato preliminar:

- `IP-AAAA-NNNNNN`
- Exemplo: `IP-2026-000001`

Requisitos:

- Deve conter prefixo do serviço.
- Deve conter ano.
- Deve ser exibido após envio.
- Deve permitir consulta pública sem login.
- Deve ter proteção contra enumeração.
- Endpoint público deve ter rate limit.
- Envio futuro por WhatsApp/e-mail pode ser avaliado, mas não é obrigatório na primeira versão.

Perguntas técnicas a resolver antes da implementação:

- O sequencial será global por ano ou por módulo?
- O protocolo será gerado no banco ou na API?
- Como evitar colisão em requisições simultâneas?
- Qual mensagem pública será exibida para protocolo inexistente sem facilitar enumeração?

## 10. Consulta pública por protocolo

Retorno público permitido:

- protocolo
- status público
- data de abertura
- última atualização
- mensagem simples

Não retornar:

- nome do solicitante;
- contato;
- histórico interno completo;
- observações internas;
- usuário responsável;
- anexos internos;
- detalhes técnicos do banco/API.

Perguntas para validação:

- A consulta pública deve mostrar previsão de atendimento no futuro?
- Quais status internos devem ser agrupados em mensagens públicas mais simples?

## 11. Dados pessoais e LGPD

Requisitos:

- Coletar o mínimo necessário.
- Nome e contato são opcionais.
- Dados pessoais não aparecem no mapa público.
- Dados pessoais só podem ser acessados por perfis autorizados.
- Registrar finalidade da coleta.
- Evitar exportação indiscriminada.
- Definir retenção mínima.

Decisão preliminar:

- Dados pessoais devem ficar armazenados pelo menor tempo necessário, inicialmente até a finalização do chamado, sujeito a validação jurídica/LGPD.

Perguntas para validação jurídica:

- Qual prazo oficial de retenção?
- O cidadão pode solicitar atendimento anônimo?
- O texto do formulário precisa de aceite/ciência de finalidade?
- Quem é responsável por responder solicitações de acesso/remoção de dados?

## 12. Perfis e permissões

Perfis iniciais:

- Atendente/Triagem
- Equipe de Campo
- Gestor do Módulo
- Administrador
- Auditor/Consulta

Decisões preliminares:

- Atendente/Triagem e Equipe de Campo podem ser a mesma pessoa na primeira versão.
- Equipe de campo, gestor e administrador podem ver todas as solicitações.
- Equipe de campo, gestor e administrador podem alterar status e finalizar.
- Gestor e administrador podem cancelar/indeferir.
- Equipe de campo, gestor e administrador podem anexar foto.
- Gestor e administrador podem ver dados pessoais.
- Administrador e auditor podem consultar auditoria.

| Ação | Atendente/Triagem | Equipe de Campo | Gestor | Administrador | Auditor |
|---|---|---|---|---|---|
| Listar solicitações | Sim | Sim | Sim | Sim | Limitado |
| Ver detalhe | Sim | Sim | Sim | Sim | Limitado |
| Ver dados pessoais | Não | Não | Sim | Sim | Não |
| Alterar status | Sim | Sim | Sim | Sim | Não |
| Finalizar | Não | Sim | Sim | Sim | Não |
| Cancelar/indeferir | Não | Não | Sim | Sim | Não |
| Anexar foto | Não | Sim | Sim | Sim | Não |
| Ver auditoria | Não | Não | Não | Sim | Sim |
| Gerenciar usuários | Não | Não | Não | Sim | Não |

## 13. Painel interno

Requisitos mínimos:

- Lista de solicitações.
- Filtros.
- Detalhe da solicitação.
- Alteração de status.
- Mapa operacional.
- Indicadores simples.

Filtros úteis:

- status;
- período;
- tipo de problema;
- prioridade;
- bairro/região;
- poste_id;
- protocolo.

Perguntas de UX:

- Quais colunas são indispensáveis na lista?
- A tela inicial deve abrir em lista ou mapa?
- O setor precisa exportar CSV/PDF futuramente?
- O painel deve destacar atrasadas automaticamente?

## 14. Mapa operacional

Requisitos:

- Mostrar solicitações abertas no mapa.
- Mostrar cores por status.
- Permitir filtro por período.
- Indicar reincidência por poste.
- Não mostrar dados pessoais.
- Permitir abrir detalhe da solicitação a partir do mapa.

Perguntas de avanço:

- Quais cores devem representar cada status?
- A reincidência será calculada por quantidade de chamados no mesmo poste em determinado período?
- Deve haver camada separada para solicitações atrasadas?
- O mapa interno deve usar GeoServer, API GeoJSON ou ambos?

## 15. Prazos e prioridade

Decisões preliminares:

- Prazo ideal deve existir, mas pode não ser formalizado no início.
- Existem solicitações urgentes.
- Prioridade alta para casos envolvendo segurança pública ou trânsito.
- Alertar solicitações paradas há mais de 15 dias.
- Prazo inicial para considerar atrasada: 15 dias.

Requisitos:

- Campo de prioridade.
- Cálculo de dias parados.
- Indicador de atraso.
- Filtro de atrasadas.

Perguntas:

- O prazo de 15 dias vale para todos os tipos?
- Casos de segurança devem ter prazo menor?
- Aguardando material pausa o prazo ou continua contando?
- "Não localizado" encerra ou suspende o chamado?

## 16. Anexos e fotos

Decisões preliminares:

- Cidadão não envia foto na primeira versão.
- Equipe pode enviar foto antes/depois apenas em casos mais graves.
- Tipo inicial aceito: jpg.
- Tamanho máximo inicial: 5 MB.
- Equipe, gestor e administrador podem visualizar anexos.
- Upload público pode ser adicionado em etapa futura.

Requisitos de segurança:

- Validar extensão e MIME type.
- Limitar tamanho.
- Não expor caminho físico.
- Armazenar metadados.
- Planejar varredura antivírus.
- Controlar acesso por perfil.
- Registrar upload em auditoria.

Perguntas:

- Fotos internas devem ser obrigatórias em caso de poste danificado ou fiação aparente?
- Onde os anexos serão armazenados na homologação?
- Qual política de retenção dos anexos?

## 17. Indicadores mínimos

Indicadores iniciais:

- solicitações abertas;
- solicitações resolvidas;
- solicitações por tipo;
- solicitações por região;
- reincidência por poste;
- atrasadas;
- tempo médio de atendimento.

Decisão preliminar:

- Relatório/exportação não é necessário no início.
- Período de análise mais usado: semanal.

Perguntas:

- O gestor precisa de visão mensal além da semanal?
- O indicador de tempo médio deve ignorar chamados cancelados/indeferidos?
- Como tratar chamados "Aguardando material"?

## 18. Integração com Geoportal público

Requisitos:

- Manter botão atual com Google Forms até módulo próprio estar estável.
- Substituição deve ser gradual.
- Deve existir fallback para voltar ao Forms.
- Camada pública de postes continua sendo base visual.
- Integração futura deve preservar popup, rota e busca de postes.
- Qualquer alteração pública deve ser testada em homologação antes de produção.

## 19. Integração com API futura

Requisitos conceituais:

- Endpoints públicos para criar solicitação e consultar protocolo.
- Endpoints internos autenticados para listar, detalhar, alterar status, anexar, finalizar e cancelar.
- Validação no servidor.
- Rate limit nos endpoints públicos.
- Autenticação e autorização nos endpoints internos.
- Auditoria em ações internas.
- Respostas públicas sem dados sensíveis.

Decisão preliminar: para a primeira homologação, a arquitetura tende a usar rotas no mesmo domínio, como `/api` e `/interno`, por simplicidade operacional, menor complexidade inicial de DNS/certificado e menor risco de CORS. A arquitetura deve permanecer preparada para futura separação por subdomínios, se necessário.

Referência: `docs/API-ENDPOINTS-ILUMINACAO.md`.

## 20. Integração com PostGIS futuro

Requisitos conceituais:

- Criar schema próprio do módulo, como `mod_iluminacao`.
- Não gravar operação em `web_map`.
- Solicitações devem referenciar `poste_id` quando houver poste selecionado no mapa.
- Dados pessoais não devem aparecer em views públicas.
- Criar histórico/auditoria.
- Criar índices por status, protocolo, `poste_id`, data e geometria.
- Criar views controladas para painel e, se necessário, visualização pública.

Referência: `docs/POSTGIS-SCHEMA-PLAN.md`.

## 21. Segurança mínima obrigatória

- HTTPS obrigatório.
- Credenciais fora do Git.
- Sem superuser em aplicação.
- Usuário do GeoServer somente leitura.
- Usuário da API com menor privilégio.
- Validação de entrada.
- Rate limit.
- Logs e auditoria.
- Tratamento genérico de erro público.
- Proteção contra enumeração de protocolo.
- Backups antes de migrations.
- Homologação antes de produção.

## 22. Critérios para iniciar SQL/API em homologação

- [ ] Requisitos mínimos aprovados.
- [ ] Status aprovados.
- [ ] Tipos de problema aprovados.
- [ ] Campos públicos aprovados.
- [ ] Formato de protocolo aprovado.
- [ ] Permissões aprovadas.
- [ ] Política de dados pessoais validada.
- [ ] Política de anexos definida.
- [ ] SRID operacional definido.
- [ ] Ambiente de homologação definido.
- [ ] Estratégia de rotas ou subdomínios definida.
- [ ] Rollback definido.
- [ ] Fallback com Google Forms confirmado.

## 23. Perguntas pendentes para amadurecimento

- O módulo deve futuramente permitir avaliação do atendimento pelo cidadão?
- A reincidência por poste deve gerar alerta automático?
- O painel deve indicar regiões com maior demanda?
- O sistema deve permitir planejamento preventivo de troca de lâmpadas?
- O módulo deve futuramente integrar inventário de luminárias, potência, tipo de lâmpada e consumo estimado?
- O módulo deve futuramente integrar ordem de serviço formal?
- O módulo deve futuramente permitir SLA por tipo de problema?
- O módulo deve futuramente publicar indicadores abertos, sem dados pessoais, para transparência?
- O módulo deve futuramente integrar outros serviços urbanos no mesmo padrão?
- Quais dados podem ser abertos ao cidadão sem comprometer segurança, privacidade ou operação?

## 24. Relação com documentos existentes

- `docs/MODULE-ILUMINACAO-PUBLICA.md`
- `docs/ILUMINACAO-VALIDATION-CHECKLIST.md`
- `docs/API-ENDPOINTS-ILUMINACAO.md`
- `docs/POSTGIS-SCHEMA-PLAN.md`
- `docs/AUTH-PERMISSIONS-PLAN.md`
- `docs/INTERNAL-DASHBOARD-UX.md`
- `docs/SQL-MIGRATION-PLAN.md`
- `docs/SECURITY-HARDENING-PLAN.md`
- `docs/DOCUMENTATION-GOVERNANCE.md`

## 25. Próximos passos

1. Revisar este documento com o setor responsável.
2. Atualizar documentos relacionados caso haja mudança.
3. Definir SRID operacional.
4. Definir homologação.
5. Definir rotas ou subdomínios para API/painel interno, mantendo `/api` e `/interno` como primeira opção de homologação.
6. Preparar primeira migration SQL apenas em homologação.
7. Preparar prova de conceito FastAPI apenas em homologação.
8. Testar sem alterar o Geoportal público.
9. Integrar ao botão público somente após estabilidade e fallback definido.
