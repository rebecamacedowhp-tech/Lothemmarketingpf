# LOTHEM Vendas — CRM com SDR IA

Protótipo navegável do CRM da Lothem. Tudo roda no navegador, sem servidor, com **dados fictícios** (pessoas, empresas, telefones, preços e resultados). Data de referência da demo: quarta, 07/10/2026, 10:24.

**Como abrir:** publique a pasta como página estática ou sirva `crm/` com qualquer servidor local e abra `index.html`. Links diretos usam `#tela.aba` (ex.: `#sdr.af`, `#equipe.sla`) e `~org` para abrir outra organização (ex.: `#funis~pf` abre o Funil PF). Cada aba do navegador fica com a sua organização, então dá para deixar dois funis abertos lado a lado.

O botão **DEMO · ROTEIRO** no topo lista 12 fluxos para testar, do lead do Meta ao QR Code.

---

## 1. Fluxo comercial que o CRM sustenta

```
Anúncio no Meta → WhatsApp (API oficial) → Cibelle, a SDR IA, atende e qualifica
→ vende o Diagnóstico (Pix) → Rebeca faz o diagnóstico → resumo vai para o Closer
→ reunião → proposta → consultoria fechada
```

Qualificação usada pela IA (vem do playbook do SDR): **dor + decisor + momento em até 60 dias**. Faltando um, ela nutre e não oferta. Capacidade de investimento é lida por sinais, nunca perguntada direto.

## 2. Mapa de telas

| Grupo | Tela | Para que serve |
|---|---|---|
| Comando | **Central** | Meta do mês (reator), 6 indicadores, funil de 30 dias, Cibelle ao vivo, agenda do dia, campanhas do Meta, evolução e meta pessoal |
| | **Atendimento** | Caixa compartilhada do WhatsApp: lista com filtros (IA, esperando humano, fora do SLA), conversa, assumir/devolver para a IA, nota interna com @menção, sugestões de resposta, painel do lead com ficha preenchida pela IA, qualificação, negócio e handoff |
| | **Funis de vendas** | Kanban com arrastar e soltar em 3 funis (Inbound · Diagnóstico, Consultoria · Closer, Outbound · Prospector), previsão ponderada, motivo de perda obrigatório, ficha do negócio com histórico |
| | **Contatos** | Pessoas e empresas, filtros por ciclo, ficha com linha do tempo, consentimento LGPD e "não contatar", importação do CSV do Prospector |
| | **Tarefas** | Lista por dia e visão de semana, minhas ou da equipe, XP por tarefa no prazo |
| Inteligência | **SDR IA** | Visão geral (maturidade, competências, o que treinar), base de conhecimento (PDF, artigo, áudio, vídeo), playbook e oferta, regras, **preenchimento do CRM**, revisões e área de teste |
| | **Chat da equipe** | Canais e mensagens diretas; a IA publica o resumo de cada handoff em `#handoff-closer` |
| | **Evolução** | Nível, ritmo, metas do mês, desafios, conquistas, ranking e regras de pontuação |
| | **Meta pessoal** | Quanto cada pessoa quer ganhar e a rota até lá, passando pelo SDR e pelo Closer |
| Conta | **WhatsApp e integrações** | Instâncias (oficial e QR Code), modelos de mensagem, integrações, comparativo oficial × não oficial |
| | **Equipe e acessos** | Pessoas, convites, matriz de permissões, **SLA de atendimento**, squads |
| | **Planos e pagamentos** | Uso do plano, aviso de limite, troca de plano com cobrança proporcional, adicionais, faturas |
| | **Organizações** | Uma organização por marca ou cliente, com dados e IA separados |
| | **Suporte** | Chamados, status dos serviços, base de ajuda |
| Menu do usuário | **Meu perfil** | Dados e foto, preferências (tema Dia/Noite, tela inicial), notificações por canal, segurança e sessões |

Complementos em todas as telas: menu lateral retrátil (o grupo Conta fica recolhido), busca e comandos (Ctrl K), botão "+" de criação rápida, chave de tema claro/escuro no topo, notificações e troca de organização no topo do menu.

