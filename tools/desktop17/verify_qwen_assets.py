#!/usr/bin/env python3
"""17.4: offline inventory and SHA256 verification of Qwen/llama.cpp assets.
No download, no database changes; resources stay in desktop/ai-runtime/.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

MANIFEST = 'stage17-4-manifest.json'
MODEL = 'Qwen3-8B-Q4_K_M.gguf'
MIN_MODEL_BYTES = 1_000_000_000


def fail(msg):
    raise ValueError('BLOCKED: ' + msg)


def no_links(root, p):
    base = root.resolve(strict=True)
    try:
        rel = p.relative_to(root)
    except ValueError:
        fail('ścieżka poza katalogiem zasobów')
    current = base
    for part in rel.parts:
        current = current / part
        if current.is_symlink(): fail('dowiązanie symboliczne w zasobach AI')


def entries(root):
    binary = root / 'bin' / 'llama-server.exe'
    model = root / 'models' / MODEL
    for p in (binary, model):
        no_links(root, p)
        if not p.is_file(): fail('brak wymaganego pliku: ' + str(p.relative_to(root)))
    # Prevent accidentally packaging a tiny HTML error page instead of the weights.
    if model.stat().st_size < MIN_MODEL_BYTES:
        fail('GGUF jest mniejszy niż 1 GB — możliwy niekompletny model')
    if model.open('rb').read(4) != b'GGUF': fail('plik modelu nie ma nagłówka GGUF')
    if binary.open('rb').read(2) != b'MZ': fail('llama-server.exe nie jest plikiem PE Windows')
    files = []
    for p in sorted((root / 'bin').rglob('*')):
        no_links(root, p)
        if p.is_file(): files.append(p)
    files.append(model)
    # DLL dependencies are kept alongside llama-server.exe (CUDA/CPU backends).
    if not files: fail('pusty katalog plików llama.cpp')
    return files


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def plan(root):
    files = entries(root)
    return [{'path': p.relative_to(root).as_posix(), 'size': p.stat().st_size, 'sha256': digest(p)} for p in files]


def run(args):
    raw = Path(args.assets)
    if raw.is_symlink(): fail('katalog zasobów AI jest symlinkiem')
    root = raw.resolve(strict=True)
    if not root.is_dir(): fail('brak katalogu zasobów AI')
    files = entries(root)
    print(f'CHECK_OK: {len(files)} plików AI, model GGUF i llama-server.exe')
    if args.check: return
    found = plan(root)
    if args.prepare:
        data = json.dumps({'schema': 'jarvis.ai17.4.v1', 'files': found}, ensure_ascii=False, indent=2).encode('utf-8') + b'\n'
        with tempfile.NamedTemporaryFile(dir=root, prefix='.jarvis-manifest-', delete=False) as f:
            f.write(data); f.flush(); os.fsync(f.fileno()); temp = Path(f.name)
        try: os.replace(temp, root / MANIFEST)
        finally: temp.unlink(missing_ok=True)
        print('PREPARE_OK: manifest SHA-256 zapisany bez pobierania danych')
    else:
        mf = root / MANIFEST
        no_links(root, mf)
        if not mf.is_file(): fail('brak manifestu; uruchom --prepare')
        recorded = json.loads(mf.read_text('utf-8'))
        if recorded.get('schema') != 'jarvis.ai17.4.v1' or recorded.get('files') != found:
            fail('rozbieżność plików AI lub SHA-256; nie buduj instalatora')
        print('VERIFY_OK: wszystkie pliki AI zgodne z manifestem SHA-256')


def main(argv=None):
    p = argparse.ArgumentParser(description='Weryfikacja zasobów Qwen 17.4')
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--prepare', action='store_true')
    mode.add_argument('--verify', action='store_true')
    p.add_argument('--assets', default='desktop/ai-runtime')
    args = p.parse_args(argv)
    try: run(args); return 0
    except (OSError, ValueError, json.JSONDecodeError) as e:
        print(e if str(e).startswith('BLOCKED') else f'BLOCKED: {type(e).__name__}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
