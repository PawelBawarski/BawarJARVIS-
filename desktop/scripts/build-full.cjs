'use strict';
/** Build Spring Boot fat JAR + Angular + Electron NSIS installer (Windows). */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const desktopDir = path.resolve(__dirname, '..');
const root = path.resolve(desktopDir, '..');
const backendDir = path.join(root, 'backend');
const targetDir = path.join(backendDir, 'target');
const stagedJar = path.join(desktopDir, '.jarvis-build', 'backend', 'jarvis-backend.jar');

function run(cmd, args, cwd) {
  const proc = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  if (proc.error) throw proc.error;
  if (proc.status !== 0) throw new Error(`Błąd budowania ${cmd} (${proc.status}).`);
}

if (process.platform !== 'win32') {
  console.error('Budowa instalatora Windows wymaga systemu Windows.');
  process.exit(1);
}
try {
  // cmd.exe is required for .cmd wrappers on Windows.
  run('cmd.exe', ['/d', '/c', 'mvnw.cmd', '-DskipTests', 'package'], backendDir);
  const jarFiles = fs.readdirSync(targetDir)
    .filter(name => name.endsWith('.jar') && !name.startsWith('original-') && !name.endsWith('-sources.jar') && !name.endsWith('-javadoc.jar'));
  if (jarFiles.length !== 1) {
    throw new Error(`Oczekiwano jednego wykonywalnego pliku JAR. Znaleziono: ${jarFiles.join(', ')}`);
  }
  fs.mkdirSync(path.dirname(stagedJar), { recursive: true });
  fs.copyFileSync(path.join(targetDir, jarFiles[0]), stagedJar);
  // Verify Spring Boot executable JAR actually has BOOT-INF/ using JDK jar CLI.
  const inspection = spawnSync('jar', ['tf', stagedJar], { encoding: 'utf8', maxBuffer: 15 * 1024 * 1024 });
  if (inspection.error || inspection.status !== 0 || !inspection.stdout.includes('BOOT-INF/')) {
    throw new Error('Plik JAR nie jest uruchamialnym Spring Boot fat JAR (brak BOOT-INF/).');
  }
  run('cmd.exe', ['/d', '/c', 'npm.cmd', 'run', 'build:ui'], desktopDir);
  const target = process.argv.includes('--dir') ? ['--win', '--dir', '--x64'] : ['--win', 'nsis', '--x64', '--publish', 'never'];
  run('cmd.exe', ['/d', '/c', 'node_modules\\.bin\\electron-builder.cmd',
    '--config', 'electron-builder.full.config.cjs', ...target], desktopDir);
  console.log('OK: instalator z backendem w desktop/release/');
} catch (error) {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
}
