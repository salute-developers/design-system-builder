param(
    [string]$Source = (Join-Path $PSScriptRoot 'dsbuilder.exe'),
    # Не ставить web-генератор: он нужен только для React и требует Node.js и сети.
    [switch]$WithoutWeb
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "Cannot find dsbuilder.exe at $Source" }
$installDir = if ($env:DSBUILDER_INSTALL_DIR) { $env:DSBUILDER_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'DSBuilder\cli' }
if (-not [IO.Path]::IsPathRooted($installDir)) { throw 'Install directory must be absolute' }
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
$installed = Join-Path $installDir 'dsbuilder.exe'
$temp = Join-Path $installDir ([Guid]::NewGuid().ToString() + '.tmp')
$backup = Join-Path $installDir ([Guid]::NewGuid().ToString() + '.bak')
$oldUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$oldProcessPath = $env:Path
$hadOld = $false
$replaced = $false
try {
    Copy-Item -LiteralPath $Source -Destination $temp
    if (Test-Path -LiteralPath $installed) {
        Move-Item -LiteralPath $installed -Destination $backup
        $hadOld = $true
    }
    Move-Item -LiteralPath $temp -Destination $installed
    $replaced = $true
    $entries = @($oldUserPath -split ';' | Where-Object { $_ })
    if (-not ($entries | Where-Object { $_.TrimEnd('\') -ieq $installDir.TrimEnd('\') })) {
        [Environment]::SetEnvironmentVariable('Path', (($entries + $installDir) -join ';'), 'User')
    }
    if (-not (($env:Path -split ';') | Where-Object { $_.TrimEnd('\') -ieq $installDir.TrimEnd('\') })) {
        $env:Path = "$installDir;$env:Path"
    }
} catch {
    if ($replaced) { Remove-Item -LiteralPath $installed -Force }
    if ($hadOld) { Move-Item -LiteralPath $backup -Destination $installed }
    [Environment]::SetEnvironmentVariable('Path', $oldUserPath, 'User')
    $env:Path = $oldProcessPath
    throw
} finally {
    Remove-Item -LiteralPath $temp, $backup -Force -ErrorAction SilentlyContinue
}
Write-Host "Installed dsbuilder.exe to $installed"
Write-Host 'Open a new terminal to use dsbuilder from any directory.'
# Web-генератор ставится после установки CLI и не отменяет её: шагу нужны npm и сеть.
if (-not $WithoutWeb) {
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        Write-Warning 'npm was not found, the React generator was not installed. Install Node.js 22+ and run: dsbuilder toolchain install web'
    } else {
        $webInstalled = $false
        try {
            & $installed toolchain install web
            $webInstalled = $LASTEXITCODE -eq 0
        } catch {
            Write-Warning $_.Exception.Message
        }
        if (-not $webInstalled) {
            Write-Warning 'The React generator was not installed, see the output above. dsbuilder is installed. Retry with: dsbuilder toolchain install web'
        }
        $global:LASTEXITCODE = 0
    }
}
