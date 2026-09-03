#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
read -r -a COMPOSE_CMD_ARR <<< "$COMPOSE_CMD"

DO_CHECK_ONLY=false
DO_LOGS=false

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh [--check] [--logs]

Options:
  --check     Только провалидировать compose/env и выйти.
  --logs      После deploy открыть docker compose logs -f.
  --help      Показать help.
USAGE
}

log() {
  echo "[production deploy] $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[production deploy] Required command '$1' not found" >&2
    exit 1
  }
}

compose() {
  "${COMPOSE_CMD_ARR[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) DO_CHECK_ONLY=true; shift ;;
    --logs) DO_LOGS=true; shift ;;
    --help) usage; exit 0 ;;
    *) echo "[production deploy] Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

require docker

if ! "${COMPOSE_CMD_ARR[@]}" version >/dev/null 2>&1; then
  echo "[production deploy] Docker Compose command not found: $COMPOSE_CMD" >&2
  exit 1
fi

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[production deploy] Missing $ENV_FILE. Create it from .env.prod.example first." >&2
  exit 1
fi

log "Validating production compose configuration"
compose config >/dev/null

if [[ "$DO_CHECK_ONLY" == true ]]; then
  log "Configuration is valid"
  exit 0
fi

log "Pulling production images"
compose pull

log "Starting production stack"
compose up -d --remove-orphans

log "Current container status"
compose ps

log "Gateway health check"
GATEWAY_HEALTHY=false
for _ in {1..30}; do
  if compose exec -T gateway wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1; then
    GATEWAY_HEALTHY=true
    break
  fi
  sleep 2
done

if [[ "$GATEWAY_HEALTHY" == true ]]; then
  log "Gateway is healthy"
else
  echo "[production deploy] Gateway health check failed" >&2
  exit 1
fi

if [[ "$DO_LOGS" == true ]]; then
  log "Following production logs"
  compose logs -f
fi