**Respiro (pedido da Rebeca):** espaço generoso e pouca coisa visível por vez. A Central mostra uma única "próxima ação" e separa o resto em abas (Hoje, Análise, Equipe e IA). No Atendimento, os dados do lead ficam em seções que abrem e fecham, as sugestões da IA aparecem só quando chamadas e o painel lateral pode ser escondido. Em Meu perfil › Preferências dá para escolher espaçamento Espaçado (padrão) ou Compacto.

**Marca por organização:** em Organizações › Marca (ou no menu da organização) a gestão envia a logo da empresa (PNG, SVG ou JPG), ajusta o nome no menu e escolhe a cor de destaque. A logo substitui o símbolo no menu e na lista de organizações.

## 3. Indicadores da Central

| Indicador | Cálculo | Por que importa |
|---|---|---|
| Meta do mês (reator) | receita fechada ÷ meta, com marcador de onde deveria estar hoje (dia ÷ dias do mês) | mostra se o mês está no ritmo |
| Projeção | receita até hoje ÷ dias passados × dias do mês | antecipa o fechamento |
| Por dia | (meta − feito) ÷ dias restantes | vira ação diária |
| Leads do Meta | leads no mês + CPL | volume e custo de entrada |
| Qualificação pela IA | qualificados ÷ leads | qualidade do tráfego e da IA |
| Diagnósticos vendidos | Pix confirmados ÷ meta | primeira venda do funil |
| Comparecimento | diagnósticos realizados ÷ vendidos | perda silenciosa entre a venda e a reunião |
| Consultorias fechadas | contratos ÷ meta | resultado final |
| Primeira resposta | mediana do tempo até a primeira mensagem | speed-to-lead |
| Funil completo | conversão entre cada etapa, 30 dias | onde o funil vaza |
| Campanhas do Meta | investimento, leads, CPL, qualificados, diagnósticos, **custo por diagnóstico**, consultorias | decide verba pelo resultado, não pelo CPL |

Alertas no topo são calculados ao vivo: lead esperando humano, SLA estourado ou correndo, instância desconectada, tarefas atrasadas, respostas da IA na fila de revisão.

## 4. Gamificação

Princípio: premiar **resultado confirmado e consistência**, nunca volume de clique. Visual sóbrio (hexágonos, barras e números), sem mascote ou confete.

| Mecânica | Como funciona |
|---|---|
| XP e níveis | Nível pela curva 25·N² + 100·N. Faixas: Base, Tração, Precisão, Estratégia, Elite, Referência |
| Tabela de XP | SLA cumprido +5 · tarefa no prazo +10 · follow-up no dia +5 · correção aprovada na IA +15 · negócio parado atualizado +8 · lead qualificado +25 · diagnóstico vendido +80 · diagnóstico com resumo em 24 h +60 · consultoria fechada +300 |
| Limites diários | ações de volume têm teto por dia, para ninguém pontuar mandando mensagem à toa |
| Ritmo | dias seguidos batendo o mínimo do dia; atraso pausa, não tira XP |
| Metas | do mês, por equipe e por pessoa, sempre com marcador de ritmo |
| Desafios | individuais, por squad ou da equipe toda, com prazo e prêmio em XP; "Meta pessoal" vira desafio com um clique |
| Conquistas | marcos reais em níveis (ex.: Treinadora I/II/III, Ticket alto, Show-up 90) |
| Ranking | por **% da meta de cada função**, para SDR, tráfego e Closer competirem de forma justa; pode ser escondido da equipe |
| Squads | Aquisição (tráfego, SDR, IA) e Fechamento (diagnóstico e Closer) |
| Recompensas | definidas pela gestão e ligadas à meta (folga, curso, bônus de squad), não a "loja de pontos" |

A IA não entra no ranking. O que ela vende conta para o squad que a supervisiona e treina.

## 5. SDR IA (Cibelle)

