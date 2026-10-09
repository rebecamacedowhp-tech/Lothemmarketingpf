/* LOTHEM Vendas — Financeiro: negociação na ficha do cliente (à vista ou parcelado, Pix, cartão ou boleto),
   controle das parcelas e aviso ao cliente um dia antes do vencimento. */

const PAY_M = { pix: ['Pix', 'QrCode'], cartao: ['Cartão', 'CreditCard'], boleto: ['Boleto', 'Barcode'], dinheiro: ['Dinheiro', 'Banknote'], transferencia: ['Transferência', 'ArrowLeftRight'] };
const FIN_TPL = 'Oi, {nome}! Passando para lembrar que a parcela {parcela} de {total}, no valor de {valor}, vence amanhã ({vencimento}). Se já pagou, pode desconsiderar. Qualquer dúvida, é só me chamar aqui.';

/* datas no formato AAAA-MM-DD; na demonstração, "hoje" é 07/10/2026 */
const finToday = () => (typeof REAL !== 'undefined' && REAL.on ? new Date().toISOString().slice(0, 10) : '2026-10-07');
const dAdd = (iso, days) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const mAdd = (iso, months) => { const d = new Date(iso + 'T12:00:00'), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + months); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return d.toISOString().slice(0, 10); };
const dBR = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—');
const dShort = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
function instState(p) {
  const t = finToday();
  if (p.paidAt) return { k: 'pago', nm: 'Pago', cls: 'ok' };
  if (p.due < t) return { k: 'atrasado', nm: 'Atrasado', cls: 'bad' };
  if (p.due === t) return { k: 'hoje', nm: 'Vence hoje', cls: 'warn' };
  if (p.due === dAdd(t, 1)) return { k: 'amanha', nm: 'Vence amanhã', cls: 'gold' };
  return { k: 'aberto', nm: 'A vencer', cls: 'line' };
}
function splitInst(total, n, first) {
  const base = Math.floor((total / n) * 100) / 100, out = [];
  for (let i = 0; i < n; i++) out.push({ n: i + 1, due: mAdd(first, i), v: i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base });
  return out;
}
const finAll = (o) => (o.sales || []).flatMap((s) => s.inst.map((p) => Object.assign({ s }, p, { ref: p })));
function finMsg(o, s, p) {
  const c = CT(s.c) || { nm: '' };
  return (o.finance && o.finance.tpl || FIN_TPL).replace('{nome}', c.nm.split(' ')[0]).replace('{parcela}', p.n).replace('{total}', s.n).replace('{valor}', brl(p.v, 2)).replace('{vencimento}', dShort(p.due)).replace('{produto}', s.product || '');
}

/* ---------- dados de demonstração ---------- */
(function demoFin() {
  const t = '2026-10-07';
  const mk = (o, c, product, total, method, mode, n, first, paidUntil, extra) => {
    const inst = splitInst(total, n, first).map((p) => Object.assign(p, { id: 'i' + uid(), paidAt: p.due <= paidUntil ? p.due : null }));
    (o.sales = o.sales || []).push(Object.assign({ id: 's' + uid(), c, product, total, method, mode, n, seller: 'u1', date: first, inst }, extra || {}));
  };
  const cr = DB.orgs.cred, m = DB.orgs.mkt;
  if (cr) {
    cr.contacts.push(
      { id: 'k20', nm: 'Tiago Martins', co: 'Martins Pizzaria', seg: 'Alimentação', city: 'Sumaré/SP', ph: '(19) 90000-3140', em: 'tiago@martins.exemplo', src: 'Meta · Vídeo Rebeca', owner: 'u1', life: 'Cliente consultoria', score: 95, last: '20/08' },
      { id: 'k21', nm: 'Helena Duarte', co: 'Duarte Moda', seg: 'Varejo de moda', city: 'Campinas/SP', ph: '(19) 90000-3141', em: 'helena@duarte.exemplo', src: 'Indicação', owner: 'u1', life: 'Cliente consultoria', score: 96, last: '15/09' });
    mk(cr, 'k8', 'Consultoria', 3897, 'boleto', 'parcelado', 6, '2026-09-08', '2026-09-30');
    mk(cr, 'k20', 'Consultoria', 4500, 'boleto', 'parcelado', 5, '2026-08-20', '2026-08-31', { notes: 'Pediu para pagar dia 20.' });
    mk(cr, 'k21', 'Consultoria', 3897, 'cartao', 'parcelado', 10, '2026-09-15', '2026-09-30');
    mk(cr, 'k3', 'Diagnóstico + Rota de Crédito', 149, 'cartao', 'parcelado', 3, '2026-10-07', t);
    mk(cr, 'k4', 'Diagnóstico + PF do sócio', 164, 'pix', 'avista', 1, t, t);
    mk(cr, 'k5', 'Diagnóstico Completo', 97, 'pix', 'avista', 1, '2026-10-06', t);
    mk(cr, 'k6', 'Diagnóstico Completo', 97, 'boleto', 'avista', 1, '2026-10-05', t);
    mk(cr, 'k7', 'Consultoria', 3897, 'boleto', 'parcelado', 3, '2026-10-08', '2000-01-01', { notes: 'Entrada no fechamento, depois todo dia 8.' });
    cr.sales.find((s) => s.c === 'k8').inst.find((p) => p.n === 2).remindAt = null;
    cr.finance = { remind: true, hour: '09:00', tpl: FIN_TPL };
  }
  if (m && m.contacts.length > 3) {
    mk(m, m.contacts[0].id, 'Consultoria', 11000, 'boleto', 'parcelado', 4, '2026-09-10', '2026-09-30');
    mk(m, m.contacts[1].id, 'Diagnóstico Estratégico', 497, 'pix', 'avista', 1, '2026-10-06', t);
    mk(m, m.contacts[2].id, 'Diagnóstico Estratégico', 497, 'cartao', 'parcelado', 3, '2026-10-02', t);
    m.finance = { remind: true, hour: '09:00', tpl: FIN_TPL };
  }
  Object.values(DB.orgs).forEach((o) => { o.sales = o.sales || []; o.finance = o.finance || { remind: true, hour: '09:00', tpl: FIN_TPL }; });
})();

