#!/bin/bash

# =============================================================================
# Design System Builder - Docker Setup Script (Development)
# =============================================================================
# This script performs a complete setup of the Design System Builder
# development environment including:
# - Building and starting all services (postgres-registry, db-service, admin, client, generator, docs-generator)
# - Running database migrations
# - Seeding initial data (seed-prod.ts)
# - Bootstrapping the user's project in projects-service (via gateway)
#   and binding the 'base' design system to it
# - Comprehensive health checks for all services
#
# Usage: ./setup-docker.sh
#
# Project bootstrap env (all optional):
#   DSBUILDER_GATEWAY_URL       gateway of backend-kt stack, default http://localhost:8080
#   DSBUILDER_PROJECT_USERNAME  Keycloak user that owns the project, default admin@example.com
#   DSBUILDER_PROJECT_PASSWORD  its password, default password
#   DSBUILDER_PROJECT_NAME      name for a newly created project, default "Base"
#   DSBUILDER_REALM / DSBUILDER_CLIENT_ID   Keycloak realm/client, default dsbuilder / dsbuilder-api
#   DSBUILDER_SKIP_PROJECT=1    skip the project bootstrap step entirely
# =============================================================================

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo_step() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

echo_header() {
    echo -e "${CYAN}$1${NC}"
}

# Progress indicator
show_progress() {
    local current=$1
    local total=$2
    local step=$3
    local percent=$((current * 100 / total))
    printf "\r${BLUE}Progress: [%3d%%] %s${NC}" $percent "$step"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.dev.yml"
JS_COMPOSE_PROJECT_NAME="${DSBUILDER_JS_COMPOSE_PROJECT_NAME:-design-system-builder}"

# Project bootstrap (backend-kt stack: keycloak + gateway + projects-service)
GATEWAY_URL="${DSBUILDER_GATEWAY_URL:-http://localhost:8080}"
PROJECT_USERNAME="${DSBUILDER_PROJECT_USERNAME:-admin@example.com}"
PROJECT_PASSWORD="${DSBUILDER_PROJECT_PASSWORD:-password}"
PROJECT_NAME="${DSBUILDER_PROJECT_NAME:-Base}"
REALM="${DSBUILDER_REALM:-dsbuilder}"
CLIENT_ID="${DSBUILDER_CLIENT_ID:-dsbuilder-api}"
SKIP_PROJECT="${DSBUILDER_SKIP_PROJECT:-0}"

cd "$SCRIPT_DIR"

run_compose() {
    docker compose \
        --project-name "$JS_COMPOSE_PROJECT_NAME" \
        -f "$COMPOSE_FILE" \
        "$@"
}

run_psql() {
    run_compose exec -T postgres-registry psql -U postgres -d ds_registry -v ON_ERROR_STOP=1 -qAt "$@"
}

# Read a JSON field from stdin: json_field access_token
json_field() {
    python3 -c '
import json, sys
value = json.load(sys.stdin)
for part in sys.argv[1].split("."):
    value = value[part]
print("" if value is None else value)
' "$1"
}

# Extract "sub" (user id) from a JWT
jwt_sub() {
    python3 -c '
import base64, json, sys
payload = sys.argv[1].split(".")[1]
payload += "=" * (-len(payload) % 4)
print(json.loads(base64.urlsafe_b64decode(payload)).get("sub", ""))
' "$1"
}

# Find a project owned by the user, or create one. Prints the project id.
# Returns 1 if the gateway is unavailable or auth fails (caller decides how to react).
bootstrap_user_project() {
    local token_response access_token user_id project_id http_status body

    if ! curl -sf "$GATEWAY_URL/health" > /dev/null 2>&1; then
        echo_warning "Gateway is not reachable at $GATEWAY_URL — start backend-kt first (cd ../backend-kt && ./start-local.sh --detach)" >&2
        return 1
    fi

    token_response="$(curl -sf -X POST "$GATEWAY_URL/realms/$REALM/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data-urlencode "grant_type=password" \
        --data-urlencode "client_id=$CLIENT_ID" \
        --data-urlencode "username=$PROJECT_USERNAME" \
        --data-urlencode "password=$PROJECT_PASSWORD")" || {
        echo_warning "Could not obtain access token for $PROJECT_USERNAME" >&2
        return 1
    }
    access_token="$(printf '%s' "$token_response" | json_field access_token)"
    if [ -z "$access_token" ]; then
        echo_warning "Token response has no access_token" >&2
        return 1
    fi
    user_id="$(jwt_sub "$access_token")"

    # Existing project owned by this user?
    project_id="$(curl -sf "$GATEWAY_URL/api/projects" -H "Authorization: Bearer $access_token" | \
        python3 -c '
