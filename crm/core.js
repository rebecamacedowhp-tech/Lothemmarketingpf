/* LOTHEM Vendas — núcleo da interface: estado, utilidades, gráficos, shell, overlays, XP e comandos. */

const S = {
  route: 'central',
  org: 'mkt',
  tabs: {},
  pipe: 'inb',
  cv: 'cv6',
  cvFilter: 'todas',
  channel: 'handoff',
  draft: {},
  noteMode: false,
  guideOpen: false,
  guideDone: new Set(),
  period: 'mes',
  filters: {},
  sim: null,
  sandbox: [],
};

const ACT = {};
const CHG = {}, INP = {}, SUB = {};
const VIEWS = {};

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const brl = (n, d = 0) => 'R$ ' + fmt(n, d);
const brlK = (n) => (n >= 1000000 ? 'R$ ' + fmt(n / 1000000, 1) + ' mi' : n >= 10000 ? 'R$ ' + fmt(n / 1000, n % 1000 ? 1 : 0) + ' mil' : brl(n));
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const uid = () => Math.random().toString(36).slice(2, 8);
const store = {
  get(k, d) { try { const v = localStorage.getItem('lothem-nucleo:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lothem-nucleo:' + k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } },
};

const O = () => DB.orgs[S.org];
const ME = () => DB.users.find((u) => u.id === DB.me);
const U = (id) => DB.users.find((u) => u.id === id);
const CT = (id) => O().contacts.find((c) => c.id === id);
const DL = (id) => O().deals.find((d) => d.id === id);
const PIPE = (id) => O().pipelines.find((p) => p.id === id);
const STAGE = (pid, sid) => PIPE(pid).stages.find((s) => s.id === sid);
const dealOf = (cid) => O().deals.find((d) => d.c === cid && !STAGE(d.p, d.s).lost);

/* ---------- ícones (Lucide via UMD, desenhados como string) ---------- */
const ICON_CACHE = {};
function ic(name, cls = '') {
  const key = name + '|' + cls;
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const node = window.lucide && window.lucide.icons && window.lucide.icons[name];
  let inner = '';
  if (node) {
    const kids = Array.isArray(node[2]) ? node[2] : Array.isArray(node[0]) ? node : [];
    inner = kids.map(([tag, attrs]) => '<' + tag + ' ' + Object.entries(attrs).map(([k, v]) => k + '="' + v + '"').join(' ') + '/>').join('');
  } else {
    inner = '<circle cx="12" cy="12" r="4"/>';
  }
  const svg = '<svg class="i ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  ICON_CACHE[key] = svg;
  return svg;
}

/* ---------- avatares e marcas ---------- */
function initials(name) { const p = name.trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function hueOf(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
function av(who, size = '') {
  if (who === 'ia' || (who && who.ia)) return '<span class="av ia ' + size + '" title="' + esc(O().ia.name) + ' · IA">' + ic('Bot', size === 's' ? 'xs' : 'sm') + '</span>';
  const u = typeof who === 'string' ? U(who) : who;
  if (!u) return '';
  const bg = u.color ? u.color : 'hsl(' + hueOf(u.nm || u.name) + ' 45% 38%)';
  const inner = u.photo ? '<img src="' + u.photo + '" alt="">' : initials(u.name || u.nm);
  return '<span class="av ' + size + '" style="background:' + bg + '" title="' + esc(u.name || u.nm) + '">' + inner + '</span>';
}
function contactAv(c, size = '') { return av({ nm: c.nm, name: c.nm }, size); }
function orgMark(o, size = 34) {
  const col = o.hue === 'gold' ? 'var(--gold)' : o.hue === 'ok' ? 'var(--ok)' : 'var(--cy)';
  return '<svg class="mark" viewBox="0 0 40 40" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="18" fill="none" stroke="' + col + '" stroke-opacity=".35" stroke-width="1"/>' +
    '<circle cx="20" cy="20" r="18" fill="none" stroke="' + col + '" stroke-width="2" stroke-dasharray="20 9.7" stroke-linecap="round"/>' +
    '<circle cx="20" cy="20" r="11" fill="none" stroke="' + col + '" stroke-opacity=".6" stroke-width="1"/>' +
    '<text x="20" y="24.2" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-weight="600" font-size="11" fill="' + col + '">' + o.mark + '</text></svg>';
}

/* ---------- marca da organização: logo e cor de destaque ---------- */
const ACCENTS = [['#46d2ff', 'Ciano Lothem'], ['#f6b84a', 'Dourado'], ['#3ddc97', 'Verde'], ['#9b8cff', 'Violeta'], ['#ff7a59', 'Coral'], ['#ff5fa2', 'Rosa']];
function hexLum(h) {
  const n = parseInt(String(h).replace('#', ''), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function applyBrand() {
  const o = O(), root = document.documentElement, st = root.style;
  ['--cy', '--cy-2', '--cy-soft', '--cy-glow', '--cy-ink'].forEach((k) => st.removeProperty(k));
  if (!o || !o.accent) return;
  const dia = root.classList.contains('dia'), a = o.accent;
  st.setProperty('--cy', dia ? 'color-mix(in srgb, ' + a + ' 70%, #000)' : a);
  st.setProperty('--cy-2', 'color-mix(in srgb, ' + a + ' 75%, #000)');
  st.setProperty('--cy-soft', 'color-mix(in srgb, ' + a + ' ' + (dia ? 10 : 12) + '%, transparent)');
  st.setProperty('--cy-glow', 'color-mix(in srgb, ' + a + ' 35%, transparent)');
  st.setProperty('--cy-ink', dia || hexLum(a) < 0.35 ? '#ffffff' : '#05121c');
}
function orgBadge(o, size = 34) {
  return o.logo ? '<span class="org-logo" style="width:' + size + 'px;height:' + size + 'px"><img src="' + o.logo + '" alt="Logo ' + esc(o.short) + '"></span>' : orgMark(o, size);
}
function loadBrands() {
  Object.values(DB.orgs).forEach((o) => {
    const b = store.get('brand:' + o.id, null);
    if (!b) return;
    if (b.logo) o.logo = b.logo;
    if (b.accent) o.accent = b.accent;
    if (b.short) o.short = b.short;
  });
}
function setTheme(dia) {
  const root = document.documentElement;
  root.classList.toggle('dia', dia);
  store.set('dia', dia);
  applyBrand();
  const sw = $('#themeSw'); if (sw) sw.checked = dia;
  if (S.route === 'perfil') rerender();
}
CHG.themeSw = (el) => setTheme(el.checked);

ACT.brandOrg = (el) => {
  closePop();
  const o = DB.orgs[(el && el.dataset && el.dataset.id) || S.org];
  S.brandDraft = { id: o.id, logo: o.logo || null, accent: o.accent || null, short: o.short };
  openBrandModal();
};
function openBrandModal() {
  const d = S.brandDraft, o = DB.orgs[d.id], admin = ['Proprietária', 'Gestor'].includes(ME().role);
  const prev = Object.assign({}, o, { logo: d.logo, short: d.short, accent: d.accent });
  const cur = d.accent || '#46d2ff';
  openModal(modalHead('Marca da organização', 'A logo aparece no menu, na troca de organização e na lista de organizações.') + `
    <div class="modal-b">
      <div class="brand-prev" style="--c:${cur}">${orgBadge(prev, 56)}<div class="grow"><b style="font-size:16px">${esc(d.short)}</b><div class="dim">${esc(o.name)}</div></div><span class="brand-dot" title="Cor de destaque"></span></div>
      ${admin ? `<div class="drop-zone">${ic('ImageUp', 'lg cy')}<div style="margin-top:8px"><b>${d.logo ? 'Trocar a logo' : 'Enviar a logo da empresa'}</b></div><div class="dim" style="font-size:13px;margin-top:4px">PNG, SVG ou JPG até 2 MB. Fundo transparente fica melhor.</div><input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" data-chg="brandLogo" aria-label="Enviar logo"></div>
      ${d.logo ? `<button class="link" data-act="brandNoLogo" style="align-self:flex-start">Remover a logo e voltar ao símbolo padrão</button>` : ''}
      <div class="field"><label for="brShort">Nome no menu</label><input class="in" id="brShort" value="${esc(d.short)}" maxlength="28" data-inp="brandShort"></div>
      <div class="field"><label>Cor de destaque</label><div class="swatches">${ACCENTS.map(([c, n]) => `<button class="sw-c ${cur === c ? 'on' : ''}" style="--c:${c}" data-act="brandAccent" data-c="${c}" title="${n}" aria-label="${n}" aria-pressed="${cur === c}"></button>`).join('')}<label class="sw-c custom ${ACCENTS.some(([c]) => c === cur) ? '' : 'on'}" title="Outra cor">${ic('Plus', 'xs')}<input type="color" value="${cur}" data-chg="brandColor" aria-label="Escolher outra cor"></label></div></div>`
      : `<p class="muted">Só a proprietária e a gestão mudam a marca.</p>`}
    </div><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button>${admin ? `<button class="btn pri" data-act="brandSave">Salvar marca</button>` : ''}</div>`);
}
CHG.brandLogo = (el) => {
  const f = el.files && el.files[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { toast('Arquivo grande demais', 'Use uma imagem de até 2 MB.', 'warn', 'Image'); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || 256, h0 = img.naturalHeight || 256, sc = Math.min(1, 256 / Math.max(w0, h0));
      const c = document.createElement('canvas'); c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      S.brandDraft.logo = c.toDataURL('image/png');
      openBrandModal();
    };
    img.onerror = () => toast('Não consegui ler a imagem', 'Tente um PNG ou JPG.', 'warn', 'Image');
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
};
ACT.brandNoLogo = () => { S.brandDraft.logo = null; openBrandModal(); };
INP.brandShort = (el) => { S.brandDraft.short = el.value; };
ACT.brandAccent = (el) => { S.brandDraft.accent = el.dataset.c === '#46d2ff' ? null : el.dataset.c; openBrandModal(); };
CHG.brandColor = (el) => { S.brandDraft.accent = el.value; openBrandModal(); };
ACT.brandSave = () => {
  const d = S.brandDraft, o = DB.orgs[d.id];
  o.logo = d.logo; o.accent = d.accent; o.short = (d.short || '').trim() || o.short;
  store.set('brand:' + o.id, { logo: o.logo, accent: o.accent, short: o.short });
  closeOverlay();
  renderShell();
  toast('Marca salva', o.short + ' já aparece com a logo e a cor novas.', '', 'Palette');
  markGuide('brand');
};

/* ---------- gráficos SVG ---------- */
function ring(p, size = 74, stroke = 7, color = 'var(--cy)', label = '') {
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p));
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--panel-3)" stroke-width="' + stroke + '"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (c * v) / 100 + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
    (label ? '<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-weight="600" font-size="' + size * 0.24 + '" fill="var(--fg)">' + label + '</text>' : '') + '</svg>';
}
function spark(arr, color = 'var(--cy)', w = 84, h = 26) {
  const mx = Math.max(...arr), mn = Math.min(...arr), rg = mx - mn || 1;
  const pts = arr.map((v, i) => [(i / (arr.length - 1)) * (w - 4) + 2, h - 3 - ((v - mn) / rg) * (h - 7)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path d="' + d + ' L' + last[0] + ' ' + h + ' L2 ' + h + 'Z" fill="' + color + '" fill-opacity=".1"/><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.4" fill="' + color + '"/></svg>';
}
function areaChart(a, b, opts = {}) {
  const W = 640, H = 220, L = 30, R = 10, T = 12, B = 26;
  const mx = Math.ceil(Math.max(...a, ...b) / 4) * 4 || 4;
  const x = (i) => L + (i / (a.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / mx) * (H - T - B);
  const path = (arr) => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = (mx / 4) * k, yy = y(v);
    grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (yy + 3) + '" text-anchor="end">' + v + '</text>';
  }
  let xl = '';
  const [d0, m0] = opts.start || [8, 9];
  for (let i = 0; i < a.length; i += 7) {
    const dt = new Date(2026, m0 - 1, d0 + i);
    xl += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '</text>';
  }
  xl += '<text x="' + x(a.length - 1) + '" y="' + (H - 6) + '" text-anchor="end">hoje</text>';
  const la = a.length - 1;
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(opts.label || 'Série diária') + '">' +
    '<defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--cy)" stop-opacity=".32"/><stop offset="1" stop-color="var(--cy)" stop-opacity="0"/></linearGradient></defs>' +
    grid + '<rect x="' + x(la - 6) + '" y="' + T + '" width="' + (x(la) - x(la - 6)) + '" height="' + (H - T - B) + '" fill="var(--cy)" fill-opacity=".05"/>' +
    '<path d="' + path(a) + ' L' + x(la) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + 'Z" fill="url(#ga)"/>' +
    '<path d="' + path(a) + '" fill="none" stroke="var(--cy)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
    '<path d="' + path(b) + '" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
    '<circle cx="' + x(la) + '" cy="' + y(a[la]) + '" r="4" fill="var(--cy)" stroke="var(--panel)" stroke-width="2"/>' +
    '<circle cx="' + x(la) + '" cy="' + y(b[la]) + '" r="4" fill="var(--gold)" stroke="var(--panel)" stroke-width="2"/>' + xl + '</svg>';
}
function bar(p, cls = '', pace) {
  return '<div class="bar ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, p)).toFixed(1) + '%"></i>' + (pace != null ? '<span class="pace" style="left:' + pace + '%" title="Ritmo esperado hoje"></span>' : '') + '</div>';
}
function pill(t, cls = '', icon = '') { return '<span class="pill ' + cls + '">' + (icon ? ic(icon) : '') + esc(t) + '</span>'; }
function delta(d, invert) {
  if (!d) return '<span class="delta flat">— 0%</span>';
  const arrow = invert ? (d > 0 ? '▼' : '▲') : (d > 0 ? '▲' : '▼');
  return '<span class="delta ' + (d > 0 ? 'up' : 'down') + '" title="comparado com o mesmo período do mês passado">' + arrow + ' ' + Math.abs(d) + '%</span>';
}
let CLOCK = 24;
function nowT() { const h = 10 + Math.floor(CLOCK / 60), m = CLOCK % 60; CLOCK = Math.min(CLOCK + 1, 13 * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
/* ---------- SLA de atendimento (configurado pela gestão em Equipe e acessos) ---------- */
const T0 = Date.now();
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const SLA_TYPES = { primeira: 'Primeira resposta', transfer: 'Transferência da IA', retorno: 'Retorno ao lead' };
function slaNow() { return 10 * 60 + 24 + (Date.now() - T0) / 60000; }
function slaInfo(cv, o) {
  o = o || O();
  if (!cv || !cv.slaType || !cv.slaSince || !o.sla) return null;
  const lim = o.sla[cv.slaType];
  if (!lim) return null;
  const left = (toMin(cv.slaSince) + lim - slaNow()) * 60;
  const used = (1 - left / (lim * 60)) * 100;
  return { lim, left, used, type: cv.slaType, label: SLA_TYPES[cv.slaType], state: left <= 0 ? 'bad' : used >= o.sla.warnAt ? 'warn' : 'ok' };
}
function slaText(si) {
  if (si.left <= 0) { const m = Math.floor(-si.left / 60); return 'Fora do SLA há ' + (m < 1 ? 'menos de 1 min' : m + ' min'); }
  return Math.floor(si.left / 60) + ':' + String(Math.floor(si.left % 60)).padStart(2, '0') + ' para responder';
}
function slaChip(cv, big) {
  const si = slaInfo(cv);
  if (!si) return '';
  return '<span class="sla ' + si.state + (big ? ' big' : '') + '" data-sla="' + cv.id + '" title="' + esc(si.label) + ': ' + si.lim + ' min">' + ic('Timer', 'xs') + '<span class="t">' + slaText(si) + '</span></span>';
}
S.slaSeen = {};
function slaBreach(o, cv, si) {
  const ct = o.contacts.find((c) => c.id === cv.c), first = ct.nm.split(' ')[0];
  const inst = o.instances.find((i) => i.id === cv.inst);
  const owner = U(cv.who || ct.owner) || ME();
  const did = [];
  if (o.sla.iaHold && inst && inst.type === 'oficial') { cv.msgs.push({ f: 'ia', x: first + ', já avisei a equipe de novo. Alguém te responde em instantes.', t: nowT() }); did.push(o.ia.name + ' mandou mensagem de espera'); }
  if (o.sla.redistribute) {
    const alt = DB.users.find((u) => u.id !== owner.id && u.orgs.includes(o.id) && o.sla.roles.includes(u.role)) || ME();
    cv.who = alt.id; cv.msgs.push({ f: 'sys', x: 'SLA estourado · lead passado de ' + owner.short + ' para ' + alt.short, t: nowT(), cls: 'bad' }); did.push('lead passado para ' + alt.short);
  } else cv.msgs.push({ f: 'sys', x: 'SLA estourado · ' + si.label.toLowerCase() + ' de ' + si.lim + ' min', t: nowT(), cls: 'bad' });
  if (o.sla.notifyBoss) did.push('gestão avisada');
  DB.notifications.unshift({ id: 'n' + uid(), ic: 'Timer', cls: 'bad', t: 'SLA estourado · ' + ct.nm, d: si.label + ' de ' + si.lim + ' min · ' + (did.join(', ') || owner.short + ' avisado'), go: 'atendimento', cv: cv.id, unread: true });
  if (o.id === S.org) toast('SLA estourado · ' + ct.nm, si.label + ' passou de ' + si.lim + ' min. ' + (did.length ? did.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.' : ''), 'bad', 'Timer');
  refreshChrome();
  if (o.id === S.org && ['atendimento', 'central'].includes(S.route)) rerender();
}
function slaTick() {
  Object.values(DB.orgs).forEach((o) => o.conversations.forEach((cv) => {
    const si = slaInfo(cv, o);
    if (!si) { delete S.slaSeen[cv.id]; return; }
    const prev = S.slaSeen[cv.id];
    S.slaSeen[cv.id] = si.state;
    if (prev && prev !== 'bad' && si.state === 'bad') slaBreach(o, cv, si);
    else if (prev === 'ok' && si.state === 'warn' && o.id === S.org) toast('SLA perto de estourar', o.contacts.find((c) => c.id === cv.c).nm + ' · faltam ' + Math.ceil(si.left / 60) + ' min', 'warn', 'Timer');
  }));
  $$('[data-sla]').forEach((el) => {
    const cv = O().conversations.find((c) => c.id === el.dataset.sla), si = slaInfo(cv);
    if (!si) { el.remove(); return; }
    el.className = 'sla ' + si.state + (el.classList.contains('big') ? ' big' : '');
    const t = el.querySelector('.t'); if (t) t.textContent = slaText(si);
  });
}
function dayLabel(off, long) {
  const d = new Date(2026, 9, 7 + off);
  const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()];
  const dm = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  if (off === 0) return long ? 'Hoje · ' + wd + ' ' + dm : 'Hoje';
  if (off === 1) return long ? 'Amanhã · ' + wd + ' ' + dm : 'Amanhã';
  if (off === -1) return long ? 'Ontem · ' + wd + ' ' + dm : 'Ontem';
  return wd.charAt(0).toUpperCase() + wd.slice(1) + ' ' + dm;
}
function copyText(txt, label) {
  const done = () => toast('Copiado', label || txt, '', 'Copy');
  try { navigator.clipboard.writeText(txt).then(done, () => toast('Selecione e copie', txt, '', 'Copy')); } catch (e) { toast('Selecione e copie', txt, '', 'Copy'); }
}
function temp(t) { return '<span class="temp ' + t + '">' + ic(t === 'quente' ? 'Flame' : t === 'morno' ? 'Thermometer' : 'Snowflake', 'xs') + t + '</span>'; }
function hexFrame(color = 'var(--gold)', fill = 'var(--gold-soft)') {
  return '<svg class="f" viewBox="0 0 64 72" aria-hidden="true"><path d="M32 2 L61 18.5 L61 53.5 L32 70 L3 53.5 L3 18.5 Z" fill="' + fill + '" stroke="' + color + '" stroke-width="1.5"/><path d="M32 9 L55 22 L55 50 L32 63 L9 50 L9 22 Z" fill="none" stroke="' + color + '" stroke-opacity=".35" stroke-width="1"/></svg>';
}

/* ---------- nível e XP ---------- */
const xpFor = (L) => 25 * L * L + 100 * L;
function levelOf(xp) { let L = 1; while (xpFor(L + 1) <= xp) L++; return L; }
function tierOf(L) { return L < 5 ? 'Base' : L < 10 ? 'Tração' : L < 15 ? 'Precisão' : L < 20 ? 'Estratégia' : L < 25 ? 'Elite' : 'Referência'; }
function lvlInfo(u) {
  const L = levelOf(u.xp), a = xpFor(L), b = xpFor(L + 1);
  return { L, tier: tierOf(L), cur: u.xp - a, need: b - a, left: b - u.xp, p: ((u.xp - a) / (b - a)) * 100 };
}
function gainXP(n, reason, who = DB.me) {
  const u = U(who);
  if (!u) return;
  const before = levelOf(u.xp);
  u.xp += n; u.seasonXp += n;
  toast('+' + n + ' XP', reason, 'xp', 'Hexagon');
  const after = levelOf(u.xp);
  if (after > before && who === DB.me) {
    setTimeout(() => toast('Nível ' + after + ' · ' + tierOf(after), 'Você subiu de nível. Faltam ' + fmt(xpFor(after + 1) - u.xp) + ' XP para o próximo.', 'xp lvl', 'ChevronsUp'), 700);
  }
  refreshChrome();
}
function squadXP(n, reason) { toast('+' + n + ' XP para o squad', reason, 'xp', 'Users'); }

/* ---------- toasts ---------- */
function toast(t, d = '', kind = '', icon = 'Check') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.setAttribute('role', 'status');
  const col = kind.includes('xp') ? 'gold' : kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : 'cy';
  el.innerHTML = '<span class="' + col + '">' + ic(icon) + '</span><div class="grow"><div class="t">' + esc(t) + '</div>' + (d ? '<div class="d">' + esc(d) + '</div>' : '') + '</div>';
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, kind.includes('lvl') ? 5200 : 3600);
}

/* ---------- overlays ---------- */
function closeOverlay() { $('#overlay').innerHTML = ''; }
function openDrawer(html) {
  $('#overlay').innerHTML = '<div class="ovl" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true">' + html + '</aside>';
  const f = $('#overlay .drawer [autofocus]'); if (f) f.focus();
}
function openModal(html, wide) {
  $('#overlay').innerHTML = '<div class="ovl" data-act="close"></div><div class="modal ' + (wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
  const f = $('#overlay .modal [autofocus]') || $('#overlay .modal input, #overlay .modal textarea'); if (f) f.focus();
}
function modalHead(t, p) { return '<div class="modal-h"><div><h3>' + t + '</h3>' + (p ? '<p>' + p + '</p>' : '') + '</div><button class="iconbtn" data-act="close" aria-label="Fechar">' + ic('X') + '</button></div>'; }
function closePop() { const p = $('#pop'); if (p) p.innerHTML = ''; }
function openPop(anchor, html, align = 'left') {
  const r = anchor.getBoundingClientRect();
  const box = $('#pop');
  box.innerHTML = '<div class="pop" role="menu">' + html + '</div>';
  const el = box.firstChild;
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = align === 'right' ? r.right - w : r.left;
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  el.style.left = left + 'px'; el.style.top = top + 'px';
}

/* ---------- navegação ---------- */
const NAV = [
  { grp: 'Comando', items: [
    { id: 'central', nm: 'Central', ic: 'LayoutDashboard' },
    { id: 'atendimento', nm: 'Atendimento', ic: 'MessageCircle', badge: () => { const n = O().conversations.filter((c) => c.st === 'espera' || c.unread).length; return n ? { n, cls: 'hot' } : null; } },
    { id: 'funis', nm: 'Funis de vendas', ic: 'Kanban' },
    { id: 'contatos', nm: 'Contatos', ic: 'Users' },
    { id: 'tarefas', nm: 'Tarefas', ic: 'SquareCheck', badge: () => { const n = O().tasks.filter((t) => !t.done && t.due < 0).length; return n ? { n, cls: 'hot' } : null; } },
  ] },
  { grp: 'Inteligência', items: [
    { id: 'sdr', nm: () => 'SDR IA · ' + O().ia.name, ic: 'Bot', badge: () => { const n = O().reviews.length; return n ? { n, cls: '' } : null; } },
    { id: 'chat', nm: 'Chat da equipe', ic: 'MessagesSquare', badge: () => { const n = O().channels.concat(O().dms).reduce((s, c) => s + (c.unread || 0), 0); return n ? { n, cls: '' } : null; } },
    { id: 'evolucao', nm: 'Evolução', ic: 'Trophy', badge: () => ({ n: 'Nv ' + levelOf(ME().xp), cls: 'gold' }) },
    { id: 'meta', nm: 'Meta pessoal', ic: 'Wallet', badge: () => { const r = typeof routeCalc === 'function' ? routeCalc(O(), DB.me) : null; return r ? { n: Math.round(pct(r.projIncome, r.c.wish)) + '%', cls: r.projIncome >= r.c.wish ? '' : 'gold' } : null; } },
  ] },
  { grp: 'Conta', fold: true, items: [
    { id: 'canais', nm: 'WhatsApp e integrações', ic: 'Smartphone', badge: () => { const n = O().instances.filter((i) => i.st === 'off').length; return n ? { n: '!', cls: 'hot' } : null; } },
    { id: 'equipe', nm: 'Equipe e acessos', ic: 'ShieldCheck' },
    { id: 'planos', nm: 'Planos e pagamentos', ic: 'CreditCard' },
    { id: 'organizacoes', nm: 'Organizações', ic: 'Building2' },
    { id: 'suporte', nm: 'Suporte', ic: 'LifeBuoy' },
  ] },
];
const navName = (it) => (typeof it.nm === 'function' ? it.nm() : it.nm);

/* Endereço da tela: #rota, #rota.aba e ~org para abrir outra organização em outra aba. Ex.: #funis~pf */
function orgHash(route, org) { return '#' + route + (org && org !== 'mkt' ? '~' + org : ''); }
function syncHash() { try { history.replaceState(null, '', orgHash(S.route, S.org)); } catch (e) { /* sem histórico no sandbox */ } }
function setOrgQuiet(id) {
  if (!DB.orgs[id]) return;
  S.org = id;
  S.pipe = O().pipelines[0].id;
  S.cv = (O().conversations[0] || {}).id;
  S.channel = (O().channels[0] || {}).id;
}
function go(route, opts = {}) {
  if (!VIEWS[route]) route = 'central';
  S.route = route;
  if (opts.tab) S.tabs[route] = opts.tab;
  if (opts.cv) S.cv = opts.cv;
  if (opts.pipe) S.pipe = opts.pipe;
  if (opts.channel) S.channel = opts.channel;
  document.documentElement.classList.remove('sb-open');
  closePop(); closeOverlay();
  syncHash();
  renderMain(true);
  renderNav();
  const st = $('#stage'); if (st && !opts.keepScroll) st.scrollTop = 0;
}

/* ---------- shell ---------- */
function renderShell() {
  const o = O();
  applyBrand();
  const dia = document.documentElement.classList.contains('dia');
  $('#app').innerHTML =
    '<aside class="sb" id="sb" aria-label="Menu principal">' +
      '<button class="sb-org" data-act="orgMenu" data-tip="' + esc(o.short) + '">' + orgBadge(o) + '<span class="txt grow"><span class="nm ellipsis" style="display:block">' + esc(o.short) + '</span><span class="sub">Plano ' + esc(o.plan) + '</span></span><span class="chev dim">' + ic('ChevronsUpDown', 'sm') + '</span></button>' +
      '<nav class="sb-scroll" id="nav"></nav>' +
      '<div class="sb-foot"><button class="me-card" data-act="meMenu" id="meCard"></button>' +
      '<button class="sb-toggle" data-act="toggleSb" data-tip="Expandir menu" aria-label="Recolher ou expandir o menu">' + ic('PanelLeftClose', 'sm') + '<span class="t">Recolher menu</span></button></div>' +
    '</aside><div class="scrim" data-act="closeSb"></div>' +
    '<div class="main">' +
      '<header class="top">' +
        '<button class="iconbtn burger" data-act="openSb" aria-label="Abrir menu">' + ic('Menu') + '</button>' +
        '<div class="top-title"><div class="crumb" id="crumb"></div><h1 id="ptitle"></h1></div>' +
        '<button class="demo-tag" data-act="guide" id="demoTag" title="Dados fictícios. Clique para ver o roteiro da demonstração."></button>' +
        '<button class="cmdk" data-act="cmd" aria-label="Buscar ou executar comando">' + ic('Search', 'sm') + '<span class="t">Buscar ou dar um comando</span><kbd>Ctrl K</kbd></button>' +
        '<button class="iconbtn" data-act="newMenu" aria-label="Criar">' + ic('Plus') + '</button>' +
        '<label class="theme-sw" title="Tema claro ou escuro"><input type="checkbox" id="themeSw" data-chg="themeSw" aria-label="Tema claro"' + (dia ? ' checked' : '') + '><span class="ts-track"><span class="ts-ic moon">' + ic('Moon', 'xs') + '</span><span class="ts-ic sun">' + ic('Sun', 'xs') + '</span><span class="ts-knob"></span></span></label>' +
        '<button class="iconbtn" data-act="notifs" aria-label="Notificações" id="bell"></button>' +
        '<button class="xpchip" data-go="evolucao" id="xpchip" aria-label="Seu nível"></button>' +
      '</header>' +
      '<main class="stage" id="stage"></main>' +
    '</div>';
  renderNav();
  refreshChrome();
  renderMain();
  renderGuide();
}

function renderNav() {
  const nav = $('#nav');
  if (!nav) return;
  const mini = document.documentElement.classList.contains('sb-min');
  nav.innerHTML = NAV.map((g) => {
    const active = g.items.some((it) => it.id === S.route);
    const open = !g.fold || mini || active || S.navOpen;
    const hot = g.items.some((it) => { const b = it.badge ? it.badge() : null; return b && b.cls === 'hot'; });
    const head = g.fold && !mini
      ? '<button class="lbl grp-t" data-act="navFold" aria-expanded="' + open + '">' + g.grp + (hot && !open ? '<span class="dot bad"></span>' : '') + '<span class="grow"></span>' + ic(open ? 'ChevronUp' : 'ChevronDown', 'xs') + '</button>'
      : '<span class="lbl">' + g.grp + '</span>';
    return '<div class="sb-grp">' + head + (open ? g.items.map((it) => {
      const b = it.badge ? it.badge() : null, nm = navName(it);
      return '<button class="nv ' + (S.route === it.id ? 'on' : '') + '" data-go="' + it.id + '" data-tip="' + esc(nm) + '"' + (S.route === it.id ? ' aria-current="page"' : '') + '>' + ic(it.ic) + '<span class="t">' + esc(nm) + '</span>' +
        (b && b.cls === 'hot' ? '<span class="bdg hot">' + b.n + '</span><span class="dot-b"></span>' : '') + '</button>';
    }).join('') : '') + '</div>';
  }).join('');
}

ACT.navFold = () => { S.navOpen = !S.navOpen; store.set('navOpen', S.navOpen); renderNav(); };

function refreshChrome() {
  const me = ME(), li = lvlInfo(me);
  const mc = $('#meCard');
  if (mc) mc.innerHTML = av(me) + '<span class="txt grow" style="min-width:0"><span class="nm ellipsis" style="display:block">' + esc(me.name) + '</span><span class="sub">' + esc(me.role.toUpperCase()) + ' · NV ' + li.L + '</span></span>';
  const xc = $('#xpchip');
  if (xc) xc.innerHTML = '<span class="gold">' + ic('Hexagon', 'sm') + '</span><span class="lv">NV ' + li.L + '</span><span class="bar gold thin"><i style="width:' + li.p.toFixed(1) + '%"></i></span>';
  const bell = $('#bell');
  if (bell) { const n = DB.notifications.filter((x) => x.unread).length; bell.innerHTML = ic('Bell') + (n ? '<span class="cnt">' + n + '</span>' : ''); }
  renderNav();
}

function renderMain(animate) {
  const v = VIEWS[S.route];
  const stage = $('#stage');
  if (!stage || !v) return;
  const t = typeof v.title === 'function' ? v.title() : v.title;
  $('#ptitle').textContent = t;
  $('#crumb').textContent = O().short + ' · ' + (v.crumb || 'Comando');
  document.title = t + ' · ' + O().short;
  const active = document.activeElement;
  const fid = active && active.id && stage.contains(active) ? active.id : null;
  const ss = {};
  $$('[data-keep-scroll]', stage).forEach((el) => { ss[el.dataset.keepScroll] = el.scrollTop; });
  stage.className = 'stage' + (v.full ? ' full' : '');
  stage.innerHTML = '<div class="view' + (v.full ? ' full-v' : '') + '" style="' + (v.full ? 'height:100%;display:flex;flex-direction:column;min-height:0' : '') + '">' + v.render() + '</div>';
  if (!animate) { const vw = $('.view', stage); if (vw) vw.style.animation = 'none'; }
  $$('[data-keep-scroll]', stage).forEach((el) => { if (ss[el.dataset.keepScroll] != null) el.scrollTop = ss[el.dataset.keepScroll]; });
  if (v.after) v.after();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); if (el.setSelectionRange && el.value != null) { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* tipo sem seleção */ } } } }
}
function rerender() { renderMain(false); renderNav(); }

/* ---------- menus do topo ---------- */
ACT.close = () => { closeOverlay(); closePop(); };
ACT.openSb = () => document.documentElement.classList.add('sb-open');
ACT.closeSb = () => document.documentElement.classList.remove('sb-open');
ACT.toggleSb = () => {
  const on = document.documentElement.classList.toggle('sb-min');
  store.set('sbMin', on);
  const b = $('.sb-toggle'); if (b) { b.innerHTML = ic(on ? 'PanelLeftOpen' : 'PanelLeftClose', 'sm') + '<span class="t">Recolher menu</span>'; b.dataset.tip = on ? 'Expandir menu' : 'Recolher menu'; }
};
ACT.orgMenu = (el) => {
  openPop(el, '<span class="lbl">Organizações</span>' + Object.values(DB.orgs).map((o) =>
    '<button class="mi ' + (o.id === S.org ? 'on' : '') + '" data-act="switchOrg" data-id="' + o.id + '">' + orgBadge(o, 26) + '<span class="grow"><b style="font-weight:600">' + esc(o.short) + '</b><br><span class="dim" style="font-size:12px">' + o.members.length + ' pessoas · ' + o.instances.length + ' instância' + (o.instances.length > 1 ? 's' : '') + '</span></span>' + (o.id === S.org ? ic('Check', 'sm') : '') + '</button>').join('') +
    '<hr class="sep" style="margin:6px 0"><span class="lbl">Abrir em outra aba</span>' + Object.values(DB.orgs).map((x) => '<a class="mi" data-act="close" href="' + orgHash(S.route, x.id) + '" target="_blank" rel="noopener">' + ic('ExternalLink', 'sm') + esc(x.short) + '</a>').join('') +
    '<hr class="sep" style="margin:6px 0"><button class="mi" data-act="brandOrg">' + ic('Palette', 'sm') + 'Personalizar marca</button><button class="mi" data-go="organizacoes">' + ic('Settings', 'sm') + 'Gerenciar organizações</button>');
};
ACT.switchOrg = (el) => {
  const id = el.dataset.id;
  closePop();
  if (id === S.org) return;
  if (S.sim && S.sim.running) simSkip();
  S.org = id;
  S.pipe = O().pipelines[0].id;
  S.cv = (O().conversations[0] || {}).id;
  S.channel = (O().channels[0] || {}).id;
  S.filters = {};
  renderShell();
  syncHash();
  toast('Você está em ' + O().short, 'Contatos, funis, canais e a SDR IA desta organização ficam separados das outras.', '', 'Building2');
  markGuide('org');
};
ACT.meMenu = (el) => {
  const dia = document.documentElement.classList.contains('dia');
  openPop(el, '<div class="row" style="padding:8px 10px">' + av(ME(), 'l') + '<div><b>' + esc(ME().name) + '</b><div class="dim" style="font-size:12px">' + esc(ME().email) + '</div></div></div><hr class="sep" style="margin:4px 0">' +
    '<button class="mi" data-go="perfil">' + ic('UserCog', 'sm') + 'Meu perfil e preferências</button>' +
    '<button class="mi" data-act="theme">' + ic(dia ? 'Moon' : 'Sun', 'sm') + (dia ? 'Usar tema Noite' : 'Usar tema Dia') + '</button>' +
    '<button class="mi" data-go="evolucao">' + ic('Trophy', 'sm') + 'Minha evolução</button>' +
    '<button class="mi" data-go="suporte">' + ic('LifeBuoy', 'sm') + 'Falar com o suporte</button>' +
    '<hr class="sep" style="margin:4px 0"><button class="mi" data-act="logout">' + ic('LogOut', 'sm') + 'Sair</button>', 'left');
};
ACT.logout = () => { closePop(); toast('Demonstração', 'Na versão real, aqui você sai da conta. Na demo, você continua dentro.', '', 'Info'); };
ACT.theme = () => { closePop(); setTheme(!document.documentElement.classList.contains('dia')); };
ACT.newMenu = (el) => {
  openPop(el, '<span class="lbl">Criar</span>' +
    '<button class="mi" data-act="newContact">' + ic('UserPlus', 'sm') + 'Contato</button>' +
    '<button class="mi" data-act="newDeal">' + ic('Kanban', 'sm') + 'Negócio no funil</button>' +
    '<button class="mi" data-act="newTask">' + ic('SquareCheck', 'sm') + 'Tarefa</button>' +
    '<button class="mi" data-act="inviteUser">' + ic('Send', 'sm') + 'Convite para a equipe</button>' +
    '<hr class="sep" style="margin:4px 0"><button class="mi" data-act="simLead">' + ic('Zap', 'sm') + 'Simular lead do Meta</button>', 'right');
};
ACT.notifs = (el) => {
  openPop(el, '<div class="row between" style="padding:6px 10px"><span class="lbl" style="padding:0">Notificações</span><button class="btn xs ghost" data-act="readAll">Marcar como lidas</button></div>' +
    DB.notifications.map((n) => '<button class="notif-i ' + (n.unread ? 'unread' : '') + '" data-act="openNotif" data-id="' + n.id + '"><span class="ico-box ' + n.cls + '" style="width:30px;height:30px">' + ic(n.ic, 'sm') + '</span><span style="min-width:0"><span class="t" style="font-weight:600;font-size:13px;display:block">' + esc(n.t) + '</span><span class="dim" style="font-size:12px">' + esc(n.d) + '</span></span></button>').join(''), 'right');
  $('#pop .pop').style.width = 'min(380px, calc(100vw - 24px))';
};
ACT.readAll = () => { DB.notifications.forEach((n) => (n.unread = false)); closePop(); refreshChrome(); };
ACT.openNotif = (el) => {
  const n = DB.notifications.find((x) => x.id === el.dataset.id);
  n.unread = false; refreshChrome();
  if (S.org !== 'mkt') { S.org = 'mkt'; renderShell(); }
  go(n.go, n.cv ? { cv: n.cv } : {});
};

/* ---------- paleta de comandos ---------- */
function cmdItems() {
  const items = [];
  NAV.forEach((g) => g.items.forEach((it) => items.push({ ic: it.ic, t: 'Ir para ' + navName(it), k: 'tela', run: () => go(it.id) })));
  items.push({ ic: 'UserCog', t: 'Ir para Meu perfil', k: 'tela', run: () => go('perfil') });
  items.push({ ic: 'Zap', t: 'Simular lead chegando do Meta', k: 'demo', run: () => ACT.simLead() });
  items.push({ ic: 'Flame', t: 'Mostrar leads quentes', k: 'filtro', run: () => { S.filters.temp = 'quente'; go('funis'); } });
  items.push({ ic: 'GraduationCap', t: 'Revisar respostas da SDR IA', k: 'ação', run: () => go('sdr', { tab: 'rev' }) });
  items.push({ ic: 'Send', t: 'Convidar pessoa para a equipe', k: 'ação', run: () => ACT.inviteUser() });
  items.push({ ic: 'SquareCheck', t: 'Criar tarefa', k: 'ação', run: () => ACT.newTask() });
  items.push({ ic: 'QrCode', t: 'Conectar WhatsApp por QR Code', k: 'ação', run: () => { go('canais'); ACT.newInstance(); } });
  items.push({ ic: 'SunMoon', t: 'Alternar tema Dia / Noite', k: 'ação', run: () => ACT.theme() });
  Object.values(DB.orgs).forEach((o) => { if (o.id !== S.org) items.push({ ic: 'Building2', t: 'Trocar para ' + o.short, k: 'org', run: () => ACT.switchOrg({ dataset: { id: o.id } }) }); });
  O().contacts.forEach((c) => items.push({ ic: 'User', t: c.nm + ' · ' + c.co, k: 'contato', run: () => openContact(c.id) }));
  O().deals.forEach((d) => { const c = CT(d.c); items.push({ ic: 'Kanban', t: 'Negócio · ' + c.co + ' · ' + STAGE(d.p, d.s).nm, k: 'negócio', run: () => openDeal(d.id) }); });
  return items;
}
ACT.cmd = () => {
  closePop();
  $('#overlay').innerHTML = '<div class="ovl" data-act="close"></div><div class="cmd" role="dialog" aria-label="Buscar ou dar um comando"><div class="cmd-in">' + ic('Search', 'cy') + '<input id="cmdQ" placeholder="Buscar contato, negócio, tela ou ação…" autocomplete="off"><kbd>Esc</kbd></div><div class="cmd-res" id="cmdRes"></div></div>';
  const q = $('#cmdQ');
  let sel = 0, list = [];
  const draw = () => {
    const v = norm(q.value.trim());
    const all = cmdItems();
    list = (v ? all.filter((x) => norm(x.t).includes(v)) : all.filter((x) => x.k !== 'contato' && x.k !== 'negócio')).slice(0, 12);
    sel = Math.min(sel, Math.max(0, list.length - 1));
    $('#cmdRes').innerHTML = list.length ? list.map((x, i) => '<button class="mi ' + (i === sel ? 'sel' : '') + '" data-i="' + i + '">' + ic(x.ic, 'sm') + '<span class="ellipsis">' + esc(x.t) + '</span><span class="k">' + x.k + '</span></button>').join('') : '<div class="empty">Nada encontrado para "' + esc(q.value) + '".</div>';
  };
  q.addEventListener('input', () => { sel = 0; draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, list.length - 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && list[sel]) { const it = list[sel]; closeOverlay(); it.run(); }
  });
  $('#cmdRes').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const it = list[+b.dataset.i]; closeOverlay(); it.run(); });
  draw(); q.focus();
};

