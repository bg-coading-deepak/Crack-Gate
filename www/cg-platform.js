/* Course platform features: lesson hub (playlist, free preview, progress, watermark, certificate, forum), Razorpay, referral/wallet, OTP signup, admin tools */
const hub = { cid: null, lid: null, done: {} }, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cloud = () => isFirebaseActive && db, lsGet = (k, d) => JSON.parse(localStorage.getItem(k) || d), uidOf = () => (currentUser && currentUser.uid) || 'guest';
const loadJs = src => new Promise(r => { if (document.querySelector(`script[src="${src}"]`)) return r(); const s = document.createElement('script'); s.src = src; s.onload = r; document.head.appendChild(s); });
if (new URLSearchParams(location.search).get('ref')) localStorage.setItem('cg_ref', new URLSearchParams(location.search).get('ref'));
(function () {
  document.getElementById('mainContainer').insertAdjacentHTML('beforeend', '<section id="view-hub" class="hidden space-y-4"></section>');
  document.getElementById('navLinks').insertAdjacentHTML('afterbegin', `<button onclick="navigateTo('hub')" class="nav-btn px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"><i class="fa-solid fa-circle-play mr-1.5"></i> Lessons</button>`);
})();
const _navH = navigateTo;
navigateTo = function (v) { $('view-hub').classList.add('hidden'); _navH(v); if (v === 'hub') { $('view-hub').classList.remove('hidden'); renderHub(); } };
const lessonsOf = c => c.lessons && c.lessons.length ? c.lessons : (c.videoUrl ? [{ id: 'l1', title: c.title, url: c.videoUrl, isFree: false }] : []);
const ACCESS_OPTS = '<option value="0">Lifetime</option><option value="30">1 month</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">1 year</option><option value="730">2 years</option><option value="custom">Custom (days)</option>';
const durText = d => !d ? 'Lifetime access' : d % 365 === 0 ? d / 365 + (d === 365 ? ' year' : ' years') : d % 30 === 0 ? d / 30 + (d === 30 ? ' month' : ' months') : d + ' days';
const daysFrom = (s, i) => $(s).value === 'custom' ? Math.max(0, Number($(i).value) || 0) : Number($(s).value);
const owns = c => currentUser && (currentUser.role === 'admin' || (currentUser.enrolledCourses || []).includes(c.id));
async function loadProgress() {
  hub.done = lsGet('cg_lp_' + uidOf(), '{}');
  if (cloud() && currentUser) { try { const d = await db.collection('userProgress').doc(currentUser.uid).get(); if (d.exists) hub.done = d.data().completed || hub.done; } catch (e) {} }
}
async function saveProgress() {
  localStorage.setItem('cg_lp_' + uidOf(), JSON.stringify(hub.done));
  if (cloud() && currentUser) try { await db.collection('userProgress').doc(currentUser.uid).set({ completed: hub.done }, { merge: true }); } catch (e) {}
}
async function ensureReferral() {
  if (!currentUser || currentUser.referralCode) return;
  currentUser.referralCode = currentUser.uid.slice(0, 6).toUpperCase(); const ref = localStorage.getItem('cg_ref');
  if (ref && ref !== currentUser.referralCode) currentUser.referredBy = ref;
  if (cloud()) try { await db.collection('users').doc(currentUser.uid).set({ referralCode: currentUser.referralCode, referredBy: currentUser.referredBy || null }, { merge: true }); } catch (e) {}
}
async function renderHub() {
  await loadProgress(); await ensureReferral();
  const cs = mockStore.courses.filter(c => lessonsOf(c).length), c = cs.find(x => x.id === hub.cid) || cs[0];
  if (!c) { $('view-hub').innerHTML = '<p class="p-6 text-slate-500">No lessons yet. Admin can add them from this page.</p>' + adminTools(); return; }
  hub.cid = c.id; const ls = lessonsOf(c), can = l => owns(c) || l.isFree, l = ls.find(x => x.id === hub.lid) || ls[0]; hub.lid = l.id;
  const dn = hub.done[c.id] || [], pct = Math.round(ls.filter(x => dn.includes(x.id)).length / ls.length * 100), card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';
  $('view-hub').innerHTML = `<div class="flex flex-wrap gap-2">${cs.map(x => `<button onclick="hub.cid='${x.id}';hub.lid=null;renderHub()" class="px-3 py-1.5 rounded-full text-xs font-bold ${x.id === c.id ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}">${esc(x.title)}</button>`).join('')}</div>
  <div class="grid lg:grid-cols-3 gap-4"><div class="lg:col-span-2 space-y-3">
    <div class="aspect-video bg-black rounded-2xl overflow-hidden relative" oncontextmenu="return false">${can(l) ? player(l) : `<div class="h-full flex flex-col items-center justify-center text-white gap-3"><i class="fa-solid fa-lock text-3xl"></i><div>Buy this course to watch</div></div>`}<div id="wm" class="absolute pointer-events-none text-white/40 text-xs font-bold select-none" style="top:10%;left:10%;text-shadow:0 0 3px #000;transition:all 1.5s">${esc(currentUser ? (currentUser.phone || '') + ' ' + currentUser.email : 'PREVIEW')}</div></div>
    <div class="flex justify-between items-center gap-3"><div><h3 class="font-bold">${esc(l.title)}</h3>${owns(c) && currentUser.role !== 'admin' ? `<div class="text-xs text-slate-500">${(currentUser.enrollExpiry || {})[c.id] ? 'Access till ' + new Date(currentUser.enrollExpiry[c.id]).toLocaleDateString() : 'Lifetime access'}</div>` : ''}</div>${can(l) && currentUser ? `<button onclick="markDone('${c.id}','${l.id}')" class="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white">${dn.includes(l.id) ? 'Completed ✅' : 'Mark complete'}</button>` : ''}</div>
    ${owns(c) ? '' : buyBox(c)}${forumHtml()}</div>
  <div class="space-y-3"><div class="${card} p-4"><div class="flex justify-between text-sm font-bold mb-2"><span>Progress</span><span>${pct}%</span></div><div class="h-2 bg-slate-200 dark:bg-slate-800 rounded"><div class="h-2 bg-sky-500 rounded" style="width:${pct}%"></div></div>
    ${pct === 100 ? `<button onclick="certificate('${c.id}')" class="mt-3 w-full px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm">Download certificate</button>` : ''}</div>
    <div class="${card} p-2">${ls.map(x => `<button onclick="hub.lid='${x.id}';renderHub()" class="w-full text-left px-3 py-2 rounded-xl text-sm flex gap-2 items-center ${x.id === l.id ? 'bg-sky-500/10' : ''}"><span>${dn.includes(x.id) ? '✅' : '📖'}</span><span class="flex-1">${esc(x.title)}</span>${x.isFree ? '<span class="text-[10px] font-bold text-emerald-500">FREE</span>' : !owns(c) ? '<i class="fa-solid fa-lock text-xs text-slate-400"></i>' : ''}</button>`).join('')}</div>
    ${currentUser ? `<div class="${card} p-4 text-sm"><b>Refer and earn</b><div class="text-xs text-slate-500 my-1">Wallet: ₹${currentUser.walletBalance || 0}. Your friend's first purchase gives you ₹100.</div><input readonly value="${location.origin}${location.pathname}?ref=${currentUser.referralCode}" onclick="this.select()" class="w-full text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5"></div>` : ''}</div></div>${adminTools()}`;
  moveWm(); loadForum();
}
function player(l) {
  const y = (l.url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/) || [])[1];
  return y ? `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${y}?rel=0&modestbranding=1" allowfullscreen></iframe>` : `<video class="w-full h-full" src="${esc(l.url)}" controls controlsList="nodownload"></video>`;
}
let wmT; function moveWm() { clearInterval(wmT); wmT = setInterval(() => { const w = $('wm'); if (!w) return clearInterval(wmT); w.style.top = 5 + Math.random() * 80 + '%'; w.style.left = 3 + Math.random() * 65 + '%'; }, 3500); }
async function markDone(cid, lid) { const a = hub.done[cid] = hub.done[cid] || []; if (!a.includes(lid)) a.push(lid); await saveProgress(); renderHub(); }
const logoData = () => new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(i, 0, 0, 256, 256); res(c.toDataURL('image/png')); }; i.onerror = rej; i.src = 'logo.png'; });
async function certificate(cid) {
  await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const c = mockStore.courses.find(x => x.id === cid), id = 'CERT-' + Date.now().toString(36).toUpperCase() + currentUser.uid.slice(0, 4).toUpperCase(), name = currentUser.name || currentUser.email;
  const d = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); d.setDrawColor(14, 165, 233); d.setLineWidth(6); d.rect(24, 24, 794, 547); try { d.addImage(await logoData(), 'PNG', 389, 36, 64, 64); } catch (e) {}
  d.setFont('times', 'bold'); d.setFontSize(34); d.text('Certificate of Completion', 421, 130, { align: 'center' });
  d.setFont('times', 'normal'); d.setFontSize(16); d.text('This is to certify that', 421, 200, { align: 'center' }); d.setFont('times', 'bold'); d.setFontSize(30); d.text(name, 421, 250, { align: 'center' });
  d.setFont('times', 'normal'); d.setFontSize(16); d.text('has successfully completed the course', 421, 295, { align: 'center' }); d.setFont('times', 'bold'); d.setFontSize(22); d.text(c.title, 421, 335, { align: 'center' });
  d.setFont('times', 'normal'); d.setFontSize(11); d.text(`Certificate ID: ${id}   |   Date: ${new Date().toLocaleDateString()}`, 421, 500, { align: 'center' });
  if (cloud()) try { await db.collection('certificates').doc(id).set({ id, uid: currentUser.uid, name, courseId: cid, at: Date.now() }); } catch (e) {}
  d.save(id + '.pdf');
}
function buyBox(c) {
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap gap-2 items-center text-sm"><div class="mr-auto"><b>₹${c.price}</b> <span class="text-xs text-slate-500">· ${durText(Number(c.accessDays) || 0)}</span></div><input id="hubCoupon" placeholder="Coupon" class="bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5 w-28 text-xs"><label class="text-xs"><input type="checkbox" id="hubWallet"> Use wallet</label>${courseState(c).s === 'expired' ? `<span class="text-xs font-bold text-red-500">Expired on ${dstr(courseState(c).exp)}</span>` : ''}<button onclick="buyRazorpay('${c.id}')" class="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold">${courseState(c).s === 'expired' ? 'Renew' : 'Pay'} with Razorpay</button></div>`;
}
async function buyRazorpay(cid) {
  if (!currentUser) return openAuthModal('student');
  if (!(isFirebaseActive && auth && auth.currentUser)) return showToast('Razorpay needs Firebase + deployed functions (see README)', 'error');
  try {
    await loadJs('https://checkout.razorpay.com/v1/checkout.js');
    const r = await fetch('/api/createOrder', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await auth.currentUser.getIdToken() }, body: JSON.stringify({ courseId: cid, coupon: $('hubCoupon').value.trim(), useWallet: $('hubWallet').checked }) }), o = await r.json();
    if (o.error) return showToast(o.error, 'error');
    const done = async () => { showToast('Payment received. Unlocking...', 'success'); for (let i = 0; i < 10; i++) { const u = (await db.collection('users').doc(currentUser.uid).get()).data(); if ((u.enrolledCourses || []).includes(cid)) { currentUser = u; return renderHub(); } await new Promise(z => setTimeout(z, 1500)); } };
    if (o.free) return done();
    new Razorpay({ key: o.key, order_id: o.orderId, amount: o.amount, name: document.title, prefill: { email: currentUser.email, contact: currentUser.phone || '' }, handler: done }).open();
  } catch (e) { showToast('Could not start payment', 'error'); }
}
const forumHtml = () => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2"><b class="text-sm">Discussion</b><div id="forumList" class="space-y-2 text-sm"></div>${currentUser ? `<div class="flex gap-2"><input id="forumText" placeholder="Ask a question..." class="flex-1 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm"><button onclick="postForum()" class="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold">Post</button></div>` : '<div class="text-xs text-slate-500">Login to join the discussion.</div>'}</div>`;
async function loadForum() {
  let list = []; const k = 'cg_forum_' + hub.cid + '_' + hub.lid;
  if (cloud()) try { list = (await db.collection('courses').doc(hub.cid).collection('discussions').where('lessonId', '==', hub.lid).get()).docs.map(d => d.data()); } catch (e) {} else list = lsGet(k, '[]');
  list.sort((a, b) => a.ts - b.ts); const el = $('forumList'); if (el) el.innerHTML = list.map(m => `<div class="p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><b class="text-xs">${esc(m.name)}${m.admin ? ' (Instructor)' : ''}</b><div>${esc(m.text)}</div></div>`).join('') || '<div class="text-xs text-slate-500">No questions yet.</div>';
}
async function postForum() {
  const t = $('forumText').value.trim(); if (!t) return;
  const m = { uid: currentUser.uid, name: currentUser.name || currentUser.email.split('@')[0], admin: currentUser.role === 'admin', text: t, lessonId: hub.lid, ts: Date.now() };
  if (cloud()) try { await db.collection('courses').doc(hub.cid).collection('discussions').add(m); } catch (e) { return showToast('Could not post', 'error'); }
  else { const k = 'cg_forum_' + hub.cid + '_' + hub.lid, a = lsGet(k, '[]'); a.push(m); localStorage.setItem(k, JSON.stringify(a)); }
  $('forumText').value = ''; loadForum();
}
/* ---------- Admin: lessons, grant/revoke access, coupons ---------- */
const adminTools = () => !(currentUser && currentUser.role === 'admin') ? '' : `<div class="grid md:grid-cols-3 gap-4"><div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 text-sm"><b>Course lessons</b><select id="adC" class="${fld}">${mockStore.courses.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select><textarea id="adL" rows="4" placeholder="One per line: title | video url | free" class="${fld}"></textarea><button onclick="saveLessons()" class="${SELF} bg-purple-600 text-white">Save lessons</button></div>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 text-sm"><b>Grant / revoke access</b><input id="gaE" placeholder="Student email" class="${fld}"><input id="gaD" type="number" placeholder="Days (blank = course default)" class="${fld}"><select id="gaC" class="${fld}">${mockStore.courses.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select><div class="flex gap-2"><button onclick="setAccess(true)" class="${SELF} bg-emerald-600 text-white">Grant</button><button onclick="setAccess(false)" class="${SELF} bg-red-600 text-white">Revoke</button></div></div>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 text-sm"><b>Course access duration</b><select id="adAC" class="${fld}">${mockStore.courses.map(c => `<option value="${c.id}">${esc(c.title)} (${durText(Number(c.accessDays) || 0)})</option>`).join('')}</select><div class="flex gap-2"><select id="adAD" class="${fld}">${ACCESS_OPTS}</select><input id="adAX" type="number" min="1" placeholder="Days" class="${fld}"></div><button onclick="saveAccessDays()" class="${SELF} bg-purple-600 text-white">Save duration</button></div>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 text-sm"><b>Create coupon</b><input id="cpC" placeholder="CODE" class="${fld}"><div class="flex gap-2"><select id="cpT" class="${fld}"><option value="percent">% off</option><option value="flat">₹ flat off</option></select><input id="cpV" type="number" placeholder="Value" class="${fld}"></div><button onclick="saveCoupon()" class="${SELF} bg-purple-600 text-white">Save coupon</button></div></div>`;
async function saveLessons() {
  const c = mockStore.courses.find(x => x.id === $('adC').value);
  c.lessons = $('adL').value.split('\n').filter(x => x.trim()).map((x, i) => { const p = x.split('|').map(s => s.trim()); return { id: 'l' + (i + 1), title: p[0], url: p[1] || '', isFree: /^free$/i.test(p[2] || '') }; });
  if (cloud()) try { await db.collection('courses').doc(c.id).set({ lessons: c.lessons }, { merge: true }); } catch (e) { return showToast(fbMsg(e), 'error'); }
  showToast('Lessons saved', 'success'); renderHub();
}
async function setAccess(on) {
  const email = $('gaE').value.trim().toLowerCase(), cid = $('gaC').value, dv = $('gaD').value.trim(); if (!cloud()) return showToast('Needs Firebase connection', 'error');
  const s = await db.collection('users').where('email', '==', email).limit(1).get(); if (s.empty) return showToast('No student with this email', 'error');
  const F = firebase.firestore.FieldValue; if (on) await grantAccess({ uid: s.docs[0].id, courseId: cid }, dv === '' ? null : Number(dv)); else await s.docs[0].ref.update({ enrolledCourses: F.arrayRemove(cid), ['enrollExpiry.' + cid]: F.delete() }); showToast(on ? 'Access granted' : 'Access revoked', 'success');
}
async function saveCoupon() {
  const code = $('cpC').value.trim().toUpperCase(), v = Number($('cpV').value); if (!code || !v || !cloud()) return showToast('Enter code, value and connect Firebase', 'error');
  await db.collection('coupons').doc(code).set({ type: $('cpT').value, value: v, active: true }); showToast('Coupon saved', 'success');
}
/* ---------- Mobile OTP sign-up (Firebase Phone Auth), then email + password linked ---------- */
$('authSubmitBtn').insertAdjacentHTML('afterend', `<button type="button" id="otpBtn" onclick="otpModal()" class="w-full text-xs text-purple-500 font-semibold mt-1">New student? Sign up with mobile OTP</button>`);
function otpModal() {
  if (!(isFirebaseActive && auth)) return showToast('OTP signup needs Firebase Phone Auth enabled', 'error');
  document.body.insertAdjacentHTML('beforeend', `<div id="otpBox" class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-2 text-sm"><b class="text-lg">Sign up with mobile</b>
  <input id="otpPhone" placeholder="+91XXXXXXXXXX" class="${fld}"><button onclick="sendOtp()" class="${SELF} bg-sky-600 text-white w-full">Send OTP</button><div id="otpRecaptcha"></div>
  <div id="otpStep2" class="hidden space-y-2"><input id="otpCode" placeholder="6-digit OTP" class="${fld}"><input id="otpName" placeholder="Full name" class="${fld}"><input id="otpEmail" type="email" placeholder="Email" class="${fld}"><input id="otpPass" type="password" placeholder="Password (min 6)" class="${fld}"><button onclick="verifyOtp()" class="${SELF} bg-emerald-600 text-white w-full">Verify and create account</button></div>
  <button onclick="$('otpBox').remove()" class="w-full text-xs text-slate-500">Cancel</button></div></div>`);
}
let otpConf; async function sendOtp() {
  try { window.rv = window.rv || new firebase.auth.RecaptchaVerifier('otpRecaptcha', { size: 'invisible' }); otpConf = await auth.signInWithPhoneNumber($('otpPhone').value.trim(), window.rv); $('otpStep2').classList.remove('hidden'); showToast('OTP sent', 'success'); }
  catch (e) { showToast('Could not send OTP: ' + e.code, 'error'); }
}
async function verifyOtp() {
  const g = id => $(id).value.trim();
  try {
    const cr = await otpConf.confirm(g('otpCode')); await cr.user.linkWithCredential(firebase.auth.EmailAuthProvider.credential(g('otpEmail'), g('otpPass')));
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('cg_sid', sid);
    await db.collection('users').doc(cr.user.uid).set({ uid: cr.user.uid, email: g('otpEmail'), name: g('otpName'), phone: cr.user.phoneNumber, role: 'student', enrolledCourses: [], sessionId: sid });
    showToast('Account created', 'success'); setTimeout(() => location.reload(), 800);
  } catch (e) { showToast('Verification failed: ' + (e.code || e.message), 'error'); }
}

