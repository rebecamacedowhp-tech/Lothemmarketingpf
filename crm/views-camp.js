/* LOTHEM Vendas — Campanhas (métricas do Meta), serviços na ficha do cliente e produto no negócio. */

/* ---------- dados de demonstração para essas telas ---------- */
(function demoExtras() {
  const m = DB.orgs.mkt, c = DB.orgs.cred, p = DB.orgs.pf;
  m.products = [{ nm: 'Diagnóstico Estratégico', price: 497 }, { nm: 'Consultoria', price: 11000 }];
  m.services = [];
  c.products = [{ nm: 'Diagnóstico Completo', price: 97 }, { nm: 'Diagnóstico + Rota de Crédito', price: 149 }, { nm: 'Diagnóstico PF (CPF do sócio)', price: 67 }, { nm: 'Rating PJ', price: 0 }, { nm: 'Consultoria', price: 3897 }];
  c.services = ['Contabilidade: balanço e DRE', 'Contabilidade: regularização fiscal', 'Contabilidade: organização do faturamento', 'Rating PJ', 'Limpa nome (CNPJ)', 'Limpa nome (CPF do sócio)', 'Consultoria de crédito'];
  p.products = [{ nm: 'Diagnóstico PF', price: 67 }, { nm: 'Consultoria', price: 3897 }];
  p.services = ['Limpa nome', 'Rating / score', 'Organização das dívidas', 'Consultoria de crédito'];
  [m, c, p].forEach((o) => {
    const ticket = o.id === 'mkt' ? 11000 : o.id === 'cred' ? 3897 : 3897;
    const front = o.id === 'mkt' ? 497 : 97;
    o.camps = o.metrics.campaigns.map((x, i) => ({
      id: o.id + '-cp' + i, nm: x.nm, spend: x.inv, clk: x.leads * 6 + i * 7, imp: (x.leads * 6 + i * 7) * 48, pleads: x.leads, status: 'ativa',
      m: { video: /v[ií]deo/i.test(x.nm), checkout: false, reach: Math.round((x.leads * 6 + i * 7) * 48 / 1.7), thruplays: /v[ií]deo/i.test(x.nm) ? x.leads * 40 : 0, landing_views: Math.round((x.leads * 6 + i * 7) * 0.82), engagement: x.leads * 11 },
      demo: { leads: x.leads, sales: x.c, revenue: x.c * ticket + x.d * front },
    }));
  });
})();

/* ---------- cálculo das métricas (topo, meio e fundo de funil) ---------- */
function campStats(o, cp) {
  const m = cp.m || {};
  const s = cp.spend || 0;
  const n = (k) => Number(m[k] || 0);
  const imp = cp.imp || 0, reach = n('reach'), clk = cp.clk || 0, leads = cp.pleads || 0;
  let crmLeads, crmSales, crmRevenue;
  if (cp.demo) ({ leads: crmLeads, sales: crmSales, revenue: crmRevenue } = cp.demo);
  else {
    const won = o.deals.filter((d) => d.camp === cp.id && (STAGE(d.p, d.s) || {}).won);
    crmLeads = o.contacts.filter((c) => c.camp === cp.id).length;
    crmSales = won.length;
    crmRevenue = won.reduce((a, d) => a + d.v, 0);
  }
  const purchases = n('purchases'), value = n('purchase_value'), ic = n('checkouts');
  const r = {
    spend: s,
    top: { reach, imp, cpm: imp ? (s / imp) * 1000 : null, freq: reach ? imp / reach : null, thru: n('thruplays') },
    mid: { clk, cpc: clk ? s / clk : null, lpv: n('landing_views'), eng: n('engagement'), leads, cpl: leads ? s / leads : null },
    bot: { purchases, cpa: purchases ? s / purchases : null, roas: s ? value / s : null, roi: s ? ((value - s) / s) * 100 : null, ic, value },
    crm: { leads: crmLeads, sales: crmSales, revenue: crmRevenue, roi: s ? ((crmRevenue - s) / s) * 100 : null },
  };
  const roi = m.checkout ? r.bot.roi : r.crm.roi, sales = m.checkout ? purchases : crmSales, lds = m.checkout ? clk : Math.max(leads, crmLeads);
  if (!s) r.verdict = ['Sem dados', 'line', 'Lance o investimento para calcular.'];
  else if (!sales && lds < 10) r.verdict = ['Observar', 'gold', 'Ainda é cedo para julgar.'];
  else if (!sales) r.verdict = ['Revisar', 'bad', 'Já tem volume e nenhuma venda: reveja público, criativo ou atendimento.'];
  else if (roi >= 0) r.verdict = ['Continuar', 'ok', 'Já paga o investimento.'];
  else r.verdict = ['Ajustar', 'warn', 'Vende, mas ainda não paga o investimento.'];
  return r;
}
const pctTxt = (v) => (v == null ? '—' : fmt(v, 1) + '%');
const brlTxt = (v, d = 2) => (v == null ? '—' : brl(v, d));
const numTxt = (v) => (v ? fmt(v) : '—');
const mGrid = (items) => `<div class="camp-grid">${items.map(([k, v, tip]) => `<div title="${esc(tip || '')}"><span class="lbl">${k}</span><b class="num">${v}</b></div>`).join('')}</div>`;

