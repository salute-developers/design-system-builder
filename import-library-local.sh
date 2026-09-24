#!/usr/bin/env bash
# Наполняет ЛОКАЛЬНЫЙ контур дизайн-системой из внешних репозиториев:
#   1. токены темы      — theme-converter/themes/<library>/<version>.zip -> БД db-service
#   2. API компонентов  — plasma-android uikit-api-meta.json -> backend-kt/scripts/import-uikit-api-meta.sh
#   3. компоненты       — theme-converter/components/<library>/*_config.json -> `dsbuilder components push`
#   4. документация     — plasma-android tokens/<library>.compose/.sdds/theme-info-compose.json -> `dsbuilder docs publish`
#                         (CodeBinding токенов: плагин по нему копирует ссылку вида SddsServTheme.colors.textDefaultAccent)
#
# Порядок не совпадает с «API, токены, компоненты» намеренно: шаг 2 с --link-design-systems
# привязывает компоненты к уже существующим дизайн-системам, поэтому дизайн-система (создаётся
# в шаге 1) должна быть в БД раньше.
#
# Требования: docker-контур поднят (./setup-local.sh), curl, jq, unzip, node/npx в js/services/db-service
# (npm ci), собранный `dsbuilder` (frontend-kt/install-local-cli.sh) и для шагов 3 и 4 — `dsbuilder auth login`.
# Для шага 4 theme-info должен быть свежим: в plasma-android поднять theme-version модуля и выполнить
# ./gradlew :tokens:<library>.compose:generateTheme (иначе в ссылках не будет токенов новой версии темы).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

library="${DSBUILDER_LIBRARY:-sdds_serv}"
theme_converter="${THEME_CONVERTER_ROOT:-$ROOT_DIR/../theme-converter}"
plasma_android="${PLASMA_ANDROID_ROOT:-$ROOT_DIR/../plasma-android}"
theme_version="latest"
api_meta_input=""
db_url="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/ds_registry}"
db_api_base="${DSBUILDER_DB_API_BASE:-http://localhost:3008/api/ds}"
gateway_url="${DSBUILDER_API_URL:-http://localhost:8080}"
project_id="${DSBUILDER_PROJECT_ID:-}"
user_name="${DSBUILDER_LOCAL_USER:-user@example.com}"
user_password="${DSBUILDER_LOCAL_PASSWORD:-password}"
dsbuilder_bin="${DSBUILDER_BIN:-dsbuilder}"
platform="compose"
link_version="latest"
skip_tokens=false
skip_api=false
skip_components=false
skip_docs=false
theme_info_input=""
apply=true

