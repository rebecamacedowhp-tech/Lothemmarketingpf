import asyncio
import hashlib
import hmac
import json
import os
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as crm  # noqa: E402
import auth  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
import tenants  # noqa: E402

SENHA = "senha-forte-123"
NUM_LOTHEM = "111000111"
NUM_LOJA = "222000222"


def resultado_base(emp):
    return {
        "resposta": "Oi Ana! Quanto tempo seu CNPJ está ativo?",
        "nome": "Ana", "dor": "Limite do banco acabou; precisa de capital de giro",
        "ficha": {c: "" for c in emp.campos_ids} | ({"empresa": "Loja da Ana"} if "empresa" in emp.campos_ids else {}),
        "lista": emp.listas_da_ia[1] if len(emp.listas_da_ia) > 1 else emp.lista_inicial,
        "temperatura": "morno", "score": 40,
        "resumo": "Ana, dona da Loja da Ana. Busca capital de giro.",
        "proximo_passo": "Descobrir tempo de CNPJ", "transferir_para_humano": False,
    }


@pytest.fixture
def plataforma(tmp_path, monkeypatch):
    url = os.getenv("TEST_DATABASE_URL", "")
    if url:
        import psycopg
        with psycopg.connect(url, autocommit=True) as c:
            c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    db.reset(str(tmp_path / "multi.db"), url)
    monkeypatch.setattr(config, "CRM_DB_LEGADO", str(tmp_path / "legado.db"))
    monkeypatch.setattr(config, "ANEXOS_DIR", tmp_path / "anexos")
    monkeypatch.setattr(config, "ADMIN_EMAIL", "admin@plataforma.com")
    monkeypatch.setattr(config, "ADMIN_SENHA", SENHA)
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", "")
    monkeypatch.setattr(config, "WHATSAPP_PHONE_NUMBER_ID", NUM_LOTHEM)
    monkeypatch.setattr(config, "DEBOUNCE_SEGUNDOS", 0)
    monkeypatch.setattr(config, "PAUSA_MAX_SEGUNDOS", 0)

    enviados = []

    async def fake_enviar(cred, tel, texto):
        enviados.append((cred.get("phone_number_id"), tel, texto))
        return f"wamid.{len(enviados)}"

    monkeypatch.setattr(crm.whatsapp, "enviar_texto", fake_enviar)
    chamadas = []
    ajustes = {}

    async def fake_analisar(emp, lead, mensagens, responder):
        chamadas.append((emp.id, responder))
        db.registrar_uso(emp.id, 100, 10)
        r = resultado_base(emp) | ajustes
        if not responder:
            r["resposta"] = ""
        return r

    monkeypatch.setattr(crm.sdr, "analisar", fake_analisar)
    tenants.preparar_plataforma()
    loja = tenants.criar("Loja Bella", "Moda feminina", "Bia", "bia@loja.com", SENHA)
    db.atualizar_empresa(loja.id, {"whatsapp_phone_number_id": NUM_LOJA, "whatsapp_token": "tok"})

    class P:
        pass

    p = P()
    p.enviados, p.chamadas, p.ajustes, p.loja_id = enviados, chamadas, ajustes, loja.id
    p.lothem_id = db.banco().um("SELECT id FROM empresas ORDER BY id LIMIT 1")["id"]
    yield p
    db.reset()


