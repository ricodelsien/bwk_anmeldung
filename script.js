
(() => {
  'use strict';

  /** Nach erfolgreicher Anmeldung: Pause bis zur nächsten (Missbrauchsschutz). */
  const SUCCESS_COOLDOWN_MS = 20000;
  const LS_LAST_OK_SUBMIT = 'bwk_bt_last_ok_submit_at';
  const DEBOUNCE_MS = 2500;

  function $(sel) {
    return document.querySelector(sel);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  async function loadPublicSettings() {
    let data =
      window.BWK_BT_DEFAULTS && window.BWK_BT_DEFAULTS.settings
        ? { ...window.BWK_BT_DEFAULTS.settings }
        : { useSlots: true, slots: [], infoWhenNoSlots: '' };
    const db = window.bewerbertagDb;
    if (!db) return data;
    try {
      const snap = await db.collection('bewerbertag_settings').doc('singleton').get();
      if (snap.exists && snap.data()) {
        Object.assign(data, snap.data());
      }
    } catch (e) {
      console.warn('Bewerbertag: Einstellungen nicht geladen, Fallback genutzt.', e);
    }
    return data;
  }

  function setPublicNoSlotsHint(el, htmlOrText, manualFromSettings) {
    if (!el) return;
    el.classList.remove('bt-rich-hint-output');
    el.classList.toggle('bt-hint--manual', !!manualFromSettings);
    if (typeof window.sanitizeHintHtml === 'function') {
      const safe = window.sanitizeHintHtml(htmlOrText || '');
      if (safe) {
        el.innerHTML = safe;
        el.classList.add('bt-rich-hint-output');
        return;
      }
      el.textContent = '';
      return;
    }
    el.textContent = htmlOrText == null ? '' : String(htmlOrText);
  }

  function applyTerminUi(settings) {
    const fs = $('#bt-fs-slots');
    const listEl = $('#btTermineList');
    const noSlots = $('#bt-no-slots-info');
    const slotsApi = window.BWK_BT_SLOTS;
    const slots = Array.isArray(settings.slots) ? settings.slots : [];
    const useSlots = settings.useSlots !== false;
    const openCount = slotsApi
      ? slots.filter((s) => s && s.value && !slotsApi.normalizeSlot(s).closed).length
      : 0;
    const rawHint = (settings.infoWhenNoSlots || '').toString();
    const customInfo =
      typeof window.hintHtmlPlainText === 'function'
        ? window.hintHtmlPlainText(rawHint)
        : rawHint.replace(/<[^>]+>/g, '').trim();

    if (!useSlots) {
      if (fs) fs.hidden = true;
      if (noSlots) {
        noSlots.hidden = false;
        setPublicNoSlotsHint(noSlots, rawHint, customInfo.length > 0);
      }
      return;
    }

    if (!slots.length || !slotsApi) {
      if (fs) fs.hidden = true;
      if (noSlots) {
        noSlots.hidden = false;
        const fallback = 'Es sind derzeit keine Termine zur Auswahl freigeschaltet.';
        const body = customInfo ? rawHint : fallback;
        setPublicNoSlotsHint(noSlots, body, customInfo.length > 0);
      }
      return;
    }

    if (!openCount) {
      if (fs) fs.hidden = true;
      if (noSlots) {
        noSlots.hidden = false;
        const fallback =
          'Für alle Termine ist die Online-Anmeldung derzeit geschlossen. Bei Rückfragen melden Sie sich gern bei uns.';
        const body = customInfo ? rawHint : fallback;
        setPublicNoSlotsHint(noSlots, body, customInfo.length > 0);
      }
      return;
    }

    if (noSlots) {
      noSlots.hidden = true;
      noSlots.classList.remove('bt-hint--manual', 'bt-rich-hint-output');
      noSlots.textContent = '';
    }
    if (fs) fs.hidden = false;
    slotsApi.renderPublicTermineList(listEl, slots);
  }

  async function isSlotClosedInSettings(db, slotValue) {
    if (!slotValue || !db) return false;
    try {
      const snap = await db.collection('bewerbertag_settings').doc('singleton').get();
      if (!snap.exists || !snap.data()) return false;
      const list = snap.data().slots;
      if (!Array.isArray(list)) return false;
      const row = list.find((s) => s && s.value === slotValue);
      return !!(row && row.closed === true);
    } catch {
      return false;
    }
  }

  async function fetchSlotCapacityMax(db, slotValue) {
    if (!slotValue || !db) return null;
    try {
      const snap = await db.collection('bewerbertag_settings').doc('singleton').get();
      if (!snap.exists || !snap.data()) return null;
      const slots = snap.data().slots;
      if (!Array.isArray(slots)) return null;
      const row = slots.find((s) => s && s.value === slotValue);
      if (!row || row.maxApplicants == null || row.maxApplicants === '') return null;
      const n = parseInt(String(row.maxApplicants), 10);
      return isNaN(n) || n < 1 ? null : n;
    } catch {
      return null;
    }
  }

  async function countUniqueActiveForSlot(db, slotValue) {
    if (!slotValue || !db) return new Set();
    const snap = await db
      .collection('bewerbertag')
      .where('slot', '==', slotValue)
      .where('status', '==', 'active')
      .get();
    const emails = new Set();
    snap.forEach((doc) => {
      const d = doc.data();
      const em = (d.emailLower || (d.email || '').toString().toLowerCase().trim());
      if (em) emails.add(em);
    });
    return emails;
  }

  async function countPriorRegistrationsByEmail(db, emailLower) {
    if (!emailLower || !db) return 0;
    const snap = await db.collection('bewerbertag').where('emailLower', '==', emailLower).get();
    return snap.size;
  }

  /**
   * IP nur zuverlässig serverseitig (Cloud Function). Optional: Callable bwkClientMeta
   * oder Fallback api.ipify.org (nur grobe Orientierung, kann fehlen).
   */
  async function resolveClientIpMeta() {
    try {
      if (typeof firebase !== 'undefined' && firebase.functions) {
        const region = window.BWK_BT_FUNCTIONS_REGION || 'europe-west3';
        const fn = firebase.app().functions(region).httpsCallable('bwkClientMeta');
        const res = await fn({});
        const ip = res.data && res.data.ip;
        if (ip && typeof ip === 'string' && ip.length < 64) {
          return { registrationIp: ip, registrationIpSource: 'callable' };
        }
      }
    } catch {
      /* keine Function deployiert oder CORS */
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2200);
      const r = await fetch('https://api.ipify.org?format=json', {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(t);
      if (r.ok) {
        const j = await r.json();
        if (j && j.ip && typeof j.ip === 'string' && j.ip.length < 64) {
          return { registrationIp: j.ip, registrationIpSource: 'ipify' };
        }
      }
    } catch {
      /* Netzwerk blockiert */
    }
    return { registrationIp: '', registrationIpSource: '' };
  }

  onReady(() => {
    const form = $('#bewerberForm');
    const successBox = $('#bewerberSuccess');
    const hint = $('#bewerberHint');
    if (!form) return;

    const submitBtn = $('#bewerberSubmit');
    const contactTypeSelect = form.querySelector('[name="contactType"]');
    const phoneField = $('#bt-phone-field');
    const phoneLabel = $('#bt-phone-label');
    const phoneInput = $('#bt-phone-input');

    loadPublicSettings().then(applyTerminUi);

    function updatePhoneRequired() {
      if (!contactTypeSelect) return;
      const needsPhone = contactTypeSelect.value === 'phone';
      if (phoneLabel) phoneLabel.textContent = needsPhone ? 'Telefon (erforderlich)' : 'Telefon (optional)';
      if (phoneField) phoneField.classList.toggle('bt-field--required', needsPhone);
    }

    if (contactTypeSelect) {
      contactTypeSelect.addEventListener('change', updatePhoneRequired);
      updatePhoneRequired();
    }

    function setSubmitLoading(loading) {
      if (!submitBtn) return;
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Wird gesendet …' : 'Anmeldung abschicken';
    }

    function showHint(msg, isError) {
      if (!hint) return;
      hint.textContent = msg;
      hint.style.color = isError ? '#b42318' : '';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn && submitBtn.disabled) return;

      showHint('', false);

      const now = Date.now();
      const lastOk = parseInt(localStorage.getItem(LS_LAST_OK_SUBMIT) || '0', 10);
      if (lastOk && now - lastOk < SUCCESS_COOLDOWN_MS) {
        showHint(
          'Sie haben sich gerade erst angemeldet. Bitte warten Sie einen Moment, bevor Sie erneut absenden.',
          true
        );
        return;
      }
      const lastTry = parseInt(sessionStorage.getItem('bwk_bt_submit_try') || '0', 10);
      if (lastTry && now - lastTry < DEBOUNCE_MS) {
        showHint('Bitte nicht doppelt klicken — die Anmeldung wird bereits verarbeitet.', true);
        return;
      }
      sessionStorage.setItem('bwk_bt_submit_try', String(now));

      setSubmitLoading(true);

      const data = new FormData(form);
      const contactType = data.get('contactType') || '';
      const phone = (data.get('phone') || '').trim();

      if (contactType === 'phone' && !phone) {
        showHint('Bitte Telefonnummer angeben (Kontaktart: Telefon).', true);
        setSubmitLoading(false);
        if (phoneInput) phoneInput.focus();
        return;
      }

      const slotFs = $('#bt-fs-slots');
      const slotRequired = slotFs && !slotFs.hidden;
      const slotVal = (data.get('slot') || '').toString();
      if (slotRequired && !slotVal) {
        showHint('Bitte einen Termin auswählen.', true);
        setSubmitLoading(false);
        return;
      }

      const emailRaw = (data.get('email') || '').toString().trim();
      const emailLower = emailRaw.toLowerCase();

      const db = window.bewerbertagDb;
      if (!db) {
        showHint('Die Anmeldung ist technisch nicht erreichbar.', true);
        setSubmitLoading(false);
        return;
      }

      try {
        if (slotVal && (await isSlotClosedInSettings(db, slotVal))) {
          showHint(
            'Dieser Termin ist geschlossen und nimmt keine neuen Anmeldungen mehr an. Bitte wählen Sie einen anderen Termin.',
            true
          );
          setSubmitLoading(false);
          return;
        }

        const maxApplicants = await fetchSlotCapacityMax(db, slotVal);
        if (maxApplicants != null && slotVal) {
          const taken = await countUniqueActiveForSlot(db, slotVal);
          if (!taken.has(emailLower) && taken.size >= maxApplicants) {
            showHint(
              'Dieser Termin ist für neue Bewerberinnen und Bewerber ausgebucht. Bitte wählen Sie einen anderen Termin oder kontaktieren Sie uns.',
              true
            );
            setSubmitLoading(false);
            return;
          }
        }

        const priorCount = await countPriorRegistrationsByEmail(db, emailLower);
        const isTriplicate = priorCount >= 2;

        const ipMeta = await resolveClientIpMeta();

        const payload = {
          salutation: data.get('salutation') || '',
          firstName: data.get('firstName') || '',
          lastName: data.get('lastName') || '',
          email: emailRaw,
          emailLower,
          phone,
          slot: slotVal,
          citizenship: data.get('citizenship') || '',
          contactType,
          message: data.get('message') || '',
          privacyAccepted: Boolean(data.get('privacy')),
          status: isTriplicate ? 'spam' : 'active',
          createdAt: Date.now(),
          registrationIp: ipMeta.registrationIp || '',
          registrationIpSource: ipMeta.registrationIpSource || '',
        };

        if (isTriplicate) {
          payload.autoSpamReason = 'email_triplicate';
        }

        await db.collection('bewerbertag').add(payload);
        localStorage.setItem(LS_LAST_OK_SUBMIT, String(Date.now()));
        form.hidden = true;
        if (successBox) successBox.hidden = false;
      } catch (err) {
        console.error('Fehler beim Speichern der Anmeldung', err);
        showHint('Die Anmeldung konnte gerade nicht gespeichert werden. Bitte später noch einmal versuchen.', true);
        setSubmitLoading(false);
      }
    });
  });
})();
