'use strict';

/** Stage 17.2: packaged Electron uses ONLY the Java runtime shipped in resources.
 * Never searches PATH or trusts a Java executable supplied by the renderer.
 */
const fs = require('node:fs');
const path = require('node:path');

function resolveBundledJava(resourcesPath, fsImpl = fs, platform = process.platform) {
  if (typeof resourcesPath !== 'string' || !path.isAbsolute(resourcesPath)) {
    throw new Error('Brak absolutnej ścieżki zasobów Electron.');
  }
  if (platform !== 'win32') {
    throw new Error('Etap 17.2 obsługuje wyłącznie spakowaną aplikację Windows.');
  }
  const base = path.resolve(resourcesPath);
  const parts = [base, path.join(base, 'java'), path.join(base, 'java', 'bin')];
  const exe = path.join(base, 'java', 'bin', 'java.exe');
  parts.push(exe);
  for (const part of parts) {
    let stat;
    try { stat = fsImpl.lstatSync(part); }
    catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error('Brak dołączonego środowiska Java 21 w resources/java. Uruchom przygotowanie 17.2.');
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error('Niedozwolone dowiązanie symboliczne w katalogu Java.');
    }
  }
  if (!fsImpl.statSync(exe).isFile()) {
    throw new Error('Nieprawidłowy plik resources/java/bin/java.exe.');
  }
  return exe;
}

module.exports = { resolveBundledJava };
