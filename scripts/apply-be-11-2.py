#!/usr/bin/env python3
"""Bezpiecznie dodaje zaleznosci Maven i konfiguracje bazy do istniejacego repo.
Uruchom w glownym katalogu projektu: python scripts/apply-be-11-2.py
"""
from pathlib import Path
import shutil
import sys

root = Path.cwd()
pom = root / "backend/pom.xml"
properties = root / "backend/src/main/resources/application.properties"
gitignore = root / ".gitignore"

if not pom.is_file() or not properties.is_file() or not (root / "frontend").exists():
    print("ERROR: Uruchom skrypt w katalogu glownym BawarJARVIS-/")
    sys.exit(1)

deps = [
    ("org.springframework.boot", "spring-boot-starter-jdbc", None),
    ("org.springframework.boot", "spring-boot-starter-flyway", None),
    ("org.flywaydb", "flyway-database-postgresql", None),
    ("org.postgresql", "postgresql", "runtime"),
    ("com.h2database", "h2", "test"),
]
original = pom.read_text(encoding="utf-8")
if "</dependencies>" not in original:
    raise SystemExit("ERROR: brak </dependencies> w backend/pom.xml")

# Nie nadpisuj istniejacego dependency; sprawdz go recznie, jesli ma zly scope.
addition = []
for group, artifact, scope in deps:
    if f"<artifactId>{artifact}</artifactId>" in original:
        print(f"POM: istnieje {artifact}; sprawdz recznie jego scope")
        continue
    fragment = ("        <dependency>\n"
                f"            <groupId>{group}</groupId>\n"
                f"            <artifactId>{artifact}</artifactId>\n"
                + (f"            <scope>{scope}</scope>\n" if scope else "")
                + "        </dependency>\n")
    addition.append(fragment)
new_pom = original.replace("</dependencies>", "".join(addition) + "    </dependencies>", 1)

addition_properties = {
    "spring.datasource.url": "jdbc:postgresql://${JARVIS_DB_HOST:127.0.0.1}:${JARVIS_DB_PORT:5433}/${JARVIS_DB_NAME:jarvis_db}",
    "spring.datasource.username": "${JARVIS_DB_USER:jarvis}",
    "spring.datasource.password": "${JARVIS_DB_PASSWORD}",
    "spring.flyway.enabled": "true",
    "spring.flyway.baseline-on-migrate": "false",
    "spring.sql.init.mode": "never",
}
old_props = properties.read_text(encoding="utf-8")
new_props = old_props
for key, value in addition_properties.items():
    if any(line.strip().startswith(key + "=") for line in new_props.splitlines()):
        print(f"PROPERTIES: istnieje {key}; nie zmieniam")
    else:
        new_props += f"\n{key}={value}"
new_props = new_props.rstrip() + "\n"

for path, old, new in ((pom, original, new_pom), (properties, old_props, new_props)):
    if old != new:
        shutil.copy2(path, path.with_name(path.name + ".be112.bak"))
        path.write_text(new, encoding="utf-8")
        print("OK:", path.relative_to(root))
    else:
        print("BEZ ZMIAN:", path.relative_to(root))

if gitignore.exists():
    original_ignore = gitignore.read_text(encoding="utf-8")
    ignores = ["backend/.env.jarvis", "*.be112.bak"]
    updated = original_ignore.rstrip() + "\n"
    for ignore in ignores:
        if ignore not in updated.splitlines():
            updated += ignore + "\n"
    if updated != original_ignore:
        shutil.copy2(gitignore, gitignore.with_name(gitignore.name + ".be112.bak"))
        gitignore.write_text(updated, encoding="utf-8")
        print("OK: .gitignore")
print("ZAKONCZONO. Sprawdz: git diff -- backend/pom.xml backend/src/main/resources/application.properties .gitignore")
