$ErrorActionPreference = 'Stop'

$gradle = Join-Path $PSScriptRoot 'gradlew.bat'
$binary = Join-Path $PSScriptRoot 'cli\build\bin\mingwX64\releaseExecutable\dsbuilder.exe'
$installer = Join-Path $PSScriptRoot 'cli\distribution\install-windows-cli.ps1'

& $gradle ':cli:linkReleaseExecutableMingwX64'
if ($LASTEXITCODE -ne 0) {
    throw "Windows CLI build failed with exit code $LASTEXITCODE"
}

& $installer -Source $binary
