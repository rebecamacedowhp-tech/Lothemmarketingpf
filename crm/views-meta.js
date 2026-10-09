/* LOTHEM Vendas — Meta pessoal: quanto cada pessoa quer ganhar e a rota até lá, passando pelo SDR e pelo Closer. */

const BIZ_LEFT = 17; // dias úteis de 08/10 a 30/10/2026

function liveMtd(o, s) {
  if (o.id === 'mkt') {
    const k = (nm) => { const x = o.metrics.kpis.find((y) => y.k === nm); return x ? parseInt(x.v, 10) : s.mtd; };
    if (s.k === 'diag') return k('Diagnósticos vendidos');
    if (s.k === 'cons') return k('Consultorias fechadas');
  }
  return s.mtd;
}

function routeCalc(o, uid) {
  const R = o.route, c = DB.comp[o.id] && DB.comp[o.id][uid];
  if (!R || !c) return null;
  let f = 1;
  const steps = R.steps.map((s) => { const st = Object.assign({}, s, { f }); f *= s.r != null ? s.r : 1; return st; });
  const unitPay = (s) => ((c.pay && c.pay[s.k]) || 0) + ((c.pct && c.pct[s.k]) ? c.pct[s.k] * (s.value || 0) : 0);
  const perTop = steps.reduce((a, s) => a + unitPay(s) * s.f, 0);
  const V = Math.max(0, c.wish - c.fixo);
  const top = perTop ? V / perTop : 0;
  steps.forEach((s) => {
    s.pay = unitPay(s);
    s.need = Math.ceil(top * s.f - 1e-9);
    s.mtd = liveMtd(o, s);
    s.proj = Math.round((s.mtd / DEMO_NOW.day) * DEMO_NOW.daysInMonth);
    s.left = Math.max(0, s.need - s.mtd);
    s.perDay = s.left / BIZ_LEFT;
    s.ok = s.proj >= s.need;
    s.contrib = s.pay * s.need;
  });
  const projIncome = c.fixo + steps.reduce((a, s) => a + s.pay * s.proj, 0);
  const lever = steps.filter((s) => s.pay > 0).sort((a, b) => b.contrib - a.contrib)[0] || null;
  return { c, R, V, steps, top, perTop, projIncome, lever, by: (k) => steps.find((s) => s.k === k) };
}

