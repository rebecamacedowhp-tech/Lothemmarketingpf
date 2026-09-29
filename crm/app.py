"""CRM Lothem + SDR IA no WhatsApp.

Rodar:  uvicorn app:app --host 0.0.0.0 --port 8000
"""
import asyncio
import logging
import secrets

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel

import config
import db
import sdr
import whatsapp

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("crm")

app = FastAPI(title="CRM Lothem – SDR IA")
_basic = HTTPBasic(auto_error=False)


def autenticado(cred: HTTPBasicCredentials | None = Depends(_basic)):
    if not config.CRM_SENHA:
        return
    if cred is None or not secrets.compare_digest(cred.password, config.CRM_SENHA):
        raise HTTPException(401, "Senha inválida", headers={"WWW-Authenticate": "Basic"})


# ---------------------------------------------------------------------------
# Motor da SDR IA
# ---------------------------------------------------------------------------
_locks: dict[int, asyncio.Lock] = {}
_esperas: dict[int, asyncio.Task] = {}


def _lock(lead_id: int) -> asyncio.Lock:
    return _locks.setdefault(lead_id, asyncio.Lock())


def ia_deve_responder(lead: dict) -> bool:
    lista = config.LISTAS_POR_ID.get(lead["lista"], {})
    return bool(lead["ia_ativa"]) and lista.get("ia_responde", True)


async def processar_lead(lead_id: int) -> dict | None:
    """Roda a SDR sobre a conversa do lead: responde (se a IA estiver ativa), preenche campos,
    move de lista e atualiza o resumo."""
    async with _lock(lead_id):
        lead = db.obter_lead(lead_id)
        if lead is None:
            return None
        mensagens = db.listar_mensagens(lead_id, limite=80)
        if not mensagens:
            return None
        responder = ia_deve_responder(lead) and mensagens[-1]["autor"] == "cliente"
        resultado = await sdr.analisar(lead, mensagens, responder)
        if resultado is None:
            return None

        # 1) Campos preenchidos pela IA (só sobrescreve quando ela trouxe algo)
        campos = {c: resultado[c].strip() for c in db.CAMPOS_IA if (resultado.get(c) or "").strip()}
        campos["resumo"] = resultado.get("resumo", lead["resumo"])
        campos["proximo_passo"] = resultado.get("proximo_passo", lead["proximo_passo"])
        campos["temperatura"] = resultado.get("temperatura", lead["temperatura"])
        campos["score"] = max(0, min(100, int(resultado.get("score") or 0)))

        # 2) Lista: a IA só move enquanto o lead está nas listas dela
        nova_lista = lead["lista"]
        if lead["lista"] in config.LISTAS_DA_IA:
            nova_lista = resultado.get("lista") or lead["lista"]
            if resultado.get("transferir_para_humano"):
                nova_lista = config.LISTA_HANDOFF
            if nova_lista not in config.LISTAS_POR_ID:
                nova_lista = lead["lista"]
        if nova_lista != lead["lista"]:
            campos["lista"] = nova_lista
            db.registrar(lead_id, f'IA moveu para "{config.LISTAS_POR_ID[nova_lista]["nome"]}"')
        db.atualizar_lead(lead_id, campos)

        # 3) Resposta ao cliente
        texto = (resultado.get("resposta") or "").strip()
        if responder and texto:
            try:
                wa_id = await whatsapp.enviar_texto(lead["telefone"], texto)
                db.salvar_mensagem(lead_id, "ia", texto, wa_id)
            except RuntimeError as e:
                db.registrar(lead_id, f"Falha ao enviar resposta da IA: {e}")

        # 4) Passagem de bastão para o vendedor
        if lead["ia_ativa"] and (resultado.get("transferir_para_humano")
                                 or not config.LISTAS_POR_ID[nova_lista].get("ia_responde", True)):
            db.atualizar_lead(lead_id, {"ia_ativa": 0})
            db.registrar(lead_id, "IA pausada – lead pronto para o vendedor")
        return resultado


async def _processar_depois(lead_id: int, segundos: float) -> None:
    try:
        await asyncio.sleep(segundos)
    except asyncio.CancelledError:
        return
    _esperas.pop(lead_id, None)
    try:
        await processar_lead(lead_id)
    except Exception:
        log.exception("Erro ao processar lead %s", lead_id)


def agendar(lead_id: int) -> None:
    """Espera o cliente parar de digitar (várias mensagens seguidas) antes de chamar a IA."""
    anterior = _esperas.get(lead_id)
    if anterior and not anterior.done():
        anterior.cancel()
    _esperas[lead_id] = asyncio.create_task(_processar_depois(lead_id, config.DEBOUNCE_SEGUNDOS))


def registrar_evento(ev: dict) -> tuple[dict, bool]:
    lead = db.obter_ou_criar_lead(ev["telefone"], ev.get("nome_whatsapp", ""))
    nova = db.salvar_mensagem(lead["id"], ev["autor"], ev["texto"], ev.get("wa_msg_id"))
    return lead, nova


# ---------------------------------------------------------------------------
# Webhook do WhatsApp
# ---------------------------------------------------------------------------
@app.get("/webhook")
async def verificar_webhook(request: Request):
    p = request.query_params
    if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == config.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(p.get("hub.challenge", ""))
    raise HTTPException(403, "Token de verificação inválido")


