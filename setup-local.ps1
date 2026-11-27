[CmdletBinding()]
param(
    [switch]$Reset,
    [switch]$Down,
    [string]$PluginZip,
    [string]$WebPluginZip,
    [switch]$SkipPlugin,
    [string]$Icons,
    [switch]$SkipIcons,
    [string]$ComponentsPackage,
    [string]$ThemePackage,
    [switch]$SkipDesignSystem,
    [switch]$SkipDocumentation
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend-kt'
$js = Join-Path $root 'js'
$toolsImage = 'dsbuilder-local-setup-tools:dev'
$gateway = 'http://host.docker.internal:8080'
$pluginWasExplicit = $PSBoundParameters.ContainsKey('PluginZip')
$webPluginWasExplicit = $PSBoundParameters.ContainsKey('WebPluginZip')
$componentsWereExplicit = $PSBoundParameters.ContainsKey('ComponentsPackage')
$iconsWereExplicit = $PSBoundParameters.ContainsKey('Icons')
$themeWasExplicit = $PSBoundParameters.ContainsKey('ThemePackage')
$pluginFromEnvironment = [Environment]::GetEnvironmentVariable('COMPOSE_PREVIEW_PLUGIN_ZIP')
$componentsFromEnvironment = [Environment]::GetEnvironmentVariable('COMPOSE_COMPONENTS_PACKAGE')
if (-not $pluginWasExplicit -and $pluginFromEnvironment) {
    $PluginZip = $pluginFromEnvironment
    $pluginWasExplicit = $true
}
$webPluginFromEnvironment = [Environment]::GetEnvironmentVariable('WEB_PREVIEW_PLUGIN_ZIP')
if (-not $webPluginWasExplicit -and $webPluginFromEnvironment) {
    $WebPluginZip = $webPluginFromEnvironment
    $webPluginWasExplicit = $true
}
$iconsFromEnvironment = [Environment]::GetEnvironmentVariable('LOCAL_ICONS_SOURCE')
if (-not $iconsWereExplicit -and $iconsFromEnvironment) {
    $Icons = $iconsFromEnvironment
    $iconsWereExplicit = $true
}
if (-not $componentsWereExplicit -and $componentsFromEnvironment) {
    $ComponentsPackage = $componentsFromEnvironment
    $componentsWereExplicit = $true
}
if (-not $Down -and -not $SkipDesignSystem -and $themeWasExplicit -and -not $componentsWereExplicit) {
    throw '-ThemePackage requires -ComponentsPackage (or COMPOSE_COMPONENTS_PACKAGE)'
}
$projectName = if ($env:DSBUILDER_JS_COMPOSE_PROJECT_NAME) { $env:DSBUILDER_JS_COMPOSE_PROJECT_NAME } else { 'design-system-builder' }

function Write-SetupLog([string]$message) { Write-Host "[local-setup] $message" }

function Invoke-Checked([string]$description, [string]$command, [string[]]$arguments) {
    & $command @arguments
    if ($LASTEXITCODE -ne 0) { throw "$description failed with exit code $LASTEXITCODE" }
}

function Invoke-BackendCompose([string[]]$arguments) {
    $base = @('compose', '--project-directory', $backend,
        '-f', (Join-Path $backend 'docker-compose.local.yml'),
        '-f', (Join-Path $backend 'docker-compose.windows.yml'))
    if (Test-Path -LiteralPath (Join-Path $backend 'identity-gateway/.env.local')) {
        $base += @('--env-file', (Join-Path $backend 'identity-gateway/.env.local'))
    }
    Invoke-Checked 'Backend Docker Compose' 'docker' ($base + $arguments)
}

function Invoke-ClientCompose([string[]]$arguments) {
    $base = @('compose', '--project-name', $projectName,
        '--project-directory', $js, '-f', (Join-Path $js 'docker-compose.dev.yml'))
    Invoke-Checked 'Client Docker Compose' 'docker' ($base + $arguments)
}

function Get-Setting([string]$name, [string]$fallback) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) { return $value }
    return $fallback
}

