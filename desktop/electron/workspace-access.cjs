'use strict';
// AI Lab 12.4: native-user-approved, read-only workspace inspection.
// No file writes, deletions, process execution, network access or arbitrary renderer paths.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MAX_FILE_BYTES = 64 * 1024;
const MAX_ENTRIES = 100;
const MAX_DEPTH = 6;
const ALLOWED_EXT = new Set([
  '.java', '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.html',
  '.scss', '.css', '.sql', '.xml', '.py', '.md', '.txt', '.yml', '.yaml',
  '.properties', '.gradle', '.kt', '.cs', '.csproj', '.sh', '.ps1', '.gitignore',
]);
const DENY_DIR = new Set([
  '.git', '.ssh', '.aws', '.config', '.idea', '.vscode', '.venv', 'venv',
  'node_modules', 'target', 'dist', 'build', '.angular', 'coverage', '.next',
  '.jarvis-patch-backups', 'appdata', 'system32', 'windows', 'program files',
  'program files (x86)', '__pycache__',
]);
const SENSITIVE = /(?:^\.|(?:^|[._-])(secret|credential|password|token|private|apikey|api_key|id_rsa|id_ed25519|keystore)(?:[._-]|$)|\.(?:pem|key|p12|pfx|jks|kdbx|env|sqlite|db|crt|cer)$)/i;

