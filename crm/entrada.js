/* LOTHEM Vendas — Entrada do lead do Meta.
   Separa quem já comprou o diagnóstico de quem fez o quiz e não comprou. A Cibelle usa uma trilha diferente para cada um. */

const ENTRY = {
  comprou: { nm: 'Já comprou o diagnóstico', short: 'Comprou', cls: 'ok', icon: 'BadgeCheck', trilha: 'não vende de novo. Pede a autorização, confirma os dados e marca a conversa com a Rebeca' },
  quiz: { nm: 'Fez o quiz e não comprou', short: 'Quiz sem compra', cls: 'warn', icon: 'ListChecks', trilha: 'vende o Diagnóstico com calma, sem pressão' },
};
const ENTRY_BOUGHT = ['pago', 'autorizado', 'relatorio', 'rebeca', 'consultoria'];

/* Na demonstração, a entrada sai da etapa do negócio. Na conta real, vem do campo salvo. */
function entryOf(c) {
  if (!c) return null;
  if (c.entry !== undefined) return c.entry;
  if (isRealM() || !String(c.src || '').startsWith('Meta')) return (c.entry = null);
  const d = O().deals.find((x) => x.c === c.id && x.p === 'diag');
  return (c.entry = d ? (ENTRY_BOUGHT.includes(d.s) ? 'comprou' : 'quiz') : null);
}
function entryPill(c) { const e = ENTRY[entryOf(c)]; return e ? pill(e.short, e.cls) : ''; }
function entryBox(c) {
  const e = entryOf(c), x = ENTRY[e];
  return `<div class="col" style="gap:8px;padding:12px;border-radius:10px;border:1px solid var(--line)">
    <label class="lbl" for="entrySel">Entrada do Meta</label>
    <select class="sel" id="entrySel" data-chg="entry" data-id="${c.id}">
      <option value="" ${!e ? 'selected' : ''}>Não marcado</option>
      ${Object.keys(ENTRY).map((k) => `<option value="${k}" ${e === k ? 'selected' : ''}>${ENTRY[k].nm}</option>`).join('')}
    </select>
    <p class="dim" style="font-size:12.5px">${x ? 'O que a ' + esc(O().ia.name) + ' faz: ' + esc(x.trilha) + '.' : 'Sem marcação, ' + esc(O().ia.name) + ' pergunta antes de oferecer qualquer coisa. Se a pessoa disser que já pagou, ela confere antes de confirmar.'}</p>
  </div>`;
}

CHG.entry = async (el) => {
  const c = CT(el.dataset.id); if (!c) return;
  const v = el.value || null;
  if (isRealM()) {
    const r = await REAL.sb.from('contacts').update({ entry_path: v, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); el.value = c.entry || ''; return; }
  }
  c.entry = v;
  toast(v ? 'Entrada: ' + ENTRY[v].nm : 'Entrada desmarcada', v ? O().ia.name + ' ' + ENTRY[v].trilha + '.' : O().ia.name + ' vai perguntar antes de ofertar.', '', v ? ENTRY[v].icon : 'Check');
  openContact(c.id);
  if (S.route === 'contatos') rerender();
};
ACT.fEntry = (el) => { S.filters.entry = el.dataset.v || null; rerender(); };

/* Ficha do contato: caixa da entrada logo depois dos dados */
const entryBaseOpen = openContact;
openContact = function (id) {
  entryBaseOpen(id);
  const c = CT(id), b = $('#overlay .drawer-b'); if (!c || !b) return;
  const box = document.createElement('div'); box.innerHTML = entryBox(c);
  b.insertBefore(box.firstElementChild, b.children[2] || null);
};

/* Novo negócio: escolher a entrada */
const entryBaseNewDeal = ACT.newDeal;
ACT.newDeal = () => {
  entryBaseNewDeal();
  const g = $('form[data-sub="newDeal"] .form-g'); if (!g) return;
  const f = document.createElement('div'); f.className = 'field';
  f.innerHTML = `<label for="ndEntry">Entrada do Meta</label><select class="sel" id="ndEntry"><option value="">Não se aplica</option>${Object.keys(ENTRY).map((k) => `<option value="${k}">${ENTRY[k].nm}</option>`).join('')}</select>`;
  g.appendChild(f);
};
const entryBaseSubNewDeal = SUB.newDeal;
SUB.newDeal = function (f) {
  const v = ($('#ndEntry') && $('#ndEntry').value) || null;
  const r = entryBaseSubNewDeal(f);
  const after = () => { const c = O().contacts[0]; if (c && c.entry === undefined) c.entry = v; if (S.route === 'contatos') rerender(); };
  if (r && r.then) r.then(after); else after();
  return r;
};
