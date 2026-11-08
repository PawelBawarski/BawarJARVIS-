# INIT — przygotowanie środowiska J.A.R.V.I.S.

## Wymagania

- Windows 11, Git Bash lub PowerShell, Git.
- Node.js zgodny z `frontend/package.json`, npm i Angular CLI przez `npx ng`.
- JDK 21 oraz Maven Wrapper (`backend/mvnw.cmd`).
- Edytor z obsługą TypeScript, Angular, Java i Maven.

## 1. Sprawdzenie narzędzi

```bash
node --version
npm --version
java -version
git --version
```

## 2. Frontend

```bash
cd frontend
npm ci
npm test -- --watch=false
npm start
```

Frontend zwykle działa pod `http://localhost:4200`.

## 3. Electron (drugi terminal)

```bash
cd desktop
npm ci
npm test
npm run dev
```

Podgląd wybudowanej aplikacji: najpierw `cd frontend && npm run build -- --base-href ./`, później `cd ../desktop && npm run preview`.

## 4. Backend Java (osobny terminal)

```bash
cd backend
./mvnw.cmd clean test
./mvnw.cmd spring-boot:run
```

Uwaga: backend i niewytrenowany model nie są jeszcze połączone z czatem aplikacji; brak gotowego API rozmów jest oczekiwany.

## 5. Instalator Windows

```bash
cd desktop
npm run installer:win
```

Wynik: `desktop/release/`. Nie publikuj niepodpisanego instalatora jako bezpiecznej automatycznej aktualizacji.

## 6. Generowanie kodu

```bash
cd frontend
npx ng generate component features/example/example-view --style=scss --skip-import
npx ng generate service core/services/example-store
```

Nie pomijaj `*.spec.ts`. Nowe komponenty mają pliki `.ts`, `.html`, `.scss` i `.spec.ts`.

## 7. Sprawdzenie zmian przed commitem

```bash
git status
git diff --check
```

Nie dodawaj `node_modules/`, `dist/`, `target/`, `release/` ani sekretów do repozytorium.

## 8. Debugowanie

- Gdy Maven nie rozpoznaje pakietów: w IDE otwórz katalog `backend` zawierający `pom.xml` i przeładuj projekt Maven.
- Gdy Angular zgłasza błąd szablonu: sprawdź `imports` komponentu standalone i płaskie klucze i18n.
- Gdy okno Electron jest puste: sprawdź dostępność Angular dev server albo `dist/jarvis/browser/` w podglądzie.
- Po zmianach w UI uruchom testy i build przed przebudową instalatora.

Zobacz też `README.md`, `AGENTS.md` i `.github/skills/jarvis-development/SKILL.md`.
