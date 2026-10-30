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
$previousBase = $env:CLI_DOWNLOAD_BASE_URL
$server = $null
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
try {
    New-Item -ItemType Directory -Path $work | Out-Null
    $source = Join-Path $work 'source.exe'
    Set-Content -LiteralPath $source -Value 'first'
    $env:DSBUILDER_INSTALL_DIR = Join-Path $work 'CLI install'
    $installer = Join-Path $distribution 'install-windows-cli.ps1'
    & $installer -Source $source
    & $installer -Source $source
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
    # Сетевой уровень проверяется через реальный loopback HTTP-сервер и ZIP.
    $web = Join-Path $work 'web'
    $release = Join-Path $web 'releases/1.2.3'
    New-Item -ItemType Directory -Path $release -Force | Out-Null
    $package = Join-Path $work 'dsbuilder-cli-windows-x64'
    New-Item -ItemType Directory -Path $package | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $package 'dsbuilder.exe')
    Copy-Item -LiteralPath $installer -Destination (Join-Path $package 'install.ps1')
    $archive = Join-Path $release 'dsbuilder-cli-windows-x64.zip'
    Compress-Archive -LiteralPath $package -DestinationPath $archive
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $release 'SHA256SUMS'), "$hash  dsbuilder-cli-windows-x64.zip`n")
    [IO.File]::WriteAllText((Join-Path $web 'stable.json'), '{"schemaVersion":1,"version":"1.2.3"}')
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    $httpFixture = Join-Path $PSScriptRoot 'installer_http_fixture.py'
    $fixtureArgument = '"' + $httpFixture + '"'
    $server = Start-Process python -ArgumentList @($fixtureArgument, "$port") -WorkingDirectory $web -PassThru -WindowStyle Hidden
    $env:CLI_DOWNLOAD_BASE_URL = "http://127.0.0.1:$port"
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            [void](Invoke-WebRequest -UseBasicParsing -Uri "$env:CLI_DOWNLOAD_BASE_URL/stable.json" -TimeoutSec 1)
            $ready = $true
            break
        } catch { Start-Sleep -Milliseconds 100 }
    }
    if (-not $ready) { throw 'Test HTTP server unavailable' }
    $bootstrap = Join-Path $distribution 'bootstrap/install.ps1'
    & $bootstrap
    & $bootstrap -Version 1.2.3
    $normalBase = $env:CLI_DOWNLOAD_BASE_URL
    $env:CLI_DOWNLOAD_BASE_URL = "$normalBase/redirect"
    $requestsLog = Join-Path $web 'requests.log'
    [IO.File]::WriteAllText($requestsLog, '')
    $failed = $false
    try { & $bootstrap } catch { $failed = $true }
    if (-not $failed) { throw 'Redirect must fail' }
    if (Get-Content -LiteralPath $requestsLog | Where-Object { $_ -eq '/stable.json' }) { throw 'Redirect was followed' }
    if ((Get-Content -LiteralPath $binary).Trim() -ne 'second') { throw 'Redirect changed installed CLI' }
    $env:CLI_DOWNLOAD_BASE_URL = $normalBase
    [IO.File]::WriteAllText((Join-Path $release 'SHA256SUMS'), (('0' * 64) + "  dsbuilder-cli-windows-x64.zip`n"))
    $failed = $false
    try { & $bootstrap } catch { $failed = $true }
    if (-not $failed -or (Get-Content -LiteralPath $binary).Trim() -ne 'second') { throw 'Checksum failure changed CLI' }
    Write-Host 'Windows local and network installer tests passed'
} finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id }
    $env:CLI_DOWNLOAD_BASE_URL = $previousBase
    [Environment]::SetEnvironmentVariable('Path', $userPath, 'User')
    $env:Path = $previousPath
    $env:DSBUILDER_INSTALL_DIR = $previousInstall
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
