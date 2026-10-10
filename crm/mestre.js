/* LOTHEM Vendas — Painel Mestre: só a dona da plataforma vê.
   Contas e situação de cada uma, pedidos de plano para liberar, mais dias de teste, suspender,
   preços e limites dos planos. No modo real, tudo passa por funções que conferem se é a administração. */

const MESTRE = { tenants: null, loaded: false };
const PLAN_NM = { ess: 'Essencial', pro: 'Profissional', adv: 'Avançado', interno: 'Uso interno', implantacao: 'Implantação' };
const ST_NM = { trial: ['Em teste', 'cy'], active: ['Ativa', 'ok'], past_due: ['Pagamento atrasado', 'warn'], canceled: ['Suspensa', 'bad'] };
const isReal = () => typeof REAL !== 'undefined' && REAL.on;
const dIso = (d) => new Date(d).toISOString();
const daysFrom = (n) => dIso(Date.now() + n * 864e5);

/* menu: aparece só para a administração da plataforma (e na demonstração) */
function mestreNav(on) {
  const has = NAV.some((g) => g.items.some((i) => i.id === 'mestre'));
  if (on && !has) NAV.push({ grp: 'Lothem', items: [{ id: 'mestre', nm: 'Painel mestre', ic: 'Crown', badge: () => { const n = (MESTRE.tenants || []).filter((t) => t.requested_plan).length; return n ? { n, cls: 'hot' } : null; } }] });
}

/* demonstração: contas fictícias de clientes do Lothem Vendas */
(function demoMestre() {
  const ago = (d) => daysFrom(-d), ahead = (d) => daysFrom(d);
  MESTRE.tenants = [
    { user_id: 't1', email: 'contato@clinicasorriso.exemplo', full_name: 'Dra. Camila Rocha', plan: 'adv', status: 'trial', trial_ends_at: ahead(2), created_at: ago(5), orgs: 'Clínica Sorriso', org_count: 1, members: 4, contacts: 312, requested_plan: 'pro', requested_cycle: 'mensal', requested_method: 'pix', requested_at: ago(0) },
    { user_id: 't2', email: 'gestao@autoescolavia.exemplo', full_name: 'Marcelo Viana', plan: 'pro', status: 'active', cycle: 'mensal', current_period_end: ahead(18), created_at: ago(40), orgs: 'Autoescola Via', org_count: 1, members: 5, contacts: 1240 },
    { user_id: 't3', email: 'rh@grupomaia.exemplo', full_name: 'Patrícia Maia', plan: 'adv', status: 'active', cycle: 'anual', current_period_end: ahead(290), created_at: ago(75), orgs: 'Maia Imóveis · Maia Seguros · Maia Consórcios', org_count: 3, members: 13, contacts: 4870 },
    { user_id: 't4', email: 'oi@studiofit.exemplo', full_name: 'Rafael Nogueira', plan: 'adv', status: 'trial', trial_ends_at: ago(1), created_at: ago(8), orgs: 'Studio Fit', org_count: 1, members: 2, contacts: 96 },
    { user_id: 't5', email: 'financeiro@contabilmais.exemplo', full_name: 'Sérgio Almeida', plan: 'ess', status: 'past_due', cycle: 'mensal', current_period_end: ago(3), created_at: ago(62), orgs: 'Contábil Mais', org_count: 1, members: 3, contacts: 410 },
    { user_id: 't6', email: 'vendas@solarvale.exemplo', full_name: 'Juliana Prates', plan: 'adv', status: 'trial', trial_ends_at: ahead(6), created_at: ago(1), orgs: 'Solar Vale Energia', org_count: 1, members: 3, contacts: 58, requested_plan: 'implantacao', requested_cycle: 'mensal', requested_method: 'pix', requested_at: ago(0) },
    { user_id: 't7', email: 'rebeca@lothem.com.br', full_name: 'Rebeca Macedo', plan: 'interno', status: 'active', created_at: ago(90), orgs: 'Lothem Marketing · Lothem Crédito · Lothem Crédito PF', org_count: 3, members: 4, contacts: 0 },
  ];
  MESTRE.loaded = true;
  mestreNav(true);
})();

