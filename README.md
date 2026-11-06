# J.A.R.V.I.S. Desktop — ETAP 01

To jest pierwszy, samodzielnie uruchamiany klocek projektu: **Angular 22 + Electron**.
Wersja zawiera ładne okno desktopowe, czat demonstracyjny, wiele rozmów,
zapisywanie ich lokalnie i odczytywanie wiadomości głosem systemowym Windows.

**WAŻNE:** To nie jest jeszcze model LLM. Odpowiedzi na czacie są DEMO. Backend
Java + Spring Boot i model Ollama dodamy w ETAPIE 02, nie ukrywamy tego przed użytkownikiem.

## Wymagania

- Windows 11
- Node.js 26.x (albo wydanie zgodne z Angular 22)
- npm
- Połączenie z internetem przy instalacji zależności

## LEGO: uruchomienie

1. Rozpakuj folder `jarvis-desktop-etap-01`.
2. Otwórz go w WebStorm lub VS Code.
3. Uruchom terminal PowerShell w katalogu zawierającym `package.json`.
4. Wpisz:

   ```powershell
   node -v
   npm install
   npm run desktop
   ```

5. Po uruchomieniu Angulara otworzy się osobne okno **J.A.R.V.I.S.**.
6. Napisz wiadomość i kliknij niebieską strzałkę lub Enter.
7. Kliknij „Włącz głos” albo „Odczytaj głosem” pod wiadomością.
8. „Nowa rozmowa” tworzy osobną konwersację; po ponownym uruchomieniu
   rozmowy pozostają zapisane lokalnie w profilu aplikacji.

## Z czego składa się projekt?

```text
jarvis-desktop-etap-01/
├── electron/
│   └── main.cjs          <-- otwiera okno desktopowe
├── src/
│   ├── main.ts           <-- uruchamia Angular
│   ├── styles.scss       <-- wygląd globalny
│   └── app/
│       ├── app.ts        <-- logika czatu
│       ├── app.html      <-- wygląd i przyciski
│       └── app.scss      <-- futurystyczne style
├── angular.json          <-- konfiguracja Angulara
└── package.json          <-- skrypty npm i zależności
```

## Co dodamy w ETAPIE 02?

- moduł `backend/` w Java 21 + Spring Boot;
- REST endpoint `/api/chat`;
- Ollama jako lokalny model językowy (np. Qwen3);
- `ChatApiService` w Angularze wywołujący Spring Boot;
- prawdziwe odpowiedzi generowane przez AI zamiast tekstu DEMO;
- osobne uruchamianie backendu na czas nauki.

Później dodamy lepszy lokalny głos, mikrofon, trwałą pamięć w PostgreSQL,
narzędzia, streaming odpowiedzi i instalator .exe. W aktualnym etapie
uruchamiamy desktop z projektu przez `npm run desktop` — **jeszcze nie instalator .exe**.

## Uwaga dotycząca prywatności

Historia jest obecnie przechowywana w localStorage Chromium/Electron. Nie jest
szyfrowana; nie wprowadzaj sekretów ani wrażliwych danych do tej demonstracji.
Etap bazodanowy dodamy później.
