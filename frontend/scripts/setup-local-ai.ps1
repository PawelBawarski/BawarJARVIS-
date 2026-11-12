# BawarJARVIS-/frontend/scripts/setup-local-ai.ps1
# J.A.R.V.I.S. 18.1 - one-command Windows x64 CPU llama.cpp + official Qwen3-8B-GGUF setup.
# Official, pinned artifacts, SHA-256 verification, resumes downloads, never changes PostgreSQL.
# Run from Git Bash (in BawarJARVIS-/frontend):
# powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w scripts/setup-local-ai.ps1)"

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not [Environment]::Is64BitOperatingSystem -or $env:OS -ne 'Windows_NT') {
    throw 'Ten skrypt wymaga Windows x64. Wersje ARM64 wymagaja innej paczki.'
}

$frontend = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $PSScriptRoot 'model-runtime.cjs'
if (-not (Test-Path -LiteralPath $runtime -PathType Leaf)) {
    throw 'Brak frontend/scripts/model-runtime.cjs. Uruchom skrypt w repo po zastosowaniu patcha 18.1.'
}

$aiRoot = Join-Path $env:USERPROFILE 'JarvisAI'
$binDir = Join-Path $aiRoot 'llama'
$modelsDir = Join-Path $aiRoot 'models'
$cacheDir = Join-Path $aiRoot 'downloads'
foreach ($dir in @($aiRoot, $binDir, $modelsDir, $cacheDir)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# Explicit release build and hashes verified against the official GitHub release manifest
# and Hugging Face Qwen's official GGUF file page (do not silently switch versions).
$llamaBuild = 'b12283'
$llamaArchive = "llama-$llamaBuild-bin-win-cpu-x64.zip"
$llamaUrl = "https://github.com/ggml-org/llama.cpp/releases/download/$llamaBuild/$llamaArchive"
$llamaSha256 = 'dafb19ac757bfb7cfc1f91c6e26703264df861c4331e3ef6dc9543ae8d010c5e'

$modelName = 'Qwen3-8B-Q4_K_M.gguf'
$modelUrl = "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/$modelName"
$modelSha256 = 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785'

$exePath = Join-Path $binDir 'llama-server.exe'
$modelPath = Join-Path $modelsDir $modelName
$zipPath = Join-Path $cacheDir $llamaArchive
$curlCmd = Get-Command 'curl.exe' -ErrorAction Stop

function Assert-FileHash([string]$file, [string]$sha256) {
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $sha256.ToLowerInvariant()) {
        throw "SHA256_MISMATCH: $file`nOczekiwano: $sha256`nOtrzymano: $actual`nNie uruchamiam niezaufanego lub niekompletnego pliku."
    }
}