async function mestreLoad() {
  if (!isReal()) return;
  const r = await REAL.sb.rpc('admin_tenants');
  if (r.error) { toast('Não consegui carregar as contas', r.error.message, 'bad', 'CircleAlert'); return; }
  MESTRE.tenants = r.data; MESTRE.loaded = true;
  if (S.route === 'mestre') rerender();
}
function tState(t) {
  if (t.plan === 'interno') return ['Uso interno', 'line'];
  if (t.status === 'trial') return new Date(t.trial_ends_at) > new Date() ? ['Teste · ' + Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) + ' dias', 'cy'] : ['Teste vencido', 'bad'];
  return ST_NM[t.status] || [t.status, 'line'];
}
const dmyT = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

VIEWS.mestre = {
  title: 'Painel mestre',
  crumb: 'Lothem',
  render() {
    if (isReal() && !MESTRE.loaded) { mestreLoad(); return `<div class="pn"><div class="empty">${ic('LoaderCircle')}<div>Carregando as contas…</div></div></div>`; }
    const T = (MESTRE.tenants || []).filter((t) => t.plan !== 'interno'), tab = S.tabs.mestre || 'resumo';
    const active = T.filter((t) => t.status === 'active'), trial = T.filter((t) => t.status === 'trial' && new Date(t.trial_ends_at) > new Date()), expired = T.filter((t) => t.status === 'trial' && new Date(t.trial_ends_at) <= new Date());
    const late = T.filter((t) => t.status === 'past_due'), reqs = (MESTRE.tenants || []).filter((t) => t.requested_plan);
    const price = (t) => { const p = DB.plans.find((x) => x.id === t.plan); return p ? (t.cycle === 'anual' ? (p.price * 10) / 12 : p.price) : 0; };
    const mrr = active.concat(late).reduce((a, t) => a + price(t), 0);
    const tabs = [['resumo', 'Resumo', 'Gauge'], ['contas', 'Contas', 'Building2', T.length], ['pedidos', 'Pedidos', 'Inbox', reqs.length], ['ia', 'IA dos clientes', 'Bot'], ['planos', 'Planos e preços', 'Tags']];
    const kpi = (k, v, sub, icn, cls) => `<div class="pn kpi" style="cursor:default"><span class="lbl">${k}</span><div class="row between"><span class="v num">${v}</span><span class="ico-box ${cls || 'cy'}">${ic(icn, 'sm')}</span></div><div class="ft"><span>${sub}</span></div></div>`;
    let body = '';
    if (tab === 'resumo') body = `<div class="kpis" style="margin-bottom:18px">
        ${kpi('Receita mensal recorrente', brl(mrr), active.length + ' contas pagantes', 'TrendingUp', 'ok')}
        ${kpi('Em teste grátis', String(trial.length), 'viram cliente em até ' + TRIAL_DAYS + ' dias', 'Hourglass')}
        ${kpi('Pedidos para liberar', String(reqs.length), 'planos e implantação', 'Inbox', reqs.length ? 'gold' : '')}
        ${kpi('Teste vencido ou atrasado', String(expired.length + late.length), 'chamar no WhatsApp', 'TriangleAlert', expired.length + late.length ? 'bad' : '')}
      </div>
      <section class="pn"><div class="pn-h"><span class="pn-t">${ic('ListTodo')}O que fazer hoje</span></div><div class="pn-b flush">
        ${reqs.map((t) => `<div class="list-i"><span class="ico-box gold">${ic('Inbox', 'sm')}</span><div class="grow"><b style="font-size:13.5px">${esc(t.full_name || t.email)} pediu ${esc(PLAN_NM[t.requested_plan] || t.requested_plan)}</b><div class="dim" style="font-size:12px">${esc(t.orgs || '')} · ${t.requested_cycle || ''} · ${t.requested_method || ''}</div></div><button class="btn sm pri" data-act="mtActivate" data-id="${t.user_id}">Liberar</button></div>`).join('')}
        ${expired.map((t) => `<div class="list-i"><span class="ico-box bad">${ic('Hourglass', 'sm')}</span><div class="grow"><b style="font-size:13.5px">Teste de ${esc(t.full_name || t.email)} venceu em ${dmyT(t.trial_ends_at)}</b><div class="dim" style="font-size:12px">${esc(t.orgs || '')} · ${t.contacts} contatos cadastrados</div></div><button class="btn sm" data-act="mtTrial" data-id="${t.user_id}">+7 dias</button></div>`).join('')}
        ${late.map((t) => `<div class="list-i"><span class="ico-box warn">${ic('CreditCard', 'sm')}</span><div class="grow"><b style="font-size:13.5px">Pagamento atrasado · ${esc(t.full_name || t.email)}</b><div class="dim" style="font-size:12px">${esc(PLAN_NM[t.plan])} · venceu em ${dmyT(t.current_period_end)}</div></div><button class="btn sm" data-act="mtActivate" data-id="${t.user_id}">Registrar pagamento</button></div>`).join('')}
        ${!reqs.length && !expired.length && !late.length ? `<div class="empty">${ic('CircleCheck')}<div>Nada pendente.</div></div>` : ''}
      </div></section>`;
    else if (tab === 'contas' || tab === 'pedidos') {
      const rows = tab === 'pedidos' ? reqs : T;
      body = rows.length ? `<div class="pn"><div class="tbl-w"><table class="tbl"><thead><tr><th>Conta</th><th>Empresas</th><th>Plano</th><th>Situação</th><th>${tab === 'pedidos' ? 'Pedido' : 'Vence'}</th><th class="r">Uso</th><th></th></tr></thead><tbody>
        ${rows.map((t) => { const [snm, scls] = tState(t); return `<tr><td><b style="font-size:13.5px">${esc(t.full_name || '—')}</b><div class="dim" style="font-size:12px">${esc(t.email)}</div></td><td style="max-width:240px">${esc(t.orgs || 'Sem empresa ainda')}</td><td class="nowrap">${esc(PLAN_NM[t.plan] || t.plan)}${t.cycle ? `<div class="dim" style="font-size:12px">${t.cycle}</div>` : ''}</td><td class="nowrap">${pill(snm, scls)}</td>
          <td class="nowrap">${tab === 'pedidos' ? `${esc(PLAN_NM[t.requested_plan] || t.requested_plan)}<div class="dim" style="font-size:12px">${t.requested_cycle || ''} · ${t.requested_method || ''} · ${dmyT(t.requested_at)}</div>` : dmyT(t.status === 'trial' ? t.trial_ends_at : t.current_period_end)}</td>
          <td class="r num nowrap" style="font-size:12.5px">${t.members} pessoas<br><span class="dim">${fmt(t.contacts)} contatos</span></td>
          <td class="r nowrap">${t.plan === 'interno' ? '' : `<button class="btn xs pri" data-act="mtActivate" data-id="${t.user_id}">${t.status === 'active' ? 'Renovar' : 'Liberar plano'}</button> <button class="btn xs" data-act="mtTrial" data-id="${t.user_id}">+7 dias</button> ${t.status !== 'canceled' ? `<button class="btn xs ghost" data-act="mtSuspend" data-id="${t.user_id}">Suspender</button>` : ''}`}</td></tr>`; }).join('')}
      </tbody></table></div></div>` : `<div class="pn"><div class="empty">${ic('CircleCheck')}<div>${tab === 'pedidos' ? 'Nenhum pedido esperando.' : 'Nenhuma conta ainda.'}</div></div></div>`;
    } else if (tab === 'ia') body = mestreIA();
    else body = mestrePlanos();
    return `<div class="page-h"><div><h2>Painel mestre</h2><p>Só você vê esta tela. Aqui você organiza as contas do Lothem Vendas: libera planos, dá mais dias de teste e ajusta os preços.</p></div></div>
      <div class="tabs" role="tablist">${tabs.map(([id, nm, icn, n]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="mestre:${id}" role="tab">${ic(icn, 'sm')}${nm}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>${body}`;
  },
};

