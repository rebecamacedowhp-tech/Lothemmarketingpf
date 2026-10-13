/* LOTHEM Vendas — atendimento automático da SDR IA no WhatsApp.
   Liga, desliga ou deixa em modo teste (só responde os números da lista). Quem responde é o servidor (/api/waha);
   aqui ficam o controle na SDR IA e o "Assumir / Devolver" gravados na conta real. */

const BOT = {};
const BOT_MODES = [
  ['desligado', 'Desligado', 'Ela não responde ninguém. As mensagens só entram no Atendimento.'],
  ['teste', 'Só números de teste', 'Ela responde apenas os números da lista abaixo. Use para treinar sem tocar em cliente.'],
  ['todos', 'Todos', 'Ela responde todo mundo que escrever para o WhatsApp conectado.'],
];
const fmtPhone = (d) => { d = String(d || '').replace(/\D/g, ''); const n = d.startsWith('55') ? d.slice(2) : d; return n.length >= 10 ? '(' + n.slice(0, 2) + ') ' + n.slice(2, -4) + '-' + n.slice(-4) : d; };

async function botLoad() {
  const o = O();
  if (!isRealM()) { BOT[o.id] = BOT[o.id] || { mode: 'teste', nums: ['5519990001234'] }; return; }
  BOT[o.id] = { loading: true };
  const r = await REAL.sb.rpc('ai_bot_settings', { p_org: o.id });
  const row = !r.error && r.data && r.data[0];
  BOT[o.id] = r.error ? { error: r.error.message } : { mode: row ? row.bot_mode : 'teste', nums: (row && row.test_numbers) || [] };
  if (S.route === 'sdr') rerender();
}

function botCard() {
  const o = O(), admin = ['Proprietária', 'Gestor'].includes((ME() || {}).role);
  if (!BOT[o.id]) botLoad();
  const B = BOT[o.id];
  if (!B || B.loading) return '';
  if (B.error) return `<section class="pn" style="margin-bottom:16px"><div class="pn-b dim" style="font-size:13px">${ic('TriangleAlert', 'sm')} O atendimento automático ainda não está instalado nesta conta (falta rodar o SQL do motor da IA).</div></section>`;
  const mode = S.botMode || B.mode, M = BOT_MODES.find((m) => m[0] === mode);
  const st = B.mode === 'todos' ? pill('Atendendo todos', 'ok') : B.mode === 'teste' ? pill('Modo teste · ' + B.nums.length + (B.nums.length === 1 ? ' número' : ' números'), 'warn') : pill('Desligado', 'line');
  return `<section class="pn" style="margin-bottom:16px"><div class="pn-h"><span class="pn-t">${ic('Bot')}Atendimento automático no WhatsApp</span>${st}</div>
    <div class="pn-b col" style="gap:12px">
      <div class="chips" role="radiogroup" aria-label="Modo do atendimento">${BOT_MODES.map(([k, nm]) => `<button class="chip ${mode === k ? 'on' : ''}" role="radio" aria-checked="${mode === k}" data-act="botMode" data-v="${k}" ${admin ? '' : 'disabled'}>${nm}</button>`).join('')}</div>
      <p class="dim" style="font-size:13px">${esc(M[2])}</p>
      ${mode === 'teste' ? `<div class="field"><label for="botNums">Números de teste (um por linha, com DDD)</label><textarea class="ta" id="botNums" rows="3" placeholder="(19) 99999-0000" ${admin ? '' : 'disabled'}>${esc(B.nums.map(fmtPhone).join('\n'))}</textarea>
        <span class="hint">Mande mensagem de um destes números para o WhatsApp conectado. A ${esc(o.ia.name)} responde em uns 10 segundos.</span></div>` : ''}
      ${mode === 'todos' && B.mode !== 'todos' ? `<div class="row top-a" style="gap:8px;font-size:12.5px;padding:10px 12px;border-radius:9px;background:var(--warn-soft)">${ic('TriangleAlert', 'sm')}<span>A partir de agora ela responde qualquer pessoa que escrever, inclusive clientes que a equipe já atende. Conversas em que a equipe respondeu nas últimas 12 horas ficam de fora.</span></div>` : ''}
      ${admin ? `<div><button class="btn pri sm" data-act="botSave">${ic('Check', 'xs')}Salvar</button></div>` : '<span class="hint">Só a proprietária ou a gestão mudam o atendimento automático.</span>'}
    </div></section>`;
}

ACT.botMode = (el) => {
  const t = $('#botNums'); if (t) S.botNumsDraft = t.value;
  S.botMode = el.dataset.v; rerender();
  const t2 = $('#botNums'); if (t2 && S.botNumsDraft !== undefined) t2.value = S.botNumsDraft;
};
ACT.botSave = async () => {
  const o = O(), B = BOT[o.id], mode = S.botMode || B.mode;
  const raw = $('#botNums') ? $('#botNums').value : (S.botNumsDraft !== undefined ? S.botNumsDraft : B.nums.join('\n'));
  const nums = raw.split(/[\n,;]+/).map((x) => x.replace(/\D/g, '')).filter((x) => x.length >= 10).map((x) => (x.length <= 11 ? '55' + x : x));
  if (mode === 'teste' && !nums.length) { toast('Falta um número', 'Coloque pelo menos um número de teste, com DDD.', 'warn', 'CircleAlert'); return; }
  if (isRealM()) { const r = await REAL.sb.rpc('ai_set_bot', { p_org: o.id, p_mode: mode, p_numbers: nums }); if (r.error) { toast('Não consegui salvar', r.error.message, 'bad', 'CircleAlert'); return; } }
  BOT[o.id] = { mode, nums }; S.botMode = null; S.botNumsDraft = undefined;
  toast(mode === 'todos' ? o.ia.name + ' atende todo mundo' : mode === 'teste' ? 'Modo teste ligado' : 'Atendimento automático desligado',
    mode === 'teste' ? 'Ela responde só ' + nums.map(fmtPhone).join(', ') + '.' : mode === 'todos' ? 'Conversas com a equipe ficam de fora.' : 'As mensagens continuam entrando no Atendimento.', '', 'Bot');
  rerender();
};

const botSdrGeralBase = sdrGeral;
sdrGeral = function () { return botCard() + botSdrGeralBase(); };

/* Assumir e devolver: na conta real, grava no banco para o servidor saber quem atende */
const botTakeOverBase = ACT.takeOver;
ACT.takeOver = () => {
  botTakeOverBase();
  if (isRealM() && S.cv) REAL.sb.from('conversations').update({ status: 'human', assigned_to: DB.me }).eq('id', S.cv).then((r) => { if (r.error) toast('Não consegui assumir', r.error.message, 'bad', 'CircleAlert'); });
};
const botGiveBackBase = ACT.giveBack;
ACT.giveBack = () => {
  botGiveBackBase();
  if (isRealM() && S.cv) REAL.sb.rpc('ai_take_back', { p_conv: S.cv }).then((r) => { if (r.error) toast('Não consegui devolver', r.error.message, 'bad', 'CircleAlert'); });
};
