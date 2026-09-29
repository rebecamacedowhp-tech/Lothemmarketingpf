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

FICHA_VAZIA = {c: "" for c in config.CAMPOS_IDS}
RESULTADO_BASE = {
    "resposta": "Oi Ana! Quanto tempo seu CNPJ está ativo?",
    "nome": "Ana", "dor": "Limite do banco acabou; precisa de capital de giro para estoque",
    "ficha": {**FICHA_VAZIA, "empresa": "Loja da Ana", "faturamento": "R$ 80 mil/mês bruto"},
    "lista": "qualificando", "temperatura": "morno", "score": 40,
    "resumo": "Ana, dona da Loja da Ana. Limite acabou, busca capital de giro.",
    "proximo_passo": "Descobrir tempo de CNPJ", "transferir_para_humano": False,
}


@pytest.fixture
def cli(tmp_path, monkeypatch):
    db.reset(str(tmp_path / "t.db"))
    monkeypatch.setattr(config, "CRM_SENHA", "")
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", "")
    monkeypatch.setattr(config, "DEBOUNCE_SEGUNDOS", 0)
    monkeypatch.setattr(config, "PAUSA_MAX_SEGUNDOS", 0)
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
    assert d["nome"] == "Ana" and d["dor"].startswith("Limite do banco")
    assert d["ficha"]["empresa"] == "Loja da Ana" and d["ficha"]["faturamento"] == "R$ 80 mil/mês bruto"
    assert d["lista"] == "qualificando"
    assert "Loja da Ana" in d["resumo"]
    assert [m["autor"] for m in d["mensagens"]] == ["cliente", "ia"]
    assert cli.enviados == [("5511988887777", RESULTADO_BASE["resposta"])]


def test_webhook_duplicado_nao_duplica_mensagem(cli):
    cli.post("/webhook", json=payload())
    cli.post("/webhook", json=payload())
    lead = db.listar_leads()[0]
    assert [m["autor"] for m in db.listar_mensagens(lead["id"])].count("cliente") == 1


def test_campo_vazio_da_ia_nao_apaga_ficha(cli):
    cli.post("/api/simular", json={"telefone": "5599", "texto": "oi"})
    cli.resultado["ficha"] = dict(FICHA_VAZIA)
    d = cli.post("/api/simular", json={"telefone": "5599", "texto": "ok"}).json()
    assert d["ficha"]["empresa"] == "Loja da Ana"


def test_qualificado_ia_continua_atendendo(cli):
    cli.resultado.update(lista="qualificado", temperatura="quente", score=85,
                         resposta="Vou deixar aqui o link pra você escolher o horário.")
    d = cli.post("/api/simular", json={"telefone": "5566", "texto": "Faturo 80 mil, CNPJ de 3 anos"}).json()
    assert d["lista"] == "qualificado" and d["ia_ativa"] == 1


def test_transferir_para_humano_pausa_ia(cli):
    cli.resultado.update(transferir_para_humano=True,
                         resposta="Vou chamar alguém do time pra falar com você por aqui.")
    d = cli.post("/api/simular", json={"telefone": "5511", "texto": "Quero falar com uma pessoa"}).json()
    assert d["lista"] == "humano"
    assert d["ia_ativa"] == 0
    assert d["mensagens"][-1]["autor"] == "ia"  # o aviso de passagem foi enviado
    # Nova mensagem do cliente: IA não responde mais, só atualiza o resumo
    cli.post("/api/simular", json={"telefone": "5511", "texto": "Ok, aguardo"})
    assert cli.chamadas[-1] is False
    assert len(cli.enviados) == 1


def test_ia_nao_tira_lead_de_lista_humana(cli):
    lead = cli.post("/api/simular", json={"telefone": "5522", "texto": "oi"}).json()
    cli.patch(f"/api/leads/{lead['id']}", json={"lista": "fechado"})
    d = cli.post("/api/simular", json={"telefone": "5522", "texto": "e aí?"}).json()
    assert d["lista"] == "fechado" and d["ia_ativa"] == 0


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
    assert "<treinamento>" in p and "ICP" in p and "qualificando" in p
    assert "humano" not in config.LISTAS_DA_IA
    s = sdr._schema()
    assert s["properties"]["lista"]["enum"] == config.LISTAS_DA_IA
    assert s["properties"]["ficha"]["required"] == config.CAMPOS_IDS


def test_contrato_social_vira_anexo(cli, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "ANEXOS_DIR", tmp_path / "anexos")

    async def fake_baixar(media_id):
        return b"%PDF-1.4 contrato", "application/pdf"

    monkeypatch.setattr(crm.whatsapp, "baixar_midia", fake_baixar)
    doc = {"entry": [{"changes": [{"field": "messages", "value": {
        "contacts": [{"wa_id": "5577", "profile": {"name": "Bia"}}],
        "messages": [{"from": "5577", "id": "wamid.DOC", "type": "document",
                      "document": {"id": "m1", "filename": "Contrato Social.pdf", "mime_type": "application/pdf"}}],
    }}]}]}
    cli.post("/webhook", json=doc)
    lead = [l for l in db.listar_leads() if l["telefone"] == "5577"][0]
    d = cli.get(f"/api/leads/{lead['id']}").json()
    assert d["anexos"][0]["nome_arquivo"] == "Contrato Social.pdf"
    assert "Contrato Social.pdf" in d["mensagens"][0]["texto"]
    r = cli.get(f"/api/anexos/{d['anexos'][0]['id']}")
    assert r.content == b"%PDF-1.4 contrato"


def test_editar_ficha_pelo_painel(cli):
    lead = cli.post("/api/simular", json={"telefone": "5588", "texto": "oi"}).json()
    d = cli.patch(f"/api/leads/{lead['id']}", json={"ficha": {"tempo_cnpj": "3 anos", "inexistente": "x"}}).json()
    assert d["ficha"]["tempo_cnpj"] == "3 anos" and d["ficha"]["empresa"] == "Loja da Ana"
    assert "inexistente" not in d["ficha"]


def test_resposta_dividida_em_varias_mensagens(cli):
    cli.resultado["resposta"] = "Que bacana, 12 anos de empresa!\n\nE hoje, de quanto de crédito você tá precisando?"
    d = cli.post("/api/simular", json={"telefone": "5512", "texto": "tenho empresa há 12 anos"}).json()
    assert [m["texto"] for m in d["mensagens"] if m["autor"] == "ia"] == [
        "Que bacana, 12 anos de empresa!", "E hoje, de quanto de crédito você tá precisando?"]
    assert len(cli.enviados) == 2


def test_dividir_mensagens_limita_a_tres():
    assert crm.dividir_mensagens("a\n\nb\n\nc\n\nd") == ["a", "b", "c\n\nd"]
