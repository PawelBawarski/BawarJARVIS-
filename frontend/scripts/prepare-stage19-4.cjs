#!/usr/bin/env node
'use strict';
/** Explicit, opt-in offline image preparation; only dependency manifests enter build context. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const frontendRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const kinds = new Set(['angular', 'spring']);
function dependencyHash(kind, directory) {
  if (!kinds.has(kind)) throw new Error('Unknown profile');
  const manifest = fs.readFileSync(path.join(directory, kind === 'angular' ? 'package.json' : 'pom.xml'));
  const material = kind === 'angular'
    ? Buffer.concat([manifest, Buffer.from([0]), fs.readFileSync(path.join(directory, 'package-lock.json'))])
    : manifest;
  return crypto.createHash('sha256').update(material).digest('hex');
}
function imageName(kind, hash) {
  return `jarvis-${kind}-test:19-4-${hash.slice(0, 12)}`;
}
function dockerfile(kind) {
  if (kind === 'angular') return [
    'FROM node:24-alpine',
    'WORKDIR /opt/jarvis',
    'COPY package.json package-lock.json ./',
    'RUN npm ci --no-audit --no-fund && chmod -R a+rX /opt/jarvis',
    'LABEL jarvis.stage="19.4"',
    '',
  ].join('\n');
  return [
    'FROM maven:3.9-eclipse-temurin-21',
    'WORKDIR /opt/jarvis',
    'COPY pom.xml ./',
    // Run an explicit tiny JUnit test during preparation to prefetch test providers as well.
    'RUN mkdir -p src/test/java && printf "import org.junit.jupiter.api.Test; class JarvisOfflinePrewarmTest { @Test void ok() {} }\\n" > src/test/java/JarvisOfflinePrewarmTest.java && mvn -B -ntp -Dmaven.repo.local=/opt/m2 dependency:go-offline && mvn -B -ntp -Dmaven.repo.local=/opt/m2 -Dtest=JarvisOfflinePrewarmTest test && rm -rf src && chmod -R a+rX /opt/m2',
    'LABEL jarvis.stage="19.4"',
    '',
  ].join('\n');
}
function prepare(kind, directory, docker = spawnSync) {
  if (!kinds.has(kind)) throw new Error('Use angular or spring');
  const hash = dependencyHash(kind, directory);
  const image = imageName(kind, hash);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-deps-'));
  try {
    fs.copyFileSync(path.join(directory, kind === 'angular' ? 'package.json' : 'pom.xml'),
      path.join(temp, kind === 'angular' ? 'package.json' : 'pom.xml'));
    if (kind === 'angular') fs.copyFileSync(path.join(directory, 'package-lock.json'), path.join(temp, 'package-lock.json'));
    fs.writeFileSync(path.join(temp, 'Dockerfile'), dockerfile(kind));
    const result = docker('docker', ['build', '--tag', image, '--file', path.join(temp, 'Dockerfile'), temp], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Docker build failed (${result.status})`);
    return image;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
if (require.main === module) {
  try {
    const mode = process.argv[2];
    if (!kinds.has(mode)) throw new Error('Usage: node scripts/prepare-stage19-4.cjs angular|spring');
    console.log('Preparing explicit dependency image. This build requires network access; checks themselves never do.');
    console.log('Only dependency manifests are copied; project sources and .env files are excluded.');
    console.log('READY_IMAGE:', prepare(mode, mode === 'angular' ? frontendRoot : backendRoot));
  } catch (e) { console.error('STAGE_19_4_PREPARE_FAILED:', e.message); process.exitCode = 1; }
}
module.exports = { dependencyHash, imageName, dockerfile, prepare };
