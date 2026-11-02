#!/usr/bin/env bash
# Готовит проект пользователя и глобальный слой Web API через Gateway.
# Дизайн-системы и темы создаёт пользователь; их начальные данные инициализирует backend.
# Повторный запуск не импортирует пользовательские значения и конфигурации компонентов.
# К базе напрямую скрипт не обращается.
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

ensure_web_api_meta
wait_for_gateway
obtain_token
wait_for_projects_api
ensure_project
import_global_layer
log "Project and global Web API are ready; create a design system in the editor"
