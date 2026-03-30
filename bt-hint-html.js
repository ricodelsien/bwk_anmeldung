/**
 * Hinweistext (infoWhenNoSlots): erlaubtes HTML für die öffentliche Seite + Sanitizer.
 * Farben nur aus der BWK-Palette; keine Links/Skripte.
 */
(function (global) {
  'use strict';

  const BWK_COLORS = [
    ['Navy', '#323276'],
    ['Blau', '#436aad'],
    ['Violett', '#5b347e'],
    ['Magenta', '#d53a96'],
    ['Tinte', '#2a2d66'],
    ['Lime', '#dbe11d'],
    ['Hellgrau', '#f0f0ee'],
    ['Weiß', '#ffffff'],
  ];

  function normalizeHex(input) {
    if (input == null) return null;
    let t = String(input).trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(t)) {
      t = '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
    }
    if (/^#[0-9a-f]{6}$/.test(t)) return t;
    return null;
  }

  const COLOR_SET = new Set(BWK_COLORS.map((pair) => normalizeHex(pair[1])).filter(Boolean));

  function rgbChannel(n) {
    const v = parseInt(n, 10);
    if (isNaN(v)) return 0;
    return Math.max(0, Math.min(255, v));
  }

  function rgbToHex(r, g, b) {
    const h = (x) => rgbChannel(x).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

  function colorFromStyle(style) {
    const st = (style || '').toString();
    const hexLoose = /color\s*:\s*(#[0-9a-fA-F]{3,6})/i.exec(st);
    if (hexLoose) {
      const h = normalizeHex(hexLoose[1]);
      if (h && COLOR_SET.has(h)) return h;
    }
    const rgbM = /color\s*:\s*rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(st);
    if (rgbM) {
      const h = normalizeHex(rgbToHex(rgbM[1], rgbM[2], rgbM[3]));
      if (h && COLOR_SET.has(h)) return h;
    }
    return null;
  }

  function appendSanitized(container, node) {
    const bit = sanitizeNode(node);
    if (!bit) return;
    if (bit.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      while (bit.firstChild) container.appendChild(bit.firstChild);
    } else {
      container.appendChild(bit);
    }
  }

  function sanitizeChildren(from, into) {
    Array.from(from.childNodes).forEach((ch) => appendSanitized(into, ch));
  }

  function sanitizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }
    if (node.nodeType === Node.COMMENT_NODE) return null;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const tag = node.tagName;

    if (tag === 'BR') return document.createElement('br');

    if (tag === 'B' || tag === 'STRONG') {
      const el = document.createElement('strong');
      sanitizeChildren(node, el);
      return el;
    }
    if (tag === 'I' || tag === 'EM') {
      const el = document.createElement('em');
      sanitizeChildren(node, el);
      return el;
    }
    if (tag === 'U') {
      const el = document.createElement('u');
      sanitizeChildren(node, el);
      return el;
    }

    if (tag === 'FONT') {
      const hex = normalizeHex(node.getAttribute('color'));
      if (hex && COLOR_SET.has(hex)) {
        const el = document.createElement('span');
        el.setAttribute('style', 'color: ' + hex);
        sanitizeChildren(node, el);
        return el;
      }
      const f = document.createDocumentFragment();
      sanitizeChildren(node, f);
      return f;
    }

    if (tag === 'SPAN') {
      const c = colorFromStyle(node.getAttribute('style') || '');
      const el = document.createElement('span');
      if (c) el.setAttribute('style', 'color: ' + c);
      sanitizeChildren(node, el);
      if (!el.getAttribute('style')) {
        const f = document.createDocumentFragment();
        while (el.firstChild) f.appendChild(el.firstChild);
        return f;
      }
      return el;
    }

    if (tag === 'UL') {
      const el = document.createElement('ul');
      sanitizeChildren(node, el);
      return el;
    }
    if (tag === 'OL') {
      const el = document.createElement('ol');
      if (node.classList && node.classList.contains('bt-rich-ol-alpha')) {
        el.className = 'bt-rich-ol-alpha';
      }
      sanitizeChildren(node, el);
      return el;
    }
    if (tag === 'LI') {
      const el = document.createElement('li');
      sanitizeChildren(node, el);
      return el;
    }

    if (tag === 'P' || tag === 'DIV') {
      const el = document.createElement('p');
      sanitizeChildren(node, el);
      return el;
    }

    const f = document.createDocumentFragment();
    sanitizeChildren(node, f);
    return f;
  }

  function sanitizeHintHtml(html) {
    const raw = (html || '').toString().trim();
    if (!raw) return '';
    let doc;
    try {
      doc = new DOMParser().parseFromString(raw, 'text/html');
    } catch {
      return '';
    }
    const out = document.createElement('div');
    Array.from(doc.body.childNodes).forEach((n) => appendSanitized(out, n));
    const plain = (out.textContent || '').replace(/\s+/g, ' ').trim();
    if (!plain) return '';
    return out.innerHTML.trim();
  }

  function hintHtmlPlainText(html) {
    const s = sanitizeHintHtml(html);
    if (!s) return '';
    const d = document.createElement('div');
    d.innerHTML = s;
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }

  global.BWK_HINT_HTML_COLORS = BWK_COLORS;
  global.sanitizeHintHtml = sanitizeHintHtml;
  global.hintHtmlPlainText = hintHtmlPlainText;
})(typeof window !== 'undefined' ? window : globalThis);
