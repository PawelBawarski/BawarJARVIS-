"use strict";
/** Enable local training only for the explicit Electron + AI developer stack. */
function backendLoraEnv(environment, { useElectron, useAi }) {
  const env = { ...environment };
  // An explicit value (especially false) always wins.
  if (useElectron && useAi && env.JARVIS_LORA_TRAINING_ENABLED === undefined) {
    env.JARVIS_LORA_TRAINING_ENABLED = 'true';
  }
  return env;
}
module.exports = { backendLoraEnv };
