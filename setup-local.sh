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
  --reset  Delete the data of the local Docker stacks (all volumes) before the setup.
           Without it the existing data is kept.
  --down   Stop the local Docker stacks without deleting their volumes.
  --help   Show this help.

The setup stops the legacy JavaScript stack, starts the Kotlin backend, whose ds-service
creates the schema of its own database with Flyway, fills the design system 'base' through
the gateway (backend-kt/bootstrap-base.sh) and starts the client from the JavaScript stack.

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

js_compose() {
  docker compose \
    --project-name "$JS_COMPOSE_PROJECT_NAME" \
    --project-directory "$ROOT_DIR/js" \
    -f "$ROOT_DIR/js/docker-compose.dev.yml" \
    "$@"
}

if [[ "$ACTION" == "down" ]]; then
  log "Stopping Kotlin backend"
  "$ROOT_DIR/backend-kt/start-local.sh" --down
  log "Stopping JavaScript stack"
  js_compose down
  log "Local stacks are stopped"
  exit 0
fi

if [[ "$RESET" == "1" ]]; then
  log "Resetting local data: removing the volumes of both stacks"
  docker compose -f "$ROOT_DIR/backend-kt/docker-compose.local.yml" down -v
  js_compose down -v
else
  # The legacy JavaScript stack owns the old Postgres on host port 5433, where ds-db now listens.
  log "Stopping the legacy JavaScript stack (volumes are kept)"
  js_compose down
fi

log "Starting Kotlin backend (Flyway creates the schema in ds-db)"
DS_FLYWAY_ADOPT_EXISTING=false "$ROOT_DIR/backend-kt/start-local.sh" --detach

log "Filling the design system 'base' through the gateway"
"$ROOT_DIR/backend-kt/bootstrap-base.sh"

log "Starting the client"
js_compose up -d --build --no-deps client

log "Local setup is ready"
log "API gateway: http://localhost:8080"
log "Client: http://localhost:3002"
