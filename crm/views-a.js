/* LOTHEM Vendas — telas comerciais: Central, Atendimento (com simulação da SDR IA), Funis, Contatos e Tarefas. */

/* =========================================================
   CENTRAL
   ========================================================= */
function computeAlerts(o) {
  const out = [];
  o.conversations.forEach((c) => {
    const si = slaInfo(c, o), nm = CT(c.c).nm;
    if (si) out.push({ cls: si.state === 'bad' ? 'bad' : 'warn', ic: 'Timer', t: si.state === 'bad' ? nm + ' está sem resposta e passou do SLA' : nm + ' precisa de resposta em ' + Math.max(1, Math.ceil(si.left / 60)) + ' min', go: 'atendimento', cv: c.id });
    else if (c.st === 'espera') out.push({ cls: 'bad', ic: 'UserCheck', t: nm + ' espera atendimento humano', go: 'atendimento', cv: c.id });
  });
  o.instances.filter((i) => i.st === 'off').forEach((i) => out.push({ cls: 'warn', ic: 'WifiOff', t: 'Instância "' + i.nm + '" desconectada', go: 'canais' }));
  const late = o.tasks.filter((t) => !t.done && t.due < 0).length;
  if (late) out.push({ cls: 'warn', ic: 'Clock', t: late + (late > 1 ? ' tarefas atrasadas' : ' tarefa atrasada'), go: 'tarefas' });
  if (o.reviews.length) out.push({ cls: 'cy', ic: 'GraduationCap', t: o.reviews.length + ' respostas da ' + o.ia.name + ' esperam revisão', go: 'sdr', tab: 'rev' });
  if (o.ia.mode === 'cop') out.push({ cls: 'cy', ic: 'ShieldCheck', t: 'Modo copiloto: a ' + o.ia.name + ' sugere e a equipe envia', go: 'sdr' });
  return out;
}
const byAt = (a, b) => (a.due - b.due) || a.at.localeCompare(b.at);

function reactor(p, pace) {
  const cx = 110, r = 80, c = 2 * Math.PI * r;
  let ticks = '';
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * 2 * Math.PI, long = k % 6 === 0;
    const r1 = long ? 96 : 99, r2 = 104;
    ticks += '<line x1="' + (cx + r1 * Math.sin(a)).toFixed(1) + '" y1="' + (cx - r1 * Math.cos(a)).toFixed(1) + '" x2="' + (cx + r2 * Math.sin(a)).toFixed(1) + '" y2="' + (cx - r2 * Math.cos(a)).toFixed(1) + '" stroke="var(--cy)" stroke-opacity="' + (long ? 0.55 : 0.2) + '" stroke-width="1"/>';
  }
  const pa = (pace / 100) * 2 * Math.PI;
  const pm = '<line x1="' + (cx + 66 * Math.sin(pa)).toFixed(1) + '" y1="' + (cx - 66 * Math.cos(pa)).toFixed(1) + '" x2="' + (cx + 93 * Math.sin(pa)).toFixed(1) + '" y2="' + (cx - 93 * Math.cos(pa)).toFixed(1) + '" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"/>';
  return '<svg viewBox="0 0 220 220" role="img" aria-label="Meta do mês: ' + fmt(p, 1) + '% concluída">' +
    '<defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--cy-2)"/><stop offset="1" stop-color="var(--cy)"/></linearGradient></defs>' +
    '<g class="spin-r">' + ticks + '</g>' +
    '<circle class="spin" cx="110" cy="110" r="90" fill="none" stroke="var(--cy)" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 7"/>' +
    '<circle cx="110" cy="110" r="' + r + '" fill="none" stroke="var(--panel-3)" stroke-width="12"/>' +
    '<circle cx="110" cy="110" r="' + r + '" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + ((c * Math.min(p, 100)) / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 110 110)" style="filter:drop-shadow(0 0 6px var(--cy-glow))"/>' +
    pm + '<circle cx="110" cy="110" r="62" fill="none" stroke="var(--line-2)" stroke-width="1"/></svg>';
}

