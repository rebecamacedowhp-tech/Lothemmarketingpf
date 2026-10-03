# LOTHEM — Inteligência em Marketing

Sistema operacional da agência: **19 agentes de IA** (1 orquestrador + 18 especialistas) rodando no Claude Code.

## Como usar
Abra uma sessão do Claude Code neste repositório e peça o que precisa, em linguagem normal. O **Agente 0** (orquestrador) monta a equipe, executa, passa pelo QA e entrega só a versão final.

Comandos: `Agente 0` · `Chame o Diretor de Arte` (ou outro especialista) · `Passe pelo QA` · `Nível Diamante` · `Refaça`.

## Estrutura
| Caminho | O que é |
|---|---|
| `CLAUDE.md` | Agente 0 + regras da agência (carregado automaticamente) |
| `.claude/agents/` | Os 18 especialistas (subagentes) |
| `clientes/<cliente>/` | Memória por cliente: `perfil.md` e `feedback.md` |
| `clientes/_modelo/` | Modelo para cadastrar cliente novo |
| `prospector_colab_v3.ipynb` | Prospecção de leads via Google Maps (Colab) |
| `docs/referencias-vendas.md` | Referências e treinamentos de SDR e Closer usados nos Agentes 17 e 18 |
| `docs/squad-legado.md` | Versão anterior do squad (7 agentes), mantida como referência |

## Os agentes
00 Orquestrador · 01 Pesquisa & Insights · 02 Planejamento Estratégico · 03 Branding & Voz · 04 Copywriting · 05 Direção de Arte · 06 Audiovisual · 07 Social Media & Calendário · 08 Community & Relacionamento · 09 Tráfego Pago · 10 Prospecção · 11 Atendimento & Vendas · 12 Propostas & Precificação · 13 Presença Digital / Sites · 14 Métricas & Relatórios · 15 Financeiro & Contratos · 16 Operações & QA · 17 SDR · 18 Closer

Nenhuma ação externa (publicar, enviar, alterar campanha/orçamento/site, propostas, contratos) acontece sem aprovação explícita da Rebeca.
