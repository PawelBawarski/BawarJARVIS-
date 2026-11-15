"use strict";
/** Poll only fixed localhost development endpoints; fail closed on timeouts. */
const http = require('node:http');

function checkOnce(url, { jsonStatusUp = false, requestTimeoutMs = 2000 } = {}) {
  return new Promise(resolve => {
    let settled = false;
    const finish = ok => { if (!settled) { settled = true; resolve(ok); } };
    const req = http.get(url, { agent: false }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 8192) { req.destroy(); finish(false); }
      });
      res.on('end', () => {
        if (res.statusCode !== 200) return finish(false);
        if (!jsonStatusUp) return finish(true);
        try { finish(JSON.parse(body).status === 'UP'); }
        catch { finish(false); }
      });
      res.on('error', () => finish(false));
    });
    req.setTimeout(requestTimeoutMs, () => { req.destroy(); finish(false); });
    req.on('error', () => finish(false));
  });
}

async function waitForReady(url, {
  jsonStatusUp = false, isStopped = () => false,
  timeoutMs = 120000, intervalMs = 500,
  check = checkOnce,
} = {}) {
  const allowed = new Set([
    'http://127.0.0.1:8080/api/security/health',
    'http://127.0.0.1:4200/',
    'http://127.0.0.1:4200/api/security/health',
  ]);
  if (!allowed.has(url)) throw new Error('Niedozwolony adres diagnostyki DEV.');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !isStopped()) {
    if (await check(url, { jsonStatusUp })) return true;
    if (isStopped()) break;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  if (isStopped()) return false;
  throw new Error(`Nie osiągnięto gotowości ${url} w ${timeoutMs} ms.`);
}
module.exports = { checkOnce, waitForReady };
