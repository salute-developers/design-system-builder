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
  --backend-only  Start only the Kotlin backend and its infrastructure; leave JS containers untouched.
  --reset  Delete the data of the local Docker stacks (all volumes) before the setup.
           Without it the existing data is kept.
  --down   Stop the local Docker stacks without deleting their volumes.
  --plugin-zip FILE|URL
           Compose preview plugin archive to publish into the local MinIO after the setup, so the component
           editor shows the Compose preview. Env: COMPOSE_PREVIEW_PLUGIN_ZIP. Default: the archive bundled in
           local-dev/compose-preview.
  --web-plugin-zip FILE|URL
           Web preview plugin archive to publish into the local MinIO after the Compose plugin, so the component
           editor shows the preview of web components. Env: WEB_PREVIEW_PLUGIN_ZIP. Default: the archive bundled in
           local-dev/web-preview.
  --skip-plugin
           Do not publish the preview plugins (neither Compose nor web).
  --icons FILE|DIR
           Icon catalog to load: a manifest file or the packages/sdds-icons directory of plasma (the whole set).
           Env: LOCAL_ICONS_SOURCE. Default: the starter set local-dev/icons/icons-manifest.json.
  --skip-icons
           Do not load the icon catalog (the icon page and the icon picker stay empty).
  --components-package DIR
           Explicitly create a demo design system and import this component package (meta.json and *_config.json).
           Env: COMPOSE_COMPONENTS_PACKAGE. Without an explicit package no demo design system or theme is seeded.
  --theme-package DIR
           Theme package of theme-converter whose Android token values replace the values of the new theme.
           Requires --components-package. Default: local-dev/design-system/theme.
  --publish-version VERSION
           Version published after the component seed. Requires --components-package. Default: 0.1.0.
  --skip-design-system
           Do not create the design system and do not load the components.
  --help   Show this help.

The setup starts the Kotlin backend, whose ds-service creates the schema of its own database
with Flyway, prepares a project and global Web API through the gateway (backend-kt/bootstrap-base.sh)
and starts the client.

The preview plugin archives and the component package are bundled in local-dev/ (see local-dev/README.md;
./refresh-local-dev-assets.sh updates the Compose ones from a plasma-android checkout, `npm run package` in
js/apps/preview-web-plugin the web one). The setup publishes both plugins with ./publish-preview-plugin.sh, which
also imports the API meta of each platform from the archive. The starter icon set local-dev/icons is loaded with
./publish-local-icons.sh (./refresh-local-dev-icons.sh rebuilds it from a plasma checkout).
User design systems and themes are created in the editor with backend defaults.
Only an explicit --components-package (or COMPOSE_COMPONENTS_PACKAGE) invokes ./seed-local-design-system.sh
to create a demo design system and import token values and component configurations.
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
BACKEND_ONLY=0
PLUGIN_ZIP="${COMPOSE_PREVIEW_PLUGIN_ZIP:-}"
PLUGIN_ZIP_EXPLICIT=0
SKIP_PLUGIN=0
[[ -n "$PLUGIN_ZIP" ]] && PLUGIN_ZIP_EXPLICIT=1
WEB_PLUGIN_ZIP="${WEB_PREVIEW_PLUGIN_ZIP:-}"
WEB_PLUGIN_ZIP_EXPLICIT=0
[[ -n "$WEB_PLUGIN_ZIP" ]] && WEB_PLUGIN_ZIP_EXPLICIT=1
ICONS_SOURCE="${LOCAL_ICONS_SOURCE:-}"
ICONS_EXPLICIT=0
SKIP_ICONS=0
[[ -n "$ICONS_SOURCE" ]] && ICONS_EXPLICIT=1
COMPONENTS_PACKAGE="${COMPOSE_COMPONENTS_PACKAGE:-}"
COMPONENTS_PACKAGE_EXPLICIT=0
THEME_PACKAGE_ARGS=()
PUBLISH_VERSION_ARGS=()
SKIP_DESIGN_SYSTEM=0
[[ -n "$COMPONENTS_PACKAGE" ]] && COMPONENTS_PACKAGE_EXPLICIT=1
BUNDLED_PLUGIN_ZIP="$ROOT_DIR/local-dev/compose-preview/preview-compose-plugin.zip"
BUNDLED_WEB_PLUGIN_ZIP="$ROOT_DIR/local-dev/web-preview/preview-web-plugin.zip"
BUNDLED_ICONS="$ROOT_DIR/local-dev/icons/icons-manifest.json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only)
      BACKEND_ONLY=1
      shift
      ;;
    --down)
      ACTION="down"
      shift
      ;;
    --reset)
      RESET=1
      shift
      ;;
    --plugin-zip)
      PLUGIN_ZIP="${2:-}"
      PLUGIN_ZIP_EXPLICIT=1
      shift 2
      ;;
    --web-plugin-zip)
      WEB_PLUGIN_ZIP="${2:-}"
      WEB_PLUGIN_ZIP_EXPLICIT=1
      shift 2
      ;;
    --skip-plugin)
      SKIP_PLUGIN=1
      shift
      ;;
    --icons)
      ICONS_SOURCE="${2:-}"
      ICONS_EXPLICIT=1
      shift 2
      ;;
    --skip-icons)
      SKIP_ICONS=1
      shift
      ;;
    --components-package)
      COMPONENTS_PACKAGE="${2:-}"
      COMPONENTS_PACKAGE_EXPLICIT=1
      shift 2
      ;;
    --theme-package)
      THEME_PACKAGE_ARGS=(--theme-package "${2:-}")
      shift 2
      ;;
    --publish-version)
      PUBLISH_VERSION_ARGS=(--publish-version "${2:-}")
      shift 2
      ;;
    --skip-design-system)
      SKIP_DESIGN_SYSTEM=1
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

