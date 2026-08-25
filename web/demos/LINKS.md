# Prévias publicadas — Sumaré

Ordenadas por prioridade (nota × log₁₀ das avaliações). Mande o link junto com a
abordagem em `copy/lothem/abordagem-escolas.md`.

**As páginas são privadas por padrão.** Para a dona da escola conseguir abrir, use o
menu de compartilhamento da página e ative o link público antes de enviar.

| # | Escola | Nota | Contato | Link |
|---|---|---|---|---|
| 1 | Villa Kids | 4,8★ 32 | WhatsApp 19 99181-4239 | https://claude.ai/code/artifact/969aa435-45fe-4ca6-8be0-f257ad59525d |
| 2 | Tindolelê Educação Infantil | 5,0★ 21 | WhatsApp 19 99658-0491 | https://claude.ai/code/artifact/46df8773-6d90-460b-beca-f2d36d944c5d |
| 3 | Oficina do Saber | 4,8★ 17 | Fixo 19 3873-6025 | https://claude.ai/code/artifact/29b70d6e-ed5d-44bd-819f-d1f77cd35290 |
| 4 | Maria Fumaça | 4,9★ 10 | WhatsApp 19 99445-6000 | https://claude.ai/code/artifact/1281cad7-e5b3-4d23-b7a5-0700ec4a9aa3 |
| 5 | Escola De Ed. Inf. Tindolelê | 4,5★ 12 | WhatsApp 19 99658-0491 | https://claude.ai/code/artifact/84e1663d-17f3-4b26-ac3e-194671c1075d |
| 6 | Sonho Mágico | 3,9★ 14 | Fixo 19 3396-2429 | https://claude.ai/code/artifact/5a1da2e3-8bd6-4375-a894-60ddc3a46eaf |
| 7 | Novo Traço | 5,0★ 5 | WhatsApp 19 99160-6325 | https://claude.ai/code/artifact/d6a4a31f-c1dd-4a69-85e6-8c983266bade |
| 8 | Sonho Dourado | 5,0★ 2 | Fixo 19 3873-6968 | https://claude.ai/code/artifact/94143546-f734-4223-9837-21932e05aea2 |

## Atenção nos itens 2 e 5

São **a mesma escola** — mesmo telefone (19 99658-0491), mesma rua. A Tindolelê tem
dois perfis no Google e as avaliações estão divididas: 21 num, 12 no outro. Quem cai
no perfil errado vê 4,5 em vez de 5,0.

Abra a conversa por aí. É um problema real, que ela provavelmente não sabe que tem, e
resolver não custa nada a você.

## O que cada página traz

Só dado real do perfil do Google: nome, nota, número de avaliações, horário, endereço e
telefone. **Nada inventado** — a promessa da abordagem é "é a sua escola", e um dado falso
encerra a conversa na primeira linha que ela ler.

- Celular → botão de WhatsApp com mensagem pronta. Fixo → botão de ligar.
- Cada escola tem um acento de cor próprio: duas donas do mesmo bairro comparando
  páginas idênticas percebem o molde na hora.
- A seção "Nosso espaço" fica vazia de propósito. Não usamos foto de banco de imagens —
  pareceria que são os alunos dela. O vazio é o convite para ela mandar as fotos reais,
  e é o que inicia a conversa.
- Faixa de prévia no topo e aviso no rodapé: a página não se passa pelo site oficial.

## Regerar

```bash
python3 web/demos/gerar.py     # lê escolas.json, escreve em paginas/
```
