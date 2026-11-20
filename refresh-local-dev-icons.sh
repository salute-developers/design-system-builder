#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDDS_ICONS=""
CLI="${DSBUILDER_CLI:-}"
ICONS_DIR="$ROOT_DIR/local-dev/icons"

usage() {
  cat <<'USAGE'
Usage:
  ./refresh-local-dev-icons.sh --sdds-icons path/to/plasma/packages/sdds-icons

Rebuilds the starter icon set that ./setup-local.sh bundles in local-dev/icons/icons-manifest.json: the icons named in
local-dev/icons/starter-icons.txt (one canonical name per line) with all their sizes, taken from the SVG sources of
the @salutejs/sdds-icons package. Names that the package no longer has are reported and skipped. Review the diff and
commit the result.

Options:
  --sdds-icons DIR   packages/sdds-icons directory of a plasma checkout (it has svg/16, svg/24 and svg/36). Required.
  --cli PATH         dsbuilder CLI with the `icons` command. Env: DSBUILDER_CLI. Default: the one that
                     ./publish-local-icons.sh resolves.
  --help             Show this help.
USAGE
}

log() {
  echo "[refresh-local-icons] $*"
}

fail() {
  echo "[refresh-local-icons] $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sdds-icons)
      SDDS_ICONS="${2:-}"
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
      echo "[refresh-local-icons] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -d "$SDDS_ICONS/svg/24" ]] || { usage >&2; fail "Pass the packages/sdds-icons directory with --sdds-icons"; }
command -v python3 >/dev/null 2>&1 || fail "Required command 'python3' not found"

if [[ -z "$CLI" ]]; then
  if command -v dsbuilder >/dev/null 2>&1 && dsbuilder icons publish --help 2>&1 | grep -q -- '--from-dir'; then
    CLI="dsbuilder"
  else
    CLI="$ROOT_DIR/frontend-kt/cli/build/install/cli-jvm/bin/dsbuilder"
    log "Building the JVM dsbuilder CLI of this repository"
    (cd "$ROOT_DIR/frontend-kt" && ./gradlew --quiet :cli:installJvmDist) || fail "The CLI build failed (JDK 17 is required)"
  fi
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# A dry run without --apply only builds the manifest: nothing is sent to a backend that is not running.
log "Reading the SVG sources of $SDDS_ICONS"
"$CLI" icons publish --from-dir "$SDDS_ICONS" --api-url "http://localhost:8080" --write-manifest "$WORK_DIR/full.json" \
  >/dev/null 2>&1 || true
[[ -s "$WORK_DIR/full.json" ]] || fail "The CLI did not write the manifest; run it by hand: $CLI icons publish --from-dir $SDDS_ICONS --write-manifest FILE"

python3 - "$WORK_DIR/full.json" "$ICONS_DIR/starter-icons.txt" "$ICONS_DIR/icons-manifest.json" <<'PY'
import json
import sys

source, names_file, target = sys.argv[1:4]
manifest = json.load(open(source, encoding="utf-8"))
wanted = [line.strip() for line in open(names_file, encoding="utf-8") if line.strip()]
by_name = {icon["name"]: icon for icon in manifest["icons"]}
missing = [name for name in wanted if name not in by_name]
if missing:
    print("[refresh-local-icons] Not in the package, skipped: " + ", ".join(missing), file=sys.stderr)
icons = [by_name[name] for name in sorted(wanted) if name in by_name]
manifest["icons"] = icons
with open(target, "w", encoding="utf-8") as out:
    json.dump(manifest, out, ensure_ascii=False, separators=(",", ":"))
print(f"[refresh-local-icons] {len(icons)} icons, {manifest['source']['package']} {manifest['source']['version']}")
PY
log "Written $ICONS_DIR/icons-manifest.json"