- **Pacote de SDR** (`sdr-kit.js`): cada organização nasce com persona, oferta, qualificação, roteiro da conversa, objeções aprovadas, follow-up, regras e resumo de passagem do seu modelo: Crédito PJ (Raio-X R$ 97, PF do sócio R$ 67, Rota R$ 149), Crédito PF ou qualquer nicho com vendedor. Método: Receita Previsível, Josh Braun e Chris Voss (ver `docs/referencias-vendas.md`). No modo real, persona, oferta, modo, regras e itens validados ficam salvos nas configurações da organização, e o que for ensinado vai para `kb_items` (arquivos na pasta privada da organização).
- **Modos:** Copiloto (sugere, pessoa envia) · Supervisionado (envia e retém o que tiver baixa confiança ou tema sensível) · Autônomo (recomendado só com maturidade acima de 90%).
- **Treinamento:** base de conhecimento com artigos, PDFs, áudios e vídeos transcritos; respostas aprovadas; fila de revisão onde cada correção vira exemplo e sobe a competência correspondente. A área "Testar" mostra a resposta, a confiança e as fontes usadas, e muda depois de cada correção.
- **Regras fixas:** não prometer resultado em número, não inventar preço, dizer que é assistente virtual quando perguntada, não pedir documento ou dado bancário, respeitar "não contatar".
- **Passa para humano quando:** o lead pede, a confiança cai abaixo de 70%, há irritação ou tema jurídico, ou o diagnóstico foi pago (aí monta o resumo para o Closer).

### Preenchimento automático do CRM

A IA lê a conversa do SDR com cada cliente e grava os campos sozinha: cadastro (empresa, segmento, cidade, e-mail), qualificação (dor, decisor, momento, capacidade), pontuação, etapa do funil e próximo passo, tarefas e agenda. Cada campo guarda o trecho da conversa usado como prova (ícone ✦ no painel do lead) e entra no **histórico de preenchimento**, com opção de desfazer.

- Interruptor geral e por grupo de campos em **SDR IA › Preenchimento do CRM** e no painel do lead. Só proprietária e gestão alteram.
- Desligado, a IA continua lendo e deixa **sugestões** para uma pessoa aplicar (uma a uma ou todas).
- Confiança mínima configurável: abaixo dela, o campo vira sugestão mesmo com o automático ligado.
- Nunca preenche: documentos, dados bancários, faturamento que o lead não confirmou.
- Pagamento confirmado move o negócio pela integração de pagamento, independente do interruptor.

## 6. SLA do SDR

Configurado em **Equipe e acessos › SLA de atendimento** (proprietária e gestão):

| Tempo | Padrão Marketing | Quando começa |
|---|---|---|
| Primeira resposta humana | 5 min | lead novo sem IA ou com IA em copiloto |
| Transferência da IA | 10 min | lead pediu uma pessoa |
| Retorno durante a conversa | 15 min | lead respondeu e espera |
| Follow-up de lead parado | 24 h | sem mensagem nossa depois do último contato |

Também configurável: alerta antes de estourar (% do tempo), contar só em horário comercial, funções às quais se aplica, e o que acontece no estouro (avisar gestão, passar o lead para outra pessoa, IA manda mensagem de espera em número oficial). O cronômetro aparece em cada conversa, a caixa tem o filtro "Fora do SLA" e a tabela de cumprimento por pessoa fica no mesmo lugar. Responder dentro do SLA vale +5 XP.

## 7. Meta pessoal

Cada pessoa informa quanto quer ganhar. O CRM usa a forma de remuneração dela (fixo + valor por etapa ou % sobre o valor da etapa) e as taxas de conversão dos últimos 30 dias para montar a rota de trás para frente:

```
variável necessário = desejado − fixo
leads necessários = variável ÷ Σ(pagamento por unidade da etapa × fração de leads que chega à etapa)
cada etapa = leads × fração acumulada (arredondado para cima)
por dia útil = (necessário − feito no mês) ÷ dias úteis restantes
```

A tela mostra: projeção no ritmo atual, a etapa que mais paga (alavanca), quanto o SDR precisa entregar e quanto o Closer precisa fechar, se a rota cabe na meta do time e, se não couber, quantos leads a mais (com custo estimado no Meta) ou quantas abordagens outbound resolvem. A rota pode ser enviada ao SDR e ao Closer pelo chat e virar desafio na Evolução. Proprietária e gestão veem a meta de todos; cada pessoa vê só a própria.

## 8. WhatsApp: oficial e não oficial

- **API oficial (Cloud API):** entrada dos anúncios, SDR IA, lembretes e confirmações com modelos aprovados.
- **Não oficial (QR Code):** relacionamento 1 a 1 e prospecção com volume baixo; IA desligada por padrão por risco de bloqueio.
- Cobrança da API oficial segue a tabela vigente da Meta (por mensagem de modelo). Confirmar valores atuais antes de orçar.

