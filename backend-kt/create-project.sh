#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
REALM="${REALM:-dsbuilder}"
CLIENT_ID="${CLIENT_ID:-dsbuilder-api}"
ADMIN_USERNAME="${ADMIN_USERNAME:-${USERNAME:-admin@example.com}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${PASSWORD:-password}}"
PROJECT_NAME="${PROJECT_NAME:-}"
PROJECT_DESCRIPTION="${PROJECT_DESCRIPTION:-}"

usage() {
  cat <<'USAGE'
Usage:
  ./create-project.sh --name "Project name" [--description "Description"]

Local dev helper for the stack started by:
  ./start-local.sh --detach

Options:
  --name NAME                 Project name. Env: PROJECT_NAME.
  --description DESCRIPTION   Optional project description. Env: PROJECT_DESCRIPTION.
  --gateway-url URL           Gateway URL. Env: GATEWAY_URL. Default: http://localhost:8080.
  --username USERNAME         Local system_admin username. Default: admin@example.com.
  --password PASSWORD         Local system_admin password. Default: password.
  --help                      Show this help.

Optional env overrides for local auth plumbing:
  REALM=dsbuilder
  CLIENT_ID=dsbuilder-api
USAGE
}

log() {
  echo "[create-project] $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[create-project] Требуется команда '$1'" >&2
    exit 1
  }
}

json_field() {
  local field="$1"
  python3 -c '
import json
import sys

data = json.load(sys.stdin)
value = data
for part in sys.argv[1].split("."):
    value = value[part]
print(value)
' "$field"
}

project_payload() {
  PROJECT_NAME="$PROJECT_NAME" PROJECT_DESCRIPTION="$PROJECT_DESCRIPTION" python3 -c '
import json
import os

payload = {"name": os.environ["PROJECT_NAME"]}
description = os.environ.get("PROJECT_DESCRIPTION", "")
if description:
    payload["description"] = description
print(json.dumps(payload, ensure_ascii=False))
'
}

print_json() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    python3 -m json.tool
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      PROJECT_NAME="${2:-}"
      shift 2
      ;;
    --description)
      PROJECT_DESCRIPTION="${2:-}"
      shift 2
      ;;
    --gateway-url)
      GATEWAY_URL="${2:-}"
      shift 2
      ;;
    --realm)
      REALM="${2:-}"
      shift 2
      ;;
    --client-id)
      CLIENT_ID="${2:-}"
      shift 2
      ;;
    --username)
      ADMIN_USERNAME="${2:-}"
      shift 2
      ;;
    --password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[create-project] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require curl
require python3

if [[ -z "$PROJECT_NAME" ]]; then
  echo "[create-project] Project name is required. Pass --name or PROJECT_NAME." >&2
  usage >&2
  exit 2
fi

log "Проверяю Gateway health: $GATEWAY_URL"
curl -fsS "$GATEWAY_URL/health" >/dev/null

log "Получаю access token для $ADMIN_USERNAME"
token_response="$(
  curl -fsS -X POST "$GATEWAY_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=password" \
    --data-urlencode "client_id=$CLIENT_ID" \
    --data-urlencode "username=$ADMIN_USERNAME" \
    --data-urlencode "password=$ADMIN_PASSWORD"
)"

access_token="$(printf '%s' "$token_response" | json_field "access_token")"

if [[ -z "$access_token" || "$access_token" == "null" ]]; then
  echo "[create-project] Не удалось получить access_token" >&2
  exit 1
fi

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

log "Создаю проект: $PROJECT_NAME"
http_status="$(
  curl -sS -o "$response_file" -w "%{http_code}" -X POST "$GATEWAY_URL/api/projects" \
    -H "Authorization: Bearer $access_token" \
    -H "Content-Type: application/json" \
    -d "$(project_payload)"
)"

if [[ "$http_status" != "201" ]]; then
  echo "[create-project] Не удалось создать проект. HTTP $http_status" >&2
  cat "$response_file" >&2
  echo >&2
  exit 1
fi

log "Проект создан"
print_json <"$response_file"
