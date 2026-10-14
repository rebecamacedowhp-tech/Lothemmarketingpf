/* LOTHEM Vendas — o cliente cuida da própria IA (SDR IA › IA e custos).
   Chave, modelo, gasto do mês, limite com aviso, comparação de custo entre as IAs com o uso real dele,
   e uma faixa em todas as telas quando a IA para (créditos acabaram, chave recusada, limite do mês). */

const IAC = {};
const CONSOLE = { anthropic: ['console.anthropic.com', 'https://console.anthropic.com/settings/billing'], openai: ['platform.openai.com', 'https://platform.openai.com/settings/organization/billing'] };
const PER_CONV = { in: 48000, out: 2400 }; // estimativa quando ainda não há uso: ~6 respostas por conversa

function iacDemo(o) {
  const days = Array.from({ length: 13 }, (_, i) => ({ day: new Date(Date.now() - (12 - i) * 864e5).toISOString().slice(0, 10), model: 'claude-sonnet-5-5', cost: [0.9, 1.1, 0.7, 1.4, 1.2, 0.8, 1.6, 1.3, 1.1, 1.5, 1.7, 1.2, 0.6][i], conversations: [9, 11, 7, 14, 12, 8, 16, 13, 11, 15, 17, 12, 6][i] }));
  return { can_edit: true, provider: 'anthropic', model: 'claude-sonnet-5-5', key_hint: 'x7Qa', paused: false, monthly_cap_usd: 25, alert_pct: 80, bot_mode: 'todos',
    last_error: null, last_error_kind: null, month: { cost: 15.1, input: 6200000, output: 260000, cache: 600000, conversations: 151 }, days };
}
async function iacLoad(id, silent) {
  const o = DB.orgs[id]; if (!o) return;
  if (!isRealM()) { IAC[id] = IAC[id] || iacDemo(o); return; }
  const r = await REAL.sb.rpc('ai_client_panel', { p_org: id });
  IAC[id] = r.error ? { error: r.error.message } : r.data;
  iacStrip();
  if (!silent && S.route === 'sdr') rerender();
}

/* o que está errado agora, em linguagem de cliente (ou nada) */
function iacAlert(P, o) {
  if (!P || P.error) return null;
  const nm = o.ia.name, prov = P.provider === 'openai' ? 'OpenAI' : 'Anthropic', [site] = CONSOLE[P.provider] || CONSOLE.anthropic;
  const cap = Number(P.monthly_cap_usd || 0), spent = Number((P.month || {}).cost || 0), pc = cap ? Math.round((spent / cap) * 100) : 0;
  if (P.last_error_kind === 'creditos') return { cls: 'bad', t: `A ${nm} parou de responder: a sua conta de IA (${prov}) ficou sem créditos.`, d: `Coloque créditos em ${site}, na parte de Billing. Ela volta sozinha na próxima mensagem.` };
  if (P.last_error_kind === 'chave') return { cls: 'bad', t: `A ${nm} parou de responder: a chave de IA foi recusada.`, d: 'A chave pode ter sido apagada ou ter vencido. Cole uma chave nova em SDR IA › IA e custos.' };
  if (!P.key_hint) return { cls: 'warn', t: `A ${nm} ainda não tem chave de IA e não responde ninguém.`, d: 'Cole a chave da Anthropic ou da OpenAI em SDR IA › IA e custos.' };
  if (cap && spent >= cap) return { cls: 'bad', t: `A ${nm} pausou: o limite de IA do mês acabou (${usd(spent)} de ${usd(cap)}).`, d: 'Aumente o limite em SDR IA › IA e custos, ou ela volta no dia 1º.' };
  if (cap && pc >= Number(P.alert_pct || 80)) return { cls: 'warn', t: `Você já usou ${pc}% do limite de IA do mês (${usd(spent)} de ${usd(cap)}).`, d: 'Quando chegar a 100%, a ' + nm + ' pausa até o mês virar.' };
  if (P.last_error_kind === 'limite') return { cls: 'warn', t: `A conta de IA (${prov}) está recusando por excesso de uso no momento.`, d: 'Costuma passar em minutos. Se repetir, aumente o limite de uso na conta da IA.' };
  return null;
}

