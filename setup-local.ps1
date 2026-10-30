[CmdletBinding()]
param(
    [switch]$Reset,
    [switch]$Down,
    [string]$PluginZip,
    [string]$WebPluginZip,
    [switch]$SkipPlugin,
    [string]$ComponentsPackage,
    [string]$ThemePackage,
    [switch]$SkipDesignSystem
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
if (-not $componentsWereExplicit -and $componentsFromEnvironment) {
    $ComponentsPackage = $componentsFromEnvironment
    $componentsWereExplicit = $true
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
            'DSBUILDER_REALM', 'DSBUILDER_CLIENT_ID', 'DSBUILDER_CLIENT_SECRET',
            'DSBUILDER_LOCAL_USERNAME', 'DSBUILDER_LOCAL_PASSWORD')) {
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
Invoke-BackendCompose @('up', '--build', '-d')
# The gateway mounts nginx.local.conf as a single file: after a checkout replaces the file the running container keeps
# the old one, and a recreated ds-service gets a new address. A restart picks up both.
Invoke-BackendCompose @('restart', 'gateway')
Initialize-ProjectsLookupClient

Write-SetupLog 'Building local setup tools container'
Invoke-Checked 'Local setup tools build' 'docker' @('build', '-t', $toolsImage,
    '-f', (Join-Path $root 'local-dev/Dockerfile.setup-tools'), (Join-Path $root 'local-dev'))

Write-SetupLog "Filling the design system 'base' through the gateway"
$metaMounts = @()
$metaEnvironment = @()
if ($env:DSBUILDER_WEB_API_META) {
    if (-not (Test-Path -LiteralPath $env:DSBUILDER_WEB_API_META -PathType Leaf)) {
        throw "Web API metadata file not found: $env:DSBUILDER_WEB_API_META"
    }
    $meta = Convert-InputPath $env:DSBUILDER_WEB_API_META '/input/web-api-meta.json' ([ref]$metaMounts)
    $metaEnvironment += "DSBUILDER_WEB_API_META=$meta"
}
Invoke-SetupTool 'local-dev/bootstrap-base-in-container.sh' @() $metaMounts $metaEnvironment

Write-SetupLog 'Starting the client'
Invoke-ClientCompose @('up', '-d', '--build', 'client')

# Each plugin is published by the CLI as CI does it: the backend stores the files in the MinIO bucket of its
# platform (compose-preview, web-preview) and imports the API meta of the platform from the archive.
function Publish-PreviewPlugin([string]$platform, [string]$title, [string]$archive, [bool]$explicit, [string]$bundled) {
    if (-not $archive) { $archive = Join-Path $root $bundled }
    if ($archive -match '^https?://' -or (Test-Path -LiteralPath $archive -PathType Leaf)) {
        $mounts = @()
        $source = Convert-InputPath $archive "/input/$(Split-Path $bundled -Leaf)" ([ref]$mounts)
        try {
            Write-SetupLog "Publishing the $title"
            Invoke-SetupTool 'publish-preview-plugin.sh' @('--platform', $platform, '--from', $source) $mounts
        } catch {
            if ($explicit) { throw }
            Write-SetupLog "The bundled $title could not be published: $_"
        }
    } else {
        if ($explicit) { throw "$title archive not found: $archive" }
        Write-SetupLog "No $title archive; continuing without it"
    }
}

if (-not $SkipPlugin) {
    Publish-PreviewPlugin 'compose' 'Compose preview plugin' $PluginZip $pluginWasExplicit 'local-dev/compose-preview/preview-compose-plugin.zip'
    Publish-PreviewPlugin 'react' 'web preview plugin' $WebPluginZip $webPluginWasExplicit 'local-dev/web-preview/preview-web-plugin.zip'
}

if (-not $SkipDesignSystem) {
    if ($themeWasExplicit -and $ThemePackage -and
        -not (Test-Path -LiteralPath (Join-Path $ThemePackage 'android/android_color.json') -PathType Leaf)) {
        throw "Theme package has no android/android_color.json: $ThemePackage"
    }
    if (-not $ComponentsPackage) { $ComponentsPackage = Join-Path $root 'local-dev/design-system/components' }
    if (Test-Path -LiteralPath (Join-Path $ComponentsPackage 'meta.json')) {
        $mounts = @()
        $package = Convert-InputPath $ComponentsPackage '/input/components' ([ref]$mounts)
        $seedArgs = @('--package', $package)
        if ($themeWasExplicit) {
            if ($ThemePackage) {
                $theme = Convert-InputPath $ThemePackage '/input/theme' ([ref]$mounts)
                $seedArgs += @('--theme-package', $theme)
            } else { $seedArgs += @('--theme-package', '') }
        }
        try {
            Write-SetupLog 'Creating the design system with a theme and components'
            Invoke-SetupTool 'seed-local-design-system.sh' $seedArgs $mounts
        } catch {
            if ($componentsWereExplicit -or $themeWasExplicit) { throw }
            Write-SetupLog "The bundled design system could not be seeded: $_"
        }
    } else {
        if ($componentsWereExplicit) { throw "Component package not found: $ComponentsPackage" }
        Write-SetupLog 'No component package; continuing without local Compose components'
    }
}

Write-SetupLog 'Local setup is ready'
Write-SetupLog 'API gateway: http://localhost:8080'
Write-SetupLog 'Client: http://localhost:3002'
