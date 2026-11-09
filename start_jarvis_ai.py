#!/usr/bin/env python3
"""J.A.R.V.I.S. all-in-one Windows development launcher (stdlib only).

Start Docker PostgreSQL, private llama.cpp, Spring Boot, Angular and Electron.
Never prints secrets or sends the session token to a browser renderer.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DB_KEYS = ("JARVIS_DB_HOST", "JARVIS_DB_PORT", "JARVIS_DB_NAME", "JARVIS_DB_USER", "JARVIS_DB_PASSWORD")
CONTAINER = "backend-jarvis-postgres-1"


class LaunchError(RuntimeError):
    pass


def load_db_config(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise LaunchError(f"Brakuje pliku {path}. Nie zmieniaj hasla; uruchom poprzednia diagnostyke bazy.")
    config = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"([A-Z][A-Z0-9_]*)=(.*)", line)
        if not match:
            raise LaunchError("Nieprawidlowy format backend.env. Nie zmieniono pliku.")
        key, value = match.groups()
        if key not in DB_KEYS or key in config:
            raise LaunchError("Nieznany lub powtorzony klucz w backend.env.")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        config[key] = value
    if not config.get("JARVIS_DB_PASSWORD"):
        raise LaunchError("Brak JARVIS_DB_PASSWORD w backend.env. Nie podawaj hasla w czacie.")
    for key, default in {"JARVIS_DB_HOST":"127.0.0.1", "JARVIS_DB_PORT":"5433", "JARVIS_DB_NAME":"jarvis_db", "JARVIS_DB_USER":"jarvis"}.items():
        config.setdefault(key, default)
    if config["JARVIS_DB_HOST"] not in ("localhost", "127.0.0.1"):
        raise LaunchError("Backend musi laczyc sie z lokalnym PostgreSQL.")
    return config


def private_environment(base: dict[str, str], db: dict[str, str]) -> dict[str, str]:
    env = dict(base)
    # Old shell overrides must not silently trump the verified backend.env.
    for key in list(env):
        if key.upper().startswith("SPRING_DATASOURCE_") or key.upper().startswith("SPRING_FLYWAY_"):
            env.pop(key, None)
        elif key.upper() in (*DB_KEYS, "JARVIS_SESSION_TOKEN", "JARVIS_LLM_API_KEY", "LLAMA_API_KEY"):
            env.pop(key, None)
    env.update(db)
    env["JARVIS_SESSION_TOKEN"] = secrets.token_hex(32)
    key = secrets.token_hex(32)
    env["JARVIS_LLM_API_KEY"] = key
    env["LLAMA_API_KEY"] = key
    return env


def renderer_safe_environment(private_env: dict[str, str]) -> dict[str, str]:
    """Do not give DB or session credentials to Angular build/dev tooling."""
    safe = dict(private_env)
    for key in list(safe):
        if key.upper() in (*DB_KEYS, "JARVIS_SESSION_TOKEN", "JARVIS_LLM_API_KEY", "LLAMA_API_KEY"):
            safe.pop(key, None)
    return safe


def resolved_executable(root: Path) -> tuple[str, list[str]]:
    for path in (
        root / 'node_modules/electron/dist/electron.exe',
        root / 'desktop/node_modules/electron/dist/electron.exe',
        root / 'frontend/node_modules/electron/dist/electron.exe',
    ):
        if path.is_file():
            return str(path), [str(root / 'desktop/electron/main.cjs')]
    # npm exec --no: explicitly never download packages in this workflow.
    npm = shutil.which('npm.cmd')
    if npm:
        return npm, ['exec', '--no', '--', 'electron', str(root / 'desktop/electron/main.cjs')]
    raise LaunchError('Nie wykryto Electrona ani npm.cmd. Sprawdz lokalne zaleznosci projektu.')


def port_open(port: int) -> bool:
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.6):
            return True
    except OSError:
        return False


def request_code(url: str, *, token: str | None = None) -> int:
    headers = {'X-Jarvis-Session': token} if token else {}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except (OSError, TimeoutError):
        return 0


def wait_for(url: str, expected: int, process: subprocess.Popen, seconds: int, label: str, token: str | None = None) -> None:
    deadline = time.monotonic() + seconds
    last = 0
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise LaunchError(f'{label} zakonczyl prace (exit {process.returncode}). Sprawdz log ponizej.')
        last = request_code(url, token=token)
        if last == expected:
            print(f'OK: {label}')
            return
        if last in (401, 403) and label == 'Spring Boot / prywatne API':
            raise LaunchError(f'{label}: HTTP {last}, problem z tokenem sesji.')
        time.sleep(1)
    raise LaunchError(f'{label}: niegotowy po {seconds} s; ostatni HTTP {last}.')


def tail(path: Path, count: int = 22) -> None:
    if path.is_file():
        lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
        for line in lines[-count:]:
            # Never echo a possible token accidentally included in a log.
            line = re.sub(r'(?i)(Bearer\s+)[0-9a-f]{64}', r'\1[REDACTED]', line)
            line = re.sub(r'(?i)(JARVIS_DB_PASSWORD\s*[=:]\s*)\S+', r'\1[REDACTED]', line)
            print('  ' + line)


def stop_all(processes: list[subprocess.Popen]) -> None:
    for process in reversed(processes):
        if process.poll() is not None:
            continue
        try:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            else:
                process.terminate()
        except (OSError, subprocess.SubprocessError):
            pass
    # Deliberately leave Docker database running. Never delete any volume.


def main() -> int:
    parser = argparse.ArgumentParser(description='JARVIS: uruchom wszystko w oknie Electron bez instalowania Ollama')
    parser.add_argument('--check', action='store_true', help='Tylko sprawdz pliki, niczego nie uruchamiaj')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    if not (root / 'backend/pom.xml').is_file() or not (root / 'frontend/package.json').is_file():
        raise LaunchError('Umiesc start_jarvis_ai.py w katalogu glownym BawarJARVIS-.')
    if os.name != 'nt':
        raise LaunchError('Ten launcher jest przygotowany dla Windows 11.')
    appdata = os.environ.get('APPDATA')
    if not appdata:
        raise LaunchError('Brakuje zmiennej APPDATA na Windows.')
    db = load_db_config(Path(appdata) / 'J.A.R.V.I.S.' / 'backend.env')
    model = root / 'desktop/ai-runtime/models/Qwen3-8B-Q4_K_M.gguf'
    engine = root / 'desktop/ai-runtime/bin/llama-server.exe'
    for item in (model, engine, root / 'desktop/electron/main.cjs'):
        if not item.is_file():
            raise LaunchError(f'Brakuje: {item}. Sprawdz python tools/local-ai/prepare_assets.py --verify')
    exe, electron_args = resolved_executable(root)
    if args.check:
        print('OK: konfiguracja, model, llama-server i launcher Electron sa dostepne.')
        for port in (8765, 8080, 4200):
            print(f'Port {port}: ' + ('ZAJETY - zamknij poprzednie procesy' if port_open(port) else 'wolny'))
        return 0
    for port in (8765, 8080, 4200):
        if port_open(port):
            raise LaunchError(f'Port {port} jest zajety. Zatrzymaj poprzedni run_dev.ps1 / npm start / Electron przez Ctrl+C.')
    docker = shutil.which('docker.exe') or shutil.which('docker')
    mvn = root / 'backend/mvnw.cmd'
    npm = shutil.which('npm.cmd')
    if not docker or not npm or not mvn.is_file():
        raise LaunchError('Brakuje docker.exe, npm.cmd lub backend/mvnw.cmd na PATH.')
    print('[1/5] Uruchamiam istniejacy kontener PostgreSQL (bez zmian danych).')
    result = subprocess.run([docker, 'start', CONTAINER], capture_output=True, text=True)
    if result.returncode:
        raise LaunchError('Nie mozna uruchomic kontenera PostgreSQL. Sprawdz docker ps -a.')
    env = private_environment(os.environ, db)
    logdir = Path(appdata) / 'J.A.R.V.I.S.' / 'logs' / 'all-in-one-dev'
    logdir.mkdir(parents=True, exist_ok=True)
    logfile_handles = []
    processes = []
    current_log = None
    def start(name: str, cmd: list[str], cwd: Path, process_env: dict[str, str]) -> subprocess.Popen:
        nonlocal current_log
        path = logdir / f'{name}.log'
        current_log = path
        fh = path.open('w', encoding='utf-8')
        logfile_handles.append(fh)
        proc = subprocess.Popen(cmd, cwd=cwd, env=process_env, stdout=fh, stderr=subprocess.STDOUT)
        processes.append(proc)
        return proc
    try:
        public_env = renderer_safe_environment(env)
        print('[2/5] Uruchamiam Qwen3 8B na RTX 3080.')
        qwen = start('qwen', [str(engine), '--model', str(model), '--host', '127.0.0.1',
             '--port', '8765', '--ctx-size', '4096', '--n-gpu-layers', '99',
             '--parallel', '1', '--alias', 'jarvis-qwen3-8b', '--no-webui',
             '--sleep-idle-seconds', '300'], engine.parent, {**public_env, 'LLAMA_API_KEY': env['LLAMA_API_KEY']})
        wait_for('http://127.0.0.1:8765/health', 200, qwen, 240, 'Qwen')
        print('[3/5] Uruchamiam Spring Boot ze wspolnym prywatnym tokenem Electron.')
        spring = start('spring', [str(mvn), 'spring-boot:run'], root / 'backend', env)
        wait_for('http://127.0.0.1:8080/api/chats', 200, spring, 120,
                 'Spring Boot / prywatne API', env['JARVIS_SESSION_TOKEN'])
        print('[4/5] Uruchamiam Angular.')
        angular = start('angular', [npm, 'start', '--', '--host', '127.0.0.1', '--port', '4200'], root / 'frontend', public_env)
        wait_for('http://127.0.0.1:4200/', 200, angular, 120, 'Angular')
        print('[5/5] Otwieram okno Electron. NIE otwieraj czatu w zwyklej przegladarce.')
        electron = start('electron', [exe, *electron_args], root, {**public_env, 'JARVIS_SESSION_TOKEN': env['JARVIS_SESSION_TOKEN']})
        print('JARVIS wystartowal. Uzyj okna Electron. Ctrl+C zatrzyma procesy aplikacji.')
        print('Logi lokalne: ' + str(logdir))
        while True:
            if electron.poll() is not None:
                print('Okno Electron zamkniete.')
                return 0
            for proc, label in ((qwen, 'Qwen'), (spring, 'Spring'), (angular, 'Angular')):
                if proc.poll() is not None:
                    current_log = logdir / f'{label.lower()}.log'
                    raise LaunchError(f'Proces {label} zakonczyl prace (exit {proc.returncode}).')
            time.sleep(1)
    except KeyboardInterrupt:
        print('\nZatrzymuje Jarvisa...')
        return 0
    except LaunchError:
        if current_log:
            print('Fragment ostatniego logu:')
            tail(current_log)
        raise
    finally:
        stop_all(processes)
        for fh in logfile_handles:
            fh.close()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except LaunchError as error:
        print('BLAD: ' + str(error), file=sys.stderr)
        sys.exit(1)
