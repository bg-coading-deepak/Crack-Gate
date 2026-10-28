/* Crack Gate core: lazy hierarchy loading, custom tests, NTA CBT, analytics, tickets, per-user sync, guards */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const toExamQ = q => ({ subject: q.subject, text: q.text, options: q.options, correct: q.correct, solution: q.steps.join(' '), chapter: q.chapter, topic: q.topic || 'General', qid: q.id });
let allLoaded = false;

/* ---------- Exams > Subjects > Chapters > Topics > Questions (lazy) ---------- */
async function loadCatalog() {
  if (!(isFirebaseActive && db)) return;
  try {
    (await db.collection('chapters').get()).forEach(d => {
      const m = d.data(), sub = (PYQ_DATA[m.exam] = PYQ_DATA[m.exam] || {}), arr = (sub[m.subject] = sub[m.subject] || []);
      let ch = arr.find(c => c.name === m.name);
      if (!ch) { ch = { name: m.name, weight: m.weight || 'Medium', topics: 0, qs: [], exam: m.exam, subject: m.subject }; arr.push(ch); }
      Object.assign(ch, { remote: true, count: m.count || 0, topicList: m.topics || [], topics: (m.topics || []).length, loaded: ch.loaded || false });
    });
  } catch (e) { console.warn(e); }
}
async function loadChapter(c) {
  if (!c.remote || c.loaded || !(isFirebaseActive && db)) return;
  try {
    (await db.collection('questions').where('exam', '==', c.exam).where('subject', '==', c.subject).where('chapter', '==', c.name).get()).forEach(d => addQ(d.data()));
    c.loaded = true;
  } catch (e) { showToast('Could not load questions', 'error'); }
}
async function ensureAllQs() {
  if (allLoaded || !(isFirebaseActive && db)) return;
  try {
    (await db.collection('questions').get()).forEach(d => addQ(d.data()));
    Object.values(PYQ_DATA).forEach(s => Object.values(s).forEach(a => a.forEach(c => { c.loaded = true; }))); allLoaded = true;
  } catch (e) { console.warn(e); }
}
saveQ = async function (r) {
  r.topic = r.topic || 'General';
  if (!addQ(r)) return false;
  const list = JSON.parse(localStorage.getItem('cg_customq') || '[]'); list.push(r); localStorage.setItem('cg_customq', JSON.stringify(list));
  if (isFirebaseActive && db) {
    try {
      await db.collection('questions').doc(r.id).set(r);
      await db.collection('chapters').doc(slug(r.exam) + '__' + slug(r.subject) + '__' + slug(r.chapter)).set({
        exam: r.exam, subject: r.subject, name: r.chapter, topics: firebase.firestore.FieldValue.arrayUnion(r.topic), count: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    } catch (e) { showToast('Could not save to the server. Please login as admin.', 'error'); }
  }
  return true;
};
const _rpyq = renderPyq;
renderPyq = async function () {
  const arr = PYQ_DATA[cgp.exam] && PYQ_DATA[cgp.exam][cgp.subject];
  if (cgp.view === 'year' && arr) await Promise.all(arr.map(loadChapter));
  _rpyq();
};
function startPracticeWith(name, qs) { pr = { base: { name, qs }, c: { name, qs }, i: 0, picked: null }; navigateTo('practice'); renderPractice(); }
startPractice = async function (i) {
  const c = cgp.list[i]; await loadChapter(c);
  if (!c.qs.length) return showToast('No questions in this chapter yet', 'info');
  startPracticeWith(c.name, c.qs);
};
function practiceTopic(t) { pr.c = { name: pr.base.name, qs: t ? pr.base.qs.filter(q => (q.topic || 'General') === t) : pr.base.qs }; pr.i = 0; pr.picked = null; renderPractice(); }
const _rp3 = renderPractice;
renderPractice = function () {
  _rp3();
  const topics = [...new Set((pr.base || pr.c).qs.map(q => q.topic || 'General'))];
  if (topics.length > 1) $('view-practice').insertAdjacentHTML('afterbegin', `<div class="flex flex-wrap gap-2 text-xs"><button onclick="practiceTopic('')" class="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800">All topics</button>${topics.map(t => `<button onclick="practiceTopic('${t.replace(/'/g, '')}')" class="px-3 py-1 rounded-full bg-sky-600/15 text-sky-600 font-semibold">${t}</button>`).join('')}</div>`);
};

/* ---------- Custom test generator (chapters, count, difficulty, timer) ---------- */
const chapterPicker = cls => {
  const by = {}; allQs().forEach(q => { (by[q.subject] = by[q.subject] || new Set()).add(q.chapter); });
  return Object.entries(by).map(([s, set]) => `<div><div class="text-xs font-bold text-slate-500 mt-2">${s}</div><div class="flex flex-wrap gap-3">${[...set].map(c => `<label class="text-sm flex items-center gap-1"><input type="checkbox" class="${cls}" value="${c}" checked> ${c}</label>`).join('')}</div></div>`).join('') || '<p class="text-sm text-slate-500">Add questions first.</p>';
};
const poolFor = (cls, diff, n) => {
  const ch = [...document.querySelectorAll('.' + cls + ':checked')].map(x => x.value);
  return allQs().filter(q => ch.includes(q.chapter) && (diff === 'Any' || dOf(q) === diff)).sort(() => Math.random() - 0.5).slice(0, n);
};
renderBuilder = async function () {
  $('view-builder').innerHTML = '<p class="text-sm text-slate-500">Loading...</p>'; await ensureAllQs();
  $('view-builder').innerHTML = `<div><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Custom test</p><h2 class="text-3xl font-extrabold">Build your own test in seconds.</h2></div>
  <div class="${card} space-y-4"><div><label class="text-xs font-bold uppercase text-slate-500">Chapters</label>${chapterPicker('bCh')}</div>
  <div class="grid grid-cols-3 gap-3"><div><label class="text-xs font-bold uppercase text-slate-500">Questions</label><input id="bCount" type="number" min="1" value="10" oninput="$('bMin').value=this.value*2" class="${inp}"></div>
  <div><label class="text-xs font-bold uppercase text-slate-500">Timer (min)</label><input id="bMin" type="number" min="1" value="20" class="${inp}"></div>
  <div><label class="text-xs font-bold uppercase text-slate-500">Difficulty</label><select id="bDiff" class="${inp}"><option>Any</option><option>Easy</option><option>Medium</option><option>Hard</option></select></div></div>
  <button onclick="buildTest()" class="px-5 py-2.5 bg-sky-600 text-white font-bold rounded-xl text-sm">Generate test and start</button></div>`;
};
buildTest = function () {
  if (!currentUser) return openAuthModal('student');
  const pool = poolFor('bCh', $('bDiff').value, Number($('bCount').value) || 10);
  if (!pool.length) return showToast('No questions match. Change chapters or difficulty.', 'error');
  const t = { id: 'b_' + Date.now(), title: `Custom Test (${pool.length} Qs)`, category: 'Custom', durationMinutes: Number($('bMin').value) || pool.length * 2, questions: pool.map(toExamQ) };
  mockStore.tests.push(t); startCBTExam(t.id);
};

/* ---------- NTA-style CBT: 5 palette states, subject tabs, per-question time, +4 / -1 ---------- */
let qEnter = 0;
const st = i => cbtAnswers[i] || (cbtAnswers[i] = { selected: null, marked: false, visited: false, time: 0 });
function leaveQ() { if (!activeCbtExam) return; st(cbtCurrentQIndex).time += Math.round((Date.now() - qEnter) / 1000); qEnter = Date.now(); }
function goQ(i) { leaveQ(); cbtCurrentQIndex = i; st(i).visited = true; renderCBTQuestion(); renderCBTPalette(); }
jumpToCBTQuestion = goQ;
const _startCbt = startCBTExam;
startCBTExam = function (id) {
  if (!currentUser) return openAuthModal('student');
  _startCbt(id); if (!activeCbtExam) return;
  cbtAnswers = {}; qEnter = Date.now(); st(0).visited = true;
  document.querySelector('#view-cbt-engine .grid.grid-cols-2.gap-2.text-xs').innerHTML = [['bg-emerald-500', 'Answered'], ['bg-red-500', 'Not Answered'], ['bg-slate-300', 'Not Visited'], ['bg-purple-600', 'Marked for Review'], ['bg-purple-600 ring-2 ring-emerald-400', 'Answered & Marked']].map(([c, t]) => `<div class="flex items-center space-x-2"><span class="w-3 h-3 rounded-full ${c} inline-block"></span><span>${t}</span></div>`).join('');
  window.onbeforeunload = () => 'Your test is in progress.';
  renderCBTQuestion(); renderCBTPalette();
};
renderCBTQuestion = function () {
  const q = activeCbtExam.questions[cbtCurrentQIndex], a = st(cbtCurrentQIndex);
  $('cbtQuestionNum').innerText = `Question ${cbtCurrentQIndex + 1} · ${q.subject} · +4 / −1`;
  $('cbtQuestionText').innerText = q.text;
  $('cbtOptionsList').innerHTML = q.options.map((o, k) => `<label onclick="selectCBTOption(${k})" class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${a.selected === k ? 'border-sky-500 bg-sky-500/10' : 'border-slate-200 dark:border-slate-700'}"><input type="radio" name="cbtOpt" ${a.selected === k ? 'checked' : ''}><span class="text-sm font-medium">${'ABCD'[k]}. ${o}</span></label>`).join('');
  const subs = [...new Set(activeCbtExam.questions.map(x => x.subject))];
  $('cbtSubjectTabs').innerHTML = subs.map(s => `<button onclick="goQ(${activeCbtExam.questions.findIndex(x => x.subject === s)})" class="px-4 py-2 rounded-lg whitespace-nowrap ${s === q.subject ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}">${s}</button>`).join('');
};
selectCBTOption = function (k) { st(cbtCurrentQIndex).selected = k; renderCBTQuestion(); renderCBTPalette(); };
cbtAction = function (type) {
  const i = cbtCurrentQIndex, a = st(i), last = activeCbtExam.questions.length - 1;
  if (type === 'clear') { a.selected = null; a.marked = false; }
  else if (type === 'mark') { a.marked = true; if (i < last) return goQ(i + 1); }
  else if (type === 'save-next' && i < last) return goQ(i + 1);
  renderCBTQuestion(); renderCBTPalette();
};
renderCBTPalette = function () {
  $('cbtPaletteGrid').innerHTML = activeCbtExam.questions.map((_, i) => {
    const a = cbtAnswers[i]; let c = 'bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white';
    if (a && a.visited) c = a.marked ? 'bg-purple-600 text-white' : a.selected !== null ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white';
    const dot = a && a.marked && a.selected !== null ? '<span class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border border-white"></span>' : '';
    return `<button onclick="goQ(${i})" class="relative w-8 h-8 rounded-lg text-xs font-bold ${c} ${i === cbtCurrentQIndex ? 'ring-2 ring-sky-400' : ''}">${i + 1}${dot}</button>`;
  }).join('');
};
function rankHtml(score, total) {
  const mean = 0.35 * total, sd = 0.18 * total, pct = Math.min(99.99, Math.max(0.01, 50 * (1 + erf((score - mean) / (sd * Math.SQRT2))))), N = 100000, rank = Math.max(1, Math.round((1 - pct / 100) * N));
  return `<div id="cgRank" class="p-5 rounded-2xl bg-gradient-to-r from-indigo-700 to-sky-600 text-white grid grid-cols-3 gap-3 text-center"><div><div class="text-xs opacity-80">Percentile</div><div class="text-2xl font-extrabold">${pct.toFixed(2)}</div></div><div><div class="text-xs opacity-80">Expected rank</div><div class="text-2xl font-extrabold">${rank.toLocaleString('en-IN')}</div></div><div><div class="text-xs opacity-80">Range</div><div class="text-lg font-bold">${Math.round(rank * .85).toLocaleString('en-IN')} - ${Math.round(rank * 1.15).toLocaleString('en-IN')}</div></div><p class="col-span-3 text-[11px] opacity-80">Estimated against a modelled cohort of 1,00,000 candidates.</p></div>`;
}
function toggleBmId(id) { const k = uidKey('cg_bm_'), b = store(k, []), i = b.indexOf(id); i < 0 ? b.push(id) : b.splice(i, 1); localStorage.setItem(k, JSON.stringify(b)); showToast(i < 0 ? 'Bookmarked for revision' : 'Bookmark removed', 'success'); }
submitCBTExam = async function () {
  if (!activeCbtExam || !currentUser) return;
  clearInterval(cbtTimerInterval); leaveQ(); window.onbeforeunload = null;
  let score = 0, correct = 0, wrong = 0; const subj = {}, chap = {}, qTimes = [];
  activeCbtExam.questions.forEach((q, i) => {
    const a = cbtAnswers[i] || { selected: null, time: 0 }, s = subj[q.subject] = subj[q.subject] || { score: 0, correct: 0, wrong: 0, skipped: 0, time: 0, n: 0 };
    s.n++; s.time += a.time || 0; qTimes.push(a.time || 0);
    if (a.selected === null || a.selected === undefined) s.skipped++;
    else if (a.selected === q.correct) { score += 4; correct++; s.score += 4; s.correct++; } else { score -= 1; wrong++; s.score -= 1; s.wrong++; }
    if (q.chapter) { const c = chap[q.chapter] = chap[q.chapter] || { a: 0, c: 0 }; if (a.selected !== null && a.selected !== undefined) { c.a++; if (a.selected === q.correct) c.c++; } }
  });
  const total = activeCbtExam.questions.length * 4, accuracy = correct + wrong ? Math.round(correct / (correct + wrong) * 100) : 0;
  const rec = { testId: activeCbtExam.id, testTitle: activeCbtExam.title, uid: currentUser.uid, email: currentUser.email, score, total, correct, wrong, accuracy, timeTakenSecs: Math.round((Date.now() - cbtStartTime) / 1000), subjects: subj, chapters: chap, qTimes, timestamp: new Date().toISOString() };
  mockStore.test_attempts.unshift(rec);
  if (isFirebaseActive && db) { try { await db.collection('test_attempts').add(rec); } catch (e) { console.warn(e); } }
  $('resScore').innerText = `${score}/${total}`; $('resAccuracy').innerText = accuracy + '%'; $('resCounts').innerText = `${correct} / ${wrong}`; $('resTime').innerText = Math.floor(rec.timeTakenSecs / 60) + 'm ' + (rec.timeTakenSecs % 60) + 's';
  ['cgRank', 'cgSubj'].forEach(i => { const o = $(i); if (o) o.remove(); });
  const m = s => Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  $('solutionBreakdown').insertAdjacentHTML('beforebegin', rankHtml(score, total) + `<div id="cgSubj" class="${card} overflow-x-auto"><b>Subject-wise analysis</b><table class="w-full text-sm mt-2"><tr class="text-xs text-slate-500 text-left"><th>Subject</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Time</th></tr>${Object.entries(subj).map(([k, s]) => `<tr><td class="py-1">${k}</td><td>${s.score}</td><td class="text-emerald-500">${s.correct}</td><td class="text-red-500">${s.wrong}</td><td>${s.skipped}</td><td>${m(s.time)}</td></tr>`).join('')}</table></div>`);
  $('solutionBreakdown').innerHTML = activeCbtExam.questions.map((q, i) => {
    const a = cbtAnswers[i] || { selected: null }, ok = a.selected === q.correct, skip = a.selected === null || a.selected === undefined;
    return `<div class="${card} space-y-2 border-l-4 ${skip ? 'border-slate-400' : ok ? 'border-emerald-500' : 'border-red-500'}"><div class="flex justify-between text-xs text-slate-500"><span>Q${i + 1} · ${q.subject}${q.chapter ? ' · ' + q.chapter : ''}</span><span>${skip ? 'Skipped' : ok ? '+4' : '-1'} · ${m(a.time || 0)}${q.qid ? ` · <button onclick="toggleBmId('${q.qid}')" class="text-amber-500 font-bold">Bookmark</button>` : ''}</span></div><div class="font-medium">${q.text}</div><div class="text-sm">Your answer: <b>${skip ? '-' : q.options[a.selected]}</b> · Correct: <b class="text-emerald-500">${q.options[q.correct]}</b></div><div class="text-sm bg-sky-500/10 rounded-xl p-3"><b>Step-by-step solution:</b> ${q.solution || 'Solution not provided.'}</div></div>`;
  }).join('');
  navigateTo('test-result');
};

/* ---------- Per-user data (progress, bookmarks, notes), history, tickets: stored in the database ---------- */
let lastUid = null, lastPushed = '', syncing = false, unsubHist = null;
const snap = () => JSON.stringify({ progress: store('cg_progress', {}), bm: store(uidKey('cg_bm_'), []), notes: store(uidKey('cg_notes_'), {}) });
logUserLogin = async function (u) {
  const e = { uid: u.uid, email: u.email, role: u.role, timestamp: new Date().toISOString(), userAgent: navigator.userAgent.substring(0, 120), platform: navigator.platform || '', language: navigator.language, screen: screen.width + 'x' + screen.height, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  mockStore.login_history.unshift(e);
  if (isFirebaseActive && db) { try { await db.collection('login_history').add(e); } catch (err) { console.warn(err); } }
  renderLoginHistoryTables();
};
const byTime = (a, b) => String(b.timestamp || b.ts).localeCompare(String(a.timestamp || a.ts));
async function onUserChange() {
  if (unsubHist) { unsubHist(); unsubHist = null; }
  if (!currentUser) { if (isFirebaseActive) { localStorage.removeItem('cg_progress'); lastPushed = ''; } return; }
  if (!(isFirebaseActive && db)) return;
  syncing = true;
  try {
    const d = await db.collection('user_data').doc(currentUser.uid).get();
    if (d.exists) { const x = d.data(); localStorage.setItem('cg_progress', JSON.stringify(x.progress || {})); localStorage.setItem(uidKey('cg_bm_'), JSON.stringify(x.bm || [])); localStorage.setItem(uidKey('cg_notes_'), JSON.stringify(x.notes || {})); }
    lastPushed = snap();
    const adm = currentUser.role === 'admin', mine = c => adm ? db.collection(c) : db.collection(c).where('uid', '==', currentUser.uid);
    mockStore.test_attempts = (await mine('test_attempts').get()).docs.map(x => x.data()).sort(byTime).slice(0, 300);
    mockStore.support_tickets = (await mine('support_tickets').get()).docs.map(x => x.data()).sort(byTime);
    if (adm) unsubHist = db.collection('login_history').orderBy('timestamp', 'desc').limit(200).onSnapshot(s => { mockStore.login_history = s.docs.map(x => x.data()); renderLoginHistoryTables(); });
    else { mockStore.login_history = (await mine('login_history').get()).docs.map(x => x.data()).sort(byTime); renderLoginHistoryTables(); }
    renderTickets(); renderStudentDashboard(); if (adm) renderAdminDashboard();
  } catch (e) { console.warn(e); }
  syncing = false;
}
setInterval(() => {
  if ((currentUser ? currentUser.uid : null) !== lastUid) { lastUid = currentUser ? currentUser.uid : null; onUserChange(); return; }
  if (currentUser && isFirebaseActive && db && !syncing) { const s = snap(); if (s !== lastPushed) { lastPushed = s; db.collection('user_data').doc(currentUser.uid).set(JSON.parse(s)).catch(() => {}); } }
}, 3000);
window.addEventListener('load', async () => {
  if (isFirebaseActive && auth) { try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {} }
  await loadCatalog(); renderPyq();
});

/* ---------- Support tickets (student raises, admin replies) ---------- */
handleCreateTicket = async function (e) {
  e.preventDefault();
  const t = { id: 'tk_' + Date.now(), uid: currentUser.uid, email: currentUser.email, subject: $('ticketSubject').value, message: $('ticketMessage').value, status: 'Open', reply: '', timestamp: new Date().toISOString() };
  mockStore.support_tickets.unshift(t);
  if (isFirebaseActive && db) { try { await db.collection('support_tickets').doc(t.id).set(t); } catch (err) { showToast('Could not send ticket', 'error'); } }
  showToast('Support ticket raised successfully!', 'success'); e.target.reset(); renderTickets();
};
renderTickets = function () {
  const mine = mockStore.support_tickets.filter(t => t.email === (currentUser && currentUser.email));
  $('studentTicketsList').innerHTML = mine.length ? mine.map(t => `<div class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1"><div class="flex justify-between"><span class="font-bold text-sm">${t.subject}</span><span class="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-800 font-semibold">${t.status}</span></div><p class="text-xs text-slate-500">${t.message}</p>${t.reply ? `<p class="text-xs bg-emerald-500/10 rounded p-2"><b>Support:</b> ${t.reply}</p>` : ''}</div>`).join('') : '<div class="text-slate-400 text-xs">No active tickets.</div>';
};
async function ticketUpdate(id, status) {
  const t = mockStore.support_tickets.find(x => x.id === id), r = document.getElementById('rep_' + id); if (!t) return;
  if (r && r.value.trim()) t.reply = r.value.trim(); t.status = status;
  if (isFirebaseActive && db) { try { await db.collection('support_tickets').doc(id).update({ reply: t.reply, status }); } catch (e) { showToast('Update failed', 'error'); } }
  renderTicketsAdmin(); showToast('Ticket ' + status, 'success');
}
function renderTicketsAdmin() {
  $('adminTab-support').innerHTML = `<div class="${card} space-y-3"><h3 class="font-bold text-lg">Support tickets (${mockStore.support_tickets.length})</h3>` + (mockStore.support_tickets.map(t => `<div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-sm"><div class="flex justify-between"><b>${t.subject}</b><span class="text-xs font-bold">${t.status}</span></div><div class="text-xs text-slate-500">${t.email} · ${new Date(t.timestamp).toLocaleString()}</div><p>${t.message}</p><input id="rep_${t.id}" value="${t.reply || ''}" placeholder="Write a reply" class="${inp}"><div class="space-x-2"><button onclick="ticketUpdate('${t.id}','Answered')" class="text-purple-500 font-bold text-xs">Send reply</button><button onclick="ticketUpdate('${t.id}','Resolved')" class="text-emerald-500 font-bold text-xs">Mark resolved</button></div></div>`).join('') || '<p class="text-sm text-slate-500">No tickets.</p>') + '</div>';
}

/* ---------- Admin: test series from question bank, lectures & notes, real sales chart ---------- */
async function renderTsPicker() {
  await ensureAllQs(); const f = document.querySelector('form[onsubmit^="handleCreateTest"]'); if (!f) return;
  const old = $('tsBox'); if (old) old.remove();
  f.lastElementChild.insertAdjacentHTML('beforebegin', `<div id="tsBox" class="space-y-2 md:col-span-3"><label class="text-xs font-bold uppercase text-slate-500">Pick chapters from the question bank</label>${chapterPicker('tsCh')}<input id="tsCount" type="number" min="1" value="10" placeholder="Number of questions" class="${inp}"></div>`);
}
handleCreateTest = async function (e) {
  e.preventDefault(); await ensureAllQs();
  const pool = poolFor('tsCh', 'Any', Number($('tsCount').value) || 10);
  if (!pool.length) return showToast('Select chapters that have questions', 'error');
  const t = { id: 't_' + Date.now(), title: $('testName').value.trim(), category: $('testCategory').value, durationMinutes: Number($('testDuration').value) || 60, questions: pool.map(toExamQ) };
  mockStore.tests.push(t); await saveDirect('tests', t); e.target.reset(); renderTests(); renderTsPicker();
};
const toEmbed = u => { const m = (u || '').match(/(?:youtu\.be\/|v=)([\w-]{11})/); return m ? 'https://www.youtube.com/embed/' + m[1] : u; };
function renderLectureAdmin() {
  let b = $('lectureAdmin'); if (!b) { $('adminTab-manage-courses').insertAdjacentHTML('beforeend', '<div id="lectureAdmin" class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"></div>'); b = $('lectureAdmin'); }
  b.innerHTML = `<h3 class="font-bold text-lg">Video lectures and PDF notes</h3><select id="lcCourse" class="${inp}">${mockStore.courses.map(c => `<option value="${c.id}">${c.title} (${(c.lectures || []).length} lectures, ${(c.notes || []).length} notes)</option>`).join('')}</select>
  <div class="grid md:grid-cols-3 gap-2"><input id="lcTitle" placeholder="Lecture title" class="${inp}"><input id="lcUrl" placeholder="YouTube / video link" class="${inp}"><button onclick="addLecture()" class="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold">Add lecture</button></div>
  <div class="grid md:grid-cols-3 gap-2"><input id="ntTitle" placeholder="Note title" class="${inp}"><input id="ntFile" type="file" accept="application/pdf" class="text-sm"><button onclick="addNote()" class="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold">Upload note</button></div>`;
}
async function addLecture() {
  const c = mockStore.courses.find(x => x.id === $('lcCourse').value), t = $('lcTitle').value.trim(), u = $('lcUrl').value.trim();
  if (!c || !t || !u) return showToast('Enter title and link', 'error');
  (c.lectures = c.lectures || []).push({ title: t, url: toEmbed(u) }); await saveDirect('courses', c); renderLectureAdmin();
}
async function addNote() {
  const c = mockStore.courses.find(x => x.id === $('lcCourse').value), t = $('ntTitle').value.trim();
  try { if (!t) throw new Error('Enter a note title'); const url = await uploadPdf($('ntFile').files[0]); (c.notes = c.notes || []).push({ title: t, url }); await saveDirect('courses', c); renderLectureAdmin(); }
  catch (e) { showToast(e.message, 'error'); }
}
const _lcp = launchCoursePlayer;
launchCoursePlayer = function (id) {
  _lcp(id); const c = mockStore.courses.find(x => x.id === id); $('videoIframe').src = toEmbed(c.videoUrl);
  let box = $('cgLectures'); if (!box) { $('view-course-player').insertAdjacentHTML('beforeend', '<div id="cgLectures" class="space-y-3"></div>'); box = $('cgLectures'); }
  box.innerHTML = `<div class="${card}"><b>Lectures</b>${(c.lectures || []).map(l => `<button onclick="$('videoIframe').src='${l.url}'" class="block w-full text-left text-sm py-2 border-b border-slate-100 dark:border-slate-800"><i class="fa-solid fa-circle-play text-sky-500 mr-2"></i>${l.title}</button>`).join('') || '<p class="text-sm text-slate-500 mt-1">No extra lectures yet.</p>'}</div><div class="${card}"><b>PDF notes</b>${(c.notes || []).map(n => `<a href="${n.url}" target="_blank" class="block text-sm py-2 text-sky-500"><i class="fa-solid fa-file-pdf mr-2"></i>${n.title}</a>`).join('') || '<p class="text-sm text-slate-500 mt-1">No notes yet.</p>'}</div>`;
};
function salesChart() {
  const c = $('adminAnalyticsChart'); if (!c || !window.Chart) return; const old = Chart.getChart(c); if (old) old.destroy();
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  new Chart(c.getContext('2d'), { type: 'bar', data: { labels: days.map(d => d.toLocaleDateString('en-IN', { weekday: 'short' })), datasets: [{ label: 'Sales (₹)', backgroundColor: '#8b5cf6', data: days.map(d => mockStore.orders.filter(o => o.status === 'approved' && new Date(o.ts).toDateString() === d.toDateString()).reduce((a, o) => a + o.amount, 0)) }] }, options: { responsive: true, maintainAspectRatio: false } });
}
const _rpay = renderPayments; renderPayments = async function () { await _rpay(); salesChart(); };
const _rad2 = renderAdminDashboard; renderAdminDashboard = function () { _rad2(); salesChart(); renderLectureAdmin(); };
(function () {
  $('adminTabBtn-questions').insertAdjacentHTML('afterend', `<button onclick="switchAdminTab('support')" id="adminTabBtn-support" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Support Tickets</button>`);
  $('adminTab-questions').insertAdjacentHTML('afterend', '<div id="adminTab-support" class="hidden space-y-4"></div>');
})();
const _sat2 = switchAdminTab;
switchAdminTab = function (t) {
  $('adminTab-support').classList.add('hidden'); $('adminTabBtn-support').className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300';
  _sat2(t); if (t === 'support') renderTicketsAdmin(); if (t === 'manage-tests') renderTsPicker(); if (t === 'manage-courses') renderLectureAdmin();
};

/* ---------- Student analytics: chapter accuracy + time management + revision ---------- */
const _prep2 = renderPrep;
renderPrep = async function () { await ensureAllQs(); _prep2(); prepCharts(); };
function reviseBm() {
  const ids = store(uidKey('cg_bm_'), []), qs = allQs().filter(q => ids.includes(q.id));
  qs.length ? startPracticeWith('Bookmarked questions', qs) : showToast('No bookmarks yet', 'info');
}
function prepCharts() {
  const prog = store('cg_progress', {}), ch = {}, subj = {};
  allQs().forEach(q => { if (prog[q.id]) { const c = ch[q.chapter] = ch[q.chapter] || { a: 0, r: 0 }; c.a++; if (prog[q.id] === 'right') c.r++; } });
  mockStore.test_attempts.filter(a => a.uid === (currentUser && currentUser.uid)).forEach(a => {
    Object.entries(a.chapters || {}).forEach(([k, v]) => { const c = ch[k] = ch[k] || { a: 0, r: 0 }; c.a += v.a; c.r += v.c; });
    Object.entries(a.subjects || {}).forEach(([k, v]) => { const s = subj[k] = subj[k] || { t: 0, n: 0 }; s.t += v.time; s.n += v.n; });
  });
  const cn = Object.keys(ch).filter(k => ch[k].a), sn = Object.keys(subj);
  $('view-prep').insertAdjacentHTML('beforeend', `<div class="${card}"><b>Chapter-wise accuracy</b>${cn.length ? '' : '<p class="text-sm text-slate-500">Practise or take a test to see this.</p>'}<div class="h-64 mt-2"><canvas id="chAcc"></canvas></div></div><div class="${card}"><b>Time management (avg seconds per question)</b>${sn.length ? '' : '<p class="text-sm text-slate-500">Attempt a test to see this.</p>'}<div class="h-56 mt-2"><canvas id="timeChart"></canvas></div></div><button onclick="reviseBm()" class="px-5 py-2.5 bg-amber-500 text-white font-bold rounded-xl text-sm">Revise bookmarked questions</button>`);
  new Chart($('chAcc'), { type: 'bar', data: { labels: cn, datasets: [{ label: 'Accuracy %', data: cn.map(k => Math.round(ch[k].r / ch[k].a * 100)), backgroundColor: '#0ea5e9' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { max: 100 } } } });
  new Chart($('timeChart'), { type: 'bar', data: { labels: sn, datasets: [{ label: 'Seconds / question', data: sn.map(k => Math.round(subj[k].t / subj[k].n)), backgroundColor: '#f59e0b' }] }, options: { responsive: true, maintainAspectRatio: false } });
}

/* ---------- Role guards ---------- */
const _nv3 = navigateTo;
navigateTo = function (v) {
  if (v === 'admin-dashboard' && !(currentUser && currentUser.role === 'admin')) { showToast('Admin access only', 'error'); return openAuthModal('admin'); }
  if (['student-dashboard', 'cbt-engine', 'prep', 'course-player', 'test-result'].includes(v) && !currentUser) return openAuthModal('student');
  _nv3(v);
};
