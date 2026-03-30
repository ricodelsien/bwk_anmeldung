/**
 * Zentrale Firebase-Konfiguration (öffentliche Maske + Lehrerbereich).
 *
 * Firestore: Anmeldungen schreiben mit Feldern emailLower, optional registrationIp.
 * Lehrerbereich: Feld rosterConfirmed (boolean) für finale Terminzuweisung — in den Regeln für authentifizierte Admins erlauben.
 * Zusätzlicher Index (slot + status) für Kapazitätsabfrage — siehe firestore.indexes.json
 *
 * Optional: Cloud Function `bwkClientMeta` (Callable) für zuverlässige Client-IP,
 * siehe Ordner `functions/`. Region unten anpassen.
 */
(function () {
  'use strict';

  /** Region für httpsCallable('bwkClientMeta'), muss mit Deploy übereinstimmen */
  window.BWK_BT_FUNCTIONS_REGION = 'europe-west3';

  window.BWK_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBblgg1dO8x_fkyPOI698Hv4iSlKVSHeo4',
    authDomain: 'bwk-anmeldung.firebaseapp.com',
    projectId: 'bwk-anmeldung',
    storageBucket: 'bwk-anmeldung.firebasestorage.app',
    messagingSenderId: '437735784788',
    appId: '1:437735784788:web:6b8bfc9d3858371c0348c1',
    measurementId: 'G-PHSZGPT35V',
  };

  window.bwkInitFirebaseApp = function bwkInitFirebaseApp() {
    if (typeof firebase === 'undefined' || !firebase.initializeApp) return;
    if (!firebase.apps.length) {
      firebase.initializeApp(window.BWK_FIREBASE_CONFIG);
    }
  };
})();
