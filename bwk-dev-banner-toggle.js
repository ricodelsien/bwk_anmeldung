/**
 * Entwicklermodus-Banner: ausblenden + festes „Fähnchen“ zum Wieder-Einblenden.
 * Gemeinsamer localStorage für admin.html und index.html.
 */
(() => {
  'use strict';

  const LS_KEY = 'bwk_dev_banner_collapsed';

  if (!window.BWK_BT_DEV_MODE) return;

  const banner = document.querySelector('[data-bwk-dev-banner]');
  if (!banner) return;

  let flag = document.getElementById('bwkDevBannerFlag');

  function readCollapsed() {
    try {
      return localStorage.getItem(LS_KEY) === '1';
    } catch {
      return false;
    }
  }

  function writeCollapsed(collapsed) {
    try {
      if (collapsed) localStorage.setItem(LS_KEY, '1');
      else localStorage.removeItem(LS_KEY);
    } catch {
      /* */
    }
  }

  function ensureFlag() {
    if (flag) return flag;
    flag = document.createElement('button');
    flag.type = 'button';
    flag.id = 'bwkDevBannerFlag';
    flag.className = 'bwk-dev-banner-flag';
    flag.setAttribute('aria-label', 'Entwicklermodus-Hinweis einblenden');
    flag.setAttribute('title', 'Entwicklermodus-Hinweis einblenden');
    flag.innerHTML =
      '<span class="bwk-dev-banner-flag-pennant" aria-hidden="true"></span>' +
      '<span class="bwk-dev-banner-flag-label">Dev</span>';
    flag.addEventListener('click', () => apply(false));
    document.body.appendChild(flag);
    return flag;
  }

  function apply(collapsed) {
    writeCollapsed(collapsed);
    if (collapsed) {
      banner.setAttribute('hidden', '');
      banner.classList.add('bwk-dev-banner--user-hidden');
      ensureFlag().hidden = false;
    } else {
      banner.removeAttribute('hidden');
      banner.classList.remove('bwk-dev-banner--user-hidden');
      ensureFlag().hidden = true;
    }
  }

  const hideBtn = banner.querySelector('[data-bwk-dev-banner-hide]');
  if (hideBtn) {
    hideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      apply(true);
    });
  }

  apply(readCollapsed());
})();
