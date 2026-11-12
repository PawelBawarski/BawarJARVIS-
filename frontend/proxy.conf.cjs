'use strict';
/** LOCAL DEVELOPMENT ONLY: inject ephemeral auth in the Node proxy, never in browser code. */
const token = process.env.JARVIS_SESSION_TOKEN;
if (!/^[0-9a-f]{64}$/.test(token || '')) {
  throw new Error('Start J.A.R.V.I.S. using npm run dev:web or npm run dev:electron.');
}
module.exports = {
  '/api/**': {
    target: 'http://127.0.0.1:8080',
    changeOrigin: false,
    secure: true,
    headers: { 'X-Jarvis-Session': token },
  },
};