/* ---------- roteiro da demo ---------- */
const GUIDE = [
  { id: 'sim', t: 'Lead do Meta atendido pela Cibelle', d: 'A SDR IA qualifica, vende o diagnóstico e recebe o Pix.', run: () => { go('atendimento'); setTimeout(() => ACT.simLead(), 250); } },
  { id: 'deal', t: 'Arrastar um negócio para "Ganho"', d: 'Feche a Bella Pele no funil da consultoria e veja o XP.', run: () => go('funis', { pipe: 'cons' }) },
  { id: 'train', t: 'Treinar a Cibelle com uma correção', d: 'Corrija a resposta sobre garantia de resultado.', run: () => go('sdr', { tab: 'rev' }) },
  { id: 'handoff', t: 'Passar um lead para o Closer', d: 'Atribua o handoff da Fernanda ao Caio no chat.', run: () => go('chat', { channel: 'handoff' }) },
  { id: 'invite', t: 'Convidar alguém e ajustar permissões', d: 'Mande um convite e edite a matriz de acesso.', run: () => { go('equipe', { tab: 'conv' }); setTimeout(() => ACT.inviteUser(), 200); } },
  { id: 'qr', t: 'Reconectar o WhatsApp por QR Code', d: 'Reative a instância do Caio, que caiu.', run: () => go('canais') },
  { id: 'task', t: 'Concluir uma tarefa e ganhar XP', d: 'Ligue para a Juliana e marque como feito.', run: () => go('tarefas') },
  { id: 'meta', t: 'Traçar uma meta de salário', d: 'Veja a rota do Caio até R$ 7.000 e envie para o SDR.', run: () => { S.metaUser = 'u2'; go('meta'); } },
  { id: 'sla', t: 'Configurar o SLA do SDR', d: 'Mude o tempo de resposta e veja o relógio da Juliana reagir.', run: () => go('equipe', { tab: 'sla' }) },
  { id: 'autofill', t: 'Ligar e desligar o preenchimento pela IA', d: 'Desligue na conta admin e simule um lead: a Cibelle só sugere.', run: () => go('sdr', { tab: 'af' }) },
  { id: 'brand', t: 'Colocar a logo da empresa', d: 'Personalize a organização com logo e cor de destaque.', run: () => ACT.brandOrg() },
  { id: 'org', t: 'Trocar de organização', d: 'Veja a Lothem Crédito, com dados e IA separados.', run: () => ACT.orgMenu($('.sb-org')) },
];
function markGuide(id) { if (!S.guideDone.has(id)) { S.guideDone.add(id); store.set('guide', Array.from(S.guideDone)); renderGuide(); } }
function renderGuide() {
  const g = $('#guide');
  if (!g) return;
  const n = S.guideDone.size;
  const tag = $('#demoTag');
  if (tag) { tag.innerHTML = ic('Route', 'sm') + '<span class="t">DEMO · ROTEIRO</span><span class="n">' + n + '/' + GUIDE.length + '</span>'; tag.setAttribute('aria-expanded', S.guideOpen); }
  g.innerHTML = (S.guideOpen ? '<div class="guide" role="dialog" aria-label="Roteiro da demo"><div class="guide-h"><div class="row between"><b style="font-family:var(--f-display);font-size:15px">Roteiro da demonstração</b><button class="iconbtn" style="width:30px;height:30px" data-act="guide" aria-label="Fechar">' + ic('X', 'sm') + '</button></div><p class="muted" style="font-size:12.5px;margin-top:4px">' + GUIDE.length + ' fluxos para ver o CRM funcionando. Clique em um para ir direto.</p>' + bar(pct(n, GUIDE.length), 'thin') + '</div>' +
      GUIDE.map((x, i) => '<button class="guide-i ' + (S.guideDone.has(x.id) ? 'done' : '') + '" data-act="runGuide" data-id="' + x.id + '"><span class="n">' + (S.guideDone.has(x.id) ? ic('Check', 'xs') : i + 1) + '</span><span><span class="tt" style="display:block">' + x.t + '</span><span class="dd">' + x.d + '</span></span>' + ic('ArrowRight', 'sm dim') + '</button>').join('') + '</div>' : '');
}
ACT.guide = () => { S.guideOpen = !S.guideOpen; renderGuide(); };
ACT.runGuide = (el) => { const x = GUIDE.find((g) => g.id === el.dataset.id); S.guideOpen = false; renderGuide(); if (x.id !== 'org' && S.org !== 'mkt') { S.org = 'mkt'; renderShell(); } x.run(); };

