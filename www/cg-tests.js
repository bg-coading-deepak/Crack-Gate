/* Course mock tests: subject-wise / series-wise tests live inside a course; visible to students only after purchase (+1 free sample). Compact checkout. */
const FREE_BADGE = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold uppercase">Free</span>';
let tstate = { course: 'ALL' }, tsig;
const cardCls = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';
const canTake = t => !!currentUser && (currentUser.role === 'admin' || t.isFree || String(t.id).startsWith('b_') || (t.courseId && courseState({ id: t.courseId }).s === 'active'));
const tcard = t => { const ok = canTake(t), n = t.qCount || (t.questions || []).length;
  return `<div class="${cardCls} p-4 flex flex-col justify-between gap-3"><div><div class="flex justify-between gap-2"><h4 class="font-bold text-sm leading-snug">${esc(t.title)}</h4>${t.isFree ? FREE_BADGE : !ok ? '<i class="fa-solid fa-lock text-slate-400 text-xs mt-1"></i>' : ''}</div>
  <div class="flex gap-4 text-xs text-slate-500 mt-2"><span><i class="fa-regular fa-clock mr-1"></i>${t.durationMinutes} min</span><span><i class="fa-solid fa-list-check mr-1"></i>${n} Qs</span></div></div>
  <button onclick="startCBTExam('${t.id}')" class="w-full py-2 rounded-xl text-xs font-bold ${ok ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${ok ? 'Start test' : currentUser ? 'Buy course to unlock' : 'Login to start'}</button></div>`; };
