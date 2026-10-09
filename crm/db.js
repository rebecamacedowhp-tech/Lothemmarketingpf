/* LOTHEM Vendas — dados reais (Supabase): login, organizações, funis, contatos, negócios e tarefas.
   Sem login, ou com #demo no endereço, o CRM roda a demonstração com dados fictícios. */

const REAL = { on: false, sb: null, user: null, roles: {} };
const ROLE_PT = { owner: 'Proprietária', manager: 'Gestor', closer: 'Closer', sdr: 'SDR', traffic: 'Tráfego', viewer: 'Leitor' };
const ROLE_DB = Object.fromEntries(Object.entries(ROLE_PT).map(([k, v]) => [v, k]));

/* Funil padrão do Diagnóstico Completo (Lothem Crédito). Serve de base para novos clientes de implantação. */
const RAIOX_STAGES = [
  ['Novo contato', 5, 'open'], ['Qualificado', 15, 'open'], ['Diagnóstico pago', 40, 'open'], ['Autorização assinada', 50, 'open'],
  ['Diagnóstico pronto', 60, 'open'], ['Reunião feita', 70, 'open'], ['Consultoria fechada', 100, 'won'], ['Perdido', 0, 'lost'],
];

/* Modelos de organização. Produtos e serviços ficam nas configurações da organização e podem ser editados. */
const TEMPLATES = {
  credito_pj: {
    funnel: 'Funil PJ',
    stages: [['Novo contato', 5, 'open'], ['Qualificado', 15, 'open'], ['Diagnóstico pago', 40, 'open'], ['Autorização assinada', 50, 'open'], ['Relatório entregue', 60, 'open'], ['Reunião feita', 70, 'open'], ['Proposta enviada', 80, 'open'], ['Fechado', 100, 'won'], ['Perdido', 0, 'lost']],
    products: [{ nm: 'Diagnóstico Completo', price: 97 }, { nm: 'Diagnóstico + Rota de Crédito', price: 149 }, { nm: 'Diagnóstico PF (CPF do sócio)', price: 67 }, { nm: 'Rating PJ', price: 0 }, { nm: 'Consultoria', price: 3897 }],
    services: ['Contabilidade: balanço e DRE', 'Contabilidade: regularização fiscal', 'Contabilidade: organização do faturamento', 'Rating PJ', 'Limpa nome (CNPJ)', 'Limpa nome (CPF do sócio)', 'Consultoria de crédito'],
  },
  credito_pf: {
    funnel: 'Funil PF',
    stages: [['Novo contato', 5, 'open'], ['Qualificado', 15, 'open'], ['Diagnóstico pago', 40, 'open'], ['Autorização assinada', 50, 'open'], ['Relatório entregue', 60, 'open'], ['Reunião feita', 70, 'open'], ['Proposta enviada', 80, 'open'], ['Fechado', 100, 'won'], ['Perdido', 0, 'lost']],
    products: [{ nm: 'Diagnóstico PF', price: 67 }, { nm: 'Consultoria', price: 3897 }],
    services: ['Limpa nome', 'Rating / score', 'Organização das dívidas', 'Consultoria de crédito'],
  },
  geral: {
    funnel: 'Funil de vendas',
    stages: [['Novo lead', 5, 'open'], ['Em conversa com a SDR', 10, 'open'], ['Qualificado', 30, 'open'], ['Reunião agendada', 50, 'open'], ['Proposta enviada', 70, 'open'], ['Fechado', 100, 'won'], ['Perdido', 0, 'lost']],
    products: [],
    services: [],
  },
};

function realClient() {
  const C = window.LOTHEM_CONFIG;
  if (!C || !window.supabase) return null;
  return window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}

