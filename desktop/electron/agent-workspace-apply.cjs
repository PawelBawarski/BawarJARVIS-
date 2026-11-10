'use strict';
/** Stage 16.6: manually approved, test-gated, single-file deploy with persisted rollback.
 * This module never executes generated code, commands, or reads renderer-supplied paths.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WorkspaceAccess } = require('./workspace-access.cjs');
const { validateRequest, uniqueReplacement } = require('./agent-project-test.cjs');

const GRANT_LIFETIME_MS = 15 * 60 * 1000;
const MAX_FILE_BYTES = 512 * 1024;
const ID_RE = /^[a-f0-9]{48}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const BACKUP_DIR = 'agent-deploy-backups-16-6';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const randomId = () => crypto.randomBytes(24).toString('hex');

function validateAction(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) throw new Error('INVALID_APPLY_REQUEST');
  const keys = Object.keys(req).sort().join(',');
  if (req.operation === 'apply' && keys === 'grantId,operation' && ID_RE.test(req.grantId)) return req;
  if (req.operation === 'rollback' && keys === 'deploymentId,operation' && ID_RE.test(req.deploymentId)) return req;
  if (req.operation === 'history' && keys === 'operation') return req;
  throw new Error('INVALID_APPLY_REQUEST');
}
function readSource(access, relativePath) {
  const filename = access.resolve(relativePath, false); // rechecks every symlink/junction
  const st = fs.lstatSync(filename);
  if (!st.isFile() || st.isSymbolicLink() || st.size > MAX_FILE_BYTES) throw new Error('SOURCE_NOT_SAFE');
  const data = fs.readFileSync(filename);
  if (data.includes(0)) throw new Error('BINARY_SOURCE');
  const content = new TextDecoder('utf-8', { fatal: true }).decode(data);
  return {filename, data, content, fingerprint: sha256(data), mode: st.mode & 0o777};
}
function saveFileAtomic(dest, data, mode = 0o600) {
  const tmp = dest + `.jarvis-${randomId()}.tmp`;
  try {
    fs.writeFileSync(tmp, data, {flag:'wx', mode});
    fs.renameSync(tmp, dest);
  } finally {
    try {fs.unlinkSync(tmp);} catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
}
function matchWorkspace(access, expectedHash) {
  const root = access.root();
  try {
    if (!root || sha256(fs.realpathSync(root)) !== expectedHash) throw new Error('WORKSPACE_CHANGED');
  } catch { throw new Error('WORKSPACE_CHANGED'); }
  return root;
}
function readManifest(base, deploymentId) {
  const directory = path.join(base, deploymentId);
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('INVALID_BACKUP_DIRECTORY');
  const file = path.join(directory, 'manifest.json');
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('INVALID_BACKUP_MANIFEST');
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.length > 4096) throw new Error('INVALID_BACKUP_MANIFEST');
  const m = JSON.parse(raw);
  if (m.version !== 1 || !['prepared','applied'].includes(m.status) ||
      !HASH_RE.test(m.rootHash) || !HASH_RE.test(m.beforeHash) || !HASH_RE.test(m.afterHash) ||
      typeof m.relativePath !== 'string') throw new Error('INVALID_BACKUP_MANIFEST');
  // Validation must match exactly the same source tree restrictions as 16.5.
  validateRequest({operation:'test', relativePath:m.relativePath, original:'x', proposed:'y'});
  return {directory, manifest:m};
}
function createDeploymentGate({ userDataDir, dialog, access = new WorkspaceAccess(userDataDir), now = Date.now } = {}) {
  if (typeof userDataDir !== 'string' || !path.isAbsolute(userDataDir)) throw new Error('INVALID_BACKUP_ROOT');
  if (typeof dialog?.showMessageBox !== 'function') throw new Error('NATIVE_CONFIRMATION_REQUIRED');
  const grants = new Map();
  let occupied = false;
  const backupBase = path.join(userDataDir, BACKUP_DIR);
  function backupRoot() {
    fs.mkdirSync(backupBase, {recursive:true,mode:0o700});
    if (fs.lstatSync(backupBase).isSymbolicLink()) throw new Error('INVALID_BACKUP_ROOT');
    return backupBase;
  }
  function issueGrant(req, sourceSha256) {
    const validated = validateRequest(req);
    if (typeof sourceSha256 !== 'string' || !HASH_RE.test(sourceSha256)) throw new Error('UNVERIFIED_TEST_RESULT');
    const root = access.root();
    if (!root) throw new Error('WORKSPACE_NOT_SELECTED');
    const source = readSource(access, validated.relativePath);
    if (source.fingerprint !== sourceSha256) throw new Error('SOURCE_CHANGED_AFTER_TEST');
    uniqueReplacement(source.content, validated.original, validated.proposed);
    const grantId = randomId();
    grants.set(grantId, {rootHash:sha256(fs.realpathSync(root)), req:validated, fileHash:sourceSha256, expires:now()+GRANT_LIFETIME_MS});
    if (grants.size > 32) grants.delete(grants.keys().next().value);
    return grantId;
  }
  async function apply(grantId) {
    const grant = grants.get(grantId);
    if (!grant || now() > grant.expires) {grants.delete(grantId); throw new Error('TEST_GRANT_EXPIRED_OR_MISSING');}
    matchWorkspace(access, grant.rootHash);
    const {req} = grant;
    const before = readSource(access, req.relativePath);
    if (before.fingerprint !== grant.fileHash) throw new Error('STALE_SOURCE_FILE');
    const afterString = uniqueReplacement(before.content, req.original, req.proposed);
    const afterBytes = Buffer.from(afterString, 'utf8');
    if (afterBytes.length > MAX_FILE_BYTES) throw new Error('PROPOSED_FILE_TOO_LARGE');
    const approval = await dialog.showMessageBox({
      type:'warning', title:'J.A.R.V.I.S. — potwierdzenie zapisu kodu',
      message:'Czy na pewno wdrożyć przetestowaną propozycję?',
      detail:`Plik: ${req.relativePath}\nZmiana obejmuje tylko jeden wskazany fragment. Przed zapisem powstanie kopia zapasowa.`,
      buttons:['Anuluj', 'Zapisz zmianę'], defaultId:0, cancelId:0, noLink:true,
    });
    if (!approval || approval.response !== 1) return {status:'cancelled',message:'Anulowano — nie zmieniono pliku.'};
    const again = readSource(access, req.relativePath);
    matchWorkspace(access, grant.rootHash);
    if (again.fingerprint !== grant.fileHash) throw new Error('STALE_SOURCE_FILE');
    // On-disk journal is written BEFORE changing the source file.
    const base = backupRoot();
    const deploymentId = randomId();
    const directory = path.join(base, deploymentId);
    fs.mkdirSync(directory, {mode:0o700});
    const originalBackup = path.join(directory,'before.bin');
    const manifestPath = path.join(directory,'manifest.json');
    fs.writeFileSync(originalBackup, again.data, {flag:'wx',mode:0o600});
    const record = {
      version:1, status:'prepared',rootHash:grant.rootHash,relativePath:req.relativePath,
      beforeHash:grant.fileHash,afterHash:sha256(afterBytes),createdAt:new Date(now()).toISOString(),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(record,null,2), {flag:'wx',mode:0o600});
    let modified = false;
    try {
      const finalCheck = readSource(access, req.relativePath);
      if (finalCheck.fingerprint !== grant.fileHash) throw new Error('STALE_SOURCE_FILE');
      saveFileAtomic(finalCheck.filename,afterBytes,again.mode);
      modified = true;
      grants.delete(grantId);
      record.status = 'applied';
      saveFileAtomic(manifestPath,Buffer.from(JSON.stringify(record,null,2),'utf8'));
      return {status:'applied',deploymentId,relativePath:req.relativePath,message:'Wdrożono jeden przetestowany fragment. Kopia zapasowa zachowana.'};
    } catch (error) {
      // A journal with status prepared remains recoverable after unexpected termination.
      if (modified) {
        try {saveFileAtomic(again.filename,again.data,again.mode);} catch {}
      }
      throw error;
    }
  }
  async function rollback(deploymentId) {
    const {directory,manifest:m} = readManifest(backupRoot(),deploymentId);
    matchWorkspace(access,m.rootHash);
    const current=readSource(access,m.relativePath);
    if (current.fingerprint !== m.afterHash) throw new Error('ROLLBACK_FILE_CHANGED: Nie nadpisuję późniejszych edycji.');
    const originalPath=path.join(directory,'before.bin');
    if (fs.lstatSync(originalPath).isSymbolicLink()) throw new Error('BACKUP_SYMLINK_DENIED');
    const original=fs.readFileSync(originalPath);
    if (sha256(original)!==m.beforeHash) throw new Error('BACKUP_CORRUPTED');
    const approval=await dialog.showMessageBox({
      type:'warning',title:'J.A.R.V.I.S. — cofnięcie wdrożenia',
      message:'Przywrócić poprzednią wersję pliku?',
      detail:`Plik: ${m.relativePath}\nPóźniejsze zmiany nie zostaną nadpisane.`,
      buttons:['Anuluj','Przywróć kopię'],defaultId:0,cancelId:0,noLink:true,
    });
    if (!approval || approval.response!==1) return {status:'cancelled',message:'Anulowano cofnięcie.'};
    const latest=readSource(access,m.relativePath);
    matchWorkspace(access,m.rootHash);
    if (latest.fingerprint!==m.afterHash) throw new Error('ROLLBACK_FILE_CHANGED');
    saveFileAtomic(latest.filename,original,latest.mode);
    const restored=path.join(directory,'manifest.rolled-back.json');
    // Renaming the manifest preserves the audit record and prevents another rollback.
    fs.renameSync(path.join(directory,'manifest.json'),restored);
    return {status:'rolled_back',relativePath:m.relativePath,message:'Przywrócono oryginalny plik z kopii zapasowej.'};
  }
  function history() {
    const root = access.root();
    if (!root) throw new Error('WORKSPACE_NOT_SELECTED');
    const rootHash = sha256(fs.realpathSync(root));
    const base=backupRoot();
    const deployments=[];
    for (const entry of fs.readdirSync(base, {withFileTypes:true}).slice(0, 200)) {
      if (!entry.isDirectory() || !ID_RE.test(entry.name)) continue;
      try {
        const {manifest:m}=readManifest(base,entry.name);
        if (m.status === 'applied' && m.rootHash === rootHash) {
          deployments.push({deploymentId:entry.name,relativePath:m.relativePath,createdAt:m.createdAt || ''});
        }
      } catch { /* corrupt or rolled-back journal: do not expose it */ }
    }
    deployments.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return {status:'ok',deployments:deployments.slice(0,30)};
  }
  async function handle(req) {
    validateAction(req);
    if (occupied) throw new Error('ANOTHER_DEPLOYMENT_IN_PROGRESS');
    occupied=true;
    try {return req.operation==='history'?history():req.operation==='apply'?await apply(req.grantId):await rollback(req.deploymentId);}
    finally {occupied=false;}
  }
  return {issueGrant,handle};
}
function registerWorkspaceApplyIpc(ipcMain,trustedSender,gate) {
  ipcMain.handle('jarvis:agent-workspace-apply',async (event,request)=>{
    if (!trustedSender(event)) throw new Error('UNTRUSTED_IPC_SENDER');
    return gate.handle(request);
  });
}
module.exports={createDeploymentGate,registerWorkspaceApplyIpc,validateAction,BACKUP_DIR};
