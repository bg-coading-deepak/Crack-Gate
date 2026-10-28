/* Firebase project: Crack Gate (YOUR_PROJECT_ID). Web config keys are public identifiers; security comes from firestore.rules */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAuSRw-4OQa2isKiIuY8eb59fGruoa3e9c",
  authDomain: "course-sell-58cee.firebaseapp.com",
  projectId: "course-sell-58cee",
  storageBucket: "course-sell-58cee.firebasestorage.app",
  messagingSenderId: "569172302560",
  appId: "1:569172302560:web:4683be99d53bfe1c1e4e85",
  measurementId: "G-0BBYB74VRC"
};
const ADMIN_EMAILS = ['dprajapati9039@gmail.com']; // change to your own email (also in firestore.rules)
if (!/^PASTE/.test(FIREBASE_CONFIG.apiKey) && !localStorage.getItem('crackgate_firebase_config')) localStorage.setItem('crackgate_firebase_config', JSON.stringify(FIREBASE_CONFIG));
/* Crack Gate extras: GATE data, UPI QR payment, mock purchase, admin payments, persistence */
const PAY = Object.assign({ upiId: 'yourname@oksbi', name: 'Crack Gate', qrImage: '', mock: true, adminKey: 'change-this-secret-key' },
  JSON.parse(localStorage.getItem('cg_pay') || '{}'));
let payFinal = 0;
const img = (c, t) => `https://placehold.co/600x400/${c}/ffffff?text=${encodeURIComponent(t)}`;
const mk = (subject, text, options, correct, solution) => ({ subject, text, options, correct, solution });

