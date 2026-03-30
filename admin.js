(() => {
  'use strict';

  const DEFAULT_MAIL_SUBJECT = 'Bewerbertag BWK – neue Termine zur Anmeldung';
  const DEFAULT_MAIL_BODY =
    'Sehr geehrte Damen und Herren,\n\n' +
    'wir möchten Sie darüber informieren, dass neue Termine für den Bewerbertag zur Anmeldung freigegeben wurden.\n\n' +
    'Bitte besuchen Sie unseren Anmeldungsbereich und wählen Sie einen passenden Termin aus.\n' +
    '(Hier den Link zur öffentlichen Anmeldung einfügen.)\n\n' +
    'Bei Fragen stehen wir Ihnen gerne zur Verfügung.\n\n' +
    'Mit freundlichen Grüßen\n' +
    'Hartmut Schulze\n' +
    'Lehrgangsleitung AVöD';

  const DEFAULT_SLOT_SUB = 'Bewerbertag · AVöD Ausbildungsvorbereitung';

  const SALUTATION_LABELS = {
    frau: 'Frau',
    herr: 'Herr',
    divers: 'Divers',
  };

  /** Bearbeitungskategorien (Firestore-Feld adminCategory) — Schlüssel + deutsche Anzeige / CSV */
  const ADMIN_CATEGORY_ORDER = [
    'kontaktiert',
    'eingeladen',
    'zusage',
    'absage',
    'warteliste',
    'rueckfrage',
  ];

  const ADMIN_CATEGORY_LABELS = {
    kontaktiert: 'Kontaktiert',
    eingeladen: 'Eingeladen',
    zusage: 'Zusage',
    absage: 'Absage',
    warteliste: 'Warteliste',
    rueckfrage: 'Rückfrage',
  };

  function formatAdminCategoryLabel(key) {
    const k = (key == null ? '' : String(key)).trim();
    if (!k) return 'Keine Kategorie';
    return ADMIN_CATEGORY_LABELS[k] || k;
  }

  function appendCategoryOptions(selectEl, includeEmptyOption) {
    if (!selectEl) return;
    if (includeEmptyOption) {
      const o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = 'Keine Kategorie';
      selectEl.appendChild(o0);
    }
    ADMIN_CATEGORY_ORDER.forEach((k) => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = ADMIN_CATEGORY_LABELS[k];
      selectEl.appendChild(o);
    });
  }

  function wireAdminCategoryFilter(selectEl) {
    if (!selectEl) return;
    selectEl.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'alle Kategorien';
    selectEl.appendChild(all);
    const none = document.createElement('option');
    none.value = '__none__';
    none.textContent = 'ohne Kategorie';
    selectEl.appendChild(none);
    ADMIN_CATEGORY_ORDER.forEach((k) => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = ADMIN_CATEGORY_LABELS[k];
      selectEl.appendChild(o);
    });
  }

  function formatAutoSpamReasonDe(reason) {
    const r = (reason || '').toString().trim();
    if (!r) return '';
    if (r === 'email_triplicate') return 'Gleiche E-Mail mindestens drei Mal';
    return r;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function slotsLib() {
    return window.BWK_BT_SLOTS;
  }

  function formatTime(v) {
    if (v == null) return '—';
    if (typeof v === 'number') {
      try {
        return new Date(v).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        return '—';
      }
    }
    if (v.toDate) {
      try {
        return v.toDate().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        return '—';
      }
    }
    return '—';
  }

  function formatSalutation(v) {
    if (v == null || v === '') return '—';
    return SALUTATION_LABELS[v] || String(v);
  }

  function formatContactType(v) {
    if (v === 'mail') return 'E-Mail';
    if (v === 'phone') return 'Telefon';
    if (v == null || v === '') return '—';
    return String(v);
  }

  function toDatetimeLocalValue(isoOrMs) {
    if (isoOrMs == null || isoOrMs === '') return '';
    const d = new Date(isoOrMs);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function datetimeLocalToIso(val) {
    if (!val || !String(val).trim()) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString();
  }

  function genSlotValue() {
    return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function slotValueFromDateIso(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return genSlotValue();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}`;
  }

  function buildFallbackSlotMap() {
    const m = {};
    const lib = slotsLib();
    const defs = window.BWK_BT_DEFAULTS && window.BWK_BT_DEFAULTS.settings && window.BWK_BT_DEFAULTS.settings.slots;
    if (lib && Array.isArray(defs)) {
      defs.forEach((s) => {
        if (s && s.value) {
          const n = lib.normalizeSlot(s);
          const l1 = lib.computeLine1(n) || n.line1;
          m[s.value] = [l1, n.line2].filter(Boolean).join(' · ') || s.value;
        }
      });
    }
    return m;
  }

  function td(text) {
    const el = document.createElement('td');
    el.textContent = text == null || text === '' ? '—' : String(text);
    return el;
  }

  function csvEscape(s) {
    const t = s == null ? '' : String(s);
    if (/[",;\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* */
    }
    try {
      window.prompt('Kopieren (Strg+C) und Enter:', text);
    } catch {
      /* */
    }
    return false;
  }

  function getSlotsDisplayTypeFromForm() {
    const r = document.querySelector('input[name="btSlotsDisplayType"]:checked');
    return r && r.value === 'freetext' ? 'freetext' : 'date';
  }

  function refreshSimpleSlotTitles() {
    document.querySelectorAll('#btSlotsEditor .bt-admin-slot-simple').forEach((row, i) => {
      const sp = row.querySelector('.bt-admin-slot-simple-title');
      if (sp) sp.textContent = 'Termin ' + (i + 1);
    });
  }

  function updateSlotRemoveButtons() {
    const rows = document.querySelectorAll('#btSlotsEditor .bt-admin-slot-simple');
    const n = rows.length;
    rows.forEach((row) => {
      const b = row.querySelector('.bt-slot-remove');
      if (b) b.hidden = n <= 2;
    });
  }

  function createSimpleSlotRow(displayType, slotData, canRemove) {
    const lib = slotsLib();
    if (!lib) return document.createElement('div');
    const n = lib.normalizeSlot(slotData || {});
    const row = document.createElement('div');
    row.className = 'bt-admin-slot-simple';
    row.dataset.slotValue = n.value || '';

    const head = document.createElement('div');
    head.className = 'bt-admin-slot-simple-head';
    const title = document.createElement('span');
    title.className = 'bt-admin-slot-simple-title';
    head.appendChild(title);

    const btnRm = document.createElement('button');
    btnRm.type = 'button';
    btnRm.className = 'bt-btn bt-btn-ghost bt-btn-xs bt-slot-remove';
    btnRm.textContent = 'Entfernen';
    btnRm.hidden = !canRemove;
    btnRm.addEventListener('click', () => {
      row.remove();
      refreshSimpleSlotTitles();
      updateSlotRemoveButtons();
    });
    head.appendChild(btnRm);
    row.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'bt-admin-slot-simple-grid';

    if (displayType === 'freetext') {
      // ── Freitext: Rich-Text-Editor pro Karte ──
      const l1 = document.createElement('div');
      l1.className = 'bt-field bt-field-full';

      const sp1 = document.createElement('span');
      sp1.textContent = 'Titel (große Zeile auf der Karte)';
      l1.appendChild(sp1);

      // Mini-Toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'bt-slot-ft-toolbar';
      const rteCommands = [
        { label: 'B', tag: 'b', cmd: 'bold', title: 'Fett' },
        { label: 'K', tag: 'i', cmd: 'italic', title: 'Kursiv' },
        { label: 'U', tag: 'u', cmd: 'underline', title: 'Unterstrichen' },
      ];
      rteCommands.forEach(({ label, tag, cmd, title }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bt-slot-ft-cmd';
        btn.title = title;
        btn.innerHTML = `<${tag}>${label}</${tag}>`;
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
          rte.focus();
          document.execCommand(cmd, false, null);
        });
        toolbar.appendChild(btn);
      });
      l1.appendChild(toolbar);

      // Contenteditable-Bereich
      const rte = document.createElement('div');
      rte.className = 'bt-input bt-rich-hint-editable bt-slot-ft-rte';
      rte.contentEditable = 'true';
      rte.setAttribute('role', 'textbox');
      rte.setAttribute('aria-multiline', 'true');
      rte.setAttribute('spellcheck', 'true');
      rte.setAttribute('data-placeholder', 'Titel der Karte …');
      const ftContent =
        n.line1Freetext ||
        (n.line1Mode === 'text' || n.line1Mode === 'internet' ? n.line1Text || n.line1 : '') ||
        '';
      if (/<[a-z]/i.test(ftContent) && typeof window.sanitizeHintHtml === 'function') {
        rte.innerHTML = window.sanitizeHintHtml(ftContent);
      } else {
        rte.textContent = ftContent;
      }
      l1.appendChild(rte);

      const l2 = document.createElement('label');
      l2.className = 'bt-field bt-field-full';
      const sp2 = document.createElement('span');
      sp2.textContent = 'Unterzeile (optional)';
      const t2 = document.createElement('input');
      t2.type = 'text';
      t2.className = 'bt-input bt-slot-sub';
      t2.placeholder = DEFAULT_SLOT_SUB;
      t2.value = n.line2 || '';
      l2.appendChild(sp2);
      l2.appendChild(t2);

      grid.appendChild(l1);
      grid.appendChild(l2);
    } else {
      // ── Datum + Uhrzeit (Start- und Endzeit) ──
      const ldt = document.createElement('label');
      ldt.className = 'bt-field bt-field-full';
      const spdt = document.createElement('span');
      spdt.textContent = 'Datum und Startzeit';
      ldt.appendChild(spdt);

      // Start + End in einer Zeile
      const timeRow = document.createElement('div');
      timeRow.className = 'bt-admin-slot-time-row';

      const dt = document.createElement('input');
      dt.type = 'datetime-local';
      dt.step = '60';
      dt.className = 'bt-input bt-input-compact bt-slot-dt';
      dt.value = toDatetimeLocalValue(n.line1Date) || '';

      const sep = document.createElement('span');
      sep.className = 'bt-admin-slot-time-sep';
      sep.textContent = 'bis';

      const dtEnd = document.createElement('input');
      dtEnd.type = 'time';
      dtEnd.step = '60';
      dtEnd.className = 'bt-input bt-input-compact bt-slot-dt-end bt-admin-slot-endtime';
      dtEnd.placeholder = 'Endzeit';
      dtEnd.title = 'Endzeit (optional, z. B. 12:00)';
      dtEnd.value = n.line1DateEnd || '';

      timeRow.appendChild(dt);
      timeRow.appendChild(sep);
      timeRow.appendChild(dtEnd);
      ldt.appendChild(timeRow);

      const l2 = document.createElement('label');
      l2.className = 'bt-field bt-field-full';
      const sp2 = document.createElement('span');
      sp2.textContent = 'Unterzeile (z. B. Veranstaltungsname)';
      const t2 = document.createElement('input');
      t2.type = 'text';
      t2.className = 'bt-input bt-slot-sub';
      t2.placeholder = DEFAULT_SLOT_SUB;
      t2.value = n.line2 || '';
      l2.appendChild(sp2);
      l2.appendChild(t2);

      grid.appendChild(ldt);
      grid.appendChild(l2);
    }

    const lmax = document.createElement('label');
    lmax.className = 'bt-field bt-field-full';
    const spm = document.createElement('span');
    spm.textContent = 'Max. eindeutige Bewerber (optional, leer = kein Limit)';
    const nm = document.createElement('input');
    nm.type = 'number';
    nm.min = '1';
    nm.step = '1';
    nm.className = 'bt-input bt-input-compact bt-slot-max';
    nm.placeholder = 'ohne Limit';
    const maxN = n.maxApplicants;
    nm.value = maxN != null && maxN !== '' ? String(maxN) : '';
    lmax.appendChild(spm);
    lmax.appendChild(nm);
    grid.appendChild(lmax);

    row.appendChild(grid);
    return row;
  }

  function readMaxApplicantsFromRow(row) {
    const maxEl = row.querySelector('.bt-slot-max');
    if (!maxEl || maxEl.value === '') return null;
    const m = parseInt(maxEl.value, 10);
    return isNaN(m) || m < 1 ? null : m;
  }

  function renderSimpleSlotsEditor(slots, displayType) {
    const root = $('#btSlotsEditor');
    if (!root) return;
    const lib = slotsLib();
    if (!lib) return;
    root.replaceChildren();
    let list = Array.isArray(slots) ? slots.map((s) => lib.normalizeSlot(s)) : [];
    list = list.filter((s) => s);
    if (list.length < 2) {
      while (list.length < 2) {
        list.push({
          value: '',
          line1Mode: displayType === 'freetext' ? 'freetext' : 'date',
          line2: '',
        });
      }
    }
    const canRm = list.length > 2;
    list.forEach((s) => {
      root.appendChild(createSimpleSlotRow(displayType, s, canRm));
    });
    refreshSimpleSlotTitles();
    updateSlotRemoveButtons();
  }

  function readSimpleSlotsPayload() {
    const lib = slotsLib();
    if (!lib) throw new Error('Interner Fehler: Slot-Modul fehlt.');
    const displayType = getSlotsDisplayTypeFromForm();
    const root = $('#btSlotsEditor');
    if (!root) throw new Error('Editor fehlt.');
    const rows = root.querySelectorAll('.bt-admin-slot-simple');
    const out = [];
    let idx = 0;
    rows.forEach((row) => {
      idx++;
      let value = (row.dataset.slotValue || '').trim();
      const subEl = row.querySelector('.bt-slot-sub');
      const sub = subEl ? subEl.value.trim() : '';
      const line2 = sub || DEFAULT_SLOT_SUB;

      if (displayType === 'freetext') {
        // Lese RTE-Inhalt (contenteditable) aus
        const rteEl = row.querySelector('.bt-slot-ft-rte');
        let tit = '';
        if (rteEl) {
          const rawHtml = rteEl.innerHTML.trim();
          const san = typeof window.sanitizeHintHtml === 'function' ? window.sanitizeHintHtml : (x) => x;
          const cleaned = san(rawHtml);
          const tmp = document.createElement('div');
          tmp.innerHTML = cleaned;
          tit = (tmp.textContent || '').trim() ? cleaned : '';
        }
        if (!tit) throw new Error('Termin ' + idx + ': Bitte einen Titel eingeben.');
        if (!value) value = genSlotValue();
        const base = {
          value,
          line1Mode: 'freetext',
          line1Freetext: tit,
          line2,
          line1Date: '',
          line1DateEnd: '',
          line1Text: '',
          line1Url: '',
          line1UrlLabel: '',
        };
        base.line1 = lib.computeLine1(base);
        const cap = readMaxApplicantsFromRow(row);
        if (cap != null) base.maxApplicants = cap;
        out.push(base);
      } else {
        const dtIn = row.querySelector('.bt-slot-dt');
        const iso = datetimeLocalToIso(dtIn && dtIn.value);
        if (!iso) throw new Error('Termin ' + idx + ': Bitte Datum und Uhrzeit wählen.');
        if (!value) value = slotValueFromDateIso(iso);
        const dtEndIn = row.querySelector('.bt-slot-dt-end');
        const endTime = dtEndIn ? dtEndIn.value.trim() : '';
        const base = {
          value,
          line1Mode: 'date',
          line1Date: iso,
          line1DateEnd: endTime,
          line2,
          line1Text: '',
          line1Freetext: '',
          line1Url: '',
          line1UrlLabel: '',
        };
        base.line1 = lib.computeLine1(base);
        const cap = readMaxApplicantsFromRow(row);
        if (cap != null) base.maxApplicants = cap;
        out.push(base);
      }
    });

    const seen = new Set();
    out.forEach((s) => {
      let v = s.value;
      while (seen.has(v)) {
        v = genSlotValue();
      }
      seen.add(v);
      s.value = v;
    });

    return { slots: out, slotsDisplayType: displayType };
  }

  onReady(() => {
    const loginForm = $('#btLoginForm');
    const loginCard = $('#btLoginCard');
    const adminCard = $('#btAdminCard');
    const tbody = $('#btAdminTableBody');
    const hint = $('#btLoginHint');
    const btnLogout = $('#btBtnLogout');
    const btnRefresh = $('#btBtnRefresh');
    const btnCsv = $('#btBtnCsv');
    const btnCopyEmails = $('#btBtnCopyEmails');
    const btnMailTemplate = $('#btBtnMailTemplate');
    const btnBulkSpam = $('#btBtnBulkSpam');
    const btnBulkDelete = $('#btBtnBulkDelete');
    const btnBulkCategory = $('#btBtnBulkCategory');
    const bulkCategorySelect = $('#btBulkCategory');
    const statusEl = $('#btAdminStatus');
    const devHelp = $('#btDevLoginHelp');
    const userLine = $('#btAdminUser');
    const filterText = $('#btFilterText');
    const filterSlot = $('#btFilterSlot');
    const filterCategory = $('#btFilterCategory');
    const filterPreset = $('#btFilterPreset');
    const includeSpam = $('#btIncludeSpam');
    const selectAll = $('#btSelectAll');
    const tabs = document.querySelectorAll('[data-bt-tab]');
    const panels = document.querySelectorAll('[data-bt-panel]');
    const settingsForm = $('#btSettingsForm');
    const settingsHint = $('#btSettingsHint');
    const btnDevReset = $('#btBtnDevReset');
    const slotsEditorRoot = $('#btSlotsEditor');
    const btnAddSlot = $('#btBtnAddSlot');
    const slotsJsonTa = $('#btSetSlotsJson');
    const mailModal = $('#btMailModal');
    const mailSubject = $('#btMailSubject');
    const mailBody = $('#btMailBody');
    const mailOpenDraft = $('#btMailOpenDraft');

    if (!loginForm || !loginCard || !adminCard || !tbody) return;
    wireAdminCategoryFilter(filterCategory);
    if (bulkCategorySelect) appendCategoryOptions(bulkCategorySelect, true);
    if (!slotsLib()) {
      console.error('bewerbertag-slots.js muss vor admin.js geladen werden.');
      return;
    }

    function loadHintIntoRich(html) {
      const rich = $('#btSetInfoRich');
      const hid = $('#btSetInfo');
      if (!hid) return;
      const san =
        typeof window.sanitizeHintHtml === 'function'
          ? window.sanitizeHintHtml
          : function (x) {
              return (x || '').toString().trim();
            };
      const cleaned = san((html || '').toString());
      hid.value = cleaned;
      if (rich) rich.innerHTML = cleaned;
    }

    function syncHintRichToHidden() {
      const rich = $('#btSetInfoRich');
      const hid = $('#btSetInfo');
      if (!hid || !rich) return;
      const san =
        typeof window.sanitizeHintHtml === 'function'
          ? window.sanitizeHintHtml
          : function (x) {
              return (x || '').toString().trim();
            };
      const cleaned = san(rich.innerHTML.trim());
      hid.value = cleaned;
      if (cleaned !== rich.innerHTML.trim()) rich.innerHTML = cleaned;
    }

    function initBtRichHintEditor() {
      const ed = $('#btSetInfoRich');
      if (!ed) return;

      function nearestOl() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        let n = sel.anchorNode;
        if (n.nodeType === Node.TEXT_NODE) n = n.parentElement;
        while (n && n !== ed && n !== document.body) {
          if (n.nodeName === 'OL') return n;
          n = n.parentElement;
        }
        return null;
      }

      document.querySelectorAll('[data-rich-hint-cmd]').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
          ed.focus();
          const cmd = btn.getAttribute('data-rich-hint-cmd');
          if (cmd === 'bold') document.execCommand('bold', false, null);
          else if (cmd === 'italic') document.execCommand('italic', false, null);
          else if (cmd === 'underline') document.execCommand('underline', false, null);
          else if (cmd === 'ul') document.execCommand('insertUnorderedList', false, null);
          else if (cmd === 'ol') {
            document.execCommand('insertOrderedList', false, null);
            const ol = nearestOl();
            if (ol && ed.contains(ol)) ol.classList.remove('bt-rich-ol-alpha');
          } else if (cmd === 'olAlpha') {
            document.execCommand('insertOrderedList', false, null);
            const ol = nearestOl();
            if (ol && ed.contains(ol)) ol.classList.add('bt-rich-ol-alpha');
          }
        });
      });

      const col = $('#btRichHintColor');
      if (col) {
        col.addEventListener('mousedown', (e) => e.stopPropagation());
        col.addEventListener('change', () => {
          const v = col.value;
          if (!v) return;
          ed.focus();
          document.execCommand('foreColor', false, v);
          col.selectedIndex = 0;
        });
      }

      ed.addEventListener('blur', () => syncHintRichToHidden());
    }

    initBtRichHintEditor();

    const isDev = !!window.BWK_ADMIN_DEV_MODE;
    const auth = isDev && window.__bwkDevAuth ? window.__bwkDevAuth : firebase.auth();
    const db = isDev && window.__bwkDevFirestore ? window.__bwkDevFirestore : firebase.firestore();

    if (devHelp && isDev) {
      devHelp.hidden = false;
    }

    if (hint && isDev) {
      hint.textContent =
        'Demonstrator: Zugang siehe „Demonstrator-Hilfe“. Produktiv: Firebase Authentication.';
    }

    let slotLabelMap = buildFallbackSlotMap();
    let lastSettingsSlots = [];
    let unsubscribeList = null;
    let lastFilteredRows = [];
    let allDocs = [];
    const selectedIds = new Set();
    let editorDisplayTypeLocked = 'date';
    let participantMailSlotValue = '';

    function emailKeyFromDocData(d) {
      if (!d) return '';
      return (d.emailLower || (d.email || '').toString().toLowerCase().trim()) || '';
    }

    function projectConfirmedUniqueAfterAssign(slotValue, assignIds) {
      const assignSet = new Set(assignIds);
      const emails = new Set();
      allDocs.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || d.status === 'spam') return;
        let effSlot = d.slot || '';
        let effRoster = !!d.rosterConfirmed;
        if (assignSet.has(docSnap.id)) {
          effSlot = slotValue;
          effRoster = true;
        }
        if (effSlot !== slotValue || !effRoster) return;
        const em = emailKeyFromDocData(d);
        if (em) emails.add(em);
      });
      return emails.size;
    }

    function getConfirmedRecipientsForSlot(slotValue) {
      const list = [];
      const seen = new Set();
      allDocs.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || d.status === 'spam') return;
        if ((d.slot || '') !== slotValue || !d.rosterConfirmed) return;
        const em = (d.email || '').toString().trim();
        const key = emailKeyFromDocData(d);
        if (!em || !key || seen.has(key)) return;
        seen.add(key);
        list.push(em);
      });
      return list.sort();
    }

    function getSlotMeta(slotValue) {
      const s = lastSettingsSlots.find((x) => x && x.value === slotValue);
      const courseLine =
        s && (s.line2 || '').toString().trim() ? (s.line2 || '').toString().trim() : DEFAULT_SLOT_SUB;
      return { slotRow: s, courseLine, label: slotLabelMap[slotValue] || slotValue };
    }

    function participantMailTexts(templateKey, terminLabel, courseLine) {
      const avod = courseLine || DEFAULT_SLOT_SUB;
      const lehrgangKern = 'AVöD-Lehrgang (Ausbildungsvorbereitung) — ' + avod;
      if (templateKey === 'stammblatt') {
        return {
          subject: 'Bewerbertag – Stammblätter und Terminbestätigung',
          body:
            'Sehr geehrte Damen und Herren,\n\n' +
            'wir bestätigen Ihre Teilnahme am Bewerbertag im Rahmen des ' +
            lehrgangKern +
            '.\n\n' +
            'Termin: ' +
            terminLabel +
            '\n' +
            'Lehrgang / Kennung: ' +
            avod +
            '\n\n' +
            'Im Anhang (bitte im Mailprogramm ergänzen) finden Sie die Stammblätter. Füllen Sie diese vor dem Termin aus und schicken uns diese umgehend zurück.\n\n' +
            'Melden Sie sich bei Rückfragen gerne bei uns.\n\n' +
            'Mit freundlichen Grüßen\n' +
            'Hartmut Schulze\n' +
            'Lehrgangsleitung AVöD';
        };
      }
      if (templateKey === 'hausaufgaben') {
        return {
          subject: 'Bewerbertag – Hausaufgaben zur Bewerbungsrunde',
          body:
            'Sehr geehrte Damen und Herren,\n\n' +
            'bezogen auf den Termin ' +
            terminLabel +
            ' (' +
            lehrgangKern +
            ') senden wir Ihnen die Hausaufgaben für die laufende Bewerbungsrunde.\n\n' +
            'Die Aufgaben finden Sie im Anhang (bitte im Mailprogramm beifügen). Bei Fragen melden Sie sich gern.\n\n' +
            'Mit freundlichen Grüßen\n' +
            'Hartmut Schulze\n' +
            'Lehrgangsleitung AVöD';
        };
      }
      return {
        subject: 'Bewerbertag – Information zum Termin',
        body:
          'Sehr geehrte Damen und Herren,\n\n' +
          'Termin: ' +
          terminLabel +
          '\n' +
          'Lehrgang / Kennung: ' +
          avod +
          '\n\n' +
          '(Hier Ihren freien Text einfügen.)\n\n' +
          'Mit freundlichen Grüßen\n' +
            'Hartmut Schulze\n' +
            'Lehrgangsleitung AVöD';
      };
    }

    function attachmentNamesHint() {
      const inp = $('#btParticipantMailFiles');
      if (!inp || !inp.files || !inp.files.length) return '';
      const names = [];
      for (let i = 0; i < inp.files.length; i++) names.push(inp.files[i].name);
      return '\n\n—\nGeplante Anhänge (bitte im Mailprogramm anfügen): ' + names.join(', ');
    }

    function applyParticipantMailTemplateUi() {
      const subEl = $('#btParticipantMailSubject');
      const bodyEl = $('#btParticipantMailBody');
      const sel = $('#btParticipantMailTemplate');
      const ctx = $('#btParticipantMailContext');
      if (!subEl || !bodyEl || !sel || !participantMailSlotValue) return;
      const meta = getSlotMeta(participantMailSlotValue);
      const t = participantMailTexts(sel.value, meta.label, meta.courseLine);
      subEl.value = t.subject;
      bodyEl.value = t.body;
      if (ctx) ctx.textContent = 'Termin: ' + meta.label + ' · ' + meta.courseLine;
    }

    function openParticipantMailModal(slotValue) {
      const modal = $('#btParticipantMailModal');
      const title = $('#btParticipantMailTitle');
      if (!modal) return;
      const emails = getConfirmedRecipientsForSlot(slotValue);
      if (!emails.length) {
        alert('Keine zugewiesenen Teilnehmer/-innen für diesen Termin.');
        return;
      }
      participantMailSlotValue = slotValue;
      if (title) title.textContent = 'Teilnehmer/-innen informieren';
      const tpl = $('#btParticipantMailTemplate');
      if (tpl) tpl.value = 'stammblatt';
      const filesInp = $('#btParticipantMailFiles');
      if (filesInp) filesInp.value = '';
      applyParticipantMailTemplateUi();
      modal.hidden = false;
      const first = $('#btParticipantMailSubject');
      if (first) first.focus();
    }

    function closeParticipantMailModal() {
      const modal = $('#btParticipantMailModal');
      if (modal) modal.hidden = true;
      participantMailSlotValue = '';
    }

    async function assignSelectedToSlot(slotValue) {
      const label = slotLabelMap[slotValue] || slotValue;
      const ids = [...selectedIds];
      const toUpdate = [];
      let skippedSpam = 0;
      ids.forEach((id) => {
        const docSnap = allDocs.find((x) => x.id === id);
        if (!docSnap) return;
        const d = docSnap.data();
        if (!d || d.status === 'spam') {
          skippedSpam++;
          return;
        }
        toUpdate.push(docSnap.id);
      });
      if (!toUpdate.length) {
        alert(
          skippedSpam
            ? 'Keine gültige Auswahl (Spam-Einträge werden nicht zugewiesen).'
            : 'Keine Zeilen ausgewählt.'
        );
        return;
      }
      let max = null;
      const slotRow = lastSettingsSlots.find((s) => s && s.value === slotValue);
      if (slotRow && slotRow.maxApplicants != null && slotRow.maxApplicants !== '') {
        const n = parseInt(String(slotRow.maxApplicants), 10);
        if (!isNaN(n) && n > 0) max = n;
      }
      const projected = projectConfirmedUniqueAfterAssign(slotValue, toUpdate);
      if (max != null && projected > max) {
        if (
          !confirm(
            'Nach der Zuweisung wären ' +
              projected +
              ' eindeutige bestätigte E-Mails bei einem Limit von ' +
              max +
              ' pro Termin. Trotzdem fortfahren?'
          )
        ) {
          return;
        }
      }
      if (
        !confirm(
          toUpdate.length +
            ' Person(en) dem Termin „' +
            label +
            '“ zuweisen? (Einträge werden diesem Termin zugeordnet und als Teil der Gruppe markiert.)'
        )
      ) {
        return;
      }
      const CHUNK = typeof db.batch === 'function' ? 400 : toUpdate.length;
      try {
        for (let i = 0; i < toUpdate.length; i += CHUNK) {
          const chunk = toUpdate.slice(i, i + CHUNK);
          if (typeof db.batch === 'function') {
            const batch = db.batch();
            chunk.forEach((id) => {
              batch.update(db.collection('bewerbertag').doc(id), {
                slot: slotValue,
                rosterConfirmed: true,
              });
            });
            await batch.commit();
          } else {
            await Promise.all(
              chunk.map((id) =>
                db.collection('bewerbertag').doc(id).update({
                  slot: slotValue,
                  rosterConfirmed: true,
                })
              )
            );
          }
        }
        setStatus(
          toUpdate.length +
            ' Person(en) zugewiesen.' +
            (skippedSpam ? ' (' + skippedSpam + ' Spam übersprungen)' : '')
        );
      } catch (e) {
        console.error(e);
        alert(
          'Zuweisung fehlgeschlagen (Rechte oder Netz). Prüfen Sie ggf. die Firestore-Regeln für das Feld rosterConfirmed.'
        );
      }
    }

    function renderCapacitySummary() {
      const el = $('#btSlotCapacitySummary');
      if (!el) return;
      if (!lastSettingsSlots.length) {
        el.hidden = true;
        el.replaceChildren();
        return;
      }
      const activeBySlot = {};
      const confirmedBySlotCap = {};
      allDocs.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || d.status === 'spam') return;
        const slot = d.slot || '';
        if (!slot) return;
        if (!activeBySlot[slot]) activeBySlot[slot] = new Set();
        const em = d.emailLower || (d.email || '').toString().toLowerCase().trim();
        if (em) activeBySlot[slot].add(em);
        if (d.rosterConfirmed) {
          if (!confirmedBySlotCap[slot]) confirmedBySlotCap[slot] = new Set();
          if (em) confirmedBySlotCap[slot].add(em);
        }
      });
      el.replaceChildren();
      el.hidden = false;
      const title = document.createElement('p');
      title.className = 'bt-hint';
      title.style.marginTop = '0';
      const strong = document.createElement('strong');
      strong.textContent =
        'Aktuelle Belegung (nur aktive Einträge; je Termin zählen eindeutige E-Mail-Adressen)';
      title.appendChild(strong);
      el.appendChild(title);
      const ul = document.createElement('ul');
      ul.className = 'bt-admin-capacity-list';
      lastSettingsSlots.forEach((s) => {
        if (!s || !s.value) return;
        const maxRaw =
          s.maxApplicants != null && s.maxApplicants !== ''
            ? parseInt(String(s.maxApplicants), 10)
            : null;
        const max = maxRaw != null && !isNaN(maxRaw) && maxRaw > 0 ? maxRaw : null;
        const n = (activeBySlot[s.value] && activeBySlot[s.value].size) || 0;
        const nConf = (confirmedBySlotCap[s.value] && confirmedBySlotCap[s.value].size) || 0;
        const label = slotLabelMap[s.value] || s.value;
        const li = document.createElement('li');
        let line = '';
        if (max != null) {
          line = label + ': ' + n + ' / ' + max;
          if (n >= max) li.classList.add('bt-admin-capacity-full');
        } else {
          line = label + ': ' + n + ' (ohne Limit)';
        }
        if (nConf > 0) line += ' · final ' + nConf;
        if (s.closed === true) line += ' · geschlossen (nicht öffentlich)';
        li.textContent = line;
        ul.appendChild(li);
      });
      el.appendChild(ul);
    }

    async function bulkSetCategoryForSlot(slotValue, categoryKey) {
      const matches = allDocs.filter((docSnap) => {
        const d = docSnap.data();
        return d && (d.slot || '') === slotValue;
      });
      if (!matches.length) {
        alert('Keine Anmeldungen für diesen Termin im Bestand.');
        return;
      }
      const val = categoryKey == null ? '' : String(categoryKey).trim();
      const label = formatAdminCategoryLabel(val);
      if (
        !confirm(
          matches.length +
            ' Anmeldung(en) für diesen Termin mit der Kategorie „' +
            label +
            '“ versehen?'
        )
      ) {
        return;
      }
      const CHUNK = typeof db.batch === 'function' ? 400 : matches.length;
      try {
        for (let i = 0; i < matches.length; i += CHUNK) {
          const chunk = matches.slice(i, i + CHUNK);
          if (typeof db.batch === 'function') {
            const batch = db.batch();
            chunk.forEach((docSnap) => {
              batch.update(db.collection('bewerbertag').doc(docSnap.id), { adminCategory: val });
            });
            await batch.commit();
          } else {
            await Promise.all(
              chunk.map((docSnap) =>
                db.collection('bewerbertag').doc(docSnap.id).update({ adminCategory: val })
              )
            );
          }
        }
        setStatus(matches.length + ' Einträge aktualisiert · Kategorie: ' + label);
      } catch (e) {
        console.error(e);
        alert('Kategorien konnten nicht gespeichert werden (Rechte oder Netz).');
      }
    }

    function renderAdminSlotOverview() {
      const el = $('#btAdminSlotOverview');
      if (!el) return;
      if (!lastSettingsSlots.length) {
        el.hidden = true;
        el.replaceChildren();
        return;
      }
      el.hidden = false;
      el.replaceChildren();

      const head = document.createElement('div');
      head.className = 'bt-admin-slot-overview-head';
      const h2 = document.createElement('h2');
      h2.className = 'bt-admin-overview-title';
      h2.textContent = 'Termine & aktuelle Anmeldungen';
      head.appendChild(h2);
      const intro = document.createElement('p');
      intro.className = 'bt-hint';
      intro.style.margin = '0';
      head.appendChild(intro);
      el.appendChild(head);

      const activeBySlot = {};
      const confirmedBySlot = {};
      allDocs.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || d.status === 'spam') return;
        const slot = d.slot || '';
        if (!slot) return;
        if (!activeBySlot[slot]) activeBySlot[slot] = new Set();
        const em = d.emailLower || (d.email || '').toString().toLowerCase().trim();
        if (em) activeBySlot[slot].add(em);
        if (d.rosterConfirmed) {
          if (!confirmedBySlot[slot]) confirmedBySlot[slot] = new Set();
          if (em) confirmedBySlot[slot].add(em);
        }
      });

      const grid = document.createElement('div');
      grid.className = 'bt-admin-slot-overview-grid';

      lastSettingsSlots.forEach((s) => {
        if (!s || !s.value) return;
        const maxRaw =
          s.maxApplicants != null && s.maxApplicants !== ''
            ? parseInt(String(s.maxApplicants), 10)
            : null;
        const max = maxRaw != null && !isNaN(maxRaw) && maxRaw > 0 ? maxRaw : null;
        const n = (activeBySlot[s.value] && activeBySlot[s.value].size) || 0;
        const nConf = (confirmedBySlot[s.value] && confirmedBySlot[s.value].size) || 0;
        const label = slotLabelMap[s.value] || s.value;
        const isClosed = s.closed === true;
        const rosterFull = max != null && nConf >= max;

        const card = document.createElement('div');
        card.className = 'bt-admin-slot-overview-card';
        if (isClosed) card.classList.add('is-closed');
        if (rosterFull) card.classList.add('is-roster-full');

        const titleEl = document.createElement('div');
        titleEl.className = 'bt-admin-slot-overview-card-title';
        titleEl.textContent = label;
        card.appendChild(titleEl);

        const stats = document.createElement('div');
        stats.className = 'bt-admin-slot-overview-stats';
        const lineReg = document.createElement('div');
        lineReg.className = 'bt-admin-slot-overview-stats-line';
        if (max != null) {
          lineReg.textContent = n + ' / ' + max + ' Plätze (Online-Anmeldungen, eindeutige E-Mails)';
          if (n >= max) lineReg.classList.add('is-reg-full');
        } else {
          lineReg.textContent = n + ' Anmeldung' + (n === 1 ? '' : 'en') + ' (ohne Limit)';
        }
        stats.appendChild(lineReg);
        const lineRoster = document.createElement('div');
        lineRoster.className = 'bt-admin-slot-overview-stats-line is-roster-count';
        if (max != null) {
          lineRoster.textContent = nConf + ' / ' + max + ' bestätigt (eindeutige E-Mails)';
        } else {
          lineRoster.textContent = nConf + ' bestätigt';
        }
        stats.appendChild(lineRoster);
        card.appendChild(stats);

        if (rosterFull) {
          const ok = document.createElement('p');
          ok.className = 'bt-admin-slot-overview-roster-ok';
          ok.textContent =
            'Gruppe vollständig bestätigt — Sie können die Teilnehmer/-innen informieren und Unterlagen versenden.';
          card.appendChild(ok);
        }

        if (isClosed) {
          const badge = document.createElement('p');
          badge.className = 'bt-admin-slot-overview-badge';
          badge.textContent = 'Geschlossen — keine neuen Online-Anmeldungen';
          card.appendChild(badge);
        }

        const actions = document.createElement('div');
        actions.className = 'bt-admin-slot-overview-actions';
        const btnAssign = document.createElement('button');
        btnAssign.type = 'button';
        btnAssign.className = 'bt-btn bt-btn-secondary bt-btn-xs';
        btnAssign.textContent = 'Auswahl diesem Termin zuweisen';
        btnAssign.setAttribute('aria-label', 'Markierte Bewerber diesem Termin zuweisen');
        btnAssign.addEventListener('click', () => {
          void assignSelectedToSlot(s.value);
        });
        actions.appendChild(btnAssign);

        if (rosterFull) {
          const btnInform = document.createElement('button');
          btnInform.type = 'button';
          btnInform.className = 'bt-btn bt-btn-xs';
          btnInform.textContent = 'Teilnehmer/-innen über Teilnahme informieren';
          btnInform.addEventListener('click', () => {
            openParticipantMailModal(s.value);
          });
          actions.appendChild(btnInform);
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        if (isClosed) {
          btn.className = 'bt-btn bt-btn-secondary bt-btn-xs';
          btn.textContent = 'Termin wieder öffnen';
          btn.addEventListener('click', () => {
            void toggleSlotClosed(s.value, false);
          });
        } else {
          btn.className = 'bt-btn bt-btn-ghost bt-btn-xs';
          btn.textContent = 'Termin schließen';
          btn.addEventListener('click', () => {
            if (
              confirm(
                'Diesen Termin auf der Anmeldeseite schließen? Neue Bewerberinnen und Bewerber können ihn nicht mehr wählen. Bestehende Einträge in der Tabelle bleiben erhalten.'
              )
            ) {
              void toggleSlotClosed(s.value, true);
            }
          });
        }
        actions.appendChild(btn);
        card.appendChild(actions);

        const catWrap = document.createElement('div');
        catWrap.className = 'bt-admin-slot-overview-cat';
        const catLab = document.createElement('span');
        catLab.className = 'bt-admin-slot-overview-cat-label';
        catLab.textContent = 'Kategorie für alle Anmeldungen:';
        const catSel = document.createElement('select');
        catSel.className = 'bt-input bt-input-compact';
        catSel.setAttribute('aria-label', 'Kategorie für alle Anmeldungen zu diesem Termin');
        appendCategoryOptions(catSel, true);
        const catBtn = document.createElement('button');
        catBtn.type = 'button';
        catBtn.className = 'bt-btn bt-btn-secondary bt-btn-xs';
        catBtn.textContent = 'Kategorie setzen';
        catBtn.addEventListener('click', () => {
          void bulkSetCategoryForSlot(s.value, catSel.value);
        });
        catWrap.appendChild(catLab);
        catWrap.appendChild(catSel);
        catWrap.appendChild(catBtn);
        card.appendChild(catWrap);

        grid.appendChild(card);
      });

      el.appendChild(grid);
    }

    async function toggleSlotClosed(slotValue, closed) {
      try {
        const snap = await db.collection('bewerbertag_settings').doc('singleton').get();
        let slots = [];
        if (snap.exists && snap.data() && Array.isArray(snap.data().slots)) {
          slots = snap.data().slots.map((x) => Object.assign({}, x));
        } else if (
          window.BWK_BT_DEFAULTS &&
          window.BWK_BT_DEFAULTS.settings &&
          Array.isArray(window.BWK_BT_DEFAULTS.settings.slots)
        ) {
          slots = window.BWK_BT_DEFAULTS.settings.slots.map((x) => Object.assign({}, x));
        }
        let found = false;
        slots = slots.map((s) => {
          if (s.value === slotValue) {
            found = true;
            return Object.assign({}, s, { closed: !!closed });
          }
          return s;
        });
        if (!found) {
          alert('Termin nicht gefunden. Bitte unter „Termine & Hinweistext“ speichern oder die Seite neu laden.');
          return;
        }
        const payload = {
          slots,
          updatedAt: isDev ? Date.now() : firebase.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection('bewerbertag_settings').doc('singleton').set(payload, { merge: true });
        lastSettingsSlots = slots.map((s) => Object.assign({}, s));
        slotLabelMap = buildSlotMapFromSettings({ slots });
        renderAdminSlotOverview();
        renderCapacitySummary();
        onDatasetChanged();
      } catch (e) {
        console.error(e);
        alert('Termin-Status konnte nicht gespeichert werden (Rechte oder Netz).');
      }
    }

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || '';
    }

    function buildSlotMapFromSettings(data) {
      const m = buildFallbackSlotMap();
      const lib = slotsLib();
      if (data && Array.isArray(data.slots) && lib) {
        data.slots.forEach((s) => {
          if (s && s.value) {
            const n = lib.normalizeSlot(s);
            const l1 = lib.computeLine1(n) || n.line1;
            m[s.value] = [l1, n.line2].filter(Boolean).join(' · ') || s.value;
          }
        });
      }
      return m;
    }

    function formatSlot(v) {
      if (v == null || v === '') return '—';
      return slotLabelMap[v] || String(v);
    }

    function rowFromDoc(docSnap) {
      const d = docSnap.data();
      const firstName = (d.firstName || '').toString().trim();
      const lastName = (d.lastName || '').toString().trim();
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || '—';
      const status = d.status === 'spam' ? 'spam' : 'active';
      const email = (d.email || '').toString().trim();
      return {
        id: docSnap.id,
        raw: d,
        createdAt: formatTime(d.createdAt),
        status,
        salutation: formatSalutation(d.salutation),
        firstName,
        lastName,
        displayName,
        slot: formatSlot(d.slot),
        slotValue: d.slot || '',
        contact: formatContactType(d.contactType),
        email,
        phone: (d.phone || '').toString().trim(),
        citizenship: (d.citizenship || '').toString().trim(),
        message: (d.message || '').toString().trim(),
        registrationIp: (d.registrationIp || '').toString().trim(),
        autoSpamReason: (d.autoSpamReason || '').toString().trim(),
        adminCategory: (d.adminCategory || '').toString().trim(),
        categoryLabel: formatAdminCategoryLabel(d.adminCategory),
        rosterConfirmed: !!d.rosterConfirmed,
      };
    }

    function dupCountsAllFromRows(rows) {
      const c = {};
      rows.forEach((r) => {
        const e = r.email.toLowerCase();
        if (e) c[e] = (c[e] || 0) + 1;
      });
      return c;
    }

    function applyFilters(rows, dupCountsAll) {
      const q = (filterText && filterText.value ? filterText.value : '').toLowerCase().trim();
      const slot = filterSlot ? filterSlot.value : '';
      const catF = filterCategory && filterCategory.value != null ? filterCategory.value : '';
      const spamOk = includeSpam && includeSpam.checked;
      const preset = filterPreset && filterPreset.value ? filterPreset.value : 'all';

      return rows.filter((r) => {
        if (catF === '__none__') {
          if ((r.adminCategory || '').trim()) return false;
        } else if (catF) {
          if ((r.adminCategory || '').trim() !== catF) return false;
        }

        if (preset === 'active') {
          if (r.status === 'spam') return false;
        } else if (preset === 'spam') {
          if (r.status !== 'spam') return false;
        } else if (preset === 'dups') {
          const ek = r.email.toLowerCase();
          if (!ek || (dupCountsAll[ek] || 0) <= 1) return false;
          if (!spamOk && r.status === 'spam') return false;
        } else {
          if (!spamOk && r.status === 'spam') return false;
        }

        if (slot && r.slotValue !== slot) return false;

        if (!q) return true;
        const hay = [
          r.displayName,
          r.email,
          r.phone,
          r.message,
          r.slot,
          r.salutation,
          r.contact,
          r.categoryLabel,
          r.adminCategory,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    function syncSelectAllCheckbox() {
      if (!selectAll) return;
      const vis = lastFilteredRows;
      if (!vis.length) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
      }
      const nSel = vis.filter((r) => selectedIds.has(r.id)).length;
      selectAll.checked = nSel === vis.length;
      selectAll.indeterminate = nSel > 0 && nSel < vis.length;
    }

    function renderTable(rows, dupCountsAll) {
      tbody.replaceChildren();
      lastFilteredRows = rows;
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        if (r.status === 'spam') tr.classList.add('bt-admin-row-spam');
        if (r.rosterConfirmed) tr.classList.add('bt-admin-row-roster');
        const emailKey = r.email.toLowerCase();
        if (emailKey && (dupCountsAll[emailKey] || 0) > 1) tr.classList.add('bt-admin-row-dup');

        const tdCh = document.createElement('td');
        tdCh.className = 'bt-admin-td-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.setAttribute('data-id', r.id);
        cb.checked = selectedIds.has(r.id);
        cb.addEventListener('change', () => {
          if (cb.checked) selectedIds.add(r.id);
          else selectedIds.delete(r.id);
          syncSelectAllCheckbox();
        });
        tdCh.appendChild(cb);
        tr.appendChild(tdCh);

        const tdSt = document.createElement('td');
        tdSt.textContent = r.status === 'spam' ? 'Spam' : 'Aktiv';
        if (r.autoSpamReason === 'email_triplicate') {
          tdSt.title = 'Automatisch als Spam: dieselbe E-Mail mindestens ein drittes Mal';
        }
        tr.appendChild(tdSt);
        tr.appendChild(td(r.createdAt));

        const tdName = document.createElement('td');
        tdName.textContent = r.displayName;
        tr.appendChild(tdName);

        const tdEm = document.createElement('td');
        const dupN = emailKey ? dupCountsAll[emailKey] || 0 : 0;
        tdEm.textContent = r.email || '—';
        if (dupN > 1) tdEm.title = 'Gleiche E-Mail ' + dupN + '× im Bestand';
        tr.appendChild(tdEm);

        tr.appendChild(td(r.registrationIp));

        tr.appendChild(td(r.slot));

        const tdCat = document.createElement('td');
        tdCat.className = 'bt-admin-td-category';
        const catSel = document.createElement('select');
        catSel.className = 'bt-input bt-input-compact';
        appendCategoryOptions(catSel, true);
        catSel.value = r.adminCategory || '';
        let catBusy = false;
        catSel.addEventListener('change', () => {
          if (catBusy) return;
          catBusy = true;
          const v = catSel.value;
          db.collection('bewerbertag')
            .doc(r.id)
            .update({ adminCategory: v })
            .catch((e) => {
              console.error(e);
              alert('Kategorie konnte nicht gespeichert werden. Firestore-Regeln prüfen.');
              catSel.value = r.adminCategory || '';
            })
            .finally(() => {
              catBusy = false;
            });
        });
        tdCat.appendChild(catSel);
        tr.appendChild(tdCat);

        // Klick auf Name → Detail-Popup
        tdName.style.cursor = 'pointer';
        tdName.title = 'Details anzeigen';
        tdName.addEventListener('click', () => openDetailModal(r));

        const tdAct = document.createElement('td');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bt-btn bt-btn-xs ' + (r.status === 'spam' ? 'bt-btn-secondary' : 'bt-btn-ghost');
        b.textContent = r.status === 'spam' ? 'Aktiv' : 'Spam';
        b.addEventListener('click', () => toggleSpam(r.id, r.status !== 'spam'));
        tdAct.appendChild(b);
        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
      syncSelectAllCheckbox();
      const parts = [];
      parts.push(rows.length + ' Einträge');
      const spamN = rows.filter((x) => x.status === 'spam').length;
      if (spamN) parts.push(spamN + ' Spam');
      setStatus(parts.join(' · '));
    }

    // ── Detail-Modal ──────────────────────────────────────────────────────────
    const detailModal = $('#btDetailModal');
    const detailList = $('#btDetailList');

    const CITIZENSHIP_LABELS = {
      deutsch: 'Deutscher Staatsbürger',
      eu_ewr: 'EU/EWR-Bürger',
      aufenthaltstitel: 'Gültiger Aufenthaltstitel',
      keins: 'Keins davon',
    };

    function openDetailModal(r) {
      if (!detailModal || !detailList) return;
      const raw = r.raw || {};

      function dlRow(label, value) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value && value !== '—' ? value : '—';
        detailList.appendChild(dt);
        detailList.appendChild(dd);
      }

      detailList.replaceChildren();
      dlRow('Status', r.status === 'spam' ? 'Spam' : 'Aktiv');
      dlRow('Zeitstempel', r.createdAt);
      dlRow('Kategorie', r.categoryLabel !== 'Keine Kategorie' ? r.categoryLabel : '—');
      dlRow('Anrede', r.salutation);
      dlRow('Name', r.displayName);
      dlRow('E-Mail', r.email);
      dlRow('Telefon', r.phone || '—');
      dlRow('Staatsangehörigkeit', CITIZENSHIP_LABELS[raw.citizenship] || raw.citizenship || '—');
      dlRow('Termin', r.slot);
      dlRow('Kontaktweg', r.contact);
      dlRow('Fragen / Hinweise', r.message || '—');
      dlRow('Zugewiesen', r.rosterConfirmed ? 'Ja' : 'Nein');
      dlRow('IP-Adresse', r.registrationIp || '—');

      detailModal.hidden = false;
    }

    function closeDetailModal() {
      if (detailModal) detailModal.hidden = true;
    }

    if (detailModal) {
      detailModal.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-bt-detail-close') || e.target.closest('[data-bt-detail-close]')) {
          closeDetailModal();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !detailModal.hidden) closeDetailModal();
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    function toggleSpam(id, asSpam) {
      db.collection('bewerbertag')
        .doc(id)
        .update({ status: asSpam ? 'spam' : 'active' })
        .catch((e) => {
          console.error(e);
          alert('Konnte Status nicht speichern. Firestore-Regeln prüfen.');
        });
    }

    function refreshSlotFilterOptions(rows) {
      if (!filterSlot) return;
      const cur = filterSlot.value;
      const values = new Set();
      rows.forEach((r) => {
        if (r.slotValue) values.add(r.slotValue);
      });
      Object.keys(slotLabelMap).forEach((k) => values.add(k));
      filterSlot.innerHTML = '<option value="">alle Termine</option>';
      Array.from(values)
        .sort()
        .forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = slotLabelMap[v] || v;
          filterSlot.appendChild(opt);
        });
      if (cur && Array.from(filterSlot.options).some((o) => o.value === cur)) filterSlot.value = cur;
    }

    function onDatasetChanged() {
      const rows = allDocs.map(rowFromDoc);
      const dupCountsAll = dupCountsAllFromRows(rows);
      refreshSlotFilterOptions(rows);
      renderTable(applyFilters(rows, dupCountsAll), dupCountsAll);
      renderCapacitySummary();
      renderAdminSlotOverview();
    }

    if (selectAll) {
      selectAll.addEventListener('change', () => {
        const checked = selectAll.checked;
        lastFilteredRows.forEach((r) => {
          if (checked) selectedIds.add(r.id);
          else selectedIds.delete(r.id);
        });
        tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach((el) => {
          el.checked = checked;
        });
        syncSelectAllCheckbox();
      });
    }

    function attachListener() {
      if (unsubscribeList) {
        unsubscribeList();
        unsubscribeList = null;
      }
      setStatus('Lade …');
      unsubscribeList = db
        .collection('bewerbertag')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          (snap) => {
            allDocs = [];
            snap.forEach((d) => allDocs.push(d));
            onDatasetChanged();
          },
          (err) => {
            console.error(err);
            allDocs = [];
            tbody.replaceChildren();
            lastFilteredRows = [];
            setStatus('Fehler beim Laden (Regeln / Index / Netz).');
          }
        );
    }

    function syncSlotsJsonTextarea(slotsArr) {
      if (slotsJsonTa) slotsJsonTa.value = JSON.stringify(slotsArr, null, 2);
    }

    function wireSlotsTypeRadios() {
      document.querySelectorAll('input[name="btSlotsDisplayType"]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const next = inp.value;
          if (next === editorDisplayTypeLocked) return;
          if (
            !confirm(
              'Wenn Sie die Termin-Art wechseln, werden die aktuellen Einträge verworfen und durch zwei leere Termine ersetzt. Fortfahren?'
            )
          ) {
            const prev = document.querySelector(
              'input[name="btSlotsDisplayType"][value="' + editorDisplayTypeLocked + '"]'
            );
            if (prev) prev.checked = true;
            return;
          }
          editorDisplayTypeLocked = next;
          renderSimpleSlotsEditor([], next);
        });
      });
    }

    async function loadSettingsUi() {
      if (!settingsForm) return;
      const lib = slotsLib();
      try {
        const snap = await db.collection('bewerbertag_settings').doc('singleton').get();
        let data =
          snap.exists && snap.data()
            ? snap.data()
            : (window.BWK_BT_DEFAULTS && window.BWK_BT_DEFAULTS.settings) || {};
        slotLabelMap = buildSlotMapFromSettings(data);
        $('#btSetUseSlots').value = data.useSlots === false ? 'false' : 'true';
        loadHintIntoRich((data.infoWhenNoSlots || '').toString());
        let slots = data.slots;
        if (!Array.isArray(slots) && window.BWK_BT_DEFAULTS) slots = window.BWK_BT_DEFAULTS.settings.slots;
        slots = Array.isArray(slots) ? slots : [];
        lastSettingsSlots = slots.map((s) => Object.assign({}, s));
        const displayType = lib.inferSlotsDisplayType(data);
        editorDisplayTypeLocked = displayType;
        const r = document.querySelector('input[name="btSlotsDisplayType"][value="' + displayType + '"]');
        if (r) r.checked = true;
        renderSimpleSlotsEditor(slots, displayType);
        syncSlotsJsonTextarea(
          slots.map((s) => {
            const n = lib.normalizeSlot(s);
            return { ...n, line1: lib.computeLine1(n) || n.line1 };
          })
        );
        if (settingsHint) settingsHint.textContent = '';
        onDatasetChanged();
      } catch (e) {
        console.error(e);
        if (settingsHint) settingsHint.textContent = 'Einstellungen konnten nicht geladen werden (Regeln / Netz).';
        const defSet = (window.BWK_BT_DEFAULTS && window.BWK_BT_DEFAULTS.settings) || {};
        if ($('#btSetUseSlots')) {
          $('#btSetUseSlots').value = defSet.useSlots === false ? 'false' : 'true';
        }
        slotLabelMap = buildSlotMapFromSettings(window.BWK_BT_DEFAULTS && window.BWK_BT_DEFAULTS.settings);
        const slots =
          (window.BWK_BT_DEFAULTS && window.BWK_BT_DEFAULTS.settings && window.BWK_BT_DEFAULTS.settings.slots) || [];
        lastSettingsSlots = slots.map((s) => Object.assign({}, s));
        const displayType = lib.inferSlotsDisplayType(window.BWK_BT_DEFAULTS.settings || {});
        editorDisplayTypeLocked = displayType;
        const r = document.querySelector('input[name="btSlotsDisplayType"][value="' + displayType + '"]');
        if (r) r.checked = true;
        renderSimpleSlotsEditor(slots, displayType);
        syncSlotsJsonTextarea(slots);
        loadHintIntoRich((defSet.infoWhenNoSlots || '').toString());
        onDatasetChanged();
      }
    }

    wireSlotsTypeRadios();

    auth.onAuthStateChanged((user) => {
      if (unsubscribeList) {
        unsubscribeList();
        unsubscribeList = null;
      }
      if (user) {
        loginCard.hidden = true;
        adminCard.hidden = false;
        if (userLine) {
          if (isDev) {
            userLine.textContent = 'Angemeldet als: ' + (user.email || user.uid || '—');
          } else {
            userLine.textContent = 'Angemeldet als ' + (user.email || user.uid || '—');
          }
        }
        attachListener();
        loadSettingsUi();
      } else {
        loginCard.hidden = false;
        adminCard.hidden = true;
        tbody.replaceChildren();
        allDocs = [];
        lastFilteredRows = [];
        selectedIds.clear();
        setStatus('');
        if (userLine) userLine.textContent = '';
        if (hint && !isDev) {
          hint.textContent = 'Zugangsdaten in FB-Auth.';
        }
      }
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const email = (fd.get('email') || '').toString().trim();
      const password = (fd.get('password') || '').toString();
      if (hint) hint.textContent = 'Anmeldung …';
      try {
        await auth.signInWithEmailAndPassword(email, password);
        if (hint) hint.textContent = '';
      } catch (err) {
        console.error(err);
        if (hint) {
          hint.textContent =
            err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
              ? 'E-Mail oder Passwort ist ungültig.'
              : err.message || 'Login fehlgeschlagen.';
        }
      }
    });

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        Promise.resolve(auth.signOut()).catch(() => {});
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        if (auth.currentUser) attachListener();
      });
    }

    [filterText, filterSlot, filterCategory, filterPreset, includeSpam].forEach((el) => {
      if (el) el.addEventListener('input', onDatasetChanged);
      if (el) el.addEventListener('change', onDatasetChanged);
    });

    if (btnCsv) {
      btnCsv.addEventListener('click', () => {
        const rows = lastFilteredRows;
        if (!rows.length) {
          setStatus('Keine Daten für den Export (Filter prüfen).');
          return;
        }
        const headers = [
          'Status',
          'Kategorie',
          'Final_zugewiesen',
          'Auto_Spam_Grund',
          'Duplikate_E_Mail_Anzahl',
          'Zeitstempel',
          'Anrede',
          'Name',
          'E-Mail',
          'E-Mail_normalisiert',
          'IP_Adresse',
          'Telefon',
          'Staatsangehörigkeit',
          'Termin',
          'Kontaktweg',
          'Notiz',
        ];
        const fullRows = allDocs.map(rowFromDoc);
        const dupCountsAll = dupCountsAllFromRows(fullRows);
        const lines = [headers.join(';')];
        rows.forEach((r) => {
          const ek = r.email.toLowerCase();
          const dupN = ek ? dupCountsAll[ek] || 0 : 0;
          lines.push(
            [
              csvEscape(r.status === 'spam' ? 'Spam' : 'Aktiv'),
              csvEscape(r.categoryLabel),
              csvEscape(r.rosterConfirmed ? 'Ja' : 'Nein'),
              csvEscape(formatAutoSpamReasonDe(r.autoSpamReason)),
              csvEscape(dupN > 1 ? String(dupN) : ''),
              csvEscape(r.createdAt),
              csvEscape(r.salutation),
              csvEscape(r.displayName),
              csvEscape(r.email),
              csvEscape((r.raw && r.raw.emailLower) || (r.email || '').toLowerCase()),
              csvEscape(r.registrationIp),
              csvEscape(r.phone),
              csvEscape(r.citizenship),
              csvEscape(r.slot),
              csvEscape(r.contact),
              csvEscape(r.message),
            ].join(';')
          );
        });
        const blob = new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `bewerbertag-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        setStatus('CSV exportiert (UTF-8, Semikolon, deutsche Spalten).');
      });
    }

    if (btnCopyEmails) {
      btnCopyEmails.addEventListener('click', async () => {
        const emails = [...new Set(lastFilteredRows.map((r) => r.email).filter(Boolean))];
        if (!emails.length) {
          alert('Keine E-Mail-Adressen in der aktuellen Filteransicht.');
          return;
        }
        const text = emails.join('; ');
        await copyToClipboard(text);
        setStatus(emails.length + ' eindeutige Adressen in die Zwischenablage kopiert.');
      });
    }

    function openMailModal() {
      if (!mailModal) return;
      if (mailSubject) mailSubject.value = DEFAULT_MAIL_SUBJECT;
      if (mailBody) mailBody.value = DEFAULT_MAIL_BODY;
      mailModal.hidden = false;
      if (mailSubject) mailSubject.focus();
    }

    function closeMailModal() {
      if (mailModal) mailModal.hidden = true;
    }

    if (btnMailTemplate) {
      btnMailTemplate.addEventListener('click', openMailModal);
    }

    if (mailModal) {
      mailModal.querySelectorAll('[data-bt-mail-close]').forEach((el) => {
        el.addEventListener('click', closeMailModal);
      });
    }

    if (mailOpenDraft) {
      mailOpenDraft.addEventListener('click', () => {
        const sub = mailSubject ? mailSubject.value : '';
        const body = mailBody ? mailBody.value : '';
        const href =
          'mailto:?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(body);
        window.location.href = href;
      });
    }

    const participantMailModal = $('#btParticipantMailModal');
    const participantMailTemplate = $('#btParticipantMailTemplate');
    const participantMailSubject = $('#btParticipantMailSubject');
    const participantMailBody = $('#btParticipantMailBody');
    const participantMailCopyRecipients = $('#btParticipantMailCopyRecipients');
    const participantMailOpenDraft = $('#btParticipantMailOpenDraft');

    if (participantMailTemplate) {
      participantMailTemplate.addEventListener('change', () => {
        applyParticipantMailTemplateUi();
      });
    }
    if (participantMailModal) {
      participantMailModal.querySelectorAll('[data-bt-participant-mail-close]').forEach((el) => {
        el.addEventListener('click', closeParticipantMailModal);
      });
    }
    if (participantMailCopyRecipients) {
      participantMailCopyRecipients.addEventListener('click', async () => {
        if (!participantMailSlotValue) return;
        const emails = getConfirmedRecipientsForSlot(participantMailSlotValue);
        if (!emails.length) {
          alert('Keine Empfängeradressen.');
          return;
        }
        const text = emails.join('; ');
        await copyToClipboard(text);
        setStatus(emails.length + ' Adresse(n) für BCC kopiert.');
      });
    }
    if (participantMailOpenDraft) {
      participantMailOpenDraft.addEventListener('click', () => {
        if (!participantMailSlotValue) return;
        const emails = getConfirmedRecipientsForSlot(participantMailSlotValue);
        if (!emails.length) {
          alert('Keine Empfängeradressen.');
          return;
        }
        const sub = participantMailSubject ? participantMailSubject.value : '';
        let body = participantMailBody ? participantMailBody.value : '';
        body += attachmentNamesHint();
        const bcc = emails.join(',');
        const maxTotal = 1900;
        const tryHref =
          'mailto:?bcc=' +
          encodeURIComponent(bcc) +
          '&subject=' +
          encodeURIComponent(sub) +
          '&body=' +
          encodeURIComponent(body);
        if (tryHref.length > maxTotal) {
          alert(
            'Zu viele oder zu lange E-Mail-Adressen für einen direkten Mail-Link. Bitte „Empfänger kopieren“ nutzen und im Programm als BCC einfügen.'
          );
          return;
        }
        window.location.href = tryHref;
      });
    }

    if (btnBulkSpam) {
      btnBulkSpam.addEventListener('click', () => {
        const ids = [...selectedIds];
        if (!ids.length) {
          alert('Keine Zeilen ausgewählt.');
          return;
        }
        Promise.all(
          ids.map((id) => db.collection('bewerbertag').doc(id).update({ status: 'spam' }))
        ).catch((e) => {
          console.error(e);
          alert('Spam-Status konnte nicht für alle Einträge gesetzt werden.');
        });
      });
    }

    if (btnBulkCategory && bulkCategorySelect) {
      btnBulkCategory.addEventListener('click', async () => {
        const ids = [...selectedIds];
        if (!ids.length) {
          alert('Keine Zeilen ausgewählt.');
          return;
        }
        const v = bulkCategorySelect.value;
        const label = formatAdminCategoryLabel(v);
        if (
          !confirm(
            ids.length + ' markierte Einträge mit der Kategorie „' + label + '“ versehen?'
          )
        ) {
          return;
        }
        const CHUNK = typeof db.batch === 'function' ? 400 : ids.length;
        try {
          for (let i = 0; i < ids.length; i += CHUNK) {
            const chunk = ids.slice(i, i + CHUNK);
            if (typeof db.batch === 'function') {
              const batch = db.batch();
              chunk.forEach((id) => {
                batch.update(db.collection('bewerbertag').doc(id), { adminCategory: v });
              });
              await batch.commit();
            } else {
              await Promise.all(
                chunk.map((id) =>
                  db.collection('bewerbertag').doc(id).update({ adminCategory: v })
                )
              );
            }
          }
          setStatus(ids.length + ' Einträge aktualisiert · Kategorie: ' + label);
        } catch (e) {
          console.error(e);
          alert('Kategorie konnte nicht für alle Einträge gespeichert werden (Regeln / Netz).');
        }
      });
    }

    if (btnBulkDelete) {
      btnBulkDelete.addEventListener('click', () => {
        const ids = [...selectedIds];
        if (!ids.length) {
          alert('Keine Zeilen ausgewählt.');
          return;
        }
        if (!confirm(ids.length + ' Einträge wirklich unwiderruflich löschen?')) return;
        Promise.all(ids.map((id) => db.collection('bewerbertag').doc(id).delete()))
          .then(() => {
            ids.forEach((id) => selectedIds.delete(id));
          })
          .catch((e) => {
            console.error(e);
            alert('Löschen fehlgeschlagen (Regeln / Netz).');
          });
      });
    }

    if (btnAddSlot && slotsEditorRoot) {
      btnAddSlot.addEventListener('click', () => {
        const displayType = getSlotsDisplayTypeFromForm();
        editorDisplayTypeLocked = displayType;
        slotsEditorRoot.appendChild(createSimpleSlotRow(displayType, {}, true));
        refreshSimpleSlotTitles();
        updateSlotRemoveButtons();
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.getAttribute('data-bt-tab');
        tabs.forEach((t) => {
          const on = t.getAttribute('data-bt-tab') === id;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panels.forEach((p) => {
          p.hidden = p.getAttribute('data-bt-panel') !== id;
        });
      });
    });

    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (settingsHint) settingsHint.textContent = 'Speichere …';
        syncHintRichToHidden();
        const useSlots = $('#btSetUseSlots').value !== 'false';
        const infoWhenNoSlots = ($('#btSetInfo') && $('#btSetInfo').value) || '';
        let slots;
        let slotsDisplayType;
        try {
          const parsed = readSimpleSlotsPayload();
          slots = parsed.slots;
          slotsDisplayType = parsed.slotsDisplayType;
          editorDisplayTypeLocked = slotsDisplayType;
        } catch (err) {
          if (settingsHint) settingsHint.textContent = err.message || 'Termine ungültig.';
          return;
        }
        const prevClosed = new Map();
        lastSettingsSlots.forEach((s) => {
          if (s && s.value && s.closed === true) prevClosed.set(s.value, true);
        });
        slots.forEach((s) => {
          if (prevClosed.has(s.value)) s.closed = true;
        });
        syncSlotsJsonTextarea(slots);
        const payload = {
          useSlots,
          infoWhenNoSlots,
          slots,
          slotsDisplayType,
        };
        if (isDev) {
          payload.updatedAt = Date.now();
        } else {
          payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        try {
          await db.collection('bewerbertag_settings').doc('singleton').set(payload, { merge: true });
          slotLabelMap = buildSlotMapFromSettings(payload);
          lastSettingsSlots = slots.map((s) => Object.assign({}, s));
          onDatasetChanged();
          if (settingsHint) settingsHint.textContent = 'Gespeichert.';
        } catch (err) {
          console.error(err);
          if (settingsHint) settingsHint.textContent = 'Speichern fehlgeschlagen (Regeln / Netz).';
        }
      });
    }

    if (btnDevReset && isDev && typeof window.bwkDevResetDemoData === 'function') {
      btnDevReset.addEventListener('click', () => {
        if (confirm('Demo-Daten wirklich zurücksetzen?')) {
          window.bwkDevResetDemoData();
          setStatus('Demo-Daten neu aufgesetzt.');
          loadSettingsUi();
        }
      });
    } else if (btnDevReset) {
      btnDevReset.hidden = true;
    }
  });
})();
