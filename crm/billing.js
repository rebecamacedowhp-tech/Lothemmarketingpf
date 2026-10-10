/* LOTHEM Vendas — planos, teste grátis de 7 dias e página de pagamento.
   Preços definidos a partir de pesquisa de mercado (out/2026): CRMs cobram por usuário (R$ 59 a R$ 232),
   e SDR com IA costuma ser módulo à parte. Aqui o preço é por empresa, com a Cibelle incluída. */

let TRIAL_DAYS = 7;
DB.plans = [
  { id: 'ess', nm: 'Essencial', price: 147, tag: 'Para organizar as vendas', lim: { users: 3, orgs: 1, ia: 0, wa: 1 },
    feats: ['Até 3 usuários', 'Funis, contatos e tarefas sem limite', 'Chat da equipe', 'Painel de campanhas do Meta', 'Metas e evolução da equipe'], no: ['Sem a Cibelle (SDR IA)'] },
  { id: 'pro', nm: 'Profissional', price: 397, tag: 'Mais escolhido', best: true, lim: { users: 6, orgs: 1, ia: 300, wa: 1 },
    feats: ['Tudo do Essencial', 'Até 6 usuários', 'Cibelle, a SDR IA, sem limite de conversas', '1 número de WhatsApp', 'Preenchimento automático do CRM', 'SLA de atendimento e meta pessoal'] },
  { id: 'adv', nm: 'Avançado', price: 897, tag: 'Para várias empresas', lim: { users: 15, orgs: 3, ia: 1500, wa: 3 },
    feats: ['Tudo do Profissional', 'Até 15 usuários', 'Até 3 empresas, cada uma com a sua Cibelle', '3 números de WhatsApp', 'Sua marca e seu logo', 'Suporte prioritário'] },
];
const PLAN_EXTRAS = [['+1 número de WhatsApp', 59]];
const IMPLANT = { price: 2497, items: ['Funis e etapas montados para o seu processo', 'Cibelle treinada com seus materiais, ofertas e objeções', 'WhatsApp conectado', '2 encontros de treinamento com a equipe', '30 dias de acompanhamento'] };
const PAY = [
  { id: 'pix', nm: 'Pix', ic: 'QrCode', d: 'QR Code na hora. Todo mês chega um novo Pix.' },
  { id: 'cartao', nm: 'Cartão de crédito', ic: 'CreditCard', d: 'Renova sozinho. O cartão é digitado na página do provedor de pagamento.' },
  { id: 'boleto', nm: 'Boleto', ic: 'Barcode', d: 'Vence em 3 dias úteis. Libera em até 2 dias úteis depois de pago.' },
];
const planOf = (id) => DB.plans.find((p) => p.id === id);
const yearPrice = (p) => p.price * 10; /* anual: 12 meses pelo preço de 10 */
const payNm = (id) => (id === 'pix' ? 'Pix' : PAY.find((m) => m.id === id).nm.toLowerCase());
const dmy = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();

/* Demonstração: conta no 3º dia do teste grátis do Avançado */
DB.billing = {
  plan: 'adv', status: 'trial', trialEnd: new Date(Date.now() + 5 * 864e5 - 3 * 36e5).toISOString(), cycle: 'mensal', card: null, holder: 'Lothem Inteligência em Marketing', invoices: [],
  usage: [
    { nm: 'Usuários', v: 6, max: 15, note: '4 ativos + 2 convites' },
    { nm: 'Instâncias WhatsApp', v: 3, max: 3, note: 'no limite do plano' },
    { nm: 'Organizações', v: 3, max: 3, note: 'Marketing, Crédito PJ e Crédito PF' },
  ],
};

Object.values(DB.orgs).forEach((o) => { o.plan = 'Avançado · teste'; });

/* Situação da assinatura: interno, ativa, teste (com dias restantes) ou vencida */
function billState() {
  const ob = REAL.on && O() && O().ownerBill;
  const B = ob || DB.billing;
  if (B.plan === 'interno') return { k: 'interno', nm: 'Uso interno Lothem' };
  if (B.status === 'active' || B.status === 'past_due') return { k: 'ativa', nm: planOf(B.plan) ? planOf(B.plan).nm : B.plan };
  if (B.status === 'trial') {
    const ms = new Date(B.trialEnd) - Date.now(), days = Math.max(0, Math.ceil(ms / 864e5));
    return ms > 0 ? { k: 'teste', days, end: new Date(B.trialEnd), nm: planOf(B.plan) ? planOf(B.plan).nm : '' } : { k: 'vencida', end: new Date(B.trialEnd) };
  }
  return { k: 'vencida' };
}