VIEWS.central = {
  title: 'Central',
  crumb: 'Comando',
  render() {
    const o = O(), m = o.metrics, me = ME(), li = lvlInfo(me), G = DB.game, tab = S.tabs.central || 'hoje';
    const p = pct(m.done, m.goal), pace = (DEMO_NOW.day / DEMO_NOW.daysInMonth) * 100;
    const proj = (m.done / DEMO_NOW.day) * DEMO_NOW.daysInMonth, daysLeft = DEMO_NOW.daysInMonth - DEMO_NOW.day;
    const need = Math.max(0, m.goal - m.done) / daysLeft;
    const today = o.tasks.filter((t) => t.due === 0 && !t.done).sort(byAt);
    const alerts = computeAlerts(o), top = alerts[0];
    const onPace = p >= pace;
    const isCred = S.org === 'cred';
    const nextIdx = today.findIndex((t) => t.at >= DEMO_NOW.time);
    const pick = isCred ? m.kpis.slice(0, 4) : ['Leads do Meta', 'Diagnósticos vendidos', 'Comparecimento', 'Consultorias fechadas'].map((k) => m.kpis.find((x) => x.k === k)).filter(Boolean);
    const kpis = (pick.length ? pick : m.kpis).slice(0, 4);
    const tabs = [['hoje', 'Hoje', 'Sun'], ['analise', 'Análise', 'ChartLine'], ['equipe', 'Equipe e IA', 'Users']];
    let body = '';

    if (tab === 'hoje') {
      const r = typeof routeCalc === 'function' ? routeCalc(o, DB.me) : null;
      const pp = r ? pct(r.projIncome, r.c.wish) : 0;
      body = `<div class="grid g-12">
        <section class="pn hud s-6">
          <div class="pn-h"><span class="pn-t">${ic('Target')}${esc(m.goalLabel)}</span>${pill(onPace ? 'No ritmo' : 'Abaixo do ritmo', onPace ? 'ok' : 'warn')}</div>
          <div class="reactor">
            <div class="reactor-svg" title="O traço dourado marca onde você deveria estar hoje (${fmt(pace, 0)}%)">${reactor(p, pace)}<div class="reactor-c"><div><div class="big num">${fmt(p, 0)}<small>%</small></div><div class="sub">da meta</div></div></div></div>
            <div class="reactor-info">
              <div class="muted">Fechado até hoje</div>
              <div class="money num">${brl(m.done)}<span>de ${brlK(m.goal)}</span></div>
              <div class="r-pair">
                <div><span class="lbl">Projeção</span><b class="num ${proj >= m.goal ? 'ok' : 'warn'}">${brlK(proj)}</b></div>
                <div><span class="lbl">Por dia</span><b class="num">${brlK(need)}</b></div>
              </div>
              <div class="dim" style="font-size:13px">${daysLeft} dias até o fim do mês</div>
            </div>
          </div>
        </section>
        <div class="s-6 kpis two">
          ${kpis.map((k) => `<button class="pn kpi" data-go="${k.go}">
            <span class="kpi-l">${esc(k.k)}</span>
            <span class="v num">${k.v}${k.unit ? `<small>${k.unit}</small>` : ''}${k.sub ? `<small> ${k.sub}</small>` : ''}</span>
            <span class="ft"><span class="ellipsis">${esc(k.hint)}</span>${delta(k.delta, k.invert)}</span>
          </button>`).join('')}
        </div>
        <section class="pn s-7">
          <div class="pn-h"><span class="pn-t">${ic('CalendarDays')}Agenda de hoje</span><button class="btn sm ghost" data-go="tarefas">Ver tarefas</button></div>
          <div class="pn-b flush">
            ${today.length ? today.slice(0, 5).map((t, i) => `<div class="agenda-i ${i === nextIdx ? 'now' : ''}">
              <time class="num">${t.at}</time>
              <div style="min-width:0"><div class="ellipsis" style="font-weight:500">${esc(t.t)}</div><div class="dim" style="font-size:13px">${esc(U(t.who).short)}${i === nextIdx ? ' · próximo' : ''}</div></div>
              ${t.deal ? `<button class="btn sm" data-act="openDeal" data-id="${t.deal}">Abrir</button>` : `<button class="btn sm" data-go="${t.go || 'tarefas'}">Ir</button>`}
            </div>`).join('') : `<div class="empty">${ic('CalendarCheck')}<div>Nada marcado para hoje.</div></div>`}
            ${today.length > 5 ? `<div class="more-row"><button class="btn sm ghost" data-go="tarefas">Mais ${today.length - 5} hoje</button></div>` : ''}
          </div>
        </section>
        <section class="pn gold-edge s-5">
          <div class="pn-h"><span class="pn-t">${ic('Trophy')}Você</span><button class="btn sm ghost" data-go="evolucao">Evolução</button></div>
          <div class="pn-b col" style="gap:20px">
            <div class="row" style="gap:14px"><div class="hex" style="width:54px;height:62px">${hexFrame()}<span class="n" style="font-size:20px">${li.L}</span></div>
              <div class="grow"><b>Nível ${li.L} · ${li.tier}</b><div class="dim" style="font-size:13px;margin:2px 0 8px">Faltam ${fmt(li.left)} XP para o próximo</div>${bar(li.p, 'gold')}</div></div>
            ${r ? `<button class="col" data-go="meta" style="gap:8px;text-align:left"><span class="row between"><span class="muted">Meta pessoal</span><b class="num">${fmt(pp, 0)}%</b></span>${bar(pp, pp >= 100 ? 'ok' : 'gold')}<span class="dim" style="font-size:13px">${brl(r.projIncome)} no ritmo, de ${brl(r.c.wish)}</span></button>` : ''}
          </div>
        </section>
      </div>`;
    } else if (tab === 'analise') {
      const f0 = m.funnel[0].v || 1;
      const cols = m.campaignCols || ['Qualif.', 'Diagn.', 'Consult.'];
      const tot = m.campaigns.reduce((a, c) => ({ inv: a.inv + c.inv, leads: a.leads + c.leads, q: a.q + c.q, d: a.d + c.d, c: a.c + c.c }), { inv: 0, leads: 0, q: 0, d: 0, c: 0 });
      const bestCost = Math.min(...m.campaigns.map((c) => (c.d ? c.inv / c.d : Infinity)));
      body = `<div class="grid g-12">
        <section class="pn s-12">
          <div class="pn-h"><span class="pn-t">${ic('Filter')}Funil · últimos 30 dias</span><button class="btn sm ghost" data-go="funis">Abrir funis</button></div>
          <div class="pn-b"><div class="funnel">
            ${m.funnel.map((f, i) => `<div class="fn-row">
              <div class="nm"><b class="num">${fmt(f.v)}</b>${esc(f.nm)}</div>
              <div class="fn-bar ${f.gold ? 'gold' : ''}"><i style="width:${Math.max(2, pct(f.v, f0)).toFixed(1)}%"></i></div>
              <div class="fn-conv num">${i ? fmt(pct(f.v, m.funnel[i - 1].v), 1) + '%' : ''}</div>
            </div>`).join('')}
          </div><p class="dim" style="font-size:13px;margin-top:16px">${esc(m.funnelNote)}</p></div>
        </section>
        <section class="pn s-12">
          <div class="pn-h"><span class="pn-t">${ic('ChartLine')}${esc(m.series.la)} por dia · 30 dias</span>
            <div class="legend"><span><i style="background:var(--cy)"></i>${esc(m.series.la)}</span><span><i style="background:var(--gold)"></i>${esc(m.series.lb)}</span></div></div>
          <div class="pn-b">${areaChart(m.series.a, m.series.b, { start: m.series.start, label: m.series.la + ' por dia nos últimos 30 dias' })}</div>
        </section>
        <section class="pn s-12">
          <div class="pn-h"><span class="pn-t">${ic('Megaphone')}Campanhas do Meta · 30 dias</span></div>
          <div class="pn-b">
            ${!m.campaigns.length ? `<div class="empty">${ic('Megaphone')}<div>Nenhuma campanha conectada ainda.</div></div>` : `
            <div class="insight">${ic('Lightbulb', 'sm')}<span>${esc(m.insight)}</span></div>
            <div class="tbl-w"><table class="tbl">
              <thead><tr><th>Campanha</th><th class="r">Invest.</th><th class="r">Leads</th><th class="r">CPL</th><th class="r">${cols[0]}</th><th class="r">${cols[1]}</th><th class="r">Custo por ${m.costLabel || (isCred ? 'proposta' : 'diagn.')}</th><th class="r">${cols[2]}</th></tr></thead>
              <tbody>${m.campaigns.map((c) => { const cost = c.d ? c.inv / c.d : null; return `<tr><td style="min-width:220px">${esc(c.nm)}</td><td class="r num">${brl(c.inv)}</td><td class="r num">${c.leads}</td><td class="r num">${brl(c.inv / c.leads, 2)}</td><td class="r num">${c.q}</td><td class="r num">${c.d}</td><td class="r num ${cost === bestCost ? 'ok' : ''}">${cost ? brl(cost, 2) : '—'}</td><td class="r num">${c.c}</td></tr>`; }).join('')}</tbody>
              <tfoot><tr><td>Total</td><td class="r num">${brl(tot.inv)}</td><td class="r num">${tot.leads}</td><td class="r num">${brl(tot.inv / tot.leads, 2)}</td><td class="r num">${tot.q}</td><td class="r num">${tot.d}</td><td class="r num">${brl(tot.inv / tot.d, 2)}</td><td class="r num">${tot.c}</td></tr></tfoot>
            </table></div>`}
          </div>
        </section>
      </div>`;
    } else {
      const live = o.conversations.filter((c) => c.st === 'ia' || c.st === 'aguardando').length;
      const espera = o.conversations.filter((c) => c.st === 'espera').length;
      const ch = G.challenges.find((x) => x.id === 'ch1');
      const squads = squadScores();
      body = `<div class="grid g-12">
        <section class="pn s-6">
          <div class="pn-h"><span class="pn-t">${ic('Bot')}${esc(o.ia.name)} agora</span><span class="pill ok"><span class="dot live"></span>${o.ia.mode === 'cop' ? 'Sugerindo' : 'Atendendo'}</span></div>
          <div class="pn-b col" style="gap:20px">
            <div class="live-ia">
              <button class="c" data-go="atendimento"><span class="lbl">Com a IA</span><div class="v num">${live}</div></button>
              <button class="c" data-go="atendimento"><span class="lbl">Esperando você</span><div class="v num ${espera ? 'bad' : ''}">${espera}</div></button>
              <button class="c" data-go="sdr" data-tab="rev"><span class="lbl">Para revisar</span><div class="v num">${o.reviews.length}</div></button>
              <div class="c"><span class="lbl">1ª resposta</span><div class="v num">${m.ia.resp}</div></div>
            </div>
            <div class="ticker">${m.ticker.slice(0, 4).map((t) => `<div class="tk"><time>${t.t}</time><span class="${t.cls || ''}">${t.x}</span></div>`).join('')}</div>
          </div>
        </section>
        <section class="pn s-6">
          <div class="pn-h"><span class="pn-t">${ic('Users')}Squads · % da meta</span><button class="btn sm ghost" data-go="evolucao" data-tab="ranking">Ranking</button></div>
          <div class="pn-b col" style="gap:22px">
            ${squads.map((s) => `<div class="col" style="gap:8px"><div class="row between"><span>${esc(s.nm)}</span><b class="num">${fmt(s.p, 0)}%</b></div>${bar(s.p, s.color === 'gold' ? 'gold' : '', pace)}</div>`).join('')}
            ${ch ? `<button class="col challenge-mini" data-go="${ch.go}" data-tab="${ch.go === 'sdr' ? 'rev' : ''}"><span class="row between"><span class="muted">Desafio: ${esc(ch.nm)}</span><span class="pill gold mono">+${ch.xp} XP</span></span><b class="num">${ch.v} de ${ch.goal}</b>${bar(pct(ch.v, ch.goal), 'gold thin')}</button>` : ''}
          </div>
        </section>
      </div>`;
    }

    return `
    <div class="page-h">
      <div><h2>Bom dia, ${esc(me.short)}</h2><p>${DEMO_NOW.label}</p></div>
      <div class="acts">${S.org === 'mkt' || S.org === 'cred' ? `<button class="btn pri" data-act="simLead">${ic('Zap', 'sm')}${S.org === 'cred' ? 'Simular lead do teste' : 'Simular lead do Meta'}</button>` : ''}</div>
    </div>
    ${top ? `<div class="next-act na-${top.cls}">
      <span class="ico-box ${top.cls}">${ic(top.ic)}</span>
      <div class="grow"><span class="lbl">Próxima ação</span><div class="t">${esc(top.t)}</div></div>
      <button class="btn pri" data-go="${top.go}"${top.cv ? ` data-cv="${top.cv}"` : ''}${top.tab ? ` data-tab="${top.tab}"` : ''}>Resolver</button>
    </div>
    ${alerts.length > 1 ? `<div class="more-alerts"><button class="btn sm ghost" data-act="toggleAlerts" aria-expanded="${!!S.showAlerts}">${S.showAlerts ? 'Esconder' : 'Ver'} ${alerts.length - 1} ${alerts.length - 1 > 1 ? 'outros avisos' : 'outro aviso'} ${ic(S.showAlerts ? 'ChevronUp' : 'ChevronDown', 'xs')}</button>
      ${S.showAlerts ? `<div class="alert-list">${alerts.slice(1).map((a) => `<button class="alert-i" data-go="${a.go}"${a.cv ? ` data-cv="${a.cv}"` : ''}${a.tab ? ` data-tab="${a.tab}"` : ''}><span class="dot ${a.cls === 'cy' ? 'cy' : a.cls}"></span><span class="grow">${esc(a.t)}</span>${ic('ChevronRight', 'xs dim')}</button>`).join('')}</div>` : ''}</div>` : ''}` : ''}
    <div class="tabs" role="tablist">${tabs.map(([id, nm, icn]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="central:${id}" role="tab" aria-selected="${tab === id}">${ic(icn, 'sm')}${nm}</button>`).join('')}</div>
    ${body}`;
  },
};
ACT.toggleAlerts = () => { S.showAlerts = !S.showAlerts; rerender(); };

function squadScores() {
  return Object.entries(DB.squads).map(([id, s]) => {
    const us = DB.users.filter((u) => u.squad === id);
    const p = us.reduce((a, u) => a + pct(u.kpi.v, u.kpi.goal), 0) / (us.length || 1);
    return { id, nm: s.name, color: s.color, p, members: us };
  });
}

/* =========================================================
   ATENDIMENTO
   ========================================================= */
const SUGG = {
  cv7: ['Oi, Juliana! Aqui é a Rebeca. Vi tudo o que você contou pra Cibelle, não precisa repetir.', 'Posso te ligar agora, em 5 minutos?', 'Prefere falar por áudio ou por ligação?'],
  cv8: ['Te mando o link agora! Sobre valor: depende do que fizer sentido pra oficina. Posso entender primeiro como o cliente novo chega hoje?', 'A prévia é por nossa conta. Se gostar, a gente conversa sobre o resto.'],
  cv4: ['Combinado, Ana! Qualquer dúvida antes de sexta, me chama por aqui.'],
  cv5: ['Felipe, convite enviado para sexta às 16h. Se o Prado tiver alguma pergunta antes, pode mandar.'],
  cx1: ['Entendi, Paulo. E a compra dos caminhões seria para quando?', 'Boa! Pra eu te ajudar melhor: a transportadora tem quanto tempo de CNPJ?'],
  cx2: ['Simone, a análise andou. Consigo te dar retorno amanhã cedo.'],
  pv1: ['Entendi, Luciana. Quitar o cartão costuma fazer sentido, porque os juros do rotativo são altos. Você sabe mais ou menos quanto está devendo hoje?', 'Faz sentido. Pra montar a simulação preciso de 3 informações rápidas. Posso te perguntar?'],
};
const CV_FILTERS = [
  { id: 'todas', nm: 'Abertas', f: (c) => c.st !== 'encerrada' },
  { id: 'voce', nm: 'Para você', f: (c) => { if (c.st === 'encerrada') return false; return c.st === 'espera' || !!slaInfo(c) || (c.who === DB.me && c.unread > 0); } },
  { id: 'ia', nm: 'Com a IA', f: (c) => c.st === 'ia' || c.st === 'aguardando' },
  { id: 'enc', nm: 'Encerradas', f: (c) => c.st === 'encerrada' },
];
const CV = (id) => O().conversations.find((c) => c.id === id);
const INST = (id) => O().instances.find((i) => i.id === id);
function cvStatus(cv) {
  const ia = O().ia.name;
  if (cv.st === 'ia') return { t: ia + ' atendendo', cls: 'cy', ic: 'Bot' };
  if (cv.st === 'aguardando') return { t: 'Aguardando o lead', cls: 'line', ic: 'Hourglass' };
  if (cv.st === 'espera') return { t: 'Esperando humano', cls: 'bad', ic: 'UserCheck' };
  if (cv.st === 'humano') return { t: cv.who === DB.me ? 'Com você' : 'Com ' + U(cv.who).short, cls: '', ic: 'User' };
  return { t: 'Encerrada', cls: 'line', ic: 'Archive' };
}
function instTag(inst) { return inst.type === 'oficial' ? pill('API oficial', 'cy mono') : pill('Não oficial', 'line mono'); }
function lastPreview(cv) {
  const m = [...cv.msgs].reverse().find((x) => x.f !== 'sys');
  if (!m) return 'Nova conversa';
  const pre = m.f === 'ia' ? O().ia.name + ': ' : m.f === 'user' ? (m.u === DB.me ? 'Você: ' : U(m.u).short + ': ') : m.f === 'note' ? 'Nota: ' : '';
  return pre + m.x.replace(/\n/g, ' ');
}
function mentionify(s) { return esc(s).replace(/@(\w+)/g, '<span class="mention">@$1</span>'); }
function msgHtml(m) {
  const ia = O().ia.name;
  if (m.f === 'sys') return `<div class="sys ${m.cls || ''}">${ic(m.cls === 'ok' ? 'CircleCheck' : m.cls === 'bad' ? 'CircleAlert' : m.cls === 'gold' ? 'Handshake' : 'Info', 'xs')}${esc(m.x)}<span class="dim">· ${m.t}</span></div>`;
  if (m.f === 'lead') return `<div class="msg lead">${esc(m.x)}<div class="meta">${m.t}</div></div>`;
  if (m.f === 'note') return `<div class="msg note"><div class="who">${ic('StickyNote', 'xs')}Nota interna · ${esc(U(m.u).short)} · só a equipe vê</div>${mentionify(m.x)}<div class="meta">${m.t}</div></div>`;
  const pay = m.pay ? `<div class="paycard"><span class="ico-box ${m.paid ? 'ok' : 'cy'}">${ic(m.paid ? 'CircleCheck' : 'QrCode')}</span><div class="grow"><b style="font-size:13px">${O().id === 'cred' ? 'Link Cakto' : 'Pix'} · ${esc(O().ia.offer)}</b><div class="dim" style="font-size:12px">${brl(O().ia.price)} · link válido por 24 h</div></div>${m.paid ? pill('Pago', 'ok') : pill('Aguardando', 'warn')}</div>` : '';
  if (m.f === 'ia') return `<div class="msg out"><div class="who">${ic('Bot', 'xs')}${esc(ia)} · IA</div>${esc(m.x)}${pay}<div class="meta">${m.t} ${ic('CheckCheck', 'xs')}</div></div>`;
  return `<div class="msg out hum"><div class="who">${esc(U(m.u).short)}${m.viaIa ? ' · sugerida pela ' + esc(ia) : ''}</div>${esc(m.x)}${pay}<div class="meta">${m.t} ${ic('CheckCheck', 'xs')}</div></div>`;
}

VIEWS.atendimento = {
  title: 'Atendimento',
  crumb: 'WhatsApp',
  full: true,
  render() {
    const o = O();
    const flt = CV_FILTERS.find((f) => f.id === S.cvFilter) || CV_FILTERS[0];
    const q = norm(S.filters.cvq || '');
    const list = o.conversations.filter(flt.f).filter((c) => !q || norm(CT(c.c).nm + ' ' + CT(c.c).co).includes(q));
    const nEnc = o.conversations.filter((c) => c.st === 'encerrada').length;
    let cv = CV(S.cv);
    if (!cv) { cv = o.conversations[0]; S.cv = cv ? cv.id : null; }
    return `<div class="inbox ${S.showThread ? 'show-thread' : ''} ${S.sideOpen ? 'side-open' : ''} ${S.sideHidden ? 'no-side' : ''}" id="inbox">
      <div class="ib-list">
        <div class="ib-list-h">
          <div class="row between"><h3 class="ib-title">Conversas</h3>
            <div class="row" style="gap:6px">${o.sla ? `<button class="iconbtn sm" data-go="equipe" data-tab="sla" title="SLA: transferência ${o.sla.transfer} min · retorno ${o.sla.retorno} min" aria-label="Configurar SLA">${ic('Timer', 'sm')}</button>` : ''}${S.org === 'mkt' || S.org === 'cred' ? `<button class="iconbtn sm" data-act="simLead" title="Simular lead do Meta" aria-label="Simular lead do Meta">${ic('Zap', 'sm')}</button>` : ''}</div></div>
          <div class="search">${ic('Search')}<input class="in" id="cvq" placeholder="Buscar" value="${esc(S.filters.cvq || '')}" data-inp="cvq" autocomplete="off" aria-label="Buscar conversa"></div>
          ${S.cvFilter === 'enc' ? `<button class="btn sm ghost" data-act="cvFilter" data-id="todas" style="align-self:flex-start">${ic('ArrowLeft', 'xs')}Voltar para as abertas</button>`
            : `<div class="seg seg-full">${CV_FILTERS.filter((f) => f.id !== 'enc').map((f) => { const n = o.conversations.filter(f.f).length; return `<button class="${S.cvFilter === f.id ? 'on' : ''}" data-act="cvFilter" data-id="${f.id}">${f.nm}${f.id === 'voce' && n ? ` <span class="seg-n">${n}</span>` : ''}</button>`; }).join('')}</div>`}
        </div>
        <div class="ib-items" data-keep-scroll="cvlist">
          ${list.length ? list.map((c) => { const ct = CT(c.c), st = cvStatus(c), si = slaInfo(c); return `<button class="cv ${c.id === S.cv ? 'on' : ''} ${c.isNew ? 'new' : ''}" data-act="selCv" data-id="${c.id}">
            ${contactAv(ct, 'l')}
            <span class="cv-main">
              <span class="row between"><span class="nm ellipsis">${esc(ct.nm)}</span>${c.isNew ? '' : `<time>${c.t}</time>`}</span>
              <span class="pv ellipsis">${esc(lastPreview(c))}</span>
              <span class="row between">${si ? slaChip(c) : `<span class="st-txt"><span class="dot ${st.cls === 'bad' ? 'bad' : st.cls === 'cy' ? 'cy' : ''}"></span>${esc(st.t)}</span>`}${c.unread ? `<span class="unr">${c.unread}</span>` : ''}</span>
            </span></button>`; }).join('') : `<div class="empty">${ic('Inbox')}<div>${S.cvFilter === 'voce' ? 'Nada esperando por você agora.' : 'Nenhuma conversa aqui.'}</div></div>`}
          ${S.cvFilter !== 'enc' && nEnc ? `<div class="more-row"><button class="btn sm ghost" data-act="cvFilter" data-id="enc">Ver encerradas (${nEnc})</button></div>` : ''}
        </div>
      </div>
      ${cv ? threadHtml(cv) : `<div class="ib-thread"><div class="empty" style="margin:auto">${ic('MessageCircle')}<div>Sem conversas ainda. Conecte um WhatsApp em Canais.</div></div></div>`}
      ${cv ? sideHtml(cv) : ''}
    </div>`;
  },
  after() { const b = $('#thBody'); if (b) b.scrollTop = b.scrollHeight; },
};

function threadHtml(cv) {
  const o = O(), ct = CT(cv.c), st = cvStatus(cv);
  const iaOn = cv.st === 'ia' || cv.st === 'aguardando';
  const typing = S.sim && S.sim.cv === cv.id && S.sim.typing;
  const sugg = SUGG[cv.id] || ['Oi, ' + ct.nm.split(' ')[0] + '! Aqui é a ' + ME().short + ', da Lothem. Vi tudo o que você contou.', 'Posso te ligar em 5 minutos?'];
  const cop = o.ia.mode === 'cop';
  const showS = S.showSugg != null ? S.showSugg : cop;
  let composer;
  if (cv.st === 'encerrada') {
    composer = `<div class="ia-bar calm">${ic('Archive', 'sm')}<span class="grow">Conversa encerrada.</span><button class="btn sm" data-act="reopenCv">Reabrir</button></div>`;
  } else if (iaOn && !S.noteMode) {
    composer = `<div class="ia-bar">${ic('Bot', 'sm cy')}<span class="grow"><b>${esc(o.ia.name)} está atendendo</b></span><button class="iconbtn sm" data-act="toggleNote" title="Escrever nota interna" aria-label="Escrever nota interna">${ic('StickyNote', 'sm')}</button><button class="btn pri" data-act="takeOver">Assumir</button></div>`;
  } else {
    composer = `${showS && !S.noteMode && sugg.length ? `<div class="sugg">${sugg.map((s, i) => `<button data-act="useSugg" data-i="${i}">${esc(s)}</button>`).join('')}</div>` : ''}
      <div class="comp-row">
        <button class="iconbtn" data-act="attach" aria-label="Anexar arquivo" title="Anexar">${ic('Paperclip', 'sm')}</button>
        <button class="iconbtn ${S.noteMode ? 'on-note' : ''}" data-act="setNote" data-v="${S.noteMode ? '0' : '1'}" aria-pressed="${!!S.noteMode}" title="${S.noteMode ? 'Voltar a responder o lead' : 'Nota interna: só a equipe vê'}" aria-label="Nota interna">${ic('StickyNote', 'sm')}</button>
        <textarea class="ta grow" id="msgIn" rows="1" placeholder="${S.noteMode ? 'Nota para a equipe (use @nome)' : 'Escreva a mensagem'}" data-inp="draft">${esc(S.draft[cv.id] || '')}</textarea>
        <button class="btn pri" data-act="sendMsg">${ic('Send', 'sm')}<span class="hide-m">${S.noteMode ? 'Salvar' : 'Enviar'}</span></button>
      </div>
      <div class="comp-foot">
        ${!S.noteMode && sugg.length ? `<button class="link" data-act="toggleSugg">${ic('Sparkles', 'xs')}${showS ? 'Esconder sugestões' : sugg.length + ' sugestões da ' + esc(o.ia.name)}</button>` : '<span></span>'}
        ${cv.st === 'humano' && !cop ? `<button class="link" data-act="giveBack">Devolver para a ${esc(o.ia.name)}</button>` : ''}
      </div>`;
  }
  return `<div class="ib-thread">
    <div class="th-h">
      <button class="iconbtn show-m" data-act="cvBack" aria-label="Voltar para a lista">${ic('ArrowLeft', 'sm')}</button>
      ${contactAv(ct, 'l')}
      <div class="grow" style="min-width:0"><b class="ellipsis" style="display:block;font-size:15.5px">${esc(ct.nm)}</b><div class="dim ellipsis">${esc(ct.co)}</div></div>
      ${slaInfo(cv) ? slaChip(cv, true) : `<span class="st-txt"><span class="dot ${st.cls === 'bad' ? 'bad' : st.cls === 'cy' ? 'cy' : ''}"></span>${esc(st.t)}</span>`}
      ${cv.st === 'espera' ? `<button class="btn pri" data-act="takeOver">Assumir</button>` : ''}
      <button class="iconbtn" data-act="cvSide" aria-label="Mostrar ou esconder dados do lead" title="Dados do lead">${ic('PanelRight', 'sm')}</button>
    </div>
    <div class="th-body" id="thBody" aria-live="polite">
      ${cv.msgs.map(msgHtml).join('')}
      ${typing ? `<div class="typing ${typing === 'lead' ? 'lead' : ''}" aria-label="digitando"><i></i><i></i><i></i></div>` : ''}
    </div>
    <div class="composer ${S.noteMode ? 'note-mode' : ''}">${composer}</div>
  </div>`;
}

const Q_KEYS = [['dor', 'Dor'], ['decisor', 'Decisor'], ['momento', 'Momento'], ['capacidade', 'Capacidade']];
function qualScore(cv) { return Q_KEYS.filter(([k]) => cv.q && cv.q[k]).length; }
function afFor(cv, k) { const o = O(); return (cv.af && cv.af[k]) || (o.autofill ? o.autofill.log.find((e) => e.cv === cv.id && e.k === k) : null); }
function afMark(e) { return e ? '<span class="af-mark" title="' + esc((e.by === 'ia' ? 'Preenchido pela ' + O().ia.name : 'Aplicado por ' + (U(e.by) ? U(e.by).short : '')) + ' às ' + e.t + ' · "' + e.quote + '"') + '">' + ic('Sparkles', 'xs') + '</span>' : ''; }
const ACC_DEF = { qualif: true, negocio: true, ficha: false, origem: false };
function accOpen(k, force) { S.acc = S.acc || {}; return S.acc[k] != null ? S.acc[k] : force || ACC_DEF[k]; }
function acc(k, title, meta, body, force) {
  const open = accOpen(k, force);
  return `<section class="acc ${open ? 'open' : ''}"><button class="acc-h" data-act="acc" data-k="${k}" data-open="${open}" aria-expanded="${open}"><span class="acc-t">${title}</span><span class="row" style="gap:10px">${meta || ''}${ic('ChevronDown', 'sm acc-ch')}</span></button>${open ? `<div class="acc-b">${body}</div>` : ''}</section>`;
}
ACT.acc = (el) => { S.acc = S.acc || {}; S.acc[el.dataset.k] = el.dataset.open !== 'true'; rerender(); };
ACT.toggleSugg = () => { const cop = O().ia.mode === 'cop'; S.showSugg = !(S.showSugg != null ? S.showSugg : cop); rerender(); };
function fichaBody(cv, ct) {
  const o = O(), A = o.autofill, admin = ['Proprietária', 'Gestor'].includes(ME().role), sugg = cv.sugg || [];
  const rows = [['nm', 'Nome'], ['ph', 'Telefone / WhatsApp'], ['co', ct.pf ? 'Ocupação' : 'Empresa'], ['seg', ct.pf ? 'Produto' : 'Segmento'], ['city', 'Cidade'], ['em', 'E-mail']].concat(o.kit && o.kit.startsWith('credito') ? [['credit', 'Crédito pretendido']] : []);
  return `<label class="row between af-toggle" title="${admin ? 'Vale para toda a organização' : 'Só a gestão altera'}"><span>Preenchimento pela ${esc(o.ia.name)}</span><span class="sw"><input type="checkbox" ${A.on ? 'checked' : ''} data-chg="afMaster" ${admin ? '' : 'disabled'} aria-label="Preenchimento automático do CRM"><span></span></span></label>
    ${rows.map(([k, nm]) => { const e = afFor(cv, k), v = ct[k]; const empty = !v || v === '—' || v === 'Empresa não informada'; return `<div class="af-row ${S.flashAf === cv.id + k ? 'flash' : ''}"><span class="dim">${nm}</span><span class="${empty ? 'dim' : ''}">${empty ? '—' : esc(v)}${afMark(e)}</span></div>`; }).join('')}
    ${sugg.length ? `<div class="af-sugg"><div class="row between"><b>${sugg.length} ${sugg.length > 1 ? 'sugestões' : 'sugestão'}</b><button class="btn sm pri" data-act="afApplyAll" data-cv="${cv.id}">Aplicar todas</button></div>
      ${sugg.map((e) => `<div class="row between" style="gap:10px"><span style="min-width:0"><span class="dim">${esc(e.nm)}:</span> ${esc(e.value)}</span><button class="btn xs" data-act="afApply" data-cv="${cv.id}" data-id="${e.id}">Aplicar</button></div>`).join('')}</div>` : ''}`;
}
function sideHtml(cv) {
  const o = O(), ct = CT(cv.c), d = dealOf(cv.c), inst = INST(cv.inst);
  const n = qualScore(cv), ready = cv.q && cv.q.dor && cv.q.decisor && cv.q.momento;
  const scoreCol = ct.score >= 75 ? 'var(--bad)' : ct.score >= 50 ? 'var(--warn)' : 'var(--cy)';
  const tmp = ct.score >= 75 ? 'quente' : ct.score >= 50 ? 'morno' : 'frio';
  const stg = d ? STAGE(d.p, d.s) : null;
  const canPay = d && d.p === 'inb' && ['novo', 'conversa', 'qualificado'].includes(d.s) && S.org === 'mkt';
  const canHand = d && d.p === 'inb' && ['pago', 'realizado'].includes(d.s);
  const sugg = cv.sugg || [];
  const afCount = ['co', 'seg', 'city', 'em'].filter((k) => afFor(cv, k)).length;
  const summary = cv.q && cv.q.dor ? [cv.q.dor, cv.q.decisor, cv.q.momento, cv.q.capacidade].filter(Boolean).join(' ') : 'A ' + o.ia.name + ' ainda está conhecendo o lead.';
  const qualBody = `<div class="score">${ring(ct.score, 58, 6, scoreCol, ct.score)}<div><div>${temp(tmp)}</div><div class="${ready ? 'ok' : 'muted'}" style="margin-top:4px">${ready ? 'Pronto para o diagnóstico' : n + ' de 4 respostas'}</div></div></div>
    <div class="q-list">${Q_KEYS.map(([k, nm]) => `<div class="q-item ${cv.q && cv.q[k] ? 'done' : ''} ${S.flashQ === cv.id + k ? 'flash' : ''}"><span class="ck">${ic('Check', 'xs')}</span><div><div class="k">${nm}${cv.q && cv.q[k] ? afMark(afFor(cv, k)) : ''}</div>${cv.q && cv.q[k] ? `<div class="a">${esc(cv.q[k])}</div>` : ''}</div></div>`).join('')}</div>`;
  const dealBody = d ? `<div class="row between"><span>${pill(stg.nm, stg.won ? 'ok' : 'cy')}</span><b class="num">${brl(d.v)}</b></div>
    <div class="muted">${esc(d.next)}</div>
    ${canPay ? `<button class="btn pri block" data-act="sendPay" data-id="${cv.id}">${ic('QrCode', 'sm')}Enviar link do diagnóstico</button>` : ''}
    ${canHand ? `<button class="btn block" data-act="handoff" data-id="${d.id}">${ic('Handshake', 'sm')}Passar para o Closer</button>` : ''}
    <button class="link" data-act="openDeal" data-id="${d.id}">Abrir negócio ${ic('ArrowUpRight', 'xs')}</button>` : '';
  return `<aside class="ib-side" aria-label="Dados do lead">
    <section class="side-head">
      <div class="row top-a" style="gap:14px">${contactAv(ct, 'l')}<div class="grow" style="min-width:0"><b style="font-size:15.5px">${esc(ct.nm)}</b><div class="muted ellipsis">${esc(ct.co)}</div></div>
        <button class="iconbtn sm side-tg" data-act="cvSide" aria-label="Fechar">${ic('X', 'sm')}</button></div>
      <div class="row" style="gap:8px"><button class="btn sm" data-act="copy" data-v="${esc(ct.ph)}">${ic('Phone', 'xs')}${esc(ct.ph)}</button><button class="btn sm ghost" data-act="openContact" data-id="${ct.id}">Ficha completa</button></div>
    </section>
    ${acc('qualif', 'Qualificação', `<span class="acc-meta">${n}/4</span>`, qualBody)}
    ${d ? acc('negocio', 'Negócio', `<span class="acc-meta">${esc(stg.nm)}</span>`, dealBody) : ''}
    ${o.autofill ? acc('ficha', 'Ficha no CRM', sugg.length ? `<span class="pill cy">${sugg.length} para aplicar</span>` : afCount ? `<span class="acc-meta">${ic('Sparkles', 'xs')} ${afCount}</span>` : '', fichaBody(cv, ct), sugg.length > 0) : ''}
    ${acc('origem', 'Origem e resumo', '', `<div class="muted">${esc(ct.src)} · ${esc(inst.nm)}${inst.type === 'oficial' ? ' (API oficial)' : ' (não oficial)'}</div><p>${esc(summary)}</p>`)}
  </aside>`;
}

INP.cvq = (el) => { S.filters.cvq = el.value; rerender(); };
INP.draft = (el) => { S.draft[S.cv] = el.value; };
ACT.cvFilter = (el) => { S.cvFilter = el.dataset.id; rerender(); };
ACT.selCv = (el) => { const cv = CV(el.dataset.id); S.cv = cv.id; cv.unread = 0; cv.isNew = false; S.showThread = true; S.noteMode = false; rerender(); };
ACT.cvBack = () => { S.showThread = false; rerender(); };
ACT.cvSide = () => {
  if (window.innerWidth > 1280) { S.sideHidden = !S.sideHidden; store.set('sideHidden', S.sideHidden); rerender(); return; }
  S.sideOpen = !S.sideOpen; const ib = $('#inbox'); if (ib) ib.classList.toggle('side-open', S.sideOpen);
};
ACT.copy = (el) => copyText(el.dataset.v);
ACT.toggleNote = () => { S.noteMode = true; rerender(); const t = $('#msgIn'); if (t) t.focus(); };
ACT.setNote = (el) => { S.noteMode = el.dataset.v === '1'; rerender(); const t = $('#msgIn'); if (t) t.focus(); };
ACT.useSugg = (el) => { const cv = CV(S.cv); const s = (SUGG[cv.id] || [])[+el.dataset.i] || el.textContent; S.draft[cv.id] = s; S.usedSugg = true; rerender(); const t = $('#msgIn'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } };
ACT.attach = () => toast('Anexos', 'Na versão real você envia imagem, PDF ou áudio. Na demo o envio de arquivo está desligado.', '', 'Paperclip');
ACT.takeOver = () => {
  const cv = CV(S.cv), was = cv.st;
  cv.st = 'humano'; cv.who = DB.me; cv.unread = 0;
  cv.msgs.push({ f: 'sys', x: ME().short + ' assumiu a conversa' + (was === 'espera' ? ' · ' + O().ia.name + ' avisou o lead' : ''), t: nowT() });
  if (S.sim && S.sim.cv === cv.id && S.sim.running) simSkip(true);
  rerender();
  const t = $('#msgIn'); if (t) t.focus();
};
ACT.giveBack = () => { const cv = CV(S.cv); cv.st = 'ia'; cv.who = null; cv.msgs.push({ f: 'sys', x: 'Conversa devolvida para a ' + O().ia.name, t: nowT() }); rerender(); };
ACT.reopenCv = () => { const cv = CV(S.cv); cv.st = 'humano'; cv.who = DB.me; cv.msgs.push({ f: 'sys', x: 'Conversa reaberta por ' + ME().short, t: nowT() }); rerender(); };
ACT.sendMsg = () => {
  const cv = CV(S.cv), el = $('#msgIn');
  const txt = (el ? el.value : '').trim();
  if (!txt) { if (el) el.focus(); return; }
  const lastLead = [...cv.msgs].reverse().find((m) => m.f !== 'sys');
  const si = S.noteMode ? null : slaInfo(cv);
  if (S.noteMode) cv.msgs.push({ f: 'note', u: DB.me, x: txt, t: nowT() });
  else cv.msgs.push({ f: 'user', u: DB.me, x: txt, t: nowT(), viaIa: O().ia.mode === 'cop' && S.usedSugg });
  S.draft[cv.id] = ''; S.usedSugg = false;
  if (cv.st === 'espera') { cv.st = 'humano'; cv.who = DB.me; }
  cv.t = nowT();
  rerender();
  if (si) {
    cv.slaType = null; cv.slaSince = null;
    if (si.left > 0) gainXP(5, 'Respondido dentro do SLA (' + Math.max(1, Math.round((si.lim * 60 - si.left) / 60)) + ' de ' + si.lim + ' min)');
    else toast('Respondido fora do SLA', 'Passou ' + Math.ceil(-si.left / 60) + ' min do prazo. Não pontua, mas o lead foi atendido.', 'warn', 'Timer');
    refreshChrome();
  } else if (!S.noteMode && lastLead && lastLead.f === 'lead') gainXP(5, 'Lead respondido por você');
  if (S.noteMode && /@\w+/.test(txt)) toast('Nota salva', 'Quem foi mencionado recebe um aviso.', '', 'AtSign');
};
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.id === 'msgIn' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ACT.sendMsg(); }
});

ACT.sendPay = (el) => {
  const cv = CV(el.dataset.id), d = dealOf(cv.c);
  cv.msgs.push({ f: cv.st === 'humano' ? 'user' : 'ia', u: DB.me, x: 'Te mandei o Pix aqui embaixo pra garantir o horário do diagnóstico.', t: nowT(), pay: true });
  cv.st = cv.st === 'humano' ? 'humano' : 'aguardando';
  d.s = 'ofertado'; d.next = 'Pix enviado · lembrete automático em 2 h'; d.moved = true;
  rerender();
  toast('Link do diagnóstico enviado', 'Quando o Pix cair, o negócio vai sozinho para "Diagnóstico pago".', '', 'QrCode');
};

/* ---------- handoff para o Closer ---------- */
ACT.handoff = (el) => {
  const d = DL(el.dataset.id), ct = CT(d.c), cv = O().conversations.find((c) => c.c === ct.id);
  const q = (cv && cv.q) || {};
  const closers = DB.users.filter((u) => u.role === 'Closer' && u.orgs.includes(S.org));
  openModal(modalHead('Passar para o Closer', 'A ' + esc(O().ia.name) + ' montou o resumo. Revise antes de enviar.') + `
    <form class="modal-b" data-sub="handoff" data-id="${d.id}">
      <div class="row">${contactAv(ct, 'l')}<div><b>${esc(ct.nm)}</b><div class="dim" style="font-size:12.5px">${esc(ct.co)} · ${esc(STAGE(d.p, d.s).nm)}</div></div></div>
      <div class="field"><label for="hoTo">Closer responsável</label><select class="sel" id="hoTo">${closers.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="hoVal">Valor estimado da consultoria</label><input class="in" id="hoVal" value="9800" inputmode="numeric"><span class="hint">Valor de demonstração. O Closer ajusta depois da reunião.</span></div>
      <div class="field"><label for="hoSum">Resumo para o Closer</label><textarea class="ta" id="hoSum" rows="6">Dor: ${esc(q.dor || 'a confirmar')}\nDecisor: ${esc(q.decisor || 'a confirmar')}\nMomento: ${esc(q.momento || 'a confirmar')}\nCapacidade: ${esc(q.capacidade || 'a confirmar')}\nPróximo passo: reunião de 30 min para apresentar o plano de 90 dias.</textarea></div>
    </form>` + `<div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="handoff">${ic('Handshake', 'sm')}Enviar handoff</button></div>`);
};
ACT.submitForm = (el) => { const f = $('form[data-sub="' + el.dataset.form + '"]'); if (f) { if (typeof f.requestSubmit === 'function') f.requestSubmit(); else SUB[f.dataset.sub](f); } };
SUB.handoff = (f) => {
  const d = DL(f.dataset.id), ct = CT(d.c), to = $('#hoTo').value, val = parseInt($('#hoVal').value.replace(/\D/g, ''), 10) || 9800;
  doHandoff(d, to, val, $('#hoSum').value);
  closeOverlay();
};
function doHandoff(d, to, val, sum) {
  const o = O(), ct = CT(d.c);
  let nd = o.deals.find((x) => x.c === d.c && x.p === 'cons');
  if (!nd) { nd = { id: 'd' + uid(), c: d.c, p: 'cons', s: 'handoff', v: val, temp: 'quente', owner: to, next: 'Primeiro contato do ' + U(to).short, age: 'agora', moved: true }; o.deals.push(nd); }
  if (d.p === 'inb') { d.s = 'realizado'; d.next = 'Handoff enviado para ' + U(to).short; d.flag = null; }
  const cv = o.conversations.find((c) => c.c === ct.id);
  if (cv) cv.msgs.push({ f: 'sys', x: 'Handoff · ' + o.ia.name + ' → ' + U(to).name, t: nowT(), cls: 'gold' });
  const ch = o.channels.find((c) => c.id === 'handoff');
  if (ch) {
    const lines = String(sum || '').split('\n').map((l) => l.split(':')).filter((p) => p.length > 1).map((p) => [p[0].trim(), p.slice(1).join(':').trim()]);
    const pend = ch.msgs.find((m) => m.deal === d.id && m.pending);
    if (pend) { pend.pending = false; pend.assigned = to; }
    else ch.msgs.push({ u: 'ia', t: nowT(), x: 'Handoff pronto para @' + U(to).short + '.', deal: nd.id, sum: lines.length ? lines : null });
    ch.msgs.push({ u: DB.me, t: nowT(), x: 'Atribuí ' + ct.nm + ' (' + ct.co + ') para @' + U(to).short + '.' });
  }
  toast('Handoff enviado para ' + U(to).short, ct.co + ' entrou no funil Consultoria · Closer.', '', 'Handshake');
  const t6 = o.tasks.find((t) => t.deal === d.id && !t.done && /resumo/i.test(t.t));
  if (t6) t6.done = true;
  gainXP(60, 'Diagnóstico com resumo entregue em 24 h');
  markGuide('handoff');
  setTimeout(() => {
    if (ch) { ch.msgs.push({ u: to, t: nowT(), x: 'Peguei. Falo com ' + ct.nm.split(' ')[0] + ' ainda hoje.' }); if (S.route === 'chat') rerender(); }
  }, 1800);
  rerender();
}

/* ---------- preenchimento automático do CRM pela IA (a gestão liga e desliga) ---------- */
const AF_FIELDS = { co: 'Empresa', seg: 'Segmento', city: 'Cidade', em: 'E-mail', dor: 'Dor', decisor: 'Decisor', momento: 'Momento', capacidade: 'Capacidade', score: 'Pontuação', etapa: 'Etapa do funil', next: 'Próximo passo', task: 'Tarefa' };
const AF_GROUP = { co: 'cadastro', seg: 'cadastro', city: 'cadastro', em: 'cadastro', dor: 'qualif', decisor: 'qualif', momento: 'qualif', capacidade: 'qualif', score: 'score', etapa: 'etapa', next: 'etapa', task: 'task' };
function afOn(o, k) {
  const A = o.autofill;
  if (!A || !A.on) return false;
  const f = A.fields.find((x) => x.k === AF_GROUP[k]);
  return !f || f.on;
}
/* Grava o campo se o preenchimento estiver ligado e a confiança passar do mínimo. Senão, vira sugestão para uma pessoa aplicar. */
function autofill(cv, k, value, quote, set, undo, conf = 93) {
  const o = O(), A = o.autofill;
  const e = { id: uid(), t: nowT(), cv: cv.id, c: cv.c, k, nm: AF_FIELDS[k] || k, value, quote, conf, set, undo };
  cv.af = cv.af || {};
  if (afOn(o, k) && conf >= A.minConf) { set(); e.by = 'ia'; A.log.unshift(e); cv.af[k] = e; S.flashAf = cv.id + k; return true; }
  cv.sugg = (cv.sugg || []).filter((x) => x.k !== k);
  cv.sugg.push(e);
  return false;
}
ACT.afApply = (el) => {
  const o = O(), cv = CV(el.dataset.cv), i = (cv.sugg || []).findIndex((x) => x.id === el.dataset.id), e = cv.sugg[i];
  e.set(); e.by = DB.me; e.t = nowT(); cv.sugg.splice(i, 1); cv.af = cv.af || {}; cv.af[e.k] = e; o.autofill.log.unshift(e);
  toast('Campo preenchido', e.nm + ': ' + e.value, '', 'Check'); rerender();
};
ACT.afApplyAll = (el) => {
  const o = O(), cv = CV(el.dataset.cv), n = (cv.sugg || []).length;
  (cv.sugg || []).forEach((e) => { e.set(); e.by = DB.me; e.t = nowT(); cv.af = cv.af || {}; cv.af[e.k] = e; o.autofill.log.unshift(e); });
  cv.sugg = [];
  toast(n + ' campos preenchidos', 'Sugestões da ' + o.ia.name + ' aplicadas por você.', '', 'CheckCheck'); rerender();
};
ACT.afUndo = (el) => {
  const o = O(), i = o.autofill.log.findIndex((x) => x.id === el.dataset.id), e = o.autofill.log[i];
  if (!e || !e.undo) return;
  e.undo(); o.autofill.log.splice(i, 1);
  const cv = o.conversations.find((c) => c.id === e.cv); if (cv && cv.af) delete cv.af[e.k];
  toast('Preenchimento desfeito', e.nm + ' voltou ao valor anterior. A ' + o.ia.name + ' registrou a correção.', '', 'Undo2'); rerender();
};
CHG.afMaster = (el) => {
  const o = O(); o.autofill.on = el.checked;
  toast(el.checked ? 'Preenchimento automático ligado' : 'Preenchimento automático desligado', el.checked ? 'A ' + o.ia.name + ' volta a preencher o CRM a partir das conversas.' : 'A ' + o.ia.name + ' só sugere. Uma pessoa aplica cada campo.', el.checked ? '' : 'warn', 'Sparkles');
  markGuide('autofill'); rerender();
};

/* ---------- simulação: lead do Meta atendido pela SDR IA ---------- */
ACT.simLead = () => {
  closePop(); closeOverlay();
  if (S.org !== 'mkt') { S.org = 'mkt'; renderShell(); }
  const o = O();
  if (S.sim && S.sim.running) { go('atendimento', { cv: S.sim.cv }); return; }
  const n = (S.simCount = (S.simCount || 0) + 1);
  const people = [
    { nm: 'Patrícia Gomes', fem: true, co: 'Studio Equilíbrio Pilates', seg: 'Pilates', city: 'Campinas/SP', partner: 'Renata', said: 'Tenho o Studio Equilíbrio, de pilates, aqui em Campinas', what: 'aluno', month: 'Janeiro é quando mais entra aluno', em: 'patricia@studioequilibrio.exemplo' },
    { nm: 'Daniel Freitas', fem: false, co: 'Freitas Ótica', seg: 'Ótica', city: 'Santo André/SP', partner: 'Márcio', said: 'Tenho a Freitas Ótica, em Santo André', what: 'cliente', month: 'Dezembro é o mês mais forte pra gente', em: 'daniel@freitasotica.exemplo' },
  ];
  const P = people[(n - 1) % people.length];
  const first = P.nm.split(' ')[0];
  const cid = 'c' + uid(), did = 'd' + uid(), cvid = 'cv' + uid();
  o.contacts.unshift({ id: cid, nm: P.nm, co: 'Empresa não informada', seg: '—', city: '—', ph: '(19) 90000-13' + String(10 + n), em: '—', src: 'Meta · Vídeo Rebeca', owner: 'u3', life: 'Lead', score: 20, last: 'agora' });
  o.deals.unshift({ id: did, c: cid, p: 'inb', s: 'novo', v: o.ia.price, temp: 'frio', owner: 'u3', next: 'Cibelle está atendendo', age: 'agora', moved: true });
  const cv = { id: cvid, c: cid, inst: 'i1', st: 'ia', unread: 0, t: nowT(), conf: 94, q: {}, af: {}, sugg: [], isNew: true, msgs: [{ f: 'sys', x: 'Lead do anúncio "[CAPT] Diagnóstico · Vídeo Rebeca 45s" · nome e telefone vieram do WhatsApp', t: nowT() }] };
  o.conversations.unshift(cv);
  o.metrics.ticker.unshift({ t: cv.t, x: 'Lead novo do Meta: <b>' + esc(P.nm) + '</b>' });
  S.cv = cvid; S.cvFilter = 'todas'; S.showThread = true;
  toast('Lead novo do Meta', P.nm + ' chegou pelo vídeo da Rebeca.', '', 'Megaphone');
  if (S.route !== 'atendimento') go('atendimento', { cv: cvid }); else rerender();

  const ct = () => CT(cid), deal = () => DL(did);
  const T = (who) => () => { S.sim.typing = who; };
  const M = (f, x, extra = {}) => () => { S.sim.typing = null; cv.msgs.push(Object.assign({ f, x, t: nowT() }, extra)); cv.t = nowT(); if (f === 'lead' && S.cv !== cvid) cv.unread++; };
  const F = (k, value, quote, conf) => () => {
    const c = ct(), prev = c[k];
    autofill(cv, k, value, quote, () => { c[k] = value; }, () => { c[k] = prev; }, conf);
  };
  const Q = (k, v, score, quote) => () => {
    autofill(cv, k, v, quote, () => { cv.q[k] = v; S.flashQ = cvid + k; }, () => { delete cv.q[k]; });
    const c = ct(), d = deal(), prevS = c.score, prevT = d.temp, t = score >= 75 ? 'quente' : score >= 50 ? 'morno' : 'frio';
    autofill(cv, 'score', score + ' · ' + t, 'Pontuação recalculada com a resposta', () => { c.score = score; d.temp = t; }, () => { c.score = prevS; d.temp = prevT; });
  };
  const stage = (s, next, why) => () => {
    const d = deal(), prev = [d.s, d.next];
    const idx = (x) => PIPE('inb').stages.findIndex((y) => y.id === x);
    autofill(cv, 'etapa', STAGE('inb', s).nm, why, () => { if (idx(s) > idx(d.s)) { d.s = s; d.next = next; d.moved = true; d.age = 'agora'; } }, () => { d.s = prev[0]; d.next = prev[1]; });
  };
  const fem = P.fem;
  const steps = [
    [700, T('lead')], [1300, M('lead', 'Oi! Vi o anúncio do diagnóstico. Como funciona?')],
    [500, T('ia')], [1000, M('ia', 'Oi, ' + first + '! Aqui é a Cibelle, da Lothem 🙂')], [400, stage('conversa', 'Cibelle está qualificando', 'Lead respondeu e a conversa começou')],
    [500, T('ia')], [800, M('ia', 'Antes de te explicar, me conta: qual é o seu negócio?')],
    [700, T('lead')], [1500, M('lead', P.said + '. Posto todo dia no Instagram e não vem ' + P.what + ' novo')],
    [350, F('co', P.co, P.said)], [250, F('seg', P.seg, P.said)], [250, F('city', P.city, P.said)],
    [500, T('ia')], [1200, M('ia', 'Postar todo dia cansa, né? E hoje o ' + P.what + ' novo chega mais por indicação ou pelo Instagram?')],
    [700, T('lead')], [1300, M('lead', 'Quase tudo indicação. Instagram não traz quase nada')],
    [300, Q('dor', 'Posta todo dia no Instagram e não vem ' + P.what + ' novo. Depende de indicação.', 42, 'Quase tudo indicação. Instagram não traz quase nada')],
    [500, T('ia')], [1000, M('ia', 'Entendi. Vocês já testaram anúncio pago alguma vez?')],
    [700, T('lead')], [1200, M('lead', 'Já impulsionei uns posts, uns R$ 300 por mês, mas parei')],
    [300, Q('capacidade', 'Já investiu cerca de R$ 300 por mês em impulsionamento.', 56, 'uns R$ 300 por mês, mas parei')],
    [500, T('ia')], [1000, M('ia', 'Boa. E sobre o negócio: você decide ' + (fem ? 'sozinha' : 'sozinho') + ' ou tem sócio?')],
    [700, T('lead')], [1100, M('lead', 'Eu e ' + (fem ? 'minha sócia, a ' : 'meu sócio, o ') + P.partner)],
    [300, Q('decisor', first + ' e ' + (fem ? 'a sócia, ' : 'o sócio, ') + P.partner + '. Os dois no diagnóstico.', 68, 'Eu e ' + (fem ? 'minha sócia, a ' : 'meu sócio, o ') + P.partner)],
    [500, T('ia')], [1000, M('ia', 'Perfeito. Se fizesse sentido, vocês querem resolver isso agora ou mais pra frente?')],
    [700, T('lead')], [1300, M('lead', 'Agora. ' + P.month + ' e quero estar ' + (fem ? 'pronta' : 'pronto'))],
    [300, Q('momento', 'Agora: quer estar ' + (fem ? 'preparada' : 'preparado') + ' para a alta temporada.', 86, 'Agora. ' + P.month)],
    [300, () => { stage('qualificado', 'Ofertar diagnóstico', 'Dor, decisor e momento confirmados')(); cv.msgs.push({ f: 'sys', x: 'Lead qualificado · dor, decisor e momento confirmados', t: nowT(), cls: 'ok' }); o.metrics.ticker.unshift({ t: nowT(), x: 'Cibelle qualificou <b>' + esc(P.nm) + '</b>' }); squadXP(25, 'Lead qualificado pela Cibelle · ' + P.nm); }],
    [600, T('ia')], [1100, M('ia', 'Então o diagnóstico faz bastante sentido pra vocês.')],
    [300, T('ia')], [1300, M('ia', 'É uma conversa de 60 min com a Rebeca, nossa estrategista. Ela olha o Instagram de vocês, os números e a concorrência da região, e vocês saem com um plano para os próximos 90 dias.')],
    [300, T('ia')], [1000, M('ia', 'O investimento é R$ 497. Se depois vocês seguirem com a consultoria, esse valor é abatido.')],
    [300, T('ia')], [800, M('ia', 'Quer que eu veja um horário em que ' + (fem ? 'a ' : 'o ') + P.partner + ' também possa?')], [200, stage('ofertado', 'Escolhendo horário', 'Diagnóstico apresentado com preço')],
    [700, T('lead')], [1300, M('lead', 'Quero! Pode ser quinta à tarde?')],
    [500, T('ia')], [1000, M('ia', 'Tenho quinta, 08/10, às 15h ou às 16h30. Qual fica melhor?')],
    [700, T('lead')], [900, M('lead', '15h')],
    [500, T('ia')], [900, M('ia', 'Fechado. Qual e-mail eu uso pra mandar o convite da chamada?')],
    [700, T('lead')], [1100, M('lead', P.em)],
    [300, F('em', P.em, P.em, 99)],
    [500, T('ia')], [1100, M('ia', 'Anotado: quinta, 08/10, às 15h. Te mando o Pix aqui embaixo pra garantir o horário.', { pay: true })],
    [400, () => { const d = deal(), prev = d.next; autofill(cv, 'next', 'Pix enviado · aguardando', 'Link de pagamento enviado', () => { d.next = 'Pix enviado · aguardando'; }, () => { d.next = prev; }); }],
    [2200, () => {
      const pm = [...cv.msgs].reverse().find((m) => m.pay); if (pm) pm.paid = true;
      cv.msgs.push({ f: 'sys', x: 'Pagamento confirmado · R$ 497 via Pix (integração de pagamento)', t: nowT(), cls: 'ok' });
      const d = deal(); d.s = 'pago'; d.next = 'Diagnóstico qui 08/10 · 15:00'; d.moved = true; d.age = 'agora';
      cv.sugg = (cv.sugg || []).filter((x) => x.k !== 'etapa' && x.k !== 'next');
      ct().life = 'Cliente diagnóstico';
      o.metrics.done += o.ia.price;
      const k = o.metrics.kpis.find((x) => x.k === 'Diagnósticos vendidos'); if (k) k.v = String(parseInt(k.v, 10) + 1);
      U('u3').kpi.v += 1;
      o.metrics.ticker.unshift({ t: nowT(), x: 'Pagamento confirmado: <b>' + esc(P.nm) + '</b> · R$ 497', cls: 'ok' });
      toast('Pagamento confirmado · R$ 497', P.nm + ' comprou o diagnóstico.', '', 'CircleDollarSign');
      squadXP(80, 'Diagnóstico vendido · ' + P.nm);
    }],
    [500, T('ia')], [1000, M('ia', 'Pagamento recebido, ' + first + '! O convite com o link da chamada já foi para o seu e-mail. Amanhã cedo eu te lembro por aqui.')],
    [600, () => {
      const task = { id: 't' + uid(), t: 'Diagnóstico · ' + P.nm + ' (' + (ct().co === 'Empresa não informada' ? P.nm : ct().co) + ')', type: 'Video', who: 'u1', due: 1, at: '15:00', deal: did, pri: 'alta', xp: 10 };
      const made = autofill(cv, 'task', 'Diagnóstico qui 08/10, 15:00 · Rebeca', 'Tenho quinta, 08/10, às 15h', () => { o.tasks.push(task); }, () => { const i = o.tasks.indexOf(task); if (i >= 0) o.tasks.splice(i, 1); });
      const filled = Object.keys(cv.af).length, pend = cv.sugg.length;
      cv.msgs.push({ f: 'sys', x: made ? 'Tarefa criada para Rebeca · diagnóstico qui 08/10, 15:00 · resumo pronto para o Closer' : 'Diagnóstico combinado para qui 08/10, 15:00 · a tarefa espera aprovação', t: nowT(), cls: 'gold' });
      o.metrics.ticker.unshift({ t: nowT(), x: filled ? 'Cibelle preencheu ' + filled + ' campos do CRM de <b>' + esc(P.nm) + '</b>' : 'Cibelle deixou ' + pend + ' sugestões de preenchimento para <b>' + esc(P.nm) + '</b>' });
      S.sim.running = false; S.sim.typing = null;
      markGuide('sim');
      toast('Fluxo concluído', filled ? 'Do anúncio ao Pix sem ninguém tocar na conversa. A Cibelle preencheu ' + filled + ' campos do CRM sozinha.' : 'Conversa concluída. O preenchimento automático está desligado: ' + pend + ' sugestões esperam alguém aplicar.', '', 'Sparkles');
    }],
  ];
  S.sim = { running: true, cv: cvid, i: 0, steps, typing: null, timer: null };
  simRun();
};
function simRun() {
  const s = S.sim;
  if (!s || !s.running) return;
  if (s.i >= s.steps.length) { s.running = false; return; }
  const [delay, fn] = s.steps[s.i];
  s.timer = setTimeout(() => { s.i++; fn(); simRefresh(); simRun(); }, delay);
}
function simSkip(silent) {
  const s = S.sim;
  if (!s) return;
  clearTimeout(s.timer);
  if (silent) { s.running = false; s.typing = null; return; }
  while (s.i < s.steps.length) { const fn = s.steps[s.i][1]; s.i++; fn(); }
  s.running = false; s.typing = null;
  simRefresh();
}
ACT.simSkip = () => simSkip();
function simRefresh() {
  if (['atendimento', 'funis', 'central', 'contatos'].includes(S.route)) rerender(); else renderNav();
  setTimeout(() => { S.flashQ = null; }, 50);
}

/* =========================================================
   FUNIS
   ========================================================= */
VIEWS.funis = {
  title: 'Funis de vendas',
  crumb: 'Comando',
  render() {
    const o = O();
    if (!PIPE(S.pipe)) S.pipe = o.pipelines[0].id;
    const pp = PIPE(S.pipe);
    const f = S.filters;
    const q = norm(f.dq || '');
    const deals = o.deals.filter((d) => d.p === pp.id).filter((d) => !f.temp || d.temp === f.temp).filter((d) => !f.owner || d.owner === f.owner)
      .filter((d) => { if (!q) return true; const c = CT(d.c); return norm(c.nm + ' ' + c.co).includes(q); });
    const open = deals.filter((d) => { const s = STAGE(d.p, d.s); return !s.won && !s.lost; });
    const sumOpen = open.reduce((a, d) => a + d.v, 0);
    const forecast = open.reduce((a, d) => a + (d.v * STAGE(d.p, d.s).p) / 100, 0);
    const won = deals.filter((d) => STAGE(d.p, d.s).won);
    const cycle = { inb: '2,4 dias', cons: '16 dias', out: '9 dias', pj: '21 dias', pf: '12 dias' }[pp.id] || '—';
    const owners = DB.users.filter((u) => u.orgs.includes(S.org));
    return `
    <div class="page-h"><div><h2>${esc(pp.nm)}</h2><p>${esc(pp.desc)}. Arraste os cards entre as etapas ou abra um negócio para ver o histórico.</p></div>
      <div class="acts"><button class="btn" data-act="openOtherTab">${ic('ExternalLink', 'sm')}Abrir em outra aba</button><button class="btn pri" data-act="newDeal">${ic('Plus', 'sm')}Novo negócio</button></div></div>
    <div class="row wrap between" style="margin-bottom:14px;gap:10px">
      <div class="seg" role="tablist">${o.pipelines.map((p) => `<button class="${p.id === pp.id ? 'on' : ''}" data-act="setPipe" data-id="${p.id}" role="tab" aria-selected="${p.id === pp.id}">${esc(p.nm)}</button>`).join('')}</div>
      <div class="row wrap" style="gap:8px">
        <div class="search" style="width:220px">${ic('Search')}<input class="in" id="dq" placeholder="Buscar negócio" value="${esc(f.dq || '')}" data-inp="dq" autocomplete="off"></div>
        <div class="chips">${['quente', 'morno', 'frio'].map((t) => `<button class="chip ${f.temp === t ? 'on' : ''}" data-act="fTemp" data-v="${t}">${temp(t)}</button>`).join('')}</div>
        <select class="sel" style="width:auto;height:30px;font-size:12.5px" data-chg="fOwner" aria-label="Responsável"><option value="">Todos os responsáveis</option>${owners.map((u) => `<option value="${u.id}" ${f.owner === u.id ? 'selected' : ''}>${esc(u.short)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="pipe-sum">
      <div class="pn c"><span class="lbl">Em aberto</span><div class="v num">${brlK(sumOpen)}</div><span class="dim" style="font-size:12px">${open.length} negócios</span></div>
      <div class="pn c"><span class="lbl">Previsão ponderada</span><div class="v num">${brlK(forecast)}</div><span class="dim" style="font-size:12px">valor × chance da etapa</span></div>
      <div class="pn c"><span class="lbl">${pp.id === 'inb' ? 'Diagnósticos realizados' : 'Ganhos'}</span><div class="v num ok">${brlK(won.reduce((a, d) => a + d.v, 0))}</div><span class="dim" style="font-size:12px">${won.length} no funil agora</span></div>
      <div class="pn c"><span class="lbl">Ciclo médio</span><div class="v num">${cycle}</div><span class="dim" style="font-size:12px">da entrada ao fechamento</span></div>
    </div>
    <div class="kb" data-keep-scroll="kb">
      ${pp.stages.map((s) => { const ds = deals.filter((d) => d.s === s.id); return `<div class="kb-col ${s.won ? 'won' : ''} ${s.lost ? 'lost' : ''}" data-stage="${s.id}">
        <div class="kb-h"><div class="nm">${s.won ? ic('CircleCheck', 'sm ok') : s.lost ? ic('CircleX', 'sm bad') : '<span class="dot cy"></span>'}${esc(s.nm)}</div>
          <div class="meta"><span>${ds.length} ${ds.length === 1 ? 'negócio' : 'negócios'}</span><span class="num">${brlK(ds.reduce((a, d) => a + d.v, 0))}</span></div></div>
        <div class="kb-body">${ds.map(cardHtml).join('') || `<div class="dim" style="font-size:12px;text-align:center;padding:16px 6px">Solte um card aqui</div>`}</div>
      </div>`; }).join('')}
    </div>`;
  },
  after() {
    $$('.card[draggable]').forEach((c) => {
      c.addEventListener('dragstart', (e) => { S.dragId = c.dataset.id; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch (er) { /* sem dataTransfer */ } });
      c.addEventListener('dragend', () => { c.classList.remove('dragging'); $$('.kb-col.drop').forEach((x) => x.classList.remove('drop')); });
    });
    $$('.kb-col').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
      col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('drop'); if (S.dragId) moveDeal(S.dragId, col.dataset.stage); S.dragId = null; });
    });
    O().deals.forEach((d) => { d.moved = false; });
  },
};
function cardHtml(d) {
  const c = CT(d.c);
  const flagCls = { Revisão: 'warn', Humano: 'bad', Handoff: 'gold', Responder: 'bad' }[d.flag] || 'cy';
  return `<div class="card ${d.moved ? 'moved' : ''}" draggable="true" data-id="${d.id}" data-act="openDeal" role="button" tabindex="0" aria-label="${esc(c.co)}, ${esc(STAGE(d.p, d.s).nm)}">
    <div class="row between top-a"><span class="co">${esc(c.pf ? c.nm : c.co)}</span>${d.flag ? pill(d.flag, flagCls) : ''}</div>
    <div class="ct dim row" style="gap:5px">${ic('Clock', 'xs')}<span class="ellipsis">${esc(d.next)}</span></div>
    <div class="ft"><span class="val num">${brl(d.v)}</span><span class="row" style="gap:8px">${temp(d.temp)}${av(d.owner, 's')}</span></div>
  </div>`;
}
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});
ACT.setPipe = (el) => { S.pipe = el.dataset.id; rerender(); };
ACT.fTemp = (el) => { S.filters.temp = S.filters.temp === el.dataset.v ? null : el.dataset.v; rerender(); };
CHG.fOwner = (el) => { S.filters.owner = el.value || null; rerender(); };
INP.dq = (el) => { S.filters.dq = el.value; rerender(); };

