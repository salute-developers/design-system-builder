param(
    [string]$Source = (Join-Path $PSScriptRoot 'dsbuilder.exe')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Cannot find dsbuilder.exe at $Source"
}

$installDir = if ($env:DSBUILDER_INSTALL_DIR) {
    $env:DSBUILDER_INSTALL_DIR
} else {
    Join-Path $env:LOCALAPPDATA 'DSBuilder\cli'
}
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
$installedBinary = Join-Path $installDir 'dsbuilder.exe'
Copy-Item -LiteralPath $Source -Destination $installedBinary -Force

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = @($userPath -split ';' | Where-Object { $_ })
if (-not ($entries | Where-Object { $_.TrimEnd('\') -ieq $installDir.TrimEnd('\') })) {
    [Environment]::SetEnvironmentVariable('Path', (($entries + $installDir) -join ';'), 'User')
}
$env:Path = "$installDir;$env:Path"

Write-Host "Installed dsbuilder.exe to $installedBinary"
Write-Host 'The user PATH was updated. Open a new terminal to use dsbuilder from any directory.'
