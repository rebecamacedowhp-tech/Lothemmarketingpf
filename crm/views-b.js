/* LOTHEM Vendas — Inteligência e conta: SDR IA, Chat da equipe, Evolução, Canais, Equipe, Planos, Organizações, Perfil e Suporte. */

/* =========================================================
   SDR IA
   ========================================================= */
const maturity = (o) => Math.round(o.skills.reduce((a, s) => a + s.v, 0) / o.skills.length);
const MODES = [
  { id: 'cop', nm: 'Copiloto', ic: 'PenLine', d: 'Sugere a resposta. Alguém da equipe revisa e envia.' },
  { id: 'sup', nm: 'Supervisionado', ic: 'Eye', d: 'Envia sozinha. Retém o que tiver baixa confiança ou tema sensível e manda para revisão.' },
  { id: 'aut', nm: 'Autônomo', ic: 'Rocket', d: 'Envia tudo, a qualquer hora. Use só com maturidade acima de 90%.' },
];
VIEWS.sdr = {
  title: () => 'SDR IA · ' + O().ia.name,
  crumb: 'Inteligência',
  render() {
    const o = O(), tab = S.tabs.sdr || 'geral', mode = MODES.find((m) => m.id === o.ia.mode);
    const tabs = [['geral', 'Visão geral', 'Gauge'], ['kb', 'Base de conhecimento', 'BookOpen', o.kb.length], ['play', 'Playbook e oferta', 'ListChecks'], ['regras', 'Regras', 'ShieldCheck'], ['af', 'Preenchimento do CRM', 'Sparkles'], ['rev', 'Revisões', 'GraduationCap', o.reviews.length], ['test', 'Testar', 'FlaskConical']];
    const body = { geral: sdrGeral, kb: sdrKb, play: sdrPlay, regras: sdrRegras, af: sdrAf, rev: sdrRev, test: sdrTest }[tab]();
    return `
    <div class="page-h"><div class="row" style="gap:14px">${av('ia', 'xl')}<div><h2>${esc(o.ia.name)} · ${esc(o.ia.role)}</h2>
      <p>${esc(kitText(o, o.play.desc))}</p>
      <div class="row wrap" style="gap:6px;margin-top:8px">${pill('Ativa · modo ' + mode.nm.toLowerCase(), 'ok', 'CircleCheck')}${pill('Maturidade ' + maturity(o) + '%', 'cy mono')}${pill(o.kb.length + ' itens na base', 'line mono')}</div></div></div>
      <div class="acts"><button class="btn" data-act="tab" data-v="sdr:test">${ic('FlaskConical', 'sm')}Testar</button><button class="btn pri" data-act="tab" data-v="sdr:kb">${ic('Plus', 'sm')}Ensinar algo novo</button></div></div>
    <div class="tabs" role="tablist">${tabs.map(([id, nm, icn, n]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="sdr:${id}" role="tab" aria-selected="${tab === id}">${ic(icn, 'sm')}${nm}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>
    ${body}`;
  },
};
function sdrGeral() {
  const o = O(), st = o.iaStats, mt = maturity(o);
  const weak = [...o.skills].sort((a, b) => a.v - b.v).filter((s) => s.v < 85).slice(0, 3);
  const ch = DB.game.challenges.find((x) => x.id === 'ch1');
  const oldKb = o.kb.filter((k) => k.st === 'old' || k.st === 'pend');
  return `<div class="grid g-12">
    <section class="pn hud s-4"><div class="pn-h"><span class="pn-t">${ic('Gauge')}Maturidade do treinamento</span></div>
      <div class="pn-b col" style="align-items:center;text-align:center;gap:12px">${ring(mt, 150, 12, 'var(--cy)', mt + '%')}
        <p class="muted" style="font-size:13px;max-width:34ch">Sobe quando você aprova correções e mantém a base atualizada. Acima de 90%, o modo autônomo fica recomendado.</p>
        <div class="row wrap" style="justify-content:center;gap:6px">${pill(st.approvals + ' correções aprovadas', 'gold mono')}${pill(o.kb.length + ' itens na base', 'line mono')}</div></div></section>
    <div class="s-8 kpis">
      ${[['Conversas · 30 dias', fmt(st.convs), 'MessageCircle'], ['Taxa de qualificação', st.qual, 'ListChecks'], [o.play.soldLabel, st.sold + '', 'CircleDollarSign', st.soloSold ? st.soloSold + ' sem ajuda humana' : o.ia.mode === 'cop' ? 'com revisão humana' : ''],
        ['Passou para humano', st.transfers + '', 'UserCheck', fmt(pct(st.transfers, st.convs), 0) + '% das conversas'], ['Confiança média', st.conf + '%', 'Gauge'], ['Satisfação', st.csat + ' / 5', 'Smile', 'pesquisa no fim da conversa']]
        .map(([k, v, icn, sub]) => `<div class="pn kpi" style="cursor:default"><span class="lbl">${k}</span><div class="row between"><span class="v num">${v}</span><span class="ico-box cy">${ic(icn, 'sm')}</span></div><div class="ft"><span>${sub || '&nbsp;'}</span></div></div>`).join('')}
    </div>
    <section class="pn s-6"><div class="pn-h"><span class="pn-t">${ic('Radar')}Mapa de competências</span><span class="dim" style="font-size:12px">abaixo de 70% pede treino</span></div>
      <div class="pn-b">${o.skills.map((s) => `<div class="comp-row"><span>${esc(s.nm)}</span>${bar(s.v, s.v < 70 ? 'warn' : '')}<b class="num ${s.v < 70 ? 'warn' : ''}" style="text-align:right">${s.v}%</b></div>`).join('')}</div></section>
    <section class="pn s-6"><div class="pn-h"><span class="pn-t">${ic('Lightbulb')}O que treinar agora</span></div>
      <div class="pn-b flush">
        ${weak.map((s) => { const n = o.reviews.filter((r) => r.skill === s.nm).length; return `<div class="list-i"><span class="ico-box warn">${ic('TrendingUp', 'sm')}</span><div class="grow"><b style="font-size:13.5px">${esc(s.nm)} · ${s.v}%</b><div class="dim" style="font-size:12px">${n ? n + ' resposta' + (n > 1 ? 's' : '') + ' desse tema na fila de revisão' : 'Escreva respostas aprovadas para os casos mais comuns'}</div></div><button class="btn sm" data-act="${n ? 'tab' : 'writeAnswer'}" data-v="sdr:rev" data-skill="${esc(s.nm)}">${n ? 'Revisar' : 'Escrever'}</button></div>`; }).join('')}
        ${oldKb.map((k) => `<div class="list-i"><span class="ico-box gold">${ic(k.ic, 'sm')}</span><div class="grow"><b style="font-size:13.5px">${esc(k.nm)}</b><div class="dim" style="font-size:12px">${esc(k.warn || '')}</div></div><button class="btn sm" data-act="tab" data-v="sdr:${k.st === 'old' ? 'play' : 'kb'}">${k.st === 'old' ? 'Atualizar' : 'Validar'}</button></div>`).join('')}
        ${ch && S.org === 'mkt' ? `<div class="list-i"><span class="ico-box gold">${ic('Swords', 'sm')}</span><div class="grow"><b style="font-size:13.5px">Desafio: ${esc(ch.nm)} · ${ch.v} de ${ch.goal}</b><div class="dim" style="font-size:12px">Cada correção de preço aprovada conta. Prêmio: +${ch.xp} XP</div></div>${pill('+' + ch.xp + ' XP', 'gold mono')}</div>` : ''}
      </div></section>
    <section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('SlidersHorizontal')}Modo de operação</span><span class="dim" style="font-size:12px">vale para todas as instâncias em que a ${esc(o.ia.name)} atende</span></div>
      <div class="pn-b"><div class="mode-cards">${MODES.map((m) => `<button class="mode-c ${o.ia.mode === m.id ? 'on' : ''}" data-act="setMode" data-id="${m.id}" aria-pressed="${o.ia.mode === m.id}"><span class="tt">${ic(m.ic, 'sm cy')}${m.nm}${m.id === 'sup' ? pill('Recomendado', 'ok') : ''}</span><span class="dd">${m.d}</span></button>`).join('')}</div>
      <p class="dim" style="font-size:12px;margin-top:10px">Em qualquer modo, as regras fixas valem: nada de prometer resultado, inventar preço ou esconder que é assistente virtual.</p></div></section>
  </div>`;
}
ACT.setMode = (el) => {
  const o = O(), m = MODES.find((x) => x.id === el.dataset.id);
  if (m.id === 'aut' && maturity(o) < 90) toast('Modo autônomo ativado com ressalva', 'A maturidade está em ' + maturity(o) + '%. Recomendado só acima de 90%.', 'warn', 'TriangleAlert');
  else toast('Modo ' + m.nm.toLowerCase() + ' ativado', m.d, '', m.ic);
  o.ia.mode = m.id; rerender();
};

function sdrKb() {
  const o = O(), cat = S.filters.kbcat || '';
  const cats = Array.from(new Set(o.kb.map((k) => k.cat)));
  const stPill = (k) => k.st === 'ok' ? pill('Aprendido', 'ok', 'CircleCheck') : k.st === 'proc' ? pill('Lendo…', 'cy', 'LoaderCircle') : k.st === 'old' ? pill('Desatualizado', 'warn', 'TriangleAlert') : pill('Aguardando validação', 'gold', 'Hourglass');
  return `<div class="grid g-12">
    <section class="pn s-8"><div class="pn-b col" style="gap:12px">
      <div class="drop-zone" id="kbZone">${ic('Upload', 'lg cy')}<div style="margin-top:8px"><b>Arraste PDF, documento, planilha, áudio ou vídeo</b></div><div class="dim" style="font-size:12px;margin-top:4px">Áudio e vídeo são transcritos. A ${esc(o.ia.name)} só usa o que estiver aqui para responder.</div><input type="file" multiple data-chg="kbFiles" aria-label="Enviar arquivos para a base"></div>
      <form class="row wrap" style="gap:8px" data-sub="kbLink"><div class="search grow" style="min-width:200px">${ic('Link')}<input class="in" id="kbUrl" placeholder="Cole o link de um artigo do blog" type="url"></div><button class="btn" type="submit">Adicionar artigo</button><button class="btn" type="button" data-act="writeAnswer">${ic('PenLine', 'sm')}Escrever resposta aprovada</button></form>
    </div></section>
    <section class="pn s-4"><div class="pn-h"><span class="pn-t">${ic('Info')}Como ela usa a base</span></div><div class="pn-b" style="font-size:13px;color:var(--fg-2)"><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
      <li>Cada resposta cita de onde tirou a informação. Você vê isso em Testar.</li><li>Se a resposta não está na base, ela não inventa: passa para humano ou manda para revisão.</li><li>Item desatualizado gera aviso aqui e na Central.</li></ul></div></section>
    <section class="pn s-12">
      <div class="pn-h"><div class="chips"><button class="chip ${!cat ? 'on' : ''}" data-act="kbCat" data-v="">Tudo<span class="n">${o.kb.length}</span></button>${cats.map((c) => `<button class="chip ${cat === c ? 'on' : ''}" data-act="kbCat" data-v="${esc(c)}">${esc(c)}<span class="n">${o.kb.filter((k) => k.cat === c).length}</span></button>`).join('')}</div></div>
      <div class="pn-b flush" style="margin-top:8px">${o.kb.filter((k) => !cat || k.cat === cat).map((k) => `<div class="kb-item"><span class="ico-box ${k.st === 'ok' ? 'cy' : k.st === 'old' ? 'warn' : 'gold'}">${ic(k.ic, 'sm')}</span>
        <div style="min-width:0"><b class="ellipsis" style="display:block;font-size:13.5px">${esc(k.nm)}</b><div class="dim" style="font-size:12px">${esc(k.type)} · ${esc(k.cat)} · ${k.uses ? 'usado em ' + fmt(k.uses) + ' respostas' : 'ainda não usado'} · atualizado em ${esc(k.upd)}</div></div>
        <div class="row" style="gap:8px">${stPill(k)}${k.st === 'pend' ? `<button class="btn xs" data-act="kbValidate" data-id="${k.id}">Validar</button>` : ''}${k.st === 'old' ? `<button class="btn xs" data-act="tab" data-v="sdr:play">Atualizar</button>` : ''}</div></div>`).join('')}</div>
    </section></div>`;
}
ACT.kbCat = (el) => { S.filters.kbcat = el.dataset.v; rerender(); };
function kbAdd(nm, type, icn, cat) {
  const o = O(), k = { id: 'k' + uid(), ic: icn, nm, type, cat, st: 'proc', uses: 0, upd: 'hoje' };
  o.kb.unshift(k);
  setTimeout(() => {
    k.st = 'ok';
    const weak = [...o.skills].sort((a, b) => a.v - b.v)[0]; weak.v = Math.min(99, weak.v + 2);
    toast(o.ia.name + ' aprendeu com "' + nm + '"', 'Competência "' + weak.nm + '" subiu para ' + weak.v + '%.', '', 'BookOpen');
    if (S.route === 'sdr') rerender();
  }, 2400);
}
CHG.kbFiles = (el) => {
  Array.from(el.files || []).forEach((f) => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const map = { pdf: ['FileText', 'PDF'], doc: ['FileText', 'Documento'], docx: ['FileText', 'Documento'], txt: ['FileText', 'Texto'], md: ['FileText', 'Texto'], csv: ['Table', 'Planilha'], xlsx: ['Table', 'Planilha'], mp3: ['FileAudio', 'Áudio · será transcrito'], m4a: ['FileAudio', 'Áudio · será transcrito'], ogg: ['FileAudio', 'Áudio · será transcrito'], mp4: ['FileVideo', 'Vídeo · será transcrito'], mov: ['FileVideo', 'Vídeo · será transcrito'] };
    const [icn, type] = map[ext] || ['File', 'Arquivo'];
    kbAdd(f.name, type + ' · ' + fmt(f.size / 1024, 0) + ' KB', icn, 'Treinamento');
  });
  rerender();
};
SUB.kbLink = () => {
  const u = $('#kbUrl').value.trim();
  if (!u) { toast('Cole um link', 'Ex.: o endereço de um artigo do seu blog.', 'warn', 'Link'); return; }
  let host = u; try { host = new URL(u).hostname; } catch (e) { /* link sem protocolo */ }
  kbAdd('Artigo: ' + host, 'Artigo da web', 'Newspaper', 'Artigo'); rerender();
};
ACT.kbValidate = (el) => { const k = O().kb.find((x) => x.id === el.dataset.id); k.st = 'ok'; k.warn = null; toast('Casos validados', 'A ' + O().ia.name + ' já pode citar esses casos.', '', 'BadgeCheck'); rerender(); };
ACT.writeAnswer = (el) => {
  const o = O(), skill = el && el.dataset ? el.dataset.skill : '';
  openModal(modalHead('Escrever resposta aprovada', 'Vira exemplo de treinamento. A ' + esc(o.ia.name) + ' usa quando aparecer pergunta parecida.') + `
    <form class="modal-b" data-sub="writeAnswer">
      <div class="field"><label for="waQ">Quando o lead perguntar…</label><input class="in" id="waQ" placeholder="Ex.: Vocês fazem só Instagram ou Google também?" autofocus required></div>
      <div class="field"><label for="waA">…a ${esc(o.ia.name)} responde</label><textarea class="ta" id="waA" rows="4" placeholder="Escreva como você responderia no WhatsApp. Curto, uma ideia, uma pergunta." required></textarea></div>
      <div class="field"><label for="waS">Competência</label><select class="sel" id="waS">${o.skills.map((s) => `<option ${s.nm === skill ? 'selected' : ''}>${esc(s.nm)}</option>`).join('')}</select></div>
    </form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="writeAnswer">Salvar e treinar</button></div>`);
};
SUB.writeAnswer = () => {
  const q = $('#waQ').value.trim(), a = $('#waA').value.trim();
  if (!q || !a) { toast('Preencha a pergunta e a resposta', '', 'warn', 'CircleAlert'); return; }
  const o = O(), sk = o.skills.find((s) => s.nm === $('#waS').value);
  sk.v = Math.min(99, sk.v + 3); o.iaStats.approvals++;
  closeOverlay();
  kbAdd('Resposta aprovada: "' + q.slice(0, 48) + (q.length > 48 ? '…' : '') + '"', 'Resposta escrita por ' + ME().short, 'BadgeCheck', 'Objeções');
  gainXP(15, 'Resposta aprovada ensinada à ' + o.ia.name);
  if (sk.nm === 'Objeção de preço') challengeStep('ch1');
  rerender();
};
function challengeStep(id) {
  const ch = DB.game.challenges.find((x) => x.id === id);
  if (!ch || ch.v >= ch.goal) return;
  ch.v++;
  if (ch.v >= ch.goal) setTimeout(() => { toast('Desafio concluído: ' + ch.nm, 'Prêmio liberado.', 'xp lvl', 'Swords'); gainXP(ch.xp, 'Desafio "' + ch.nm + '"'); }, 900);
}