/* faixa no topo de todas as telas para quem cuida da conta */
function iacStrip() {
  const old = $('#iaStrip'); if (old) old.remove();
  if (!isRealM() || REAL.admin || !S.org) return;
  const P = IAC[S.org], o = O(); if (!P || !P.can_edit) return;
  const A = iacAlert(P, o); if (!A) return;
  const main = $('#app .main'); if (!main) return;
  const el = document.createElement('div');
  el.className = 'ia-strip ' + A.cls; el.id = 'iaStrip';
  el.innerHTML = ic(A.cls === 'bad' ? 'CircleAlert' : 'TriangleAlert', 'sm') + `<span class="grow"><b>${esc(A.t)}</b> <span class="hide-m">${esc(A.d)}</span></span><button class="btn sm" data-act="iacGo">Resolver</button>`;
  main.insertBefore(el, main.firstChild);
}
ACT.iacGo = () => { S.tabs.sdr = 'ia'; go('sdr'); };
const iacShellBase = renderShell;
renderShell = function () { iacShellBase(); iacStrip(); };

/* custo de um modelo para um volume de tokens (sem desconto de cache: comparação justa entre empresas) */
const iacCost = (m, tin, tout) => (tin * m.in + tout * m.out) / 1e6;

function sdrIA() {
  const o = O();
  if (!IAC[o.id]) { iacLoad(o.id); return isRealM() ? `<div class="pn"><div class="empty">${ic('LoaderCircle')}<div>Carregando…</div></div></div>` : sdrIA(); }
  const P = IAC[o.id];
  if (P.error) return `<div class="pn"><div class="empty">${ic('TriangleAlert')}<div>Esta parte ainda não está instalada nesta conta.<br><span class="dim" style="font-size:12.5px">${esc(P.error)}</span></div></div></div>`;
  const edit = P.can_edit, M = P.month || {}, cur = AIM(P.model), prov = P.provider || cur.p, A = iacAlert(P, o);
  const conv = Number(M.conversations || 0), spent = Number(M.cost || 0), cap = Number(P.monthly_cap_usd || 0);
  const day = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(), proj = day ? (spent / day) * dim : 0;
  // volume de referência: o uso real do mês; sem uso ainda, 100 conversas estimadas
  const real = Number(M.input || 0) + Number(M.cache || 0) > 0;
  const tin = real ? Number(M.input || 0) + Number(M.cache || 0) : PER_CONV.in * 100, tout = real ? Number(M.output || 0) : PER_CONV.out * 100;
  const base = real ? Math.max(conv, 1) : 100;
  const rank = AI_MODELS.map((m) => ({ m, c: iacCost(m, tin, tout) })).sort((a, b) => a.c - b.c);
  const cheapest = rank[0].c;
  const [site, link] = CONSOLE[prov] || CONSOLE.anthropic;

  return `${A ? `<div class="row top-a" style="gap:10px;padding:12px 14px;border-radius:10px;margin-bottom:16px;background:var(--${A.cls === 'bad' ? 'bad' : 'warn'}-soft)">${ic(A.cls === 'bad' ? 'CircleAlert' : 'TriangleAlert', 'sm')}<div><b>${esc(A.t)}</b><div style="font-size:13px;margin-top:2px">${esc(A.d)}</div>${P.last_error ? `<div class="dim" style="font-size:12px;margin-top:4px">Resposta da ${prov === 'openai' ? 'OpenAI' : 'Anthropic'}: ${esc(P.last_error)}</div>` : ''}</div></div>` : ''}
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:16px;align-items:start">
    <section class="pn"><div class="pn-h"><span class="pn-t">${ic('KeyRound')}Chave de IA</span>${P.key_hint ? pill((prov === 'openai' ? 'OpenAI' : 'Anthropic') + ' ••••' + esc(P.key_hint), 'ok', 'Lock') : pill('Falta cadastrar', 'warn')}</div>
      <div class="pn-b col" style="gap:10px">
        <p class="dim" style="font-size:13px">A ${esc(o.ia.name)} usa a <b>sua</b> conta de IA. Você paga direto à Anthropic (Claude) ou à OpenAI (GPT), só pelo que usar. Para trocar de empresa de IA, cole a chave da outra.</p>
        ${edit ? `<form class="col" style="gap:8px" data-sub="myKey"><div class="field"><label for="myKeyIn">${P.key_hint ? 'Trocar a chave' : 'Cole aqui a chave de API'}</label><input class="in" id="myKeyIn" type="password" autocomplete="off" placeholder="sk-ant-… (Claude) ou sk-… (GPT)"></div><div><button class="btn pri sm" type="submit">${ic('Lock', 'xs')}Salvar cifrada</button></div></form>
        <span class="hint">Fica guardada com criptografia e nunca aparece de novo. Créditos e faturas ficam em <a href="${link}" target="_blank" rel="noopener">${site}</a>.</span>` : '<span class="hint">Só a proprietária ou a gestão mexem na chave.</span>'}
      </div></section>

    <section class="pn"><div class="pn-h"><span class="pn-t">${ic('Coins')}Gasto deste mês</span>${pill(P.paused ? 'IA pausada' : 'IA ligada', P.paused ? 'warn' : 'ok')}</div>
      <div class="pn-b col" style="gap:12px">
        <div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
          <div class="r-stat"><span class="lbl">Gasto</span><div class="num" style="font-size:20px;margin-top:4px">${usd(spent)}</div></div>
          <div class="r-stat"><span class="lbl">Conversas</span><div class="num" style="font-size:20px;margin-top:4px">${fmt(conv)}</div></div>
          <div class="r-stat"><span class="lbl">Por conversa</span><div class="num" style="font-size:20px;margin-top:4px">${conv ? usd(spent / conv) : '—'}</div></div>
        </div>
        <p class="dim" style="font-size:12.5px">No ritmo de hoje, o mês fecha em <b>${usd(proj)}</b>. Os valores são em dólar, como a ${prov === 'openai' ? 'OpenAI' : 'Anthropic'} cobra.</p>
        ${cap ? `<div><div class="row between" style="font-size:12.5px;margin-bottom:4px"><span>Limite do mês</span><span class="num">${usd(spent)} de ${usd(cap)}</span></div>${bar(Math.min(100, (spent / cap) * 100), spent >= cap ? 'bad thin' : (spent / cap) * 100 >= Number(P.alert_pct || 80) ? 'warn thin' : 'thin')}</div>` : ''}
        ${edit ? `<form class="col" style="gap:10px" data-sub="iacSave">
          <div class="form-g"><div class="field"><label for="iacCap">Limite por mês (US$)</label><input class="in" id="iacCap" inputmode="decimal" value="${P.monthly_cap_usd != null ? P.monthly_cap_usd : ''}" placeholder="sem limite"><span class="hint">Ao chegar no limite, a ${esc(o.ia.name)} pausa.</span></div>
          <div class="field"><label for="iacAlert">Me avisar ao chegar em</label><select class="sel" id="iacAlert">${[50, 70, 80, 90].map((v) => `<option value="${v}" ${Number(P.alert_pct || 80) === v ? 'selected' : ''}>${v}% do limite</option>`).join('')}</select></div></div>
          <label class="row" style="font-size:13px;gap:10px"><span class="sw"><input type="checkbox" id="iacPause" ${P.paused ? 'checked' : ''}><span></span></span>Pausar a ${esc(o.ia.name)} (as mensagens continuam chegando no Atendimento)</label>
          <div><button class="btn sm pri" type="submit">${ic('Check', 'xs')}Salvar</button></div></form>` : ''}
      </div></section>
  </div>

  <section class="pn" style="margin-top:16px"><div class="pn-h"><span class="pn-t">${ic('Cpu')}Modelo da ${esc(o.ia.name)}</span>${pill(cur.nm, 'cy')}</div>
    <div class="pn-b col" style="gap:8px">
      <p class="dim" style="font-size:13px">Modelos da ${prov === 'openai' ? 'OpenAI' : 'Anthropic'}, a empresa da sua chave. Preço por milhão de tokens, entrada / saída.</p>
      ${AI_MODELS.filter((m) => m.p === prov).map((m) => `<button type="button" class="pay-m ${m.id === cur.id ? 'on' : ''}" data-act="iacModel" data-v="${m.id}" ${edit ? '' : 'disabled'}><span class="col" style="gap:2px;text-align:left"><b>${m.nm}${m.id === cur.id ? ' · em uso' : ''}</b><span class="dim" style="font-size:12.5px">${esc(m.note)}</span></span><span class="num dim nowrap" style="font-size:12px;margin-left:auto">US$ ${fmt(m.in, m.in < 1 ? 2 : 0)} / ${fmt(m.out, m.out < 1 ? 2 : 0)}</span></button>`).join('')}
    </div></section>

  <section class="pn" style="margin-top:16px"><div class="pn-h"><span class="pn-t">${ic('Scale')}Qual IA sai mais em conta para você</span><span class="dim" style="font-size:12px">${real ? 'com o seu uso real deste mês' : 'estimativa para 100 conversas'}</span></div>
    <div class="pn-b flush"><div class="tbl-w"><table class="tbl"><thead><tr><th>Modelo</th><th>Empresa</th><th class="r">${real ? 'Este mês custaria' : '100 conversas'}</th><th class="r">Por conversa</th><th></th></tr></thead><tbody>
      ${rank.map(({ m, c }) => `<tr${m.id === cur.id ? ' style="background:var(--cy-soft)"' : ''}><td><b style="font-size:13.5px">${m.nm}</b><div class="dim" style="font-size:12px">${esc(m.note)}</div></td><td class="nowrap">${m.p === 'openai' ? 'OpenAI' : 'Anthropic'}</td><td class="r num nowrap">${usd(c)}</td><td class="r num nowrap">${usd(c / base)}</td>
        <td class="nowrap">${m.id === cur.id ? pill('em uso', 'cy') : c === cheapest ? pill('mais barato', 'ok') : c < iacCost(cur, tin, tout) ? pill(Math.round((1 - c / iacCost(cur, tin, tout)) * 100) + '% mais barato', 'line') : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="dim" style="font-size:12.5px;padding:12px 16px">O mais barato nem sempre vende melhor: os modelos menores erram mais nas regras e nas objeções. Para a SDR, a recomendação é <b>Claude Sonnet 5.5</b> ou <b>GPT-6.1 Sol</b>. Teste uma semana e compare as vendas, não só o custo. A conta não considera o desconto de cache, que deixa o custo real um pouco menor.</p></div></section>`;
}

ACT.iacModel = async (el) => {
  const o = O(), m = AIM(el.dataset.v), P = IAC[o.id];
  if (isRealM()) { const r = await REAL.sb.rpc('ai_client_save', { p_org: o.id, p_model: m.id, p_cap: P.monthly_cap_usd, p_alert: P.alert_pct, p_paused: P.paused }); if (r.error) { toast('Não consegui trocar', r.error.message, 'bad', 'CircleAlert'); return; } }
  P.model = m.id; toast('Modelo trocado para ' + m.nm, 'Vale a partir da próxima mensagem.', '', 'Cpu'); rerender();
};
SUB.iacSave = async () => {
  const o = O(), P = IAC[o.id], raw = $('#iacCap').value.replace(',', '.').trim();
  const cap = raw === '' ? null : Number(raw), alert = Number($('#iacAlert').value), paused = $('#iacPause').checked;
  if (cap != null && (isNaN(cap) || cap < 0)) { toast('Limite inválido', 'Use um número, por exemplo 30.', 'warn', 'CircleAlert'); return; }
  if (isRealM()) { const r = await REAL.sb.rpc('ai_client_save', { p_org: o.id, p_model: null, p_cap: cap, p_alert: alert, p_paused: paused }); if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); return; } }
  Object.assign(P, { monthly_cap_usd: cap, alert_pct: alert, paused });
  toast('Configuração da IA salva', cap ? 'Limite de ' + usd(cap) + ' por mês, aviso em ' + alert + '%.' : 'Sem limite mensal.', '', 'Coins'); iacStrip(); rerender();
};
/* depois de salvar a chave (mestre-ia.js), recarrega o painel */
const iacKeyBase = SUB.myKey;
SUB.myKey = async (f) => { await iacKeyBase(f); delete IAC[O().id]; await iacLoad(O().id); };

/* ao entrar e ao trocar de empresa, confere a IA para mostrar a faixa */
const iacStartBase = startReal;
startReal = async function (user) {
  await iacStartBase(user);
  if (REAL.on && !REAL.admin && S.org) iacLoad(S.org, true);
};
const iacSwitchBase = ACT.switchOrg;
ACT.switchOrg = (el) => { iacSwitchBase(el); if (isRealM() && !REAL.admin && !IAC[S.org]) iacLoad(S.org, true); else iacStrip(); };
