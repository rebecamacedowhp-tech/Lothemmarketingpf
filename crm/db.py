"""Banco de dados multiempresa (Postgres em produção, SQLite em desenvolvimento/testes).

Toda tabela de dados de cliente tem `empresa_id`, e todas as consultas do painel filtram por ele:
uma empresa nunca enxerga os dados de outra.
"""
import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

import config

CAMPOS_EDITAVEIS = ["nome", "dor", "ficha", "lista", "ia_ativa", "vendedor", "resumo", "proximo_passo",
                    "temperatura", "score"]

_TABELAS = """
CREATE TABLE IF NOT EXISTS empresas (
    id {pk},
    nome TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{{}}',
    treinamento TEXT NOT NULL DEFAULT '',
    whatsapp_phone_number_id TEXT UNIQUE,
    whatsapp_token TEXT NOT NULL DEFAULT '',
    limite_mensal INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usuarios (
    id {pk},
    empresa_id INTEGER REFERENCES empresas(id),
    nome TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'vendedor',
    criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS config_versoes (
    id {pk},
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    config TEXT NOT NULL,
    treinamento TEXT NOT NULL,
    autor TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
    id {pk},
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    telefone TEXT NOT NULL,
    nome_whatsapp TEXT NOT NULL DEFAULT '',
    nome TEXT NOT NULL DEFAULT '',
    dor TEXT NOT NULL DEFAULT '',
    ficha TEXT NOT NULL DEFAULT '{{}}',
    lista TEXT NOT NULL,
    temperatura TEXT NOT NULL DEFAULT '',
    score INTEGER NOT NULL DEFAULT 0,
    resumo TEXT NOT NULL DEFAULT '',
    proximo_passo TEXT NOT NULL DEFAULT '',
    ia_ativa INTEGER NOT NULL DEFAULT 1,
    vendedor TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    ultima_msg_em TEXT,
    UNIQUE (empresa_id, telefone)
);
CREATE TABLE IF NOT EXISTS mensagens (
    id {pk},
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    wa_msg_id TEXT UNIQUE,
    autor TEXT NOT NULL,
    texto TEXT NOT NULL,
    criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_lead ON mensagens(lead_id, id);
CREATE TABLE IF NOT EXISTS anexos (
    id {pk},
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    nome_arquivo TEXT NOT NULL,
    caminho TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS historico (
    id {pk},
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    descricao TEXT NOT NULL,
    criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS uso (
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    mes TEXT NOT NULL,
    chamadas INTEGER NOT NULL DEFAULT 0,
    tokens_entrada INTEGER NOT NULL DEFAULT 0,
    tokens_saida INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (empresa_id, mes)
);
CREATE TABLE IF NOT EXISTS meta (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);
"""


def agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def mes_atual() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


