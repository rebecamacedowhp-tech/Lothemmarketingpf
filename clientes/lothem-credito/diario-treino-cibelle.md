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

## Treinamento novo (14/10/2026)

Rebeca reprovou o atendimento ("está horrível") e pediu para refazer do jeito certo. Memória e conversa de teste zeradas. Oferta única: Diagnóstico com Rota de Crédito, R$ 149. Treinamento atual = `manual-cibelle-v2.md` (manual comercial Hormozi da Rebeca + etapa da dor + objeções do script v1). Instruções ganharam o bloco "ROTEIRO OFICIAL" que vale acima da ordem antiga.

## Testes de atendimento

### Teste 1 · 13/10/2026 23:03 · trilha quiz (lead sem quiz no CRM) · modo Autônomo · Claude Sonnet 5.5
Custo da conversa inteira: US$ 0,10 (6 respostas).

**Conversa**
- Lead: Oi fiz o teste no site o banco negou meu capital de giro / Oi quero capital de giro
- Cibelle: Oi, Re! Aqui é a Cibelle, da equipe da Rebeca, da Lothem. Vi que você fez o teste… / Não peço senha nem dado de banco… / o que você sabe sobre o motivo que o banco deu para negar?
- Lead: não me disse nada, apenas que não tinha sido aprovado
- Cibelle: isso é comum… / o motivo costuma estar em restrição, dívida no Banco Central ou faturamento que o banco não enxerga / as vendas entram na conta PJ ou parte cai na pessoal?
- Lead: Na conta pj
- Cibelle: isso ajuda… / motivo provável: restrição ou dívida (palpite) / ação de hoje: Registrato + "você sabe se tem restrição?"
- Lead: acho que não, mas não tenho certeza
- Cibelle: muita gente não tem certeza / o Registrato ajuda / "esse palpite faz sentido? Se quiser, a Rebeca pode gravar um áudio curtinho"
- Lead: Não entendi
- Cibelle: explica de outro jeito / "faz sentido até aqui?"
- Lead: Sim
- Cibelle: próximo passo é confirmar com dados / "a Rebeca grava um áudio curto… Quer ouvir?"
- Lead: Sim
- Cibelle: vou pedir para a Rebeca gravar / oferta completa do Diagnóstico (consultas, PDF em 1 h, nota, 30 min) / R$ 97 + garantia + "isso te parece útil?" → **passou para a equipe** (precisa gravar o áudio)
- Lead: Nossa, tem que pagar? Não é golpe? → **ficou sem resposta**

**Bom:** transparência na abertura (não pede senha, não empresta); uma pergunta por vez; usou a resposta da pessoa (conta PJ) para mudar o palpite; deu ação útil (Registrato); quando a pessoa não entendeu, explicou de novo mais simples; oferta com garantia e "quem aprova é o banco".

**Errou (método Hormozi + Script):**
1. **Prometeu um áudio que não existe.** Ofereceu "a Rebeca grava um áudio sobre o seu caso"; os áudios A0–A8 não estão no sistema e ela não grava sob demanda. Criou espera e passou a conversa para a equipe por isso.
2. **A passagem para a equipe veio na pior hora.** Logo depois do preço, a pessoa trouxe a maior objeção ("tem que pagar? não é golpe?") e ninguém respondeu. [GARANTIA GOD-MODE] o risco ficou com o cliente.
3. **Não perguntou quanto e para quê.** Nunca perguntou o valor do capital de giro nem a finalidade, então a oferta não ligou o Diagnóstico ao resultado que ela quer. [DREAM OUTCOME]
4. **Oferta em lista de funcionalidades.** Serasa, Boa Vista, SCR, PDF, nota… num balão longo, antes de construir confiança. "Isso ainda é um produto, não uma oferta." [TRIM & STACK]
5. **Nome "Re".** Usou o nome do perfil do WhatsApp sem confirmar. Deveria perguntar "como posso te chamar?".
6. **Balões demais por vez** (3 a cada resposta, alguns longos, com ação e pergunta no mesmo balão).

**Mudanças aplicadas em 13/10 (Rebeca: "pode aplicar"):**
- Instrução: não oferecer áudio enquanto os áudios não estiverem no sistema; explicar por texto.
- Instrução: antes da oferta, perguntar valor e finalidade do crédito e usar a resposta na oferta.
- Instrução: oferta em no máximo 2 balões, começando pelo objetivo da pessoa; o balão do preço já leva a frase anti-golpe.
- Instrução: se o nome do WhatsApp parecer apelido ou abreviação, perguntar como chamar.
- Instrução: no máximo 2 balões por resposta.
- Resposta aprovada nova para "tem que pagar? não é golpe?" logo depois do preço.
- Passagem para a equipe: só nos casos da regra; nunca por causa de áudio.
- Pedido da Rebeca: "entender a dor do cliente e usar o método Hormozi nível hard". Entrou nas instruções a fase obrigatória **Entender a dor** (situação, objetivo, implicação "e se esse capital não sair nos próximos meses?", tentativas, urgência 0 a 10, repetir a dor com as palavras dela) e o bloco **Hormozi nível máximo** (resultado dos sonhos, equação de valor, custo de não agir com os números dela, garantia colada no preço, pergunta de sim fácil, firmeza sem desconto). Continua proibido: escassez inventada, valores fictícios, prometer crédito, humilhar.
- Onde: `crm/mestre-ia.js` (TRILHAS_PROMPT), `crm/sdr-kit.js` (CRED_OBJ), `crm/api/_cibelle.mjs` (máx. 2 balões, nada de promessa impossível), treinamento 3.3/3.4. Para valer em produção: Painel Mestre › IA dos clientes › PJ › Carregar pacote oficial (agora substitui os documentos antigos).