/* ---------- tela Financeiro ---------- */
NAV[0].items.splice(NAV[0].items.findIndex((i) => i.id === 'campanhas') + 1, 0, { id: 'financeiro', nm: 'Financeiro', ic: 'Banknote' });
VIEWS.financeiro = {
  title: 'Financeiro',
  crumb: 'Comando',
  render() {
    const o = O(), t = finToday(), month = t.slice(0, 7), all = finAll(o), tab = S.tabs.financeiro || 'receber';
    const sum = (a) => a.reduce((x, p) => x + p.v, 0);
    const recebido = all.filter((p) => p.paidAt && p.paidAt.slice(0, 7) === month);
    const aberto = all.filter((p) => !p.paidAt), atras = aberto.filter((p) => p.due < t), prox30 = aberto.filter((p) => p.due >= t && p.due <= dAdd(t, 30));
    const vendasMes = (o.sales || []).filter((s) => s.date.slice(0, 7) === month), av = vendasMes.filter((s) => s.mode === 'avista'), pc = vendasMes.filter((s) => s.mode === 'parcelado');
    const amanha = aberto.filter((p) => p.due === dAdd(t, 1));
    const kpi = (k, v, sub, icn, cls) => `<div class="pn kpi" style="cursor:default"><span class="lbl">${k}</span><div class="row between"><span class="v num ${cls || ''}">${v}</span><span class="ico-box ${cls || 'cy'}">${ic(icn, 'sm')}</span></div><div class="ft"><span>${sub}</span></div></div>`;
    const tabs = [['receber', 'A receber', 'CalendarClock', aberto.length - atras.length], ['atrasadas', 'Atrasadas', 'TriangleAlert', atras.length], ['recebido', 'Recebido', 'CircleCheck'], ['vendas', 'Vendas', 'Receipt', (o.sales || []).length], ['avisos', 'Aviso de vencimento', 'BellRing']];
    let body = '';
    if (tab === 'receber' || tab === 'atrasadas' || tab === 'recebido') {
      const rows = tab === 'receber' ? aberto.filter((p) => p.due >= t).sort((a, b) => (a.due < b.due ? -1 : 1)) : tab === 'atrasadas' ? atras.sort((a, b) => (a.due < b.due ? -1 : 1)) : all.filter((p) => p.paidAt).sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
      body = rows.length ? `<div class="pn"><div class="tbl-w"><table class="tbl"><thead><tr><th>${tab === 'recebido' ? 'Pago em' : 'Vencimento'}</th><th>Cliente</th><th>Produto</th><th>Parcela</th><th>Forma</th><th class="r">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
        ${rows.map((p) => { const c = CT(p.s.c) || { nm: '—', co: '' }, st = instState(p); return `<tr><td class="num nowrap">${dBR(tab === 'recebido' ? p.paidAt.slice(0, 10) : p.due)}</td><td><button class="link" data-act="openContact" data-id="${c.id}">${esc(c.nm)}</button><div class="dim" style="font-size:12px">${esc(c.co || '')}</div></td><td>${esc(p.s.product || '—')}</td><td class="num nowrap">${p.s.mode === 'avista' ? 'À vista' : p.n + ' de ' + p.s.n}</td><td class="nowrap">${ic(PAY_M[p.s.method][1], 'xs dim')} ${PAY_M[p.s.method][0]}</td><td class="r num nowrap">${brl(p.v, 2)}</td>
          <td class="nowrap">${pill(st.nm, st.cls)}${st.k === 'amanha' && o.finance.remind ? ' ' + pill(p.remindAt ? 'Avisado' : 'Aviso hoje ' + o.finance.hour, p.remindAt ? 'ok' : 'cy', 'BellRing') : ''}</td>
          <td class="r nowrap">${p.paidAt ? `<button class="btn xs ghost" data-act="finUnpay" data-id="${p.id}">Desfazer</button>` : `${st.k === 'amanha' || st.k === 'atrasado' || st.k === 'hoje' ? `<button class="btn xs ghost" data-act="finRemind" data-id="${p.id}" title="Mandar a mensagem agora">${ic('Send', 'xs')}</button> ` : ''}<button class="btn xs" data-act="finPay" data-id="${p.id}">${ic('Check', 'xs')}Recebi</button>`}</td></tr>`; }).join('')}
      </tbody></table></div></div>` : `<div class="pn"><div class="empty">${ic('CircleCheck')}<div>${tab === 'atrasadas' ? 'Nenhuma parcela atrasada.' : tab === 'recebido' ? 'Nada recebido ainda.' : 'Nenhuma parcela a vencer.'}</div></div></div>`;
    } else if (tab === 'vendas') {
      body = `<div class="pn"><div class="tbl-w"><table class="tbl"><thead><tr><th>Data</th><th>Cliente</th><th>Produto</th><th>Condição</th><th>Forma</th><th class="r">Total</th><th>Recebido</th></tr></thead><tbody>
        ${(o.sales || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => { const c = CT(s.c) || { nm: '—' }, pg = s.inst.filter((p) => p.paidAt), late = s.inst.some((p) => !p.paidAt && p.due < t); return `<tr><td class="num nowrap">${dBR(s.date)}</td><td><button class="link" data-act="openContact" data-id="${c.id}">${esc(c.nm)}</button></td><td>${esc(s.product || '—')}</td><td>${s.mode === 'avista' ? pill('À vista', 'cy') : pill(s.n + 'x', 'gold')}</td><td class="nowrap">${PAY_M[s.method][0]}</td><td class="r num nowrap">${brl(s.total, 2)}</td><td style="min-width:150px"><div class="row" style="gap:8px">${bar(pct(pg.length, s.n), late ? 'bad' : '')}<span class="num dim nowrap" style="font-size:12px">${pg.length}/${s.n}</span></div></td></tr>`; }).join('') || '<tr><td colspan="7" class="dim">Nenhuma venda registrada. Registre pela ficha do cliente.</td></tr>'}
      </tbody></table></div></div>`;
    } else {
      const ex = amanha[0] || aberto[0];
      body = `<div class="grid g-12">
        <section class="pn s-7"><div class="pn-h"><span class="pn-t">${ic('BellRing')}Aviso um dia antes do vencimento</span></div>
          <div class="pn-b col" style="gap:14px">
            <div class="set-row" style="padding-top:0"><div><div class="tt">Mandar o aviso pelo WhatsApp</div><div class="dd">A ${esc(o.ia.name)} manda a mensagem no dia anterior ao vencimento de cada parcela.</div></div><span class="sw"><input type="checkbox" ${o.finance.remind ? 'checked' : ''} data-chg="finRemindOn" aria-label="Aviso de vencimento"><span></span></span></div>
            <div class="field" style="max-width:200px"><label for="finHour">Horário do envio</label><input class="in" type="time" id="finHour" value="${o.finance.hour}" data-chg="finHour"></div>
            <form class="field" data-sub="finTpl"><label for="finTplIn">Mensagem</label><textarea class="ta" id="finTplIn" rows="4">${esc(o.finance.tpl)}</textarea><span class="hint">Use {nome}, {parcela}, {total}, {valor}, {vencimento} e {produto}.</span><div><button class="btn sm" type="submit" style="margin-top:8px">Salvar mensagem</button></div></form>
            ${typeof REAL !== 'undefined' && REAL.on ? `<div class="row top-a" style="gap:8px;font-size:12.5px;padding:10px 12px;border-radius:9px;background:var(--warn-soft)"><span class="warn">${ic('Info', 'sm')}</span><span>O envio automático começa quando o WhatsApp estiver conectado. Até lá, use o botão de enviar na parcela para copiar a mensagem.</span></div>` : ''}
          </div></section>
        <section class="pn s-5"><div class="pn-h"><span class="pn-t">${ic('MessageCircle')}Como o cliente recebe</span></div>
          <div class="pn-b col" style="gap:12px">${ex ? `<div class="msg out" style="max-width:100%"><div class="who">${ic('Bot', 'xs')}${esc(o.ia.name)}</div>${esc(finMsg(o, ex.s, ex))}<div class="meta">${o.finance.hour}</div></div>` : '<div class="dim">Sem parcelas em aberto.</div>'}
          <span class="lbl" style="margin-top:6px">Avisos de amanhã (${amanha.length})</span>
          ${amanha.map((p) => { const c = CT(p.s.c) || { nm: '—' }; return `<div class="row between" style="font-size:13px;gap:8px"><span>${esc(c.nm)} · ${brl(p.v, 2)}</span>${p.remindAt ? pill('Enviado', 'ok') : `<button class="btn xs" data-act="finRemind" data-id="${p.id}">Enviar agora</button>`}</div>`; }).join('') || '<div class="dim" style="font-size:13px">Nenhuma parcela vence amanhã.</div>'}</div></section></div>`;
    }
    return `
    <div class="page-h"><div><h2>Financeiro</h2><p>O que entrou, o que vai entrar e o que está atrasado. As vendas são registradas na ficha de cada cliente.</p></div></div>
    <div class="kpis" style="margin-bottom:18px">
      ${kpi('Recebido no mês', brl(sum(recebido)), recebido.length + ' pagamentos', 'CircleCheck', 'ok')}
      ${kpi('A receber · 30 dias', brl(sum(prox30)), prox30.length + ' parcelas', 'CalendarClock')}
      ${kpi('Em atraso', brl(sum(atras)), atras.length + (atras.length === 1 ? ' parcela' : ' parcelas'), 'TriangleAlert', atras.length ? 'bad' : '')}
      ${kpi('Vendas do mês', brl(vendasMes.reduce((a, s) => a + s.total, 0)), av.length + ' à vista · ' + pc.length + ' parceladas', 'Receipt')}
    </div>
    <div class="tabs" role="tablist">${tabs.map(([id, nm, icn, n]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="financeiro:${id}" role="tab">${ic(icn, 'sm')}${nm}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>
    ${body}`;
  },
};
const finFind = (id) => { for (const s of O().sales || []) { const p = s.inst.find((x) => x.id === id); if (p) return [s, p]; } return [null, null]; };
ACT.finPay = (el) => {
  const [s, p] = finFind(el.dataset.id); if (!p) return;
  p.paidAt = finToday() + 'T12:00:00';
  if (typeof REAL !== 'undefined' && REAL.on) REAL.sb.from('installments').update({ paid_at: new Date().toISOString() }).eq('id', p.id).then((r) => { if (r.error) toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); });
  toast('Pagamento registrado', (CT(s.c) || {}).nm + ' · ' + brl(p.v, 2), '', 'CircleCheck'); rerender();
};
ACT.finUnpay = (el) => {
  const [, p] = finFind(el.dataset.id); if (!p) return;
  p.paidAt = null;
  if (typeof REAL !== 'undefined' && REAL.on) REAL.sb.from('installments').update({ paid_at: null }).eq('id', p.id).then(() => {});
  rerender();
};
ACT.finRemind = (el) => {
  const o = O(), [s, p] = finFind(el.dataset.id); if (!p) return;
  const txt = finMsg(o, s, p);
  if (typeof REAL !== 'undefined' && REAL.on) {
    try { navigator.clipboard.writeText(txt); } catch (e) { /* sem área de transferência */ }
    toast('Mensagem copiada', 'Cole no WhatsApp do cliente. O envio automático liga quando o WhatsApp estiver conectado.', '', 'Copy');
    REAL.sb.from('installments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', p.id).then(() => {});
  } else toast('Aviso enviado pelo WhatsApp', txt, '', 'BellRing');
  p.remindAt = finToday(); rerender();
};
CHG.finRemindOn = (el) => { O().finance.remind = el.checked; finSaveSettings(); toast(el.checked ? 'Aviso de vencimento ligado' : 'Aviso de vencimento desligado', '', '', 'BellRing'); rerender(); };
CHG.finHour = (el) => { O().finance.hour = el.value || '09:00'; finSaveSettings(); };
SUB.finTpl = () => { O().finance.tpl = $('#finTplIn').value.trim() || FIN_TPL; finSaveSettings(); toast('Mensagem salva', '', '', 'MessageCircle'); rerender(); };
function finSaveSettings() { if (typeof REAL !== 'undefined' && REAL.on && REAL.saveSettings) REAL.saveSettings(O(), (st) => { st.finance = O().finance; }); }

