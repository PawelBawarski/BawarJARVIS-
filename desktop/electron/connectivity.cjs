'use strict';

// Fixed HTTPS probe. Never accept a URL from the Angular renderer.
const INTERNET_PROBE_URL = 'https://www.gstatic.com/generate_204';

async function checkInternet(net) {
  if (!net || typeof net.isOnline !== 'function' || typeof net.fetch !== 'function') {
    throw new TypeError('Electron net module is required');
  }
  if (!net.isOnline()) return { state: 'offline' };
  try {
    const response = await net.fetch(INTERNET_PROBE_URL, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    // An intercepted or filtered endpoint must not falsely claim Internet access.
    return { state: response.status === 204 ? 'online' : 'unverified' };
  } catch {
    // A failed fixed probe could also mean blocked Google infrastructure.
    return { state: 'unverified' };
  }
}

module.exports = { checkInternet, INTERNET_PROBE_URL };
