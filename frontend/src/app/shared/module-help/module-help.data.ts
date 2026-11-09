/** Context help is local/static: no network, no credentials, no hidden side effects. */
export type HelpTopic = 'chat' | 'lab' | 'lab-training' | 'lab-workspace' | 'lab-offline' |
  'lab-reasoning' | 'lab-learning' | 'lab-internet' | 'lab-ranking' | 'mining' | 'security' | 'radio';

export interface HelpGuide {
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly steps: readonly string[];
  readonly examples: readonly string[];
  readonly commands: readonly { readonly label: string; readonly value: string }[];
  readonly caution?: string;
}

export const MODULE_HELP: Record<HelpTopic, HelpGuide> = {
  chat: {
    title: 'Czat AI — lokalny model Qwen3 8B',
    summary: 'Rozmowa w zwykłym czacie. Historia rozmów pozostaje w backendzie Spring Boot i bazie PostgreSQL.',
    status: 'Wymaga przygotowania zasobów modelu (~5 GB) przed zbudowaniem pełnej aplikacji desktopowej.',
    steps: [
      'W trybie programistycznym najpierw uruchom model i Spring Boot skryptem run_dev.ps1.',
      'Uruchom Angular w drugim terminalu i otwórz Czat.',
      'W gotowym instalatorze Electron uruchamia model i backend automatycznie, jeśli zasoby zostały do niego dołączone.',
      'Jeżeli model nie startuje, sprawdź wynik weryfikacji plików i wolny VRAM.'
    ],
    examples: ['Wyjaśnij Angular Signals i pokaż przykład.', 'Napisz test JUnit dla kontrolera Spring Boot.', 'Czym różni się Kafka od RabbitMQ?'],
    commands: [
      { label: 'Jednorazowe przygotowanie modelu (w katalogu BawarJARVIS-)', value: 'python tools/local-ai/prepare_assets.py' },
      { label: 'Sprawdzenie zasobów modelu', value: 'python tools/local-ai/prepare_assets.py --verify' },
      { label: 'Start lokalnego modelu i Spring Boot w trybie DEV', value: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/local-ai/run_dev.ps1' },
      { label: 'Uruchom frontend w drugim terminalu', value: 'cd frontend && npm start' },
      { label: 'Sprawdzenie GPU', value: 'nvidia-smi' },
    ],
    caution: 'To nie jest model wytrenowany przez nas od zera. Qwen działa lokalnie; przeglądanie internetu i autonomiczne programowanie zostaną dodane w kolejnych etapach.'
  },
  lab: {
    title: 'AI Lab — centrum rozwoju Jarvisa',
    summary: 'Miejsce badań, testowania jakości AI, gromadzenia wiedzy i przyszłego doskonalenia kodu.',
    status: 'Obecnie są tu narzędzia eksperymentalne. Samoczynne modyfikowanie kodu i trening wag Qwen nie są jeszcze aktywne.',
    steps: [
      'Rozwiń „Trening, historia i dostęp do katalogu”, aby przetestować małą sieć Transformer.',
      'Rozwiń „Offline Brain”, aby uruchomić osobną bazę wiedzy i ranking źródeł.',
      'Token pola Offline Brain jest wyświetlany w terminalu usługi Java 21 na porcie 8766.',
      'W przyszłości agent będzie proponować zmiany kodu, testować je w izolacji i prosić Cię o akceptację.'
    ],
    examples: ['Zestaw testowy „ala ma kota” ćwiczy mały model znakowy, nie czat Qwen.', 'Ocena trafnych i nietrafnych źródeł pomaga trenować ranking wyszukiwania.'],
    commands: [
      { label: 'Uruchom osobny Offline Brain — odczytaj token w konsoli', value: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/offline-brain/start.ps1' },
      { label: 'Testy Java Offline Brain', value: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/offline-brain/test.ps1' }
    ],
    caution: 'Token Offline Brain nie jest tokenem Qwen. Nie udostępniaj go publicznie. Nie ma potrzeby uruchamiania Offline Brain, aby rozmawiać z Qwen.'
  },
  'lab-training': {
    title: 'AI Lab — trening i historia modeli',
    summary: 'Eksperymentalny, mały Transformer napisany w Javie; jego metryki są użyteczne do nauki działania sieci.',
    status: 'Działa niezależnie od modelu konwersacyjnego Qwen3 8B.',
    steps: ['Podaj kilka krótkich przykładów, każdy w osobnej linii.', 'Ustaw 3 epoki i rozpocznij trening.', 'Obserwuj funkcję straty (loss).', 'Zapisz checkpoint i przetestuj ewaluację na osobnym zbiorze danych.'],
    examples: ['ala', 'ala ma kota', 'kot pije mleko'],
    commands: [{ label: 'Testy backendu Spring Boot', value: 'cd backend && ./mvnw.cmd test' }],
    caution: 'Zmniejszenie loss nie oznacza ogólnej inteligencji. Nie używamy tego małego modelu do zwykłego czatu.'
  },
  'lab-workspace': {
    title: 'AI Lab — katalog roboczy',
    summary: 'Bezpieczny wybór folderu projektu do analizy jego plików.',
    status: 'Na razie tylko odczyt; zmiany kodu będą wymagały jawnej zgody.',
    steps: ['Kliknij „Wybierz folder” i wskaż katalog projektu.', 'Przejrzyj pliki dopuszczone przez filtr bezpieczeństwa.', 'Nie wskazuj katalogów systemowych, katalogu domowego ani dysku głównego.', 'Dostęp można wycofać przez „Odłącz katalog”.'],
    examples: ['BawarJARVIS-/frontend', 'BawarJARVIS-/backend'],
    commands: [{ label: 'Testy bezpieczeństwa katalogu', value: 'node --test desktop/electron/workspace-access.test.cjs' }],
    caution: 'Katalogi ukryte, sekrety i próby wyjścia poza projekt są blokowane. To nie jest jeszcze autonomiczny edytor kodu.'
  },
  'lab-offline': {
    title: 'Offline Brain — osobna usługa Java 21',
    summary: 'Lokalna baza wiedzy, wyszukiwanie odpowiedzi z cytowaniem źródeł, import zatwierdzonych stron i ranking.',
    status: 'Oddzielna usługa HTTP 127.0.0.1:8766. Nie jest to model czatu ani GPU LLM.',
    steps: [
      'W katalogu głównym uruchom poniższy start.ps1.',
      'Pozostaw okno terminala otwarte i skopiuj z niego wygenerowany token (nie wklejaj go do rozmowy).',
      'W AI Lab otwórz „Offline Brain”, wklej token i kliknij „Połącz / odśwież”.',
      'Dodaj dokument do pamięci albo pobierz podgląd dozwolonej strony i zatwierdź import.',
      'W sekcji Reasoning wpisz pytanie dotyczące zapisanej wiedzy.'
    ],
    examples: ['Tytuł: Angular Signals', 'Źródło: https://angular.dev/guide/signals', 'Pytanie: Co to są Signals w Angularze?'],
    commands: [
      { label: 'Uruchom usługę i odczytaj token', value: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/offline-brain/start.ps1' },
      { label: 'Przetestuj usługę', value: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/offline-brain/test.ps1' }
    ],
    caution: 'Nie wklejaj tutaj haseł, kluczy API ani innych sekretów. „Learning” zapisuje wiedzę, ale nie zmienia wag Qwen.'
  },
  'lab-reasoning': {
    title: 'Reasoning — wyszukiwanie odpowiedzi',
    summary: 'Odpowiada na podstawie lokalnej bazy wiedzy lub prostych działań arytmetycznych.',
    status: 'To nie jest swobodny czat LLM.',
    steps: ['Najpierw dodaj dokument w Learning albo zatwierdź import ze strony.', 'Wpisz pytanie w pole Reasoning.', 'Sprawdź wskazane źródła, oceń je jako trafne lub nietrafne.'],
    examples: ['Co to są Angular Signals?', '(2+3)*4'], commands: [],
    caution: 'Nie traktuj odpowiedzi o wysokim score jako automatycznie prawdziwej.'
  },
  'lab-learning': {
    title: 'Learning — lokalna pamięć wiedzy',
    summary: 'Zapisuje dokumenty, z których korzysta wyszukiwarka Offline Brain.',
    status: 'Zapamiętywanie informacji nie jest treningiem parametrów modelu językowego.',
    steps: ['Wpisz tytuł, źródło i treść.', 'Kliknij „Dodaj do pamięci”.', 'Sprawdź dokument na liście i zapytaj o niego w Reasoning.'],
    examples: ['Tytuł: Spring Boot', 'Źródło: https://spring.io/projects/spring-boot', 'Treść: Spring Boot upraszcza tworzenie samodzielnych aplikacji Spring.'], commands: [],
    caution: 'Nie zapisuj danych wrażliwych ani sekretów do materiałów treningowych.'
  },
  'lab-internet': {
    title: 'Internet — bezpieczny import dokumentów',
    summary: 'Pozwala pobrać podgląd pojedynczej strony z dozwolonej domeny i ręcznie zaakceptować import.',
    status: 'Nie jest to jeszcze autonomiczne, ciągłe przeszukiwanie internetu przez agenta.',
    steps: ['Wklej adres HTTPS z dozwolonej domeny.', 'Kliknij „Pobierz podgląd”.', 'Przeczytaj treść i kliknij „Zatwierdź import”.', 'Wiedza stanie się dostępna w Reasoning.'],
    examples: ['https://angular.dev/overview', 'https://docs.oracle.com/en/java/'], commands: [],
    caution: 'Treści internetu są danymi nieufnymi — nie mogą automatycznie stać się instrukcjami wykonywanymi przez Jarvisa.'
  },
  'lab-ranking': {
    title: 'Training — ranking źródeł',
    summary: 'Trenuje niewielki ranker wybierający trafniejsze dokumenty do odpowiedzi.',
    status: 'Nie trenuje wag Qwen3 8B.',
    steps: ['Zadaj pytania w Reasoning i oceniaj wskazane źródła.', 'Zbierz minimum 8 ocen, w tym co najmniej 3 trafne i 3 nietrafne.', 'Kliknij „Trenuj ranking”.', 'Porównaj walidację; w razie potrzeby cofnij zmianę.'],
    examples: ['Źródło o Angularze przy pytaniu o Signals → trafne.', 'Źródło o CSS przy pytaniu o Javę → nietrafne.'], commands: [],
    caution: 'Poprawa rankera nie oznacza, że główny LLM nauczył się nowych umiejętności.'
  },
  mining: {
    title: 'Mining / Bitcoin',
    summary: 'Oddzielny moduł aplikacji. Jego funkcje będą rozwijane niezależnie od AI Lab.',
    status: 'Zakres rzeczywistego mining-u i monitoringu wymaga osobnej implementacji.',
    steps: ['Otwórz zakładkę Mining.', 'Sprawdź dostępne wskaźniki i konfigurację.', 'Nie uruchamiaj rzeczywistego kopania bez oceny opłacalności, poboru prądu i temperatury GPU.'],
    examples: ['Porównaj koszt 1 kWh z przychodem.', 'Monitoruj temperaturę i pobór energii RTX 3080.'],
    commands: [{ label: 'Sprawdź moc i temperaturę GPU', value: 'nvidia-smi --query-gpu=temperature.gpu,power.draw,power.limit --format=csv' }],
    caution: 'Moduł mining nie powinien wykorzystywać GPU automatycznie ani uruchamiać obciążeń bez Twojej zgody.'
  },
  security: {
    title: 'Security — diagnostyka bezpieczeństwa',
    summary: 'Wyświetla stan kontroli bezpieczeństwa. Rzeczywiste mechanizmy ochronne działają w backendzie i Electronie.',
    status: 'Panel nie zastępuje autoryzacji ani kontroli uprawnień.',
    steps: ['Otwórz zakładkę Security.', 'Przejrzyj kontrole połączenia, Electrona i backendu.', 'Jeżeli pojawia się błąd, sprawdź logi aplikacji i testy.'],
    examples: ['Czy IPC sprawdza zaufanego nadawcę?', 'Czy niedozwolona ścieżka workspace jest odrzucana?'],
    commands: [{ label: 'Testy polityki bezpieczeństwa Electron', value: 'node --test desktop/electron/security-policy.test.cjs' }]
  },
  radio: {
    title: 'Radio — odtwarzacz',
    summary: 'Panel radia dostępny w górnym pasku aplikacji.',
    status: 'Odtwarzanie transmisji wymaga internetu; lista stacji i dostępność zależą od źródeł.',
    steps: ['Kliknij ikonę radia w prawym górnym rogu.', 'Wybierz stację i uruchom odtwarzanie.', 'Reguluj głośność w panelu.', 'Gdy strumień jest niedostępny, wybierz inną stację.'],
    examples: ['Wybierz stację z listy.', 'Wyłącz radio po zakończeniu słuchania.'], commands: []
  }
};
