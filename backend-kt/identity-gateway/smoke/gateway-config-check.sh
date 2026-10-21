#!/usr/bin/env sh
set -eu

CONFIG="${1:-gateway/nginx.local.conf}"

grep -q "location /internal/" "$CONFIG"
grep -q "return 403" "$CONFIG"
grep -q "auth_request /_auth_project" "$CONFIG"
grep -q 'proxy_set_header X-User-Id $trusted_user_id' "$CONFIG"
grep -q 'proxy_set_header X-Project-Role $trusted_project_role' "$CONFIG"
grep -q 'proxy_set_header X-System-Admin $trusted_system_admin' "$CONFIG"
grep -q 'proxy_set_header X-Compose-Preview-Publisher $trusted_compose_preview_publisher' "$CONFIG"
grep -q 'proxy_set_header X-Compose-Preview-Publisher ""' "$CONFIG"
grep -q 'limit_conn_zone.*ds_route_connections' "$CONFIG"
grep -q 'limit_conn ds_route_connections 16' "$CONFIG"
grep -q "proxy_set_header X-User-Id \"\"" "$CONFIG"
grep -q "Access-Control-Allow-Origin" "$CONFIG"
test "$(grep -c 'Access-Control-Allow-Headers .*X-DS-Base-Revision.*X-DS-Client-Id.*Idempotency-Key' "$CONFIG")" -eq 3
grep -q "return 204" "$CONFIG"

echo "gateway config smoke checks passed"
