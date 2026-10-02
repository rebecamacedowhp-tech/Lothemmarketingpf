"""Banco SQLite do CRM: leads, mensagens e histórico de movimentações."""
import json
import sqlite3
import threading
from datetime import datetime, timezone

import config

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

CAMPOS_EDITAVEIS = ["nome", "dor", "ficha", "lista", "ia_ativa", "vendedor", "resumo", "proximo_passo",
                    "temperatura", "score"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT UNIQUE NOT NULL,
    nome_whatsapp TEXT DEFAULT '',
    nome TEXT DEFAULT '',
    dor TEXT DEFAULT '',
    ficha TEXT DEFAULT '{}',       -- campos de qualificação definidos em sdr_config.json
    lista TEXT NOT NULL,
    temperatura TEXT DEFAULT '',
    score INTEGER DEFAULT 0,
    resumo TEXT DEFAULT '',
    proximo_passo TEXT DEFAULT '',
    ia_ativa INTEGER DEFAULT 1,
    vendedor TEXT DEFAULT '',
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    ultima_msg_em TEXT
);
CREATE TABLE IF NOT EXISTS mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    wa_msg_id TEXT UNIQUE,
    autor TEXT NOT NULL,          -- cliente | ia | vendedor
    texto TEXT NOT NULL,
    criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_lead ON mensagens(lead_id, id);
CREATE TABLE IF NOT EXISTS anexos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    nome_arquivo TEXT NOT NULL,
    caminho TEXT NOT NULL,
    mime TEXT DEFAULT '',
    criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    descricao TEXT NOT NULL,
    criado_em TEXT NOT NULL
);
"""


def agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(config.CRM_DB, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.executescript(SCHEMA)
    return _conn


def reset(caminho: str) -> None:
    """Troca o arquivo do banco (usado nos testes)."""
    global _conn
    if _conn is not None:
        _conn.close()
    _conn = None
    config.CRM_DB = caminho


def _row(r):
    if not r:
        return None
    d = dict(r)
    try:
        d["ficha"] = json.loads(d.get("ficha") or "{}")
    except json.JSONDecodeError:
        d["ficha"] = {}
    return d


def obter_ou_criar_lead(telefone: str, nome_whatsapp: str = "") -> dict:
    with _lock:
        c = conn()
        r = c.execute("SELECT * FROM leads WHERE telefone=?", (telefone,)).fetchone()
        if r:
            if nome_whatsapp and not r["nome_whatsapp"]:
                c.execute("UPDATE leads SET nome_whatsapp=? WHERE id=?", (nome_whatsapp, r["id"]))
                c.commit()
            return _row(c.execute("SELECT * FROM leads WHERE id=?", (r["id"],)).fetchone())
        t = agora()
        cur = c.execute(
            "INSERT INTO leads (telefone, nome_whatsapp, lista, criado_em, atualizado_em) VALUES (?,?,?,?,?)",
            (telefone, nome_whatsapp, config.LISTA_INICIAL, t, t),
        )
        c.execute(
            "INSERT INTO historico (lead_id, descricao, criado_em) VALUES (?,?,?)",
            (cur.lastrowid, "Lead chegou pelo WhatsApp", t),
        )
        c.commit()
        return _row(c.execute("SELECT * FROM leads WHERE id=?", (cur.lastrowid,)).fetchone())


def obter_lead(lead_id: int) -> dict | None:
    with _lock:
        return _row(conn().execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone())


def listar_leads(busca: str = "") -> list[dict]:
    with _lock:
        sql = "SELECT * FROM leads"
        args: tuple = ()
        if busca:
            sql += " WHERE nome LIKE ? OR nome_whatsapp LIKE ? OR telefone LIKE ? OR dor LIKE ? OR ficha LIKE ?"
            args = (f"%{busca}%",) * 5
        sql += " ORDER BY COALESCE(ultima_msg_em, criado_em) DESC"
        return [_row(r) for r in conn().execute(sql, args).fetchall()]


def atualizar_lead(lead_id: int, campos: dict) -> None:
    campos = {k: v for k, v in campos.items() if k in CAMPOS_EDITAVEIS}
    if not campos:
        return
    if "ficha" in campos:
        campos["ficha"] = json.dumps(campos["ficha"], ensure_ascii=False)
    with _lock:
        c = conn()
        sets = ", ".join(f"{k}=?" for k in campos)
        c.execute(
            f"UPDATE leads SET {sets}, atualizado_em=? WHERE id=?",
            (*campos.values(), agora(), lead_id),
        )
        c.commit()


def salvar_mensagem(lead_id: int, autor: str, texto: str, wa_msg_id: str | None = None) -> bool:
    """Salva a mensagem. Retorna False se ela já existia (webhook repetido)."""
    with _lock:
        c = conn()
        t = agora()
        try:
            c.execute(
                "INSERT INTO mensagens (lead_id, wa_msg_id, autor, texto, criado_em) VALUES (?,?,?,?,?)",
                (lead_id, wa_msg_id, autor, texto, t),
            )
        except sqlite3.IntegrityError:
            return False
        c.execute("UPDATE leads SET ultima_msg_em=? WHERE id=?", (t, lead_id))
        c.commit()
        return True


def listar_mensagens(lead_id: int, limite: int = 500) -> list[dict]:
    with _lock:
        rows = conn().execute(
            "SELECT * FROM (SELECT * FROM mensagens WHERE lead_id=? ORDER BY id DESC LIMIT ?) ORDER BY id",
            (lead_id, limite),
        ).fetchall()
        return [dict(r) for r in rows]


def registrar(lead_id: int, descricao: str) -> None:
    with _lock:
        c = conn()
        c.execute(
            "INSERT INTO historico (lead_id, descricao, criado_em) VALUES (?,?,?)",
            (lead_id, descricao, agora()),
        )
        c.commit()


def listar_historico(lead_id: int) -> list[dict]:
    with _lock:
        rows = conn().execute(
            "SELECT * FROM historico WHERE lead_id=? ORDER BY id DESC", (lead_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def salvar_anexo(lead_id: int, nome_arquivo: str, caminho: str, mime: str = "") -> int:
    with _lock:
        c = conn()
        cur = c.execute(
            "INSERT INTO anexos (lead_id, nome_arquivo, caminho, mime, criado_em) VALUES (?,?,?,?,?)",
            (lead_id, nome_arquivo, caminho, mime, agora()),
        )
        c.commit()
        return cur.lastrowid


def listar_anexos(lead_id: int) -> list[dict]:
    with _lock:
        rows = conn().execute(
            "SELECT id, lead_id, nome_arquivo, mime, criado_em FROM anexos WHERE lead_id=? ORDER BY id DESC",
            (lead_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def obter_anexo(anexo_id: int) -> dict | None:
    with _lock:
        r = conn().execute("SELECT * FROM anexos WHERE id=?", (anexo_id,)).fetchone()
        return dict(r) if r else None
