#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
META_FILE=""
LIBRARY_ID="uikit-compose"
CORE_VERSION=""
CORE_CHANNEL=""

usage() {
  cat <<'USAGE'
Usage:
  ./import-compose-components.sh --from path/to/uikit-compose-api-meta.json --core-version 0.57.0 --channel stable

Local dev helper for the stack started by ./setup-local.sh. It imports the Compose API meta into the
shared component layer. It does not link components to a design system: that is done by
`dsbuilder components push`, which creates the links and the component configurations together, so the
component editor lists the components in the "Compose" group only after the push.

Options:
  --from FILE            API meta of uikit-compose. It must come from the release the Compose
                         preview plugin is built from.
  --library-id ID        Core library. Default: uikit-compose.
  --core-version VERSION Exact Core version (required).
  --channel stable|dev   Core channel (required).
  --gateway-url URL      Gateway URL. Env: GATEWAY_URL. Default: http://localhost:8080.
  --help                 Show this help.

The import is a system-administrator operation. Sign in once before running the script:
  DSBUILDER_API_URL=http://localhost:8080 dsbuilder auth login
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
    --library-id) LIBRARY_ID="${2:-}"; shift 2 ;;
    --core-version) CORE_VERSION="${2:-}"; shift 2 ;;
    --channel) CORE_CHANNEL="${2:-}"; shift 2 ;;
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

[[ -n "$CORE_VERSION" && "$CORE_CHANNEL" =~ ^(stable|dev)$ ]] || {
  echo "[compose-import] Pass --core-version VERSION and --channel stable|dev" >&2
  exit 2
}
log "Importing $META_FILE into the component layer"
if ! DSBUILDER_API_URL="$GATEWAY_URL" dsbuilder components import-api --from "$META_FILE" --platform compose \
  --library-id "$LIBRARY_ID" --core-version "$CORE_VERSION" --channel "$CORE_CHANNEL" --apply; then
  echo "[compose-import] The import failed. Sign in as a system administrator first:" >&2
  echo "[compose-import]   DSBUILDER_API_URL=$GATEWAY_URL dsbuilder auth login" >&2
  exit 1
fi

log 'Done. Link the components and add their configurations with `dsbuilder components push --platform compose --apply`.'
