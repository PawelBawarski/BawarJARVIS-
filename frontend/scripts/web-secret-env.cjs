"use strict";
/** Never pass external web-search credentials to browser tooling or Electron. */
function frontendChildEnv(environment) {
  const clean = { ...environment };
  delete clean.JARVIS_WEB_SEARCH_API_KEY;
  return clean;
}
module.exports = { frontendChildEnv };
