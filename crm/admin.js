/* LOTHEM Vendas — separação das três entradas:
   1. Administração da plataforma: quem está em platform_admins entra direto no Painel Mestre, sem CRM.
   2. Clientes (inclusive as contas da própria Lothem): só o CRM, sem Painel Mestre.
   3. Demonstração: dados fictícios, com faixa fixa avisando, e sem Painel Mestre. */

const ADM_ORG = '__adm';

function adminShell() {
  const dia = document.documentElement.classList.contains('dia');
  $('#app').className = 'app adm-app';
  $('#app').innerHTML =
    '<div class="main adm-main">' +
      '<header class="top">' +
        '<span class="adm-brand">' + ic('Crown', 'sm gold') + '<b>LOTHEM Vendas</b><span class="dim">· administração</span></span>' +
        '<div class="top-title"><div class="crumb" id="crumb"></div><h1 id="ptitle"></h1></div>' +
        '<span class="grow"></span>' +
        '<span class="dim hide-m" style="font-size:12.5px">' + esc((REAL.user && REAL.user.email) || '') + '</span>' +
        '<label class="theme-sw" title="Tema claro ou escuro"><input type="checkbox" id="themeSw" data-chg="themeSw" aria-label="Tema claro"' + (dia ? ' checked' : '') + '><span class="ts-track"><span class="ts-ic moon">' + ic('Moon', 'xs') + '</span><span class="ts-ic sun">' + ic('Sun', 'xs') + '</span><span class="ts-knob"></span></span></label>' +
        '<button class="btn sm ghost" data-act="logoutReal">' + ic('LogOut', 'xs') + 'Sair</button>' +
      '</header>' +
      '<main class="stage" id="stage"></main>' +
    '</div>';
  renderMain(true);
}

async function adminStart(user) {
  REAL.user = user; REAL.on = true; REAL.admin = true;
  document.documentElement.classList.add('real');
  try { await mestreReal(); } catch (e) { console.error(e); }
  // o Painel Mestre não usa dados de organização; a casca só precisa de um nome
  DB.orgs = { [ADM_ORG]: { id: ADM_ORG, name: 'Administração', short: 'Administração', pipelines: [{ id: 'p', stages: [] }], conversations: [], contacts: [], deals: [] } };
  S.org = ADM_ORG; S.route = 'mestre';
  VIEWS.mestre.crumb = 'Administração da plataforma';
  go = function (route, opts = {}) { S.route = 'mestre'; if (opts.tab) S.tabs.mestre = opts.tab; closePop(); closeOverlay(); renderMain(true); };
  syncHash = () => { try { history.replaceState(null, '', '#mestre'); } catch (e) { /* sem histórico */ } };
  adminShell();
}

/* Login: a administração vai para o Painel Mestre antes de procurar organizações */
const admStartBase = startReal;
startReal = async function (user) {
  let adm = false;
  try { const r = await REAL.sb.rpc('is_platform_admin'); adm = !r.error && r.data === true; } catch (e) { /* segue como cliente */ }
  if (adm) return adminStart(user);
  return admStartBase(user);
};

/* Demonstração: faixa fixa em todas as telas, sem Painel Mestre */
NAV.forEach((g, i) => { if (g.grp === 'Lothem') NAV.splice(i, 1); });
const admRenderShellBase = renderShell;
renderShell = function () {
  admRenderShellBase();
  if (typeof REAL !== 'undefined' && REAL.on) return;
  const main = $('#app .main'); if (!main || $('#demoStrip')) return;
  const strip = document.createElement('div');
  strip.className = 'demo-strip'; strip.id = 'demoStrip';
  strip.innerHTML = ic('Play', 'xs') + '<span class="grow"><b>Demonstração</b> · dados fictícios, nada aqui é real</span><button class="btn sm" data-act="leaveDemo">' + ic('LogIn', 'xs') + 'Entrar na minha conta</button>';
  main.insertBefore(strip, main.firstChild);
};
ACT.leaveDemo = () => { try { sessionStorage.removeItem('lothem-demo'); } catch (e) { /* sem armazenamento */ } location.hash = ''; location.reload(); };
