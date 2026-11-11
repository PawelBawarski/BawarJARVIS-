'use strict';

const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

function isPid(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff;
}

function controlError(code) {
  const messages = {
    ENOENT: 'Nie znaleziono programu sterującego PostgreSQL.',
    ETIMEDOUT: 'Przekroczono czas wykonania programu sterującego PostgreSQL.',
    ABORT_ERR: 'Anulowano wykonanie programu sterującego PostgreSQL.',
  };
  const error = new Error(messages[code] || 'Program sterujący PostgreSQL zakończył się błędem.');
  error.code = code;
  return error;
}

/**
 * MAIN only. The caller validates the executable and cluster paths.
 * pg_ctl on Windows starts a long-lived CMD/PostgreSQL descendant. Ignore stdio
 * and observe the controller's exit without waiting for descendant pipe handles.
 */
function runPgControl(executable, args, {
  env,
  timeout = 60000,
  signal,
  spawnImpl = spawn,
} = {}) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || executable.includes('\0')) {
    return Promise.reject(new TypeError('Wymagana absolutna ścieżka programu PostgreSQL.'));
  }
  if (!Array.isArray(args) || !args.every(value => typeof value === 'string' && !value.includes('\0'))) {
    return Promise.reject(new TypeError('Argumenty programu PostgreSQL muszą być tablicą napisów.'));
  }
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return Promise.reject(new TypeError('Wymagany dodatni limit czasu programu PostgreSQL.'));
  }
  if (signal?.aborted) return Promise.reject(controlError('ABORT_ERR'));

  return new Promise((resolve, reject) => {
    let child = null;
    let timer = null;
    let settled = false;

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      child?.removeListener('exit', onExit);
      if (error) {
        if (isPid(child?.pid)) error.controllerPid = child.pid;
        reject(error);
      }
      else resolve({ stdout: '' });
    }
    function interrupt(code) {
      if (settled) return;
      finish(controlError(code));
      // Never kill a process tree or a server found by PID/port here.
      try { if (child && !child.killed) child.kill(); }
      catch { /* The bounded result is already known; never expose native errors. */ }
    }
    function onAbort() { interrupt('ABORT_ERR'); }
    function onExit(code) {
      if (code === 0) finish();
      else finish(controlError(Number.isInteger(code) ? code : 'PG_CONTROL_FAILED'));
    }
    function onError(error) {
      const code = ['ENOENT', 'ETIMEDOUT', 'ABORT_ERR'].includes(error?.code)
        ? error.code : 'PG_CONTROL_FAILED';
      finish(controlError(code));
    }

    try {
      child = spawnImpl(executable, args, {
        env,
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch (error) {
      onError(error);
      return;
    }
    // Keep this listener after settlement: late spawn/kill errors must be handled.
    child.on('error', onError);
    child.once('exit', onExit);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    timer = setTimeout(() => interrupt('ETIMEDOUT'), timeout);
  });
}

/** Fail closed unless CIM confirms the short-lived pg_ctl -> CMD -> postgres chain. */
async function isPostmasterDescendant({
  postmasterPid,
  controllerPid,
  attemptedAt,
  env = process.env,
  execImpl = execFileAsync,
  platform = process.platform,
} = {}) {
  const now = Date.now();
  const systemRoot = env?.SystemRoot || env?.WINDIR;
  if (platform !== 'win32' || !isPid(postmasterPid) || !isPid(controllerPid) ||
      postmasterPid === controllerPid || !Number.isFinite(attemptedAt) || attemptedAt <= 0 ||
      attemptedAt > now + 1000 || typeof systemRoot !== 'string' ||
      !path.isAbsolute(systemRoot) || systemRoot.includes('\0')) return false;
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  // Only the validated numeric PID is interpolated. Never request CommandLine or
  // process environments: names, IDs and UTC creation times suffice here.
  const script = `$ErrorActionPreference = 'Stop';
try {
  $postgresProcess = Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${postmasterPid}' -ErrorAction Stop;
  if ($null -eq $postgresProcess) { Write-Output 'null'; exit 0; }
  $parentProcess = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = ' + [uint32]$postgresProcess.ParentProcessId) -ErrorAction Stop;
  if ($null -eq $parentProcess) { Write-Output 'null'; exit 0; }
  [pscustomobject]@{
    postgres = @{
      pid = [uint32]$postgresProcess.ProcessId;
      name = [string]$postgresProcess.Name;
      parentPid = [uint32]$postgresProcess.ParentProcessId;
      createdAt = $postgresProcess.CreationDate.ToUniversalTime().ToString('o');
    };
    parent = @{
      pid = [uint32]$parentProcess.ProcessId;
      name = [string]$parentProcess.Name;
      parentPid = [uint32]$parentProcess.ParentProcessId;
      createdAt = $parentProcess.CreationDate.ToUniversalTime().ToString('o');
    };
  } | ConvertTo-Json -Compress -Depth 3;
} catch { Write-Output 'null'; exit 0; }`;
  try {
    const result = await execImpl(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
      shell: false,
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 16 * 1024,
      encoding: 'utf8',
      env: { SystemRoot: systemRoot, WINDIR: systemRoot },
    });
    const raw = typeof result === 'string' ? result : result?.stdout;
    if (typeof raw !== 'string' || raw.length > 16 * 1024) return false;
    const info = JSON.parse(raw.trim());
    const postgres = info?.postgres;
    const parent = info?.parent;
    if (postgres?.pid !== postmasterPid || !isPid(postgres?.parentPid) ||
        postgres.parentPid !== parent?.pid || parent.pid === controllerPid ||
        parent.pid === postmasterPid || parent.parentPid !== controllerPid ||
        typeof postgres.name !== 'string' || postgres.name.toLowerCase() !== 'postgres.exe' ||
        typeof parent.name !== 'string' || parent.name.toLowerCase() !== 'cmd.exe') return false;
    const times = [postgres.createdAt, parent.createdAt].map(value =>
      typeof value === 'string' ? Date.parse(value) : NaN);
    if (!times.every(time => Number.isFinite(time) && time >= attemptedAt - 1000 && time <= now + 1000)) return false;
    return times[1] <= times[0];
  } catch {
    return false;
  }
}

module.exports = { runPgControl, isPostmasterDescendant };
