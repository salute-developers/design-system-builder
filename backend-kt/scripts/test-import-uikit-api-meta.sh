#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

printf '[]\n' >"$work_dir/input.json"

dry_run_output="$($script_dir/import-uikit-api-meta.sh --input "$work_dir/input.json")"
jq -e 'select(.mode == "dry-run" and .sourceComponents == 0)' \
    <<<"$(sed -n '1,/^}/p' <<<"$dry_run_output")" >/dev/null
grep -q 'Dry-run only' <<<"$dry_run_output"

mkdir -p "$work_dir/bin"
cat >"$work_dir/bin/curl" <<'CURL'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CURL_LOG"
printf '[]\n200\n'
CURL
chmod +x "$work_dir/bin/curl"

CURL_LOG="$work_dir/curl.log" PATH="$work_dir/bin:$PATH" \
    "$script_dir/import-uikit-api-meta.sh" --input "$work_dir/input.json" --apply >/dev/null

[[ "$(wc -l <"$work_dir/curl.log" | tr -d ' ')" -eq 3 ]]
grep -q 'http://localhost:8085/api/ds/components' "$work_dir/curl.log"
grep -q 'http://localhost:8085/api/ds/states' "$work_dir/curl.log"
grep -q 'http://localhost:8085/api/ds/property-platform-params' "$work_dir/curl.log"
grep -q -- '-H X-Actor-Type: user' "$work_dir/curl.log"
grep -q -- '-H X-Project-Id: global' "$work_dir/curl.log"
grep -q -- '-H X-System-Admin: true' "$work_dir/curl.log"
! grep -q 'localhost:3008\|db-service' "$work_dir/curl.log"

echo "import-uikit-api-meta dry-run and isolated system_admin transport: OK"
