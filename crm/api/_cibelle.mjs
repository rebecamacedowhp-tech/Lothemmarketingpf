// Lothem Vendas — motor da SDR IA no WhatsApp.
// Chamado pela ponte da WAHA quando chega mensagem de um lead. O banco decide se a IA pode responder
// (chave, modo de teste, equipe atendendo, limite de gasto); aqui só montamos o contexto, chamamos a IA
// com a chave do cliente, conferimos a resposta e enviamos.

import { ROTEIRO_PROMPT, ROTEIRO_SCHEMA, renderizar, lerQuiz } from './_roteiro-credito.mjs';

// organizações que rodam o roteiro fixo (falas escritas por nós; a IA só escolhe e preenche)
const ROTEIROS = { '5a9f3318-59af-4384-b406-2d5f350fd5fc': 'credito' }; // LOTHEM — Inteligência em Crédito · PJ

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
    mensagens: { type: 'array', items: { type: 'string' }, description: '1 ou 2 balões de WhatsApp, na ordem de envio.' },
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

VOZ (vale acima de qualquer regra de estilo anterior)
Você é uma pessoa simpática e esperta conversando no WhatsApp, não um atendimento. Leve, direta, calorosa, com reação de gente.
- Reaja de verdade ao que a pessoa disse antes de perguntar: "Boa!", "Poxa…", "Ah, entendi o drama", "Que bom que ainda não pediu". Uma reação curta, depois a pergunta.
- Muitas vezes 1 balão basta. Mensagem curta vende mais.
- Fale como se fala: "pra", "tá", "beleza", "olha". Sem palavra difícil.
- Proibido soar como robô:
  · repetir o que a pessoa acabou de dizer ("Então você ainda não pediu…");
  · começar mensagem com "Entendi", "Perfeito", "Certo" ou com o nome da pessoa (use o nome no máximo uma vez a cada 3 ou 4 mensagens);
  · "Para eu entender melhor", "Me conta:", "Obrigada por chamar aqui", "Fico à disposição", "Excelente pergunta";
  · pergunta com cardápio de opções ("negaram, aprovaram menos ou ainda não pediu?"): pergunte aberto;
  · agradecer a cada resposta;
  · aviso de segurança na primeira mensagem. O aviso (não pede senha, não empresta, não cobra para liberar) entra só quando falar de pagamento ou se a pessoa desconfiar.
- Mostre que entende do assunto com uma observação útil e curta, não com explicação longa.
Exemplos do jeito errado → jeito certo:
· "Entendi, Andréia. Então você ainda não pediu, e isso é bom: dá para se preparar antes." → "Que bom que ainda não pediu! Dá pra chegar no banco já sabendo o que ele vai olhar."
· "Para eu entender melhor o seu caso: quanto você quer de capital de giro, mais ou menos?" → "E quanto você tá pensando em pedir?"
· (a pessoa diz "300 mil") "Certo. E para que seria esse valor?" → "Boa, 300 mil dá um fôlego bom. É pra estoque, folha ou pra respirar no caixa?" (aqui as opções são exemplo, não formulário)
· "Prazer, Andréia! Obrigada por chamar aqui. Me conta: você já pediu?" → "Prazer, Andréia! Você já chegou a pedir esse capital no banco?"

COMO DEVOLVER A RESPOSTA (o sistema lê isto, o cliente não vê)
Responda só com o JSON pedido:
- mensagens: 1 ou 2 balões curtos (no máximo 3 linhas cada), prontos para enviar no WhatsApp. Uma pergunta só, no último balão. Sem rótulos, sem colchetes, sem campos para preencher.
- Nunca prometa algo que não dá para entregar por esta conversa (áudio, ligação, arquivo, retorno de outra pessoa). Se a pessoa precisar disso, passe para a equipe e avise.
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

