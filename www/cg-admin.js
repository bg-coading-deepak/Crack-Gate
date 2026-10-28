/* Crack Gate admin: question bank (single + CSV import) and PDF upload */
const SELF = 'px-4 py-2 rounded-xl text-sm font-bold';
const fld = 'w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm';

function addQ(r) {
  const exam = PYQ_DATA[r.exam] = PYQ_DATA[r.exam] || {};
  const sub = exam[r.subject] = exam[r.subject] || [];
  let ch = sub.find(c => c.name === r.chapter);
  if (!ch) { ch = { name: r.chapter, weight: 'Medium', topics: 0, qs: [], exam: r.exam, subject: r.subject }; sub.push(ch); }
  if (ch.qs.some(q => q.id === r.id)) return false;
  const q = Q(r.id, Number(r.year) || new Date().getFullYear(), r.text, r.options, r.correct, r.steps);
  q.diff = r.diff || 'Medium'; q.topic = r.topic || 'General'; ch.qs.push(q); return true;
}
async function saveQ(r) {
  if (!addQ(r)) return false;
  const list = JSON.parse(localStorage.getItem('cg_customq') || '[]'); list.push(r); localStorage.setItem('cg_customq', JSON.stringify(list));
  if (isFirebaseActive && db) { try { await db.collection('questions').doc(r.id).set(r); } catch (e) { showToast('Could not save to the server. Please login as admin.', 'error'); } }
  return true;
}
JSON.parse(localStorage.getItem('cg_customq') || '[]').forEach(addQ);

