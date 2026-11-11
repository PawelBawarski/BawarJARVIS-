#!/usr/bin/env python3
"""J.A.R.V.I.S. 17.3: PostgreSQL 17 Windows, no Docker after migration.

Commands are deliberately separated. --stage copies verified server binaries from a
user-provided distribution. --init creates a NEW cluster; --migrate uses a read-only
Docker pg_dump and restores into that EMPTY cluster; --activate switches backend.env.
NO DROP/DELETE of the Docker cluster; no network downloads or automatic DB cutover.
"""
from __future__ import annotations
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import uuid

PORT = 55432
DB_NAME = 'jarvis_db'
DB_USER = 'jarvis'
SCHEMA = 'jarvis.postgres17.v1'
BINS = ('postgres.exe', 'pg_ctl.exe', 'initdb.exe', 'pg_dump.exe',
        'pg_restore.exe', 'psql.exe', 'createdb.exe')
EXCLUDED = {'pg_stat_statements', 'pg_buffercache'}
IDENTIFIER = re.compile(r'^[a-z_][a-z0-9_]*$')
CONTAINER = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$')


def root_path(root: Path) -> Path:
    root = root.resolve(strict=True)
    if not (root / 'backend' / 'pom.xml').is_file() or not (root / 'desktop' / 'electron').is_dir():
        raise ValueError('Nie rozpoznaję katalogu BawarJARVIS-.')
    return root


def state_base(env: dict, override: Path | None = None) -> Path:
    if override is not None:
        return override.resolve()
    if not env.get('APPDATA'):
        raise ValueError('Brak APPDATA; ten etap jest przeznaczony dla Windows.')
    return Path(env['APPDATA']) / 'JarvisData'


