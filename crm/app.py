"""CRM com IA para WhatsApp — plataforma multiempresa.

Rodar:  uvicorn app:app --host 0.0.0.0 --port 8000
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
import config
import db
import sdr
import tenants
import whatsapp

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("crm")


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    tenants.preparar_plataforma()
    yield


app = FastAPI(title="CRM com IA para WhatsApp", lifespan=ciclo_de_vida)
STATIC = config.BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


# ---------------------------------------------------------------------------
# Sessão / permissões
# ---------------------------------------------------------------------------
class Sessao:
    def __init__(self, usuario: dict, empresa: tenants.Empresa):
        self.usuario = usuario
        self.empresa = empresa

    @property
    def admin(self) -> bool:
        return self.usuario["papel"] == "admin"

    @property
    def gestor(self) -> bool:
        return self.usuario["papel"] in ("admin", "dono")


def _sessao_do_request(request: Request) -> Sessao | None:
    dados = auth.ler_sessao(request.cookies.get(auth.COOKIE))
    if not dados:
        return None
    usuario = db.obter_usuario(dados["u"])
    if not usuario:
        return None
    empresa_id = dados["e"] if usuario["papel"] == "admin" else usuario["empresa_id"]
    empresa = tenants.obter(empresa_id) if empresa_id else None
    if not empresa:
        return None
    return Sessao(usuario, empresa)


def logado(request: Request) -> Sessao:
    s = _sessao_do_request(request)
    if not s:
        raise HTTPException(401, "Faça login")
    return s


def gestor(s: Sessao = Depends(logado)) -> Sessao:
    if not s.gestor:
        raise HTTPException(403, "Só o dono da conta pode fazer isso")
    return s


def administradora(s: Sessao = Depends(logado)) -> Sessao:
    if not s.admin:
        raise HTTPException(403, "Área da administradora da plataforma")
    return s


def _gravar_sessao(request: Request, response: Response, usuario_id: int, empresa_id: int) -> None:
    # Cookie "secure" quando o acesso é por https (o Railway informa via X-Forwarded-Proto).
    https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").startswith("https")
    response.set_cookie(auth.COOKIE, auth.criar_sessao(usuario_id, empresa_id), httponly=True, samesite="lax",
                        max_age=config.SESSAO_DIAS * 86400, secure=https)


# ---------------------------------------------------------------------------
# Motor da IA
# ---------------------------------------------------------------------------
_locks: dict[int, asyncio.Lock] = {}
_esperas: dict[int, asyncio.Task] = {}


def _lock(lead_id: int) -> asyncio.Lock:
    return _locks.setdefault(lead_id, asyncio.Lock())


def dividir_mensagens(texto: str, maximo: int = 2) -> list[str]:
    """A IA separa as mensagens com linha em branco; manda no máximo `maximo` balões."""
    partes = [p.strip() for p in texto.split("\n\n") if p.strip()]
    if len(partes) > maximo:
        partes = partes[: maximo - 1] + ["\n\n".join(partes[maximo - 1:])]
    return partes


def ia_deve_responder(emp: tenants.Empresa, lead: dict) -> bool:
    lista = emp.listas_por_id.get(lead["lista"], {})
    return emp.sdr_ativa and bool(lead["ia_ativa"]) and lista.get("ia_responde", True)


def limite_atingido(emp: tenants.Empresa) -> bool:
    return bool(emp.limite_mensal) and db.uso_do_mes(emp.id)["chamadas"] >= emp.limite_mensal


async def processar_lead(lead_id: int, sem_responder: bool = False) -> dict | None:
    """Roda a IA sobre a conversa: preenche ficha/resumo, move de lista e, se a SDR estiver ativa
    (e `sem_responder` for falso), responde o cliente."""
    async with _lock(lead_id):
        lead = db.obter_lead(lead_id)
        if lead is None:
            return None
        emp = tenants.obter(lead["empresa_id"])
        if emp is None or not emp.ativo:
            return None
        if limite_atingido(emp):
            db.registrar(lead_id, "Limite mensal de uso da IA atingido – fale com o suporte para ampliar o plano")
            return None
        mensagens = db.listar_mensagens(lead_id, limite=80)
        if not mensagens:
            return None
        responder = (not sem_responder) and ia_deve_responder(emp, lead) and mensagens[-1]["autor"] == "cliente"
        resultado = await sdr.analisar(emp, lead, mensagens, responder)
        if resultado is None:
            return None

        # 1) Ficha (só sobrescreve quando a IA trouxe algo)
        campos = {c: resultado[c].strip() for c in ("nome", "dor") if (resultado.get(c) or "").strip()}
        ficha = dict(lead["ficha"])
        for c, v in (resultado.get("ficha") or {}).items():
            if c in emp.campos_ids and (v or "").strip():
                ficha[c] = v.strip()
        campos["ficha"] = ficha
        campos["resumo"] = resultado.get("resumo", lead["resumo"])
        campos["proximo_passo"] = resultado.get("proximo_passo", lead["proximo_passo"])
        campos["temperatura"] = resultado.get("temperatura", lead["temperatura"])
        campos["score"] = max(0, min(100, int(resultado.get("score") or 0)))

        # 2) Lista: a IA só move enquanto o lead está nas listas dela
        nova_lista = lead["lista"]
        if lead["lista"] in emp.listas_da_ia or lead["lista"] not in emp.listas_por_id:
            nova_lista = resultado.get("lista") or lead["lista"]
            if resultado.get("transferir_para_humano") and emp.sdr_ativa:
                nova_lista = emp.lista_handoff
            if nova_lista not in emp.listas_por_id:
                nova_lista = lead["lista"] if lead["lista"] in emp.listas_por_id else emp.lista_inicial
        if nova_lista != lead["lista"]:
            campos["lista"] = nova_lista
            db.registrar(lead_id, f'IA moveu para "{emp.listas_por_id[nova_lista]["nome"]}"')
        db.atualizar_lead(lead_id, campos)

        # 3) Resposta ao cliente (SDR)
        texto = (resultado.get("resposta") or "").strip()
        if responder and texto:
            for i, parte in enumerate(dividir_mensagens(texto)):
                if i:
                    await asyncio.sleep(min(config.PAUSA_MAX_SEGUNDOS, 1 + len(parte) / 40))
                try:
                    wa_id = await whatsapp.enviar_texto(emp.whatsapp, lead["telefone"], parte)
                    db.salvar_mensagem(lead_id, "ia", parte, wa_id)
                except RuntimeError as e:
                    db.registrar(lead_id, f"Falha ao enviar resposta da IA: {e}")
                    break

        # 4) Passagem de bastão para o vendedor
        if emp.sdr_ativa and lead["ia_ativa"] and (
                resultado.get("transferir_para_humano")
                or not emp.listas_por_id[nova_lista].get("ia_responde", True)):
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


def registrar_evento(emp: tenants.Empresa, ev: dict) -> tuple[dict, bool]:
    lead = db.obter_ou_criar_lead(emp.id, ev["telefone"], ev.get("nome_whatsapp", ""), emp.lista_inicial)
    nova = db.salvar_mensagem(lead["id"], ev["autor"], ev["texto"], ev.get("wa_msg_id"))
    return lead, nova


async def guardar_midia(emp: tenants.Empresa, lead_id: int, midia: dict, wa_msg_id: str | None) -> None:
    """Baixa o documento/imagem do cliente e anexa ao card do lead."""
    try:
        conteudo, mime = await whatsapp.baixar_midia(emp.whatsapp, midia["id"])
    except Exception as e:  # noqa: BLE001 - qualquer falha de download só vira registro no histórico
        log.warning("Não consegui baixar a mídia %s: %s", midia.get("id"), e)
        db.registrar(lead_id, f'Não foi possível baixar o arquivo "{midia["nome"]}" do WhatsApp')
        return
    pasta = config.ANEXOS_DIR / str(emp.id) / str(lead_id)
    pasta.mkdir(parents=True, exist_ok=True)
    nome = "".join(ch for ch in midia["nome"] if ch.isalnum() or ch in "._- ") or "arquivo"
    caminho = pasta / f"{(wa_msg_id or 'x')[-10:]}-{nome}"
    caminho.write_bytes(conteudo)
    db.salvar_anexo(lead_id, midia["nome"], str(caminho), mime or midia.get("mime", ""))
    db.registrar(lead_id, f'Arquivo recebido e anexado: {midia["nome"]}')


# ---------------------------------------------------------------------------
# Webhook do WhatsApp (um app da Meta para todas as empresas)
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
        emp = tenants.por_numero(ev["phone_number_id"]) if ev["phone_number_id"] else None
        if emp is None or not emp.ativo:
            log.warning("Mensagem para um número sem empresa cadastrada: %s", ev["phone_number_id"])
            continue
        lead, nova = registrar_evento(emp, ev)
        if not nova:
            continue
        if ev.get("midia"):
            await guardar_midia(emp, lead["id"], ev["midia"], ev.get("wa_msg_id"))
        if ev["autor"] == "vendedor" and lead["ia_ativa"] and emp.sdr_ativa:
            db.atualizar_lead(lead["id"], {"ia_ativa": 0})
            db.registrar(lead["id"], "Vendedor respondeu pelo WhatsApp – IA pausada")
        if emp.sdr_ativa or emp.cfg.get("preencher_automatico"):
            agendar(lead["id"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
class Login(BaseModel):
    email: str
    senha: str


@app.post("/api/login")
async def login(dados: Login, request: Request, response: Response):
    u = db.usuario_por_email(dados.email)
    if not u or not auth.conferir_senha(dados.senha, u["senha_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos")
    if not u["empresa_id"] or not db.obter_empresa(u["empresa_id"]):
        raise HTTPException(403, "Usuário sem empresa")
    _gravar_sessao(request, response, u["id"], u["empresa_id"])
    return {"ok": True, "papel": u["papel"]}


@app.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie(auth.COOKIE)
    return {"ok": True}


class TrocaSenha(BaseModel):
    senha_atual: str
    nova_senha: str


@app.post("/api/eu/senha")
async def trocar_senha(dados: TrocaSenha, s: Sessao = Depends(logado)):
    if not auth.conferir_senha(dados.senha_atual, s.usuario["senha_hash"]):
        raise HTTPException(400, "Senha atual incorreta")
    if len(dados.nova_senha) < 8:
        raise HTTPException(400, "A nova senha precisa ter pelo menos 8 caracteres")
    db.atualizar_senha(s.usuario["id"], auth.hash_senha(dados.nova_senha))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Painel (leads)
# ---------------------------------------------------------------------------
class AtualizacaoLead(BaseModel):
    nome: str | None = None
    dor: str | None = None
    ficha: dict[str, str] | None = None
    lista: str | None = None
    ia_ativa: bool | None = None
    vendedor: str | None = None
    resumo: str | None = None
    proximo_passo: str | None = None


class NovaMensagem(BaseModel):
    texto: str


class Simulacao(BaseModel):
    telefone: str
    texto: str
    nome_whatsapp: str = ""
    autor: str = "cliente"


def _lead_da_empresa(s: Sessao, lead_id: int) -> dict:
    lead = db.obter_lead(lead_id, s.empresa.id)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")
    return lead


@app.get("/api/config")
async def ver_config(s: Sessao = Depends(logado)):
    e = s.empresa
    return {"listas": e.listas, "campos": e.campos, "empresa": e.nome, "nome_sdr": e.nome_sdr,
            "sdr_ativa": e.sdr_ativa, "papel": s.usuario["papel"], "usuario": s.usuario["nome"],
            "email": s.usuario["email"], "whatsapp_conectado": bool(e.token and e.phone_number_id)}


@app.get("/api/leads")
async def listar(busca: str = "", s: Sessao = Depends(logado)):
    return db.listar_leads(s.empresa.id, busca)


@app.get("/api/leads/{lead_id}")
async def detalhe(lead_id: int, s: Sessao = Depends(logado)):
    lead = _lead_da_empresa(s, lead_id)
    return {**lead, "mensagens": db.listar_mensagens(lead_id), "historico": db.listar_historico(lead_id),
            "anexos": db.listar_anexos(lead_id)}


@app.get("/api/anexos/{anexo_id}")
async def baixar_anexo(anexo_id: int, s: Sessao = Depends(logado)):
    a = db.obter_anexo(anexo_id, s.empresa.id)
    if not a:
        raise HTTPException(404, "Anexo não encontrado")
    return FileResponse(a["caminho"], filename=a["nome_arquivo"], media_type=a["mime"] or None)


@app.patch("/api/leads/{lead_id}")
async def atualizar(lead_id: int, dados: AtualizacaoLead, s: Sessao = Depends(logado)):
    lead = _lead_da_empresa(s, lead_id)
    emp = s.empresa
    campos = dados.model_dump(exclude_none=True)
    if "ficha" in campos:
        campos["ficha"] = {**lead["ficha"], **{k: v for k, v in campos["ficha"].items() if k in emp.campos_ids}}
    if "lista" in campos:
        if campos["lista"] not in emp.listas_por_id:
            raise HTTPException(400, "Lista inexistente")
        if campos["lista"] != lead["lista"]:
            quem = s.usuario["nome"] or "Vendedor"
            db.registrar(lead_id, f'{quem} moveu para "{emp.listas_por_id[campos["lista"]]["nome"]}"')
            if not emp.listas_por_id[campos["lista"]].get("ia_responde", True) and "ia_ativa" not in campos:
                campos["ia_ativa"] = False
    if "ia_ativa" in campos:
        campos["ia_ativa"] = int(campos["ia_ativa"])
        if campos["ia_ativa"] != lead["ia_ativa"]:
            db.registrar(lead_id, "IA reativada" if campos["ia_ativa"] else "IA pausada manualmente")
    db.atualizar_lead(lead_id, campos)
    return db.obter_lead(lead_id, emp.id)


@app.post("/api/leads/{lead_id}/mensagens")
async def vendedor_envia(lead_id: int, msg: NovaMensagem, tarefas: BackgroundTasks, s: Sessao = Depends(logado)):
    lead = _lead_da_empresa(s, lead_id)
    texto = msg.texto.strip()
    if not texto:
        raise HTTPException(400, "Mensagem vazia")
    try:
        wa_id = await whatsapp.enviar_texto(s.empresa.whatsapp, lead["telefone"], texto)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    db.salvar_mensagem(lead_id, "vendedor", texto, wa_id)
    campos = {"ia_ativa": 0}
    if not lead["vendedor"]:
        campos["vendedor"] = s.usuario["nome"]
    if lead["ia_ativa"] and s.empresa.sdr_ativa:
        db.registrar(lead_id, "Vendedor assumiu a conversa – IA pausada")
    db.atualizar_lead(lead_id, campos)
    if s.empresa.sdr_ativa or s.empresa.cfg.get("preencher_automatico"):
        tarefas.add_task(processar_lead, lead_id, True)
    return {"ok": True}


@app.post("/api/leads/{lead_id}/preencher")
async def preencher_com_ia(lead_id: int, s: Sessao = Depends(logado)):
    """Botão "Preencher CRM com IA": lê a conversa e preenche ficha, lista e resumo (nunca responde o cliente)."""
    _lead_da_empresa(s, lead_id)
    if limite_atingido(s.empresa):
        raise HTTPException(429, "Limite mensal de uso da IA atingido")
    if await processar_lead(lead_id, sem_responder=True) is None:
        raise HTTPException(502, "A IA não conseguiu analisar a conversa agora. Tente de novo em instantes.")
    return db.obter_lead(lead_id, s.empresa.id)


@app.post("/api/simular")
async def simular(sim: Simulacao, s: Sessao = Depends(logado)):
    """Simula uma mensagem chegando no WhatsApp (testar sem a Meta configurada)."""
    autor = "vendedor" if sim.autor == "vendedor" else "cliente"
    lead, _ = registrar_evento(s.empresa, {"telefone": sim.telefone, "nome_whatsapp": sim.nome_whatsapp,
                                           "texto": sim.texto, "wa_msg_id": None, "autor": autor})
    if autor == "cliente" and (s.empresa.sdr_ativa or s.empresa.cfg.get("preencher_automatico")):
        await processar_lead(lead["id"])
    return {**db.obter_lead(lead["id"], s.empresa.id), "mensagens": db.listar_mensagens(lead["id"])}


# ---------------------------------------------------------------------------
# Configurações da empresa (dono)
# ---------------------------------------------------------------------------
class ConfigEmpresa(BaseModel):
    nome: str | None = None
    config: dict
    treinamento: str = ""


class WhatsappEmpresa(BaseModel):
    phone_number_id: str = ""
    token: str = ""


class NovoUsuario(BaseModel):
    nome: str
    email: str
    senha: str
    papel: str = "vendedor"


@app.get("/api/empresa")
async def ver_empresa(s: Sessao = Depends(gestor)):
    e = s.empresa
    return {"id": e.id, "nome": e.nome, "config": e.cfg, "treinamento": e.treinamento,
            "whatsapp": {"phone_number_id": e.phone_number_id, "token_configurado": bool(e.token)},
            "limite_mensal": e.limite_mensal, "uso": db.uso_do_mes(e.id)}


@app.put("/api/empresa")
async def salvar_empresa(dados: ConfigEmpresa, s: Sessao = Depends(gestor)):
    if dados.nome and dados.nome.strip():
        db.atualizar_empresa(s.empresa.id, {"nome": dados.nome.strip()})
    emp = tenants.salvar_config(s.empresa, dados.config, dados.treinamento, s.usuario["email"])
    return {"ok": True, "config": emp.cfg}


@app.put("/api/empresa/whatsapp")
async def salvar_whatsapp(dados: WhatsappEmpresa, s: Sessao = Depends(gestor)):
    numero = dados.phone_number_id.strip()
    if numero:
        dono = tenants.por_numero(numero)
        if dono and dono.id != s.empresa.id:
            raise HTTPException(400, "Este número já está conectado a outra conta")
    campos = {"whatsapp_phone_number_id": numero}
    if dados.token.strip():
        campos["whatsapp_token"] = dados.token.strip()
    db.atualizar_empresa(s.empresa.id, campos)
    return {"ok": True}


@app.get("/api/empresa/versoes")
async def versoes(s: Sessao = Depends(gestor)):
    return db.listar_versoes(s.empresa.id)


@app.post("/api/empresa/versoes/{versao_id}/restaurar")
async def restaurar_versao(versao_id: int, s: Sessao = Depends(gestor)):
    v = db.obter_versao(s.empresa.id, versao_id)
    if not v:
        raise HTTPException(404, "Versão não encontrada")
    tenants.salvar_config(s.empresa, v["config"], v["treinamento"], f'{s.usuario["email"]} (restaurou #{versao_id})')
    return {"ok": True}


@app.get("/api/empresa/usuarios")
async def usuarios(s: Sessao = Depends(gestor)):
    return db.listar_usuarios(s.empresa.id)


@app.post("/api/empresa/usuarios")
async def criar_usuario(dados: NovoUsuario, s: Sessao = Depends(gestor)):
    if len(dados.senha) < 8:
        raise HTTPException(400, "A senha precisa ter pelo menos 8 caracteres")
    if db.usuario_por_email(dados.email):
        raise HTTPException(400, "Já existe um usuário com esse e-mail")
    papel = "dono" if dados.papel == "dono" else "vendedor"
    u = db.criar_usuario(s.empresa.id, dados.nome.strip(), dados.email, auth.hash_senha(dados.senha), papel)
    return {"id": u["id"]}


@app.delete("/api/empresa/usuarios/{usuario_id}")
async def remover_usuario(usuario_id: int, s: Sessao = Depends(gestor)):
    if usuario_id == s.usuario["id"]:
        raise HTTPException(400, "Você não pode remover a si mesma")
    db.remover_usuario(s.empresa.id, usuario_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Administradora da plataforma
# ---------------------------------------------------------------------------
class NovaEmpresa(BaseModel):
    nome: str
    nicho: str = ""
    dono_nome: str
    dono_email: str
    dono_senha: str
    limite_mensal: int = 0


class AjusteEmpresa(BaseModel):
    limite_mensal: int | None = None
    ativo: bool | None = None


@app.get("/api/admin/empresas")
async def admin_empresas(_s: Sessao = Depends(administradora)):
    return [{"id": e["id"], "nome": e["nome"], "nicho": e["config"].get("nicho", ""), "ativo": bool(e["ativo"]),
             "limite_mensal": e["limite_mensal"], "chamadas_mes": e["chamadas_mes"], "total_leads": e["total_leads"],
             "whatsapp_conectado": bool(e["whatsapp_phone_number_id"] and e["whatsapp_token"]),
             "criado_em": e["criado_em"]} for e in db.listar_empresas()]


@app.post("/api/admin/empresas")
async def admin_criar_empresa(dados: NovaEmpresa, _s: Sessao = Depends(administradora)):
    if len(dados.dono_senha) < 8:
        raise HTTPException(400, "A senha do dono precisa ter pelo menos 8 caracteres")
    if db.usuario_por_email(dados.dono_email):
        raise HTTPException(400, "Já existe um usuário com esse e-mail")
    emp = tenants.criar(dados.nome.strip(), dados.nicho.strip(), dados.dono_nome.strip(), dados.dono_email,
                        dados.dono_senha, dados.limite_mensal)
    return {"id": emp.id}


@app.patch("/api/admin/empresas/{empresa_id}")
async def admin_ajustar_empresa(empresa_id: int, dados: AjusteEmpresa, _s: Sessao = Depends(administradora)):
    if not db.obter_empresa(empresa_id):
        raise HTTPException(404, "Empresa não encontrada")
    campos = dados.model_dump(exclude_none=True)
    if "ativo" in campos:
        campos["ativo"] = int(campos["ativo"])
    db.atualizar_empresa(empresa_id, campos)
    return {"ok": True}


@app.post("/api/admin/entrar/{empresa_id}")
async def admin_entrar(empresa_id: int, request: Request, response: Response,
                       s: Sessao = Depends(administradora)):
    """A administradora abre o CRM de uma empresa cliente (suporte/configuração)."""
    if not db.obter_empresa(empresa_id):
        raise HTTPException(404, "Empresa não encontrada")
    _gravar_sessao(request, response, s.usuario["id"], empresa_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------
def _pagina(request: Request, arquivo: str, precisa: str | None = None):
    s = _sessao_do_request(request)
    if not s:
        return RedirectResponse("/login", status_code=303)
    if (precisa == "gestor" and not s.gestor) or (precisa == "admin" and not s.admin):
        return RedirectResponse("/", status_code=303)
    return FileResponse(STATIC / arquivo)


@app.get("/")
async def painel(request: Request):
    return _pagina(request, "index.html")


@app.get("/configuracoes")
async def pagina_config(request: Request):
    return _pagina(request, "config.html", "gestor")


@app.get("/admin")
async def pagina_admin(request: Request):
    return _pagina(request, "admin.html", "admin")


@app.get("/login")
async def pagina_login():
    return FileResponse(STATIC / "login.html")


@app.get("/saude")
async def saude():
    return {"ok": True}
