# Checklist de Validacao do Modulo de Iluminacao Publica

## 1. Objetivo

Este documento orienta a reuniao com o setor responsavel por Iluminacao Publica / Manutencao de Postes.

O objetivo e validar o fluxo operacional real antes de criar banco, API, painel interno ou regras de permissao. A validacao evita que o Geoportal implemente protocolo, status, campos ou telas com regras diferentes da rotina do setor.

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

- Esse fluxo faz sentido?
- Alguma etapa esta faltando?
- Alguma etapa esta sobrando?
- Quem deve ser responsavel por cada etapa?

## 6. Status da solicitacao

Status iniciais sugeridos:

- Aberta
- Em triagem
- Encaminhada
- Em execucao
- Resolvida
- Indeferida
- Cancelada

Perguntas:

- Esses status representam o processo real?
- Precisa de "Aguardando material"?
- Precisa de "Aguardando equipe"?
- Precisa de "Nao localizado"?
- Quando uma solicitacao pode ser cancelada?
- Quando pode ser indeferida?
- Quem pode finalizar?

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

- Esses tipos estao corretos?
- Algum tipo deve ser removido?
- Algum tipo deve ser acrescentado?
- Algum tipo exige prioridade automatica?
- Algum tipo deve exigir foto?

## 8. Campos do formulario publico

Campos minimos sugeridos:

- ID do poste
- coordenada
- tipo de problema
- descricao
- nome do solicitante, opcional ou obrigatorio a definir
- contato, opcional ou obrigatorio a definir
- foto, opcional em fase futura

Perguntas:

- Nome deve ser obrigatorio?
- Contato deve ser obrigatorio?
- Foto deve ser permitida ja na primeira versao?
- Quais campos sao realmente necessarios?
- Que mensagem deve aparecer ao cidadao apos enviar?

## 9. Protocolo

Perguntas:

- Qual formato de protocolo e desejado?
- Deve conter ano?
- Deve conter prefixo, como IP-2026-000001?
- O cidadao deve receber protocolo na tela?
- Deve receber por e-mail/WhatsApp futuramente?
- O protocolo deve permitir consulta publica sem login?

Sugestao inicial:

- usar formato sequencial com ano, por exemplo: IP-2026-000001.

## 10. Dados pessoais e LGPD

Pontos para validar:

- coletar apenas dados necessarios;
- nao exibir nome/contato no mapa publico;
- limitar acesso interno aos dados pessoais;
- informar finalidade da coleta;
- definir se o cidadao pode solicitar anonimamente.

Perguntas:

- O setor realmente precisa do nome do cidadao?
- O setor realmente precisa do telefone?
- Por quanto tempo esses dados devem ficar armazenados?
- Quem pode visualizar dados pessoais?

## 11. Perfis e permissoes

Perfis sugeridos:

- Atendente/Triagem
- Equipe de Campo
- Gestor do Modulo
- Administrador
- Auditor/Consulta

Perguntas:

- Quem deve ver todas as solicitacoes?
- Quem pode alterar status?
- Quem pode finalizar?
- Quem pode cancelar/indeferir?
- Quem pode anexar foto?
- Quem pode ver dados pessoais?
- Quem pode consultar auditoria?

## 12. Painel interno

Telas a validar:

- painel inicial com resumo;
- lista de solicitacoes;
- mapa operacional;
- detalhe da solicitacao;
- alteracao de status;
- anexos;
- indicadores simples.

Perguntas:

- A lista e suficiente na primeira versao?
- O mapa operacional e essencial desde o inicio?
- Quais filtros sao indispensaveis?
- Quais indicadores sao uteis para gestao?

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

- O setor precisa ver solicitacoes abertas no mapa?
- Deve mostrar reincidencia por poste?
- Deve ter cores por status?
- Deve permitir filtro por periodo?
- Deve mostrar dados pessoais? A recomendacao e nao.

## 14. Prazos e prioridade

Perguntas:

- Existe prazo de atendimento?
- Existem solicitacoes urgentes?
- Algum tipo de problema deve gerar prioridade alta?
- O sistema deve alertar solicitacoes paradas ha muitos dias?
- Qual prazo para considerar atrasada?

## 15. Anexos e fotos

Perguntas:

- O cidadao deve enviar foto?
- A equipe deve enviar foto antes/depois?
- Quais tipos de arquivo aceitar?
- Qual tamanho maximo?
- Quem pode visualizar anexos?
- E aceitavel iniciar sem upload publico e adicionar depois?

Sugestao inicial:

- primeira versao pode comecar sem upload publico, mas permitir anexo interno controlado em etapa posterior.

## 16. Consulta publica de protocolo

Perguntas:

- O cidadao deve consultar o status pelo protocolo?
- Quais informacoes podem aparecer?
- Deve mostrar apenas status e data de atualizacao?
- Deve mostrar previsao?
- Deve ocultar historico interno?

Sugestao:

- mostrar apenas protocolo, status publico, data de abertura, ultima atualizacao e mensagem simples.

## 17. Indicadores para gestao

Indicadores sugeridos:

- solicitacoes abertas;
- solicitacoes resolvidas;
- tempo medio de atendimento;
- solicitacoes por tipo;
- solicitacoes por regiao;
- reincidencia por poste;
- atrasadas.

Perguntas:

- Quais indicadores realmente ajudam o setor?
- Precisa exportar relatorio?
- Qual periodo de analise e mais usado?

## 18. Fallback e transicao

- Google Forms deve continuar ativo ate o modulo proprio estar estavel.
- Botao publico do Geoportal so deve mudar apos teste.
- Deve existir plano de voltar para o Forms se houver problema.
- Integracao publica deve ser gradual.

Perguntas:

- Por quanto tempo manter o Forms em paralelo?
- Quem valida a troca definitiva?
- O setor aceita testar primeiro apenas internamente?

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
