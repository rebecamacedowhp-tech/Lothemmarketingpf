/* LOTHEM Vendas — demonstração da Lothem Crédito (Diagnóstico Completo).
   Clientes já atendidos pela Cibelle, preenchimento automático ligado, campanhas com métricas
   e uma simulação ao vivo: um lead chega, a Cibelle atende, qualifica, vende e preenche o CRM sozinha.
   Tudo fictício. */

(function demoCred() {
  const o = DB.orgs.cred;
  if (!o) return;
  o.name = 'LOTHEM — Inteligência em Crédito'; o.short = 'Lothem Crédito';
  o.ia = Object.assign(o.ia, { mode: 'sup' });

  o.pipelines = [{ id: 'diag', nm: 'Diagnóstico Completo', desc: 'Do teste no site à consultoria', stages: [
    { id: 'novo', nm: 'Novo contato', p: 5 }, { id: 'conversa', nm: 'Em conversa com a Cibelle', p: 10 }, { id: 'qualificado', nm: 'Qualificado', p: 20 },
    { id: 'link', nm: 'Link enviado', p: 30 }, { id: 'pago', nm: 'Diagnóstico pago', p: 45 }, { id: 'autorizado', nm: 'Autorização assinada', p: 55 },
    { id: 'relatorio', nm: 'Relatório entregue', p: 65 }, { id: 'rebeca', nm: 'Conversa com a Rebeca', p: 75 }, { id: 'consultoria', nm: 'Consultoria fechada', p: 100, won: true },
    { id: 'perdido', nm: 'Perdido', p: 0, lost: true } ] }];

  /* nome, empresa, segmento, cidade, etapa, valor, produto, status da conversa, problema, decisor, momento, faturamento, hora, campanha, mensagens */
  const P = [
    ['Roberto Nunes', 'Nunes Auto Peças', 'Autopeças', 'Sumaré/SP', 'conversa', 97, 'Diagnóstico Completo', 'ia', null, null, null, null, '10:21', 'Teste do site', [
      ['lead', 'Oi, fiz o teste no site. O banco negou meu capital de giro'], ['ia', 'Oi, Roberto! Aqui é a Cibelle, da equipe da Rebeca, da Lothem. Você fez o teste de crédito da Nunes Auto Peças no nosso site.'], ['ia', 'Não peço senha nem dado de banco, e nada aqui é cobrado sem você pedir. A Lothem não empresta dinheiro nem cobra para liberar empréstimo.'], ['ia', 'Me conta: o dinheiro das vendas entra numa conta PJ ou parte cai no seu CPF?']]],
    ['Juliana Prado', 'Doce Prado Confeitaria', 'Confeitaria', 'Campinas/SP', 'qualificado', 97, 'Diagnóstico Completo', 'aguardando', 'Aprovaram menos do que pediu: R$ 15 mil de R$ 60 mil.', 'Juliana decide sozinha.', 'Quer pedir de novo em novembro.', 'R$ 30 a 100 mil por mês · metade no Pix pessoal.', '10:12', 'Vídeo Rebeca · Aprovaram menos', [
      ['lead', 'Pedi 60 mil e aprovaram 15. Não entendi nada'], ['ia', 'Oi, Juliana! Aqui é a Cibelle, da equipe da Rebeca, da Lothem. Pelo que você respondeu no teste, metade das vendas cai no seu Pix pessoal.'], ['ia', 'O mais provável é isso: o banco calcula o limite com o faturamento que ele enxerga na conta da empresa. Ele está vendo uma confeitaria menor do que ela é.'], ['lead', 'Faz sentido demais'], ['ia', 'Quer que eu te mande um áudio rapidinho da Rebeca explicando esse ponto no seu caso?']]],
    ['Carlos Mendes', 'Mendes Transportes', 'Transporte', 'Hortolândia/SP', 'link', 149, 'Diagnóstico + Rota de Crédito', 'aguardando', 'Negado no Pronampe com cadastro limpo.', 'Carlos e o sócio, Paulo.', 'Agora: quer trocar dívida cara.', 'R$ 100 a 400 mil por mês.', '09:58', 'Carrossel Pronampe', [
      ['lead', 'Quero saber o que faço depois do relatório'], ['ia', 'Para isso existe o combo com a Rota de Crédito, Carlos: além do Diagnóstico, a Rebeca monta o passo a passo, qual linha pedir, em qual banco e com quais documentos.'], ['ia', 'O combo é R$ 149. Quer que eu te mande o link?'], ['lead', 'Manda'], ['ia', 'Aqui está: pay.cakto.com.br/n2qt6u5_1160897. Dá para pagar no Pix, no cartão ou no boleto.']]],
    ['Fernanda Lopes', 'Lopes Estética', 'Estética', 'Americana/SP', 'pago', 164, 'Diagnóstico + PF do sócio', 'aguardando', 'Restrição no CPF e crédito negado.', 'Fernanda decide sozinha.', 'Agora: quer comprar equipamento.', 'R$ 10 a 30 mil por mês.', '09:41', 'Teste do site', [
      ['ia', 'Recebi aqui, Fernanda. Obrigada pela confiança!'], ['ia', 'Falta só um passo: assinar a autorização para as consultas aos birôs e ao SCR do Banco Central. Sem ela, ninguém consulta nada. Te mando agora.'], ['sys', 'Termo de autorização enviado'], ['lead', 'Vou assinar no almoço']]],
    ['Marcos Ribeiro', 'Ribeiro Materiais de Construção', 'Materiais de construção', 'Sumaré/SP', 'autorizado', 97, 'Diagnóstico Completo', 'aguardando', 'Pediu em 3 bancos na mesma semana e levou não.', 'Marcos e a esposa, Sandra.', 'Antes do fim do ano.', 'R$ 100 a 400 mil por mês.', '09:20', 'Vídeo Rebeca · O que o banco olha', [
      ['lead', 'Assinei'], ['ia', 'Autorização recebida, Marcos! A Rebeca já começou o seu relatório.'], ['ia', 'Vamos deixar a conversa de 30 minutos marcada: prefere hoje ou amanhã? Manhã ou tarde?'], ['lead', 'Amanhã de manhã'], ['ia', 'Amanhã, 10h, com a Rebeca. Te lembro pela manhã.']]],
    ['Patrícia Alves', 'Alves Pet Shop', 'Pet shop', 'Paulínia/SP', 'relatorio', 97, 'Diagnóstico Completo', 'humano', 'MEI faturando acima do teto.', 'Patrícia decide sozinha.', 'Agora.', 'R$ 10 a 30 mil por mês.', '08:55', 'Teste do site', [
      ['sys', 'Relatório entregue em PDF · rating estimado C'], ['lead', 'Recebi! Quero falar com a Rebeca sobre a parte do MEI'], ['ia', 'Vou chamar a Rebeca aqui, ela te responde pessoalmente. Qual o melhor horário para você, hoje ou amanhã?'], ['sys', 'Conversa passada para Rebeca', 'gold']]],
    ['André Costa', 'Costa Usinagem', 'Indústria', 'Nova Odessa/SP', 'rebeca', 97, 'Diagnóstico Completo', 'humano', 'Restrição no CNPJ por protesto antigo.', 'André e o sócio.', 'Quer o Finame para uma máquina.', 'R$ 100 a 400 mil por mês.', 'ontem', 'Carrossel Pronampe', [
      ['user', 'André, vi seu relatório. O protesto é de 2022 e dá para cancelar direto no cartório. Amanhã te mostro a ordem certa.'], ['lead', 'Combinado, Rebeca']]],
    ['Luciana Freitas', 'Freitas Contabilidade', 'Contabilidade', 'Campinas/SP', 'consultoria', 3897, 'Consultoria', 'encerrada', 'Faturamento em várias contas.', 'Luciana decide sozinha.', 'Agora.', 'R$ 30 a 100 mil por mês.', '02/10', 'Vídeo Rebeca · Aprovaram menos', [
      ['sys', 'Consultoria fechada · R$ 3.897', 'ok'], ['lead', 'Obrigada, Rebeca! Já concentrei tudo na conta principal']]],
    ['Eduardo Lima', 'Lima Hamburgueria', 'Alimentação', 'Sumaré/SP', 'conversa', 97, 'Diagnóstico Completo', 'ia', 'Queria empréstimo, achou que a Lothem emprestava.', null, null, null, '10:17', 'Teste do site', [
      ['lead', 'Quanto vocês liberam?'], ['ia', 'A Lothem não empresta dinheiro, Eduardo. Quem empresta é o banco. O que a gente faz é te mostrar como o banco enxerga a sua empresa antes de você pedir.'], ['ia', 'E fica o alerta: se alguém disser que vai te emprestar e pedir pagamento antes de liberar, é golpe.'], ['lead', 'Ah entendi. E como sei o que o banco vê?']]],
    ['Sônia Barros', 'Barros Moda', 'Varejo de moda', 'Indaiatuba/SP', 'perdido', 97, 'Diagnóstico Completo', 'encerrada', 'CNPJ inapto na Receita.', null, null, null, '01/10', 'Teste do site', [
      ['ia', 'Sônia, com o CNPJ inapto o banco barra o pedido antes de qualquer análise. O primeiro passo é um contador ver as declarações em atraso.'], ['lead', 'Vou resolver com o contador primeiro'], ['sys', 'Encerrada · CNPJ inapto, retomar depois de regularizar']]],
    ['Gustavo Pires', 'Pires Climatização', 'Serviços', 'Valinhos/SP', 'qualificado', 97, 'Diagnóstico Completo', 'espera', 'Negado com cadastro limpo.', 'Gustavo decide sozinho.', 'Este mês.', 'R$ 30 a 100 mil por mês.', '10:09', 'Vídeo Rebeca · O que o banco olha', [
      ['lead', 'Prefiro falar por vídeo antes de pagar'], ['ia', 'Claro! A Rebeca faz uma chamada de vídeo rápida com você. Qual o melhor horário, hoje ou amanhã?'], ['sys', 'Pediu chamada de vídeo · passando para a Rebeca', 'gold']]],
    ['Renata Souza', 'Souza Odontologia', 'Saúde', 'Campinas/SP', 'link', 97, 'Diagnóstico Completo', 'aguardando', 'Pouco tempo de CNPJ (8 meses).', 'Renata decide sozinha.', 'Quer se preparar para 2027.', 'R$ 30 a 100 mil por mês.', '09:33', 'Carrossel Pronampe', [
      ['lead', 'Isso é golpe?'], ['ia', 'Faz muito bem em perguntar, Renata. Tem muito golpe de crédito por aí, e o roteiro deles é sempre o mesmo: prometem dinheiro e pedem um pagamento antes de liberar.'], ['ia', 'A gente não faz nada disso. CNPJ 42.367.944/0001-41, site lothem.com.br. Se quiser, a Rebeca faz uma chamada de vídeo com você.'], ['lead', 'Ok, me manda o link então'], ['ia', 'Aqui está: pay.cakto.com.br/gqg3w2t_1164272. Assim que pagar, te mando a autorização das consultas.']]],
  ];

  const owners = { conversa: 'ia', qualificado: 'u3', link: 'u3', pago: 'u3', autorizado: 'u3', relatorio: 'u1', rebeca: 'u1', consultoria: 'u1', perdido: 'u3' };
  const nexts = { conversa: 'Cibelle está atendendo', qualificado: 'Ofertar o Diagnóstico', link: 'Aguardando pagamento', pago: 'Aguardando autorização assinada', autorizado: 'Relatório até 11:30 · conversa amanhã 10h', relatorio: 'Marcar conversa com a Rebeca', rebeca: 'Apresentar a consultoria', consultoria: 'Consultoria em andamento', perdido: 'Retomar quando regularizar o CNPJ' };
  const temps = { conversa: 'frio', qualificado: 'morno', link: 'quente', pago: 'quente', autorizado: 'quente', relatorio: 'quente', rebeca: 'quente', consultoria: 'quente', perdido: 'frio' };
  const life = { consultoria: 'Cliente consultoria', pago: 'Cliente diagnóstico', autorizado: 'Cliente diagnóstico', relatorio: 'Cliente diagnóstico', rebeca: 'Cliente diagnóstico', perdido: 'Perdido' };
  o.contacts = []; o.deals = []; o.conversations = [];
  const log = [];
  P.forEach(([nm, co, seg, city, st, v, prod, cst, dor, dec, mom, cap, t, src, msgs], i) => {
    const id = 'k' + (i + 1), first = nm.split(' ')[0];
    o.contacts.push({ id, nm, co, seg, city, ph: '(19) 90000-31' + String(10 + i), em: first.toLowerCase() + '@' + co.split(' ')[0].toLowerCase() + '.exemplo', src: 'Meta · ' + src, owner: owners[st] === 'ia' ? 'u3' : owners[st], life: life[st] || (st === 'conversa' ? 'Lead' : 'Qualificado'), score: [0, 35, 62, 78, 88, 92, 94, 95, 97, 99][Math.min(9, Object.keys(nexts).indexOf(st) + 1)] || 40, last: /^\d/.test(t) && t.includes(':') ? 'hoje ' + t : t });
    o.deals.push({ id: 'x' + (i + 1), c: id, p: 'diag', s: st, v, temp: temps[st], owner: owners[st] === 'ia' ? 'u3' : owners[st], next: nexts[st], age: t.includes(':') ? 'hoje' : t, product: prod });
    const q = {}; if (dor) q.dor = dor; if (dec) q.decisor = dec; if (mom) q.momento = mom; if (cap) q.capacidade = cap;
    const cv = { id: 'cx' + (i + 1), c: id, inst: 'j1', st: cst, who: cst === 'humano' ? 'u1' : undefined, unread: cst === 'espera' || cst === 'ia' ? 1 : 0, t: t.includes(':') ? t : '08:00', conf: 90 + (i % 8), q, af: {},
      msgs: (msgs.map(([f, x, cls], j) => Object.assign({ f, x, t: t.includes(':') ? t : '09:' + String(10 + j) }, f === 'user' ? { u: 'u1' } : {}, cls ? { cls } : {}))) };
    if (cst === 'espera') { cv.slaType = 'transfer'; cv.slaSince = t; }
    o.conversations.push(cv);
    const add = (k, nmF, value, quote) => { const e = { id: 'l' + log.length, t: t.includes(':') ? t : '09:00', cv: cv.id, c: id, k, nm: nmF, value, quote, conf: 91 + (log.length % 8), by: 'ia' }; log.push(e); cv.af[k] = e; };
    add('co', 'Empresa', co, 'Tenho a ' + co); add('seg', 'Segmento', seg, co);
    if (dor) add('dor', 'Problema', dor, msgs[0][1]);
    if (cap) add('capacidade', 'Faturamento', cap, 'resposta do teste do site');
    if (mom) add('momento', 'Momento', mom, 'resposta na conversa');
    if (st !== 'conversa') add('etapa', 'Etapa do funil', o.pipelines[0].stages.find((s) => s.id === st).nm, 'avanço na conversa');
  });

  o.autofill = {
    on: true, minConf: 85,
    fields: [
      { k: 'cadastro', nm: 'Cadastro do contato', d: 'Empresa, segmento, cidade e e-mail que a pessoa conta na conversa.', on: true },
      { k: 'qualif', nm: 'Qualificação', d: 'Problema, quem decide, momento e faturamento, com o trecho da conversa como prova.', on: true },
      { k: 'score', nm: 'Pontuação e temperatura', d: 'Recalcula a cada resposta.', on: true },
      { k: 'etapa', nm: 'Etapa do funil e próximo passo', d: 'Move o negócio quando a conversa avança: qualificado, link, pago, autorização.', on: true },
      { k: 'task', nm: 'Tarefas e agenda', d: 'Cria a conversa de 30 minutos com a Rebeca.', on: true },
    ],
    never: ['CPF, RG e fotos de documentos', 'Dados bancários e senhas', 'Valor, taxa ou prazo de crédito'],
    stats: { today: log.length, corrected: 1 },
    log: log.sort((a, b) => (a.t < b.t ? 1 : -1)),
  };
  o.iaStats = { convs: 286, qual: '47,2%', sold: 41, soloSold: 33, transfers: 29, conf: 91, csat: '4,8', approvals: 37 };
  o.reviews = [{ id: 'w1', who: 'Gustavo Pires', co: 'Pires Climatização', q: 'Em quanto tempo o banco libera depois?', a: 'Normalmente em poucos dias.', conf: 48, why: 'Promessa de prazo. A resposta foi retida e não chegou ao lead.', skill: 'Cuidados legais', sent: false, blocked: true,
    ideal: 'Isso quem decide é o banco, Gustavo, pelas regras dele. O que a gente faz é te deixar preparado para a análise.' }];
  o.tasks = [
    { id: 'y1', t: 'Conversa de 30 min · Marcos Ribeiro (Ribeiro Materiais)', type: 'Video', who: 'u1', due: 1, at: '10:00', deal: 'x5', pri: 'alta', xp: 10 },
    { id: 'y2', t: 'Chamada de vídeo · Gustavo Pires antes de pagar', type: 'Video', who: 'u1', due: 0, at: '14:00', deal: 'x11', pri: 'alta', xp: 10 },
    { id: 'y3', t: 'Apresentar consultoria · André Costa', type: 'Handshake', who: 'u1', due: 1, at: '15:00', deal: 'x7', pri: 'alta', xp: 10 },
    { id: 'y4', t: 'Lembrar Fernanda de assinar a autorização', type: 'MessageCircle', who: 'u3', due: 0, at: '13:30', deal: 'x4', pri: 'média', xp: 10 },
  ];
  o.instances = [{ id: 'j1', nm: 'Lothem Crédito', type: 'oficial', num: '+55 19 99460-7410', st: 'on', quality: 'Alta', tier: '1.000 conversas iniciadas / 24 h', today: 63, agents: ['ia', 'u1', 'u3'], use: 'A Cibelle atende quem vem do teste do site e dos anúncios.' }];
  o.templates = [{ nm: 'retomar_diagnostico', cat: 'Marketing', st: 'Aprovado', lang: 'pt_BR', body: 'Oi, {{1}}! Aqui é a Cibelle, da equipe da Rebeca. Tem mais um ponto no seu caso que o banco olha. Posso te contar?' }];

  const M = o.metrics;
  M.goalLabel = 'Faturamento de outubro'; M.goal = 30000; M.done = 41 * 97 + 3 * 3897;
  M.kpis = [
    { k: 'Leads do teste e do Meta', v: '214', sub: 'no mês', delta: 18, spark: [22, 25, 28, 31, 30, 36, 42], go: 'contatos', hint: 'CPL R$ 6,40' },
    { k: 'Qualificados pela Cibelle', v: '101', delta: 12, spark: [10, 12, 13, 15, 14, 17, 20], go: 'atendimento', hint: '47% dos leads' },
    { k: 'Diagnósticos vendidos', v: '41', delta: 9, spark: [3, 4, 5, 6, 6, 8, 9], go: 'funis', hint: '33 sem ajuda humana' },
    { k: 'Consultorias fechadas', v: '3', delta: 1, spark: [0, 0, 1, 0, 1, 0, 1], go: 'funis', hint: 'R$ 11.691' },
    { k: 'Primeira resposta', v: '38', unit: 's', delta: 7, spark: [70, 61, 55, 49, 44, 40, 38], go: 'sdr', hint: 'mediana · Cibelle', invert: true },
    { k: 'Campos preenchidos pela IA', v: String(186 + log.length), delta: 22, spark: [18, 22, 25, 27, 30, 31, 33], go: 'sdr', hint: 'hoje: ' + log.length },
  ];
  M.funnel = [{ nm: 'Leads', v: 214 }, { nm: 'Qualificados', v: 101 }, { nm: 'Link enviado', v: 63 }, { nm: 'Diagnóstico pago', v: 41 }, { nm: 'Conversa com a Rebeca', v: 34 }, { nm: 'Consultoria', v: 3, gold: true }];
  M.funnelNote = 'Últimos 30 dias · a Cibelle não promete aprovação, valor, taxa ou prazo';
  M.series = { a: [5, 6, 7, 6, 8, 7, 6, 8, 9, 7, 8, 9, 7, 6, 8, 9, 10, 8, 9, 7, 8, 9, 10, 9, 8, 10, 11, 9, 10, 12], b: [1, 1, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2, 1, 1, 2, 2, 3, 2, 2, 1, 2, 2, 3, 2, 2, 2, 3, 2, 3, 3], la: 'Leads', lb: 'Diagnósticos vendidos', start: [8, 9] };
  M.campaigns = [
    { nm: '[CAPT] Teste do site · Vídeo Rebeca 40s', inv: 820, leads: 118, q: 61, d: 24, c: 2 },
    { nm: '[CAPT] Pronampe · Carrossel', inv: 540, leads: 64, q: 27, d: 11, c: 1 },
    { nm: '[VENDA] Diagnóstico · Checkout direto', inv: 410, leads: 32, q: 13, d: 6, c: 0 },
  ];
  M.campaignCols = ['Qualificados', 'Diagnósticos', 'Consultorias'];
  M.insight = 'O vídeo da Rebeca traz o lead mais barato e vende 1 diagnóstico a cada 5 leads. Coloque mais verba nele antes de testar criativo novo.';
  M.ia = { active: 2, handoffs: 2, reviews: 1, conf: 91, resp: '38 s', csat: '4,8' };
  M.ticker = [
    { t: '10:21', x: 'Cibelle começou a atender <b>Roberto Nunes</b> · Nunes Auto Peças' },
    { t: '10:17', x: 'Cibelle explicou para <b>Eduardo Lima</b> que a Lothem não empresta dinheiro' },
    { t: '10:12', x: 'Cibelle preencheu o faturamento de <b>Juliana Prado</b>' },
    { t: '09:58', x: 'Link do combo enviado para <b>Carlos Mendes</b>' },
    { t: '09:41', x: 'Pagamento confirmado: <b>Fernanda Lopes</b> · R$ 164', cls: 'ok' },
  ];
  M.alerts = [{ cls: 'cy', ic: 'Bot', t: 'Cibelle atendendo 2 conversas agora', go: 'atendimento' }, { cls: 'bad', ic: 'UserCheck', t: 'Gustavo Pires pediu chamada de vídeo com a Rebeca', go: 'atendimento' }];
  o.route = {
    cpl: 6.4, outbound: 0, rateNote: 'Taxas dos últimos 30 dias · consultoria a partir de R$ 3.897 (fictício)',
    steps: [
      { k: 'leads', nm: 'Leads do teste e do Meta', ic: 'Megaphone', who: ['u4'], mtd: 214, r: 0.472, verb: 'viram qualificados' },
      { k: 'qual', nm: 'Qualificados pela Cibelle', one: 'lead qualificado', ic: 'ListChecks', who: ['ia', 'u3'], mtd: 101, r: 0.406, verb: 'compram o diagnóstico' },
      { k: 'diag', nm: 'Diagnósticos vendidos', one: 'diagnóstico vendido', ic: 'CircleDollarSign', who: ['ia', 'u3'], mtd: 41, r: 0.83, value: 97, verb: 'fazem a conversa com a Rebeca' },
      { k: 'reun', nm: 'Conversas com a Rebeca', ic: 'Video', who: ['u1'], mtd: 34, r: 0.088, verb: 'fecham a consultoria' },
      { k: 'cons', nm: 'Consultorias fechadas', one: 'consultoria fechada', ic: 'BadgeCheck', who: ['u1'], mtd: 3, value: 3897 },
    ],
    sdr: 'u3', closer: 'u1', sdrStep: 'diag', closerStep: 'cons', closerPrep: 'reun',
  };

  /* Campanhas com métricas completas (topo, meio e, na de checkout, fundo de funil) */
  o.camps = M.campaigns.map((x, i) => {
    const clk = [1420, 760, 390][i], imp = [61200, 33800, 18900][i], checkout = i === 2;
    return { id: 'cred-cp' + i, nm: x.nm, spend: x.inv, clk, imp, pleads: x.leads, status: 'ativa',
      m: { video: i === 0, checkout, reach: Math.round(imp / [1.8, 1.6, 1.4][i]), thruplays: i === 0 ? 9800 : 0, landing_views: Math.round(clk * 0.81), engagement: [2140, 1310, 420][i],
        purchases: checkout ? 6 : 0, purchase_value: checkout ? 6 * 97 : 0, checkouts: checkout ? 19 : 0 },
      demo: { leads: x.leads, sales: x.c, revenue: x.c * 3897 + x.d * 97 } };
  });
})();