/* ---------- ficha do cliente: negociação ---------- */
const finBaseOpenContact = openContact;
openContact = function (id) {
  finBaseOpenContact(id);
  const o = O(), c = CT(id), b = $('#overlay .drawer-b'); if (!c || !b) return;
  const sales = (o.sales || []).filter((s) => s.c === id), t = finToday();
  const box = document.createElement('div');
  box.className = 'col svc-box';
  box.innerHTML = `<div class="row between"><span class="lbl">Negociação e pagamento</span><button class="btn xs" data-act="finNew" data-c="${id}">${ic('Plus', 'xs')}Registrar negociação</button></div>
    ${sales.map((s) => { const pg = s.inst.filter((p) => p.paidAt).length, next = s.inst.find((p) => !p.paidAt); return `<div class="r-stat col" style="gap:6px"><div class="row between" style="gap:8px"><b style="font-size:13.5px">${esc(s.product || 'Venda')}</b><b class="num">${brl(s.total, 2)}</b></div>
      <div class="row wrap" style="gap:6px">${s.mode === 'avista' ? pill('À vista', 'cy') : pill(s.n + 'x de ' + brl(s.inst[0].v, 2), 'gold')}${pill(PAY_M[s.method][0], 'line')}${pill(pg + ' de ' + s.n + ' pagas', pg === s.n ? 'ok' : 'line')}</div>
      ${next ? `<div class="dim" style="font-size:12.5px">Próxima: ${dBR(next.due)} · ${brl(next.v, 2)}${next.due < t ? ' · <span class="bad">atrasada</span>' : ''}</div>` : '<div class="dim" style="font-size:12.5px">Tudo pago.</div>'}
      ${s.notes ? `<div class="dim" style="font-size:12.5px">${esc(s.notes)}</div>` : ''}</div>`; }).join('') || '<div class="dim" style="font-size:13px">Nenhuma negociação registrada.</div>'}`;
  b.insertBefore(box, b.children[2] || null);
};
ACT.finNew = (el) => {
  const o = O(), c = CT(el.dataset.c), d = o.deals.find((x) => x.c === c.id);
  S.finForm = { c: c.id, deal: d ? d.id : null, product: d && d.product || '', total: d ? d.v : 0, method: 'pix', mode: 'avista', n: 3, first: finToday(), paid: true, notes: '' };
  finModal();
};
function finModal() {
  const o = O(), F = S.finForm, c = CT(F.c);
  const prev = F.mode === 'parcelado' ? splitInst(Number(F.total) || 0, F.n, F.first) : [];
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, nm]) => `<button type="button" class="${F[k] === v ? 'on' : ''}" data-act="finSet" data-k="${k}" data-v="${v}">${nm}</button>`).join('')}</div>`;
  openModal(modalHead('Negociação · ' + esc(c.nm), 'O que foi combinado com o cliente.') + `<form class="modal-b col" style="gap:14px" data-sub="finSave">
    <div class="form-g"><div class="field"><label for="fnProd">Produto</label><input class="in" id="fnProd" list="fnProds" value="${esc(F.product)}" placeholder="Ex.: Consultoria"><datalist id="fnProds">${(o.products || []).map((p) => `<option value="${esc(p.nm)}">`).join('')}</datalist></div>
    <div class="field"><label for="fnTotal">Valor total (R$)</label><input class="in" id="fnTotal" inputmode="decimal" value="${F.total || ''}" data-inp="finTotal" required></div></div>
    <div class="field"><label>Condição</label>${seg('mode', [['avista', 'À vista'], ['parcelado', 'Parcelado']])}</div>
    <div class="field"><label>Forma de pagamento</label>${seg('method', [['pix', 'Pix'], ['cartao', 'Cartão'], ['boleto', 'Boleto'], ['dinheiro', 'Dinheiro'], ['transferencia', 'Transferência']])}</div>
    ${F.mode === 'parcelado' ? `<div class="form-g"><div class="field"><label for="fnN">Parcelas</label><select class="sel" id="fnN" data-chg="finN">${Array.from({ length: 23 }, (_, i) => i + 2).map((n) => `<option ${F.n === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label for="fnFirst">1º vencimento</label><input class="in" type="date" id="fnFirst" value="${F.first}" data-chg="finFirst"></div></div>
      <div class="r-stat col" style="gap:4px;max-height:160px;overflow:auto">${prev.map((p) => `<div class="row between" style="font-size:12.5px"><span>Parcela ${p.n} · ${dBR(p.due)}</span><b class="num">${brl(p.v, 2)}</b></div>`).join('')}</div>
      <span class="hint">O cliente recebe um aviso no WhatsApp um dia antes de cada vencimento.</span>`
    : `<div class="form-g"><div class="field"><label for="fnFirst">Data do pagamento</label><input class="in" type="date" id="fnFirst" value="${F.first}" data-chg="finFirst"></div>
      <label class="row" style="gap:10px;font-size:13px;align-self:end;padding-bottom:10px"><input type="checkbox" ${F.paid ? 'checked' : ''} data-chg="finPaid"> Já recebido</label></div>`}
    <div class="field"><label for="fnNotes">Observação</label><input class="in" id="fnNotes" value="${esc(F.notes)}" placeholder="Ex.: pediu para pagar todo dia 10"></div>
  </form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="finSave">Salvar negociação</button></div>`);
}
const finKeep = () => { const F = S.finForm; if (!F) return; ['fnProd:product', 'fnTotal:total', 'fnNotes:notes'].forEach((x) => { const [id, k] = x.split(':'), e = $('#' + id); if (e) F[k] = e.value; }); };
ACT.finSet = (el) => { finKeep(); S.finForm[el.dataset.k] = el.dataset.v; if (el.dataset.k === 'mode' && el.dataset.v === 'parcelado' && S.finForm.first === finToday()) S.finForm.first = mAdd(finToday(), 1); finModal(); };
CHG.finN = (el) => { finKeep(); S.finForm.n = Number(el.value); finModal(); };
CHG.finFirst = (el) => { finKeep(); S.finForm.first = el.value || finToday(); finModal(); };
CHG.finPaid = (el) => { S.finForm.paid = el.checked; };
INP.finTotal = () => {};
SUB.finSave = async () => {
  finKeep();
  const o = O(), F = S.finForm, total = Number(String(F.total).replace(/\./g, '').replace(',', '.')) || 0;
  if (!total) { toast('Informe o valor total', '', 'warn', 'CircleAlert'); return; }
  const n = F.mode === 'parcelado' ? F.n : 1;
  const inst = (n > 1 ? splitInst(total, n, F.first) : [{ n: 1, due: F.first, v: total }]).map((p) => Object.assign(p, { id: 'i' + uid(), paidAt: n === 1 && F.paid ? F.first + 'T12:00:00' : null }));
  const sale = { id: 's' + uid(), c: F.c, deal: F.deal, product: F.product.trim(), total, method: F.method, mode: n > 1 ? 'parcelado' : 'avista', n, seller: DB.me, date: finToday(), notes: F.notes.trim(), inst };
  if (typeof REAL !== 'undefined' && REAL.on) {
    const sb = REAL.sb, r = await sb.from('sales').insert({ org_id: o.id, contact_id: F.c, deal_id: F.deal, product: sale.product || null, total, method: F.method, mode: sale.mode, installments: n, seller_id: DB.me, notes: sale.notes || null }).select().single();
    if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); return; }
    sale.id = r.data.id;
    const ri = await sb.from('installments').insert(inst.map((p) => ({ org_id: o.id, sale_id: sale.id, n: p.n, due: p.due, value: p.v, paid_at: p.paidAt ? new Date().toISOString() : null }))).select();
    if (ri.error) { toast('Não consegui salvar as parcelas', ri.error.message, 'bad', 'CircleAlert'); return; }
    ri.data.forEach((row, i) => { inst[i].id = row.id; });
  }
  (o.sales = o.sales || []).push(sale);
  closeOverlay();
  toast('Negociação salva', sale.mode === 'avista' ? 'À vista · ' + brl(total, 2) : n + 'x de ' + brl(inst[0].v, 2) + ' · aviso um dia antes de cada vencimento', '', 'Wallet');
  openContact(F.c);
};
