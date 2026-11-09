# J.A.R.V.I.S. — AI Lab 12.3: Versioned datasets

## Zakres
- Migracja Flyway V3; nie modyfikuje istniejących V1 i V2.
- Zestawy tekstowe przechowywane w lokalnym PostgreSQL. W odróżnieniu od 12.2, w którym zapisywaliśmy wyłącznie *metryki i skrót korpusu*, tutaj celowo zapisujemy **treść przykładów** — aby można je było powtórnie wykorzystać.
- Każda edycja tworzy nową, niezmienną wersję zbioru. Nie ma endpointu zmiany lub usunięcia istniejących wersji.
- Limit 5–100 unikatowych próbek, maks. 256 znaków Java String na przykład.
- Deterministyczny podział 80/20: posortowane SHA-256 z solą aplikacyjną (stały, publiczny prefiks, nie kryptograficzny sekret). Powtórzenia są odrzucane; podział można odtworzyć, ale **nie ma gwarancji, że podobne semantycznie zdania są niezależne**. Dla wysokiej jakości ewaluacji kolejnym krokiem będzie separacja po tematach/źródłach i analiza przecieku danych.
- Zapis SHA-256 podzbioru walidacyjnego pozwala porównywać ewaluacje tylko przy identycznych przykładach i kolejności. Tu podział jest deterministyczny.
- Endpointy wymagają `ROLE_JARVIS`. Electron dopuszcza wyłącznie ustalone trasy API na 127.0.0.1:8080. Nie dodajemy dowolnych URL ani dostępu do dysku.

## API
- `GET /api/ai-lab/datasets` — lista nazw i najnowszych wersji
- `POST /api/ai-lab/datasets` — nowy zestaw `{name, examples}`
- `GET /api/ai-lab/datasets/{uuid}/versions` — wersje zestawu
- `POST /api/ai-lab/datasets/{uuid}/versions` — nowa wersja `{examples}`
- `GET /api/ai-lab/datasets/versions/{uuid}` — przykłady części treningowej i walidacyjnej

## Właściwości bezpieczeństwa
- Nie używamy uploadu ani importu plików i nie pobieramy treści z internetu.
- Zestawy mogą zawierać poufne dane użytkownika. Nie wpisuj haseł, tokenów ani danych klientów bez upoważnienia. Baza jest lokalna, ale kopie zapasowe i logi też wymagają ochrony.
- Serwis zawiera transakcje dla zapisu nowej wersji; `SELECT ... FOR UPDATE` serializuje współbieżne modyfikacje jednego zbioru.
- Zachowujemy limit 100 przykładów dotychczasowego trenera i limit 100 epok.
- Uruchomienie treningu w panelu zestawów korzysta z dotychczasowego `LabTrainingService`; ewaluacja korzysta z `ModelEvaluator` i zapisuje metryki przez integrację 12.2.
- W tej wersji **nie przypisujemy ID zbioru do historii treningu**; w następnym etapie dołączymy referencję wersji zbioru do uruchomień i metryk.

## Kolejne etapy
- AI Lab 12.4: odtworzenie wybranego checkpointu i powiązanie treningu/ewaluacji z wersją korpusu.
- AI Lab 12.5: import plików tekstowych z walidacją, bez wykonywania ich zawartości.
