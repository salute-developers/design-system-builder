#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
DESIGN_SYSTEM_NAME="sdds_serv_local"
DESIGN_SYSTEM_NAME_EXPLICIT=0
THEME_NAME="sdds_serv_local"
THEME_PROFILE="malachite"
PUBLISH_VERSION="0.1.0"
PACKAGE_DIR=""
THEME_PACKAGE="$ROOT_DIR/local-dev/design-system/theme"
USERNAME="${DSBUILDER_LOCAL_USERNAME:-admin@example.com}"
PASSWORD="${DSBUILDER_LOCAL_PASSWORD:-password}"
CLI="${DSBUILDER_CLI:-}"

usage() {
  cat <<'USAGE'
Usage:
  ./seed-local-design-system.sh --package path/to/components [--theme-package path/to/theme]

Local dev helper for the stack started by ./setup-local.sh. It creates a design system with a theme in the
local project and loads the component configurations of a package into it, so the component editor lists the
Compose components and shows their preview (the plugin itself is published by ./publish-preview-plugin.sh).

The package is a directory with `meta.json` and the component configuration files, for example the one
that the theme builder of a plasma-android token module downloads. The package bundled in this repository is
local-dev/design-system/components (./refresh-local-dev-assets.sh updates it from
tokens/sdds.serv.compose/build/theme-builder/components).

Options:
  --package DIR          Component package (meta.json and *_config.json).
  --theme-package DIR    Theme package of theme-converter (android/android_*.json). Its Android token values replace
                         the values of the new theme, which Compose preview reads. Default: local-dev/design-system/theme.
                         Pass an empty value to keep the values that the backend creates for the starting palette.
  --publish-version VERSION
                         Publish this version after import unless it already exists. Default: 0.1.0.
                         An existing publication stays unchanged; the import still updates the draft.
  --name NAME            Name of the design system that the script owns. Default: sdds_serv_local.
  --theme NAME           Theme name. Default: sdds_serv_local.
  --profile PROFILE      Starting palette of the theme: sber, malachite or b2b. Default: malachite.
  --gateway-url URL      Gateway URL. Env: GATEWAY_URL. Default: http://localhost:8080.
  --cli PATH             dsbuilder CLI. Env: DSBUILDER_CLI. Default: the JVM CLI of this repository.
  --help                 Show this help.

The script works only in its own design system: other design systems of the project (for example `base`) are not
touched. The design system and its theme are created when they are missing; a repeated run reloads their token
values and component configurations. After import it publishes 0.1.0 unless that version already exists.

It signs in as the local dev user (DSBUILDER_LOCAL_USERNAME, DSBUILDER_LOCAL_PASSWORD; the Keycloak dev realm
defaults). 
USAGE
}

log() {
  echo "[seed-design-system] $*"
}

fail() {
  echo "[seed-design-system] $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --package)
      PACKAGE_DIR="${2:-}"
      shift 2
      ;;
    --theme-package)
      THEME_PACKAGE="${2:-}"
      shift 2
      ;;
    --publish-version)
      PUBLISH_VERSION="${2:-}"
      shift 2
      ;;
    --name)
      DESIGN_SYSTEM_NAME="${2:-}"
      DESIGN_SYSTEM_NAME_EXPLICIT=1
      shift 2
      ;;
    --theme)
      THEME_NAME="${2:-}"
      shift 2
      ;;
    --profile)
      THEME_PROFILE="${2:-}"
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
      echo "[seed-design-system] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ "$PUBLISH_VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] \
  || fail "--publish-version must have the form MAJOR.MINOR.PATCH without leading zeroes"

for command_name in curl python3; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Required command '$command_name' not found"
done
[[ -n "$PACKAGE_DIR" ]] || { usage >&2; fail "Pass the component package with --package"; }
[[ -f "$PACKAGE_DIR/meta.json" ]] || fail "The package has no meta.json: $PACKAGE_DIR"
PACKAGE_DIR="$(cd "$PACKAGE_DIR" && pwd)"

# JSON helper: json_get '<python expression over the parsed document d>'
json_get() {
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))' "$1"
}

TOKEN="$(
  curl --fail --silent --show-error --request POST "$GATEWAY_URL/auth/token" \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=password' \
    --data-urlencode 'client_id=dsbuilder-api' \
    --data-urlencode "username=$USERNAME" \
    --data-urlencode "password=$PASSWORD" | json_get "d['access_token']"
)" || fail "Cannot sign in as $USERNAME. Is the stack running (./setup-local.sh)?"

