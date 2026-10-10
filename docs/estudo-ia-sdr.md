# Estudo: qual IA usar na SDR do Lothem Vendas

Data: 10/10/2026. Preços em dólar por 1 milhão de tokens.

## 1. Quanto uma conversa de SDR consome (HIPÓTESE, a medir no piloto)

Base: a conversa de crédito da Cibelle (abertura → qualificação → oferta → link → pagamento → autorização → agenda).

| Item | Estimativa |
|---|---|
| Mensagens da IA por conversa | 12 |
| Instruções + regras + trechos da base (RAG) por mensagem | ~3 mil tokens (repetidos, entram em cache) |
| Histórico da conversa lido a cada mensagem (média) | ~1,3 mil tokens |
| Total lido por conversa | ~16 mil tokens novos + ~36 mil em cache |
| Total escrito por conversa | ~2,4 mil tokens de resposta + preenchimento do CRM, mais o raciocínio interno do modelo |

Sem RAG (mandando a base inteira de 27 mil caracteres em toda mensagem), o cache sobe para ~108 mil tokens por conversa. O RAG corta isso em cerca de 3 vezes.

## 2. Custo por conversa e por 1.000 conversas (HIPÓTESE com preços FATO)

| Modelo | Preço entrada / saída | Por conversa | 1.000 conversas/mês | Fonte do preço |
|---|---|---|---|---|
| Claude Opus 5.5 | 4 / 20 | ~US$ 0,21 | ~US$ 210 | Anthropic, tabela oficial |
| Claude Sonnet 5.5 | 2 / 10 | ~US$ 0,08 | ~US$ 80 | Anthropic, tabela oficial |
| Gemini 3.8 Flash | 0,75 / 3,75 (dobra em 01/01/2027) | ~US$ 0,03 | ~US$ 30 (US$ 60 em 2027) | Google, página oficial |
| Claude Haiku 5.5 | 0,10 / 0,50 | ~US$ 0,005 | ~US$ 5 | Anthropic, tabela oficial |
| DeepSeek V4.1 Flash | 0,15 / 0,60 fora do pico (dobra no pico) | ~US$ 0,005 | ~US$ 5 a 10 | DeepSeek, página oficial |
| GPT-6 Astra (topo) | 10 / 50 | ~US$ 0,38 | ~US$ 380 | OpenAI, página oficial |
| GPT-6.1 Sol (linha média) | 2 / 10 (cache 0,10) | ~US$ 0,07 | ~US$ 70 | OpenAI, página oficial |
| GPT-5.6 Terra | 2 / 12 | ~US$ 0,08 | ~US$ 80 | OpenAI, página oficial |
| GPT-5.4 mini | 0,75 / 4,50 | ~US$ 0,03 | ~US$ 30 | OpenAI, página oficial |
| GPT-5 mini | 0,25 / 2 | ~US$ 0,01 | ~US$ 12 | OpenAI, página oficial |
| GPT-6 Luna (econômico) | 0,10 / 0,50 | ~US$ 0,004 | ~US$ 4 | OpenAI, página oficial |

## 3. Para empresas grandes, o preço não é o único critério (RECOMENDAÇÃO)

- **Regras de crédito:** a SDR não pode prometer aprovação, taxa nem prazo. Modelos mais fortes erram menos nisso, e um erro aqui custa mais do que a diferença de preço.
- **Preencher o CRM sem erro:** nome, telefone, dor e valor de crédito precisam sair no formato certo. É preciso medir isso modelo por modelo.
- **Proteção de dados (LGPD):** empresa grande vai perguntar onde os dados são processados e se a IA guarda as conversas. Prefira provedores com contrato de proteção de dados e opção de não reter dados. DeepSeek é chinês, e isso costuma ser vetado por jurídico e compliance de empresas de crédito.
- **Português natural:** a regra "não parecer IA" vale aqui também. Precisa ser testado com conversas reais.

## 4. Recomendação

1. **Padrão do Lothem Vendas: Claude Sonnet 5.5** para conversar (cerca de 40% do custo do Opus 5.5).
2. **Claude Haiku 5.5** para tarefas simples em volume: classificar a mensagem, extrair os campos do CRM, triagem do disparo.
3. **Claude Opus 5.5** como opção "premium" para empresas grandes ou ticket alto, e como reforço quando o Sonnet não tiver certeza.
4. Antes de fechar, **testar com a mesma base de conversas** os 5 candidatos (Opus 5.5, Sonnet 5.5, Haiku 5.5, Gemini Flash e GPT-6.1 Sol), mais GPT-6 Luna contra o Haiku 5.5) e escolher pelos números, não pelo preço da tabela.

## 5. Onde testar todos os modelos com uma conta só (FATO)

| Plataforma | Como cobra | Por que considerar |
|---|---|---|
| **Vercel AI Gateway** | Preço de tabela de cada provedor, **sem taxa sobre tokens**; aceita a chave do próprio cliente (BYOK) sem taxa; tem plano grátis com parte dos modelos | O Lothem Vendas já roda na Vercel; uma integração só serve para Claude, GPT, Gemini e outros; tem limite de gasto por projeto ou por chave |
| **OpenRouter** | Preço de tabela + taxa de 5,5% na compra de créditos | Centenas de modelos, bom para experimentar rápido |

Recomendação: **Vercel AI Gateway**, pela integração com o que já existe e por não cobrar taxa sobre tokens.

## 6. Próximo passo proposto

Teste comparativo: 20 conversas simuladas a partir da base da Lothem Crédito, rodadas nos 5 modelos, com nota para seguir as regras, tom, preenchimento correto do CRM e conversão até o link. Saem tokens e custo reais por conversa. Precisa de créditos de IA (custo baixo, a estimar antes) e da sua aprovação.

## Fontes
- Anthropic: tabela oficial de modelos e preços (06/10/2026)
- Google: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
- Vercel AI Gateway: https://vercel.com/docs/ai-gateway/pricing
- OpenRouter (taxa de 5,5%): https://omidsaffari.com/blog/openrouter-pricing
- OpenAI: https://developers.openai.com/api/docs/pricing