VIEWS.campanhas = {
  title: 'Campanhas',
  crumb: 'Comando',
  render() {
    const o = O(), camps = o.camps || [];
    const rows = camps.map((cp) => ({ cp, st: campStats(o, cp) }));
    const tot = rows.reduce((a, { st }) => ({ spend: a.spend + st.spend, leads: a.leads + Math.max(st.mid.leads, st.crm.leads), sales: a.sales + (st.bot.purchases || st.crm.sales) }), { spend: 0, leads: 0, sales: 0 });
    return `
    <div class="page-h"><div><h2>Campanhas</h2><p>Topo, meio e fundo de funil de cada campanha, e o que ela trouxe de venda no CRM.</p></div>
      <div class="acts"><button class="btn pri" data-act="campEdit">${ic('Plus', 'sm')}Adicionar campanha</button></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:24px">
      ${[['Investido', brl(tot.spend)], ['Leads', fmt(tot.leads)], ['Vendas', fmt(tot.sales)]].map(([k, v]) => `<div class="pn kpi" style="cursor:default"><span class="kpi-l">${k}</span><span class="v num">${v}</span></div>`).join('')}
    </div>
    ${!rows.length ? `<div class="pn"><div class="empty">${ic('Megaphone')}<div><b>Nenhuma campanha ainda.</b></div><p class="muted" style="margin-top:6px">Adicione a campanha com os números do Gerenciador de Anúncios. Depois, ao criar um negócio, escolha de qual campanha o lead veio.</p><button class="btn pri" style="margin-top:16px" data-act="campEdit">Adicionar campanha</button></div></div>` : `
    <div class="col" style="gap:20px">${rows.map(({ cp, st }) => { const m = cp.m || {}; return `<section class="pn camp-card">
      <div class="row between wrap" style="gap:12px"><div style="min-width:0"><b style="font-size:16px">${esc(cp.nm)}</b><div class="dim" style="font-size:13px">${brl(st.spend)} investidos · ${m.video ? 'criativo em vídeo' : 'criativo em imagem'} · ${m.checkout ? 'leva direto ao checkout' : 'leva para WhatsApp ou formulário'}</div></div>
        <div class="row" style="gap:10px">${pill(st.verdict[0], st.verdict[1])}<button class="btn sm" data-act="campEdit" data-id="${cp.id}">Atualizar números</button></div></div>
      <div class="dim" style="font-size:13px;margin-top:-8px">${esc(st.verdict[2])}</div>
      <div class="funnel-sec"><span class="fs-t">Topo de funil</span>${mGrid([['Alcance', numTxt(st.top.reach)], ['Impressões', numTxt(st.top.imp)], ['CPM', brlTxt(st.top.cpm), 'Custo por mil impressões'], ['Frequência', st.top.freq == null ? '—' : fmt(st.top.freq, 2), 'Impressões ÷ alcance'], ...(m.video ? [['ThruPlays', numTxt(st.top.thru)]] : [])])}</div>
      <div class="funnel-sec"><span class="fs-t">Meio de funil</span>${mGrid([['Cliques no link', numTxt(st.mid.clk)], ['CPC', brlTxt(st.mid.cpc), 'Custo por clique no link'], ['Visualizações da página', numTxt(st.mid.lpv)], ['Engajamento', numTxt(st.mid.eng)], ['CPL', brlTxt(st.mid.cpl), 'Custo por lead']])}</div>
      ${m.checkout ? `<div class="funnel-sec"><span class="fs-t">Fundo de funil</span>${mGrid([['Compras', numTxt(st.bot.purchases)], ['CPA', brlTxt(st.bot.cpa), 'Custo por compra'], ['ROAS', st.bot.roas == null ? '—' : fmt(st.bot.roas, 2) + 'x', 'Valor das compras ÷ investido'], ['ROI', pctTxt(st.bot.roi), '(Valor das compras − investido) ÷ investido'], ['IC', numTxt(st.bot.ic), 'Inícios de checkout'], ['Valor das compras', brlTxt(st.bot.value, 0)]])}</div>`
        : `<div class="funnel-sec"><span class="fs-t">Resultado no CRM</span>${mGrid([['Leads no CRM', numTxt(st.crm.leads)], ['Vendas fechadas', numTxt(st.crm.sales)], ['Receita', brlTxt(st.crm.revenue, 0)], ['ROI pelo CRM', pctTxt(st.crm.roi), '(Receita das vendas − investido) ÷ investido']])}
          <p class="dim" style="font-size:12.5px;margin-top:10px">Esta campanha não vai direto ao checkout, então as métricas de fundo de funil do Meta não valem aqui. O resultado vem das vendas fechadas no funil do CRM.</p></div>`}
    </section>`; }).join('')}</div>`}
    <details class="pn camp-help" style="margin-top:24px"><summary>O que cada métrica quer dizer</summary>
      <div class="col" style="gap:8px;margin-top:12px;font-size:14px;color:var(--fg-2)">
        <div><b>Alcance:</b> quantas pessoas diferentes viram o anúncio. <b>Impressões:</b> quantas vezes ele apareceu.</div>
        <div><b>CPM:</b> custo para aparecer mil vezes. <b>Frequência:</b> quantas vezes, em média, cada pessoa viu.</div>
        <div><b>ThruPlays:</b> vídeos assistidos até o fim ou por pelo menos 15 segundos.</div>
        <div><b>CPC:</b> custo de cada clique no link. <b>Visualizações da página:</b> quem clicou e a página carregou de fato.</div>
        <div><b>CPL:</b> custo de cada lead.</div>
        <div><b>CPA:</b> custo de cada compra. <b>ROAS:</b> quanto voltou para cada R$ 1. <b>ROI:</b> o lucro sobre o investido; acima de 0% se paga.</div>
        <div><b>IC:</b> inícios de checkout, quem chegou a começar a compra.</div>
      </div></details>`;
  },
};
ACT.campEdit = (el) => {
  const o = O(), cp = (o.camps || []).find((x) => x.id === (el && el.dataset ? el.dataset.id : null)) || { nm: '', spend: 0, imp: 0, clk: 0, pleads: 0, m: {} };
  const m = cp.m || {};
  const f = (id, lbl, v) => `<div class="field"><label for="${id}">${lbl}</label><input class="in num" id="${id}" inputmode="decimal" value="${v || ''}"></div>`;
  openModal(modalHead(cp.id ? 'Atualizar números' : 'Adicionar campanha', 'Copie do Gerenciador de Anúncios do Meta. Deixe em branco o que não tiver.') + `
    <form class="modal-b" data-sub="campSave" data-id="${cp.id || ''}">
      <div class="field"><label for="cpNm">Nome da campanha</label><input class="in" id="cpNm" value="${esc(cp.nm)}" required autofocus placeholder="Ex.: [PJ] Diagnóstico · Vídeo"></div>
      <label class="row" style="gap:10px"><span class="sw"><input type="checkbox" id="cpVid" ${m.video ? 'checked' : ''}><span></span></span>O criativo é vídeo</label>
      <label class="row" style="gap:10px"><span class="sw"><input type="checkbox" id="cpChk" ${m.checkout ? 'checked' : ''} data-chg="cpChk"><span></span></span>O anúncio leva direto ao checkout</label>
      ${f('cpSp', 'Valor investido (R$)', cp.spend)}
      <span class="fs-t">Topo de funil</span><div class="form-g">${f('cpRe', 'Alcance', m.reach)}${f('cpIm', 'Impressões', cp.imp)}${f('cpTp', 'ThruPlays (se for vídeo)', m.thruplays)}</div>
      <span class="fs-t">Meio de funil</span><div class="form-g">${f('cpCl', 'Cliques no link', cp.clk)}${f('cpLp', 'Visualizações da página de destino', m.landing_views)}${f('cpEn', 'Engajamento com a publicação', m.engagement)}${f('cpLd', 'Leads', cp.pleads)}</div>
      <div id="cpBot" ${m.checkout ? '' : 'hidden'}><span class="fs-t">Fundo de funil</span><div class="form-g">${f('cpPu', 'Compras', m.purchases)}${f('cpIc', 'Inícios de checkout (IC)', m.checkouts)}${f('cpVa', 'Valor de conversão das compras (R$)', m.purchase_value)}</div></div>
      <p class="dim" style="font-size:12.5px">CPM, frequência, CPC, CPL, CPA, ROAS e ROI são calculados sozinhos.</p>
    </form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="campSave">Salvar</button></div>`);
};
CHG.cpChk = (el) => { $('#cpBot').hidden = !el.checked; };
const numIn = (id) => Number(String(($(id) || {}).value || '0').replace(/\./g, '').replace(',', '.')) || 0;
SUB.campSave = async (f) => {
  const o = O(), id = f.dataset.id;
  const nm = $('#cpNm').value.trim(); if (!nm) { toast('Dê um nome para a campanha', '', 'warn', 'Megaphone'); return; }
  const cp = (o.camps || []).find((x) => x.id === id) || {};
  Object.assign(cp, { nm, spend: numIn('#cpSp'), pleads: numIn('#cpLd'), imp: numIn('#cpIm'), clk: numIn('#cpCl') });
  cp.m = { video: $('#cpVid').checked, checkout: $('#cpChk').checked, reach: numIn('#cpRe'), thruplays: numIn('#cpTp'), landing_views: numIn('#cpLp'), engagement: numIn('#cpEn'), purchases: numIn('#cpPu'), checkouts: numIn('#cpIc'), purchase_value: numIn('#cpVa') };
  if (cp.demo) cp.demo.leads = Math.max(cp.pleads, cp.demo.leads);
  if (typeof REAL !== 'undefined' && REAL.on) { const newId = await REAL.saveCampaign(cp); if (!newId) return; cp.id = newId; }
  else if (!cp.id) cp.id = 'cp' + uid();
  o.camps = o.camps || [];
  if (!o.camps.includes(cp)) o.camps.push(cp);
  closeOverlay(); toast('Campanha salva', nm, '', 'Megaphone'); rerender();
};

