# J.A.R.V.I.S. — LLM 10.8/10.12: Multi-Head Attention Backward

## Wymagania
- Java 21, Spring Boot 4.1.2, JUnit 5 (w Twoim projekcie)
- Lekcja 10.3: `DenseLayer.backward()` i `DenseGradients`
- Lekcja 10.7: `CausalSelfAttention.backward()`, `CausalAttentionGradients` i `AttentionProjectionGradients`

## Instalacja — wszystkie ścieżki od katalogu `BawarJARVIS-/`

1. `backend/src/main/java/pl/bawar/jarvis/brain/attention/MultiHeadAttention.java` — **podmień po porównaniu** z Twoją lokalną wersją. Zostawiono konstruktor, `forward()`, `headCount()` i `embeddingSize()`. Dodano `backward()`.
2. `backend/src/main/java/pl/bawar/jarvis/brain/attention/MultiHeadAttentionGradients.java` — **nowy** rekord ze wszystkimi gradientami całego bloku.
3. `backend/src/main/java/pl/bawar/jarvis/brain/attention/MultiHeadOutputProjectionGradients.java` — **nowy** rekord na gradienty wspólnej projekcji wyjściowej, z osią tokenów w `inputGradient`.
4. `backend/src/test/java/pl/bawar/jarvis/brain/attention/MultiHeadAttentionBackwardTest.java` — **nowy** plik, 8 testów JUnit.

Nie usuwaj starych testów `MultiHeadAttentionTest.java`. Jeśli masz niezacommitowane zmiany, zrób kopię lub porównaj diff.

## Co zwraca backward?

`MultiHeadAttentionGradients backward(double[][] input, double[][] dOutput)`:

- `inputGradient()` — gradient wejścia `[tokens][embeddingSize]`, suma wkładu z każdej głowicy.
- `outputProjectionGradients()` — `MultiHeadOutputProjectionGradients`, czyli `inputGradient` o wymiarach `[tokens][heads*embeddingSize]`, zsumowane po tokenach `weightGradients` `[heads*embeddingSize][embeddingSize]` oraz `biasGradients` `[embeddingSize]`.
- `headGradients()` — lista `CausalAttentionGradients`, po jednym elemencie dla każdej głowicy, zawierająca gradienty Q/K/V.

**Uwaga o architekturze:** obecna, edukacyjna implementacja Jarvisa ma każdą głowicę o pełnym `embeddingSize`, więc po konkatenacji wymiar wynosi `headCount * embeddingSize`. To nie jest jeszcze zoptymalizowana klasyczna wersja z `headDim = embeddingSize / headCount`; zachowaliśmy istniejące API i kształty macierzy.

## Testy — Git Bash w Windows

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend

./mvnw.cmd -Dtest=MultiHeadAttentionBackwardTest test
./mvnw.cmd -Dtest=MultiHeadAttentionTest,MultiHeadAttentionBackwardTest test
./mvnw.cmd clean test
```

Nowe testy sprawdzają:
- wcześniejsze zachowanie `forward()` (2 głowice),
- wymiar, zbieranie gradientów projekcji wyjściowej i niemodyfikowalność listy głowic,
- różnice skończone dla **każdego wejścia**, wag i biasów output projection oraz Q/K/V obydwu głowic,
- brak gradientu od pierwszego tokenu do przyszłych tokenów,
- walidację argumentów i niezmienianie danych wejściowych.

## Lokalna weryfikacja plików

W izolowanym środowisku Java 21 nowa klasa i 8 testów zostały skompilowane i uruchomione ze złączonymi klasami lekcji 10.7 i zgodnymi implementacjami `DenseLayer`/`MatrixOps`. Użyto lekkiego harnessu imitującego asercje JUnit 5, **nie uruchomiono Maven ani rzeczywistego JUnit 5**. Wszystkie 8 scenariuszy przeszły. Ostateczne sprawdzenie: `./mvnw.cmd clean test` u Ciebie.

## Co dalej?

LLM 10.9 — Backpropagation przez cały Transformer Block (LayerNorm, Attention, Residual, FFN). Po LLM 10.12: integracja Spring Boot / Angular / PostgreSQL.
