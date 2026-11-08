# J.A.R.V.I.S. — LLM 10.9/10.12: TransformerBlock Backward

## Cel

Dopisujemy `backward(double[][] input, double[][] outputGradients)` do istniejącego bloku dekodera w schemacie **Pre-LayerNorm**:

```text
x ---> LN1 ---> MHA --+---> a ---> LN2 ---> FFN --+---> y
 \___________________/       \____________________/
      residual 1                      residual 2
```

W metodzie backward liczymy gradienty **w odwrotnej kolejności** i **sumujemy gradienty z obu ścieżek rezydualnych**. Nie aktualizujemy jeszcze parametrów — zrobi to AdamW, kiedy połączymy wszystkie warstwy w treningu modelu.

## Instalacja: dokładne ścieżki od `BawarJARVIS-/`

| Plik | Lokalizacja docelowa | Akcja |
|---|---|---|
| `TransformerBlock.java` | `backend/src/main/java/pl/bawar/jarvis/brain/transformer/TransformerBlock.java` | **ZMIANA**: porównaj z lokalnym plikiem i scal; zachowuje konstruktor, `forward()`, `embeddingSize()` |
| `TransformerBlockGradients.java` | `backend/src/main/java/pl/bawar/jarvis/brain/transformer/TransformerBlockGradients.java` | **NOWY** |
| `LayerNormBatchGradients.java` | `backend/src/main/java/pl/bawar/jarvis/brain/normalization/LayerNormBatchGradients.java` | **NOWY** |
| `TransformerBlockBackwardTest.java` | `backend/src/test/java/pl/bawar/jarvis/brain/transformer/TransformerBlockBackwardTest.java` | **NOWY**, 9 testów JUnit |

> Nie zastępuj lokalnego pliku `TransformerBlock.java` bez porównania, jeżeli masz niezacommitowane modyfikacje. Jeśli lokalny kod różni się od wersji GitHub, dodaj przede wszystkim metodę `backward()`, `backwardNorm()` i pomocniczą metodę `add()`, a także importy.

**Wymagane wcześniejsze etapy:** 10.3 (`DenseLayer.backward`), 10.5 (`LayerNormalization.backward`), 10.6 (`FeedForwardNetwork.backward`), 10.7–10.8 (Causal/Multi-Head Attention backward).

## Uruchomienie w Git Bash / Windows

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
./mvnw.cmd -Dtest=TransformerBlockBackwardTest test
./mvnw.cmd -Dtest=TransformerBlockTest,TransformerBlockBackwardTest test
./mvnw.cmd clean test
```

Nowy zestaw zawiera 9 testów, w tym:

1. Wymiary wszystkich gradientów.
2. Finite differences każdego elementu wejścia.
3. Finite differences `gamma`, `beta` obu LayerNorm.
4. Finite differences wszystkich wag projekcji wyjścia Attention i obu Dense w FFN.
5. Finite differences wszystkich Q/K/V wag i biasów obu głowic.
6. Finite differences biasów projekcji wyjścia Attention i FFN.
7. Zachowanie maski przyczynowej przez cały blok.
8. Brak mutacji wejścia i parametrów podczas backward.
9. Walidacja nieprawidłowych wymiarów i NaN.

## Matematyka

Przy `a = x + MHA(LN1(x))` oraz `y = a + FFN(LN2(a))`:

```text
dFFN_out   = dy
(dLN2_in, dLN2_gamma, dLN2_beta) = LN2.backward(a, FFN.backward(LN2(a), dy).dInput)
da         = dy + dLN2_in
(dLN1_in, dLN1_gamma, dLN1_beta) = LN1.backward(x, MHA.backward(LN1(x), da).dInput)
dx         = da + dLN1_in
```

Zarówno `gamma`/`beta` normalizacji, jak i parametry Attention/FFN są współdzielone między tokenami. Sumujemy ich gradienty dla wszystkich tokenów. Jeśli funkcja straty jest średnią, odpowiednio skalujemy `dy` **przed** `backward()`.

## Weryfikacja

Kod i 9 testów uruchomiono w izolowanym środowisku Java 21 z implementacjami poprzednich etapów oraz prostym adapterem asercji JUnit. Wynik 9/9. Weryfikacja w pełnym projekcie Spring Boot odbywa się dopiero przy uruchomieniu Twojego Mavena.

## Zapisz do zeszytu

- Pre-LN: normalizacja zachodzi **przed** Attention i FFN.
- Residual `y = x + f(x)` oznacza w backward `dx = dy + df/dx · dy` (zapis intuicyjny; dokładnie w ujęciu Jacobianów: `dx = dy + J_f(x)^T dy`).
- LayerNorm ma trenowalne `gamma` i `beta`; gradienty sumujemy po tokenach.
- `backward()` oblicza gradienty; optymalizator AdamW aktualizuje parametry osobno.
- Gradient checking metodą różnic centralnych pomaga znaleźć błędy zanim rozpoczniemy trening pełnego modelu.

Następny etap: **10.10 — embeddingi i warstwa LM Head (Backward)**. Potem 10.11 — Training Loop oraz 10.12 — generowanie, checkpointy i ewaluacja. Następnie integracja Spring Boot + Angular + PostgreSQL.
