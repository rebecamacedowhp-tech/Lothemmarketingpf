/* LOTHEM Vendas — Disparos: mensagem em massa pela SDR IA, com segurança para o número.
   Passo a passo: quem recebe → mensagem aprovada → ritmo → revisar e começar.
   Quem responde cai no Atendimento com a SDR; quem pede para sair vira "não contatar". */

const isRealB = () => typeof REAL !== 'undefined' && REAL.on;
const BL_ST = { rascunho: ['Rascunho', 'line'], agendado: ['Aguardando WhatsApp', 'gold'], enviando: ['Enviando', 'cy'], pausado: ['Pausado', 'warn'], concluido: ['Concluído', 'ok'], parado: ['Parado pela segurança', 'bad'] };
const hasPhone = (c) => c.ph && c.ph !== '—';

/* ---------- demonstração ---------- */
(function demoBlasts() {
  const cr = DB.orgs.cred;
  Object.values(DB.orgs).forEach((o) => { o.blasts = o.blasts || []; });
  if (cr) {
    cr.templates = (cr.templates || []).concat([
      { nm: 'reativar_teste_credito', cat: 'Marketing', st: 'Aprovado', lang: 'pt_BR', body: 'Oi, {{1}}! Aqui é a Cibelle, da equipe da Rebeca, da Lothem. Você fez o teste de crédito no nosso site há um tempo. Tem um ponto no seu caso que o banco olha e que vale você saber antes do próximo pedido. Posso te contar?' },
      { nm: 'convite_pronampe', cat: 'Marketing', st: 'Em análise', lang: 'pt_BR', body: 'Oi, {{1}}! O Pronampe abriu de novo. Quer saber se o perfil da sua empresa se encaixa antes de pedir?' },
    ]);
    cr.blasts.push({ id: 'b1', nm: 'Reativação · fizeram o teste e não compraram', tpl: 'reativar_teste_credito', total: 180, perHour: 30, win: ['09:00', '18:00'], weekdays: true, stopPct: 3, status: 'concluido', date: '05/10',
      stats: { sent: 180, delivered: 171, read: 142, replied: 23, optout: 2, failed: 9, sales: 4 } });
  }
})();

