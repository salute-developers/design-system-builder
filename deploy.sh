#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
read -r -a COMPOSE_CMD_ARR <<< "$COMPOSE_CMD"

DO_PULL=false
DO_CHECK_ONLY=false
DO_LOGS=false
NO_BUILD=false

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh [--pull] [--check] [--logs] [--no-build]

Options:
  --pull      Выполнить git pull перед deploy.
  --check     Только провалидировать compose/env и выйти.
  --logs      После deploy открыть docker compose logs -f.
  --no-build  Запустить up -d без --build.
  --help      Показать help.
USAGE
}

log() {
  echo "[identity-gateway deploy] $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[identity-gateway deploy] Required command '$1' not found" >&2
    exit 1
  }
}

compose() {
  "${COMPOSE_CMD_ARR[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pull)
      DO_PULL=true
      shift
      ;;
    --check)
      DO_CHECK_ONLY=true
      shift
      ;;
    --logs)
      DO_LOGS=true
      shift
      ;;
    --no-build)
      NO_BUILD=true
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[identity-gateway deploy] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require docker
require git

if ! "${COMPOSE_CMD_ARR[@]}" version >/dev/null 2>&1; then
  echo "[identity-gateway deploy] Docker Compose command not found: $COMPOSE_CMD" >&2
  exit 1
fi

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[identity-gateway deploy] Missing $ENV_FILE. Create it from .env.prod.example first." >&2
  exit 1
fi

if [[ "$DO_PULL" == true ]]; then
  log "Pulling latest changes"
  git pull --ff-only
fi

log "Validating production compose configuration"
compose config >/dev/null

if [[ "$DO_CHECK_ONLY" == true ]]; then
  log "Configuration is valid"
  exit 0
fi

if [[ "$NO_BUILD" == true ]]; then
  log "Starting production stack without rebuild"
  compose up -d
else
  log "Building and starting production stack"
  compose up --build -d
fi

log "Current container status"
compose ps

log "Gateway health check"
if curl --fail --silent --show-error "http://localhost:${GATEWAY_PORT:-8080}/health" >/dev/null; then
  log "Gateway is healthy"
else
  echo "[identity-gateway deploy] Gateway health check failed" >&2
  exit 1
fi

if [[ "$DO_LOGS" == true ]]; then
  log "Following production logs"
  compose logs -f
fi