function moveDeal(id, sid, opts = {}) {
  const d = DL(id), o = O();
  if (!d || d.s === sid) return;
  const st = STAGE(d.p, sid), c = CT(d.c);
  if (st.lost && !opts.reason) { askLost(id); return; }
  const fromIdx = PIPE(d.p).stages.findIndex((s) => s.id === d.s);
  d.s = sid; d.moved = true; d.age = 'agora';
  if (opts.reason) { d.next = 'Motivo: ' + opts.reason; d.temp = 'frio'; c.life = 'Perdido'; toast('Negócio marcado como perdido', c.co + ' · ' + opts.reason, '', 'CircleX'); }
  else if (d.p === 'cons' && sid === 'ganho') {
    d.next = 'Contrato assinado hoje'; d.flag = null; c.life = 'Cliente consultoria';
    o.metrics.done += d.v;
    const k = o.metrics.kpis.find((x) => x.k === 'Consultorias fechadas'); if (k) { k.v = String(parseInt(k.v, 10) + 1); k.hint = brl(d.v) + ' · ' + c.co; }
    U(d.owner).kpi && U(d.owner).role === 'Closer' && (U(d.owner).kpi.v += 1);
    const ch4 = DB.game.challenges.find((x) => x.id === 'ch4'); if (ch4) ch4.v = Math.min(ch4.goal, ch4.v + 1);
    o.metrics.ticker.unshift({ t: nowT(), x: 'Consultoria fechada: <b>' + esc(c.co) + '</b> · ' + brl(d.v), cls: 'ok' });
    toast('Consultoria fechada · ' + brl(d.v), c.co + '. Meta do mês atualizada.', '', 'Handshake');
    gainXP(300, 'Consultoria fechada · ' + c.co);
    if (d.v > 15000) { const a = DB.game.achievements.find((x) => x.nm === 'Ticket alto'); if (a && !a.got) { a.got = true; a.tier = 'ÚNICA'; a.when = 'out/2026'; setTimeout(() => toast('Conquista desbloqueada: Ticket alto', 'Consultoria acima de R$ 15.000.', 'xp lvl', 'Crown'), 1400); } }
    markGuide('deal');
  } else if (d.p === 'inb' && sid === 'pago') {
    d.next = 'Agendar diagnóstico'; o.metrics.done += d.v;
    toast('Diagnóstico pago', c.co + ' · ' + brl(d.v), '', 'CircleDollarSign'); squadXP(80, 'Diagnóstico vendido · ' + c.co);
  } else {
    const toIdx = PIPE(d.p).stages.findIndex((s) => s.id === sid);
    d.next = toIdx > fromIdx ? 'Avançou para ' + st.nm.toLowerCase() : 'Voltou para ' + st.nm.toLowerCase();
    toast('Negócio movido', c.co + ' → ' + st.nm, '', 'MoveRight');
  }
  rerender();
}
function askLost(id) {
  const d = DL(id), c = CT(d.c);
  const reasons = ['Sem verba no momento', 'Escolheu outra empresa', 'Parou de responder', 'Não era o momento', 'Não tinha o perfil'];
  openModal(modalHead('Por que perdemos ' + esc(c.co) + '?', 'O motivo alimenta o relatório de perdas e a reativação automática.') + `
    <form class="modal-b" data-sub="lost" data-id="${id}">
      <div class="chips" role="radiogroup">${reasons.map((r, i) => `<label class="chip ${i === 0 ? 'on' : ''}" style="cursor:pointer"><input type="radio" name="lr" value="${esc(r)}" ${i === 0 ? 'checked' : ''} style="display:none" data-chg="lostPick">${esc(r)}</label>`).join('')}</div>
      <div class="field"><label for="lrNote">Observação (opcional)</label><textarea class="ta" id="lrNote" rows="3" placeholder="Ex.: pediu para retomar em janeiro"></textarea></div>
      <label class="row" style="font-size:13px"><span class="sw"><input type="checkbox" id="lrReact" checked><span></span></span>Criar lembrete de reativação em 90 dias</label>
    </form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn danger" data-act="submitForm" data-form="lost">Marcar como perdido</button></div>`);
}
CHG.lostPick = (el) => { $$('label.chip', el.closest('form')).forEach((l) => l.classList.toggle('on', l.contains(el))); };
SUB.lost = (f) => { const r = (f.querySelector('input[name=lr]:checked') || {}).value || 'Outro'; const pid = PIPE(DL(f.dataset.id).p).stages.find((s) => s.lost); closeOverlay(); moveDeal(f.dataset.id, pid.id, { reason: r }); };

