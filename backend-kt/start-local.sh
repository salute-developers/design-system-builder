#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
ENV_FILE="$ROOT_DIR/identity-gateway/.env.local"

usage() {
  cat <<'USAGE'
Usage:
  ./start-local.sh [--build-only] [--no-build] [--detach] [--down] [--logs] [--check-java]

Options:
  --build-only  Build fat jars and docker images, then exit.
  --no-build    Skip Gradle jar build.
  --detach      Start docker compose in detached mode.
  --down        Stop local compose stack.
  --logs        Follow compose logs for the local stack.
  --check-java  Find JDK 17, print its version, then exit.
  --help        Show this help.

Environment:
  DSBUILDER_JAVA_HOME  Optional path to JDK 17. Takes precedence over JAVA_HOME.
USAGE
}

log() {
  echo "[identity-gateway] $*"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[identity-gateway] Required command '$1' not found" >&2
    exit 1
  }
}

java_major_version() {
  local java_binary="$1"
  local version

  [[ -x "$java_binary" ]] || return 1
  version="$("$java_binary" -version 2>&1 | awk -F '"' '/version/ { print $2; exit }')"
  [[ -n "$version" ]] || return 1

  if [[ "$version" == 1.* ]]; then
    version="${version#1.}"
  fi

  printf '%s\n' "${version%%.*}"
}

activate_jdk_17() {
  local java_home="$1"
  local source="$2"
  local major

  [[ -n "$java_home" ]] || return 1
  major="$(java_major_version "$java_home/bin/java" || true)"
  [[ "$major" == "17" ]] || return 1

  export JAVA_HOME="$java_home"
  export PATH="$JAVA_HOME/bin:$PATH"
  log "Using JDK 17 from $source: $JAVA_HOME"
  return 0
}

