'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const source = path.join(__dirname, 'install-stage19-1.cjs');

test('19.1 integration is idempotent and does not remove previous imports/translations', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-191-installer-'));
  const fe = path.join(temp, 'frontend');
  const files = {
    'scripts/install-stage19-1.cjs': fs.readFileSync(source, 'utf8'),
    'scripts/dev-stack.cjs': "const found = line.match(/JARVIS_DB_(?:HOST|PORT|NAME|USER|PASSWORD)/);\nconst result = Object.entries(process.env).filter(([key]) => key.startsWith('JARVIS_DB_'));\n",
    'src/app/features/ai-lab/agent-planner/agent-planner.ts':
      "import { AgentSandbox } from '../agent-sandbox/agent-sandbox'; // JARVIS_STAGE16_4_SANDBOX\nimport { AgentChangeReview } from '../agent-change-review/agent-change-review';\n@Component({ imports: [AgentSandbox, AgentChangeReview, TranslatePipe] })",
    'src/app/features/ai-lab/agent-planner/agent-planner.html': '<app-agent-sandbox [preview]="patch" />',
    'public/i18n/pl.json': '{\n  "existing.key": "Wartość"\n}\n',
    'public/i18n/en.json': '{\n  "existing.key": "Value"\n}\n',
  };
  try {
    for (const [rel, value] of Object.entries(files)) {
      const dest = path.join(fe, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, value);
    }
    const run = () => spawnSync(process.execPath, [path.join(fe, 'scripts/install-stage19-1.cjs')], { encoding: 'utf8' });
    const first = run();assert.equal(first.status, 0, first.stderr);
    const ts = fs.readFileSync(path.join(fe, 'src/app/features/ai-lab/agent-planner/agent-planner.ts'), 'utf8');
    assert.match(ts, /AgentChangeReview/);assert.match(ts, /AgentFileWrite/);
    const pl = JSON.parse(fs.readFileSync(path.join(fe, 'public/i18n/pl.json'), 'utf8'));
    assert.equal(pl['existing.key'], 'Wartość');assert.ok(pl['lab.fileWrite.title']);
    const before = Object.fromEntries(Object.keys(files).map(rel => [rel,fs.readFileSync(path.join(fe,rel),'utf8')]));
    const again = run();assert.equal(again.status, 0, again.stderr);
    for (const rel of Object.keys(files)) assert.equal(fs.readFileSync(path.join(fe,rel),'utf8'), before[rel]);
    assert.match(fs.readFileSync(path.join(fe, 'scripts/dev-stack.cjs'),'utf8'), /AGENT_\(\?:WORKSPACE_ROOT/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