mockStore.courses = [
  { id: 'c1', title: 'GATE CSE Complete Course 2027', category: 'GATE CSE', price: 1499, image: img('4f46e5', 'GATE CSE'), videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', pdfUrl: '#', desc: 'DSA, Algorithms, OS, DBMS, CN, TOC and COA with PYQs and full solutions.' },
  { id: 'c2', title: 'GATE ECE Signals & Systems + Networks', category: 'GATE ECE', price: 899, image: img('0284c7', 'GATE ECE'), videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', pdfUrl: '#', desc: 'High-weightage ECE subjects with chapter-wise tests.' },
  { id: 'c3', title: 'GATE EE Power Systems Crash Course', category: 'GATE EE', price: 799, image: img('059669', 'GATE EE'), videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', pdfUrl: '#', desc: 'Power systems, machines and control in short focused lectures.' },
  { id: 'c4', title: 'GATE ME Thermodynamics Masterclass', category: 'GATE ME', price: 799, image: img('d97706', 'GATE ME'), videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', pdfUrl: '#', desc: 'Thermo, Fluid Mechanics and SOM with solved PYQs.' },
  { id: 'c5', title: 'GATE CE Structural Analysis', category: 'GATE CE', price: 699, image: img('dc2626', 'GATE CE'), videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', pdfUrl: '#', desc: 'Structures, Geotech and Environmental engineering.' }
];
mockStore.tests = [{
  id: 't1', title: 'GATE CSE Full Mock Test #1', category: 'GATE CSE', durationMinutes: 180,
  questions: [
    mk('Data Structures', 'Worst-case time to search a key in a balanced BST with n nodes?', ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 1, 'A balanced BST has height log n, so search takes O(log n).'),
    mk('Algorithms', 'Time complexity of Merge Sort in the worst case?', ['O(n)', 'O(n^2)', 'O(n log n)', 'O(log n)'], 2, 'T(n)=2T(n/2)+n gives O(n log n).'),
    mk('Operating Systems', 'Which scheduling algorithm can cause starvation?', ['Round Robin', 'FCFS', 'Priority Scheduling', 'None'], 2, 'Low-priority processes may wait forever in priority scheduling.'),
    mk('Digital Logic', 'Minimum number of NAND gates to implement a NOT gate?', ['1', '2', '3', '4'], 0, 'Tie both inputs of one NAND together.'),
    mk('DBMS', 'Which normal form removes transitive dependency?', ['1NF', '2NF', '3NF', 'BCNF only'], 2, '3NF removes transitive dependencies on the key.')
  ]
}];
mockStore.orders = mockStore.orders || [];
mockStore.users.forEach(u => { if (u.uid === 'std_1') u.enrolledCourses = []; });

// persistence
try {
  const saved = JSON.parse(localStorage.getItem('cg_store') || 'null');
  if (saved) Object.keys(saved).forEach(k => { mockStore[k] = saved[k]; });
} catch (e) { console.warn(e); }
setInterval(() => { try { localStorage.setItem('cg_store', JSON.stringify(mockStore)); } catch (e) {} }, 1500);

// optional backend (server.js). Returns null when not running.
async function saveOrderRemote(o) { if (isFirebaseActive && db) { try { await db.collection('orders').doc(o.id).set(o); } catch (e) { console.warn(e); } } }
async function api(path, opts = {}) {
  try {
    const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json', 'x-admin-key': PAY.adminKey } }, opts));
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

function upiUrl(amount, note) {
  return `upi://pay?pa=${encodeURIComponent(PAY.upiId)}&pn=${encodeURIComponent(PAY.name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}
function renderQR() {
  const box = document.getElementById('upiQr'); box.innerHTML = '';
  document.getElementById('upiAmt').innerText = '₹' + payFinal;
  if (PAY.qrImage) { box.innerHTML = `<img src="${PAY.qrImage}" class="w-48 h-48 object-contain">`; }
  else { const u = upiUrl(payFinal, 'CrackGate ' + currentPayingCourse.id); new QRCode(box, { text: u, width: 190, height: 190 }); document.getElementById('upiLink').href = u; }
}
function switchPayTab(t) {
  ['upi', 'mock'].forEach(x => {
    document.getElementById('payPane-' + x).classList.toggle('hidden', x !== t);
    document.getElementById('payTab-' + x).className = 'py-2 rounded-xl ' + (x === t ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-700');
  });
  document.getElementById('payTab-mock').style.display = PAY.mock ? '' : 'none';
}
function startCheckout(courseId) {
  if (!currentUser) { openAuthModal('student'); return; }
  const c = mockStore.courses.find(x => x.id === courseId);
  currentPayingCourse = c; payFinal = c.price;
  document.getElementById('payCourseTitle').innerText = c.title;
  ['payAmountDisplay', 'payBasePrice', 'payFinalTotal'].forEach(i => document.getElementById(i).innerText = '₹' + c.price);
  document.getElementById('payDiscount').innerText = '-₹0';
  document.getElementById('utrInput').value = '';
  openModal('paymentModal'); switchPayTab('upi'); renderQR();
}
function applyCoupon() {
  const code = document.getElementById('couponInput').value.trim().toUpperCase();
  if (['CRACK10', 'EXAM10'].includes(code) && currentPayingCourse) {
    const d = Math.round(currentPayingCourse.price * 0.1); payFinal = currentPayingCourse.price - d;
    document.getElementById('payDiscount').innerText = '-₹' + d;
    document.getElementById('payFinalTotal').innerText = '₹' + payFinal;
    document.getElementById('payAmountDisplay').innerText = '₹' + payFinal;
    renderQR(); showToast('10% coupon applied', 'success');
  } else showToast('Invalid coupon', 'error');
}
async function grantAccess(o, days) {
  const c = mockStore.courses.find(x => x.id === o.courseId) || {}, d = days != null ? days : (Number(c.accessDays) || 0), exp = d > 0 ? Date.now() + d * 864e5 : null;
  const apply = u => { if (!u.enrolledCourses.includes(o.courseId)) u.enrolledCourses.push(o.courseId); u.enrollExpiry = u.enrollExpiry || {}; if (exp) u.enrollExpiry[o.courseId] = exp; else delete u.enrollExpiry[o.courseId]; };
  const u = mockStore.users.find(x => x.uid === o.uid); if (u) apply(u);
  if (currentUser && currentUser.uid === o.uid) apply(currentUser);
  if (isFirebaseActive && db) {
    try { await db.collection('users').doc(o.uid).set({ enrolledCourses: firebase.firestore.FieldValue.arrayUnion(o.courseId), enrollExpiry: { [o.courseId]: exp === null ? firebase.firestore.FieldValue.delete() : exp } }, { merge: true }); }
    catch (e) { showToast('Could not update enrolment. Please contact support.', 'error'); }
  }
}
function newOrder(method, status, utr) {
  return { id: 'ord_' + Date.now(), uid: currentUser.uid, email: currentUser.email, courseId: currentPayingCourse.id,
    title: currentPayingCourse.title, amount: payFinal, method, utr: utr || '', status, ts: new Date().toISOString() };
}
async function submitUpi() {
  const utr = document.getElementById('utrInput').value.trim();
  if (!/^\d{12}$/.test(utr)) return showToast('Enter valid 12-digit UTR', 'error');
  if (mockStore.orders.some(o => o.utr === utr)) return showToast('This UTR is already used', 'error');
  const o = newOrder('upi', 'pending', utr); mockStore.orders.push(o); await saveOrderRemote(o); await api('/api/orders', { method: 'POST', body: JSON.stringify(o) });
  closeModal('paymentModal'); showToast('Payment submitted. Access unlocks after admin verification.', 'success'); renderPayments();
}
async function mockBuy() {
  if (!PAY.mock) return;
  const o = newOrder('mock', 'approved'); mockStore.orders.push(o); await saveOrderRemote(o); await api('/api/orders', { method: 'POST', body: JSON.stringify(o) });
  await grantAccess(o); closeModal('paymentModal'); showToast('Mock purchase done. Course unlocked!', 'success');
  renderStudentDashboard(); renderPayments(); navigateTo('student-dashboard');
}
async function setOrder(id, status) {
  const o = mockStore.orders.find(x => x.id === id); if (!o) return;
  o.status = status; if (isFirebaseActive && db) { try { await db.collection('orders').doc(id).update({ status }); } catch (e) {} } await api('/api/orders/' + id, { method: 'POST', body: JSON.stringify({ status }) });
  if (status === 'approved') await grantAccess(o);
  renderPayments(); showToast('Order ' + status, 'success');
}
function savePaySettings() {
  PAY.upiId = document.getElementById('setUpi').value.trim(); PAY.qrImage = document.getElementById('setQr').value.trim();
  PAY.mock = document.getElementById('setMock').checked;
  localStorage.setItem('cg_pay', JSON.stringify({ upiId: PAY.upiId, qrImage: PAY.qrImage, mock: PAY.mock }));
  showToast('Payment settings saved', 'success');
}
async function renderPayments() {
  const el = document.getElementById('adminTab-payments'); if (!el) return;
  if (isFirebaseActive && db && currentUser && currentUser.role === 'admin') {
    try { (await db.collection('orders').get()).forEach(d => { const r = d.data(), i = mockStore.orders.findIndex(o => o.id === r.id); if (i < 0) mockStore.orders.push(r); else mockStore.orders[i] = r; }); } catch (e) {}
  }
  const remote = await api('/api/orders');
  if (remote) remote.forEach(r => { if (!mockStore.orders.find(o => o.id === r.id)) mockStore.orders.push(r); });
  const rows = mockStore.orders.slice().reverse().map(o => `<tr><td class="p-3 text-xs">${o.email}</td><td class="p-3 text-xs">${o.title}</td><td class="p-3 font-bold">₹${o.amount}</td><td class="p-3 text-xs">${o.method}${o.utr ? '<br>' + o.utr : ''}</td><td class="p-3 text-xs font-bold">${o.status}</td><td class="p-3 text-xs space-x-2">${o.status === 'pending' ? `<button onclick="setOrder('${o.id}','approved')" class="text-emerald-600 font-bold">Approve</button><button onclick="setOrder('${o.id}','rejected')" class="text-red-600 font-bold">Reject</button>` : ''}</td></tr>`).join('') || '<tr><td class="p-3 text-sm text-slate-500" colspan="6">No orders yet</td></tr>';
  el.innerHTML = `<div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"><h3 class="font-bold text-lg">Payment Settings (your GPay / UPI)</h3>
  <input id="setUpi" value="${PAY.upiId}" placeholder="yourname@oksbi" class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm">
  <input id="setQr" value="${PAY.qrImage}" placeholder="Optional: your own QR image URL" class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm">
  <label class="flex items-center gap-2 text-sm"><input id="setMock" type="checkbox" ${PAY.mock ? 'checked' : ''}> Enable mock purchase (testing)</label>
  <button onclick="savePaySettings()" class="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold">Save</button> <button onclick="seedFirestore()" class="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-bold">Load sample courses/tests</button></div>
  <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto"><h3 class="font-bold text-lg mb-3">Orders</h3><table class="w-full text-left"><thead class="text-xs text-slate-500"><tr><th class="p-3">Student</th><th class="p-3">Course</th><th class="p-3">Amount</th><th class="p-3">Method / UTR</th><th class="p-3">Status</th><th class="p-3">Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const rev = mockStore.orders.filter(o => o.status === 'approved').reduce((a, o) => a + o.amount, 0);
  const r = document.getElementById('adminStatRevenue'); if (r) r.innerText = '₹' + rev.toLocaleString('en-IN');
}

// admin tab injection
(function () {
  const nav = document.querySelector('#view-admin-dashboard .border-b');
  nav.insertAdjacentHTML('beforeend', `<button onclick="switchAdminTab('payments')" id="adminTabBtn-payments" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">Payments & Orders</button>`);
  document.getElementById('adminTab-students').insertAdjacentHTML('afterend', '<div id="adminTab-payments" class="hidden space-y-4"></div>');
})();
function switchAdminTab(tab) {
  ['analytics', 'login-history', 'manage-courses', 'manage-tests', 'students', 'payments'].forEach(t => {
    document.getElementById('adminTab-' + t).classList.add('hidden');
    document.getElementById('adminTabBtn-' + t).className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300';
  });
  document.getElementById('adminTab-' + tab).classList.remove('hidden');
  document.getElementById('adminTabBtn-' + tab).className = 'pb-3 border-b-2 border-purple-600 text-purple-600 dark:text-purple-400 font-bold';
  if (tab === 'payments') renderPayments();
}
const _renderAdmin = renderAdminDashboard;
renderAdminDashboard = function () {
  const c = document.getElementById('adminAnalyticsChart'); if (c && window.Chart && Chart.getChart(c)) Chart.getChart(c).destroy();
  _renderAdmin(); renderPayments();
};
if (localStorage.getItem('theme') !== 'light') document.documentElement.classList.add('dark');
async function syncFromFirestore() {
  if (!(isFirebaseActive && db)) return;
  try {
    const c = await db.collection('courses').get(), t = await db.collection('tests').get();
    if (!c.empty) mockStore.courses = c.docs.map(d => d.data());
    if (!t.empty) mockStore.tests = t.docs.map(d => d.data());
  } catch (e) { console.warn('Firestore sync', e); }
}
async function seedFirestore() {
  if (!(isFirebaseActive && db)) return showToast('Server not connected', 'error');
  try {
    for (const c of mockStore.courses) await db.collection('courses').doc(c.id).set(c);
    for (const t of mockStore.tests) await db.collection('tests').doc(t.id).set(t);
    showToast('Sample content loaded', 'success');
  } catch (e) { showToast('Failed: please login as admin', 'error'); }
}
function openLegal(t) { alert(t + ': add your content here (support@crackgate.in)'); }
function injectHome() {
  return; // legacy home blocks disabled: cg-landing.js renders the home page
  const home = document.getElementById('view-home');
  const feat = (i, t, d) => `<div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><div class="w-10 h-10 rounded-xl bg-sky-600/15 text-sky-500 flex items-center justify-center mb-3"><i class="fa-solid ${i}"></i></div><h3 class="font-bold">${t}</h3><p class="text-sm text-slate-500 mt-1">${d}</p></div>`;
  const exams = ['GATE CSE', 'GATE ECE', 'GATE EE', 'GATE ME', 'GATE CE'].map(e => `<button onclick="document.getElementById('courseFilter').value='${e}';renderCourses();navigateTo('courses')" class="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold text-sm hover:border-sky-500">${e}</button>`).join('');
  home.insertAdjacentHTML('beforeend', `<div class="space-y-3"><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Everything in one place</p><h2 class="text-3xl font-extrabold">From first chapter to exam day.</h2>
  <div class="grid md:grid-cols-3 gap-4 pt-2">${feat('fa-book-open', 'Past year questions', 'Chapter-wise and year-wise PYQs, each with a full solution.')}${feat('fa-laptop-code', 'Mock tests with a real exam feel', 'Timed sections, mark for review and a full question palette.')}${feat('fa-chart-line', 'Analysis', 'Score, accuracy, time spent and subject-wise breakdown after every test.')}</div></div>
  <div class="space-y-3"><p class="text-xs font-bold uppercase tracking-wider text-sky-500">Exams</p><h2 class="text-3xl font-extrabold">One pass. Every GATE branch.</h2><div class="flex flex-wrap gap-3 pt-2">${exams}</div></div>
  <div class="rounded-3xl bg-gradient-to-r from-indigo-700 to-sky-600 text-white p-10 text-center space-y-3"><h2 class="text-3xl font-extrabold">Start preparing today.</h2><p class="text-sky-100">Create your free account and unlock your first mock test.</p><button onclick="openAuthModal('student')" class="px-6 py-3 bg-white text-indigo-800 font-bold rounded-xl">Create free account</button></div>`);
}
window.addEventListener('load', async () => { injectHome(); await syncFromFirestore(); renderCourses(); renderTests(); renderAdminDashboard(); });