api() {
  local method="$1" path="$2"
  shift 2
  curl --fail-with-body --silent --show-error --request "$method" "$GATEWAY_URL$path" \
    --header "Authorization: Bearer $TOKEN" --header 'Content-Type: application/json' "$@"
}

USER_ID="$(printf '%s' "$TOKEN" | python3 -c '
import base64, json, sys
payload = sys.stdin.read().split(".")[1]
payload += "=" * (-len(payload) % 4)
print(json.loads(base64.urlsafe_b64decode(payload)).get("sub", ""))
')"
PROJECT_ID="$(api GET /api/projects | python3 -c '
import json, sys
items = json.load(sys.stdin)
items = items if isinstance(items, list) else items.get("items", [])
for item in items:
    if item.get("ownerUserId") == sys.argv[1] and item.get("status") != "archived":
        print(item["id"]); break
' "$USER_ID")" || fail "Could not list the user's projects"
[[ -n "$PROJECT_ID" ]] || fail "The user has no project. Run ./setup-local.sh first."
PROJECT_NAME="$(api GET "/api/projects/$PROJECT_ID" | json_get "d['name']")"
DS_BASE="/api/projects/$PROJECT_ID/design-systems"

DESIGN_SYSTEM_ID=""
existing="$(api GET "$DS_BASE" | python3 -c '
import json, sys
items = json.load(sys.stdin)
for name in sys.argv[1:]:
    for item in items:
        if item.get("name") == name:
            print(item["id"], name); sys.exit(0)
' "$DESIGN_SYSTEM_NAME" "sdds_serv_local-${PROJECT_ID:0:8}")"
if [[ -n "$existing" ]]; then
  read -r DESIGN_SYSTEM_ID DESIGN_SYSTEM_NAME <<< "$existing"
fi

post_design_system() {
  curl --silent --show-error --request POST "$GATEWAY_URL$DS_BASE" \
    --header "Authorization: Bearer $TOKEN" --header 'Content-Type: application/json' \
    --data "$(python3 -c 'import json,sys; print(json.dumps({"name":sys.argv[1],"projectName":sys.argv[2],"projectId":sys.argv[3]}))' \
      "$DESIGN_SYSTEM_NAME" "$PROJECT_NAME" "$PROJECT_ID")" --write-out '\n%{http_code}'
}

if [[ -z "$DESIGN_SYSTEM_ID" ]]; then
  log "Creating the design system '$DESIGN_SYSTEM_NAME'"
  response="$(post_design_system)" || fail "The design system request failed"
  status="${response##*$'\n'}"
  if [[ "$status" == "409" && "$DESIGN_SYSTEM_NAME_EXPLICIT" == "0" ]]; then
    DESIGN_SYSTEM_NAME="sdds_serv_local-${PROJECT_ID:0:8}"
    log "Name 'sdds_serv_local' is already used in another project; creating '$DESIGN_SYSTEM_NAME'"
    response="$(post_design_system)" || fail "The design system request failed"
    status="${response##*$'\n'}"
  fi
  [[ "$status" == "201" ]] || fail "The design system could not be created: HTTP $status"
  DESIGN_SYSTEM_ID="$(printf '%s' "${response%$'\n'*}" | json_get "d['id']")"
else
  log "Reusing the design system '$DESIGN_SYSTEM_NAME'"
fi

THEMES="$(api GET "$DS_BASE/$DESIGN_SYSTEM_ID/tenants" | json_get "len(d)")"
if [[ "$THEMES" == "0" ]]; then
  log "Creating the theme '$THEME_NAME' (starting palette: $THEME_PROFILE)"
  api POST "$DS_BASE/$DESIGN_SYSTEM_ID/tenants" \
    --data "{\"name\":\"$THEME_NAME\",\"profile\":\"$THEME_PROFILE\"}" \
    >/dev/null || fail "The theme could not be created"
else
  log "The design system already has a theme"
fi

