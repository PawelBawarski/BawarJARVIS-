#!/usr/bin/env python3
"""Manual 16.5 dependency image preparation. Network may be used ONLY during explicitly requested docker build."""
from __future__ import annotations
import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

FE_DOCKERFILE = '''FROM node:22-alpine
WORKDIR /opt/fe
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
RUN test -x /opt/fe/node_modules/.bin/ng
'''
BE_DOCKERFILE = '''FROM maven:3.9.13-eclipse-temurin-21
WORKDIR /opt/prep
COPY pom.xml ./
RUN mvn -B -q -DskipTests dependency:go-offline
RUN mkdir -p /opt/m2 && cp -a /root/.m2/repository/. /opt/m2/
'''

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frontend', action='store_true')
    parser.add_argument('--backend', action='store_true')
    args = parser.parse_args()
    if not args.frontend and not args.backend:
        parser.error('Wybierz --frontend albo --backend. Obrazy przygotowywane są osobno.')
    root = Path.cwd().resolve()
    if not (root/'frontend/package-lock.json').is_file() or not (root/'backend/pom.xml').is_file():
        parser.error('Uruchom skrypt z katalogu BawarJARVIS-.')
    tasks = []
    if args.frontend:
        tasks.append(('frontend', 'jarvis-test-frontend:16.5', FE_DOCKERFILE,
                     ('frontend/package.json','frontend/package-lock.json')))
    if args.backend:
        tasks.append(('backend', 'jarvis-test-backend:16.5', BE_DOCKERFILE, ('backend/pom.xml',)))
    for name, image, dockerfile, rels in tasks:
        with tempfile.TemporaryDirectory(prefix=f'jarvis-image-{name}-') as tmp:
            work = Path(tmp)
            (work/'Dockerfile').write_text(dockerfile, encoding='utf-8')
            for rel in rels:
                src = root/rel
                if src.is_symlink() or src.stat().st_size > 1024*1024:
                    raise ValueError(f'Nieprawidłowy plik wejściowy: {rel}')
                shutil.copyfile(src, work/src.name)
            print(f'Budowanie {image}. UWAGA: docker build może pobierać zależności z internetu.', flush=True)
            result = subprocess.run(['docker','build','--pull=false','-t',image,str(work)], check=False)
            if result.returncode:
                print(f'ERROR: {image} nie został zbudowany (kod {result.returncode}).',file=sys.stderr)
                return result.returncode
    print('DONE: przygotowano obrazy. Późniejsze uruchomienia testów są offline.')
    return 0
if __name__ == '__main__':
    raise SystemExit(main())
