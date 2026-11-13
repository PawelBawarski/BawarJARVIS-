'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepare, imageName, dependencyHash } = require('./prepare-stage19-4.cjs');

test('image tag changes with lockfile or pom', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-image194-'));
  try {
    fs.writeFileSync(path.join(temp, 'package.json'), '{"name":"test"}');
    fs.writeFileSync(path.join(temp, 'package-lock.json'), '{"lockfileVersion":3}');
    const a = imageName('angular', dependencyHash('angular', temp));
    fs.writeFileSync(path.join(temp, 'package-lock.json'), '{"lockfileVersion":3,"other":true}');
    const b = imageName('angular', dependencyHash('angular', temp));
    assert.notEqual(a, b);
    assert.match(a, /^jarvis-angular-test:19-4-[0-9a-f]{12}$/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
test('Docker build context contains manifests only, not source, env or whole workspace', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-context194-'));
  try {
    fs.writeFileSync(path.join(temp, 'package.json'), '{}');
    fs.writeFileSync(path.join(temp, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(temp, '.env.model.local'), 'SECRET=do-not-send');
    fs.mkdirSync(path.join(temp, 'src'));
    fs.writeFileSync(path.join(temp, 'src', 'demo.ts'), 'private source');
    const build = (_tool, argv) => {
      assert.equal(argv[0], 'build');
      const context = argv.at(-1);
      assert.deepEqual(fs.readdirSync(context).sort(), ['Dockerfile', 'package-lock.json', 'package.json']);
      return { status: 0 };
    };
    assert.match(prepare('angular', temp, build), /^jarvis-angular-test:19-4-/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