VIEWS.meta = {
  title: 'Meta pessoal',
  crumb: 'Inteligência',
  render() {
    const o = O(), comps = DB.comp[o.id] || {};
    const people = Object.keys(comps).filter((id) => U(id));
    if (!o.route || !people.length) {
      return `<div class="page-h"><div><h2>Meta pessoal</h2><p>Defina a forma de remuneração da equipe desta organização para liberar o cálculo da rota.</p></div></div><div class="pn"><div class="empty">${ic('Wallet')}<div>Ainda não há funil com taxas suficientes nesta organização.</div></div></div>`;
    }
    if (!comps[S.metaUser]) S.metaUser = comps[DB.me] ? DB.me : people[0];
    const uid = S.metaUser, u = U(uid), rc = routeCalc(o, uid), c = rc.c, R = rc.R;
    const isMe = uid === DB.me, canEdit = ME().role === 'Proprietária' || ME().role === 'Gestor';
    const projP = pct(rc.projIncome, c.wish), gap = Math.max(0, c.wish - rc.projIncome);
    const leads = rc.steps[0], invest = leads.need * R.cpl;
    const fields = [];
    Object.keys(c.pay || {}).forEach((k) => fields.push({ kind: 'pay', k, lbl: 'R$ por ' + (rc.by(k) ? rc.by(k).one || rc.by(k).nm.toLowerCase() : k), v: c.pay[k] }));
    Object.keys(c.pct || {}).forEach((k) => fields.push({ kind: 'pct', k, lbl: '% sobre ' + (rc.by(k) ? rc.by(k).nm.toLowerCase() : k), v: +(c.pct[k] * 100).toFixed(1) }));

    return `
    <div class="page-h"><div><h2>Meta pessoal</h2><p>Quanto ${isMe ? 'você quer' : esc(u.short) + ' quer'} ganhar por mês e o caminho até lá. A conta parte da forma de remuneração e das taxas reais do funil, e mostra o que depende do SDR e do Closer.</p></div>
      <div class="acts"><button class="btn" data-act="metaChallenge">${ic('Swords', 'sm')}Virar desafio pessoal</button><button class="btn pri" data-act="metaSave">${ic('Check', 'sm')}Salvar meta</button></div></div>
    <div class="row wrap between" style="gap:10px;margin-bottom:16px">
      <div class="chips" role="tablist" aria-label="Pessoa">${people.map((id) => { const p = U(id), r = routeCalc(o, id); return `<button class="chip ${id === uid ? 'on' : ''}" data-act="metaUser" data-id="${id}" role="tab" aria-selected="${id === uid}" style="height:36px;padding-left:5px">${av(p, 's')}${esc(p.short)}<span class="n">${fmt(pct(r.projIncome, r.c.wish), 0)}%</span></button>`; }).join('')}</div>
      <span class="dim" style="font-size:12px">${ic('Lock', 'xs')} ${ME().role === 'Proprietária' ? 'Como proprietária, você vê e ajusta a meta de todos. Cada pessoa vê só a própria.' : 'Só você e a gestão veem esta meta.'}</span>
    </div>

    <div class="grid g-12">
      <section class="pn hud gold-edge s-5"><div class="pn-h"><span class="pn-t">${ic('Wallet')}Quanto ${isMe ? 'quero' : 'quer'} ganhar</span>${pill(projP >= 100 ? 'No ritmo' : 'Faltam ' + brl(gap), projP >= 100 ? 'ok' : 'warn')}</div>
        <div class="pn-b col" style="gap:14px">
          <div class="row" style="gap:12px">${av(u, 'l')}<div><b>${esc(u.name)}</b><div class="dim" style="font-size:12px">${esc(u.role)} · ${esc(c.label.toLowerCase())} desejado por mês</div></div></div>
          <div class="money-wrap"><span>R$</span><input class="in money-in num" id="mpWish" inputmode="numeric" value="${fmt(c.wish)}" data-inp="mpWish" aria-label="${esc(c.label)} desejado por mês"></div>
          <input type="range" id="mpRange" min="1000" max="40000" step="250" value="${c.wish}" data-inp="mpRange" aria-label="Ajustar valor desejado">
          <div class="score">${ring(projP, 74, 7, projP >= 100 ? 'var(--ok)' : 'var(--gold)', fmt(Math.min(projP, 999), 0) + '%')}<div><span class="lbl">No ritmo de outubro</span><div style="font:600 20px/1.2 var(--f-display);margin-top:4px" class="num">${brl(rc.projIncome)}</div><div class="${projP >= 100 ? 'ok' : 'warn'}" style="font-size:12.5px">${projP >= 100 ? 'O ritmo atual já paga essa meta.' : 'Faltam ' + brl(gap) + ' por mês no ritmo atual.'}</div></div></div>
          <hr class="sep">
          <div class="row between"><span class="lbl">Como ${isMe ? 'você ganha' : esc(u.short) + ' ganha'}</span>${canEdit ? '' : pill('Definido pela gestão', 'line')}</div>
          <p class="muted" style="font-size:12.5px">${esc(c.note)}</p>
          <div class="form-g">
            <div class="field"><label for="mpFixo">Fixo (R$)</label><input class="in num" id="mpFixo" inputmode="numeric" value="${fmt(c.fixo)}" data-inp="mpComp" data-kind="fixo" ${canEdit ? '' : 'disabled'}></div>
            ${fields.map((x) => `<div class="field"><label for="mp-${x.kind}-${x.k}">${esc(x.lbl)}</label><input class="in num" id="mp-${x.kind}-${x.k}" inputmode="decimal" value="${String(x.v).replace('.', ',')}" data-inp="mpComp" data-kind="${x.kind}" data-k="${x.k}" ${canEdit ? '' : 'disabled'}></div>`).join('')}
          </div>
          <div class="r-stat" style="font-size:13px">Fixo <b class="num">${brl(c.fixo)}</b> + variável necessário <b class="num gold">${brl(rc.V)}</b>${rc.lever ? `<div class="dim" style="font-size:12px;margin-top:4px">Maior alavanca: <b>${esc(rc.lever.nm.toLowerCase())}</b>, ${brl(rc.lever.pay, rc.lever.pay % 1 ? 2 : 0)} cada.</div>` : ''}</div>
        </div></section>

      <section class="pn s-7"><div class="pn-h"><span class="pn-t">${ic('Route')}Rota até ${brl(c.wish)}</span><span class="dim" style="font-size:12px">${BIZ_LEFT} dias úteis até 30/10</span></div>
        <div class="pn-b"><div class="rt">
          ${rc.steps.map((s, i) => `<div class="rt-step ${s.pay > 0 ? 'lever' : ''} ${s.ok ? 'ok' : ''}">
            <div class="rt-node">${ic(s.ic, 'sm')}</div>
            <div class="rt-body">
              <div class="row wrap between" style="gap:6px"><div class="row" style="gap:8px"><b>${esc(s.nm)}</b><div class="av-stack">${s.who.map((w) => av(w, 's')).join('')}</div></div>
                <div class="row" style="gap:6px">${s.pay > 0 ? pill((isMe ? 'Sua' : 'Alavanca') + ' · ' + brl(s.pay, s.pay % 1 ? 2 : 0) + ' cada', 'gold mono') : ''}${pill(s.ok ? 'No ritmo' : 'Faltam ' + fmt(Math.max(0, s.need - s.proj)), s.ok ? 'ok' : 'warn')}</div></div>
              <div class="rt-kv"><div><span class="lbl">Precisa no mês</span><b class="num">${fmt(s.need)}</b></div><div><span class="lbl">Feito até hoje</span><b class="num">${fmt(s.mtd)}</b></div><div><span class="lbl">Por dia útil</span><b class="num">${s.left ? fmt(s.perDay, s.perDay < 10 ? 1 : 0) : '—'}</b></div></div>
              ${bar(pct(s.mtd, s.need || 1), s.pay > 0 ? 'gold thin' : 'thin', (DEMO_NOW.day / DEMO_NOW.daysInMonth) * 100)}
            </div></div>
            ${s.r != null ? `<div class="rt-conv">${ic('ArrowDown', 'xs')} ${fmt(s.r * 100, 1)}% ${esc(s.verb)}</div>` : ''}`).join('')}
        </div>
        <p class="dim" style="font-size:12px;margin-top:12px">${esc(R.rateNote)}. Investimento estimado no Meta para essa rota: <b class="num">${brl(invest)}</b> (${fmt(leads.need)} leads × CPL ${brl(R.cpl, 2)}).</p></div></section>

      <section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('Handshake')}Combinado com o SDR e o Closer</span><span class="dim" style="font-size:12px">ninguém bate meta pessoal sozinho</span></div>
        <div class="pn-b grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">${partnerCard(o, rc, 'sdr', uid)}${partnerCard(o, rc, 'closer', uid)}</div></section>
    </div>`;
  },
};

