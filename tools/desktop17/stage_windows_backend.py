#!/usr/bin/env python3
"""J.A.R.V.I.S. 17.2: build Spring Boot and stage a redistributable Java 21 runtime.

Only the explicit --prepare mode invokes Maven/jlink and writes under
`desktop/resources/java` + `desktop/resources/backend`. It neither starts
PostgreSQL nor reads backend.env, nor touches chat history.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

MODULES = 'java.se,jdk.charsets,jdk.crypto.ec,jdk.localedata,jdk.management,jdk.naming.dns,jdk.security.auth,jdk.unsupported,jdk.zipfs'


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def java_release(jdk: Path) -> dict[str, str]:
    release = jdk / 'release'
    if release.is_symlink() or not release.is_file():
        raise ValueError('Brak pliku release w katalogu JDK.')
    info: dict[str, str] = {}
    for row in release.read_text(encoding='utf-8').splitlines():
        match = re.fullmatch(r'([A-Z_]+)=(?:"(.*)"|(.*))', row)
        if match:
            info[match[1]] = match[2] if match[2] is not None else match[3]
    version = info.get('JAVA_VERSION', '')
    if not re.match(r'^21(?:\.|$)', version):
        raise ValueError(f'Wymagany JDK 21, wykryto: {version or "nieznany"}')
    for name in ['java.exe', 'jlink.exe']:
        exe = jdk / 'bin' / name
        if exe.is_symlink() or not exe.is_file():
            raise ValueError(f'Brakuje {name} w JDK.')
    if not ((jdk / 'legal' / 'java.base').is_dir() or (jdk / 'LICENSE').is_file()):
        raise ValueError('Nie znaleziono informacji licencyjnych JDK. Nie wolno pakować go bez licencji.')
    return info


def find_jdk(explicit: str | None = None) -> Path:
    options: list[Path] = []
    if explicit:
        options.append(Path(explicit))
    elif os.environ.get('JAVA_HOME'):
        options.append(Path(os.environ['JAVA_HOME']))
    else:
        for exe in ['jlink.exe', 'jlink']:
            resolved = shutil.which(exe)
            if resolved:
                options.append(Path(resolved).resolve().parent.parent)
    if not options:
        raise ValueError('Nie znalazłem JDK. Podaj --jdk "C:\\Program Files\\Eclipse Adoptium\\jdk-21...".')
    for option in options:
        try:
            location = option.resolve(strict=True)
            java_release(location)
            return location
        except (OSError, ValueError):
            if explicit:
                raise
    raise ValueError('Wykryte JAVA_HOME/jlink nie wskazują na pełny JDK 21. Podaj --jdk.')


def choose_boot_jar(root: Path) -> Path:
    folder = root / 'backend' / 'target'
    candidates = [p for p in folder.glob('*.jar') if p.is_file() and not p.is_symlink()
                  and not p.name.startswith('original-') and not p.name.endswith(('-sources.jar', '-javadoc.jar'))]
    valid: list[Path] = []
    for candidate in candidates:
        try:
            with zipfile.ZipFile(candidate) as z:
                names = set(z.namelist())
                if 'META-INF/MANIFEST.MF' in names and any(x.startswith('BOOT-INF/lib/') for x in names):
                    manifest = z.read('META-INF/MANIFEST.MF').decode('utf-8', errors='replace')
                    if 'Start-Class:' in manifest and 'Main-Class:' in manifest:
                        valid.append(candidate)
        except (zipfile.BadZipFile, OSError):
            pass
    if len(valid) != 1:
        raise ValueError(f'Oczekiwałem jednego wykonywalnego Spring Boot fat JAR w backend/target, znaleziono: {len(valid)}. ({len(candidates)} plików .jar)')
    return valid[0]


def safe_dir(path: Path) -> bool:
    return path.is_dir() and not path.is_symlink()


def run_checked(args: list[str], cwd: Path) -> None:
    # Fixed local tools; never uses the shell or accepts model-generated commands.
    print('URUCHAMIAM:', ' '.join([Path(args[0]).name, *args[1:]]), flush=True)
    subprocess.run(args, cwd=str(cwd), check=True, shell=False)


def verify_bundle(root: Path, run_java: bool = True) -> None:
    resources = root / 'desktop' / 'resources'
    java = resources / 'java' / 'bin' / 'java.exe'
    jar = resources / 'backend' / 'jarvis-backend.jar'
    manifest_file = resources / 'backend' / 'stage17-2-manifest.json'
    for p in [resources / 'java', resources / 'java' / 'bin', resources / 'backend', java, jar, manifest_file]:
        if p.is_symlink() or not p.exists():
            raise ValueError(f'Brak elementu lub symlink: {p.relative_to(root)}')
    data = json.loads(manifest_file.read_text('utf-8'))
    if data.get('schema') != 'jarvis.windows17.backend.v1':
        raise ValueError('Nieznany manifest zasobów.')
    if hash_file(java) != data.get('sha256_java') or hash_file(jar) != data.get('sha256_jar'):
        raise ValueError('Niepoprawna suma SHA-256 bundla Java/JAR.')
    if not (resources / 'java' / 'legal' / 'java.base').is_dir() or not (resources / 'java' / 'release').is_file():
        raise ValueError('Runtime nie ma kompletu plików licencyjnych lub metadanych Java.')
    java_version = re.search(r'^JAVA_VERSION=\"?([^\"\n]+)', (resources / 'java' / 'release').read_text('utf-8'), flags=re.MULTILINE)
    if not java_version or not re.match(r'^21(?:\.|$)', java_version.group(1)):
        raise ValueError('Spakowane środowisko Java nie jest Java 21.')
    with zipfile.ZipFile(jar) as z:
        if 'META-INF/MANIFEST.MF' not in z.namelist() or not any(n.startswith('BOOT-INF/lib/') for n in z.namelist()):
            raise ValueError('Bundlowany JAR nie jest wykonywalnym Spring Boot JAR.')
    if run_java and sys.platform == 'win32':
        completed = subprocess.run([str(java), '-version'], capture_output=True, text=True, timeout=15, shell=False)
        if completed.returncode != 0 or not re.search(r'version "21\.', completed.stderr + completed.stdout):
            raise ValueError('Spakowana Java nie uruchamia się lub nie jest w wersji 21.')
    print('VERIFY_OK: Java 21 + Spring Boot fat JAR, sumy SHA-256 poprawne, bez Dockera.')


def prepare(root: Path, jdk: Path, skip_build: bool, replace: bool) -> None:
    if sys.platform != 'win32':
        raise ValueError('Przygotowanie 17.2 wymaga Windows: jlink musi utworzyć windowsowe java.exe.')
    java_release(jdk)
    resources = root / 'desktop' / 'resources'
    if resources.is_symlink():
        raise ValueError('desktop/resources nie może być symlinkiem.')
    resources.mkdir(parents=True, exist_ok=True)
    target_java = resources / 'java'
    target_backend = resources / 'backend'
    if (target_java.exists() or target_backend.exists()) and not replace:
        raise ValueError('Bundle już istnieje. Uruchom --verify albo świadomie użyj --replace (kopie zapasowe).')
    if not skip_build:
        wrapper = root / 'backend' / 'mvnw.cmd'
        if wrapper.is_symlink() or not wrapper.is_file():
            raise ValueError('Brak backend/mvnw.cmd. Nie można bezpiecznie zbudować backendu.')
        run_checked([str(wrapper), '-B', '-ntp', 'package'], root / 'backend')
    jar = choose_boot_jar(root)
    workspace = Path(tempfile.mkdtemp(prefix='.jarvis17-2-staging-', dir=resources))
    backup_dir = None
    moved_old: list[tuple[Path, Path]] = []
    moved_new: list[Path] = []
    try:
        staging_java = workspace / 'java'
        run_checked([
            str(jdk / 'bin' / 'jlink.exe'), '--add-modules', MODULES, '--strip-debug',
            '--no-header-files', '--no-man-pages', '--output', str(staging_java),
        ], root)
        staged_java_exe = staging_java / 'bin' / 'java.exe'
        staged_license = staging_java / 'legal' / 'java.base'
        if not staged_java_exe.is_file() or not staged_license.is_dir():
            raise ValueError('jlink nie przygotował pełnej Javy lub katalogu licencji legal/.')
        completed = subprocess.run([str(staged_java_exe), '-version'], capture_output=True, text=True, timeout=20, shell=False)
        if completed.returncode != 0 or not re.search(r'version "21\.', completed.stderr + completed.stdout):
            raise ValueError('Nie można uruchomić środowiska Java 21 wygenerowanego przez jlink.')
        staging_backend = workspace / 'backend'
        staging_backend.mkdir()
        dest_jar = staging_backend / 'jarvis-backend.jar'
        shutil.copy2(jar, dest_jar)
        version = java_release(jdk)
        manifest = {
            'schema': 'jarvis.windows17.backend.v1',
            'java_version': version['JAVA_VERSION'],
            'java_implementor': version.get('IMPLEMENTOR', 'unknown'),
            'sha256_java': hash_file(staged_java_exe),
            'sha256_jar': hash_file(dest_jar),
            'modules': MODULES.split(','),
            'note': 'Java build is local; check JDK license and redistribution terms before publishing installer.',
        }
        (staging_backend / 'stage17-2-manifest.json').write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        if replace and (target_java.exists() or target_backend.exists()):
            from datetime import datetime, timezone
            label = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            backup_dir = resources / '.stage17-2-backups' / label
            backup_dir.mkdir(parents=True, exist_ok=False)
            for target in [target_java, target_backend]:
                if target.exists():
                    if target.is_symlink() or not target.is_dir():
                        raise ValueError(f'Nieznany istniejący katalog {target}')
                    backup = backup_dir / target.name
                    target.rename(backup)
                    moved_old.append((target, backup))
        for target, source in [(target_java, staging_java), (target_backend, staging_backend)]:
            source.rename(target)
            moved_new.append(target)
        verify_bundle(root)
        print('PREPARE_OK: desktop/resources/java i desktop/resources/backend gotowe do electron-builder.')
        if backup_dir:
            print('KOPIA:', backup_dir.relative_to(root))
    except BaseException:
        for target in reversed(moved_new):
            if target.is_dir() and not target.is_symlink():
                shutil.rmtree(target)
        for target, backup in reversed(moved_old):
            if backup.exists():
                backup.rename(target)
        raise
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='JARVIS 17.2 — lokalny pakiet Java 21 + Spring Boot')
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--check', action='store_true', help='Tylko kontrola, bez zapisu i bez procesów')
    action.add_argument('--prepare', action='store_true', help='Maven package + jlink + zasoby pakietu')
    action.add_argument('--verify', action='store_true', help='Weryfikacja istniejącego pakietu')
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--jdk', help='Katalog JDK 21 (jeśli JAVA_HOME nie jest ustawione)')
    parser.add_argument('--skip-build', action='store_true', help='Użyj istniejącego Spring Boot JAR (po pomyślnym Maven package)')
    parser.add_argument('--replace', action='store_true', help='Zastąp poprzedni bundle z kopią zapasową')
    args = parser.parse_args(argv)
    try:
        root = args.root.resolve(strict=True)
        if not (root / 'backend' / 'pom.xml').is_file() or not (root / 'desktop' / 'electron' / 'backend-runtime.cjs').is_file():
            raise ValueError('To nie jest katalog główny projektu BawarJARVIS-.')
        if args.verify:
            verify_bundle(root)
            return 0
        jdk = find_jdk(args.jdk)
        info = java_release(jdk)
        print(f"JDK_OK: Java {info['JAVA_VERSION']}, implementor: {info.get('IMPLEMENTOR', 'unknown')}")
        if args.check:
            try:
                boot = choose_boot_jar(root)
                print('SPRING_BOOT_JAR_OK:', boot.relative_to(root))
            except ValueError:
                print('SPRING_BOOT_JAR: brak — zostanie zbudowany przez Maven package.')
            print('CHECK_OK: bez zmian w projekcie i bazie.')
            return 0
        prepare(root, jdk, args.skip_build, args.replace)
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired, zipfile.BadZipFile) as error:
        print('ERROR:', error, file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
