/**
 * Desktop vs. schmales Layout (öffentliche Karte + ggf. Admin).
 */
(() => {
  'use strict';

  function isMobileLayout() {
    const w = window.innerWidth;
    if (w <= 768) return true;
    if (w <= 1024 && window.matchMedia('(pointer: coarse)').matches) return true;
    return false;
  }

  function apply() {
    const mobile = isMobileLayout();
    const root = document.documentElement;
    root.classList.toggle('bt-layout-mobile', mobile);
    root.classList.toggle('bt-layout-desktop', !mobile);
    root.dataset.btViewport = mobile ? 'mobile' : 'desktop';
  }

  apply();
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(apply, 120);
  });
  try {
    window.matchMedia('(pointer: coarse)').addEventListener('change', apply);
  } catch {
    /* */
  }
})();
