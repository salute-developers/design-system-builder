#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
META_FILE=""

usage() {
  cat <<'USAGE'
Usage:
  ./import-compose-components.sh --from path/to/uikit-compose-api-meta.json

Local dev helper for the stack started by ./setup-local.sh. It imports the Compose API meta into the
shared component layer. It does not link components to a design system: that is done by
`dsbuilder components push`, which creates the links and the component configurations together, so the
component editor lists the components in the "Compose" group only after the push.

Options:
  --from FILE            API meta of uikit-compose. It must come from the release the Compose
                         preview plugin is built from.
  --gateway-url URL      Gateway URL. Env: GATEWAY_URL. Default: http://localhost:8080.
  --help                 Show this help.

The import is a system-administrator operation. Sign in once before running the script:
  dsbuilder auth login --api-url http://localhost:8080 --username admin@example.com
USAGE
}

log() {
  echo "[compose-import] $*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      META_FILE="${2:-}"
      shift 2
      ;;
    --gateway-url)
      GATEWAY_URL="${2:-}"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[compose-import] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command_name in dsbuilder; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "[compose-import] Required command '$command_name' not found" >&2
    exit 1
  }
done

if [[ -z "$META_FILE" || ! -f "$META_FILE" ]]; then
  echo "[compose-import] Pass an existing API meta file with --from" >&2
  usage >&2
  exit 2
fi

log "Importing $META_FILE into the component layer"
if ! dsbuilder components import-api --from "$META_FILE" --platform compose --api-url "$GATEWAY_URL" --apply; then
  echo "[compose-import] The import failed. Sign in as a system administrator first:" >&2
  echo "[compose-import]   dsbuilder auth login --api-url $GATEWAY_URL --username admin@example.com" >&2
  exit 1
fi

log "Done. Link the components and add their configurations with `dsbuilder components push --platform compose --apply`."
