/* LOTHEM Vendas — Reativação dos leads parados (conta real da Lothem Crédito).
   Conversas sem mensagem há 2 dias ou mais, em 3 abas: eu não respondi · pararam de responder · receberam o link e não pagaram.
   Cada lead já vem com a próxima mensagem da sequência (Hormozi + Russell Brunson, clientes/lothem-credito/script-reativacao.md).
   Quem responde sai da lista sozinho; a sequência anda um passo a cada envio, no mínimo 2 dias entre um e outro. */

const REAT_ORGS = ['5a9f3318-59af-4384-b406-2d5f350fd5fc'];
const REAT_LIMITE = 35; // por dia no número principal, para o WhatsApp não bloquear
const REAT = { rows: null, org: null, loading: false, err: '' };
const REAT_ABAS = [
  ['eu', 'Eu não respondi', 'MessageCircleWarning', 'O lead mandou a última mensagem e ficou sem resposta.'],
  ['eles', 'Pararam de responder', 'MessageCircleOff', 'Você mandou a última mensagem e o lead sumiu.'],
  ['link', 'Receberam o link e não pagaram', 'Link', 'O link de pagamento foi enviado e a conversa parou.'],
];
const REAT_PASSOS = ['Abertura', 'História', 'Virada', 'Oferta', 'Encerramento'];
const reatOn = () => typeof REAL !== 'undefined' && REAL.on && REAT_ORGS.includes(S.org);
const reatAba = (r) => (r.link ? 'link' : r.quem === 'lead' ? 'eu' : 'eles');

function reatPrimeiro(nome) {
  const n = String(nome || '').trim().split(/\s+/)[0] || '';
  return /^[A-Za-zÀ-ÿ]{2,}$/.test(n) ? n[0].toUpperCase() + n.slice(1).toLowerCase() : '';
}
// passo da sequência: se o lead respondeu depois do último envio, recomeça da abertura
function reatPasso(r) {
  const re = r.reactivation || {};
  if (!re.passo || (r.ultima_lead_em && re.em && r.ultima_lead_em > re.em)) return 0;
  return re.passo;
}
// o que o lead veio buscar, pela primeira e pela última mensagem dele: a abertura fala disso, não de algo genérico
function reatMotivo(r) {
  const t = ((r.primeira_lead || '') + ' ' + (r.ultima_lead || '')).toLowerCase();
  if (r.cnpj) return ['cnpj', 'Mandou o CNPJ'];
  if (r.agenda) return ['agenda', 'Estava marcando'];
  if (/diagn/.test(t)) return ['diagnostico', 'Pediu o diagnóstico'];
  if (/ebook|e-book/.test(t)) return ['ebook', 'Pediu o ebook'];
  if (/analista/.test(t)) return ['analista', 'Pediu a Rebeca'];
  if (/empr[eé]st|cr[eé]dito|quanto|como funciona|capital|financ/.test(t)) return ['pergunta', 'Perguntou sobre crédito'];
  return ['geral', ''];
}
function reatTexto(r) {
  const p = reatPrimeiro(r.nome), oi = p ? 'Oi, ' + p + '!' : 'Oi!', n = p ? p + ', ' : '';
  const passo = reatPasso(r), aba = reatAba(r), eu = aba === 'eu', m = reatMotivo(r)[0];
  const desculpa = eu ? ' Desculpa a demora, falha minha.' : '';
  if (passo === 0) {
    if (aba === 'link') return oi + ' Seu diagnóstico ficou parado só no pagamento. O que te segurou: o valor, a confiança ou o momento?';
    if (m === 'cnpj') return oi + desculpa + ' Você chegou a me mandar seu CNPJ pra Rebeca olhar, e a conversa parou aí. Ainda quer que ela veja o que o banco enxerga na sua empresa?';
    if (m === 'agenda') return oi + desculpa + ' A gente estava quase marcando sua conversa com a Rebeca e parou. Ainda quer que ela olhe sua empresa?';
    if (m === 'diagnostico') return oi + ' Você pediu pra fazer o diagnóstico' + (eu ? ' e eu demorei pra te responder, falha minha.' : ' e a gente parou no meio do caminho.') + ' Ainda quer fazer?';
    if (m === 'ebook') return eu ? oi + ' Você pediu o ebook e eu fiquei te devendo, desculpa! Ainda quer receber?' : oi + ' Te mandei o ebook uns dias atrás. Você ainda está buscando crédito pra sua empresa?';
    if (m === 'analista') return oi + ' Você pediu pra falar com a Rebeca, a ex-analista de crédito PJ' + (eu ? ', e ficou sem resposta. Falha nossa!' : '.') + ' Ainda quer que ela olhe sua empresa?';
    if (m === 'pergunta' && eu) return oi + ' Você me perguntou sobre crédito pra sua empresa e ficou sem resposta, desculpa. Ainda está buscando?';
    return oi + (eu ? ' Você me chamou aqui e ficou sem resposta, falha minha.' : '') + ' Você ainda está buscando crédito pra sua empresa?';
  }
  if (passo === 1) return n + 'o Felipe, dono de restaurante em Salvador, falou uma coisa depois do diagnóstico que eu guardei: o Pronampe só foi possível depois de saber o que organizar e como organizar. Quer que a Rebeca olhe o seu caso também?';
  if (passo === 2) return 'Uma coisa que quase ninguém sabe' + (p ? ', ' + p : '') + ': o banco nega e não conta o motivo. E cada pedido gera uma consulta no seu CNPJ, e muita consulta seguida faz o próximo banco desconfiar. Por isso a Rebeca, que trabalhou quase 4 anos dentro de banco, olha antes de você pedir. Faz sentido pra você?';
  if (passo === 3) return 'Vou ser direta' + (p ? ', ' + p : '') + ': o Diagnóstico com Rota de Crédito sai por R$ 149. O relatório fica pronto em 25 minutos, e a Rebeca entra numa reunião com você pra mostrar o que arrumar e quanto crédito dá pra buscar depois. Se vier genérico, ela devolve o valor. Ela atende 8 por dia. Quer garantir a sua?';
  return n + 'vou parar por aqui pra não te incomodar. Se um dia quiser saber o que o banco vê na sua empresa, é só responder "quero" aqui.';
}
const reatEnviadosHoje = () => (REAT.hoje || 0) + (REAT.extra || 0);