def safe_tree(path: Path) -> None:
    path = path.absolute()
    for ancestor in (path, *path.parents):
        if ancestor.is_symlink():
            raise ValueError(f'Symlink poza bezpieczną ścieżką PostgreSQL: {ancestor}')


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def atomic_bytes(path: Path, data: bytes, *, private: bool = False):
    safe_tree(path.parent)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix='.jarvis17-3-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as file:
            os.chmod(temp, 0o600)
            file.write(data)
            file.flush()
            os.fsync(file.fileno())
        if private:
            secure_acl(Path(temp), is_dir=False)
        os.replace(temp, path)
        if private:
            secure_acl(path, is_dir=False)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def write_state(base: Path, state: dict):
    atomic_bytes(base / 'postgres17' / 'state.json',
                 (json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode('utf-8'), private=True)


def read_state(base: Path) -> dict:
    f = base / 'postgres17' / 'state.json'
    if not f.is_file():
        raise ValueError('Nie ma klastra PostgreSQL 17. Uruchom najpierw --init.')
    state = json.loads(f.read_text('utf-8'))
    if (state.get('schema') != SCHEMA or state.get('port') != PORT or
        state.get('database') != DB_NAME or state.get('major') != 17):
        raise ValueError('Nieobsługiwany manifest klastra PostgreSQL; nie modyfikuję go.')
    return state


def current_sid() -> str:
    result = subprocess.run(['whoami', '/user', '/fo', 'csv', '/nh'],
                            capture_output=True, text=True, check=True, timeout=10)
    row = next(csv.reader(result.stdout.splitlines()))
    sid = row[-1].strip()
    if not re.fullmatch(r'S-1-(?:\d+-){2,}\d+', sid):
        raise ValueError('Nie można ustalić SID konta Windows.')
    return sid


def secure_acl(path: Path, is_dir: bool = False):
    """Windows ACL: ONLY current user can access a private credential/data path."""
    if sys.platform != 'win32':
        return  # Unit tests on Unix; production CLI denies non-Windows operations.
    sid = current_sid()
    grant = f'*{sid}:(OI)(CI)F' if is_dir else f'*{sid}:F'
    subprocess.run(['icacls', str(path), '/inheritance:r', '/grant:r', grant],
                   check=True, capture_output=True, timeout=25)


def require_windows():
    if sys.platform != 'win32':
        raise ValueError('Operacja wymaga Windows. Weryfikację --check można uruchomić na innym systemie.')


def binaries(home: Path) -> dict[str, Path]:
    safe_tree(home)
    if not home.is_dir() or not (home / 'share' / 'postgres.bki').is_file():
        raise ValueError('Brakuje share/postgres.bki: wskaż główny katalog PostgreSQL 17, nie sam folder bin.')
    paths = {name: home / 'bin' / name for name in BINS}
    for name, file in paths.items():
        safe_tree(file)
        if not file.is_file():
            raise ValueError(f'Nie znaleziono bin/{name}.')
    return paths


def command(argv: list[str | Path], *, env: dict | None = None, timeout=120, capture=True):
    args = [str(x) for x in argv]
    result = subprocess.run(args, env=env, stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.PIPE if capture else None, timeout=timeout)
    if result.returncode:
        # Never print stderr: native PostgreSQL utilities may echo connection strings.
        raise ValueError(f'Komenda {Path(args[0]).name} nie powiodła się (exit {result.returncode}).')
    return result.stdout or b''


def validate_version(home: Path):
    paths = binaries(home)
    version = command([paths['postgres.exe'], '--version'], timeout=15).decode('ascii', 'replace')
    if not re.search(r'\b17\.\d+\b', version):
        raise ValueError('Wymagany PostgreSQL 17.x, nie inna główna wersja.')
    return version.strip()


def stage(root: Path, source: Path):
    require_windows()
    source = source.resolve(strict=True)
    target = root / 'desktop' / 'resources' / 'postgres'
    if target.exists():
        raise ValueError(f'Katalog już istnieje: {target}; nie nadpisuję binariów.')
    if source == target or target.is_relative_to(source):
        raise ValueError('Źródło PostgreSQL nie może zawierać katalogu docelowego.')
    version = validate_version(source)
    with tempfile.TemporaryDirectory(prefix='jarvis17-3-pg-', dir=target.parent) as tmp:
        staged = Path(tmp) / 'postgres'
        staged.mkdir()
        for folder in ('bin', 'lib', 'share'):
            current = source / folder
            if current.exists():
                shutil.copytree(current, staged / folder, symlinks=False)
        for name in ('COPYRIGHT', 'LICENSE', 'copyright', 'license.txt'):
            if (source / name).is_file():
                shutil.copy2(source / name, staged / name)
        validate_version(staged)
        atomic_bytes(staged / 'stage17-3-manifest.json', json.dumps({
            'schema': 'jarvis.pg.binaries.v1', 'version': version,
            'postgres_sha256': sha256(staged / 'bin' / 'postgres.exe'),
            'initdb_sha256': sha256(staged / 'bin' / 'initdb.exe'),
        }, indent=2).encode('utf-8'))
        os.rename(staged, target)
    print('STAGE_OK: desktop/resources/postgres — PostgreSQL 17 Windows, bez instalacji usługi systemowej.')


def verify_stage(root: Path):
    home = root / 'desktop' / 'resources' / 'postgres'
    version = validate_version(home)
    manifest = json.loads((home / 'stage17-3-manifest.json').read_text('utf-8'))
    if (manifest.get('schema') != 'jarvis.pg.binaries.v1' or
        sha256(home / 'bin' / 'postgres.exe') != manifest.get('postgres_sha256')):
        raise ValueError('Integralność binariów PostgreSQL nie zgadza się z manifestem.')
    return home, version


def port_free(host='127.0.0.1', port=PORT):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex((host, port)) != 0


def restricted_env(password: str) -> dict:
    # PGPASSWORD only in child env, never command line or logs.
    env = os.environ.copy()
    env['PGPASSWORD'] = password
    env['PGHOST'] = '127.0.0.1'
    env['PGPORT'] = str(PORT)
    env['PGUSER'] = DB_USER
    env.pop('PGSERVICE', None)
    env.pop('PGSERVICEFILE', None)
    return env


def pg_start(home: Path, base: Path):
    if not port_free():
        raise ValueError(f'Port {PORT} jest zajęty. Nie przejmuję obcego serwera PostgreSQL.')
    paths = binaries(home)
    datadir = base / 'postgres17' / 'data'
    command([paths['pg_ctl.exe'], '-D', datadir, '-l', base / 'postgres17' / 'postgres.log',
             '-w', '-t', '90', 'start'], timeout=105)


def pg_stop(home: Path, base: Path):
    paths = binaries(home)
    command([paths['pg_ctl.exe'], '-D', base / 'postgres17' / 'data',
             '-m', 'fast', '-w', '-t', '40', 'stop'], timeout=50)


def init(root: Path, base: Path):
    require_windows()
    home, version = verify_stage(root)
    state_dir = base / 'postgres17'
    data = state_dir / 'data'
    if state_dir.exists():
        raise ValueError('Katalog danych PostgreSQL już istnieje. Nie wykonuję ponownej inicjalizacji.')
    if not port_free():
        raise ValueError(f'Port {PORT} jest zajęty — przed init zamknij inną instancję.')
    safe_tree(base)
    base.mkdir(parents=True, exist_ok=True)
    secure_acl(base, is_dir=True)
    state_dir.mkdir(mode=0o700)
    secure_acl(state_dir, is_dir=True)
    password = secrets.token_urlsafe(42)
    paths = binaries(home)
    try:
        fd, pwpath = tempfile.mkstemp(dir=state_dir, prefix='.initdb-secret-')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write(password + '\n')
            os.chmod(pwpath, 0o600)
            secure_acl(Path(pwpath))
            command([paths['initdb.exe'], '-D', data, '-U', DB_USER, '--encoding=UTF8',
                     '--auth-host=scram-sha-256', '--auth-local=scram-sha-256',
                     '--pwfile', pwpath], timeout=180)
        finally:
            Path(pwpath).unlink(missing_ok=True)
        # initdb inherits ACL from state_dir. Restrict to loopback and fixed dedicated port.
        conf = data / 'postgresql.conf'
        with conf.open('a', encoding='utf-8') as file:
            file.write("\n# JARVIS managed only; 17.3\nlisten_addresses = '127.0.0.1'\n")
            file.write(f'port = {PORT}\npassword_encryption = \'scram-sha-256\'\n')
        (data / 'pg_hba.conf').write_text(
            '# JARVIS 17.3: restricted loopback and SCRAM only\n'
            'host all all 127.0.0.1/32 scram-sha-256\n', encoding='utf-8')
        atomic_bytes(state_dir / 'credentials.json', json.dumps({
            'schema': 'jarvis.postgres17.credentials.v1', 'password': password,
        }).encode('utf-8'), private=True)
        state = {'schema': SCHEMA, 'major': 17, 'port': PORT, 'database': DB_NAME,
                 'migrated': False, 'activated': False, 'version': version,
                 'createdAt': datetime.now(timezone.utc).isoformat()}
        write_state(base, state)
        pg_start(home, base)
        try:
            command([paths['createdb.exe'], '-h', '127.0.0.1', '-p', str(PORT), '-U', DB_USER,
                     DB_NAME], env=restricted_env(password), timeout=30)
        finally:
            pg_stop(home, base)
    except Exception:
        print('INIT_FAILED: sprawdź prywatny katalog postgres17. Nie usuwam go automatycznie.', file=sys.stderr)
        raise
    print('INIT_OK: nowy prywatny klaster, 127.0.0.1:55432, baza jarvis_db (pusta).')


def verify_backup(base: Path, state: dict):
    name = state.get('dumpFile', '')
    digest = state.get('dumpSha256', '')
    if not re.fullmatch(r'[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}\.dump', name) or not re.fullmatch(r'[a-f0-9]{64}', digest):
        raise ValueError('Brak prawidłowego manifestu migracji i backupu.')
    file = base / 'postgres17' / 'backups' / name
    safe_tree(file)
    if not file.is_file() or sha256(file) != digest:
        raise ValueError('Backup źródłowej bazy został utracony lub zmodyfikowany; odmawiam aktywacji.')


def password_for(base: Path) -> str:
    path = base / 'postgres17' / 'credentials.json'
    safe_tree(path)
    info = json.loads(path.read_text('utf-8'))
    if info.get('schema') != 'jarvis.postgres17.credentials.v1' or not info.get('password'):
        raise ValueError('Nieprawidłowy plik prywatnych danych uwierzytelniających.')
    return info['password']


def psql(home: Path, base: Path, sql: str) -> str:
    return command([home / 'bin' / 'psql.exe', '-X', '-w', '-q', '-A', '-t',
                    '-h', '127.0.0.1', '-p', str(PORT), '-U', DB_USER,
                    '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-c', sql],
                   env=restricted_env(password_for(base)), timeout=120).decode('utf-8').strip()


def source_psql(container: str, sql: str) -> str:
    return command(['docker', 'exec', container, 'psql', '-X', '-q', '-A', '-t',
                    '-v', 'ON_ERROR_STOP=1', '-U', DB_USER, '-d', DB_NAME, '-c', sql],
                   timeout=120).decode('utf-8').strip()


def table_counts(query) -> dict:
    sql = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    result = query(sql)
    names = result.splitlines() if result else []
    if not names:
        raise ValueError('Brak tabel w źródłowej bazie; migracja nie jest bezpieczna.')
    counts = {}
    for table in names:
        if not IDENTIFIER.fullmatch(table):
            raise ValueError('Nietypowa nazwa tabeli — wymagana osobna kontrola migracji.')
        count = query(f'SELECT count(*) FROM public."{table}"')
        if not count.isdecimal():
            raise ValueError(f'Nieprawidłowy licznik tabeli: {table}.')
        counts[table] = int(count)
    return counts


def migrate(root: Path, base: Path, container: str):
    require_windows()
    if not CONTAINER.fullmatch(container):
        raise ValueError('Niedozwolona nazwa kontenera Docker.')
    home, _ = verify_stage(root)
    state = read_state(base)
    if state['migrated'] or state['activated']:
        raise ValueError('Migracja już zarejestrowana. Nie importuję ponownie danych.')
    if not port_free():
        raise ValueError('Port PostgreSQL 55432 jest zajęty — zatrzymaj Jarvisa i inne serwery.')
    # Source is NEVER altered. Docker exec only runs SELECT and pg_dump.
    remote_version = command(['docker', 'exec', container, 'pg_dump', '--version'], timeout=15).decode('utf-8', 'replace')
    if not re.search(r'\b17\.\d+\b', remote_version):
        raise ValueError('Źródłowy pg_dump musi mieć główną wersję 17.')
    src_counts = table_counts(lambda query: source_psql(container, query))
    backup_dir = base / 'postgres17' / 'backups'
    backup_dir.mkdir(exist_ok=True, parents=True)
    secure_acl(backup_dir, is_dir=True)
    dump = backup_dir / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8] + '.dump')
    safe_tree(dump)
    # Stream bytes directly; never put backup in source repository or shell pipeline.
    with dump.open('xb') as file:
        os.chmod(dump, 0o600)
        secure_acl(dump)
        with subprocess.Popen(['docker', 'exec', container, 'pg_dump', '-U', DB_USER,
                               '-d', DB_NAME, '-Fc'], stdout=file, stderr=subprocess.DEVNULL) as proc:
            try:
                code = proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill(); proc.wait()
                raise ValueError('Timeout pg_dump; istniejący backup pozostaje do diagnostyki.')
        file.flush()
        os.fsync(file.fileno())
    if code != 0 or dump.stat().st_size < 100:
        raise ValueError('Backup pg_dump nie został poprawnie utworzony. Nie importuję danych.')
    command([home / 'bin' / 'pg_restore.exe', '--list', dump], timeout=40)
    pg_start(home, base)
    try:
        empty = psql(home, base, "SELECT count(*) FROM pg_tables WHERE schemaname='public'")
        if empty != '0':
            raise ValueError('Docelowa baza nie jest pusta. Nie wykonuję importu nad istniejącymi danymi.')
        command([home / 'bin' / 'pg_restore.exe', '--no-owner', '--no-acl', '--single-transaction',
                 '--exit-on-error', '-h', '127.0.0.1', '-p', str(PORT), '-U', DB_USER,
                 '-d', DB_NAME, dump], env=restricted_env(password_for(base)), timeout=600)
        dst_counts = table_counts(lambda query: psql(home, base, query))
        if src_counts != dst_counts:
            raise ValueError('Po imporcie liczby rekordów są różne. Nie aktywuję lokalnej bazy.')
        if 'flyway_schema_history' not in dst_counts:
            raise ValueError('Brak historii Flyway po migracji.')
        flyway_fail = psql(home, base, 'SELECT count(*) FROM public.flyway_schema_history WHERE success = false')
        if flyway_fail != '0':
            raise ValueError('W lokalnej bazie istnieją nieudane migracje Flyway.')
        state.update({'migrated': True, 'dumpFile': dump.name, 'dumpSha256': sha256(dump),
                      'tableCounts': dst_counts, 'migratedAt': datetime.now(timezone.utc).isoformat()})
        write_state(base, state)
    finally:
        pg_stop(home, base)
    print(f'MIGRATE_OK: zweryfikowano {len(src_counts)} tabel; backup zachowany: {dump}')
    print('Docker PostgreSQL i jego wolumen pozostawiono bez zmian.')