/* Selo no topo: quantos dias de teste faltam */
const renderShellBill = renderShell;
renderShell = function () {
  renderShellBill();
  const st = billState(), tag = $('#demoTag');
  if (!tag || (st.k !== 'teste' && st.k !== 'vencida')) return;
  const b = document.createElement('button');
  b.className = 'trial-chip ' + (st.k === 'vencida' ? 'bad' : st.days <= 2 ? 'warn' : '');
  b.dataset.go = 'planos';
  b.innerHTML = ic(st.k === 'vencida' ? 'Lock' : 'Hourglass', 'xs') + '<span>' + (st.k === 'vencida' ? 'Teste encerrado' : 'Teste grátis · ' + st.days + (st.days === 1 ? ' dia' : ' dias')) + '</span>';
  tag.after(b);
};

/* =========================================================
   PLANOS
   ========================================================= */
VIEWS.planos = {
  title: 'Planos e pagamentos',
  crumb: 'Conta',
  render() {
    const B = DB.billing, st = billState(), yearly = S.filters.yearly;
    let hero = '';
    if (st.k === 'teste') hero = `<section class="pn hud" style="margin-bottom:20px"><div class="pn-b row wrap" style="gap:18px">
      <span class="ico-box cy">${ic('Hourglass', 'sm')}</span>
      <div class="grow" style="min-width:220px"><b style="font-size:16px">Você está no teste grátis do ${esc(st.nm)}</b><div class="muted" style="font-size:13.5px;margin-top:4px">Faltam <b>${st.days} ${st.days === 1 ? 'dia' : 'dias'}</b>, até ${dmy(st.end)}. Nada é cobrado até lá. Escolha um plano e a primeira cobrança só acontece quando o teste acabar.</div>
        <div style="margin-top:10px;max-width:420px">${bar(pct(TRIAL_DAYS - st.days, TRIAL_DAYS))}</div></div>
      <button class="btn pri" data-act="pickPlan" data-id="pro">Escolher meu plano</button></div></section>`;
    else if (st.k === 'vencida') hero = `<section class="pn" style="margin-bottom:20px;border-color:var(--bad)"><div class="pn-b row wrap" style="gap:18px">
      <span class="ico-box bad">${ic('Lock', 'sm')}</span>
      <div class="grow" style="min-width:220px"><b style="font-size:16px">Seu teste grátis terminou</b><div class="muted" style="font-size:13.5px;margin-top:4px">Seus contatos, funis e conversas continuam guardados. Até você escolher um plano, o CRM fica só para consulta.</div></div>
      <button class="btn pri" data-act="pickPlan" data-id="pro">Escolher meu plano</button></div></section>`;
    else if (st.k === 'interno') hero = `<section class="pn" style="margin-bottom:20px"><div class="pn-b row wrap" style="gap:14px"><span class="ico-box ok">${ic('BadgeCheck', 'sm')}</span><div class="grow"><b>Conta da Lothem: uso interno, sem cobrança</b><div class="muted" style="font-size:13px">É assim que seus clientes veem os planos quando criam a conta.</div></div></div></section>`;
    else hero = `<section class="pn" style="margin-bottom:20px"><div class="pn-b row wrap" style="gap:14px"><span class="ico-box ok">${ic('BadgeCheck', 'sm')}</span><div class="grow"><b>Plano ${esc(st.nm)} ativo</b><div class="muted" style="font-size:13px">${B.cycle === 'anual' ? 'Pagamento anual' : 'Pagamento mensal'}${B.next ? ' · próxima cobrança em ' + B.next : ''}${B.method ? ' · ' + esc(PAY.find((m) => m.id === B.method).nm) : ''}</div></div></div></section>`;
    const curId = st.k === 'ativa' ? B.plan : null;
    return `
    <div class="page-h"><div><h2>Planos e pagamentos</h2><p>Preço por empresa, não por usuário. A Cibelle já vem incluída a partir do Profissional.</p></div></div>
    ${hero}
    <div class="row between wrap" style="gap:10px;margin-bottom:14px"><h3 style="font-size:16px">Planos</h3><div class="seg"><button class="${!yearly ? 'on' : ''}" data-act="yearly" data-v="0">Mensal</button><button class="${yearly ? 'on' : ''}" data-act="yearly" data-v="1">Anual · 2 meses grátis</button></div></div>
    <div class="plans" style="margin-bottom:22px">${DB.plans.map((p) => `<div class="pn plan ${p.best ? 'best' : ''} ${p.id === curId ? 'cur' : ''}">
      <div class="row between"><b style="font-family:var(--f-display);font-size:18px">${esc(p.nm)}</b>${p.id === curId ? pill('Seu plano', 'cy') : p.best ? pill(p.tag, 'gold') : pill(p.tag, 'line')}</div>
      <div class="pr num">${brl(yearly ? Math.round(yearPrice(p) / 12) : p.price)}<small>/mês</small></div>
      <div class="dim" style="font-size:12px;margin-top:-6px">${yearly ? brl(yearPrice(p)) + ' por ano, à vista' : 'sem fidelidade'}</div>
      <ul>${p.feats.map((f) => `<li>${ic('Check', 'sm cy')}${esc(f)}</li>`).join('')}${(p.no || []).map((f) => `<li class="dim">${ic('Minus', 'sm')}${esc(f)}</li>`).join('')}</ul>
      ${p.id === curId ? '<button class="btn block" disabled>Você está aqui</button>' : `<button class="btn block ${p.best ? 'pri' : ''}" data-act="pickPlan" data-id="${p.id}">Escolher ${esc(p.nm)}</button>`}</div>`).join('')}</div>
    <div class="grid g-12">
      <section class="pn s-7"><div class="pn-h"><span class="pn-t">${ic('Wrench')}Quer que a Lothem implante para você?</span>${pill('a partir de ' + brl(IMPLANT.price), 'gold mono')}</div>
        <div class="pn-b col" style="gap:12px"><p class="muted" style="font-size:13.5px">Pagamento único, além do plano. A gente deixa o CRM pronto para vender.</p>
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:13.5px">${IMPLANT.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <div><button class="btn" data-act="askImplant">${ic('MessageCircle', 'sm')}Quero a implantação</button></div></div></section>
      <section class="pn s-5"><div class="pn-h"><span class="pn-t">${ic('PackagePlus')}Extras</span></div>
        <div class="pn-b col" style="gap:10px">${PLAN_EXTRAS.map(([nm, v]) => `<div class="row between" style="font-size:13.5px"><span>${esc(nm)}</span><b class="num">${brl(v)}/mês</b></div>`).join('')}
          <hr class="sep"><p class="dim" style="font-size:12px">A IA da Cibelle usa a <b>sua própria chave da Anthropic</b>: você paga direto a eles, pelo uso, sem limite de conversas no plano.</p><p class="dim" style="font-size:12px">Mensagens que a Meta cobra no WhatsApp oficial (modelos de mensagem) são pagas direto à Meta, pelo uso.</p></div></section>
      ${st.k !== 'interno' ? `<section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('Gauge')}Uso da conta</span></div><div class="pn-b"><div class="usage">${B.usage.map((u) => { const p = pct(u.v, u.max); return `<div class="r-stat col" style="gap:6px"><span class="lbl">${esc(u.nm)}</span><div class="num" style="font-size:18px;font-weight:600">${fmt(u.v)} <span class="dim" style="font-size:13px;font-weight:500">de ${fmt(u.max)}</span></div>${bar(p, p > 100 ? 'bad' : p >= 85 ? 'warn' : '')}<span class="dim" style="font-size:12px">${esc(u.note)}</span></div>`; }).join('')}</div></div></section>` : ''}
      ${B.invoices.length ? `<section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('Receipt')}Faturas</span></div><div class="pn-b" style="padding-top:4px"><div class="tbl-w"><table class="tbl"><thead><tr><th>Data</th><th>Descrição</th><th class="r">Valor</th><th>Status</th></tr></thead><tbody>${B.invoices.map((i) => `<tr><td class="nowrap">${i.date}</td><td>${esc(i.desc)}</td><td class="r num nowrap">${brl(i.v, 2)}</td><td>${pill(i.st, i.st === 'Paga' ? 'ok' : 'warn')}</td></tr>`).join('')}</tbody></table></div></div></section>` : ''}
    </div>`;
  },
};
ACT.yearly = (el) => { S.filters.yearly = el.dataset.v === '1'; rerender(); };
ACT.pickPlan = (el) => { S.checkout = Object.assign({ cycle: S.filters.yearly ? 'anual' : 'mensal', method: 'pix' }, S.checkout || {}, { plan: el.dataset.id, done: null }); go('assinar'); };
ACT.askImplant = () => openModal(modalHead('Implantação pela Lothem', 'A partir de ' + brl(IMPLANT.price) + ', pagamento único.') + `<div class="modal-b col" style="gap:12px">
    <p style="font-size:14px">A gente entende o seu processo de vendas, monta os funis, treina a Cibelle com os seus materiais e prepara a equipe. O valor final depende do tamanho da operação.</p>
    <p class="muted" style="font-size:13px">Ao confirmar, a Lothem recebe seu pedido e te chama no WhatsApp para marcar a conversa.</p></div>
  <div class="modal-f"><button class="btn ghost" data-act="close">Agora não</button><button class="btn pri" data-act="sendImplant">Confirmar pedido</button></div>`);
