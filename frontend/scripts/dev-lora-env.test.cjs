"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { backendLoraEnv } = require('./dev-lora-env.cjs');

test('Electron + AI developer stack enables training by default', () => {
  assert.equal(backendLoraEnv({ PATH: 'abc' }, { useElectron: true, useAi: true }).JARVIS_LORA_TRAINING_ENABLED, 'true');
});
test('explicitly disabled training remains disabled', () => {
  assert.equal(backendLoraEnv({ JARVIS_LORA_TRAINING_ENABLED: 'false' }, { useElectron: true, useAi: true }).JARVIS_LORA_TRAINING_ENABLED, 'false');
});
test('standard development and web AI mode do not enable training implicitly', () => {
  for (const flags of [{ useElectron: false, useAi: true }, { useElectron: true, useAi: false }, { useElectron: false, useAi: false }]) {
    assert.equal(backendLoraEnv({}, flags).JARVIS_LORA_TRAINING_ENABLED, undefined);
  }
});
test('helper does not mutate caller environment', () => {
  const source = { PATH: 'abc' };
  backendLoraEnv(source, { useElectron: true, useAi: true });
  assert.deepEqual(source, { PATH: 'abc' });
});