@app.post("/webhook")
async def receber_webhook(request: Request):
    corpo = await request.body()
    if not whatsapp.assinatura_valida(corpo, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(401, "Assinatura inválida")
    payload = await request.json()
    for ev in whatsapp.extrair_eventos(payload):
        lead, nova = registrar_evento(ev)
        if not nova:
            continue
        if ev["autor"] == "vendedor" and lead["ia_ativa"]:
            # Alguém respondeu pelo celular: o humano assumiu.
            db.atualizar_lead(lead["id"], {"ia_ativa": 0})
            db.registrar(lead["id"], "Vendedor respondeu pelo WhatsApp – IA pausada")
        agendar(lead["id"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# API do painel
# ---------------------------------------------------------------------------
class AtualizacaoLead(BaseModel):
    nome: str | None = None
    dor: str | None = None
    empresa: str | None = None
    segmento: str | None = None
    orcamento: str | None = None
    faturamento: str | None = None
    decisor: str | None = None
    urgencia: str | None = None
    lista: str | None = None
    ia_ativa: bool | None = None
    vendedor: str | None = None
    resumo: str | None = None
    proximo_passo: str | None = None


class NovaMensagem(BaseModel):
    texto: str
    vendedor: str = ""


class Simulacao(BaseModel):
    telefone: str
    texto: str
    nome_whatsapp: str = ""


@app.get("/api/config", dependencies=[Depends(autenticado)])
async def ver_config():
    return {"listas": config.LISTAS, "empresa": config.SDR["empresa"], "nome_sdr": config.SDR["nome_sdr"],
            "whatsapp_conectado": bool(config.WHATSAPP_TOKEN and config.WHATSAPP_PHONE_NUMBER_ID)}


@app.get("/api/leads", dependencies=[Depends(autenticado)])
async def listar(busca: str = ""):
    return db.listar_leads(busca)


@app.get("/api/leads/{lead_id}", dependencies=[Depends(autenticado)])
async def detalhe(lead_id: int):
    lead = db.obter_lead(lead_id)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")
    return {**lead, "mensagens": db.listar_mensagens(lead_id), "historico": db.listar_historico(lead_id)}


@app.patch("/api/leads/{lead_id}", dependencies=[Depends(autenticado)])
async def atualizar(lead_id: int, dados: AtualizacaoLead):
    lead = db.obter_lead(lead_id)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")
    campos = dados.model_dump(exclude_none=True)
    if "lista" in campos:
        if campos["lista"] not in config.LISTAS_POR_ID:
            raise HTTPException(400, "Lista inexistente")
        if campos["lista"] != lead["lista"]:
            db.registrar(lead_id, f'Movido manualmente para "{config.LISTAS_POR_ID[campos["lista"]]["nome"]}"')
            if not config.LISTAS_POR_ID[campos["lista"]].get("ia_responde", True) and "ia_ativa" not in campos:
                campos["ia_ativa"] = False
    if "ia_ativa" in campos:
        campos["ia_ativa"] = int(campos["ia_ativa"])
        if campos["ia_ativa"] != lead["ia_ativa"]:
            db.registrar(lead_id, "IA reativada" if campos["ia_ativa"] else "IA pausada manualmente")
    db.atualizar_lead(lead_id, campos)
    return db.obter_lead(lead_id)


@app.post("/api/leads/{lead_id}/mensagens", dependencies=[Depends(autenticado)])
async def vendedor_envia(lead_id: int, msg: NovaMensagem, tarefas: BackgroundTasks):
    lead = db.obter_lead(lead_id)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")
    texto = msg.texto.strip()
    if not texto:
        raise HTTPException(400, "Mensagem vazia")
    try:
        wa_id = await whatsapp.enviar_texto(lead["telefone"], texto)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    db.salvar_mensagem(lead_id, "vendedor", texto, wa_id)
    campos = {"ia_ativa": 0}
    if msg.vendedor and not lead["vendedor"]:
        campos["vendedor"] = msg.vendedor
    if lead["ia_ativa"]:
        db.registrar(lead_id, "Vendedor assumiu a conversa – IA pausada")
    db.atualizar_lead(lead_id, campos)
    tarefas.add_task(processar_lead, lead_id)  # atualiza o resumo com o que o vendedor falou
    return {"ok": True}


@app.post("/api/leads/{lead_id}/resumir", dependencies=[Depends(autenticado)])
async def resumir(lead_id: int):
    if not db.obter_lead(lead_id):
        raise HTTPException(404, "Lead não encontrado")
    await processar_lead(lead_id)
    return db.obter_lead(lead_id)


@app.post("/api/simular", dependencies=[Depends(autenticado)])
async def simular(s: Simulacao):
    """Simula uma mensagem chegando no WhatsApp (para testar a SDR sem a Meta configurada)."""
    lead, _ = registrar_evento({"telefone": s.telefone, "nome_whatsapp": s.nome_whatsapp,
                                "texto": s.texto, "wa_msg_id": None, "autor": "cliente"})
    await processar_lead(lead["id"])
    return {**db.obter_lead(lead["id"]), "mensagens": db.listar_mensagens(lead["id"])}


@app.get("/", dependencies=[Depends(autenticado)])
async def painel():
    return FileResponse(config.BASE_DIR / "static" / "index.html")


@app.get("/saude")
async def saude():
    return {"ok": True}