ensure_jdk_17() {
  local current_java=""
  local current_major=""
  local discovered_java_home=""
  local candidate

  if [[ -n "${DSBUILDER_JAVA_HOME:-}" ]]; then
    if activate_jdk_17 "$DSBUILDER_JAVA_HOME" "DSBUILDER_JAVA_HOME"; then
      return 0
    fi
    log "Ignoring DSBUILDER_JAVA_HOME because it does not point to JDK 17: $DSBUILDER_JAVA_HOME"
  fi

  if [[ -n "${JAVA_HOME:-}" ]]; then
    if activate_jdk_17 "$JAVA_HOME" "JAVA_HOME"; then
      return 0
    fi
    log "Ignoring JAVA_HOME because it does not point to JDK 17: $JAVA_HOME"
  fi

  current_java="$(command -v java || true)"
  if [[ -n "$current_java" ]]; then
    current_major="$(java_major_version "$current_java" || true)"
    if [[ "$current_major" == "17" ]]; then
      unset JAVA_HOME
      log "Using JDK 17 from PATH: $current_java"
      return 0
    fi
  fi

  if [[ "$(uname -s)" == "Darwin" && -x /usr/libexec/java_home ]]; then
    discovered_java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    if activate_jdk_17 "$discovered_java_home" "/usr/libexec/java_home"; then
      return 0
    fi
  fi

  for candidate in \
    /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    /usr/lib/jvm/java-17-openjdk \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/java-17-openjdk-arm64 \
    /usr/lib/jvm/temurin-17-jdk-amd64 \
    /usr/lib/jvm/*17* \
    "${SDKMAN_CANDIDATES_DIR:-${HOME:-}/.sdkman/candidates}"/java/* \
    "${HOME:-}"/.asdf/installs/java/*; do
    if activate_jdk_17 "$candidate" "system installation"; then
      return 0
    fi
  done

  cat >&2 <<'ERROR'
[identity-gateway] JDK 17 is required to build the Kotlin backend, but it was not found.
[identity-gateway] Install any JDK 17 distribution or point the script to an existing installation:
[identity-gateway]   DSBUILDER_JAVA_HOME=/path/to/jdk-17 ./start-local.sh --detach
[identity-gateway] If the fat jars are already built, use ./start-local.sh --no-build --detach.
ERROR
  return 1
}

load_local_env() {
  if [[ -f "$ENV_FILE" ]]; then
    log "Loading local environment from $ENV_FILE"
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

read_json_field() {
  local field="$1"
  ruby -rjson -e "data = JSON.parse(STDIN.read); value = data$field; print(value.nil? ? '' : value)"
}

bootstrap_projects_lookup_client() {
  local admin_user admin_password lookup_realm lookup_client_id lookup_client_secret admin_token client_uuid
  local service_account_user_id realm_management_client_id role_payload

  admin_user="${KEYCLOAK_ADMIN:-admin}"
  admin_password="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
  lookup_realm="${PROJECTS_IDENTITY_KEYCLOAK_REALM:-dsbuilder}"
  lookup_client_id="${PROJECTS_IDENTITY_KEYCLOAK_CLIENT_ID:-projects-service}"
  lookup_client_secret="${PROJECTS_IDENTITY_KEYCLOAK_CLIENT_SECRET:-projects-service-secret}"

  log "Bootstrapping Keycloak client for Projects Service user lookup"

  admin_token="$(
    curl -fsS -X POST "http://localhost:8090/realms/master/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "client_id=admin-cli" \
      -d "grant_type=password" \
      -d "username=$admin_user" \
      -d "password=$admin_password" | read_json_field '["access_token"]'
  )"

  if [[ -z "$admin_token" ]]; then
    echo "[identity-gateway] Failed to obtain Keycloak admin token for bootstrap" >&2
    exit 1
  fi

  client_uuid="$(
    curl -fsS -H "Authorization: Bearer $admin_token" \
      "http://localhost:8090/admin/realms/$lookup_realm/clients?clientId=$lookup_client_id" | \
      ruby -rjson -e 'data = JSON.parse(STDIN.read); print(data.first && data.first["id"] || "")'
  )"

  if [[ -z "$client_uuid" ]]; then
    client_uuid="$(
      curl -fsS -X POST "http://localhost:8090/admin/realms/$lookup_realm/clients" \
        -H "Authorization: Bearer $admin_token" \
        -H "Content-Type: application/json" \
        -d "{
          \"clientId\":\"$lookup_client_id\",
          \"name\":\"Projects Service Lookup\",
          \"enabled\":true,
          \"protocol\":\"openid-connect\",
          \"publicClient\":false,
          \"clientAuthenticatorType\":\"client-secret\",
          \"secret\":\"$lookup_client_secret\",
          \"standardFlowEnabled\":false,
          \"directAccessGrantsEnabled\":false,
          \"serviceAccountsEnabled\":true
        }" >/dev/null && \
      curl -fsS -H "Authorization: Bearer $admin_token" \
        "http://localhost:8090/admin/realms/$lookup_realm/clients?clientId=$lookup_client_id" | \
        ruby -rjson -e 'data = JSON.parse(STDIN.read); print(data.first && data.first["id"] || "")'
    )"
  else
    curl -fsS -X PUT "http://localhost:8090/admin/realms/$lookup_realm/clients/$client_uuid" \
      -H "Authorization: Bearer $admin_token" \
      -H "Content-Type: application/json" \
      -d "{
        \"id\":\"$client_uuid\",
        \"clientId\":\"$lookup_client_id\",
        \"name\":\"Projects Service Lookup\",
        \"enabled\":true,
        \"protocol\":\"openid-connect\",
        \"publicClient\":false,
        \"clientAuthenticatorType\":\"client-secret\",
        \"secret\":\"$lookup_client_secret\",
        \"standardFlowEnabled\":false,
        \"directAccessGrantsEnabled\":false,
        \"serviceAccountsEnabled\":true
      }" >/dev/null
  fi

  service_account_user_id="$(
    curl -fsS -H "Authorization: Bearer $admin_token" \
      "http://localhost:8090/admin/realms/$lookup_realm/clients/$client_uuid/service-account-user" | \
      read_json_field '["id"]'
  )"

  realm_management_client_id="$(
    curl -fsS -H "Authorization: Bearer $admin_token" \
      "http://localhost:8090/admin/realms/$lookup_realm/clients?clientId=realm-management" | \
      ruby -rjson -e 'data = JSON.parse(STDIN.read); print(data.first && data.first["id"] || "")'
  )"

  role_payload="$(
    curl -fsS -H "Authorization: Bearer $admin_token" \
      "http://localhost:8090/admin/realms/$lookup_realm/clients/$realm_management_client_id/roles" | \
      ruby -rjson -e '
        data = JSON.parse(STDIN.read)
        selected = data.select { |role| ["query-users", "view-users"].include?(role["name"]) }
        print JSON.generate(selected)
      '
  )"

  curl -fsS -X POST \
    "http://localhost:8090/admin/realms/$lookup_realm/users/$service_account_user_id/role-mappings/clients/$realm_management_client_id" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "$role_payload" >/dev/null
}

BUILD_JAR=true
BUILD_ONLY=false
DETACH=false
DOWN=false
LOGS=false
CHECK_JAVA=false

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
    --check-java)
      CHECK_JAVA=true
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "[identity-gateway] Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$CHECK_JAVA" == true ]]; then
  ensure_jdk_17
  java -version
  exit 0
fi

require docker
require curl
require ruby
load_local_env

if ! $COMPOSE_CMD version >/dev/null 2>&1; then
  echo "[identity-gateway] Docker Compose command not found: $COMPOSE_CMD" >&2
  exit 1
fi

cd "$ROOT_DIR"

if [[ "$DOWN" == true ]]; then
  log "Stopping local stack"
  $COMPOSE_CMD -f docker-compose.local.yml down
  exit 0
fi

if [[ "$LOGS" == true ]]; then
  log "Following local stack logs"
  $COMPOSE_CMD -f docker-compose.local.yml logs -f
  exit 0
fi

if [[ "$BUILD_JAR" == true ]]; then
  ensure_jdk_17
  log "Building Auth Helper fat jar"
  "$ROOT_DIR/gradlew" -p "$ROOT_DIR/identity-gateway" :app:shadowJar
  log "Building Projects Service fat jar"
  "$ROOT_DIR/gradlew" -p "$ROOT_DIR/projects-service" :app:shadowJar
  log "Building Documentation Service fat jar"
  "$ROOT_DIR/gradlew" -p "$ROOT_DIR/documentation-service" :app:shadowJar
fi

if [[ "$BUILD_ONLY" == true ]]; then
  log "Building compose images"
  $COMPOSE_CMD -f docker-compose.local.yml build
  exit 0
fi

log "Starting Keycloak, Auth Helper, Gateway, Projects Service, and Documentation Service"
$COMPOSE_CMD -f docker-compose.local.yml up --build -d
bootstrap_projects_lookup_client

if [[ "$DETACH" != true ]]; then
  $COMPOSE_CMD -f docker-compose.local.yml logs -f
fi