/* ---------- tela ---------- */
NAV[1].items.splice(1, 0, { id: 'disparos', nm: 'Disparos', ic: 'Send' });
VIEWS.disparos = {
  title: 'Disparos',
  crumb: 'Inteligência',
  render() {
    const o = O(), L = o.blasts || [];
    const card = (b) => {
      const s = b.stats || {}, st = BL_ST[b.status] || [b.status, 'line'], pctSent = b.total ? Math.round((100 * (s.sent || 0)) / b.total) : 0;
      return `<section class="pn"><div class="pn-h"><span class="pn-t">${ic('Send')}${esc(b.nm)}</span>${pill(st[0], st[1])}</div>
        <div class="pn-b col" style="gap:14px">
          <div class="dim" style="font-size:12.5px">Modelo ${esc(b.tpl)} · ${fmt(b.total)} contatos · até ${b.perHour} por hora · ${b.win[0]} às ${b.win[1]}${b.weekdays ? ', dias úteis' : ''}${b.date ? ' · ' + b.date : ''}</div>
          <div class="row" style="gap:10px">${bar(pctSent, b.status === 'parado' ? 'bad' : '')}<span class="num dim nowrap" style="font-size:12px">${fmt(s.sent || 0)} de ${fmt(b.total)}</span></div>
          <div class="usage">${[['Entregues', s.delivered], ['Lidas', s.read], ['Responderam', s.replied], ['Pediram para sair', s.optout], ['Vendas', s.sales]].map(([k, v]) => `<div class="r-stat"><span class="lbl">${k}</span><div class="num" style="font-size:18px;font-weight:600">${fmt(v || 0)}</div>${k === 'Responderam' && s.sent ? `<span class="dim" style="font-size:11.5px">${fmt((100 * (v || 0)) / s.sent, 1)}% das enviadas</span>` : ''}</div>`).join('')}</div>
          ${b.status === 'agendado' ? `<div class="row top-a" style="gap:8px;font-size:12.5px;padding:10px 12px;border-radius:9px;background:var(--gold-soft)">${ic('Info', 'sm')}<span>Tudo pronto. O envio começa sozinho quando o WhatsApp oficial estiver conectado em Canais.</span></div>` : ''}
          ${b.status === 'parado' ? `<div class="row top-a" style="gap:8px;font-size:12.5px;padding:10px 12px;border-radius:9px;background:var(--bad-soft)">${ic('ShieldAlert', 'sm')}<span>Parado porque mais de ${b.stopPct}% pediram para sair ou bloquearam. Isso protege o seu número. Revise a lista e a mensagem antes de retomar.</span></div>` : ''}
          <div class="row wrap" style="gap:8px">${b.status === 'enviando' ? `<button class="btn sm" data-act="blPause" data-id="${b.id}">${ic('Pause', 'xs')}Pausar</button>` : ''}${b.status === 'pausado' || b.status === 'parado' ? `<button class="btn sm pri" data-act="blResume" data-id="${b.id}">${ic('Play', 'xs')}Retomar</button>` : ''}${s.replied ? `<button class="btn sm ghost" data-go="atendimento">${ic('MessageCircle', 'xs')}Ver respostas</button>` : ''}</div>
        </div></section>`;
    };
    return `<div class="page-h"><div><h2>Disparos</h2><p>A ${esc(o.ia.name)} manda a mensagem para uma lista, aos poucos, e atende quem responder.</p></div>
      <div class="acts"><button class="btn pri" data-act="blNew">${ic('Plus', 'sm')}Novo disparo</button></div></div>
      <div class="grid g-12"><div class="s-8 col" style="gap:16px">${L.slice().reverse().map(card).join('') || `<div class="pn"><div class="empty">${ic('Send')}<div>Nenhum disparo ainda. Clique em <b>Novo disparo</b>.</div></div></div>`}</div>
      <section class="pn s-4"><div class="pn-h"><span class="pn-t">${ic('ShieldCheck')}Para não perder o número</span></div><div class="pn-b col" style="gap:10px;font-size:13px;color:var(--fg-2)">
        <p>Só vai para quem <b>autorizou</b> receber mensagens suas (regra do WhatsApp e da LGPD).</p>
        <p>A primeira mensagem é sempre um <b>modelo aprovado pela Meta</b>, cobrado por mensagem pela própria Meta.</p>
        <p>Envia <b>aos poucos</b>, no horário comercial. Se muita gente pedir para sair ou bloquear, o disparo <b>para sozinho</b>.</p>
        <p>Quem pediu para não ser contatado e quem está sendo atendido por uma pessoa <b>ficam de fora</b>.</p></div></section></div>`;
  },
};