renderTests = function () {
  const g = $('testsGrid'), vis = mockStore.tests.filter(t => t.courseId || t.isFree), courses = mockStore.courses.filter(c => vis.some(t => t.courseId === c.id));
  g.className = 'space-y-8';
  if (!vis.length) { g.innerHTML = '<div class="text-center text-slate-500 py-16">Mock tests will appear here soon.</div>'; return; }
  const chips = ['ALL', ...courses.map(c => c.id)].map(id => `<button onclick="tstate.course='${id}';renderTests()" class="px-3 py-1.5 rounded-full text-xs font-bold ${tstate.course === id ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}">${id === 'ALL' ? 'All' : esc(courses.find(c => c.id === id).title)}</button>`).join('');
  const free = vis.filter(t => t.isFree), showFree = tstate.course === 'ALL' && free.length;
  const KINDS = [['full', 'Full-length tests'], ['subject', 'Subject-wise tests']];
  const sec = c => { const st = courseState(c), ts = vis.filter(t => t.courseId === c.id && !(t.isFree && showFree)); if (!ts.length) return '';
    return `<div class="space-y-4"><div class="${cardCls} p-5 flex flex-wrap items-center gap-3 justify-between"><div><h3 class="font-extrabold text-lg">${esc(c.title)}</h3><div class="text-xs text-slate-500 mt-1">₹${c.price} · ${durText(Number(c.accessDays) || 0)} · ${ts.length} tests</div>${statusLine(st)}</div>${st.s === 'active' ? '' : courseBtn(c, st)}</div>
    ${KINDS.map(([k, label]) => { const ks = ts.filter(t => (t.kind || 'subject') === k); if (!ks.length) return ''; const groups = [...new Set(ks.map(t => t.group || 'General'))];
      return `<div class="space-y-3"><div class="text-sm font-extrabold">${label}</div>${groups.map(gr => `<div><div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">${esc(gr)}</div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${ks.filter(t => (t.group || 'General') === gr).sort((x, y) => (x.order || 0) - (y.order || 0)).map(tcard).join('')}</div></div>`).join('')}</div>`; }).join('')}</div>`; };
  g.innerHTML = `<div class="flex flex-wrap gap-2">${chips}</div>${showFree ? `<div class="space-y-3"><div class="text-xs font-bold uppercase tracking-wider text-emerald-600">Free sample test</div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${free.map(tcard).join('')}</div></div>` : ''}${courses.filter(c => tstate.course === 'ALL' || c.id === tstate.course).map(sec).join('')}`;
};
const _scb = startCBTExam;
startCBTExam = async function (id) {
  if (!currentUser) return openAuthModal('student');
  const t = mockStore.tests.find(x => x.id === id); if (!t) return;
  if (!canTake(t)) { showToast('Buy this course to unlock this test', 'error'); return t.courseId ? startCheckout(t.courseId) : undefined; }
  if (t.qCount && !(t.questions && t.questions.length)) {
    try { const d = await db.collection('testQuestions').doc(id).get(); if (!d.exists) throw 0; t.questions = d.data().questions; } catch (e) { return showToast('Could not load the test. Check your course access.', 'error'); }
  }
  _scb(id);
};
setInterval(() => {
  mockStore.tests.forEach(t => { if (!Array.isArray(t.questions)) t.questions = []; });
  const s = JSON.stringify([mockStore.tests.map(t => t.id + (t.isFree ? 1 : 0)), mockStore.courses.length, currentUser && currentUser.enrolledCourses, currentUser && currentUser.enrollExpiry]);
  if (s !== tsig) { tsig = s; try { renderTests(); } catch (e) {} }
}, 700);
/* ---------- Admin: course mock tests ---------- */
$('adminTabBtn-payments').insertAdjacentHTML('afterend', `<button onclick="switchAdminTab('mtests')" id="adminTabBtn-mtests" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Course Mock Tests</button>`);
$('adminTab-payments').insertAdjacentHTML('afterend', '<div id="adminTab-mtests" class="hidden space-y-4"></div>');
const _satT = switchAdminTab;
switchAdminTab = function (t) { $('adminTab-mtests').classList.add('hidden'); $('adminTabBtn-mtests').className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'; _satT(t); if (t === 'mtests') renderMtAdmin(); };
function renderMtAdmin() {
  const rows = mockStore.courses.map(c => { const ts = mockStore.tests.filter(t => t.courseId === c.id); if (!ts.length) return '';
    return `<div class="py-2"><div class="font-bold text-sm mb-1">${esc(c.title)}</div>${ts.map(t => `<div class="flex justify-between items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs"><span>${t.kind === 'full' ? 'Full-length' : 'Subject-wise'} · ${esc(t.group || 'General')} · ${esc(t.title)} · ${t.qCount || t.questions.length} Qs · ${t.durationMinutes} min ${t.isFree ? FREE_BADGE : ''}</span><span class="whitespace-nowrap"><button onclick="toggleFree('${t.id}',${!t.isFree})" class="text-sky-500 font-bold mr-3">${t.isFree ? 'Remove free' : 'Make free'}</button><button onclick="deleteMockTest('${t.id}')" class="text-red-500 font-bold">Delete</button></span></div>`).join('')}</div>`; }).join('');
  $('adminTab-mtests').innerHTML = `<div class="${cardCls} p-6 space-y-3"><h3 class="font-bold text-lg">Add a mock test to a course</h3><p class="text-xs text-slate-500">Students see these only after buying the course. Only one test on the platform can be the free sample.</p>
  <div class="grid md:grid-cols-2 gap-3"><select id="mtCourse" class="${fld}">${mockStore.courses.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select><select id="mtKind" class="${fld}"><option value="subject">Subject-wise test</option><option value="full">Full-length test (series)</option></select><input id="mtGroup" required placeholder="Subject name or series name (e.g. Physics, Series 1)" class="${fld}">
  <input id="mtName" placeholder="Test name (e.g. Physics Full Length #1)" class="${fld}"><div class="grid grid-cols-2 gap-3"><input id="mtDur" type="number" min="1" value="180" class="${fld}"><label class="text-sm flex items-center gap-2"><input type="checkbox" id="mtFree"> Free sample</label></div>
  <input id="mtFile" type="file" accept=".csv" class="text-sm md:col-span-2"><textarea id="mtCsv" rows="3" placeholder="...or paste CSV: question, optA, optB, optC, optD, correct (A-D), solution, subject (optional)" class="${fld} md:col-span-2"></textarea></div>
  <div class="flex gap-2"><button onclick="saveMockTest()" class="${SELF} bg-purple-600 text-white">Create test</button><button onclick="mtTemplate()" class="${SELF} bg-slate-200 dark:bg-slate-700">Download CSV template</button></div></div>
  <div class="${cardCls} p-6"><h3 class="font-bold text-lg mb-2">Course tests</h3>${rows || '<p class="text-sm text-slate-500">No course tests yet.</p>'}</div>`;
}
function mtTemplate() {
  const csv = 'question,optA,optB,optC,optD,correct,solution,subject\n"What is 2+2?",3,4,5,6,B,"2+2 equals 4",Maths\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'mock-test-template.csv'; a.click();
}
async function saveFlags(id, free) {
  const t = mockStore.tests.find(x => x.id === id); t.isFree = free;
  if (cloud()) { await db.collection('tests').doc(id).set({ isFree: free }, { merge: true }); if (t.qCount) await db.collection('testQuestions').doc(id).set({ isFree: free }, { merge: true }); }
}
async function toggleFree(id, on) {
  try { if (on) for (const o of mockStore.tests.filter(x => x.isFree && x.id !== id)) await saveFlags(o.id, false); await saveFlags(id, on); showToast(on ? 'Marked as the free sample test' : 'Free flag removed', 'success'); }
  catch (e) { showToast(fbMsg(e), 'error'); } renderMtAdmin(); renderTests();
}
async function saveMockTest() {
  const g = id => $(id).value.trim(); let text = g('mtCsv'); const f = $('mtFile').files[0]; if (f) text = await f.text();
  const course = mockStore.courses.find(c => c.id === g('mtCourse')), group = g('mtGroup'), title = g('mtName');
  if (!course || !group || !title) return showToast('Select course and fill subject/series and test name', 'error');
  let rows = parseCsv(text); if (/^question$/i.test((rows[0] || [])[0] || '')) rows.shift();
  const qs = rows.map(r => { const [q, a, b, c, d, ans, sol, sub] = r.map(x => (x || '').trim()), correct = 'ABCD'.indexOf((ans || '').toUpperCase()), options = [a, b, c, d].filter(Boolean);
    return q && options.length >= 2 && correct >= 0 && correct < options.length ? { subject: sub || group, text: q, options, correct, solution: sol || 'See official solution.' } : null; }).filter(Boolean);
  if (!qs.length) return showToast('No valid questions found in the CSV', 'error');
  const free = $('mtFree').checked, t = { id: 'mt_' + Date.now(), title, category: course.category, durationMinutes: Number(g('mtDur')) || 180, courseId: course.id, group, kind: g('mtKind') || 'subject', isFree: free, qCount: qs.length, order: Date.now() };
  try {
    if (free) for (const o of mockStore.tests.filter(x => x.isFree)) await saveFlags(o.id, false);
    if (cloud()) { await db.collection('tests').doc(t.id).set(t); await db.collection('testQuestions').doc(t.id).set({ id: t.id, courseId: t.courseId, isFree: free, questions: qs }); }
  } catch (e) { return showToast(fbMsg(e), 'error'); }
  if (!mockStore.tests.some(x => x.id === t.id)) mockStore.tests.push({ ...t, questions: cloud() ? [] : qs });
  showToast(`Test created with ${qs.length} questions`, 'success'); $('mtName').value = ''; $('mtCsv').value = ''; $('mtFile').value = ''; renderMtAdmin(); renderTests();
}
async function deleteMockTest(id) {
  if (!confirm('Delete this test?')) return; mockStore.tests = mockStore.tests.filter(t => t.id !== id);
  if (cloud()) try { await db.collection('tests').doc(id).delete(); await db.collection('testQuestions').doc(id).delete(); } catch (e) { showToast(fbMsg(e), 'error'); }
  renderMtAdmin(); renderTests();
}
/* ---------- Checkout: compact, UPI only (the "Mock Purchase" test tab is removed so nobody can unlock for free) ---------- */
(function () {
  const mt = $('payTab-mock'); if (mt) mt.parentElement.style.display = 'none'; const mp = $('payPane-mock'); if (mp) mp.style.display = 'none'; // keep the element: switchPayTab() needs it
  document.head.insertAdjacentHTML('beforeend', '<style>#paymentModal>div{padding:1rem!important;max-height:94vh;overflow-y:auto}#paymentModal .space-y-4>*+*,#paymentModal .space-y-3>*+*{margin-top:.5rem!important}#upiQr{padding:4px!important}#upiQr canvas,#upiQr img{width:150px!important;height:150px!important}#paymentModal h3{font-size:1rem}#paymentModal #payAmountDisplay{font-size:1.25rem}</style>');
})();

/* ---------- Live access: an approval/purchase (or revoke) is reflected instantly, no re-login needed ---------- */
let unsubUser, unsubUid;
setInterval(() => {
  const u = currentUser && currentUser.uid; if (u === unsubUid) return; unsubUid = u; if (unsubUser) unsubUser();
  if (u && cloud()) unsubUser = db.collection('users').doc(u).onSnapshot(s => { if (!s.exists || !currentUser || currentUser.uid !== u) return; const d = s.data(); currentUser.enrolledCourses = d.enrolledCourses || []; currentUser.enrollExpiry = d.enrollExpiry || {}; currentUser.walletBalance = d.walletBalance || 0; }, () => {});
}, 700);

mockBuy = async function () { showToast('Test purchase is disabled. Please pay via UPI.', 'error'); }; // nobody can unlock a course for free
