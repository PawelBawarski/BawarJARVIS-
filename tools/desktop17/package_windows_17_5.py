#!/usr/bin/env python3
"""J.A.R.V.I.S. 17.5 — offline, fail-closed Windows NSIS packager.

--check: inventory only, without reading secrets or large model bytes
--verify: full SHA256 verification of Qwen source + staged backend assets
--provision-model: copy verified GGUF to persistent LOCALAPPDATA; never overwrite
--build: run regression + NSIS build locally; NEVER publish automatically
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

GGUF = 'Qwen3-8B-Q4_K_M.gguf'
MODEL_REL = Path('desktop/ai-runtime/models') / GGUF
MANIFEST = Path('desktop/ai-runtime/stage17-4-manifest.json')
CONFIG = 'electron-builder.stage17-5.config.cjs'

class Blocked(RuntimeError):
    pass

def ensure(condition: bool, reason: str):
    if not condition:
        raise Blocked(reason)

def digest(p: Path) -> str:
    sha = hashlib.sha256()
    with p.open('rb') as stream:
        while buf := stream.read(8 * 1024 * 1024):
            sha.update(buf)
    return sha.hexdigest()

def no_symlink(path: Path):
    path = path.absolute()
    for part in [path, *path.parents]:
        if part.is_symlink():
            raise Blocked('Odmowa operacji na dowiązaniu symbolicznym: ' + str(path))

def path_within(root: Path, relative: str | Path) -> Path:
    name = Path(relative)
    ensure(not name.is_absolute() and '..' not in name.parts, 'Ścieżka poza projektem')
    p = root / name
    no_symlink(p)
    return p

def expected_model(root: Path):
    mf = path_within(root, MANIFEST)
    ensure(mf.is_file(), f'Brak manifestu Qwen: {MANIFEST}')
    try:
        manifest = json.loads(mf.read_text('utf-8'))
    except (UnicodeError, json.JSONDecodeError) as err:
        raise Blocked('Manifest Qwen nie jest prawidłowym JSON') from err
    ensure(manifest.get('schema') == 'jarvis.ai17.4.v1' and isinstance(manifest.get('files'), list),
           'Nieobsługiwany manifest Qwen 17.4')
    found = [e for e in manifest['files'] if isinstance(e, dict) and e.get('path') == f'models/{GGUF}']
    ensure(len(found) == 1, 'Manifest Qwen nie zawiera jednoznacznego modelu')
    entry = found[0]
    ensure(type(entry.get('size')) is int and entry['size'] >= 1_000_000_000 and
           re.fullmatch('[a-f0-9]{64}', str(entry.get('sha256', ''))) is not None,
           'Nieprawidłowy rozmiar lub SHA-256 modelu w manifeście')
    return entry

def inventory(root: Path):
    checks = [
        ('Konfiguracja 17.5', CONFIG),
        ('Konfiguracja 17.4', 'electron-builder.stage17-4.config.cjs'),
        ('Nadzor Qwen', 'desktop/electron/qwen-runtime.cjs'),
        ('Rozdzielenie GGUF', 'desktop/electron/qwen-model-path.cjs'),
        ('Java 21', 'desktop/resources/java/bin/java.exe'),
        ('Spring Boot', 'desktop/resources/backend/jarvis-backend.jar'),
        ('Manifest Java/JAR', 'desktop/resources/backend/stage17-2-manifest.json'),
        ('PostgreSQL 17', 'desktop/resources/postgres/bin/postgres.exe'),
        ('PostgreSQL pg_ctl', 'desktop/resources/postgres/bin/pg_ctl.exe'),
        ('PostgreSQL katalog', 'desktop/resources/postgres/share/postgres.bki'),
        ('llama-server', 'desktop/ai-runtime/bin/llama-server.exe'),
        ('Model Qwen', str(MODEL_REL)),
        ('Angular', 'frontend/dist/jarvis/browser/index.html'),
        ('Weryfikacja Qwen', 'tools/desktop17/verify_qwen_assets.py'),
        ('Weryfikacja Java/JAR', 'tools/desktop17/stage_windows_backend.py'),
    ]
    misses = []
    for label, name in checks:
        f = path_within(root, name)
        exists = f.is_file()
        print(f"  [{'TAK' if exists else 'BRAK'}] {label}: {name}")
        if not exists: misses.append(name)
    if not misses:
        expected = expected_model(root)
        source = path_within(root, MODEL_REL)
        ensure(source.stat().st_size == expected['size'], 'Rozmiar modelu różni się od manifestu')
        with source.open('rb') as s:
            ensure(s.read(4) == b'GGUF', 'Plik modelu nie jest GGUF')
    return misses

def run(root: Path, commands: list[str], timeout=1800):
    print('URUCHAMIAM:', ' '.join(commands), flush=True)
    p = subprocess.run(commands, cwd=root, timeout=timeout, check=False)
    if p.returncode:
        raise Blocked(f'Polecenie nie przeszło: {commands[0]} (exit={p.returncode})')

def verify(root: Path):
    misses = inventory(root)
    ensure(not misses, 'Brak wymaganych zasobów. Ukończ przygotowanie 17.2–17.4.')
    expected = expected_model(root)
    model = path_within(root, MODEL_REL)
    print('WERYFIKUJĘ SHA-256 Qwen (duży plik)...', flush=True)
    ensure(digest(model) == expected['sha256'], 'Qwen nie zgadza się z SHA-256 z manifestu')
    run(root, [sys.executable, 'tools/desktop17/stage_windows_backend.py', '--verify'], 300)
    run(root, [sys.executable, 'tools/desktop17/verify_qwen_assets.py', '--verify'], 1800)
    # CI must not substitute unreviewed scripts or compile without staged JAR.
    print('VERIFY_OK: kompletne zasoby i SHA-256. Migracja bazy jest weryfikowana osobno przez 17.3.')

def model_destination(env: dict):
    local = env.get('LOCALAPPDATA')
    ensure(bool(local) and Path(local).is_absolute(), 'Brak LOCALAPPDATA (Windows); nie zgaduję lokalizacji modelu')
    return Path(local) / 'J.A.R.V.I.S.' / 'models' / GGUF

def provision(root: Path, env=None, destination: Path | None = None):
    env = os.environ if env is None else env
    source = path_within(root, MODEL_REL)
    expected = expected_model(root)
    ensure(source.is_file() and source.stat().st_size == expected['size'], 'Niepoprawny plik źródłowy GGUF')
    dest = destination if destination is not None else model_destination(env)
    ensure(dest.is_absolute(), 'Docelowy model musi być w ścieżce absolutnej')
    no_symlink(dest)
    if dest.exists():
        ensure(dest.is_file() and dest.stat().st_size == expected['size'] and
               digest(dest) == expected['sha256'], 'Istniejący model różni się od oczekiwanego; nie nadpisuję go')
        print('ALREADY_PROVISIONED: model zgodny z manifestem')
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    no_symlink(dest)
    usage = shutil.disk_usage(dest.parent)
    ensure(usage.free >= expected['size'] + 256 * 1024 * 1024,
           'Za mało wolnego miejsca na bezpieczną kopię modelu')
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.jarvis-model-', suffix='.tmp',
                                         dir=dest.parent, delete=False) as out:
            tmp = Path(out.name)
            os.chmod(tmp, 0o600)
            h = hashlib.sha256()
            with source.open('rb') as inp:
                while data := inp.read(8 * 1024 * 1024):
                    out.write(data)
                    h.update(data)
            out.flush(); os.fsync(out.fileno())
        ensure(tmp.stat().st_size == expected['size'] and h.hexdigest() == expected['sha256'],
               'Weryfikacja skopiowanego GGUF nie powiodła się')
        # Never replace an existing file even in a race; Windows os.link may need permissions.
        ensure(not dest.exists(), 'Docelowy model powstał podczas kopiowania. Odmawiam nadpisania.')
        os.rename(tmp, dest)
        tmp = None
        print('PROVISION_OK: model zweryfikowany i zapisany poza katalogiem instalacji')
        return dest
    finally:
        if tmp is not None: tmp.unlink(missing_ok=True)

def locate_builder(root: Path) -> str:
    candidates = [root / 'node_modules/.bin/electron-builder.cmd',
                  root / 'desktop/node_modules/.bin/electron-builder.cmd']
    for f in candidates:
        if f.is_file(): return str(f)
    raise Blocked('Brak lokalnego electron-builder.cmd. Zainstaluj istniejące zależności desktop/npm, bez npx auto-download.')

def build(root: Path):
    ensure(sys.platform == 'win32', 'Build NSIS jest wykonywany na Windows, nie w tym środowisku.')
    verify(root)
    # Pre-release verification: no stale UI; all regressions must pass.
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    node = shutil.which('node.exe') or shutil.which('node')
    ensure(npm is not None and node is not None, 'Brak Node/npm')
    run(root, [node, '--check', 'desktop/electron/main.cjs'], 30)
    electron_tests = sorted(str(p.relative_to(root)) for p in (root/'desktop/electron').glob('*.test.cjs'))
    ensure(bool(electron_tests), 'Brak testów Electron')
    run(root, [node, '--test', *electron_tests], 900)
    run(root, [node, '--test', 'scripts/verify-release-artifact.test.cjs'], 180)
    run(root, [sys.executable, 'tools/desktop17/test_package_windows_17_5.py'], 180)
    run(root, [node, '--test', 'tools/desktop17/test_builder_config_17_5.cjs'], 180)
    maven = root / 'backend/mvnw.cmd'
    ensure(maven.is_file(), 'Brak backend/mvnw.cmd')
    run(root/'backend', [str(maven), '-B', '-ntp', 'test'], 1200)
    run(root, [npm, '--prefix', 'frontend', 'run', 'build'], 900)
    run(root, [npm, '--prefix', 'frontend', 'test', '--', '--watch=false'], 900)
    npx = shutil.which('npx.cmd') or shutil.which('npx')
    ensure(npx is not None, 'Brak npx')
    run(root / 'frontend', [npx, '--no-install', 'playwright', 'test', '--workers=1'], 1200)
    run(root, [node, 'scripts/stage-llm-licenses.cjs'], 30)
    builder = locate_builder(root)
    run(root / 'desktop', [builder, '--projectDir', str(root / 'desktop'), '--config', str(root / 'electron-builder.stage17-5.desktop.config.cjs'), '--win', 'nsis', '--x64', '--publish', 'never'], 3600)
    # Same fail-closed post-build checks and manifest as npm installer:stage17-5.
    run(root, [node, 'scripts/verify-release-artifact.cjs', '--write-manifest', '--root', str(root)], 300)
    print('UWAGA: to lokalny instalator, bez modelu GGUF. 17.6 sprawdzi czystą instalację przed publikacją.')

def main(argv=None):
    p = argparse.ArgumentParser(description='J.A.R.V.I.S. 17.5: bezpieczny instalator NSIS Windows')
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument('--check', action='store_true')
    group.add_argument('--verify', action='store_true')
    group.add_argument('--provision-model', action='store_true')
    group.add_argument('--build', action='store_true')
    p.add_argument('--root', type=Path, default=Path.cwd())
    args = p.parse_args(argv)
    try:
        root = args.root.resolve(strict=True)
        ensure(root.is_dir() and (root/'frontend').is_dir() and (root/'desktop').is_dir(),
               'Uruchom narzędzie z katalogu BawarJARVIS-')
        if args.check:
            misses = inventory(root)
            ensure(not misses, 'CHECK_BLOCKED: ' + ', '.join(misses))
            print('CHECK_OK: zasoby znalezione, pełną weryfikację wykonaj przez --verify')
        elif args.verify: verify(root)
        elif args.provision_model: provision(root)
        elif args.build: build(root)
        return 0
    except (Blocked, OSError, ValueError, subprocess.TimeoutExpired) as error:
        print('BLOCKED:', str(error), file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
