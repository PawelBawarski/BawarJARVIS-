# J.A.R.V.I.S. — Desktop 11.5: start lokalnego Spring Boot z Electrona

## Zakres

Nowy proces main Electron uruchamia **wyłącznie wewnątrz zainstalowanej aplikacji** zapakowany `jarvis-backend.jar`. Odczekuje na odpowiedź uwierzytelnionego API (HTTP 200) i dopiero wtedy tworzy okno Angulara. Dev (`npm run dev` i `bash start_jarvis_dev.sh`) pozostaje bez zmian.

Bezpieczne ograniczenia:

- `java -jar` jest uruchamiany bez powłoki, z argumentami `--server.address=127.0.0.1` i `--server.port=8080`.
- Token sesji generuje Electron main (`crypto.randomBytes(32)`), przekazuje do własnego procesu Java przez zmienną środowiskową; Angular nie dostaje tokenu.
- Hasło PostgreSQL jest pobierane wyłącznie z prywatnego pliku użytkownika `%APPDATA%/J.A.R.V.I.S./backend.env`. **Nie znajduje się w instalatorze**.
- Zajęty port 8080 (lub niezgodne uprawnienia) blokuje uruchomienie; aplikacja nie używa obcego procesu.
- Zamknięcie Electrona kończy tylko backend, który Electron sam uruchomił.
- Brak automatycznej instalacji Javy, Dockera i bazy. PostgreSQL 17 musi już działać lokalnie; Java 21 jest wymagana w PATH.
- Nie zmieniamy istniejących stylów, komponentów i tłumaczeń Angulara, tokenowego Spring Security ani schematu PostgreSQL.

## Pliki

- `desktop/electron/backend-runtime.cjs` — zarządzanie procesem
- `desktop/electron/backend-runtime.test.cjs` — testy Node bez Electrona i Javy
- `desktop/scripts/init-backend-config.cjs` — jednorazowe kopiowanie `backend/.env.jarvis` do prywatnego AppData; nie nadpisuje istniejącego pliku
- `desktop/scripts/build-full.cjs` — Maven + Angular + electron-builder
- `desktop/electron-builder.full.config.cjs` — istniejąca konfiguracja buildera + backend JAR
- `desktop/electron/main.cjs` — minimalny patch w `app.whenReady()`: `await startPackagedBackend()`, zamknięcie procesu przy `before-quit`
- `desktop/package.json` — dodane komendy `installer:full`, `pack:full`; oryginalne pozostają
- `.gitignore` — dodany `desktop/.jarvis-build/`

## Test i użycie na Windows 11

```bash
cd ~/Desktop/Nauka/BawarJARVIS-
python apply_jarvis_desktop_11_5.py
node --test desktop/electron/backend-runtime.test.cjs
node --check desktop/electron/main.cjs
npm --prefix frontend run build
./backend/mvnw.cmd -f backend/pom.xml -DskipTests package
```

**Jednorazowo** kopiujemy istniejące hasło do lokalnego AppData:

```bash
node desktop/scripts/init-backend-config.cjs
```

Przed budową upewnij się, że `backend/.env.jarvis` zawiera prawdziwe hasło, i że uruchomiony kontener PostgreSQL odpowiada:

```bash
cd backend
docker compose --env-file .env.jarvis -f compose.db.yml up -d --wait
cd ../desktop
npm run installer:full
```

Powstaje `desktop/release/JARVIS-Setup-...exe`. Zamknij wszystkie stare lokalne backendy na `127.0.0.1:8080` przed otwarciem zainstalowanej aplikacji. Backend z JAR-a wystartuje sam, ale PostgreSQL nadal musi działać, a Java 21 musi być zainstalowana.

Wersja developerska nadal działa przez:

```bash
bash start_jarvis_dev.sh
```

## Test ręczny wydania

1. Otwórz instalację `desktop/release/...exe` i uruchom J.A.R.V.I.S. przy działającym PostgreSQL.
2. Powinien pojawić się Angular Chat, bez konieczności ręcznego uruchamiania Spring Boot.
3. Wyślij krótką wiadomość. Sprawdź zapis PostgreSQL.
4. Zamknij program i potwierdź, że zajmowany przez **jego** backend port 8080 został zwolniony.
5. Uruchom ponownie i sprawdź, że historia czatu pozostała w bazie.
6. Uruchom stary backend na 8080 i uruchom ponownie instalację: powinien pojawić się kontrolowany komunikat o zajętym porcie zamiast połączenia z obcą usługą.

## Ograniczenia i przyszłość

To **jeszcze nie jest samowystarczalny instalator offline**: Java 21 + Docker Desktop + uruchomiony kontener PostgreSQL nadal są wymagane. Docelowo w kolejnym etapie można dodać dystrybucję własnego Java Runtime (`jlink`), zarządzanie uruchamianiem bazy oraz bardziej wygodną, zaszyfrowaną konfigurację hasła przez DPAPI. Nie uruchamiaj dwóch egzemplarzy Jarvisa naraz na tym samym porcie 8080.

## Zapisz do zeszytu

1. Proces Electron main zarządza cyklem życia procesu Spring Boot; Angular renderer nie ma dostępu do JDK, bazy ani tokenu.
2. `spawn` z `shell: false` nie parsuje argumentów przez interpreter poleceń.
3. Readiness check musi potwierdzać status API z prawidłowym tokenem, a nie samo otwarcie TCP.
4. `before-quit` służy do zamknięcia tylko własnego procesu potomnego.
5. `extraResources` umieszcza wykonywalny JAR poza `app.asar` i umożliwia uruchomienie go przez `java -jar`.