function Download-Verified([string]$url, [string]$target, [string]$sha256) {
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        Write-Host "Weryfikacja istniejacego pliku: $target"
        Assert-FileHash $target $sha256
        Write-Host 'SHA256 OK - ponowne pobieranie nie jest potrzebne.'
        return
    }

    $partial = "$target.part"
    if ((Test-Path -LiteralPath $partial -PathType Leaf) -and
        ((Get-Item -LiteralPath $partial).Length -gt 0)) {
        Write-Host "Wznawiam pobieranie: $partial"
    } else {
        Write-Host "Pobieranie: $url"
    }

    # curl.exe is part of Windows 11; -C - resumes a .part file after interruption.
    & $curlCmd.Source --fail --location --show-error --retry 5 --retry-delay 3 `
        --connect-timeout 30 --continue-at - --output $partial $url
    if ($LASTEXITCODE -ne 0) {
        throw "DOWNLOAD_FAILED ($LASTEXITCODE). Pozostawiono $partial - uruchom skrypt ponownie, aby wznowic."
    }
    Assert-FileHash $partial $sha256
    Move-Item -LiteralPath $partial -Destination $target
    Write-Host "Pobrano i zweryfikowano: $target"
}

Write-Host '=== J.A.R.V.I.S. 18.1 / AUTOMATYCZNA INSTALACJA QWEN ==='
Write-Host "Instalacja poza repozytorium: $aiRoot"
Write-Host 'Model wymaga pobrania ok. 5 GB i dodatkowego miejsca na pliki tymczasowe.'

if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
    Download-Verified $llamaUrl $zipPath $llamaSha256
    $staging = Join-Path $cacheDir ("extract-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    try {
        Expand-Archive -LiteralPath $zipPath -DestinationPath $staging
        $server = Get-ChildItem -LiteralPath $staging -Recurse -File -Filter 'llama-server.exe' |
            Select-Object -First 1
        if ($null -eq $server) {
            throw "W poprawnie pobranym ZIP nie znaleziono llama-server.exe: $zipPath"
        }
        # Copy the *whole* binary directory so that its companion DLLs are retained.
        Get-ChildItem -LiteralPath $server.DirectoryName -Force |
            Copy-Item -Destination $binDir -Recurse -Force
        if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
            throw "Nie skopiowano llama-server.exe do $binDir"
        }
    } finally {
        if (Test-Path -LiteralPath $staging) {
            Remove-Item -LiteralPath $staging -Force -Recurse
        }
    }
} else {
    Write-Host "llama-server.exe juz istnieje: $exePath (nie nadpisuje)"
}

# Download the official file. Its exact SHA256 is published by Qwen/Hugging Face.
Download-Verified $modelUrl $modelPath $modelSha256

# Prepare .env.model.local without printing or overwriting any secrets.
$envFile = Join-Path $frontend '.env.model.local'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$updates = @{
    'JARVIS_LLAMA_SERVER_PATH' = $exePath.Replace('\', '/')
    'JARVIS_GGUF_PATH' = $modelPath.Replace('\', '/')
}
$seen = @{}
$lines = [System.Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath $envFile -PathType Leaf) {
    $backupDir = Join-Path $aiRoot 'config-backups'
    if (-not (Test-Path -LiteralPath $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    $backup = Join-Path $backupDir ('.env.model.local-' + [guid]::NewGuid().ToString('N') + '.bak')
    Copy-Item -LiteralPath $envFile -Destination $backup
    Write-Host "Kopia dotychczasowej konfiguracji: $backup"
    foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
        if ($line -match '^(JARVIS_LLAMA_SERVER_PATH|JARVIS_GGUF_PATH)=') {
            $key = $Matches[1]
            if (-not $seen.ContainsKey($key)) {
                $lines.Add($key + '=' + $updates[$key])
                $seen[$key] = $true
            }
        } else {
            $lines.Add($line)
        }
    }
}
foreach ($key in @('JARVIS_LLAMA_SERVER_PATH', 'JARVIS_GGUF_PATH')) {
    if (-not $seen.ContainsKey($key)) { $lines.Add($key + '=' + $updates[$key]) }
}
if (-not ($lines | Where-Object { $_ -match '^JARVIS_GPU_LAYERS=' })) {
    $lines.Add('JARVIS_GPU_LAYERS=0')
}
if (-not ($lines | Where-Object { $_ -match '^JARVIS_CTX_SIZE=' })) {
    $lines.Add('JARVIS_CTX_SIZE=4096')
}
[System.IO.File]::WriteAllText($envFile, (($lines -join "`n") + "`n"), $utf8)
Write-Host "Zapisano konfiguracje: $envFile"

# Fix the one platform-specific test fixture from stage 18.1.
$testFile = Join-Path $PSScriptRoot 'model-runtime.test.cjs'
if (Test-Path -LiteralPath $testFile -PathType Leaf) {
    $old = "JARVIS_LLAMA_SERVER_PATH:'/nonexistent/llama-server'"
    $replacement = "JARVIS_LLAMA_SERVER_PATH:process.platform === 'win32' ? 'C:/nonexistent/llama-server.exe' : '/nonexistent/llama-server'"
    $testText = [System.IO.File]::ReadAllText($testFile)
    if ($testText.Contains($old)) {
        [System.IO.File]::WriteAllText($testFile, $testText.Replace($old, $replacement), $utf8)
        Write-Host 'Poprawiono test dla Windows: model-runtime.test.cjs'
    }
}

Write-Host '=== KONTROLA TESTOW ==='
& node --test $testFile
if ($LASTEXITCODE -ne 0) {
    throw 'Testy Node.js nie przeszly. Nie uruchamiaj jeszcze dev:web:ai.'
}

Write-Host ''
Write-Host 'GOTOWE. Qwen i llama.cpp znajduja sie poza repozytorium.'
Write-Host 'Uruchom Docker (jesli potrzeba), a w frontend: npm run dev:web:ai'
