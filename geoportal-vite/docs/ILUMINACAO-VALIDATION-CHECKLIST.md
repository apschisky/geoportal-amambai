# Checklist de Validacao do Modulo de Iluminacao Publica

## 1. Objetivo

Este documento orienta a reuniao com o setor responsavel por Iluminacao Publica / Manutencao de Postes.

O objetivo e validar o fluxo operacional real antes de criar banco, API, painel interno ou regras de permissao. A validacao evita que o Geoportal implemente protocolo, status, campos ou telas com regras diferentes da rotina do setor.

Situacao: houve preenchimento inicial do fluxo em documento auxiliar `.docx`. As decisoes abaixo sao preliminares e devem ser confirmadas antes de qualquer implementacao, SQL, API ou mudanca no Geoportal publico.

## 2. Principios da reuniao

- Manter o fluxo simples na primeira versao.
- Evitar excesso de campos.
- Validar o processo real do setor.
- Preservar o Geoportal publico funcionando.
- Manter o Google Forms como fallback ate o modulo proprio estar estavel.
- Priorizar protocolo, status, auditoria e painel interno basico.
- Nao definir detalhes tecnicos finais sem validacao operacional.

## 3. Escopo da primeira versao

Escopo inicial sugerido:

- cidadao solicita reparo pelo Geoportal;
- solicitacao gera protocolo;
- setor visualiza solicitacao em painel interno;
- setor atualiza status;
- equipe registra execucao;
- cidadao consulta andamento basico;
- gestor acompanha indicadores simples.

Fora do escopo inicial:

- aplicativo mobile dedicado;
- integracao automatica com outros sistemas;
- pagamento/custos detalhados;
- ordens de servico complexas;
- automacoes avancadas;
- publicacao de dados pessoais no mapa publico.

## 4. Fluxo atual

Perguntas para levantar:

- Como o cidadao solicita reparo hoje?
- Quem recebe as solicitacoes do Google Forms?
- Quem faz a triagem?
- Quem executa o servico?
- Como o setor sabe que o servico foi concluido?
- Existe controle de prazo?
- Existe planilha, WhatsApp, sistema ou outro controle paralelo?
- Quais problemas acontecem no fluxo atual?

## 5. Fluxo futuro proposto

Fluxo inicial para validacao:

1. Cidadao clica no poste no Geoportal.
2. Cidadao abre "Solicitar Reparo".
3. Sistema ja leva o ID do poste e coordenada.
4. Cidadao informa tipo de problema e descricao.
5. Sistema gera protocolo.
6. Solicitacao entra como Aberta.
7. Atendente faz triagem.
8. Solicitacao e Encaminhada ou Indeferida.
9. Equipe executa.
10. Atendimento e Resolvido ou Cancelado.
11. Historico fica auditado.
12. Cidadao consulta status pelo protocolo.

Perguntas:

- Fluxo proposto: faz sentido inicialmente.
- Pode haver atualizacao no mapa como parte do fluxo futuro.
- Triagem: pode ser feita pela propria equipe de manutencao junto com secretario ou chefe de setor.
- Responsaveis: equipe de manutencao com secretario/chefe de setor.

## 6. Status da solicitacao

Status iniciais sugeridos:

- Aberta
- Em triagem
- Encaminhada
- Em execucao
- Aguardando material
- Nao localizado
- Resolvida
- Indeferida
- Cancelada

Decisoes preliminares:

- "Aguardando material" e interessante para o fluxo interno.
- "Aguardando equipe" nao parece necessario inicialmente.
- "Nao localizado" deve existir.
- Cancelada: quando for falso chamado.
- Indeferida: quando nao houver seguranca para executar o servico ou outra justificativa definida.
- Finalizacao: equipe responsavel, gestor ou administrador.

## 7. Tipos de problema

Tipos iniciais sugeridos:

- Lampada apagada
- Lampada piscando
- Lampada acesa durante o dia
- Poste danificado
- Braco/luminaria danificada
- Fiacao aparente
- Outro

