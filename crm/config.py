"""Configurações da plataforma (variáveis de ambiente).

A configuração de cada empresa cliente (campos, funil, treinamento da SDR...) fica no banco,
em `empresas.config` — veja tenants.py.
"""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# ---- IA (conta da plataforma) ----
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
CLAUDE_EFFORT = os.getenv("CLAUDE_EFFORT", "medium")

# ---- WhatsApp: app da Meta da plataforma (um só para todas as empresas) ----
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v23.0")
# Número da empresa nº 1 (Lothem). As demais empresas cadastram o número delas no painel.
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

# ---- Banco de dados ----
# Com DATABASE_URL (Postgres do Railway) usa Postgres; sem ela, usa SQLite no arquivo CRM_DB_MULTI.
DATABASE_URL = os.getenv("DATABASE_URL", "")
_DATA_DIR = Path(os.getenv("CRM_DB", str(BASE_DIR / "crm.db"))).parent
CRM_DB_MULTI = os.getenv("CRM_DB_MULTI", str(_DATA_DIR / "crm_multi.db"))
# Banco da versão antiga (uma empresa só). Se existir, os dados são importados para a empresa nº 1.
CRM_DB_LEGADO = os.getenv("CRM_DB", str(BASE_DIR / "crm.db"))
ANEXOS_DIR = Path(os.getenv("CRM_ANEXOS", BASE_DIR / "anexos"))

# ---- Acesso ----
# Administradora da plataforma (você). Se ADMIN_EMAIL não for definido, o login é "admin".
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin").strip().lower()
ADMIN_SENHA = os.getenv("ADMIN_SENHA", "") or os.getenv("CRM_SENHA", "")
SECRET_KEY = os.getenv("SECRET_KEY", "") or secrets.token_hex(32)
SESSAO_DIAS = int(os.getenv("SESSAO_DIAS", "30"))

# ---- Comportamento da SDR ----
DEBOUNCE_SEGUNDOS = float(os.getenv("DEBOUNCE_SEGUNDOS", "8"))
PAUSA_MAX_SEGUNDOS = float(os.getenv("PAUSA_MAX_SEGUNDOS", "4"))

# Arquivos usados para criar a empresa nº 1 (Lothem) na primeira vez
SEED_CONFIG = BASE_DIR / "sdr_config.json"
SEED_TREINAMENTO = BASE_DIR / "treinamento_sdr.md"
MODELO_GENERICO = BASE_DIR / "modelos" / "generico.json"