usage() {
    cat <<USAGE
Usage: ./import-library-local.sh [options]

Options:
  --library <name>          Имя библиотеки/дизайн-системы (default: sdds_serv)
  --theme-version <ver>     Версия темы: latest или 0.10.0 и т.п. (default: latest)
  --theme-converter <path>  Корень theme-converter (env THEME_CONVERTER_ROOT, default: ../theme-converter)
  --plasma-android <path>   Корень plasma-android (env PLASMA_ANDROID_ROOT, default: ../plasma-android)
  --api-meta <path>         Явный путь к uikit-api-meta.json (по умолчанию из plasma-android)
  --platform <name>         Платформа API компонентов: xml|compose|ios|web (default: compose)
  --link-version <ver>      version в ссылке дизайн-системы для components push (default: latest)
  --db-url <url>            DATABASE_URL db-service (default: postgresql://postgres:postgres@localhost:5433/ds_registry)
  --db-api-base <url>       API db-service (default: http://localhost:3008/api/ds)
  --gateway-url <url>       Gateway для CLI/проектов (default: \$DSBUILDER_API_URL или http://localhost:8080)
  --project-id <id>         Проект для \`components push\` (по умолчанию первый проект пользователя или созданный local-test)
  --theme-info <path>       theme-info-compose.json для документации (по умолчанию из plasma-android tokens/<library>.compose/.sdds)
  --skip-tokens | --skip-api | --skip-components | --skip-docs
  --dry-run                 Шаги 2–4 без записи (шаг 4 только собирает бандл) (шаг 1 токенов всегда пишет в БД)
  --help

Environment: DSBUILDER_LIBRARY, THEME_CONVERTER_ROOT, PLASMA_ANDROID_ROOT, DATABASE_URL, DSBUILDER_DB_API_BASE,
  DSBUILDER_API_URL, DSBUILDER_PROJECT_ID, DSBUILDER_LOCAL_USER, DSBUILDER_LOCAL_PASSWORD, DSBUILDER_BIN
USAGE
}

log() { echo "[import-library] $*"; }
die() { echo "[import-library] $*" >&2; exit 1; }
need_value() { [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || die "Не задано значение для $1"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --library) need_value "$@"; library="$2"; shift 2 ;;
        --theme-version) need_value "$@"; theme_version="$2"; shift 2 ;;
        --theme-converter) need_value "$@"; theme_converter="$2"; shift 2 ;;
        --plasma-android) need_value "$@"; plasma_android="$2"; shift 2 ;;
        --api-meta) need_value "$@"; api_meta_input="$2"; shift 2 ;;
        --platform) need_value "$@"; platform="$2"; shift 2 ;;
        --link-version) need_value "$@"; link_version="$2"; shift 2 ;;
        --db-url) need_value "$@"; db_url="$2"; shift 2 ;;
        --db-api-base) need_value "$@"; db_api_base="${2%/}"; shift 2 ;;
        --gateway-url) need_value "$@"; gateway_url="${2%/}"; shift 2 ;;
        --project-id) need_value "$@"; project_id="$2"; shift 2 ;;
        --theme-info) need_value "$@"; theme_info_input="$2"; shift 2 ;;
        --skip-tokens) skip_tokens=true; shift ;;
        --skip-api) skip_api=true; shift ;;
        --skip-components) skip_components=true; shift ;;
        --skip-docs) skip_docs=true; shift ;;
        --dry-run) apply=false; shift ;;
        --help|-h) usage; exit 0 ;;
        *) usage >&2; die "Неизвестный аргумент: $1" ;;
    esac
done

for cmd in curl jq unzip; do command -v "$cmd" >/dev/null 2>&1 || die "Нужна команда '$cmd'"; done

theme_converter="$(cd "$theme_converter" 2>/dev/null && pwd)" || die "theme-converter не найден: $theme_converter (--theme-converter)"
[[ -f "$theme_converter/themes/$library/$theme_version.zip" ]] || \
    die "Нет темы $theme_converter/themes/$library/$theme_version.zip. Доступные библиотеки: $(ls "$theme_converter/themes" | tr '\n' ' ')"

step_tokens() {
    log "1/4 токены: библиотека=$library версия=$theme_version"
    local tmp theme_dir
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' RETURN
    unzip -q -o "$theme_converter/themes/$library/$theme_version.zip" -d "$tmp"
    rm -rf "$tmp/__MACOSX"
    # Некоторые архивы содержат корневую папку — нормализуем к плоской структуре.
    theme_dir="$tmp"
    if [[ ! -f "$theme_dir/meta.json" ]]; then
        theme_dir="$(dirname "$(find "$tmp" -maxdepth 2 -name meta.json | head -1)")"
        [[ -f "$theme_dir/meta.json" ]] || die "В архиве темы нет meta.json"
    fi
    (cd "$ROOT_DIR/js/services/db-service" && DATABASE_URL="$db_url" npx --yes tsx src/db/import-theme.ts \
        --dir="$theme_dir" --library="$library")
}

step_api() {
    log "2/4 API компонентов ($platform)"
    # Формат compose — массив компонентов, его генерирует KSP модуля uikit-compose
    # (kspCommonMainKotlinMetadata). Файлы tokens/*/build/theme-builder/... пустые ({}), не подходят.
    local input="${api_meta_input:-$plasma_android/sdds-core/uikit-compose/build/generated/ksp/metadata/commonMain/resources/sdds/api/uikit-compose-api-meta.json}"
    [[ -f "$input" ]] || die "Нет $input. Сгенерируйте его в plasma-android (KSP модуля sdds-core/uikit-compose, задача kspCommonMainKotlinMetadata) или передайте --api-meta"
    [[ "$(jq -r 'type' "$input")" == "array" && "$(jq 'length' "$input")" -gt 0 ]] || die "$input не содержит массив компонентов (формат compose)"
    log "API meta: $input"
    local args=(--input "$input" --api-base "$db_api_base" --platform "$platform" --link-design-systems)
    $apply && args+=(--apply)
    "$ROOT_DIR/backend-kt/scripts/import-uikit-api-meta.sh" "${args[@]}"
}

gateway_token() {
    curl -fsS -X POST "$gateway_url/auth/token" \
        -d "grant_type=password&client_id=dsbuilder-api&username=$user_name&password=$user_password" | jq -r .access_token
}

resolve_project() {
    [[ -n "$project_id" ]] && { echo "$project_id"; return; }
    local token id
    token="$(gateway_token)" || die "Не удалось получить токен на $gateway_url (контур поднят? пользователь $user_name?)"
    id="$(curl -fsS "$gateway_url/api/projects" -H "Authorization: Bearer $token" | jq -r '.[0].id // empty')"
    if [[ -z "$id" ]]; then
        id="$(curl -fsS -X POST "$gateway_url/api/projects" -H "Authorization: Bearer $token" \
            -H 'Content-Type: application/json' -d '{"name":"local-test","description":"локальный контур"}' | jq -r .id)"
        log "создан проект local-test ($id)"
    fi
    echo "$id"
}

step_components() {
    log "3/4 компоненты из theme-converter/components/$library"
    local dir="$theme_converter/components/$library"
    [[ -d "$dir" ]] || die "Нет $dir"
    command -v "$dsbuilder_bin" >/dev/null 2>&1 || die "Не найден '$dsbuilder_bin' (frontend-kt/install-local-cli.sh или DSBUILDER_BIN)"
    local ds_id pid
    ds_id="$(curl -fsS "$db_api_base/design-systems" | jq -r --arg n "$library" '.[] | select(.name==$n) | .id' | head -1)"
    [[ -n "$ds_id" ]] || die "Дизайн-система '$library' не найдена в db-service ($db_api_base) — не выполнен шаг токенов?"
    pid="$(resolve_project)"
    export DSBUILDER_API_URL="$gateway_url"
    "$dsbuilder_bin" auth status >/dev/null 2>&1 || die "Нет сессии CLI для $gateway_url. Выполните: DSBUILDER_API_URL=$gateway_url $dsbuilder_bin auth login"
    local args=(components push --from "$dir" --design-system "dsbuilder://projects/$pid/design-systems/$ds_id?version=$link_version&platform=$platform")
    $apply && args+=(--apply) || args+=(--dry-run)
    "$dsbuilder_bin" "${args[@]}"
}

step_docs() {
    log "4/4 документация: библиотека=$library платформа=compose"
    command -v "$dsbuilder_bin" >/dev/null 2>&1 || die "Не найден '$dsbuilder_bin' (frontend-kt/install-local-cli.sh или DSBUILDER_BIN)"
    local theme_info="${theme_info_input:-$plasma_android/tokens/${library//_/.}.compose/.sdds/theme-info-compose.json}"
    [[ -f "$theme_info" ]] || die "Нет $theme_info. Сгенерируйте тему в plasma-android (generateTheme модуля ${library//_/.}.compose) или передайте --theme-info"
    [[ "$(jq '.tokens | length' "$theme_info")" -gt 0 ]] || die "$theme_info не содержит токенов"
    log "theme-info: $theme_info (версия темы $(jq -r .version "$theme_info"), токенов $(jq '.tokens | length' "$theme_info"))"
    local ds_id pid work
    ds_id="$(curl -fsS "$db_api_base/design-systems" | jq -r --arg n "$library" '.[] | select(.name==$n) | .id' | head -1)"
    [[ -n "$ds_id" ]] || die "Дизайн-система '$library' не найдена в db-service ($db_api_base) — не выполнен шаг токенов?"
    pid="$(resolve_project)"
    export DSBUILDER_API_URL="$gateway_url"
    $apply && { "$dsbuilder_bin" auth status >/dev/null 2>&1 || die "Нет сессии CLI для $gateway_url. Выполните: DSBUILDER_API_URL=$gateway_url $dsbuilder_bin auth login"; }
    work="$(mktemp -d)"
    trap 'rm -rf "$work"' RETURN
    mkdir -p "$work/.sdds" "$work/docs/meta"
    cat > "$work/.sdds/config.json" <<CONFIG
{
    "projectId": "$pid",
    "designSystemId": "$ds_id",
    "credential": {"type": "env", "name": "DSBUILDER_API_KEY"},
    "tenants": [],
    "palettePath": null,
    "platforms": ["compose"]
}
CONFIG
    cp "$theme_info" "$work/docs/meta/theme-info.json"
    printf '# Tokens\n\nТокены %s (локальная проверка code bindings).\n' "$library" > "$work/docs/tokens.md"
    cat > "$work/docs/structure.json" <<STRUCTURE
{
    "schemaVersion": "1.0",
    "navigation": [
        {"title": "Tokens", "subjects": null, "hidden": null, "merge": null, "items": [], "path": "tokens.md"}
    ]
}
STRUCTURE
    # `docs generate` ожидает структуру ядра (structure-core.json); обходной путь известного бага CLI.
    cp "$work/docs/structure.json" "$work/docs/structure-core.json"
    mkdir -p "$work/docs/content/core"
    cp "$work/docs/tokens.md" "$work/docs/content/core/tokens.md"
    (
        cd "$work"
        # Публикуем от имени пользовательской сессии, а не ключа проекта.
        unset DSBUILDER_API_KEY
        "$dsbuilder_bin" docs generate --docs-dir docs --platform compose --output ./docs-bundle.tar.gz
        if $apply; then
            "$dsbuilder_bin" docs publish --bundle ./docs-bundle.tar.gz
        else
            log "dry-run: бандл собран, публикация пропущена"
        fi
    )
}

$skip_tokens || step_tokens
$skip_api || step_api
$skip_components || step_components
$skip_docs || step_docs
log "готово. Проверка: DSBUILDER_API_URL=$gateway_url $dsbuilder_bin status  /  плагин: runIde"