async function reatCarregar() {
  if (!reatOn() || REAT.loading) return;
  REAT.loading = true; REAT.err = '';
  const meiaNoite = new Date(); meiaNoite.setHours(0, 0, 0, 0);
  const [r, h] = await Promise.all([
    REAL.sb.rpc('reativacao_lista', { p_org: S.org, p_dias: 2 }),
    REAL.sb.from('conversations').select('id', { count: 'exact', head: true }).eq('org_id', S.org).gte('reactivation->>em', meiaNoite.toISOString()),
  ]);
  REAT.loading = false; REAT.hoje = h.error ? 0 : h.count || 0; REAT.extra = 0;
  if (r.error) { REAT.err = /reativacao_lista/.test(r.error.message) ? 'Falta rodar o SQL da reativação no Supabase.' : r.error.message; REAT.rows = []; }
  else REAT.rows = r.data;
  REAT.org = S.org;
  if (S.route === 'reativacao') rerender();
}

const reatIdx = NAV[0].items.findIndex((i) => i.id === 'contatos');
NAV[0].items.splice(reatIdx + 1, 0, { id: 'reativacao', nm: 'Reativação', ic: 'RefreshCcw' });
VIEWS.reativacao = {
  title: 'Reativação',
  crumb: 'Comando',
  render() {
    if (!reatOn()) return `<div class="page-h"><div><h2>Reativação</h2><p>Disponível na conta da Lothem Crédito com o WhatsApp conectado.</p></div></div>`;
    if (REAT.org !== S.org || REAT.rows === null) { reatCarregar(); return `<div class="page-h"><div><h2>Reativação</h2><p>Procurando as conversas paradas…</p></div></div>`; }
    const tab = S.tabs.reativacao || 'eu', rows = REAT.rows.filter((r) => reatAba(r) === tab && reatPasso(r) < REAT_PASSOS.length);
    const cont = (id) => REAT.rows.filter((r) => reatAba(r) === id && reatPasso(r) < REAT_PASSOS.length).length;
    const hoje = reatEnviadosHoje(), cheio = hoje >= REAT_LIMITE, aba = REAT_ABAS.find((a) => a[0] === tab);
    const card = (r) => {
      const passo = reatPasso(r), dias = Math.max(2, Math.floor((Date.now() - new Date(r.parado_desde)) / 864e5));
      return `<section class="pn"><div class="pn-b col" style="gap:10px">
        <div class="row between" style="gap:10px;flex-wrap:wrap"><div><b>${esc(r.nome || 'Sem nome')}</b>${r.objetivo ? ` <span class="dim">· ${esc(r.objetivo)}</span>` : ''}</div>
          <div class="row" style="gap:6px">${reatMotivo(r)[1] ? pill(reatMotivo(r)[1], 'ok') : ''}${(r.reactivation || {}).etiqueta ? pill(r.reactivation.etiqueta.replace(/‎/g, ''), '', 'Tag') : ''}${pill('Parado há ' + dias + ' dias', dias > 14 ? 'bad' : 'gold')}${pill('Passo ' + (passo + 1) + ' de 5 · ' + REAT_PASSOS[passo], 'cy')}</div></div>
        ${r.ultima_lead ? `<div class="dim" style="font-size:12.5px">Última do lead: “${esc(r.ultima_lead)}”</div>` : ''}
        <textarea class="ta" id="reat-${r.conversation_id}" rows="3" aria-label="Mensagem para ${esc(r.nome || 'o lead')}">${esc(reatTexto(r))}</textarea>
        <div class="row between" style="gap:8px;flex-wrap:wrap">
          <button class="btn xs ghost" data-act="reatParar" data-id="${r.conversation_id}">${ic('Ban', 'xs')}Não contatar</button>
          <div class="row" style="gap:8px"><button class="btn xs ghost" data-act="reatAbrir" data-id="${r.conversation_id}">${ic('MessageCircle', 'xs')}Ver conversa</button>
          <button class="btn xs ghost" data-act="reatCopiar" data-id="${r.conversation_id}">${ic('Copy', 'xs')}Copiar</button>
          <button class="btn xs pri" data-act="reatEnviar" data-id="${r.conversation_id}" ${cheio ? 'disabled title="Limite do dia atingido"' : ''}>${ic('Send', 'xs')}Enviar</button></div></div>
      </div></section>`;
    };
    return `<div class="page-h"><div><h2>Reativação</h2><p>Leads parados há 2 dias ou mais. A mensagem já vem pronta, e você pode editar antes de enviar.</p></div>
        <div class="row" style="gap:8px">${pill(hoje + ' de ' + REAT_LIMITE + ' enviadas hoje', cheio ? 'bad' : 'ok', 'Send')}<button class="btn sm" data-act="reatImportar">${ic('Download', 'xs')}Importar do WhatsApp</button><button class="btn sm ghost" data-act="reatAtualizar">${ic('RefreshCw', 'xs')}Atualizar</button></div></div>
      ${REAT.err ? `<div class="row top-a" style="gap:8px;font-size:13px;padding:10px 12px;border-radius:9px;background:var(--warn-soft);margin-bottom:14px">${ic('TriangleAlert', 'sm')}<span>${esc(REAT.err)}</span></div>` : ''}
      <div class="tabs" role="tablist">${REAT_ABAS.map(([id, nm, icn]) => { const n = cont(id); return `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-v="reativacao:${id}" role="tab" aria-selected="${tab === id}">${ic(icn, 'sm')}${nm}${n ? `<span class="n">${n}</span>` : ''}</button>`; }).join('')}</div>
      <p class="muted" style="font-size:13px;margin:4px 0 14px">${aba[3]} Quem responder sai da lista e volta para o atendimento normal.</p>
      ${cheio ? `<div class="row top-a" style="gap:8px;font-size:13px;padding:10px 12px;border-radius:9px;background:var(--warn-soft);margin-bottom:14px">${ic('ShieldAlert', 'sm')}<span>Limite de ${REAT_LIMITE} mensagens hoje atingido. Amanhã você continua, para o WhatsApp não bloquear o número.</span></div>` : ''}
      <div class="col" style="gap:12px">${rows.map(card).join('') || `<div class="pn"><div class="empty">${ic('CircleCheck')}<div>Nenhum lead parado nesta aba.</div></div></div>`}</div>`;
  },
};

