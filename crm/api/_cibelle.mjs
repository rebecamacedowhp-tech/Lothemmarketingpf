// Lothem Vendas — motor da SDR IA no WhatsApp.
// Chamado pela ponte da WAHA quando chega mensagem de um lead. O banco decide se a IA pode responder
// (chave, modo de teste, equipe atendendo, limite de gasto); aqui só montamos o contexto, chamamos a IA
// com a chave do cliente, conferimos a resposta e enviamos.

const PRICE = { // US$ por milhão de tokens: entrada, saída
  'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5], 'claude-fable-5-1': [10, 50],
  'gpt-6.1-sol': [2, 10], 'gpt-6-luna': [0.1, 0.5], 'gpt-6-astra': [10, 50], 'gpt-5.6-terra': [2, 12],
};
const DEBOUNCE_MS = 6000; // espera o lead terminar de digitar várias mensagens seguidas
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['mensagens', 'ficha', 'memoria', 'passar_para_equipe', 'motivo'],
  properties: {
    mensagens: { type: 'array', items: { type: 'string' }, description: 'De 1 a 3 baloes de WhatsApp, na ordem de envio.' },
    ficha: {
      type: 'object', additionalProperties: false,
      required: ['nome', 'empresa', 'segmento', 'cidade', 'credito_pretendido'],
      properties: {
        nome: { type: 'string' }, empresa: { type: 'string' }, segmento: { type: 'string' }, cidade: { type: 'string' },
        credito_pretendido: { type: 'string', description: 'Valor e finalidade, ex.: "R$ 80 mil · capital de giro".' },
      },
    },
    memoria: { type: 'string' },
    passar_para_equipe: { type: 'boolean' },
    motivo: { type: 'string' },
  },
};

const FORMATO = `

COMO DEVOLVER A RESPOSTA (o sistema lê isto, o cliente não vê)
Responda só com o JSON pedido:
- mensagens: de 1 a 3 baloes curtos, prontos para enviar no WhatsApp. Sem rótulos, sem colchetes, sem campos para preencher.
- ficha: preencha só o que a pessoa disse nesta conversa (nome, empresa, segmento, cidade, crédito pretendido com valor e finalidade). O que ela não disse fica "".
- memoria: o que você precisa lembrar desta pessoa na próxima conversa, em linhas curtas: problema, crédito pretendido, faturamento, quem decide, momento, objeções, o que foi combinado. Reescreva a memória inteira, juntando a anterior com o que mudou.
- passar_para_equipe: true quando a regra mandar chamar a Rebeca ou a equipe, ou quando você não souber responder. Nesse caso, avise a pessoa nas mensagens.
- motivo: por que passou para a equipe, em poucas palavras ("" se não passou).`;

function contexto(ctx, trechos) {
  const c = ctx.contact || {};
  const entrada = c.entrada === 'comprou' ? 'Já comprou o diagnóstico' : c.entrada === 'quiz' ? 'Fez o quiz e não comprou' : 'Não marcado';
  const ficha = [['Nome', c.nome], ['Empresa', c.empresa], ['Segmento', c.segmento], ['Cidade', c.cidade], ['Crédito pretendido', c.credito_pretendido], ['Origem', c.origem]]
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `DADOS DESTE CLIENTE NO CRM
Entrada: ${entrada}
${ficha || 'Ficha ainda vazia.'}

MEMÓRIA SOBRE ESTE CLIENTE
${ctx.memory || 'Nenhuma ainda. Esta pode ser a primeira conversa.'}

TRECHOS DA BASE QUE PODEM AJUDAR NESTA RESPOSTA
${trechos.length ? trechos.map((t) => `[${t.title}]\n${t.content}`).join('\n\n') : 'Nenhum trecho encontrado. Se a resposta depender de informação que você não tem, diga que confirma com a Rebeca.'}`;
}

