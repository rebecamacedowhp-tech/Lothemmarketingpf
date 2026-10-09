"""Empresas clientes: configuração de cada uma, modelo para novos nichos e criação da empresa nº 1."""
import json
import logging
import re
import sqlite3
import unicodedata
from pathlib import Path

import auth
import config
import db

log = logging.getLogger("tenants")


class Empresa:
    """Visão de uma empresa com atalhos para a configuração (campos, funil, SDR)."""

    def __init__(self, linha: dict):
        self.id: int = linha["id"]
        self.nome: str = linha["nome"]
        self.cfg: dict = normalizar_config(linha["config"])
        self.treinamento: str = linha.get("treinamento") or ""
        self.phone_number_id: str = linha.get("whatsapp_phone_number_id") or ""
        self.token: str = linha.get("whatsapp_token") or ""
        self.limite_mensal: int = int(linha.get("limite_mensal") or 0)
        self.ativo: bool = bool(linha.get("ativo", 1))

    @property
    def listas(self) -> list[dict]:
        return self.cfg["listas"]

    @property
    def listas_por_id(self) -> dict:
        return {l["id"]: l for l in self.listas}

    @property
    def lista_inicial(self) -> str:
        return self.listas[0]["id"]

    @property
    def listas_da_ia(self) -> list[str]:
        return [l["id"] for l in self.listas if l.get("ia_pode_mover", True)]

    @property
    def lista_handoff(self) -> str:
        h = self.cfg.get("lista_quando_transferir", "humano")
        return h if h in self.listas_por_id else self.lista_inicial

    @property
    def campos(self) -> list[dict]:
        return self.cfg["campos"]

    @property
    def campos_ids(self) -> list[str]:
        return [c["id"] for c in self.campos]

    @property
    def sdr_ativa(self) -> bool:
        return bool(self.cfg.get("sdr_ativa"))

    @property
    def nome_sdr(self) -> str:
        return self.cfg.get("nome_sdr") or "Assistente"

    @property
    def whatsapp(self) -> dict:
        return {"token": self.token, "phone_number_id": self.phone_number_id}


def modelo_generico() -> dict:
    return json.loads(Path(config.MODELO_GENERICO).read_text(encoding="utf-8"))


