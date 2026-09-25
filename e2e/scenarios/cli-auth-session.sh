#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$E2E_ROOT/lib/common.sh"
e2e_load_context

[[ -x "$E2E_CLI" ]] || e2e_fail "CLI executable not found: $E2E_CLI"

e2e_log "Scenario cli-auth-session: checking CLI against Gateway"

cli_home="$E2E_ARTIFACTS_DIR/cli-home"
mkdir -p "$cli_home"
export HOME="$cli_home"
export JAVA_OPTS="${JAVA_OPTS:-} -Duser.home=$cli_home"

login_output="$E2E_ARTIFACTS_DIR/cli-login.txt"
printf '%s\n' 'password' | "$E2E_CLI" auth login \
  --api-url "$E2E_GATEWAY_URL" \
  --username "$E2E_OWNER_USERNAME" > "$login_output"
grep --fixed-strings "Logged in: $E2E_OWNER_USERNAME" "$login_output" >/dev/null || \
  e2e_fail "CLI did not create an authenticated session"

status_output="$E2E_ARTIFACTS_DIR/cli-status.txt"
"$E2E_CLI" auth status --api-url "$E2E_GATEWAY_URL" > "$status_output"
grep --fixed-strings "Logged in: $E2E_OWNER_USERNAME" "$status_output" >/dev/null || \
  e2e_fail "CLI did not read the authenticated session"

logout_output="$E2E_ARTIFACTS_DIR/cli-logout.txt"
"$E2E_CLI" auth logout --api-url "$E2E_GATEWAY_URL" > "$logout_output"
grep --fixed-strings 'Logged out' "$logout_output" >/dev/null || \
  e2e_fail "CLI did not close the authenticated session"

"$E2E_CLI" auth status --api-url "$E2E_GATEWAY_URL" > "$status_output"
grep --fixed-strings 'Not logged in' "$status_output" >/dev/null || \
  e2e_fail "CLI session remains after logout"

e2e_log "PASS: cli-auth-session"
