"""Senhas e sessões de login (cookie assinado)."""
import base64
import hashlib
import hmac
import json
import secrets
import time

import config

COOKIE = "crm_sessao"
_ITERACOES = 200_000


def hash_senha(senha: str) -> str:
    sal = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal.encode(), _ITERACOES).hex()
    return f"pbkdf2${_ITERACOES}${sal}${h}"


def conferir_senha(senha: str, guardado: str) -> bool:
    try:
        _, iteracoes, sal, h = guardado.split("$")
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal.encode(), int(iteracoes)).hex()
    return hmac.compare_digest(calc, h)


def _assinar(dados: bytes) -> str:
    return hmac.new(config.SECRET_KEY.encode(), dados, hashlib.sha256).hexdigest()


def criar_sessao(usuario_id: int, empresa_id: int) -> str:
    corpo = json.dumps({"u": usuario_id, "e": empresa_id, "x": int(time.time()) + config.SESSAO_DIAS * 86400})
    b64 = base64.urlsafe_b64encode(corpo.encode()).decode()
    return f"{b64}.{_assinar(b64.encode())}"


def ler_sessao(token: str | None) -> dict | None:
    if not token or "." not in token:
        return None
    b64, assinatura = token.rsplit(".", 1)
    if not hmac.compare_digest(_assinar(b64.encode()), assinatura):
        return None
    try:
        dados = json.loads(base64.urlsafe_b64decode(b64.encode()))
    except (ValueError, json.JSONDecodeError):
        return None
    if dados.get("x", 0) < time.time():
        return None
    return dados
