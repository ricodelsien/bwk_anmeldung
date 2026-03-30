/**
 * Schalter für den lokalen Demonstrator (?dev=1).
 * Wird von bwk-dev-banner-toggle.js und optional weiteren Dev-Skripten genutzt.
 */
(() => {
  'use strict';

  const q = new URLSearchParams(location.search);
  const dev = q.get('dev') === '1';
  const hostOk =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:';
  const insecure = q.get('insecure') === '1';
  const active = dev && (hostOk || insecure);

  window.BWK_BT_DEV_MODE = active;
  window.BWK_BT_DEV_INSECURE = dev && insecure && !hostOk;
  window.BWK_ADMIN_DEV_MODE = active;
  window.BWK_ADMIN_DEV_INSECURE = window.BWK_BT_DEV_INSECURE;

  if (active) {
    document.documentElement.setAttribute('data-bwk-dev', '1');
  }
})();
