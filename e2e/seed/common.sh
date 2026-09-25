#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$E2E_ROOT/lib/common.sh"

e2e_log "Seeding common project data through Gateway"

owner_username="user@example.com"
other_username="user2@example.com"
owner_token="$(e2e_access_token "$owner_username")"
response_file="$E2E_ARTIFACTS_DIR/seed-project.json"

status="$(
  e2e_http_status "$response_file" \
    --request POST "$E2E_GATEWAY_URL/api/projects" \
    --header "Authorization: Bearer $owner_token" \
    --header 'Content-Type: application/json' \
    --data "{\"name\":\"E2E common project $E2E_RUN_ID\",\"description\":\"Shared fixture for E2E scenarios\"}"
)"
e2e_assert_equals "201" "$status" "Common project creation failed"

project_id="$(jq --exit-status --raw-output '.id' "$response_file")"
[[ -n "$project_id" && "$project_id" != "null" ]] || e2e_fail "Seed response has no project id"

{
  printf 'E2E_PROJECT_ID=%q\n' "$project_id"
  printf 'E2E_OWNER_USERNAME=%q\n' "$owner_username"
  printf 'E2E_OTHER_USERNAME=%q\n' "$other_username"
} > "$E2E_CONTEXT_FILE"

e2e_log "Common data is ready"
