#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
ENV_FILE="$ROOT_DIR/identity-gateway/.env.local"

usage() {
  cat <<'USAGE'
Usage:
  ./start-local.sh [--build-only] [--no-build] [--detach] [--down] [--logs]

Options:
  --build-only  Build fat jars and docker images, then exit.
  --no-build    Skip Gradle jar build.
  --detach      Start docker compose in detached mode.
  --down        Stop local compose stack.
  --logs        Follow compose logs for the local stack.
  --help        Show this help.
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
