/* Teste ponta a ponta da demonstração do Lothem Vendas.
   Como rodar: abra o CRM com #demo, cole no console:  const s=document.createElement('script');s.src='tests/e2e.js';document.body.appendChild(s)
   e depois:  await E2E.run()
   O robô passa por todas as telas e abas das 3 organizações, clica em cada botão, mexe em cada chave e seletor,
   preenche e envia cada formulário, roda os fluxos completos e junta todo erro que aparecer. */
window.E2E = (() => {
  const errors = [], log = [];
  let ctx = '';
  const note = (k, msg) => errors.push({ ctx, k, msg: String(msg).slice(0, 300) });
  window.addEventListener('error', (e) => note('erro', e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) => note('promessa', e.reason && e.reason.message || e.reason));
  const ce = console.error; console.error = (...a) => { note('console', a.map(String).join(' ')); ce.apply(console, a); };
  /* nada sai da página durante o teste */
  window.open = () => null; window.alert = () => {}; window.confirm = () => true;
  try { navigator.clipboard.writeText = async () => {}; } catch (e) { /* sem área de transferência */ }
  HTMLAnchorElement.prototype.click = function () {};
  const SKIP_ACT = new Set(['logout', 'logoutReal', 'openDemo', 'simLead', 'impRun', 'blStart']);
  const ROUTES = () => Object.keys(VIEWS);
  const TABS = { central: ['hoje', 'analise', 'equipe'], sdr: ['geral', 'kb', 'play', 'regras', 'af', 'rev', 'test'], evolucao: ['desafios', 'conquistas', 'ranking', 'regras'],
    canais: ['inst', 'tpl', 'int', 'cmp'], equipe: ['pessoas', 'conv', 'perm', 'sla', 'squads'], perfil: ['dados', 'pref', 'notif', 'seg'], contatos: ['pessoas', 'empresas'],
    financeiro: ['receber', 'atrasadas', 'recebido', 'vendas', 'avisos'], disparo: [null], mestre: ['resumo', 'contas', 'pedidos', 'ia', 'planos'] };
  const fill = (root) => {
    root.querySelectorAll('input, textarea').forEach((i) => {
      if (i.type === 'file' || i.type === 'checkbox' || i.type === 'radio' || i.type === 'range' || i.value) return;
      i.value = i.type === 'email' ? 'teste@exemplo.com' : i.type === 'date' ? '2026-10-20' : i.type === 'time' ? '10:00' : i.type === 'url' ? 'https://lothem.com.br/blog' : i.inputMode === 'tel' || i.type === 'tel' ? '(19) 99999-0000' : i.inputMode === 'numeric' || i.inputMode === 'decimal' || i.type === 'number' ? '100' : i.tagName === 'TEXTAREA' ? 'Teste ponta a ponta' : 'Teste E2E';
    });
  };
  let ORG = null;
  function open(route, tab) { closeOverlay(); closePop(); if (S.sim) S.sim.running = false; if (ORG && S.org !== ORG) { setOrgQuiet(ORG); renderShell(); } go(route, tab ? { tab } : {}); }
  function sweep(org, route, tab) {
    ctx = org + ' › ' + route + (tab ? '.' + tab : '');
    try { open(route, tab); } catch (e) { note('abrir tela', e.message); return; }
    const sel = '#stage [data-act], #stage [data-go], #stage [data-chg], #stage [data-inp], #stage form[data-sub]';
    const n = document.querySelectorAll(sel).length;
    for (let i = 0; i < n; i++) {
      try { open(route, tab); } catch (e) { note('abrir tela', e.message); return; }
      const el = document.querySelectorAll(sel)[i]; if (!el) continue;
      const what = (el.dataset.act || el.dataset.go || el.dataset.chg || el.dataset.inp || el.dataset.sub);
      if (SKIP_ACT.has(el.dataset.act)) continue;
      ctx = org + ' › ' + route + (tab ? '.' + tab : '') + ' › ' + what;
      try {
        if (el.matches('form[data-sub]')) { fill(el); el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
        else if (el.dataset.chg) {
          if (el.type === 'file') continue;
          if (el.type === 'checkbox') el.checked = !el.checked; else if (el.tagName === 'SELECT' && el.options.length > 1) el.selectedIndex = (el.selectedIndex + 1) % el.options.length; else if (el.type === 'date') el.value = '2026-10-20'; else if (el.type === 'time') el.value = '10:00';
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.dataset.inp) { if (el.type === 'range') el.value = el.min || 50; else el.value = el.value || 'teste'; el.dispatchEvent(new Event('input', { bubbles: true })); }
        else el.click();
        log.push(ctx);
        /* o que abriu (modal ou gaveta) também é testado: formulários enviados e botões principais */
        const ov = document.querySelector('#overlay');
        if (ov && ov.children.length) {
          const f = ov.querySelector('form[data-sub]');
          if (f) { ctx += ' › modal ' + f.dataset.sub; fill(f); f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); log.push(ctx); }
        }
      } catch (e) { note('ação', e.message); }
    }
  }
  function flows(org) {
    ctx = org + ' › fluxos';
    setOrgQuiet(org); renderShell();
    const o = O();
    if (o.autofill) { o.autofill.on = true; o.autofill.minConf = 80; o.autofill.fields.forEach((f) => { f.on = true; }); }
    /* lead ao vivo: roda a simulação inteira de uma vez */
    if (org === 'mkt' || org === 'cred') {
      try {
        ACT.simLead(); clearTimeout(S.sim.timer); S.sim.steps.forEach(([, fn]) => fn()); S.sim.running = false;
        const cv = O().conversations[0];
        if (Object.keys(cv.af || {}).length < 8) note('simulação', 'a IA preencheu só ' + Object.keys(cv.af || {}).length + ' campos');
        log.push(ctx + ' › simulação ok (' + Object.keys(cv.af).length + ' campos preenchidos)');
      } catch (e) { note('simulação', e.message); }
    }
    /* mover negócio no funil */
    try { const d = o.deals[0], pp = PIPE(d.p), st = pp.stages[Math.min(pp.stages.length - 1, 2)]; moveDeal(d.id, st.id); if (d.s !== st.id && !st.won) note('funil', 'negócio não mudou de etapa'); log.push(ctx + ' › mover negócio'); } catch (e) { note('funil', e.message); }
    /* ficha do cliente e negociação parcelada */
    try {
      const c = o.contacts[0]; openContact(c.id);
      ACT.finNew({ dataset: { c: c.id } }); S.finForm.total = '1200'; ACT.finSet({ dataset: { k: 'mode', v: 'parcelado' } }); ACT.finSet({ dataset: { k: 'method', v: 'boleto' } });
      const t = document.querySelector('#fnTotal'); if (t) t.value = '1200';
      const before = o.sales.length; SUB.finSave();
      if (o.sales.length !== before + 1) note('financeiro', 'negociação não foi salva');
      const s = o.sales[o.sales.length - 1]; if (s.inst.reduce((a, p) => a + p.v, 0).toFixed(2) !== '1200.00') note('financeiro', 'parcelas não somam o total');
      ACT.finPay({ dataset: { id: s.inst[0].id } }); if (!s.inst[0].paidAt) note('financeiro', 'baixa da parcela falhou');
      log.push(ctx + ' › negociação 3x boleto, soma e baixa');
    } catch (e) { note('financeiro', e.message); }
    /* teste da SDR */
    try { S.sandbox = []; $('#sbIn') || open('sdr', 'test'); const a = iaAnswer('Isso é golpe?'); if (!a || !a.txt) note('sdr', 'sem resposta'); log.push(ctx + ' › SDR responde'); } catch (e) { note('sdr', e.message); }
    /* checkout */
    try { S.checkout = { plan: 'pro', cycle: 'anual', method: 'cartao' }; open('assinar'); fill(document.querySelector('#coForm')); SUB.checkout(); log.push(ctx + ' › checkout'); } catch (e) { note('checkout', e.message); }
    /* importação */
    try {
      S.imp = { step: 1 }; const rows = impCsv('Nome;Celular;E-mail;Etapa;Valor\nTeste Um;(11) 91111-1111;um@t.com;Novo;R$ 1.500,00\nTeste Dois;(11) 92222-2222;;Qualificado;\n');
      S.imp = { step: 2, file: 't.csv', headers: rows[0], rows: rows.slice(1), map: impGuess(rows[0]), stageMap: {}, defStage: null, pipe: null };
      open('importar'); ACT.impGo({ dataset: { v: '3' } }); ACT.impGo({ dataset: { v: '4' } }); S.imp.lgpd = true;
      const n0 = o.contacts.length; ACT.impRun(); if (o.contacts.length !== n0 + 2) note('importar', 'importou ' + (o.contacts.length - n0) + ' de 2');
      log.push(ctx + ' › importação');
    } catch (e) { note('importar', e.message); }
    /* disparo em massa: passo a passo até começar */
    try {
      S.bl = null; open('disparo'); const A = blAudience();
      if (A.ok.length) {
        ACT.blGo({ dataset: { v: '2' } });
        const t = (o.templates || []).find((x) => x.st === 'Aprovado');
        if (t) {
          ACT.blTpl({ dataset: { v: t.nm } }); ACT.blGo({ dataset: { v: '3' } }); ACT.blGo({ dataset: { v: '4' } }); CHG.blConsent({ checked: true });
          const n0 = (o.blasts || []).length; ACT.blStart(); const b = o.blasts[o.blasts.length - 1];
          if (o.blasts.length !== n0 + 1) note('disparo', 'disparo não foi criado');
          if (b && b.stats.sent < 1 && b.status === 'enviando') note('disparo', 'disparo não começou a enviar');
          if (b) { b.status = 'pausado'; clearTimeout(b.timer); }
          log.push(ctx + ' › disparo em massa (' + A.ok.length + ' contatos)');
        } else log.push(ctx + ' › disparo: sem modelo aprovado nesta organização');
      }
    } catch (e) { note('disparo', e.message); }
    /* campanhas: contas */
    try { (o.camps || []).forEach((cp) => { const r = campStats(o, cp); if (r.spend && r.top.imp && !(r.top.cpm > 0)) note('campanhas', 'CPM inválido em ' + cp.nm); }); log.push(ctx + ' › métricas de campanha'); } catch (e) { note('campanhas', e.message); }
  }
  async function run() {
    errors.length = 0; log.length = 0;
    const orgs = Object.keys(DB.orgs);
    for (const org of orgs) {
      ORG = org; setOrgQuiet(org); renderShell();
      for (const r of ROUTES()) {
        if (r === 'assinar' || r === 'importar') continue;
        const tabs = TABS[r] || [null];
        for (const t of tabs) sweep(org, r, t);
      }
      flows(org);
    }
    /* comandos gerais */
    ctx = 'geral';
    try { ACT.cmd(); closeOverlay(); ['notifs', 'toggleSb', 'toggleSb', 'orgMenu', 'meMenu', 'newMenu', 'guide', 'guide'].forEach((a) => { const b = document.querySelector('[data-act="' + a + '"]'); if (b) b.click(); closePop(); }); log.push('comandos'); } catch (e) { note('geral', e.message); }
    try { const sw = document.querySelector('#themeSw'); if (sw) { sw.checked = !sw.checked; sw.dispatchEvent(new Event('change', { bubbles: true })); sw.checked = !sw.checked; sw.dispatchEvent(new Event('change', { bubbles: true })); } log.push('tema'); } catch (e) { note('tema', e.message); }
    closeOverlay(); closePop();
    const byCtx = {}; errors.forEach((e) => { const k = e.k + ': ' + e.msg; (byCtx[k] = byCtx[k] || []).push(e.ctx); });
    return { acoes: log.length, erros: errors.length, unicos: Object.entries(byCtx).map(([k, v]) => ({ erro: k, vezes: v.length, onde: v.slice(0, 3) })) };
  }
  /* sem rolagem lateral no celular */
  function overflow() {
    const bad = [];
    for (const r of ROUTES()) { if (r === 'assinar') continue; try { open(r); if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(r + ' (' + document.documentElement.scrollWidth + 'px)'); } catch (e) { bad.push(r + ' erro'); } }
    return { largura: innerWidth, telasComRolagemLateral: bad };
  }
  return { run, overflow, errors, log };
})();
