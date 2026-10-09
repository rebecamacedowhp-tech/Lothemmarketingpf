/* LOTHEM Vendas — importar contatos e negócios de outro CRM ou planilha (CSV ou Excel).
   Passo a passo: arquivo → colunas → funil e etapas → revisar e importar.
   No modo real, telefone, e-mail e documento são cifrados no banco (função import_rows). */

const IMP_FIELDS = [
  ['name', 'Nome do contato', ['nome', 'name', 'contato', 'cliente', 'lead', 'nome completo', 'nome do contato', 'pessoa', 'full name']],
  ['company', 'Empresa', ['empresa', 'company', 'organizacao', 'razao social', 'nome da empresa', 'conta', 'account']],
  ['phone', 'Telefone / WhatsApp', ['telefone', 'celular', 'whatsapp', 'phone', 'fone', 'tel', 'mobile', 'telefone celular', 'numero']],
  ['email', 'E-mail', ['email', 'e-mail', 'mail', 'endereco de email']],
  ['document', 'CPF ou CNPJ', ['cpf', 'cnpj', 'documento', 'cpf/cnpj', 'cpf ou cnpj', 'doc']],
  ['city', 'Cidade', ['cidade', 'city', 'municipio', 'localidade']],
  ['segment', 'Segmento', ['segmento', 'ramo', 'setor', 'industry', 'segment', 'nicho']],
  ['source', 'Origem', ['origem', 'fonte', 'source', 'canal', 'utm_source', 'origem do lead']],
  ['stage', 'Etapa do funil', ['etapa', 'estagio', 'fase', 'stage', 'status', 'etapa do funil', 'pipeline stage', 'deal stage']],
  ['value', 'Valor do negócio', ['valor', 'value', 'amount', 'preco', 'ticket', 'receita', 'valor do negocio', 'valor total']],
  ['product', 'Produto', ['produto', 'product', 'servico', 'plano', 'produtos']],
  ['notes', 'Observações', ['observacoes', 'observacao', 'notas', 'nota', 'notes', 'descricao', 'comentarios', 'anotacoes']],
];
const IMP_MAX = 20000;

/* ---------- leitura do arquivo ---------- */
function impDecode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); } /* CSV salvo pelo Excel no Brasil */
}
function impCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [';', ',', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}
function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Não consegui abrir a leitura de Excel. Salve a planilha como CSV e tente de novo.')); document.head.appendChild(s); });
}
async function impRead(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase(), buf = await file.arrayBuffer();
  if (ext === 'xlsx' || ext === 'xls') {
    await loadXlsxLib();
    const wb = window.XLSX.read(buf, { type: 'array' }), sh = wb.Sheets[wb.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(sh, { header: 1, raw: false, defval: '' }).filter((r) => r.some((c) => String(c).trim() !== ''));
  }
  return impCsv(impDecode(buf));
}
function impGuess(headers) {
  const used = new Set(), map = {};
  const H = headers.map((h) => norm(h).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim());
  IMP_FIELDS.forEach(([k, , syn]) => {
    let i = H.findIndex((h, j) => !used.has(j) && syn.includes(h));
    if (i < 0) i = H.findIndex((h, j) => !used.has(j) && syn.some((s) => s.length > 3 && h.includes(s)) && !(k === 'name' && /empresa|negocio|company/.test(h)));
    if (i >= 0) { map[k] = i; used.add(i); }
  });
  return map;
}
function impMoney(v) {
  let s = String(v || '').replace(/[^\d,.-]/g, ''); if (!s) return '';
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s); return isFinite(n) ? String(Math.round(n * 100) / 100) : '';
}

/* ---------- linhas prontas para importar ---------- */
function impRows() {
  const I = S.imp, cell = (r, k) => (I.map[k] != null ? String(r[I.map[k]] == null ? '' : r[I.map[k]]).trim() : '');
  const seen = new Set(), out = []; let noName = 0, dup = 0;
  I.rows.forEach((r) => {
    const x = {}; IMP_FIELDS.forEach(([k]) => { x[k] = cell(r, k); });
    if (!x.name) x.name = x.company;
    if (!x.name) { noName++; return; }
    const key = x.phone.replace(/\D/g, '') || x.email.toLowerCase();
    if (key && seen.has(key)) { dup++; return; }
    if (key) seen.add(key);
    x.value = impMoney(x.value);
    const st = I.map.stage != null ? I.stageMap[x.stage] : I.defStage;
    x.stage_id = st && st !== 'none' ? st : '';
    out.push(x);
  });
  return { out, noName, dup };
}