export async function chamarClaude(ctx, sistema, dinamico, msgs, schema = SCHEMA) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ctx.api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: ctx.model || 'claude-sonnet-5-5', max_tokens: 4000,
      system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }, { type: 'text', text: dinamico }],
      messages: msgs,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('Claude: ' + ((out.error && out.error.message) || r.status)), { status: r.status, tipo: out.error && out.error.type });
  const u = out.usage || {};
  const uso = { in: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), out: u.output_tokens || 0, cache: u.cache_read_input_tokens || 0, creation: u.cache_creation_input_tokens || 0 };
  if (out.stop_reason === 'refusal') return { recusa: true, uso };
  const txt = (out.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { json: JSON.parse(txt), uso };
}

export async function chamarGPT(ctx, sistema, dinamico, msgs, schema = SCHEMA) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + ctx.api_key, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: ctx.model || 'gpt-6.1-sol',
      messages: [{ role: 'system', content: sistema }, { role: 'system', content: dinamico }, ...msgs],
      response_format: { type: 'json_schema', json_schema: { name: 'resposta', strict: true, schema } },
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('OpenAI: ' + ((out.error && out.error.message) || r.status)), { status: r.status, tipo: out.error && (out.error.code || out.error.type) });
  const u = out.usage || {}, cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0;
  const uso = { in: (u.prompt_tokens || 0) - cached, out: u.completion_tokens || 0, cache: cached, creation: 0 };
  const msg = out.choices && out.choices[0] && out.choices[0].message;
  if (!msg || msg.refusal) return { recusa: true, uso };
  return { json: JSON.parse(msg.content), uso };
}

export function custo(model, uso) {
  const [pi, po] = PRICE[model] || [4, 20];
  // cache: leitura sai a 10% da entrada; gravação no cache da Anthropic sai a 125%
  return ((uso.in - uso.creation) * pi + uso.creation * pi * 1.25 + uso.cache * pi * 0.1 + uso.out * po) / 1e6;
}

// por que a IA falhou, em linguagem de cliente: créditos, chave, limite de uso ou outro
export function tipoDeErro(e) {
  const t = (String(e.message || '') + ' ' + String(e.tipo || '')).toLowerCase();
  if (/credit balance|insufficient_quota|billing|quota|saldo|payment/.test(t)) return 'creditos';
  if (e.status === 401 || e.status === 403 || /api.key|api_key|authentication|invalid x-api-key|permission/.test(t)) return 'chave';
  if (e.status === 429 || /rate.limit|overloaded/.test(t)) return 'limite';
  return 'outro';
}

