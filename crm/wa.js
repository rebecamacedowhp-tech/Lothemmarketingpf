/* LOTHEM Vendas — WhatsApp real (WAHA) na conta real.
   Carrega números e conversas do banco, abre as mensagens (decifradas por função), envia pelo servidor /api/waha
   e confere novidades a cada poucos segundos. Na demonstração, nada aqui roda. */

const WA_ST = { ia: 'ia', waiting_lead: 'aguardando', waiting_human: 'espera', human: 'humano', closed: 'encerrada' };
const WA = { timer: null, sig: {} };
const hm = (iso) => { const d = new Date(iso || Date.now()); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

function waInstance(i) {
  return { id: i.id, nm: i.name, type: i.kind === 'oficial' ? 'oficial' : 'nao', num: i.phone_hint ? '•••• ' + i.phone_hint : 'sessão ' + (i.external_id || '—'), st: i.status === 'on' ? 'on' : 'off',
    quality: '—', tier: 'WAHA', today: 0, agents: ['ia'], use: 'WhatsApp pela WAHA · sessão ' + (i.external_id || '—') };
}
function waContact(c, uid) {
  return { id: c.id, pf: c.kind === 'pf', nm: c.name, co: c.kind === 'pf' ? (c.occupation || 'Pessoa física') : (c.company || '—'), seg: c.segment || '—', city: c.city || '—',
    ph: c.phone_hint ? '•••• ' + c.phone_hint : '—', docHint: c.document_hint || null, em: c.email_hint || '—', credit: c.credit_wanted || null, entry: c.entry_path || null, src: c.source || 'WhatsApp',
    owner: c.owner_id || uid, life: c.lifecycle || 'Lead', score: c.score || 0, last: 'agora', services: c.services || {}, camp: c.campaign_id || null };
}
function waConv(r, old) {
  const cv = old || { id: r.id, q: {}, af: {}, sugg: [], conf: 0, msgs: [], loaded: false };
  Object.assign(cv, { c: r.contact_id, inst: r.instance_id, st: WA_ST[r.status] || 'espera', who: r.assigned_to || null, unread: r.unread || 0, t: hm(r.last_message_at || r.created_at), at: r.last_message_at });
  return cv;
}

async function waLoad(silent) {
  if (!REAL.on) return;
  const sb = REAL.sb, ids = Object.keys(DB.orgs);
  const [ins, cvs] = await Promise.all([
    sb.from('whatsapp_instances').select('id, org_id, name, kind, phone_hint, external_id, status').in('org_id', ids),
    sb.from('conversations').select('id, org_id, contact_id, instance_id, status, unread, last_message_at, created_at, assigned_to, chat_id').in('org_id', ids).order('last_message_at', { ascending: false, nullsFirst: false }).limit(300),
  ]);
  if (ins.error || cvs.error) { if (!silent) console.error(ins.error || cvs.error); return; }
  let changed = false;
  for (const o of Object.values(DB.orgs)) {
    o.instances = ins.data.filter((i) => i.org_id === o.id).map(waInstance);
    const rows = cvs.data.filter((c) => c.org_id === o.id);
    const missing = rows.map((r) => r.contact_id).filter((cid) => !o.contacts.some((c) => c.id === cid));
    if (missing.length) {
      const ct = await sb.from('contacts').select('*').in('id', Array.from(new Set(missing)));
      if (!ct.error) { ct.data.forEach((c) => o.contacts.unshift(waContact(c, DB.me))); changed = true; }
    }
    o.conversations = rows.map((r) => {
      const old = o.conversations.find((x) => x.id === r.id);
      if (!old || old.at !== r.last_message_at) { changed = true; if (old) old.loaded = false; }
      return waConv(r, old);
    });
  }
  const cv = S.cv && O().conversations.find((x) => x.id === S.cv);
  if (cv && !cv.loaded) { await waMsgs(cv); changed = true; }
  if (changed && S.route === 'atendimento') {
    const inp = $('#msgIn'); if (inp && S.cv) S.draft[S.cv] = inp.value;
    rerender();
  }
  if (changed) refreshChrome();
}
async function waMsgs(cv) {
  const r = await REAL.sb.rpc('get_conversation_messages', { p_conversation: cv.id });
  if (r.error) { console.error(r.error); return; }
  cv.msgs = r.data.map((m) => ({ f: m.sender === 'lead' ? 'lead' : m.sender === 'ia' ? 'ia' : m.sender === 'note' ? 'note' : m.sender === 'system' ? 'sys' : 'user', u: m.author_id || DB.me, x: m.body || '', t: hm(m.created_at) }));
  cv.loaded = true;
  if (cv.unread) { cv.unread = 0; REAL.sb.from('conversations').update({ unread: 0 }).eq('id', cv.id).then(() => {}); }
}

/* abrir uma conversa real carrega as mensagens */
const waRenderBase = VIEWS.atendimento.render;
VIEWS.atendimento.render = function () {
  if (REAL.on && S.cv) { const cv = O().conversations.find((x) => x.id === S.cv); if (cv && !cv.loaded && !cv.loading) { cv.loading = true; waMsgs(cv).then(() => { cv.loading = false; if (S.route === 'atendimento') rerender(); }); } }
  return waRenderBase.apply(this, arguments);
};

/* responder pelo CRM: aparece na hora e vai para o WhatsApp pelo servidor */
const waSendBase = ACT.sendMsg;
ACT.sendMsg = async () => {
  if (!REAL.on || S.noteMode) return waSendBase();
  const cv = CV(S.cv), el = $('#msgIn'), txt = (el ? el.value : '').trim();
  if (!cv || !txt) return waSendBase();
  waSendBase();
  try {
    const { data } = await REAL.sb.auth.getSession();
    const r = await fetch('/api/waha?op=send', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data.session && data.session.access_token) }, body: JSON.stringify({ conversation: cv.id, text: txt }) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.ok) throw new Error(out.erro || 'falha no envio');
  } catch (e) {
    toast('A mensagem não saiu', e.message + '. Confira se o WhatsApp está conectado na WAHA.', 'bad', 'CircleAlert');
    const last = [...cv.msgs].reverse().find((m) => m.f === 'user' && m.x === txt); if (last) last.x = '⚠ não enviada: ' + last.x;
    rerender();
  }
};