/* Campos que a IA preenche: nome e telefone (vêm do WhatsApp) e, no crédito, quanto a pessoa quer */
Object.assign(AF_FIELDS, { nm: 'Nome', ph: 'Telefone', credit: 'Crédito pretendido' });
Object.assign(AF_GROUP, { nm: 'cadastro', ph: 'cadastro', credit: 'qualif' });
(function demoCredit() {
  const o = DB.orgs.cred; if (!o) return;
  const want = { k1: 'R$ 50 mil · capital de giro', k2: 'R$ 60 mil · capital de giro', k3: 'R$ 300 mil · trocar dívida cara', k4: 'R$ 40 mil · equipamento', k5: 'R$ 150 mil · estoque', k6: 'R$ 30 mil · capital de giro', k7: 'R$ 250 mil · máquina (Finame)', k8: 'R$ 120 mil · capital de giro', k11: 'R$ 70 mil · capital de giro', k12: 'R$ 90 mil · reforma' };
  Object.entries(want).forEach(([id, v]) => {
    const c = o.contacts.find((x) => x.id === id); if (!c) return; c.credit = v;
    const cv = o.conversations.find((x) => x.c === id);
    if (cv) { const e = { id: 'lc' + id, t: cv.t, cv: cv.id, c: id, k: 'credit', nm: 'Crédito pretendido', value: v, quote: 'resposta na conversa', conf: 94, by: 'ia' }; cv.af = cv.af || {}; cv.af.credit = e; o.autofill.log.unshift(e); }
  });
})();

