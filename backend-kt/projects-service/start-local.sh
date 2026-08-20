#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

usage() {
  cat <<'USAGE'
Usage:
  ./start-local.sh [--build-only] [--no-build] [--detach] [--down] [--logs]

Options:
  --build-only  Build shared local stack jars and docker images, then exit.
  --no-build    Skip Gradle jar build.
  --detach      Start docker compose in detached mode.
  --down        Stop shared local compose stack.
  --logs        Follow compose logs for the shared local stack.
  --help        Show this help.
USAGE
}

log() {
  echo "[projects-service] $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[projects-service] Required command '$1' not found" >&2
    exit 1
  }
}

BUILD_JAR=true
BUILD_ONLY=false
DETACH=false
DOWN=false
LOGS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    --no-build)
      BUILD_JAR=false
      shift
      ;;
    --detach)
      DETACH=true
      shift
      ;;
    --down)
      DOWN=true
      shift
      ;;
    --logs)
      LOGS=true
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[projects-service] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require docker

if ! $COMPOSE_CMD version >/dev/null 2>&1; then
  echo "[projects-service] Docker Compose command not found: $COMPOSE_CMD" >&2
  exit 1
fi

if [[ "$DOWN" == true ]]; then
  log "Stopping shared local stack"
  cd "$ROOT_DIR"
  $COMPOSE_CMD -f docker-compose.local.yml down
  exit 0
fi

if [[ "$LOGS" == true ]]; then
  log "Following shared local stack logs"
  cd "$ROOT_DIR"
  $COMPOSE_CMD -f docker-compose.local.yml logs -f
  exit 0
fi

if [[ "$BUILD_JAR" == true ]]; then
  log "Building Projects Service fat jar"
  "$ROOT_DIR/gradlew" -p "$ROOT_DIR/projects-service" :app:shadowJar
fi

cd "$ROOT_DIR"

if [[ "$BUILD_ONLY" == true ]]; then
  log "Building compose images"
  $COMPOSE_CMD -f docker-compose.local.yml build
  exit 0
fi

log "Starting shared local stack"
if [[ "$DETACH" == true ]]; then
  $COMPOSE_CMD -f docker-compose.local.yml up --build -d
else
  $COMPOSE_CMD -f docker-compose.local.yml up --build
fi