function partnerCard(o, rc, kind, viewer) {
  const R = rc.R, who = U(R[kind]), step = rc.by(R[kind + 'Step']), prep = kind === 'closer' ? rc.by(R.closerPrep) : null;
  const you = who.id === viewer;
  const role = kind === 'sdr' ? 'SDR' : 'Closer';
  const goal = o.id === 'mkt' && who.kpi && ((kind === 'sdr' && step.k === 'diag') || (kind === 'closer' && step.k === 'cons')) ? who.kpi.goal : null;
  let advice;
  if (step.ok) advice = `<div class="row top-a ok" style="font-size:13px">${ic('CircleCheck', 'sm')}<span>No ritmo atual ${you ? 'você entrega' : esc(who.short) + ' entrega'} ${fmt(step.proj)} no mês. Isso cobre a rota.</span></div>`;
  else if (kind === 'sdr') {
    const extra = step.need - step.proj, fromLeads = step.f / rc.steps[0].f;
    const moreLeads = Math.ceil(extra / fromLeads), cost = moreLeads * R.cpl, outb = extra * R.outbound;
    advice = `<div class="col" style="gap:6px;font-size:13px"><div class="row top-a warn">${ic('TriangleAlert', 'sm')}<span>Faltam <b>${fmt(extra)}</b> além do ritmo atual (${fmt(step.proj)}).</span></div><div class="muted">Dois caminhos: <b>+${fmt(moreLeads)} leads</b> no Meta (≈ ${brl(cost)} a mais de anúncio) ou <b>≈ ${fmt(outb)} abordagens</b> outbound (1 a cada ${R.outbound}).</div></div>`;
  } else {
    const needRate = prep && prep.proj ? Math.min(99, (step.need / prep.proj) * 100) : 0;
    advice = `<div class="col" style="gap:6px;font-size:13px"><div class="row top-a warn">${ic('TriangleAlert', 'sm')}<span>Faltam <b>${fmt(step.need - step.proj)}</b> além do ritmo atual (${fmt(step.proj)}).</span></div>${prep ? `<div class="muted">Com ${fmt(prep.proj)} ${esc(prep.nm.toLowerCase())} no ritmo, a taxa de fechamento teria de subir de ${fmt(prep.r * 100, 1)}% para <b>${fmt(needRate, 1)}%</b>. A outra saída é o SDR entregar mais.</div>` : ''}</div>`;
  }
  return `<div class="r-stat col" style="gap:10px;padding:14px">
    <div class="row between"><div class="row">${av(who, 'l')}<div><b>${you ? 'Sua parte' : esc(who.name)}</b><div class="dim" style="font-size:12px">${role}${kind === 'sdr' ? ' · com a ' + esc(o.ia.name) + ' (IA)' : ''}</div></div></div>${goal ? pill('Meta do time: ' + goal, 'line mono') : ''}</div>
    <div class="row wrap" style="gap:16px">
      <div><span class="lbl">${esc(step.nm)}</span><div style="font:600 22px/1.2 var(--f-display)" class="num">${fmt(step.need)}<span class="dim" style="font-size:13px;font-weight:500"> no mês</span></div><div class="dim" style="font-size:12px">${step.left ? fmt(step.perDay, 1) + ' por dia útil' : 'meta do mês já batida'}</div></div>
      ${prep ? `<div><span class="lbl">${esc(prep.nm)}</span><div style="font:600 22px/1.2 var(--f-display)" class="num">${fmt(prep.need)}<span class="dim" style="font-size:13px;font-weight:500"> no mês</span></div><div class="dim" style="font-size:12px">${prep.left ? fmt(prep.perDay, 1) + ' por dia útil' : 'já garantidas'}</div></div>` : ''}
    </div>
    ${goal && step.need > goal ? `<div class="row top-a" style="padding:8px 10px;border-radius:8px;background:var(--gold-soft);font-size:12.5px"><span class="gold">${ic('Info', 'sm')}</span><span>Essa rota pede ${fmt(step.need - goal)} a mais que a meta do time (${goal}). Vale alinhar na próxima reunião.</span></div>` : ''}
    ${advice}
    ${you ? '' : `<button class="btn sm" data-act="metaSend" data-u="${who.id}" data-step="${step.k}">${ic('Send', 'xs')}Enviar rota para ${esc(who.short)}</button>`}
  </div>`;
}

