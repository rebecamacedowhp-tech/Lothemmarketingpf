"""Configuração do CRM: variáveis de ambiente + roteiro da SDR (sdr_config.json)."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
CLAUDE_EFFORT = os.getenv("CLAUDE_EFFORT", "medium")

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v23.0")

CRM_SENHA = os.getenv("CRM_SENHA", "")
CRM_DB = os.getenv("CRM_DB", str(BASE_DIR / "crm.db"))
DEBOUNCE_SEGUNDOS = float(os.getenv("DEBOUNCE_SEGUNDOS", "8"))

SDR_CONFIG_PATH = Path(os.getenv("SDR_CONFIG", BASE_DIR / "sdr_config.json"))
TREINAMENTO_PATH = Path(os.getenv("SDR_TREINAMENTO", BASE_DIR / "treinamento_sdr.md"))


def carregar_sdr_config() -> dict:
    with open(SDR_CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def carregar_treinamento() -> str:
    try:
        return TREINAMENTO_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


SDR = carregar_sdr_config()
TREINAMENTO = carregar_treinamento()
LISTAS = SDR["listas"]
LISTAS_POR_ID = {l["id"]: l for l in LISTAS}
LISTA_INICIAL = LISTAS[0]["id"]
LISTAS_DA_IA = [l["id"] for l in LISTAS if l.get("ia_pode_mover", True)]
LISTA_HANDOFF = SDR.get("lista_quando_transferir", "quente")