const reatRow = (id) => (REAT.rows || []).find((r) => r.conversation_id === id);
const reatMsg = (id) => { const el = $('#reat-' + id); return el ? el.value.trim() : ''; };
ACT.reatAtualizar = () => { REAT.rows = null; rerender(); };
ACT.reatCopiar = (el) => copyText(reatMsg(el.dataset.id), 'Mensagem');
ACT.reatAbrir = (el) => { S.cvFilter = 'todas'; S.showThread = true; go('atendimento', { cv: el.dataset.id }); };
ACT.reatParar = async (el) => {
  const id = el.dataset.id, r = await REAL.sb.rpc('reativacao_marcar', { p_conversation: id, p_dados: { parar: new Date().toISOString() } });
  if (r.error) return toast('Não consegui marcar', r.error.message, 'bad', 'CircleAlert');
  REAT.rows = REAT.rows.filter((x) => x.conversation_id !== id);
  toast('Marcado como não contatar', 'Esse lead não aparece mais na reativação.', '', 'Ban'); rerender();
};
ACT.reatEnviar = async (el) => {
  const id = el.dataset.id, row = reatRow(id), txt = reatMsg(id);
  if (!row || !txt) return;
  if (reatEnviadosHoje() >= REAT_LIMITE) return toast('Limite do dia atingido', 'Continue amanhã para não arriscar o número.', 'bad', 'ShieldAlert');
  el.disabled = true;
  try {
    const { data } = await REAL.sb.auth.getSession();
    const r = await fetch('/api/waha?op=send', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data.session && data.session.access_token) }, body: JSON.stringify({ conversation: id, text: txt }) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.ok) throw new Error(out.erro || 'falha no envio');
  } catch (e) { el.disabled = false; return toast('A mensagem não saiu', e.message + '. Confira se o WhatsApp está conectado.', 'bad', 'CircleAlert'); }
  const dados = { passo: reatPasso(row) + 1, em: new Date().toISOString() };
  await REAL.sb.rpc('reativacao_marcar', { p_conversation: id, p_dados: dados });
  REAT.rows = REAT.rows.filter((x) => x.conversation_id !== id); REAT.extra = (REAT.extra || 0) + 1;
  toast('Enviada', (row.nome || 'Lead') + ' · ' + REAT_PASSOS[dados.passo - 1] + '. A próxima aparece em 2 dias se não responder.', '', 'Send'); rerender();
};

