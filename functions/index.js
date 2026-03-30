/**
 * Optional: Zuverlässige Client-IP für Anmeldungen (ohne Drittanbieter im Browser).
 *
 *   cd functions && npm install && cd .. && firebase deploy --only functions:bwkClientMeta
 *
 * Region = window.BWK_BT_FUNCTIONS_REGION in firebase-config.js (europe-west3).
 */
const functions = require('firebase-functions');

exports.bwkClientMeta = functions.region('europe-west3').https.onCall((data, context) => {
  const req = context.rawRequest;
  if (!req) return { ip: null };
  const xf = req.headers['x-forwarded-for'];
  let ip = '';
  if (xf) ip = String(xf).split(',')[0].trim();
  else if (req.connection && req.connection.remoteAddress) {
    ip = String(req.connection.remoteAddress).trim();
  }
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return { ip: ip || null };
});