def activate(root: Path, base: Path):
    require_windows()
    home, _ = verify_stage(root)
    state = read_state(base)
    if not state.get('migrated') or state.get('activated'):
        raise ValueError('Aktywacja wymaga zweryfikowanej migracji i nie może być powtórzona.')
    verify_backup(base, state)
    envfile = base / 'backend.env'
    if not envfile.is_file():
        raise ValueError('Brak starego backend.env — nie aktywuję automatycznie.')
    safe_tree(envfile)
    original = envfile.read_bytes()
    # Fail closed rather than overwrite an unknown env format/extra settings.
    keys = {}
    for line in original.decode('utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = re.fullmatch(r'(JARVIS_DB_[A-Z_]+)=(.*)', line)
        if not m or m[1] not in {'JARVIS_DB_HOST', 'JARVIS_DB_PORT', 'JARVIS_DB_NAME',
                                'JARVIS_DB_USER', 'JARVIS_DB_PASSWORD'}:
            raise ValueError('Nieznany wpis backend.env; wymagany przegląd ręczny, nie nadpisuję.')
        if m[1] in keys:
            raise ValueError('Zduplikowany klucz backend.env.')
        keys[m[1]] = m[2]
    if not keys.get('JARVIS_DB_PASSWORD'):
        raise ValueError('Stara konfiguracja backend.env nie ma hasła, przerwano.')
    # Before cutover, re-verify counts, not just a stale manifest.
    if not port_free():
        raise ValueError('Port lokalnej bazy zajęty; zamknij Jarvisa i ponów.')
    pg_start(home, base)
    try:
        actual = table_counts(lambda sql: psql(home, base, sql))
        if actual != state.get('tableCounts'):
            raise ValueError('Lokalna baza zmieniła się od migracji. Nie przełączam aplikacji.')
    finally:
        pg_stop(home, base)
    backup_dir = base / 'postgres17' / 'backups'
    backup_file = backup_dir / f'backend-env-before-cutover-{uuid.uuid4().hex}.bak'
    atomic_bytes(backup_file, original, private=True)
    new = ('# J.A.R.V.I.S. 17.3 — lokalna baza PostgreSQL Windows.\n'
           'JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=55432\n'
           'JARVIS_DB_NAME=jarvis_db\nJARVIS_DB_USER=jarvis\n'
           f'JARVIS_DB_PASSWORD={password_for(base)}\n').encode('utf-8')
    atomic_bytes(envfile, new, private=True)
    state.update({'activated': True, 'activatedAt': datetime.now(timezone.utc).isoformat(),
                  'backendEnvBackup': backup_file.name, 'backendEnvSha256': sha256(envfile)})
    try:
        write_state(base, state)
    except Exception:
        atomic_bytes(envfile, original, private=True)
        raise
    print('ACTIVATE_OK: backend.env wskazuje lokalną bazę 127.0.0.1:55432.')
    print('Stary Docker PostgreSQL pozostawiony bez zmian. Kopia starej konfiguracji zabezpieczona.')


def verify(root: Path, base: Path):
    require_windows()
    home, _ = verify_stage(root)
    state = read_state(base)
    if not state.get('migrated'):
        raise ValueError('Brak zakończonej migracji; nie można potwierdzić danych.')
    verify_backup(base, state)
    if not port_free():
        raise ValueError('Port 55432 jest już zajęty. Zamknij wcześniej lokalną bazę.')
    pg_start(home, base)
    try:
        actual = table_counts(lambda sql: psql(home, base, sql))
        if actual != state.get('tableCounts'):
            raise ValueError('Nie zgadzają się liczby rekordów. Migracja wymaga ręcznej analizy.')
        if psql(home, base, 'SELECT count(*) FROM public.flyway_schema_history WHERE success = false') != '0':
            raise ValueError('Wykryto nieudaną migrację Flyway.')
    finally:
        pg_stop(home, base)
    print(f'VERIFY_OK: {len(actual)} tabel, zgodne liczniki i historia Flyway.')


def start_manual(root: Path, base: Path):
    require_windows()
    home, _ = verify_stage(root)
    read_state(base)
    pg_start(home, base)
    print('START_OK: lokalny PostgreSQL 17 na 127.0.0.1:55432; nie uruchamiam Spring Boot.')


def stop_manual(root: Path, base: Path):
    require_windows()
    home, _ = verify_stage(root)
    read_state(base)
    pg_stop(home, base)
    print('STOP_OK: zamknięto wyłącznie zarządzany klaster PostgreSQL Jarvisa.')


def status(root: Path, base: Path):
    try:
        home, version = verify_stage(root)
        print(f'PG_BINARIES: OK ({version}) — {home}')
    except (ValueError, OSError, FileNotFoundError) as error:
        print('PG_BINARIES: BRAK/PROBLEM —', error)
    try:
        state = read_state(base)
        print('PG_CLUSTER:', 'MIGRATED' if state['migrated'] else 'INITIALIZED',
              '| ACTIVATED' if state['activated'] else '| NOT_ACTIVATED')
    except (ValueError, OSError, FileNotFoundError) as error:
        print('PG_CLUSTER: BRAK —', error)
    print('Docker: bez zmian. Dane przechowujemy w:', base / 'postgres17')


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='Jarvis 17.3 — lokalny PostgreSQL Windows')
    actions = ap.add_mutually_exclusive_group(required=True)
    for opt in ('check', 'stage', 'init', 'migrate', 'verify', 'activate', 'start', 'stop', 'status'):
        actions.add_argument(f'--{opt}', action='store_true')
    ap.add_argument('--root', type=Path, default=Path.cwd())
    ap.add_argument('--pg-home', type=Path, help='Rozpakowana binarna dystrybucja PostgreSQL 17 Windows')
    ap.add_argument('--container', default='backend-jarvis-postgres-1', help='Nazwa istniejącego kontenera PostgreSQL')
    ap.add_argument('--state-base', type=Path, help='Katalog danych aplikacji; domyślnie APPDATA/JarvisData')
    args = ap.parse_args(argv)
    try:
        root = root_path(args.root)
        base = state_base(os.environ, args.state_base)
        if args.check or args.status:
            status(root, base)
        elif args.stage:
            if not args.pg_home:
                raise ValueError('Do --stage podaj --pg-home z rozpakowanym PostgreSQL 17.')
            stage(root, args.pg_home)
        elif args.init:
            init(root, base)
        elif args.migrate:
            migrate(root, base, args.container)
        elif args.verify:
            verify(root, base)
        elif args.start:
            start_manual(root, base)
        elif args.stop:
            stop_manual(root, base)
        elif args.activate:
            activate(root, base)
        return 0
    except (OSError, ValueError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        print('BLOCKED:', str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
