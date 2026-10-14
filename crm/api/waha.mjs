// Lothem Vendas — ponte entre a WAHA (WhatsApp) e o CRM.
// POST /api/waha?op=webhook  ← a WAHA avisa que chegou (ou saiu) mensagem. Assinatura HMAC-SHA512 obrigatória.
// POST /api/waha?op=send     ← o CRM manda uma resposta. Exige o login da pessoa (token do Supabase).
// Segredos ficam nas variáveis da Vercel: WAHA_URL, WAHA_API_KEY, WAHA_WEBHOOK_HMAC, SUPABASE_SERVICE_ROLE_KEY.

import crypto from 'node:crypto';
import { responder } from './_cibelle.mjs';

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

const digitsOf = (jid) => (/@(c\.us|s\.whatsapp\.net)$/.test(jid || '') ? String(jid).split('@')[0].replace(/\D/g, '') : '');

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
  console.log('webhook', JSON.stringify({ conversa: conv, deMim: fromMe, temTexto: !!p.body, ia }));
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

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json(405, { ok: false });
    const op = new URL(request.url).searchParams.get('op');
    try {
      if (op === 'webhook') return await webhook(request);
      if (op === 'send') return await send(request);
      return json(404, { ok: false });
    } catch (e) {
      console.error(e);
      return json(500, { ok: false, erro: String(e.message || e) });
    }
  },
};
