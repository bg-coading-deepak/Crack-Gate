/* Crack Gate: register + single-device login, rank prediction, test builder, fitness, bookmarks/notes, syllabus, question stats */
const $ = id => document.getElementById(id);
const store = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const uidKey = p => p + (currentUser ? currentUser.uid : 'guest');
const allQs = () => Object.entries(PYQ_DATA).flatMap(([exam, subs]) => Object.entries(subs).flatMap(([subject, chs]) => chs.flatMap(c => c.qs.map(q => ({ ...q, exam, subject, chapter: c.name })))));
const dOf = q => q.diff || ['Easy', 'Medium', 'Hard'][q.id.charCodeAt(q.id.length - 1) % 3]; // set q.diff on your real questions

/* ---------- 1. Register + one active device per student ---------- */
let authMode = 'login', loggingIn = false, unsubSess = null;
(function () {
  const t = $('authModalTitle').parentElement;
  t.insertAdjacentHTML('beforeend', `<div class="flex gap-2 justify-center mt-3 text-xs font-bold"><button type="button" id="amLogin" onclick="setAuthMode('login')" class="px-4 py-1.5 rounded-lg">Login</button><button type="button" id="amReg" onclick="setAuthMode('register')" class="px-4 py-1.5 rounded-lg">Register</button></div>`);
  $('authEmail').parentElement.insertAdjacentHTML('beforebegin', `<div id="nameBox" class="hidden"><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Full Name</label><input id="authName" class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm"></div>`);
  setAuthMode('login');
})();
function setAuthMode(m) {
  authMode = m;
  $('amLogin').className = 'px-4 py-1.5 rounded-lg ' + (m === 'login' ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-700');
  $('amReg').className = 'px-4 py-1.5 rounded-lg ' + (m === 'register' ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-700');
  $('nameBox').classList.toggle('hidden', m !== 'register');
  $('authSubmitBtn').innerText = m === 'register' ? 'Create Student Account' : 'Login';
  if (m === 'register') $('authEmail').value = '';
}
function forceLogout(msg) { if (unsubSess) unsubSess(); showToast(msg || 'Logged out: this account was opened on another device.', 'error'); logoutUser(); }
function watchSession(uid) {
  if (!db) return; if (unsubSess) unsubSess();
  unsubSess = db.collection('users').doc(uid).onSnapshot(d => {
    const s = d.exists && d.data().sessionId;
    if (!loggingIn && s && s !== localStorage.getItem('cg_sid') && currentUser && currentUser.role !== 'admin') forceLogout();
  });
}
fetchUserProfile = async function (fu) {
  if (!db) return;
  const doc = await db.collection('users').doc(fu.uid).get();
  currentUser = doc.exists ? doc.data() : { uid: fu.uid, email: fu.email, role: 'student', enrolledCourses: [] };
  if (!loggingIn) {
    if (currentUser.role !== 'admin' && currentUser.sessionId && currentUser.sessionId !== localStorage.getItem('cg_sid')) return forceLogout();
    watchSession(fu.uid);
  }
  updateAuthUI();
};
handleAuthSubmit = async function (e) {
  e.preventDefault();
  const email = $('authEmail').value.trim(), password = $('authPassword').value, name = $('authName').value.trim();
  const isAdm = ADMIN_EMAILS.includes(email.toLowerCase());
  if (authMode === 'register' && (!name || password.length < 6)) return showToast('Enter name and a password of 6+ characters', 'error');
  const sid = 's_' + Date.now() + Math.random().toString(36).slice(2);
  loggingIn = true;
  try {
    if (isFirebaseActive && auth) {
      const cred = authMode === 'register' ? await auth.createUserWithEmailAndPassword(email, password) : await auth.signInWithEmailAndPassword(email, password);
      const ref = db.collection('users').doc(cred.user.uid), snap = await ref.get();
      currentUser = snap.exists ? snap.data() : { uid: cred.user.uid, email, name: name || email.split('@')[0], role: 'student', enrolledCourses: [] };
      currentUser.role = isAdm ? 'admin' : 'student'; currentUser.sessionId = sid;
      localStorage.setItem('cg_sid', sid);
      await ref.set(currentUser, { merge: true });
      watchSession(cred.user.uid);
    } else {
      let u = mockStore.users.find(x => x.email === email);
      if (authMode === 'register' && u) return showToast('Email already registered. Please login.', 'error');
      if (authMode === 'login' && !u) return showToast('No account found. Please register first.', 'error');
      if (!u) { u = { uid: 'u_' + Date.now(), email, name, role: isAdm ? 'admin' : 'student', enrolledCourses: [] }; mockStore.users.push(u); }
      currentUser = u;
    }
  } catch (err) { return showToast(err.message, 'error'); }
  finally { loggingIn = false; }
  await logUserLogin(currentUser); closeModal('authModal'); updateAuthUI();
  showToast('Welcome ' + (currentUser.name || currentUser.email), 'success');
  navigateTo(currentUser.role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
};
const _logout = logoutUser; logoutUser = function () { if (unsubSess) unsubSess(); _logout(); };

/* ---------- 2. Percentile + rank prediction ---------- */
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const _submit = submitCBTExam;
submitCBTExam = async function () {
  await _submit();
  const a = mockStore.test_attempts[0]; if (!a) return;
  const mean = 0.35 * a.total, sd = 0.18 * a.total, pct = Math.min(99.99, Math.max(0.01, 50 * (1 + erf((a.score - mean) / (sd * Math.SQRT2)))));
  const N = 100000, rank = Math.max(1, Math.round((1 - pct / 100) * N)), lo = Math.max(1, Math.round(rank * 0.85)), hi = Math.round(rank * 1.15);
  const old = $('cgRank'); if (old) old.remove();
  $('view-test-result').insertAdjacentHTML('afterbegin', `<div id="cgRank" class="p-5 rounded-2xl bg-gradient-to-r from-indigo-700 to-sky-600 text-white grid grid-cols-3 gap-3 text-center">
  <div><div class="text-xs opacity-80">Percentile</div><div class="text-2xl font-extrabold">${pct.toFixed(2)}</div></div>
  <div><div class="text-xs opacity-80">Expected rank</div><div class="text-2xl font-extrabold">${rank.toLocaleString('en-IN')}</div></div>
  <div><div class="text-xs opacity-80">Rank range</div><div class="text-lg font-bold">${lo.toLocaleString('en-IN')} - ${hi.toLocaleString('en-IN')}</div></div>
  <p class="col-span-3 text-[11px] opacity-80">Estimate vs a modelled cohort of ${N.toLocaleString('en-IN')} candidates. It becomes more accurate as more students attempt.</p></div>`);
};

/* ---------- 3. Question stats, bookmarks, notes (wrap practice) ---------- */
const getStat = async id => { if (isFirebaseActive && db) { try { const d = await db.collection('qstats').doc(id).get(); if (d.exists) return d.data(); } catch (e) {} } return store('cg_qstats', {})[id] || { a: 0, c: 0 }; };
const _pick = pickPractice;
pickPractice = function (k) {
  const q = pr.c.qs[pr.i], right = k === q.correct ? 1 : 0, s = store('cg_qstats', {}); s[q.id] = s[q.id] || { a: 0, c: 0 }; s[q.id].a++; s[q.id].c += right;
  localStorage.setItem('cg_qstats', JSON.stringify(s));
  if (isFirebaseActive && db) db.collection('qstats').doc(q.id).set({ a: firebase.firestore.FieldValue.increment(1), c: firebase.firestore.FieldValue.increment(right) }, { merge: true }).catch(() => {});
  _pick(k);
};
const _rp = renderPractice;
renderPractice = function () {
  _rp(); const q = pr.c.qs[pr.i], bm = store(uidKey('cg_bm_'), []), notes = store(uidKey('cg_notes_'), {});
  $('view-practice').insertAdjacentHTML('beforeend', `<div class="flex items-center gap-3 text-sm"><button onclick="toggleBm('${q.id}')" class="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-600 font-semibold"><i class="fa-${bm.includes(q.id) ? 'solid' : 'regular'} fa-bookmark"></i> ${bm.includes(q.id) ? 'Bookmarked' : 'Bookmark'}</button><span id="qstatTxt" class="text-xs text-slate-500"></span></div>
  <textarea id="qNote" placeholder="Your notes on this question..." onblur="saveNote('${q.id}')" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm" rows="3">${notes[q.id] || ''}</textarea>`);
  if (pr.picked !== null) getStat(q.id).then(s => { const el = $('qstatTxt'); if (el) el.innerText = s.a >= 5 ? Math.round(s.c / s.a * 100) + '% of students got this right (' + s.a + ' attempts)' : 'Be among the first to attempt this question'; });
};
function toggleBm(id) { const k = uidKey('cg_bm_'), b = store(k, []), i = b.indexOf(id); i < 0 ? b.push(id) : b.splice(i, 1); localStorage.setItem(k, JSON.stringify(b)); renderPractice(); }
function saveNote(id) { const k = uidKey('cg_notes_'), n = store(k, {}), v = $('qNote').value.trim(); v ? n[id] = v : delete n[id]; localStorage.setItem(k, JSON.stringify(n)); }

/* ---------- 4. Pages: builder, my prep, syllabus ---------- */
const SYLLABUS = { 'GATE CSE': { 'Engineering Mathematics': ['Discrete Mathematics', 'Linear Algebra', 'Calculus', 'Probability and Statistics'], 'Data Structures & Algorithms': ['Arrays, stacks, queues, linked lists', 'Trees, BST, heaps, graphs', 'Hashing', 'Sorting and searching', 'Asymptotic analysis', 'Greedy, DP, divide and conquer'], 'Operating Systems': ['Processes and threads', 'CPU scheduling', 'Synchronisation and deadlock', 'Memory management', 'File systems'], 'DBMS': ['ER model', 'Relational algebra and SQL', 'Normalisation', 'Transactions and concurrency', 'Indexing'], 'Computer Networks': ['OSI/TCP-IP layers', 'Routing', 'Congestion control', 'Application protocols'], 'Theory of Computation': ['Regular languages', 'CFG and PDA', 'Turing machines and decidability'], 'Digital Logic and COA': ['Boolean algebra', 'Combinational and sequential circuits', 'Pipelining', 'Cache and memory'], 'Compiler Design': ['Lexical analysis', 'Parsing', 'Intermediate code', 'Optimisation'] } };
['builder', 'prep', 'syllabus'].forEach(v => $('mainContainer').insertAdjacentHTML('beforeend', `<section id="view-${v}" class="hidden space-y-5 max-w-4xl mx-auto"></section>`));
$('navLinks').insertAdjacentHTML('beforeend', [['builder', 'fa-wand-magic-sparkles', 'Build Test'], ['syllabus', 'fa-list-check', 'Syllabus'], ['prep', 'fa-chart-pie', 'My Prep']].map(([v, i, t]) => `<button onclick="navigateTo('${v}')" class="nav-btn px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"><i class="fa-solid ${i} mr-1.5"></i> ${t}</button>`).join(''));
const _nav2 = navigateTo;
navigateTo = function (v) {
  ['builder', 'prep', 'syllabus'].forEach(x => $('view-' + x).classList.add('hidden'));
  _nav2(v);
  if (['builder', 'prep', 'syllabus'].includes(v)) { $('view-' + v).classList.remove('hidden'); ({ builder: renderBuilder, prep: renderPrep, syllabus: renderSyllabus })[v](); }
};
const card = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800';
const inp = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm';
function renderBuilder() {
  const subs = [...new Set(allQs().map(q => q.subject))];
  $('view-builder').innerHTML = `<div><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Custom test</p><h2 class="text-3xl font-extrabold">Build your own test in seconds.</h2><p class="text-sm text-slate-500">Every question comes from past year papers.</p></div>
  <div class="${card} space-y-4"><div><label class="text-xs font-bold uppercase text-slate-500">Subjects</label><div class="flex flex-wrap gap-3 mt-2">${subs.map(s => `<label class="text-sm flex items-center gap-1"><input type="checkbox" class="bSub" value="${s}" checked> ${s}</label>`).join('')}</div></div>
  <div class="grid grid-cols-2 gap-3"><div><label class="text-xs font-bold uppercase text-slate-500">Questions</label><input id="bCount" type="number" min="1" value="5" class="${inp}"></div><div><label class="text-xs font-bold uppercase text-slate-500">Difficulty</label><select id="bDiff" class="${inp}"><option>Any</option><option>Easy</option><option>Medium</option><option>Hard</option></select></div></div>
  <button onclick="buildTest()" class="px-5 py-2.5 bg-sky-600 text-white font-bold rounded-xl text-sm">Create test and start</button></div>`;
}
function buildTest() {
  if (!currentUser) return openAuthModal('student');
  const subs = [...document.querySelectorAll('.bSub:checked')].map(x => x.value), d = $('bDiff').value;
  let pool = allQs().filter(q => subs.includes(q.subject) && (d === 'Any' || dOf(q) === d)).sort(() => Math.random() - 0.5).slice(0, Number($('bCount').value) || 5);
  if (!pool.length) return showToast('No questions match. Try other filters.', 'error');
  const t = { id: 'b_' + Date.now(), title: `Custom Test (${pool.length} Qs${d === 'Any' ? '' : ', ' + d})`, category: 'Custom', durationMinutes: pool.length * 3,
    questions: pool.map(q => ({ subject: q.subject, text: q.text, options: q.options, correct: q.correct, solution: q.steps.join(' ') })) };
  mockStore.tests.push(t); startCBTExam(t.id);
}
function renderPrep() {
  const prog = store('cg_progress', {}), qs = allQs(), att = qs.filter(q => prog[q.id]), right = att.filter(q => prog[q.id] === 'right').length;
  const acc = att.length ? right / att.length : 0, cov = qs.length ? att.length / qs.length : 0, fit = Math.round(100 * (0.6 * acc + 0.4 * cov));
  const byCh = {}; qs.forEach(q => { const k = q.subject + ' › ' + q.chapter; byCh[k] = byCh[k] || { a: 0, r: 0, n: 0 }; byCh[k].n++; if (prog[q.id]) { byCh[k].a++; if (prog[q.id] === 'right') byCh[k].r++; } });
  const fix = Object.entries(byCh).map(([k, v]) => [k, v.a ? Math.round(v.r / v.a * 100) : -1, v.a]).sort((x, y) => x[1] - y[1]).slice(0, 4);
  const bm = store(uidKey('cg_bm_'), []), notes = store(uidKey('cg_notes_'), {}), byId = Object.fromEntries(qs.map(q => [q.id, q]));
  $('view-prep').innerHTML = `<h2 class="text-3xl font-extrabold">My Prep</h2>
  <div class="${card} flex items-center gap-6"><div class="text-5xl font-extrabold text-sky-500">${fit}</div><div><div class="font-bold">Exam fitness score</div><div class="text-xs text-slate-500">60% accuracy + 40% syllabus coverage, from ${att.length} of ${qs.length} PYQs attempted</div></div></div>
  <div class="${card}"><b>Fix next</b>${fix.map(([k, p, a]) => `<div class="flex justify-between text-sm mt-2"><span>${k}</span><span class="${p < 0 ? 'text-slate-400' : p < 50 ? 'text-red-500' : 'text-emerald-500'} font-bold">${p < 0 ? 'Not started' : p + '% (' + a + ' attempted)'}</span></div>`).join('') || '<p class="text-sm text-slate-500">Start practising to see this.</p>'}</div>
  <div class="${card}"><b>Bookmarks</b>${bm.map(id => byId[id] ? `<div class="text-sm mt-2">• ${byId[id].text}<span class="text-xs text-slate-400"> (${byId[id].chapter})</span></div>` : '').join('') || '<p class="text-sm text-slate-500 mt-1">No bookmarks yet. Bookmark questions while practising.</p>'}</div>
  <div class="${card}"><b>My notes</b>${Object.entries(notes).map(([id, n]) => byId[id] ? `<div class="text-sm mt-2"><span class="text-xs text-slate-400">${byId[id].chapter}: </span>${n}</div>` : '').join('') || '<p class="text-sm text-slate-500 mt-1">No notes yet.</p>'}</div>`;
}
function renderSyllabus() {
  $('view-syllabus').innerHTML = `<div><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Exam syllabus</p><h2 class="text-3xl font-extrabold">GATE CSE syllabus</h2><p class="text-sm text-slate-500">Subject and topic-wise. Edit SYLLABUS in cg-more.js to match the official brochure.</p></div>` +
    Object.entries(SYLLABUS['GATE CSE']).map(([s, t]) => `<details class="${card}"><summary class="font-bold cursor-pointer">${s} <span class="text-xs text-slate-400 font-normal">· ${t.length} topics</span></summary><ul class="mt-3 text-sm space-y-1 list-disc ml-5 text-slate-600 dark:text-slate-300">${t.map(x => `<li>${x}</li>`).join('')}</ul></details>`).join('');
}
