/* App-only rules (loaded only inside the Android app; the website is unchanged): students only, no admin access. */
(function () {
  const native = window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
  if (!native) return;
  document.head.insertAdjacentHTML('beforeend', '<style>.admin-only,#adminPortalBtn,#view-admin-dashboard{display:none!important}</style>');
  const MSG = 'Admin access is available only on the website. Please use a student account in the app.';
  const _nv = navigateTo;
  navigateTo = function (v) { if (v === 'admin-dashboard') { showToast(MSG, 'error'); return _nv('home'); } _nv(v); };
  const _ua = updateAuthUI;
  updateAuthUI = function () {
    _ua();
    if (currentUser && currentUser.role === 'admin') setTimeout(() => { // after the login flow has finished
      if (!(currentUser && currentUser.role === 'admin')) return;
      try { if (isFirebaseActive && auth) auth.signOut(); } catch (e) {}
      currentUser = null; _ua(); _nv('home'); showToast(MSG, 'error');
    }, 0);
  };
})();
