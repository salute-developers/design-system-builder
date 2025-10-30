#!/usr/bin/env bash
set -euo pipefail

# Usage examples:
#  ./deploy.sh                          # uses dev defaults, pulls image if IMAGE is set, otherwise tries to load tar
#  ENV=prod IMAGE=ghcr.io/org/app:prod ./deploy.sh
#  ENV=dev  IMAGE_TAR=./backend-dev.tar.gz ./deploy.sh
#  ENV=prod ENV_FILE=.env.prod IMAGE=ghcr.io/org/app:1.2.3 ./deploy.sh
#  SSH_DEST=user@server REMOTE_DIR=~/project-publisher ENV=prod IMAGE=ghcr.io/org/app:1.2.3 ./deploy.sh  # builds/saves image locally, uploads only artifacts
#  SSH_DEST=deploy@1.2.3.4 SSH_PORT=2222 ENV=prod IMAGE=ghcr.io/org/app:1.2.3 IMAGE_TAR=./backend-prod.tar.gz ./deploy.sh


# ----------------------
# Config via environment
# ----------------------
ENV="${ENV:-dev}"                    # dev | prod
IMAGE="${IMAGE:-}"                  # e.g. ghcr.io/org/app:dev or myapp:dev
IMAGE_TAR="${IMAGE_TAR:-}"          # path to .tar or .tar.gz with docker image (alternative to IMAGE)
ENV_FILE_INPUT="${ENV_FILE:-}"      # optional override, otherwise auto-pick
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}" # directory with docker-compose.yml on server
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}" # allow override to `docker-compose` if old distro

# Default artifacts bundle name used in SSH mode
ARTIFACT_IMAGE_NAME="image.tar.gz"

# Backend service name in docker-compose.yml
SERVICE_NAME="backend"

# ----------------------
# Helpers
# ----------------------
log() { echo -e "\033[1;34m[deploy]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[warn]\033[0m $*"; }
err() { echo -e "\033[1;31m[err]\033[0m  $*" 1>&2; }

require() {
  command -v "$1" >/dev/null 2>&1 || { err "Required command '$1' not found"; exit 1; }
}

healthcheck() {
  local url="${HEALTH_URL:-http://localhost:8081/health}"
  local attempts="${HEALTH_ATTEMPTS:-20}"
  local delay="${HEALTH_DELAY_SEC:-2}"
  for i in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "Healthcheck OK: $url"
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

# ----------------------
# Checks
# ----------------------
if [[ -n "$SSH_DEST" ]]; then
  require ssh
  require scp
  # Need local docker only if we must create an image tarball
  if [[ -z "$IMAGE_TAR" ]]; then
    require docker
  fi
else
  require docker
  if ! $COMPOSE_CMD version >/dev/null 2>&1; then
    err "Docker Compose command not found (tried: '$COMPOSE_CMD'). Install Docker Compose v2."; exit 1
  fi
fi

if [[ ! -f "$PROJECT_DIR/docker-compose.yml" ]]; then
  err "docker-compose.yml not found in $PROJECT_DIR"; exit 1
fi

# Prepare SSH/SCP args
SSH_ARGS=()
SCP_ARGS=()
if [[ -n "${SSH_PORT:-}" ]]; then
  SSH_ARGS+=("-p" "$SSH_PORT")
  SCP_ARGS+=("-P" "$SSH_PORT")
fi
if [[ -n "$SSH_KEY" ]]; then
  if [[ ! -f "$SSH_KEY" ]]; then
    err "SSH key file not found: $SSH_KEY"; exit 1
  fi
  log "key >$SSH_KEY<"
  SSH_ARGS+=("-i" "$SSH_KEY")
  SCP_ARGS+=("-i" "$SSH_KEY")
fi

# ----------------------
# SSH mode: build/collect artifacts locally and upload only artifacts
# ----------------------
if [[ -n "$SSH_DEST" ]]; then
  REMOTE_DIR=${REMOTE_DIR:-"/opt/project-publisher"}
  log "SSH target: $SSH_DEST:${SSH_PORT:-22}"
  log "Remote dir: $REMOTE_DIR"

  # We need IMAGE tag to be known on the server for compose
  if [[ -z "$IMAGE" ]]; then
    err "SSH mode requires IMAGE to be set (tag used by docker-compose on server)."; exit 1
  fi

  # Prepare temporary artifacts directory
  ART_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'deploy_artifacts')
  trap 'rm -rf "$ART_DIR"' EXIT

  # 1) Decide env file (already computed below), copy compose & env into artifacts
  cp -f "$PROJECT_DIR/docker-compose.yml" "$ART_DIR/docker-compose.yml"

  # We'll resolve ENV_FILE (ENV_FILE_INPUT or auto-pick) later in the script just below; but for SSH path we need it now
  # Re-run small portion to compute ENV_FILE the same way this script would
  if [[ -n "$ENV_FILE_INPUT" ]]; then
    _EF="$ENV_FILE_INPUT"
  else
    case "$ENV" in
      prod) _EF=.env.prod ;;
      *)    _EF=.env.dev  ;;
    esac
  fi
  if [[ ! -f "$PROJECT_DIR/$_EF" ]]; then
    warn "ENV file '$_EF' not found in $PROJECT_DIR"
  else
    cp -f "$PROJECT_DIR/$_EF" "$ART_DIR/$_EF"
  fi

  # 2) Ensure we have an image tarball locally
  LOCAL_TAR="$ART_DIR/$ARTIFACT_IMAGE_NAME"
  if [[ -n "$IMAGE_TAR" ]]; then
    # Normalize to gzip and correct name in artifacts
    if [[ "$IMAGE_TAR" == *.gz ]]; then
      cp -f "$IMAGE_TAR" "$LOCAL_TAR"
    else
      # re-pack to gz to keep a consistent filename
      gzip -c "$IMAGE_TAR" > "$LOCAL_TAR"
    fi
  else
    log "Building image locally via compose: $IMAGE"
    (
      cd "$PROJECT_DIR" && \
      BACKEND_IMAGE="$IMAGE" \
      $COMPOSE_CMD -f docker-compose.yml -f docker-compose.deploy.yml build "$SERVICE_NAME"
    )
    log "Saving image $IMAGE to tar.gz: $LOCAL_TAR"
    docker save "$IMAGE" | gzip > "$LOCAL_TAR"
  fi

  # 3) Upload artifacts: compose file, image tarball
  log "Uploading artifacts with args ${SSH_ARGS[0]} ${SSH_ARGS[1]} and dest $SSH_DEST to dir $REMOTE_DIR"
  ssh "${SSH_ARGS[@]}" "$SSH_DEST" "mkdir -p '$REMOTE_DIR'" || { err "Failed to create remote dir"; exit 1; }
  scp "${SCP_ARGS[@]}" "$ART_DIR/docker-compose.yml" "$SSH_DEST:$REMOTE_DIR/" || { err "SCP docker-compose.yml failed"; exit 1; }
  if [[ -n "$ENV_FILE_INPUT" && -f "$ART_DIR/$_EF" ]]; then
    scp "${SCP_ARGS[@]}" "$ART_DIR/$_EF" "$SSH_DEST:$REMOTE_DIR/" || { err "SCP env file failed"; exit 1; }
  fi
  scp "${SCP_ARGS[@]}" "$LOCAL_TAR" "$SSH_DEST:$REMOTE_DIR/$ARTIFACT_IMAGE_NAME" || { err "SCP image tar failed"; exit 1; }

  # 4) Run deploy on server using only uploaded artifacts
  log "Running deploy remotely (load image, compose up)..."
  ssh "${SSH_ARGS[@]}" "$SSH_DEST" \
    "set -euo pipefail; cd '$REMOTE_DIR' && \
     docker load -i '$ARTIFACT_IMAGE_NAME' && \
     export BACKEND_IMAGE='$IMAGE'; \
     ${COMPOSE_CMD} -f docker-compose.yml up -d --no-build && \
     docker image prune -f >/dev/null 2>&1 || true" || { err "Remote deploy failed"; exit 1; }

  log "Remote deploy completed."
  exit 0