import json, sys
user_id = sys.argv[1]
for project in json.load(sys.stdin):
    if project.get("ownerUserId") == user_id and project.get("status") != "archived":
        print(project["id"]); break
' "$user_id")"

    if [ -n "$project_id" ]; then
        echo_info "Reusing existing project of $PROJECT_USERNAME: $project_id" >&2
        printf '%s' "$project_id"
        return 0
    fi

    body="$(mktemp)"
    http_status="$(curl -sS -o "$body" -w "%{http_code}" -X POST "$GATEWAY_URL/api/projects" \
        -H "Authorization: Bearer $access_token" \
        -H "Content-Type: application/json" \
        -d "$(PROJECT_NAME="$PROJECT_NAME" python3 -c 'import json, os; print(json.dumps({"name": os.environ["PROJECT_NAME"]}, ensure_ascii=False))')")"
    if [ "$http_status" != "201" ]; then
        echo_warning "Project creation failed: HTTP $http_status $(cat "$body")" >&2
        rm -f "$body"
        return 1
    fi
    project_id="$(json_field id < "$body")"
    rm -f "$body"

    echo_info "Created project '$PROJECT_NAME' for $PROJECT_USERNAME: $project_id" >&2
    printf '%s' "$project_id"
}

echo_header "🐳 Design System Builder - Docker Setup (Development)"
echo "======================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo_error "Docker is not running. Please start Docker first."
    exit 1
fi
echo_success "Docker is running"

# Check if Docker Compose is available
if ! docker compose version > /dev/null 2>&1; then
    echo_error "Docker Compose plugin not found. Please install Docker Compose."
    exit 1
fi
echo_success "Docker Compose is available"

echo ""
echo_header "🚀 Setting up development environment..."
echo "   📦 Services: postgres-registry, db-service, admin, client, generator, publisher, docs-generator"
echo "   🗄️ Database: migrations + seeding (prod seeds)"
echo "   👤 Project: find/create user project via $GATEWAY_URL and bind it to DS 'base'"
echo "   🔍 Health checks: all services"

# Stop any existing containers
echo_step "Stopping existing containers..."
run_compose down -v

# Build and start services
echo_step "Building and starting services..."
if run_compose build; then
    echo_success "Build successful"
else
    echo_error "Build failed. Troubleshooting suggestions:"
    echo "  1. Check internet connection: ping google.com"
    echo "  2. Try disabling Docker proxy in Docker Desktop settings:"
    echo "     - Open Docker Desktop"
    echo "     - Go to Settings → Resources → Proxies"
    echo "     - Uncheck 'Manual proxy configuration'"
    echo "     - Apply & Restart Docker"
    echo "  3. Restart Docker Desktop"
    echo "  4. Check firewall settings"
    echo "  5. Try using mobile hotspot temporarily"
    echo ""
    echo_info "Current Docker proxy settings:"
    docker info | grep -E "(HTTP Proxy|HTTPS Proxy)" || echo "  No proxy configured"
    exit 1
fi

# Start only postgres + db-service first (migrate before other services connect)
echo_info "Starting postgres and db-service..."
run_compose up -d postgres-registry db-service

# Wait for PostgreSQL (db-service) to be ready
echo ""
echo_step "Waiting for PostgreSQL (db-service) to be ready..."
timeout=60
while ! run_compose exec -T postgres-registry pg_isready -U postgres -d ds_registry > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        echo_error "PostgreSQL (db-service) did not start in time"
        exit 1
    fi
done
echo_success "PostgreSQL (db-service) is ready"

# Database setup — run BEFORE other services start
echo ""
echo_header "🗄️ Setting up databases..."

# --- db-service migrations ---
echo_step "Running db-service migrations..."
if run_compose exec -T db-service npx drizzle-kit migrate; then
    echo_success "db-service migrations completed"
