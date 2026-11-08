# J.A.R.V.I.S. — naprawa kompilacji UI 9.5.3

Wszystkie ścieżki w ZIP są liczone od katalogu głównego `BawarJARVIS-/`.

1. Upewnij się, że nie masz niezacommitowanych zmian w plikach, które podmieniasz; najpierw wykonaj `git diff` lub kopię zapasową.
2. Rozpakuj ZIP. Skopiuj wszystkie pliki do odpowiadających im folderów projektu.
3. `security-diagnostics.ts` jest NOWY — usuwa TS2307 i błędy `unknown`.
4. `security-dashboard.scss` ZASTĘPUJE obecny plik (usuwa nadmiarowe `}`).
5. `security-diagnostics.spec.ts` jest NOWY: testy jednostkowe serwisu.
6. `security-dashboard.spec.ts` ZASTĘPUJE stare testy, które używały `new SecurityDashboard()` bez kontekstu Angular DI.
7. Sprawdź w frontend/src/app/features/security/security-dashboard/security-dashboard.ts, czy klasa ma `readonly diagnostics = inject(SecurityDiagnosticsService)` i `ngOnInit()` wywołuje `void this.diagnostics.checkBackend()`.
8. Nie uruchamiaj Electrona po nieudanym buildzie. Korzystaj z `npm run build:ui && npm run preview`.
9. Komendę Maven `./mvnw.cmd spring-boot:run` uruchom w osobnym terminalu, nie w tle w Git Bash (unika `stdout is not a tty`).
10. Testy: `cd frontend && npm test -- --watch=false && npm run build && npx playwright test`.

Paczka NIE modyfikuje implementacji zabezpieczeń Spring Security ani Electrona.