/* ---------- importar as conversas antigas do WhatsApp, por etiqueta ---------- */
const REAT_FORA = /favoritos|grupos|não lidas|meekah/i; // etiquetas que não são lead
const REAT_IMP = { etiquetas: null, rodando: false };
async function reatApi(op, dados) {
  const { data } = await REAL.sb.auth.getSession();
  const r = await fetch('/api/waha?op=' + op, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data.session && data.session.access_token) }, body: JSON.stringify(Object.assign({ org: S.org }, dados)) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.ok) throw new Error(out.erro || 'o servidor respondeu ' + r.status);
  return out;
}
ACT.reatImportar = async () => {
  openModal(modalHead('Trazer os leads do WhatsApp', 'Lendo as etiquetas do seu WhatsApp…') + '<div class="modal-b" id="reatImp"><div class="dim">Um instante.</div></div>');
  try {
    const out = await reatApi('etiquetas', {});
    REAT_IMP.etiquetas = out.etiquetas.filter((e) => e.conversas > 0);
  } catch (e) { $('#reatImp').innerHTML = `<div class="bad">${esc(e.message)}</div>`; return; }
  $('#reatImp').outerHTML = `<div class="modal-b col" id="reatImp" style="gap:12px">
      <p class="muted" style="font-size:13px">Marque as etiquetas com leads. A IA lê cada conversa, preenche a ficha e a conversa entra no CRM. Nenhuma mensagem é enviada.</p>
      <div class="col" style="gap:8px">${REAT_IMP.etiquetas.map((e, i) => `<label class="row" style="gap:10px;font-size:14px"><input type="checkbox" id="ri-${i}" ${REAT_FORA.test(e.nome) ? '' : 'checked'}><span class="dot" style="background:${esc(e.cor || '#999')}"></span><span class="grow">${esc(e.nome.replace(/\u200e/g, ''))}</span><span class="dim num">${e.conversas}</span></label>`).join('')}</div>
      <div id="reatProg" class="dim" style="font-size:13px"></div></div>
    <div class="modal-f"><button class="btn ghost" data-act="close">Fechar</button><button class="btn pri" id="reatGo" data-act="reatImportarGo">${ic('Download', 'xs')}Importar</button></div>`;
};
ACT.reatImportarGo = async () => {
  if (REAT_IMP.rodando) return;
  const escolhidas = REAT_IMP.etiquetas.filter((e, i) => { const el = $('#ri-' + i); return el && el.checked; });
  if (!escolhidas.length) return;
  REAT_IMP.rodando = true; const btn = $('#reatGo'); if (btn) btn.disabled = true;
  const total = escolhidas.reduce((a, e) => a + e.conversas, 0);
  let feitas = 0, erros = 0;
  const prog = (t) => { const el = $('#reatProg'); if (el) el.innerHTML = t; };
  for (const e of escolhidas) {
    let de = 0;
    while (de !== null) {
      prog(`Importando <b>${esc(e.nome)}</b> · ${feitas} de ${total} conversas${erros ? ' · ' + erros + ' com erro' : ''}`);
      try {
        const out = await reatApi('importar', { etiqueta: e.id, nome: e.nome.replace(/\u200e/g, ''), de, qtd: 5 });
        feitas += out.resultados.length; erros += out.resultados.filter((r) => r.erro).length; de = out.proximo;
      } catch (err) { erros += 5; feitas += 5; de = de + 5 < e.conversas ? de + 5 : null; }
    }
  }
  REAT_IMP.rodando = false;
  prog(`<span class="ok">${ic('CircleCheck', 'xs')} Pronto: ${feitas - erros} conversas no CRM.</span>${erros ? ' ' + erros + ' deram erro (pode importar de novo, nada se repete).' : ''}`);
  if (btn) btn.disabled = false;
  REAT.rows = null; reatCarregar();
  if (typeof waLoad === 'function') waLoad(true);
};
