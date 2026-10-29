#!/usr/bin/env bash
# Наполняет локальный контур дизайн-системой `base` через Gateway и ds-service.
#
# Порядок: проект пользователя → глобальный слой web-компонентов (импорт API-меты
# по web-api-meta.json) → дизайн-система `base` с темой `base_default`. Версию скрипт не публикует: `base`
# остаётся черновиком, версии публикует пользователь из журнала.
# Определения и значения токенов, палитру и компоненты темы ds-service заводит сам из своих ресурсов,
# но компоненты — только при полном глобальном слое, поэтому import-api идёт до создания темы.
# Повторный запуск ничего не дублирует. К базе напрямую скрипт не обращается.
#
# Environment (всё необязательно):
#   DSBUILDER_GATEWAY_URL        Gateway, default http://localhost:8080
#   DSBUILDER_PROJECT_USERNAME   пользователь Keycloak (системный администратор), default admin@example.com
#   DSBUILDER_PROJECT_PASSWORD   его пароль, default password
#   DSBUILDER_PROJECT_NAME       имя нового проекта, default Base
#   DSBUILDER_REALM / DSBUILDER_CLIENT_ID   realm и client Keycloak, default dsbuilder / dsbuilder-api
#   DSBUILDER_WEB_API_META       web-api-meta.json; default js/cli/.sdds/web/web-api-meta.json, генерируется при отсутствии
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY_URL="${DSBUILDER_GATEWAY_URL:-http://localhost:8080}"
PROJECT_USERNAME="${DSBUILDER_PROJECT_USERNAME:-admin@example.com}"
PROJECT_PASSWORD="${DSBUILDER_PROJECT_PASSWORD:-password}"
PROJECT_NAME="${DSBUILDER_PROJECT_NAME:-Base}"
REALM="${DSBUILDER_REALM:-dsbuilder}"
CLIENT_ID="${DSBUILDER_CLIENT_ID:-dsbuilder-api}"
WEB_API_META="${DSBUILDER_WEB_API_META:-$ROOT_DIR/js/cli/.sdds/web/web-api-meta.json}"
DESIGN_SYSTEM_NAME="base"
TENANT_NAME="base_default"

log() { echo "[bootstrap-base] $*"; }
fail() { echo "[bootstrap-base] ERROR: $*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' not found"; }

require curl
require python3

json_field() {
    python3 -c '
import json, sys
try:
    value = json.load(sys.stdin)
    for part in sys.argv[1].split("."):
        value = value[part]
except (ValueError, KeyError, TypeError):
    value = None
print("" if value is None else value)
' "$1"
}

jwt_sub() {
    python3 -c '
import base64, json, sys
payload = sys.argv[1].split(".")[1]
payload += "=" * (-len(payload) % 4)
print(json.loads(base64.urlsafe_b64decode(payload)).get("sub", ""))
' "$1"
}

# http <method> <path> [json-body]: тело ответа в stdout; HTTP-статус в файле STATUS_FILE,
# потому что вызов идёт в подстановке `$(...)` и переменную из неё не вернуть.
STATUS_FILE="$(mktemp)"
IMPORT_BODY_FILE="$(mktemp)"
trap 'rm -f "$STATUS_FILE" "$IMPORT_BODY_FILE"' EXIT
http() {
    local method="$1" path="$2" body="${3:-}"
    local args=(-sS -w '%{stderr}%{http_code}' -X "$method" "$GATEWAY_URL$path" -H "Authorization: Bearer $ACCESS_TOKEN")
    [[ -z "$body" ]] || args+=(-H 'Content-Type: application/json' -d "$body")
    curl "${args[@]}" 2>"$STATUS_FILE" || fail "curl $method $path failed: $(cat "$STATUS_FILE")"
}

expect_status() {
    local expected="$1" what="$2" body="$3" status
    status="$(tail -c 3 "$STATUS_FILE")"
    [[ "$status" == "$expected" ]] || fail "$what: HTTP $status $body"
}

# ─── Инструменты: web-api-meta.json ─────────────────────────────────────────