function sdrPlay() {
  const o = O(), P = o.play, k3 = o.kb.find((k) => k.cat === 'Oferta'), stale = k3 && (k3.st === 'old' || k3.st === 'pend');
  const T = (s) => kitText(o, s);
  const msg = (x) => `<div class="quote ia" style="white-space:pre-line;margin:0">${esc(T(x))}</div>`;
  return `<div class="grid g-12">
    <section class="pn s-6"><div class="pn-h"><span class="pn-t">${ic('UserRound')}Persona</span></div>
      <form class="pn-b col" style="gap:14px" data-sub="persona">
        <div class="form-g"><div class="field"><label for="psNm">Nome</label><input class="in" id="psNm" value="${esc(o.ia.name)}"></div>
        <div class="field"><label for="psRole">Função</label><input class="in" id="psRole" value="${esc(o.ia.role)}"></div></div>
        <div class="field"><label for="psHi">Como se apresenta</label><input class="in" id="psHi" value="${esc(T(P.hi))}"></div>
        <div class="field"><label>Tom de voz</label><div class="chips">${['Próximo', 'Direto', 'Sem marketingês', 'Formal', 'Descontraído'].map((t, i) => `<button type="button" class="chip ${i < 3 ? 'on' : ''}" data-act="toggleChip">${t}</button>`).join('')}</div></div>
        <div class="form-g"><div class="field"><label>Tamanho das mensagens</label><div class="seg" data-segname="len"><button type="button" class="on" data-act="segPick">Curtas</button><button type="button" data-act="segPick">Médias</button></div></div>
        <div class="field"><label>Emojis</label><div class="seg"><button type="button" data-act="segPick">Nenhum</button><button type="button" class="on" data-act="segPick">Só na abertura</button><button type="button" data-act="segPick">Livre</button></div></div></div>
        <div><button class="btn pri" type="submit">Salvar persona</button></div>
      </form></section>
    <section class="pn s-6 ${stale ? 'gold-edge' : ''}"><div class="pn-h"><span class="pn-t">${ic('Tag')}Oferta que ela vende</span>${stale ? pill(k3.st === 'pend' ? 'Aguardando sua validação' : '92 dias sem revisão', 'warn', 'TriangleAlert') : pill('Atualizada', 'ok')}</div>
      <form class="pn-b col" style="gap:12px" data-sub="offer">
        <div class="field"><label for="ofNm">Nome</label><input class="in" id="ofNm" value="${esc(o.ia.offer)}" placeholder="Ex.: Diagnóstico gratuito, Demonstração, Orçamento"></div>
        <div class="field"><label for="ofWhat">O que é</label><textarea class="ta" id="ofWhat" rows="3" placeholder="Explique em 2 frases, como você falaria no WhatsApp.">${esc(P.what || '')}</textarea></div>
        ${P.prices && P.prices.length ? `<div class="col" style="gap:6px"><span class="lbl">Preços que ela pode informar</span>${P.prices.map(([nm, v, note, link]) => `<div class="row between" style="font-size:13px;gap:10px"><span>${esc(nm)}${note ? `<span class="dim" style="font-size:12px"> · ${esc(note)}</span>` : ''}${link ? `<br><a class="cy mono" style="font-size:11.5px" href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace('https://', ''))}</a>` : ''}</span><b class="num nowrap">${v ? brl(v) : '—'}</b></div>`).join('')}</div>`
        : `<div class="field"><label for="ofPrice">Investimento</label><input class="in" id="ofPrice" value="${o.ia.price ? brl(o.ia.price) : ''}" placeholder="Deixe em branco se ela não deve falar preço"></div>`}
        <div class="form-g"><div class="field"><label for="ofPay">Pagamento</label><input class="in" id="ofPay" value="${esc(P.pay || '')}" placeholder="Ex.: Pix ou cartão em até 3x"></div>
        <div class="field"><label for="ofCredit">Condição</label><input class="in" id="ofCredit" value="${esc(P.cond || '')}" placeholder="Ex.: valor abatido se fechar"></div></div>
        <div class="row wrap" style="gap:8px"><button class="btn pri" type="submit">Salvar oferta</button>${k3 && k3.st === 'pend' ? `<button class="btn" type="button" data-act="kbValidate" data-id="${k3.id}">${ic('BadgeCheck', 'sm')}Validar oferta</button>` : ''}</div>
      </form></section>
    <section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('ListChecks')}Qualificação</span><span class="dim" style="font-size:12px">${esc(P.qualRule)}</span></div>
      <div class="pn-b"><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
        ${P.qual.map(([k, qq, req]) => `<div class="r-stat col" style="gap:8px"><div class="row between"><b>${esc(k)}</b>${req ? pill('Obrigatório', 'cy') : pill('Sinal indireto', 'line')}</div><p class="muted" style="font-size:12.5px">"${esc(qq)}"</p></div>`).join('')}
      </div><p class="dim" style="font-size:12px;margin-top:10px">${esc(T(P.qualNote))}</p></div></section>
    <div class="s-12 col" style="gap:10px">
      ${acc('sdr-script', ic('MessageCircle', 'sm cy') + 'Roteiro da conversa', pill(o.script.length + ' passos', 'line mono'), `<div class="col" style="gap:16px">${o.script.map(([nm, when, x], i) => `<div class="col" style="gap:6px"><div class="row" style="gap:8px">${pill(String(i + 1), 'cy mono')}<b>${esc(nm)}</b><span class="dim" style="font-size:12px">${esc(when)}</span></div>${msg(x)}</div>`).join('')}</div>`)}
      ${acc('sdr-obj', ic('MessagesSquare', 'sm cy') + 'Objeções e respostas aprovadas', pill(o.objections.length + ' respostas', 'line mono'), `<p class="dim" style="font-size:12.5px;margin-bottom:12px">Concordar, nomear o que a pessoa sente e devolver uma pergunta. Nunca discutir.</p><div class="col" style="gap:14px">${o.objections.map((x) => `<div class="col" style="gap:6px"><div class="quote" style="margin:0"><span class="lbl">Quando disserem</span><div style="margin-top:4px">"${esc(x.q)}"</div></div>${msg(x.a)}</div>`).join('')}</div>`)}
      ${o.diag ? acc('sdr-diag', ic('Stethoscope', 'sm cy') + 'Diagnóstico rápido: o que dizer em cada caso', pill(o.diag.length + ' casos', 'line mono'), `<p class="dim" style="font-size:12.5px;margin-bottom:12px">Sempre como palpite. Do mais grave para o mais leve. Mande o áudio antes do texto.</p><div class="col" style="gap:14px">${o.diag.map(([c, l, a, au], i) => `<div class="col" style="gap:4px"><div class="row" style="gap:8px">${pill(String(i + 1), 'cy mono')}<b>${esc(c)}</b>${au ? pill('áudio ' + au, 'line mono', 'FileAudio') : ''}</div><div style="font-size:13px">${esc(l)}</div><div class="dim" style="font-size:12.5px"><b>Ação de hoje:</b> ${esc(a)}</div></div>`).join('')}</div>`) : ''}
      ${o.audios ? acc('sdr-audios', ic('FileAudio', 'sm cy') + 'Áudios da Rebeca', pill(o.audios.length + ' áudios', 'line mono'), `<div class="col" style="gap:8px">${o.audios.map(([k, nm, when]) => `<div class="row top-a" style="gap:12px;font-size:13px"><b class="mono" style="width:30px;flex:none">${k}</b><span><b>${esc(nm)}</b><br><span class="dim">${esc(when)}</span></span></div>`).join('')}</div>`) : ''}
      ${o.pending ? acc('sdr-pend', ic('ListTodo', 'sm warn') + 'Falta você definir', pill(o.pending.length + ' itens', 'warn mono'), `<div class="col" style="gap:8px">${o.pending.map((x) => `<div class="row top-a" style="gap:8px;font-size:13px"><span class="warn">${ic('Circle', 'xs')}</span>${esc(x)}</div>`).join('')}<p class="dim" style="font-size:12px;margin-top:6px">Enquanto não estiverem definidos, a ${esc(o.ia.name)} não fala desses pontos.</p></div>`) : ''}
      ${P.basePrompt && typeof SDR_BASE_CREDITO !== 'undefined' ? acc('sdr-base', ic('ScrollText', 'sm cy') + 'Instruções e base completa da ' + esc(o.ia.name), pill('versão ' + SDR_BASE_CREDITO.version, 'line mono'), `<span class="lbl">Instruções (prompt de sistema)</span><pre class="base-pre">${esc(SDR_BASE_CREDITO.prompt)}</pre><span class="lbl" style="margin-top:14px;display:block">Base de conhecimento</span><pre class="base-pre">${esc(SDR_BASE_CREDITO.base)}</pre>`) : ''}
      ${acc('sdr-follow', ic('CalendarClock', 'sm cy') + 'Follow-up de quem parou de responder', pill(o.follow.length + ' toques', 'line mono'), `<div class="col" style="gap:10px">${o.follow.map(([d, x]) => `<div class="row top-a" style="gap:12px;font-size:13px"><b class="nowrap" style="width:110px;flex:none">${esc(d)}</b><span>${esc(x)}</span></div>`).join('')}</div>`)}
    </div>
    <section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('Handshake')}O que vai no resumo para ${o.kit && o.kit.startsWith('credito') ? 'a Rebeca' : 'o Closer'}</span></div>
      <div class="pn-b grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">
        ${(P.handoff || []).map((t) => `<label class="row" style="font-size:13px"><span class="sw"><input type="checkbox" checked><span></span></span>${esc(t)}</label>`).join('')}
      </div></section>
  </div>`;
}
ACT.toggleChip = (el) => el.classList.toggle('on');
ACT.segPick = (el) => { $$('button', el.parentElement).forEach((b) => b.classList.toggle('on', b === el)); };
SUB.persona = () => { const n = $('#psNm').value.trim() || O().ia.name; O().ia.name = n; O().ia.role = $('#psRole').value.trim() || O().ia.role; O().play.hi = $('#psHi').value.trim() || O().play.hi; toast('Persona salva', n + ' já responde com o novo jeito.', '', 'UserRound'); rerender(); };
SUB.offer = () => {
  const o = O(), k = o.kb.find((x) => x.cat === 'Oferta');
  o.ia.offer = $('#ofNm').value.trim() || o.ia.offer;
  if ($('#ofPrice')) { const p = parseInt($('#ofPrice').value.replace(/\D/g, ''), 10); o.ia.price = p ? (p > 99999 ? Math.round(p / 100) : p) : 0; }
  o.play.what = $('#ofWhat').value.trim(); o.play.pay = $('#ofPay').value.trim(); o.play.cond = $('#ofCredit').value.trim();
  if (k && !k.kit) { k.st = 'ok'; k.upd = 'hoje'; k.warn = null; }
  const sk = o.skills.find((s) => s.nm === 'Oferta do diagnóstico'); if (sk) sk.v = Math.min(99, sk.v + 4);
  const t = o.tasks.find((x) => /oferta do diagnóstico/i.test(x.t) && !x.done); if (t) t.done = true;
  toast('Oferta atualizada', 'A ' + o.ia.name + ' já usa a nova versão nas próximas conversas.', '', 'Tag');
  rerender();
};

