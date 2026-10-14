#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JS_COMPOSE_PROJECT_NAME="${DSBUILDER_JS_COMPOSE_PROJECT_NAME:-design-system-builder}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
DESIGN_SYSTEM="base"
META_FILE=""

usage() {
  cat <<'USAGE'
Usage:
  ./import-compose-components.sh --from path/to/uikit-compose-api-meta.json [--design-system base]

Local dev helper for the stack started by ./setup-local.sh. It imports the Compose API meta into the
shared component layer and links the imported Compose components to a design system, so the component
editor lists them in the "Compose" group.

Options:
  --from FILE            API meta of uikit-compose. It must come from the release the Compose
                         preview plugin is built from.
  --design-system NAME   Design system to link the components to. Default: base.
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
    --design-system)
      DESIGN_SYSTEM="${2:-}"
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

for command_name in docker dsbuilder; do
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

log "Linking Compose components to the design system '$DESIGN_SYSTEM'"
docker compose \
  --project-name "$JS_COMPOSE_PROJECT_NAME" \
  --project-directory "$ROOT_DIR/js" \
  -f "$ROOT_DIR/js/docker-compose.dev.yml" \
  exec -T postgres-registry psql -U postgres -d ds_registry -v ON_ERROR_STOP=1 -v ds="$DESIGN_SYSTEM" -qAt <<'SQL'
WITH target AS (
  SELECT id FROM design_systems WHERE name = :'ds'
), linked AS (
  INSERT INTO design_system_components (design_system_id, component_id)
  SELECT target.id, c.id FROM target, components c WHERE c.platform = 'compose'
  ON CONFLICT (design_system_id, component_id) DO NOTHING
  RETURNING 1
)
SELECT 'linked ' || (SELECT count(*) FROM linked) || ' new Compose component(s); design system found: ' || (SELECT count(*) FROM target);
SQL

log "Done. Open the component editor with VITE_COMPOSE_PREVIEW_PLUGIN_URL set to see the Compose group."