// histórico no formato da IA: lead = user; IA e equipe = assistant; mensagens seguidas do mesmo lado viram uma
function historico(msgs) {
  const out = [];
  for (const m of msgs || []) {
    if (!m.texto) continue;
    const role = m.de === 'lead' ? 'user' : 'assistant';
    const txt = m.de === 'user' ? `(mensagem da equipe) ${m.texto}` : m.texto;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += '\n' + txt; else out.push({ role, content: txt });
  }
  if (out[0] && out[0].role === 'assistant') out.unshift({ role: 'user', content: '(início da conversa)' });
  return out;
}

async function chamarClaude(ctx, sistema, dinamico, msgs) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ctx.api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: ctx.model || 'claude-sonnet-5-5', max_tokens: 4000,
      system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }, { type: 'text', text: dinamico }],
      messages: msgs,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Claude: ' + ((out.error && out.error.message) || r.status));
  const u = out.usage || {};
  const uso = { in: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), out: u.output_tokens || 0, cache: u.cache_read_input_tokens || 0, creation: u.cache_creation_input_tokens || 0 };
  if (out.stop_reason === 'refusal') return { recusa: true, uso };
  const txt = (out.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { json: JSON.parse(txt), uso };
}

async function chamarGPT(ctx, sistema, dinamico, msgs) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + ctx.api_key, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: ctx.model || 'gpt-6.1-sol',
      messages: [{ role: 'system', content: sistema }, { role: 'system', content: dinamico }, ...msgs],
      response_format: { type: 'json_schema', json_schema: { name: 'resposta', strict: true, schema: SCHEMA } },
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('OpenAI: ' + ((out.error && out.error.message) || r.status));
  const u = out.usage || {}, cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0;
  const uso = { in: (u.prompt_tokens || 0) - cached, out: u.completion_tokens || 0, cache: cached, creation: 0 };
  const msg = out.choices && out.choices[0] && out.choices[0].message;
  if (!msg || msg.refusal) return { recusa: true, uso };
  return { json: JSON.parse(msg.content), uso };
}

function custo(model, uso) {
  const [pi, po] = PRICE[model] || [4, 20];
  // cache: leitura sai a 10% da entrada; gravação no cache da Anthropic sai a 125%
  return ((uso.in - uso.creation) * pi + uso.creation * pi * 1.25 + uso.cache * pi * 0.1 + uso.out * po) / 1e6;
}

