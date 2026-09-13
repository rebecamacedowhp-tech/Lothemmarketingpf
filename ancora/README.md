# Âncora

App de autorregulação emocional para pessoas com transtorno de personalidade borderline (e qualquer pessoa em intensa ativação emocional). Reúne exercícios guiados inspirados em habilidades de DBT, mapeamento de gatilhos e um relatório pronto para levar à terapia.

## O que tem

**Na crise**
- Botão de acesso imediato: “Estou em crise — me ajude agora”
- Escala de intensidade 0–10 que prioriza as habilidades certas para o momento
- Exercícios guiados: **TIPP**, **aterramento 5-4-3-2-1**, **respiração ritmada**, **STOP**, **autocuidado sensorial** e **distração ACCEPTS**

**Entre as crises**
- **Gatilhos**: catálogo pessoal por categoria (relacional, interno, corpo, ambiente, rotina), com sugestões prontas e contagem de quantas crises cada gatilho apareceu
- **Diário**: registro de episódio com intensidade antes/depois, gatilhos, emoções, impulsos (contidos ou executados), habilidades usadas e texto livre

**Para a terapia**
- Relatório com resumo do período (7/30/90 dias ou histórico completo): média de intensidade, redução após os exercícios, gatilhos/emoções/impulsos mais frequentes e lista de episódios
- Exportar por: copiar, baixar `.txt`, compartilhar, imprimir/PDF ou enviar por e-mail
- Opção de ocultar os textos pessoais do relatório

## Privacidade

Todos os dados ficam em `localStorage`, apenas no aparelho. O app não envia nada para servidores — a pessoa decide quando e para quem compartilhar.

> Âncora **não substitui** terapia, psiquiatria ou emergência. Em risco à vida, procure ajuda imediata. No Brasil: **CVV 188**.

## Como rodar

```bash
cd ancora
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Deploy

O `vercel.json` na raiz do repositório já aponta para este app, então o projeto Vercel ligado à
raiz publica o Âncora sem configuração adicional:

| Campo | Valor |
| --- | --- |
| Install | `npm install --prefix ancora` |
| Build | `cd ancora && npm run build` |
| Output | `ancora/dist` |

Se preferir um projeto Vercel dedicado, crie um novo projeto com **Root Directory** = `ancora`; o
`ancora/vercel.json` cuida do resto.

## Stack

- React + TypeScript + Vite
- Framer Motion
- CSS próprio (sem framework), instalável como PWA
