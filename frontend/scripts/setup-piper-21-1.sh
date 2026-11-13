#!/usr/bin/env bash
# J.A.R.V.I.S. Windows 11 Git Bash. Official Piper Windows release + voices.
set -euo pipefail
[[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]] || { echo 'Uruchom w Git Bash na Windows.' >&2; exit 1; }
ROOT="$HOME/JarvisAI"
BIN="$ROOT/piper"
MODELS="$ROOT/models"
DL="$ROOT/downloads"
mkdir -p "$BIN" "$MODELS" "$DL"
ZIP="$DL/piper_windows_amd64-2023.11.14-2.zip"
BASE='https://huggingface.co/rhasspy/piper-voices/resolve/main'

# Official model digests shown in Hugging Face file metadata (not just archive filenames).
PL_SHA='38f66464240ed74f186e6b7dc13c6e3b22e023426299f25c2b3cc9dfa9373fbc'
EN_SHA='cf9ccdec59f05adee47173f6fb4d89e8b0c5f30c178748d2572fe4efd1d2724c'
verify() { printf '%s  %s\n' "$2" "$1" | sha256sum -c - >/dev/null; }
fetch() {
  local url="$1" target="$2" digest="${3:-}"
  if [[ -f "$target" ]] && { [[ -z "$digest" ]] || verify "$target" "$digest"; }; then
    echo "Już pobrano: $(basename "$target")"; return 0
  fi
  if [[ -f "$target" ]] && [[ -n "$digest" ]]; then mv -f "$target" "$target.invalid"; fi
  local part="$target.part"
  echo "Pobieranie: $(basename "$target")"
  curl.exe --fail --location --retry 5 --retry-delay 3 --continue-at - \
    --output "$(cygpath -w "$part")" "$url"
  if [[ -n "$digest" ]]; then
    verify "$part" "$digest" || { echo "Nieprawidłowy SHA256: $target" >&2; exit 1; }
  fi
  mv -f "$part" "$target"
}

if [[ ! -f "$BIN/piper.exe" ]]; then
  fetch 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip' "$ZIP"
  EXTRACT="$DL/piper-21-1-extract"
  mkdir -p "$EXTRACT"
  powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath '$(cygpath -w "$ZIP")' -DestinationPath '$(cygpath -w "$EXTRACT")' -Force"
  FOUND="$(find "$EXTRACT" -type f -iname 'piper.exe' -print -quit)"
  [[ -n "$FOUND" ]] || { echo 'Brak piper.exe w ZIP' >&2; exit 1; }
  cp -R "$(dirname "$FOUND")/." "$BIN/"
  echo 'Piper unpacked with DLLs and espeak-ng-data.'
fi
[[ -f "$BIN/piper.exe" ]] || { echo 'Brak piper.exe' >&2; exit 1; }

PL="$MODELS/pl_PL-gosia-medium.onnx"
EN="$MODELS/en_US-amy-medium.onnx"
fetch "$BASE/pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx" "$PL" "$PL_SHA"
fetch "$BASE/en/en_US/amy/medium/en_US-amy-medium.onnx" "$EN" "$EN_SHA"
fetch "$BASE/pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx.json" "$PL.json"
fetch "$BASE/en/en_US/amy/medium/en_US-amy-medium.onnx.json" "$EN.json"
# Config must be JSON and contain model sample-rate/phoneme data.
node -e "for(const f of process.argv.slice(1)) { const o=require(f); if (!o.audio?.sample_rate || !o.phoneme_id_map) process.exit(1) }" "$(cygpath -w "$PL.json")" "$(cygpath -w "$EN.json")"

ENV="$(cd "$(dirname "$0")/../../backend" && pwd)/.env.jarvis"
[[ -f "$ENV" ]] || { echo "Brak $ENV" >&2; exit 1; }
add_env() { grep -q "^$1=" "$ENV" || printf '\n%s=%s\n' "$1" "$2" >> "$ENV"; }
add_env JARVIS_PIPER_ENABLED true
add_env JARVIS_PIPER_PATH "$(cygpath -m "$BIN/piper.exe")"
add_env JARVIS_PIPER_MODEL_PL "$(cygpath -m "$PL")"
add_env JARVIS_PIPER_MODEL_EN "$(cygpath -m "$EN")"
echo 'PIPER_OK: binaries, models and JSON configs ready.'
echo 'Uwaga: istniejące JARVIS_PIPER_* zachowane; sprawdź je po instalacji.'
echo 'Uruchom: npm run dev:web:ai'