ensure_web_api_meta() {
    if [[ -f "$WEB_API_META" ]]; then return; fi
    if [[ -n "${DSBUILDER_WEB_API_META:-}" ]]; then fail "web-api-meta file not found: $WEB_API_META"; fi
    [[ -d "$ROOT_DIR/js/cli/node_modules" ]] || fail "web-api-meta.json is missing and js/cli has no dependencies: run 'cd js/cli && npm ci', or pass DSBUILDER_WEB_API_META=<file>"
    log "Generating web-api-meta.json from the installed @salutejs/plasma-new-hope (js/cli)"
    (cd "$ROOT_DIR/js/cli" && npm run --silent generate:api-meta -- --package @salutejs/plasma-new-hope --out "$WEB_API_META")
    [[ -f "$WEB_API_META" ]] || fail "web-api-meta.json was not generated at $WEB_API_META"
}

# ─── Gateway и проект ───────────────────────────────────────────────────────

wait_for_gateway() {
    local attempt
    for attempt in $(seq 1 60); do
        curl -sf "$GATEWAY_URL/health" >/dev/null 2>&1 && return
        sleep 2
    done
    fail "Gateway is not reachable at $GATEWAY_URL — start backend-kt first (cd backend-kt && ./start-local.sh --detach)"
}

obtain_token() {
    local response
    response="$(curl -sf -X POST "$GATEWAY_URL/realms/$REALM/protocol/openid-connect/token" \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode 'grant_type=password' \
        --data-urlencode "client_id=$CLIENT_ID" \
        --data-urlencode "username=$PROJECT_USERNAME" \
        --data-urlencode "password=$PROJECT_PASSWORD")" || fail "Could not obtain access token for $PROJECT_USERNAME"
    ACCESS_TOKEN="$(printf '%s' "$response" | json_field access_token)"
    [[ -n "$ACCESS_TOKEN" ]] || fail "Token response has no access_token"
}

wait_for_projects_api() {
    # Gateway отвечает /health раньше, чем готовы projects-service и auth-helper.
    local attempt status
    for attempt in $(seq 1 45); do
        status="$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY_URL/api/projects" -H "Authorization: Bearer $ACCESS_TOKEN" || true)"
        [[ "$status" == "200" ]] && return
        sleep 2
    done
    fail "Projects API did not become ready (last HTTP status: ${status:-none})"
}

ensure_project() {
    local user_id body
    user_id="$(jwt_sub "$ACCESS_TOKEN")"
    body="$(http GET /api/projects)"
    expect_status 200 "Project listing failed" "$body"
    PROJECT_ID="$(printf '%s' "$body" | python3 -c '
import json, sys
user_id = sys.argv[1]
for project in json.load(sys.stdin):
    if project.get("ownerUserId") == user_id and project.get("status") != "archived":
        print(project["id"]); break
' "$user_id")"
    if [[ -n "$PROJECT_ID" ]]; then
        log "Project of $PROJECT_USERNAME: $PROJECT_ID (existing)"
        return
    fi
    body="$(http POST /api/projects "$(PROJECT_NAME="$PROJECT_NAME" python3 -c 'import json, os; print(json.dumps({"name": os.environ["PROJECT_NAME"]}, ensure_ascii=False))')")"
    expect_status 201 "Project creation failed" "$body"
    PROJECT_ID="$(printf '%s' "$body" | json_field id)"
    [[ "$PROJECT_ID" =~ ^[0-9a-fA-F-]{36}$ ]] || fail "Unexpected project id: $PROJECT_ID"
    log "Project '$PROJECT_NAME' created for $PROJECT_USERNAME: $PROJECT_ID"
}

# ─── Глобальный слой web-компонентов ────────────────────────────────────────

import_global_layer() {
    log "Importing the web component layer from $WEB_API_META"
    python3 "$ROOT_DIR/backend-kt/scripts/normalize_web_api_meta.py" "$WEB_API_META" > "$IMPORT_BODY_FILE" \
        || fail "Web API meta normalization failed"
    local body
    body="$(curl -sS -w '%{stderr}%{http_code}' -X POST \
        "$GATEWAY_URL/api/admin/component-config/import-api-meta" \
        -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
        --data-binary "@$IMPORT_BODY_FILE" 2>"$STATUS_FILE")" \
        || fail "API meta import request failed: $(cat "$STATUS_FILE")"
    expect_status 200 "API meta import failed" "$body"
    log "Web component layer imported"
}

# ─── Дизайн-система base ────────────────────────────────────────────────────