/* Canais: ligar um número da WAHA a esta organização */
function waConnectModal() {
  openModal(modalHead('Conectar WhatsApp (WAHA)', 'O número já precisa estar conectado no painel da WAHA, com a sessão em WORKING.') + `<form class="modal-b col" style="gap:14px" data-sub="waConnect">
    <div class="field"><label for="waNm">Nome do número</label><input class="in" id="waNm" placeholder="Ex.: Lothem Crédito" required></div>
    <div class="field"><label for="waSs">Nome da sessão na WAHA</label><input class="in" id="waSs" value="default" required><span class="hint">Aparece na lista de Sessions do painel da WAHA.</span></div>
    <div class="field"><label for="waPh">Número (opcional)</label><input class="in" id="waPh" inputmode="tel" placeholder="(19) 99999-0000"></div>
    <div class="row top-a" style="gap:8px;font-size:12.5px;padding:10px 12px;border-radius:9px;background:var(--warn-soft)">${ic('TriangleAlert', 'sm')}<span>A WAHA não é a API oficial da Meta. O número pode ser restringido, principalmente com disparos em massa.</span></div>
  </form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="waConnect">Conectar</button></div>`);
}
SUB.waConnect = async () => {
  const nm = $('#waNm').value.trim(), ss = $('#waSs').value.trim(), ph = $('#waPh').value.trim();
  if (!nm || !ss) return;
  const r = await REAL.sb.from('whatsapp_instances').insert({ org_id: S.org, name: nm, kind: 'nao_oficial', external_id: ss, phone: ph || null, status: 'on' }).select().single();
  if (r.error) { toast('Não consegui conectar', r.error.message, 'bad', 'CircleAlert'); return; }
  closeOverlay(); toast('WhatsApp conectado ao CRM', 'As mensagens novas vão aparecer no Atendimento.', '', 'Smartphone');
  await waLoad(true); go('canais');
};

/* liga tudo quando a conta real abre */
const waStartBase = startReal;
startReal = async function (user) {
  await waStartBase(user);
  if (!REAL.on) return;
  await waLoad(true);
  if (S.route === 'atendimento' || S.route === 'canais') rerender();
  clearInterval(WA.timer);
  WA.timer = setInterval(() => { if (!document.hidden) waLoad(true); }, 8000);
};
