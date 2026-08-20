#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDENTITY_DIR="$ROOT_DIR/identity-gateway"
PROJECTS_DIR="$ROOT_DIR/projects-service"
DIST_ROOT="$ROOT_DIR/build/deploy-bundle"
BUNDLE_DIR="$DIST_ROOT/identity-gateway-deploy"
ARCHIVE_PATH="$ROOT_DIR/build/distributions/identity-gateway-deploy.tar.gz"

usage() {
  cat <<'USAGE'
Usage:
  ./build-deploy-bundle.sh [--skip-build]

Creates a minimal local deployment bundle archive for identity-gateway.
USAGE
}

log() {
  echo "[identity-gateway bundle-build] $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[identity-gateway bundle-build] Required command '$1' not found" >&2
    exit 1
  }
}

copy_file() {
  local src="$1"
  local dst="$2"
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
}

write_local_deploy_script() {
  local dst="$BUNDLE_DIR/deploy.sh"
  mkdir -p "$(dirname "$dst")"
  cat >"$dst" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$ROOT_DIR/start-local.sh" --no-build --detach "$@"
SCRIPT
}

SKIP_BUILD=false

if [[ $# -gt 0 ]]; then
  case "$1" in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[identity-gateway bundle-build] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
fi

require tar

cd "$ROOT_DIR"

if [[ "$SKIP_BUILD" == true ]]; then
  log "Skipping jar build and using existing artifacts"
else
  log "Building auth-helper fat jar"
  ./gradlew -p "$IDENTITY_DIR" :app:shadowJar

  log "Building projects-service fat jar"
  ./gradlew -p "$PROJECTS_DIR" :app:shadowJar
fi

log "Preparing bundle directory"
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"
mkdir -p "$ROOT_DIR/build/distributions"

copy_file "$ROOT_DIR/docker-compose.local.yml" "$BUNDLE_DIR/docker-compose.local.yml"
copy_file "$ROOT_DIR/start-local.sh" "$BUNDLE_DIR/start-local.sh"
write_local_deploy_script
copy_file "$ROOT_DIR/DEPLOY.md" "$BUNDLE_DIR/DEPLOY.md"
copy_file "$IDENTITY_DIR/.env.local.example" "$BUNDLE_DIR/identity-gateway/.env.local"
copy_file "$IDENTITY_DIR/.env.local.example" "$BUNDLE_DIR/identity-gateway/.env.local.example"
copy_file "$IDENTITY_DIR/app/Dockerfile.local" "$BUNDLE_DIR/identity-gateway/app/Dockerfile.local"
copy_file "$IDENTITY_DIR/app/build/libs/app-all.jar" "$BUNDLE_DIR/identity-gateway/app/build/libs/app-all.jar"
copy_file "$IDENTITY_DIR/gateway/nginx.local.conf" "$BUNDLE_DIR/identity-gateway/gateway/nginx.local.conf"
copy_file "$IDENTITY_DIR/keycloak/dsbuilder-realm.json" "$BUNDLE_DIR/identity-gateway/keycloak/dsbuilder-realm.json"
copy_file "$PROJECTS_DIR/app/Dockerfile.local" "$BUNDLE_DIR/projects-service/app/Dockerfile.local"
copy_file "$PROJECTS_DIR/app/build/libs/app-all.jar" "$BUNDLE_DIR/projects-service/app/build/libs/app-all.jar"

chmod +x "$BUNDLE_DIR/deploy.sh"
chmod +x "$BUNDLE_DIR/start-local.sh"

log "Creating archive"
rm -f "$ARCHIVE_PATH"
tar -czf "$ARCHIVE_PATH" -C "$DIST_ROOT" identity-gateway-deploy

log "Bundle created at $ARCHIVE_PATH"