const metaComp = () => DB.comp[S.org][S.metaUser];
ACT.metaUser = (el) => { S.metaUser = el.dataset.id; rerender(); };
INP.mpWish = (el) => { const n = parseInt(el.value.replace(/\D/g, ''), 10) || 0; metaComp().wish = Math.min(n, 999999); rerender(); markGuide('meta'); };
INP.mpRange = (el) => { metaComp().wish = +el.value; rerender(); markGuide('meta'); };
INP.mpComp = (el) => {
  const c = metaComp(), raw = el.value.replace(/\./g, '').replace(',', '.'), n = parseFloat(raw) || 0;
  if (el.dataset.kind === 'fixo') c.fixo = n;
  else if (el.dataset.kind === 'pay') c.pay[el.dataset.k] = n;
  else c.pct[el.dataset.k] = n / 100;
  rerender();
};
ACT.metaSave = () => {
  const u = U(S.metaUser), c = metaComp();
  toast('Meta salva', (S.metaUser === DB.me ? 'Sua meta' : 'A meta de ' + u.short) + ' de ' + brl(c.wish) + ' aparece na Central e na Evolução.', '', 'Wallet');
  markGuide('meta');
};
ACT.metaSend = (el) => {
  const o = O(), rc = routeCalc(o, S.metaUser), to = U(el.dataset.u), s = rc.by(el.dataset.step), me = ME();
  let dm = o.dms.find((d) => d.u === to.id);
  if (!dm) { dm = { id: 'dm-' + to.id, u: to.id, unread: 0, msgs: [{ day: 'Hoje' }] }; o.dms.push(dm); }
  const whose = S.metaUser === DB.me ? 'minha meta' : 'a meta de ' + U(S.metaUser).short;
  dm.msgs.push({ u: me.id, t: nowT(), x: 'Tracei ' + whose + ' de ' + brl(rc.c.wish) + ' por mês. Pra chegar lá, a rota pede ' + fmt(s.need) + ' ' + s.nm.toLowerCase() + ' em outubro (' + fmt(s.perDay, 1) + ' por dia útil daqui pra frente). Fechamos juntos?' });
  setTimeout(() => { dm.msgs.push({ u: to.id, t: nowT(), x: 'Fechado. Vou acompanhar pela Meta pessoal.' }); if (S.route === 'chat') rerender(); }, 1800);
  toast('Rota enviada para ' + to.short, 'Mensagem direta no chat da equipe.', '', 'Send');
  markGuide('meta');
};
ACT.metaChallenge = () => {
  const o = O(), rc = routeCalc(o, S.metaUser), s = rc.lever || rc.steps[rc.steps.length - 1], u = U(S.metaUser);
  const id = 'chm-' + S.org + '-' + u.id;
  let ch = DB.game.challenges.find((x) => x.id === id);
  const d = 'Chegar a ' + fmt(s.need) + ' ' + s.nm.toLowerCase() + ' em outubro para ganhar ' + brl(rc.c.wish) + '.';
  if (!ch) { ch = { id, nm: 'Rota do salário · ' + u.short, scope: 'Individual', who: u.id, d, v: s.mtd, goal: s.need, xp: 250, left: '24 dias', go: 'meta', joined: true }; DB.game.challenges.unshift(ch); }
  else Object.assign(ch, { d, v: s.mtd, goal: s.need });
  toast('Desafio criado', ch.nm + ' · +250 XP ao concluir. Está na aba Evolução.', 'xp', 'Swords');
  markGuide('meta');
};
