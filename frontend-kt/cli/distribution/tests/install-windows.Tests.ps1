# Запускается на Windows; отсутствие платформы — ошибка, а не успешный пропуск.
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne 'Win32NT') { throw 'Windows test requires Windows' }
$distribution = Split-Path $PSScriptRoot -Parent
foreach ($script in @((Join-Path $distribution 'install-windows-cli.ps1'), (Join-Path $distribution 'bootstrap/install.ps1'))) {
    $tokens = $null
    $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw ($errors | Out-String) }
}
$work = Join-Path ([IO.Path]::GetTempPath()) ('CLI tests with spaces ' + [Guid]::NewGuid())
$previousInstall = $env:DSBUILDER_INSTALL_DIR
$previousPath = $env:Path
$previousBase = $env:CLI_RELEASE_BASE_URL
$server = $null
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
try {
    New-Item -ItemType Directory -Path $work | Out-Null
    $source = Join-Path $work 'source.exe'
    Set-Content -LiteralPath $source -Value 'first'
    $env:DSBUILDER_INSTALL_DIR = Join-Path $work 'CLI install'
    $installer = Join-Path $distribution 'install-windows-cli.ps1'
    & $installer -Source $source -WithoutWeb
    & $installer -Source $source -WithoutWeb
    $entries = @([Environment]::GetEnvironmentVariable('Path', 'User') -split ';' |
        Where-Object { $_ -eq $env:DSBUILDER_INSTALL_DIR })
    if ($entries.Count -ne 1) { throw 'PATH duplicated' }
    $unrelated = Join-Path $env:DSBUILDER_INSTALL_DIR 'keep.txt'
    Set-Content -LiteralPath $unrelated -Value 'keep'
    Set-Content -LiteralPath $source -Value 'second'
    & $installer -Source $source
    $binary = Join-Path $env:DSBUILDER_INSTALL_DIR 'dsbuilder.exe'
    if ((Get-Content -LiteralPath $binary).Trim() -ne 'second') { throw 'Upgrade failed' }
    if (-not (Test-Path -LiteralPath $unrelated)) { throw 'Unrelated file removed' }
    $failed = $false
    try { & $installer -Source (Join-Path $work 'missing.exe') } catch { $failed = $true }
    if (-not $failed -or (Get-Content -LiteralPath $binary).Trim() -ne 'second') { throw 'Missing source changed installed CLI' }
    # Занятый executable запрещает замену; предыдущий файл должен остаться рабочим.
    $locked = [IO.File]::Open($binary, 'Open', 'Read', 'None')
    try {
        $failed = $false
        try { & $installer -Source $source } catch { $failed = $true }
        if (-not $failed) { throw 'Locked executable should prevent replacement' }
    } finally { $locked.Dispose() }
    if ((Get-Content -LiteralPath $binary).Trim() -ne 'second') { throw 'Failed replacement lost old CLI' }
    # Шаг web-генератора: с поддельным npm.cmd он запускается, его ошибка не отменяет установку CLI.
    $fakeNode = Join-Path $work 'fake node'
    New-Item -ItemType Directory -Path $fakeNode | Out-Null
    Set-Content -LiteralPath (Join-Path $fakeNode 'npm.cmd') -Value '@exit /b 0'
    $pathBeforeNode = $env:Path
    $env:Path = "$fakeNode;$env:Path"
    try {
        $warnings = & $installer -Source $source 3>&1 | Where-Object { $_ -is [System.Management.Automation.WarningRecord] }
        if (-not ($warnings | Where-Object { $_.Message -like '*Retry with: dsbuilder toolchain install web*' })) {
            throw 'Failed web generator step was not reported'
        }
        if ((Get-Content -LiteralPath $binary).Trim() -ne 'second') { throw 'Web generator step changed installed CLI' }
        $skipped = & $installer -Source $source -WithoutWeb 3>&1 | Where-Object { $_ -is [System.Management.Automation.WarningRecord] }
        if ($skipped) { throw '-WithoutWeb still ran the web generator step' }
    } finally { $env:Path = $pathBeforeNode }
    # Сетевой уровень проверяется через реальный loopback HTTP-сервер и ZIP.
    $web = Join-Path $work 'web'
    $release = Join-Path $web 'releases/download/cli-v1.2.3'
    New-Item -ItemType Directory -Path $release -Force | Out-Null
    $package = Join-Path $work 'dsbuilder-cli-windows-x64'
    New-Item -ItemType Directory -Path $package | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $package 'dsbuilder.exe')
    Copy-Item -LiteralPath $installer -Destination (Join-Path $package 'install.ps1')
    $archive = Join-Path $release 'dsbuilder-cli-windows-x64.zip'
    # Windows PowerShell 5.1 Compress-Archive записывает обратные разделители путей.
    # Релизный Gradle ZIP использует прямые; тестовый комплект должен повторять его формат.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $testZip = [IO.Compression.ZipFile]::Open($archive, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in Get-ChildItem -LiteralPath $package -File) {
            $entryName = 'dsbuilder-cli-windows-x64/' + $file.Name
            [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($testZip, $file.FullName, $entryName)
        }
    } finally { $testZip.Dispose() }
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $release 'SHA256SUMS'), "$hash  dsbuilder-cli-windows-x64.zip`n")
    $artifacts = [ordered]@{}
    foreach ($target in @('macos-arm64', 'macos-x64', 'windows-x64', 'jvm')) {
        $artifacts[$target] = [ordered]@{file="dsbuilder-cli-$target.zip"; sha256=$hash}
    }
    $manifest = [ordered]@{schemaVersion=1; version='1.2.3'; iosCliReleaseTag='release-14-10-2026'; artifacts=$artifacts} | ConvertTo-Json -Depth 5 -Compress
    $latest = Join-Path $web 'releases/latest/download'
    New-Item -ItemType Directory -Path $latest -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $latest 'release.json'), $manifest)
    [IO.File]::WriteAllText((Join-Path $release 'release.json'), $manifest)
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    $httpFixture = Join-Path $PSScriptRoot 'installer_http_fixture.py'
    $fixtureArgument = '"' + $httpFixture + '"'
    $server = Start-Process python -ArgumentList @($fixtureArgument, "$port") -WorkingDirectory $web -PassThru -WindowStyle Hidden
    $env:CLI_RELEASE_BASE_URL = "http://127.0.0.1:$port"
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            [void](Invoke-WebRequest -UseBasicParsing -Uri "$env:CLI_RELEASE_BASE_URL/releases/latest/download/release.json" -TimeoutSec 1)
            $ready = $true
            break
        } catch { Start-Sleep -Milliseconds 100 }
    }
    if (-not $ready) { throw 'Test HTTP server unavailable' }
    $bootstrap = Join-Path $distribution 'bootstrap/install.ps1'
    & $bootstrap -WithoutWeb
    & $bootstrap -Version 1.2.3 -WithoutWeb
    $normalBase = $env:CLI_RELEASE_BASE_URL
    $env:CLI_RELEASE_BASE_URL = "$normalBase/redirect"
    $requestsLog = Join-Path $web 'requests.log'
    [IO.File]::WriteAllText($requestsLog, '')
    & $bootstrap -WithoutWeb
    if (-not (Get-Content -LiteralPath $requestsLog | Where-Object { $_ -eq '/releases/latest/download/release.json' })) { throw 'Redirect was not followed' }
    $env:CLI_RELEASE_BASE_URL = $normalBase
    [IO.File]::WriteAllText((Join-Path $release 'SHA256SUMS'), (('0' * 64) + "  dsbuilder-cli-windows-x64.zip`n"))
    $failed = $false
    try { & $bootstrap } catch { $failed = $true }
    if (-not $failed -or (Get-Content -LiteralPath $binary).Trim() -ne 'second') { throw 'Checksum failure changed CLI' }
    Write-Host 'Windows local and network installer tests passed'
} finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id }
    $env:CLI_RELEASE_BASE_URL = $previousBase
    [Environment]::SetEnvironmentVariable('Path', $userPath, 'User')
    $env:Path = $previousPath
    $env:DSBUILDER_INSTALL_DIR = $previousInstall
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