def cliente(email="admin@plataforma.com", senha=SENHA):
    c = TestClient(crm.app)
    r = c.post("/api/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return c


def payload(numero, tel="5511988887777", texto="Oi, quero saber mais", wamid="wamid.A"):
    return {"entry": [{"changes": [{"field": "messages", "value": {
        "metadata": {"phone_number_id": numero},
        "contacts": [{"wa_id": tel, "profile": {"name": "Ana WhatsApp"}}],
        "messages": [{"from": tel, "id": wamid, "type": "text", "text": {"body": texto}}],
    }}]}]}


# ------------------------------------------------------------------ plataforma e login
def test_lothem_vira_empresa_1_com_treinamento(plataforma):
    emp = tenants.obter(plataforma.lothem_id)
    assert emp.nome_sdr == "Ingrid" and emp.sdr_ativa
    assert "SPIN" in emp.treinamento
    assert "tipo" in emp.campos_ids and emp.phone_number_id == NUM_LOTHEM
    assert db.listar_versoes(emp.id)  # versão inicial guardada


def test_login_obrigatorio_e_senha_errada(plataforma):
    c = TestClient(crm.app)
    assert c.get("/api/leads").status_code == 401
    assert c.get("/", follow_redirects=False).headers["location"] == "/login"
    assert c.post("/api/login", json={"email": "bia@loja.com", "senha": "errada"}).status_code == 401


def test_sessao_adulterada_e_recusada(plataforma):
    c = TestClient(crm.app)
    token = auth.criar_sessao(1, plataforma.loja_id)
    c.cookies.set(auth.COOKIE, token[:-2] + "00")
    assert c.get("/api/leads").status_code == 401


# ------------------------------------------------------------------ isolamento entre empresas
def test_webhook_vai_para_a_empresa_do_numero(plataforma):
    c = TestClient(crm.app)
    c.post("/webhook", json=payload(NUM_LOJA, wamid="w1"))
    assert len(db.listar_leads(plataforma.loja_id)) == 1
    assert db.listar_leads(plataforma.lothem_id) == []
    c.post("/webhook", json=payload("999", tel="5599", wamid="w2"))  # número desconhecido: ignorado
    assert len(db.listar_leads(plataforma.loja_id)) == 1


def test_empresa_nao_ve_lead_de_outra(plataforma):
    TestClient(crm.app).post("/webhook", json=payload(NUM_LOTHEM, wamid="w1"))
    lead = db.listar_leads(plataforma.lothem_id)[0]
    bia = cliente("bia@loja.com")
    assert bia.get("/api/leads").json() == []
    assert bia.get(f"/api/leads/{lead['id']}").status_code == 404
    assert bia.patch(f"/api/leads/{lead['id']}", json={"nome": "x"}).status_code == 404
    assert bia.post(f"/api/leads/{lead['id']}/preencher").status_code == 404


def test_mesmo_telefone_em_duas_empresas_sao_leads_diferentes(plataforma):
    c = TestClient(crm.app)
    c.post("/webhook", json=payload(NUM_LOTHEM, wamid="a"))
    c.post("/webhook", json=payload(NUM_LOJA, wamid="b"))
    assert len(db.listar_leads(plataforma.lothem_id)) == 1 and len(db.listar_leads(plataforma.loja_id)) == 1


# ------------------------------------------------------------------ IA
def test_sdr_ativa_responde_e_preenche(plataforma):
    TestClient(crm.app).post("/webhook", json=payload(NUM_LOTHEM, wamid="w1"))
    lead = db.listar_leads(plataforma.lothem_id)[0]
    asyncio.run(crm.processar_lead(lead["id"]))
    d = cliente().get(f"/api/leads/{lead['id']}").json()
    assert d["nome"] == "Ana" and d["dor"].startswith("Limite")
    assert d["ficha"]["empresa"] == "Loja da Ana"
    assert [m["autor"] for m in d["mensagens"]] == ["cliente", "ia"]
    assert plataforma.enviados[0][0] == NUM_LOTHEM


def test_empresa_so_crm_nao_responde_nem_chama_ia_sozinha(plataforma):
    TestClient(crm.app).post("/webhook", json=payload(NUM_LOJA, wamid="w1"))
    assert plataforma.chamadas == [] and plataforma.enviados == []


def test_botao_preencher_crm_com_ia(plataforma):
    bia = cliente("bia@loja.com")
    lead = bia.post("/api/simular", json={"telefone": "5531", "texto": "quero um vestido até 300 reais"}).json()
    bia.post("/api/simular", json={"telefone": "5531", "texto": "Temos sim! Qual tamanho?", "autor": "vendedor"})
    d = bia.post(f"/api/leads/{lead['id']}/preencher").json()
    assert d["nome"] == "Ana" and "Loja da Ana" in d["resumo"]
    assert plataforma.chamadas == [(plataforma.loja_id, False)]
    assert plataforma.enviados == []


def test_preencher_automatico_quando_ligado(plataforma):
    emp = tenants.obter(plataforma.loja_id)
    tenants.salvar_config(emp, emp.cfg | {"preencher_automatico": True}, "", "teste")
    TestClient(crm.app).post("/webhook", json=payload(NUM_LOJA, wamid="w1"))
    assert plataforma.chamadas == [(plataforma.loja_id, False)] and plataforma.enviados == []


def test_transferir_para_humano_pausa_ia(plataforma):
    plataforma.ajustes.update(transferir_para_humano=True, resposta="Vou chamar alguém do time.")
    d = cliente().post("/api/simular", json={"telefone": "5511", "texto": "quero falar com uma pessoa"}).json()
    assert d["lista"] == "humano" and d["ia_ativa"] == 0


def test_limite_mensal_bloqueia_ia(plataforma):
    db.atualizar_empresa(plataforma.loja_id, {"limite_mensal": 1})
    bia = cliente("bia@loja.com")
    lead = bia.post("/api/simular", json={"telefone": "5531", "texto": "oi"}).json()
    assert bia.post(f"/api/leads/{lead['id']}/preencher").status_code == 200
    assert bia.post(f"/api/leads/{lead['id']}/preencher").status_code == 429
    assert db.uso_do_mes(plataforma.loja_id)["chamadas"] == 1


def test_resposta_dividida_em_duas_mensagens(plataforma):
    plataforma.ajustes["resposta"] = "Que bacana!\n\nE de quanto você precisa?"
    d = cliente().post("/api/simular", json={"telefone": "5512", "texto": "tenho empresa"}).json()
    assert [m["texto"] for m in d["mensagens"] if m["autor"] == "ia"] == ["Que bacana!", "E de quanto você precisa?"]


def test_dividir_mensagens_limita_a_duas():
    assert crm.dividir_mensagens("a\n\nb\n\nc") == ["a", "b\n\nc"]


# ------------------------------------------------------------------ configuração por empresa
def test_dono_configura_campos_funil_e_versoes(plataforma):
    bia = cliente("bia@loja.com")
    cfg = bia.get("/api/empresa").json()["config"]
    cfg["campos"] = [{"rotulo": "Tamanho", "instrucao": "P, M, G"}, {"rotulo": "Cor preferida", "instrucao": ""}]
    cfg["sdr_ativa"] = True
    r = bia.put("/api/empresa", json={"config": cfg, "treinamento": "Seja simpática."}).json()
    assert [c["id"] for c in r["config"]["campos"]] == ["tamanho", "cor_preferida"]
    emp = tenants.obter(plataforma.loja_id)
    assert emp.sdr_ativa and emp.treinamento == "Seja simpática."
    versoes = bia.get("/api/empresa/versoes").json()
    assert len(versoes) == 2
    bia.post(f"/api/empresa/versoes/{versoes[-1]['id']}/restaurar")
    assert not tenants.obter(plataforma.loja_id).sdr_ativa  # voltou à versão original
    assert len(bia.get("/api/empresa/versoes").json()) == 3  # restaurar também vira versão


def test_vendedor_nao_acessa_configuracoes(plataforma):
    bia = cliente("bia@loja.com")
    assert bia.post("/api/empresa/usuarios", json={"nome": "Leo", "email": "leo@loja.com",
                                                   "senha": SENHA}).status_code == 200
    leo = cliente("leo@loja.com")
    assert leo.get("/api/empresa").status_code == 403
    assert leo.get("/api/admin/empresas").status_code == 403
    assert leo.get("/api/leads").status_code == 200


def test_numero_whatsapp_nao_pode_ser_de_duas_empresas(plataforma):
    bia = cliente("bia@loja.com")
    assert bia.put("/api/empresa/whatsapp", json={"phone_number_id": NUM_LOTHEM}).status_code == 400


# ------------------------------------------------------------------ administradora
def test_admin_cria_empresa_e_entra_nela(plataforma):
    adm = cliente()
    r = adm.post("/api/admin/empresas", json={"nome": "Imob Sol", "nicho": "Imobiliária", "dono_nome": "Caio",
                                              "dono_email": "caio@sol.com", "dono_senha": SENHA})
    nova = r.json()["id"]
    lista = adm.get("/api/admin/empresas").json()
    assert {e["nome"] for e in lista} >= {"Imob Sol", "Loja Bella"}
    adm.post(f"/api/admin/entrar/{nova}")
    assert adm.get("/api/config").json()["empresa"] == "Imob Sol"
    assert cliente("caio@sol.com").get("/api/config").json()["empresa"] == "Imob Sol"


def test_empresa_desativada_para_de_receber(plataforma):
    cliente().patch(f"/api/admin/empresas/{plataforma.loja_id}", json={"ativo": False})
    TestClient(crm.app).post("/webhook", json=payload(NUM_LOJA, wamid="w1"))
    assert db.listar_leads(plataforma.loja_id) == []


# ------------------------------------------------------------------ WhatsApp
def test_verificacao_e_assinatura_webhook(plataforma, monkeypatch):
    monkeypatch.setattr(config, "WHATSAPP_VERIFY_TOKEN", "abc")
    c = TestClient(crm.app)
    assert c.get("/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "abc",
                                     "hub.challenge": "42"}).text == "42"
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", "segredo")
    corpo = json.dumps(payload(NUM_LOJA)).encode()
    assert c.post("/webhook", content=corpo, headers={"X-Hub-Signature-256": "sha256=errado"}).status_code == 401
    ok = "sha256=" + hmac.new(b"segredo", corpo, hashlib.sha256).hexdigest()
    assert c.post("/webhook", content=corpo, headers={"X-Hub-Signature-256": ok}).status_code == 200


