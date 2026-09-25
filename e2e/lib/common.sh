#!/usr/bin/env bash

e2e_log() {
  echo "[e2e] $*"
}

e2e_fail() {
  echo "[e2e] FAIL: $*" >&2
  exit 1
}

e2e_require() {
  command -v "$1" >/dev/null 2>&1 || e2e_fail "Required command '$1' not found"
}

e2e_assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="$3"

  [[ "$actual" == "$expected" ]] || \
    e2e_fail "$message: expected '$expected', got '$actual'"
}

e2e_access_token() {
  local username="$1"
  local password="${2:-password}"
  local response

  response="$(
    curl --fail-with-body --silent --show-error \
      --request POST "$E2E_GATEWAY_URL/auth/token" \
      --header 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode 'grant_type=password' \
      --data-urlencode 'client_id=dsbuilder-api' \
      --data-urlencode "username=$username" \
      --data-urlencode "password=$password"
  )" || e2e_fail "Cannot obtain an access token for $username"

  printf '%s' "$response" | jq --exit-status --raw-output '.access_token'
}

e2e_http_status() {
  local output_file="$1"
  shift

  curl --silent --show-error --output "$output_file" --write-out '%{http_code}' "$@"
}

e2e_load_context() {
  [[ -f "$E2E_CONTEXT_FILE" ]] || e2e_fail "E2E context not found: $E2E_CONTEXT_FILE"
  # shellcheck source=/dev/null
  source "$E2E_CONTEXT_FILE"
}
