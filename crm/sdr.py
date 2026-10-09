"""IA do CRM: lê a conversa do WhatsApp, preenche a ficha, escolhe a lista e escreve o resumo.

Funciona em dois modos, conforme a configuração de cada empresa:
- SDR ativa: além de preencher o CRM, responde e qualifica o cliente sozinha.
- Só CRM: nunca responde; apenas lê a conversa (vendedor x cliente) e preenche o CRM.
"""
import json
import logging

import anthropic

import config
import db

log = logging.getLogger("sdr")

_client: anthropic.AsyncAnthropic | None = None


def client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY or None)
    return _client


def _texto_listas(emp) -> str:
    return "\n".join(f'- "{l["id"]}" ({l["nome"]}): {l["descricao"]}' for l in emp.listas if l["id"] in emp.listas_da_ia)


def montar_system_prompt(emp) -> str:
    c = emp.cfg
    campos = "\n".join(f'- {x["id"]} ({x["rotulo"]}): {x["instrucao"]}' for x in emp.campos) or "(nenhum campo extra)"
    if emp.sdr_ativa:
        cabecalho = (f"Você é {emp.nome_sdr}, SDR (pré-vendas) da {emp.nome}, atendendo clientes pelo WhatsApp. "
                     "Você conversa com o cliente, qualifica e mantém o CRM preenchido.")
        tom = f"\n## Tom de voz\n{c.get('tom_de_voz') or ''}\n"
        treino = f"\n## Treinamento (siga este método)\n<treinamento>\n{emp.treinamento or '(sem treinamento extra)'}\n</treinamento>\n"
        resposta = ("- resposta: a próxima mensagem para o cliente no WhatsApp, escrita como uma pessoa real: texto puro,\n"
                    "  sem markdown, sem listas, curta. Para mandar duas mensagens, separe com uma linha em branco.\n"
                    "  Se a instrução disser para não responder, devolva \"\".")
    else:
        cabecalho = (f"Você é o assistente de CRM da {emp.nome}. Você lê as conversas de WhatsApp entre os vendedores "
                     "e os clientes e mantém o CRM preenchido. Você NUNCA escreve para o cliente.")
        tom = ""
        treino = (f"\n## Orientações da empresa\n<orientacoes>\n{emp.treinamento}\n</orientacoes>\n"
                  if emp.treinamento.strip() else "")
        resposta = '- resposta: sempre "".'
    return f"""{cabecalho}

## Sobre a empresa
Nicho: {c.get("nicho") or "não informado"}
{c.get("sobre_empresa") or ""}

## Objetivo comercial
{c.get("objetivo") or ""}
{tom}
## Informações da empresa (produtos, preços, links, pessoas)
{c.get("informacoes") or "(nenhuma)"}
Use SOMENTE as informações acima para preços, condições e links; nunca invente valor, desconto, prazo ou link.
Se algo estiver "ainda não definido" ou não estiver aqui e o cliente pedir, diga que vai confirmar e já retorna,
e marque transferir_para_humano = true.
{treino}
## Listas (etapas do funil) que você pode escolher para o cliente
{_texto_listas(emp)}

## Como preencher o retorno
Você recebe a ficha atual do cliente e a conversa inteira. Devolva SEMPRE o JSON pedido:
{resposta}
- nome: nome do cliente ("" se não souber).
- dor: a necessidade/dor principal do cliente, com as palavras e o contexto dele, incluindo o impacto
  ou o motivo. "" se ainda não souber.
- ficha: um objeto com os campos abaixo. Use "" para o que ainda não se sabe. Nunca invente nem altere o
  que o cliente disse.
{campos}
- lista: o id da lista em que o cliente deve ficar agora.
- temperatura: quente, morno ou frio.
- score: nota de 0 a 100 de quão perto o cliente está de comprar (perfil + interesse real).
- resumo: resumo para o VENDEDOR que vai continuar o atendimento, em 4 a 8 linhas curtas: quem é o
  cliente; o que ele quer e por quê; o que já foi perguntado e respondido; objeções e dúvidas; o que já
  foi prometido. Escreva de forma que qualquer vendedor continue a conversa sem ler o histórico.
- proximo_passo: uma frase com o que deve acontecer a seguir (e quem faz).
- transferir_para_humano: true ou false.
"""


