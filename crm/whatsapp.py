"""Integração com a WhatsApp Business Cloud API (Meta): ler webhooks e enviar mensagens."""
import hashlib
import hmac
import logging

import httpx

import config

log = logging.getLogger("whatsapp")

DESCRICAO_MIDIA = {
    "audio": "[cliente enviou um áudio]",
    "image": "[cliente enviou uma imagem]",
    "video": "[cliente enviou um vídeo]",
    "document": "[cliente enviou um documento]",
    "sticker": "[figurinha]",
    "location": "[cliente enviou uma localização]",
    "contacts": "[cliente enviou um contato]",
}


def assinatura_valida(corpo: bytes, cabecalho: str | None) -> bool:
    """Confere o X-Hub-Signature-256 para garantir que o webhook veio da Meta."""
    if not config.WHATSAPP_APP_SECRET:
        return True
    if not cabecalho or not cabecalho.startswith("sha256="):
        return False
    esperado = hmac.new(config.WHATSAPP_APP_SECRET.encode(), corpo, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, cabecalho.removeprefix("sha256="))


def _texto_da_mensagem(m: dict) -> str:
    tipo = m.get("type")
    if tipo == "text":
        return m.get("text", {}).get("body", "")
    if tipo == "button":
        return m.get("button", {}).get("text", "")
    if tipo == "interactive":
        i = m.get("interactive", {})
        escolha = i.get("button_reply") or i.get("list_reply") or {}
        return escolha.get("title", "")
    legenda = (m.get(tipo) or {}).get("caption") if isinstance(m.get(tipo), dict) else None
    base = DESCRICAO_MIDIA.get(tipo, f"[mensagem do tipo {tipo}]")
    if tipo == "document" and m["document"].get("filename"):
        base = f'[cliente enviou o documento "{m["document"]["filename"]}" — anexado ao card]'
    return f"{base} {legenda}" if legenda else base


def extrair_eventos(payload: dict) -> list[dict]:
    """Transforma o JSON do webhook em uma lista simples de eventos.

    Cada evento: {telefone, nome_whatsapp, texto, wa_msg_id, autor}
    - autor "cliente": mensagem que o lead mandou
    - autor "vendedor": mensagem que alguém mandou pelo app WhatsApp Business no celular
      (só chega se o número estiver no modo coexistência e o webhook "smb_message_echoes" assinado)
    """
    eventos = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            valor = change.get("value", {})
            nomes = {c.get("wa_id"): c.get("profile", {}).get("name", "") for c in valor.get("contacts", [])}
            for m in valor.get("messages", []):
                ev = {
                    "telefone": m["from"],
                    "nome_whatsapp": nomes.get(m["from"], ""),
                    "texto": _texto_da_mensagem(m),
                    "wa_msg_id": m.get("id"),
                    "autor": "cliente",
                }
                if m.get("type") in ("document", "image"):
                    midia = m[m["type"]]
                    ev["midia"] = {
                        "id": midia.get("id"),
                        "mime": midia.get("mime_type", ""),
                        "nome": midia.get("filename") or f'{m["type"]}-{m.get("id", "")[-8:]}',
                    }
                eventos.append(ev)
            for m in valor.get("message_echoes", []):
                eventos.append({
                    "telefone": m.get("to", ""),
                    "nome_whatsapp": "",
                    "texto": _texto_da_mensagem(m),
                    "wa_msg_id": m.get("id"),
                    "autor": "vendedor",
                })
    return [e for e in eventos if e["telefone"] and e["texto"]]


async def enviar_texto(telefone: str, texto: str) -> str | None:
    """Envia uma mensagem de texto. Devolve o id da mensagem no WhatsApp (ou None em modo simulação/erro)."""
    if not (config.WHATSAPP_TOKEN and config.WHATSAPP_PHONE_NUMBER_ID):
        log.info("[simulação] para %s: %s", telefone, texto)
        return None
    url = f"https://graph.facebook.com/{config.GRAPH_API_VERSION}/{config.WHATSAPP_PHONE_NUMBER_ID}/messages"
    corpo = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": telefone,
        "type": "text",
        "text": {"preview_url": False, "body": texto},
    }
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.post(url, json=corpo, headers={"Authorization": f"Bearer {config.WHATSAPP_TOKEN}"})
    if r.status_code >= 400:
        log.error("Falha ao enviar WhatsApp para %s (%s): %s", telefone, r.status_code, r.text)
        raise RuntimeError(f"WhatsApp recusou o envio ({r.status_code}): {r.text[:300]}")
    return (r.json().get("messages") or [{}])[0].get("id")


async def baixar_midia(media_id: str) -> tuple[bytes, str]:
    """Baixa um documento/imagem enviado pelo cliente. Devolve (conteúdo, mime)."""
    cab = {"Authorization": f"Bearer {config.WHATSAPP_TOKEN}"}
    async with httpx.AsyncClient(timeout=60) as http:
        info = await http.get(f"https://graph.facebook.com/{config.GRAPH_API_VERSION}/{media_id}", headers=cab)
        info.raise_for_status()
        dados = info.json()
        arquivo = await http.get(dados["url"], headers=cab)
        arquivo.raise_for_status()
    return arquivo.content, dados.get("mime_type", "")
