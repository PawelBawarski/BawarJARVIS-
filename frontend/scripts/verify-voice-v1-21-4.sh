#!/usr/bin/env bash
# Run from Git Bash on Windows. Stops at the first failure (no hidden success).
set -euo pipefail
cd "$(dirname "$0")/.."

printf '\n[Voice V1] Installer regression\n'
node --test \
  scripts/install-stage21-0.test.cjs \
  scripts/install-stage21-1.test.cjs \
  scripts/install-stage21-2.test.cjs \
  scripts/install-stage21-3.test.cjs \
  scripts/install-stage21-4.test.cjs

printf '\n[Voice V1] Translations, Angular unit tests and production build\n'
npm run check:i18n
npm test -- --watch=false
npm run build

printf '\n[Voice V1] Browser end-to-end tests\n'
npx playwright test \
  e2e/voice-dictation-21-0.e2e.spec.ts \
  e2e/voice-read-aloud-21-1.e2e.spec.ts \
  e2e/voice-queue-21-2.e2e.spec.ts \
  e2e/voice-conversation-21-3.e2e.spec.ts \
  e2e/voice-diagnostics-21-4.e2e.spec.ts \
  e2e/voice-fallback-21-4.e2e.spec.ts

printf '\n[Voice V1] Spring Boot unit tests\n'
cd ../backend
./mvnw.cmd -Dtest=LocalSpeechServiceTest,LocalPiperServiceTest test

printf '\n[Voice V1] All automated checks completed successfully.\n'
