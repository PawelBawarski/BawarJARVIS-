# J.A.R.V.I.S. – naprawa PostgreSQL `SQLSTATE 28P01`

## Co wykryto

`run_dev.ps1` uruchamia Qwen, następnie Spring Boot. Start Spring Boot zatrzymuje się na `FATAL: password authentication failed for user "jarvis"`. Nie jest to błąd CUDA lub modelu.

Wcześniejsza poprawka wczytuje `%APPDATA%\J.A.R.V.I.S.\backend.env`, ale nie nadpisuje istniejących zmiennych `JARVIS_DB_*` pochodzących z procesu. Mogą one zawierać stare hasło. Ponadto w Spring Boot zmienne `SPRING_DATASOURCE_*` mogą mieć pierwszeństwo względem wartości w `application.properties`.

## Instalacja (Git Bash, katalog `BawarJARVIS-`)

1. Pobierz `JARVIS_DB_28P01_FIX.zip` do głównego katalogu repozytorium.
2. Wykonaj:

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
python -m zipfile -e JARVIS_DB_28P01_FIX.zip _jarvis_db_28p01
python _jarvis_db_28p01/napraw_jarvis_db_28p01.py --check
```

Jeśli wynik zawiera `CHECK OK`, wykonaj:

```bash
python _jarvis_db_28p01/napraw_jarvis_db_28p01.py
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/local-ai/run_dev.ps1
```

Skrypt tworzy kopię pliku `tools/local-ai/run_dev.ps1.before-28p01-fix.bak`. Modyfikuje tylko `tools/local-ai/run_dev.ps1`. W trakcie uruchomienia wczytuje z lokalnego prywatnego pliku ustawienia bazy i wymusza w procesie Spring Boot `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` i `SPRING_DATASOURCE_PASSWORD`, aby odziedziczone stare ustawienia nie miały pierwszeństwa.

## Gdy sprawdzanie zgłasza nieprawidłowe hasło

Jeśli `--check` wyświetli `The password stored in backend.env does NOT authenticate ...`, napraw rzeczywiste hasło w bazie przez skrypt odzyskiwania (przed resetem upewnij się, że nie działają inne aplikacje potrzebujące tego konta):

```bash
python _jarvis_db_28p01/napraw_jarvis_db_credentials.py --reset
python _jarvis_db_28p01/napraw_jarvis_db_28p01.py --check
python _jarvis_db_28p01/napraw_jarvis_db_28p01.py
```

Reset zmienia wyłącznie hasło roli `jarvis` i zapisuje nową konfigurację poza repozytorium. **Nie usuwa wolumenu, tabel ani historii rozmów**, ale inne procesy używające starego hasła wymagają aktualizacji. Jeśli reset nie powiedzie się, zachowaj komunikat błędu (bez sekretów) i nie modyfikuj `pg_hba.conf` na ślepo.

Jeżeli `--check` zgłasza niezgodność publikowanego portu, NIE uruchamiaj resetu tylko po to, by „naprawić” port. Najpierw sprawdź mapowanie Dockera.

## Cofnięcie

```bash
python _jarvis_db_28p01/napraw_jarvis_db_28p01.py --rollback
```

## Testy lokalne (nie wymagają Dockera)

```bash
python _jarvis_db_28p01/tests/test_jarvis_db_28p01.py
```

Sześć testów offline sprawdza instalację, ponowne wykonanie, cofnięcie, odmowę nadpisania zmodyfikowanego pliku, parser danych prywatnych i brak sekretów w argumentach procesu. **Nie zastępuje to testu na rzeczywistej bazie użytkownika**.

## Bezpieczeństwo

- Nie wysyłaj nikomu `%APPDATA%\J.A.R.V.I.S.\backend.env`.
- Nie publikuj kopii tego pliku ani wyników poleceń wyświetlających hasło.
- Nie wykonuj `docker compose down -v` ani `docker volume rm`.
- Żadne hasło nie jest zapisane w skrypcie naprawczym.