/* ---------- tela de login ---------- */
function loginScreen(mode = 'entrar', note = '') {
  document.documentElement.classList.add('real');
  const t = { entrar: ['Entrar no Lothem Vendas', 'Entrar'], criar: ['Criar sua conta', 'Criar conta'], senha: ['Recuperar a senha', 'Enviar link'] }[mode];
  $('#app').className = 'auth-wrap';
  $('#app').innerHTML = `<div class="auth-card">
    <div class="row" style="gap:12px">${orgMark({ hue: 'cy', mark: 'LV' }, 40)}<div><b style="font-family:var(--f-display);font-size:18px">Lothem Vendas</b><div class="dim" style="font-size:13px">CRM com SDR IA</div></div></div>
    <h2 style="font-size:24px">${t[0]}</h2>
    ${mode === 'criar' ? `<div class="row" style="gap:8px;font-size:13.5px"><span class="cy">${ic('Hourglass', 'sm')}</span><span><b>7 dias grátis</b> com tudo liberado. Sem cartão.</span></div>` : ''}
    ${note ? `<div class="auth-note">${note}</div>` : ''}
    <form class="col" style="gap:16px" data-sub="auth" data-mode="${mode}">
      ${mode === 'criar' ? `<div class="field"><label for="auNm">Seu nome</label><input class="in" id="auNm" autocomplete="name" required></div>` : ''}
      <div class="field"><label for="auEm">E-mail</label><input class="in" id="auEm" type="email" autocomplete="email" required autofocus></div>
      ${mode !== 'senha' ? `<div class="field"><label for="auPw">Senha</label><input class="in" id="auPw" type="password" minlength="8" autocomplete="${mode === 'criar' ? 'new-password' : 'current-password'}" required>${mode === 'criar' ? '<span class="hint">Pelo menos 8 caracteres.</span>' : ''}</div>` : ''}
      <button class="btn pri block" type="submit" id="auBtn">${t[1]}</button>
    </form>
    <div class="col" style="gap:10px;align-items:flex-start">
      ${mode === 'entrar' ? `<button class="link" data-act="authMode" data-v="criar">Ainda não tem conta? Teste 7 dias grátis</button><button class="link" data-act="authMode" data-v="senha">Esqueci a senha</button>` : `<button class="link" data-act="authMode" data-v="entrar">Já tenho conta. Entrar</button>`}
    </div>
    <hr class="sep">
    <a class="btn ghost block" href="#demo" data-act="openDemo">${ic('Play', 'sm')}Ver a demonstração com dados fictícios</a>
    <div class="dim" style="font-size:11.5px;text-align:center;letter-spacing:.04em">Um produto LOTHEM — Inteligência em Tecnologia</div>
  </div>`;
  const f = $('#auEm'); if (f) f.focus();
}
ACT.authMode = (el) => loginScreen(el.dataset.v);
ACT.openDemo = (el, e) => { e.preventDefault(); location.hash = 'demo'; location.reload(); };
SUB.auth = async (f) => {
  const mode = f.dataset.mode, em = $('#auEm').value.trim(), pw = $('#auPw') ? $('#auPw').value : '';
  const btn = $('#auBtn'); btn.disabled = true; btn.textContent = 'Aguarde…';
  const site = (window.LOTHEM_CONFIG && window.LOTHEM_CONFIG.siteUrl) || location.origin;
  let r;
  if (mode === 'entrar') r = await REAL.sb.auth.signInWithPassword({ email: em, password: pw });
  else if (mode === 'criar') r = await REAL.sb.auth.signUp({ email: em, password: pw, options: { data: { full_name: $('#auNm').value.trim() }, emailRedirectTo: site } });
  else r = await REAL.sb.auth.resetPasswordForEmail(em, { redirectTo: site });
  if (r.error) { btn.disabled = false; btn.textContent = 'Tentar de novo'; loginNote(authError(r.error)); return; }
  if (mode === 'criar' && !r.data.session) { loginScreen('entrar', 'Conta criada. Enviamos um e-mail para <b>' + esc(em) + '</b>: clique no link para confirmar e depois entre aqui.'); return; }
  if (mode === 'senha') { loginScreen('entrar', 'Se esse e-mail tiver conta, chega um link para criar uma senha nova.'); return; }
  startReal(r.data.session.user);
};
function loginNote(html) { const c = $('.auth-card'); let n = $('.auth-note', c); if (!n) { n = document.createElement('div'); n.className = 'auth-note bad'; c.querySelector('h2').after(n); } n.className = 'auth-note bad'; n.innerHTML = html; }
function authError(e) {
  const m = (e.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha não conferem.';
  if (m.includes('email not confirmed')) return 'Falta confirmar o e-mail. Abra a mensagem que enviamos e clique no link.';
  if (m.includes('already registered')) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (m.includes('rate limit')) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (m.includes('password')) return 'A senha precisa ter pelo menos 8 caracteres.';
  return 'Não deu certo: ' + esc(e.message);
}

/* ---------- carregar os dados reais ---------- */
const blankMetrics = (o) => ({
  goalLabel: 'Meta do mês', goal: (o.settings && o.settings.goal) || 10000, done: 0, money: true,
  kpis: [], funnel: [{ nm: 'Contatos', v: 0 }, { nm: 'Negócios', v: 0 }, { nm: 'Ganhos', v: 0, gold: true }],
  funnelNote: 'Números reais desta organização.', series: { a: Array(30).fill(0), b: Array(30).fill(0), la: 'Contatos', lb: 'Negócios', start: [8, 9] },
  campaigns: [], insight: '', ia: { active: 0, handoffs: 0, reviews: 0, conf: 0, resp: '—', csat: '—' }, ticker: [], alerts: [],
});
const dayOff = (iso) => { if (!iso) return 0; const d = new Date(iso), t = new Date(); t.setHours(0, 0, 0, 0); const d0 = new Date(d); d0.setHours(0, 0, 0, 0); return Math.round((d0 - t) / 86400000); };
const hhmm = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '09:00');
const ago = (iso) => { if (!iso) return '—'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' dias'; };