def gerar_id(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", t).strip("_")[:40] or "campo"


def normalizar_config(cfg: dict) -> dict:
    """Garante que a configuração tem tudo o que o sistema precisa (ids únicos, ao menos uma lista)."""
    base = modelo_generico()
    cfg = {**base, **(cfg or {})}
    vistos = set()
    campos = []
    for c in cfg.get("campos") or []:
        rotulo = (c.get("rotulo") or "").strip()
        if not rotulo:
            continue
        cid = gerar_id(c.get("id") or rotulo)
        while cid in vistos or cid in ("nome", "dor"):
            cid += "_2"
        vistos.add(cid)
        campos.append({"id": cid, "rotulo": rotulo, "instrucao": (c.get("instrucao") or "").strip()})
    cfg["campos"] = campos
    vistos = set()
    listas = []
    for l in cfg.get("listas") or []:
        nome = (l.get("nome") or "").strip()
        if not nome:
            continue
        lid = gerar_id(l.get("id") or nome)
        while lid in vistos:
            lid += "_2"
        vistos.add(lid)
        listas.append({
            "id": lid, "nome": nome, "cor": l.get("cor") or "#64748b",
            "descricao": (l.get("descricao") or "").strip(),
            "ia_pode_mover": bool(l.get("ia_pode_mover", True)),
            "ia_responde": bool(l.get("ia_responde", True)),
        })
    cfg["listas"] = listas or base["listas"]
    return cfg


def obter(empresa_id: int) -> Empresa | None:
    linha = db.obter_empresa(empresa_id)
    return Empresa(linha) if linha else None


def por_numero(phone_number_id: str) -> Empresa | None:
    linha = db.empresa_por_numero(phone_number_id)
    return Empresa(linha) if linha else None


def criar(nome: str, nicho: str = "", dono_nome: str = "", dono_email: str = "", dono_senha: str = "",
          limite_mensal: int = 0) -> Empresa:
    cfg = modelo_generico()
    if nicho:
        cfg["nicho"] = nicho
    linha = db.criar_empresa(nome, cfg, "", limite_mensal=limite_mensal)
    if dono_email:
        db.criar_usuario(linha["id"], dono_nome, dono_email, auth.hash_senha(dono_senha), "dono")
    return Empresa(linha)


def salvar_config(empresa: Empresa, cfg: dict, treinamento: str, autor: str) -> Empresa:
    cfg = normalizar_config(cfg)
    db.atualizar_empresa(empresa.id, {"config": cfg, "treinamento": treinamento})
    db.salvar_versao(empresa.id, cfg, treinamento, autor)
    return obter(empresa.id)


# ---------------------------------------------------------------- empresa nº 1 (Lothem)
def _config_lothem() -> tuple[dict, str]:
    """Converte o sdr_config.json + treinamento_sdr.md da versão antiga para a configuração por empresa."""
    s = json.loads(Path(config.SEED_CONFIG).read_text(encoding="utf-8"))
    treinamento = Path(config.SEED_TREINAMENTO).read_text(encoding="utf-8").strip()
    d = s.get("diagnostico") or {}
    esp = s.get("especialista") or {}
    linhas = []
    if d:
        linhas.append(f'Produto que você vende: {d.get("nome", "")}')
        linhas += [f"- {i}" for i in d.get("o_que_inclui", [])]
        linhas.append(f'Preço PJ: {d.get("preco_pj") or "ainda não definido"}')
        linhas.append(f'Preço PF: {d.get("preco_pf") or "ainda não definido"}')
        linhas.append(f'Formas de pagamento: {d.get("formas_pagamento") or "ainda não definido"}')
        linhas.append(f'Link de pagamento PJ: {d.get("link_pagamento_pj") or "ainda não definido"}')
        linhas.append(f'Link de pagamento PF: {d.get("link_pagamento_pf") or "ainda não definido"}')
    if esp:
        linhas.append(f'Especialista que faz a reunião de diagnóstico: {esp.get("nome")}: {esp.get("apresentacao")}')
    linhas.append("Link de agendamento com a especialista (enviar depois do comprovante de pagamento): "
                  + (s.get("link_agendamento") or "ainda não definido"))
    cfg = {
        "nicho": "Assessoria de crédito PJ e PF",
        "sobre_empresa": s.get("sobre_empresa", ""),
        "nome_sdr": s.get("nome_sdr", "Ingrid"),
        "sdr_ativa": True,
        "preencher_automatico": True,
        "tom_de_voz": s.get("tom_de_voz", ""),
        "objetivo": s.get("objetivo", ""),
        "informacoes": "\n".join(linhas),
        "campos": s.get("campos", []),
        "lista_quando_transferir": s.get("lista_quando_transferir", "humano"),
        "listas": s.get("listas", []),
    }
    return cfg, treinamento


def preparar_plataforma() -> None:
    """Na primeira execução: cria a empresa nº 1 (Lothem), a administradora e importa o banco antigo."""
    b = db.banco()
    if not b.um("SELECT id FROM empresas ORDER BY id LIMIT 1"):
        cfg, treinamento = _config_lothem()
        nome = json.loads(Path(config.SEED_CONFIG).read_text(encoding="utf-8")).get("empresa", "Minha empresa")
        db.criar_empresa(nome, normalizar_config(cfg), treinamento, config.WHATSAPP_PHONE_NUMBER_ID or None,
                         config.WHATSAPP_TOKEN)
        log.info("Empresa nº 1 criada: %s", nome)
    primeira = b.um("SELECT id FROM empresas ORDER BY id LIMIT 1")["id"]
    if config.ADMIN_SENHA and not db.usuario_por_email(config.ADMIN_EMAIL):
        db.criar_usuario(primeira, "Administradora", config.ADMIN_EMAIL, auth.hash_senha(config.ADMIN_SENHA), "admin")
        log.info("Usuária administradora criada: %s", config.ADMIN_EMAIL)
    if not db.meta_obter("legado_importado"):
        importar_legado(primeira)
        db.meta_definir("legado_importado", db.agora())


def importar_legado(empresa_id: int) -> int:
    """Copia leads/mensagens/anexos/histórico do banco SQLite da versão de uma empresa só."""
    caminho = Path(config.CRM_DB_LEGADO)
    if not caminho.exists() or str(caminho) == str(config.CRM_DB_MULTI):
        return 0
    try:
        velho = sqlite3.connect(str(caminho))
        velho.row_factory = sqlite3.Row
        tabelas = {r[0] for r in velho.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "leads" not in tabelas:
            return 0
        colunas = {r[1] for r in velho.execute("PRAGMA table_info(leads)")}
        if "empresa_id" in colunas:
            return 0
        b = db.banco()
        emp = obter(empresa_id)
        total = 0
        for l in velho.execute("SELECT * FROM leads ORDER BY id"):
            l = dict(l)
            if l["lista"] not in emp.listas_por_id:
                l["lista"] = emp.lista_inicial
            novo = b.um(
                "INSERT INTO leads (empresa_id, telefone, nome_whatsapp, nome, dor, ficha, lista, temperatura,"
                " score, resumo, proximo_passo, ia_ativa, vendedor, criado_em, atualizado_em, ultima_msg_em)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (empresa_id, telefone) DO NOTHING RETURNING id",
                (empresa_id, l["telefone"], l.get("nome_whatsapp") or "", l.get("nome") or "", l.get("dor") or "",
                 l.get("ficha") or "{}", l["lista"], l.get("temperatura") or "", l.get("score") or 0,
                 l.get("resumo") or "", l.get("proximo_passo") or "", l.get("ia_ativa", 1), l.get("vendedor") or "",
                 l["criado_em"], l["atualizado_em"], l.get("ultima_msg_em")),
            )
            if not novo:
                continue
            total += 1
            for m in velho.execute("SELECT * FROM mensagens WHERE lead_id=? ORDER BY id", (l["id"],)):
                b.executar("INSERT INTO mensagens (lead_id, wa_msg_id, autor, texto, criado_em) VALUES (?,?,?,?,?)"
                           " ON CONFLICT (wa_msg_id) DO NOTHING",
                           (novo["id"], m["wa_msg_id"], m["autor"], m["texto"], m["criado_em"]))
            for h in velho.execute("SELECT * FROM historico WHERE lead_id=? ORDER BY id", (l["id"],)):
                b.executar("INSERT INTO historico (lead_id, descricao, criado_em) VALUES (?,?,?)",
                           (novo["id"], h["descricao"], h["criado_em"]))
            if "anexos" in tabelas:
                for a in velho.execute("SELECT * FROM anexos WHERE lead_id=? ORDER BY id", (l["id"],)):
                    b.executar("INSERT INTO anexos (lead_id, nome_arquivo, caminho, mime, criado_em) VALUES (?,?,?,?,?)",
                               (novo["id"], a["nome_arquivo"], a["caminho"], a["mime"], a["criado_em"]))
        velho.close()
        log.info("Importados %s leads do banco antigo", total)
        return total
    except sqlite3.Error:
        log.exception("Não foi possível importar o banco antigo")
        return 0