def test_webhook_duplicado_nao_duplica(plataforma):
    c = TestClient(crm.app)
    c.post("/webhook", json=payload(NUM_LOJA, wamid="w1"))
    c.post("/webhook", json=payload(NUM_LOJA, wamid="w1"))
    lead = db.listar_leads(plataforma.loja_id)[0]
    assert len(db.listar_mensagens(lead["id"])) == 1


def test_documento_vira_anexo_da_empresa(plataforma, monkeypatch):
    async def fake_baixar(cred, media_id):
        assert cred["token"] == "tok"
        return b"%PDF contrato", "application/pdf"

    monkeypatch.setattr(crm.whatsapp, "baixar_midia", fake_baixar)
    doc = {"entry": [{"changes": [{"field": "messages", "value": {
        "metadata": {"phone_number_id": NUM_LOJA},
        "messages": [{"from": "5577", "id": "wamid.DOC", "type": "document",
                      "document": {"id": "m1", "filename": "Contrato.pdf", "mime_type": "application/pdf"}}]}}]}]}
    TestClient(crm.app).post("/webhook", json=doc)
    lead = db.listar_leads(plataforma.loja_id)[0]
    bia = cliente("bia@loja.com")
    anexo = bia.get(f"/api/leads/{lead['id']}").json()["anexos"][0]
    assert bia.get(f"/api/anexos/{anexo['id']}").content == b"%PDF contrato"
    assert cliente().get(f"/api/anexos/{anexo['id']}").status_code == 404  # outra empresa