function timelineFor(d) {
  const c = CT(d.c), pp = PIPE(d.p), idx = pp.stages.findIndex((s) => s.id === d.s);
  const ev = {
    inb: [['Megaphone', 'Clicou no anúncio e chamou no WhatsApp', c.src], ['Bot', O().ia.name + ' iniciou a conversa', 'resposta em 38 s'], ['ListChecks', 'Qualificado pela ' + O().ia.name, 'dor, decisor e momento'], ['QrCode', 'Link do diagnóstico enviado', brl(d.v)], ['CircleDollarSign', 'Pagamento confirmado via Pix', brl(d.v)], ['Video', 'Diagnóstico realizado com a Rebeca', 'resumo gerado para o Closer']],
    cons: [['Handshake', 'Handoff recebido', 'resumo do diagnóstico anexado'], ['CalendarCheck', 'Reunião agendada', 'com ' + U(d.owner).short], ['FileText', 'Proposta enviada', brl(d.v)], ['MessagesSquare', 'Negociação', 'condições em discussão'], ['BadgeCheck', 'Contrato assinado', brl(d.v)]],
    out: [['MapPin', 'Importado do Prospector', 'Google Maps · nota e avaliações'], ['Repeat', 'Cadência de 14 dias iniciada', '8 toques'], ['MessageCircle', 'Respondeu no WhatsApp', 'toque 1'], ['CalendarCheck', 'Reunião marcada', 'diagnóstico']],
    pf: [['Megaphone', 'Clicou no anúncio PF', c.src], ['ListChecks', 'Necessidade entendida', ''], ['Calculator', 'Simulação enviada', brl(d.v)], ['ShieldCheck', 'Documentos pelo canal seguro', 'sem foto no WhatsApp'], ['BadgeCheck', 'Contrato assinado', brl(d.v)]],
    pj: [['UserPlus', 'Primeiro contato', c.src], ['ListChecks', 'Necessidade entendida', ''], ['ShieldCheck', 'Perfil enviado para análise', 'documentos pelo canal seguro'], ['FileText', 'Proposta de crédito apresentada', brl(d.v)], ['BadgeCheck', 'Contrato assinado', brl(d.v)]],
  }[pp.id] || [];
  const stLost = STAGE(d.p, d.s).lost;
  const items = ev.slice(0, stLost ? ev.length - 1 : idx + 1);
  if (stLost) items.push(['CircleX', 'Marcado como perdido', d.next]);
  return items.reverse().map(([icn, t, sub], i) => `<div class="row top-a" style="gap:12px"><span class="ico-box ${i === 0 ? 'cy' : ''}" style="width:30px;height:30px">${ic(icn, 'sm')}</span><div class="grow"><div style="font-weight:500;font-size:13px">${esc(t)}</div><div class="dim" style="font-size:12px">${esc(sub)}${i === 0 ? ' · ' + esc(d.age) : ''}</div></div></div>`).join('');
}
function openDeal(id) {
  const d = DL(id); if (!d) return;
  const c = CT(d.c), pp = PIPE(d.p), st = STAGE(d.p, d.s), cv = O().conversations.find((x) => x.c === c.id);
  const isCons = d.p === 'cons', canHand = d.p === 'inb' && ['pago', 'realizado'].includes(d.s);
  openDrawer(`
    <div class="drawer-h">${contactAv(c, 'l')}<div class="grow"><h3 style="font-size:18px">${esc(c.co)}</h3><div class="muted" style="font-size:13px">${esc(c.nm)} · ${esc(c.seg)} · ${esc(c.city)}</div>
      <div class="row wrap" style="gap:6px;margin-top:8px">${pill(pp.nm, 'line')}${pill(st.nm, st.won ? 'ok' : st.lost ? 'bad' : 'cy')}${temp(d.temp)}</div></div>
      <button class="iconbtn" data-act="close" aria-label="Fechar">${ic('X')}</button></div>
    <div class="drawer-b">
      <div class="col" style="gap:8px"><span class="lbl">Etapa · clique para mover</span>
        <div class="chips">${pp.stages.map((s) => `<button class="chip ${s.id === d.s ? 'on' : ''}" data-act="drawerMove" data-id="${d.id}" data-s="${s.id}">${esc(s.nm)}</button>`).join('')}</div></div>
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <div class="r-stat"><span class="lbl">Valor</span><div class="v num">${brl(d.v)}</div></div>
        <div class="r-stat"><span class="lbl">Chance da etapa</span><div class="v num">${st.p}%</div></div>
        <div class="r-stat"><span class="lbl">Responsável</span><div class="row" style="margin-top:6px">${av(d.owner, 's')}<span>${esc(U(d.owner).name)}</span></div></div>
        <div class="r-stat"><span class="lbl">Origem</span><div style="margin-top:6px;font-size:13px">${esc(c.src)}</div></div>
      </div>
      <div class="row" style="padding:12px;border-radius:10px;background:var(--cy-soft);border:1px solid var(--line-2)"><span class="cy">${ic('Clock', 'sm')}</span><div class="grow"><span class="lbl">Próximo passo</span><div style="font-weight:500">${esc(d.next)}</div></div><button class="btn sm" data-act="newTask" data-deal="${d.id}">Criar tarefa</button></div>
      ${cv && cv.q && Object.keys(cv.q).length ? `<div class="col" style="gap:4px"><span class="lbl">Qualificação</span>${Q_KEYS.filter(([k]) => cv.q[k]).map(([k, nm]) => `<div class="q-item done"><span class="ck">${ic('Check', 'xs')}</span><div><div class="k">${nm}</div><div class="a">${esc(cv.q[k])}</div></div></div>`).join('')}</div>` : ''}
      <div class="col" style="gap:12px"><span class="lbl">Histórico</span>${timelineFor(d)}</div>
    </div>
    <div class="drawer-f">
      ${cv ? `<button class="btn" data-go="atendimento" data-cv="${cv.id}">${ic('MessageCircle', 'sm')}Abrir conversa</button>` : ''}
      ${canHand ? `<button class="btn" data-act="handoff" data-id="${d.id}">${ic('Handshake', 'sm')}Passar para o Closer</button>` : ''}
      ${!st.lost && pp.stages.some((s) => s.lost) ? `<button class="btn danger" data-act="drawerMove" data-id="${d.id}" data-s="perdido">Perdido</button>` : ''}
      ${isCons && !st.won && !st.lost ? `<button class="btn pri" data-act="drawerMove" data-id="${d.id}" data-s="ganho">${ic('BadgeCheck', 'sm')}Marcar como ganho</button>` : ''}
    </div>`);
}
ACT.openDeal = (el) => openDeal(el.dataset.id);
ACT.drawerMove = (el) => {
  const id = el.dataset.id, s = el.dataset.s, d = DL(id);
  if (STAGE(d.p, s).lost) { askLost(id); return; }
  moveDeal(id, s);
  if (d.s === s) openDeal(id);
};
ACT.newDeal = () => {
  closePop();
  const o = O();
  openModal(modalHead('Novo negócio', 'Cria o contato e coloca o negócio na primeira etapa do funil escolhido.') + `
    <form class="modal-b" data-sub="newDeal"><div class="form-g">
      <div class="field"><label for="ndNm">Nome do contato</label><input class="in" id="ndNm" required placeholder="Ex.: Carla Mendes" autofocus></div>
      <div class="field"><label for="ndCo">Empresa</label><input class="in" id="ndCo" required placeholder="Ex.: Mendes Odontologia"></div>
      <div class="field"><label for="ndPh">WhatsApp</label><input class="in" id="ndPh" placeholder="(11) 90000-0000" inputmode="tel"></div>
      <div class="field"><label for="ndSeg">Segmento</label><input class="in" id="ndSeg" placeholder="Ex.: Odontologia"></div>
      <div class="field"><label for="ndPipe">Funil</label><select class="sel" id="ndPipe">${o.pipelines.map((p) => `<option value="${p.id}" ${p.id === S.pipe ? 'selected' : ''}>${esc(p.nm)}</option>`).join('')}</select></div>
      <div class="field"><label for="ndVal">Valor (R$)</label><input class="in" id="ndVal" value="${o.ia.price || 50000}" inputmode="numeric"></div>
    </div></form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="newDeal">Criar negócio</button></div>`);
};
SUB.newDeal = () => {
  const nm = $('#ndNm').value.trim(), co = $('#ndCo').value.trim();
  if (!nm || !co) { toast('Falta preencher', 'Nome e empresa são obrigatórios.', 'warn', 'CircleAlert'); return; }
  const o = O(), pid = $('#ndPipe').value, cid = 'c' + uid();
  o.contacts.unshift({ id: cid, nm, co, seg: $('#ndSeg').value || 'Não informado', city: '—', ph: $('#ndPh').value || '—', em: '—', src: 'Cadastro manual', owner: DB.me, life: 'Lead', score: 30, last: 'agora' });
  o.deals.unshift({ id: 'd' + uid(), c: cid, p: pid, s: PIPE(pid).stages[0].id, v: parseInt($('#ndVal').value.replace(/\D/g, ''), 10) || 0, temp: 'frio', owner: DB.me, next: 'Primeiro contato', age: 'agora', moved: true });
  closeOverlay(); S.pipe = pid;
  toast('Negócio criado', co + ' entrou em ' + PIPE(pid).nm + '.', '', 'Kanban');
  if (S.route === 'funis') rerender(); else go('funis');
};