// limpa o que não pode ir para o cliente
function limpar(txt) {
  return String(txt || '').replace(/\s*—\s*/g, ', ').replace(/\[[^\]]{1,40}\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function responder({ rpc, waha, conv, waId }) {
  await sleep(DEBOUNCE_MS);
  const ctx = await rpc('ai_bot_context', { p_conv: conv, p_wa_id: waId || null });
  if (!ctx || !ctx.reply) return { respondeu: false, motivo: ctx && ctx.reason };
  if (!ctx.system_prompt) return { respondeu: false, motivo: 'instruções da IA não carregadas (Painel Mestre → Carregar pacote oficial)' };

  const msgs = historico(ctx.messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return { respondeu: false, motivo: 'nada novo do lead' };

  // busca na base com as palavras das últimas mensagens do lead
  const ultimas = (ctx.messages || []).filter((m) => m.de === 'lead').slice(-3).map((m) => m.texto).join(' ');
  const palavras = Array.from(new Set(ultimas.toLowerCase().normalize('NFC').match(/[a-zà-ú0-9]{4,}/g) || [])).slice(0, 12);
  const trechos = palavras.length ? await rpc('ai_kb_find', { p_org: ctx.org_id, p_q: palavras.join(' or ') }).catch(() => []) : [];

  const sistema = ctx.system_prompt + FORMATO;
  const dinamico = contexto(ctx, trechos || []);
  const model = ctx.model || (ctx.provider === 'openai' ? 'gpt-6.1-sol' : 'claude-sonnet-5-5');

  let res;
  try {
    res = ctx.provider === 'openai' ? await chamarGPT(ctx, sistema, dinamico, msgs) : await chamarClaude(ctx, sistema, dinamico, msgs);
  } catch (e) {
    console.error('IA falhou', e);
    await rpc('ai_bot_apply', { p_conv: conv, p_fields: {}, p_memory: null, p_handoff: true, p_reason: 'a IA não conseguiu responder (' + String(e.message || e).slice(0, 120) + ')' });
    return { respondeu: false, motivo: 'erro na IA' };
  }
  await rpc('ai_bot_usage', { p_org: ctx.org_id, p_model: model, p_in: res.uso.in, p_out: res.uso.out, p_cache: res.uso.cache, p_cost: Number(custo(model, res.uso).toFixed(4)), p_new_conv: !!ctx.first_reply });
  if (res.recusa) {
    await rpc('ai_bot_apply', { p_conv: conv, p_fields: {}, p_memory: null, p_handoff: true, p_reason: 'a IA preferiu não responder esta mensagem' });
    return { respondeu: false, motivo: 'recusa' };
  }

  const j = res.json || {};
  const baloes = (j.mensagens || []).map(limpar).filter(Boolean).slice(0, 3);
  const proibido = (ctx.blocked_terms || []).find((t) => baloes.some((b) => b.toLowerCase().includes(String(t).toLowerCase())));
  if (proibido || !baloes.length) {
    if (baloes.length) await rpc('ai_bot_suggest', { p_conv: conv, p_text: baloes.join('\n\n'), p_reason: `não enviada: tinha a palavra proibida "${proibido}"` });
    await rpc('ai_bot_apply', { p_conv: conv, p_fields: j.ficha || {}, p_memory: j.memoria || null, p_handoff: true,
      p_reason: proibido ? `a resposta tinha a palavra proibida "${proibido}" e não foi enviada` : 'a IA não gerou resposta' });
    return { respondeu: false, motivo: proibido ? 'termo proibido' : 'resposta vazia' };
  }

  // Copiloto: só sugere. Supervisionado: segura a mensagem quando quer passar para a equipe. Autônomo: envia sempre.
  const modo = ctx.op_mode || 'sup';
  if (modo === 'cop' || (modo === 'sup' && j.passar_para_equipe)) {
    await rpc('ai_bot_suggest', { p_conv: conv, p_text: baloes.join('\n\n'), p_reason: modo === 'cop' ? 'copiloto: revise e envie' : 'segurada para revisão: ' + (j.motivo || 'passar para a equipe') });
    await rpc('ai_bot_apply', { p_conv: conv, p_fields: j.ficha || {}, p_memory: j.memoria || null, p_handoff: modo === 'sup', p_reason: j.motivo || '' });
    return { respondeu: false, sugeriu: true, motivo: modo === 'cop' ? 'copiloto' : 'segurada para revisão' };
  }

  for (let i = 0; i < baloes.length; i++) {
    await waha('startTyping', { session: ctx.session || 'default', chatId: ctx.chat_id }).catch(() => {});
    await sleep(Math.min(4000, 800 + baloes[i].length * 25));
    const enviado = await waha('sendText', { session: ctx.session || 'default', chatId: ctx.chat_id, text: baloes[i] });
    const wid = enviado && (typeof enviado.id === 'object' && enviado.id ? enviado.id._serialized || enviado.id.id : enviado.id);
    await rpc('ai_bot_log', { p_conv: conv, p_body: baloes[i], p_wa_id: wid || null });
  }
  await waha('stopTyping', { session: ctx.session || 'default', chatId: ctx.chat_id }).catch(() => {});
  await rpc('ai_bot_apply', { p_conv: conv, p_fields: j.ficha || {}, p_memory: j.memoria || null, p_handoff: !!j.passar_para_equipe, p_reason: j.motivo || '' });
  return { respondeu: true, baloes: baloes.length };
}
