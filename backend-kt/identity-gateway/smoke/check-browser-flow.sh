#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
CLIENT_ID="${CLIENT_ID:-dsbuilder-api}"
REDIRECT_URI="${REDIRECT_URI:-http://localhost:8080/}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[check-browser-flow] Требуется команда '$1'" >&2
    exit 1
  }
}

require curl
require python3

auth_url="$GATEWAY_URL/auth/login?client_id=$CLIENT_ID&response_type=code&scope=openid&redirect_uri=$REDIRECT_URI"

echo "[check-browser-flow] Проверяю redirect с /auth/login"
headers="$(curl -sSI "$auth_url")"
location="$(printf '%s\n' "$headers" | awk 'BEGIN{IGNORECASE=1} /^Location:/ {sub(/\r$/, "", $2); print $2}')"

expected_prefix="$GATEWAY_URL/realms/dsbuilder/protocol/openid-connect/auth"
case "$location" in
  "$expected_prefix"*) ;;
  *)
    echo "[check-browser-flow] Неожиданный Location: $location" >&2
    exit 1
    ;;
esac

echo "[check-browser-flow] Проверяю login page через Gateway"
login_page="$(curl -fsSL "$auth_url")"

LOGIN_PAGE="$login_page" GATEWAY_URL="$GATEWAY_URL" python3 - <<'PY'
import os
import re
import sys

html = os.environ["LOGIN_PAGE"]
gateway = os.environ["GATEWAY_URL"]

checks = [
    ("title", "Sign in to dsbuilder" in html),
    ("form", 'id="kc-form-login"' in html),
    ("resources", 'href="/resources/' in html and 'src="/resources/' in html),
    ("register_link", '/realms/dsbuilder/login-actions/registration' in html),
]

action_match = re.search(r'action="([^"]+login-actions/authenticate[^"]+)"', html)
checks.append(("login_action", bool(action_match and action_match.group(1).startswith(f"{gateway}/realms/dsbuilder/"))))

failed = [name for name, ok in checks if not ok]
if failed:
    print("[check-browser-flow] Не пройдены проверки: " + ", ".join(failed), file=sys.stderr)
    sys.exit(1)
PY

echo "[check-browser-flow] OK: browser login flow через Gateway выглядит корректно"