ACT.sendImplant = async () => {
  if (REAL.on) { const r = await REAL.sb.rpc('request_plan', { p_plan: 'implantacao', p_cycle: 'mensal', p_method: 'pix' }); if (r.error) { toast('Não consegui enviar', r.error.message, 'bad', 'CircleAlert'); return; } }
  closeOverlay(); toast('Pedido enviado', 'A Lothem vai te chamar no WhatsApp para marcar a conversa.', '', 'MessageCircle');
};

/* =========================================================
   PÁGINA DE PAGAMENTO
   ========================================================= */
VIEWS.assinar = {
  title: 'Assinar',
  crumb: 'Conta',
  render() {
    const C = S.checkout = Object.assign({ plan: 'pro', cycle: 'mensal', method: 'pix' }, S.checkout || {});
    if (C.done) return checkoutDone(C);
    const p = planOf(C.plan), st = billState(), anual = C.cycle === 'anual', total = anual ? yearPrice(p) : p.price;
    const first = st.k === 'teste' ? st.end : new Date();
    const me = ME();
    const step = (n, t, body) => `<section class="pn"><div class="pn-h"><span class="pn-t"><span class="step-n">${n}</span>${t}</span></div><div class="pn-b">${body}</div></section>`;
    return `
    <div class="page-h"><div><button class="link" data-go="planos" style="margin-bottom:6px">${ic('ArrowLeft', 'xs')} Voltar aos planos</button><h2>Assinar o Lothem Vendas</h2>
      <p>${st.k === 'teste' ? 'Seu teste grátis vai até ' + dmy(st.end) + '. Assinando agora, a primeira cobrança só acontece nessa data.' : 'Escolha o plano, a forma de pagamento e pronto.'}</p></div></div>
    <div class="row top-a" style="gap:10px;padding:12px 14px;border-radius:10px;background:var(--cy-soft);font-size:13px;margin-bottom:18px"><span class="cy">${ic('Info', 'sm')}</span><span>${REAL.on ? 'O pagamento online está sendo ligado. Seu pedido fica registrado e a Lothem te chama para concluir. Nenhum valor é cobrado sem você confirmar.' : 'Demonstração: nenhum valor é cobrado.'}</span></div>
    <div class="co-grid">
      <div class="col" style="gap:16px">
        ${step(1, 'Plano', `<div class="pay-opts">${DB.plans.map((x) => `<button type="button" class="pay-o ${x.id === C.plan ? 'on' : ''}" data-act="coSet" data-k="plan" data-v="${x.id}" aria-pressed="${x.id === C.plan}"><b>${esc(x.nm)}</b><span class="num">${brl(x.price)}/mês</span>${x.best ? pill('Mais escolhido', 'gold') : ''}</button>`).join('')}</div>`)}
        ${step(2, 'Como prefere pagar o plano', `<div class="seg"><button class="${!anual ? 'on' : ''}" data-act="coSet" data-k="cycle" data-v="mensal">Todo mês</button><button class="${anual ? 'on' : ''}" data-act="coSet" data-k="cycle" data-v="anual">Uma vez por ano · 2 meses grátis</button></div>`)}
        ${step(3, 'Forma de pagamento', `<div class="col" style="gap:10px">${PAY.map((m) => `<button type="button" class="pay-m ${m.id === C.method ? 'on' : ''}" data-act="coSet" data-k="method" data-v="${m.id}" aria-pressed="${m.id === C.method}"><span class="ico-box ${m.id === C.method ? 'cy' : ''}">${ic(m.ic, 'sm')}</span><span class="col" style="gap:2px;text-align:left"><b>${m.nm}</b><span class="dim" style="font-size:12.5px">${m.d}</span></span><span class="radio"></span></button>`).join('')}</div>`)}
        ${step(4, 'Dados para a nota fiscal', `<form class="col" style="gap:14px" data-sub="checkout" id="coForm">
          <div class="field"><label for="coNm">Nome ou razão social</label><input class="in" id="coNm" value="${esc(C.nm || (REAL.on ? '' : B_HOLDER()))}" autocomplete="organization" required></div>
          <div class="field"><label for="coEm">E-mail para receber a nota</label><input class="in" id="coEm" type="email" value="${esc(C.em || me.email || '')}" autocomplete="email" required></div>
          <span class="hint">CPF ou CNPJ e dados do cartão são pedidos só na página segura do provedor de pagamento. O Lothem Vendas não guarda esses dados.</span></form>`)}
      </div>
      <aside class="pn co-sum"><div class="pn-h"><span class="pn-t">${ic('Receipt')}Resumo</span></div>
        <div class="pn-b col" style="gap:12px">
          <div class="row between"><span>Plano ${esc(p.nm)}</span><b class="num">${brl(p.price)}/mês</b></div>
          ${anual ? `<div class="row between"><span>12 meses pelo preço de 10</span><b class="num ok">− ${brl(p.price * 2)}</b></div>` : ''}
          <hr class="sep">
          <div class="row between"><span>${anual ? 'Total por ano' : 'Total por mês'}</span><b class="num" style="font-size:20px">${brl(total)}</b></div>
          ${st.k === 'teste' ? `<div class="row between"><span class="cy">Hoje você paga</span><b class="num cy">${brl(0)}</b></div>` : ''}
          <div class="dim" style="font-size:12.5px">Primeira cobrança em ${dmy(first)}, por ${esc(payNm(C.method))}. ${anual ? 'Renova uma vez por ano.' : 'Renova todo mês.'} Sem fidelidade: cancele quando quiser.</div>
          <button class="btn pri block" data-act="submitForm" data-form="checkout">${ic('Lock', 'sm')}${REAL.on ? 'Confirmar pedido' : 'Continuar para o pagamento seguro'}</button>
          <div class="row" style="gap:6px;font-size:12px;color:var(--fg-3)">${ic('ShieldCheck', 'xs')}Pagamento processado pelo provedor, com criptografia.</div>
        </div></aside>
    </div>`;
  },
};
const B_HOLDER = () => DB.billing.holder || '';
ACT.coSet = (el) => {
  const C = S.checkout;
  ['coNm', 'coEm'].forEach((id) => { const i = $('#' + id); if (i) C[id === 'coNm' ? 'nm' : 'em'] = i.value; });
  C[el.dataset.k] = el.dataset.v; rerender();
};
SUB.checkout = async () => {
  const C = S.checkout, nm = $('#coNm').value.trim(), em = $('#coEm').value.trim();
  if (!nm || !/.+@.+\..+/.test(em)) { toast('Confira nome e e-mail', 'Os dois são usados na nota fiscal.', 'warn', 'CircleAlert'); return; }
  C.nm = nm; C.em = em;
  if (REAL.on) {
    const r = await REAL.sb.rpc('request_plan', { p_plan: C.plan, p_cycle: C.cycle, p_method: C.method });
    if (r.error) { toast('Não consegui registrar', r.error.message, 'bad', 'CircleAlert'); return; }
    C.done = 'pedido'; rerender(); return;
  }
  C.done = C.method === 'pix' && billState().k !== 'teste' ? 'pix' : 'ok';
  if (C.done === 'ok') activateDemo(C);
  rerender();
};
function activateDemo(C) {
  const B = DB.billing, p = planOf(C.plan), st = billState(), first = st.k === 'teste' ? st.end : new Date();
  B.plan = p.id; B.status = 'active'; B.cycle = C.cycle; B.method = C.method; B.next = dmy(first);
  B.usage[0].max = p.lim.users; B.usage[1].max = p.lim.wa; B.usage[2].max = p.lim.ia; B.usage[3].max = p.lim.orgs;
  if (st.k !== 'teste') B.invoices.unshift({ date: dmy(new Date()), desc: p.nm + ' · ' + C.cycle, v: C.cycle === 'anual' ? yearPrice(p) : p.price, st: 'Paga' });
  Object.values(DB.orgs).forEach((o) => { o.plan = p.nm; });
}
ACT.pixPaid = () => { const C = S.checkout; activateDemo(C); C.done = 'ok'; renderShell(); toast('Pagamento confirmado', 'Plano ' + planOf(C.plan).nm + ' ativo.', '', 'BadgeCheck'); };
function checkoutDone(C) {
  const p = planOf(C.plan), B = DB.billing;
  if (C.done === 'pix') return `<div class="pn co-done"><div class="pn-b col" style="gap:16px;align-items:center;text-align:center">
    <h2 style="font-size:22px">Pague com Pix</h2><p class="muted">Abra o app do banco, escolha Pix e leia o código. A confirmação aparece aqui sozinha.</p>
    <div class="qr-demo" aria-label="QR Code de demonstração">${ic('QrCode', 'xl')}<span>QR Code de demonstração</span></div>
    <b class="num" style="font-size:22px">${brl(C.cycle === 'anual' ? yearPrice(p) : p.price)}</b>
    <div class="row wrap" style="gap:8px;justify-content:center"><button class="btn" data-act="copyPix">${ic('Copy', 'sm')}Copiar código Pix</button><button class="btn pri" data-act="pixPaid">Simular pagamento recebido</button></div></div></div>`;
  if (C.done === 'pedido') return `<div class="pn co-done"><div class="pn-b col" style="gap:14px;align-items:center;text-align:center">
    <span class="ico-box ok">${ic('CircleCheck', 'sm')}</span><h2 style="font-size:22px">Pedido registrado</h2>
    <p class="muted" style="max-width:46ch">Plano ${esc(p.nm)}, ${C.cycle === 'anual' ? 'anual' : 'mensal'}, por ${esc(payNm(C.method))}. A Lothem te chama no WhatsApp para concluir o pagamento. Enquanto isso, seu acesso continua normal.</p>
    <button class="btn" data-go="central">Voltar para a Central</button></div></div>`;
  return `<div class="pn co-done"><div class="pn-b col" style="gap:14px;align-items:center;text-align:center">
    <span class="ico-box ok">${ic('BadgeCheck', 'sm')}</span><h2 style="font-size:22px">Plano ${esc(p.nm)} ativo</h2>
    <p class="muted" style="max-width:46ch">Tudo liberado. ${B.method === 'pix' ? 'O Pix chega no seu e-mail' : B.method === 'boleto' ? 'O boleto chega no seu e-mail' : 'A cobrança no cartão acontece'} em ${B.next}. A nota fiscal vai para ${esc(C.em)}.</p>
    <button class="btn pri" data-go="central">Ir para a Central</button></div></div>`;
}
ACT.copyPix = () => toast('Código copiado', 'Na demonstração, o código não é válido.', '', 'Copy');

