#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$E2E_ROOT/lib/common.sh"
e2e_load_context

e2e_log "Scenario api-project-access: checking Gateway authentication and project access"

response_file="$E2E_ARTIFACTS_DIR/api-project-access.json"
status="$(e2e_http_status "$response_file" "$E2E_GATEWAY_URL/api/projects")"
e2e_assert_equals "401" "$status" "Anonymous projects request must be rejected"

owner_token="$(e2e_access_token "$E2E_OWNER_USERNAME")"
status="$(
  e2e_http_status "$response_file" \
    "$E2E_GATEWAY_URL/api/projects/$E2E_PROJECT_ID" \
    --header "Authorization: Bearer $owner_token"
)"
e2e_assert_equals "200" "$status" "Project owner cannot read the common project"
jq --exit-status --arg id "$E2E_PROJECT_ID" \
  '.id == $id and .status == "active"' "$response_file" >/dev/null || \
  e2e_fail "Gateway returned unexpected project data"

other_token="$(e2e_access_token "$E2E_OTHER_USERNAME")"
status="$(
  e2e_http_status "$response_file" \
    "$E2E_GATEWAY_URL/api/projects/$E2E_PROJECT_ID" \
    --header "Authorization: Bearer $other_token"
)"
e2e_assert_equals "403" "$status" "A user without project access must be rejected"

e2e_log "PASS: api-project-access"