### Teste 2 · 13/10/2026 23:27 · mesma conversa do teste 1, devolvida para a IA
**Conversa**
- Lead: Oi o banco negou meu capital de giro
- Cibelle: Boa pergunta, Re… Tem que pagar só se você quiser. O Diagnóstico custa R$ 97… A Lothem não empresta… / Sobre o áudio, errei em prometer… Se quiser conferir quem somos, posso te passar o CNPJ e o site. Quer que eu mande?

**Bom:** já seguiu os ajustes (2 balões, admitiu o erro do áudio, respondeu ao medo de golpe com transparência).
**Errou:** respondeu à pergunta antiga ("não é golpe?") em vez da mensagem nova; continuou chamando de "Re" sem perguntar o nome.
**Causa:** o histórico e a memória do teste 1 continuavam na mesma conversa.
**Mudança feita:** botão "Recomeçar conversas de teste" (SDR IA › Visão geral › Atendimento automático), migração `20261013090000_recomecar_teste.sql`. Encerra e guarda a conversa antiga, zera a memória só dos números de teste.

### Teste 3 · 14/10/2026 02:07 · conversa nova · treinamento v2 (pacote talvez não recarregado)
**Bom:** perguntou como chamar; 2 balões; pingue-pongue; começou a dor (já pediu? quanto?); usou "ainda não pedi" a favor.
**Errou (Rebeca: "robótico e sem graça"):** aviso de segurança no primeiro oi; repetiu o que a pessoa disse; frases de atendimento ("Entendi", "Para eu entender melhor", "Me conta:", "Obrigada por chamar aqui"); pergunta com cardápio de opções; sem reação ao "300 mil"; não usou a abertura do manual ("problema real ou curiosidade?").
**Mudança feita:** bloco VOZ no motor (`crm/api/_cibelle.mjs`, vale para todos na hora, sem recarregar pacote): reagir antes de perguntar, 1 balão quando der, fala coloquial, lista de proibidos de robô, aviso de segurança só no pagamento ou desconfiança, 4 exemplos errado → certo.

**Fim do teste 3 (02:14):** a pessoa pediu CNPJ e site; a busca na base só usou a palavra "Sim" e não achou os dados; a Cibelle passou para a equipe ("travou"). Continuou robótica.
**Mudança (14/10, pedido da Rebeca: "rodar exatamente um script, bem humanizado, bem despojado"):** **modo roteiro fixo** para a Lothem Crédito PJ (`crm/api/_roteiro-credito.mjs`). 34 falas escritas no tom leve; a IA só escolhe a fala e preenche {nome}, {objetivo}, {valor}, {para_que}, {consequencia}. CNPJ, site, Instagram (@lothem.credito), link, preço e garantia dentro das falas: não depende mais de busca na base. Fala livre só quando nenhuma serve, uma frase. PDF: `docs/treinamento/Roteiro-Fixo-Cibelle.pdf`.

**Ajustes do roteiro (14/10, avaliação da Rebeca do teste 3):** "quase perderam a venda por excesso de explicação e falta de comando no final" e "quem controla a conversa faz as perguntas; depois do 'eu pago pra saber isso?', ofereceu CNPJ e site sem cobrar o pagamento". Mudanças: falas encurtadas; toda fala termina com comando ("Te mando o link?", "Bora?"); depois de objeção, fecha pedindo o pagamento; a fala "dados" só quando a pessoa pede; perguntas fora do roteiro: uma frase com FATOS fixos + volta ao roteiro com comando; sem fato, confirma com a Rebeca e passa para a equipe.

### Teste 4 · 14/10/2026 · lead que chega do quiz pelo WhatsApp (decisão da Rebeca)
O funil manda uma mensagem pronta quando a pessoa não compra: "Olá, Rebeca! Fiz a pré-análise de crédito no site. Nome / Empresa / CNPJ / Faturamento / Prontidão / Crédito para / Tenho uma dúvida sobre o Diagnóstico…".
**Feito:** o motor (`crm/api/_roteiro-credito.mjs` → `lerQuiz`, `crm/api/_cibelle.mjs`) reconhece essa mensagem, guarda nome, empresa, CNPJ (cifrado), objetivo e notas na ficha, marca a entrada "Fez o quiz e não comprou" e abre direto com "oi" + "direta", sem perguntar nome, objetivo nem faturamento. Migração `20261014010000_quiz_whatsapp.sql` (função `ai_bot_quiz`). Funil: linha nova "Crédito para: ..." na mensagem (`lothem-funil/fonte/app.js`, ainda NÃO publicado).
Também: conversa de teste zerada (a anterior voltou de onde parou porque a ficha antiga era reaproveitada; agora conversa nova começa do zero).

Formato de cada teste:

### Teste N · data · trilha (quiz / comprou)
**Conversa** (como saiu no WhatsApp)
**Bom:**
**Errou:**
**Mudança feita:** (arquivo e o que mudou)