/* menu: Campanhas logo depois de Contatos */
NAV[0].items.splice(NAV[0].items.findIndex((i) => i.id === 'contatos') + 1, 0, { id: 'campanhas', nm: 'Campanhas', ic: 'Megaphone' });

/* ---------- ficha do cliente: serviços para marcar ---------- */
const baseOpenContact = openContact;
openContact = function (id) {
  baseOpenContact(id);
  const o = O(), c = CT(id), list = o.services || [];
  if (!c || !list.length) return;
  c.services = c.services || {};
  const box = document.createElement('div');
  box.className = 'col svc-box';
  box.innerHTML = `<div class="row between"><span class="lbl">Serviços</span><span class="dim" style="font-size:12px">${list.filter((s) => c.services[s]).length} de ${list.length} marcados</span></div>
    ${list.map((s, i) => `<label class="svc"><input type="checkbox" data-chg="svc" data-c="${c.id}" data-i="${i}" ${c.services[s] ? 'checked' : ''}><span class="svc-ck">${ic('Check', 'xs')}</span><span>${esc(s)}</span></label>`).join('')}`;
  const b = $('#overlay .drawer-b');
  if (b) b.insertBefore(box, b.children[2] || null);
};
CHG.svc = (el) => {
  const o = O(), c = CT(el.dataset.c), s = o.services[+el.dataset.i];
  c.services = Object.assign({}, c.services, { [s]: el.checked });
  if (!el.checked) delete c.services[s];
  const n = el.closest('.svc-box').querySelector('.dim'); if (n) n.textContent = o.services.filter((x) => c.services[x]).length + ' de ' + o.services.length + ' marcados';
  if (typeof REAL !== 'undefined' && REAL.on) REAL.saveServices(c);
};