/* Na demonstração, o CRM abre na Lothem Crédito */
if (!/~/.test(location.hash)) S.org = 'cred';

/* ---------- simulação ao vivo: lead chega e a Cibelle atende, vende e preenche o CRM ---------- */
const simLeadBase = ACT.simLead;
ACT.simLead = () => {
  if (S.org !== 'cred') return simLeadBase();
  closePop(); closeOverlay();
  const o = O();
  if (S.sim && S.sim.running) { go('atendimento', { cv: S.sim.cv }); return; }
  const n = (S.simCount = (S.simCount || 0) + 1);
  const people = [
    { nm: 'Cláudia Ramos', fem: true, co: 'Ramos Pães e Doces', seg: 'Padaria', city: 'Sumaré/SP', years: '4 anos', em: 'claudia@ramospaes.exemplo' },
    { nm: 'Rafael Moreira', fem: false, co: 'Moreira Ferramentas', seg: 'Ferramentas', city: 'Hortolândia/SP', years: '3 anos', em: 'rafael@moreiraferramentas.exemplo' },
  ];
  const Pp = people[(n - 1) % people.length], first = Pp.nm.split(' ')[0], fem = Pp.fem;
  const cid = 'k' + uid(), did = 'x' + uid(), cvid = 'cx' + uid();
  o.contacts.unshift({ id: cid, nm: Pp.nm, co: 'Empresa não informada', seg: '—', city: '—', ph: '—', em: '—', src: 'Meta · Teste do site · Vídeo Rebeca 40s', owner: 'u3', life: 'Lead', score: 20, last: 'agora' });
  o.deals.unshift({ id: did, c: cid, p: 'diag', s: 'novo', v: 97, temp: 'frio', owner: 'u3', next: 'Cibelle está atendendo', age: 'agora', moved: true, product: 'Diagnóstico Completo' });
  const cv = { id: cvid, c: cid, inst: 'j1', st: 'ia', unread: 0, t: nowT(), conf: 95, q: {}, af: {}, sugg: [], isNew: true, msgs: [{ f: 'sys', x: 'Lead do teste em diagnostico.lothem.com.br · anúncio "[CAPT] Teste do site · Vídeo Rebeca 40s"', t: nowT() }] };
  o.conversations.unshift(cv);
  o.metrics.ticker.unshift({ t: cv.t, x: 'Lead novo do teste do site: <b>' + esc(Pp.nm) + '</b>' });
  S.cv = cvid; S.cvFilter = 'todas'; S.showThread = true;
  toast('Lead novo', Pp.nm + ' fez o teste de crédito no site.', '', 'Megaphone');
  if (S.route !== 'atendimento') go('atendimento', { cv: cvid }); else rerender();

  const ct = () => CT(cid), deal = () => DL(did);
  const T = (who) => () => { S.sim.typing = who; };
  const Msg = (f, x, extra = {}) => () => { S.sim.typing = null; cv.msgs.push(Object.assign({ f, x, t: nowT() }, extra)); cv.t = nowT(); };
  const F = (k, value, quote, conf) => () => { const c = ct(), prev = c[k]; autofill(cv, k, value, quote, () => { c[k] = value; }, () => { c[k] = prev; }, conf); };
  const Q = (k, v, score, quote) => () => {
    autofill(cv, k, v, quote, () => { cv.q[k] = v; S.flashQ = cvid + k; }, () => { delete cv.q[k]; });
    const c = ct(), d = deal(), prevS = c.score, prevT = d.temp, t = score >= 75 ? 'quente' : score >= 50 ? 'morno' : 'frio';
    autofill(cv, 'score', score + ' · ' + t, 'Pontuação recalculada com a resposta', () => { c.score = score; d.temp = t; }, () => { c.score = prevS; d.temp = prevT; });
  };
  const stage = (s, next, why) => () => {
    const d = deal(), prev = [d.s, d.next], idx = (x) => PIPE('diag').stages.findIndex((y) => y.id === x);
    autofill(cv, 'etapa', STAGE('diag', s).nm, why, () => { if (idx(s) > idx(d.s)) { d.s = s; d.next = next; d.moved = true; d.age = 'agora'; } }, () => { d.s = prev[0]; d.next = prev[1]; });
  };
  const steps = [
    [400, F('ph', '(19) 90000-32' + String(10 + n), 'número do WhatsApp', 99)],
    [700, T('lead')], [1300, Msg('lead', 'Oi, fiz o teste no site. O banco negou meu pedido de capital de giro e não falou o porquê')],
    [500, T('ia')], [1000, Msg('ia', 'Oi, ' + first + '! Aqui é a Cibelle, da equipe da Rebeca, da Lothem. Vi que você fez o teste de crédito no nosso site.')], [300, stage('conversa', 'Cibelle está qualificando', 'A pessoa respondeu e a conversa começou')],
    [400, T('ia')], [1100, Msg('ia', 'Não peço senha nem dado de banco, e nada aqui é cobrado sem você pedir. A Lothem não empresta dinheiro nem cobra para liberar empréstimo.')],
    [400, T('ia')], [800, Msg('ia', 'Me conta: qual é a sua empresa e há quanto tempo ela tem CNPJ?')],
    [700, T('lead')], [1400, Msg('lead', 'Tenho a ' + Pp.co + ', aqui em ' + Pp.city.split('/')[0] + '. CNPJ de ' + Pp.years)],
    [350, F('co', Pp.co, 'Tenho a ' + Pp.co)], [250, F('seg', Pp.seg, 'Tenho a ' + Pp.co)], [250, F('city', Pp.city, 'aqui em ' + Pp.city.split('/')[0])],
    [500, T('ia')], [1100, Msg('ia', 'E o dinheiro das vendas entra numa conta PJ ou parte cai no seu CPF?')],
    [700, T('lead')], [1300, Msg('lead', 'Metade cai no Pix da minha conta pessoal. Faturo uns 60 mil por mês')],
    [300, Q('capacidade', 'Cerca de R$ 60 mil por mês · metade no Pix pessoal.', 48, 'Metade cai no Pix da minha conta pessoal. Faturo uns 60 mil por mês')],
    [500, T('ia')], [900, Msg('ia', 'Entendi. Você sabe se tem alguma restrição no CNPJ ou no seu CPF?')],
    [700, T('lead')], [1200, Msg('lead', 'No CPF tem uma conta de cartão antiga')],
    [300, Q('dor', 'Capital de giro negado sem explicação · restrição antiga no CPF · metade do faturamento no CPF.', 62, 'No CPF tem uma conta de cartão antiga')],
    [500, T('ia')], [900, Msg('ia', 'E de quanto você precisaria, mais ou menos? Só para eu entender o tamanho do pedido.')],
    [700, T('lead')], [1100, Msg('lead', 'Uns 80 mil, para capital de giro')],
    [300, F('credit', 'R$ 80 mil · capital de giro', 'Uns 80 mil, para capital de giro', 96)],
    [600, T('ia')], [1400, Msg('ia', 'Pelo que você respondeu, o mais provável é isto: o banco só enxerga o que passa na conta da empresa. Com metade caindo no seu CPF, a ' + Pp.co + ' parece menor do que é.')],
    [400, T('ia')], [1200, Msg('ia', 'E no crédito da empresa o banco também olha o CPF do sócio. Aquela conta antiga pode estar travando o CNPJ.')],
    [400, T('ia')], [1000, Msg('ia', 'Uma coisa que dá para fazer hoje: passar a maquininha e o Pix das vendas para a conta da empresa. Faz sentido pra você?')],
    [700, T('lead')], [1100, Msg('lead', 'Faz muito sentido. Eu decido tudo ' + (fem ? 'sozinha' : 'sozinho') + ' e queria pedir de novo mês que vem')],
    [300, Q('decisor', first + ' decide ' + (fem ? 'sozinha' : 'sozinho') + '.', 74, 'Eu decido tudo ' + (fem ? 'sozinha' : 'sozinho'))],
    [300, Q('momento', 'Quer pedir crédito de novo no mês que vem.', 86, 'queria pedir de novo mês que vem')],
    [300, () => { stage('qualificado', 'Ofertar o Diagnóstico', 'Problema, decisor e momento confirmados')(); cv.msgs.push({ f: 'sys', x: 'Lead qualificado · problema, decisor e momento confirmados', t: nowT(), cls: 'ok' }); o.metrics.ticker.unshift({ t: nowT(), x: 'Cibelle qualificou <b>' + esc(Pp.nm) + '</b>' }); squadXP(25, 'Lead qualificado pela Cibelle · ' + Pp.nm); }],
    [600, T('ia')], [1500, Msg('ia', 'Então antes de pedir de novo vale ver o que o banco está vendo. A Rebeca faz o Diagnóstico Completo do seu CNPJ: cruza Serasa, Boa Vista e o SCR do Banco Central e mostra a nota estimada da empresa e o que ajustar primeiro.')],
    [400, T('ia')], [1200, Msg('ia', 'O relatório chega em PDF em até 1 hora e depois você conversa 30 minutos com ela. O valor é R$ 97, com garantia: se não te mostrar nada novo, a Rebeca devolve.')],
    [400, T('ia')], [900, Msg('ia', 'Como tem a restrição no CPF, dá para incluir o seu CPF por mais R$ 67. Quer que eu te mande o link?')],
    [700, T('lead')], [900, Msg('lead', 'Quero! Só o da empresa por enquanto')],
    [500, T('ia')], [1100, Msg('ia', 'Aqui está, ' + first + '. O pagamento é pela Cakto e dá para pagar no Pix, no cartão ou no boleto. A gente nunca pede Pix para conta de pessoa física.', { pay: true })],
    [300, stage('link', 'Aguardando pagamento', 'Link do Diagnóstico enviado a pedido')],
    [2200, () => {
      const pm = [...cv.msgs].reverse().find((m) => m.pay); if (pm) pm.paid = true;
      cv.msgs.push({ f: 'sys', x: 'Pagamento confirmado · R$ 97 pela Cakto', t: nowT(), cls: 'ok' });
      const d = deal(); d.s = 'pago'; d.next = 'Aguardando autorização assinada'; d.moved = true; d.age = 'agora';
      ct().life = 'Cliente diagnóstico'; o.metrics.done += 97;
      const k = o.metrics.kpis.find((x) => x.k === 'Diagnósticos vendidos'); if (k) k.v = String(parseInt(k.v, 10) + 1);
      o.metrics.ticker.unshift({ t: nowT(), x: 'Pagamento confirmado: <b>' + esc(Pp.nm) + '</b> · R$ 97', cls: 'ok' });
      toast('Pagamento confirmado · R$ 97', Pp.nm + ' comprou o Diagnóstico Completo.', '', 'CircleDollarSign');
      squadXP(80, 'Diagnóstico vendido · ' + Pp.nm);
    }],
    [500, T('ia')], [1100, Msg('ia', 'Recebi aqui, ' + first + '. Obrigada pela confiança! Falta só assinar a autorização para as consultas aos birôs e ao SCR. Te mando agora.')],
    [300, () => { cv.msgs.push({ f: 'sys', x: 'Termo de autorização enviado', t: nowT() }); }],
    [900, T('lead')], [1000, Msg('lead', 'Assinei')],
    [300, () => { stage('autorizado', 'Relatório em até 1 hora · agendar conversa', 'Autorização assinada')(); }],
    [500, T('ia')], [1000, Msg('ia', 'Autorização recebida! A Rebeca já começou o seu relatório. Vamos marcar a conversa de 30 minutos: prefere hoje ou amanhã? Manhã ou tarde?')],
    [700, T('lead')], [900, Msg('lead', 'Amanhã de manhã')],
    [500, T('ia')], [900, Msg('ia', 'Amanhã, 10h, com a Rebeca. Te lembro pela manhã.')],
    [600, () => {
      const task = { id: 't' + uid(), t: 'Conversa de 30 min · ' + Pp.nm + ' (' + Pp.co + ')', type: 'Video', who: 'u1', due: 1, at: '10:00', deal: did, pri: 'alta', xp: 10 };
      const made = autofill(cv, 'task', 'Conversa amanhã, 10:00 · Rebeca', 'Amanhã de manhã', () => { o.tasks.push(task); }, () => { const i = o.tasks.indexOf(task); if (i >= 0) o.tasks.splice(i, 1); });
      const d = deal(), prev = d.next; autofill(cv, 'next', 'Relatório até 1 h · conversa amanhã 10h', 'Amanhã, 10h, com a Rebeca', () => { d.next = 'Relatório até 1 h · conversa amanhã 10h'; }, () => { d.next = prev; });
      const filled = Object.keys(cv.af).length;
      cv.msgs.push({ f: 'sys', x: made ? 'Tarefa criada para a Rebeca · resumo do caso pronto para a conversa' : 'Conversa combinada · a tarefa espera aprovação', t: nowT(), cls: 'gold' });
      o.metrics.ticker.unshift({ t: nowT(), x: 'Cibelle preencheu ' + filled + ' campos do CRM de <b>' + esc(Pp.nm) + '</b>' });
      S.sim.running = false; S.sim.typing = null;
      toast('Fluxo concluído', 'Do teste do site ao pagamento e à agenda da Rebeca, sem ninguém tocar na conversa. A Cibelle preencheu ' + filled + ' campos do CRM.', '', 'Sparkles');
    }],
  ];
  S.sim = { running: true, cv: cvid, i: 0, steps, typing: null, timer: null };
  simRun();
};
