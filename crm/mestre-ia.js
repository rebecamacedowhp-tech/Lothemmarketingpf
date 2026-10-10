/* LOTHEM Vendas — Painel Mestre › IA dos clientes.
   Por organização: chave de API (da Lothem ou do cliente, sempre cifrada), modelo, esforço, limite e auditoria de gasto,
   instruções da SDR (com versão), palavras proibidas, quando passar para humano e base de conhecimento (RAG).
   Preços oficiais da Anthropic por milhão de tokens (tabela de 06/10/2026). */

const AI_MODELS = [
  { id: 'claude-opus-5-5', nm: 'Claude Opus 5.5', in: 4, out: 20, note: 'Recomendado para a SDR: conversa melhor e segue as regras com mais firmeza' },
  { id: 'claude-sonnet-5-5', nm: 'Claude Sonnet 5.5', in: 2, out: 10, note: 'Metade do preço do Opus, bom para volume alto' },
  { id: 'claude-haiku-5-5', nm: 'Claude Haiku 5.5', in: 0.1, out: 0.5, note: 'O mais barato, para triagem simples' },
  { id: 'claude-fable-5-1', nm: 'Claude Fable 5.1', in: 10, out: 50, note: 'O mais capaz e o mais caro; raramente necessário para SDR' },
];
const AIM = (id) => AI_MODELS.find((m) => m.id === id) || AI_MODELS[0];
const isRealM = () => typeof REAL !== 'undefined' && REAL.on;
const MIA = { list: null, detail: {}, usd: Number(store.get('usdBrl', 0)) || 0 };
const usd = (v) => 'US$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v) => (MIA.usd ? usd(v) + ' <span class="dim">(' + brl(v * MIA.usd, 2) + ')</span>' : usd(v));
const kTok = (n) => (n >= 1e6 ? fmt(n / 1e6, 1) + ' mi' : n >= 1e3 ? fmt(n / 1e3, 0) + ' mil' : fmt(n));

/* ---------- demonstração ---------- */
function miaDemo() {
  if (MIA.list) return;
  const seed = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000; };
  const orgs = (MESTRE.tenants || []).flatMap((t) => (t.orgs || '').split(' · ').filter(Boolean).map((nm) => ({ nm, t })));
  MIA.list = orgs.map(({ nm, t }, i) => {
    const r = seed(nm), model = i % 4 === 1 ? 'claude-sonnet-5-5' : 'claude-opus-5-5', m = AIM(model), days = [];
    for (let d = 29; d >= 0; d--) {
      const convs = Math.round((t.plan === 'interno' ? 30 : 8) + r() * (t.plan === 'interno' ? 40 : 25)), inp = convs * Math.round(9000 + r() * 6000), out = convs * Math.round(900 + r() * 700);
      days.push({ day: new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), model, conversations: convs, input_tokens: inp, output_tokens: out, cache_read_tokens: Math.round(inp * 0.6), cost_usd: Math.round(((inp * m.in + out * m.out) / 1e6) * 100) / 100 });
    }
    const own = t.plan !== 'interno' && i % 4 !== 3;
    return { org_id: 'o' + i, org_name: nm, owner_email: t.email, ia_name: 'Cibelle', model, key_source: t.plan === 'interno' ? 'lothem' : 'cliente', key_hint: own ? 'x7Qa' : null,
      monthly_cap_usd: t.plan === 'interno' ? 300 : null, paused: false, _days: days,
      _cfg: { effort: 'medium', alert_pct: 80, on_cap: 'pausar', system_prompt: 'Você é a Cibelle, SDR da ' + nm + '. Atenda pelo WhatsApp, qualifique e marque a reunião com o vendedor. Frases curtas, uma pergunta por mensagem.', prompt_version: 1 + (i % 4), blocked_terms: ['garantido', 'grátis'], handoff_terms: ['reclamação', 'advogado', 'cancelar'] },
      _kb: [{ id: 'kb' + i + 'a', title: 'Tabela de preços e condições', category: 'Oferta', chunks: 3, created_at: new Date(Date.now() - 6 * 864e5).toISOString(), text: 'Os planos e preços da ' + nm + ' são informados só pelo vendedor na reunião. Pagamento em Pix, cartão em até 12x ou boleto.' },
        { id: 'kb' + i + 'b', title: 'Perguntas frequentes', category: 'FAQ', chunks: 5, created_at: new Date(Date.now() - 2 * 864e5).toISOString(), text: 'Atendemos de segunda a sexta, das 8h às 18h. O horário de atendimento no sábado é das 9h às 12h. Para remarcar, basta avisar com 24 horas de antecedência.' }],
      _audit: [{ at: new Date(Date.now() - 3 * 864e5).toISOString(), action: 'configuracao_alterada', detail: { model: true }, by: 'Rebeca Macedo' }].concat(own ? [{ at: new Date(Date.now() - 9 * 864e5).toISOString(), action: 'chave_alterada', detail: { final: 'x7Qa' }, by: 'Rebeca Macedo' }] : []) };
  });
  MIA.list.forEach((x) => { const mo = x._days.filter((d) => d.day.slice(0, 7) === new Date().toISOString().slice(0, 7)); x.month_cost_usd = mo.reduce((a, d) => a + d.cost_usd, 0); x.month_conversations = mo.reduce((a, d) => a + d.conversations, 0); x.month_tokens = mo.reduce((a, d) => a + d.input_tokens + d.output_tokens, 0); x.kb_docs = x._kb.length; x.kb_chunks = x._kb.reduce((a, k) => a + k.chunks, 0); });
}
async function miaLoad() {
  if (!isRealM()) { miaDemo(); return; }
  const r = await REAL.sb.rpc('admin_ai_overview');
  if (r.error) { toast('Não consegui carregar a IA dos clientes', r.error.message, 'bad', 'CircleAlert'); MIA.list = []; } else MIA.list = r.data;
  if (S.route === 'mestre') rerender();
}
async function miaGet(id) {
  const x = MIA.list.find((o) => o.org_id === id);
  if (!isRealM()) return (MIA.detail[id] = { config: Object.assign({ model: x.model, key_source: x.key_source, key_hint: x.key_hint, monthly_cap_usd: x.monthly_cap_usd, paused: x.paused }, x._cfg), usage: x._days, audit: x._audit, kb: x._kb });
  const r = await REAL.sb.rpc('admin_ai_get', { p_org: id });
  if (r.error) { toast('Não consegui abrir', r.error.message, 'bad', 'CircleAlert'); return null; }
  return (MIA.detail[id] = r.data);
}