Perguntas:

- Tipos iniciais mantidos.
- Prioridade deve considerar seguranca da populacao, seguranca da equipe de manutencao, transito e necessidade de insumos.
- Foto pode ser exigida ou recomendada em situacoes mais delicadas.

## 8. Campos do formulario publico

Campos minimos sugeridos:

- ID do poste
- coordenada
- tipo de problema
- descricao
- ponto de referencia
- indicacao do poste mais proximo, quando o cidadao nao localizar o poste correto
- nome do solicitante opcional
- contato opcional
- foto nao prevista na primeira versao

Decisoes preliminares:

- Nome nao deve ser obrigatorio.
- Contato nao deve ser obrigatorio.
- Foto nao deve entrar na primeira versao.
- Mensagem ao cidadao: "Solicitacao realizada. Protocolo no IP-AAAA-NNNNNN."

## 9. Protocolo

Perguntas:

- Qual formato de protocolo e desejado?
- Deve conter ano?
- Deve conter prefixo, como IP-2026-000001?
- O cidadao deve receber protocolo na tela?
- Deve receber por e-mail/WhatsApp futuramente?
- O protocolo deve permitir consulta publica sem login?

Decisoes preliminares:

- usar formato sequencial com ano, por exemplo: IP-2026-000001;
- conter prefixo para diferenciar futuros servicos;
- conter ano;
- aparecer na tela apos envio;
- permitir consulta publica sem login, com protecao contra enumeracao/rate limit;
- avaliar envio futuro por e-mail/WhatsApp, sem obrigatoriedade na primeira versao.

## 10. Dados pessoais e LGPD

Pontos para validar:

- coletar apenas dados necessarios;
- nao exibir nome/contato no mapa publico;
- limitar acesso interno aos dados pessoais;
- informar finalidade da coleta;
- definir se o cidadao pode solicitar anonimamente.

Perguntas:

- Nome nao deve ser obrigatorio.
- Contato nao deve ser obrigatorio.
- Contato pode ser util se o poste nao for localizado ou faltar informacao.
- Dados pessoais devem ficar armazenados pelo minimo necessario.
- Sugestao inicial: manter ate a finalizacao do chamado, sujeito a validacao juridica/LGPD.
- Apenas gestor e administrador devem visualizar dados pessoais.

## 11. Perfis e permissoes

Perfis sugeridos:

- Atendente/Triagem
- Equipe de Campo
- Gestor do Modulo
- Administrador
- Auditor/Consulta

Perguntas:

- Atendente/Triagem e Equipe de Campo podem ser a mesma pessoa na primeira versao.
- Equipe de campo, gestor e administrador veem todas as solicitacoes.
- Equipe de campo, gestor e administrador podem alterar status e finalizar.
- Gestor e administrador podem cancelar/indeferir.
- Equipe de campo, gestor e administrador podem anexar foto.
- Gestor e administrador podem ver dados pessoais.
- Administrador e auditor podem consultar auditoria.

## 12. Painel interno

Telas a validar:

- painel inicial com resumo;
- lista de solicitacoes;
- mapa operacional;
- detalhe da solicitacao;
- alteracao de status;
- anexos;
- indicadores simples.

Decisoes preliminares:

- Lista de solicitacoes e suficiente na primeira versao.
- Mapa operacional e essencial desde o inicio.
- Mapa deve indicar postes/solicitacoes em diferentes estados.
- Todos os filtros sugeridos sao uteis inicialmente.
- Indicadores uteis: tipo de problema, regiao e reincidencia por poste.

Filtros sugeridos:

- status;
- periodo;
- tipo de problema;
- prioridade;
- bairro/regiao;
- poste_id;
- protocolo.

## 13. Mapa operacional

Perguntas:

- O setor precisa ver solicitacoes abertas no mapa.
- Deve mostrar reincidencia por poste.
- Deve ter cores por status.
- Deve permitir filtro por periodo.
- Nao deve mostrar dados pessoais.

