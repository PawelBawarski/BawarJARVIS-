#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT="$ROOT/docs/modernization/chat-performance"
mkdir -p "$REPORT"
SUM="$REPORT/summary.txt"
printf 'CHAT PERFORMANCE / WEB / VOICE GATE\n' > "$SUM"
failed=0
run() {
  local label="$1" folder="$2"; shift 2
  echo "RUN $label"
  if (cd "$folder" && "$@") > "$REPORT/$label.log" 2>&1; then
    echo "$label: PASS" | tee -a "$SUM"
  else
    local code=$?
    echo "$label: FAIL($code)" | tee -a "$SUM"
    tail -n 30 "$REPORT/$label.log"
    failed=1
  fi
}
run frontend-unit "$ROOT/frontend" env CI=true npm test
run web-key-isolation "$ROOT/frontend" node --test scripts/web-secret-env.test.cjs
run frontend-build "$ROOT/frontend" npm run build
run frontend-i18n "$ROOT/frontend" npm run check:i18n
run frontend-e2e "$ROOT/frontend" ./node_modules/.bin/playwright test --workers=2
run backend-verify "$ROOT/backend" ./mvnw.cmd verify
run electron "$ROOT/frontend" npm run test:electron
run git-diff "$ROOT" git diff --check
if [ "$failed" -eq 0 ]; then echo 'CHAT PERFORMANCE GATE: PASS' | tee -a "$SUM"; else echo 'CHAT PERFORMANCE GATE: FAIL' | tee -a "$SUM"; fi
exit "$failed"
