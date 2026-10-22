#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLASMA_ANDROID=""
TOKEN_MODULE="tokens/sdds.serv.compose"
BUILD_PLUGIN=1

usage() {
  cat <<'USAGE'
Usage:
  ./refresh-local-dev-assets.sh --plasma-android path/to/plasma-android [--token-module tokens/sdds.serv.compose]

Updates the files that ./setup-local.sh bundles in local-dev/ and rewrites the provenance in local-dev/README.md:
  - local-dev/compose-preview/preview-compose-plugin.zip   built in plasma-android with previewPluginArtifact
                                                            (needs JDK 17 and Node)
  - local-dev/design-system/theme/                          Android token values of the theme
  - local-dev/design-system/components/                     component package (meta.json and *_config.json)
The theme and the component package are downloaded from the public theme-converter repository
(https://github.com/salute-developers/theme-converter) in the names and versions that the token module declares
in its gradle.properties (theme-name, theme-version, components-name, components-version). Review the diff and
commit the result.

Options:
  --plasma-android DIR   plasma-android checkout. Required.
  --token-module PATH    Token module of plasma-android that declares the theme. Default: tokens/sdds.serv.compose.
  --skip-plugin-build    Copy the plugin archive that is already built.
  --help                 Show this help.
USAGE
}

log() {
  echo "[refresh-local-dev] $*"
}

fail() {
  echo "[refresh-local-dev] $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plasma-android)
      PLASMA_ANDROID="${2:-}"
      shift 2
      ;;
    --token-module)
      TOKEN_MODULE="${2:-}"
      shift 2
      ;;
    --skip-plugin-build)
      BUILD_PLUGIN=0
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[refresh-local-dev] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "$PLASMA_ANDROID" && -d "$PLASMA_ANDROID" ]] || { usage >&2; fail "Pass the plasma-android checkout with --plasma-android"; }
PLASMA_ANDROID="$(cd "$PLASMA_ANDROID" && pwd)"

if [[ "$BUILD_PLUGIN" == "1" ]]; then
  log "Building the plugin archive"
  (cd "$PLASMA_ANDROID" && ./gradlew --quiet :integration-core:preview-compose-plugin:previewPluginArtifact) \
    || fail "The plugin build failed"
fi

ZIP="$PLASMA_ANDROID/integration-core/preview-compose-plugin/build/distributions/preview-compose-plugin.zip"
PROPERTIES="$PLASMA_ANDROID/$TOKEN_MODULE/gradle.properties"
[[ -f "$ZIP" ]] || fail "The plugin archive is missing: $ZIP"
[[ -f "$PROPERTIES" ]] || fail "The token module has no gradle.properties: $PROPERTIES"

property() {
  local value
  value="$(grep -E "^$1=" "$PROPERTIES" | head -1 | cut -d= -f2- | tr -d '[:space:]')"
  [[ -n "$value" ]] || fail "$1 is not declared in $PROPERTIES"
  echo "$value"
}
THEME_NAME="$(property theme-name)"
THEME_VERSION="$(property theme-version)"
COMPONENTS_NAME="$(property components-name)"
COMPONENTS_VERSION="$(property components-version)"
BASE_URL="https://github.com/salute-developers/theme-converter/raw/main"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
download() {
  curl -fsSL -o "$WORK_DIR/$2.zip" "$BASE_URL/$1" || fail "Could not download $BASE_URL/$1"
  mkdir -p "$WORK_DIR/$2"
  unzip -q -o "$WORK_DIR/$2.zip" -d "$WORK_DIR/$2" -x '__MACOSX/*' || fail "Could not unpack $1"
}
log "Downloading the theme $THEME_NAME $THEME_VERSION and the components $COMPONENTS_NAME $COMPONENTS_VERSION"
download "themes/$THEME_NAME/$THEME_VERSION.zip" theme
download "components/$COMPONENTS_NAME/$COMPONENTS_VERSION.zip" components
[[ -f "$WORK_DIR/components/meta.json" ]] || fail "The component package has no meta.json"
[[ -d "$WORK_DIR/theme/android" ]] || fail "The theme package has no android directory"

log "Copying the plugin archive"
cp "$ZIP" "$ROOT_DIR/local-dev/compose-preview/preview-compose-plugin.zip"

log "Copying the theme (Android values) and the component package"
rm -rf "$ROOT_DIR/local-dev/design-system/theme" "$ROOT_DIR/local-dev/design-system/components"
mkdir -p "$ROOT_DIR/local-dev/design-system/theme/android" "$ROOT_DIR/local-dev/design-system/components"
cp "$WORK_DIR"/theme/android/*.json "$ROOT_DIR/local-dev/design-system/theme/android/"
cp "$WORK_DIR/components/meta.json" "$WORK_DIR"/components/*_config.json "$ROOT_DIR/local-dev/design-system/components/"

COMMIT="$(git -C "$PLASMA_ANDROID" rev-parse HEAD 2>/dev/null || echo unknown)"
python3 - "$ROOT_DIR" "$COMMIT" "$THEME_NAME" "$THEME_VERSION" "$COMPONENTS_NAME" "$COMPONENTS_VERSION" <<'PY'
import hashlib, json, re, sys, zipfile
root, commit, theme_name, theme_version, components_name, components_version = sys.argv[1:7]
zip_path = f"{root}/local-dev/compose-preview/preview-compose-plugin.zip"
manifest = json.loads(zipfile.ZipFile(zip_path).read("preview-plugin.json"))
package = json.load(open(f"{root}/local-dev/design-system/components/meta.json"))
digest = hashlib.sha256(open(zip_path, "rb").read()).hexdigest()
block = (
    "<!-- provenance:start -->\n"
    f"- Plugin archive: build `{manifest['version']}` (commit `{manifest['commit']}`), uikit-compose "
    f"`{manifest['uikitComposeVersion']}`, protocol {manifest['protocolVersion']}, sha256 `{digest}`.\n"
    f"- Theme (Android values): `{theme_name}` `{theme_version}` from theme-converter.\n"
    f"- Component package: `{components_name}` `{components_version}`, {len(package['components'])} configurations, "
    "from theme-converter.\n"
    f"- plasma-android commit of the refresh: `{commit}`.\n"
    "<!-- provenance:end -->"
)
path = f"{root}/local-dev/README.md"
text = open(path).read()
text = re.sub(r"<!-- provenance:start -->.*?<!-- provenance:end -->", lambda _: block, text, flags=re.S)
open(path, "w").write(text)
PY

log "Done. Review 'git status local-dev' and commit the update."
