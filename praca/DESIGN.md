# Praça — sistema visual

Identidade do esquadrão de publicidade. Este arquivo é a fonte da verdade:
toda superfície nova (app, estúdio, gerador de sites) deriva daqui.

## Conceito

Peça impressa em **risografia** — o meio do panfleto de comércio local:
papel jornal, três tintas, registro imperfeito. A assinatura da marca é o
**erro de registro**: o título é impresso em duas camadas de tinta que nunca
fecham perfeitamente. Uma ideia forte, o resto quieto.

Tema único e deliberado (uma peça impressa não tem modo escuro). Toda cor é
pintada explicitamente, então a página se segura sobre qualquer fundo.

## Cor

| Token       | Hex       | Onde entra |
|-------------|-----------|------------|
| `--papel`   | `#ECEAE1` | Fundo. Cinza esverdeado de jornal — não o bege-creme genérico. |
| `--papel-alto` | `#F5F3EC` | Fichas, campos de formulário. |
| `--tinta`   | `#22201C` | Texto e todas as bordas. Preto quente, nunca `#000`. |
| `--azul`    | `#2C4C9B` | Federal Blue. Banda de números, sombra de botão vazado. |
| `--rosa`    | `#FF3D8C` | Fluorescent Pink. Sombra do botão primário, foco, marcas. |
| `--amarelo` | `#FFD400` | Banda das regras, grifo, números sobre azul. |
| `--sombra`  | `#C9C6BA` | Sombra neutra quando nenhuma tinta se aplica. |

**Regra de contraste:** rosa e amarelo nunca recebem texto corrido — só
tipo grande, blocos de fundo e marcas. Texto sobre eles é sempre `--tinta`.

## Tipografia

| Papel | Família | Uso |
|-------|---------|-----|
| Display | **Archivo** 800/900, versal, `letter-spacing:-.02em` | Títulos e nomes de mesa. |
| Corpo | **Newsreader** 300–500 | Texto corrido, máximo ~65 caracteres por linha. |
| Dado | **Martian Mono** 400/600, versal, `letter-spacing:.1em` | Rótulos, números, briefing formatado. `tabular-nums` sempre. |

Escala: `.6875 / .8125 / 1.0625 / 1.25 / 1.6875 / 2.375rem` e o cartaz em
`clamp(2.75rem, 11vw, 7.5rem)`.

## Formas

- Raio **2px** em tudo. Não é uma interface arredondada.
- Borda **2px sólida `--tinta`** — a borda é o traço da impressão.
- Sombra **dura e deslocada** na cor da tinta da vez (`4px 4px 0`), que cresce
  para `9px 9px 0` no hover. É o deslocamento de registro, não profundidade.
- Nenhum degradê, nenhuma sombra difusa, nenhum emoji como marcador.

## Voz

Português direto, verbo ativo, frase curta. O botão diz o que acontece
("Montar o briefing" → "Briefing copiado"). Nada de "submeter", "solução" ou
"potencializar". Vocabulário do ofício: praça, verba, mesa, passe, hook rate,
criativo fadigado, atribuição.

## Estrutura

A numeração 01–07 só existe porque as sete mesas **são** uma sequência: a
saída de uma é a entrada da seguinte. Numeração que não carrega ordem real
não entra.