/* ---------- negócio: produto e campanha de origem ---------- */
const baseNewDeal = ACT.newDeal;
ACT.newDeal = () => {
  baseNewDeal();
  const o = O(), g = $('form[data-sub="newDeal"] .form-g');
  if (!g) return;
  const wrap = document.createElement('div');
  wrap.className = 'form-g full';
  wrap.style.gridColumn = '1 / -1';
  wrap.innerHTML = `${(o.products || []).length ? `<div class="field"><label for="ndProd">Produto</label><select class="sel" id="ndProd" data-chg="ndProd"><option value="">Escolha</option>${o.products.map((p) => `<option value="${esc(p.nm)}" data-price="${p.price}">${esc(p.nm)}${p.price ? ' · ' + brl(p.price) : ''}</option>`).join('')}</select></div>` : ''}
    <div class="field"><label for="ndCamp">Veio de qual campanha?</label><select class="sel" id="ndCamp"><option value="">Nenhuma / não sei</option>${(o.camps || []).map((c) => `<option value="${c.id}">${esc(c.nm)}</option>`).join('')}</select></div>`;
  g.appendChild(wrap);
};
CHG.ndProd = (el) => { const pr = el.selectedOptions[0] && el.selectedOptions[0].dataset.price; if (pr && Number(pr) > 0) $('#ndVal').value = pr; };
const baseSubNewDeal = SUB.newDeal;
SUB.newDeal = function (f) {
  const prod = $('#ndProd') ? $('#ndProd').value : '', camp = $('#ndCamp') ? $('#ndCamp').value : '';
  const r = baseSubNewDeal(f);
  const after = () => {
    if (typeof REAL !== 'undefined' && REAL.on) return;
    const o = O(), d = o.deals[0], c = d && CT(d.c);
    if (d && prod) d.product = prod;
    if (d && camp) { d.camp = camp; if (c) { c.camp = camp; const cp = o.camps.find((x) => x.id === camp); if (cp) { c.src = 'Meta · ' + cp.nm; if (cp.demo) cp.demo.leads++; } } }
    if (S.route === 'funis') rerender();
  };
  if (r && r.then) r.then(after); else after();
};
const baseCard = cardHtml;
cardHtml = function (d) {
  const h = baseCard(d);
  return d.product ? h.replace('<div class="ft">', `<div class="ct"><span class="pill line">${esc(d.product)}</span></div><div class="ft">`) : h;
};
const baseOpenDeal = openDeal;
openDeal = function (id) {
  baseOpenDeal(id);
  const d = DL(id), o = O(); if (!d) return;
  const cp = d.camp ? (o.camps || []).find((x) => x.id === d.camp) : null;
  if (!d.product && !cp) return;
  const box = document.createElement('div');
  box.className = 'grid';
  box.style.cssText = 'grid-template-columns:repeat(2,minmax(0,1fr));gap:10px';
  box.innerHTML = `${d.product ? `<div class="r-stat"><span class="lbl">Produto</span><div style="margin-top:4px">${esc(d.product)}</div></div>` : ''}${cp ? `<div class="r-stat"><span class="lbl">Campanha</span><div style="margin-top:4px">${esc(cp.nm)}</div></div>` : ''}`;
  const b = $('#overlay .drawer-b'); if (b) b.insertBefore(box, b.children[2] || null);
};

/* ---------- nova organização: escolher o modelo ---------- */
const baseNewOrg = ACT.newOrg;
ACT.newOrg = () => {
  baseNewOrg();
  const f = $('form[data-sub="newOrg"]'); if (!f) return;
  const el = document.createElement('div');
  el.className = 'field';
  el.innerHTML = `<label for="noTpl">Modelo</label><select class="sel" id="noTpl"><option value="geral">Geral: qualquer nicho com vendedor e SDR</option><option value="credito_pj">Crédito PJ (Diagnóstico, Rota, Consultoria)</option><option value="credito_pf">Crédito PF (Diagnóstico PF, Consultoria)</option></select>`;
  f.insertBefore(el, f.children[1] || null);
};
