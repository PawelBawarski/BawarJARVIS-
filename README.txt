J.A.R.V.I.S. — naprawa hasla bazy bez usuwania danych

Problem:
run_dev.ps1 wymaga hasla JARVIS_DB_PASSWORD, lecz plik
%APPDATA%\J.A.R.V.I.S.\backend.env nie istnieje.

1. Skopiuj napraw_jarvis_db_credentials.py do katalogu BawarJARVIS-
2. Uruchom w Git Bash:
   cd ~/Desktop/Nauka/BawarJARVIS-
   python napraw_jarvis_db_credentials.py

Skrypt odczytuje lokalna konfiguracje dzialajacego kontenera Docker,
sprawdza haslo w PostgreSQL i tworzy katalog oraz backend.env.
Nie wypisuje hasla, nie usuwa danych, nie modyfikuje repozytorium.

Jesli skrypt napisze, ze haslo z konfiguracji kontenera nie dziala:
   python napraw_jarvis_db_credentials.py --reset

--reset losuje nowe haslo, zmienia je dla roli jarvis i zapisuje w backend.env.
Dane PostgreSQL i historia rozmow pozostaja na dysku. Jesli stary
start_jarvis_dev.sh korzysta z innej prywatnej konfiguracji, trzeba
zaktualizowac ja do nowego hasla. Nie publikuj backend.env.

Uruchom ponownie:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/local-ai/run_dev.ps1

Przydatne sprawdzenie bez pokazywania hasla:
   powershell.exe -NoProfile -Command 'Test-Path (Join-Path $env:APPDATA "J.A.R.V.I.S.\backend.env")'

Oczekiwane: True.

Brak mozliwosci zmiany hasla przez lokalne psql jest bezpiecznie
zglaszany; skrypt nie zmienia pg_hba.conf, nie usuwa wolumenow i nie
wykonuje docker compose down -v.
