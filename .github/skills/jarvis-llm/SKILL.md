---
name: jarvis-llm
description: Implementuj własny trenowalny decoder-only Transformer J.A.R.V.I.S. w Javie 21; słownik, embeddingi, attention, gradienty, AdamW, pętle treningowe, testy gradient checking i checkpointy.
---

# JARVIS — szkoleniowy Transformer Java 21

Użyj przy zadaniach związanych z `backend/src/main/java/pl/bawar/jarvis/brain/**`.

1. Zawsze zacznij od przeczytania aktualnych klas i ich JUnit. Nie zmieniaj istniejących publicznych API bez planu migracji.
2. `forward` nie może mutować wejścia. `backward` musi zwracać gradient wejścia i parametrów bez wykonywania `optimizer.step()`.
3. Dla tokenów i pozycji uwzględnij indeksy i wymiary. W EmbeddingLayer ignoruj PAD i sumuj powtórzone ID; w LM Head sumuj gradienty wszystkich pozycji.
4. Obliczenia: stabilny softmax/logsumexp; sprawdzaj NaN, Infinity i błędne wymiary. Testuj gradienty analityczne metodą centralnych różnic skończonych.
5. Optymalizatory utrzymują stany `m`, `v` pomiędzy krokami; bias, embedding, projection i LayerNorm wymagają właściwych tablic parametrów.
6. Trening ma jawnie definiować maskowanie PAD, przesunięcie celu next-token i sposób agregacji loss. Nie wolno trenować na danych bez uprawnień ani automatycznie na treści WWW.
7. Checkpoint musi zawierać zgodny słownik, architekturę, parametry, parametry optymalizatora i wersję formatu; JSON metadanych może trafić do PostgreSQL, dane wag na dysk.
8. Udokumentuj dokładne ścieżki plików, komendy dla Git Bash Windows i status uruchomionych testów.

## Komenda

`cd backend && ./mvnw.cmd clean test`

## Stan po LLM 10.12

- `FullModelTrainer` z 10.11 oblicza mean next-token loss i aktualizuje wszystkie parametry przez AdamW.
- `TextGenerator` wykonuje ograniczone generowanie, zatrzymuje się na EOS i uwzględnia długość kontekstu; temperatura 0 oznacza greedy.
- `ModelEvaluator` liczy mean cross entropy i `perplexity = exp(loss)` na niezależnym zbiorze; nie mutuje wag.
- `ModelCheckpoint` w formacie v1 przechowuje słownik, wagi całego modelu, parametry i momenty AdamW; sprawdza checksum, strukturę i wersję przed wczytaniem.
- Nigdy nie wczytuj checkpointów z niezweryfikowanych źródeł. SHA-256 nie jest podpisem cyfrowym.
- Trening, generowanie, zapis i odczyt checkpointu wykonuj pod jednym lockiem lub na dedykowanym workerze (mutable model).
- Checkpointy zapisuj poza repozytorium (`backend/checkpoints/` wyłączone z Git); w PostgreSQL później tylko metadane, wersje i ścieżki kontrolowane przez backend.
- Nie wykonuj automatycznego retrainingu ani modyfikacji plików na podstawie treści WWW.

## Następne kroki

- BE-1: bezpieczna fasada inferencji/treningu, jedno źródło stanu modelu.
- BE-2: PostgreSQL, Flyway i migracje historii, wiadomości, treningów, checkpointów.
- FE-1: prawdziwy Chat Angular → Electron IPC → Spring Boot → model → PostgreSQL z Playwright E2E.
- Internet search: narzędzie backendowe z jawnie wskazanymi źródłami i ochroną SSRF, niezależne od treningu.