fi

# ----------------------
# Decide ENV file
# ----------------------
if [[ -n "$ENV_FILE_INPUT" ]]; then
  ENV_FILE="$ENV_FILE_INPUT"
else
  case "$ENV" in
    prod) ENV_FILE=.env.prod ;;
    *)    ENV_FILE=.env.dev  ;;
  esac
fi
if [[ ! -f "$PROJECT_DIR/$ENV_FILE" ]]; then
  warn "ENV file '$ENV_FILE' not found in $PROJECT_DIR — falling back to .env"
  ENV_FILE=.env
fi

log "Environment: $ENV"
log "ENV file:    $ENV_FILE"

# ----------------------
# Load or pull image
# ----------------------
if [[ -n "$IMAGE_TAR" ]]; then
  log "Loading image from archive: $IMAGE_TAR"
  if [[ "$IMAGE_TAR" == *.gz ]]; then
    gunzip -c "$IMAGE_TAR" | docker load
  else
    docker load < "$IMAGE_TAR"
  fi
  # Try to infer the image name from 'docker load' output by listing most-recent image for the repo if IMAGE is empty
  if [[ -z "$IMAGE" ]]; then
    IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | head -n1)
    log "Using loaded image: $IMAGE"
  fi
elif [[ -n "$IMAGE" ]]; then
  log "Pulling image: $IMAGE"
  docker pull "$IMAGE"
else
  err "Neither IMAGE nor IMAGE_TAR provided. Set IMAGE (registry tag) or IMAGE_TAR (path to archive)."; exit 1
fi

# ----------------------
# Deploy with Compose
# ----------------------
export BACKEND_IMAGE="$IMAGE"     # used by docker-compose.yml
export ENV_FILE="$ENV_FILE"       # used by docker-compose.yml for env_file interpolation

log "Bringing up stack (no build)..."
$COMPOSE_CMD --env-file "$ENV_FILE" -f "$PROJECT_DIR/docker-compose.yml" up -d --no-build

log "Pruning old images (dangling)..."
docker image prune -f >/dev/null 2>&1 || true

# ----------------------
# Post-deploy checks
# ----------------------
if healthcheck; then
  log "Deployment finished successfully."
else
  warn "Healthcheck failed — showing last logs:"
  $COMPOSE_CMD logs --no-log-prefix --tail=200 "$SERVICE_NAME" || true
  exit 1
fi
