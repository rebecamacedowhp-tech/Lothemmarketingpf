"""SDR IA: lê a conversa, responde o lead, preenche os campos, escolhe a lista e escreve o resumo."""
import json
import logging

import anthropic

import config

log = logging.getLogger("sdr")

_client: anthropic.AsyncAnthropic | None = None


def client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY or None)
    return _client


def _texto_listas() -> str:
    linhas = []
    for l in config.LISTAS:
        if l["id"] in config.LISTAS_DA_IA:
            linhas.append(f'- "{l["id"]}" ({l["nome"]}): {l["descricao"]}')
    return "\n".join(linhas)


def montar_system_prompt() -> str:
    s = config.SDR
    perguntas = "\n".join(f"- {p}" for p in s["perguntas_de_qualificacao"])
    regras = "\n".join(f"- {r}" for r in s["regras"])
    return f"""Você é {s["nome_sdr"]}, SDR (pré-vendas) da {s["empresa"]}, atendendo leads pelo WhatsApp.

## Sobre a empresa
{s["sobre_empresa"]}

## Seu objetivo
{s["objetivo"]}

## Tom de voz
{s["tom_de_voz"]}

## O que você precisa descobrir (aos poucos, sem parecer um formulário)
{perguntas}

## Regras
{regras}

## Treinamento de SDR (siga este método; ele tem prioridade sobre o estilo padrão)
<treinamento>
{config.TREINAMENTO or "(sem treinamento extra)"}
</treinamento>

## Listas (etapas do funil) que você pode escolher para o lead
{_texto_listas()}

Quando o lead ficar qualificado como quente, ou pedir para falar com uma pessoa, marque
transferir_para_humano = true e, na resposta, diga que um especialista da {s["empresa"]}
vai continuar o atendimento por aqui em breve.

## Como preencher o retorno
Você recebe a ficha atual do lead e a conversa inteira. Devolva SEMPRE o JSON pedido:
- resposta: a próxima mensagem para o cliente no WhatsApp (texto puro, sem markdown). Se a instrução
  disser para não responder, devolva "".
- nome, dor, empresa, segmento, orcamento, faturamento, decisor, urgencia: o que o cliente já disse.
  Use "" para o que ainda não se sabe. Nunca invente. A "dor" deve ser escrita com as palavras e o
  contexto do cliente (ex.: "gasta R$ 5 mil/mês no Meta Ads e não consegue vender; leads desqualificados").
- lista: o id da lista em que o lead deve ficar agora.
- temperatura: quente, morno ou frio.
- score: nota de 0 a 100 de quão pronto o lead está para comprar.
- resumo: resumo para o VENDEDOR que vai assumir a conversa, em 4 a 8 linhas curtas, cobrindo:
  quem é e a empresa; a dor principal; o que já foi perguntado e respondido; objeções ou dúvidas;
  o que já foi prometido ao cliente. Escreva de forma que o vendedor consiga continuar a conversa
  sem ler o histórico.
- proximo_passo: uma frase dizendo o que o vendedor (ou a IA) deve fazer a seguir.
- transferir_para_humano: true ou false.
"""


def _schema() -> dict:
    texto = {"type": "string"}
    campos = {
        "resposta": texto,
        "nome": texto,
        "dor": texto,
        "empresa": texto,
        "segmento": texto,
        "orcamento": texto,
        "faturamento": texto,
        "decisor": texto,
        "urgencia": texto,
        "lista": {"type": "string", "enum": config.LISTAS_DA_IA},
        "temperatura": {"type": "string", "enum": ["quente", "morno", "frio"]},
        "score": {"type": "integer"},
        "resumo": texto,
        "proximo_passo": texto,
        "transferir_para_humano": {"type": "boolean"},
    }
    return {
        "type": "object",
        "properties": campos,
        "required": list(campos),
        "additionalProperties": False,
    }


def _formatar_conversa(mensagens: list[dict]) -> str:
    rotulo = {"cliente": "CLIENTE", "ia": config.SDR["nome_sdr"].upper() + " (IA)", "vendedor": "VENDEDOR"}
    return "\n".join(f"[{m['criado_em'][:16].replace('T', ' ')}] {rotulo.get(m['autor'], m['autor'])}: {m['texto']}" for m in mensagens)


def _formatar_ficha(lead: dict) -> str:
    campos = ["telefone", "nome_whatsapp", "nome", "dor", "empresa", "segmento", "orcamento",
              "faturamento", "decisor", "urgencia", "lista", "temperatura", "score", "resumo"]
    return "\n".join(f"{c}: {lead.get(c) or ''}" for c in campos)


async def analisar(lead: dict, mensagens: list[dict], responder: bool) -> dict | None:
    """Chama o Claude e devolve o dicionário com resposta + campos. None se não deu para analisar."""
    instrucao = (
        "Escreva a próxima mensagem para o cliente e atualize a ficha."
        if responder
        else "NÃO escreva mensagem para o cliente (resposta = \"\"): um vendedor humano está atendendo. "
             "Apenas atualize a ficha, o resumo e o próximo passo com base na conversa."
    )
    conteudo = (
        f"<ficha_atual>\n{_formatar_ficha(lead)}\n</ficha_atual>\n\n"
        f"<conversa>\n{_formatar_conversa(mensagens)}\n</conversa>\n\n{instrucao}"
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
                "format": {"type": "json_schema", "schema": _schema()},
            },
            system=[{"type": "text", "text": montar_system_prompt(), "cache_control": {"type": "ephemeral"}}],
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
        log.error("ANTHROPIC_API_KEY não configurada no .env – a SDR IA está desligada")
        return None

    if resp.stop_reason in ("refusal", "max_tokens"):
        log.warning("Claude não completou a análise (stop_reason=%s)", resp.stop_reason)
        return None
    texto = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        log.error("Resposta do Claude não é JSON: %r", texto[:300])
        return None
