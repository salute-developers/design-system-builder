#!/usr/bin/env sh
set -eu

CONFIG="${1:-gateway/nginx.local.conf}"

grep -q "location /internal/" "$CONFIG"
grep -q "return 403" "$CONFIG"
grep -q "auth_request /_auth_project" "$CONFIG"
grep -q 'proxy_set_header X-User-Id $trusted_user_id' "$CONFIG"
grep -q 'proxy_set_header X-Project-Role $trusted_project_role' "$CONFIG"
grep -q 'proxy_set_header X-System-Admin $trusted_system_admin' "$CONFIG"
grep -q "proxy_set_header X-User-Id \"\"" "$CONFIG"
grep -q "Access-Control-Allow-Origin" "$CONFIG"
grep -q "return 204" "$CONFIG"

echo "gateway config smoke checks passed"
