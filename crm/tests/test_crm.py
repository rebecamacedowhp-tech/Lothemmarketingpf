import hashlib
import hmac
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as crm  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402

RESULTADO_BASE = {
    "resposta": "Oi Ana! Me conta, hoje vocês já investem em anúncios?",
    "nome": "Ana", "dor": "Gasta no Meta Ads e não vende", "empresa": "Loja da Ana",
    "segmento": "moda", "orcamento": "", "faturamento": "", "decisor": "", "urgencia": "",
    "lista": "qualificando", "temperatura": "morno", "score": 40,
    "resumo": "Ana, dona da Loja da Ana (moda). Dor: anúncios sem venda.",
    "proximo_passo": "Descobrir orçamento", "transferir_para_humano": False,
}


@pytest.fixture
def cli(tmp_path, monkeypatch):
    db.reset(str(tmp_path / "t.db"))
    monkeypatch.setattr(config, "CRM_SENHA", "")
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", "")
    monkeypatch.setattr(config, "DEBOUNCE_SEGUNDOS", 0)
    enviados = []

    async def fake_enviar(tel, texto):
        enviados.append((tel, texto))
        return f"wamid.{len(enviados)}"

    monkeypatch.setattr(crm.whatsapp, "enviar_texto", fake_enviar)
    c = TestClient(crm.app)
    c.enviados = enviados
    c.resultado = dict(RESULTADO_BASE)
    chamadas = []

    async def fake_analisar(lead, mensagens, responder):
        chamadas.append(responder)
        r = dict(c.resultado)
        if not responder:
            r["resposta"] = ""
        return r

    monkeypatch.setattr(crm.sdr, "analisar", fake_analisar)
    c.chamadas = chamadas
    return c


def payload(tel="5511988887777", texto="Oi, quero saber sobre tráfego pago", wamid="wamid.A"):
    return {"entry": [{"changes": [{"field": "messages", "value": {
        "contacts": [{"wa_id": tel, "profile": {"name": "Ana WhatsApp"}}],
        "messages": [{"from": tel, "id": wamid, "type": "text", "text": {"body": texto}}],
    }}]}]}


def test_verificacao_webhook(cli, monkeypatch):
    monkeypatch.setattr(config, "WHATSAPP_VERIFY_TOKEN", "abc")
    r = cli.get("/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "42"})
    assert r.text == "42"
    assert cli.get("/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "x"}).status_code == 403


def test_assinatura_invalida_rejeitada(cli, monkeypatch):
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", "segredo")
    corpo = json.dumps(payload()).encode()
    assert cli.post("/webhook", content=corpo, headers={"X-Hub-Signature-256": "sha256=errado"}).status_code == 401
    ok = "sha256=" + hmac.new(b"segredo", corpo, hashlib.sha256).hexdigest()
    assert cli.post("/webhook", content=corpo, headers={"X-Hub-Signature-256": ok}).status_code == 200


def test_mensagem_do_cliente_gera_lead_resposta_e_ficha(cli):
    import asyncio
    cli.post("/webhook", json=payload())
    lead = db.listar_leads()[0]
    asyncio.run(crm.processar_lead(lead["id"]))
    d = cli.get(f"/api/leads/{lead['id']}").json()
    assert d["telefone"] == "5511988887777"
    assert d["nome"] == "Ana" and d["dor"] == "Gasta no Meta Ads e não vende"
    assert d["lista"] == "qualificando"
    assert "Loja da Ana" in d["resumo"]
    assert [m["autor"] for m in d["mensagens"]] == ["cliente", "ia"]
    assert cli.enviados == [("5511988887777", RESULTADO_BASE["resposta"])]


def test_webhook_duplicado_nao_duplica_mensagem(cli):
    cli.post("/webhook", json=payload())
    cli.post("/webhook", json=payload())
    lead = db.listar_leads()[0]
    assert [m["autor"] for m in db.listar_mensagens(lead["id"])].count("cliente") == 1


def test_lead_quente_vai_para_vendedor_e_ia_pausa(cli):
    cli.resultado.update(lista="quente", temperatura="quente", score=90, transferir_para_humano=True,
                         resposta="Perfeito! Um especialista vai te chamar aqui em instantes.")
    d = cli.post("/api/simular", json={"telefone": "5511", "texto": "Quero começar semana que vem"}).json()
    assert d["lista"] == "quente"
    assert d["ia_ativa"] == 0
    assert d["mensagens"][-1]["autor"] == "ia"  # o aviso de passagem foi enviado
    # Nova mensagem do cliente: IA não responde mais, só atualiza o resumo
    cli.post("/api/simular", json={"telefone": "5511", "texto": "Ok, aguardo"})
    assert cli.chamadas[-1] is False
    assert len(cli.enviados) == 1


def test_ia_nao_tira_lead_de_lista_humana(cli):
    lead = cli.post("/api/simular", json={"telefone": "5522", "texto": "oi"}).json()
    cli.patch(f"/api/leads/{lead['id']}", json={"lista": "atendimento"})
    d = cli.post("/api/simular", json={"telefone": "5522", "texto": "e aí?"}).json()
    assert d["lista"] == "atendimento" and d["ia_ativa"] == 0


def test_vendedor_envia_pelo_crm_pausa_ia(cli):
    lead = cli.post("/api/simular", json={"telefone": "5533", "texto": "oi"}).json()
    r = cli.post(f"/api/leads/{lead['id']}/mensagens", json={"texto": "Oi, sou o Pedro!", "vendedor": "Pedro"})
    assert r.status_code == 200
    d = cli.get(f"/api/leads/{lead['id']}").json()
    assert d["ia_ativa"] == 0 and d["vendedor"] == "Pedro"
    assert d["mensagens"][-1]["autor"] == "vendedor"


def test_mensagem_do_celular_do_vendedor_pausa_ia(cli):
    cli.post("/api/simular", json={"telefone": "5544", "texto": "oi"})
    eco = {"entry": [{"changes": [{"field": "smb_message_echoes", "value": {
        "message_echoes": [{"from": "5500", "to": "5544", "id": "wamid.eco", "type": "text", "text": {"body": "Oi, aqui é a Rebeca"}}]}}]}]}
    cli.post("/webhook", json=eco)
    lead = [l for l in db.listar_leads() if l["telefone"] == "5544"][0]
    assert lead["ia_ativa"] == 0
    assert db.listar_mensagens(lead["id"])[-1]["autor"] == "vendedor"


def test_prompt_inclui_treinamento_e_listas():
    import sdr
    p = sdr.montar_system_prompt()
    assert "<treinamento>" in p and "qualificando" in p and "atendimento" not in [l for l in config.LISTAS_DA_IA]
    s = sdr._schema()
    assert s["properties"]["lista"]["enum"] == config.LISTAS_DA_IA
