/* Crack Gate: chapter-wise PYQ + practice mode (sample questions; add your own in PYQ_DATA) */
const Q = (id, year, text, options, correct, steps) => ({ id, year, text, options, correct, steps });
const PYQ_DATA = {
  'GATE CSE': {
    'Data Structures': [
      { name: 'Trees', weight: 'High', topics: 8, qs: [
        Q('ds1', 2021, 'Maximum number of nodes in a binary tree of height h (root at height 0)?', ['2^h', '2^(h+1) - 1', '2^h - 1', 'h + 1'], 1, ['Level i has at most 2^i nodes.', 'Sum for i = 0..h is 2^(h+1) - 1.']),
        Q('ds2', 2019, 'In-order traversal of a BST gives keys in which order?', ['Random', 'Descending', 'Ascending', 'Level order'], 2, ['Left < root < right in a BST.', 'In-order visits left, root, right, so keys come out sorted ascending.']) ] },
      { name: 'Stacks and Queues', weight: 'Medium', topics: 5, qs: [
        Q('ds3', 2020, 'Which data structure is used to convert infix to postfix?', ['Queue', 'Stack', 'Heap', 'Graph'], 1, ['Operators wait on a stack until precedence allows them out.']) ] },
      { name: 'Hashing', weight: 'Medium', topics: 4, qs: [] }
    ],
    'Algorithms': [
      { name: 'Sorting', weight: 'High', topics: 9, qs: [
        Q('al1', 2022, 'Worst-case time of Quick Sort with last-element pivot on sorted input?', ['O(n log n)', 'O(n)', 'O(n^2)', 'O(log n)'], 2, ['Sorted input makes partitions of size n-1 and 0.', 'T(n) = T(n-1) + n = O(n^2).']),
        Q('al2', 2018, 'Which sort is stable and O(n log n) worst case?', ['Quick Sort', 'Heap Sort', 'Merge Sort', 'Selection Sort'], 2, ['Merge Sort keeps equal keys in order and always splits evenly.']) ] },
      { name: 'Graph Algorithms', weight: 'High', topics: 11, qs: [] }
    ],
    'Operating Systems': [
      { name: 'Process Scheduling', weight: 'High', topics: 7, qs: [
        Q('os1', 2021, 'Which scheduling policy is optimal for minimum average waiting time (non-preemptive)?', ['FCFS', 'SJF', 'Round Robin', 'Priority'], 1, ['Running shortest jobs first minimises the average wait.']) ] }
    ]
  }
};
const cgp = { exam: 'GATE CSE', subject: null, view: 'chapter' };
const progress = () => JSON.parse(localStorage.getItem('cg_progress') || '{}');
const SEC = 'view-pyq';
const cnt = c => c.count || c.qs.length;

