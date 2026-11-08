---
name: jarvis-development
description: Implementuj i weryfikuj zmiany w repozytorium J.A.R.V.I.S. Używaj przy tworzeniu komponentów Angular, serwisów, testów, klas Java, funkcji Electron oraz modułów Chat, Mining, AI Lab i Radio.
---

# Skill: rozwój J.A.R.V.I.S.

## Procedura

1. Przeczytaj `README.md` i `AGENTS.md` oraz aktualne pliki dotyczące zadania.
2. Określ warstwę zmiany: Angular (`frontend`), Electron (`desktop`) czy Java (`backend`).
3. Podaj komendę generatora przed nowym kodem, np. `npx ng g c features/... --style=scss --skip-import` lub `npx ng g s core/services/...`.
4. W Angularze każdy komponent musi mieć `.ts`, `.html`, `.scss`, `.spec.ts`; stosuj Signals, istniejące serwisy i płaskie klucze i18n PL/EN.
5. W Javie utrzymuj małe klasy, jawne wymiary macierzy i testy JUnit. Nie wprowadzaj gotowych wag modeli ani Ollama.
6. W Electronie ogranicz dostęp renderera do systemu; nie włączaj `nodeIntegration`. Przechowuj operacje systemowe po stronie main process za zatwierdzanym IPC.
7. Przy funkcjach AI Lab wymagaj izolowanego katalogu roboczego, jawnych uprawnień, limitów, przeglądu diffu i zgody na trwałe zmiany.
8. Uruchom testy i build dla zmienianych części. Wynik opisz jako wykonany tylko wtedy, gdy faktycznie go sprawdzono.
9. Zakończ krótką instrukcją weryfikacji i listą ograniczeń gotowości.

## Polecenia weryfikacyjne

```bash
# frontend
cd frontend && npm test -- --watch=false && npm run build

# desktop
cd desktop && npm test

# backend
cd backend && ./mvnw.cmd clean test
```

## Definicja ukończenia

- Kod kompiluje się.
- Testy kluczowych przypadków i błędów przechodzą.
- Interfejs działa w obu motywach i językach oraz na małych ekranach.
- Brak pozornych odpowiedzi AI lub nieaktywnych elementów udających rzeczywiste funkcje.
- Nowe operacje zapisu i sieci mają jawne granice bezpieczeństwa.
- Dokumentacja odzwierciedla stan faktycznie wdrożony, a nie przyszły plan.
