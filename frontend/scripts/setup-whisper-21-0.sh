#!/usr/bin/env bash
# Windows 11 Git Bash. Downloads only official Whisper CLI and multilingual base model.
set -euo pipefail
ROOT="$HOME/JarvisAI"
BIN="$ROOT/whisper"
MODEL="$ROOT/models"
DOWNLOAD="$ROOT/downloads"
mkdir -p "$BIN" "$MODEL" "$DOWNLOAD"
ZIP="$DOWNLOAD/whisper-bin-x64-b5454.zip"
MODEL_FILE="$MODEL/ggml-base.bin"
WHISPER_SHA="6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb"
MODEL_SHA="60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"

checksum() { printf '%s  %s\n' "$2" "$1" | sha256sum -c -; }
if [[ ! -f "$BIN/whisper-cli.exe" ]]; then
  echo 'Downloading Whisper 1.9.5 CPU Windows binary (verified sha256)...'
  if [[ ! -f "$ZIP" ]] || ! checksum "$ZIP" "$WHISPER_SHA" >/dev/null 2>&1; then
    curl.exe --fail --location --retry 5 --retry-delay 3 --continue-at - \
      --output "$(cygpath -w "$ZIP")" \
      'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip'
  fi
  checksum "$ZIP" "$WHISPER_SHA"
  EXTRACT="$DOWNLOAD/whisper-b5454-unpacked"
  mkdir -p "$EXTRACT"
  powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath '$(cygpath -w "$ZIP")' -DestinationPath '$(cygpath -w "$EXTRACT")' -Force"
  FOUND="$(find "$EXTRACT" -type f -iname 'whisper-cli.exe' -print -quit)"
  [[ -n "$FOUND" ]] || { echo 'whisper-cli.exe not found in archive' >&2; exit 1; }
  cp -R "$(dirname "$FOUND")/." "$BIN/"
fi
[[ -f "$BIN/whisper-cli.exe" ]] || { echo 'Whisper binary missing' >&2; exit 1; }

echo 'Downloading Whisper multilingual base model (~148 MB)...'
if [[ ! -f "$MODEL_FILE" ]] || ! checksum "$MODEL_FILE" "$MODEL_SHA" >/dev/null 2>&1; then
  curl.exe --fail --location --retry 5 --retry-delay 3 --continue-at - \
    --output "$(cygpath -w "$MODEL_FILE")" \
    'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
fi
checksum "$MODEL_FILE" "$MODEL_SHA"

ENV_FILE="$(cd "$(dirname "$0")/../../backend" && pwd)/.env.jarvis"
[[ -f "$ENV_FILE" ]] || { echo "Missing: $ENV_FILE" >&2; exit 1; }
add_env() { grep -q "^$1=" "$ENV_FILE" || printf '\n%s=%s\n' "$1" "$2" >> "$ENV_FILE"; }
add_env JARVIS_VOICE_ENABLED true
add_env JARVIS_WHISPER_CLI_PATH "$(cygpath -m "$BIN/whisper-cli.exe")"
add_env JARVIS_WHISPER_MODEL_PATH "$(cygpath -m "$MODEL_FILE")"

echo 'OK: Whisper and model present. Start Jarvis using npm run dev:web:ai.'
echo 'Note: existing voice env values were preserved, not overwritten.'
