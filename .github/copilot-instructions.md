# GitHub Copilot — J.A.R.V.I.S.

Przeczytaj główny `AGENTS.md`, `README.md`, `docs/JARVIS-ROADMAP.md` i odpowiedni skill (`.github/skills/jarvis-development/SKILL.md` lub `.github/skills/jarvis-llm/SKILL.md`).

- Stack: Angular 22 Signals/SCSS/Vitest/Playwright, Electron sandbox + IPC, Java 21 Spring Boot, własny edukacyjny Transformer, docelowo PostgreSQL.
- Przed edycją przeczytaj faktyczne pliki w lokalnej gałęzi. Nie nadpisuj pracy użytkownika na podstawie starych tutoriali.
- Twórz małe zmiany i aktualizuj testy. Frontend = Vitest + Angular build + Playwright E2E; backend = JUnit; desktop = node --test.
- Podawaj pełne ścieżki od `BawarJARVIS-/`, polecenia tworzenia plików i instrukcje Git Bash/Windows.
- Nie przedstawiaj niewytrenowanego modelu jako działającego inteligentnego chatbota.
- Internet: tylko przez kontrolowany backend i jawne narzędzia; żadnych dowolnych URL w IPC, żadnego autonomicznego wykonywania poleceń czy trenowania na stronach WWW.
- Nie zapisuj tokenów w frontendzie i nie zapisuj trwałej historii czatu w localStorage. Docelowo użyj Spring Boot + PostgreSQL.
- Nowe przyciski muszą mieć rzeczywiste działanie, etykiety dostępności i stan niedostępności.
- Weryfikuj oraz raportuj realny stan testów. Nie twierdź, że lokalny Maven/Angular przechodzi, jeśli nie został uruchomiony.
