param(
    [string]$Version,
    [ValidateSet('windows-x64')][string]$Target = 'windows-x64'
)
$ErrorActionPreference = 'Stop'
$base = if ($env:CLI_DOWNLOAD_BASE_URL) { $env:CLI_DOWNLOAD_BASE_URL.TrimEnd('/') } else { '@CLI_DOWNLOAD_BASE_URL@' }
$uri = [Uri]$base
if (-not $uri.IsAbsoluteUri -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or
    ($uri.Scheme -ne 'https' -and -not ($uri.Scheme -eq 'http' -and $uri.IsLoopback))) {
    throw 'CLI_DOWNLOAD_BASE_URL must be an HTTPS URL'
}
if ([Environment]::OSVersion.Platform -ne 'Win32NT' -or
    [Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITEW6432') -eq 'ARM64' -or
    [Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE') -eq 'ARM64' -or
    -not [Environment]::Is64BitOperatingSystem) { throw 'Native installer requires Windows x64' }
$work = Join-Path ([IO.Path]::GetTempPath()) ('dsbuilder-download-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $work | Out-Null
try {
    if (-not $Version) {
        $stableFile = Join-Path $work 'stable.json'
        Invoke-WebRequest -UseBasicParsing -MaximumRedirection 0 -Uri "$base/stable.json" -OutFile $stableFile -TimeoutSec 60
        $stable = Get-Content -LiteralPath $stableFile -Raw | ConvertFrom-Json
        if ($stable.schemaVersion -ne 1) { throw 'Unsupported stable manifest' }
        $Version = $stable.version
    }
    if ($Version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') { throw 'Invalid release version' }
    $name = 'dsbuilder-cli-windows-x64.zip'
    $sumsFile = Join-Path $work 'SHA256SUMS'
    Invoke-WebRequest -UseBasicParsing -MaximumRedirection 0 -Uri "$base/releases/$Version/SHA256SUMS" -OutFile $sumsFile -TimeoutSec 60
    $matchesFound = @(Get-Content -LiteralPath $sumsFile | Where-Object { $_ -match '^([a-f0-9]{64})  dsbuilder-cli-windows-x64\.zip$' })
    if ($matchesFound.Count -ne 1) { throw 'Invalid or missing checksum' }
    $expected = $matchesFound[0].Substring(0, 64)
    $archive = Join-Path $work $name
    Invoke-WebRequest -UseBasicParsing -MaximumRedirection 0 -Uri "$base/releases/$Version/$name" -OutFile $archive -TimeoutSec 300
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Archive SHA-256 mismatch' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        foreach ($entry in $zip.Entries) {
            $path = $entry.FullName
            if ($path -notmatch '^dsbuilder-cli-windows-x64/[A-Za-z0-9_.\-/]*$' -or
                $path -match '(^|/)\.\.?(/|$)' -or
                (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Unsafe archive entry' }
        }
    } finally { $zip.Dispose() }
    $expanded = Join-Path $work 'expanded'
    [IO.Compression.ZipFile]::ExtractToDirectory($archive, $expanded)
    $package = Join-Path $expanded 'dsbuilder-cli-windows-x64'
    if (-not (Test-Path -LiteralPath (Join-Path $package 'dsbuilder.exe') -PathType Leaf)) { throw 'Native binary missing' }
    $installer = Join-Path $package 'install.ps1'
    if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw 'Archive installer missing' }
    & $installer
} finally { Remove-Item -LiteralPath $work -Recurse -Force }