/* ---------- liberar plano ---------- */
const mtFind = (id) => (MESTRE.tenants || []).find((t) => t.user_id === id);
ACT.mtActivate = (el) => {
  const t = mtFind(el.dataset.id), want = t.requested_plan && t.requested_plan !== 'implantacao' ? t.requested_plan : t.plan === 'interno' ? 'pro' : t.plan;
  openModal(modalHead('Liberar plano · ' + esc(t.full_name || t.email), 'Use quando o pagamento entrar.') + `<form class="modal-b col" style="gap:14px" data-sub="mtActivate" data-id="${t.user_id}">
    ${t.requested_plan === 'implantacao' ? `<div class="row top-a" style="gap:8px;font-size:13px;padding:10px 12px;border-radius:9px;background:var(--gold-soft)">${ic('Wrench', 'sm')}<span>Essa conta pediu <b>implantação</b>. Combine o projeto com o cliente e libere o plano que vocês acertarem.</span></div>` : ''}
    <div class="form-g"><div class="field"><label for="mtPlan">Plano</label><select class="sel" id="mtPlan">${DB.plans.map((p) => `<option value="${p.id}" ${p.id === want ? 'selected' : ''}>${esc(p.nm)} · ${brl(p.price)}/mês</option>`).join('')}</select></div>
    <div class="field"><label for="mtCycle">Ciclo</label><select class="sel" id="mtCycle"><option value="mensal" ${t.requested_cycle !== 'anual' ? 'selected' : ''}>Mensal</option><option value="anual" ${t.requested_cycle === 'anual' ? 'selected' : ''}>Anual</option></select></div></div>
    <div class="field" style="max-width:240px"><label for="mtUntil">Pago até</label><input class="in" type="date" id="mtUntil" value="${new Date(Date.now() + (t.requested_cycle === 'anual' ? 365 : 30) * 864e5).toISOString().slice(0, 10)}"><span class="hint">Depois dessa data, a conta aparece como pagamento atrasado.</span></div>
  </form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="mtActivate">Liberar</button></div>`);
};
SUB.mtActivate = async (f) => {
  const t = mtFind(f.dataset.id), plan = $('#mtPlan').value, cycle = $('#mtCycle').value, until = new Date($('#mtUntil').value + 'T23:59:00').toISOString();
  if (!(await mtSave(t, { p_plan: plan, p_status: 'active', p_cycle: cycle, p_period_end: until, p_clear_request: true }))) return;
  Object.assign(t, { plan, status: 'active', cycle, current_period_end: until, requested_plan: null, requested_cycle: null, requested_method: null, requested_at: null });
  closeOverlay(); toast('Plano liberado', (t.full_name || t.email) + ' · ' + PLAN_NM[plan] + ' até ' + dmyT(until), '', 'BadgeCheck'); rerender();
};
ACT.mtTrial = async (el) => {
  const t = mtFind(el.dataset.id), base = t.status === 'trial' && new Date(t.trial_ends_at) > new Date() ? new Date(t.trial_ends_at).getTime() : Date.now(), end = dIso(base + 7 * 864e5);
  if (!(await mtSave(t, { p_plan: t.plan === 'interno' ? 'adv' : t.plan, p_status: 'trial', p_trial_end: end }))) return;
  Object.assign(t, { status: 'trial', trial_ends_at: end });
  toast('Mais 7 dias de teste', (t.full_name || t.email) + ' · até ' + dmyT(end), '', 'Hourglass'); rerender();
};
ACT.mtSuspend = (el) => {
  const t = mtFind(el.dataset.id);
  openModal(modalHead('Suspender ' + esc(t.full_name || t.email) + '?', '') + `<div class="modal-b"><p style="font-size:14px">A conta continua vendo os dados, mas não cria nem altera nada até você liberar de novo. Nada é apagado.</p></div>
    <div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn danger" data-act="mtSuspendOk" data-id="${t.user_id}">Suspender</button></div>`);
};
ACT.mtSuspendOk = async (el) => {
  const t = mtFind(el.dataset.id);
  if (!(await mtSave(t, { p_plan: t.plan, p_status: 'canceled' }))) return;
  t.status = 'canceled'; closeOverlay(); toast('Conta suspensa', t.full_name || t.email, '', 'Lock'); rerender();
};
async function mtSave(t, args) {
  if (!isReal()) return true;
  const r = await REAL.sb.rpc('admin_set_subscription', Object.assign({ p_user: t.user_id, p_cycle: null, p_period_end: null, p_trial_end: null, p_clear_request: false }, args));
  if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); return false; }
  return true;
}