if [[ -n "$THEME_PACKAGE" ]]; then
  [[ -f "$THEME_PACKAGE/android/android_color.json" ]] || fail "The theme package has no android/android_color.json: $THEME_PACKAGE"
  TENANT_ID="$(api GET "$DS_BASE/$DESIGN_SYSTEM_ID/tenants" | json_get "d[0]['id']")"
  log "Loading the Android token values of the theme package"
  python3 "$ROOT_DIR/local-dev/apply_theme_values.py" "$GATEWAY_URL" "$TOKEN" "$PROJECT_ID" "$DESIGN_SYSTEM_ID" \
    "$TENANT_ID" "$(cd "$THEME_PACKAGE" && pwd)" || fail "The theme values could not be loaded"
fi

resolve_cli() {
  if [[ -n "$CLI" ]]; then
    echo "$CLI"
    return
  fi
  local jvm="$ROOT_DIR/frontend-kt/cli/build/install/cli-jvm/bin/dsbuilder"
  log "Building the JVM dsbuilder CLI of this repository" >&2
  (cd "$ROOT_DIR/frontend-kt" && ./gradlew --quiet :cli:installJvmDist >&2) || fail "The CLI build failed (JDK 17 is required)"
  echo "$jvm"
}
CLI="$(resolve_cli)"

# `components push` uses a short-lived PAT; no browser session is needed for local setup.
PAT_ID=""
revoke_setup_pat() {
  if [[ -n "$PAT_ID" ]]; then
    api DELETE "/api/settings/personal-access-tokens/$PAT_ID" >/dev/null \
      || log "Could not revoke temporary PAT $PAT_ID"
  fi
}
trap revoke_setup_pat EXIT
pat_response="$(api POST /api/settings/personal-access-tokens \
  --data '{"name":"local setup components push","scopes":["components:write"],"ttlSeconds":3600}')" \
  || fail "Could not create a temporary PAT"
PAT_ID="$(printf '%s' "$pat_response" | json_get "d['token']['id']")"
PAT_SECRET="$(printf '%s' "$pat_response" | json_get "d.get('secret') or ''")"
[[ -n "$PAT_ID" && -n "$PAT_SECRET" ]] || fail "The temporary PAT response is incomplete"

LINK="dsbuilder://projects/$PROJECT_ID/design-systems/$DESIGN_SYSTEM_ID?version=draft&platform=compose"
log "Loading the component configurations from $PACKAGE_DIR"
push_output="$(DSBUILDER_API_URL="$GATEWAY_URL" DSBUILDER_API_KEY="$PAT_SECRET" "$CLI" components push \
  --from "$PACKAGE_DIR" --platform compose --design-system "$LINK" \
  --apply 2>&1)" || {
    printf '%s\n' "$push_output" | grep -v SLF4J >&2 || true
    fail "The component configurations could not be loaded"
  }
printf '%s\n' "$push_output" | grep -v SLF4J | grep -E "^(Created|Updated|Unchanged|Rejected|Status)|^  .*:" || true

VERSIONS_URL="$DS_BASE/$DESIGN_SYSTEM_ID/versions"
existing_version="$(api GET "$VERSIONS_URL?version=$PUBLISH_VERSION&limit=1" \
  | json_get "next((v['id'] for v in d if v['version'] == '$PUBLISH_VERSION'), '')")" \
  || fail "Could not check published versions"
if [[ -n "$existing_version" ]]; then
  log "Version $PUBLISH_VERSION is already published and unchanged; the draft has been updated"
else
  draft="$(api GET "$DS_BASE/$DESIGN_SYSTEM_ID?version=draft")" \
    || fail "Could not read the active draft for publication"
  publish_body="$(printf '%s' "$draft" | python3 -c '
import json, sys
value = json.load(sys.stdin)
assert isinstance(value["draftId"], str) and value["draftId"]
assert type(value["draftRevision"]) is int and value["draftRevision"] >= 0
print(json.dumps({"draftId": value["draftId"], "draftRevision": value["draftRevision"],
                  "version": sys.argv[1], "changelog": "Local setup seed"}))
' "$PUBLISH_VERSION")" || fail "The active draft response is incomplete"
  publish_key="$(python3 -c 'import uuid; print(uuid.uuid4())')"
  log "Publishing version $PUBLISH_VERSION"
  api POST "$VERSIONS_URL" --header "Idempotency-Key: $publish_key" --data "$publish_body" \
    >/dev/null || fail "Could not publish version $PUBLISH_VERSION; the imported data remains in the draft"
  log "Published version $PUBLISH_VERSION"
fi

log "Done. Open the component editor: the Compose components are listed with their preview."