function sdrAf() {
  const o = O(), A = o.autofill, admin = ['Proprietária', 'Gestor'].includes(ME().role);
  if (!A) return `<div class="pn"><div class="empty">${ic('Sparkles')}<div>Preenchimento automático indisponível nesta organização.</div></div></div>`;
  const nameOf = (e) => { const c = o.contacts.find((x) => x.id === e.c); return c ? c.nm : '—'; };
  return `<div class="grid g-12">
    <section class="pn hud s-7"><div class="pn-h"><span class="pn-t">${ic('Sparkles')}Preenchimento automático do CRM</span>${pill(admin ? 'Só proprietária e gestão alteram' : 'Somente leitura', 'line', 'Lock')}</div>
      <div class="pn-b">
        <div class="set-row" style="padding-top:0"><div style="min-width:0"><div class="tt" style="font-size:15px">A ${esc(o.ia.name)} preenche o CRM sozinha</div><div class="dd">Ela lê a conversa do SDR com cada cliente e grava os campos na hora, com o trecho que serviu de prova. Desligue a qualquer momento: ela passa a só sugerir.</div></div>
          <span class="sw" style="transform:scale(1.15)"><input type="checkbox" id="afMaster" ${A.on ? 'checked' : ''} data-chg="afMaster" ${admin ? '' : 'disabled'} aria-label="Preenchimento automático do CRM"><span></span></span></div>
        ${A.on ? '' : `<div class="row top-a" style="padding:10px 12px;border-radius:9px;background:var(--warn-soft);font-size:13px;margin:4px 0 8px"><span class="warn">${ic('PauseCircle', 'sm')}</span><span>Desligado. A ${esc(o.ia.name)} continua lendo as conversas, mas cada campo vira sugestão para uma pessoa aplicar no painel do lead.</span></div>`}
        ${A.fields.map((f) => `<div class="set-row" style="${A.on ? '' : 'opacity:.55'}"><div style="min-width:0"><div class="tt">${esc(f.nm)}</div><div class="dd">${esc(f.d)}</div></div><span class="sw"><input type="checkbox" ${f.on ? 'checked' : ''} data-chg="afField" data-k="${f.k}" ${admin && A.on ? '' : 'disabled'} aria-label="${esc(f.nm)}"><span></span></span></div>`).join('')}
        <div class="set-row"><div><div class="tt">Confiança mínima para gravar sozinha</div><div class="dd">Abaixo de ${A.minConf}%, o campo vira sugestão para uma pessoa aprovar.</div></div><div class="row" style="gap:10px;flex:none;width:200px"><input type="range" min="50" max="99" step="1" value="${A.minConf}" id="afConf" data-inp="afConf" ${admin ? '' : 'disabled'} aria-label="Confiança mínima"><b class="num" style="width:38px;text-align:right">${A.minConf}%</b></div></div>
      </div></section>
    <section class="pn s-5"><div class="pn-h"><span class="pn-t">${ic('ShieldCheck')}Limites</span></div>
      <div class="pn-b col" style="gap:12px">
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div class="r-stat"><span class="lbl">Preenchidos hoje</span><div class="v num">${A.stats.today + A.log.filter((e) => e.fresh).length}</div></div><div class="r-stat"><span class="lbl">Corrigidos por pessoas</span><div class="v num">${A.stats.corrected}</div><span class="dim" style="font-size:11.5px">cada correção treina a ${esc(o.ia.name)}</span></div></div>
        <span class="lbl">Ela nunca preenche</span>
        ${A.never.map((x) => `<div class="row" style="font-size:13px">${ic('Ban', 'sm bad')}${esc(x)}</div>`).join('')}
        <p class="dim" style="font-size:12px">Pagamento confirmado move o negócio pela integração de pagamento, mesmo com o preenchimento desligado.</p>
      </div></section>
    <section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('History')}Histórico de preenchimento</span><span class="dim" style="font-size:12px">tudo que a IA gravou, com o trecho da conversa</span></div>
      <div class="pn-b" style="padding-top:4px"><div class="tbl-w"><table class="tbl"><thead><tr><th>Hora</th><th>Lead</th><th>Campo</th><th>Valor gravado</th><th>Trecho da conversa</th><th class="r">Confiança</th><th>Quem</th><th></th></tr></thead><tbody>
        ${A.log.slice(0, 14).map((e) => `<tr><td class="num dim">${e.t}</td><td class="nowrap">${esc(nameOf(e))}</td><td class="nowrap">${esc(e.nm)}</td><td style="min-width:180px">${esc(e.value)}</td><td style="min-width:200px;color:var(--fg-2);font-style:italic">"${esc(e.quote)}"</td><td class="r num">${e.conf}%</td><td class="nowrap">${e.by === 'ia' ? pill(o.ia.name, 'cy', 'Sparkles') : pill(U(e.by) ? U(e.by).short : '—', 'line')}</td><td class="r">${e.undo ? `<button class="btn xs ghost" data-act="afUndo" data-id="${e.id}">Desfazer</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="dim">Nada preenchido ainda.</td></tr>'}
      </tbody></table></div></div></section>
  </div>`;
}
CHG.afField = (el) => { const f = O().autofill.fields.find((x) => x.k === el.dataset.k); f.on = el.checked; toast(f.nm + (el.checked ? ': a IA preenche' : ': só sugestão'), '', '', 'Sparkles'); markGuide('autofill'); };
INP.afConf = (el) => { O().autofill.minConf = +el.value; rerender(); };

function sdrRegras() {
  const o = O();
  return `<div class="grid g-12">
    <section class="pn s-7"><div class="pn-h"><span class="pn-t">${ic('ShieldCheck')}Regras de conduta</span><span class="dim" style="font-size:12px">${ic('Lock', 'xs')} regra fixa não pode ser desligada</span></div>
      <div class="pn-b flush">${o.rules.map((r, i) => `<div class="rule-i"><span class="sw" style="margin-top:2px"><input type="checkbox" ${r.on ? 'checked' : ''} ${r.lock ? 'disabled' : ''} data-chg="rule" data-i="${i}" aria-label="${esc(r.t)}"><span></span></span><div class="grow"><div class="tt row" style="gap:6px">${esc(r.t)}${r.lock ? ic('Lock', 'xs dim') : ''}</div><div class="dd">${esc(r.d)}</div></div></div>`).join('')}</div></section>
    <section class="pn s-5"><div class="pn-h"><span class="pn-t">${ic('UserCheck')}Chama um humano quando</span></div>
      <div class="pn-b col" style="gap:10px">${o.handoffRules.map((r) => `<div class="row" style="font-size:13px"><span class="ok">${ic('CircleCheck', 'sm')}</span>${esc(r)}</div>`).join('')}
        ${o.sla ? `<div class="row top-a" style="font-size:12.5px;padding:8px 10px;border-radius:8px;background:var(--cy-soft)"><span class="cy">${ic('Timer', 'sm')}</span><span>Ao transferir, o SLA de ${o.sla.transfer} min começa a contar para a equipe. <button class="cy" data-go="equipe" data-tab="sla">Ajustar SLA</button></span></div>` : ''}
        <hr class="sep"><span class="lbl">Horário da equipe</span><div style="font-size:13px">Seg a sex, 8h às 19h · sáb, 9h às 13h</div>
        <p class="dim" style="font-size:12px">Fora do horário, a ${esc(o.ia.name)} continua qualificando e avisa que temas que pedem uma pessoa são respondidos no próximo dia útil.</p></div></section>
  </div>`;
}
CHG.rule = (el) => { const r = O().rules[+el.dataset.i]; r.on = el.checked; toast(r.on ? 'Regra ativada' : 'Regra desativada', r.t, '', 'ShieldCheck'); };

function sdrRev() {
  const o = O();
  if (!o.reviews.length) return `<div class="pn"><div class="empty">${ic('CircleCheck')}<div><b>Fila zerada.</b> A ${esc(o.ia.name)} não tem nada esperando revisão.</div></div></div>`;
  return `<p class="muted" style="margin-bottom:12px">A ${esc(o.ia.name)} manda para cá o que respondeu com pouca confiança ou o que uma regra segurou. Cada correção aprovada vira exemplo de treinamento e vale +15 XP.</p>
  <div class="pn">${o.reviews.map((r) => `<div class="review" id="rev-${r.id}">
    <div class="row wrap between" style="gap:8px"><div class="row" style="gap:8px">${contactAv({ nm: r.who })}<div><b style="font-size:13.5px">${esc(r.who)}</b><div class="dim" style="font-size:12px">${esc(r.co)}</div></div></div>
      <div class="row wrap" style="gap:6px">${pill('Confiança ' + r.conf + '%', r.conf < 55 ? 'bad mono' : 'warn mono')}${r.blocked ? pill('Retida · não chegou ao lead', 'bad', 'ShieldAlert') : pill('Enviada', 'line')}${pill(r.skill, 'cy')}</div></div>
    <div class="quote"><span class="lbl">Lead perguntou</span><div style="margin-top:4px">${esc(r.q)}</div></div>
    <div class="quote ia"><span class="lbl">${esc(o.ia.name)} respondeu</span><div style="margin-top:4px">${esc(r.a)}</div><div class="dim" style="font-size:12px;margin-top:6px">${ic('Info', 'xs')} ${esc(r.why)}</div></div>
    ${S.revOpen === r.id ? `<div class="field"><label for="fix-${r.id}">Resposta ideal</label><textarea class="ta" id="fix-${r.id}" rows="4" placeholder="Escreva como você responderia.">${esc(S.revDraft && S.revDraft[r.id] || '')}</textarea>
      <div class="row wrap" style="gap:8px;margin-top:4px"><button class="btn sm" data-act="revSuggest" data-id="${r.id}">${ic('Sparkles', 'xs')}Usar sugestão do playbook</button><span class="grow"></span><button class="btn sm ghost" data-act="revCancel">Cancelar</button><button class="btn sm pri" data-act="revSave" data-id="${r.id}">${ic('GraduationCap', 'xs')}Salvar e treinar</button></div></div>`
    : `<div class="row wrap" style="gap:8px"><button class="btn sm pri" data-act="revOpen" data-id="${r.id}">${ic('PenLine', 'xs')}Corrigir e treinar</button><button class="btn sm" data-act="revApprove" data-id="${r.id}" ${r.blocked ? 'disabled title="Resposta retida por regra não pode ser aprovada como está"' : ''}>${ic('Check', 'xs')}Aprovar como está</button><button class="btn sm ghost" data-act="revDrop" data-id="${r.id}">Descartar</button></div>`}
  </div>`).join('')}</div>`;
}
ACT.revOpen = (el) => { S.revOpen = el.dataset.id; rerender(); const t = $('#fix-' + el.dataset.id); if (t) t.focus(); };
ACT.revCancel = () => { S.revOpen = null; rerender(); };
ACT.revSuggest = (el) => { const r = O().reviews.find((x) => x.id === el.dataset.id); S.revDraft = S.revDraft || {}; S.revDraft[r.id] = r.ideal; rerender(); const t = $('#fix-' + r.id); if (t) t.focus(); };
function revResolve(id, how, text) {
  const o = O(), i = o.reviews.findIndex((x) => x.id === id), r = o.reviews[i];
  o.reviews.splice(i, 1);
  S.trained = S.trained || {};
  if (how === 'drop') { toast('Revisão descartada', 'Nada foi ensinado.', '', 'Trash2'); rerender(); return; }
  S.trained[id] = text || r.a;
  const sk = o.skills.find((s) => s.nm === r.skill); if (sk) sk.v = Math.min(99, sk.v + 4);
  o.iaStats.approvals++;
  const ach = DB.game.achievements.find((a) => a.nm === 'Treinadora'); if (ach && ach.prog) ach.prog[0]++;
  const ch = o.channels.find((c) => c.id === 'treino');
  if (ch) ch.msgs.push({ u: 'ia', t: nowT(), x: 'Aprendi uma resposta nova aprovada pela @' + ME().short + ': "' + r.q + '"' });
  toast(o.ia.name + ' aprendeu', '"' + r.q + '"' + (sk ? ' · ' + sk.nm + ' foi para ' + sk.v + '%' : ''), '', 'GraduationCap');
  gainXP(15, how === 'fix' ? 'Correção aprovada na ' + o.ia.name : 'Resposta aprovada na ' + o.ia.name);
  if (r.skill === 'Objeção de preço') challengeStep('ch1');
  const t5 = o.tasks.find((t) => t.id === 't5'); if (t5 && !o.reviews.length) t5.done = true;
  markGuide('train');
  S.revOpen = null;
  rerender();
}
ACT.revSave = (el) => { const t = $('#fix-' + el.dataset.id); const v = t ? t.value.trim() : ''; if (!v) { toast('Escreva a resposta ideal', 'Ou use a sugestão do playbook.', 'warn', 'PenLine'); return; } revResolve(el.dataset.id, 'fix', v); };
ACT.revApprove = (el) => revResolve(el.dataset.id, 'ok');
ACT.revDrop = (el) => revResolve(el.dataset.id, 'drop');
document.addEventListener('input', (e) => { if (e.target.id && e.target.id.startsWith('fix-')) { S.revDraft = S.revDraft || {}; S.revDraft[e.target.id.slice(4)] = e.target.value; } });

/* Sandbox: respostas da IA a partir da base e das correções aprovadas */
function iaAnswer(q) {
  const o = O(), t = norm(q), tr = S.trained || {};
  const R = (txt, conf, src, flag) => ({ txt, conf, src, flag });
  const fromReview = (id, fallback) => {
    const r = o.reviews.find((x) => x.id === id);
    if (tr[id]) return R(tr[id], 94, ['Correção aprovada por ' + ME().short]);
    if (r) return R(r.a, r.conf, ['Sem resposta aprovada'], r.blocked ? 'Seria retida por regra e iria para revisão' : 'Confiança baixa · iria para revisão');
    return fallback;
  };
  if (S.org === 'cred') {
    if (/(taxa|juros)/.test(t)) return fromReview('w1', R('A taxa depende da análise do perfil da empresa, então não consigo te passar um número agora.', 92, ['Regras · cuidados legais']));
    if (/(prazo|tempo|quando sai|dias)/.test(t)) return fromReview('w2', R('O prazo depende da análise. Eu te aviso a cada etapa.', 90, ['Regras · cuidados legais']));
    if (/(document|cnpj|rg|cpf)/.test(t)) return R('Documento não é por aqui. A equipe te manda um link seguro para enviar.', 97, ['Regras · LGPD']);
    if (/(robo|ia|humano|pessoa)/.test(t)) return R('Sou a Cibelle, assistente virtual da Lothem Crédito. Se preferir, chamo alguém do time agora.', 99, ['Regras · identificação']);
    return R('Boa pergunta. Vou chamar alguém do time para te responder com cuidado.', 52, ['Sem item na base'], 'Iria para revisão');
  }
  if (/(garant|quantos clientes|resultado)/.test(t)) return fromReview('r1', R('Número de cliente eu não garanto. O que dá pra garantir é o processo do diagnóstico.', 90, ['Objeções']));
  if (/consultoria/.test(t) && /(quanto|preco|valor|custa)/.test(t)) return fromReview('r2', R('Depende do que o diagnóstico mostrar. A Rebeca te passa o valor certo no diagnóstico.', 90, ['Oferta']));
  if (/(parcel|cartao)/.test(t)) return fromReview('r3', R('Dá sim, no cartão em até 3x.', 90, ['Oferta']));
  if (/(fora de|outra cidade|outro estado|online|presencial)/.test(t)) return fromReview('r4', R('Atendemos sim, tudo por videochamada.', 90, ['FAQ']));
  if (/(agencia)/.test(t)) return fromReview('r5', R('Não precisa trocar para fazer o diagnóstico.', 90, ['Objeções']));
  if (/(site|cardapio|logo)/.test(t)) return fromReview('r6', R('Site faz parte de alguns planos.', 90, ['Oferta']));
  if (/(quanto|preco|valor|custa)/.test(t)) return R('O diagnóstico é R$ ' + fmt(o.ia.price) + '. Se depois vocês seguirem com a consultoria, esse valor é abatido.\nAntes, me conta: qual é o seu negócio?', 95, ['Oferta: Diagnóstico Estratégico', 'Roteiro de qualificação']);
  if (/(socio|socia|esposa|marido)/.test(t)) return R('Faz sentido. O que você acha que ele vai perguntar?\nSe quiser, marco o diagnóstico num horário em que vocês dois possam.', 93, ['Objeções frequentes']);
  if (/(pensar|depois|agora nao|sem tempo)/.test(t)) return R('Tranquilo. Geralmente é o preço, o momento ou a dúvida se funciona. Qual dos três pesa mais pra você?', 91, ['Objeções frequentes', 'Áudio: treinamento de abordagem']);
  if (/(como funciona|diagnostico|o que e)/.test(t)) return R('É uma conversa de 60 min com a Rebeca, por videochamada. Ela analisa seu Instagram, seus números e a concorrência, e você sai com um plano de 90 dias.\nQuer ver um horário?', 96, ['Oferta: Diagnóstico Estratégico', 'Vídeo: como a Rebeca conduz o diagnóstico']);
  if (/(robo|\bia\b|humano|pessoa|bot)/.test(t)) return R('Sou a Cibelle, assistente virtual da Lothem. Se preferir falar com alguém do time, eu chamo agora.', 99, ['Regra: dizer que é assistente virtual']);
  if (/(oi|ola|bom dia|boa tarde|boa noite)/.test(t)) return R('Oi! Aqui é a Cibelle, da Lothem 🙂\nMe conta: qual é o seu negócio?', 97, ['Playbook SDR Lothem v3']);
  return R('Essa eu não sei responder com certeza. Vou chamar alguém do time pra te responder certinho.', 41, ['Nada na base sobre isso'], 'Iria para revisão · vale ensinar essa');
}
function sdrTest() {
  const o = O(), hints = o.play.hints;
  return `<div class="grid g-12"><section class="pn s-8"><div class="sandbox">
    <div class="th-h">${av('ia', 'l')}<div class="grow"><b>Conversa de teste com a ${esc(o.ia.name)}</b><div class="dim" style="font-size:12px">Nada sai para o WhatsApp. Escreva como um lead escreveria.</div></div><button class="btn sm ghost" data-act="sbClear">Limpar</button></div>
    <div class="th-body" id="sbBody">${S.sandbox.length ? S.sandbox.map((m) => m.f === 'lead' ? `<div class="msg lead">${esc(m.x)}</div>` : m.f === 'typing' ? '<div class="typing"><i></i><i></i><i></i></div>' : `<div class="msg out"><div class="who">${ic('Bot', 'xs')}${esc(o.ia.name)} · confiança ${m.conf}%</div>${esc(m.x)}<div class="src">${m.src.map((s) => `<span>${esc(s)}</span>`).join('')}</div>${m.flag ? `<div class="warn" style="font-size:11.5px;margin-top:6px">${ic('TriangleAlert', 'xs')} ${esc(m.flag)}</div>` : ''}</div>`).join('') : `<div class="empty" style="margin:auto">${ic('FlaskConical')}<div>Teste uma pergunta abaixo. Depois de treinar uma correção em Revisões, pergunte de novo e compare.</div></div>`}</div>
    <form class="composer" data-sub="sandbox"><div class="sugg">${hints.map((h) => `<button type="button" data-act="sbHint">${esc(h)}</button>`).join('')}</div>
      <div class="row" style="gap:8px"><input class="in grow" id="sbIn" placeholder="Pergunte como um lead perguntaria…" autocomplete="off"><button class="btn pri" type="submit">${ic('Send', 'sm')}</button></div></form>
  </div></section>
  <section class="pn s-4"><div class="pn-h"><span class="pn-t">${ic('Info')}Como ler o teste</span></div><div class="pn-b col" style="gap:10px;font-size:13px;color:var(--fg-2)">
    <p><b class="cy">Confiança</b> abaixo de 70% faz a resposta ir para revisão no modo supervisionado.</p><p><b class="cy">Fontes</b> mostram de onde a resposta saiu. Sem fonte, ela não afirma.</p><p><b class="cy">Antes e depois:</b> pergunte "Vocês garantem resultado?", corrija em Revisões e pergunte de novo.</p></div></section></div>`;
}
SUB.sandbox = () => {
  const el = $('#sbIn'), q = el.value.trim(); if (!q) return;
  S.sandbox.push({ f: 'lead', x: q }, { f: 'typing' });
  el.value = ''; rerender(); scrollSb();
  setTimeout(() => { S.sandbox = S.sandbox.filter((m) => m.f !== 'typing'); const a = iaAnswer(q); S.sandbox.push({ f: 'ia', x: a.txt, conf: a.conf, src: a.src, flag: a.flag }); if (S.route === 'sdr') { rerender(); scrollSb(); } }, 900);
};
function scrollSb() { const b = $('#sbBody'); if (b) b.scrollTop = b.scrollHeight; const i = $('#sbIn'); if (i) i.focus(); }
ACT.sbHint = (el) => { const i = $('#sbIn'); i.value = el.textContent; SUB.sandbox(); };
ACT.sbClear = () => { S.sandbox = []; rerender(); };

/* =========================================================
   CHAT DA EQUIPE
   ========================================================= */
VIEWS.chat = {
  title: 'Chat da equipe',
  crumb: 'Inteligência',
  full: true,
  render() {
    const o = O();
    const all = o.channels.concat(o.dms);
    let ch = all.find((c) => c.id === S.channel) || o.channels[0];
    S.channel = ch.id; ch.unread = 0;
    const isDm = !!ch.u;
    const title = isDm ? U(ch.u).name : '#' + ch.nm;
    const desc = isDm ? U(ch.u).role + ' · ' + U(ch.u).fn : { geral: 'Avisos do dia e comemorações', comercial: 'Leads, campanhas e combinados do time', handoff: 'A ' + o.ia.name + ' publica aqui o resumo de cada lead pronto para o Closer', treino: 'O que a ' + o.ia.name + ' aprendeu e o que ela marcou para revisão' }[ch.id] || '';
    const members = DB.users.filter((u) => u.orgs.includes(S.org));
    return `<div class="tchat ${S.chatSide ? 'show-side' : ''}">
      <aside class="tc-side"><span class="lbl" style="padding:0 10px 6px;display:block">Canais</span>
        ${o.channels.map((c) => `<button class="tc-ch ${c.id === ch.id ? 'on' : ''}" data-act="selCh" data-id="${c.id}">${ic('Hash', 'sm')}${esc(c.nm)}${c.unread ? `<span class="unr">${c.unread}</span>` : ''}</button>`).join('')}
        ${o.dms.length ? `<span class="lbl" style="padding:14px 10px 6px;display:block">Mensagens diretas</span>${o.dms.map((d) => `<button class="tc-ch ${d.id === ch.id ? 'on' : ''}" data-act="selCh" data-id="${d.id}">${av(d.u, 's')}${esc(U(d.u).name)}${d.unread ? `<span class="unr">${d.unread}</span>` : ''}</button>`).join('')}` : ''}
        <div class="dim" style="font-size:11.5px;padding:16px 10px">Mencione um negócio com @ e o nome da empresa. Notas internas das conversas do WhatsApp também avisam por aqui.</div>
      </aside>
      <div class="tc-main">
        <div class="th-h"><button class="iconbtn show-m" data-act="chatSide" aria-label="Canais">${ic('Menu', 'sm')}</button><div class="grow"><b>${esc(title)}</b><div class="dim ellipsis" style="font-size:12.5px">${esc(desc)}</div></div><div class="av-stack hide-m">${members.map((u) => av(u, 's')).join('')}${S.org === 'mkt' ? av('ia', 's') : ''}</div></div>
        <div class="tc-msgs" id="tcBody">${ch.msgs.map((m) => m.day ? `<div class="day-sep">${m.day}</div>` : tmHtml(m)).join('')}</div>
        <form class="composer" data-sub="chat"><div class="row" style="gap:8px"><input class="in grow" id="tcIn" placeholder="Mensagem para ${esc(title)}" autocomplete="off"><button class="btn pri" type="submit">${ic('Send', 'sm')}<span class="hide-m">Enviar</span></button></div></form>
      </div></div>`;
  },
  after() { const b = $('#tcBody'); if (b) b.scrollTop = b.scrollHeight; },
};
function tmHtml(m) {
  const isIa = m.u === 'ia', u = isIa ? null : U(m.u);
  const d = m.deal ? DL(m.deal) : null, c = d ? CT(d.c) : null;
  return `<div class="tm">${av(isIa ? 'ia' : m.u)}<div style="min-width:0"><div class="h"><b>${isIa ? esc(O().ia.name) + ' <span class="pill cy mono" style="height:18px">IA</span>' : esc(u.name)}</b><time>${m.t}</time></div>
    <div class="tx">${mentionify(m.x)}</div>
    ${d ? `<div class="deal-embed"><div class="row between"><div class="row" style="gap:8px">${contactAv(c, 's')}<b style="font-size:13px">${esc(c.nm)} · ${esc(c.co)}</b></div>${pill(STAGE(d.p, d.s).nm, 'cy')}</div>
      ${m.sum ? `<div class="col" style="gap:4px">${m.sum.map(([k, v]) => `<div style="font-size:12.5px"><b>${esc(k)}:</b> <span class="muted">${esc(v)}</span></div>`).join('')}</div>` : ''}
      <div class="row wrap" style="gap:6px"><button class="btn xs" data-act="openDeal" data-id="${d.id}">Abrir negócio</button>${m.pending ? `<button class="btn xs pri" data-act="assignHandoff" data-id="${d.id}">${ic('Handshake', 'xs')}Atribuir ao Caio</button>` : m.assigned ? pill('Atribuído a ' + U(m.assigned).short, 'ok', 'Check') : ''}</div></div>` : ''}
    ${m.react ? `<span class="react">${m.react}</span>` : ''}</div></div>`;
}
ACT.selCh = (el) => { S.channel = el.dataset.id; S.chatSide = false; rerender(); };
ACT.chatSide = () => { S.chatSide = !S.chatSide; rerender(); };
SUB.chat = () => {
  const el = $('#tcIn'), x = el.value.trim(); if (!x) return;
  const o = O(), ch = o.channels.concat(o.dms).find((c) => c.id === S.channel);
  ch.msgs.push({ u: DB.me, t: nowT(), x });
  rerender(); const i = $('#tcIn'); if (i) i.focus();
  if (ch.u) setTimeout(() => { ch.msgs.push({ u: ch.u, t: nowT(), x: 'Combinado, ' + ME().short + '.' }); if (S.route === 'chat' && S.channel === ch.id) { rerender(); const j = $('#tcIn'); if (j) j.focus(); } }, 1600);
};
ACT.assignHandoff = (el) => {
  const d = DL(el.dataset.id), ch = O().channels.find((c) => c.id === 'handoff'), m = ch.msgs.find((x) => x.deal === d.id && x.pending);
  doHandoff(d, 'u2', 9800, (m && m.sum ? m.sum.map(([k, v]) => k + ': ' + v).join('\n') : ''));
};

/* =========================================================
   EVOLUÇÃO (gamificação)
   ========================================================= */
VIEWS.evolucao = {
  title: 'Evolução',
  crumb: 'Inteligência',
  render() {
    const G = DB.game, me = ME(), li = lvlInfo(me), tab = S.tabs.evolucao || 'desafios', m = O().metrics;
    const pace = (DEMO_NOW.day / DEMO_NOW.daysInMonth) * 100;
    const goals = S.org === 'mkt' ? [
      ['Receita do mês', m.done, m.goal, brl(m.done) + ' de ' + brlK(m.goal)],
      ['Diagnósticos vendidos', U('u3').kpi.v, 40, U('u3').kpi.v + ' de 40'],
      ['Consultorias fechadas', parseInt(m.kpis[4].v, 10), 6, m.kpis[4].v + ' de 6'],
      ['Comparecimento nos diagnósticos', 82, 85, '82% · meta 85%', true],
      ['Primeira resposta abaixo de 1 min', 100, 100, '41 s de mediana · cumprida', true],
    ] : S.org === 'cred' ? [['Volume contratado', m.done, m.goal, brlK(m.done) + ' de ' + brlK(m.goal)], ['Perfis analisados', 12, 30, '12 de 30']] : [[m.goalLabel, m.done, m.goal, brl(m.done) + ' de ' + brlK(m.goal)]];
    const tabs = [['desafios', 'Desafios', 'Swords'], ['conquistas', 'Conquistas', 'Award'], ['ranking', 'Ranking', 'ChartNoAxesColumn'], ['regras', 'Como pontuar', 'Scale']];
    return `
    <div class="page-h"><div><h2>Evolução</h2><p>Metas, desafios e conquistas da temporada. A pontuação premia resultado confirmado e consistência, não volume de cliques.</p></div>
      <div class="acts">${pill(G.season.nm + ' · faltam ' + G.season.daysLeft + ' dias', 'gold mono', 'CalendarClock')}</div></div>
    <div class="grid g-12" style="margin-bottom:16px">
      <section class="pn hud gold-edge s-5"><div class="lvl-card">
        <div class="hex">${hexFrame()}<div class="n">${li.L}<small>NÍVEL</small></div></div>
        <div class="col" style="gap:8px;width:100%"><div><h3 style="font-size:20px">${esc(li.tier)}</h3><div class="muted" style="font-size:13px">${esc(me.name)} · ${fmt(me.xp)} XP no total</div></div>
          ${bar(li.p, 'gold')}<div class="row between dim" style="font-size:12px"><span class="num">${fmt(li.cur)} / ${fmt(li.need)} XP</span><span>faltam ${fmt(li.left)} para o nível ${li.L + 1}</span></div>
          <hr class="sep"><div class="row between wrap" style="gap:8px"><div><span class="lbl">Ritmo</span><div style="font-weight:600;margin-top:2px">${G.streak} dias seguidos <span class="dim" style="font-weight:400">· recorde ${G.streakBest}</span></div></div>
          <div class="streak" aria-label="Últimos 14 dias">${Array.from({ length: 14 }, (_, i) => `<i class="${i >= 14 - G.streak ? 'on' : ''}"></i>`).join('')}</div></div>
          <div class="dim" style="font-size:12px">Ritmo = bater o mínimo do dia (tarefas no prazo e leads respondidos). Atraso pausa o ritmo, não tira XP.</div></div>
      </div></section>
      <section class="pn s-7"><div class="pn-h"><span class="pn-t">${ic('Target')}Metas de outubro · equipe</span><span class="dim" style="font-size:12px">traço = onde deveríamos estar hoje</span></div>
        <div class="pn-b col" style="gap:14px">${goals.map(([nm, v, g, lbl, fixed]) => { const p = pct(v, g); const ok = fixed ? p >= 100 : p >= pace; return `<div class="col" style="gap:6px"><div class="row between"><span style="font-weight:500">${nm}</span><span class="row" style="gap:8px"><span class="dim num" style="font-size:12.5px">${lbl}</span>${pill(ok ? (fixed ? 'Cumprida' : 'No ritmo') : 'Atenção', ok ? 'ok' : 'warn')}</span></div>${bar(p, ok ? '' : 'warn', fixed ? null : pace)}</div>`; }).join('')}</div></section>
    </div>
    <div class="tabs" role="tablist">${tabs.map(([id, nm, icn]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="evolucao:${id}" role="tab" aria-selected="${tab === id}">${ic(icn, 'sm')}${nm}</button>`).join('')}</div>
    ${{ desafios: evDesafios, conquistas: evConquistas, ranking: evRanking, regras: evRegras }[tab]()}`;
  },
};
function evDesafios() {
  const G = DB.game, act = G.challenges.filter((c) => c.joined), av2 = G.challenges.filter((c) => !c.joined);
  const card = (c) => { const done = c.v >= c.goal; return `<div class="pn chal ${done ? 'gold-edge' : ''}"><div class="row between top-a"><span class="tt">${esc(c.nm)}</span>${pill('+' + c.xp + ' XP', 'gold mono')}</div>
    <div class="row wrap" style="gap:6px">${pill(c.scope, c.scope === 'Individual' ? 'line' : 'cy', c.scope === 'Individual' ? 'User' : 'Users')}${pill(done ? 'Concluído' : 'Termina em ' + c.left, done ? 'ok' : 'line', done ? 'CircleCheck' : 'Clock')}</div>
    <p class="muted" style="font-size:13px">${esc(c.d)}</p>
    ${c.joined ? `<div class="col" style="gap:6px">${bar(pct(c.v, c.goal), 'gold')}<div class="row between" style="font-size:12.5px"><span class="num">${c.v} de ${c.goal}${c.unit ? ' ' + c.unit : ''}</span>${c.go && !done ? `<button class="btn xs" data-go="${c.go}" data-tab="${c.go === 'sdr' ? 'rev' : ''}" ${c.go === 'funis' ? 'data-pipe="cons"' : ''}>Ir agora ${ic('ArrowRight', 'xs')}</button>` : ''}</div></div>` : `<button class="btn sm pri" data-act="joinCh" data-id="${c.id}">Participar</button>`}</div>`; };
  return `<span class="lbl" style="display:block;margin-bottom:10px">Em andamento</span><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));margin-bottom:20px">${act.map(card).join('')}</div>
    ${av2.length ? `<span class="lbl" style="display:block;margin-bottom:10px">Disponíveis</span><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${av2.map(card).join('')}</div>` : ''}`;
}
ACT.joinCh = (el) => { const c = DB.game.challenges.find((x) => x.id === el.dataset.id); c.joined = true; c.who = DB.me; toast('Você entrou no desafio', c.nm + ' · +' + c.xp + ' XP ao concluir', '', 'Swords'); rerender(); };
function evConquistas() {
  const A = DB.game.achievements, got = A.filter((a) => a.got).length;
  return `<p class="muted" style="margin-bottom:12px">${got} de ${A.length} conquistas. Elas marcam marcos reais do trabalho e ficam no seu perfil.</p>
  <div class="ach-grid">${A.map((a) => { const pr = a.prog; const pv = pr ? (a.inv ? (pr[0] === 0 ? 100 : 0) : pct(pr[0], pr[1])) : 0; return `<div class="pn ach ${a.got ? '' : 'locked'}">
    <div class="emb">${hexFrame(a.got ? 'var(--gold)' : 'var(--fg-3)', a.got ? 'var(--gold-soft)' : 'var(--panel-3)')}<span class="${a.got ? 'gold' : 'dim'}">${ic(a.ic)}</span></div>
    <span class="tier">${a.tier}</span><span class="tt">${esc(a.nm)}</span><span class="dd">${esc(a.d)}</span>
    ${a.got ? `<span class="dim" style="font-size:11.5px">Conquistada em ${a.when}${a.prog ? ' · próximo: ' + a.next : ''}</span>${a.prog ? `<div style="width:100%">${bar(pct(a.prog[0], a.prog[1]), 'gold thin')}<div class="dim num" style="font-size:11px;margin-top:4px">${a.prog[0]} / ${a.prog[1]}</div></div>` : ''}`
      : pr ? `<div style="width:100%">${bar(pv, 'thin')}<div class="dim num" style="font-size:11px;margin-top:4px">${a.inv ? pr[0] + ' negócios parados agora' : pr[0] + (a.unit || '') + ' / ' + pr[1] + (a.unit || '')}</div></div>` : ''}
  </div>`; }).join('')}</div>`;
}
function evRanking() {
  const mode = S.filters.rank || 'ind', pace = (DEMO_NOW.day / DEMO_NOW.daysInMonth) * 100;
  const trend = { u1: -1, u2: -1, u3: 2, u4: 0 };
  let rows;
  if (mode === 'ind') {
    rows = DB.users.filter((u) => u.orgs.includes(S.org)).map((u) => ({ u, p: pct(u.kpi.v, u.kpi.goal) })).sort((a, b) => b.p - a.p);
  }
  const sq = squadScores().sort((a, b) => b.p - a.p);
  return `<div class="row wrap between" style="gap:10px;margin-bottom:12px"><div class="seg"><button class="${mode === 'ind' ? 'on' : ''}" data-act="rankMode" data-v="ind">Individual</button><button class="${mode === 'sq' ? 'on' : ''}" data-act="rankMode" data-v="sq">Squads</button></div>
    <label class="row" style="font-size:13px"><span class="sw"><input type="checkbox" checked data-chg="rankVis"><span></span></span>Mostrar ranking para a equipe</label></div>
  <p class="muted" style="font-size:13px;margin-bottom:12px">Ordenado por % da meta de cada pessoa. Assim SDR, tráfego e Closer competem de forma justa, cada um na sua métrica principal.</p>
  <div class="pn">${mode === 'ind' ? rows.map((r, i) => `<div class="rank-row ${i === 0 ? 'p1' : ''} ${r.u.id === DB.me ? 'me' : ''}"><span class="pos">${i + 1}</span>
      <div class="row" style="min-width:0">${av(r.u)}<div style="min-width:0"><b class="ellipsis" style="display:block">${esc(r.u.name)}${r.u.id === DB.me ? ' <span class="dim" style="font-weight:400">(você)</span>' : ''}</b><div class="dim ellipsis" style="font-size:12px">${esc(r.u.role)} · ${esc(r.u.kpi.nm)}: ${r.u.kpi.v} de ${r.u.kpi.goal}</div></div></div>
      <div class="col hide-m" style="gap:4px">${bar(r.p, r.p >= pace ? '' : 'warn', pace)}</div>
      <b class="num" style="text-align:right">${fmt(r.p, 0)}%</b>
      <span class="hide-m num dim" style="text-align:right;font-size:12px">${trend[r.u.id] > 0 ? '<span class="ok">▲ ' + trend[r.u.id] + '</span>' : trend[r.u.id] < 0 ? '<span class="bad">▼ ' + -trend[r.u.id] + '</span>' : '—'}</span></div>`).join('')
    : sq.map((s, i) => `<div class="rank-row ${i === 0 ? 'p1' : ''}"><span class="pos">${i + 1}</span><div class="row" style="min-width:0"><div class="av-stack">${s.members.map((u) => av(u, 's')).join('')}${s.id === 'aq' ? av('ia', 's') : ''}</div><div style="min-width:0"><b>${esc(s.nm)}</b><div class="dim" style="font-size:12px">${esc(DB.squads[s.id].desc)}</div></div></div><div class="col hide-m">${bar(s.p, s.color === 'gold' ? 'gold' : '', pace)}</div><b class="num" style="text-align:right">${fmt(s.p, 0)}%</b><span class="hide-m"></span></div>`).join('')}</div>
  <p class="dim" style="font-size:12px;margin-top:10px">${ic('Bot', 'xs')} A Cibelle não entra no ranking. O que ela vende conta para o Squad Aquisição, que supervisiona e treina a IA.</p>`;
}
ACT.rankMode = (el) => { S.filters.rank = el.dataset.v; rerender(); };
CHG.rankVis = (el) => toast(el.checked ? 'Ranking visível para a equipe' : 'Ranking só para gestores', el.checked ? 'Todos veem posição e % da meta.' : 'Cada pessoa vê só a própria posição.', '', 'Eye');
function evRegras() {
  const G = DB.game;
  return `<div class="grid g-12"><section class="pn s-7"><div class="pn-h"><span class="pn-t">${ic('Scale')}Tabela de pontos</span></div><div class="pn-b" style="padding-top:4px"><div class="tbl-w"><table class="tbl"><thead><tr><th>Ação</th><th class="r">XP</th><th class="r">Limite</th></tr></thead><tbody>${G.rules.map((r) => `<tr><td>${esc(r.a)}</td><td class="r"><span class="pill gold mono">+${r.xp}</span></td><td class="r dim nowrap">${esc(r.cap)}</td></tr>`).join('')}</tbody></table></div></div></section>
    <section class="pn s-5"><div class="pn-h"><span class="pn-t">${ic('Compass')}Princípios</span></div><div class="pn-b col" style="gap:10px;font-size:13px">
      ${[['Resultado vale mais que atividade', 'Pagamento confirmado e contrato assinado valem muito mais que mover card.'], ['Limite diário', 'Evita pontuar por volume de mensagens ou tarefas criadas só para marcar.'], ['Comparação justa', 'Ranking por % da meta de cada função.'], ['Sem punição', 'XP nunca é retirado. Atraso só pausa o ritmo.'], ['Recompensa real', 'Definida pela gestão, ligada à meta, não a pontos.']].map(([t, d]) => `<div class="row top-a"><span class="cy" style="margin-top:2px">${ic('CircleCheck', 'sm')}</span><div><b>${t}</b><div class="muted">${d}</div></div></div>`).join('')}
      <hr class="sep"><span class="lbl">Recompensas da temporada</span>${G.rewards.map((r) => `<div class="row top-a"><span class="gold">${ic('Gift', 'sm')}</span><div><b>${esc(r.nm)}</b><div class="muted">${esc(r.crit)}</div></div></div>`).join('')}</div></section></div>`;
}

/* =========================================================
   CANAIS: WhatsApp e integrações
   ========================================================= */
VIEWS.canais = {
  title: 'WhatsApp e integrações',
  crumb: 'Conta',
  render() {
    const o = O(), tab = S.tabs.canais || 'inst', lim = DB.billing.usage.find((u) => u.nm === 'Instâncias WhatsApp');
    const tabs = [['inst', 'Instâncias', 'Smartphone', o.instances.length], ['tpl', 'Modelos de mensagem', 'FileText', o.templates.length], ['int', 'Integrações', 'Plug'], ['cmp', 'Oficial ou não oficial?', 'Scale']];
    return `
    <div class="page-h"><div><h2>WhatsApp e integrações</h2><p>Números conectados pela API oficial da Meta ou por QR Code, modelos aprovados e as integrações que alimentam o CRM.</p></div>
      <div class="acts"><button class="btn pri" data-act="newInstance">${ic('Plus', 'sm')}Nova instância</button></div></div>
    <div class="tabs" role="tablist">${tabs.map(([id, nm, icn, n]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="canais:${id}">${ic(icn, 'sm')}${nm}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>
    ${tab === 'inst' ? `<div class="row between wrap" style="gap:8px;margin-bottom:12px"><span class="muted" style="font-size:13px">${lim ? `${o.instances.length} de ${lim.max} instâncias do plano em uso nesta organização.` : ''}</span></div>
      ${o.instances.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${o.instances.map(instCard).join('')}</div>` : `<div class="pn"><div class="empty">${ic('Smartphone')}<div>Nenhum WhatsApp conectado nesta organização.</div><button class="btn pri" style="margin-top:12px" data-act="newInstance">Conectar o primeiro número</button></div></div>`}`
    : tab === 'tpl' ? tplTab() : tab === 'int' ? intTab() : cmpTab()}`;
  },
};
function instCard(i) {
  const on = i.st === 'on', of = i.type === 'oficial', ia = i.agents.includes('ia');
  return `<div class="pn inst ${on ? '' : 'gold-edge'}" style="${on ? '' : 'border-color:color-mix(in srgb,var(--bad) 40%,transparent)'}">
    <div class="inst-h"><span class="ico-box ${on ? 'ok' : 'bad'}">${ic(on ? 'Smartphone' : 'WifiOff', 'sm')}</span><div class="grow"><b>${esc(i.nm)}</b><div class="dim mono" style="font-size:12px">${esc(i.num)}</div></div>${on ? `<span class="pill ok"><span class="dot live"></span>Conectada</span>` : pill('Desconectada', 'bad')}</div>
    <div class="row wrap" style="gap:6px">${of ? pill('API oficial · Cloud API', 'cy', 'BadgeCheck') : pill('Não oficial · QR Code', 'line', 'QrCode')}</div>
    <p class="muted" style="font-size:12.5px">${esc(i.use)}</p>
    <div class="kv"><div><span class="lbl">Qualidade</span><b>${esc(i.quality)}</b></div><div><span class="lbl">Hoje</span><b class="num">${i.today} msgs</b></div><div><span class="lbl">Atendem</span><div class="av-stack" style="margin-top:4px">${i.agents.map((a) => av(a, 's')).join('')}</div></div></div>
    <div class="dim" style="font-size:12px">${ic('Gauge', 'xs')} ${esc(i.tier)}</div>
    <label class="row" style="font-size:13px;${of ? '' : 'opacity:.6'}"><span class="sw"><input type="checkbox" ${ia ? 'checked' : ''} ${of ? '' : 'disabled'} data-chg="instIa" data-id="${i.id}"><span></span></span>${of ? 'A ' + esc(O().ia.name) + ' atende neste número' : 'IA desligada em número não oficial (menos risco de bloqueio)'}</label>
    <div class="row wrap" style="gap:8px">${on ? `<button class="btn sm" data-act="instCfg" data-id="${i.id}">${ic('Settings', 'xs')}Configurar</button>${of ? `<button class="btn sm" data-act="tab" data-v="canais:tpl">Modelos</button>` : `<button class="btn sm ghost" data-act="instOff" data-id="${i.id}">Desconectar</button>`}` : `<button class="btn sm pri" data-act="qr" data-id="${i.id}">${ic('QrCode', 'xs')}Reconectar com QR Code</button>`}</div>
  </div>`;
}
CHG.instIa = (el) => { const i = O().instances.find((x) => x.id === el.dataset.id); if (el.checked && !i.agents.includes('ia')) i.agents.unshift('ia'); if (!el.checked) i.agents = i.agents.filter((a) => a !== 'ia'); toast(el.checked ? O().ia.name + ' ligada em ' + i.nm : O().ia.name + ' desligada em ' + i.nm, el.checked ? 'Ela responde primeiro quem chegar por esse número.' : 'As conversas novas vão direto para a equipe.', '', 'Bot'); rerender(); };
ACT.instCfg = () => toast('Configurações da instância', 'Horário, fila de distribuição, mensagem de ausência e webhook. Na demo, só leitura.', '', 'Settings');
ACT.instOff = (el) => { const i = O().instances.find((x) => x.id === el.dataset.id); i.st = 'off'; toast('Instância desconectada', i.nm, 'warn', 'WifiOff'); rerender(); };
ACT.qr = (el) => {
  const i = O().instances.find((x) => x.id === el.dataset.id);
  const owner = U(i.agents.find((a) => a !== 'ia')) || ME();
  openModal(modalHead('Conectar "' + esc(i.nm) + '"', 'Leia o código com o WhatsApp do celular de ' + esc(owner.short) + '.') + `
    <div class="modal-b"><div class="qr-box"><canvas id="qrCv" width="29" height="29" aria-label="QR Code de demonstração"></canvas>
      <div class="col" style="gap:10px;font-size:13px" id="qrSteps"><div class="row top-a"><span class="pill cy mono">1</span>Abra o WhatsApp no celular</div><div class="row top-a"><span class="pill cy mono">2</span>Toque em Mais opções › Aparelhos conectados</div><div class="row top-a"><span class="pill cy mono">3</span>Toque em Conectar um aparelho e aponte para o código</div>
      <div class="dim" style="font-size:12px" id="qrTimer">O código renova em 45 s</div></div></div>
      <div class="row top-a" style="padding:10px 12px;border-radius:9px;background:var(--warn-soft);font-size:12.5px"><span class="warn">${ic('TriangleAlert', 'sm')}</span><span>Conexão não oficial depende do celular ligado e com internet. Use para conversas 1 a 1 e volume baixo. Disparo em massa por aqui pode bloquear o número.</span></div>
    </div><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="qrScan" data-id="${i.id}" id="qrBtn">${ic('ScanLine', 'sm')}Simular leitura do código</button></div>`);
  drawQr();
  let s = 45; clearInterval(S.qrT);
  S.qrT = setInterval(() => { const t = $('#qrTimer'); if (!t) { clearInterval(S.qrT); return; } s--; if (s <= 0) { s = 45; drawQr(); } t.textContent = 'O código renova em ' + s + ' s'; }, 1000);
};
function drawQr() {
  const cv = $('#qrCv'); if (!cv) return;
  const x = cv.getContext('2d'), n = 29;
  const dark = '#0b1422';
  x.fillStyle = '#fff'; x.fillRect(0, 0, n, n); x.fillStyle = dark;
  let seed = Math.floor(Math.random() * 1e9);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (rnd() > 0.52) x.fillRect(c, r, 1, 1);
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([a, b]) => { x.fillStyle = '#fff'; x.fillRect(a - 1 < 0 ? 0 : a - 1, b - 1 < 0 ? 0 : b - 1, 9, 9); x.fillStyle = dark; x.fillRect(a, b, 7, 7); x.fillStyle = '#fff'; x.fillRect(a + 1, b + 1, 5, 5); x.fillStyle = dark; x.fillRect(a + 2, b + 2, 3, 3); });
}
ACT.qrScan = (el) => {
  const i = O().instances.find((x) => x.id === el.dataset.id), b = $('#qrBtn');
  b.disabled = true; b.innerHTML = ic('LoaderCircle', 'sm') + 'Conectando…';
  $('#qrTimer').textContent = 'Código lido. Sincronizando conversas…';
  setTimeout(() => {
    clearInterval(S.qrT); i.st = 'on'; closeOverlay();
    const t = O().tasks.find((x) => !x.done && /reconectar/i.test(x.t)); if (t) t.done = true;
    const n = DB.notifications.find((x) => x.id === 'n3'); if (n) n.unread = false;
    toast('"' + i.nm + '" conectada', t ? 'A tarefa de reconexão foi concluída sozinha.' : 'Conversas sincronizadas.', '', 'Wifi');
    markGuide('qr'); refreshChrome(); rerender();
  }, 1600);
};
ACT.newInstance = () => {
  closePop();
  const o = O(), lim = DB.billing.usage.find((u) => u.nm === 'Instâncias WhatsApp'), full = lim && lim.v >= lim.max && DB.billing.plan !== 'ag';
  openModal(modalHead('Nova instância de WhatsApp', 'Escolha como conectar o número.') + `
    <div class="modal-b">${full ? `<div class="row top-a" style="padding:10px 12px;border-radius:9px;background:var(--gold-soft);font-size:13px"><span class="gold">${ic('Info', 'sm')}</span><div class="grow">Seu plano usa ${lim.v} de ${lim.max} instâncias. Para conectar mais um número, adicione uma instância extra por ${brl(79)}/mês ou reconecte uma que caiu.<div style="margin-top:8px"><button class="btn xs gold" data-act="addon" data-v="+1 instância WhatsApp">Adicionar instância extra</button></div></div></div>` : ''}
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        <button class="type-c" data-act="pickInst" data-v="oficial"><span class="row" style="gap:8px"><span class="ico-box cy">${ic('BadgeCheck', 'sm')}</span><b>API oficial (Cloud API)</b></span><ul><li>Conecta pelo cadastro da Meta</li><li>Estável e com vários atendentes</li><li>Modelos aprovados para mensagens fora da janela de 24 h</li><li>Recomendada para anúncios e para a SDR IA</li></ul></button>
        <button class="type-c" data-act="pickInst" data-v="qr"><span class="row" style="gap:8px"><span class="ico-box">${ic('QrCode', 'sm')}</span><b>Não oficial (QR Code)</b></span><ul><li>Conecta em 1 minuto lendo o código</li><li>Usa o WhatsApp do próprio celular</li><li>Risco de bloqueio com volume alto</li><li>Para relacionamento 1 a 1</li></ul></button>
      </div></div><div class="modal-f"><button class="btn ghost" data-act="close">Fechar</button></div>`);
};
ACT.pickInst = (el) => {
  const lim = DB.billing.usage.find((u) => u.nm === 'Instâncias WhatsApp');
  if (lim && lim.v >= lim.max && DB.billing.plan !== 'ag') { toast('Limite do plano', 'Adicione uma instância extra ou reconecte a do Caio.', 'warn', 'Info'); return; }
  if (el.dataset.v === 'oficial') { closeOverlay(); toast('Cadastro da Meta', 'Na versão real, abre o cadastro incorporado da Meta para verificar a empresa e o número.', '', 'BadgeCheck'); return; }
  const id = 'i' + uid();
  O().instances.push({ id, nm: 'Novo número', type: 'naooficial', num: '+55 11 90000-0199', st: 'off', quality: '—', tier: 'Limite seguro: 40 novas conversas / dia', today: 0, agents: [DB.me], use: 'Relacionamento 1 a 1.' });
  if (lim) lim.v++;
  ACT.qr({ dataset: { id } });
};
ACT.addon = (el) => {
  const lim = DB.billing.usage.find((u) => u.nm === (el.dataset.v.includes('instância') ? 'Instâncias WhatsApp' : 'Conversas da SDR IA'));
  if (lim) lim.max += el.dataset.v.includes('instância') ? 1 : 1000;
  closeOverlay(); toast('Adicional contratado', el.dataset.v + ' · cobrado proporcionalmente na próxima fatura.', '', 'CreditCard');
  rerender();
};
function tplTab() {
  const o = O();
  const stc = (s) => s === 'Aprovado' ? 'ok' : s === 'Em análise' ? 'warn' : 'bad';
  return `<div class="row between wrap" style="gap:8px;margin-bottom:12px"><p class="muted" style="font-size:13px;max-width:70ch">Fora da janela de 24 horas, a API oficial só envia modelos aprovados pela Meta. Lembretes e confirmações costumam entrar como Utilidade.</p><button class="btn" data-act="newTpl">${ic('Plus', 'sm')}Novo modelo</button></div>
  <div class="pn"><div class="tbl-w"><table class="tbl"><thead><tr><th>Nome</th><th>Categoria</th><th>Status</th><th>Texto</th></tr></thead><tbody>${o.templates.map((t) => `<tr><td class="mono nowrap" style="font-size:12.5px">${esc(t.nm)}</td><td>${esc(t.cat)}</td><td>${pill(t.st, stc(t.st))}${t.why ? `<div class="bad" style="font-size:11.5px;margin-top:4px">${esc(t.why)}</div>` : ''}</td><td style="min-width:280px;color:var(--fg-2)">${esc(t.body)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
ACT.newTpl = () => {
  openModal(modalHead('Novo modelo de mensagem', 'Vai para análise da Meta. Use {{1}}, {{2}} para os campos variáveis.') + `<form class="modal-b" data-sub="newTpl">
    <div class="form-g"><div class="field"><label for="tpN">Nome</label><input class="in mono" id="tpN" placeholder="lembrete_diagnostico_1h" required autofocus></div><div class="field"><label for="tpC">Categoria</label><select class="sel" id="tpC"><option>Utilidade</option><option>Marketing</option></select></div></div>
    <div class="field"><label for="tpB">Texto</label><textarea class="ta" id="tpB" rows="4">Oi, {{1}}! Seu diagnóstico começa em 1 hora. O link é este: {{2}}</textarea></div></form>
    <div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="newTpl">Enviar para análise</button></div>`);
};
SUB.newTpl = () => { const n = $('#tpN').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'); if (!n) return; O().templates.unshift({ nm: n, cat: $('#tpC').value, st: 'Em análise', lang: 'pt_BR', body: $('#tpB').value }); closeOverlay(); toast('Modelo enviado para análise', 'A Meta costuma responder em minutos ou poucas horas.', '', 'FileText'); rerender(); };
function intTab() {
  return `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${O().integrations.map((it, i) => `<div class="pn integ"><span class="lg">${it.lg}</span><div class="grow"><b>${esc(it.nm)}</b><div class="muted" style="font-size:12.5px">${esc(it.d)}</div></div><span class="sw"><input type="checkbox" ${it.st === 'on' ? 'checked' : ''} data-chg="integ" data-i="${i}" aria-label="${esc(it.nm)}"><span></span></span></div>`).join('')}</div>`;
}
CHG.integ = (el) => { const it = O().integrations[+el.dataset.i]; it.st = el.checked ? 'on' : 'off'; toast(it.nm + (el.checked ? ' ligada' : ' desligada'), '', '', 'Plug'); };
function cmpTab() {
  const rows = [
    ['Como conecta', 'Cadastro na Meta com empresa verificada', 'Lendo o QR Code com o celular'],
    ['Estabilidade', 'Alta. Não depende de celular ligado', 'Depende do celular com bateria e internet'],
    ['Risco de bloqueio', 'Baixo, seguindo as políticas da Meta', 'Maior, principalmente com volume alto'],
    ['Mensagem fora da janela de 24 h', 'Só com modelo aprovado', 'Livre, mas aumenta o risco'],
    ['SDR IA e automações', 'Liberado', 'Desligado por padrão'],
    ['Vários atendentes no mesmo número', 'Sim', 'Sim, pelo CRM'],
    ['Custo', 'A Meta cobra por mensagem de modelo enviada. Respostas dentro da janela de atendimento não são cobradas. Confira a tabela atual da Meta.', 'Sem cobrança da Meta'],
    ['Quando usar', 'Leads de anúncio, SDR IA, lembretes e confirmações', 'Relacionamento 1 a 1 e prospecção com volume baixo'],
  ];
  return `<div class="pn"><div class="tbl-w"><table class="tbl"><thead><tr><th></th><th>${ic('BadgeCheck', 'xs cy')} API oficial</th><th>${ic('QrCode', 'xs')} Não oficial</th></tr></thead><tbody>${rows.map(([k, a, b]) => `<tr><td><b>${k}</b></td><td style="min-width:220px">${esc(a)}</td><td style="min-width:220px;color:var(--fg-2)">${esc(b)}</td></tr>`).join('')}</tbody></table></div></div>
  <p class="dim" style="font-size:12px;margin-top:10px">Recomendação da Lothem: anúncio e IA sempre na oficial. A não oficial fica para conversas pessoais de quem já é cliente.</p>`;
}

/* =========================================================
   EQUIPE E ACESSOS
   ========================================================= */
VIEWS.equipe = {
  title: 'Equipe e acessos',
  crumb: 'Conta',
  render() {
    const tab = S.tabs.equipe || 'pessoas', seats = DB.billing.usage.find((u) => u.nm === 'Usuários');
    const tabs = [['pessoas', 'Pessoas', 'Users', DB.users.length], ['conv', 'Convites', 'Send', DB.invites.length], ['perm', 'Permissões', 'Lock'], ['sla', 'SLA de atendimento', 'Timer'], ['squads', 'Squads', 'Users2']];
    return `
    <div class="page-h"><div><h2>Equipe e acessos</h2><p>Quem entra, com qual função e o que cada função pode ver ou mudar. Uma pessoa pode ter funções diferentes em cada organização.</p></div>
      <div class="acts"><button class="btn pri" data-act="inviteUser">${ic('Send', 'sm')}Convidar pessoa</button></div></div>
    <div class="pn" style="padding:12px 16px;margin-bottom:16px"><div class="row between wrap" style="gap:8px"><span style="font-size:13px"><b class="num">${seats.v} de ${seats.max}</b> lugares do plano em uso · ${esc(seats.note)}</span><button class="btn xs ghost" data-go="planos">Ver plano</button></div><div style="margin-top:8px">${bar(pct(seats.v, seats.max))}</div></div>
    <div class="tabs" role="tablist">${tabs.map(([id, nm, icn, n]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="equipe:${id}">${ic(icn, 'sm')}${nm}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>
    ${{ pessoas: eqPessoas, conv: eqConvites, perm: eqPerm, sla: eqSla, squads: eqSquads }[tab]()}`;
  },
};
function eqPessoas() {
  return `<div class="pn"><div class="tbl-w"><table class="tbl"><thead><tr><th>Pessoa</th><th>Função</th><th>Squad</th><th>Organizações</th><th>Verificação em 2 etapas</th><th>Último acesso</th><th></th></tr></thead><tbody>
    ${DB.users.map((u) => `<tr><td><div class="row">${av(u)}<div><b>${esc(u.name)}</b>${u.id === DB.me ? ' <span class="dim">(você)</span>' : ''}<div class="dim" style="font-size:12px">${esc(u.email)}</div></div></div></td>
      <td>${pill(u.role, u.role === 'Proprietária' ? 'gold' : 'cy')}</td><td>${esc(DB.squads[u.squad].name)}</td>
      <td><div class="row" style="gap:4px">${u.orgs.map((id) => orgBadge(DB.orgs[id], 24)).join('')}</div></td>
      <td>${u.twofa ? pill('Ativa', 'ok', 'ShieldCheck') : pill('Desligada', 'warn', 'ShieldAlert')}</td><td class="dim nowrap">${esc(u.last)}</td>
      <td class="r">${u.id === DB.me ? '' : `<button class="btn xs" data-act="editUser" data-id="${u.id}">Editar</button>`}</td></tr>`).join('')}
    <tr><td><div class="row">${av('ia')}<div><b>${Object.values(DB.orgs).map((o) => esc(o.ia.name)).filter((v, i, a) => a.indexOf(v) === i).join(' e ')}</b><div class="dim" style="font-size:12px">Assistentes de IA, uma por organização</div></div></div></td><td>${pill('SDR IA', 'line')}</td><td>Squad Aquisição</td><td><div class="row" style="gap:4px">${Object.values(DB.orgs).map((o) => orgBadge(o, 24)).join('')}</div></td><td class="dim">—</td><td class="dim">sempre on-line</td><td class="r dim" style="font-size:12px">não ocupa lugar</td></tr>
  </tbody></table></div></div>`;
}
ACT.editUser = (el) => {
  const u = U(el.dataset.id);
  openModal(modalHead('Editar ' + esc(u.name), 'Mudanças valem no próximo acesso.') + `<form class="modal-b" data-sub="editUser" data-id="${u.id}"><div class="form-g">
    <div class="field"><label for="euRole">Função</label><select class="sel" id="euRole">${DB.roles.filter((r) => r !== 'Proprietária').map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label for="euSq">Squad</label><select class="sel" id="euSq">${Object.entries(DB.squads).map(([k, s]) => `<option value="${k}" ${k === u.squad ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field full"><label>Organizações</label><div class="col" style="gap:8px">${Object.values(DB.orgs).map((o) => `<label class="row" style="font-size:13px"><input type="checkbox" name="euOrg" value="${o.id}" ${u.orgs.includes(o.id) ? 'checked' : ''}>${esc(o.short)}</label>`).join('')}</div></div>
  </div></form><div class="modal-f"><button class="btn danger" data-act="deactUser" data-id="${u.id}" style="margin-right:auto">Desativar acesso</button><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="editUser">Salvar</button></div>`);
};
SUB.editUser = (f) => {
  const u = U(f.dataset.id);
  u.role = $('#euRole').value; u.squad = $('#euSq').value;
  const orgs = $$('input[name=euOrg]:checked', f).map((x) => x.value); if (orgs.length) u.orgs = orgs;
  Object.values(DB.orgs).forEach((o) => { o.members = DB.users.filter((x) => x.orgs.includes(o.id)).map((x) => x.id); });
  closeOverlay(); toast('Acesso atualizado', u.name + ' · ' + u.role, '', 'UserCog'); rerender();
};
ACT.deactUser = (el) => {
  const u = U(el.dataset.id);
  openModal(modalHead('Desativar o acesso de ' + esc(u.short) + '?', 'A pessoa sai na hora. Contatos e negócios dela passam para você.') + `<div class="modal-f" style="padding-top:18px"><button class="btn ghost" data-act="close">Manter acesso</button><button class="btn danger" data-act="deactConfirm" data-id="${u.id}">Desativar</button></div>`);
};
ACT.deactConfirm = (el) => { const u = U(el.dataset.id); u.status = 'inativo'; u.last = 'desativado agora'; closeOverlay(); toast('Acesso desativado', u.name + ' não consegue mais entrar.', 'warn', 'Ban'); rerender(); };
function eqConvites() {
  return `<div class="grid g-12"><section class="pn s-8">${DB.invites.length ? DB.invites.map((v) => `<div class="list-i"><span class="ico-box cy">${ic('Mail', 'sm')}</span><div class="grow"><b style="font-size:13.5px">${esc(v.email)}</b><div class="dim" style="font-size:12px">${esc(v.role)} · ${esc(DB.squads[v.squad].name)} · ${v.orgs.map((id) => DB.orgs[id].short).join(', ')} · enviado ${esc(v.sent)} · ${esc(v.expires)}</div></div>
      <div class="row wrap" style="gap:6px"><button class="btn xs" data-act="invResend" data-id="${v.id}">Reenviar</button><button class="btn xs" data-act="copy" data-v="https://nucleo.lothem.com.br/convite/${v.id}">Copiar link</button><button class="btn xs ghost" data-act="invCancel" data-id="${v.id}">Cancelar</button></div></div>`).join('') : `<div class="empty">${ic('Send')}<div>Nenhum convite pendente.</div></div>`}</section>
    <section class="pn s-4"><div class="pn-h"><span class="pn-t">${ic('Link')}Link de convite aberto</span></div><div class="pn-b col" style="gap:10px"><p class="muted" style="font-size:13px">Quem tiver o link entra como Leitor e você aprova depois. Desligado por segurança.</p><label class="row" style="font-size:13px"><span class="sw"><input type="checkbox" data-chg="openLink"><span></span></span>Permitir entrada pelo link</label></div></section></div>`;
}
CHG.openLink = (el) => toast(el.checked ? 'Link aberto ativado' : 'Link aberto desativado', el.checked ? 'Novas pessoas entram como Leitor e esperam sua aprovação.' : '', '', 'Link');
ACT.invResend = (el) => { const v = DB.invites.find((x) => x.id === el.dataset.id); v.sent = 'agora'; v.expires = 'expira em 7 dias'; toast('Convite reenviado', v.email, '', 'Send'); rerender(); };
ACT.invCancel = (el) => { const i = DB.invites.findIndex((x) => x.id === el.dataset.id); const v = DB.invites.splice(i, 1)[0]; DB.billing.usage[0].v--; toast('Convite cancelado', v.email, '', 'X'); rerender(); };
ACT.inviteUser = () => {
  closePop();
  openModal(modalHead('Convidar para a equipe', 'A pessoa recebe um e-mail com o link de acesso. O convite vale por 7 dias.') + `<form class="modal-b" data-sub="invite"><div class="form-g">
    <div class="field full"><label for="ivE">E-mail</label><input class="in" id="ivE" type="email" placeholder="nome@empresa.com.br" required autofocus><span class="hint">Para convidar várias pessoas, separe os e-mails por vírgula.</span></div>
    <div class="field"><label for="ivR">Função</label><select class="sel" id="ivR">${DB.roles.filter((r) => r !== 'Proprietária').map((r) => `<option ${r === 'Closer' ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label for="ivS">Squad</label><select class="sel" id="ivS">${Object.entries(DB.squads).map(([k, s]) => `<option value="${k}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field full"><label>Organizações</label><div class="row wrap" style="gap:14px">${Object.values(DB.orgs).map((o) => `<label class="row" style="font-size:13px"><input type="checkbox" name="ivO" value="${o.id}" ${o.id === S.org ? 'checked' : ''}>${esc(o.short)}</label>`).join('')}</div></div>
    <div class="field full"><label for="ivM">Mensagem (opcional)</label><textarea class="ta" id="ivM" rows="2" placeholder="Ex.: Bem-vinda ao time! Começa na segunda."></textarea></div>
  </div></form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="invite">${ic('Send', 'sm')}Enviar convite</button></div>`);
};
SUB.invite = (f) => {
  const emails = $('#ivE').value.split(',').map((x) => x.trim()).filter(Boolean);
  const bad = emails.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (!emails.length || bad.length) { toast('Confira o e-mail', bad.length ? bad.join(', ') + ' não parece um e-mail válido.' : 'Digite pelo menos um e-mail.', 'warn', 'CircleAlert'); return; }
  const seats = DB.billing.usage[0];
  if (seats.v + emails.length > seats.max) { toast('Sem lugares livres no plano', 'Você tem ' + (seats.max - seats.v) + ' lugar(es). Suba de plano ou cancele um convite.', 'warn', 'Users'); return; }
  const orgs = $$('input[name=ivO]:checked', f).map((x) => x.value);
  emails.forEach((e) => DB.invites.unshift({ id: 'inv' + uid(), email: e, role: $('#ivR').value, squad: $('#ivS').value, orgs: orgs.length ? orgs : [S.org], sent: 'agora', expires: 'expira em 7 dias', by: DB.me }));
  seats.v += emails.length;
  closeOverlay(); S.tabs.equipe = 'conv';
  toast(emails.length > 1 ? emails.length + ' convites enviados' : 'Convite enviado', emails.join(', '), '', 'Send');
  markGuide('invite');
  if (S.route === 'equipe') rerender(); else go('equipe', { tab: 'conv' });
};
function eqPerm() {
  const lv = (v) => (v === '—' ? 'none' : v);
  return `<p class="muted" style="font-size:13px;margin-bottom:12px">Clique para trocar o nível: Total → Editar → Ver → Sem acesso. A coluna da proprietária não muda.</p>
  <div class="pn"><div class="tbl-w"><table class="tbl perm"><thead><tr><th>Área</th>${DB.roles.map((r) => `<th class="c">${r}</th>`).join('')}</tr></thead><tbody>
    ${DB.modules.map((m, mi) => `<tr><td class="nowrap">${esc(m.nm)}</td>${m.p.map((v, ri) => `<td class="c"><button class="perm-b ${lv(v)} ${ri === 0 ? 'locked' : ''}" data-act="${ri === 0 ? 'noop' : 'perm'}" data-m="${mi}" data-r="${ri}" aria-label="${esc(m.nm)} · ${DB.roles[ri]}: ${v === '—' ? 'sem acesso' : v}">${v === '—' ? '—' : v}</button></td>`).join('')}</tr>`).join('')}
  </tbody></table></div></div>
  <div class="pn" style="margin-top:14px"><div class="pn-h"><span class="pn-t">${ic('Eye')}Alcance dos dados</span></div><div class="tbl-w"><table class="tbl perm"><tbody>${DB.scopes.map((s, si) => `<tr><td>${esc(s.nm)}</td>${s.roles.map((on, ri) => `<td class="c"><span class="sw"><input type="checkbox" ${on ? 'checked' : ''} ${ri === 0 ? 'disabled' : ''} data-chg="scope" data-s="${si}" data-r="${ri}" aria-label="${esc(s.nm)} · ${DB.roles[ri]}"><span></span></span></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
ACT.perm = (el) => {
  const order = ['total', 'editar', 'ver', '—'], m = DB.modules[+el.dataset.m], r = +el.dataset.r;
  m.p[r] = order[(order.indexOf(m.p[r]) + 1) % order.length];
  rerender(); toast('Permissão salva', DB.roles[r] + ' · ' + m.nm + ': ' + (m.p[r] === '—' ? 'sem acesso' : m.p[r]), '', 'Lock');
  markGuide('invite');
};
CHG.scope = (el) => { DB.scopes[+el.dataset.s].roles[+el.dataset.r] = el.checked; toast('Alcance atualizado', DB.roles[+el.dataset.r] + ' · ' + DB.scopes[+el.dataset.s].nm, '', 'Eye'); };
function eqSla() {
  const o = O(), L = o.sla, admin = ['Proprietária', 'Gestor'].includes(ME().role);
  if (!L) return `<div class="pn"><div class="empty">${ic('Timer')}<div>Esta organização ainda não tem SLA.</div><button class="btn pri" style="margin-top:12px" data-act="slaCreate">Criar SLA padrão</button></div></div>`;
  const live = o.conversations.map((c) => ({ c, si: slaInfo(c) })).filter((x) => x.si);
  const rows = [
    ['primeira', 'Primeira resposta humana', 'Lead novo em número sem IA, ou com a IA no modo copiloto.', 'min'],
    ['transfer', 'Transferência da IA', 'Lead que pediu para falar com uma pessoa ou que a IA passou para o time.', 'min'],
    ['retorno', 'Retorno durante a conversa', 'O lead respondeu e está esperando a próxima mensagem do time.', 'min'],
    ['followup', 'Follow-up de lead parado', 'Conversa sem nenhuma mensagem nossa depois do último contato.', 'h'],
  ];
  return `<div class="grid g-12">
    <section class="pn hud s-7"><div class="pn-h"><span class="pn-t">${ic('Timer')}Tempos de resposta do SDR</span>${admin ? pill('Só proprietária e gestão alteram', 'line', 'Lock') : pill('Somente leitura', 'line', 'Lock')}</div>
      <div class="pn-b">${rows.map(([k, t, d, unit]) => `<div class="set-row"><div style="min-width:0"><div class="tt">${t}</div><div class="dd">${d}</div></div>
        <div class="row" style="gap:6px;flex:none"><input class="in num" type="number" min="1" max="${unit === 'h' ? 168 : 240}" id="sla-${k}" value="${L[k]}" data-chg="slaNum" data-k="${k}" style="width:84px;text-align:right" ${admin ? '' : 'disabled'} aria-label="${t} em ${unit === 'h' ? 'horas' : 'minutos'}"><span class="dim" style="width:28px">${unit}</span></div></div>`).join('')}
        <div class="set-row"><div><div class="tt">Alerta antes de estourar</div><div class="dd">O SDR recebe um aviso quando ${L.warnAt}% do tempo já passou.</div></div><div class="row" style="gap:10px;flex:none;width:200px"><input type="range" min="50" max="95" step="5" value="${L.warnAt}" id="sla-warn" data-inp="slaWarn" ${admin ? '' : 'disabled'} aria-label="Momento do alerta"><b class="num" style="width:38px;text-align:right">${L.warnAt}%</b></div></div>
        <div class="set-row"><div><div class="tt">Contar só no horário comercial</div><div class="dd">Seg a sex, 8h às 19h · sáb, 9h às 13h. Fora disso, o relógio para.</div></div><span class="sw"><input type="checkbox" ${L.business ? 'checked' : ''} data-chg="slaBool" data-k="business" ${admin ? '' : 'disabled'} aria-label="Contar só no horário comercial"><span></span></span></div>
        <div class="set-row"><div><div class="tt">Vale para as funções</div><div class="dd">Quem tem o relógio correndo nas conversas atribuídas.</div></div><div class="chips">${['SDR', 'Closer', 'Gestor', 'Proprietária'].map((r) => `<button class="chip ${L.roles.includes(r) ? 'on' : ''}" data-act="slaRole" data-v="${r}" ${admin ? '' : 'disabled'}>${r}</button>`).join('')}</div></div>
      </div></section>
    <section class="pn s-5"><div class="pn-h"><span class="pn-t">${ic('Siren')}Quando o tempo estoura</span></div>
      <div class="pn-b">
        <div class="set-row"><div><div class="tt">Avisar a pessoa responsável</div><div class="dd">Sempre ligado.</div></div><span class="sw"><input type="checkbox" checked disabled aria-label="Avisar a pessoa responsável"><span></span></span></div>
        <div class="set-row"><div><div class="tt">Avisar a gestão</div><div class="dd">Notificação para proprietária e gestores.</div></div><span class="sw"><input type="checkbox" ${L.notifyBoss ? 'checked' : ''} data-chg="slaBool" data-k="notifyBoss" ${admin ? '' : 'disabled'} aria-label="Avisar a gestão"><span></span></span></div>
        <div class="set-row"><div><div class="tt">Passar o lead para outra pessoa</div><div class="dd">Vai para o próximo da função, com o relógio zerado.</div></div><span class="sw"><input type="checkbox" ${L.redistribute ? 'checked' : ''} data-chg="slaBool" data-k="redistribute" ${admin ? '' : 'disabled'} aria-label="Passar o lead para outra pessoa"><span></span></span></div>
        <div class="set-row"><div><div class="tt">${esc(o.ia.name)} manda mensagem de espera</div><div class="dd">Só em número da API oficial. Avisa o lead que alguém já vai responder.</div></div><span class="sw"><input type="checkbox" ${L.iaHold ? 'checked' : ''} data-chg="slaBool" data-k="iaHold" ${admin ? '' : 'disabled'} aria-label="Mensagem de espera da IA"><span></span></span></div>
        <hr class="sep" style="margin:10px 0"><span class="lbl">Relógios correndo agora</span>
        <div class="col" style="gap:8px;margin-top:10px">${live.length ? live.map(({ c }) => `<button class="row between" data-go="atendimento" data-cv="${c.id}" style="padding:8px 10px;border:1px solid var(--line);border-radius:9px;text-align:left"><span class="row" style="gap:8px;min-width:0">${contactAv(CT(c.c), 's')}<span class="ellipsis">${esc(CT(c.c).nm)}</span></span>${slaChip(c)}</button>`).join('') : '<span class="dim" style="font-size:13px">Nenhum lead esperando resposta.</span>'}</div>
      </div></section>
    <section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('ChartColumn')}Cumprimento do SLA · 30 dias</span><span class="dim" style="font-size:12px">conta pontos na Evolução</span></div>
      <div class="pn-b" style="padding-top:4px"><div class="tbl-w"><table class="tbl"><thead><tr><th>Pessoa</th><th class="r">Conversas</th><th>Dentro do SLA</th><th class="r">Tempo médio de resposta</th><th class="r">Estouros</th></tr></thead><tbody>
        ${(o.slaStats || []).map((r) => { const isIa = r.u === 'ia'; const nm = isIa ? o.ia.name + ' (IA)' : U(r.u).name; return `<tr><td><div class="row">${av(isIa ? 'ia' : r.u, 's')}${esc(nm)}</div></td><td class="r num">${r.convs}</td><td style="min-width:180px"><div class="row" style="gap:10px"><div class="grow">${bar(r.inSla, r.inSla >= 95 ? 'ok' : r.inSla >= 90 ? '' : 'warn')}</div><b class="num" style="width:40px;text-align:right">${r.inSla}%</b></div></td><td class="r num nowrap">${r.avg}</td><td class="r num ${r.breaches > 5 ? 'warn' : ''}">${r.breaches}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="dim" style="font-size:12px;margin-top:10px">Responder dentro do SLA vale +5 XP. Fora do SLA não tira ponto: o lead conta como atendido e o estouro fica registrado aqui.</p></div></section>
  </div>`;
}
CHG.slaNum = (el) => {
  const L = O().sla, k = el.dataset.k, n = Math.max(1, Math.min(+el.max || 240, parseInt(el.value, 10) || L[k]));
  L[k] = n; S.slaSeen = {}; slaTick();
  toast('SLA atualizado', SLA_TYPES[k] ? SLA_TYPES[k] + ': ' + n + ' min. Os relógios abertos já usam o novo tempo.' : 'Follow-up: ' + n + ' h.', '', 'Timer');
  markGuide('sla'); rerender();
};
INP.slaWarn = (el) => { O().sla.warnAt = +el.value; rerender(); };
CHG.slaBool = (el) => { O().sla[el.dataset.k] = el.checked; toast('SLA atualizado', el.closest('.set-row').querySelector('.tt').textContent + (el.checked ? ': ligado' : ': desligado'), '', 'Timer'); markGuide('sla'); };
ACT.slaRole = (el) => { const L = O().sla, r = el.dataset.v; L.roles = L.roles.includes(r) ? L.roles.filter((x) => x !== r) : L.roles.concat(r); rerender(); };
ACT.slaCreate = () => { O().sla = { primeira: 5, transfer: 10, retorno: 15, followup: 24, warnAt: 80, business: true, notifyBoss: true, redistribute: false, iaHold: true, roles: ['SDR'] }; O().slaStats = []; toast('SLA padrão criado', 'Ajuste os tempos como quiser.', '', 'Timer'); rerender(); };

function eqSquads() {
  return `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${squadScores().map((s) => `<div class="pn inst"><div class="row between"><b style="font-family:var(--f-display);font-size:16px">${esc(s.nm)}</b>${pill(fmt(s.p, 0) + '% da meta', s.color === 'gold' ? 'gold' : 'cy')}</div><p class="muted" style="font-size:13px">${esc(DB.squads[s.id].desc)}</p>
    <div class="col" style="gap:8px">${s.members.map((u) => `<div class="row">${av(u, 's')}<span class="grow">${esc(u.name)}</span><span class="dim" style="font-size:12px">${esc(u.kpi.nm)}: ${u.kpi.v}/${u.kpi.goal}</span></div>`).join('')}${s.id === 'aq' ? `<div class="row">${av('ia', 's')}<span class="grow">${esc(O().ia.name)} (IA)</span><span class="dim" style="font-size:12px">supervisionada pela Marina</span></div>` : ''}</div></div>`).join('')}</div>`;
}

/* =========================================================
   PLANOS E PAGAMENTOS
   ========================================================= */
VIEWS.planos = {
  title: 'Planos e pagamentos',
  crumb: 'Conta',
  render() {
    const B = DB.billing, cur = DB.plans.find((p) => p.id === B.plan), yearly = S.filters.yearly;
    const iaU = B.usage.find((u) => u.nm === 'Conversas da SDR IA');
    const price = (p) => (yearly ? Math.round(p.price * 0.85) : p.price);
    return `
    <div class="page-h"><div><h2>Planos e pagamentos</h2><p>Plano ${esc(cur.nm)} · ${brl(cur.price)}/mês · próxima cobrança em ${B.next} no ${esc(B.card.toLowerCase())}.</p></div></div>
    <div class="usage" style="margin-bottom:14px">${B.usage.map((u) => { const p = pct(u.v, u.max); return `<div class="pn c"><span class="lbl">${esc(u.nm)}</span><div class="v num">${fmt(u.v)} <span class="dim" style="font-size:13px;font-weight:500">de ${fmt(u.max)}</span></div>${bar(p, p > 100 ? 'bad' : p >= 85 ? 'warn' : '')}<span class="dim" style="font-size:12px">${esc(u.note)}</span></div>`; }).join('')}</div>
    ${iaU && pct(iaU.v, iaU.max) >= 85 ? `<div class="pn gold-edge" style="padding:14px 16px;margin-bottom:18px"><div class="row wrap" style="gap:12px"><span class="ico-box gold">${ic('Bot', 'sm')}</span><div class="grow" style="min-width:220px"><b>A Cibelle está perto do limite de conversas</b><div class="muted" style="font-size:13px">No ritmo atual, ela passa de ${fmt(iaU.max)} conversas em cerca de 4 dias, antes do fim do ciclo. Quando passar, novos leads caem direto para a equipe.</div></div>
      <button class="btn sm gold" data-act="addon" data-v="+1.000 conversas da SDR IA">+1.000 conversas por ${brl(129)}/mês</button><button class="btn sm" data-act="changePlan" data-id="ag">Ver plano Agência</button></div></div>` : ''}
    <div class="row between wrap" style="gap:10px;margin-bottom:12px"><h3 style="font-size:16px">Planos</h3><div class="seg"><button class="${!yearly ? 'on' : ''}" data-act="yearly" data-v="0">Mensal</button><button class="${yearly ? 'on' : ''}" data-act="yearly" data-v="1">Anual · 15% off</button></div></div>
    <div class="plans" style="margin-bottom:18px">${DB.plans.map((p) => `<div class="pn plan ${p.id === B.plan ? 'cur' : ''}"><div class="row between"><b style="font-family:var(--f-display);font-size:18px">${esc(p.nm)}</b>${p.id === B.plan ? pill('Plano atual', 'cy') : pill(p.tag, 'line')}</div>
      <div class="pr num">${brl(price(p))}<small>/mês${yearly ? ' no anual' : ''}</small></div>
      <ul>${p.feats.map((f) => `<li>${ic('Check')}${esc(f)}</li>`).join('')}</ul>
      ${p.id === B.plan ? '<button class="btn block" disabled>Você está aqui</button>' : `<button class="btn block ${p.price > cur.price ? 'pri' : ''}" data-act="changePlan" data-id="${p.id}">${p.price > cur.price ? 'Mudar para ' + esc(p.nm) : 'Voltar para ' + esc(p.nm)}</button>`}</div>`).join('')}</div>
    <div class="grid g-12">
      <section class="pn s-4"><div class="pn-h"><span class="pn-t">${ic('CreditCard')}Forma de pagamento</span></div><div class="pn-b col" style="gap:12px">
        <div class="row"><span class="ico-box cy">${ic('CreditCard', 'sm')}</span><div class="grow"><b>${esc(B.card)}</b><div class="dim" style="font-size:12px">vence em 08/29 · ${esc(B.holder)}</div></div></div>
        <button class="btn sm" data-act="payMethod">Trocar forma de pagamento</button>
        <hr class="sep"><span class="lbl">Dados de cobrança</span><div style="font-size:13px">${esc(B.holder)}<br><span class="dim">CNPJ 00.000.000/0001-00 (fictício)</span><br><span class="dim">financeiro@lothem.com.br</span></div></div></section>
      <section class="pn s-8"><div class="pn-h"><span class="pn-t">${ic('Receipt')}Faturas</span></div><div class="pn-b" style="padding-top:4px"><div class="tbl-w"><table class="tbl"><thead><tr><th>Nota</th><th>Data</th><th>Descrição</th><th class="r">Valor</th><th>Status</th><th></th></tr></thead><tbody>${B.invoices.map((i) => `<tr><td class="mono nowrap" style="font-size:12px">${esc(i.id)}</td><td class="nowrap">${i.date}</td><td>${esc(i.desc)}</td><td class="r num nowrap">${brl(i.v, 2)}</td><td>${pill(i.st, i.st === 'Paga' ? 'ok' : 'warn')}</td><td class="r"><button class="btn xs" data-act="dlInvoice">${ic('Download', 'xs')}PDF</button></td></tr>`).join('')}</tbody></table></div></div></section>
    </div>`;
  },
};
ACT.yearly = (el) => { S.filters.yearly = el.dataset.v === '1'; rerender(); };
ACT.dlInvoice = () => toast('Download indisponível na demo', 'Na versão real, baixa o PDF da nota fiscal.', '', 'Download');
ACT.payMethod = () => openModal(modalHead('Trocar forma de pagamento', '') + `<div class="modal-b"><div class="row top-a" style="padding:12px;border-radius:9px;background:var(--cy-soft);font-size:13px"><span class="cy">${ic('ShieldCheck', 'sm')}</span><span>Os dados do cartão são digitados na página segura do provedor de pagamento. O Lothem Vendas nunca guarda o número do cartão. Também dá para pagar por Pix automático.</span></div></div><div class="modal-f"><button class="btn ghost" data-act="close">Fechar</button><button class="btn pri" data-act="paySecure">Abrir página segura</button></div>`);
ACT.paySecure = () => { closeOverlay(); toast('Página segura', 'Na versão real, abre o checkout do provedor de pagamento.', '', 'ShieldCheck'); };
ACT.changePlan = (el) => {
  const B = DB.billing, cur = DB.plans.find((p) => p.id === B.plan), to = DB.plans.find((p) => p.id === el.dataset.id);
  const up = to.price > cur.price, prorate = ((to.price - cur.price) * 8) / 30;
  const lose = !up ? ['A SDR IA deixa de atender', 'Ficam só 3 usuários e 1 instância de WhatsApp', 'A segunda organização fica só para leitura'] : [];
  openModal(modalHead((up ? 'Subir para ' : 'Voltar para ') + esc(to.nm), up ? 'A mudança vale na hora.' : 'A mudança vale no próximo ciclo, em ' + B.next + '.') + `<div class="modal-b">
    <div class="grid" style="grid-template-columns:1fr auto 1fr;gap:10px;align-items:center"><div class="r-stat"><span class="lbl">Hoje</span><div class="v">${esc(cur.nm)}</div><span class="dim num">${brl(cur.price)}/mês</span></div>${ic('ArrowRight', 'cy')}<div class="r-stat"><span class="lbl">Depois</span><div class="v">${esc(to.nm)}</div><span class="dim num">${brl(to.price)}/mês</span></div></div>
    ${up ? `<div style="font-size:13px">Cobrança proporcional hoje: <b class="num">${brl(prorate, 2)}</b> <span class="dim">(8 dias até o fim do ciclo)</span>. Depois, ${brl(to.price)}/mês a partir de ${B.next}.</div>` : `<div class="col" style="gap:6px;font-size:13px">${lose.map((l) => `<div class="row"><span class="warn">${ic('TriangleAlert', 'sm')}</span>${l}</div>`).join('')}</div>`}
  </div><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn ${up ? 'pri' : 'danger'}" data-act="confirmPlan" data-id="${to.id}">${up ? 'Confirmar e pagar ' + brl(prorate, 2) : 'Agendar mudança'}</button></div>`);
};
ACT.confirmPlan = (el) => {
  const B = DB.billing, cur = DB.plans.find((p) => p.id === B.plan), to = DB.plans.find((p) => p.id === el.dataset.id), up = to.price > cur.price;
  closeOverlay();
  if (!up) { toast('Mudança agendada', 'Você volta para o ' + to.nm + ' em ' + B.next + '. Dá para cancelar até lá.', '', 'CalendarClock'); return; }
  const prorate = ((to.price - cur.price) * 8) / 30;
  B.invoices.unshift({ id: 'NF 2026/1007', date: '07/10/2026', desc: 'Upgrade ' + cur.nm + ' → ' + to.nm + ' (proporcional)', v: prorate, st: 'Paga' });
  B.plan = to.id;
  const lim = { ag: [25, 10, 10000, 99] }[to.id];
  if (lim) { B.usage[0].max = lim[0]; B.usage[1].max = lim[1]; B.usage[2].max = lim[2]; B.usage[3].max = lim[3]; B.usage[3].note = 'ilimitadas no Agência'; }
  Object.values(DB.orgs).forEach((o) => { o.plan = to.nm; });
  toast('Plano ' + to.nm + ' ativo', 'Novos limites já liberados. Fatura proporcional paga.', '', 'BadgeCheck');
  renderShell();
};

/* =========================================================
   ORGANIZAÇÕES
   ========================================================= */
VIEWS.organizacoes = {
  title: 'Organizações',
  crumb: 'Conta',
  render() {
    return `
    <div class="page-h"><div><h2>Organizações</h2><p>Cada organização tem os próprios contatos, funis, números de WhatsApp e SDR IA. Nada se mistura. Pessoas podem participar de várias, com funções diferentes.</p></div>
      <div class="acts"><button class="btn pri" data-act="newOrg">${ic('Plus', 'sm')}Nova organização</button></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${Object.values(DB.orgs).map((o) => `<div class="pn org-card ${o.id === S.org ? 'cur' : ''}">
      <div class="row">${orgBadge(o, 44)}<div class="grow"><b style="font-family:var(--f-display);font-size:16px">${esc(o.name)}</b><div class="dim" style="font-size:12px">Plano ${esc(o.plan)}</div></div>${o.id === S.org ? pill('Você está aqui', 'cy') : ''}</div>
      <div class="inst" style="padding:0"><div class="kv"><div><span class="lbl">Contatos</span><b class="num">${o.contacts.length}</b></div><div><span class="lbl">Negócios</span><b class="num">${o.deals.length}</b></div><div><span class="lbl">WhatsApp</span><b class="num">${o.instances.length}</b></div></div></div>
      <div class="row between"><div class="row" style="gap:8px"><div class="av-stack">${o.members.map((id) => av(id, 's')).join('')}${av('ia', 's')}</div><span class="dim" style="font-size:12px">${o.members.length} pessoas · IA: ${esc(o.ia.name)}</span></div>
      <div class="row" style="gap:8px"><a class="btn sm ghost" href="${orgHash('funis', o.id)}" target="_blank" rel="noopener" title="Abrir o funil desta organização em outra aba">${ic('ExternalLink', 'xs')}Outra aba</a><button class="btn sm ghost" data-act="brandOrg" data-id="${o.id}">${ic('Palette', 'xs')}Marca</button>${o.id === S.org ? '' : `<button class="btn sm" data-act="switchOrg" data-id="${o.id}">Entrar</button>`}</div></div></div>`).join('')}</div>`;
  },
};
ACT.newOrg = () => {
  openModal(modalHead('Nova organização', 'Use para outra marca ou para gerenciar o CRM de um cliente da agência.') + `<form class="modal-b" data-sub="newOrg">
    <div class="field"><label for="noN">Nome</label><input class="in" id="noN" placeholder="Ex.: Clínica Vitta Odonto" required autofocus></div>
    <div class="field"><label for="noC">Começar com</label><select class="sel" id="noC"><option value="mkt">Os funis da Lothem Marketing (sem contatos)</option><option value="">Estrutura vazia</option></select></div>
    <div id="noWarn"></div></form>
    <div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="newOrg">Criar organização</button></div>`);
};
SUB.newOrg = () => {
  const nm = $('#noN').value.trim();
  if (!nm) { toast('Dê um nome para a organização', '', 'warn', 'Building2'); return; }
  const lim = DB.billing.usage.find((u) => u.nm === 'Organizações');
  if (DB.billing.plan !== 'ag' && lim.v >= lim.max) {
    $('#noWarn').innerHTML = `<div class="row top-a" style="padding:12px;border-radius:9px;background:var(--gold-soft);font-size:13px"><span class="gold">${ic('Building2', 'sm')}</span><div class="grow">O plano Profissional permite ${lim.max} organizações e você já usa as duas. O plano Agência libera organizações ilimitadas, com uma SDR IA treinada para cada uma.<div style="margin-top:8px"><button type="button" class="btn xs gold" data-act="changePlan" data-id="ag">Ver plano Agência</button></div></div></div>`;
    return;
  }
  const id = 'o' + uid(), base = $('#noC').value ? DB.orgs[$('#noC').value] : null;
  const words = nm.replace(/^(LOTHEM|Lothem)\s*[—-]\s*/, '').split(/\s+/);
  DB.orgs[id] = {
    id, name: nm, short: nm.length > 26 ? nm.slice(0, 24) + '…' : nm, mark: (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase(), hue: 'cy', plan: DB.plans.find((p) => p.id === DB.billing.plan).nm, members: [DB.me],
    ia: { name: 'Cibelle', role: 'SDR IA', mode: 'cop', offer: 'Diagnóstico', price: 0 },
    metrics: { goalLabel: 'Meta do mês', goal: 10000, done: 0, money: true, kpis: [], funnel: [{ nm: 'Leads', v: 0 }, { nm: 'Qualificados', v: 0 }, { nm: 'Vendas', v: 0, gold: true }], funnelNote: 'Organização nova: os números aparecem com as primeiras conversas.', series: { a: Array(30).fill(0), b: Array(30).fill(0), la: 'Leads', lb: 'Qualificados', start: [8, 9] }, campaigns: [], insight: 'Conecte o Meta Ads em Canais para ver as campanhas aqui.', ia: { active: 0, handoffs: 0, reviews: 0, conf: 0, resp: '—', csat: '—' }, ticker: [{ t: nowT(), x: 'Organização criada por ' + esc(ME().short) }] },
    pipelines: base ? JSON.parse(JSON.stringify(base.pipelines)) : [{ id: 'p1', nm: 'Vendas', desc: 'Funil padrão', stages: [{ id: 'novo', nm: 'Novo', p: 10 }, { id: 'conversa', nm: 'Em conversa', p: 30 }, { id: 'proposta', nm: 'Proposta', p: 60 }, { id: 'ganho', nm: 'Ganho', p: 100, won: true }] }],
    contacts: [], deals: [], instances: [], templates: [], integrations: [], conversations: [], tasks: [], channels: [{ id: 'geral', nm: 'geral', unread: 0, msgs: [{ day: 'Hoje' }, { u: DB.me, t: nowT(), x: 'Organização criada. Próximo passo: conectar o WhatsApp e convidar a equipe.' }] }], dms: [],
    kb: [], skills: [{ nm: 'Abertura', v: 40 }, { nm: 'Qualificação', v: 30 }], iaStats: { convs: 0, qual: '—', sold: 0, soloSold: 0, transfers: 0, conf: 0, csat: '—', approvals: 0 }, reviews: [], rules: DB.orgs.mkt.rules.filter((r) => r.lock).map((r) => Object.assign({}, r)), handoffRules: ['O lead pede para falar com uma pessoa'],
  };
  DB.orgs[id].metrics.kpis = [{ k: 'Leads', v: '0', delta: 0, spark: [0, 0, 0, 0, 0, 0, 0], go: 'contatos', hint: 'conecte o Meta Ads' }, { k: 'Conversas', v: '0', delta: 0, spark: [0, 0, 0, 0, 0, 0, 0], go: 'atendimento', hint: 'conecte um WhatsApp' }, { k: 'Vendas', v: '0', delta: 0, spark: [0, 0, 0, 0, 0, 0, 0], go: 'funis', hint: 'primeiro negócio' }];
  lim.v++;
  ME().orgs.push(id);
  closeOverlay();
  toast('Organização criada', nm + '. Dados e IA separados das outras.', '', 'Building2');
  ACT.switchOrg({ dataset: { id } });
};

/* =========================================================
   PERFIL
   ========================================================= */
VIEWS.perfil = {
  title: 'Meu perfil',
  crumb: 'Conta',
  render() {
    const u = ME(), li = lvlInfo(u), tab = S.tabs.perfil || 'dados', dia = document.documentElement.classList.contains('dia');
    const tabs = [['dados', 'Dados', 'User'], ['pref', 'Preferências', 'SlidersHorizontal'], ['notif', 'Notificações', 'Bell'], ['seg', 'Segurança', 'ShieldCheck']];
    let body = '';
    if (tab === 'dados') body = `<form class="pn" data-sub="profile"><div class="prof-h"><label class="avatar-up" title="Trocar foto">${av(u, 'xl')}<span class="ed">${ic('Camera', 'xs')}</span><input type="file" accept="image/*" data-chg="photo" aria-label="Trocar foto"></label>
        <div><h3 style="font-size:20px">${esc(u.name)}</h3><div class="muted">${esc(u.role)} · ${esc(u.fn)}</div><div class="row wrap" style="gap:6px;margin-top:8px">${pill('Nível ' + li.L + ' · ' + li.tier, 'gold mono', 'Hexagon')}${pill(DB.squads[u.squad].name, 'line')}</div></div></div>
      <div class="pn-b"><div class="form-g">
        <div class="field"><label for="pfN">Nome</label><input class="in" id="pfN" value="${esc(u.name)}"></div>
        <div class="field"><label for="pfF">Como você aparece para a equipe</label><input class="in" id="pfF" value="${esc(u.fn)}"></div>
        <div class="field"><label for="pfE">E-mail</label><input class="in" id="pfE" type="email" value="${esc(u.email)}"></div>
        <div class="field"><label for="pfP">WhatsApp</label><input class="in" id="pfP" value="${esc(u.phone)}"></div>
        <div class="field"><label for="pfS">Assinatura nas mensagens</label><input class="in" id="pfS" value="${esc(u.short)} · Lothem"><span class="hint">Aparece quando você assume uma conversa da IA.</span></div>
        <div class="field"><label for="pfTz">Fuso horário</label><select class="sel" id="pfTz"><option>Brasília (GMT-3)</option><option>Manaus (GMT-4)</option><option>Fernando de Noronha (GMT-2)</option></select></div>
      </div><div style="margin-top:16px"><button class="btn pri" type="submit">Salvar alterações</button></div></div></form>`;
    else if (tab === 'pref') body = `<div class="pn"><div class="pn-b">
      <div class="set-row"><div><div class="tt">Tema</div><div class="dd">Também tem a chave no topo da tela.</div></div><div class="seg"><button class="${dia ? '' : 'on'}" data-act="${dia ? 'theme' : 'noop'}">${ic('Moon', 'xs')} Escuro</button><button class="${dia ? 'on' : ''}" data-act="${dia ? 'noop' : 'theme'}">${ic('Sun', 'xs')} Claro</button></div></div>
      <div class="set-row"><div><div class="tt">Espaçamento</div><div class="dd">Espaçado deixa mais respiro entre as coisas. Compacto mostra mais por tela.</div></div><div class="seg"><button class="${document.documentElement.classList.contains('compact') ? '' : 'on'}" data-act="density" data-v="0">Espaçado</button><button class="${document.documentElement.classList.contains('compact') ? 'on' : ''}" data-act="density" data-v="1">Compacto</button></div></div>
      <div class="set-row"><div><div class="tt">Menu lateral</div><div class="dd">Recolhido mostra só os ícones.</div></div><button class="btn sm" data-act="toggleSb">${document.documentElement.classList.contains('sb-min') ? 'Expandir' : 'Recolher'}</button></div>
      <div class="set-row"><div><div class="tt">Tela inicial</div><div class="dd">Onde o Lothem Vendas abre quando você entra.</div></div><select class="sel" style="width:auto" data-chg="home">${[['central', 'Central'], ['atendimento', 'Atendimento'], ['funis', 'Funis'], ['tarefas', 'Tarefas']].map(([k, n]) => `<option value="${k}" ${store.get('home', 'central') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="set-row"><div><div class="tt">Mostrar meu nome no ranking</div><div class="dd">Desligado, você aparece como "Pessoa do time".</div></div><span class="sw"><input type="checkbox" checked data-chg="prefToast" data-v="Ranking"><span></span></span></div>
      <div class="set-row"><div><div class="tt">Avisos de XP e conquistas</div><div class="dd">Mensagens discretas no canto da tela.</div></div><span class="sw"><input type="checkbox" checked data-chg="prefToast" data-v="Avisos de XP"><span></span></span></div>
      <div class="set-row"><div><div class="tt">Resumo do dia às 8h</div><div class="dd">Agenda, metas e o que a IA fez durante a noite, no seu WhatsApp.</div></div><span class="sw"><input type="checkbox" checked data-chg="prefToast" data-v="Resumo do dia"><span></span></span></div>
    </div></div>`;
    else if (tab === 'notif') {
      const ev = ['Lead pediu atendimento humano', 'Pagamento de diagnóstico confirmado', 'Handoff recebido', 'Resposta da IA retida por regra', 'Tarefa atrasada', 'Conquista desbloqueada'];
      body = `<div class="pn"><div class="tbl-w"><table class="tbl perm"><thead><tr><th>Quando</th><th class="c">No app</th><th class="c">E-mail</th><th class="c">WhatsApp</th></tr></thead><tbody>${ev.map((e, i) => `<tr><td>${e}</td>${[true, i < 3, i < 2].map((on, k) => `<td class="c"><span class="sw"><input type="checkbox" ${on ? 'checked' : ''} aria-label="${e} · ${['No app', 'E-mail', 'WhatsApp'][k]}"><span></span></span></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    } else body = `<div class="grid g-12"><section class="pn s-6"><div class="pn-h"><span class="pn-t">${ic('ShieldCheck')}Acesso</span></div><div class="pn-b">
        <div class="set-row"><div><div class="tt">Verificação em 2 etapas</div><div class="dd">Código no app autenticador a cada novo aparelho.</div></div>${pill('Ativa', 'ok', 'ShieldCheck')}</div>
        <div class="set-row"><div><div class="tt">Senha</div><div class="dd">Trocada há 41 dias.</div></div><button class="btn sm" data-act="pwd">Trocar senha</button></div>
        <div class="set-row"><div><div class="tt">Seus dados (LGPD)</div><div class="dd">Baixe uma cópia de tudo que o Lothem Vendas guarda sobre você.</div></div><button class="btn sm" data-act="lgpd">Pedir cópia</button></div></div></section>
      <section class="pn s-6"><div class="pn-h"><span class="pn-t">${ic('Laptop')}Sessões ativas</span></div><div class="pn-b flush">${[['Laptop', 'Chrome · Windows', 'São Paulo · agora', true], ['Smartphone', 'App Android', 'São Paulo · ontem, 21:14'], ['Smartphone', 'Safari · iPhone', 'Santo André · 02/10']].map(([icn, a, b, cur], i) => `<div class="list-i"><span class="ico-box">${ic(icn, 'sm')}</span><div class="grow"><b style="font-size:13px">${a}</b><div class="dim" style="font-size:12px">${b}</div></div>${cur ? pill('Esta sessão', 'cy') : `<button class="btn xs" data-act="endSess" data-i="${i}">Encerrar</button>`}</div>`).join('')}</div></section></div>`;
    return `<div class="page-h"><div><h2>Meu perfil</h2><p>Seus dados, preferências de uso e segurança da conta.</p></div></div>
      <div class="tabs" role="tablist">${tabs.map(([id, nm, icn]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="perfil:${id}">${ic(icn, 'sm')}${nm}</button>`).join('')}</div>${body}`;
  },
};
CHG.photo = (el) => {
  const f = el.files && el.files[0]; if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Escolha uma imagem', 'JPG, PNG ou WebP.', 'warn', 'Image'); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'), s = 160; c.width = s; c.height = s; const x = c.getContext('2d'); const m = Math.min(img.width, img.height); x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); ME().photo = c.toDataURL('image/jpeg', 0.85); toast('Foto atualizada', 'Aparece no menu, no chat e nas conversas.', '', 'Camera'); refreshChrome(); rerender(); };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
};
SUB.profile = () => {
  const u = ME(), n = $('#pfN').value.trim();
  if (!n) { toast('O nome não pode ficar vazio', '', 'warn', 'User'); return; }
  u.name = n; u.short = n.split(' ')[0]; u.fn = $('#pfF').value.trim(); u.email = $('#pfE').value.trim(); u.phone = $('#pfP').value.trim();
  toast('Perfil salvo', 'Seu nome e foto já aparecem atualizados para a equipe.', '', 'UserCog');
  refreshChrome(); rerender();
};
CHG.home = (el) => { store.set('home', el.value); toast('Tela inicial salva', 'O Lothem Vendas vai abrir em ' + el.selectedOptions[0].text + '.', '', 'House'); };
CHG.prefToast = (el) => toast(el.dataset.v + (el.checked ? ' ligado' : ' desligado'), '', '', 'SlidersHorizontal');
ACT.pwd = () => toast('Troca de senha', 'Na versão real, você recebe um link no e-mail para criar a nova senha.', '', 'KeyRound');
ACT.lgpd = () => toast('Pedido registrado', 'A cópia dos seus dados chega por e-mail em até 15 dias.', '', 'ShieldCheck');
ACT.endSess = (el) => { el.closest('.list-i').remove(); toast('Sessão encerrada', 'O aparelho precisa entrar de novo.', '', 'LogOut'); };

/* =========================================================
   SUPORTE
   ========================================================= */
VIEWS.suporte = {
  title: 'Suporte',
  crumb: 'Conta',
  render() {
    const stc = (s) => ({ 'Em andamento': 'cy', 'Aguardando você': 'warn', Resolvido: 'ok', Aberto: 'cy' })[s] || 'line';
    return `
    <div class="page-h"><div><h2>Suporte</h2><p>Abra um chamado, acompanhe o status dos serviços ou consulte a base de ajuda. Primeira resposta em 18 min, em média, no horário comercial.</p></div>
      <div class="acts"><button class="btn pri" data-act="newTicket">${ic('Plus', 'sm')}Abrir chamado</button></div></div>
    <div class="grid g-12">
      <section class="pn s-8"><div class="pn-h"><span class="pn-t">${ic('Inbox')}Seus chamados</span></div><div class="pn-b flush">
        ${DB.tickets.map((t) => `<div class="list-i click" data-act="openTicket" data-id="${t.id}" role="button" tabindex="0"><span class="ico-box ${stc(t.st)}">${ic(t.st === 'Resolvido' ? 'CircleCheck' : 'LifeBuoy', 'sm')}</span>
          <div class="grow" style="min-width:0"><div class="row wrap" style="gap:6px"><span class="mono dim" style="font-size:12px">#${t.id}</span><b style="font-size:13.5px">${esc(t.t)}</b></div><div class="dim ellipsis" style="font-size:12px">${esc(t.last)}</div></div>
          <div class="col hide-m" style="gap:4px;align-items:flex-end">${pill(t.st, stc(t.st))}<span class="dim" style="font-size:11.5px">${esc(t.cat)} · ${esc(t.upd)}</span></div></div>`).join('')}
      </div></section>
      <section class="pn s-4"><div class="pn-h"><span class="pn-t">${ic('Activity')}Status dos serviços</span></div><div class="pn-b flush">
        ${DB.services.map((s) => `<div class="status-i"><span class="dot ${s.st}"></span><div class="grow" style="min-width:0"><div class="ellipsis">${esc(s.nm)}</div><div class="dim" style="font-size:11.5px">${esc(s.note)}</div></div></div>`).join('')}
        <div style="padding:10px 16px 14px"><span class="lbl">Conexão por QR Code · 30 dias</span><div class="uptime" style="margin:8px 0 0">${(DB.services[1].bars || []).map((b) => `<i class="${b ? 'w' : ''}"></i>`).join('')}</div></div>
      </div></section>
      <section class="pn s-12"><div class="pn-h"><span class="pn-t">${ic('BookOpen')}Base de ajuda</span><span class="dim" style="font-size:12px">WhatsApp do suporte: <span class="mono" style="user-select:all">(11) 4000-0099</span> (fictício)</span></div>
        <div class="pn-b grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px">${DB.helpArticles.map((a) => `<button class="row between" data-act="helpArt" style="padding:12px 14px;border:1px solid var(--line);border-radius:9px;text-align:left"><span>${ic('FileText', 'sm cy')} ${esc(a)}</span>${ic('ArrowUpRight', 'xs dim')}</button>`).join('')}</div></section>
    </div>`;
  },
};
ACT.helpArt = (el) => toast('Artigo de ajuda', el.textContent.trim() + ' · na versão real, abre o artigo completo.', '', 'BookOpen');
ACT.openTicket = (el) => {
  const t = DB.tickets.find((x) => x.id === +el.dataset.id);
  t.thread = t.thread || [{ u: t.by, x: 'Abri este chamado: ' + t.t + '.', time: 'há 1 dia' }, { sup: true, x: t.last.replace(/^(Suporte|Resolvido):\s*/, ''), time: t.upd }];
  openDrawer(`<div class="drawer-h"><span class="ico-box cy">${ic('LifeBuoy')}</span><div class="grow"><span class="mono dim" style="font-size:12px">#${t.id} · ${esc(t.cat)} · prioridade ${esc(t.pri.toLowerCase())}</span><h3 style="font-size:17px">${esc(t.t)}</h3></div><button class="iconbtn" data-act="close" aria-label="Fechar">${ic('X')}</button></div>
    <div class="drawer-b" id="tkBody">${t.thread.map((m) => `<div class="tm">${m.sup ? `<span class="av" style="background:var(--panel-3);color:var(--cy)">${ic('LifeBuoy', 'sm')}</span>` : av(m.u)}<div><div class="h"><b>${m.sup ? 'Suporte Lothem' : esc(U(m.u).name)}</b><time>${esc(m.time)}</time></div><div class="tx">${esc(m.x)}</div></div></div>`).join('')}</div>
    <form class="drawer-f" data-sub="tkReply" data-id="${t.id}" style="justify-content:stretch"><input class="in grow" id="tkIn" placeholder="Responder ao suporte" autocomplete="off"><button class="btn pri" type="submit">${ic('Send', 'sm')}</button></form>`);
};
SUB.tkReply = (f) => {
  const t = DB.tickets.find((x) => x.id === +f.dataset.id), x = $('#tkIn').value.trim(); if (!x) return;
  t.thread.push({ u: DB.me, x, time: 'agora' }); if (t.st === 'Aguardando você' || t.st === 'Resolvido') t.st = 'Em andamento'; t.upd = 'agora'; t.last = 'Você: ' + x;
  ACT.openTicket({ dataset: { id: t.id } }); if (S.route === 'suporte') rerender();
};
ACT.newTicket = () => {
  openModal(modalHead('Abrir chamado', 'Quanto mais detalhe, mais rápido a gente resolve.') + `<form class="modal-b" data-sub="ticket"><div class="form-g">
    <div class="field full"><label for="tkT">Assunto</label><input class="in" id="tkT" placeholder="Ex.: A Cibelle não respondeu um lead às 22h" required autofocus></div>
    <div class="field"><label for="tkC">Área</label><select class="sel" id="tkC"><option>Canais WhatsApp</option><option>SDR IA</option><option>Funis e contatos</option><option>Pagamentos e plano</option><option>Integrações</option><option>Outro</option></select></div>
    <div class="field"><label>Prioridade</label><div class="seg" id="tkP"><button type="button" data-act="segPick">Baixa</button><button type="button" class="on" data-act="segPick">Média</button><button type="button" data-act="segPick">Alta</button></div></div>
    <div class="field full"><label for="tkD">O que aconteceu</label><textarea class="ta" id="tkD" rows="4" placeholder="Passo a passo, horário e nome do contato, se tiver."></textarea></div>
    <div class="field full"><label for="tkF">Print (opcional)</label><input class="in" id="tkF" type="file" accept="image/*" style="padding-top:7px"></div>
  </div></form><div class="modal-f"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn pri" data-act="submitForm" data-form="ticket">Abrir chamado</button></div>`);
};
SUB.ticket = () => {
  const t = $('#tkT').value.trim(); if (!t) { toast('Escreva o assunto', '', 'warn', 'CircleAlert'); return; }
  const pri = ($('#tkP .on') || {}).textContent || 'Média';
  const id = Math.max(1000, ...DB.tickets.map((x) => x.id)) + 1;
  DB.tickets.unshift({ id, t, cat: $('#tkC').value, pri, st: 'Aberto', upd: 'agora', by: DB.me, last: 'Recebemos seu chamado. Primeira resposta em até 18 min no horário comercial.' });
  closeOverlay(); toast('Chamado #' + id + ' aberto', 'A resposta chega aqui e no seu e-mail.', '', 'LifeBuoy'); rerender();
};

ACT.density = (el) => { const on = el.dataset.v === '1'; document.documentElement.classList.toggle('compact', on); store.set('compact', on); rerender(); };
