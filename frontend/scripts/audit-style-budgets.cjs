'use strict';

/** 18.7 — auditable component-style budget guard. Does not modify angular.json. */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Last known production-build measurements (18.4), in kB.
const BASELINE_KB = Object.freeze({
  'agent-planner.scss': 7.00,
  'chat-view.scss': 5.36,
  'ai-lab-view.scss': 4.83,
});
const ROUNDING_TOLERANCE_KB = 0.02;

function parseComponentWarnings(log) {
  const results = [];
  const pattern = /([^\s\\/]+\.scss) exceeded maximum budget\.[^\n]*?with a total of ([\d.]+) kB\./g;
  for (const match of log.matchAll(pattern)) {
    results.push({ file: match[1], totalKb: Number(match[2]) });
  }
  return results;
}

function regressions(warnings) {
  return warnings.filter(({ file, totalKb }) =>
    !(file in BASELINE_KB) || totalKb > BASELINE_KB[file] + ROUNDING_TOLERANCE_KB);
}

function report(log) {
  const warnings = parseComponentWarnings(log);
  if (!warnings.length) {
    return { warnings, regressions: [], message: 'STYLE_BUDGET_OK: no component warnings.' };
  }
  const bad = regressions(warnings);
  const summary = warnings
    .map(({ file, totalKb }) => `${file}: ${totalKb.toFixed(2)} kB (baseline ${BASELINE_KB[file] ?? 'NEW'} kB)`)
    .join('\n');
  return {
    warnings, regressions: bad,
    message: `${bad.length ? 'STYLE_BUDGET_REGRESSION' : 'STYLE_BUDGET_BASELINE_OK'}\n${summary}`,
  };
}

if (require.main === module) {
  const cli = path.join(__dirname, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  const result = spawnSync(process.execPath, [cli, 'build'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 24 * 1024 * 1024,
    windowsHide: true,
  });
  const output = [result.stdout || '', result.stderr || ''].join('\n');
  process.stdout.write(output);
  if (result.error || result.status !== 0) {
    console.error('ANGULAR_BUILD_FAILED:', result.error?.message || result.status);
    process.exitCode = 1;
  } else {
    const resultReport = report(output);
    console.log(resultReport.message);
    if (resultReport.regressions.length) process.exitCode = 1;
  }
}

module.exports = { BASELINE_KB, parseComponentWarnings, regressions, report };
