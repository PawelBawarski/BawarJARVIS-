'use strict';
const DEV_URL = 'http://127.0.0.1:4200/';
function isTrustedDevUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === new URL(DEV_URL).origin && !url.username && !url.password;
  } catch { return false; }
}
module.exports = { DEV_URL, isTrustedDevUrl };