/* ---------- Role-based UI: admin sign-in has no register; logged-in users never see sign-up; only admin sees Firebase badge ---------- */
const _oam = openAuthModal;
openAuthModal = function (role) {
  _oam(role); $('authEmail').value = ''; $('authPassword').value = ''; setAuthMode('login');
  const adm = role === 'admin'; $('amLogin').parentElement.style.display = adm ? 'none' : ''; $('otpBtn').style.display = adm ? 'none' : '';
};
function syncAuthUi() {
  expireAccess(); refreshIfChanged();
  const u = currentUser, isAdm = !!(u && u.role === 'admin');
  document.querySelectorAll('.guest-only').forEach(e => e.classList.toggle('hidden', !!u));
  document.querySelectorAll('.user-only').forEach(e => e.classList.toggle('hidden', !u));
  document.querySelectorAll('.admin-only').forEach(e => e.classList.toggle('hidden', !isAdm));
  const b = $('firebaseStatusBadge'); if (b) b.style.display = isAdm ? '' : 'none';
}
setInterval(syncAuthUi, 500); syncAuthUi();

/* ---------- Course access duration (admin decides: lifetime, 1 month, 6 months, 1 year, custom days) ---------- */
async function saveAccessDays() {
  const c = mockStore.courses.find(x => x.id === $('adAC').value); c.accessDays = daysFrom('adAD', 'adAX');
  if (cloud()) try { await db.collection('courses').doc(c.id).set({ accessDays: c.accessDays }, { merge: true }); } catch (e) { return showToast(fbMsg(e), 'error'); }
  showToast('Duration saved: ' + durText(c.accessDays) + '. Applies to new purchases.', 'success'); renderHub();
}
function expireAccess() {
  const u = currentUser; if (!u || u.role === 'admin' || !u.enrollExpiry) return;
  const gone = (u.enrolledCourses || []).filter(id => u.enrollExpiry[id] && u.enrollExpiry[id] < Date.now()); if (!gone.length) return;
  u.enrolledCourses = u.enrolledCourses.filter(id => !gone.includes(id));
  showToast('Your access has expired: ' + gone.map(id => (mockStore.courses.find(c => c.id === id) || {}).title || id).join(', ') + '. Please renew.', 'error');
}
(function () {
  const pu = $('coursePdfUrl'); if (!pu) return;
  pu.parentElement.insertAdjacentHTML('afterend', `<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Access duration</label><div class="flex gap-2"><select id="courseAccess" class="${fld}">${ACCESS_OPTS}</select><input id="courseAccessCustom" type="number" min="1" placeholder="Days" class="${fld}"></div></div>`);
})();
const _hcc = handleCreateCourse;
handleCreateCourse = async function (e) {
  const days = daysFrom('courseAccess', 'courseAccessCustom'); await _hcc(e);
  const c = mockStore.courses[mockStore.courses.length - 1]; if (!c) return; c.accessDays = days;
  if (cloud()) try { await db.collection('courses').doc(c.id).set({ accessDays: days }, { merge: true }); } catch (err) {}
  renderCourseAdmin();
};

