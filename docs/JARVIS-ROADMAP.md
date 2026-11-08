# JARVIS — stan modułów i dalsze zadania (po LLM 10.12)

## Prace wykonywane w lekcji 10.10

- Backward dla token embeddings i positional embeddings.
- Backward dla LM Head ze współdzielonymi parametrami po całej sekwencji.
- Status sieci, ikona radia offline, bezpieczne linki do GitHub Releases i projektu.
- Aktualizacja AGENTS, Copilot, README oraz specjalistycznego skillu Java/LLM.

## LLM 10.11 i 10.12 — wykonane w paczkach szkoleniowych

- 10.11: `FullModelTrainer`, backward całego modelu, AdamW, gradient clipping.
- 10.12: `TextGenerator`, `ModelEvaluator`, `ModelCheckpoint` (wersja, słownik, tensor, AdamW, SHA-256).
- Weryfikacja środowiska użytkownika jest konieczna; stanu lokalnego repo nie można wywnioskować z wydanych paczek.
- Checkpointy to pliki na dysku, `backend/checkpoints/` ignorowany przez Git.

## Backend + frontend + baza danych

1. Migracje Flyway i tabele conversations/messages/training_runs/checkpoints; PostgreSQL jako źródło prawdy.
2. Stabilne DTO REST do rozmów, inferencji i treningu, walidacja i autoryzacja.
3. Wysyłanie żądań Angular → IPC Electron → Spring Boot; testy E2E.
4. Sieciowy tool w backendzie: jawne API wyszukiwania/aktualnych wiadomości, źródła z datami, SSRF defense, allowlista domen i limity, obsługa offline.
5. Aktualizacje aplikacji: wyłącznie z podpisanych, zaufanych wydań, świadoma zgoda użytkownika na instalację. Nigdy na polecenie treści znalezionej w internecie.

## Co NIE jest jeszcze gotowe

- Publiczny hosting interfejsu w przeglądarce.
- Automatyczny installer z ikony — obecnie odsyłacz do GitHub Releases.
- Chat z wytrenowanym modelem za pośrednictwem API Spring Boot i PostgreSQL (nadal do podłączenia).
- Automatyczna analiza wiadomości przez AI.
- Automatyczne modyfikowanie backendu oraz uczenie wag na podstawie pobranych stron.
