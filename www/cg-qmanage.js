/* Question manager: browse, edit and delete PYQ questions (bulk CSV import stays in the Question Bank tab). Firestore copy always wins over cached/local copy. */
const qm = { exam: null, subject: null, chapter: null };
const _addQ = addQ;
addQ = function (r) { // an existing id is updated in place (so edits made elsewhere are picked up)
  const ch = ((PYQ_DATA[r.exam] || {})[r.subject] || []).find(c => c.name === r.chapter), q = ch && ch.qs.find(x => x.id === r.id);
  if (q) { Object.assign(q, { year: Number(r.year) || q.year, text: r.text, options: r.options, correct: r.correct, steps: r.steps, diff: r.diff || q.diff, topic: r.topic || q.topic }); return false; }
  return _addQ(r);
};
const chKey = ch => slug(ch.exam) + '__' + slug(ch.subject) + '__' + slug(ch.name);
const curCh = () => ((PYQ_DATA[qm.exam] || {})[qm.subject] || []).find(c => c.name === qm.chapter);
const _rqa3 = renderQAdmin;
renderQAdmin = function () {
  _rqa3(); $('adminTab-questions').insertAdjacentHTML('afterbegin', '<div id="qManageBox" class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"></div>'); renderQManage();
};
async function renderQManage() {
  const box = $('qManageBox'); if (!box) return;
  const exams = Object.keys(PYQ_DATA); if (!exams.length) { box.innerHTML = '<p class="text-sm text-slate-500">No questions yet. Import a CSV below.</p>'; return; }
  if (!exams.includes(qm.exam)) qm.exam = exams[0];
  const subs = Object.keys(PYQ_DATA[qm.exam]); if (!subs.includes(qm.subject)) qm.subject = subs[0];
  const chs = PYQ_DATA[qm.exam][qm.subject] || []; if (!chs.some(c => c.name === qm.chapter)) qm.chapter = chs[0] && chs[0].name;
  const ch = curCh(); if (ch) await loadChapter(ch);
  const opt = (arr, cur) => arr.map(x => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
  box.innerHTML = `<h3 class="font-bold text-lg">Manage questions</h3><p class="text-xs text-slate-500">Edit or delete any question you added. Built-in sample questions are read-only.</p>
  <div class="grid md:grid-cols-3 gap-3"><select class="${fld}" onchange="qm.exam=this.value;qm.subject=null;qm.chapter=null;renderQManage()">${opt(exams, qm.exam)}</select>
  <select class="${fld}" onchange="qm.subject=this.value;qm.chapter=null;renderQManage()">${opt(subs, qm.subject)}</select>
  <select class="${fld}" onchange="qm.chapter=this.value;renderQManage()">${opt(chs.map(c => c.name), qm.chapter)}</select></div>
  <div class="divide-y divide-slate-100 dark:divide-slate-700">${ch && ch.qs.length ? ch.qs.map((q, i) => `<div class="py-2 flex justify-between gap-3 text-sm"><span><b>${i + 1}.</b> ${esc(q.text.slice(0, 90))}${q.text.length > 90 ? '…' : ''} <span class="text-xs text-slate-400">· ${q.year} · ${q.diff || 'Medium'}</span></span>
    <span class="whitespace-nowrap">${String(q.id).startsWith('cq_') ? `<button onclick="editQ('${q.id}')" class="text-sky-500 font-bold text-xs mr-3">Edit</button><button onclick="deleteQ('${q.id}')" class="text-red-500 font-bold text-xs">Delete</button>` : '<span class="text-xs text-slate-400">sample</span>'}</span></div>`).join('') : '<p class="py-3 text-sm text-slate-500">No questions in this chapter.</p>'}</div>`;
}
function editQ(id) {
  const ch = curCh(), q = ch.qs.find(x => x.id === id), v = s => esc(s || ''), lb = 'block text-xs font-semibold text-slate-500 uppercase mb-1';
  $('qEditBox') && $('qEditBox').remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="qEditBox" class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 overflow-y-auto"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg space-y-3 text-sm my-8"><b class="text-lg">Edit question</b>
  <div><label class="${lb}">Question</label><textarea id="qeT" rows="3" class="${fld}">${v(q.text)}</textarea></div>
  <div class="grid grid-cols-2 gap-3">${'ABCD'.split('').map((L, k) => `<div><label class="${lb}">Option ${L}</label><input id="qe${L}" value="${v(q.options[k])}" class="${fld}"></div>`).join('')}</div>
  <div class="grid grid-cols-3 gap-3"><div><label class="${lb}">Correct</label><select id="qeAns" class="${fld}">${'ABCD'.split('').map((L, k) => `<option ${k === q.correct ? 'selected' : ''}>${L}</option>`).join('')}</select></div>
  <div><label class="${lb}">Year</label><input id="qeY" type="number" value="${q.year || ''}" class="${fld}"></div><div><label class="${lb}">Difficulty</label><select id="qeDf" class="${fld}">${['Easy', 'Medium', 'Hard'].map(d => `<option ${d === (q.diff || 'Medium') ? 'selected' : ''}>${d}</option>`).join('')}</select></div></div>
  <div><label class="${lb}">Topic</label><input id="qeTp" value="${v(q.topic)}" class="${fld}"></div>
  <div><label class="${lb}">Solution (one step per line)</label><textarea id="qeS" rows="3" class="${fld}">${v((q.steps || []).join('\n'))}</textarea></div>
  <div class="flex gap-2"><button onclick="saveQEdit('${id}')" class="${SELF} bg-purple-600 text-white flex-1">Save changes</button><button onclick="$('qEditBox').remove()" class="${SELF} bg-slate-200 dark:bg-slate-700 flex-1">Cancel</button></div></div></div>`);
}
async function saveQEdit(id) {
  const ch = curCh(), q = ch.qs.find(x => x.id === id), g = i => $(i).value.trim(), options = ['qeA', 'qeB', 'qeC', 'qeD'].map(g).filter(Boolean), correct = 'ABCD'.indexOf(g('qeAns'));
  if (!g('qeT') || options.length < 2 || correct >= options.length) return showToast('Need question text, 2+ options and a valid correct answer', 'error');
  Object.assign(q, { text: g('qeT'), options, correct, year: Number(g('qeY')) || q.year, diff: g('qeDf'), topic: g('qeTp') || 'General', steps: g('qeS').split('\n').map(s => s.trim()).filter(Boolean) });
  if (!q.steps.length) q.steps = ['See official solution.'];
  const rec = { id, exam: ch.exam, subject: ch.subject, chapter: ch.name, year: q.year, diff: q.diff, topic: q.topic, text: q.text, options, correct, steps: q.steps };
  const list = JSON.parse(localStorage.getItem('cg_customq') || '[]'), i = list.findIndex(x => x.id === id); if (i >= 0) list[i] = rec; else list.push(rec); localStorage.setItem('cg_customq', JSON.stringify(list));
  if (isFirebaseActive && db) try { await db.collection('questions').doc(id).set(rec); await db.collection('chapters').doc(chKey(ch)).set({ exam: ch.exam, subject: ch.subject, name: ch.name, topics: firebase.firestore.FieldValue.arrayUnion(rec.topic) }, { merge: true }); } catch (e) { return showToast(fbMsg(e), 'error'); }
  $('qEditBox').remove(); showToast('Question updated', 'success'); renderQManage();
}
async function deleteQ(id) {
  if (!confirm('Delete this question?')) return; const ch = curCh();
  ch.qs = ch.qs.filter(x => x.id !== id); if (ch.count) ch.count--;
  localStorage.setItem('cg_customq', JSON.stringify(JSON.parse(localStorage.getItem('cg_customq') || '[]').filter(x => x.id !== id)));
  if (isFirebaseActive && db) try { await db.collection('questions').doc(id).delete(); await db.collection('chapters').doc(chKey(ch)).set({ count: firebase.firestore.FieldValue.increment(-1) }, { merge: true }); } catch (e) { showToast(fbMsg(e), 'error'); }
  showToast('Question deleted', 'success'); renderQManage();
}
