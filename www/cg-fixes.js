/* Crack Gate fixes: (1) lesson video + discussion access, (2) live tests count from admin, (3) exam-wise syllabus dropdown. Loaded last. */
(function () {
  const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';

  /* ---------- 1. Lessons: video only after enrolment, private support instead of public chat ---------- */
  const _nv = navigateTo;
  navigateTo = function (v) { if (v === 'hub' && !currentUser) return openAuthModal('student'); _nv(v); };

  const fx = { tab: 'qa', threads: [] };
  const isAdm = () => !!(currentUser && currentUser.role === 'admin');
  const course = () => mockStore.courses.find(x => x.id === hub.cid);

  window.fxEnroll = cid => { if (!currentUser) return openAuthModal('student'); startCheckout(cid); };
  window.fxTab = t => { fx.tab = t; fixForum(); };

  function fixVideo(c) {
    const box = document.querySelector('#view-hub .aspect-video'), ls = lessonsOf(c), l = ls.find(x => x.id === hub.lid) || ls[0];
    if (!box || owns(c) || (l && l.isFree)) return;
    const img = encodeURI(c.image || '').replace(/'/g, '%27');
    box.innerHTML = `<div class="absolute inset-0 bg-cover bg-center" style="background-image:url('${img}');filter:blur(14px) brightness(.45);transform:scale(1.1)"></div>
      <div class="relative h-full flex flex-col items-center justify-center text-white gap-3 text-center px-4"><i class="fa-solid fa-lock text-3xl"></i><div class="font-bold">Enroll now to unlock this lesson</div>
      <button onclick="fxEnroll('${c.id}')" class="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 font-bold text-sm">Enroll Now · ₹${c.price}</button></div>`;
  }
  function forumBox(c) {
    if (!currentUser) return `<div id="fxForum" class="${card} p-4 text-sm text-slate-500">Login to continue.</div>`;
    if (!owns(c)) return `<div id="fxForum" class="${card} p-4 text-sm flex flex-wrap items-center justify-between gap-3"><span class="text-slate-500">Discussion and instructor support are available after you enroll.</span><button onclick="fxEnroll('${c.id}')" class="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs">Enroll Now</button></div>`;
    const tb = (k, t) => `<button onclick="fxTab('${k}')" class="px-3 py-1.5 rounded-full text-xs font-bold ${fx.tab === k ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}">${t}</button>`;
    return `<div id="fxForum" class="${card} p-4 space-y-3"><div class="flex gap-2">${tb('qa', 'Q&amp;A (instructor)')}${tb('pv', isAdm() ? 'Student support' : 'Private support')}</div><div id="fxBody" class="space-y-2 text-sm"></div></div>`;
  }
  const bubble = m => `<div class="p-2 rounded-lg ${m.admin ? 'bg-sky-500/10' : 'bg-slate-50 dark:bg-slate-800'}"><b class="text-xs">${m.admin ? 'Instructor' : esc(m.name || 'You')}</b><div>${esc(m.text)}</div></div>`;
  const inputRow = (id, ph, onclick) => `<div class="flex gap-2"><input id="${id}" placeholder="${ph}" class="flex-1 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm"><button onclick="${onclick}" class="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold">Send</button></div>`;
  const lsKey = () => 'cg_fx_' + hub.cid + '_' + hub.lid;

  async function fixForum() {
    const c = course(), old = $('fxForum'); if (!c) return;
    if (old) old.outerHTML = forumBox(c);
    const body = $('fxBody'); if (!body) return;
    const mine = currentUser.uid, adm = isAdm(), pub = fx.tab === 'qa'; let list = [];
    try {
      if (cloud()) {
        let q = db.collection('courses').doc(hub.cid).collection('discussions').where('lessonId', '==', hub.lid);
        q = pub ? q.where('kind', '==', 'public') : adm ? q.where('kind', '==', 'private') : q.where('threadUid', '==', mine);
        list = (await q.get()).docs.map(d => d.data());
      } else list = lsGet(lsKey(), '[]').filter(m => pub ? m.kind === 'public' : adm || m.threadUid === mine);
    } catch (e) { body.innerHTML = '<div class="text-xs text-slate-500">Could not load messages.</div>'; return; }
    list.sort((a, b) => a.ts - b.ts);
    if (pub) {
      body.innerHTML = (list.map(bubble).join('') || '<div class="text-xs text-slate-500">No instructor notes for this lesson yet.</div>') +
        (adm ? inputRow('fxQa', 'Post a public note for this lesson...', "fxPost('qa')") : '<div class="text-xs text-slate-500">Have a doubt? Use the Private support tab. Only you and the instructor can see it.</div>');
    } else if (!adm) {
      body.innerHTML = '<div class="text-xs text-slate-500">Private chat: only you and the instructor can see this.</div>' + (list.map(bubble).join('') || '<div class="text-xs text-slate-500">No messages yet.</div>') + inputRow('fxMe', 'Message the instructor...', "fxPost('me')");
    } else {
      const g = {}; list.forEach(m => (g[m.threadUid] = g[m.threadUid] || []).push(m)); fx.threads = Object.keys(g);
      body.innerHTML = fx.threads.map((u, i) => `<div class="border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-2"><div class="text-xs font-bold text-sky-500">${esc((g[u].find(m => !m.admin) || {}).name || u)}</div>${g[u].map(bubble).join('')}${inputRow('fxR' + i, 'Reply...', `fxPost('re',${i})`)}</div>`).join('') || '<div class="text-xs text-slate-500">No student messages for this lesson.</div>';
    }
  }
  window.fxPost = async function (mode, i) {
    const el = $(mode === 'qa' ? 'fxQa' : mode === 'me' ? 'fxMe' : 'fxR' + i), t = el && el.value.trim(); if (!t || !currentUser) return;
    const adm = isAdm(); if (mode === 'qa' && !adm) return;
    const m = { uid: currentUser.uid, name: currentUser.name || currentUser.email.split('@')[0], admin: adm, text: t, lessonId: hub.lid, ts: Date.now(), kind: mode === 'qa' ? 'public' : 'private' };
    if (mode !== 'qa') m.threadUid = adm ? fx.threads[i] : currentUser.uid;
    if (cloud()) { try { await db.collection('courses').doc(hub.cid).collection('discussions').add(m); } catch (e) { return showToast('Could not send', 'error'); } }
    else { const a = lsGet(lsKey(), '[]'); a.push(m); localStorage.setItem(lsKey(), JSON.stringify(a)); }
    fixForum();
  };
  loadForum = function () {}; // the old public forum query is switched off
  const _rh = renderHub;
  renderHub = async function () { await _rh.apply(this, arguments); try { const c = course(); if (!c) return; fixVideo(c); const old = $('forumList'); if (old) old.parentElement.outerHTML = forumBox(c); fixForum(); } catch (e) { console.warn(e); } };

  /* ---------- 2. Mock tests: only what the admin published, live count ---------- */
  const _sync = syncFromFirestore;
  syncFromFirestore = async function () {
    await _sync();
    if (cloud()) try { mockStore.tests = (await db.collection('tests').get()).docs.map(d => d.data()); } catch (e) {}
  };
  const _rt = renderTests;
  renderTests = function () {
    const all = mockStore.tests; mockStore.tests = all.filter(t => t.isPublished !== false);
    try { _rt(); } finally { mockStore.tests = all; }
    const g = $('testsGrid'); if (!g) return;
    const n = g.querySelectorAll('button[onclick^="startCBTExam"]').length; let p = $('fxTestCount');
    if (!p) { g.insertAdjacentHTML('beforebegin', '<p id="fxTestCount" class="text-sm font-semibold text-sky-500"></p>'); p = $('fxTestCount'); }
    p.textContent = `Showing ${n} live test${n === 1 ? '' : 's'}`;
  };
  const _rma = renderMtAdmin;
  renderMtAdmin = function () {
    _rma(); const box = $('adminTab-mtests'), o = mockStore.tests.filter(t => !t.courseId && !t.isFree && !String(t.id).startsWith('b_')); if (!box || !o.length) return;
    box.insertAdjacentHTML('beforeend', `<div class="${card} p-6"><h3 class="font-bold text-lg mb-1">Tests not linked to a course</h3><p class="text-xs text-slate-500 mb-2">Students do not see these. Delete the ones you do not need.</p>${o.map(t => `<div class="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs"><span>${esc(t.title)} · ${t.qCount || (t.questions || []).length} Qs</span><button onclick="deleteMockTest('${t.id}')" class="text-red-500 font-bold">Delete</button></div>`).join('')}</div>`);
  };

  /* ---------- 3. Syllabus: Exam dropdown, then subjects, then topics ---------- */
  const GA = ['Verbal ability', 'Numerical ability', 'Analytical aptitude', 'Spatial aptitude'];
  Object.assign(SYLLABUS, {
    'GATE DA': { 'Probability and Statistics': ['Counting, axioms of probability', 'Conditional probability and Bayes theorem', 'Random variables and distributions', 'Mean, median, mode, standard deviation', 'Correlation and covariance', 'Central limit theorem', 'Hypothesis testing and confidence intervals'],
      'Linear Algebra': ['Vector spaces and subspaces', 'Linear dependence and independence', 'Matrices, determinant, rank, nullity', 'Systems of linear equations', 'Eigenvalues and eigenvectors', 'Projections, LU decomposition, SVD'],
      'Calculus and Optimization': ['Limits, continuity, differentiability', 'Taylor series', 'Maxima and minima', 'Single-variable optimization'],
      'Programming, Data Structures and Algorithms': ['Python programming', 'Stacks, queues, linked lists, trees, hash tables', 'Searching and sorting', 'Divide and conquer', 'Graph traversals, shortest path, spanning trees'],
      'Database Management and Warehousing': ['ER model and relational model', 'Relational algebra and SQL', 'Integrity constraints and normal forms', 'File organisation and indexing', 'Data warehouse schemas, hierarchies, measures'],
      'Machine Learning': ['Regression and logistic regression', 'kNN, naive Bayes, LDA', 'Support vector machines', 'Decision trees', 'Neural networks and MLP', 'Bias-variance, cross-validation', 'K-means and hierarchical clustering', 'PCA'],
      'Artificial Intelligence': ['Uninformed and informed search', 'Adversarial search', 'Propositional and predicate logic', 'Reasoning under uncertainty, variable elimination'], 'General Aptitude': GA },
    'GATE ECE': { 'Engineering Mathematics': ['Linear algebra', 'Calculus', 'Differential equations', 'Vector calculus', 'Complex analysis', 'Probability and statistics', 'Numerical methods'],
      'Networks, Signals and Systems': ['Network theorems, transient response', 'Two-port networks', 'Fourier, Laplace and Z transforms', 'LTI systems', 'Sampling'], 'Electronic Devices': ['Semiconductor physics', 'PN junction, BJT, MOSFET', 'LED, photodiode, solar cell'],
      'Analog Circuits': ['Diode circuits', 'BJT and MOSFET amplifiers', 'Op-amp circuits', 'Oscillators and feedback'], 'Digital Circuits': ['Boolean algebra', 'Combinational and sequential circuits', 'ADC and DAC', 'Microprocessor 8085'],
      'Control Systems': ['Transfer function', 'Time-domain response', 'Root locus', 'Bode and Nyquist', 'Stability'], 'Communications': ['Analog modulation', 'Digital modulation', 'Information theory', 'Noise and random processes'],
      'Electromagnetics': ['Maxwell equations', 'Wave propagation', 'Transmission lines', 'Waveguides', 'Antennas'], 'General Aptitude': GA },
    'GATE EE': { 'Engineering Mathematics': ['Linear algebra', 'Calculus', 'Differential equations', 'Complex variables', 'Probability and statistics', 'Numerical methods'], 'Electric Circuits': ['Network theorems', 'Transient analysis', 'Three-phase circuits', 'Resonance'],
      'Electromagnetic Fields': ['Electrostatics', 'Magnetostatics', 'Maxwell equations'], 'Signals and Systems': ['LTI systems', 'Fourier, Laplace, Z transforms', 'Sampling'], 'Electrical Machines': ['Transformers', 'DC machines', 'Induction machines', 'Synchronous machines'],
      'Power Systems': ['Transmission line parameters', 'Load flow', 'Fault analysis', 'Stability', 'Protection'], 'Control Systems': ['Transfer function', 'Root locus', 'Bode and Nyquist', 'State space'], 'Measurements': ['Bridges', 'Instrument transformers', 'Wattmeter and energy meter'],
      'Analog and Digital Electronics': ['Op-amp circuits', 'Combinational and sequential logic'], 'Power Electronics': ['Rectifiers', 'Choppers', 'Inverters'], 'General Aptitude': GA },
    'GATE ME': { 'Engineering Mathematics': ['Linear algebra', 'Calculus', 'Differential equations', 'Probability and statistics', 'Numerical methods'], 'Engineering Mechanics': ['Free body diagrams', 'Friction', 'Kinematics and dynamics'], 'Mechanics of Materials': ['Stress and strain', 'Mohr circle', 'Beams', 'Torsion', 'Buckling'],
      'Theory of Machines and Vibrations': ['Mechanisms', 'Gears and cams', 'Balancing', 'Free and forced vibration'], 'Machine Design': ['Design for static and fatigue loads', 'Bolts, shafts, bearings'], 'Fluid Mechanics': ['Fluid statics', 'Bernoulli and momentum', 'Boundary layer', 'Turbomachines'],
      'Heat Transfer': ['Conduction', 'Convection', 'Radiation', 'Heat exchangers'], 'Thermodynamics': ['Laws of thermodynamics', 'Entropy', 'Cycles', 'Psychrometrics'], 'Manufacturing Engineering': ['Casting, forming, welding', 'Machining', 'Metrology'], 'Industrial Engineering': ['Production planning', 'Inventory', 'Linear programming', 'Queuing'], 'General Aptitude': GA },
    'GATE CE': { 'Engineering Mathematics': ['Linear algebra', 'Calculus', 'Differential equations', 'Probability and statistics', 'Numerical methods'], 'Structural Engineering': ['Engineering mechanics', 'Structural analysis', 'Concrete structures', 'Steel structures'],
      'Geotechnical Engineering': ['Soil properties', 'Consolidation and shear strength', 'Foundations', 'Slope stability'], 'Water Resources': ['Fluid mechanics', 'Hydrology', 'Irrigation'], 'Environmental Engineering': ['Water treatment', 'Wastewater treatment', 'Air pollution'],
      'Transportation Engineering': ['Highway design', 'Traffic engineering', 'Pavement design'], 'Geomatics': ['Surveying', 'Photogrammetry and remote sensing'], 'General Aptitude': GA }
  });
  SYLLABUS['GATE CSE']['General Aptitude'] = SYLLABUS['GATE CSE']['General Aptitude'] || GA;
  const sy = { exam: null };
  window.fxSy = v => { sy.exam = v; renderSyllabus(); };
  renderSyllabus = function () {
    const exams = [...new Set([...Object.keys(SYLLABUS), ...mockStore.courses.map(c => c.category).filter(Boolean)])];
    if (!exams.includes(sy.exam)) sy.exam = exams.includes('GATE CSE') ? 'GATE CSE' : exams[0];
    const subs = SYLLABUS[sy.exam], n = subs ? Object.keys(subs).length : 0;
    $('view-syllabus').innerHTML = `<div><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Exam syllabus</p><h2 class="text-3xl font-extrabold">${esc(sy.exam)} syllabus</h2><p class="text-sm text-slate-500">Select an exam, then open a subject to see its topics.</p></div>
    <select onchange="fxSy(this.value)" class="w-full sm:w-80 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold">${exams.map(e => `<option value="${esc(e)}" ${e === sy.exam ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>` +
      (subs ? `<div class="text-xs text-slate-500">${n} subjects</div>` + Object.entries(subs).map(([s, t]) => `<details class="${card} p-4"><summary class="font-bold cursor-pointer">${esc(s)} <span class="text-xs text-slate-400 font-normal">· ${t.length} topics</span></summary><ul class="mt-3 text-sm space-y-1 list-disc ml-5 text-slate-600 dark:text-slate-300">${t.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')
        : `<div class="${card} p-6 text-sm text-slate-500">Syllabus for ${esc(sy.exam)} will be added soon.</div>`);
  };
})();
