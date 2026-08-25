# Contratos de Handoff do Squad

Cada linha é um contrato: o agente da esquerda **só** entrega ao da direita quando os itens
da coluna "Artefato" existem e passam no gate. Artefato faltando = handoff bloqueado.

## 1. CSO → Market Researcher
**Artefato:** `estrategia/<cliente>/plano-mestre.md`
- OKR de growth do ciclo (número + prazo)
- Meta de ROAS e teto de CAC
- Verba total e split por canal
- Oferta central em uma frase
- Canais prioritários ranqueados

**Gate:** existe pelo menos um número vindo de dado real (faturamento, gasto atual, ROAS histórico
via Windsor). Plano 100% hipotético não passa.

## 2. Market Researcher → Creative Director + Copywriter
**Artefato:** `pesquisa/<cliente>/dossie-mercado.md`
- 5+ concorrentes com o ângulo que cada um usa
- 10+ objeções reais do público (fonte: reviews, comentários, comunidades, Search Console)
- 3+ ângulos inexplorados, cada um com a dor que ataca
- Vocabulário do público (as palavras que eles usam, não as suas)

**Gate:** cada dor tem origem citada. Dor inventada não passa.

## 3. Creative Director → Copywriter → Media Buyer
**Artefato:** `criativos/<cliente>/matriz-testes.md` + arquivos exportados do Canva
- Briefing visual por ângulo
- Regra dos 3 primeiros segundos escrita para cada hook
- Matriz de teste: ângulo × formato × hook (mínimo 3×2)
- Peças exportadas nos formatos do canal (9:16, 1:1, 4:5)

**Gate:** todo criativo nasce de um ângulo do dossiê. Criativo órfão volta.

## 4. Copywriter → Media Buyer
**Artefato:** `copy/<cliente>/copies.md` (ou .docx para o cliente)
- Headline + primária + CTA por criativo
- Variações A/B (mínimo 2 por peça), cada uma testando **uma** variável
- Roteiro VSL quando o formato pedir

**Gate:** cada variação declara qual variável está sendo testada. "Versão 2" sem hipótese volta.

## 5. CRO → Web Builder
**Artefato:** `cro/<cliente>/wireframe-<pagina>.md` + canvas de design
- Estrutura de seções em ordem, com a função de cada uma
- Copy de cada bloco (vinda do Copywriter, não inventada)
- Hipótese de teste A/B com métrica de sucesso
- Requisitos de tracking (eventos a disparar)

**Gate:** a hipótese tem métrica e limiar de decisão. "Ver se melhora" volta.

## 6. Web Builder → Media Buyer
**Artefato:** página publicada + URL
- Página no ar e acessível
- Eventos de conversão disparando (verificado no navegador)
- LCP < 2.5s, CLS < 0.1 medidos de verdade
- Parâmetros UTM aceitos e preservados

**Gate:** screenshot da página real + medição de Web Vitals anexada. Sem prova, não sobe tráfego.

## 7. Media Buyer → Data & Atribuição
**Artefato:** `midia/<cliente>/estrutura-campanhas.md`
- Estrutura de campanha/conjunto/anúncio por canal
- Budget inicial e regra de escala (quando subir, quanto, com base em qual número)
- Regra de corte (quando matar criativo)
- IDs das campanhas criadas

**Gate:** o usuário confirmou cada ação de escrita antes de executar. Sempre.

## 8. Data & Atribuição → CSO (fecha o ciclo)
**Artefato:** `dados/<cliente>/relatorio-ciclo-<n>.md` + dashboard publicado
- MER real do período (receita total ÷ gasto total em mídia)
- ROAS por canal, sem double-counting
- Criativos campeões vs. fadigados, com o número que sustenta a classificação
- Recomendação de verba do próximo ciclo, por canal

**Gate:** a atribuição declara o modelo usado e onde ele pode estar errando. Número sem
ressalva metodológica não passa.

## Ciclos de retorno

Três loops curtos existem fora da cadeia principal e podem ser disparados sozinhos:

- **Fadiga criativa:** Data & Atribuição → Creative Director (não passa pelo CSO).
- **Página convertendo mal:** Data & Atribuição → CRO → Web Builder.
- **Ângulo saturado:** Data & Atribuição → Market Researcher.