class _Banco:
    """Camada fina sobre sqlite3 / psycopg. As consultas usam `?` e são traduzidas para o Postgres."""

    def __init__(self, url: str, caminho_sqlite: str):
        self.postgres = url.startswith(("postgres://", "postgresql://"))
        self._lock = threading.RLock()
        if self.postgres:
            from psycopg.rows import dict_row
            from psycopg_pool import ConnectionPool

            self._pool = ConnectionPool(url, min_size=1, max_size=5, kwargs={"row_factory": dict_row},
                                        open=True)
        else:
            self._conn = sqlite3.connect(caminho_sqlite, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        pk = "BIGSERIAL PRIMARY KEY" if self.postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
        for comando in _TABELAS.format(pk=pk).split(";"):
            if comando.strip():
                self.executar(comando)

    @contextmanager
    def _cursor(self):
        if self.postgres:
            with self._pool.connection() as c:
                with c.cursor() as cur:
                    yield cur
        else:
            with self._lock:
                cur = self._conn.cursor()
                try:
                    yield cur
                    self._conn.commit()
                except Exception:
                    self._conn.rollback()
                    raise

    def _sql(self, sql: str) -> str:
        return sql.replace("?", "%s") if self.postgres else sql

    def executar(self, sql: str, args: tuple = ()) -> None:
        with self._cursor() as cur:
            cur.execute(self._sql(sql), args)

    def um(self, sql: str, args: tuple = ()) -> dict | None:
        with self._cursor() as cur:
            cur.execute(self._sql(sql), args)
            r = cur.fetchone()
            return dict(r) if r else None

    def todos(self, sql: str, args: tuple = ()) -> list[dict]:
        with self._cursor() as cur:
            cur.execute(self._sql(sql), args)
            return [dict(r) for r in cur.fetchall()]

    def fechar(self) -> None:
        if self.postgres:
            self._pool.close()
        else:
            self._conn.close()


_banco: _Banco | None = None


def banco() -> _Banco:
    global _banco
    if _banco is None:
        _banco = _Banco(config.DATABASE_URL, config.CRM_DB_MULTI)
    return _banco


def reset(caminho_sqlite: str | None = None, url: str = "") -> None:
    """Troca o banco em uso (testes)."""
    global _banco
    if _banco is not None:
        _banco.fechar()
    _banco = None
    config.DATABASE_URL = url
    if caminho_sqlite:
        config.CRM_DB_MULTI = caminho_sqlite


def _json(texto: str | None) -> dict:
    try:
        return json.loads(texto or "{}")
    except json.JSONDecodeError:
        return {}


def _lead(r: dict | None) -> dict | None:
    if r:
        r["ficha"] = _json(r.get("ficha"))
    return r


# ---------------------------------------------------------------- meta
def meta_obter(chave: str) -> str | None:
    r = banco().um("SELECT valor FROM meta WHERE chave=?", (chave,))
    return r["valor"] if r else None


def meta_definir(chave: str, valor: str) -> None:
    banco().executar("INSERT INTO meta (chave, valor) VALUES (?,?) ON CONFLICT (chave) DO UPDATE SET valor=?",
                     (chave, valor, valor))


# ---------------------------------------------------------------- empresas
def _empresa(r: dict | None) -> dict | None:
    if r:
        r["config"] = _json(r.get("config"))
    return r


def criar_empresa(nome: str, cfg: dict, treinamento: str = "", phone_number_id: str | None = None,
                  token: str = "", limite_mensal: int = 0) -> dict:
    r = banco().um(
        "INSERT INTO empresas (nome, config, treinamento, whatsapp_phone_number_id, whatsapp_token, limite_mensal,"
        " criado_em) VALUES (?,?,?,?,?,?,?) RETURNING id",
        (nome, json.dumps(cfg, ensure_ascii=False), treinamento, phone_number_id or None, token, limite_mensal,
         agora()),
    )
    salvar_versao(r["id"], cfg, treinamento, "criação")
    return obter_empresa(r["id"])


def obter_empresa(empresa_id: int) -> dict | None:
    return _empresa(banco().um("SELECT * FROM empresas WHERE id=?", (empresa_id,)))


def empresa_por_numero(phone_number_id: str) -> dict | None:
    return _empresa(banco().um("SELECT * FROM empresas WHERE whatsapp_phone_number_id=?", (phone_number_id,)))


def listar_empresas() -> list[dict]:
    mes = mes_atual()
    rows = banco().todos(
        "SELECT e.*, COALESCE(u.chamadas, 0) AS chamadas_mes,"
        " (SELECT COUNT(*) FROM leads l WHERE l.empresa_id = e.id) AS total_leads"
        " FROM empresas e LEFT JOIN uso u ON u.empresa_id = e.id AND u.mes = ? ORDER BY e.id",
        (mes,),
    )
    return [_empresa(r) for r in rows]


def atualizar_empresa(empresa_id: int, campos: dict) -> None:
    permitidos = {"nome", "config", "treinamento", "whatsapp_phone_number_id", "whatsapp_token",
                  "limite_mensal", "ativo"}
    campos = {k: v for k, v in campos.items() if k in permitidos}
    if "config" in campos:
        campos["config"] = json.dumps(campos["config"], ensure_ascii=False)
    if "whatsapp_phone_number_id" in campos:
        campos["whatsapp_phone_number_id"] = campos["whatsapp_phone_number_id"] or None
    if not campos:
        return
    sets = ", ".join(f"{k}=?" for k in campos)
    banco().executar(f"UPDATE empresas SET {sets} WHERE id=?", (*campos.values(), empresa_id))


def salvar_versao(empresa_id: int, cfg: dict, treinamento: str, autor: str) -> None:
    banco().executar(
        "INSERT INTO config_versoes (empresa_id, config, treinamento, autor, criado_em) VALUES (?,?,?,?,?)",
        (empresa_id, json.dumps(cfg, ensure_ascii=False), treinamento, autor, agora()),
    )


def listar_versoes(empresa_id: int, limite: int = 50) -> list[dict]:
    return banco().todos(
        "SELECT id, autor, criado_em FROM config_versoes WHERE empresa_id=? ORDER BY id DESC LIMIT ?",
        (empresa_id, limite),
    )


def obter_versao(empresa_id: int, versao_id: int) -> dict | None:
    r = banco().um("SELECT * FROM config_versoes WHERE empresa_id=? AND id=?", (empresa_id, versao_id))
    if r:
        r["config"] = _json(r["config"])
    return r


# ---------------------------------------------------------------- usuários
def criar_usuario(empresa_id: int | None, nome: str, email: str, senha_hash: str, papel: str) -> dict:
    r = banco().um(
        "INSERT INTO usuarios (empresa_id, nome, email, senha_hash, papel, criado_em) VALUES (?,?,?,?,?,?)"
        " RETURNING id",
        (empresa_id, nome, email.strip().lower(), senha_hash, papel, agora()),
    )
    return obter_usuario(r["id"])


def obter_usuario(usuario_id: int) -> dict | None:
    return banco().um("SELECT * FROM usuarios WHERE id=?", (usuario_id,))


def usuario_por_email(email: str) -> dict | None:
    return banco().um("SELECT * FROM usuarios WHERE email=?", (email.strip().lower(),))


def listar_usuarios(empresa_id: int) -> list[dict]:
    return banco().todos(
        "SELECT id, nome, email, papel, criado_em FROM usuarios WHERE empresa_id=? ORDER BY id", (empresa_id,)
    )


def atualizar_senha(usuario_id: int, senha_hash: str) -> None:
    banco().executar("UPDATE usuarios SET senha_hash=? WHERE id=?", (senha_hash, usuario_id))


def remover_usuario(empresa_id: int, usuario_id: int) -> None:
    banco().executar("DELETE FROM usuarios WHERE empresa_id=? AND id=? AND papel <> 'admin'",
                     (empresa_id, usuario_id))


# ---------------------------------------------------------------- uso da IA
def registrar_uso(empresa_id: int, tokens_entrada: int, tokens_saida: int) -> None:
    banco().executar(
        "INSERT INTO uso (empresa_id, mes, chamadas, tokens_entrada, tokens_saida) VALUES (?,?,1,?,?)"
        " ON CONFLICT (empresa_id, mes) DO UPDATE SET chamadas = uso.chamadas + 1,"
        " tokens_entrada = uso.tokens_entrada + ?, tokens_saida = uso.tokens_saida + ?",
        (empresa_id, mes_atual(), tokens_entrada, tokens_saida, tokens_entrada, tokens_saida),
    )


def uso_do_mes(empresa_id: int) -> dict:
    r = banco().um("SELECT chamadas, tokens_entrada, tokens_saida FROM uso WHERE empresa_id=? AND mes=?",
                   (empresa_id, mes_atual()))
    return r or {"chamadas": 0, "tokens_entrada": 0, "tokens_saida": 0}


# ---------------------------------------------------------------- leads
def obter_ou_criar_lead(empresa_id: int, telefone: str, nome_whatsapp: str, lista_inicial: str) -> dict:
    b = banco()
    r = b.um("SELECT * FROM leads WHERE empresa_id=? AND telefone=?", (empresa_id, telefone))
    if r:
        if nome_whatsapp and not r["nome_whatsapp"]:
            b.executar("UPDATE leads SET nome_whatsapp=? WHERE id=?", (nome_whatsapp, r["id"]))
            r["nome_whatsapp"] = nome_whatsapp
        return _lead(r)
    t = agora()
    novo = b.um(
        "INSERT INTO leads (empresa_id, telefone, nome_whatsapp, lista, criado_em, atualizado_em)"
        " VALUES (?,?,?,?,?,?) ON CONFLICT (empresa_id, telefone) DO NOTHING RETURNING id",
        (empresa_id, telefone, nome_whatsapp, lista_inicial, t, t),
    )
    if novo:
        registrar(novo["id"], "Lead chegou pelo WhatsApp")
    return _lead(b.um("SELECT * FROM leads WHERE empresa_id=? AND telefone=?", (empresa_id, telefone)))


def obter_lead(lead_id: int, empresa_id: int | None = None) -> dict | None:
    if empresa_id is None:
        return _lead(banco().um("SELECT * FROM leads WHERE id=?", (lead_id,)))
    return _lead(banco().um("SELECT * FROM leads WHERE id=? AND empresa_id=?", (lead_id, empresa_id)))


def listar_leads(empresa_id: int, busca: str = "") -> list[dict]:
    sql = "SELECT * FROM leads WHERE empresa_id=?"
    args: tuple = (empresa_id,)
    if busca:
        termo = f"%{busca.lower()}%"
        sql += (" AND (LOWER(nome) LIKE ? OR LOWER(nome_whatsapp) LIKE ? OR telefone LIKE ?"
                " OR LOWER(dor) LIKE ? OR LOWER(ficha) LIKE ?)")
        args += (termo,) * 5
    sql += " ORDER BY COALESCE(ultima_msg_em, criado_em) DESC"
    return [_lead(r) for r in banco().todos(sql, args)]


def atualizar_lead(lead_id: int, campos: dict) -> None:
    campos = {k: v for k, v in campos.items() if k in CAMPOS_EDITAVEIS}
    if not campos:
        return
    if "ficha" in campos:
        campos["ficha"] = json.dumps(campos["ficha"], ensure_ascii=False)
    sets = ", ".join(f"{k}=?" for k in campos)
    banco().executar(f"UPDATE leads SET {sets}, atualizado_em=? WHERE id=?", (*campos.values(), agora(), lead_id))


def salvar_mensagem(lead_id: int, autor: str, texto: str, wa_msg_id: str | None = None) -> bool:
    """Salva a mensagem. Retorna False se ela já existia (webhook repetido)."""
    b = banco()
    t = agora()
    r = b.um(
        "INSERT INTO mensagens (lead_id, wa_msg_id, autor, texto, criado_em) VALUES (?,?,?,?,?)"
        " ON CONFLICT (wa_msg_id) DO NOTHING RETURNING id",
        (lead_id, wa_msg_id, autor, texto, t),
    )
    if not r:
        return False
    b.executar("UPDATE leads SET ultima_msg_em=? WHERE id=?", (t, lead_id))
    return True


def listar_mensagens(lead_id: int, limite: int = 500) -> list[dict]:
    rows = banco().todos(
        "SELECT * FROM (SELECT * FROM mensagens WHERE lead_id=? ORDER BY id DESC LIMIT ?) AS m ORDER BY id",
        (lead_id, limite),
    )
    return rows


def registrar(lead_id: int, descricao: str) -> None:
    banco().executar("INSERT INTO historico (lead_id, descricao, criado_em) VALUES (?,?,?)",
                     (lead_id, descricao, agora()))


def listar_historico(lead_id: int) -> list[dict]:
    return banco().todos("SELECT * FROM historico WHERE lead_id=? ORDER BY id DESC", (lead_id,))


def salvar_anexo(lead_id: int, nome_arquivo: str, caminho: str, mime: str = "") -> int:
    r = banco().um(
        "INSERT INTO anexos (lead_id, nome_arquivo, caminho, mime, criado_em) VALUES (?,?,?,?,?) RETURNING id",
        (lead_id, nome_arquivo, caminho, mime, agora()),
    )
    return r["id"]


def listar_anexos(lead_id: int) -> list[dict]:
    return banco().todos(
        "SELECT id, lead_id, nome_arquivo, mime, criado_em FROM anexos WHERE lead_id=? ORDER BY id DESC",
        (lead_id,),
    )


def obter_anexo(anexo_id: int, empresa_id: int) -> dict | None:
    return banco().um(
        "SELECT a.* FROM anexos a JOIN leads l ON l.id = a.lead_id WHERE a.id=? AND l.empresa_id=?",
        (anexo_id, empresa_id),
    )
