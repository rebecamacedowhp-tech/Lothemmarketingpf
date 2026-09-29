# CRM Lothem Inteligência em Crédito + SDR IA no WhatsApp Business

CRM em que uma **SDR com IA (Claude)** atende todo lead que chega no WhatsApp Business, seguindo o
treinamento oficial da Lothem (Formação de SDR, POP 01 e Manual do SDR PJ):

1. **Responde na hora** e qualifica com **SPIN Selling**, uma pergunta por vez, validando o **ICP**
   (não MEI, 12+ meses de CNPJ como ME, ponto físico ou receita recorrente, faturamento ≥ R$ 30 mil/mês,
   endividamento saudável).
2. **Preenche a ficha sozinha**: nome, telefone WhatsApp, **dor do cliente**, empresa, segmento, natureza
   jurídica, tempo de CNPJ, estrutura, faturamento, endividamento, objetivo e valor do crédito, bancos,
   garantias, decisor, caminho provável, Contrato Social e agendamento.
3. **Move o lead para a lista certa**: Novo → Em qualificação → Qualificado (agendar) → Agendado,
   ou Outras soluções (MEI/fora do ICP) / Nutrir / Desqualificado.
4. Com o lead qualificado, **envia o link de agendamento** da consultoria + diagnóstico e **pede o
   Contrato Social**; o documento que o cliente manda é **anexado ao card** automaticamente.
5. **Escreve as observações para o Closer** (quem é, se está no ICP, dor, o que foi falado, objeções)
   e o **próximo passo**, para qualquer vendedor continuar sem ler o histórico.
6. Contorna as objeções do manual. Se o cliente pedir uma pessoa ou o caso for sensível, **passa para
   o time humano** (lista "Precisa de humano") e para de responder.

O painel é um quadro Kanban (arrastar e soltar entre listas). Clicando no lead você vê as observações,
a ficha, os documentos, a conversa completa, e pode responder o cliente direto pelo CRM.

## Arquivos que você edita

| Arquivo | O que é |
|---|---|
| `treinamento_sdr.md` | **Treinamento da SDR** (já com o conteúdo da Formação, POP e Manual). |
| `sdr_config.json` | Nome da SDR, **link de agendamento**, descrição da empresa, tom de voz, **campos da ficha** e **listas do funil**. |
| `.env` | Chaves do Claude e do WhatsApp, senha do painel. |

Depois de editar, reinicie o servidor.

## Como rodar

```bash
cd crm
cp .env.example .env        # preencha as chaves
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

Abra `http://localhost:8000` (usuário: qualquer um, senha: `CRM_SENHA`).

**Testar sem WhatsApp:** no painel, clique em **"Testar SDR"** e mande mensagens como se fosse um cliente.
Só precisa da `ANTHROPIC_API_KEY`.

Para colocar no ar (Render, Railway, Fly.io, VPS…) use o `Dockerfile`. Monte um volume em `/data`
para o banco não se perder.

## Conectar o WhatsApp Business (Cloud API da Meta)

1. Em [developers.facebook.com](https://developers.facebook.com) crie um app do tipo **Business** e adicione o produto **WhatsApp**.
2. Em *WhatsApp > Configuração da API*, adicione o seu número e copie o **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. Crie um **token permanente** (Configurações do Negócio > Usuários do sistema > gerar token com
   `whatsapp_business_messaging` e `whatsapp_business_management`) → `WHATSAPP_TOKEN`.
4. Em *Configurações do app > Básico*, copie a **Chave secreta do app** → `WHATSAPP_APP_SECRET`.
5. Em *WhatsApp > Configuração > Webhook*:
   - URL de callback: `https://SEU-DOMINIO/webhook`
   - Token de verificação: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
   - Assine o campo **messages** (e **smb_message_echoes**, se usar o app no celular junto — veja abaixo).

### Usar o app WhatsApp Business no celular ao mesmo tempo
Se o seu número estiver no **modo coexistência** (app WhatsApp Business + Cloud API no mesmo número),
assine também o webhook `smb_message_echoes`. Assim, quando alguém da equipe responder pelo celular,
a mensagem aparece no CRM, a IA para de responder aquele lead e o resumo leva em conta o que o vendedor falou.

## Como a IA decide

A cada mensagem do cliente (o CRM espera `DEBOUNCE_SEGUNDOS` para juntar mensagens seguidas),
a SDR recebe a ficha atual + a conversa inteira e devolve, num formato fixo: a resposta, os campos,
a lista, temperatura (quente/morno/frio), score de 0 a 100, resumo, próximo passo e se deve transferir.

- A IA só move leads entre as listas marcadas como dela. Listas com `"ia_pode_mover": false`
  (Em atendimento, Ganho, Perdido) são só dos vendedores.
- Listas com `"ia_responde": false` pausam a IA quando o lead entra nelas.
- Arrastar um lead para "Em atendimento", responder pelo CRM ou pelo celular pausa a IA.
  O botão **🤖/👤** no lead liga e desliga a IA manualmente.

## Testes

```bash
pip install pytest && python -m pytest -q tests
```
