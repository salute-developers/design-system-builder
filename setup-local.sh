#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JS_COMPOSE_PROJECT_NAME="${DSBUILDER_JS_COMPOSE_PROJECT_NAME:-design-system-builder}"

usage() {
  cat <<'USAGE'
Usage:
  ./setup-local.sh
  ./setup-local.sh --reset
  ./setup-local.sh --down

Options:
  --reset  Delete the data of both local Docker stacks (all volumes) before the setup.
           Without it the existing data is kept.
  --down   Stop both local Docker stacks without deleting their volumes.
  --help   Show this help.

The setup starts the JavaScript stack without a schema, starts the Kotlin backend,
whose ds-service creates the shared database schema with Flyway, and then seeds the
database and binds the design system 'base' to the user's project.

To list the Compose components in the component editor, run ./import-compose-components.sh afterwards.
USAGE
}

log() {
  echo "[local-setup] $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[local-setup] Required command '$1' not found" >&2
    exit 1
  }
}

ACTION="setup"
RESET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --down)
      ACTION="down"
      shift
      ;;
    --reset)
      RESET=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[local-setup] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require docker

if ! docker compose version >/dev/null 2>&1; then
  echo "[local-setup] Docker Compose plugin is not available" >&2
  exit 1
fi

if [[ "$ACTION" == "down" ]]; then
  log "Stopping Kotlin backend"
  "$ROOT_DIR/backend-kt/start-local.sh" --down

  log "Stopping JavaScript stack"
  docker compose \
    --project-name "$JS_COMPOSE_PROJECT_NAME" \
    --project-directory "$ROOT_DIR/js" \
    -f "$ROOT_DIR/js/docker-compose.dev.yml" \
    down

  log "Both local stacks are stopped"
  exit 0
fi

js_compose() {
  docker compose \
    --project-name "$JS_COMPOSE_PROJECT_NAME" \
    --project-directory "$ROOT_DIR/js" \
    -f "$ROOT_DIR/js/docker-compose.dev.yml" \
    "$@"
}

# The shared schema is owned by Flyway in ds-service, so a database that was filled by the Drizzle
# runner (tables without Flyway history) cannot be reused: say so instead of failing inside ds-service.
check_schema_owner() {
  local tables history
  tables="$(js_compose exec -T postgres-registry psql -U postgres -d ds_registry -qAt \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null || echo 0)"
  history="$(js_compose exec -T postgres-registry psql -U postgres -d ds_registry -qAt \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'flyway_schema_history'" 2>/dev/null || echo 0)"
  if [[ "${tables:-0}" != "0" && "${history:-0}" == "0" ]]; then
    echo "[local-setup] The database 'ds_registry' has a schema that Flyway does not manage (created by the" >&2
    echo "[local-setup] Drizzle runner). Run './setup-local.sh --reset' to recreate it; this deletes local data." >&2
    exit 1
  fi
}

if [[ "$RESET" == "1" ]]; then
  log "Resetting local data: removing the volumes of both stacks"
  docker compose -f "$ROOT_DIR/backend-kt/docker-compose.local.yml" down -v
fi

log "Setting up JavaScript stack (without a schema: Flyway creates it)"
(
  cd "$ROOT_DIR/js"
  DS_SCHEMA_MIGRATION_OWNER=flyway DSBUILDER_RESET_VOLUMES="$RESET" ./setup-docker.sh
)

check_schema_owner

log "Starting Kotlin backend"
DS_FLYWAY_ADOPT_EXISTING=false "$ROOT_DIR/backend-kt/start-local.sh" --detach

log "Seeding the database and binding the design system 'base'"
(
  cd "$ROOT_DIR/js"
  DS_SCHEMA_MIGRATION_OWNER=flyway ./setup-docker.sh --seed-only
)

log "Local setup is ready"
log "API gateway: http://localhost:8080"
