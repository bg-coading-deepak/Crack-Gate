/* Build Test (easy selection): login required, only chapters the admin made free, subject-wise accordions with select-all, search, live counts. */
const bs = { sel: new Set(), q: '', keys: [], groups: [] };
const builderQs = () => allQs().filter(q => pqAdm() || pyqAllowed.has(q.exam + '|' + q.subject));
function bData() { const m = {}; builderQs().forEach(q => { const g = q.exam + ' · ' + q.subject; ((m[g] = m[g] || {})[q.chapter] = m[g][q.chapter] || []).push(q); }); return m; }
const bAvail = () => { const d = bData(); let n = 0; bs.sel.forEach(k => { const [g, c] = k.split('||'); n += ((d[g] || {})[c] || []).length; }); return n; };
renderBuilder = async function () {
  const v = $('view-builder'); v.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>'; await ensureAllQs();
  if (!Object.keys(bData()).length) { v.innerHTML = '<div class="p-6 text-slate-500">No chapters are unlocked for you yet.</div>'; return; }
  v.innerHTML = `<div><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Custom test</p><h2 class="text-3xl font-extrabold">Build your own test in seconds.</h2><p class="text-sm text-slate-500">Pick chapters, choose how many questions, and start.</p></div>
  <div class="${card} space-y-3"><div class="flex flex-wrap gap-2 items-center"><input id="bSearch" oninput="bs.q=this.value;bList()" placeholder="Search chapter or subject..." class="${inp} flex-1 min-w-[180px]"><button onclick="bAll(true)" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700">Select all</button><button onclick="bAll(false)" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700">Clear</button></div>
  <div id="bList" class="max-h-[46vh] overflow-y-auto pr-1"></div></div>
  <div class="${card} space-y-3 sticky bottom-3 shadow-lg"><div id="bSum" class="text-sm font-semibold"></div>
  <div class="grid grid-cols-3 gap-3"><div><label class="text-xs font-bold uppercase text-slate-500">Questions</label><input id="bCount" type="number" min="1" value="10" oninput="$('bMin').value=this.value*2" class="${inp}"><div class="flex gap-1 mt-1">${[10, 20, 30, 50].map(n => `<button onclick="bCnt(${n})" class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-700">${n}</button>`).join('')}<button onclick="bCnt(0)" class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-700">All</button></div></div>
  <div><label class="text-xs font-bold uppercase text-slate-500">Timer (min)</label><input id="bMin" type="number" min="1" value="20" class="${inp}"></div>
  <div><label class="text-xs font-bold uppercase text-slate-500">Difficulty</label><select id="bDiff" class="${inp}"><option>Any</option><option>Easy</option><option>Medium</option><option>Hard</option></select></div></div>
  <button id="bGo" onclick="buildTest()" class="w-full px-5 py-3 bg-sky-600 text-white font-bold rounded-xl text-sm">Generate test and start</button></div>`;
  bList();
};
function bList() {
  const d = bData(), q = (bs.q || '').toLowerCase().trim(); bs.keys = []; bs.groups = [];
  const html = Object.entries(d).map(([g, chs]) => {
    const names = Object.keys(chs).filter(n => !q || n.toLowerCase().includes(q) || g.toLowerCase().includes(q)); if (!names.length) return '';
    const idx = names.map(n => bs.keys.push(g + '||' + n) - 1); bs.groups.push(idx); const gi = bs.groups.length - 1;
    const on = idx.filter(i => bs.sel.has(bs.keys[i])).length, tot = names.reduce((a, n) => a + chs[n].length, 0);
    return `<details open class="border-b border-slate-100 dark:border-slate-800"><summary class="flex items-center gap-3 cursor-pointer py-2.5"><input type="checkbox" ${on === idx.length ? 'checked' : ''} data-ind="${on > 0 && on < idx.length ? 1 : 0}" onclick="event.stopPropagation()" onchange="bGroup(${gi},this.checked)"><b class="text-sm">${esc(g)}</b><span class="text-xs text-slate-400">${on}/${idx.length} chapters · ${tot} Qs</span></summary>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pb-3">${names.map((n, j) => { const on1 = bs.sel.has(bs.keys[idx[j]]); return `<label class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer ${on1 ? 'border-sky-500 bg-sky-500/10' : 'border-slate-200 dark:border-slate-700'}"><span class="flex items-center gap-2 text-sm"><input type="checkbox" ${on1 ? 'checked' : ''} onchange="bOne(${idx[j]},this.checked)">${esc(n)}</span><span class="text-xs text-slate-400">${chs[n].length}</span></label>`; }).join('')}</div></details>`;
  }).join('');
  $('bList').innerHTML = html || '<p class="text-sm text-slate-500 py-3">No chapter matches your search.</p>';
  document.querySelectorAll('#bList input[data-ind="1"]').forEach(i => { i.indeterminate = true; }); bSum();
}
function bSum() { const n = bAvail(), c = bs.sel.size; $('bSum').innerText = c ? `${c} chapter${c > 1 ? 's' : ''} selected · ${n} questions available` : 'Select at least one chapter'; $('bGo').disabled = !c; $('bGo').style.opacity = c ? 1 : .5; }
function bOne(i, on) { on ? bs.sel.add(bs.keys[i]) : bs.sel.delete(bs.keys[i]); bList(); }
function bGroup(gi, on) { bs.groups[gi].forEach(i => on ? bs.sel.add(bs.keys[i]) : bs.sel.delete(bs.keys[i])); bList(); }
function bAll(on) { if (!on) bs.sel.clear(); else { const q = (bs.q || '').toLowerCase().trim(); Object.entries(bData()).forEach(([g, chs]) => Object.keys(chs).forEach(n => { if (!q || n.toLowerCase().includes(q) || g.toLowerCase().includes(q)) bs.sel.add(g + '||' + n); })); } bList(); }
function bCnt(n) { const v = n || bAvail() || 10; $('bCount').value = v; $('bMin').value = v * 2; }
buildTest = function () {
  if (!currentUser) return openAuthModal('student');
  const d = bData(), diff = $('bDiff').value; let pool = [];
  bs.sel.forEach(k => { const [g, c] = k.split('||'); pool = pool.concat((d[g] || {})[c] || []); });
  pool = pool.filter(q => diff === 'Any' || dOf(q) === diff).sort(() => Math.random() - 0.5).slice(0, Number($('bCount').value) || 10);
  if (!pool.length) return showToast('No questions match. Change chapters or difficulty.', 'error');
  const t = { id: 'b_' + Date.now(), title: `Custom Test (${pool.length} Qs)`, category: 'Custom', durationMinutes: Number($('bMin').value) || pool.length * 2, questions: pool.map(toExamQ) };
  mockStore.tests.push(t); startCBTExam(t.id);
};
