#!/usr/bin/env python3
"""J.A.R.V.I.S. M01: read-only inventory + optional conservative quarantine.
Run from repo root: python docs/modernization/m01_inventory.py --root .
This script NEVER deletes files; --quarantine requires explicit paths in --paths-file.
"""
import argparse
import csv
import hashlib
import os
from pathlib import Path
import shutil
import sys

BACKUP_MARKERS = ('.bak', '.backup', '.orig')
GENERATED = {'dist', 'target', '.angular', 'test-results', 'coverage', 'out-tsc', 'node_modules', 'playwright-report'}
EXCLUDED = {'.git', '.jarvis-m01-quarantine'}

def is_backup(name):
    low = name.lower()
    return any(low.endswith(marker) or marker + '.' in low or marker + '-' in low for marker in BACKUP_MARKERS)

def sha256(path):
    dig = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            dig.update(chunk)
    return dig.hexdigest()

def inventory(root):
    result = []
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED]
        for name in files:
            if not is_backup(name):
                continue
            p = Path(current) / name
            rel = p.relative_to(root)
            generated = bool(set(rel.parts) & GENERATED)
            classification = 'generated-artifact' if generated else 'source-backup-review'
            result.append((rel.as_posix(), classification, p.stat().st_size, sha256(p)))
    return sorted(result)

def inside(root, rel):
    if rel.is_absolute() or '..' in rel.parts or not rel.parts:
        raise ValueError(f'Invalid relative path: {rel}')
    path = root / rel
    if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root):
        raise ValueError(f'Not a regular file inside root: {rel}')
    return path

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root', type=Path, required=True)
    ap.add_argument('--report', type=Path, default=Path('m01-candidates.csv'))
    ap.add_argument('--quarantine', action='store_true', help='Move only paths explicitly listed in --paths-file into quarantine')
    ap.add_argument('--paths-file', type=Path, help='UTF-8 file with one approved relative path per line')
    args = ap.parse_args()
    root = args.root.expanduser().resolve()
    if not root.is_dir():
        ap.error('root must be a directory')
    rows = inventory(root)
    report = args.report.resolve()
    with report.open('w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['relative_path', 'category', 'bytes', 'sha256'])
        writer.writerows(rows)
    print(f'Inventory: {len(rows)} backup-like files ({sum(r[1] == "source-backup-review" for r in rows)} source; {sum(r[1] == "generated-artifact" for r in rows)} generated).')
    print(f'CSV: {report}')
    if not args.quarantine:
        print('DRY RUN: no files modified.')
        return
    if not args.paths_file:
        ap.error('--quarantine requires --paths-file')
    approved = [line.strip() for line in args.paths_file.read_text(encoding='utf-8').splitlines() if line.strip() and not line.lstrip().startswith('#')]
    candidates = {r[0]: r for r in rows}
    approved = list(dict.fromkeys(approved))
    for item in approved:
        if item not in candidates:
            raise ValueError(f'Not a candidate: {item}')
        inside(root, Path(item))
    # No partial move on validation errors; no overwrite, no delete.
    for item in approved:
        dest = root / '.jarvis-m01-quarantine' / item
        if dest.exists():
            raise FileExistsError(f'Quarantine destination already exists: {dest}')
    for item in approved:
        src = inside(root, Path(item))
        dest = root / '.jarvis-m01-quarantine' / item
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        print(f'QUARANTINED: {item}')
    print('Files moved into .jarvis-m01-quarantine; restore by moving back to original paths.')

if __name__ == '__main__':
    main()
