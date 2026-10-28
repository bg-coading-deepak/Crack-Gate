/* PYQ access: hidden from the public header. Admin ticks which exam/subject PYQs are free; students see only those, after login, inside Student Portal. */
let pyqAllowed = new Set(JSON.parse(localStorage.getItem('cg_pyq_access') || '[]')), pyqUid;
const pqAdm = () => !!(currentUser && currentUser.role === 'admin');
const pyqPairs = () => Object.keys(PYQ_DATA).flatMap(e => Object.keys(PYQ_DATA[e]).map(s => [e, s])).filter(([e, s]) => pqAdm() || pyqAllowed.has(e + '|' + s));
(function () { const b = document.querySelector('#navLinks button[onclick*="\'pyq\'"]'); if (b) b.classList.add('admin-only', 'hidden'); })();
const _navQ = navigateTo;
navigateTo = function (v) {
  if (v === 'builder' && !currentUser) return openAuthModal('student');
  if (v === 'pyq' || v === 'practice') {
    if (!currentUser) return openAuthModal('student');
    if (!pqAdm() && !pyqPairs().length) return showToast('No free PYQs are unlocked for you yet', 'error');
  }
  _navQ(v);
  if (v === 'student-dashboard') renderPyqPortal();
};
const _rpq = renderPyq;
renderPyq = async function () {
  if (pqAdm()) return _rpq();
  const keep = {}; pyqPairs().forEach(([e, s]) => { (keep[e] = keep[e] || {})[s] = PYQ_DATA[e][s]; });
  if (!Object.keys(keep).length) { $('view-pyq').innerHTML = '<p class="p-6 text-slate-500">No PYQs unlocked for you yet.</p>'; return; }
  if (!keep[cgp.exam]) cgp.exam = Object.keys(keep)[0]; if (!keep[cgp.exam][cgp.subject]) cgp.subject = null;
  const orig = { ...PYQ_DATA }, swap = o => { Object.keys(PYQ_DATA).forEach(k => delete PYQ_DATA[k]); Object.assign(PYQ_DATA, o); };
  swap(keep); try { await _rpq(); } finally { swap(orig); }
};
function startPyq(i) { const [e, s] = window.__pp[i]; cgp.exam = e; cgp.subject = s; cgp.view = 'chapter'; navigateTo('pyq'); }
function renderPyqPortal() {
  const sec = $('view-student-dashboard'); if (!sec) return; let b = $('dashPyq');
  if (!b) { sec.insertAdjacentHTML('beforeend', '<div id="dashPyq" class="mt-8"></div>'); b = $('dashPyq'); }
  const pairs = currentUser && !pqAdm() ? pyqPairs() : []; window.__pp = pairs;
  b.innerHTML = pairs.length ? `<h3 class="font-bold text-lg mb-3">Free PYQs</h3><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">${pairs.map(([e, s], i) => `<button onclick="startPyq(${i})" class="text-left p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-500"><div class="text-[10px] font-bold uppercase text-sky-500">${esc(e)}</div><b>${esc(s)}</b><div class="text-xs text-slate-500">${PYQ_DATA[e][s].length} chapters</div></button>`).join('')}</div>` : '';
}
const _rsd2 = renderStudentDashboard; renderStudentDashboard = function () { _rsd2(); renderPyqPortal(); };
async function loadPyqAccess() {
  if (!(cloud() && currentUser)) return;
  try { const d = await db.collection('settings').doc('pyqAccess').get(); if (d.exists) { pyqAllowed = new Set(d.data().allowed || []); localStorage.setItem('cg_pyq_access', JSON.stringify([...pyqAllowed])); renderPyqPortal(); } } catch (e) {}
}
setInterval(() => { const u = currentUser && currentUser.uid; if (u !== pyqUid) { pyqUid = u; loadPyqAccess(); renderPyqPortal(); } }, 600);
/* ---------- Admin: choose which PYQs are free ---------- */
const _rqa = renderQAdmin;
renderQAdmin = function () {
  _rqa();
  $('adminTab-questions').insertAdjacentHTML('afterbegin', `<div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"><h3 class="font-bold text-lg">Free PYQ access</h3><p class="text-xs text-slate-500">Tick the PYQs that logged-in students can open (shown inside their Student Portal). Unticked ones stay hidden.</p>
  ${Object.keys(PYQ_DATA).map(e => `<div><b class="text-sm">${esc(e)}</b><div class="flex flex-wrap gap-4 mt-1">${Object.keys(PYQ_DATA[e]).map(s => `<label class="text-sm flex items-center gap-1.5"><input type="checkbox" class="pyqChk" value="${esc(e + '|' + s)}" ${pyqAllowed.has(e + '|' + s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div></div>`).join('')}
  <button onclick="savePyqAccess()" class="${SELF} bg-purple-600 text-white">Save PYQ access</button></div>`);
};
async function savePyqAccess() {
  const v = [...document.querySelectorAll('.pyqChk:checked')].map(x => x.value); pyqAllowed = new Set(v); localStorage.setItem('cg_pyq_access', JSON.stringify(v));
  if (cloud()) try { await db.collection('settings').doc('pyqAccess').set({ allowed: v }); } catch (e) { return showToast(fbMsg(e), 'error'); }
  showToast('PYQ access saved', 'success');
}