/* ---------- eventos globais ---------- */

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-act]');
  const opener = t && /Menu$|^notifs$/.test(t.dataset.act || '');
  if (!e.target.closest('#pop .pop') && !opener) closePop();
  if (S.guideOpen && !e.target.closest('#guide') && !e.target.closest('#demoTag')) { S.guideOpen = false; renderGuide(); }
  if (!t) return;
  if (t.dataset.act) { const fn = ACT[t.dataset.act]; if (fn) fn(t, e); return; }
  e.preventDefault();
  go(t.dataset.go, { tab: t.dataset.tab, pipe: t.dataset.pipe, cv: t.dataset.cv, channel: t.dataset.channel });
});
document.addEventListener('change', (e) => { const t = e.target.closest('[data-chg]'); if (t && CHG[t.dataset.chg]) CHG[t.dataset.chg](t, e); });
document.addEventListener('input', (e) => { const t = e.target.closest('[data-inp]'); if (t && INP[t.dataset.inp]) INP[t.dataset.inp](t, e); });
document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-sub]'); if (!f) return; e.preventDefault(); if (SUB[f.dataset.sub]) SUB[f.dataset.sub](f, e); });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ACT.cmd(); }
  if (e.key === 'Escape') { closeOverlay(); closePop(); if (S.guideOpen) { S.guideOpen = false; renderGuide(); } }
});
