#!/usr/bin/env bash
set -euo pipefail

#############################################
# deploy_source.sh — upload minimal sources and build on server via Compose
#
# What it does now (as requested):
#   • Does NOT copy any .env file at all
#   • Packs ONLY: jars (build/libs), Dockerfile, docker-compose*.yml, and scripts/ (or script/)
#   • Uploads a single context tarball to the server
#   • Extracts into REMOTE_DIR and runs `docker compose build` + `up -d --no-build`
#############################################

log() { echo "[deploy] $*"; }
err() { echo "[err]  $*" >&2; }
_die() { err "$1"; exit 1; }
_dbg() { [[ -n "${SSH_DEBUG:-}" ]] && echo "[ssh-debug] $*" >&2 || true; }

# ----------------------
# Config (env vars)
# ----------------------
SSH_DEST="${SSH_DEST:-}"                 # REQUIRED: user@host
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"                   # optional private key
SSH_JUMP="${SSH_JUMP:-}"                 # optional ProxyJump bastion (user@host:port)
SSH_CONNECT_TIMEOUT="${SSH_CONNECT_TIMEOUT:-10}"
SSH_KEEPALIVE_INTERVAL="${SSH_KEEPALIVE_INTERVAL:-15}"
SSH_KEEPALIVE_COUNT="${SSH_KEEPALIVE_COUNT:-3}"
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_DEBUG="${SSH_DEBUG:-}"

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"     # local root
REMOTE_DIR="${REMOTE_DIR:-~/project-publisher}"  # remote root
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
SERVICE_NAME="${SERVICE_NAME:-backend}"
IMAGE="${IMAGE:-}"                        # REQUIRED tag used by compose (BACKEND_IMAGE)

[[ -z "$SSH_DEST" ]] && _die "SSH_DEST is required (user@host)."
[[ -z "$IMAGE"    ]] && _die "IMAGE tag is required (e.g. org/app:tag)."
[[ -f "$PROJECT_DIR/docker-compose.yml" ]] || _die "docker-compose.yml not found in $PROJECT_DIR"

# Normalize SSH key path if provided
if [[ -n "$SSH_KEY" ]]; then
  [[ "$SSH_KEY" == ~* ]] && SSH_KEY="${SSH_KEY/#~/$HOME}"
  if [[ "$SSH_KEY" != /* ]]; then SSH_KEY="$(cd "${SSH_KEY%/*}" 2>/dev/null && pwd)/${SSH_KEY##*/}"; fi
  [[ -f "$SSH_KEY" ]] || _die "SSH key not found at: $SSH_KEY"
fi

# ----------------------
# SSH/SCP args
# ----------------------
SSH_ARGS=("-p" "$SSH_PORT")
SCP_ARGS=("-P" "$SSH_PORT")
[[ -n "$SSH_KEY" ]] && { SSH_ARGS+=("-i" "$SSH_KEY"); SCP_ARGS+=("-i" "$SSH_KEY"); }
[[ -n "$SSH_JUMP" ]] && { SSH_ARGS+=("-J" "$SSH_JUMP"); SCP_ARGS+=("-o" "ProxyJump=$SSH_JUMP"); }
SSH_ARGS+=("-o" "ConnectTimeout=$SSH_CONNECT_TIMEOUT" \
          "-o" "ServerAliveInterval=$SSH_KEEPALIVE_INTERVAL" \
          "-o" "ServerAliveCountMax=$SSH_KEEPALIVE_COUNT" \
          "-o" "StrictHostKeyChecking=$SSH_STRICT_HOST_KEY_CHECKING")
SCP_ARGS+=("-o" "ConnectTimeout=$SSH_CONNECT_TIMEOUT" \
          "-o" "ServerAliveInterval=$SSH_KEEPALIVE_INTERVAL" \
          "-o" "ServerAliveCountMax=$SSH_KEEPALIVE_COUNT" \
          "-o" "StrictHostKeyChecking=$SSH_STRICT_HOST_KEY_CHECKING")

_dbg "SSH_DEST=$SSH_DEST"
_dbg "SSH_ARGS=${SSH_ARGS[*]}"
_dbg "SCP_ARGS=${SCP_ARGS[*]}"

# ----------------------
# Quick connectivity check
# ----------------------
log "Checking SSH connectivity..."
if ! ssh "${SSH_ARGS[@]}" ${SSH_DEBUG:+-vvv} -o BatchMode=yes "$SSH_DEST" "echo ok" >/dev/null 2>&1; then
  _die "SSH connectivity failed. Check host/port/firewall, key, or use SSH_JUMP."
fi

# ----------------------
# Prepare context (ONLY jars, Dockerfile, compose files, scripts/script dirs)
# ----------------------
ART_DIR="$(mktemp -d)"; trap 'rm -rf "$ART_DIR" >/dev/null 2>&1 || true' EXIT
CONTEXT_TAR="$ART_DIR/context.tar.gz"

# Build list of existing paths
pushd "$PROJECT_DIR" >/dev/null
paths=()
# Dockerfile
[[ -f Dockerfile ]] && paths+=(Dockerfile)
# compose files
[[ -f docker-compose.yml ]] && paths+=(docker-compose.yml)
[[ -f docker-compose.deploy.yml ]] && paths+=(docker-compose.deploy.yml)
# jars directory
[[ -d build/libs ]] && paths+=(build/libs)
# scripts directories (support both names)
[[ -d scripts ]] && paths+=(scripts)
[[ -d script ]] && paths+=(script)

[[ ${#paths[@]} -eq 0 ]] && _die "Nothing to pack. Expected at least one of: Dockerfile, compose files, build/libs, scripts/ or script/."

log "Packing context -> $CONTEXT_TAR"
COPYFILE_DISABLE=1 tar -czf "$CONTEXT_TAR" "${paths[@]}"
popd >/dev/null

# ----------------------
# Upload and remote build via Compose
# ----------------------
ssh "${SSH_ARGS[@]}" "$SSH_DEST" "mkdir -p '$REMOTE_DIR'" || _die "Failed to create remote dir"
scp "${SCP_ARGS[@]}" "$CONTEXT_TAR" "$SSH_DEST:$REMOTE_DIR/" || _die "SCP context.tar.gz failed"

log "Building image on server via compose: $IMAGE"
ssh "${SSH_ARGS[@]}" "$SSH_DEST" \
  "set -euo pipefail; cd '$REMOTE_DIR' && \
   tar -xzf context.tar.gz && \
   export BACKEND_IMAGE='$IMAGE'; \
   if [ -f docker-compose.deploy.yml ]; then \
     $COMPOSE_CMD --project-directory '$REMOTE_DIR' -f '$REMOTE_DIR/docker-compose.yml' -f '$REMOTE_DIR/docker-compose.deploy.yml' build '$SERVICE_NAME'; \
     $COMPOSE_CMD --project-directory '$REMOTE_DIR' -f '$REMOTE_DIR/docker-compose.yml' -f '$REMOTE_DIR/docker-compose.deploy.yml' up -d --no-build; \
   else \
     $COMPOSE_CMD --project-directory '$REMOTE_DIR' -f '$REMOTE_DIR/docker-compose.yml' build '$SERVICE_NAME'; \
     $COMPOSE_CMD --project-directory '$REMOTE_DIR' -f '$REMOTE_DIR/docker-compose.yml' up -d --no-build; \
   fi && \
   docker image prune -f >/dev/null 2>&1 || true" || _die "Remote build/deploy failed"

log "Done: server-built image '$IMAGE' is running."