## 14. Prazos e prioridade

Perguntas:

- Prazo ideal deve existir, mas pode nao ser formalizado no inicio.
- Existem solicitacoes urgentes.
- Prioridade alta para casos envolvendo seguranca publica ou transito.
- Sistema deve alertar solicitacoes paradas ha mais de 15 dias.
- Prazo inicial para considerar atrasada: 15 dias.

## 15. Anexos e fotos

Perguntas:

- Cidadao nao envia foto na primeira versao.
- Equipe pode enviar foto antes/depois somente em casos mais graves.
- Tipo inicial aceito: jpg.
- Tamanho maximo inicial: 5 MB.
- Equipe, gestor e administrador podem visualizar anexos.
- E aceitavel iniciar sem upload publico e adicionar depois.

## 16. Consulta publica de protocolo

Decisoes preliminares:

- Cidadao deve consultar status pelo protocolo.
- Retorno publico deve mostrar apenas protocolo, status publico, data de abertura, ultima atualizacao e mensagem simples.
- Nao mostrar previsao inicialmente.
- Ocultar historico interno.

## 17. Indicadores para gestao

Indicadores sugeridos:

- solicitacoes abertas;
- solicitacoes resolvidas;
- tempo medio de atendimento;
- solicitacoes por tipo;
- solicitacoes por regiao;
- reincidencia por poste;
- atrasadas.

Decisoes preliminares:

- Indicadores uteis: solicitacoes por tipo, solicitacoes por regiao e reincidencia por poste.
- Relatorio/exportacao nao e necessario no inicio.
- Periodo de analise mais usado: semanal.

## 18. Fallback e transicao

- Google Forms deve continuar ativo ate o modulo proprio estar estavel.
- Botao publico do Geoportal so deve mudar apos teste.
- Deve existir plano de voltar para o Forms se houver problema.
- Integracao publica deve ser gradual.

Perguntas:

- Google Forms continua ativo ate o modulo proprio estar estavel.
- Se for facil retornar ao Forms em caso de inconsistencia, a troca pode ocorrer apos testes.
- Validacao da troca definitiva: Prefeito.
- Setor aceita testar primeiro internamente.

## 19. Decisoes que precisam sair da reuniao

- [ ] fluxo aprovado;
- [ ] status aprovados;
- [ ] tipos de problema aprovados;
- [ ] campos publicos aprovados;
- [ ] necessidade de nome/contato definida;
- [ ] protocolo definido;
- [ ] perfis aprovados;
- [ ] permissoes principais aprovadas;
- [ ] necessidade de anexos definida;
- [ ] filtros essenciais definidos;
- [ ] indicadores essenciais definidos;
- [ ] responsaveis por triagem/execucao/finalizacao definidos;
- [ ] fallback com Google Forms confirmado.

## 20. Pendencias tecnicas apos a reuniao

- ajustar `docs/MODULE-ILUMINACAO-PUBLICA.md` se o fluxo mudar;
- ajustar `docs/API-ENDPOINTS-ILUMINACAO.md` se endpoints/payloads mudarem;
- ajustar `docs/POSTGIS-SCHEMA-PLAN.md` se campos/status mudarem;
- ajustar `docs/AUTH-PERMISSIONS-PLAN.md` se perfis/permissoes mudarem;
- ajustar `docs/INTERNAL-DASHBOARD-UX.md` se telas/filtros mudarem;
- so depois preparar SQL de homologacao.

## 21. Relacao com documentos existentes

- `docs/MODULE-ILUMINACAO-PUBLICA.md`
- `docs/API-ENDPOINTS-ILUMINACAO.md`
- `docs/POSTGIS-SCHEMA-PLAN.md`
- `docs/AUTH-PERMISSIONS-PLAN.md`
- `docs/INTERNAL-DASHBOARD-UX.md`
- `docs/SQL-MIGRATION-PLAN.md`
- `docs/DOCUMENTATION-GOVERNANCE.md`
