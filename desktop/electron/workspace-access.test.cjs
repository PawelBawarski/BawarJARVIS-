'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WorkspaceAccess, registerWorkspaceIpc, routeWorkspaceRequest, validRoot } = require('./workspace-access.cjs');
function fixture(t) {
  // Windows TEMP is usually under AppData, intentionally forbidden by validRoot().
  const dir = fs.mkdtempSync(path.join(__dirname, 'jarvis-workspace-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'project');fs.mkdirSync(root);
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'hello.ts'), 'export const n = 1;');
  fs.writeFileSync(path.join(root, '.env'), 'TOKEN=do_not_expose');
  fs.writeFileSync(path.join(root, 'private.pem'), 'do_not_expose');
  fs.mkdirSync(path.join(root, 'node_modules'));
  return { dir, root, instance: new WorkspaceAccess(path.join(dir, 'app-config')) };
}
test('cannot read before a user explicitly selects a directory', t => {
  const { instance } = fixture(t);
  assert.equal(instance.status().selected, null);
  assert.throws(() => instance.list(), /WORKSPACE_NOT_SELECTED/);
});
test('native selection is persisted, read-only, and clear does not delete project files', t => {
  const { root, instance } = fixture(t);
  assert.equal(instance.select(root).readOnly, true);
  assert.equal(instance.status().writeEnabled, false);
  assert.equal(instance.read('src/hello.ts').content, 'export const n = 1;');
  instance.clear();
  assert.equal(instance.status().selected, null);
  assert.equal(fs.existsSync(path.join(root, 'src/hello.ts')), true);
});
test('listing excludes secrets and generated folders', t => {
  const { root, instance } = fixture(t);instance.select(root);
  assert.deepEqual(instance.list().entries.map(e => e.name), ['src']);
});
test('rejects traversal, absolute routes, Windows separators, and hidden files', t => {
  const { root, instance } = fixture(t); instance.select(root);
  for (const value of ['../bad.ts', '/etc/passwd', 'src/../../bad.ts', 'src\\hello.ts', '.env', 'src/./hello.ts', 'src//hello.ts', 'C:/foo.ts']) {
    assert.throws(() => instance.read(value));
  }
});
test('refuses symlinks or Windows junctions pointing outside selected workspace', t => {
  const { dir, root, instance } = fixture(t);instance.select(root);
  const external = path.join(dir, 'outside.ts');fs.writeFileSync(external,'secret');
  try { fs.symlinkSync(external, path.join(root, 'src', 'link.ts')); }
  catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
    // Junctions exercise the same escape protection without symlink privileges.
    const externalDir = path.join(dir, 'outside');
    fs.mkdirSync(externalDir);
    fs.writeFileSync(path.join(externalDir, 'hello.ts'), 'secret');
    fs.symlinkSync(externalDir, path.join(root, 'src', 'link'), 'junction');
    assert.throws(() => instance.list('src/link'), /WORKSPACE_ACCESS_DENIED/);
    assert.throws(() => instance.read('src/link/hello.ts'), /WORKSPACE_ACCESS_DENIED/);
    return;
  }
  assert.throws(() => instance.read('src/link.ts'), /WORKSPACE_ACCESS_DENIED/);
});
test('rejects large text and binary files', t => {
  const { root, instance } = fixture(t);instance.select(root);
  fs.writeFileSync(path.join(root, 'huge.ts'), 'x'.repeat(65 * 1024));
  fs.writeFileSync(path.join(root, 'binary.ts'), Buffer.from([65, 0, 66]));
  assert.throws(() => instance.read('huge.ts'), /WORKSPACE_FILE_TOO_LARGE/);
  assert.throws(() => instance.read('binary.ts'), /WORKSPACE_BINARY_FILE/);
});
test('does not permit choosing home, volume root, or protected system directories', t => {
  const { root } = fixture(t);
  assert.throws(() => validRoot(os.homedir()), /WORKSPACE_TOO_BROAD/);
  assert.throws(() => validRoot(path.parse(os.homedir()).root), /WORKSPACE_TOO_BROAD/);
  for (const segment of ['AppData', 'aPpDaTa', 'Windows', 'System32', 'Program Files', 'Program Files (x86)']) {
    assert.throws(() => validRoot(path.join(root, segment, 'project')), /WORKSPACE_FORBIDDEN/);
  }
});
test('IPC sender must be trusted; renderer cannot supply an arbitrary root', async t => {
  const { dir, root } = fixture(t);
  const handlers = {};
  registerWorkspaceIpc({ handle: (name, fn) => { handlers[name] = fn; } }, event => event.trusted, {
    userDataDir: path.join(dir,'config'),
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) },
  });
  await assert.rejects(() => handlers['jarvis:workspace']({ trusted: false }, { operation: 'choose' }), /UNTRUSTED/);
  assert.throws(() => routeWorkspaceRequest({ operation: 'choose', root }), /UNEXPECTED_WORKSPACE_FIELDS/);
  const result = await handlers['jarvis:workspace']({ trusted: true }, { operation: 'choose' });
  assert.equal(result.ok, true);
  assert.equal(result.data.selected, fs.realpathSync(root));
});
test('IPC allows only read/status/choose/clear/list operations', () => {
  for (const operation of ['write','delete','execute','openUrl']) {
    assert.throws(() => routeWorkspaceRequest({operation}), /UNSUPPORTED/);
  }
});

test('accepts deep project source paths but still denies traversal', t => {
  const { root, instance } = fixture(t);
  instance.select(root);
  const rel = 'backend/src/main/java/pl/bawar/jarvis/chat/api/Sample.java';
  const folders = path.dirname(rel);
  fs.mkdirSync(path.join(root, folders), { recursive: true });
  fs.writeFileSync(path.join(root, rel), 'class Sample {}');
  assert.equal(instance.read(rel).content, 'class Sample {}');
  assert.throws(() => instance.read('backend/src/../.env'));
  assert.throws(() => instance.read('backend/node_modules/foo.java'));
});