function Import-LocalEnvironment {
    $file = Join-Path $backend 'identity-gateway/.env.local'
    if (-not (Test-Path -LiteralPath $file)) { return }
    foreach ($line in Get-Content -LiteralPath $file) {
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { continue }
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

function Invoke-Json([string]$method, [string]$url, $headers, $body) {
    $request = @{ Method = $method; Uri = $url; ErrorAction = 'Stop' }
    if ($headers) { $request.Headers = $headers }
    if ($null -ne $body) {
        $request.ContentType = 'application/json'
        $request.Body = ConvertTo-Json -InputObject $body -Depth 30 -Compress
    }
    return Invoke-RestMethod @request
}

function Wait-ForUrl([string]$url, [string]$description, [int]$attempts) {
    for ($attempt = 0; $attempt -lt $attempts; $attempt++) {
        try {
            Invoke-RestMethod -Uri $url -TimeoutSec 3 -ErrorAction Stop | Out-Null
            return
        } catch { Start-Sleep -Seconds 2 }
    }
    throw "$description is not reachable at $url"
}

function Initialize-ProjectsLookupClient {
    Write-SetupLog 'Bootstrapping Keycloak client for Projects Service user lookup'
    Wait-ForUrl 'http://localhost:8090/realms/master' 'Keycloak' 60
    $admin = Get-Setting 'KEYCLOAK_ADMIN' 'admin'
    $password = Get-Setting 'KEYCLOAK_ADMIN_PASSWORD' 'admin'
    $realm = Get-Setting 'PROJECTS_IDENTITY_KEYCLOAK_REALM' 'dsbuilder'
    $clientId = Get-Setting 'PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID' 'projects-service'
    $secret = Get-Setting 'PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET' 'projects-service-secret'
    $token = Invoke-RestMethod -Method Post -Uri 'http://localhost:8090/realms/master/protocol/openid-connect/token' `
        -ContentType 'application/x-www-form-urlencoded' `
        -Body @{ client_id = 'admin-cli'; grant_type = 'password'; username = $admin; password = $password }
    if (-not $token.access_token) { throw 'Keycloak admin token is missing' }
    $headers = @{ Authorization = "Bearer $($token.access_token)" }
    $base = "http://localhost:8090/admin/realms/$realm"
    $clientUrl = "$base/clients"
    $encodedClientId = [Uri]::EscapeDataString($clientId)
    $clients = @(Invoke-Json 'GET' "$clientUrl`?clientId=$encodedClientId" $headers $null | Where-Object { $null -ne $_ })
    $clientBody = @{
        clientId = $clientId; name = 'Projects Service Lookup'; enabled = $true
        protocol = 'openid-connect'; publicClient = $false
        clientAuthenticatorType = 'client-secret'; secret = $secret
        standardFlowEnabled = $false; directAccessGrantsEnabled = $false
        serviceAccountsEnabled = $true
    }
    if ($clients.Count -eq 0) {
        Invoke-Json 'POST' $clientUrl $headers $clientBody | Out-Null
        $clients = @(Invoke-Json 'GET' "$clientUrl`?clientId=$encodedClientId" $headers $null | Where-Object { $null -ne $_ })
    } else {
        $clientBody.id = $clients[0].id
        Invoke-Json 'PUT' "$clientUrl/$($clients[0].id)" $headers $clientBody | Out-Null
    }
    if ($clients.Count -eq 0) { throw 'Projects Service Keycloak client was not created' }
    $clientUuid = $clients[0].id
    $serviceAccount = Invoke-Json 'GET' "$clientUrl/$clientUuid/service-account-user" $headers $null
    $realmManagement = @(Invoke-Json 'GET' "$clientUrl`?clientId=realm-management" $headers $null | Where-Object { $null -ne $_ })[0]
    if (-not $realmManagement) { throw 'Keycloak realm-management client is missing' }
    $roles = @(Invoke-Json 'GET' "$clientUrl/$($realmManagement.id)/roles" $headers $null) |
        Where-Object { $_.name -in @('query-users', 'view-users') }
    if (@($roles).Count -ne 2) { throw 'Keycloak query-users/view-users roles are missing' }
    Invoke-Json 'POST' "$base/users/$($serviceAccount.id)/role-mappings/clients/$($realmManagement.id)" `
        $headers @($roles) | Out-Null
}

function Convert-InputPath([string]$path, [string]$target, [ref]$mounts) {
    if ($path -match '^https?://') { return $path }
    $absolute = (Resolve-Path -LiteralPath $path).Path
    $prefix = $root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if ($absolute.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        return '/workspace/' + $absolute.Substring($prefix.Length).Replace('\', '/')
    }
    $mounts.Value += @('--mount', "type=bind,source=$absolute,target=$target,readonly")
    return $target
}

function Invoke-SetupTool([string]$script, [string[]]$arguments, [string[]]$mounts, [string[]]$environment = @()) {
    $dockerArgs = @('run', '--rm', '--mount', "type=bind,source=$root,target=/workspace",
        '--mount', 'type=volume,source=dsbuilder-local-npm,target=/workspace/js/cli/node_modules',
        '--mount', 'type=volume,source=dsbuilder-local-gradle,target=/root/.gradle',
        '-w', '/workspace', '-e', "DSBUILDER_GATEWAY_URL=$gateway", '-e', "GATEWAY_URL=$gateway")
    foreach ($name in @('DSBUILDER_PROJECT_USERNAME', 'DSBUILDER_PROJECT_PASSWORD', 'DSBUILDER_PROJECT_NAME',
            'DSBUILDER_REALM', 'DSBUILDER_PROJECT_CLIENT_ID', 'DSBUILDER_CLIENT_ID', 'DSBUILDER_CLIENT_SECRET',
            'DSBUILDER_LOCAL_USERNAME', 'DSBUILDER_LOCAL_PASSWORD',
            'DSBUILDER_WEB_CORE_VERSION', 'DSBUILDER_WEB_CORE_CHANNEL', 'DSBUILDER_WEB_CORE_LIBRARY')) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($null -ne $value) { $dockerArgs += @('-e', "$name=$value") }
    }
    $dockerArgs += $mounts
    foreach ($setting in $environment) { $dockerArgs += @('-e', $setting) }
    $dockerArgs += @($toolsImage, 'bash', $script)
    $dockerArgs += $arguments
    Invoke-Checked $script 'docker' $dockerArgs
}

Import-LocalEnvironment
if (-not $Down -and $env:DSBUILDER_WEB_API_META -and [string]::IsNullOrWhiteSpace($env:DSBUILDER_WEB_CORE_VERSION)) {
    throw 'Set DSBUILDER_WEB_CORE_VERSION to the exact version used to generate the Web API meta before setup'
}
Invoke-Checked 'Docker Compose availability' 'docker' @('compose', 'version')

if ($Down) {
    Write-SetupLog 'Stopping Kotlin backend and client'
    Invoke-BackendCompose @('down')
    Invoke-ClientCompose @('down', '--remove-orphans')
    return
}

if ($Reset) {
    Write-SetupLog 'Removing local Docker volumes'
    Invoke-BackendCompose @('down', '-v')
    Invoke-ClientCompose @('down', '-v', '--remove-orphans')
} else {
    Invoke-ClientCompose @('down', '--remove-orphans')
}

Write-SetupLog 'Building and starting Kotlin backend in Linux containers'
$env:DS_FLYWAY_ADOPT_EXISTING = 'false'
Invoke-BackendCompose @('up', '--build', '--remove-orphans', '-d')
Initialize-ProjectsLookupClient

Write-SetupLog 'Building local setup tools container'
Invoke-Checked 'Local setup tools build' 'docker' @('build', '-t', $toolsImage,
    '-f', (Join-Path $root 'local-dev/Dockerfile.setup-tools'), (Join-Path $root 'local-dev'))

# Preview publication links each plugin to its registered Core release and stores files in its local MinIO bucket.
function Publish-PreviewPlugin([string]$platform, [string]$title, [string]$archive, [bool]$explicit, [string]$bundled, [string]$channel) {
    if (-not $archive) { $archive = Join-Path $root $bundled }
    if ($archive -match '^https?://' -or (Test-Path -LiteralPath $archive -PathType Leaf)) {
        $mounts = @()
        $source = Convert-InputPath $archive "/input/$(Split-Path $bundled -Leaf)" ([ref]$mounts)
        $published = $false
        try {
            Write-SetupLog "Publishing the $title"
            $toolArgs = @('--platform', $platform, '--channel', $channel, '--from', $source)
            if ($platform -eq 'compose') { $toolArgs += '--register-core' }
            Invoke-SetupTool 'publish-preview-plugin.sh' $toolArgs $mounts
            $published = $true
        } catch {
            if ($explicit) { throw }
            Write-SetupLog "The bundled $title could not be published. See local-dev/README.md for archive requirements. $_"
        }
        if ($published -and $platform -eq 'compose' -and -not $SkipDesignSystem) {
            Invoke-SetupTool 'ensure-local-preview-core.sh' @('--archive', $source) $mounts
        }
    } else {
        if ($explicit) { throw "$title archive not found: $archive" }
        Write-SetupLog "No $title archive; continuing without it"
    }
}

$webPreviewDownload = $null
$composePreviewDownload = $null
try {
    $composeSource = if ($PluginZip) { $PluginZip } else { Join-Path $root 'local-dev/compose-preview/preview-compose-plugin.zip' }
    if (-not $SkipPlugin -and ($composeSource -match '^https?://' -or
        (Test-Path -LiteralPath $composeSource -PathType Leaf))) {
        $composePreviewDownload = [IO.Path]::GetTempFileName()
        if ($composeSource -match '^https?://') {
            Invoke-WebRequest -Uri $composeSource -OutFile $composePreviewDownload -UseBasicParsing -TimeoutSec 120
        } else {
            Copy-Item -LiteralPath $composeSource -Destination $composePreviewDownload
        }
        $PluginZip = $composePreviewDownload
    }
    # Bootstrap and publication share one snapshot, even if the original ZIP changes.
    $webSource = if ($WebPluginZip) { $WebPluginZip } else { Join-Path $root 'local-dev/web-preview/preview-web-plugin.zip' }
    $webSourceIsUrl = $webSource -match '^https?://'
    if (-not $SkipPlugin -and -not $env:DSBUILDER_WEB_API_META -and
        ($webSourceIsUrl -or (Test-Path -LiteralPath $webSource -PathType Leaf))) {
        $webPreviewDownload = [IO.Path]::GetTempFileName()
        if ($webSourceIsUrl) {
            Write-SetupLog 'Downloading the Web preview archive'
            Invoke-WebRequest -Uri $webSource -OutFile $webPreviewDownload -UseBasicParsing -TimeoutSec 120
        } else {
            Copy-Item -LiteralPath $webSource -Destination $webPreviewDownload
        }
        $WebPluginZip = $webPreviewDownload
    }

    Write-SetupLog 'Preparing the project and global Web API through the gateway'
    $metaMounts = @()
    $projectClientId = Get-Setting 'DSBUILDER_PROJECT_CLIENT_ID' 'dsbuilder-api'
    $metaEnvironment = @("DSBUILDER_PROJECT_CLIENT_ID=$projectClientId")
    if ($env:DSBUILDER_WEB_API_META) {
        if (-not (Test-Path -LiteralPath $env:DSBUILDER_WEB_API_META -PathType Leaf)) {
            throw "Web API metadata file not found: $env:DSBUILDER_WEB_API_META"
        }
        $meta = Convert-InputPath $env:DSBUILDER_WEB_API_META '/input/web-api-meta.json' ([ref]$metaMounts)
        $metaEnvironment += "DSBUILDER_WEB_API_META=$meta"
    } elseif ($WebPluginZip) {
        $archive = Convert-InputPath $WebPluginZip '/input/preview-web-plugin.zip' ([ref]$metaMounts)
        $metaEnvironment += "WEB_PREVIEW_PLUGIN_ZIP=$archive"
    }
    Invoke-SetupTool 'local-dev/bootstrap-base-in-container.sh' @() $metaMounts $metaEnvironment

    Write-SetupLog 'Starting the client'
    Invoke-ClientCompose @('up', '-d', '--build', 'client')

    if (-not $SkipPlugin) {
        $composeChannel = if ($env:DSBUILDER_COMPOSE_CORE_CHANNEL) { $env:DSBUILDER_COMPOSE_CORE_CHANNEL } else { 'dev' }
        $webChannel = if ($env:DSBUILDER_WEB_CORE_CHANNEL) { $env:DSBUILDER_WEB_CORE_CHANNEL } else { 'dev' }
        Publish-PreviewPlugin 'compose' 'Compose preview plugin' $PluginZip $pluginWasExplicit 'local-dev/compose-preview/preview-compose-plugin.zip' $composeChannel
        Publish-PreviewPlugin 'react' 'web preview plugin' $WebPluginZip $webPluginWasExplicit 'local-dev/web-preview/preview-web-plugin.zip' $webChannel
    }
# The icon catalog is loaded as CI does it: the backend stores the SVG files in the MinIO bucket of the Compose
# preview plugin and replaces the catalog in one transaction. Without -Icons the bundled starter set is used.
function Publish-IconCatalog {
    $source = if ($Icons) { $Icons } else { Join-Path $root 'local-dev/icons/icons-manifest.json' }
    if (-not (Test-Path -LiteralPath $source)) {
        if ($iconsWereExplicit) { throw "Icon set not found: $source" }
        Write-SetupLog 'No icon set; continuing without the icon catalog'
        return
    }
    $mounts = @()
    $inputPath = Convert-InputPath $source '/input/icons' ([ref]$mounts)
    try {
        Write-SetupLog 'Loading the icon catalog'
        $toolArgs = @('--from', $inputPath)
        if (-not $iconsWereExplicit) { $toolArgs += '--if-empty' }
        Invoke-SetupTool 'publish-local-icons.sh' $toolArgs $mounts
    } catch {
        if ($iconsWereExplicit) { throw }
        Write-SetupLog "The bundled icon set could not be loaded: $_"
    }
}

if (-not $SkipIcons) { Publish-IconCatalog }

if (-not $SkipDesignSystem -and $componentsWereExplicit) {
    if ($themeWasExplicit -and $ThemePackage -and
        -not (Test-Path -LiteralPath (Join-Path $ThemePackage 'android/android_color.json') -PathType Leaf)) {
        throw "Theme package has no android/android_color.json: $ThemePackage"
    }
    if (-not $ComponentsPackage) { throw 'The requested component package path is empty' }
    if (Test-Path -LiteralPath (Join-Path $ComponentsPackage 'meta.json')) {
        $mounts = @()
        $package = Convert-InputPath $ComponentsPackage '/input/components' ([ref]$mounts)
        $seedArgs = @('--package', $package)
        $coreArchive = if ($PluginZip) { $PluginZip } else { Join-Path $root 'local-dev/compose-preview/preview-compose-plugin.zip' }
        $coreSource = Convert-InputPath $coreArchive '/input/core-preview-plugin.zip' ([ref]$mounts)
        $seedArgs += @('--core-archive', $coreSource)
        if ($themeWasExplicit) {
            if ($ThemePackage) {
                $theme = Convert-InputPath $ThemePackage '/input/theme' ([ref]$mounts)
                $seedArgs += @('--theme-package', $theme)
            } else { $seedArgs += @('--theme-package', '') }
        }
        Write-SetupLog 'Creating the design system with a theme and components'
        Invoke-SetupTool 'seed-local-design-system.sh' $seedArgs $mounts
    } else {
        throw "Component package not found: $ComponentsPackage"
    }
}

if (-not $SkipDesignSystem -and -not $SkipDocumentation) {
    Write-SetupLog 'Ensuring Compose documentation for the existing demo design system'
    Invoke-SetupTool 'publish-local-documentation.sh' @('--if-missing') @()
}

Write-SetupLog 'Local setup is ready'
Write-SetupLog 'API gateway: http://localhost:8080'
Write-SetupLog 'Client: http://localhost:3002'

} finally {
    foreach ($download in @($webPreviewDownload, $composePreviewDownload)) {
        if ($download) { Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue }
    }
}