/* ---------- tela ---------- */
VIEWS.importar = {
  title: 'Importar de outro CRM',
  crumb: 'Comando',
  render() {
    const I = S.imp = S.imp || { step: 1 };
    const steps = ['Arquivo', 'Colunas', 'Funil', 'Revisar'];
    const head = `<div class="page-h"><div><button class="link" data-go="contatos" style="margin-bottom:6px">${ic('ArrowLeft', 'xs')} Voltar aos contatos</button><h2>Trazer seus clientes de outro CRM</h2>
      <p>Funciona com qualquer CRM ou planilha. Seus dados entram nesta organização: ${esc(O().short)}.</p></div></div>
      ${I.step < 5 ? `<div class="imp-steps">${steps.map((t, i) => `<span class="${I.step === i + 1 ? 'on' : I.step > i + 1 ? 'done' : ''}"><b>${I.step > i + 1 ? ic('Check', 'xs') : i + 1}</b>${t}</span>`).join('')}</div>` : ''}`;
    return head + [null, impStep1, impStep2, impStep3, impStep4, impStep5][I.step]();
  },
};
function impStep1() {
  return `<div class="grid g-12">
    <section class="pn s-7"><div class="pn-b col" style="gap:14px">
      <div class="drop-zone">${ic('Upload', 'lg cy')}<div style="margin-top:8px"><b>Envie a planilha exportada do seu CRM</b></div><div class="dim" style="font-size:12.5px;margin-top:4px">CSV ou Excel (.xlsx), até ${fmt(IMP_MAX)} linhas</div><input type="file" accept=".csv,.txt,.xlsx,.xls" data-chg="impFile" aria-label="Enviar planilha"></div>
      ${S.imp.err ? `<div class="row top-a" style="gap:8px;font-size:13px;color:var(--bad)">${ic('CircleAlert', 'sm')}<span>${esc(S.imp.err)}</span></div>` : ''}
      <button class="btn sm ghost" data-act="impModel" style="align-self:flex-start">${ic('Download', 'xs')}Baixar planilha modelo</button>
    </div></section>
    <section class="pn s-5"><div class="pn-h"><span class="pn-t">${ic('Info')}Como tirar os dados do CRM antigo</span></div>
      <div class="pn-b col" style="gap:10px;font-size:13.5px">
        <p>No CRM antigo, abra a lista de <b>contatos</b> ou de <b>negócios</b> e procure o botão <b>Exportar</b>. Baixe em CSV ou Excel.</p>
        <p class="muted">Vale para RD Station, Kommo, Pipedrive, HubSpot, Agendor, Ploomes, planilha do Excel ou do Google.</p>
        <p class="muted">Se exportar negócios, a etapa do funil e o valor vêm junto.</p>
        <hr class="sep"><p class="dim" style="font-size:12.5px">Prefere que a Lothem faça a migração? Ela já vem na implantação.</p></div></section>
  </div>`;
}
function impStep2() {
  const I = S.imp, ex = I.rows[0] || [];
  return `<section class="pn"><div class="pn-h"><span class="pn-t">${ic('Columns3')}Diga onde está cada informação</span><span class="dim" style="font-size:12px">${fmt(I.rows.length)} linhas em ${esc(I.file)}</span></div>
    <div class="pn-b"><p class="muted" style="font-size:13px;margin-bottom:14px">Já liguei o que reconheci. Confira e ajuste o que estiver errado. Só o nome é obrigatório.</p>
      <div class="imp-map">${IMP_FIELDS.map(([k, nm]) => `<label class="lbl" for="im-${k}">${esc(nm)}${k === 'name' ? ' *' : ''}</label>
        <select class="sel" id="im-${k}" data-chg="impMap" data-k="${k}"><option value="">Não importar</option>${I.headers.map((h, i) => `<option value="${i}" ${I.map[k] === i ? 'selected' : ''}>${esc(h || 'Coluna ' + (i + 1))}</option>`).join('')}</select>
        <span class="dim ellipsis" style="font-size:12.5px">${I.map[k] != null ? 'ex.: ' + esc(String(ex[I.map[k]] || '—')).slice(0, 60) : ''}</span>`).join('')}</div>
      <div class="row between" style="margin-top:18px"><button class="btn ghost" data-act="impGo" data-v="1">Voltar</button><button class="btn pri" data-act="impGo" data-v="3" ${I.map.name == null && I.map.company == null ? 'disabled' : ''}>Continuar</button></div></div></section>`;
}
function impStep3() {
  const I = S.imp, o = O(), pp = o.pipelines.find((p) => p.id === I.pipe) || o.pipelines[0]; I.pipe = pp.id;
  const opts = (sel) => `<option value="none" ${sel === 'none' ? 'selected' : ''}>Só o contato, sem negócio</option>` + pp.stages.map((s) => `<option value="${s.id}" ${sel === s.id ? 'selected' : ''}>${esc(s.nm)}</option>`).join('');
  const vals = I.map.stage != null ? Array.from(new Set(I.rows.map((r) => String(r[I.map.stage] || '').trim()))).slice(0, 40) : [];
  vals.forEach((v) => {
    if (v in I.stageMap) return;
    const n = norm(v);
    const m = pp.stages.find((s) => norm(s.nm) === n) || pp.stages.find((s) => n && (norm(s.nm).includes(n) || n.includes(norm(s.nm))))
      || (/(ganh|fechad|vendid|won|conclu)/.test(n) && pp.stages.find((s) => s.won)) || (/(perd|lost|cancel|desist)/.test(n) && pp.stages.find((s) => s.lost));
    I.stageMap[v] = m ? m.id : pp.stages[0].id;
  });
  if (I.defStage == null) I.defStage = pp.stages[0].id;
  return `<section class="pn"><div class="pn-h"><span class="pn-t">${ic('Filter')}Para qual funil eles vão</span></div>
    <div class="pn-b col" style="gap:16px">
      <div class="field" style="max-width:360px"><label for="imPipe">Funil</label><select class="sel" id="imPipe" data-chg="impPipe">${o.pipelines.map((p) => `<option value="${p.id}" ${p.id === pp.id ? 'selected' : ''}>${esc(p.nm)}</option>`).join('')}</select></div>
      ${vals.length ? `<div><span class="lbl">Cada etapa do CRM antigo entra em qual etapa daqui?</span><div class="imp-map" style="margin-top:10px">${vals.map((v, i) => `<label class="lbl" for="is-${i}">${esc(v || '(sem etapa)')}</label><select class="sel" id="is-${i}" data-chg="impStage" data-v="${esc(v)}">${opts(I.stageMap[v])}</select><span class="dim" style="font-size:12.5px">${fmt(I.rows.filter((r) => String(r[I.map.stage] || '').trim() === v).length)} linhas</span>`).join('')}</div></div>`
      : `<div class="field" style="max-width:360px"><label for="imDef">Todos entram na etapa</label><select class="sel" id="imDef" data-chg="impDef">${opts(I.defStage)}</select><span class="hint">A planilha não tem coluna de etapa.</span></div>`}
      <div class="row between"><button class="btn ghost" data-act="impGo" data-v="2">Voltar</button><button class="btn pri" data-act="impGo" data-v="4">Continuar</button></div></div></section>`;
}
function impStep4() {
  const I = S.imp, { out, noName, dup } = impRows();
  const c = (k) => out.filter((x) => x[k]).length, deals = out.filter((x) => x.stage_id).length;
  return `<div class="grid g-12">
    <section class="pn s-8"><div class="pn-h"><span class="pn-t">${ic('ListChecks')}Confira antes de importar</span></div>
      <div class="pn-b col" style="gap:14px">
        <div class="usage">${[['Contatos', out.length], ['Negócios no funil', deals], ['Com telefone', c('phone')], ['Com e-mail', c('email')]].map(([k, v]) => `<div class="r-stat"><span class="lbl">${k}</span><div class="num" style="font-size:20px;font-weight:600">${fmt(v)}</div></div>`).join('')}</div>
        ${noName || dup ? `<div class="dim" style="font-size:12.5px">${noName ? fmt(noName) + ' linhas sem nome ficam de fora. ' : ''}${dup ? fmt(dup) + ' repetidas na planilha (mesmo telefone ou e-mail) entram uma vez só.' : ''} Quem já existe no CRM também não é duplicado.</div>` : '<div class="dim" style="font-size:12.5px">Quem já existe no CRM (mesmo telefone ou e-mail) não é duplicado.</div>'}
        <div class="tbl-w"><table class="tbl"><thead><tr><th>Nome</th><th>Empresa</th><th>Telefone</th><th>E-mail</th><th>Etapa</th></tr></thead><tbody>${out.slice(0, 5).map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.company || '—')}</td><td class="num">${x.phone ? '•••• ' + esc(x.phone.replace(/\D/g, '').slice(-4)) : '—'}</td><td>${x.email ? esc(x.email[0] + '•••@' + (x.email.split('@')[1] || '')) : '—'}</td><td>${esc((O().pipelines.find((p) => p.id === I.pipe).stages.find((s) => s.id === x.stage_id) || { nm: '—' }).nm)}</td></tr>`).join('')}</tbody></table></div>
      </div></section>
    <section class="pn s-4"><div class="pn-h"><span class="pn-t">${ic('ShieldCheck')}Proteção dos dados</span></div>
      <div class="pn-b col" style="gap:12px;font-size:13px">
        <p>Telefone, e-mail e CPF/CNPJ entram criptografados. Na tela aparece só o final.</p>
        <label class="row top-a" style="gap:10px"><input type="checkbox" id="imLgpd" ${I.lgpd ? 'checked' : ''} data-chg="impLgpd"><span>Confirmo que esses clientes são da minha empresa e que posso tratar os dados deles (LGPD).</span></label>
        <button class="btn pri block" data-act="impRun" ${I.lgpd && out.length ? '' : 'disabled'}>${ic('Upload', 'sm')}Importar ${fmt(out.length)} contatos</button>
        <button class="btn ghost block" data-act="impGo" data-v="3">Voltar</button></div></section>
  </div>`;
}
function impStep5() {
  const I = S.imp, R = I.result;
  if (!R) return `<section class="pn co-done"><div class="pn-b col" style="gap:14px;align-items:center;text-align:center"><h2 style="font-size:20px">Importando…</h2><div style="width:100%;max-width:360px">${bar(I.progress || 0)}</div><p class="dim">${fmt(I.done || 0)} de ${fmt(I.total || 0)}. Pode deixar esta tela aberta.</p></div></section>`;
  return `<section class="pn co-done"><div class="pn-b col" style="gap:14px;align-items:center;text-align:center">
    <span class="ico-box ${R.error ? 'warn' : 'ok'}">${ic(R.error ? 'TriangleAlert' : 'CircleCheck', 'sm')}</span>
    <h2 style="font-size:22px">${R.error ? 'Importação parou no meio' : 'Clientes importados'}</h2>
    <p class="muted" style="max-width:46ch"><b>${fmt(R.created)}</b> contatos novos e <b>${fmt(R.deals)}</b> negócios no funil.${R.skipped ? ' ' + fmt(R.skipped) + ' já existiam ou estavam sem nome.' : ''}${R.error ? ' Motivo: ' + esc(R.error) + '. O que já entrou ficou salvo; você pode importar o arquivo de novo que os repetidos são ignorados.' : ''}</p>
    <div class="row wrap" style="gap:8px;justify-content:center"><button class="btn" data-act="impReset">Importar outro arquivo</button><button class="btn pri" data-go="funis">Ver o funil</button></div></div></section>`;
}

/* ---------- ações ---------- */
ACT.importCsv = () => { S.imp = { step: 1 }; go('importar'); };
CHG.impFile = async (el) => {
  const f = el.files && el.files[0]; if (!f) return;
  try {
    const rows = await impRead(f);
    if (rows.length < 2) throw new Error('A planilha está vazia ou só tem o cabeçalho.');
    if (rows.length - 1 > IMP_MAX) throw new Error('A planilha tem mais de ' + fmt(IMP_MAX) + ' linhas. Divida em arquivos menores.');
    const headers = rows[0].map((h) => String(h).trim());
    S.imp = { step: 2, file: f.name, headers, rows: rows.slice(1), map: impGuess(headers), stageMap: {}, defStage: null, pipe: null };
  } catch (e) { S.imp = { step: 1, err: e.message || 'Não consegui ler o arquivo.' }; }
  rerender();
};
CHG.impMap = (el) => { const I = S.imp; if (el.value === '') delete I.map[el.dataset.k]; else I.map[el.dataset.k] = Number(el.value); if (el.dataset.k === 'stage') I.stageMap = {}; rerender(); };
CHG.impPipe = (el) => { S.imp.pipe = el.value; S.imp.stageMap = {}; S.imp.defStage = null; rerender(); };
CHG.impStage = (el) => { S.imp.stageMap[el.dataset.v] = el.value; };
CHG.impDef = (el) => { S.imp.defStage = el.value; };
CHG.impLgpd = (el) => { S.imp.lgpd = el.checked; rerender(); };
ACT.impGo = (el) => { S.imp.step = Number(el.dataset.v); rerender(); };
ACT.impReset = () => { S.imp = { step: 1 }; rerender(); };
ACT.impModel = () => {
  const csv = '﻿' + IMP_FIELDS.map(([, nm]) => nm).join(';') + '\n' + ['Maria Souza', 'Souza Contabilidade', '(11) 90000-0000', 'maria@exemplo.com.br', '00.000.000/0001-00', 'São Paulo/SP', 'Contabilidade', 'Indicação', 'Qualificado', '1500', 'Consultoria', 'Quer resolver até o fim do mês'].join(';') + '\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'modelo-importacao-lothem-vendas.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
ACT.impRun = async () => {
  const I = S.imp, { out } = impRows();
  I.step = 5; I.total = out.length; I.done = 0; I.progress = 0; I.result = null; rerender();
  const R = { created: 0, skipped: 0, deals: 0 };
  if (!REAL.on) { /* demonstração: entra só nesta tela, nada vai para o banco */
    const o = O();
    out.forEach((x) => {
      const id = 'imp' + uid();
      o.contacts.unshift({ id, pf: !x.company, nm: x.name, co: x.company || 'Pessoa física', seg: x.segment || '—', city: x.city || '—', ph: x.phone ? '•••• ' + x.phone.replace(/\D/g, '').slice(-4) : '—', em: x.email ? x.email[0] + '•••@' + (x.email.split('@')[1] || '') : '—', src: x.source || 'Importado', owner: DB.me, life: 'Lead', score: 0, last: 'agora' });
      R.created++;
      if (x.stage_id) { o.deals.unshift({ id: 'd' + uid(), c: id, p: I.pipe, s: x.stage_id, v: Number(x.value) || 0, temp: 'frio', owner: DB.me, next: 'Importado de outro CRM', age: 'agora', product: x.product || null }); R.deals++; }
    });
    I.result = R; rerender(); return;
  }
  const send = out.map((x) => ({ name: x.name, company: x.company, phone: x.phone, email: x.email, document: x.document, city: x.city, segment: x.segment, source: x.source, value: x.value, product: x.product, notes: x.notes, stage_id: x.stage_id }));
  for (let i = 0; i < send.length; i += 300) {
    const r = await REAL.sb.rpc('import_rows', { p_org: S.org, p_pipeline: I.pipe, p_rows: send.slice(i, i + 300) });
    if (r.error) { R.error = r.error.message; break; }
    R.created += r.data.created; R.skipped += r.data.skipped; R.deals += r.data.deals;
    I.done = Math.min(send.length, i + 300); I.progress = (I.done / send.length) * 100;
    if (S.route === 'importar') rerender();
  }
  I.result = R;
  await startReal(REAL.user); go('importar');
};
