# CRM com IA para WhatsApp (multiempresa)

CRM para **qualquer nicho de vendas**, ligado ao WhatsApp Business. A IA lê as conversas e preenche o
CRM sozinha: ficha do cliente, necessidade/dor, etapa do funil e um **resumo para qualquer vendedor
continuar o atendimento**. Pode ser vendido para várias empresas: cada uma tem os seus dados separados.

## O que cada empresa cliente tem

- **Quadro de leads (Kanban)** com as conversas do WhatsApp.
- **Botão "✨ Preencher CRM com IA"** em cada conversa: a IA lê tudo e preenche a ficha, o resumo, o
  próximo passo e a etapa do funil.
- **Três modos de IA** (em Configurações):
  1. *Só no botão*: a IA trabalha quando o vendedor clica.
  2. *Preencher automaticamente*: a cada mensagem nova, sem nunca responder o cliente.
  3. *SDR com IA*: também responde, qualifica e passa para o vendedor (ex.: a Ingrid da Lothem).
- **Configuração sem código**: nicho, o que vende, produtos/preços/links, **campos da ficha**,
  **etapas do funil**, treinamento/script, WhatsApp e equipe.
- **Histórico de versões** das configurações: dá para restaurar qualquer versão.
- **Login por usuário** (dono e vendedores) e documentos recebidos anexados ao card.

## Para você (administradora da plataforma)

- Página **Administração**: cadastra empresas clientes, define **limite mensal de análises da IA**
  (para o plano que ela paga), ativa/desativa e abre o CRM de qualquer empresa para dar suporte.
- O **uso da IA** é contado por empresa e por mês (análises e tokens).
- A empresa nº 1 é a Lothem, criada a partir de `sdr_config.json` + `treinamento_sdr.md` na primeira
  execução; os leads do banco antigo (uma empresa só) são importados automaticamente.

## Banco de dados

- **Produção:** Postgres (variável `DATABASE_URL`). No Railway: *+ Add → Database → PostgreSQL* e, no
  serviço do CRM, a variável `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
- **Sem `DATABASE_URL`:** usa SQLite em `/data/crm_multi.db` (volume do Railway).
- Todas as tabelas de clientes têm `empresa_id` e todas as consultas filtram por ele.

## Variáveis de ambiente

Veja `.env.example`. As principais: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `ADMIN_EMAIL`,
`ADMIN_SENHA` (se faltar, usa `CRM_SENHA`), `SECRET_KEY` e as do WhatsApp.

## WhatsApp de cada empresa

Um app da Meta (o da plataforma) recebe o webhook de todos os números em `https://SEU-DOMINIO/webhook`.
Cada empresa informa em Configurações o **Phone number ID** e o **token** do número dela; as mensagens
vão para a empresa certa pelo número que recebeu. Para cada cliente conectar o próprio número sozinho
(Embedded Signup), o app precisa virar **Tech Provider** na Meta.

## Rodar localmente

```bash
cd crm
cp .env.example .env
pip install -r requirements.txt
uvicorn app:app --reload
```

## Testes

```bash
pip install pytest && python -m pytest -q tests
# também contra Postgres:
TEST_DATABASE_URL=postgresql://usuario@localhost/crmtest python -m pytest -q tests
```