function parseCsv(t) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
const rowToQ = (c, n) => {
  const [exam, subject, chapter, year, diff, text, a, b, cc, d, ans, sol, topic] = c.map(x => (x || '').trim());
  const correct = 'ABCD'.indexOf((ans || '').toUpperCase());
  if (!exam || !subject || !chapter || !text || !a || !b || correct < 0) return null;
  return { id: 'cq_' + Date.now() + '_' + n, exam, subject, chapter, year, diff: ['Easy', 'Medium', 'Hard'].includes(diff) ? diff : 'Medium', text, options: [a, b, cc, d].filter(Boolean), correct, steps: (sol || 'See official solution.').split('|'), topic: topic || 'General' };
};
async function importCsv() {
  let text = $('csvText').value; const f = $('csvFile').files[0];
  if (f) text = await f.text();
  if (!text.trim()) return showToast('Choose a CSV file or paste CSV', 'error');
  let rows = parseCsv(text); if (/^exam$/i.test((rows[0] || [])[0] || '')) rows.shift();
  let ok = 0, bad = 0;
  for (let i = 0; i < rows.length; i++) { const r = rowToQ(rows[i], i); if (r && await saveQ(r)) ok++; else bad++; }
  showToast(`Imported ${ok} questions, skipped ${bad}`, ok ? 'success' : 'error');
  renderQAdmin();
}
async function addSingleQ(e) {
  e.preventDefault(); const g = id => $(id).value.trim();
  const r = { id: 'cq_' + Date.now(), exam: g('qExam'), subject: g('qSub'), chapter: g('qCh'), year: g('qYear'), diff: g('qDiff'), topic: g('qTopic') || 'General',
    text: g('qText'), options: ['qA', 'qB', 'qC', 'qD'].map(g).filter(Boolean), correct: 'ABCD'.indexOf(g('qAns')), steps: g('qSol').split('\n').filter(Boolean) };
  if (r.options.length < 2 || r.correct >= r.options.length) return showToast('Need 2+ options and a valid correct answer', 'error');
  if (!r.steps.length) r.steps = ['See official solution.'];
  await saveQ(r); showToast('Question added', 'success'); e.target.reset(); renderQAdmin();
}
async function uploadPdf(file) {
  if (!file || file.type !== 'application/pdf') throw new Error('Please select a PDF file');
  if (file.size > 50 * 1024 * 1024) throw new Error('PDF is larger than 50 MB');
  try {
    const r = await fetch('/api/upload?name=' + encodeURIComponent(file.name), { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'x-admin-key': PAY.adminKey }, body: file });
    if (r.ok) return (await r.json()).url;
  } catch (e) {}
  if (isFirebaseActive && firebase.storage) {
    const ref = firebase.storage().ref('pdfs/' + Date.now() + '_' + file.name.replace(/[^\w.-]/g, '_'));
    await ref.put(file); return await ref.getDownloadURL();
  }
  throw new Error('Upload failed: run server.js (npm start) or enable Firebase Storage');
}
async function pdfPick(inp) {
  const f = inp.files[0]; if (!f) return;
  showToast('Uploading PDF...', 'info');
  try { $('coursePdfUrl').value = await uploadPdf(f); showToast('PDF uploaded. Now save the course.', 'success'); }
  catch (e) { showToast(e.message, 'error'); inp.value = ''; }
}
async function attachPdf() {
  const id = $('attCourse').value, f = $('attFile').files[0];
  try {
    const url = await uploadPdf(f), c = mockStore.courses.find(x => x.id === id); c.pdfUrl = url;
    if (isFirebaseActive && db) await db.collection('courses').doc(id).set(c, { merge: true });
    showToast('PDF attached to course', 'success'); renderQAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}
function renderQAdmin() {
  const total = allQs().length, exams = Object.keys(PYQ_DATA), subs = [...new Set(allQs().map(q => q.subject))];
  $('adminTab-questions').innerHTML = `
  <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"><h3 class="font-bold text-lg">Question Bank <span class="text-xs font-normal text-slate-500">(${total} questions)</span></h3>
  <datalist id="dlExam">${exams.map(x => `<option value="${x}">`).join('')}</datalist><datalist id="dlSub">${subs.map(x => `<option value="${x}">`).join('')}</datalist>
  <form onsubmit="addSingleQ(event)" class="grid md:grid-cols-2 gap-3">
    <input id="qExam" list="dlExam" required placeholder="Exam (e.g. GATE CSE)" class="${fld}"><input id="qSub" list="dlSub" required placeholder="Subject" class="${fld}">
    <input id="qCh" required placeholder="Chapter" class="${fld}"><div class="grid grid-cols-2 gap-3"><input id="qYear" type="number" placeholder="Year" class="${fld}"><select id="qDiff" class="${fld}"><option>Easy</option><option selected>Medium</option><option>Hard</option></select></div>
    <input id="qTopic" placeholder="Topic (optional, e.g. Binary Search Trees)" class="${fld} md:col-span-2"><textarea id="qText" required rows="2" placeholder="Question text" class="${fld} md:col-span-2"></textarea>
    <input id="qA" required placeholder="Option A" class="${fld}"><input id="qB" required placeholder="Option B" class="${fld}"><input id="qC" placeholder="Option C" class="${fld}"><input id="qD" placeholder="Option D" class="${fld}">
    <select id="qAns" class="${fld}"><option>A</option><option>B</option><option>C</option><option>D</option></select>
    <textarea id="qSol" rows="2" placeholder="Solution steps (one per line)" class="${fld}"></textarea>
    <button class="${SELF} bg-purple-600 text-white md:col-span-2">Add question</button></form></div>
  <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"><h3 class="font-bold text-lg">Bulk import (CSV)</h3>
  <p class="text-xs text-slate-500">Columns: exam, subject, chapter, year, diff, question, optA, optB, optC, optD, correct (A-D), solution (steps separated by |), topic (optional). <a href="sample-questions.csv" download class="text-purple-500 font-bold">Download template</a></p>
  <input id="csvFile" type="file" accept=".csv" class="text-sm"><textarea id="csvText" rows="3" placeholder="...or paste CSV rows here" class="${fld}"></textarea>
  <button onclick="importCsv()" class="${SELF} bg-purple-600 text-white">Import</button></div>
  <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"><h3 class="font-bold text-lg">Upload PDF notes to a course</h3>
  <select id="attCourse" class="${fld}">${mockStore.courses.map(c => `<option value="${c.id}">${c.title}${c.pdfUrl && c.pdfUrl !== '#' ? ' (has PDF)' : ''}</option>`).join('')}</select>
  <input id="attFile" type="file" accept="application/pdf" class="text-sm"><button onclick="attachPdf()" class="${SELF} bg-purple-600 text-white">Upload and attach</button></div>`;
}
(function () {
  $('adminTabBtn-payments').insertAdjacentHTML('afterend', `<button onclick="switchAdminTab('questions')" id="adminTabBtn-questions" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Question Bank & PDFs</button>`);
  $('adminTab-payments').insertAdjacentHTML('afterend', '<div id="adminTab-questions" class="hidden space-y-4"></div>');
  const pdf = $('coursePdfUrl'); if (pdf) pdf.insertAdjacentHTML('afterend', '<input type="file" accept="application/pdf" onchange="pdfPick(this)" class="text-xs mt-1">');
})();
const _sat = switchAdminTab;
switchAdminTab = function (t) {
  $('adminTab-questions').classList.add('hidden'); $('adminTabBtn-questions').className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300';
  _sat(t); if (t === 'questions') renderQAdmin();
};

/* ---------- Direct-to-Firebase course/test publishing (no seed or extra publish step) ---------- */
function fbMsg(err) {
  return err.code === 'permission-denied'
    ? 'Permission denied. Please login with the admin account.'
    : 'Save failed: ' + err.message;
}
async function saveDirect(coll, obj) {
  if (!(isFirebaseActive && db)) { showToast('Saved on this device only (server not connected)', 'info'); return false; }
  try { await db.collection(coll).doc(obj.id).set(obj); showToast('Saved. It is live for students now.', 'success'); return true; }
  catch (err) { showToast(fbMsg(err), 'error'); return false; }
}
handleCreateCourse = async function (e) {
  e.preventDefault(); const g = id => $(id).value.trim();
  const course = { id: 'c_' + Date.now(), title: g('courseTitle'), category: g('courseCategory'), price: Number(g('coursePrice')) || 0,
    image: g('courseImage') || `https://placehold.co/600x400/4f46e5/ffffff?text=${encodeURIComponent(g('courseTitle'))}`,
    videoUrl: g('courseVideoUrl'), pdfUrl: g('coursePdfUrl') || '#', desc: g('courseDesc') };
  mockStore.courses.push(course); await saveDirect('courses', course);
  e.target.reset(); renderCourses(); renderCourseAdmin();
};
handleCreateTest = async function (e) {
  e.preventDefault();
  const test = { id: 't_' + Date.now(), title: $('testName').value.trim(), category: $('testCategory').value, durationMinutes: Number($('testDuration').value) || 60,
    questions: JSON.parse(JSON.stringify(mockStore.tests[0].questions)) };
  mockStore.tests.push(test); await saveDirect('tests', test);
  e.target.reset(); renderTests();
};
async function deleteCourse(id) {
  if (!confirm('Delete this course?')) return;
  mockStore.courses = mockStore.courses.filter(c => c.id !== id);
  if (isFirebaseActive && db) { try { await db.collection('courses').doc(id).delete(); } catch (err) { showToast(fbMsg(err), 'error'); } }
  renderCourses(); renderCourseAdmin();
}
function renderCourseAdmin() {
  let box = $('courseAdminList');
  if (!box) { $('adminTab-manage-courses').insertAdjacentHTML('beforeend', '<div id="courseAdminList" class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700"></div>'); box = $('courseAdminList'); }
  box.innerHTML = `<h3 class="font-bold text-lg mb-3">Live courses (${mockStore.courses.length})</h3>` + mockStore.courses.map(c => `<div class="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700 text-sm"><span>${c.title} <span class="text-xs text-slate-400">· ${c.category} · ₹${c.price}</span></span><button onclick="deleteCourse('${c.id}')" class="text-red-500 font-bold text-xs">Delete</button></div>`).join('');
}
window.addEventListener('load', () => {
  renderCourseAdmin();
  if (!(isFirebaseActive && db)) return;
  // real-time: anything added in Firebase (here or in the console) shows up instantly
  db.collection('courses').onSnapshot(s => { if (!s.empty) { mockStore.courses = s.docs.map(d => d.data()); renderCourses(); renderCourseAdmin(); } }, err => console.warn(err));
  db.collection('tests').onSnapshot(s => { if (!s.empty) { mockStore.tests = s.docs.map(d => d.data()); renderTests(); } }, err => console.warn(err));
});

/* ---------- Password reset (Firebase never exposes or sets passwords from the browser; it emails a reset link) ---------- */
async function sendReset(email) {
  if (!(isFirebaseActive && auth)) return showToast('Password reset needs the server connection', 'error');
  if (!email) return showToast('Enter the email first', 'error');
  try { await auth.sendPasswordResetEmail(email); showToast('Password reset link sent to ' + email, 'success'); }
  catch (err) { showToast(err.code === 'auth/user-not-found' ? 'No account with this email' : 'Could not send reset email', 'error'); }
}
$('authSubmitBtn').insertAdjacentHTML('afterend', `<button type="button" onclick="sendReset($('authEmail').value.trim())" class="w-full text-xs text-sky-500 font-semibold mt-2">Forgot password?</button>`);
const _ra = renderAdminDashboard;
renderAdminDashboard = function () {
  _ra();
  document.querySelectorAll('#adminUserTable button').forEach(b => { const email = b.closest('tr').children[0].innerText.trim(); b.innerText = 'Send reset email'; b.setAttribute('onclick', `sendReset('${email}')`); });
};
