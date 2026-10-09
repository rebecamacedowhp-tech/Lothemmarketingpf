/* Banco de mentira para testar o modo real sem tocar no Supabase de verdade.
   Uso (com o CRM aberto SEM #demo e sem login): carregar tests/e2e.js e este arquivo, depois  await REALTEST.run() */
window.REALTEST = (() => {
  const U = '22222222-2222-2222-2222-222222222222', O1 = '11111111-1111-1111-1111-111111111111';
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  const now = new Date().toISOString();
  const T = {
    organizations: [{ id: O1, name: 'Clínica Teste', slug: 'clinica-teste', plan: 'adv', brand: { short: 'Clínica Teste' }, settings: { template: 'geral', products: [{ nm: 'Avaliação', price: 150 }], services: [] } }],
    memberships: [{ org_id: O1, user_id: U, role: 'owner', squad: null }],
    pipelines: [{ id: 'p1', org_id: O1, name: 'Funil de vendas', position: 0 }],
    stages: [['s1', 'Novo lead', 5, 'open'], ['s2', 'Qualificado', 30, 'open'], ['s3', 'Fechado', 100, 'won'], ['s4', 'Perdido', 0, 'lost']].map(([id, name, probability, kind], position) => ({ id, org_id: O1, pipeline_id: 'p1', name, probability, kind, position })),
    contacts: [{ id: 'c1', org_id: O1, kind: 'pf', name: 'Ana Teste', phone_hint: '1234', email_hint: 'a•••@t.com', created_at: now, updated_at: now, services: {} }],
    deals: [{ id: 'd1', org_id: O1, contact_id: 'c1', pipeline_id: 'p1', stage_id: 's1', value: 150, temperature: 'frio', created_at: now, updated_at: now }],
    tasks: [], campaigns: [], kb_items: [], profiles: [{ id: U, full_name: 'Dona Teste' }],
    subscriptions: [{ user_id: U, plan: 'adv', status: 'trial', trial_ends_at: new Date(Date.now() + 5 * 864e5).toISOString() }],
    sales: [], installments: [], platform_settings: [{ id: 1, plans: [], extras: [], implant: {}, trial_days: 7 }],
  };
  const calls = [];
  function from(table) {
    const st = { table, op: 'select', filters: [], payload: null, single: false, maybe: false };
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; },
      eq(k, v) { st.filters.push((r) => r[k] === v); return b; }, in(k, vs) { st.filters.push((r) => vs.includes(r[k])); return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; }, update(p) { st.op = 'update'; st.payload = p; return b; }, delete() { st.op = 'delete'; return b; },
      single() { st.single = true; return b; }, maybeSingle() { st.maybe = true; return b; },
      then(ok, bad) { return Promise.resolve(exec(st)).then(ok, bad); },
    };
    return b;
  }
  function exec(st) {
    const rows = T[st.table] = T[st.table] || [];
    calls.push(st.op + ' ' + st.table);
    let data;
    if (st.op === 'insert') { const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((r) => Object.assign({ id: uuid(), created_at: now, updated_at: now }, r)); rows.push(...list); data = list; }
    else if (st.op === 'update') { data = rows.filter((r) => st.filters.every((f) => f(r))); data.forEach((r) => Object.assign(r, st.payload)); }
    else if (st.op === 'delete') { data = []; }
    else data = rows.filter((r) => st.filters.every((f) => f(r))).map((r) => (st.table === 'memberships' ? Object.assign({ organizations: T.organizations.find((o) => o.id === r.org_id) }, r) : r));
    if (st.single || st.maybe) data = data[0] || null;
    return { data, error: null };
  }
  const RPC = {
    is_platform_admin: () => true, admin_tenants: () => [], org_billing: () => [], create_organization: () => { const id = uuid(); T.organizations.push({ id, name: 'Nova', settings: {}, brand: {} }); T.memberships.push({ org_id: id, user_id: U, role: 'owner' }); return id; },
    get_contact_sensitive: () => [{ phone: '(19) 91234-1234', document: '123.456.789-00', email: 'ana@t.com' }], set_contact_sensitive: () => null,
    import_rows: (a) => ({ created: a.p_rows.length, skipped: 0, deals: a.p_rows.filter((r) => r.stage_id).length }), request_plan: () => null,
    admin_set_subscription: () => null, admin_save_settings: () => null, find_contact_by_phone: () => null,
  };
  const client = {
    from, rpc: (name, args) => { calls.push('rpc ' + name); return Promise.resolve(RPC[name] ? { data: RPC[name](args || {}), error: null } : { data: null, error: { message: 'rpc ausente: ' + name } }); },
    auth: { getSession: async () => ({ data: { session: { user: { id: U, email: 'dona@teste.com' } } } }), refreshSession: async () => ({}), signOut: async () => ({}), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    storage: { from: () => ({ upload: async () => { calls.push('storage upload'); return { data: {}, error: null }; } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  };
  let booted = false;
  async function boot() {
    if (booted) return; booted = true;
    REAL.sb = client; REAL.user = { id: U, email: 'dona@teste.com' };
    realWrites();
    await startReal(REAL.user);
  }
  /* fluxos que dependem do banco responder (o robô geral não espera) */
  async function flows() {
    await boot();
    const o = O(), out = {};
    const c = o.contacts[0]; openContact(c.id); ACT.finNew({ dataset: { c: c.id } });
    S.finForm.total = '900'; ACT.finSet({ dataset: { k: 'mode', v: 'parcelado' } }); document.querySelector('#fnTotal').value = '900';
    await SUB.finSave();
    out.venda = T.sales.length + ' venda, ' + T.installments.length + ' parcelas no banco';
    const rows = impCsv('Nome;Celular\nUm;(11) 91111-1111\nDois;(11) 92222-2222\n');
    S.imp = { step: 2, file: 't.csv', headers: rows[0], rows: rows.slice(1), map: impGuess(rows[0]), stageMap: {}, defStage: null, pipe: null };
    go('importar'); ACT.impGo({ dataset: { v: '3' } }); S.imp.lgpd = true;
    await ACT.impRun(); out.importacao = S.imp.result;
    const before = T.tasks.length; S.tabs = S.tabs || {};
    return out;
  }
  async function run() {
    await boot();
    const r = await E2E.run();
    return Object.assign(r, { gravacoes: calls.filter((c) => !c.startsWith('select')).reduce((a, c) => { a[c] = (a[c] || 0) + 1; return a; }, {}) });
  }
  return { run, boot, flows, calls, T };
})();
