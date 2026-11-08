# J.A.R.V.I.S. — Personal AI Desktop Assistant

Eksperymentalna, modularna aplikacja desktopowa na Windows. Projekt edukacyjny: budujemy własny, niewielki model językowy od zera w Java 21, zamiast korzystać z gotowych wag lub Ollama.

Repozytorium: https://github.com/PawelBawarski/BawarJARVIS-

## Stos technologiczny

| Część | Technologie |
| --- | --- |
| Frontend | Angular 22, TypeScript, Angular Signals, SCSS, Vitest |
| Desktop | Electron, electron-builder, instalator NSIS Windows x64 |
| Backend | Java 21, Spring Boot 4.1.x, Maven, JUnit |
| AI | Własny edukacyjny decoder-only Transformer w Javie |
| CI/CD | GitHub Actions (frontend/backend build i testy, instalator Windows) |

Wersję konkretnej zależności sprawdzaj w `package.json`, `package-lock.json` lub `backend/pom.xml`; nie sugeruj się numerem wersji w tym dokumencie.

## Struktura katalogów

```text
.github/workflows/               # automatyzacja buildów i testów
.github/skills/                  # lokalne instrukcje do powtarzalnych prac
frontend/src/app/core/          # serwisy, stan i modele
frontend/src/app/features/      # chat, mining, AI Lab
frontend/src/app/layout/        # AppShell, sidebar, przełącznik modułów, ustawienia
frontend/public/i18n/           # pl.json, en.json (płaskie klucze)
desktop/electron/               # główny proces Electrona
desktop/tests/                  # testy desktopu
backend/src/main/java/pl/bawar/jarvis/brain/ # własna matematyka i Transformer
backend/src/test/java/          # testy JUnit
docs/INIT.md                    # instrukcja uruchomienia środowiska
AGENTS.md                       # zasady pracy z agentami kodującymi
```

## Uruchomienie lokalne (Windows / Git Bash)

Wymagane: Java 21, Node.js zgodny z projektem, npm oraz Git. Z katalogu głównego:

**Terminal 1 — Angular**

```bash
cd frontend
npm ci
npm start
```

**Terminal 2 — Electron** (po uruchomieniu frontendu)

```bash
cd desktop
npm ci
npm run dev
```

**Backend — osobny terminal**

```bash
cd backend
./mvnw.cmd test
./mvnw.cmd spring-boot:run
```

Backend nie jest jeszcze automatycznie wbudowany w instalator desktopowy. Aktualny silnik AI jest edukacyjny, niewytrenowany i nie zapewnia jeszcze sensownej konwersacji.

## Testy i build

```bash
cd frontend && npm test -- --watch=false && npm run build
cd ../desktop && npm test && npm run installer:win
cd ../backend && ./mvnw.cmd clean test
```

Plik instalatora powstaje w `desktop/release/`. Workflow GitHub Actions należy zweryfikować w zakładce Actions.

## Moduły aplikacji

- **Chat**: wiele rozmów z lokalną historią; właściwe odpowiedzi AI dopiero po podłączeniu backendu.
- **Mining**: planowana kontrola kopania, limity sprzętowe, szacowanie kosztów energii; rzeczywisty silnik nie jest jeszcze podłączony.
- **AI Lab**: planowany asystent modyfikujący kod w izolowanym środowisku, wyłącznie za zgodą użytkownika.
- **Radio**: planowany globalny odtwarzacz stacji z różnych państw, z backendem Spring Boot.

Nawigacja powinna umożliwiać dodawanie następnych modułów bez przepisywania istniejących komponentów.

## Bezpieczeństwo i prywatność

Projekt jest w trakcie utwardzania. Docelowe zasady:

- Spring Boot nasłuchuje lokalnie; samo `127.0.0.1` nie zastępuje uwierzytelniania.
- Electron renderer bez `nodeIntegration`, z `contextIsolation`, sandboxem i kontrolowanym IPC.
- Połączenia internetowe wychodzące są dopuszczane przez jawne usługi; trzeba chronić przed SSRF, przekierowaniami do sieci prywatnych i niebezpiecznymi adresami URL.
- AI Lab nie wykonuje dowolnych poleceń ani zmian w repozytorium bez oceny uprawnień, ograniczeń zasobów, prezentacji diffu i świadomego zatwierdzenia.
- Nie commituj sekretów, certyfikatów, prywatnych kluczy, tokenów API ani prywatnych rozmów.
- Wstępne rozmowy zapisywane w `localStorage` **nie są szyfrowane**. Nie wpisuj tam haseł ani innych sekretów; docelowo przygotujemy bezpieczniejszy magazyn danych.
- Aktualizacje z GitHub Releases wymagają osobnej weryfikacji i prawidłowego podpisywania wydań przed publicznym wdrożeniem.

Nie traktuj obecnego projektu jako systemu odpornego na wszystkie ataki.

## Dokumenty współpracy

- `docs/INIT.md` — uruchomienie i workflow rozwoju.
- `AGENTS.md` — reguły dla AI pomagającej w programowaniu.
- `.github/skills/jarvis-development/SKILL.md` — procedura implementacji funkcji z testami.

## Roadmap

1. Stabilny UI, wiele czatów, ustawienia w oknie modalnym.
2. Własny trening Transformera, generowanie sekwencji, checkpointy.
3. Bezpieczne API Spring Boot i integracja z Angular/Electron.
4. Radio internetowe, Mining i AI Lab z kontrolą uprawnień.
5. Trwałe przechowywanie i migracje danych, bezpieczne aktualizacje.

Licencja projektu nie jest tutaj deklarowana — przed publicznym rozpowszechnianiem kodu dodaj odpowiedni plik `LICENSE`.