def test_vendedor_responde_e_ia_pausa(plataforma):
    adm = cliente()
    lead = adm.post("/api/simular", json={"telefone": "5533", "texto": "oi"}).json()
    assert adm.post(f"/api/leads/{lead['id']}/mensagens", json={"texto": "Oi, sou a Rebeca!"}).status_code == 200
    d = adm.get(f"/api/leads/{lead['id']}").json()
    assert d["ia_ativa"] == 0 and d["mensagens"][-1]["autor"] == "vendedor"


# ------------------------------------------------------------------ migração do banco antigo
def test_importa_banco_antigo_para_empresa_1(tmp_path, monkeypatch):
    legado = tmp_path / "legado.db"
    v = sqlite3.connect(legado)
    v.executescript("""
        CREATE TABLE leads (id INTEGER PRIMARY KEY, telefone TEXT, nome_whatsapp TEXT, nome TEXT, dor TEXT,
          ficha TEXT, lista TEXT, temperatura TEXT, score INTEGER, resumo TEXT, proximo_passo TEXT,
          ia_ativa INTEGER, vendedor TEXT, criado_em TEXT, atualizado_em TEXT, ultima_msg_em TEXT);
        CREATE TABLE mensagens (id INTEGER PRIMARY KEY, lead_id INTEGER, wa_msg_id TEXT, autor TEXT, texto TEXT,
          criado_em TEXT);
        CREATE TABLE historico (id INTEGER PRIMARY KEY, lead_id INTEGER, descricao TEXT, criado_em TEXT);
        INSERT INTO leads VALUES (1,'5511','Ana','Ana','dor','{}','lista_que_nao_existe_mais','',0,'res','',1,'',
          '2026-09-30','2026-09-30',NULL);
        INSERT INTO mensagens VALUES (1,1,'w9','cliente','oi','2026-09-30');
        INSERT INTO historico VALUES (1,1,'Lead chegou','2026-09-30');
    """)
    v.commit()
    v.close()
    db.reset(str(tmp_path / "multi.db"), "")
    monkeypatch.setattr(config, "CRM_DB_LEGADO", str(legado))
    monkeypatch.setattr(config, "ADMIN_SENHA", "")
    tenants.preparar_plataforma()
    tenants.preparar_plataforma()  # segunda vez não duplica
    leads = db.listar_leads(1)
    assert len(leads) == 1 and leads[0]["nome"] == "Ana" and leads[0]["lista"] == "novo"
    assert db.listar_mensagens(leads[0]["id"])[0]["texto"] == "oi"
    db.reset()


def test_prompt_generico_e_da_sdr():
    import sdr
    db.reset(":memory:", "")
    cfg = tenants.modelo_generico()
    emp = tenants.Empresa({"id": 1, "nome": "Loja X", "config": cfg, "treinamento": ""})
    p = sdr.montar_system_prompt(emp)
    assert "NUNCA escreve para o cliente" in p and "Loja X" in p
    emp.cfg["sdr_ativa"] = True
    p = sdr.montar_system_prompt(emp)
    assert "SDR" in p and "<treinamento>" in p
    s = sdr._schema(emp)
    assert s["properties"]["ficha"]["required"] == emp.campos_ids
    assert "humano" not in s["properties"]["lista"]["enum"]
    db.reset()