/* =========================================================
   CONTATOS
   ========================================================= */
const LIFE = ['Lead', 'Qualificado', 'Cliente diagnóstico', 'Cliente consultoria', 'Cliente', 'Perdido'];
const lifeCls = (l) => ({ Lead: 'line', Qualificado: 'cy', 'Cliente diagnóstico': 'gold', 'Cliente consultoria': 'ok', Cliente: 'ok', Perdido: 'bad' })[l] || '';
VIEWS.contatos = {
  title: 'Contatos',
  crumb: 'Comando',
  render() {
    const o = O(), tab = S.tabs.contatos || 'pessoas', f = S.filters;
    const q = norm(f.cq || '');
    const lifes = LIFE.filter((l) => o.contacts.some((c) => c.life === l));
    const rows = o.contacts.filter((c) => !f.life || c.life === f.life).filter((c) => !q || norm(c.nm + ' ' + c.co + ' ' + c.seg + ' ' + c.city).includes(q));
    const companies = rows.map((c) => ({ c, deals: o.deals.filter((d) => d.c === c.id) }));
    return `
    <div class="page-h"><div><h2>Contatos</h2><p>${o.contacts.length} pessoas e ${o.contacts.length} empresas nesta organização. Cada ficha guarda conversas, negócios e consentimento.</p></div>
      <div class="acts"><button class="btn" data-act="importCsv">${ic('Upload', 'sm')}Importar de outro CRM</button><button class="btn pri" data-act="newDeal">${ic('UserPlus', 'sm')}Novo contato</button></div></div>
    <div class="tabs" role="tablist"><button class="${tab === 'pessoas' ? 'on' : ''}" data-act="tab" data-v="contatos:pessoas">${ic('User', 'sm')}Pessoas</button><button class="${tab === 'empresas' ? 'on' : ''}" data-act="tab" data-v="contatos:empresas">${ic('Building', 'sm')}Empresas</button></div>
    <div class="row wrap between" style="gap:10px;margin-bottom:12px">
      <div class="search" style="width:min(320px,100%)">${ic('Search')}<input class="in" id="cq" placeholder="Nome, empresa, segmento ou cidade" value="${esc(f.cq || '')}" data-inp="cq" autocomplete="off"></div>
      <div class="chips"><button class="chip ${!f.life ? 'on' : ''}" data-act="fLife" data-v="">Todos<span class="n">${o.contacts.length}</span></button>${lifes.map((l) => `<button class="chip ${f.life === l ? 'on' : ''}" data-act="fLife" data-v="${l}">${l}<span class="n">${o.contacts.filter((c) => c.life === l).length}</span></button>`).join('')}</div>
    </div>
    <div class="pn"><div class="tbl-w">${tab === 'pessoas' ? `<table class="tbl">
      <thead><tr><th>Pessoa</th><th>Empresa</th><th>Ciclo</th><th>Pontuação</th><th>Origem</th><th>Responsável</th><th>Última interação</th></tr></thead>
      <tbody>${rows.map((c) => `<tr class="click" data-act="openContact" data-id="${c.id}" tabindex="0" role="button">
        <td><div class="row">${contactAv(c)}<div style="min-width:0"><b>${esc(c.nm)}</b><div class="dim" style="font-size:12px">${esc(c.ph)}</div></div></div></td>
        <td><div>${esc(c.co)}</div><div class="dim" style="font-size:12px">${esc(c.seg)} · ${esc(c.city)}</div></td>
        <td>${pill(c.life, lifeCls(c.life))}</td>
        <td style="min-width:110px"><div class="row" style="gap:8px"><span class="num" style="width:22px">${c.score}</span><div class="grow">${bar(c.score, c.score >= 75 ? 'bad thin' : c.score >= 50 ? 'warn thin' : 'thin')}</div></div></td>
        <td class="nowrap">${esc(c.src)}</td><td>${av(c.owner, 's')}</td><td class="nowrap dim">${esc(c.last)}</td></tr>`).join('')}</tbody></table>`
      : `<table class="tbl"><thead><tr><th>Empresa</th><th>Segmento</th><th>Cidade</th><th>Contato principal</th><th class="r">Negócios</th><th class="r">Valor em aberto</th></tr></thead>
      <tbody>${companies.map(({ c, deals }) => `<tr class="click" data-act="openContact" data-id="${c.id}" tabindex="0" role="button"><td><b>${esc(c.co)}</b></td><td>${esc(c.seg)}</td><td>${esc(c.city)}</td><td>${esc(c.nm)}</td><td class="r num">${deals.length}</td><td class="r num">${brl(deals.filter((d) => { const s = STAGE(d.p, d.s); return !s.won && !s.lost; }).reduce((a, d) => a + d.v, 0))}</td></tr>`).join('')}</tbody></table>`}
      ${rows.length ? '' : `<div class="empty">${ic('SearchX')}<div>Nenhum contato com esse filtro.</div></div>`}
    </div></div>`;
  },
};
ACT.tab = (el) => { const [r, v] = el.dataset.v.split(':'); S.tabs[r] = v; rerender(); };
INP.cq = (el) => { S.filters.cq = el.value; rerender(); };
ACT.fLife = (el) => { S.filters.life = el.dataset.v || null; rerender(); };
function openContact(id) {
  const c = CT(id); if (!c) return;
  const deals = O().deals.filter((d) => d.c === c.id), cv = O().conversations.find((x) => x.c === c.id);
  const consent = c.src.startsWith('Meta') ? 'Aceitou contato pelo formulário do anúncio (Meta Lead Ads).' : c.src.startsWith('Prospector') ? 'Dado público do Google Maps. Contato B2B com opção de sair na primeira mensagem.' : 'Contato informado pela própria pessoa.';
  openDrawer(`
    <div class="drawer-h">${contactAv(c, 'l')}<div class="grow"><h3 style="font-size:18px">${esc(c.nm)}</h3><div class="muted" style="font-size:13px">${esc(c.co)} · ${esc(c.seg)}</div><div class="row wrap" style="gap:6px;margin-top:8px">${pill(c.life, lifeCls(c.life))}${pill('Pontuação ' + c.score, 'line mono')}</div></div><button class="iconbtn" data-act="close" aria-label="Fechar">${ic('X')}</button></div>
    <div class="drawer-b">
      <div class="row wrap" style="gap:8px">${cv ? `<button class="btn sm pri" data-go="atendimento" data-cv="${cv.id}">${ic('MessageCircle', 'xs')}Conversa no WhatsApp</button>` : ''}<button class="btn sm" data-act="copy" data-v="${esc(c.ph)}">${ic('Phone', 'xs')}${esc(c.ph)}</button><button class="btn sm" data-act="copy" data-v="${esc(c.em)}">${ic('Mail', 'xs')}Copiar e-mail</button></div>
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <div class="r-stat"><span class="lbl">Cidade</span><div style="margin-top:4px">${esc(c.city)}</div></div>
        <div class="r-stat"><span class="lbl">Origem</span><div style="margin-top:4px">${esc(c.src)}</div></div>
        <div class="r-stat"><span class="lbl">Responsável</span><div class="row" style="margin-top:4px">${av(c.owner, 's')}${esc(U(c.owner).short)}</div></div>
        <div class="r-stat"><span class="lbl">Última interação</span><div style="margin-top:4px">${esc(c.last)}</div></div>
      </div>
      <div class="col" style="gap:8px"><span class="lbl">Negócios</span>${deals.length ? deals.map((d) => `<button class="row between" data-act="openDeal" data-id="${d.id}" style="padding:10px 12px;border:1px solid var(--line);border-radius:9px;text-align:left"><span><b style="font-size:13px">${esc(PIPE(d.p).nm)}</b><div class="dim" style="font-size:12px">${esc(STAGE(d.p, d.s).nm)} · ${esc(d.next)}</div></span><b class="num">${brl(d.v)}</b></button>`).join('') : '<span class="dim">Nenhum negócio ainda.</span>'}</div>
      ${deals[0] ? `<div class="col" style="gap:12px"><span class="lbl">Linha do tempo</span>${timelineFor(deals[0])}</div>` : ''}
      <div class="col" style="gap:8px;padding:12px;border-radius:10px;border:1px solid var(--line)"><span class="lbl">Consentimento e LGPD</span><p style="font-size:13px;color:var(--fg-2)">${consent}</p>
        <label class="row" style="font-size:13px"><span class="sw"><input type="checkbox" data-chg="noContact" data-id="${c.id}" ${c.noContact ? 'checked' : ''}><span></span></span>Não contatar (a IA e a equipe param de enviar mensagens)</label></div>
    </div>`);
}
ACT.openContact = (el) => openContact(el.dataset.id);
CHG.noContact = (el) => { const c = CT(el.dataset.id); c.noContact = el.checked; toast(el.checked ? 'Marcado como "não contatar"' : 'Contato liberado', el.checked ? 'Nenhuma mensagem automática sai para ' + c.nm + '.' : c.nm + ' volta a receber mensagens.', '', el.checked ? 'Ban' : 'Check'); };
ACT.importCsv = () => {
  openModal(modalHead('Importar leads do Prospector', 'Use o arquivo leads_excel.csv que o Prospector gera. Os leads entram no funil Outbound · Prospector.') + `
    <div class="modal-b">
      <div class="drop-zone" id="csvZone">${ic('Upload', 'lg cy')}<div style="margin-top:8px"><b>Arraste o CSV aqui</b> ou clique para escolher</div><div class="dim" style="font-size:12px;margin-top:4px">Colunas lidas: nome, telefone, ramo, cidade, nota, avaliações</div><input type="file" accept=".csv,text/csv" data-chg="csvFile" aria-label="Escolher arquivo CSV"></div>
      <div id="csvOut"></div>
    </div><div class="modal-f"><button class="btn ghost" data-act="csvSample">Usar arquivo de exemplo</button><button class="btn pri" data-act="csvImport" id="csvBtn" disabled>Importar</button></div>`);
  S.csvRows = [];
};
function csvPreview(rows) {
  S.csvRows = rows;
  $('#csvOut').innerHTML = `<div class="pn" style="padding:12px"><div class="row between"><b>${rows.length} leads encontrados</b>${pill('Duplicados ignorados: 0', 'line mono')}</div><div class="col" style="gap:4px;margin-top:8px;font-size:12.5px">${rows.slice(0, 4).map((r) => `<div class="row between"><span>${esc(r[0])}</span><span class="dim">${esc(r[2] || '')} · ${esc(r[3] || '')}</span></div>`).join('')}${rows.length > 4 ? `<div class="dim">e mais ${rows.length - 4}…</div>` : ''}</div></div>`;
  $('#csvBtn').disabled = !rows.length;
}
CHG.csvFile = (el) => {
  const file = el.files && el.files[0]; if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    const lines = String(rd.result).split(/\r?\n/).filter((l) => l.trim());
    const sep = (lines[0] || '').includes(';') ? ';' : ',';
    const rows = lines.slice(1).map((l) => l.split(sep).map((x) => x.replace(/^"|"$/g, '').trim())).filter((r) => r[0]);
    csvPreview(rows.slice(0, 200));
  };
  rd.readAsText(file);
};
ACT.csvSample = () => csvPreview([['Padaria Pão Dourado', '(11) 90000-3301', 'Padaria', 'Osasco/SP'], ['Clínica Vet Amigo Fiel', '(11) 90000-3302', 'Veterinária', 'Barueri/SP'], ['Autoescola Direção Certa', '(11) 90000-3303', 'Autoescola', 'Carapicuíba/SP']]);
ACT.csvImport = () => {
  const o = O(), pipe = o.pipelines.find((p) => p.id === 'out') || o.pipelines[0];
  (S.csvRows || []).forEach((r) => {
    const cid = 'c' + uid();
    o.contacts.push({ id: cid, nm: 'Responsável · ' + r[0], co: r[0], seg: r[2] || '—', city: r[3] || '—', ph: r[1] || '—', em: '—', src: 'Prospector · Google Maps', owner: 'u3', life: 'Lead', score: 40, last: 'agora' });
    o.deals.push({ id: 'd' + uid(), c: cid, p: pipe.id, s: pipe.stages[0].id, v: o.ia.price || 0, temp: 'frio', owner: 'u3', next: 'Toque 1 amanhã · 08:30', age: 'agora', moved: true });
  });
  const n = (S.csvRows || []).length;
  closeOverlay();
  toast(n + ' leads importados', 'Entraram em ' + pipe.nm + ' com a cadência de 14 dias.', '', 'Upload');
  rerender();
};

