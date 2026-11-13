#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
ICONS_SOURCE=""
CLI="${DSBUILDER_CLI:-}"
IF_EMPTY=0

usage() {
  cat <<'USAGE'
Usage:
  ./publish-local-icons.sh --from local-dev/icons/icons-manifest.json
  ./publish-local-icons.sh --from path/to/plasma/packages/sdds-icons

Local dev helper for the stack started by ./setup-local.sh. It loads the icon catalog into the local backend exactly
as CI does (`dsbuilder icons publish --apply`): the backend stores the SVG files in the local MinIO bucket of the
Compose preview plugin and replaces the catalog in one transaction, so the icon page and the icon picker of the
component editor work. A repeated run of the same set is harmless (`unchanged`).

The source is either a manifest file (a bundled starter set is local-dev/icons/icons-manifest.json) or the
`packages/sdds-icons` directory of the plasma repository (the whole set, about 2000 icons).

Options:
  --from FILE|DIR     Icon manifest or the sdds-icons package directory. Required.
  --if-empty          Load the set only when the catalog is empty, so a repeated setup does not replace a catalog that
                      was loaded by hand (for example the whole set from plasma).
  --gateway-url URL   Gateway URL. Env: GATEWAY_URL. Default: http://localhost:8080.
  --cli PATH          dsbuilder CLI with the `icons` command. Env: DSBUILDER_CLI. By default the `dsbuilder` from PATH
                      is used when it has the command, otherwise the JVM CLI of this repository is built (JDK 17).
  --help              Show this help.

The publication signs in as the local service account of the Keycloak dev realm. Override it with
DSBUILDER_CLIENT_ID and DSBUILDER_CLIENT_SECRET.
USAGE
}

log() {
  echo "[local-icons] $*"
}

fail() {
  echo "[local-icons] $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      ICONS_SOURCE="${2:-}"
      shift 2
      ;;
    --if-empty)
      IF_EMPTY=1
      shift
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
      echo "[local-icons] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "$ICONS_SOURCE" ]] || { usage >&2; fail "Pass the icon manifest or the sdds-icons directory with --from"; }
if [[ -d "$ICONS_SOURCE" ]]; then
  SOURCE_ARGS=(--from-dir "$ICONS_SOURCE")
elif [[ -f "$ICONS_SOURCE" ]]; then
  SOURCE_ARGS=(--from "$ICONS_SOURCE")
else
  fail "Icon source not found: $ICONS_SOURCE"
fi

resolve_cli() {
  if [[ -n "$CLI" ]]; then
    echo "$CLI"
    return
  fi
  if command -v dsbuilder >/dev/null 2>&1 && dsbuilder icons publish --help 2>&1 | grep -q -- '--from-dir'; then
    echo "dsbuilder"
    return
  fi
  local jvm="$ROOT_DIR/frontend-kt/cli/build/install/cli-jvm/bin/dsbuilder"
  log "Building the JVM dsbuilder CLI of this repository (the installed one has no icons command)" >&2
  (cd "$ROOT_DIR/frontend-kt" && ./gradlew --quiet :cli:installJvmDist >&2) || fail "The CLI build failed (JDK 17 is required)"
  [[ -x "$jvm" ]] || fail "The built CLI is missing: $jvm"
  echo "$jvm"
}

CLI="$(resolve_cli)"

# The Keycloak dev realm creates this service account with the publisher role only.
export DSBUILDER_CLIENT_ID="${DSBUILDER_CLIENT_ID:-dsbuilder-preview-publisher}"
export DSBUILDER_CLIENT_SECRET="${DSBUILDER_CLIENT_SECRET:-dev-preview-publisher-secret}"

if [[ "$IF_EMPTY" == "1" ]]; then
  # A dry run reports the differences with the active catalog: an empty catalog has nothing removed, changed or equal.
  PLAN="$("$CLI" icons publish "${SOURCE_ARGS[@]}" --api-url "$GATEWAY_URL" 2>&1)" \
    || fail "The icon catalog could not be checked: $PLAN"
  if ! grep -Eq '^Added: [0-9]+, removed: 0, changed: 0, unchanged: 0$' <<<"$PLAN"; then
    log "The catalog is not empty; it is left as it is"
    exit 0
  fi
fi

log "Publishing the icon catalog from $ICONS_SOURCE to $GATEWAY_URL"
"$CLI" icons publish "${SOURCE_ARGS[@]}" --api-url "$GATEWAY_URL" --apply \
  || fail "The publication failed. Is the stack running (./setup-local.sh)?"

log "Done. The icon page and the icon picker read the catalog from the local backend."
