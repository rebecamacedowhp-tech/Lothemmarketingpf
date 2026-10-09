/* LOTHEM Vendas — inicialização. */
(function boot() {
  const root = document.documentElement;
  if (store.get('dia', false)) root.classList.add('dia');
  if (store.get('sbMin', false)) root.classList.add('sb-min');
  if (store.get('compact', false)) root.classList.add('compact');
  S.sideHidden = store.get('sideHidden', false);
  S.navOpen = store.get('navOpen', false);
  S.guideDone = new Set(store.get('guide', []));

  const [mainPart, orgPart] = (location.hash || '').replace('#', '').split('~');
  const [hash, htab] = mainPart.split('.');
  S.route = VIEWS[hash] ? hash : store.get('home', 'central');
  if (htab) S.tabs[S.route] = htab;
  if (!VIEWS[S.route]) S.route = 'central';

  /* Demonstração: dados fictícios, sem login. Fica ligada até a pessoa sair dela. */
  let demo = false;
  try { demo = hash === 'demo' || sessionStorage.getItem('lothem-demo') === '1'; if (hash === 'demo') sessionStorage.setItem('lothem-demo', '1'); } catch (e) { demo = hash === 'demo'; }

  function startDemo() {
    root.classList.remove('real');
    loadBrands();
    if (orgPart && DB.orgs[orgPart]) setOrgQuiet(orgPart);
    renderShell();
    renderGuide();
    if (root.classList.contains('sb-min')) { const b = $('.sb-toggle'); if (b) { b.innerHTML = ic('PanelLeftOpen', 'sm') + '<span class="t">Recolher menu</span>'; b.dataset.tip = 'Expandir menu'; } }
    if (window.LOTHEM_CONFIG && window.supabase) {
      ACT.logout = () => { try { sessionStorage.removeItem('lothem-demo'); } catch (e) { /* sem armazenamento */ } location.hash = ''; location.reload(); };
    }
  }

  slaTick();
  setInterval(slaTick, 1000);
  window.addEventListener('hashchange', () => {
    const [m, og] = location.hash.replace('#', '').split('~');
    const [h, t] = m.split('.');
    if (og && DB.orgs[og] && og !== S.org) { setOrgQuiet(og); renderShell(); }
    if (VIEWS[h] && (h !== S.route || (t && t !== S.tabs[h]))) go(h, { tab: t });
  });

  if (demo || typeof bootData !== 'function') startDemo();
  else bootData(startDemo);
})();