else
    echo_error "db-service migrations failed"
    exit 1
fi

# --- Seeding ---
echo_step "Seeding db-service database (prod)..."
if run_compose exec -T db-service npx tsx src/db/seed-prod.ts; then
    echo_success "db-service database seeding (prod) completed"
else
    echo_error "db-service database seeding (prod) failed"
    exit 1
fi

# --- User project → design system 'base' ---
echo ""
echo_header "👤 Binding design system 'base' to the user's project..."
if [ "$SKIP_PROJECT" = "1" ]; then
    echo_info "Skipped (DSBUILDER_SKIP_PROJECT=1)"
elif project_id="$(bootstrap_user_project)"; then
    if ! printf '%s' "$project_id" | grep -Eq '^[0-9a-fA-F-]{36}$'; then
        echo_error "Unexpected project id: $project_id"
        exit 1
    fi
    if run_psql -c "UPDATE design_systems SET project_id = '$project_id' WHERE name = 'base';" > /dev/null; then
        echo_success "Design system 'base' bound to project $project_id"
    else
        echo_error "Failed to set project_id on design system 'base'"
        exit 1
    fi
else
    echo_warning "Project bootstrap skipped: design system 'base' stays without project_id (visible to every project)"
fi

# Now start the remaining services (client, admin, generator, etc.)
echo_info "Starting remaining services..."
run_compose up -d

# Wait for frontend services to be ready
echo_step "Waiting for services to start..."
timeout=30
while ! curl -sf http://localhost:3002 > /dev/null 2>&1 || ! curl -sf http://localhost:3004 > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        break
    fi
done

# Check final health
echo ""
echo_header "🔍 Final health check..."

services_healthy=true
total_services=4
current_service=0

# Check PostgreSQL (db-service)
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking PostgreSQL (db-service)..."
if run_compose exec -T postgres-registry pg_isready -U postgres -d ds_registry > /dev/null 2>&1; then
    echo_success "PostgreSQL (db-service) is healthy"
else
    echo_error "PostgreSQL (db-service) is not healthy"
    services_healthy=false
fi

# Check DB Service
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking DB Service..."
if curl -sf http://localhost:3008/api/health > /dev/null 2>&1; then
    echo_success "DB Service is healthy"
else
    echo_error "DB Service is not healthy"
    services_healthy=false
fi

# Check Admin
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking Admin..."
if curl -f http://localhost:3004 > /dev/null 2>&1; then
    echo_success "Admin is healthy"
else
    echo_error "Admin is not healthy"
    services_healthy=false
fi

# Check Client
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking Client..."
if curl -f http://localhost:3002 > /dev/null 2>&1; then
    echo_success "Client is healthy"
else
    echo_error "Client is not healthy"
    services_healthy=false
fi

echo ""
if [ "$services_healthy" = true ]; then
    echo_header "🎉 Setup completed successfully!"
    echo ""
    echo_header "📋 Service Information:"
    echo "   🛠️ Admin:          http://localhost:3004"
    echo "   🎨 Client:         http://localhost:3002"
    echo "   📋 DB Service:     http://localhost:3008"
    echo "   🏗️ Generator:      http://localhost:3005"
    echo "   📄 Docs Generator: http://localhost:3006"
    echo "   🗄️ DB (db-service):  localhost:5433"
    echo ""
    echo_header "📦 View running services:"
    run_compose ps
    echo ""
    echo_header "📝 Useful commands:"
    echo "   View logs:      docker compose --project-name $JS_COMPOSE_PROJECT_NAME -f $COMPOSE_FILE logs -f"
    echo "   Stop services:  docker compose --project-name $JS_COMPOSE_PROJECT_NAME -f $COMPOSE_FILE down"
    echo "   Restart:        docker compose --project-name $JS_COMPOSE_PROJECT_NAME -f $COMPOSE_FILE restart"
    echo ""
    echo_header "🎯 Test the CLI tool:"
    echo "   cd generate-ds && npm run dev 1 --dry-run"
else
    echo_error "Setup completed with errors. Please check the service logs:"
    echo "   docker compose --project-name $JS_COMPOSE_PROJECT_NAME -f $COMPOSE_FILE logs"
fi
