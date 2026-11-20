#!/usr/bin/env sh
set -eu

exec python3 "$(dirname "$0")/bootstrap-production-keycloak.py"
