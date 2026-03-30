/**
 * Fallback, wenn noch kein Dokument bewerbertag_settings/singleton in Firestore existiert.
 * Wird vom Dev-Shim für die lokale Demo genutzt.
 *
 * Zeiten sind UTC. Berlin-Sommer (CEST = UTC+2):
 *   09:00 CEST = 07:00 UTC · 12:00 CEST = 10:00 UTC · 15:00 CEST = 13:00 UTC
 */
(function () {
  'use strict';

  const DEFAULT_SUB = 'Bewerbertag | AVöD';

  window.BWK_BT_DEFAULTS = {
    settings: {
      useSlots: true,
      slotsDisplayType: 'date',
      infoWhenNoSlots:
        'Aktuell sind keine festen Bewerbertage geplant. Für weitere Informationen schreiben Sie uns gerne an.',
      slots: [
        {
          value: '2026-05-04-09',
          line1Mode: 'date',
          line1Date: '2026-05-04T07:00:00.000Z', // 09:00 CEST
          line1DateEnd: '12:00',
          line1Text: '',
          line1: 'Mo, 04.05.2026, 09:00–12:00 Uhr',
          line2: DEFAULT_SUB,
          line1Url: '',
          line1UrlLabel: '',
          line1Freetext: '',
        },
        {
          value: '2026-05-06-12',
          line1Mode: 'date',
          line1Date: '2026-05-06T10:00:00.000Z', // 12:00 CEST
          line1DateEnd: '15:00',
          line1Text: '',
          line1: 'Mi, 06.05.2026, 12:00–15:00 Uhr',
          line2: DEFAULT_SUB,
          line1Url: '',
          line1UrlLabel: '',
          line1Freetext: '',
        },
        {
          value: '2026-05-08-09',
          line1Mode: 'date',
          line1Date: '2026-05-08T07:00:00.000Z', // 09:00 CEST
          line1DateEnd: '12:00',
          line1Text: '',
          line1: 'Fr, 08.05.2026, 09:00–12:00 Uhr',
          line2: DEFAULT_SUB,
          line1Url: '',
          line1UrlLabel: '',
          line1Freetext: '',
        },
      ],
      updatedAt: null,
    },
  };
})();
