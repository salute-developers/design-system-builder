#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
PROJECT_ID="${PROJECT_ID:-project-1}"
USERNAME="${USERNAME:-user@example.com}"
PASSWORD="${PASSWORD:-password}"
CLIENT_ID="${CLIENT_ID:-dsbuilder-api}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[check-api-flow] Требуется команда '$1'" >&2
    exit 1
  }
}

require curl
require jq
require python3

echo "[check-api-flow] Проверяю health Gateway"
curl -fsS "$GATEWAY_URL/health" >/dev/null

echo "[check-api-flow] Получаю access token"
token_response="$(curl -fsS -X POST "$GATEWAY_URL/realms/dsbuilder/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "username=$USERNAME" \
  -d "password=$PASSWORD")"

access_token="$(printf '%s' "$token_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')"
user_id="$(ACCESS_TOKEN="$access_token" python3 - <<'PY'
import base64
import json
import os

token = os.environ["ACCESS_TOKEN"]
payload = token.split(".")[1]
payload += "=" * (-len(payload) % 4)
decoded = base64.urlsafe_b64decode(payload.encode("ascii"))
print(json.loads(decoded)["sub"])
PY
)"

if [[ -z "$access_token" || "$access_token" == "null" ]]; then
  echo "[check-api-flow] Не удалось получить access_token" >&2
  printf '%s\n' "$token_response" >&2
  exit 1
fi

if [[ -z "$user_id" || "$user_id" == "null" ]]; then
  echo "[check-api-flow] Не удалось извлечь userId из access token" >&2
  exit 1
fi

echo "[check-api-flow] Отправляю project-scoped запрос через Gateway"
api_response="$(curl -fsS "$GATEWAY_URL/projects/$PROJECT_ID/test" \
  -H "Authorization: Bearer $access_token" \
  -H "X-User-Id: spoofed-user" \
  -H "X-Project-Role: owner" \
  -H "X-System-Admin: true")"

printf '%s' "$api_response" | jq -e --arg project_id "$PROJECT_ID" '
  .http.originalUrl == ("/projects/" + $project_id + "/test") and
  .http.method == "GET" and
  .request.headers["x-user-id"] == $user_id and
  .request.headers["x-project-id"] == $project_id and
  .request.headers["x-project-role"] == "viewer" and
  .request.headers["x-system-admin"] == "false" and
  .request.headers["x-actor-type"] == "user" and
  .request.headers["x-user-id"] != "spoofed-user"
' --arg user_id "$user_id" >/dev/null

echo "[check-api-flow] OK: token получен, Gateway пропустил запрос, trusted headers выставлены"
