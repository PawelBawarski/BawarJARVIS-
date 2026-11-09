# AI Lab 12.1 — Trening z Angular + Electron + Spring Boot

## Funkcje

- Jeden asynchroniczny trening na raz: `POST /api/ai-lab/training` zwraca HTTP 202 natychmiast.
- Odczyt `GET /api/ai-lab/training`: stan `IDLE/RUNNING/COMPLETED/FAILED`, epoka, tablica rzeczywistych loss.
- `GET /api/ai-lab/model`: metryki modelu; `POST /api/ai-lab/checkpoint/save` i `.../load`: ręczne checkpointy.
- `POST /api/ai-lab/evaluate` do przyszłego panelu ewaluacji.
- Endpointy są tylko dla `ROLE_JARVIS`, z tokenem sesji w Electron main i stałymi trasami.
- Model używa istniejącej blokady (`JarvisModelService`); panel nie pobiera `model.status()` podczas treningu.
- Brak automatycznego trenowania, zapisu checkpointu i wykonywania poleceń systemowych.

## Ograniczenia

- Status i historia loss są w pamięci backendu i znikają po restarcie. Tabele `jarvis_training_runs` i `jarvis_model_checkpoints` wymagają osobnej integracji persystencji w następnym etapie.
- Funkcja treningu nie potrafi jeszcze wstrzymywać ani anulować epoki. Zamykanie aplikacji w trakcie treningu może utracić niezapisane zmiany wag.
- Wstawiany panel wymaga istniejącego Angular standalone `app-ai-lab-view`; instalator sprawdza jego strukturę i zatrzyma się bez zmian, jeśli nie znajdzie bezpiecznego punktu.
- Poprawność wizualna i kompletne testy Maven/Angular/Playwright wymagają uruchomienia w lokalnym repo użytkownika.
- Dane demonstracyjne `ala` i `ala ma kota` nadają się do nauki mechanizmu, nie do stworzenia pełnowartościowego modelu językowego.

## Bezpieczeństwo

Nie wysyłaj tokenu do renderer ani nie włączaj publicznego CORS. Nie używaj `permitAll()` dla AI Lab. W paczce IPC waliduje maksymalnie 100 przykładów po 256 znaków oraz 1–100 epok; backend wykonuje niezależną walidację i swój limit kontekstu.
