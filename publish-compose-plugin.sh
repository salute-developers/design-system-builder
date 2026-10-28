#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
PLUGIN_SOURCE=""
CLI="${DSBUILDER_CLI:-}"

usage() {
  cat <<'USAGE'
Usage:
  ./publish-compose-plugin.sh --from path/to/preview-compose-plugin.zip
  ./publish-compose-plugin.sh --from https://example.com/preview-compose-plugin.zip

Local dev helper for the stack started by ./setup-local.sh. It sends a prebuilt Compose preview plugin to the
local backend, exactly as the plasma-android CI does: the backend stores the files in the local MinIO bucket,
imports the API meta from the archive into the component layer and makes the build active, so the component
editor shows the Compose preview.

The archive bundled in this repository is local-dev/compose-preview/preview-compose-plugin.zip (setup-local.sh uses
it by default; ./refresh-local-dev-assets.sh updates it). A fresh build comes from plasma-android:
  ./gradlew :integration-core:preview-compose-plugin:previewPluginArtifact
  -> integration-core/preview-compose-plugin/build/distributions/preview-compose-plugin.zip

Options:
  --from FILE|URL    Plugin archive: a local file or an http(s) address.
  --gateway-url URL  Gateway URL. Env: GATEWAY_URL. Default: http://localhost:8080.
  --cli PATH         dsbuilder CLI with the `preview-plugin` command. Env: DSBUILDER_CLI. By default the `dsbuilder`
                     from PATH is used when it knows the command, otherwise the JVM CLI of this repository is
                     built (needs JDK 17).
  --help             Show this help.

The publication signs in as the local service account of the Keycloak dev realm. Override it with
DSBUILDER_CLIENT_ID and DSBUILDER_CLIENT_SECRET. A repeated publication of the same build is harmless.
USAGE
}

log() {
  echo "[compose-plugin] $*"
}

fail() {
  echo "[compose-plugin] $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      PLUGIN_SOURCE="${2:-}"
      shift 2
      ;;
    --gateway-url)
      GATEWAY_URL="${2:-}"
      shift 2
      ;;
    --cli)
      CLI="${2:-}"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[compose-plugin] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "$PLUGIN_SOURCE" ]] || { usage >&2; fail "Pass the plugin archive with --from"; }

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

ARCHIVE="$PLUGIN_SOURCE"
if [[ "$PLUGIN_SOURCE" =~ ^https?:// ]]; then
  command -v curl >/dev/null 2>&1 || fail "Required command 'curl' not found"
  ARCHIVE="$WORK_DIR/preview-compose-plugin.zip"
  log "Downloading $PLUGIN_SOURCE"
  curl -fsSL -o "$ARCHIVE" "$PLUGIN_SOURCE" || fail "Could not download $PLUGIN_SOURCE"
fi
[[ -f "$ARCHIVE" ]] || fail "Plugin archive not found: $ARCHIVE"

resolve_cli() {
  if [[ -n "$CLI" ]]; then
    echo "$CLI"
    return
  fi
  if command -v dsbuilder >/dev/null 2>&1 && dsbuilder --help 2>&1 | grep -q 'preview-plugin'; then
    echo "dsbuilder"
    return
  fi
  local jvm="$ROOT_DIR/frontend-kt/cli/build/install/cli-jvm/bin/dsbuilder"
  log "Building the JVM dsbuilder CLI of this repository (the installed one has no 'preview-plugin' command)" >&2
  (cd "$ROOT_DIR/frontend-kt" && ./gradlew --quiet :cli:installJvmDist >&2) || fail "The CLI build failed (JDK 17 is required)"
  [[ -x "$jvm" ]] || fail "The built CLI is missing: $jvm"
  echo "$jvm"
}

CLI="$(resolve_cli)"

# The Keycloak dev realm (backend-kt/identity-gateway) creates this service account with the publisher role only.
export DSBUILDER_CLIENT_ID="${DSBUILDER_CLIENT_ID:-dsbuilder-preview-publisher}"
export DSBUILDER_CLIENT_SECRET="${DSBUILDER_CLIENT_SECRET:-dev-preview-publisher-secret}"

log "Publishing $ARCHIVE to $GATEWAY_URL"
"$CLI" preview-plugin publish --platform compose --from "$ARCHIVE" --api-url "$GATEWAY_URL" --apply \
  || fail "The publication failed. Is the stack running (./setup-local.sh)?"

log "Done. The component editor loads the plugin from the local MinIO bucket."
