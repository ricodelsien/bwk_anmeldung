/**
 * Gemeinsame Slot-Logik (öffentliche Seite + Admin).
 * Firestore: slots[] mit value, line1, line2, line1Mode, line1Date, line1DateEnd,
 *   line1Freetext, line1Url, line1UrlLabel, maxApplicants, closed
 */
(function (global) {
  'use strict';

  function parseMaxApplicants(m) {
    if (m == null || m === '') return null;
    const n = parseInt(String(m), 10);
    return isNaN(n) || n < 1 ? null : n;
  }

  function normalizeSlot(s) {
    const empty = {
      value: '',
      line1: '',
      line2: '',
      line1Mode: 'text',
      line1Text: '',
      line1Date: '',
      line1DateEnd: '',
      line1Url: '',
      line1UrlLabel: '',
      line1Freetext: '',
      maxApplicants: null,
      closed: false,
    };
    if (!s || typeof s !== 'object') return { ...empty };
    const line1 = (s.line1 || '').toString();
    const hasMode = s.line1Mode != null && s.line1Mode !== '';
    const mode = hasMode ? String(s.line1Mode) : 'text';
    const line1Text =
      s.line1Text != null && String(s.line1Text) !== ''
        ? String(s.line1Text)
        : !hasMode
          ? line1
          : String(s.line1Text || '');
    return {
      value: s.value != null ? String(s.value) : '',
      line1,
      line2: s.line2 != null ? String(s.line2) : '',
      line1Mode: mode,
      line1Text,
      line1Date: s.line1Date != null ? String(s.line1Date) : '',
      line1DateEnd: s.line1DateEnd != null ? String(s.line1DateEnd) : '',
      line1Url: s.line1Url != null ? String(s.line1Url) : '',
      line1UrlLabel: s.line1UrlLabel != null ? String(s.line1UrlLabel) : '',
      line1Freetext: s.line1Freetext != null ? String(s.line1Freetext) : '',
      maxApplicants: parseMaxApplicants(s.maxApplicants),
      closed: s.closed === true,
    };
  }

  function computeLine1(s) {
    const n = normalizeSlot(s);
    switch (n.line1Mode) {
      case 'date':
        if (n.line1Date) {
          const d = new Date(n.line1Date);
          if (!isNaN(d.getTime())) {
            const parts = [
              d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'numeric', year: 'numeric' }),
            ];
            const startTime = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            if (n.line1DateEnd) {
              parts.push(startTime + '–' + n.line1DateEnd + ' Uhr');
            } else {
              parts.push(startTime + ' Uhr');
            }
            return parts.join(', ');
          }
        }
        return n.line1Text || n.line1 || '';
      case 'text':
        return n.line1Text || '';
      case 'internet':
        return n.line1UrlLabel || n.line1Url || n.line1 || '';
      case 'freetext': {
        const ft = n.line1Freetext || n.line1 || '';
        // Return plain text for computeLine1 (strip HTML if any)
        if (/<[a-z]/i.test(ft)) {
          const tmp = document.createElement('div');
          tmp.innerHTML = ft;
          return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
        }
        return ft;
      }
      default:
        return n.line1Text || n.line1 || '';
    }
  }

  function inferSlotsDisplayType(settings) {
    if (!settings || typeof settings !== 'object') return 'date';
    if (settings.slotsDisplayType === 'freetext' || settings.slotsDisplayType === 'date') {
      return settings.slotsDisplayType;
    }
    const slots = settings.slots;
    if (!Array.isArray(slots) || !slots.length) return 'date';
    let freetextish = 0;
    slots.forEach((s) => {
      const n = normalizeSlot(s);
      if (n.line1Mode === 'freetext' || n.line1Mode === 'internet') freetextish++;
      else if (n.line1Mode === 'text' && !n.line1Date) freetextish++;
    });
    if (freetextish === slots.length) return 'freetext';
    if (freetextish > 0) return 'freetext';
    return 'date';
  }

  /**
   * Rendert die öffentlichen Terminkarten als horizontale Karten-Reihe.
   * Datum-Modus: Wochentag / Datum / Uhrzeit-Spanne / Tag-Zeile
   * Freitext-Modus: Rich-Text-Titel / Unterzeile
   * @param {HTMLElement} container
   * @param {Array<object>} slots
   */
  function renderPublicTermineList(container, slots) {
    if (!container) return;
    container.replaceChildren();
    const list = Array.isArray(slots) ? slots.filter((s) => s && s.value) : [];
    let firstVisible = true;
    list.forEach((slot) => {
      const n = normalizeSlot(slot);
      if (n.closed) return;

      const label = document.createElement('label');
      label.className = 'bt-termin-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'slot';
      input.value = n.value;
      if (firstVisible) input.required = true;
      firstVisible = false;

      const cardBody = document.createElement('span');
      cardBody.className = 'bt-termin-label';

      if (n.line1Mode === 'date' && n.line1Date) {
        const d = new Date(n.line1Date);
        if (!isNaN(d.getTime())) {
          // Wochentag
          const dayEl = document.createElement('strong');
          dayEl.className = 'bt-termin-day';
          dayEl.textContent = d.toLocaleDateString('de-DE', { weekday: 'long' });
          cardBody.appendChild(dayEl);

          // Datum
          const dateEl = document.createElement('span');
          dateEl.className = 'bt-termin-date';
          dateEl.textContent = d.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          cardBody.appendChild(dateEl);

          // Uhrzeit-Spanne
          const startTime = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const timeEl = document.createElement('span');
          timeEl.className = 'bt-termin-time';
          timeEl.textContent = n.line1DateEnd
            ? startTime + ' – ' + n.line1DateEnd + ' Uhr'
            : startTime + ' Uhr';
          cardBody.appendChild(timeEl);
        } else {
          // Fallback bei ungültigem Datum
          const strong = document.createElement('strong');
          strong.className = 'bt-termin-day';
          strong.textContent = n.line1Text || n.line1 || '';
          cardBody.appendChild(strong);
        }
      } else {
        // Freitext-Modus: Rich Text
        const strong = document.createElement('strong');
        strong.className = 'bt-termin-day';
        const ftContent = n.line1Freetext || computeLine1(n) || n.line1 || '';
        if (typeof window.sanitizeHintHtml === 'function' && /<[a-z]/i.test(ftContent)) {
          strong.innerHTML = window.sanitizeHintHtml(ftContent);
        } else {
          strong.textContent = ftContent;
        }
        cardBody.appendChild(strong);
      }

      // Unterzeile / Tag
      const subText = n.line2 || '';
      if (subText) {
        const tagEl = document.createElement('span');
        tagEl.className = 'bt-termin-tag';
        if (n.line1Url) {
          const a = document.createElement('a');
          a.href = n.line1Url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = n.line1UrlLabel || subText;
          // Link-Klick soll nicht die Radio-Auswahl verändern
          a.addEventListener('click', (e) => e.stopPropagation());
          tagEl.appendChild(a);
          if (n.line1UrlLabel && subText !== n.line1UrlLabel) {
            tagEl.appendChild(document.createTextNode(' · ' + subText));
          }
        } else {
          tagEl.textContent = subText;
        }
        cardBody.appendChild(tagEl);
      }

      label.appendChild(input);
      label.appendChild(cardBody);
      container.appendChild(label);
    });
  }

  global.BWK_BT_SLOTS = {
    normalizeSlot,
    computeLine1,
    inferSlotsDisplayType,
    renderPublicTermineList,
  };
})(typeof window !== 'undefined' ? window : globalThis);