/* ---------- Edit any course anytime: title, category, price, duration, image, video, PDF, description ---------- */
const _rca = renderCourseAdmin;
renderCourseAdmin = function () {
  _rca();
  document.querySelectorAll('#courseAdminList button[onclick^="deleteCourse"]').forEach(b => {
    const id = (b.getAttribute('onclick').match(/'([^']+)'/) || [])[1], c = mockStore.courses.find(x => x.id === id); if (!c) return;
    b.insertAdjacentHTML('beforebegin', `<button onclick="editCourse('${id}')" class="text-sky-500 font-bold text-xs mr-3">Edit</button>`);
    const sp = b.parentElement.querySelector('span'); if (sp) sp.insertAdjacentHTML('beforeend', ` <span class="text-xs text-slate-400">· ${durText(Number(c.accessDays) || 0)}</span>`);
  });
};
function editCourse(id) {
  const c = mockStore.courses.find(x => x.id === id), d = Number(c.accessDays) || 0, preset = [0, 30, 90, 180, 365, 730].includes(d), v = k => esc(c[k] || ''), lb = 'block text-xs font-semibold text-slate-500 uppercase mb-1';
  $('courseEditBox') && $('courseEditBox').remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="courseEditBox" class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 overflow-y-auto"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg space-y-3 text-sm my-8"><b class="text-lg">Edit course</b>
  <div><label class="${lb}">Title</label><input id="ceT" value="${v('title')}" class="${fld}"></div>
  <div class="grid grid-cols-2 gap-3"><div><label class="${lb}">Category</label><input id="ceC" value="${v('category')}" class="${fld}"></div><div><label class="${lb}">Price (₹)</label><input id="ceP" type="number" min="0" value="${Number(c.price) || 0}" class="${fld}"></div></div>
  <div><label class="${lb}">Access duration</label><div class="flex gap-2"><select id="ceAD" class="${fld}">${ACCESS_OPTS.replace(`value="${preset ? d : 'custom'}"`, `value="${preset ? d : 'custom'}" selected`)}</select><input id="ceAX" type="number" min="1" placeholder="Days" value="${preset ? '' : d}" class="${fld}"></div></div>
  <div><label class="${lb}">Thumbnail image URL</label><input id="ceI" value="${v('image')}" class="${fld}"></div>
  <div><label class="${lb}">Video URL</label><input id="ceV" value="${v('videoUrl')}" class="${fld}"></div>
  <div><label class="${lb}">PDF URL</label><input id="ceF" value="${c.pdfUrl && c.pdfUrl !== '#' ? esc(c.pdfUrl) : ''}" class="${fld}"><input type="file" accept="application/pdf" onchange="cePdf(this)" class="text-xs mt-1"></div>
  <div><label class="${lb}">Description</label><textarea id="ceDs" rows="3" class="${fld}">${v('desc')}</textarea></div>
  <div class="flex gap-2 pt-1"><button onclick="saveCourseEdit('${id}')" class="${SELF} bg-purple-600 text-white flex-1">Save changes</button><button onclick="$('courseEditBox').remove()" class="${SELF} bg-slate-200 dark:bg-slate-700 flex-1">Cancel</button></div></div></div>`);
}
async function cePdf(inp) { const f = inp.files[0]; if (!f) return; showToast('Uploading PDF...', 'info'); try { $('ceF').value = await uploadPdf(f); showToast('PDF uploaded. Now save changes.', 'success'); } catch (e) { showToast(e.message, 'error'); inp.value = ''; } }
async function saveCourseEdit(id) {
  const c = mockStore.courses.find(x => x.id === id), g = i => $(i).value.trim();
  if (!g('ceT')) return showToast('Title is required', 'error');
  Object.assign(c, { title: g('ceT'), category: g('ceC'), price: Number(g('ceP')) || 0, accessDays: daysFrom('ceAD', 'ceAX'), image: g('ceI') || c.image, videoUrl: g('ceV'), pdfUrl: g('ceF') || '#', desc: g('ceDs') });
  if (cloud()) try { await db.collection('courses').doc(id).set({ title: c.title, category: c.category, price: c.price, accessDays: c.accessDays, image: c.image, videoUrl: c.videoUrl, pdfUrl: c.pdfUrl, desc: c.desc }, { merge: true }); } catch (e) { return showToast(fbMsg(e), 'error'); }
  $('courseEditBox').remove(); showToast('Course updated', 'success'); renderCourses(); renderCourseAdmin();
}

/* ---------- Student-facing course info: name, price, duration, validity and automatic Expired status ---------- */
const dstr = t => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
function courseState(c) {
  const u = currentUser; if (!u || u.role === 'admin') return { s: 'none' };
  const exp = (u.enrollExpiry || {})[c.id];
  if ((u.enrolledCourses || []).includes(c.id)) return { s: 'active', exp };
  return exp && exp < Date.now() ? { s: 'expired', exp } : { s: 'none' };
}
function statusLine(st) {
  if (st.s === 'expired') return `<div class="text-xs font-bold text-red-500"><i class="fa-solid fa-circle-xmark"></i> Expired on ${dstr(st.exp)}</div>`;
  if (st.s !== 'active') return '';
  if (!st.exp) return '<div class="text-xs font-bold text-emerald-500"><i class="fa-solid fa-infinity"></i> Lifetime access</div>';
  const n = Math.ceil((st.exp - Date.now()) / 864e5);
  return `<div class="text-xs font-bold ${n <= 7 ? 'text-amber-500' : 'text-emerald-500'}"><i class="fa-solid fa-clock"></i> Valid till ${dstr(st.exp)} (${n} day${n === 1 ? '' : 's'} left)</div>`;
}
const courseBtn = (c, st) => st.s === 'active' ? `<button onclick="launchCoursePlayer('${c.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs">Open course</button>`
  : `<button onclick="startCheckout('${c.id}')" class="px-4 py-2 ${st.s === 'expired' ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'} text-white font-bold rounded-xl text-xs">${st.s === 'expired' ? 'Renew now' : 'Enroll Now'}</button>`;
renderCourses = function () {
  const f = $('courseFilter').value, list = f === 'ALL' ? mockStore.courses : mockStore.courses.filter(c => c.category === f);
  $('coursesGrid').innerHTML = list.map(c => { const st = courseState(c); return `<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col justify-between">
    <div><img src="${c.image}" alt="${esc(c.title)}" class="w-full h-44 object-cover"><div class="p-5 space-y-2">
      <div class="flex items-center gap-2 flex-wrap"><span class="px-2.5 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-bold text-xs rounded-full uppercase">${esc(c.category)}</span><span class="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-700 font-bold text-xs rounded-full"><i class="fa-regular fa-clock mr-1"></i>${durText(Number(c.accessDays) || 0)}</span></div>
      <h3 class="font-bold text-lg leading-snug">${esc(c.title)}</h3><p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${esc(c.desc || '')}</p>${statusLine(st)}</div></div>
    <div class="p-5 pt-0 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 mt-4"><span class="text-xl font-extrabold">₹${c.price}</span>${courseBtn(c, st)}</div></div>`; }).join('');
};
const _rsd = renderStudentDashboard;
renderStudentDashboard = function () {
  _rsd(); if (!currentUser) return;
  const mine = mockStore.courses.filter(c => courseState(c).s !== 'none'); if (!mine.length) return;
  $('dashEnrolledCount').innerText = mine.filter(c => courseState(c).s === 'active').length;
  $('enrolledCoursesList').innerHTML = mine.map(c => { const st = courseState(c); return `<div class="bg-white dark:bg-slate-800 rounded-2xl border ${st.s === 'expired' ? 'border-red-300 dark:border-red-900' : 'border-slate-200 dark:border-slate-700'} p-5 space-y-3 flex flex-col justify-between">
    <div class="space-y-1"><div class="flex justify-between gap-2"><h4 class="font-bold text-base">${esc(c.title)}</h4><span class="text-sm font-extrabold">₹${c.price}</span></div>
    <div class="text-xs text-slate-500"><i class="fa-regular fa-clock mr-1"></i>Course duration: ${durText(Number(c.accessDays) || 0)}</div>${statusLine(st)}</div>${courseBtn(c, st).replace('px-4 py-2', 'w-full py-2')}</div>`; }).join('');
};
var lastSig;
function refreshIfChanged() {
  const u = currentUser, sig = u ? u.uid + '|' + (u.enrolledCourses || []).join() + '|' + JSON.stringify(u.enrollExpiry || {}) : '-';
  if (sig === lastSig) return; lastSig = sig;
  try { renderCourses(); if (u) renderStudentDashboard(); if (!$('view-hub').classList.contains('hidden')) renderHub(); } catch (e) {}
}
renderCourses();