// limpa o que não pode ir para o cliente
function limpar(txt) {
  return String(txt || '').replace(/\s*—\s*/g, ', ').replace(/\[[^\]]{1,40}\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function responder({ rpc, waha, conv, waId }) {
  await sleep(DEBOUNCE_MS);
  const ctx = await rpc('ai_bot_context', { p_conv: conv, p_wa_id: waId || null });
  if (!ctx || !ctx.reply) return { respondeu: false, motivo: ctx && ctx.reason };
  const roteiro = ROTEIROS[ctx.org_id];
  if (!roteiro && !ctx.system_prompt) return { respondeu: false, motivo: 'instruções da IA não carregadas (Painel Mestre → Carregar pacote oficial)' };

  const msgs = historico(ctx.messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return { respondeu: false, motivo: 'nada novo do lead' };

  // busca na base com as palavras das últimas mensagens do lead
  const ultimas = (ctx.messages || []).filter((m) => m.de === 'lead').slice(-3).map((m) => m.texto).join(' ');
  const palavras = roteiro ? [] : Array.from(new Set(ultimas.toLowerCase().normalize('NFC').match(/[a-zà-ú0-9]{4,}/g) || [])).slice(0, 12);
  const trechos = palavras.length ? await rpc('ai_kb_find', { p_org: ctx.org_id, p_q: palavras.join(' or ') }).catch(() => []) : [];

  const sistema = roteiro ? ROTEIRO_PROMPT : ctx.system_prompt + FORMATO;
  // conversa nova sem memória (lead novo ou teste recomeçado): não reaproveita a ficha antiga, começa do zero
  const doZero = ctx.first_reply && !ctx.memory;
  // lead que veio do quiz pelo botão do WhatsApp: a mensagem traz os dados dele; guarda na ficha e passa para a IA
  let quiz = null;
  if (roteiro) {
    const q = (ctx.messages || []).find((x) => x.de === 'lead' && lerQuiz(x.texto));
    quiz = q ? lerQuiz(q.texto) : null;
    if (quiz && (ctx.first_reply || !(ctx.contact || {}).entrada)) { // também quando o quiz chega no meio da conversa
      const notas = ['Veio do quiz do site.', quiz.faturamento && 'Faturamento: ' + quiz.faturamento + '.', quiz.prontidao && 'Prontidão: ' + quiz.prontidao + '.', quiz.credito && 'Crédito para: ' + quiz.credito + '.', quiz.empresa && 'Empresa: ' + quiz.empresa + '.'].filter(Boolean).join('\n');
      await rpc('ai_bot_quiz', { p_conv: conv, p_nome: quiz.nome, p_empresa: quiz.empresa, p_cnpj: quiz.cnpj, p_credito: quiz.credito, p_notes: notas }).catch((e) => console.error('ai_bot_quiz', e));
    }
  }
  const base = doZero ? Object.assign({}, ctx, { contact: { entrada: quiz ? 'quiz' : (ctx.contact || {}).entrada } }) : ctx;
  let dinamico = roteiro ? contexto(base, []).split('TRECHOS DA BASE')[0].trim() : contexto(base, trechos || []);
  if (quiz) dinamico += '\n\nQUIZ DO SITE (a pessoa chegou pelo botão do funil; não pergunte nada disto de novo). Chame pelo primeiro nome do quiz, e só troque se ela corrigir com clareza ("meu nome é…", "pode me chamar de…").\n' +
    [quiz.primeiro && 'Primeiro nome: ' + quiz.primeiro, quiz.nome && 'Nome completo: ' + quiz.nome, quiz.empresa && 'Empresa: ' + quiz.empresa, quiz.faturamento && 'Faturamento: ' + quiz.faturamento + ' por mês', quiz.prontidao && 'Prontidão: ' + quiz.prontidao, quiz.credito && 'Crédito para: ' + quiz.credito].filter(Boolean).join('\n');
  const schema = roteiro ? ROTEIRO_SCHEMA : SCHEMA;
  const model = ctx.model || (ctx.provider === 'openai' ? 'gpt-6.1-sol' : 'claude-sonnet-5-5');

  let res;
  try {
    res = ctx.provider === 'openai' ? await chamarGPT(ctx, sistema, dinamico, msgs, schema) : await chamarClaude(ctx, sistema, dinamico, msgs, schema);
  } catch (e) {
    console.error('IA falhou', e);
    await rpc('ai_bot_error', { p_org: ctx.org_id, p_kind: tipoDeErro(e), p_msg: String(e.message || e) }).catch(() => {});
    await rpc('ai_bot_apply', { p_conv: conv, p_fields: {}, p_memory: null, p_handoff: true, p_reason: 'a IA não conseguiu responder (' + String(e.message || e).slice(0, 120) + ')' });
    return { respondeu: false, motivo: 'erro na IA' };
  }
  await rpc('ai_bot_usage', { p_org: ctx.org_id, p_model: model, p_in: res.uso.in, p_out: res.uso.out, p_cache: res.uso.cache, p_cost: Number(custo(model, res.uso).toFixed(4)), p_new_conv: !!ctx.first_reply });
  if (res.recusa) {
    await rpc('ai_bot_apply', { p_conv: conv, p_fields: {}, p_memory: null, p_handoff: true, p_reason: 'a IA preferiu não responder esta mensagem' });
    return { respondeu: false, motivo: 'recusa' };
  }

  const j = res.json || {};
  // nunca manda de novo um balão igual a um que a IA já enviou nesta conversa (ex.: o link várias vezes)
  const jaFoi = new Set((ctx.messages || []).filter((x) => x.de === 'ia').map((x) => limpar(x.texto)));
  let baloes = (roteiro ? renderizar(j) : (j.mensagens || [])).map(limpar).filter(Boolean).filter((b) => !jaFoi.has(b)).slice(0, 2);
  if (roteiro && !baloes.length && (j.falas || []).includes('link')) baloes = renderizar({ falas: ['aguardo'], slots: j.slots }).map(limpar);
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
