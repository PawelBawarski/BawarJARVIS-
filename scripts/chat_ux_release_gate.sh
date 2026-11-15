#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
REPORT="$ROOT/docs/modernization/chat-ux"
mkdir -p "$REPORT"
SUMMARY="$REPORT/summary.txt"
printf 'CHAT UX RELEASE GATE\n====================\n' > "$SUMMARY"
failed=0
run_check() {
  local name="$1"; local cwd="$2"; shift 2
  echo "RUN $name"
  if (cd "$cwd" && "$@") >"$REPORT/$name.log" 2>&1; then
    echo "$name: PASS" | tee -a "$SUMMARY"
  else
    local exitcode=$?
    echo "$name: FAIL($exitcode)" | tee -a "$SUMMARY"
    tail -n 28 "$REPORT/$name.log"
    failed=1
  fi
}
run_check unit "$FRONTEND" env CI=true npm test
run_check e2e "$FRONTEND" ./node_modules/.bin/playwright test --workers=2
run_check build "$FRONTEND" npm run build
run_check i18n "$FRONTEND" npm run check:i18n
run_check styles "$FRONTEND" npm run audit:styles
run_check electron "$FRONTEND" npm run test:electron
run_check git-diff "$ROOT" git diff --check
if [ "$failed" -eq 0 ]; then
  echo 'CHAT UX RELEASE GATE: PASS' | tee -a "$SUMMARY"
else
  echo 'CHAT UX RELEASE GATE: FAIL' | tee -a "$SUMMARY"
fi
exit "$failed"
