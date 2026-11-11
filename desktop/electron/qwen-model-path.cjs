'use strict';
/** 17.5: models are persistent, independently verified user data, not NSIS payload.
 * This module is Electron-main only. No user path arrives via renderer IPC.
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const MODEL = 'Qwen3-8B-Q4_K_M.gguf';
const MANIFEST_REL = 'llm/stage17-4-manifest.json';

function noSymlinks(file, fsImpl = fs) {
  const resolved = path.resolve(file);
  const root = path.parse(resolved).root;
  let current = root;
  for (const segment of path.relative(root, resolved).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (fsImpl.lstatSync(current).isSymbolicLink()) {
      throw new Error('Qwen: niedozwolony symlink w zasobach modelu.');
    }
  }
  if (!fsImpl.statSync(resolved).isFile()) throw new Error('Qwen: model nie jest plikiem.');
}

function expectedModel(resourcesPath, fsImpl = fs) {
  const manifest = path.join(resourcesPath, MANIFEST_REL);
  noSymlinks(manifest, fsImpl);
  const data = JSON.parse(fsImpl.readFileSync(manifest, 'utf8'));
  if (data.schema !== 'jarvis.ai17.4.v1' || !Array.isArray(data.files)) {
    throw new Error('Qwen: nieprawidłowy manifest plików AI.');
  }
  const entries = data.files.filter(x => x.path === `models/${MODEL}`);
  if (entries.length !== 1 || !Number.isSafeInteger(entries[0].size) || entries[0].size < 1_000_000_000 ||
      typeof entries[0].sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entries[0].sha256)) {
    throw new Error('Qwen: brak prawidłowego SHA-256 i rozmiaru modelu w manifeście.');
  }
  return entries[0];
}

function hashSync(file, fsImpl = fs) {
  const handle = fsImpl.openSync(file, 'r');
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
  try {
    while (true) {
      const count = fsImpl.readSync(handle, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally { fsImpl.closeSync(handle); }
  return hash.digest('hex');
}

function resolveVerifiedQwenModel({ resourcesPath, env = process.env,
  fsImpl = fs, platform = process.platform } = {}) {
  if (platform !== 'win32' || typeof resourcesPath !== 'string' || !path.isAbsolute(resourcesPath)) {
    throw new Error('Qwen 17.5 wymaga spakowanego środowiska Windows.');
  }
  const required = expectedModel(resourcesPath, fsImpl);
  const candidates = [];
  if (env.LOCALAPPDATA && path.isAbsolute(env.LOCALAPPDATA)) {
    candidates.push(path.join(env.LOCALAPPDATA, 'J.A.R.V.I.S.', 'models', MODEL));
  }
  // Allow an existing, older offline installer to retain its model in resources.
  candidates.push(path.join(resourcesPath, 'llm', 'models', MODEL));
  for (const file of candidates) {
    if (!fsImpl.existsSync(file)) continue;
    noSymlinks(file, fsImpl);
    if (fsImpl.statSync(file).size !== required.size || hashSync(file, fsImpl) !== required.sha256) {
      throw new Error('Qwen: SHA-256 lub rozmiar modelu nie zgadza się z manifestem. Nie uruchamiam AI.');
    }
    return file;
  }
  throw new Error('Brak modelu Qwen3 8B. Przed pierwszym uruchomieniem wykonaj bezpieczne przygotowanie modelu 17.5.');
}

module.exports = { MODEL, MANIFEST_REL, noSymlinks, expectedModel, hashSync, resolveVerifiedQwenModel };
