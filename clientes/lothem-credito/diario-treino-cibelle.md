# Diário de treino da Cibelle (SDR IA da Lothem Crédito)

Aqui fica tudo o que decidimos sobre a Cibelle e cada teste de atendimento, para ela ficar no ponto. Cada teste entra com: a conversa, o que ficou bom, o que errou e o que mudou na base ou nas regras.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Instruções oficiais (prompt) e base | `clientes/lothem-credito/base-sdr-ia.md` → gera `crm/sdr-base-credito.js` |
| Treinamento de vendas do Diagnóstico (duas trilhas) | `clientes/lothem-credito/treinamento-venda-diagnostico.md` → gera `crm/sdr-treino-credito.js` · PDF em `docs/treinamento/Treinamento-Venda-Diagnostico-Cibelle.pdf` |
| Falas boas da aula de SDR (Luiz) | `docs/treinamento/Falas-do-SDR-Aula-Luiz.pdf` |
| Respostas aprovadas e scripts | `crm/sdr-kit.js` (CRED_OBJ, CRED_SCRIPT) |
| Regras do cliente | `clientes/lothem-credito/feedback.md` |
| Motor que responde no WhatsApp | `crm/api/_cibelle.mjs` (chamado por `crm/api/waha.mjs`) |
| Configuração em produção | Painel Mestre (rebeca.macedo.whp@gmail.com) › IA dos clientes › LOTHEM — Inteligência em Crédito · PJ |
| O que o cliente configura sozinho | CRM › SDR IA › Visão geral (modo de operação e atendimento automático) e IA e custos (chave, modelo, limite) |

## Decisões tomadas (13/10/2026)

1. **Duas entradas do Meta, duas trilhas.** "Já comprou o diagnóstico": não vende de novo; autorização, confirmação de dados, conversa de 30 min com a Rebeca. "Fez o quiz e não comprou": venda consultiva do Diagnóstico de R$ 97. O CRM marca no campo Entrada.
2. **Hormozi só no que é honesto:** resultado que o cliente quer, equação de valor, garantia aprovada (devolve os R$ 97 se o relatório não mostrar nada novo). Fora: escassez inventada, valores fictícios, "seria burrice não comprar".
3. **Da aula do Luiz entram:** confirmação de faturamento declarado, valor e finalidade do crédito, "o que te levou a buscar o diagnóstico", respostas para "pra que reunião", "não tenho tempo", "não tenho pendência". **Ficam fora:** escassez falsa, passar-se por outra pessoa, cobrança com mentira, pressão.
4. **Modo teste:** a Cibelle só responde os números da lista de teste. Clientes reais e os 89 leads que a Rebeca atende não recebem nada dela.
5. **Modo de operação:** Copiloto (só sugere), Supervisionado (envia e segura quando vai passar para a equipe), Autônomo (envia tudo). Recomendado para o teste: Supervisionado.
6. **Proteções do motor:** palavra proibida não sai (vira sugestão e passa para a equipe); erro da IA passa para a equipe; equipe respondeu nas últimas 12 h, a IA fica quieta; "Devolver para a Cibelle" religa.
7. **Chave:** cada empresa usa a própria chave (Anthropic ou OpenAI). Lothem Crédito PJ: Anthropic, Claude Sonnet 5.5.

## Pendências de decisão da Rebeca

- [ ] O R$ 149: no prompt v2 é "diagnóstico com reunião"; na base é o combo com a Rota de Crédito. Hoje vale a base.
- [ ] Copiloto ou automático por trilha (sugestão: automático no quiz, copiloto em quem já comprou).
- [ ] Integração quiz + Cakto para marcar a entrada sozinha.
- [ ] Termo de autorização das consultas (arquivo ou link).
- [ ] Agenda da Rebeca para a conversa de 30 min.
- [ ] Instagram oficial (enquanto vazio, a Cibelle não cita).

## Histórico do teste no WhatsApp

| Quando | O que aconteceu | Causa | Correção |
|---|---|---|---|
| 13/10 22:4x | Mensagem não chegou no CRM | primeira mensagem não foi repassada pela WAHA (webhook já estava configurado) | reenviada; a partir de 22:45 chegou |
| 13/10 22:48 | Chegou na PJ, a Cibelle não respondeu | chave marcada como "da Lothem"; o motor só aceitava "do cliente" | migração `20261013070000_motor_chave.sql`; opção "Chave da Lothem" removida do Painel Mestre |

## Testes de atendimento

Formato de cada teste:

### Teste N · data · trilha (quiz / comprou)
**Conversa** (como saiu no WhatsApp)
**Bom:**
**Errou:**
**Mudança feita:** (arquivo e o que mudou)
