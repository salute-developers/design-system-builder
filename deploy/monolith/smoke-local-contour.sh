#!/usr/bin/env bash
set -Eeuo pipefail

base_url="${MONOLITH_BASE_URL:-http://127.0.0.1:8080}"
realm="${KEYCLOAK_REALM:-dsbuilder}"
client_id="${OIDC_CLIENT_ID:-dsbuilder-api}"
username="${SMOKE_USERNAME:-user@example.com}"
password="${SMOKE_PASSWORD:-password}"

token="$(curl --fail --silent --show-error \
  --data-urlencode grant_type=password \
  --data-urlencode client_id="$client_id" \
  --data-urlencode username="$username" \
  --data-urlencode password="$password" \
  "$base_url/realms/$realm/protocol/openid-connect/token" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).access_token')"

curl --fail --silent --show-error "$base_url/health/ready" >/dev/null
curl --fail --silent --show-error -H "Authorization: Bearer $token" "$base_url/api/projects" >/dev/null

project_id="${SMOKE_PROJECT_ID:-}"
if [[ -z "$project_id" ]]; then
  project_id="$(curl --fail --silent --show-error \
    -X POST \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d '{"name":"Monolith smoke project","description":"Created by smoke-local-contour.sh"}' \
    "$base_url/api/projects" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).id')"
fi

curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  "$base_url/api/projects/$project_id" >/dev/null

design_system_id="$(curl --fail --silent --show-error \
  -X POST \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Monolith smoke $project_id\",\"projectName\":\"Monolith smoke project\",\"projectId\":\"$project_id\"}" \
  "$base_url/api/projects/$project_id/ds/design-systems" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).id')"

curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  "$base_url/api/projects/$project_id/ds/design-systems/$design_system_id" >/dev/null

smoke_tmp="$(mktemp -d)"
trap 'rm -rf "$smoke_tmp"' EXIT
mkdir -p "$smoke_tmp/bundle/content"
printf '{"navigation":[]}' >"$smoke_tmp/bundle/docs.json"
printf '%s' "{\"schemaVersion\":\"1.0\",\"designSystem\":{\"id\":\"$design_system_id\",\"version\":\"1.0.0\"},\"platform\":\"compose\",\"artifacts\":[{\"type\":\"RESOLVED_DOCS\",\"path\":\"docs.json\",\"format\":\"dsb-resolved-docs-v1\"},{\"type\":\"CONTENT_ROOT\",\"path\":\"content/\",\"format\":null}]}" >"$smoke_tmp/bundle/manifest.json"
tar -C "$smoke_tmp/bundle" -czf "$smoke_tmp/bundle.tar.gz" manifest.json docs.json content

job_id="$(curl --fail --silent --show-error \
  -X POST \
  -H "Authorization: Bearer $token" \
  --form "bundle=@$smoke_tmp/bundle.tar.gz;type=application/gzip" \
  "$base_url/api/projects/$project_id/documentation/bundles" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).jobId')"

job_status=""
for _ in {1..30}; do
  job_status="$(curl --fail --silent --show-error \
    -H "Authorization: Bearer $token" \
    "$base_url/api/projects/$project_id/documentation/ingestion-jobs/$job_id" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).status')"
  [[ "$job_status" == "succeeded" || "$job_status" == "failed" ]] && break
  sleep 1
done
[[ "$job_status" == "succeeded" ]]

publication_id="$(curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  "$base_url/api/projects/$project_id/documentation/publications/active?designSystemId=$design_system_id&version=1.0.0&platform=compose" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).publicationId')"

curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  "$base_url/api/projects/$project_id/documentation/publications/$publication_id/navigation" >/dev/null
curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  "$base_url/api/projects/$project_id/documentation/search?designSystemId=$design_system_id&version=1.0.0&platform=compose&query=smoke" >/dev/null
