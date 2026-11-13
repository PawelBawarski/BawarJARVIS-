'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { install, merge, additions } = require('./install-stage20-1.cjs');

test('keeps existing custom translations', () => {
  const before = '{"memory.local.title":"Custom title","existing":"Kept"}';
  const after = JSON.parse(merge(before,additions.en));
  assert.equal(after['memory.local.title'],'Custom title');
  assert.equal(after.existing,'Kept');
});
test('installs once, leaves prior translations intact and keeps PL/EN parity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-201-'));
  const loc = path.join(dir,'public','i18n');
  fs.mkdirSync(loc,{recursive:true});
  fs.writeFileSync(path.join(loc,'pl.json'),'{"older":"Starszy"}');
  fs.writeFileSync(path.join(loc,'en.json'),'{"older":"Older"}');
  try {
    const count = install(dir);
    assert.equal(count,1+Object.keys(additions.pl).length);
    const pl = fs.readFileSync(path.join(loc,'pl.json'),'utf8');
    assert.equal(install(dir),count);
    assert.equal(fs.readFileSync(path.join(loc,'pl.json'),'utf8'),pl);
    assert.equal(JSON.parse(pl).older,'Starszy');
    assert.equal(JSON.parse(fs.readFileSync(path.join(loc,'en.json'),'utf8')).older,'Older');
  } finally { fs.rmSync(dir,{force:true,recursive:true}); }
});
