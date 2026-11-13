param(
    [string]$Version,
    [ValidateSet('windows-x64')][string]$Target = 'windows-x64',
    [switch]$WithoutWeb
)
$ErrorActionPreference = 'Stop'
$base = if ($env:CLI_RELEASE_BASE_URL) { $env:CLI_RELEASE_BASE_URL.TrimEnd('/') } else { '@CLI_RELEASE_BASE_URL@' }
$uri = [Uri]$base
if (-not $uri.IsAbsoluteUri -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or
    ($uri.Scheme -ne 'https' -and -not ($uri.Scheme -eq 'http' -and $uri.IsLoopback))) {
    throw 'CLI_RELEASE_BASE_URL must be an HTTPS URL'
}
if ([Environment]::OSVersion.Platform -ne 'Win32NT' -or
    [Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITEW6432') -eq 'ARM64' -or
    [Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE') -eq 'ARM64' -or
    -not [Environment]::Is64BitOperatingSystem) { throw 'Native installer requires Windows x64' }
$work = Join-Path ([IO.Path]::GetTempPath()) ('dsbuilder-download-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $work | Out-Null
function Download-ReleaseFile([string]$Url, [string]$Destination) {
    # Не используем автоматические переходы: PowerShell 5.1 не запрещает HTTPS -> HTTP.
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        try {
            $current = [Uri]$Url
            for ($hop = 0; $hop -le 5; $hop++) {
                $request = [Net.HttpWebRequest]::Create($current)
                $request.AllowAutoRedirect = $false
                $request.Timeout = 30000
                $request.ReadWriteTimeout = 300000
                $response = $request.GetResponse()
                try {
                    $status = [int]$response.StatusCode
                    if ($status -in @(301, 302, 303, 307, 308)) {
                        if ($hop -eq 5) { throw 'Too many redirects' }
                        $next = [Uri]::new($current, $response.Headers['Location'])
                        if ($next.UserInfo -or $next.Scheme -notin @('http', 'https') -or
                            ($next.Scheme -eq 'http' -and ($current.Scheme -eq 'https' -or -not $next.IsLoopback))) {
                            throw 'Unsafe release redirect'
                        }
                        $current = $next
                        continue
                    }
                    if ($status -ne 200) { throw 'Unexpected download status' }
                    $output = [IO.File]::Create($Destination)
                    try { $response.GetResponseStream().CopyTo($output) } finally { $output.Dispose() }
                    return
                } finally { $response.Dispose() }
            }
        } catch {
            if ($attempt -eq 2) { throw }
        }
    }
}
try {
    $manifestFile = Join-Path $work 'release.json'
    if (-not $Version) {
        Download-ReleaseFile "$base/releases/latest/download/release.json" $manifestFile
    } else {
        if ($Version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') { throw 'Invalid release version' }
        Download-ReleaseFile "$base/releases/download/cli-v$Version/release.json" $manifestFile
    }
    $manifestText = (Get-Content -LiteralPath $manifestFile -Raw).TrimEnd("`n")
    $pattern = '^\{"schemaVersion":1,"version":"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)","iosCliReleaseTag":"[A-Za-z0-9][A-Za-z0-9._-]*","artifacts":\{'
    $entries = foreach ($platform in @('macos-arm64', 'macos-x64', 'windows-x64', 'jvm')) {
        '"' + $platform + '":\{"file":"dsbuilder-cli-' + $platform + '\.zip","sha256":"[0-9a-f]{64}"\}'
    }
    $pattern += ($entries -join ',') + '\}\}$'
    if ($manifestText -cnotmatch $pattern) { throw 'Invalid release manifest' }
    $manifest = $manifestText | ConvertFrom-Json
    if ($Version -and $Version -ne $manifest.version) { throw 'Release version mismatch' }
    $Version = $manifest.version
    $name = 'dsbuilder-cli-windows-x64.zip'
    $download = "$base/releases/download/cli-v$Version"
    $sumsFile = Join-Path $work 'SHA256SUMS'
    Download-ReleaseFile "$download/SHA256SUMS" $sumsFile
    $matchesFound = @(Get-Content -LiteralPath $sumsFile | Where-Object { $_ -match '^([a-f0-9]{64})  dsbuilder-cli-windows-x64\.zip$' })
    if ($matchesFound.Count -ne 1) { throw 'Invalid or missing checksum' }
    $expected = $matchesFound[0].Substring(0, 64)
    if ($expected -cne $manifest.artifacts.'windows-x64'.sha256) { throw 'Manifest SHA-256 mismatch' }
    $archive = Join-Path $work $name
    Download-ReleaseFile "$download/$name" $archive
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
    & $installer -WithoutWeb:$WithoutWeb
} finally { Remove-Item -LiteralPath $work -Recurse -Force }
