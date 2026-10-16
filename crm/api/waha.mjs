// Lothem Vendas — ponte entre a WAHA (WhatsApp) e o CRM.
// POST /api/waha?op=webhook  ← a WAHA avisa que chegou (ou saiu) mensagem. Assinatura HMAC-SHA512 obrigatória.
// POST /api/waha?op=send     ← o CRM manda uma resposta. Exige o login da pessoa (token do Supabase).
// Segredos ficam nas variáveis da Vercel: WAHA_URL, WAHA_API_KEY, WAHA_WEBHOOK_HMAC, SUPABASE_SERVICE_ROLE_KEY.

import crypto from 'node:crypto';
import { responder, chamarClaude, chamarGPT, custo } from './_cibelle.mjs';

const SB_URL = 'https://djjodusiwteuembfvpvt.supabase.co';
const SB_PUBLIC = 'sb_publishable_CO5CII13uu1sQ6kY2tjLuA_RO2RC2IO';
const env = (k) => (process.env[k] || '').trim();
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/* chamadas ao banco: como servidor (chave de serviço) ou como a pessoa logada (token dela) */
async function rpc(fn, args, token) {
  const key = token ? SB_PUBLIC : env('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, 'content-type': 'application/json' };
  // chaves novas (sb_secret_…) vão só no apikey; token de login e chave antiga (JWT) vão no Authorization
  if (token) headers.authorization = `Bearer ${token}`;
  else if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error((data && data.message) || `banco respondeu ${r.status}`);
  return data;
}

function validHmac(raw, header) {
  const key = env('WAHA_WEBHOOK_HMAC');
  if (!key || !header) return false;
  const mine = crypto.createHmac('sha512', key).update(raw).digest('hex');
  const a = Buffer.from(mine), b = Buffer.from(String(header).trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// número do WhatsApp sem o código do aparelho: "5519999990000:10@s.whatsapp.net" vira "5519999990000"
const digitsOf = (jid) => (/@(c\.us|s\.whatsapp\.net)$/.test(jid || '') ? String(jid).split('@')[0].split(':')[0].replace(/\D/g, '') : '');

async function lidParaNumero(session, lid) {
  try {
    const r = await fetch(`${env('WAHA_URL').replace(/\/$/, '')}/api/${encodeURIComponent(session)}/lids/${encodeURIComponent(lid)}`, { headers: { 'x-api-key': env('WAHA_API_KEY') } });
    if (!r.ok) { console.log('lid sem resposta', r.status); return ''; }
    const out = await r.json().catch(() => ({}));
    return digitsOf(out && (out.pn || out.phone || out.jid)) || String((out && out.pn) || '').replace(/\D/g, '');
  } catch (e) { console.log('lid erro', String(e.message || e)); return ''; }
}

async function webhook(request) {
  const raw = await request.text();
  if (!validHmac(raw, request.headers.get('x-webhook-hmac'))) return json(401, { ok: false, erro: 'assinatura inválida' });
  let ev; try { ev = JSON.parse(raw); } catch { return json(400, { ok: false }); }
  if (!['message', 'message.any'].includes(ev.event)) return json(200, { ok: true, ignorado: ev.event });
  const p = ev.payload || {}, fromMe = !!p.fromMe;
  const chat = fromMe ? p.to : p.from;
  if (!chat || /@g\.us$|@newsletter$|status@broadcast/.test(chat)) return json(200, { ok: true, ignorado: 'grupo ou status' });
  const info = (p._data && (p._data.Info || p._data)) || {};
  const alt = info.SenderAlt || info.RecipientAlt || info.senderPn || info.SenderPN || info.senderAlt || p.senderPn || '';
  let phone = digitsOf(chat) || digitsOf(alt);
  // o WhatsApp às vezes manda só o código da conversa (@lid), sem o número: pergunta à WAHA qual é o número
  if (!phone && /@lid$/.test(chat || '')) {
    phone = await lidParaNumero(ev.session || 'default', chat);
    if (!phone) console.log('sem número', JSON.stringify({ chat, campos: Object.keys(info) }));
  }
  const name = fromMe ? '' : (p.notifyName || info.PushName || info.notifyName || info.pushName || '');
  const ts = p.timestamp ? new Date(Number(p.timestamp) * 1000).toISOString() : new Date().toISOString();
  const waId = typeof p.id === 'object' && p.id ? p.id._serialized || p.id.id : p.id;
  const body = p.body || (p.hasMedia ? '[mídia]' : '');
  const conv = await rpc('wa_ingest', { p_session: ev.session || 'default', p_chat_id: chat, p_phone: phone || null, p_name: name || null, p_body: body, p_wa_id: waId || null, p_from_me: fromMe, p_ts: ts });
  // mensagem nova de lead: a IA decide se responde (modo de teste, equipe atendendo etc. ficam no banco)
  let ia = null;
  if (conv && !fromMe && p.body) {
    try { ia = await responder({ rpc, waha, conv, waId }); } catch (e) { console.error('motor da IA', e); ia = { respondeu: false, motivo: 'erro: ' + String(e.message || e).slice(0, 200) }; }
  }
  console.log('webhook', JSON.stringify({ conversa: conv, deMim: fromMe, temTexto: !!p.body, tipoChat: String(chat).split('@')[1], final: phone ? phone.slice(-4) : '', digitos: phone ? phone.length : 0, altTipo: String(alt).split('@')[1] || '', ia }));
  return json(200, { ok: true, conversa: conv, ia });
}

async function waha(op, body) {
  const r = await fetch(`${env('WAHA_URL').replace(/\/$/, '')}/api/${op}`, {
    method: 'POST',
    headers: { 'x-api-key': env('WAHA_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('WAHA ' + op + ': ' + ((out && (out.message || out.error)) || r.status));
  return out;
}

async function send(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { ok: false, erro: 'faça login' });
  let body; try { body = await request.json(); } catch { return json(400, { ok: false }); }
  const text = String(body.text || '').trim().slice(0, 4000);
  if (!body.conversation || !text) return json(400, { ok: false, erro: 'conversa e texto são obrigatórios' });
  const target = await rpc('wa_send_target', { p_conversation: body.conversation }, token); // confere se a pessoa é da organização
  const t = Array.isArray(target) ? target[0] : target;
  if (!t || !t.chat_id) return json(400, { ok: false, erro: 'conversa sem WhatsApp ligado' });
  const r = await fetch(`${env('WAHA_URL').replace(/\/$/, '')}/api/sendText`, {
    method: 'POST',
    headers: { 'x-api-key': env('WAHA_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ session: t.session || 'default', chatId: t.chat_id, text }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) return json(502, { ok: false, erro: 'o WhatsApp não aceitou o envio', detalhe: out && (out.message || out.error) });
  const waId = out && (typeof out.id === 'object' ? out.id._serialized || out.id.id : out.id);
  await rpc('wa_log_sent', { p_conversation: body.conversation, p_body: text, p_wa_id: waId || null }, token);
  return json(200, { ok: true, wa_id: waId || null });
}

/* ---------- importar leads do WhatsApp (etiquetas) ---------- */
async function wahaGet(path) {
  const r = await fetch(`${env('WAHA_URL').replace(/\/$/, '')}/api/${path}`, { headers: { 'x-api-key': env('WAHA_API_KEY') } });
  const out = await r.json().catch(() => null);
  if (!r.ok) throw new Error('WAHA ' + path.split('?')[0] + ': ' + ((out && (out.message || out.error)) || r.status));
  return out;
}
// sessão da WAHA da organização, conferindo pelo login da pessoa (o banco só devolve se ela for da organização)
async function sessaoDaOrg(token, org) {
  const r = await fetch(`${SB_URL}/rest/v1/whatsapp_instances?select=external_id&kind=eq.nao_oficial&org_id=eq.${encodeURIComponent(org)}&limit=1`, {
    headers: { apikey: SB_PUBLIC, authorization: `Bearer ${token}` },
  });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0].external_id : null;
}
// lista as etiquetas do WhatsApp Business com quantas conversas cada uma tem, e testa se o histórico vem
async function etiquetas(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { ok: false, erro: 'faça login' });
  let body; try { body = await request.json(); } catch { return json(400, { ok: false }); }
  const s = await sessaoDaOrg(token, body.org);
  if (!s) return json(400, { ok: false, erro: 'esta organização não tem WhatsApp conectado' });
  let labels;
  try { labels = await wahaGet(`${encodeURIComponent(s)}/labels`); } catch (e) { return json(200, { ok: false, erro: 'etiquetas: ' + e.message }); }
  const out = [];
  let historico = null;
  for (const l of labels || []) {
    let chats = [];
    try { chats = await wahaGet(`${encodeURIComponent(s)}/labels/${encodeURIComponent(l.id)}/chats`); } catch (e) { chats = []; }
    out.push({ id: l.id, nome: l.name, cor: l.colorHex || l.color, conversas: Array.isArray(chats) ? chats.length : 0 });
    if (!historico && Array.isArray(chats) && chats[0]) {
      const chatId = chats[0].id && (chats[0].id._serialized || chats[0].id) || chats[0];
      try {
        const msgs = await wahaGet(`${encodeURIComponent(s)}/chats/${encodeURIComponent(chatId)}/messages?limit=20&downloadMedia=false`);
        historico = { mensagens: Array.isArray(msgs) ? msgs.length : 0, comTexto: Array.isArray(msgs) ? msgs.filter((m) => m.body).length : 0 };
      } catch (e) { historico = { erro: e.message }; }
    }
  }
  return json(200, { ok: true, sessao: s, etiquetas: out, historico });
}

// importa um pedaço das conversas de uma etiqueta: histórico da WAHA → IA preenche a ficha → banco
const FICHA_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['nome', 'empresa', 'segmento', 'cidade', 'credito_pretendido', 'resumo', 'situacao'],
  properties: {
    nome: { type: 'string', description: 'Nome que a pessoa disse na conversa. Vazio se ela não disse.' },
    empresa: { type: 'string' }, segmento: { type: 'string' }, cidade: { type: 'string' },
    credito_pretendido: { type: 'string', description: 'Curto, ex.: "capital de giro" ou "R$ 80 mil · capital de giro". Vazio se não falou.' },
    resumo: { type: 'string', description: 'Uma ou duas frases: o que a pessoa queria, onde a conversa parou e o que falta.' },
    situacao: { type: 'string', enum: ['interessado', 'sem_interesse', 'comprou', 'sem_info'] },
  },
};
const FICHA_PROMPT = `Você lê uma conversa antiga de WhatsApp entre a Lothem Crédito (consultoria que prepara empresas para conseguir crédito no banco) e um lead.
Preencha a ficha só com o que está escrito na conversa. Não invente: campo sem informação fica vazio.
"situacao": comprou = pagou o diagnóstico ou fechou a consultoria; sem_interesse = disse claramente que não quer; interessado = mostrou interesse e a conversa parou; sem_info = não dá para saber.`;

async function importar(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { ok: false, erro: 'faça login' });
  let body; try { body = await request.json(); } catch { return json(400, { ok: false }); }
  const s = await sessaoDaOrg(token, body.org);
  if (!s) return json(400, { ok: false, erro: 'esta organização não tem WhatsApp conectado' });
  const de = Math.max(0, Number(body.de) || 0), qtd = Math.min(8, Math.max(1, Number(body.qtd) || 5));
  const chats = (await wahaGet(`${encodeURIComponent(s)}/labels/${encodeURIComponent(body.etiqueta)}/chats`)) || [];
  const fatia = chats.slice(de, de + qtd);
  const keyRows = await rpc('ai_key_for_server', { p_org: body.org }).catch(() => []);
  const ia = Array.isArray(keyRows) ? keyRows[0] : keyRows;
  const res = await Promise.all(fatia.map(async (c) => {
    const chatId = (c && c.id && (c.id._serialized || c.id)) || c;
    if (typeof chatId !== 'string' || /@g\.us$|@newsletter$|status@broadcast/.test(chatId)) return { pulado: true };
    try {
      const raw = (await wahaGet(`${encodeURIComponent(s)}/chats/${encodeURIComponent(chatId)}/messages?limit=100&downloadMedia=false`)) || [];
      const msgs = raw.map((m) => ({
        wa_id: typeof m.id === 'object' && m.id ? m.id._serialized || m.id.id : m.id,
        from_me: !!m.fromMe, body: m.body || (m.hasMedia ? '[mídia]' : ''), ts: new Date(Number(m.timestamp || 0) * 1000).toISOString(),
        nome: m.fromMe ? '' : (m._data && (m._data.Info && m._data.Info.PushName || m._data.notifyName)) || m.notifyName || '',
      })).filter((m) => m.wa_id && m.body).sort((a, b) => (a.ts < b.ts ? -1 : 1));
      if (!msgs.length) return { pulado: true };
      let phone = digitsOf(chatId);
      if (!phone && /@lid$/.test(chatId)) phone = await lidParaNumero(s, chatId);
      const perfil = c.name || (msgs.find((m) => m.nome) || {}).nome || '';
      let ficha = {};
      if (ia && ia.api_key) {
        const conversa = msgs.slice(-40).map((m) => (m.from_me ? 'Lothem: ' : 'Lead: ') + m.body.slice(0, 400)).join('\n').slice(-6000);
        const ctx = { api_key: ia.api_key, model: ia.model };
        const out = ia.provider === 'openai'
          ? await chamarGPT(ctx, FICHA_PROMPT, 'Nome no perfil do WhatsApp: ' + (perfil || '—'), [{ role: 'user', content: conversa }], FICHA_SCHEMA)
          : await chamarClaude(ctx, FICHA_PROMPT, 'Nome no perfil do WhatsApp: ' + (perfil || '—'), [{ role: 'user', content: conversa }], FICHA_SCHEMA);
        if (out.json) ficha = out.json;
        await rpc('ai_bot_usage', { p_org: body.org, p_model: ia.model, p_in: out.uso.in, p_out: out.uso.out, p_cache: out.uso.cache, p_cost: Number(custo(ia.model, out.uso).toFixed(4)), p_new_conv: false }).catch(() => {});
      }
      await rpc('wa_import_chat', { p_session: s, p_chat_id: chatId, p_phone: phone || null, p_name: perfil || null, p_label: body.nome || String(body.etiqueta),
        p_msgs: msgs.map(({ nome, ...m }) => m), p_ficha: ficha });
      return { ok: true, nome: ficha.nome || perfil || '', mensagens: msgs.length, situacao: ficha.situacao || '' };
    } catch (e) { console.error('importar', chatId, e); return { erro: String(e.message || e).slice(0, 160) }; }
  }));
  return json(200, { ok: true, total: chats.length, de, proximo: de + fatia.length < chats.length ? de + fatia.length : null, resultados: res });
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json(405, { ok: false });
    const op = new URL(request.url).searchParams.get('op');
    try {
      if (op === 'webhook') return await webhook(request);
      if (op === 'send') return await send(request);
      if (op === 'etiquetas') return await etiquetas(request);
      if (op === 'importar') return await importar(request);
      return json(404, { ok: false });
    } catch (e) {
      console.error(e);
      return json(500, { ok: false, erro: String(e.message || e) });
    }
  },
};
