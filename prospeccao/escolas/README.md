# Campanha — Escolas com boa reputação e sem site

## O ICP

Escola com **nota ≥ 4.3**, **≥ 10 avaliações** e **nenhum site** no perfil do Google.

A ausência de site é o gatilho, mas não é a dor. A dor é: a escola já conquistou a
confiança dos pais que a conhecem, e perde a matrícula do pai que *ainda não* a conhece —
ele pesquisa, acha o perfil, não encontra valores, estrutura ou como matricular, e vai
para o colégio ao lado que tem uma página. **A reputação existe e não converte.**

Por isso a nota alta importa mais que o tamanho da escola: nota alta sem site é a maior
distância entre o que a escola merece e o que ela captura. E é o argumento que ela sente.

## Como minerar a lista

```bash
export GOOGLE_MAPS_API_KEY="sua-chave"   # Places API (New) habilitada no Google Cloud

python3 minerar_escolas.py \
  --regioes "Campinas SP" "Sorocaba SP" "Jundiaí SP" \
  --nota-min 4.3 --avaliacoes-min 10 \
  --saida leads-escolas.csv
```

Ou com um arquivo de regiões (uma por linha):

```bash
python3 minerar_escolas.py --regioes regioes.txt --saida leads-escolas.csv
```

**Dimensionar o mercado antes de prospectar:** rode com `--incluir-com-site` uma vez.
O relatório mostra quantas escolas já têm site — a razão entre os dois números diz se a
região vale a campanha. Densidade de ICP abaixo de ~15% costuma indicar região saturada.

### Saída

CSV ordenado por `prioridade` = `nota × log10(avaliações + 1)`.

Nota alta com 3 avaliações é acaso, não reputação. O log impede que uma escola gigante
com 800 avaliações domine o ranking inteiro e esconda as médias, que costumam ser as
mais fáceis de fechar.

### Limites e custo

- A Places API devolve no máximo **60 resultados por consulta** (3 páginas × 20). Por isso
  o script varre **vários termos × várias regiões**: é assim que se cobre uma cidade.
- Cidade grande: quebre por bairro ou zona, não por cidade inteira — senão você só vê as
  60 mais bem ranqueadas e perde justamente as escolas pequenas do ICP.
- Text Search é cobrado por requisição. Cada região × termo = até 3 requisições. Estime
  antes de varrer um estado.

## Enriquecimento

O que o Google não entrega e a campanha precisa:

- **Decisor** (diretor/mantenedor): busca manual, Instagram da escola, ou `apify_dataset`
- **Instagram**: muita escola sem site tem Instagram ativo — é o canal de abordagem mais quente
- **E-mail**: quase nunca vem no perfil; ligar ou usar o Direct converte melhor que e-mail frio
- **Nº de alunos** (para precificar): pergunta da própria abordagem

Sem telefone no CSV = precisa de enriquecimento antes de entrar em cadência.

## Fluxo do squad nesta campanha

```
Este script  ──> lista de leads no ICP
      │
      ▼
/market-research  ──> objeções reais de escola sem site, vocabulário do diretor
      │
      ▼
/cso  ──> preço, oferta, meta de matrículas fechadas por mês
      │
      ├──> /copywriter  ──> script de ligação, Direct, WhatsApp, cadência
      ├──> /creative-director  ──> criativo de anúncio + antes/depois
      │
      ▼
/web-builder  ──> a ENTREGA (o site da escola) e também a prova:
                  landing da campanha + demo pronta como quebra-gelo
      │
      ▼
/media-buyer  ──> Meta Ads por geografia + cargo, retargeting de quem viu a demo
      │
      ▼
/data-attribution  ──> taxa de resposta, custo por reunião, CAC por região
```

## O ativo que muda a taxa de resposta

Não aborde pedindo reunião. **Chegue com a demo pronta.**

O `/web-builder` monta um gerador que pega uma linha do CSV (nome, nota, avaliações, foto
do Google, endereço) e cospe uma página real da escola, publicada, com URL própria.

A abordagem deixa de ser "posso te apresentar uma proposta?" e vira "fiz o site da
[Escola X], está no ar, olha aqui — suas 4.8 estrelas na primeira dobra". Objeção de
"não tenho tempo" e "vou pensar" caem junto, porque não há nada a imaginar.

Escala: 1 demo custa segundos depois do gerador pronto. 200 demos personalizadas é meio
período de máquina — e é a diferença entre 2% e 20% de resposta.
