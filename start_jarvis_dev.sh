#!/usr/bin/env bash
# J.A.R.V.I.S. DEV: start the database, Spring Boot, Angular and Electron in order.
# Run from Git Bash: bash start_jarvis_dev.sh
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

for file in \
  "$ROOT/backend/.env.jarvis" \
  "$ROOT/backend/compose.db.yml" \
  "$ROOT/backend/mvnw.cmd" \
  "$ROOT/frontend/package.json" \
  "$ROOT/desktop/package.json"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Missing file: $file" >&2
    echo 'Put start_jarvis_dev.sh in the BawarJARVIS- repository root.' >&2
    exit 1
  fi
done

for program in docker node npm curl; do
  if ! command -v "$program" >/dev/null 2>&1; then
    echo "ERROR: Missing command: $program" >&2
    exit 1
  fi
done

BACKEND_PID=''
FRONTEND_PID=''
cleanup() {
  local pid
  for pid in "$FRONTEND_PID" "$BACKEND_PID"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT

# The PostgreSQL credentials and API token are inherited by the Spring Boot and Electron processes.
set -a
# shellcheck source=/dev/null
source "$ROOT/backend/.env.jarvis"
set +a
if [[ -z "${JARVIS_SESSION_TOKEN:-}" ]]; then
  export JARVIS_SESSION_TOKEN="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
fi

echo '[1/4] Starting PostgreSQL...'
if ! (cd "$ROOT/backend" && docker compose --env-file .env.jarvis -f compose.db.yml up -d --wait); then
  echo 'ERROR: Docker/PostgreSQL failed to start.' >&2
  exit 1
fi

echo '[2/4] Starting Spring Boot...'
(cd "$ROOT/backend" && ./mvnw.cmd spring-boot:run) &
BACKEND_PID=$!

backend_ready=0
last_status='000'
for ((attempt=1; attempt<=90; attempt++)); do
  last_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --max-time 2 -H "X-Jarvis-Session: $JARVIS_SESSION_TOKEN" \
    'http://127.0.0.1:8080/api/chats' || true)"
  if [[ "$last_status" == '200' ]]; then
    backend_ready=1
    break
  fi
  if [[ "$last_status" == '401' || "$last_status" == '403' ]]; then
    echo 'ERROR: Chat API denies this session (401/403).' >&2
    echo 'A previous backend may be running with another token. Stop old backend processes and rerun.' >&2
    exit 1
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo 'ERROR: Spring Boot process exited. Check its log above.' >&2
    exit 1
  fi
  sleep 1
done
if [[ "$backend_ready" -ne 1 ]]; then
  echo "ERROR: Chat API did not become ready; last HTTP status: $last_status" >&2
  echo 'Check Spring Boot and PostgreSQL logs above.' >&2
  exit 1
fi

echo '[3/4] Starting Angular at http://127.0.0.1:4200 ...'
(cd "$ROOT/frontend" && npm start -- --host 127.0.0.1 --port 4200) &
FRONTEND_PID=$!

frontend_ready=0
for ((attempt=1; attempt<=90; attempt++)); do
  if curl --silent --fail --output /dev/null --max-time 2 'http://127.0.0.1:4200/'; then
    frontend_ready=1
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo 'ERROR: Angular process exited. Check its log above.' >&2
    exit 1
  fi
  sleep 1
done
if [[ "$frontend_ready" -ne 1 ]]; then
  echo 'ERROR: Angular did not become available at 127.0.0.1:4200.' >&2
  exit 1
fi

echo '[4/4] Backend and Angular are available. Starting Electron...'
(cd "$ROOT/desktop" && npm run dev)