/* ---------- novo disparo (passo a passo) ---------- */
function blAudience() {
  const o = O(), F = S.bl.f, busy = new Set(o.conversations.filter((c) => c.st === 'humano' || c.st === 'espera').map((c) => c.c));
  const inStage = (c) => !F.stage || o.deals.some((d) => d.c === c.id && d.s === F.stage);
  const all = o.contacts.filter((c) => (!F.life || c.life === F.life) && (!F.src || c.src === F.src) && (!F.city || c.city === F.city) && inStage(c));
  const out = { all, noPhone: all.filter((c) => !hasPhone(c)), optout: all.filter((c) => c.noContact), busy: F.skipBusy ? all.filter((c) => busy.has(c.id)) : [] };
  out.ok = all.filter((c) => hasPhone(c) && !c.noContact && !(F.skipBusy && busy.has(c.id)));
  return out;
}
VIEWS.disparo = {
  title: 'Novo disparo',
  crumb: 'Inteligência',
  render() {
    const o = O(), B = S.bl = S.bl || { step: 1, f: { skipBusy: true }, perHour: 30, win: ['09:00', '18:00'], weekdays: true, stopPct: 3, nm: '' };
    const steps = ['Quem recebe', 'Mensagem', 'Ritmo', 'Revisar'];
    const head = `<div class="page-h"><div><button class="link" data-go="disparos" style="margin-bottom:6px">${ic('ArrowLeft', 'xs')} Voltar aos disparos</button><h2>Novo disparo</h2><p>A ${esc(o.ia.name)} manda e atende quem responder.</p></div></div>
      <div class="imp-steps">${steps.map((t, i) => `<span class="${B.step === i + 1 ? 'on' : B.step > i + 1 ? 'done' : ''}"><b>${B.step > i + 1 ? ic('Check', 'xs') : i + 1}</b>${t}</span>`).join('')}</div>`;
    const nav = (back, next, dis) => `<div class="row between" style="margin-top:18px">${back ? `<button class="btn ghost" data-act="blGo" data-v="${back}">Voltar</button>` : '<span></span>'}<button class="btn pri" data-act="blGo" data-v="${next}" ${dis ? 'disabled' : ''}>Continuar</button></div>`;
    const A = blAudience(), tpls = (o.templates || []);
    if (B.step === 1) {
      const opts = (k, vals, nmAll) => `<select class="sel" data-chg="blF" data-k="${k}"><option value="">${nmAll}</option>${vals.map((v) => `<option value="${esc(v)}" ${B.f[k] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
      const uniq = (f) => Array.from(new Set(o.contacts.map(f).filter((x) => x && x !== '—'))).sort();
      const pp = o.pipelines[0];
      return head + `<section class="pn"><div class="pn-b col" style="gap:16px">
        <div class="field" style="max-width:420px"><label for="blNm">Nome do disparo</label><input class="in" id="blNm" value="${esc(B.nm)}" placeholder="Ex.: Reativação de quem fez o teste" data-inp="blNm"></div>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
          <div class="field"><label>Etapa de vida</label>${opts('life', uniq((c) => c.life), 'Todas')}</div>
          <div class="field"><label>Origem</label>${opts('src', uniq((c) => c.src), 'Todas')}</div>
          <div class="field"><label>Cidade</label>${opts('city', uniq((c) => c.city), 'Todas')}</div>
          <div class="field"><label>Etapa do funil</label><select class="sel" data-chg="blF" data-k="stage"><option value="">Todas</option>${pp.stages.map((s) => `<option value="${s.id}" ${B.f.stage === s.id ? 'selected' : ''}>${esc(s.nm)}</option>`).join('')}</select></div>
        </div>
        <label class="row" style="gap:10px;font-size:13px"><input type="checkbox" ${B.f.skipBusy ? 'checked' : ''} data-chg="blBusy"> Tirar quem está sendo atendido por uma pessoa agora</label>
        <div class="usage">${[['Vão receber', A.ok.length, 'ok'], ['Sem telefone', A.noPhone.length], ['Pediram para não contatar', A.optout.length], ['Em atendimento humano', A.busy.length]].map(([k, v, c]) => `<div class="r-stat"><span class="lbl">${k}</span><div class="num ${c || ''}" style="font-size:20px;font-weight:600">${fmt(v)}</div></div>`).join('')}</div>
        <div class="dim" style="font-size:12.5px">${A.ok.slice(0, 6).map((c) => esc(c.nm)).join(', ')}${A.ok.length > 6 ? ' e mais ' + (A.ok.length - 6) : ''}</div>
        <div class="dim" style="font-size:12.5px">Lista nova? Suba a planilha em <button class="link" data-act="importCsv">Importar de outro CRM</button> e depois filtre pela origem "Importado".</div>
        ${nav(0, 2, !A.ok.length)}</div></section>`;
    }
    if (B.step === 2) {
      const sel = tpls.find((t) => t.nm === B.tpl), first = (A.ok[0] || { nm: 'Maria' }).nm.split(' ')[0];
      return head + `<section class="pn"><div class="pn-b col" style="gap:14px">
        <span class="lbl">Escolha a mensagem aprovada pela Meta</span>
        ${tpls.map((t) => { const ok = t.st === 'Aprovado'; return `<button type="button" class="pay-m ${B.tpl === t.nm ? 'on' : ''}" data-act="blTpl" data-v="${esc(t.nm)}" ${ok ? '' : 'disabled style="opacity:.55"'}><span class="col" style="gap:4px;text-align:left"><b class="mono" style="font-size:12.5px">${esc(t.nm)}</b><span style="font-size:13px">${esc(t.body)}</span></span>${pill(t.st, ok ? 'ok' : 'warn')}</button>`; }).join('') || '<div class="dim">Nenhum modelo cadastrado.</div>'}
        <div class="dim" style="font-size:12.5px">Precisa de outra mensagem? Crie em <button class="link" data-go="canais" data-tab="tpl">WhatsApp e integrações → Modelos de mensagem</button>. A Meta aprova em algumas horas.</div>
        ${sel ? `<span class="lbl" style="margin-top:6px">Como chega para ${esc(first)}</span><div class="msg out" style="max-width:520px"><div class="who">${ic('Bot', 'xs')}${esc(o.ia.name)}</div>${esc(sel.body.replace('{{1}}', first))}</div>` : ''}
        ${nav(1, 3, !sel)}</div></section>`;
    }
    if (B.step === 3) {
      const hrs = Math.ceil(A.ok.length / Math.max(1, B.perHour)), perDay = (parseInt(B.win[1], 10) - parseInt(B.win[0], 10)) || 9, days = Math.ceil(hrs / perDay);
      return head + `<section class="pn"><div class="pn-b col" style="gap:16px">
        <div class="set-row" style="padding-top:0"><div><div class="tt">Mensagens por hora</div><div class="dd">Mais devagar protege o número. Para número novo, comece com até 20.</div></div><div class="row" style="gap:10px;flex:none;width:220px"><input type="range" min="5" max="120" step="5" value="${B.perHour}" data-inp="blRate" aria-label="Mensagens por hora"><b class="num" style="width:44px;text-align:right">${B.perHour}</b></div></div>
        <div class="form-g" style="max-width:420px"><div class="field"><label for="blW0">Começa às</label><input class="in" type="time" id="blW0" value="${B.win[0]}" data-chg="blW" data-i="0"></div><div class="field"><label for="blW1">Termina às</label><input class="in" type="time" id="blW1" value="${B.win[1]}" data-chg="blW" data-i="1"></div></div>
        <label class="row" style="gap:10px;font-size:13px"><input type="checkbox" ${B.weekdays ? 'checked' : ''} data-chg="blWeek"> Só em dias úteis</label>
        <div class="set-row"><div><div class="tt">Parar sozinho se</div><div class="dd">mais de ${B.stopPct}% pedirem para sair ou bloquearem</div></div><select class="sel" style="width:auto" data-chg="blStop">${[2, 3, 5].map((v) => `<option value="${v}" ${B.stopPct === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></div>
        <div class="r-stat">${ic('Clock', 'sm cy')} ${fmt(A.ok.length)} mensagens levam cerca de <b>${hrs} ${hrs === 1 ? 'hora' : 'horas'}</b>${days > 1 ? `, em ${days} dias` : ''}.</div>
        ${nav(2, 4)}</div></section>`;
    }
    return head + `<section class="pn"><div class="pn-b col" style="gap:14px">
      <div class="usage">${[['Contatos', fmt(A.ok.length)], ['Mensagem', B.tpl], ['Ritmo', B.perHour + ' por hora'], ['Horário', B.win[0] + ' às ' + B.win[1]]].map(([k, v]) => `<div class="r-stat"><span class="lbl">${k}</span><div style="font-size:14px;font-weight:600;word-break:break-word">${esc(String(v))}</div></div>`).join('')}</div>
      <label class="row top-a" style="gap:10px;font-size:13px"><input type="checkbox" ${B.consent ? 'checked' : ''} data-chg="blConsent"><span>Confirmo que essas pessoas autorizaram receber mensagens da minha empresa no WhatsApp (LGPD e regras do WhatsApp).</span></label>
      <div class="row between" style="margin-top:6px"><button class="btn ghost" data-act="blGo" data-v="3">Voltar</button><button class="btn pri" data-act="blStart" ${B.consent ? '' : 'disabled'}>${ic('Send', 'sm')}Começar disparo</button></div></div></section>`;
  },
};
ACT.blNew = () => { S.bl = null; go('disparo'); };
ACT.blGo = (el) => { const n = $('#blNm'); if (n) S.bl.nm = n.value; S.bl.step = Number(el.dataset.v); rerender(); };
CHG.blF = (el) => { S.bl.f[el.dataset.k] = el.value; rerender(); };
CHG.blBusy = (el) => { S.bl.f.skipBusy = el.checked; rerender(); };
INP.blNm = (el) => { S.bl.nm = el.value; };
ACT.blTpl = (el) => { S.bl.tpl = el.dataset.v; rerender(); };
INP.blRate = (el) => { S.bl.perHour = Number(el.value); rerender(); };
CHG.blW = (el) => { S.bl.win[+el.dataset.i] = el.value; rerender(); };
CHG.blWeek = (el) => { S.bl.weekdays = el.checked; };
CHG.blStop = (el) => { S.bl.stopPct = Number(el.value); rerender(); };
CHG.blConsent = (el) => { S.bl.consent = el.checked; rerender(); };
ACT.blStart = async () => {
  const o = O(), B = S.bl, A = blAudience();
  const b = { id: 'b' + uid(), nm: B.nm.trim() || 'Disparo de ' + new Date().toLocaleDateString('pt-BR'), tpl: B.tpl, total: A.ok.length, ids: A.ok.map((c) => c.id), perHour: B.perHour, win: B.win.slice(), weekdays: B.weekdays, stopPct: B.stopPct, status: isRealB() ? 'agendado' : 'enviando', date: 'hoje', stats: { sent: 0, delivered: 0, read: 0, replied: 0, optout: 0, failed: 0, sales: 0 } };
  if (isRealB()) {
    const r = await REAL.sb.from('broadcasts').insert({ org_id: o.id, name: b.nm, template: b.tpl, filters: B.f, contact_ids: b.ids, per_hour: b.perHour, window_start: b.win[0], window_end: b.win[1], weekdays_only: b.weekdays, stop_at_pct: b.stopPct, status: 'agendado', consent: true, created_by: DB.me }).select().single();
    if (r.error) { toast('Não consegui salvar o disparo', r.error.message, 'bad', 'CircleAlert'); return; }
    b.id = r.data.id;
  }
  (o.blasts = o.blasts || []).push(b); S.bl = null;
  go('disparos');
  if (isRealB()) toast('Disparo salvo', 'Começa sozinho quando o WhatsApp oficial estiver conectado.', '', 'Send');
  else { toast('Disparo começou', b.total + ' contatos · ' + b.perHour + ' por hora', '', 'Send'); blRun(b); }
};
ACT.blPause = (el) => { const b = O().blasts.find((x) => x.id === el.dataset.id); b.status = 'pausado'; blSave(b); rerender(); };
ACT.blResume = (el) => { const b = O().blasts.find((x) => x.id === el.dataset.id); b.status = isRealB() ? 'agendado' : 'enviando'; blSave(b); rerender(); if (!isRealB()) blRun(b); };
function blSave(b) { if (isRealB() && /^[0-9a-f-]{36}$/.test(b.id)) REAL.sb.from('broadcasts').update({ status: b.status, updated_at: new Date().toISOString() }).eq('id', b.id).then(() => {}); }

/* demonstração: o envio acelerado (1 segundo = alguns minutos), com respostas indo para o Atendimento */
function blRun(b) {
  const o = O(), org = o.id, s = b.stats;
  const tick = () => {
    if (b.status !== 'enviando' || S.org !== org) return;
    const n = Math.min(b.total - s.sent, Math.max(1, Math.round(b.perHour / 10)));
    for (let i = 0; i < n; i++) {
      const c = CT(b.ids[s.sent]); s.sent++;
      if (!c) { s.failed++; continue; }
      s.delivered++; if (Math.random() < 0.8) s.read++;
      if (s.sent % 4 === 2) {
        s.replied++;
        const tpl = (o.templates || []).find((t) => t.nm === b.tpl), first = c.nm.split(' ')[0];
        const cv = { id: 'cv' + uid(), c: c.id, inst: (o.instances[0] || {}).id, st: 'ia', unread: 1, t: nowT(), conf: 92, q: {}, af: {}, sugg: [], isNew: true,
          msgs: [{ f: 'sys', x: 'Disparo "' + b.nm + '"', t: nowT() }, { f: 'ia', x: tpl ? tpl.body.replace('{{1}}', first) : 'Oi, ' + first + '!', t: nowT() }, { f: 'lead', x: s.replied % 3 ? 'Pode contar sim' : 'Oi! Quero saber mais', t: nowT() }] };
        o.conversations.unshift(cv);
        o.metrics.ticker && o.metrics.ticker.unshift({ t: nowT(), x: '<b>' + esc(c.nm) + '</b> respondeu o disparo · ' + esc(o.ia.name) + ' atendendo' });
      }
      if (s.sent === 7 && b.total > 7) { s.optout++; c.noContact = true; }
    }
    if (s.sent >= b.total) { b.status = 'concluido'; toast('Disparo concluído', s.replied + ' pessoas responderam. A ' + o.ia.name + ' está atendendo.', '', 'CircleCheck'); }
    if (S.route === 'disparos') rerender();
    if (b.status === 'enviando') b.timer = setTimeout(tick, 900);
  };
  tick();
}
