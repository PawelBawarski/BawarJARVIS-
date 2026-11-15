/** Context help is local/static: no network, no credentials, no hidden side effects. */
export type HelpTopic = 'chat' | 'lab' | 'lab-training' | 'lab-workspace' | 'lab-offline' |
  'lab-reasoning' | 'lab-learning' | 'lab-internet' | 'lab-ranking' | 'security' | 'radio';

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
    title: 'Czat — lokalny Qwen3 8B',
    summary: 'Rozmowy są zapisywane przez Spring Boot w PostgreSQL. Odpowiedzi generuje Qwen3 uruchamiany lokalnie przez llama.cpp. Przygotowywanie odpowiedzi może zależeć od CPU, GPU i wielkości modelu.',
    status: 'Spring Boot może działać bez Qwena. Do generowania odpowiedzi potrzebne są llama-server i GGUF. Odczyt głosowy wymaga osobno skonfigurowanego Pipera. Opcjonalne wyszukiwanie internetowe działa przez darmową, lokalną instancję SearXNG w Dockerze i przełącznik w Settings.',
    steps: [
      'Uruchom Docker Desktop i skonfigurowaną bazę PostgreSQL.',
      'W frontend/.env.model.local podaj pełne ścieżki JARVIS_LLAMA_SERVER_PATH oraz JARVIS_GGUF_PATH. Przyspieszenie GPU skonfiguruj przez JARVIS_GPU_LAYERS, jeśli Twoja wersja llama.cpp je obsługuje.',
      'W katalogu frontend uruchom npm run dev:electron:ai. Startuje lokalny model, Spring Boot, Angular i Electron.',
      'Bez modelu uruchom npm run dev:electron; możesz przeglądać historię, ale Qwen nie wygeneruje odpowiedzi.',
      'W menu u góry Chatu włącz lub wyłącz automatyczne czytanie nowych odpowiedzi. Mikrofon wymaga osobnego kliknięcia.',
      'W katalogu głównym uruchom docker compose -f docker-compose.searxng.yml up -d. Następnie w Settings włącz Dostęp do internetu. Ustawienie zapisuje się w PostgreSQL; bez niego internet jest wyłączony.',
      'Niektóre pytania mogą wymagać weryfikacji źródeł; Jarvis nie powinien uznawać tekstów stron za polecenia.'
    ],
    examples: ['Wyjaśnij Angular Signals.', 'Napisz test JUnit dla Spring Boot.', 'Sprawdź w internecie aktualne informacje o Spring Boot.'],
    commands: [
      { label: 'Start SearXNG (Docker)', value: 'docker compose -f docker-compose.searxng.yml up -d' },
      { label: 'Start desktopu i lokalnego Qwena', value: 'cd frontend && npm run dev:electron:ai' },
      { label: 'Start desktopu bez Qwena', value: 'cd frontend && npm run dev:electron' },
      { label: 'Test konfiguracji modelu', value: 'cd frontend && npm run test:model' },
      { label: 'Sprawdź NVIDIA GPU', value: 'nvidia-smi' }
    ],
    caution: 'Wyniki internetu mogą być błędne. Włączenie internetu wysyła pytanie do wyszukiwarek przez SearXNG. Nigdy nie przesyłaj haseł ani sekretów w treści zapytań.'
  },
  lab: {
    title: 'AI Lab — wiedza, trening i agent',
    summary: 'Trzy obszary: pamięć i źródła, dostrajanie Qwen3-0.6B (LoRA) oraz analiza kodu.',
    status: 'Trening LoRA na GPU działa po włączeniu JARVIS_LORA_TRAINING_ENABLED. Qwen3 8B używany w Czacie pozostaje osobnym modelem.',
    steps: [
      'Wiedza i źródła: wyszukaj źródła, zatwierdź wpisy, importuj dokumenty albo zapisz notatkę do PostgreSQL.',
      'Trening modeli AI: uruchom SearXNG, wyszukaj propozycje, sprawdź pytania i odpowiedzi oraz zatwierdź co najmniej dwa przykłady.',
      'Utwórz zbiór treningowy, wybierz go w sekcji LoRA, ustaw kroki i uruchom trening; obserwuj loss, VRAM i historię.',
      'Agent i analiza kodu: dodaj wybrane fragmenty kodu, opisz zadanie i oceń proponowane zmiany. Żadne pliki nie są automatycznie zmieniane.',
      'Wszystkie sekcje są domyślnie zwinięte. Rozwijaj wyłącznie tę, z której aktualnie korzystasz.'
    ],
    examples: [
      'Wyszukaj instrukcję Angular Signals, zweryfikuj źródło i zatwierdź przykłady do LoRA.',
      'Dostrój Qwen3-0.6B na zatwierdzonym zbiorze, a potem porównaj odpowiedzi przed i po treningu.',
      'Dodaj fragment komponentu Angular i poproś agenta o propozycję refaktoryzacji.'
    ],
    commands: [
      { label: 'Uruchom J.A.R.V.I.S. z treningiem (Git Bash)', value: 'export JARVIS_LORA_TRAINING_ENABLED=true && cd frontend && npm run dev:electron:ai' },
      { label: 'Sprawdź trening Python', value: 'python -m unittest discover -s training/tests -v' },
      { label: 'Backend Java', value: 'cd backend && ./mvnw.cmd clean verify' }
    ],
    caution: 'Źródła internetowe wymagają weryfikacji; LoRA trenuje adapter modelu 0.6B, nie zastępuje automatycznie modelu 8B w Czacie. Nie dodawaj sekretów do źródeł lub danych treningowych.'
  },
  'lab-training': {
    title: 'AI Lab — trening i historia modeli',
    summary: 'Eksperymentalny, mały Transformer w Javie (nie Qwen3). Dalszy trening Qwen3 wymaga pobierania danych, weryfikacji licencji i jakości, fine-tuningu LoRA/QLoRA, ewaluacji oraz zatwierdzonej zamiany checkpointu. Sam import stron nie zmienia wag modelu.',
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

/** Localized Chat guide. Other module guides are migrated separately. */
export const CHAT_HELP_EN: HelpGuide = {
  title: 'Chat — local Qwen3 8B',
  summary: 'Spring Boot stores conversations in PostgreSQL. llama.cpp runs Qwen3 locally. Response latency depends on CPU, GPU and model size.',
  status: 'Spring Boot can run without Qwen. Replies require llama-server and GGUF; speech requires Piper. Optional search uses a free local Docker SearXNG instance and a persistent Settings toggle.',
  steps: [
    'Start Docker Desktop and the configured PostgreSQL instance.',
    'Set absolute JARVIS_LLAMA_SERVER_PATH and JARVIS_GGUF_PATH paths in frontend/.env.model.local. Configure JARVIS_GPU_LAYERS for compatible GPU acceleration.',
    'From frontend run npm run dev:electron:ai to start the model, Spring Boot, Angular and Electron.',
    'Without the model use npm run dev:electron to access existing conversations, not Qwen replies.',
    'Use the Chat header menu to toggle automatic narration of new replies; microphone use always requires a separate click.',
    'Run docker compose -f docker-compose.searxng.yml up -d from the repository root, then enable Internet access in Settings. The preference is stored in PostgreSQL.',
    'Verify web sources independently. Website content is untrusted data, not application instructions.'
  ],
  examples: ['Explain Angular Signals.', 'Write a Spring Boot JUnit test.', 'Search the web for current Spring Boot changes.'],
  commands: [
    { label: 'Start SearXNG (Docker)', value: 'docker compose -f docker-compose.searxng.yml up -d' },
    { label: 'Start desktop with local Qwen', value: 'cd frontend && npm run dev:electron:ai' },
    { label: 'Start desktop without model', value: 'cd frontend && npm run dev:electron' },
    { label: 'Test local model configuration', value: 'cd frontend && npm run test:model' },
    { label: 'Check NVIDIA GPU', value: 'nvidia-smi' }
  ],
  caution: 'Web sources may be inaccurate. Enabling internet sends search terms to external engines via SearXNG. Never search for passwords or secrets.'
};
