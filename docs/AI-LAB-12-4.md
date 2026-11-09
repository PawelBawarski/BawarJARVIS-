# AI Lab 12.4 — zatwierdzony katalog roboczy (tylko odczyt)

## Cel
Wybór katalogu pracy Jarvisa przez natywne okno Electrona i podgląd dopuszczonych plików źródłowych. Żaden model ani renderer nie otrzymuje bezpośredniego dostępu do `fs`, `child_process`, niezabezpieczonej ścieżki systemowej ani dowolnego żądania HTTP.

## Wdrożone
- `jarvis:workspace` IPC (status, choose, clear, list, read) sprawdza pochodzenie nadawcy przez `isTrustedSender`.
- Katalog wskazuje wyłącznie użytkownik przez okno `showOpenDialog({properties:['openDirectory']})`.
- Odczyt ograniczony do 64 KiB / plik, 100 wpisów / katalog, 6 poziomów.
- Brak dowolnych ścieżek absolutnych od renderera. Odrzucane `..`, ukośniki Windows, dowiązania symboliczne, sekretne nazwy i katalogi, niedozwolone rozszerzenia.
- HTML korzysta z interpolacji Angulara (escaping), nigdy `innerHTML` z pliku.
- Konfiguracja zawierająca tylko wskazaną ścieżkę jest zapisywana lokalnie pod `app.getPath('userData')/jarvis-workspace.json`. Historia treningów i rozmowy nadal są w PostgreSQL.
- Skasowanie wyboru **nie usuwa plików projektu**.

## Jeszcze NIE wdrożono
- Pisanie/zmienianie/usuwanie plików, instalowanie zależności, uruchamianie poleceń lub testów.
- Autonomiczne iteracje agenta, powiadomienia po krokach, uczenie się na podstawie internetu.
- Sandbox wykonawczy (oddzielny proces/kontener), limity CPU/RAM, review diff, rollback.

## Zagrożenia i dalsze zabezpieczenia
Ochrona przed symlinkami i realpath zmniejsza ryzyko ucieczki poza katalog, ale na Windows nie jest pełną izolacją przed wszystkimi reparse points, hardlinkami i wyścigami TOCTOU. Nie używaj tego modułu jako mechanizmu dostępu do nieufnych drzew kodu wrogich użytkowników. Przed umożliwieniem zapisu/własnych poleceń potrzebny jest osobny sandbox i przegląd zmian.

## Testy
`node --test desktop/electron/workspace-access.test.cjs`
`cd frontend && npm test -- --watch=false && npm run build`
`cd frontend && npx playwright test e2e/ai-lab-workspace.e2e.spec.ts`
