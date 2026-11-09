$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$build = Join-Path $root 'build'
New-Item -ItemType Directory -Force $build | Out-Null
$src = Get-ChildItem (Join-Path $root 'src/main/java') -Filter '*.java' -Recurse | ForEach-Object { $_.FullName }
& javac -encoding UTF-8 --add-modules jdk.httpserver -d $build $src
if ($LASTEXITCODE -ne 0) { throw 'Kompilacja silnika Java nie powiodla sie' }
& java --add-modules jdk.httpserver -cp $build jarvis.offline.ServerMain
