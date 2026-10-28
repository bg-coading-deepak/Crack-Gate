/* Crack Gate UI: dark navbar with Test Series dropdown, single login for students + admins, new hero, #hash links. Loaded last. */
(function () {
  const EXAMS = ['GATE CSE', 'GATE DA', 'GATE ECE', 'GATE EE', 'GATE ME', 'GATE CE'];
  document.head.insertAdjacentHTML('beforeend', `<style>
  header.cgdark{background:#0a0a0f!important;border-color:rgba(255,255,255,.08)!important;color:#fff}
  header.cgdark .nav-btn{color:#e5e7eb}header.cgdark .nav-btn:hover{background:rgba(255,255,255,.1)!important}
  header.cgdark .text-slate-900,header.cgdark #userNameDisplay{color:#fff}header.cgdark #themeToggleBtn{color:#cbd5e1}
  #tsWrap{position:relative}#tsMenu{position:absolute;left:0;top:100%;margin-top:6px;min-width:250px;background:#0a0a0f;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:6px 0;box-shadow:0 12px 30px rgba(0,0,0,.5);z-index:60}
  #tsMenu a{display:block;padding:9px 18px;font-size:14px;font-weight:600;color:#cbd5e1;cursor:pointer}#tsMenu a:hover{background:rgba(255,255,255,.08);color:#fff}
  #tsMenu a.all{color:#f5a623;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:4px}
  </style>`);
  const hdr = document.querySelector('header'); if (hdr) hdr.classList.add('cgdark');

  /* ---------- Test Series dropdown (exam list builds itself from your courses + syllabus) ---------- */
  const nav = $('navLinks'), home = [...nav.children].find(b => (b.getAttribute('onclick') || '').includes("'home'"));
  nav.insertAdjacentHTML('afterbegin', '<div id="tsWrap"><button id="tsBtn" type="button" class="nav-btn px-3 py-2 rounded-lg text-sm font-medium"><i class="fa-solid fa-layer-group mr-1.5"></i> Test Series <i class="fa-solid fa-chevron-down text-[10px] ml-1"></i></button><div id="tsMenu" class="hidden"></div></div>');
  if (home) nav.insertAdjacentElement('afterbegin', home); // Home first, then Test Series
  const wrap = $('tsWrap'), menu = $('tsMenu');
  const exams = () => [...new Set([...EXAMS, ...Object.keys(SYLLABUS), ...mockStore.courses.map(c => c.category).filter(Boolean)])];
  function buildMenu() {
    menu.innerHTML = `<a class="all" onclick="cgOpenExam('')">View All Test Series</a>` + exams().map(e => `<a onclick="cgOpenExam('${esc(e)}')">${esc(e)} Test Series</a>`).join('');
    const f = $('courseFilter'); if (f) exams().forEach(e => { if (![...f.options].some(o => o.value === e)) f.add(new Option(e, e)); });
  }
  window.cgOpenExam = function (e) {
    menu.classList.add('hidden'); const f = $('courseFilter');
    if (f) { if (e && ![...f.options].some(o => o.value === e)) f.add(new Option(e, e)); f.value = e || 'ALL'; renderCourses(); }
    navigateTo('courses');
  };
  $('tsBtn').onclick = ev => { ev.stopPropagation(); menu.classList.toggle('hidden'); };
  wrap.onmouseenter = () => menu.classList.remove('hidden'); wrap.onmouseleave = () => menu.classList.add('hidden');
  document.addEventListener('click', () => menu.classList.add('hidden'));
  buildMenu(); let sig = ''; setInterval(() => { const s = exams().join('|'); if (s !== sig) { sig = s; buildMenu(); } }, 1000);

  /* ---------- One login for everyone: admin or student is decided by the email ---------- */
  const _oam2 = openAuthModal;
  openAuthModal = function (role) {
    _oam2(role);
    $('authModalTitle').innerText = 'Sign in to CrackGate';
    $('authModalTitle').parentElement.querySelector('p').innerText = 'One login for students and admins';
    $('authModalIcon').className = 'w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center text-xl font-bold mx-auto mb-2';
    $('amLogin').parentElement.style.display = ''; if ($('otpBtn')) $('otpBtn').style.display = '';
  };

  /* ---------- New hero ---------- */
  const ring = s => `<div class="absolute rounded-full border border-white/10" style="width:${s}px;height:${s}px;left:50%;top:50%;transform:translate(-50%,-50%)"></div>`;
  const chip = (t, pos, rot) => `<div class="hidden md:flex absolute w-24 h-24 rounded-full bg-white/5 items-center justify-center text-xs font-extrabold text-white/50 uppercase" style="${pos};transform:rotate(${rot}deg)">${t}</div>`;
  const hero = `<div class="relative overflow-hidden rounded-3xl text-center text-white px-6 py-20 md:py-28" style="background:radial-gradient(circle at 50% 110%,rgba(249,115,22,.22),transparent 55%),#0a0a0f">
    ${ring(520)}${ring(860)}${ring(1220)}${chip('GATE CSE', 'left:6%;top:42%', -20)}${chip('GATE DA', 'right:6%;top:18%', 20)}${chip('GATE ECE', 'right:3%;top:62%', 90)}${chip('GATE EE', 'left:16%;top:76%', 15)}
    <div class="relative z-10 space-y-6 max-w-4xl mx-auto"><span class="inline-block px-4 py-1.5 rounded-full border border-white/15 text-sm text-slate-300">Want to ace your preparation?</span>
      <h1 class="uppercase"><span class="block text-5xl md:text-7xl font-extrabold tracking-tight">India's top</span><span class="block text-4xl md:text-7xl italic font-light tracking-tight">GATE test series</span></h1>
      <p class="text-slate-400 max-w-xl mx-auto">Chapter-wise PYQs, full mock tests in the real exam interface and detailed analysis, for GATE CSE, DA, ECE, EE, ME and CE.</p>
      <div class="flex flex-wrap gap-3 justify-center pt-2"><button onclick="navigateTo('tests')" class="px-7 py-3 rounded-xl font-bold text-slate-900" style="background:linear-gradient(#fff,#fff) padding-box,linear-gradient(90deg,#f59e0b,#7c3aed) border-box;border:3px solid transparent">View Test Series &rarr;</button>
      <button onclick="openAuthModal('student')" class="guest-only px-7 py-3 rounded-xl font-bold border border-white/25 hover:bg-white/10">Login / Sign up</button><button onclick="navigateTo('student-dashboard')" class="user-only hidden px-7 py-3 rounded-xl font-bold border border-white/25 hover:bg-white/10">Go to my portal</button></div></div></div>`;
  const h = $('view-home'); if (h && h.firstElementChild) h.firstElementChild.outerHTML = hero;

  /* ---------- Shareable links: crackgate.in/#tests, /#courses, /#syllabus ---------- */
  const _nv3 = navigateTo;
  navigateTo = function (v) { _nv3(v); try { if (['home', 'courses', 'tests', 'syllabus'].includes(v)) history.replaceState(null, '', v === 'home' ? location.pathname : '#' + v); } catch (e) {} };
  window.addEventListener('load', () => { const v = location.hash.slice(1); if (['courses', 'tests', 'syllabus'].includes(v)) setTimeout(() => navigateTo(v), 300); });
})();