## 9. Multiorganização, acessos e plano

- Organizações separadas, cada uma com contatos, funis, números, SLA, IA e regras próprias. Na demo: **Lothem Marketing**, **Lothem Crédito PJ** e **Lothem Crédito PF** (campanhas para pessoa física: contato → necessidade → simulação → documentos no canal seguro → contratado, com cor verde para não confundir as abas). As duas de crédito rodam com IA em copiloto e preenchimento automático desligado, por ser serviço financeiro.
- **Abrir em outra aba:** botão em Funis de vendas, no menu da organização e em Organizações.
- Funções: Proprietária, Gestor, Closer, SDR, Tráfego, Leitor, com matriz de permissão por área e alcance de dados.
- **Planos** (`billing.js`, preço por empresa): Essencial R$ 147 (3 usuários, sem IA) · Profissional R$ 397 (6 usuários, Cibelle com 300 conversas, 1 WhatsApp) · Avançado R$ 897 (15 usuários, 3 empresas, 1.500 conversas, 3 WhatsApp). Anual = 12 meses pelo preço de 10. Extras: +500 conversas R$ 97, +1 WhatsApp R$ 59. Implantação pela Lothem a partir de R$ 2.497.
- **Teste grátis:** toda conta nova ganha 7 dias do Avançado, sem cartão. Vencido o teste, o banco bloqueia criar e alterar (políticas restritivas com `org_active`), mas tudo continua visível. Contas que já existiam ficaram como uso interno.
- **Página de pagamento** (`#assinar`): plano, mensal ou anual, Pix, cartão ou boleto e dados da nota. Enquanto o provedor de pagamento não está ligado, o pedido fica em `subscriptions.requested_*` e a ativação é manual. CPF/CNPJ e cartão ficam só na página do provedor.

## 9b. Segurança e criptografia

- RLS em todas as tabelas, organizações dentro do token de login (JWT), funções com `search_path` vazio, arquivos e tempo real isolados por organização, papel anônimo sem acesso e banco fechado para conexão direta.
- **Criptografia AES-256 por campo** (`20261009050000_criptografia.sql`), com a chave no Vault e cada valor amarrado ao dono (um dado copiado para outra organização não abre):
  - **Clientes finais:** telefone, e-mail, CPF/CNPJ/RG, qualificação do negócio (dor, dívidas, momento) e texto das mensagens do WhatsApp.
  - **Equipe do tenant:** telefone de cada pessoa e e-mail dos convites.
  - **Tenant:** CPF/CNPJ, e-mail, telefone e endereço de cobrança, número do WhatsApp e a chave de acesso da Meta (essa nunca volta para o navegador).
- Gatilhos cifram sozinhos tudo o que for gravado. A tela recebe só a dica (4 últimos dígitos, e-mail mascarado); o valor completo sai por função, só para quem tem acesso, e abrir dado de cliente fica no histórico.
- Ficam legíveis para o CRM funcionar (busca, lista, funil): nome do contato, empresa, cidade, segmento, nome das pessoas da equipe e nome da organização. O e-mail de login é guardado pelo Supabase Auth. Tudo, inclusive isso, fica cifrado em disco pelo Supabase.

## 10. O que é demonstração e o que falta para produção

| Na demo | Para produção |
|---|---|
| Dados em memória, sem login | Banco de dados, autenticação com 2 etapas, trilha de auditoria |
| Conversas e IA simuladas | WhatsApp Cloud API (webhooks), conexão por QR para a não oficial, modelo de linguagem com busca na base de conhecimento e as regras como filtro antes do envio |
| Pagamento simulado | Gateway com Pix e cartão, webhook de confirmação |
| Campanhas com números fixos | Meta Lead Ads e API de Conversões (devolver "lead qualificado", "diagnóstico pago" e "consultoria fechada") |
| Cálculos no navegador | Jobs de SLA, metas e XP no servidor |

**Pendências de decisão da Rebeca** (estão como fictícias na demo): preço real do diagnóstico e da consultoria, política de comissão de SDR e Closer, metas reais do mês, nome final da IA, quais casos de cliente a IA pode citar.
