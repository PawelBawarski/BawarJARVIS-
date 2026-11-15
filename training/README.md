# AI Lab — pierwszy rzeczywisty test LoRA (Qwen3-0.6B)

To jest **samodzielny eksperyment GPU**, nie jest jeszcze połączony z UI Play/Stop, PostgreSQL ani SearXNG. Nic nie zmienia w modelu Czatu (Qwen3 8B, GGUF). Nie udaje uczenia z internetu.

Uruchom z katalogu `BawarJARVIS-`, w aktywnym `.venv-training`:

```bash
python -m unittest discover -s training/tests -v
python training/train_lora.py
python training/train_lora.py --train
```

Pierwszy `--train` pobierze model `Qwen/Qwen3-0.6B` z Hugging Face (około 1,5 GB wag + pliki pomocnicze), uruchomi 6 kroków LoRA na CUDA i zapisze pliki adaptera pod `training/runs/qwen3-0.6b-smoke/adapter/` oraz `progress.json`. Dane w `training/data/starter.jsonl` są wyłącznie oryginalnymi **przykładami technicznymi do testu mechaniki**, nie służą do poprawienia ogólnej wiedzy modelu.

**STOP:** Ctrl+C w tym samym terminalu albo utwórz plik `training/runs/qwen3-0.6b-smoke/STOP`. Zatrzymanie jest kooperatywne: po zakończeniu aktualnego kroku zapisuje checkpoint. W Windows brutalne zamknięcie procesu nie gwarantuje zapisu. Po zatrzymaniu wykonaj nową próbę z innym `--output`; ten test nie obsługuje jeszcze wznowienia stanu optymalizatora.

`progress.json` pokazuje status, krok, stratę i pamięć GPU. LoRA zapisuje adapter; nie zmienia plików bazowego modelu. Przy problemie CUDA OOM wyłącz ciężkie aplikacje i uruchom nową próbę z `--seq-len 64`. Nie używaj tej próbki do automatycznego podmienia modelu produkcyjnego.

Uwaga: w repo ignorujemy `training/runs/` oraz `training/data/private/`; nie umieszczaj prywatnych treści w publicznych przykładach.


## Kontrola procesu (krok następny)

Kontroler `training/control_lora.py` uruchamia `train_lora.py` w **osobnym procesie** i zapisuje PID, identyfikator treningu oraz postęp w `training/runs/`. Nie zmienia backendu, nie zmienia Chatu i nie wysyła danych do Internetu poza pierwszym pobraniem modelu z Hugging Face przez trenera.

```bash
python training/control_lora.py status
python training/control_lora.py start --steps 6 --seq-len 128
python training/control_lora.py status
python training/control_lora.py stop
```

**Uwaga:** po `start` log dostępny jest w `training/runs/<runId>/train.log`; pierwszy start pobiera model. Stop jest kooperatywny. Jeśli proces zawiesi się podczas pobierania modelu, flagę STOP odczyta dopiero po wejściu w pętlę treningową.

To etap CLI przed API Spring Boot i Angular Play/Stop, a nie kompletna integracja UI ani samouczenie z internetu.