(function init() {
  document.getElementById('mainContainer').insertAdjacentHTML('beforeend', `<section id="view-pyq" class="hidden space-y-6"></section><section id="view-practice" class="hidden space-y-4 max-w-3xl mx-auto"></section>`);
  document.getElementById('navLinks').insertAdjacentHTML('afterbegin', `<button onclick="navigateTo('pyq')" class="nav-btn px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"><i class="fa-solid fa-file-lines mr-1.5"></i> PYQs</button>`);
})();
const _nav = navigateTo;
navigateTo = function (v) {
  ['pyq', 'practice'].forEach(x => document.getElementById('view-' + x).classList.add('hidden'));
  _nav(v);
  if (v === 'pyq' || v === 'practice') { document.getElementById('view-' + v).classList.remove('hidden'); if (v === 'pyq') renderPyq(); }
};
function renderPyq() {
  const data = PYQ_DATA[cgp.exam], subs = Object.keys(data); cgp.subject = cgp.subject || subs[0];
  const prog = progress();
  const chips = Object.keys(PYQ_DATA).map(e => `<button class="px-3 py-1.5 rounded-full text-xs font-bold ${e === cgp.exam ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}" onclick="cgp.exam='${e}';cgp.subject=null;renderPyq()">${e}</button>`).join('');
  const tabs = subs.map(s => `<button class="px-4 py-2 rounded-xl text-sm font-semibold ${s === cgp.subject ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}" onclick="cgp.subject='${s}';renderPyq()">${s}</button>`).join('');
  let chapters = data[cgp.subject].map(c => ({ ...c, subject: cgp.subject }));
  const colour = { High: 'text-red-500', Medium: 'text-amber-500', Low: 'text-emerald-500' };
  const list = (cgp.view === 'year' ? [...new Set(chapters.flatMap(c => c.qs.map(q => q.year)))].sort((a, b) => b - a).map(y => ({ name: 'Year ' + y, weight: '', topics: 0, qs: chapters.flatMap(c => c.qs.filter(q => q.year === y)), year: y })) : chapters);
  document.getElementById('view-pyq').innerHTML = `
  <div><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Past Year Questions</p><h2 class="text-3xl font-extrabold">${cgp.exam} · ${cgp.subject}</h2><p class="text-sm text-slate-500">Chapter-wise and year-wise, with solutions.</p></div>
  <div class="flex flex-wrap gap-2">${chips}</div><div class="flex flex-wrap gap-2">${tabs}</div>
  <div class="flex gap-2 text-xs font-bold"><button onclick="cgp.view='chapter';renderPyq()" class="px-3 py-1.5 rounded-lg ${cgp.view === 'chapter' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800'}">Chapter-wise</button><button onclick="cgp.view='year';renderPyq()" class="px-3 py-1.5 rounded-lg ${cgp.view === 'year' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800'}">Year-wise</button></div>
  <div class="grid md:grid-cols-2 gap-3">${list.map((c, i) => { const done = c.qs.filter(q => prog[q.id]).length, pct = cnt(c) ? Math.round(done / cnt(c) * 100) : 0;
    return `<button ${cnt(c) ? `onclick="startPractice(${i})"` : 'disabled'} class="text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${cnt(c) ? 'hover:border-sky-500' : 'opacity-50'}">
    <div class="flex justify-between"><b>${c.name}</b><span class="text-xs font-bold ${colour[c.weight] || ''}">${c.weight}</span></div>
    <div class="text-xs text-slate-500 mt-1">${cnt(c) ? cnt(c) + ' questions' : 'Coming soon'}${c.topics ? ' · ' + c.topics + ' topics' : ''}</div>
    <div class="h-1.5 bg-slate-200 dark:bg-slate-800 rounded mt-3"><div class="h-1.5 bg-sky-500 rounded" style="width:${pct}%"></div></div></button>`; }).join('')}</div>`;
  cgp.list = list;
}
let pr = null;
function startPractice(i) { pr = { c: cgp.list[i], i: 0, picked: null }; navigateTo('practice'); renderPractice(); }
function renderPractice() {
  const q = pr.c.qs[pr.i], L = 'ABCD', shown = pr.picked !== null;
  const opts = q.options.map((o, k) => { let cls = 'border-slate-200 dark:border-slate-800 hover:border-sky-500';
    if (shown) cls = k === q.correct ? 'border-emerald-500 bg-emerald-500/10' : k === pr.picked ? 'border-red-500 bg-red-500/10' : 'border-slate-200 dark:border-slate-800 opacity-60';
    return `<button ${shown ? 'disabled' : `onclick="pickPractice(${k})"`} class="w-full text-left p-3 rounded-xl border bg-white dark:bg-slate-900 ${cls}"><b class="mr-2">${L[k]}</b>${o}</button>`; }).join('');
  document.getElementById('view-practice').innerHTML = `<button onclick="navigateTo('pyq')" class="text-sm text-sky-500 font-semibold"><i class="fa-solid fa-arrow-left"></i> Back</button>
  <div class="text-xs text-slate-500">Practice · ${pr.c.name} · Question ${pr.i + 1} of ${pr.c.qs.length} · GATE ${q.year}</div>
  <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium">${q.text}</div><div class="space-y-2">${opts}</div>
  ${shown ? `<div class="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sm space-y-1"><b>Step-by-step solution</b>${q.steps.map((s, n) => `<div>${n + 1}. ${s}</div>`).join('')}</div>
  <button onclick="nextPractice()" class="px-5 py-2.5 bg-sky-600 text-white font-bold rounded-xl text-sm">${pr.i + 1 < pr.c.qs.length ? 'Next question' : 'Finish'}</button>` : ''}`;
}
function pickPractice(k) {
  const q = pr.c.qs[pr.i]; pr.picked = k;
  const p = progress(); p[q.id] = k === q.correct ? 'right' : 'wrong'; localStorage.setItem('cg_progress', JSON.stringify(p));
  renderPractice();
}
function nextPractice() {
  if (pr.i + 1 < pr.c.qs.length) { pr.i++; pr.picked = null; renderPractice(); }
  else { const p = progress(), r = pr.c.qs.filter(q => p[q.id] === 'right').length; showToast(`Done! ${r}/${pr.c.qs.length} correct`, 'success'); navigateTo('pyq'); }
}