ensure_design_system() {
    local body existing
    DESIGN_SYSTEM_ID=""
    DS_ROOT="/api/projects/$PROJECT_ID/ds"
    body="$(http GET "$DS_ROOT/design-systems")"
    expect_status 200 "Design system listing failed" "$body"
    existing="$(printf '%s' "$body" | python3 -c '
import json, sys
items = json.load(sys.stdin)
items = items if isinstance(items, list) else items.get("items", [])
for name in sys.argv[1:]:
    for ds in items:
        if ds.get("name") == name:
            print(ds["id"], name); sys.exit(0)
' "$DESIGN_SYSTEM_NAME" "base-${PROJECT_ID:0:8}")"
    if [[ -n "$existing" ]]; then
        read -r DESIGN_SYSTEM_ID DESIGN_SYSTEM_NAME <<< "$existing"
    fi
    if [[ -n "$DESIGN_SYSTEM_ID" ]]; then
        log "Design system '$DESIGN_SYSTEM_NAME': $DESIGN_SYSTEM_ID (existing)"
    else
        body="$(http POST "$DS_ROOT/design-systems" "$(python3 -c 'import json, sys; print(json.dumps({"name": sys.argv[1], "projectName": sys.argv[2], "description": "Default design system for creating base components"}, ensure_ascii=False))' "$DESIGN_SYSTEM_NAME" "$PROJECT_NAME")")"
        if [[ "$(tail -c 3 "$STATUS_FILE")" == "409" ]]; then
            DESIGN_SYSTEM_NAME="base-${PROJECT_ID:0:8}"
            log "Name 'base' is already used in another project; creating '$DESIGN_SYSTEM_NAME'"
            body="$(http POST "$DS_ROOT/design-systems" "$(python3 -c 'import json, sys; print(json.dumps({"name": sys.argv[1], "projectName": sys.argv[2], "description": "Default design system for creating base components"}, ensure_ascii=False))' "$DESIGN_SYSTEM_NAME" "$PROJECT_NAME")")"
        fi
        expect_status 201 "Design system creation failed" "$body"
        DESIGN_SYSTEM_ID="$(printf '%s' "$body" | json_field id)"
        log "Design system '$DESIGN_SYSTEM_NAME' created: $DESIGN_SYSTEM_ID"
    fi

    body="$(http GET "$DS_ROOT/design-systems/$DESIGN_SYSTEM_ID/tenants")"
    expect_status 200 "Tenant listing failed" "$body"
    TENANT_ID="$(printf '%s' "$body" | python3 -c '
import json, sys
items = json.load(sys.stdin)
items = items if isinstance(items, list) else items.get("items", [])
for tenant in items:
    if tenant.get("name") == sys.argv[1] and tenant.get("designSystemId") == sys.argv[2]:
        print(tenant["id"]); break
' "$TENANT_NAME" "$DESIGN_SYSTEM_ID")"
    if [[ -n "$TENANT_ID" ]]; then
        log "Theme '$TENANT_NAME': $TENANT_ID (existing)"
    else
        body="$(http POST "$DS_ROOT/tenants" "$(python3 -c 'import json, sys; print(json.dumps({"designSystemId": sys.argv[1], "name": sys.argv[2]}))' "$DESIGN_SYSTEM_ID" "$TENANT_NAME")")"
        expect_status 201 "Theme creation failed" "$body"
        TENANT_ID="$(printf '%s' "$body" | json_field id)"
        log "Theme '$TENANT_NAME' created: $TENANT_ID"
    fi
}

verify() {
    local body components values
    body="$(http POST "$DS_ROOT/component-config/export" "$(python3 -c 'import json, sys; print(json.dumps({"designSystemId": sys.argv[1], "platform": "web"}))' "$DESIGN_SYSTEM_ID")")"
    expect_status 200 "Component export failed" "$body"
    components="$(printf '%s' "$body" | python3 -c 'import json, sys; print(len(json.load(sys.stdin)["components"]))')"
    [[ "$components" != "0" ]] || fail "Design system '$DESIGN_SYSTEM_NAME' has no components: the web component layer was incomplete when the theme was created. Check the API meta import output, then recreate the contour with './setup-local.sh --reset'."
    body="$(http GET "$DS_ROOT/tenants/$TENANT_ID/token-values")"
    expect_status 200 "Token values listing failed" "$body"
    values="$(printf '%s' "$body" | python3 -c 'import json, sys; print(len(json.load(sys.stdin)))')"
    [[ "$values" != "0" ]] || fail "Theme '$TENANT_NAME' has no token values"
    log "Design system '$DESIGN_SYSTEM_NAME' is ready: $components components, $values token values in '$TENANT_NAME'"
}

ensure_web_api_meta
wait_for_gateway
obtain_token
wait_for_projects_api
ensure_project
import_global_layer
ensure_design_system
verify