if [[ "$ACTION" == "setup" && "$BACKEND_ONLY" == "0" && "$SKIP_DESIGN_SYSTEM" == "0" && ( "${#THEME_PACKAGE_ARGS[@]}" -gt 0 || "${#PUBLISH_VERSION_ARGS[@]}" -gt 0 ) && "$COMPONENTS_PACKAGE_EXPLICIT" == "0" ]]; then
  echo "[local-setup] --theme-package/--publish-version require --components-package (or COMPOSE_COMPONENTS_PACKAGE)" >&2
  exit 2
fi

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
  if [[ "$BACKEND_ONLY" == "0" ]]; then
    log "Stopping the client"
    js_compose down --remove-orphans
  fi
  log "Local stacks are stopped"
  exit 0
fi

if [[ "$RESET" == "1" ]]; then
  log "Resetting local data: removing the volumes of both stacks"
  docker compose -f "$ROOT_DIR/backend-kt/docker-compose.local.yml" down -v
  # --remove-orphans: контейнеры прежнего JS-стека (db-service и его Postgres на порту 5433) больше не описаны в compose.
  if [[ "$BACKEND_ONLY" == "0" ]]; then js_compose down -v --remove-orphans; fi
elif [[ "$BACKEND_ONLY" == "0" ]]; then
  js_compose down --remove-orphans
fi

log "Starting Kotlin backend (Flyway creates the schema in ds-db)"
DS_FLYWAY_ADOPT_EXISTING=false "$ROOT_DIR/backend-kt/start-local.sh" --detach
if [[ "$BACKEND_ONLY" == "1" ]]; then
  log "Backend started; JS stack and seed data were left untouched"
  exit 0
fi

log "Preparing the project and global Web API through the gateway"
"$ROOT_DIR/backend-kt/bootstrap-base.sh"

log "Starting the client"
js_compose up -d --build client

# The plugins are published as CI does it: the backend stores each one in its local MinIO bucket (compose-preview,
# web-preview) and imports the API meta of its platform from the archive. Without an archive the editor simply shows
# no preview of that platform.
publish_plugin() {
  local platform="$1" title="$2" archive="$3" explicit="$4" bundled="$5" hint="$6"
  if [[ -z "$archive" && -f "$bundled" ]]; then
    archive="$bundled"
  fi
  if [[ -z "$archive" ]]; then
    log "No $title archive: $hint"
    return
  fi
  log "Publishing the $title"
  if ! "$ROOT_DIR/publish-preview-plugin.sh" --platform "$platform" --from "$archive"; then
    if [[ "$explicit" == "1" ]]; then
      echo "[local-setup] The requested $title could not be published" >&2
      exit 1
    fi
    log "The $title could not be published; the setup continues without its preview"
  fi
}

if [[ "$SKIP_PLUGIN" == "0" ]]; then
  publish_plugin compose "Compose preview plugin" "$PLUGIN_ZIP" "$PLUGIN_ZIP_EXPLICIT" "$BUNDLED_PLUGIN_ZIP" \
    "restore local-dev/compose-preview or pass --plugin-zip"
  publish_plugin react "web preview plugin" "$WEB_PLUGIN_ZIP" "$WEB_PLUGIN_ZIP_EXPLICIT" "$BUNDLED_WEB_PLUGIN_ZIP" \
    "restore local-dev/web-preview or pass --web-plugin-zip"
fi

# The icon catalog is loaded as CI does it (`dsbuilder icons publish --apply`): the backend stores the SVG files in the
# MinIO bucket of the Compose preview plugin, so the plugin storage must be configured (it is, by the local compose).
if [[ "$SKIP_ICONS" == "0" ]]; then
  if [[ -z "$ICONS_SOURCE" && -f "$BUNDLED_ICONS" ]]; then
    ICONS_SOURCE="$BUNDLED_ICONS"
  fi
  if [[ -z "$ICONS_SOURCE" ]]; then
    log "No icon set: restore local-dev/icons or pass --icons"
  else
    log "Loading the icon catalog"
    ICONS_ARGS=(--from "$ICONS_SOURCE")
    # The bundled set must not replace a catalog that was loaded by hand.
    [[ "$ICONS_EXPLICIT" == "1" ]] || ICONS_ARGS+=(--if-empty)
    if ! "$ROOT_DIR/publish-local-icons.sh" "${ICONS_ARGS[@]}"; then
      if [[ "$ICONS_EXPLICIT" == "1" ]]; then
        echo "[local-setup] The requested icon set could not be loaded" >&2
        exit 1
      fi
      log "The bundled icon set could not be loaded; the setup continues without the icon catalog"
    fi
  fi
fi

# The components of the package must already exist in the global layer: the plugin publication above imports them.
if [[ "$SKIP_DESIGN_SYSTEM" == "0" && "$COMPONENTS_PACKAGE_EXPLICIT" == "1" ]]; then
  if [[ -n "$COMPONENTS_PACKAGE" ]]; then
    log "Creating the design system with a theme and loading the components"
    if ! "$ROOT_DIR/seed-local-design-system.sh" --package "$COMPONENTS_PACKAGE" "${THEME_PACKAGE_ARGS[@]+"${THEME_PACKAGE_ARGS[@]}"}" "${PUBLISH_VERSION_ARGS[@]+"${PUBLISH_VERSION_ARGS[@]}"}"; then
      echo "[local-setup] The requested component package could not be loaded" >&2
      exit 1
    fi
  else
    echo "[local-setup] The requested component package path is empty" >&2
    exit 2
  fi
fi

log "Local setup is ready"
log "API gateway: http://localhost:8080"
log "Client: http://localhost:3002"
