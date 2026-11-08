# JARVIS – LLM Lekcja 10.4

## Najpierw napraw test Spring Security

Plik `backend/src/test/java/pl/bawar/jarvis/security/ApiSecurityConfigTest.java`:

W teście `shouldDenyUnknownApiEndpoint` zamień oczekiwanie statusu dla żądania bez tokenu:
`status().isForbidden()` -> `status().isUnauthorized()`.

Nazwę testu możesz zmienić na `shouldRequireAuthenticationForUnknownApiEndpoint`.
Nie zmieniaj konfiguracji zabezpieczeń tylko dla starego oczekiwania testu.

## Skopiuj nowe pliki

- `backend/src/main/java/pl/bawar/jarvis/brain/optimization/AdamWOptimizer.java`
- `backend/src/test/java/pl/bawar/jarvis/brain/optimization/AdamWOptimizerTest.java`
- `backend/src/test/java/pl/bawar/jarvis/brain/optimization/AdamWDenseTrainingTest.java`

Umieść je w repozytorium `BawarJARVIS-` zachowując strukturę katalogów.

## Uruchom

```bash
cd ~/Desktop/Nauka/BawarJARVIS-/backend
./mvnw.cmd -Dtest=AdamWOptimizerTest,AdamWDenseTrainingTest test
./mvnw.cmd clean test
```

W `AdamWDenseTrainingTest` ćwiczymy jedną miniwarstwę na jednym przykładzie, nie cały transformer. Test korzysta z `DenseLayer.backward()` z poprzedniej lekcji. Osobny optimizer przypada na każdy wiersz macierzy wag i biasy, bo musi przechowywać momenty pomiędzy krokami. Biasy mają weight decay = 0.0.