/* Teste vencido: aviso uma vez por sessão */
function billGate() {
  if (billState().k !== 'vencida' || S.billWarned) return;
  S.billWarned = true;
  openModal(modalHead('Seu teste grátis terminou', '') + `<div class="modal-b col" style="gap:12px"><p style="font-size:14px">Seus contatos, funis e conversas continuam guardados. Para voltar a criar e editar, escolha um plano.</p></div>
    <div class="modal-f"><button class="btn ghost" data-act="close">Só consultar</button><button class="btn pri" data-act="gatePlans">Ver planos</button></div>`);
}
ACT.gatePlans = () => { closeOverlay(); go('planos'); };

/* Modo real: monta a cobrança a partir da assinatura salva no banco */
function realBilling(sub, orgs) {
  if (!sub) sub = { plan: 'interno', status: 'active' }; /* banco ainda sem a tabela de assinaturas: não bloqueia nada */
  const owned = orgs.filter((o) => REAL.roles[o.id] === 'owner');
  const p = planOf(sub && sub.plan) || planOf('adv');
  const users = new Set(); owned.forEach((o) => o.members.forEach((m) => users.add(m)));
  const next = sub && sub.current_period_end ? dmy(new Date(sub.current_period_end)) : null;
  DB.billing = {
    plan: sub ? sub.plan : 'adv', status: sub ? sub.status : 'trial', trialEnd: sub && sub.trial_ends_at, cycle: sub && sub.cycle || 'mensal', next,
    holder: '', invoices: [], method: null,
    usage: [
      { nm: 'Usuários', v: users.size, max: p.lim.users, note: 'nas suas empresas' },
      { nm: 'Instâncias WhatsApp', v: 0, max: p.lim.wa, note: 'nenhum número conectado' },
      { nm: 'Organizações', v: owned.length, max: p.lim.orgs, note: 'criadas por você' },
    ],
  };
}