async function loadReal() {
  const sb = REAL.sb, uid = REAL.user.id;
  const mySub = await sb.from('subscriptions').select('*').eq('user_id', uid).maybeSingle();
  REAL.sub = mySub.error ? null : mySub.data;
  const ms = await sb.from('memberships').select('org_id, role, squad, organizations(id, name, slug, plan, brand, settings)').eq('user_id', uid);
  if (ms.error) throw ms.error;
  if (!ms.data.length) return false;
  const orgIds = ms.data.map((m) => m.org_id);
  const [allMs, pips, stg, cts, dls, tks, camps, kbs] = await Promise.all([
    sb.from('memberships').select('org_id, user_id, role, squad').in('org_id', orgIds),
    sb.from('pipelines').select('*').in('org_id', orgIds).order('position'),
    sb.from('stages').select('*').in('org_id', orgIds).order('position'),
    sb.from('contacts').select('*').in('org_id', orgIds).order('created_at', { ascending: false }).limit(2000),
    sb.from('deals').select('*').in('org_id', orgIds).order('updated_at', { ascending: false }).limit(2000),
    sb.from('tasks').select('*').in('org_id', orgIds).order('due_at').limit(2000),
    sb.from('campaigns').select('*').in('org_id', orgIds).order('created_at'),
    sb.from('kb_items').select('*').in('org_id', orgIds).order('created_at', { ascending: false }),
  ]);
  for (const r of [allMs, pips, stg, cts, dls, tks]) if (r.error) throw r.error;
  const userIds = Array.from(new Set(allMs.data.map((m) => m.user_id)));
  const profs = await sb.from('profiles').select('*').in('id', userIds);
  const colors = ['#1f9fd6', '#7a5cf0', '#e0577f', '#1aa874', '#d98a1c', '#3d7be0'];
  DB.users = userIds.map((id, i) => {
    const p = (profs.data || []).find((x) => x.id === id) || {};
    const mine = allMs.data.filter((m) => m.user_id === id);
    const name = p.full_name || (id === uid ? REAL.user.email : 'Pessoa da equipe');
    return { id, name, short: name.split(' ')[0], email: id === uid ? REAL.user.email : '', phone: p.phone_hint ? '•••• ' + p.phone_hint : '', photo: p.avatar_url || null,
      role: ROLE_PT[mine[0].role] || 'SDR', fn: '', squad: mine[0].squad === 'fec' ? 'fec' : 'aq', xp: 0, seasonXp: 0, color: colors[i % colors.length],
      status: 'ativo', last: id === uid ? 'agora' : '—', twofa: false, orgs: mine.map((m) => m.org_id), kpi: { nm: 'Meta do mês', v: 0, goal: 1 } };
  });
  DB.me = uid;
  DB.invites = []; DB.notifications = []; DB.tickets = [];
  DB.game.challenges = []; DB.game.achievements.forEach((a) => { a.got = false; if (a.prog) a.prog[0] = 0; });
  DB.comp = {};
  DB.orgs = {};
  ms.data.forEach((m) => {
    const o = m.organizations, brand = o.brand || {}, set = o.settings || {};
    REAL.roles[o.id] = m.role;
    const pipelines = pips.data.filter((p) => p.org_id === o.id).map((p) => ({ id: p.id, nm: p.name, desc: p.description || '', stages: stg.data.filter((s) => s.pipeline_id === p.id).map((s) => ({ id: s.id, nm: s.name, p: s.probability, won: s.kind === 'won', lost: s.kind === 'lost' })) }));
    const contacts = cts.data.filter((c) => c.org_id === o.id).map((c) => ({ id: c.id, pf: c.kind === 'pf', nm: c.name, co: c.kind === 'pf' ? (c.occupation || 'Pessoa física') : (c.company || '—'), seg: c.segment || '—', city: c.city || '—', ph: c.phone_hint ? '•••• ' + c.phone_hint : '—', docHint: c.document_hint || null, em: c.email_hint || '—', src: c.source || 'Cadastro manual', owner: c.owner_id || uid, life: c.lifecycle || 'Lead', score: c.score || 0, last: ago(c.updated_at), noContact: c.do_not_contact, services: c.services || {}, camp: c.campaign_id || null }));
    const deals = dls.data.filter((d) => d.org_id === o.id).map((d) => ({ id: d.id, c: d.contact_id, p: d.pipeline_id, s: d.stage_id, v: Number(d.value), temp: d.temperature, owner: d.owner_id || uid, next: d.next_step || '—', age: ago(d.updated_at), product: d.product || null, camp: d.campaign_id || null }));
    const tasks = tks.data.filter((t) => t.org_id === o.id).map((t) => ({ id: t.id, t: t.title, type: t.kind || 'SquareCheck', who: t.assignee_id || uid, due: dayOff(t.due_at), at: hhmm(t.due_at), deal: t.deal_id, pri: t.priority === 'alta' ? 'alta' : 'média', xp: 10, done: !!t.done_at }));
    const words = (brand.short || o.name).replace(/^LOTHEM\s*[—-]\s*/i, '').split(/\s+/);
    const org = {
      id: o.id, name: o.name, short: brand.short || o.name, mark: brand.mark || (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase(), hue: 'cy',
      accent: brand.accent || null, logo: brand.logo || null, plan: o.plan === 'implantacao' ? 'Implantação' : o.plan,
      members: allMs.data.filter((x) => x.org_id === o.id).map((x) => x.user_id),
      ia: Object.assign({ name: 'Cibelle', role: 'SDR IA', mode: 'cop', offer: '', price: 0 }, set.ia || {}),
      sla: Object.assign({ primeira: 5, transfer: 10, retorno: 15, followup: 24, warnAt: 80, business: true, notifyBoss: true, redistribute: false, iaHold: false, roles: ['SDR'] }, set.sla || {}),
      slaStats: [], metrics: blankMetrics(o), pipelines: pipelines.length ? pipelines : [{ id: 'none', nm: 'Funil', desc: '', stages: [{ id: 'none', nm: 'Sem etapas', p: 0 }] }],
      contacts, deals, tasks, instances: [], templates: [], integrations: [], conversations: [],
      channels: [{ id: 'geral', nm: 'geral', unread: 0, msgs: [] }], dms: [], kb: [], skills: [{ nm: 'Abertura', v: 0 }],
      iaStats: { convs: 0, qual: '—', sold: 0, soloSold: 0, transfers: 0, conf: 0, csat: '—', approvals: 0 }, reviews: [], rules: [], handoffRules: [],
      autofill: { on: false, minConf: 85, fields: [], never: [], stats: { today: 0, corrected: 0 }, log: [] },
      products: set.products || [], services: set.services || [],
      camps: (camps.error ? [] : camps.data).filter((c) => c.org_id === o.id).map((c) => ({ id: c.id, nm: c.name, spend: Number(c.spend), imp: c.impressions, clk: c.clicks, pleads: c.platform_leads, status: c.status, m: c.metrics || {} })),
    };
    org._set = set;
    org.kb = (kbs.error ? [] : kbs.data).filter((k) => k.org_id === o.id).map(kbRow);
    applyKit(org, guessKit(o.name, set), set, { skills: {} });
    refreshRealMetrics(org);
    DB.orgs[o.id] = org;
  });
  const [sls, ins, bcs] = await Promise.all([sb.from('sales').select('*').in('org_id', orgIds), sb.from('installments').select('*').in('org_id', orgIds).order('n'), sb.from('broadcasts').select('*').in('org_id', orgIds).order('created_at')]);
  Object.values(DB.orgs).forEach((o) => {
    o.blasts = (bcs.error ? [] : bcs.data).filter((b) => b.org_id === o.id).map((b) => ({ id: b.id, nm: b.name, tpl: b.template, total: (b.contact_ids || []).length, ids: b.contact_ids || [], perHour: b.per_hour, win: [String(b.window_start).slice(0, 5), String(b.window_end).slice(0, 5)], weekdays: b.weekdays_only, stopPct: Number(b.stop_at_pct), status: b.status, date: b.created_at.slice(8, 10) + '/' + b.created_at.slice(5, 7), stats: Object.assign({ sent: 0, delivered: 0, read: 0, replied: 0, optout: 0, failed: 0, sales: 0 }, b.stats || {}) }));
    o.finance = Object.assign({ remind: true, hour: '09:00', tpl: FIN_TPL }, (o._set || {}).finance || {});
    o.sales = (sls.error ? [] : sls.data).filter((x) => x.org_id === o.id).map((x) => ({ id: x.id, c: x.contact_id, deal: x.deal_id, product: x.product || '', total: Number(x.total), method: x.method, mode: x.mode, n: x.installments, seller: x.seller_id, date: x.created_at.slice(0, 10), notes: x.notes || '',
      inst: (ins.error ? [] : ins.data).filter((i) => i.sale_id === x.id).map((i) => ({ id: i.id, n: i.n, due: i.due, v: Number(i.value), paidAt: i.paid_at, remindAt: i.reminder_sent_at })) }));
  });
  realBilling(REAL.sub, Object.values(DB.orgs));
  await Promise.all(Object.values(DB.orgs).filter((o) => REAL.roles[o.id] !== 'owner').map(async (o) => {
    const b = await sb.rpc('org_billing', { p_org: o.id });
    const row = !b.error && b.data && b.data[0];
    if (row) o.ownerBill = { plan: row.plan, status: row.status, trialEnd: row.trial_ends_at };
  }));
  return true;
}
const KB_IC = { Treinamento: 'FileText', Artigo: 'Newspaper', Objeções: 'BadgeCheck', Oferta: 'Tag', Regras: 'ShieldCheck', FAQ: 'CircleHelp', Playbook: 'ListChecks' };
function kbRow(k) {
  const d = new Date(k.created_at);
  return { id: k.id, ic: KB_IC[k.category] || 'File', nm: k.title, type: k.file_path ? 'Arquivo' : k.content ? 'Texto' : 'Item', cat: k.category || 'Treinamento', st: k.status === 'ready' || k.status === 'processing' ? 'ok' : k.status === 'pending' ? 'pend' : 'ok', uses: 0, upd: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') };
}
function refreshRealMetrics(org) {
  const m = org.metrics, open = org.deals.filter((d) => { const s = org.pipelines.flatMap((p) => p.stages).find((x) => x.id === d.s); return s && !s.won && !s.lost; });
  const won = org.deals.filter((d) => { const s = org.pipelines.flatMap((p) => p.stages).find((x) => x.id === d.s); return s && s.won; });
  m.done = won.reduce((a, d) => a + d.v, 0);
  m.kpis = [
    { k: 'Contatos', v: String(org.contacts.length), delta: 0, spark: [0, 0, 0, 0, 0, 0, org.contacts.length], go: 'contatos', hint: 'na organização' },
    { k: 'Negócios abertos', v: String(open.length), delta: 0, spark: [0, 0, 0, 0, 0, 0, open.length], go: 'funis', hint: brl(open.reduce((a, d) => a + d.v, 0)) + ' em aberto' },
    { k: 'Ganhos', v: String(won.length), delta: 0, spark: [0, 0, 0, 0, 0, 0, won.length], go: 'funis', hint: brl(m.done) },
    { k: 'Tarefas de hoje', v: String(org.tasks.filter((t) => t.due === 0 && !t.done).length), delta: 0, spark: [0, 0, 0, 0, 0, 0, 0], go: 'tarefas', hint: 'abertas' },
  ];
  m.funnel = [{ nm: 'Contatos', v: org.contacts.length }, { nm: 'Negócios', v: org.deals.length }, { nm: 'Ganhos', v: won.length, gold: true }];
}

/* ---------- primeira organização ---------- */
function onboardingScreen() {
  $('#app').className = 'auth-wrap';
  $('#app').innerHTML = `<div class="auth-card wide">
    <h2 style="font-size:24px">Vamos montar a sua empresa no Lothem Vendas</h2>
    <p class="muted">Você ainda não faz parte de nenhuma organização. Escolha como começar.</p>
    ${REAL.sub && REAL.sub.plan === 'interno' ? `<button class="type-c" data-act="seedLothem"><b>Lothem Crédito: PJ e PF</b><span class="muted" style="font-size:13px">Cria as duas organizações com o funil do Diagnóstico Completo, os produtos (Diagnóstico, Rota de Crédito, PF do sócio, Rating PJ, Consultoria) e as caixinhas de serviços na ficha do cliente.</span></button>` : ''}
    <form class="type-c" data-sub="firstOrg" style="cursor:default"><b>Modelo geral: qualquer nicho com vendedor e SDR</b><span class="muted" style="font-size:13px">Funil: novo lead, em conversa com a SDR, qualificado, reunião agendada, proposta enviada, fechado. Ideal para implantar em clientes.</span>
      <div class="field"><label for="foNm">Nome da empresa</label><input class="in" id="foNm" placeholder="Ex.: Clínica Sorriso"></div><button class="btn block" type="submit">Criar com o modelo geral</button></form>
    <button class="link" data-act="logoutReal">Sair</button>
  </div>`;
}
async function createOrgWithFunnel(name, slug, tplKey, short) {
  const sb = REAL.sb, tpl = TEMPLATES[tplKey] || TEMPLATES.geral;
  const r = await sb.rpc('create_organization', { p_name: name, p_slug: slug });
  if (r.error) throw r.error;
  const orgId = r.data;
  const up = await sb.from('organizations').update({ brand: { short: short || name }, settings: { template: tplKey, products: tpl.products, services: tpl.services } }).eq('id', orgId);
  if (up.error) throw up.error;
  const p = await sb.from('pipelines').insert({ org_id: orgId, name: tpl.funnel, position: 0 }).select().single();
  if (p.error) throw p.error;
  const st = await sb.from('stages').insert(tpl.stages.map(([nm, prob, kind], i) => ({ org_id: orgId, pipeline_id: p.data.id, name: nm, position: i, probability: prob, kind })));
  if (st.error) throw st.error;
  return orgId;
}
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
ACT.seedLothem = async (el) => {
  el.disabled = true; el.querySelector('b').textContent = 'Criando…';
  try {
    await createOrgWithFunnel('LOTHEM — Inteligência em Crédito · PJ', slugify('lothem credito pj'), 'credito_pj', 'Lothem Crédito PJ');
    await createOrgWithFunnel('LOTHEM — Inteligência em Crédito · PF', slugify('lothem credito pf'), 'credito_pf', 'Lothem Crédito PF');
    await REAL.sb.auth.refreshSession();
    startReal(REAL.user);
  } catch (e) { el.disabled = false; el.querySelector('b').textContent = 'Não deu certo. Tentar de novo'; console.error(e); }
};
SUB.firstOrg = async () => {
  const nm = $('#foNm').value.trim(); if (!nm) return;
  try { await createOrgWithFunnel(nm, slugify(nm), 'geral', nm); await REAL.sb.auth.refreshSession(); startReal(REAL.user); } catch (e) { toast('Não deu certo', e.message, 'bad', 'CircleAlert'); }
};

/* ---------- gravar as mudanças no banco ---------- */
function realWrites() {
  const sb = REAL.sb, oid = () => S.org;
  const fail = (e) => { console.error(e); toast('Não consegui salvar', 'Confira a internet e tente de novo. A tela pode estar diferente do banco.', 'bad', 'CircleAlert'); };

  REAL.saveSettings = (o, change) => {
    const next = JSON.parse(JSON.stringify(o._set || {}));
    change(next); o._set = next;
    return sb.from('organizations').update({ settings: next }).eq('id', o.id).then((r) => { if (r.error) fail(r.error); });
  };
  const iaKeep = (o) => REAL.saveSettings(o, (st) => {
    st.ia = { name: o.ia.name, role: o.ia.role, mode: o.ia.mode, offer: o.ia.offer, price: o.ia.price };
    st.play = Object.assign(st.play || {}, { hi: o.play.hi, what: o.play.what, pay: o.play.pay, cond: o.play.cond });
  });
  const basePersona = SUB.persona;
  SUB.persona = (f) => { basePersona(f); iaKeep(O()); };
  const baseOffer = SUB.offer;
  SUB.offer = (f) => { baseOffer(f); iaKeep(O()); };
  const baseMode = ACT.setMode;
  ACT.setMode = (el) => { baseMode(el); iaKeep(O()); };
  const baseRule = CHG.rule;
  CHG.rule = (el) => {
    baseRule(el);
    const r = O().rules[+el.dataset.i];
    REAL.saveSettings(O(), (st) => {
      st.rulesOff = (st.rulesOff || []).filter((t) => t !== r.t); st.rulesOn = (st.rulesOn || []).filter((t) => t !== r.t);
      (r.on ? st.rulesOn : st.rulesOff).push(r.t);
    });
  };
  /* Base de conhecimento: o que for ensinado fica salvo (arquivos vão para a pasta privada da organização) */
  const kbSave = async (row, file) => {
    const o = O();
    if (file) {
      const path = o.id + '/kb/' + Date.now() + '-' + file.name.replace(/[^\w.\-]+/g, '_');
      const up = await sb.storage.from('arquivos').upload(path, file);
      if (up.error) return fail(up.error);
      row.file_path = path;
    }
    const r = await sb.from('kb_items').insert(Object.assign({ org_id: o.id, status: 'ready' }, row)).select().single();
    if (r.error) return fail(r.error);
    const local = o.kb.find((k) => !k.kit && k.nm === row.title && !k.saved);
    if (local) { local.id = r.data.id; local.saved = true; }
  };
  const baseKbFiles = CHG.kbFiles;
  CHG.kbFiles = (el) => { const files = Array.from(el.files || []); baseKbFiles(el); files.forEach((f) => kbSave({ title: f.name, category: 'Treinamento' }, f)); };
  const baseKbLink = SUB.kbLink;
  SUB.kbLink = (f) => { const u = $('#kbUrl').value.trim(); baseKbLink(f); if (!u) return; let host = u; try { host = new URL(u).hostname; } catch (e) { /* sem protocolo */ } kbSave({ title: 'Artigo: ' + host, category: 'Artigo', content: u }); };
  const baseWrite = SUB.writeAnswer;
  SUB.writeAnswer = (f) => {
    const q = $('#waQ').value.trim(), a = $('#waA').value.trim(); baseWrite(f); if (!q || !a) return;
    kbSave({ title: 'Resposta aprovada: "' + q.slice(0, 48) + (q.length > 48 ? '…' : '') + '"', category: 'Objeções', content: 'Pergunta: ' + q + '\nResposta: ' + a });
  };

  const baseMove = moveDeal;
  moveDeal = function (id, sid, opts = {}) {
    const d = DL(id), before = d && d.s;
    baseMove(id, sid, opts);
    if (d && d.s !== before) sb.from('deals').update({ stage_id: d.s, next_step: d.next, temperature: d.temp, lost_reason: opts.reason || null, updated_at: new Date().toISOString() }).eq('id', id).then((r) => { if (r.error) fail(r.error); });
  };

  SUB.newDeal = async () => {
    const nm = $('#ndNm').value.trim(), co = $('#ndCo').value.trim();
    if (!nm) { toast('Falta preencher', 'O nome é obrigatório.', 'warn', 'CircleAlert'); return; }
    const pid = $('#ndPipe').value, pp = PIPE(pid), first = pp.stages.find((s) => !s.lost && !s.won) || pp.stages[0];
    const v = parseInt(($('#ndVal').value || '0').replace(/\D/g, ''), 10) || 0;
    const prod = ($('#ndProd') && $('#ndProd').value) || null, camp = ($('#ndCamp') && $('#ndCamp').value) || null;
    const campNm = camp ? (O().camps.find((c) => c.id === camp) || {}).nm : null;
    const ct = await sb.from('contacts').insert({ org_id: oid(), kind: co ? 'pj' : 'pf', name: nm, company: co || null, segment: $('#ndSeg').value || null, source: campNm ? 'Meta · ' + campNm : 'Cadastro manual', campaign_id: camp, owner_id: DB.me, lifecycle: 'Lead' }).select().single();
    if (ct.error) return fail(ct.error);
    const phone = $('#ndPh').value.trim();
    if (phone) { const ps = await sb.rpc('set_contact_sensitive', { p_contact: ct.data.id, p_phone: phone }); if (ps.error) fail(ps.error); }
    const dl = await sb.from('deals').insert({ org_id: oid(), contact_id: ct.data.id, pipeline_id: pid, stage_id: first.id, value: v, owner_id: DB.me, next_step: 'Primeiro contato', product: prod, campaign_id: camp }).select().single();
    if (dl.error) return fail(dl.error);
    const o = O();
    o.contacts.unshift({ id: ct.data.id, pf: !co, nm, co: co || 'Pessoa física', seg: $('#ndSeg').value || '—', city: '—', ph: phone ? '•••• ' + phone.replace(/\D/g, '').slice(-4) : '—', em: '—', src: campNm ? 'Meta · ' + campNm : 'Cadastro manual', owner: DB.me, life: 'Lead', score: 0, last: 'agora', services: {}, camp });
    o.deals.unshift({ id: dl.data.id, c: ct.data.id, p: pid, s: first.id, v, temp: 'frio', owner: DB.me, next: 'Primeiro contato', age: 'agora', moved: true, product: prod, camp });
    refreshRealMetrics(o);
    closeOverlay(); S.pipe = pid;
    toast('Negócio criado', (co || nm) + ' entrou em ' + pp.nm + '.', '', 'Kanban');
    if (S.route === 'funis') rerender(); else go('funis');
  };

  const baseDone = ACT.doneTask;
  ACT.doneTask = (el) => {
    baseDone(el);
    const t = O().tasks.find((x) => x.id === el.dataset.id);
    sb.from('tasks').update({ done_at: t.done ? new Date().toISOString() : null }).eq('id', t.id).then((r) => { if (r.error) fail(r.error); });
  };

  SUB.newTask = async () => {
    const t = $('#ntT').value.trim(); if (!t) return;
    const due = new Date(); due.setDate(due.getDate() + Number($('#ntDay').value)); const [h, mi] = ($('#ntAt').value || '15:00').split(':'); due.setHours(+h, +mi, 0, 0);
    const r = await sb.from('tasks').insert({ org_id: oid(), title: t, kind: $('#ntType').value, assignee_id: $('#ntWho').value, due_at: due.toISOString(), deal_id: $('#ntDeal').value || null, priority: 'media' }).select().single();
    if (r.error) return fail(r.error);
    O().tasks.push({ id: r.data.id, t, type: $('#ntType').value, who: $('#ntWho').value, due: Number($('#ntDay').value), at: $('#ntAt').value || '15:00', deal: $('#ntDeal').value || null, pri: 'média', xp: 10 });
    closeOverlay(); toast('Tarefa criada', t, '', 'SquareCheck'); if (S.route === 'tarefas') rerender(); else renderNav();
  };

  const baseBrand = ACT.brandSave;
  ACT.brandSave = () => {
    const id = S.brandDraft.id;
    baseBrand();
    const o = DB.orgs[id];
    sb.from('organizations').update({ brand: { short: o.short, accent: o.accent, logo: o.logo, mark: o.mark } }).eq('id', id).then((r) => { if (r.error) fail(r.error); });
  };

  SUB.newOrg = async () => {
    const nm = $('#noN').value.trim(); if (!nm) return;
    try { await createOrgWithFunnel(nm, slugify(nm), ($('#noTpl') && $('#noTpl').value) || 'geral', nm); await sb.auth.refreshSession(); closeOverlay(); toast('Organização criada', nm, '', 'Building2'); startReal(REAL.user); } catch (e) { fail(e); }
  };

  REAL.saveServices = (c) => sb.from('contacts').update({ services: c.services, updated_at: new Date().toISOString() }).eq('id', c.id).then((r) => { if (r.error) fail(r.error); });
  REAL.saveCampaign = async (cp) => {
    const row = { org_id: oid(), name: cp.nm, spend: cp.spend, impressions: cp.imp, clicks: cp.clk, platform_leads: cp.pleads, metrics: cp.m || {}, updated_at: new Date().toISOString() };
    const r = cp.id ? await sb.from('campaigns').update(row).eq('id', cp.id).select().single() : await sb.from('campaigns').insert(row).select().single();
    if (r.error) { fail(r.error); return null; }
    return r.data.id;
  };
  const baseOpen = openContact;
  openContact = function (id) {
    baseOpen(id);
    const c = CT(id), b = $('#overlay .drawer-b'); if (!c || !b) return;
    const box = document.createElement('div');
    box.className = 'col svc-box';
    box.id = 'piiBox';
    box.innerHTML = `<div class="row between"><span class="lbl">Dados sensíveis</span>${ic('Lock', 'sm dim')}</div>
      <div class="dim" style="font-size:13px">Telefone ${esc(c.ph)}${c.em && c.em !== '—' ? ' · e-mail ' + esc(c.em) : ''}${c.docHint ? ' · documento terminado em ' + esc(c.docHint) : ''}. Guardados com criptografia; abrir fica registrado no histórico.</div>
      <div class="row wrap" style="gap:8px"><button class="btn sm" data-act="piiShow" data-id="${c.id}">${ic('Eye', 'xs')}Mostrar</button><button class="btn sm ghost" data-act="piiEdit" data-id="${c.id}">${ic('PenLine', 'xs')}Editar telefone, e-mail ou CPF/CNPJ</button></div>
      <div id="piiOut"></div>`;
    b.insertBefore(box, b.children[2] || null);
  };
  ACT.piiShow = async (el) => {
    const r = await sb.rpc('get_contact_sensitive', { p_contact: el.dataset.id });
    if (r.error) return fail(r.error);
    const row = (r.data || [])[0] || {};
    $('#piiOut').innerHTML = `<div class="r-stat" style="font-size:14px">Telefone: <b>${esc(row.phone || '—')}</b><br>E-mail: <b>${esc(row.email || '—')}</b><br>Documento: <b>${esc(row.document || '—')}</b></div>`;
  };
  ACT.piiEdit = (el) => {
    $('#piiOut').innerHTML = `<form class="col" style="gap:10px" data-sub="piiSave" data-id="${el.dataset.id}"><div class="field"><label for="piPh">Telefone / WhatsApp</label><input class="in" id="piPh" inputmode="tel" placeholder="Deixe em branco para não mudar"></div><div class="field"><label for="piEm">E-mail</label><input class="in" id="piEm" type="email" placeholder="Deixe em branco para não mudar"></div><div class="field"><label for="piDoc">CPF, CNPJ ou RG</label><input class="in" id="piDoc" placeholder="Deixe em branco para não mudar"></div><button class="btn pri sm" type="submit">Salvar com criptografia</button></form>`;
  };
  SUB.piiSave = async (f) => {
    const ph = $('#piPh').value.trim(), doc = $('#piDoc').value.trim(), em = $('#piEm').value.trim(); if (!ph && !doc && !em) return;
    const r = await sb.rpc('set_contact_sensitive', { p_contact: f.dataset.id, p_phone: ph || null, p_document: doc || null, p_email: em || null });
    if (r.error) return fail(r.error);
    const c = CT(f.dataset.id);
    if (ph) c.ph = '•••• ' + ph.replace(/\D/g, '').slice(-4);
    if (doc) c.docHint = doc.replace(/\D/g, '').slice(-3);
    if (em && em.includes('@')) c.em = em[0] + '•••@' + em.split('@')[1];
    toast('Dados salvos com criptografia', c.nm, '', 'Lock');
    openContact(c.id);
  };
  const baseSwitch = ACT.switchOrg;
  ACT.switchOrg = (el) => { baseSwitch(el); store.set('realOrg', S.org); };
  ACT.logout = () => ACT.logoutReal();
  ACT.simLead = () => toast('Simulação só na demonstração', 'Aqui ficam os seus dados reais. Para ver a simulação, abra a demonstração.', '', 'Info');
}
ACT.logoutReal = async () => { await REAL.sb.auth.signOut(); location.hash = ''; location.reload(); };

async function startReal(user) {
  REAL.user = user;
  document.documentElement.classList.add('real');
  $('#app').className = 'app';
  $('#app').innerHTML = '<div class="auth-wrap"><div class="dim">Carregando seus dados…</div></div>';
  let ok;
  try { ok = await loadReal(); } catch (e) { console.error(e); loginScreen('entrar', 'Não consegui carregar seus dados: ' + esc(e.message)); return; }
  if (!ok) { onboardingScreen(); return; }
  REAL.on = true;
  try { await mestreReal(); } catch (e) { console.error(e); }
  const saved = store.get('realOrg', null);
  setOrgQuiet(DB.orgs[saved] ? saved : Object.keys(DB.orgs)[0]);
  S.route = VIEWS[S.route] ? S.route : 'central';
  $('#app').className = 'app';
  renderShell();
  renderGuide();
  billGate();
}

/* Boot: decide entre demonstração e dados reais. */
async function bootData(startDemo) {
  const wantsDemo = /^#demo/.test(location.hash);
  REAL.sb = wantsDemo ? null : realClient();
  if (!REAL.sb) { startDemo(); return; }
  realWrites();
  const { data } = await REAL.sb.auth.getSession();
  if (data && data.session) startReal(data.session.user);
  else loginScreen('entrar');
  REAL.sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') toast('Crie a senha nova', 'Vá em Meu perfil › Segurança.', '', 'KeyRound'); });
}
