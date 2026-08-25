# Limiares de Decisão do Squad

Números para separar "está funcionando" de "está morrendo". São pontos de partida — ao ter 30
dias de histórico real do cliente via Windsor, **substitua pelo baseline dele**. O baseline do
cliente sempre vence o benchmark genérico.

## Criativo (vídeo)

| Métrica | Verde | Atenção | Matar |
|---|---|---|---|
| Hook Rate (3s / impressões) | > 45% | 30–45% | < 30% |
| Hold Rate (75% assistido / 3s) | > 25% | 15–25% | < 15% |
| CTR (link) | > 1.5% | 0.8–1.5% | < 0.8% |
| Frequência (7d) | < 2.0 | 2.0–3.0 | > 3.0 |

Fadiga confirmada = CTR caindo 3 dias seguidos **e** frequência > 2.5 **e** CPA subindo.
Os três juntos. Um sozinho é ruído.

## Mídia

- **Volume mínimo pra decidir:** 50 cliques ou 3× o CPA alvo em gasto. Abaixo disso, não decida.
- **Escala vertical:** subir 20% do budget quando ROAS > meta por 3 dias. Nunca dobrar de uma vez.
- **Escala horizontal:** duplicar conjunto vencedor em novo público antes de forçar budget no atual.
- **Corte:** gastou 1.5× o CPA alvo sem conversão → pausa.

## Landing / CRO

| Métrica | Alvo |
|---|---|
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| Taxa de conversão (lead) | > 15% |
| Taxa de conversão (e-commerce) | > 2% |

Teste A/B só conclui com significância estatística. Sem volume, o teste não terminou —
e "parece melhor" não é resultado.

## Financeiro

- **MER** = receita total ÷ gasto total em mídia. É o número que manda, acima do ROAS de plataforma.
- **Gap de plataforma:** soma dos ROAS de plataforma sempre supera o MER (double-counting).
  Se a diferença passar de 30%, a atribuição está quebrada — investigue antes de decidir verba.
- **Teto de CAC** = LTV ÷ 3, como piso de segurança.
