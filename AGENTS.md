# J.A.R.V.I.S. — instrukcje dla agentów kodujących

## Cel projektu

Budujemy modularną aplikację desktopową na Windows: Angular 22 + Electron + Java 21 / Spring Boot. Własny edukacyjny Transformer implementujemy od podstaw, bez gotowych wag LLM i bez Ollama.

## Zasady współpracy

1. Przed zmianą istniejącego pliku przeczytaj jego bieżącą zawartość; nie zakładaj, że kod jest taki jak w starych lekcjach.
2. Nie usuwaj działających funkcji bez uzgodnienia. Preferuj małe, odwracalne zmiany.
3. Zawsze podaj komendę CLI tworzącą nowy komponent, serwis, pakiet lub plik, jeśli taka istnieje.
4. Angular: standalone components, Signals, HTML i SCSS w osobnych plikach oraz test `*.spec.ts`. Każdy komponent ma cztery pliki: `.ts`, `.html`, `.scss`, `.spec.ts`.
5. Angular: trzymaj stan rozmów w `ChatStore`, a konfigurację i18n w płaskich kluczach `frontend/public/i18n/pl.json` i `en.json`; nie dubluj serwisów tłumaczeń czy motywu.
6. Moduły UI mają korzystać ze wspólnego rejestru nawigacji; nowe moduły nie mogą rozbijać layoutu.
7. Java: rozdziel `controller`, `service`, `dto` i logikę `brain`; pisz JUnit razem z kodem produkcyjnym.
8. Nie opisuj niewytrenowanego Transformera jako działającego chatbota. Nie generuj fikcyjnych odpowiedzi AI dla użytkownika.
9. Po zmianach uruchom odpowiednie testy i build, a gdy nie można ich uruchomić, powiedz to wprost.
10. Zachowuj zgodność aplikacji z testami Electron oraz buildem NSIS.

## Bezpieczeństwo

- Nie commituj tokenów, sekretów, certyfikatów ani danych użytkownika.
- Electron: izolacja kontekstu, sandbox, brak Node.js API w rendererze, minimalny zakres IPC.
- Backend: wyłącznie lokalny interfejs i uwierzytelnianie także dla żądań z `localhost`.
- Internet: połączenia wychodzące przez kontrolowaną warstwę, walidacja URL, ochrona przed SSRF i dostępem do prywatnych adresów.
- AI Lab: analiza i propozycje kodu mogą być automatyczne, ale wykonywanie komend, zapis zmian, instalacja pakietów i publikacja wymagają jawnej autoryzacji. Używaj izolowanych kopii roboczych, limitów zasobów, logów i możliwości wycofania zmian.
- Mining: nie uruchamiaj CPU/GPU lub pobierania oprogramowania bez jednoznacznej zgody, limitów zasobów i informacji o kosztach.
- Rozmowy przechowywane tymczasowo w `localStorage` nie są szyfrowane. Nie nazywaj tego bezpiecznym magazynem sekretów.

## Sprawdzenia

Frontend: `cd frontend && npm test -- --watch=false && npm run build`

Desktop: `cd desktop && npm test && npm run installer:win`

Backend: `cd backend && ./mvnw.cmd clean test`

Nie wykonuj automatycznych `git push`, tagowania wydania ani publikacji bez wyraźnej prośby użytkownika.