function allowedName(name, directory) {
  if (typeof name !== 'string' || !name || name.startsWith('.') || SENSITIVE.test(name)) return false;
  return directory ? !DENY_DIR.has(name.toLowerCase()) : ALLOWED_EXT.has(path.extname(name).toLowerCase());
}
function relativeParts(relative = '') {
  if (typeof relative !== 'string' || relative.length > 240 || relative.includes('\\') || relative.includes('\0')) {
    throw new Error('INVALID_RELATIVE_PATH');
  }
  if (relative === '') return [];
  const parts = relative.split('/');
  if (parts.length > MAX_DEPTH || parts.some(p => !p || p === '.' || p === '..' || p.includes(':') || p.includes('\0'))) {
    throw new Error('INVALID_RELATIVE_PATH');
  }
  return parts;
}
function validRoot(selected, homeDir = os.homedir()) {
  if (typeof selected !== 'string' || !path.isAbsolute(selected)) throw new Error('INVALID_WORKSPACE');
  const absolute = path.resolve(selected);
  if (absolute === path.parse(absolute).root || absolute.toLowerCase() === path.resolve(homeDir).toLowerCase()) {
    throw new Error('WORKSPACE_TOO_BROAD');
  }
  const parts = absolute.split(path.sep).map(x => x.toLowerCase());
  if (parts.some(p => ['windows', 'system32', 'appdata', 'program files', 'program files (x86)'].includes(p))) {
    throw new Error('WORKSPACE_FORBIDDEN');
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('INVALID_WORKSPACE');
  return fs.realpathSync(absolute);
}
class WorkspaceAccess {
  constructor(userDataDir, homeDir = os.homedir()) {
    if (!path.isAbsolute(userDataDir)) throw new Error('INVALID_CONFIG_DIRECTORY');
    this.configPath = path.join(userDataDir, 'jarvis-workspace.json');
    this.homeDir = homeDir;
  }
  root() {
    let config;
    try { config = JSON.parse(fs.readFileSync(this.configPath, 'utf8')); }
    catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new Error('WORKSPACE_CONFIG_INVALID');
    }
    if (!config || config.version !== 1 || config.readOnly !== true || typeof config.root !== 'string') {
      throw new Error('WORKSPACE_CONFIG_INVALID');
    }
    try { return validRoot(config.root, this.homeDir); }
    catch { throw new Error('WORKSPACE_NO_LONGER_AVAILABLE'); }
  }
  status() { return { selected: this.root(), readOnly: true, writeEnabled: false }; }
  select(selected) {
    const root = validRoot(selected, this.homeDir);
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    // The config contains only the user-approved directory, never credentials.
    fs.writeFileSync(this.configPath, JSON.stringify({ version: 1, root, readOnly: true }, null, 2), { mode: 0o600 });
    return this.status();
  }
  clear() {
    try { fs.unlinkSync(this.configPath); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    return this.status();
  }
  resolve(relative, isDirectory) {
    const root = this.root();
    if (!root) throw new Error('WORKSPACE_NOT_SELECTED');
    const parts = relativeParts(relative);
    if (parts.some((part,i) => !allowedName(part, i < parts.length - 1 || isDirectory))) {
      throw new Error('WORKSPACE_ACCESS_DENIED');
    }
    let candidate = root;
    for (const part of parts) {
      candidate = path.join(candidate, part);
      const st = fs.lstatSync(candidate); // reject symlinks, including junctions
      if (st.isSymbolicLink()) throw new Error('WORKSPACE_ACCESS_DENIED');
    }
    const canonical = fs.realpathSync(candidate);
    const rel = path.relative(root, canonical);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
      throw new Error('WORKSPACE_ACCESS_DENIED');
    }
    const st = fs.statSync(candidate);
    if (isDirectory ? !st.isDirectory() : !st.isFile()) throw new Error('WORKSPACE_TYPE_INVALID');
    return candidate;
  }
  list(relative = '') {
    const dir = this.resolve(relative, true);
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(item => (item.isDirectory() || item.isFile()) && allowedName(item.name, item.isDirectory()))
      .sort((a,b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .slice(0, MAX_ENTRIES)
      .map(item => ({
        name: item.name,
        kind: item.isDirectory() ? 'directory' : 'file',
        relativePath: relative ? relative + '/' + item.name : item.name,
      }));
    return { relativePath: relative, entries };
  }
  read(relative) {
    const file = this.resolve(relative, false);
    // O_NOFOLLOW protects against final-component symlink races on supporting OSes.
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
    const fd = fs.openSync(file, flags);
    try {
      const info = fs.fstatSync(fd);
      if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error('WORKSPACE_FILE_TOO_LARGE');
      const buffer = Buffer.alloc(info.size);
      const bytes = fs.readSync(fd, buffer, 0, info.size, 0);
      const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes));
      if (content.includes('\0')) throw new Error('WORKSPACE_BINARY_FILE');
      return { relativePath: relative, content, size: bytes };
    } finally { fs.closeSync(fd); }
  }
}
function routeWorkspaceRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !['status', 'choose', 'clear', 'list', 'read'].includes(input.operation)) {
    throw new Error('UNSUPPORTED_WORKSPACE_OPERATION');
  }
  const allowed = input.operation === 'list' || input.operation === 'read'
    ? ['operation', 'relativePath'] : ['operation'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('UNEXPECTED_WORKSPACE_FIELDS');
  if (input.operation === 'read' && (typeof input.relativePath !== 'string' || !input.relativePath)) {
    throw new Error('INVALID_RELATIVE_PATH');
  }
  if (input.operation === 'list' && input.relativePath !== undefined && typeof input.relativePath !== 'string') {
    throw new Error('INVALID_RELATIVE_PATH');
  }
  return input;
}
function registerWorkspaceIpc(ipcMain, trustedSender, options) {
  const access = new WorkspaceAccess(options.userDataDir, options.homeDir);
  ipcMain.handle('jarvis:workspace', async (event, request) => {
    if (!trustedSender(event)) throw new Error('UNTRUSTED_IPC_SENDER');
    const input = routeWorkspaceRequest(request);
    try {
      let data;
      switch (input.operation) {
        case 'status': data = access.status(); break;
        case 'clear': data = access.clear(); break;
        case 'list': data = access.list(input.relativePath || ''); break;
        case 'read': data = access.read(input.relativePath); break;
        case 'choose': {
          const selected = await options.dialog.showOpenDialog({
            title: 'Wybierz katalog roboczy Jarvisa (tylko odczyt)',
            properties: ['openDirectory'],
          });
          data = selected.canceled || !selected.filePaths?.length
            ? access.status() : access.select(selected.filePaths[0]);
          break;
        }
        default: throw new Error('UNSUPPORTED_WORKSPACE_OPERATION');
      }
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error?.code === 'ENOENT' ? 'WORKSPACE_PATH_NOT_FOUND' : error.message || 'WORKSPACE_ERROR' };
    }
  });
  return access;
}
module.exports = { WorkspaceAccess, routeWorkspaceRequest, registerWorkspaceIpc, relativeParts, validRoot };