/* ---------- aba ---------- */
function mestreIA() {
  if (!MIA.list) { miaLoad(); if (!MIA.list) return `<div class="pn"><div class="empty">${ic('LoaderCircle')}<div>Carregando…</div></div></div>`; }
  if (S.miaOrg) return miaDetail(S.miaOrg);
  const L = MIA.list, total = L.reduce((a, x) => a + Number(x.month_cost_usd || 0), 0), own = L.filter((x) => x.key_source === 'cliente').length;
  const alerts = L.filter((x) => x.monthly_cap_usd && x.month_cost_usd >= x.monthly_cap_usd * 0.8);
  return `<div class="kpis" style="margin-bottom:18px">
      ${[['Gasto de IA no mês', money(total), L.length + ' organizações', 'Coins'], ['Pago pela Lothem', money(L.filter((x) => x.key_source !== 'cliente').reduce((a, x) => a + Number(x.month_cost_usd || 0), 0)), 'suas empresas', 'Building2'], ['Sem chave de IA', String(L.filter((x) => x.key_source === 'cliente' && !x.key_hint).length), 'a SDR não responde', 'KeyRound'], ['Perto do limite', String(alerts.length), '80% ou mais do limite', 'TriangleAlert']]
        .map(([k, v, s, icn], i) => `<div class="pn kpi" style="cursor:default"><span class="lbl">${k}</span><div class="row between"><span class="v num" style="font-size:20px">${v}</span><span class="ico-box ${i === 3 && alerts.length ? 'warn' : 'cy'}">${ic(icn, 'sm')}</span></div><div class="ft"><span>${s}</span></div></div>`).join('')}
    </div>
    <div class="row between wrap" style="gap:10px;margin-bottom:12px"><span class="dim" style="font-size:12.5px">Custo calculado pela tabela oficial de preços da Anthropic, por milhão de tokens.</span>
      <label class="row" style="gap:8px;font-size:12.5px">Cotação do dólar (R$)<input class="in" style="width:90px" inputmode="decimal" value="${MIA.usd || ''}" placeholder="ex.: 5,40" data-chg="miaUsd"></label></div>
    <div class="pn"><div class="tbl-w"><table class="tbl"><thead><tr><th>Organização</th><th>IA</th><th>Modelo</th><th>Chave</th><th style="min-width:180px">Gasto do mês</th><th class="r">Conversas</th><th class="r">Base (RAG)</th><th></th></tr></thead><tbody>
      ${L.map((x) => { const cap = Number(x.monthly_cap_usd || 0), p = cap ? pct(x.month_cost_usd, cap) : 0; return `<tr><td><b style="font-size:13.5px">${esc(x.org_name)}</b><div class="dim" style="font-size:12px">${esc(x.owner_email || '')}</div></td><td>${esc(x.ia_name)}${x.paused ? ' ' + pill('Pausada', 'bad') : ''}</td><td class="nowrap">${esc(AIM(x.model).nm.replace('Claude ', ''))}</td>
        <td class="nowrap">${x.key_source === 'cliente' ? pill('Do cliente ••••' + esc(x.key_hint || ''), 'cy', 'KeyRound') : pill('Da Lothem', 'line')}</td>
        <td><div class="num" style="font-size:13px">${money(x.month_cost_usd)}${cap ? ` <span class="dim">de ${usd(cap)}</span>` : ''}</div>${cap ? bar(p, p >= 100 ? 'bad' : p >= 80 ? 'warn' : '') : '<span class="dim" style="font-size:12px">sem limite</span>'}</td>
        <td class="r num">${fmt(x.month_conversations || 0)}</td><td class="r num">${fmt(x.kb_docs || 0)} docs</td><td class="r"><button class="btn xs pri" data-act="miaOpen" data-id="${x.org_id}">Abrir</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="dim">Nenhuma organização ainda.</td></tr>'}
    </tbody></table></div></div>`;
}
ACT.miaOpen = async (el) => { S.miaOrg = el.dataset.id; S.acc = Object.assign(S.acc || {}, { 'mia-key': true }); await miaGet(el.dataset.id); rerender(); };
ACT.miaBack = () => { S.miaOrg = null; rerender(); };
CHG.miaUsd = (el) => { MIA.usd = Number(String(el.value).replace(',', '.')) || 0; store.set('usdBrl', MIA.usd); rerender(); };

function miaDetail(id) {
  const x = MIA.list.find((o) => o.org_id === id), D = MIA.detail[id];
  if (!x || !D) return `<div class="pn"><div class="empty">${ic('LoaderCircle')}<div>Abrindo…</div></div></div>`;
  const C = D.config || {}, m = AIM(C.model || x.model), U = D.usage || [];
  const month = new Date().toISOString().slice(0, 7), mo = U.filter((d) => String(d.day).slice(0, 7) === month);
  const spent = mo.reduce((a, d) => a + Number(d.cost_usd), 0), dayN = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const proj = dayN ? (spent / dayN) * dim : 0, cap = Number(C.monthly_cap_usd || 0), maxDay = Math.max(1, ...U.map((d) => Number(d.cost_usd)));
  const convs = mo.reduce((a, d) => a + d.conversations, 0);
  const ACTN = { chave_alterada: 'Chave de API alterada', chave_removida: 'Chave de API removida', configuracao_alterada: 'Configuração alterada', rag_documento_adicionado: 'Documento adicionado à base', rag_documento_removido: 'Documento removido da base' };
  const sec = (k, t, meta, body) => acc(k, t, meta, body);
  return `<div class="row wrap between" style="gap:10px;margin-bottom:14px"><div><button class="link" data-act="miaBack">${ic('ArrowLeft', 'xs')} Todas as organizações</button><h3 style="font-size:18px;margin-top:6px">${esc(x.org_name)} · ${esc(x.ia_name)}</h3><div class="dim" style="font-size:12.5px">${esc(x.owner_email || '')}</div></div>
      <label class="row" style="gap:10px;font-size:13px"><span class="sw"><input type="checkbox" ${C.paused ? '' : 'checked'} data-chg="miaPause" aria-label="IA ligada"><span></span></span>${C.paused ? 'IA pausada' : 'IA ligada'}</label></div>
    <div class="col" style="gap:10px">
    ${sec('mia-key', ic('KeyRound', 'sm cy') + 'Chave de API e modelo', pill(C.key_source === 'cliente' ? 'Chave do cliente ••••' + (C.key_hint || '') : 'Chave da Lothem', C.key_source === 'cliente' ? 'cy' : 'line'), `<div class="col" style="gap:14px">
      <div class="seg"><button class="${C.key_source === 'cliente' ? 'on' : ''}" data-act="miaSrc" data-v="cliente">Chave do cliente (padrão)</button><button class="${C.key_source !== 'cliente' ? 'on' : ''}" data-act="miaSrc" data-v="lothem">Chave da Lothem</button></div>
      ${C.key_source === 'cliente' && !C.key_hint ? `<div class="row top-a" style="gap:8px;font-size:12.5px;padding:10px 12px;border-radius:9px;background:var(--warn-soft)">${ic('TriangleAlert', 'sm')}<span>Sem chave cadastrada: a ${esc(x.ia_name)} não responde até o cliente colocar a chave dele (em SDR IA, no CRM dele) ou você colar aqui.</span></div>` : ''}
      ${C.key_source === 'cliente' ? `<form class="row wrap" style="gap:8px;align-items:flex-end" data-sub="miaKey"><div class="field grow" style="min-width:240px"><label for="miaKeyIn">Chave de API da Anthropic do cliente</label><input class="in" id="miaKeyIn" type="password" autocomplete="off" placeholder="${C.key_hint ? 'Já cadastrada · termina em ' + esc(C.key_hint) + ' · cole outra para trocar' : 'Cole a chave aqui'}"></div><button class="btn pri" type="submit">${ic('Lock', 'sm')}Salvar cifrada</button>${C.key_hint ? '<button class="btn ghost" type="button" data-act="miaClearKey">Remover</button>' : ''}</form>
        <span class="hint">A chave é guardada com criptografia e nunca aparece de novo, nem para você. Só o servidor da IA consegue usá-la. Trocar ou remover fica na auditoria.</span>` : '<span class="hint">O gasto da IA desta organização entra na conta da Lothem. Use para as suas próprias empresas.</span>'}
      <div class="field"><label>Modelo</label><div class="col" style="gap:8px">${AI_MODELS.map((mm) => `<button type="button" class="pay-m ${mm.id === m.id ? 'on' : ''}" data-act="miaModel" data-v="${mm.id}"><span class="col" style="gap:2px;text-align:left"><b>${mm.nm}</b><span class="dim" style="font-size:12.5px">${mm.note}</span></span><span class="num dim nowrap" style="font-size:12px;margin-left:auto">US$ ${fmt(mm.in, mm.in < 1 ? 2 : 0)} / ${fmt(mm.out, mm.out < 1 ? 2 : 0)} por 1 mi tokens</span></button>`).join('')}</div></div>
      <div class="field" style="max-width:360px"><label>Esforço</label><div class="seg">${[['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']].map(([v, n]) => `<button class="${(C.effort || 'medium') === v ? 'on' : ''}" data-act="miaEffort" data-v="${v}">${n}</button>`).join('')}</div><span class="hint">Mais esforço pensa mais antes de responder e custa mais. Médio é o padrão.</span></div></div>`)}
    ${sec('mia-cost', ic('Coins', 'sm cy') + 'Gasto e auditoria', pill(usd(spent) + ' no mês', cap && spent >= cap ? 'bad' : 'line mono'), `<div class="col" style="gap:14px">
      <div class="usage">${[['Gasto no mês', money(spent)], ['Projeção do mês', money(proj)], ['Conversas no mês', fmt(convs)], ['Custo por conversa', convs ? money(spent / convs) : '—']].map(([k, v]) => `<div class="r-stat"><span class="lbl">${k}</span><div class="num" style="font-size:16px;font-weight:600">${v}</div></div>`).join('')}</div>
      <form class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;align-items:end" data-sub="miaCap">
        <div class="field"><label for="miaCapIn">Limite mensal (US$)</label><input class="in" id="miaCapIn" inputmode="decimal" value="${C.monthly_cap_usd || ''}" placeholder="sem limite"></div>
        <div class="field"><label for="miaAlert">Avisar ao chegar em</label><select class="sel" id="miaAlert">${[50, 70, 80, 90].map((v) => `<option value="${v}" ${Number(C.alert_pct || 80) === v ? 'selected' : ''}>${v}% do limite</option>`).join('')}</select></div>
        <div class="field"><label for="miaOnCap">Ao bater o limite</label><select class="sel" id="miaOnCap"><option value="pausar" ${C.on_cap !== 'avisar' ? 'selected' : ''}>Pausar a IA e passar para a equipe</option><option value="avisar" ${C.on_cap === 'avisar' ? 'selected' : ''}>Só avisar e continuar</option></select></div>
        <button class="btn" type="submit">Salvar limite</button></form>
      ${cap && proj > cap ? `<div class="row top-a" style="gap:8px;font-size:12.5px;padding:10px 12px;border-radius:9px;background:var(--warn-soft)">${ic('TriangleAlert', 'sm')}<span>No ritmo atual, o mês fecha em ${usd(proj)}, acima do limite de ${usd(cap)}.</span></div>` : ''}
      <div><span class="lbl">Últimos 30 dias</span><div class="mia-bars">${U.map((d) => `<span title="${dBRshort(d.day)} · ${usd(d.cost_usd)} · ${d.conversations} conversas" style="height:${Math.max(3, (100 * Number(d.cost_usd)) / maxDay)}%"></span>`).join('') || '<span class="dim" style="font-size:12.5px">Sem uso ainda.</span>'}</div></div>
      <div class="tbl-w" style="max-height:260px;overflow:auto"><table class="tbl"><thead><tr><th>Dia</th><th>Modelo</th><th class="r">Conversas</th><th class="r">Tokens entrada</th><th class="r">Tokens saída</th><th class="r">Custo</th></tr></thead><tbody>
        ${U.slice().reverse().map((d) => `<tr><td class="num">${dBRshort(d.day)}</td><td class="nowrap">${esc(AIM(d.model).nm.replace('Claude ', ''))}</td><td class="r num">${d.conversations}</td><td class="r num">${kTok(Number(d.input_tokens))}</td><td class="r num">${kTok(Number(d.output_tokens))}</td><td class="r num nowrap">${usd(d.cost_usd)}</td></tr>`).join('') || '<tr><td colspan="6" class="dim">Sem uso registrado.</td></tr>'}
      </tbody></table></div>
      <span class="lbl">Quem mudou o quê</span>
      <div class="col" style="gap:6px">${(D.audit || []).map((a) => `<div class="row between" style="font-size:13px;gap:10px"><span>${esc(ACTN[a.action] || a.action)}${a.detail && a.detail.titulo ? ' · ' + esc(a.detail.titulo) : ''}${a.detail && a.detail.final ? ' · termina em ' + esc(a.detail.final) : ''}</span><span class="dim nowrap" style="font-size:12px">${esc(a.by || '—')} · ${new Date(a.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></div>`).join('') || '<span class="dim" style="font-size:13px">Nenhuma alteração registrada.</span>'}</div></div>`)}
    ${sec('mia-train', ic('GraduationCap', 'sm cy') + 'Treinamento da SDR', pill('versão ' + (C.prompt_version || 1), 'line mono'), `<form class="col" style="gap:14px" data-sub="miaTrain">
      <div class="field"><label for="miaPrompt">Instruções da ${esc(x.ia_name)} (prompt de sistema)</label><textarea class="ta" id="miaPrompt" rows="9" placeholder="Quem ela é, como fala, o que vende, o que nunca diz e quando passa para uma pessoa.">${esc(C.system_prompt || '')}</textarea><span class="hint">Cada vez que o texto muda, a versão sobe e a mudança fica na auditoria.</span></div>
      <div class="form-g"><div class="field"><label for="miaBlocked">Palavras e frases proibidas</label><textarea class="ta" id="miaBlocked" rows="4" placeholder="uma por linha">${esc((C.blocked_terms || []).join('\n'))}</textarea></div>
      <div class="field"><label for="miaHandoff">Passa para uma pessoa quando aparecer</label><textarea class="ta" id="miaHandoff" rows="4" placeholder="uma por linha">${esc((C.handoff_terms || []).join('\n'))}</textarea></div></div>
      <div><button class="btn pri" type="submit">${ic('Check', 'sm')}Salvar treinamento</button></div></form>`)}
    ${sec('mia-rag', ic('Library', 'sm cy') + 'Base de conhecimento (RAG)', pill((D.kb || []).length + ' documentos', 'line mono'), `<div class="col" style="gap:14px">
      <p class="dim" style="font-size:12.5px">Cada documento é dividido em trechos. Em cada conversa, a ${esc(x.ia_name)} busca os trechos que respondem à pergunta e usa só eles, em vez de ler a base inteira. Isso deixa a resposta mais certa e mais barata.</p>
      <form class="col" style="gap:10px" data-sub="miaKb">
        <div class="form-g"><div class="field"><label for="miaKbT">Título</label><input class="in" id="miaKbT" placeholder="Ex.: Tabela de preços 2026"></div><div class="field"><label for="miaKbC">Tipo</label><select class="sel" id="miaKbC">${['Oferta', 'FAQ', 'Objeções', 'Treinamento', 'Regras', 'Produto'].map((c) => `<option>${c}</option>`).join('')}</select></div></div>
        <div class="field"><label for="miaKbX">Conteúdo</label><textarea class="ta" id="miaKbX" rows="5" placeholder="Cole o texto aqui, ou envie um arquivo .txt, .md ou .csv abaixo."></textarea></div>
        <div class="row wrap" style="gap:8px"><label class="btn sm ghost">${ic('Upload', 'xs')}Enviar arquivo<input type="file" accept=".txt,.md,.csv" hidden data-chg="miaKbFile"></label><span class="grow"></span><button class="btn pri sm" type="submit">${ic('Plus', 'xs')}Adicionar à base</button></div>
        <span class="hint">PDF: por enquanto, copie o texto do PDF e cole aqui.</span></form>
      <div class="col" style="gap:6px">${(D.kb || []).map((k) => `<div class="row between" style="gap:10px;font-size:13px;padding:8px 0;border-bottom:1px solid var(--line)"><span>${ic('FileText', 'xs dim')} <b>${esc(k.title)}</b> <span class="dim">· ${esc(k.category || '')} · ${fmt(k.chunks || 0)} trechos</span></span><button class="btn xs ghost" data-act="miaKbDel" data-id="${k.id}">Remover</button></div>`).join('') || '<span class="dim" style="font-size:13px">Base vazia.</span>'}</div>
      <form class="row wrap" style="gap:8px" data-sub="miaSearch"><div class="search grow" style="min-width:220px">${ic('Search')}<input class="in" id="miaQ" placeholder="Teste: o que um cliente perguntaria?" value="${esc(S.miaQ || '')}"></div><button class="btn" type="submit">Testar busca</button></form>
      ${S.miaHits ? `<div class="col" style="gap:8px">${S.miaHits.map((h) => `<div class="quote" style="margin:0"><span class="lbl">${esc(h.title)} · trecho ${h.n}</span><div style="margin-top:4px;font-size:13px">${esc(h.content)}</div></div>`).join('') || '<span class="dim" style="font-size:13px">Nada na base responde a isso. Vale adicionar um documento sobre o tema.</span>'}</div>` : ''}
    </div>`)}
    </div>`;
}
const dBRshort = (iso) => String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7);

/* ---------- ações ---------- */
async function miaSave(patch, msg) {
  const id = S.miaOrg, D = MIA.detail[id], x = MIA.list.find((o) => o.org_id === id);
  if (isRealM()) { const r = await REAL.sb.rpc('admin_ai_save', { p_org: id, p_cfg: patch }); if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); return; } await miaGet(id); }
  else {
    if ('system_prompt' in patch && patch.system_prompt !== D.config.system_prompt) D.config.prompt_version = (D.config.prompt_version || 1) + 1;
    Object.assign(D.config, patch); Object.assign(x._cfg, patch);
    D.audit.unshift({ at: new Date().toISOString(), action: 'configuracao_alterada', detail: patch, by: (ME() || {}).name });
  }
  ['model', 'key_source', 'monthly_cap_usd', 'paused'].forEach((k) => { if (k in patch) x[k] = patch[k]; });
  if (msg) toast(msg, x.org_name, '', 'Check');
  rerender();
}
ACT.miaModel = (el) => miaSave({ model: el.dataset.v }, 'Modelo alterado para ' + AIM(el.dataset.v).nm);
ACT.miaEffort = (el) => miaSave({ effort: el.dataset.v }, 'Esforço alterado');
ACT.miaSrc = (el) => miaSave({ key_source: el.dataset.v });
CHG.miaPause = (el) => miaSave({ paused: !el.checked }, el.checked ? 'IA ligada' : 'IA pausada: as conversas vão para a equipe');
SUB.miaCap = () => miaSave({ monthly_cap_usd: String($('#miaCapIn').value).replace(',', '.'), alert_pct: Number($('#miaAlert').value), on_cap: $('#miaOnCap').value }, 'Limite salvo');
SUB.miaTrain = () => {
  const lines = (id) => $('#' + id).value.split('\n').map((s) => s.trim()).filter(Boolean);
  miaSave({ system_prompt: $('#miaPrompt').value.trim(), blocked_terms: lines('miaBlocked'), handoff_terms: lines('miaHandoff') }, 'Treinamento salvo');
};
SUB.miaKey = async () => {
  const k = $('#miaKeyIn').value.trim(), id = S.miaOrg, x = MIA.list.find((o) => o.org_id === id), D = MIA.detail[id];
  if (k.length < 20) { toast('Chave muito curta', 'Confira se copiou a chave inteira.', 'warn', 'CircleAlert'); return; }
  $('#miaKeyIn').value = '';
  if (isRealM()) { const r = await REAL.sb.rpc('admin_ai_set_key', { p_org: id, p_key: k }); if (r.error) { toast('Não consegui salvar a chave', r.error.message, 'bad', 'CircleAlert'); return; } await miaGet(id); }
  else { D.config.key_hint = k.slice(-4); D.config.key_source = 'cliente'; D.audit.unshift({ at: new Date().toISOString(), action: 'chave_alterada', detail: { final: k.slice(-4) }, by: (ME() || {}).name }); }
  x.key_hint = k.slice(-4); x.key_source = 'cliente';
  toast('Chave salva com criptografia', 'Termina em ' + k.slice(-4), '', 'Lock'); rerender();
};
ACT.miaClearKey = async () => {
  const id = S.miaOrg, x = MIA.list.find((o) => o.org_id === id), D = MIA.detail[id];
  if (isRealM()) { const r = await REAL.sb.rpc('admin_ai_clear_key', { p_org: id }); if (r.error) { toast('Não consegui remover', r.error.message, 'bad', 'CircleAlert'); return; } await miaGet(id); }
  else { D.config.key_hint = null; D.config.key_source = 'lothem'; D.audit.unshift({ at: new Date().toISOString(), action: 'chave_removida', detail: {}, by: (ME() || {}).name }); }
  x.key_hint = null; x.key_source = 'lothem'; toast('Chave removida', 'A organização volta a usar a chave da Lothem.', '', 'KeyRound'); rerender();
};
/* RAG: divide o texto em trechos de ~900 caracteres, cortando em fim de frase */
function miaChunks(text) {
  const parts = String(text).replace(/\r/g, '').split(/\n{2,}|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean), out = [];
  let cur = '';
  parts.forEach((p) => { if ((cur + ' ' + p).length > 900 && cur) { out.push(cur.trim()); cur = p; } else cur = cur ? cur + ' ' + p : p; });
  if (cur.trim()) out.push(cur.trim());
  return out;
}
CHG.miaKbFile = async (el) => {
  const f = el.files && el.files[0]; if (!f) return;
  const txt = await f.text(); $('#miaKbX').value = txt.slice(0, 200000); if (!$('#miaKbT').value) $('#miaKbT').value = f.name.replace(/\.[^.]+$/, '');
};
SUB.miaKb = async () => {
  const id = S.miaOrg, D = MIA.detail[id], x = MIA.list.find((o) => o.org_id === id);
  const title = $('#miaKbT').value.trim(), cat = $('#miaKbC').value, text = $('#miaKbX').value.trim();
  if (!title || !text) { toast('Preencha o título e o conteúdo', '', 'warn', 'CircleAlert'); return; }
  const chunks = miaChunks(text);
  if (isRealM()) { const r = await REAL.sb.rpc('admin_kb_add', { p_org: id, p_title: title, p_category: cat, p_chunks: chunks }); if (r.error) { toast('Não consegui adicionar', r.error.message, 'bad', 'CircleAlert'); return; } await miaGet(id); }
  else { D.kb.unshift({ id: 'kb' + uid(), title, category: cat, chunks: chunks.length, created_at: new Date().toISOString(), text }); D.audit.unshift({ at: new Date().toISOString(), action: 'rag_documento_adicionado', detail: { titulo: title }, by: (ME() || {}).name }); }
  x.kb_docs = (x.kb_docs || 0) + 1; toast('Documento adicionado', title + ' · ' + chunks.length + ' trechos', '', 'Library'); rerender();
};
ACT.miaKbDel = async (el) => {
  const id = S.miaOrg, D = MIA.detail[id], x = MIA.list.find((o) => o.org_id === id);
  if (isRealM()) { const r = await REAL.sb.rpc('admin_kb_delete', { p_kb: el.dataset.id }); if (r.error) { toast('Não consegui remover', r.error.message, 'bad', 'CircleAlert'); return; } await miaGet(id); }
  else D.kb = D.kb.filter((k) => k.id !== el.dataset.id);
  x.kb_docs = Math.max(0, (x.kb_docs || 1) - 1); rerender();
};
SUB.miaSearch = async () => {
  const q = $('#miaQ').value.trim(); S.miaQ = q; if (!q) return;
  if (isRealM()) { const r = await REAL.sb.rpc('admin_kb_search', { p_org: S.miaOrg, p_q: q }); S.miaHits = r.error ? [] : r.data; }
  else {
    const words = norm(q).split(/\W+/).filter((w) => w.length > 3);
    S.miaHits = MIA.detail[S.miaOrg].kb.flatMap((k) => miaChunks(k.text || '').map((c, i) => ({ title: k.title, n: i + 1, content: c, score: words.filter((w) => norm(c).includes(w)).length })))
      .filter((h) => h.score).sort((a, b) => b.score - a.score).slice(0, 3);
  }
  rerender();
};


/* ---------- no CRM do cliente: SDR IA › Visão geral ganha o cartão da chave de IA ---------- */
const MY_KEY = {};
async function myKeyLoad() {
  const o = O();
  if (!isRealM()) { MY_KEY[o.id] = MY_KEY[o.id] || { key_source: 'cliente', key_hint: o.id === 'mkt' ? null : 'x7Qa', model: 'claude-opus-5-5', paused: false }; return; }
  MY_KEY[o.id] = { key_source: 'cliente', key_hint: null, loading: true };
  const r = await REAL.sb.rpc('ai_my_status', { p_org: o.id });
  MY_KEY[o.id] = r.error ? { key_source: 'cliente', key_hint: null } : (r.data && r.data[0]) || { key_source: 'cliente', key_hint: null };
  if (S.route === 'sdr') rerender();
}
const sdrGeralBase = sdrGeral;
sdrGeral = function () {
  const o = O(), admin = ['Proprietária', 'Gestor'].includes((ME() || {}).role);
  if (!MY_KEY[o.id]) myKeyLoad();
  const K = MY_KEY[o.id];
  const card = !K || K.loading || K.key_source === 'lothem' ? '' : `<section class="pn ${K.key_hint ? '' : 'gold-edge'}" style="margin-bottom:16px"><div class="pn-h"><span class="pn-t">${ic('KeyRound')}Chave de IA da ${esc(o.ia.name)}</span>${K.key_hint ? pill('Cadastrada ••••' + esc(K.key_hint), 'ok', 'Lock') : pill('Falta cadastrar', 'warn')}</div>
    <div class="pn-b col" style="gap:10px"><p class="dim" style="font-size:13px">A ${esc(o.ia.name)} usa a <b>sua conta na Anthropic</b> (console.anthropic.com). Você paga direto a eles, pelo uso, sem limite de conversas no plano.${K.key_hint ? '' : ' Sem a chave, ela não responde.'}</p>
    ${admin ? `<form class="row wrap" style="gap:8px;align-items:flex-end" data-sub="myKey"><div class="field grow" style="min-width:240px"><label for="myKeyIn">${K.key_hint ? 'Trocar a chave' : 'Cole aqui a chave de API'}</label><input class="in" id="myKeyIn" type="password" autocomplete="off" placeholder="sk-ant-…"></div><button class="btn pri" type="submit">${ic('Lock', 'sm')}Salvar cifrada</button></form><span class="hint">Fica guardada com criptografia e nunca aparece de novo. Só o servidor da IA usa.</span>` : '<span class="hint">Só a proprietária ou a gestão cadastram a chave.</span>'}</div></section>`;
  return card + sdrGeralBase();
};
SUB.myKey = async () => {
  const o = O(), k = $('#myKeyIn').value.trim();
  if (k.length < 20) { toast('Chave muito curta', 'Confira se copiou a chave inteira.', 'warn', 'CircleAlert'); return; }
  $('#myKeyIn').value = '';
  if (isRealM()) { const r = await REAL.sb.rpc('ai_set_my_key', { p_org: o.id, p_key: k }); if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); return; } }
  MY_KEY[o.id] = Object.assign(MY_KEY[o.id] || {}, { key_source: 'cliente', key_hint: k.slice(-4), loading: false });
  toast('Chave salva com criptografia', 'Termina em ' + k.slice(-4), '', 'Lock'); rerender();
};