def _schema(emp) -> dict:
    texto = {"type": "string"}
    ficha = {
        "type": "object",
        "properties": {c: texto for c in emp.campos_ids},
        "required": list(emp.campos_ids),
        "additionalProperties": False,
    }
    campos = {
        "resposta": texto,
        "nome": texto,
        "dor": texto,
        "ficha": ficha,
        "lista": {"type": "string", "enum": emp.listas_da_ia or [emp.lista_inicial]},
        "temperatura": {"type": "string", "enum": ["quente", "morno", "frio"]},
        "score": {"type": "integer"},
        "resumo": texto,
        "proximo_passo": texto,
        "transferir_para_humano": {"type": "boolean"},
    }
    return {"type": "object", "properties": campos, "required": list(campos), "additionalProperties": False}


def _formatar_conversa(emp, mensagens: list[dict]) -> str:
    rotulo = {"cliente": "CLIENTE", "ia": emp.nome_sdr.upper() + " (IA)", "vendedor": "VENDEDOR"}
    return "\n".join(f"[{m['criado_em'][:16].replace('T', ' ')}] {rotulo.get(m['autor'], m['autor'])}: {m['texto']}"
                     for m in mensagens)


def _formatar_ficha(emp, lead: dict) -> str:
    linhas = [f"{c}: {lead.get(c) or ''}" for c in
              ["telefone", "nome_whatsapp", "nome", "dor", "lista", "temperatura", "score", "resumo"]]
    ficha = lead.get("ficha") or {}
    linhas += [f"ficha.{c}: {ficha.get(c, '')}" for c in emp.campos_ids]
    return "\n".join(linhas)


async def analisar(emp, lead: dict, mensagens: list[dict], responder: bool) -> dict | None:
    """Chama o Claude e devolve o dicionário com resposta + campos. None se não deu para analisar."""
    instrucao = (
        "Escreva a próxima mensagem para o cliente e atualize a ficha."
        if responder
        else "NÃO escreva mensagem para o cliente (resposta = \"\"). Apenas atualize a ficha, a lista, o resumo e o "
             "próximo passo com base na conversa."
    )
    conteudo = (
        f"<ficha_atual>\n{_formatar_ficha(emp, lead)}\n</ficha_atual>\n\n"
        f"<conversa>\n{_formatar_conversa(emp, mensagens)}\n</conversa>\n\n{instrucao}"
    )
    try:
        resp = await client().beta.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            thinking={"type": "adaptive"},
            output_config={
                "effort": config.CLAUDE_EFFORT,
                "format": {"type": "json_schema", "schema": _schema(emp)},
            },
            system=[{"type": "text", "text": montar_system_prompt(emp), "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": conteudo}],
        )
    except anthropic.RateLimitError:
        log.exception("Limite de uso do Claude atingido")
        return None
    except anthropic.APIStatusError as e:
        log.error("Erro da API do Claude (%s): %s", e.status_code, e.message)
        return None
    except anthropic.APIConnectionError:
        log.exception("Sem conexão com a API do Claude")
        return None
    except TypeError:
        log.error("ANTHROPIC_API_KEY não configurada – a IA está desligada")
        return None

    u = resp.usage
    entrada = (u.input_tokens or 0) + (getattr(u, "cache_creation_input_tokens", 0) or 0) + \
        (getattr(u, "cache_read_input_tokens", 0) or 0)
    db.registrar_uso(emp.id, entrada, u.output_tokens or 0)

    if resp.stop_reason in ("refusal", "max_tokens"):
        log.warning("Claude não completou a análise (stop_reason=%s)", resp.stop_reason)
        return None
    texto = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        log.error("Resposta do Claude não é JSON: %r", texto[:300])
        return None