/* =========================================================
   TAREFAS
   ========================================================= */
VIEWS.tarefas = {
  title: 'Tarefas',
  crumb: 'Comando',
  render() {
    const o = O(), view = S.tabs.tarefas || 'lista', mine = S.filters.tmine !== false;
    const ts = o.tasks.filter((t) => !mine || t.who === DB.me);
    const late = ts.filter((t) => !t.done && t.due < 0), today = ts.filter((t) => !t.done && t.due === 0);
    const next = ts.filter((t) => !t.done && t.due > 0), done = ts.filter((t) => t.done);
    const groups = [['Atrasadas', late, 'bad'], [dayLabel(0, true), today, 'cy'], ...[1, 2, 3, 4, 5].map((k) => [dayLabel(k, true), next.filter((t) => t.due === k), '']), ['Concluídas', done, 'ok']];
    return `
    <div class="page-h"><div><h2>Tarefas</h2><p>Ligações, follow-ups, diagnósticos e reuniões. Tarefa concluída no prazo vale +10 XP; atrasada não pontua, mas libera sua sequência.</p></div>
      <div class="acts"><button class="btn pri" data-act="newTask">${ic('Plus', 'sm')}Nova tarefa</button></div></div>
    <div class="row wrap between" style="gap:10px;margin-bottom:14px">
      <div class="row wrap" style="gap:8px">
        <div class="seg"><button class="${view === 'lista' ? 'on' : ''}" data-act="tab" data-v="tarefas:lista">${ic('List', 'xs')} Lista</button><button class="${view === 'semana' ? 'on' : ''}" data-act="tab" data-v="tarefas:semana">${ic('CalendarDays', 'xs')} Semana</button></div>
        <div class="seg"><button class="${mine ? 'on' : ''}" data-act="tMine" data-v="1">Minhas</button><button class="${!mine ? 'on' : ''}" data-act="tMine" data-v="0">Equipe toda</button></div>
      </div>
      <div class="chips">${pill(late.length + ' atrasadas', late.length ? 'bad' : 'line')}${pill(today.length + ' hoje', 'cy')}${pill(next.length + ' nos próximos dias', 'line')}${pill(done.length + ' concluídas', 'ok')}</div>
    </div>
    ${view === 'lista' && !ts.length ? `<div class="pn"><div class="empty">${ic('SquareCheck')}<div>Nenhuma tarefa por aqui. Crie a primeira em "Nova tarefa".</div></div></div>` : ''}
    ${view === 'lista' ? groups.filter(([, l]) => l.length).map(([nm, l, cls]) => `<section class="pn" style="margin-bottom:12px">
        <div class="pn-h" style="padding-bottom:10px;border-bottom:1px solid var(--line)"><span class="pn-t ${cls}">${nm}</span><span class="dim num" style="font-size:12px">${l.length}</span></div>
        <div>${l.sort(byAt).map(taskHtml).join('')}</div></section>`).join('') : weekHtml(ts)}`;
  },
};
function taskHtml(t) {
  const late = !t.done && t.due < 0, d = t.deal ? DL(t.deal) : null;
  return `<div class="task ${t.done ? 'done' : ''} ${late ? 'late' : ''}">
    <button class="ck" data-act="doneTask" data-id="${t.id}" aria-label="${t.done ? 'Desmarcar' : 'Concluir'}: ${esc(t.t)}" aria-pressed="${!!t.done}">${ic('Check', 'xs')}</button>
    <span class="ico-box ${late ? 'bad' : t.due === 0 ? 'cy' : ''}">${ic(t.type, 'sm')}</span>
    <div style="min-width:0"><div class="tt">${esc(t.t)}</div><div class="dd"><span class="when">${ic('Clock', 'xs')} ${t.due === 0 ? 'hoje' : dayLabel(t.due).toLowerCase()}, ${t.at}</span><span class="row" style="gap:5px">${av(t.who, 's')}${esc(U(t.who).short)}</span>${d ? `<button class="cy" data-act="openDeal" data-id="${d.id}">${ic('Link', 'xs')} ${esc(CT(d.c).co)}</button>` : ''}${t.go ? `<button class="cy" data-go="${t.go}">${ic('ArrowUpRight', 'xs')} abrir</button>` : ''}</div></div>
    <div class="row" style="gap:6px">${t.pri === 'alta' && !t.done ? pill('Alta', 'warn') : ''}${!t.done && !late ? pill('+' + t.xp + ' XP', 'gold mono') : ''}</div>
  </div>`;
}
function weekHtml(ts) {
  const days = [-2, -1, 0, 1, 2, 3, 4];
  return `<div class="week">${days.map((k) => { const l = ts.filter((t) => t.due === k).sort(byAt); return `<div class="pn wd ${k === 0 ? 'today' : ''}"><div class="h"><span>${dayLabel(k)}</span><span class="dim num">${l.length}</span></div>${l.map((t) => `<button class="ev ${t.done ? 'done' : ''}" data-act="${t.deal ? 'openDeal' : 'noop'}" data-id="${t.deal || ''}" style="text-align:left"><b>${t.at} · ${esc(U(t.who).short)}</b>${esc(t.t)}</button>`).join('') || '<span class="dim" style="font-size:12px">Livre</span>'}</div>`; }).join('')}</div>`;
}
ACT.noop = () => {};
ACT.tMine = (el) => { S.filters.tmine = el.dataset.v === '1'; rerender(); };
ACT.doneTask = (el) => {
  const t = O().tasks.find((x) => x.id === el.dataset.id);
  t.done = !t.done;
  if (t.done) {
    if (t.due >= 0) gainXP(t.xp, 'Tarefa concluída no prazo');
    else toast('Tarefa concluída', 'Atrasadas não pontuam, mas param de travar sua sequência.', '', 'Check');
    markGuide('task');
  } else if (t.due >= 0) { ME().xp -= t.xp; ME().seasonXp -= t.xp; refreshChrome(); }
  rerender();
};
ACT.newTask = (el) => {
  closePop();
  const o = O(), dealId = el && el.dataset ? el.dataset.deal : '';
  const types = [['Phone', 'Ligação'], ['MessageCircle', 'Mensagem'], ['Repeat', 'Follow-up'], ['Video', 'Reunião ou diagnóstico'], ['Mail', 'E-mail'], ['ClipboardList', 'Preparação']];
  openModal(modalHead('Nova tarefa', 'Tarefas com negócio vinculado aparecem no histórico do cliente.') + `
    <form class="modal-b" data-sub="newTask"><div class="form-g">
      <div class="field full"><label for="ntT">O que precisa ser feito</label><input class="in" id="ntT" required placeholder="Ex.: Ligar para confirmar o diagnóstico" autofocus></div>
      <div class="field"><label for="ntType">Tipo</label><select class="sel" id="ntType">${types.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
      <div class="field"><label for="ntWho">Responsável</label><select class="sel" id="ntWho">${DB.users.filter((u) => u.orgs.includes(S.org)).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="ntDay">Quando</label><select class="sel" id="ntDay">${[0, 1, 2, 3, 4, 5].map((k) => `<option value="${k}">${dayLabel(k, true)}</option>`).join('')}</select></div>
      <div class="field"><label for="ntAt">Horário</label><input class="in" id="ntAt" type="time" value="15:00"></div>
      <div class="field full"><label for="ntDeal">Negócio vinculado</label><select class="sel" id="ntDeal"><option value="">Nenhum</option>${o.deals.map((d) => `<option value="${d.id}" ${d.id === dealId ? 'selected' : ''}>${esc(CT(d.c).co)} · ${esc(STAGE(d.p, d.s).nm)}</option>`).join('')}</select></div>
    </div></form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="newTask">Criar tarefa</button></div>`);
};
SUB.newTask = () => {
  const t = $('#ntT').value.trim();
  if (!t) { toast('Escreva a tarefa', 'O título é obrigatório.', 'warn', 'CircleAlert'); return; }
  O().tasks.push({ id: 't' + uid(), t, type: $('#ntType').value, who: $('#ntWho').value, due: +$('#ntDay').value, at: $('#ntAt').value || '15:00', deal: $('#ntDeal').value || null, pri: 'média', xp: 10 });
  closeOverlay();
  toast('Tarefa criada', t, '', 'SquareCheck');
  if (S.route === 'tarefas') rerender(); else renderNav();
};

ACT.openOtherTab = (el) => {
  openPop(el, '<span class="lbl">Abrir o funil em outra aba</span>' + Object.values(DB.orgs).map((o) =>
    '<a class="mi" data-act="close" href="' + orgHash('funis', o.id) + '" target="_blank" rel="noopener">' + orgBadge(o, 26) + '<span class="grow"><b style="font-weight:600">' + esc(o.short) + '</b><br><span class="dim" style="font-size:12px">' + o.pipelines.map((p) => esc(p.nm)).join(' · ') + '</span></span>' + ic('ExternalLink', 'sm dim') + '</a>').join('') +
    '<p class="dim" style="font-size:12px;padding:8px 10px 4px;max-width:300px">Cada aba fica com a sua organização. Arraste uma aba para o lado e veja os dois funis ao mesmo tempo.</p>', 'right');
};