/* ---------- planos e preços ---------- */
function mestrePlanos() {
  return `<form class="col" style="gap:16px" data-sub="mtPlans">
    <div class="plans">${DB.plans.map((p, i) => `<section class="pn plan"><div class="field"><label for="mp-nm-${i}">Nome</label><input class="in" id="mp-nm-${i}" value="${esc(p.nm)}"></div>
      <div class="form-g"><div class="field"><label for="mp-pr-${i}">Preço/mês (R$)</label><input class="in" id="mp-pr-${i}" inputmode="numeric" value="${p.price}"></div><div class="field"><label for="mp-us-${i}">Usuários</label><input class="in" id="mp-us-${i}" inputmode="numeric" value="${p.lim.users}"></div></div>
      <div class="field"><label for="mp-og-${i}">Empresas</label><input class="in" id="mp-og-${i}" inputmode="numeric" value="${p.lim.orgs}"></div>
      <div class="field"><label for="mp-wa-${i}">Números de WhatsApp</label><input class="in" id="mp-wa-${i}" inputmode="numeric" value="${p.lim.wa}"></div>
      <div class="field"><label for="mp-ft-${i}">O que inclui (uma linha por item)</label><textarea class="ta" id="mp-ft-${i}" rows="6">${esc(p.feats.join('\n'))}</textarea></div></section>`).join('')}</div>
    <section class="pn"><div class="pn-b grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">
      <div class="field"><label for="mp-trial">Dias de teste grátis</label><input class="in" id="mp-trial" inputmode="numeric" value="${TRIAL_DAYS}"></div>
      <div class="field"><label for="mp-imp">Implantação a partir de (R$)</label><input class="in" id="mp-imp" inputmode="numeric" value="${IMPLANT.price}"></div>
      ${PLAN_EXTRAS.map(([nm, v], i) => `<div class="field"><label for="mp-ex-${i}">${esc(nm)} (R$/mês)</label><input class="in" id="mp-ex-${i}" inputmode="numeric" value="${v}"></div>`).join('')}
    </div></section>
    <div class="row between wrap" style="gap:10px"><span class="dim" style="font-size:12.5px">Vale para contas novas e para a tela de planos de todos os clientes. Quem já paga continua com o valor combinado até você renovar.</span><button class="btn pri" type="submit">${ic('Check', 'sm')}Salvar planos e preços</button></div>
  </form>`;
}
SUB.mtPlans = async () => {
  const num = (id) => Math.max(0, parseInt(String($('#' + id).value).replace(/\D/g, ''), 10) || 0);
  DB.plans.forEach((p, i) => {
    p.nm = $('#mp-nm-' + i).value.trim() || p.nm; p.price = num('mp-pr-' + i);
    p.lim = { users: num('mp-us-' + i), orgs: num('mp-og-' + i), ia: 0, wa: num('mp-wa-' + i) };
    p.feats = $('#mp-ft-' + i).value.split('\n').map((x) => x.trim()).filter(Boolean);
  });
  PLAN_EXTRAS.forEach((x, i) => { x[1] = num('mp-ex-' + i); });
  IMPLANT.price = num('mp-imp'); TRIAL_DAYS = Math.min(60, num('mp-trial'));
  if (isReal()) {
    const r = await REAL.sb.rpc('admin_save_settings', { p_plans: DB.plans, p_extras: PLAN_EXTRAS, p_implant: IMPLANT, p_trial_days: TRIAL_DAYS });
    if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); return; }
  }
  toast('Planos e preços salvos', 'Já aparecem na tela de planos.', '', 'Tags'); rerender();
};

/* modo real: carrega preços salvos e liga o painel para quem é administração */
async function mestreReal() {
  const sb = REAL.sb;
  const [adm, st] = await Promise.all([sb.rpc('is_platform_admin'), sb.from('platform_settings').select('*').eq('id', 1).maybeSingle()]);
  const P = st && !st.error && st.data;
  if (P) {
    if (Array.isArray(P.plans) && P.plans.length) P.plans.forEach((x) => { const p = DB.plans.find((y) => y.id === x.id); if (p) Object.assign(p, x); });
    if (Array.isArray(P.extras) && P.extras.length) P.extras.forEach((x, i) => { if (PLAN_EXTRAS[i]) PLAN_EXTRAS[i] = x; });
    if (P.implant && P.implant.price) Object.assign(IMPLANT, P.implant);
    if (P.trial_days != null) TRIAL_DAYS = P.trial_days;
  }
  const on = !adm.error && adm.data === true;
  NAV.forEach((g, i) => { if (g.grp === 'Lothem' && !on) NAV.splice(i, 1); });
  MESTRE.tenants = null; MESTRE.loaded = false;
  if (on) mestreNav(true);
}
