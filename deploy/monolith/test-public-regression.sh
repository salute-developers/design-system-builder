#!/usr/bin/env bash
set -Eeuo pipefail

base_url="${MONOLITH_BASE_URL:-http://127.0.0.1:8080}"
legacy_url="${LEGACY_BASE_URL:-}"
realm="${KEYCLOAK_REALM:-dsbuilder}"
client_id="${OIDC_CLIENT_ID:-dsbuilder-api}"

token() {
  local url="$1" username="$2"
  curl --fail --silent --show-error \
    --data-urlencode grant_type=password \
    --data-urlencode client_id="$client_id" \
    --data-urlencode username="$username" \
    --data-urlencode password=password \
    "$url/auth/token" |
    node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).access_token'
}

assert_status() {
  local expected="$1"
  shift
  local actual
  actual="$(curl --silent --output /dev/null --write-out '%{http_code}' "$@")"
  [[ "$actual" == "$expected" ]] || {
    echo "Expected HTTP $expected, got $actual" >&2
    exit 1
  }
}

check_common_contract() {
  local url="$1" bearer="$2"
  assert_status 200 "$url/health"
  assert_status 404 "$url/auth/login"
  assert_status 404 "$url/auth/register"
  assert_status 302 "$url/auth/account"
  assert_status 404 "$url/admin"
  assert_status 404 "$url/admin/console"
  assert_status 404 "$url/api/admin"
  assert_status 404 "$url/api/admin/users"
  assert_status 308 "$url/api/projects/"
  assert_status 401 "$url/api/projects"
  assert_status 401 -H 'X-System-Admin: true' -H 'X-User-Id: forged' "$url/api/projects"
  assert_status 403 "$url/internal/projects/anything/access-check"
  assert_status 204 -X OPTIONS -H 'Origin: http://localhost:5173' "$url/api/projects"
  assert_status 200 -H "Authorization: Bearer $bearer" "$url/api/projects"
}

owner_token="$(token "$base_url" user@example.com)"
other_token="$(token "$base_url" user2@example.com)"
check_common_contract "$base_url" "$owner_token"

if [[ -n "$legacy_url" ]]; then
  legacy_token="$(token "$legacy_url" user@example.com)"
  check_common_contract "$legacy_url" "$legacy_token"
fi

project_json="$(curl --fail --silent --show-error \
  -X POST -H "Authorization: Bearer $owner_token" -H 'Content-Type: application/json' \
  -d '{"name":"Monolith regression project"}' "$base_url/api/projects")"
project_id="$(node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).id' <<<"$project_json")"

assert_status 403 \
  -H "Authorization: Bearer $other_token" \
  -H 'X-System-Admin: true' \
  "$base_url/api/projects/$project_id"

key_json="$(curl --fail --silent --show-error \
  -X POST -H "Authorization: Bearer $owner_token" -H 'Content-Type: application/json' \
  -d '{"name":"regression-read-key","scopes":["design-systems:read"]}' \
  "$base_url/api/projects/$project_id/access-keys")"
project_key="$(node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).secret' <<<"$key_json")"

assert_status 200 \
  -H "Authorization: ProjectKey $project_key" \
  "$base_url/api/projects/$project_id/ds/design-systems"
assert_status 403 \
  -X POST -H "Authorization: ProjectKey $project_key" -H 'Content-Type: application/json' -d '{}' \
  "$base_url/api/projects/$project_id/ds/component-config/import"
assert_status 401 \
  -H 'Authorization: ProjectKey invalid' \
  "$base_url/api/projects/$project_id/ds/design-systems"

design_system_json="$(curl --fail --silent --show-error \
  -X POST -H "Authorization: Bearer $owner_token" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Regression $project_id\",\"projectName\":\"Monolith regression project\",\"projectId\":\"$project_id\"}" \
  "$base_url/api/projects/$project_id/ds/design-systems")"
design_system_id="$(node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).id' <<<"$design_system_json")"

regression_tmp="$(mktemp -d)"
trap 'rm -rf "$regression_tmp"' EXIT
mkdir -p "$regression_tmp/bundle/content"
printf '{"navigation":[]}' >"$regression_tmp/bundle/docs.json"
printf '%s' "{\"schemaVersion\":\"1.0\",\"designSystem\":{\"id\":\"$design_system_id\",\"version\":\"1.0.0\"},\"platform\":\"compose\",\"artifacts\":[{\"type\":\"RESOLVED_DOCS\",\"path\":\"docs.json\",\"format\":\"dsb-resolved-docs-v1\"},{\"type\":\"CONTENT_ROOT\",\"path\":\"content/\",\"format\":null}]}" >"$regression_tmp/bundle/manifest.json"
dd if=/dev/urandom of="$regression_tmp/bundle/payload.bin" bs=1m count="${LARGE_UPLOAD_MIB:-12}" status=none
tar -C "$regression_tmp/bundle" -czf "$regression_tmp/bundle.tar.gz" manifest.json docs.json content payload.bin
assert_status 202 \
  -X POST -H "Authorization: Bearer $owner_token" \
  --form "bundle=@$regression_tmp/bundle.tar.gz;type=application/gzip" \
  "$base_url/api/projects/$project_id/documentation/bundles"
