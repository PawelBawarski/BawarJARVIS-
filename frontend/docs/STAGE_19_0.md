# J.A.R.V.I.S. 19.0 — przegląd proponowanego kodu (bez zapisu plików)

## Cel

Rozszerzenie istniejącego AI Lab o czytelny, bezpieczny przegląd propozycji generowanej
przez lokalny Qwen. Nie tworzymy drugiego generatora ani nie zapisujemy plików.

## Co działa

1. Backend `AgentPatchPreviewService` generuje nową wersję WYŁĄCZNIE wybranego i zatwierdzonego fragmentu.
2. `AgentPatchReview` analizuje tekstowy zakres zmiany i flaguje kilka znanych wzorców:
   `LARGE_CHANGE`, `PROCESS_EXECUTION`, `DYNAMIC_CODE`, `POSSIBLE_SECRET`.
3. Angular sprawdza, czy odpowiedź dotyczy dokładnie zatwierdzonej ścieżki i oryginalnego kodu,
   czy zawiera nowy fragment oraz czy nie przekracza limitów długości.
4. Osobny komponent `AgentChangeReview` przedstawia podsumowanie linii, ostrzeżenia i informację,
   że żadne testy ani kompilacja NIE zostały przeprowadzone.
5. Użytkownik może świadomie skopiować proponowany kod do schowka. To nie jest zapis w pliku.
6. Zmiana zadania, wybranego pliku lub planu unieważnia stary podgląd.
7. Stare odpowiedzi API, pozbawione pola `review`, nadal wyświetlają porównanie i informację
   o braku analizy ryzyk (kompatybilność wsteczna).

## Granice funkcji

- Heurystyki nie są kompilatorem, skanerem bezpieczeństwa ani testami jednostkowymi.
  Mogą pomijać ryzyka i generować fałszywe alarmy.
- Nie dodano endpointu do zapisu, usuwania ani wykonywania kodu.
- Zatwierdzenie istniejącego planu w PostgreSQL NIE zatwierdza automatycznie zmian w plikach.
- Dostęp do pełnego projektu nie jest udzielany; wysyłane są tylko jawnie dołączone fragmenty.
- Nie ma automatycznego ponawiania wywołań POST Qwen.

## Testy z `BawarJARVIS-/`

```bash
cd frontend
npm run check:i18n
npm test -- --watch=false
npm run build
npx playwright test e2e/agent-code-review-19-0.e2e.spec.ts e2e/ai-lab-web-code-context-18-2.e2e.spec.ts e2e/backend-resilience-18-9.e2e.spec.ts
cd ../backend
./mvnw.cmd -Dtest=AgentPatchReviewTest,AgentPatchPreviewServiceTest,AgentProposalServiceTest test
```

## Wymagania i kolejny etap

Wymaga aplikacji ze zmianami 18.9; dla pełnej regresji E2E zalecana także poprawka 18.9.1.
Następny etap 19.1 powinien wprowadzić odrębną, uwierzytelnioną usługę zapisu z allowlistą
ścieżek, wersjonowaniem/sha256, kopią zapasową, potwierdzeniem zakresu i rollbackiem,
zanim AI Lab otrzyma jakiekolwiek uprawnienie do zmiany plików.
