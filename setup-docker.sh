#!/bin/bash

# =============================================================================
# Design System Builder - Complete Docker Setup Script
# =============================================================================
# This script performs a complete setup of the Design System Builder environment
# including:
# - Building and starting all services (postgres, ds-registry, backend, frontend, admin, client, client-proxy)
# - Running database migrations
# - Seeding initial data (dev: seed-dev.ts, prod: seed-prod.ts)
# - Comprehensive health checks for all services
# - Support for both development and production environments
# - Enhanced error handling and troubleshooting
#
# Usage: ./setup-docker.sh [dev|prod]
#   dev, development  - Start development environment
#   prod, production  - Start production environment
#   (no arguments)    - Interactive mode
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

echo_header "🐳 Design System Builder - Complete Docker Setup"
echo "======================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo_error "Docker is not running. Please start Docker first."
    exit 1
fi
echo_success "Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo_error "docker-compose not found. Please install docker-compose."
    exit 1
fi
echo_success "docker-compose is available"

# Parse command line arguments
ENV_NAME=""
COMPOSE_FILE=""
FULL_SETUP=true

# Check for CLI arguments
if [ "$1" = "dev" ] || [ "$1" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    ENV_NAME="development"
    FULL_SETUP=true
elif [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    COMPOSE_FILE="docker-compose.yml"
    ENV_NAME="production"
    FULL_SETUP=true
elif [ "$1" = "" ]; then
    # No arguments provided, ask interactively
    echo ""
    echo_header "🚀 Environment Selection:"
    echo "1) Development (with hot reloading, volume mounts, dev dependencies)"
    echo "2) Production (optimized builds, production dependencies)"
    read -p "Enter your choice (1 or 2): " choice

    if [ "$choice" = "1" ]; then
        COMPOSE_FILE="docker-compose.dev.yml"
        ENV_NAME="development"
        FULL_SETUP=true
    elif [ "$choice" = "2" ]; then
        COMPOSE_FILE="docker-compose.yml"
        ENV_NAME="production"
        FULL_SETUP=true
    else
        echo_error "Invalid choice. Exiting."
        exit 1
    fi
else
    echo_error "Invalid argument: $1"
    echo ""
    echo "Usage: $0 [dev|prod]"
    echo "  dev, development  - Start development environment"
    echo "  prod, production  - Start production environment"
    echo "  (no arguments)    - Interactive mode"
    exit 1
fi

echo ""
echo_header "🚀 Setting up $ENV_NAME environment..."
echo "   📦 Services: postgres, postgres-registry, db-service, ds-registry, frontend, admin, client, client-proxy, generator, publisher, docs-generator"
if [ "$FULL_SETUP" = true ]; then
    if [ "$ENV_NAME" = "development" ]; then
        echo "   🗄️ Database: migrations + seeding (dev seeds)"
    else
        echo "   🗄️ Database: migrations + seeding (prod seeds)"
    fi
else
    echo "   🗄️ Database: quick test (no migrations/seeding)"
fi
echo "   🔍 Health checks: all services"

# Stop any existing containers
echo_step "Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down -v

# Build and start services
echo_step "Building and starting services..."
if docker-compose -f $COMPOSE_FILE build; then
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

echo_info "Starting services..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for PostgreSQL (db-service) to be ready
echo ""
echo_step "Waiting for PostgreSQL (db-service) to be ready..."
timeout=60
while ! docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres -d ds_builder > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        echo_error "PostgreSQL (db-service) did not start in time"
        exit 1
    fi
done
echo_success "PostgreSQL (db-service) is ready"

# Wait for PostgreSQL (ds-registry) to be ready
echo_step "Waiting for PostgreSQL (ds-registry) to be ready..."
timeout=60
while ! docker-compose -f $COMPOSE_FILE exec -T postgres-registry pg_isready -U postgres -d ds_registry > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        echo_error "PostgreSQL (ds-registry) did not start in time"
        exit 1
    fi
done
echo_success "PostgreSQL (ds-registry) is ready"

# Wait for backend to be ready
echo_step "Waiting for backend (db-service) to be ready..."
timeout=60
while ! docker-compose -f $COMPOSE_FILE exec -T db-service curl -f http://localhost:3001/health > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        echo_error "Backend (db-service) did not start in time"
        exit 1
    fi
done
echo_success "Backend (db-service) is ready"

# Wait for ds-registry to be ready
echo_step "Waiting for ds-registry to be ready..."
timeout=60
while ! docker-compose -f $COMPOSE_FILE exec -T ds-registry curl -sf http://localhost:3008/api/tables > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        echo_warning "ds-registry health check timed out, continuing..."
        break
    fi
done
echo_success "ds-registry is ready"

# Run database setup only if full setup is requested
if [ "$FULL_SETUP" = true ]; then
    echo ""
    echo_header "🗄️ Setting up databases..."

    # --- db-service migrations ---
    echo_step "Running db-service migrations..."
    if docker-compose -f $COMPOSE_FILE exec -T db-service npx drizzle-kit migrate; then
        echo_success "db-service migrations completed"
    else
        echo_error "db-service migrations failed"
        exit 1
    fi

    # --- ds-registry migrations ---
    echo_step "Running ds-registry migrations..."
    if docker-compose -f $COMPOSE_FILE exec -T ds-registry npx drizzle-kit migrate; then
        echo_success "ds-registry migrations completed"
    else
        echo_error "ds-registry migrations failed"
        exit 1
    fi

    # --- Seeding ---
    if [ "$ENV_NAME" = "development" ]; then
        echo_step "Seeding db-service database with saved state..."
        if docker-compose -f $COMPOSE_FILE exec -T db-service npx tsx src/db/seed-from-saved-state.ts; then
            echo_success "db-service database seeding completed"
        else
            echo_error "db-service database seeding failed"
            exit 1
        fi

        echo_step "Seeding ds-registry database (dev)..."
        if docker-compose -f $COMPOSE_FILE exec -T ds-registry npx tsx src/db/seed-dev.ts; then
            echo_success "ds-registry database seeding (dev) completed"
        else
            echo_error "ds-registry database seeding (dev) failed"
            exit 1
        fi
    else
        echo_info "Skipping db-service seeding in production mode"

        echo_step "Seeding ds-registry database (prod)..."
        if docker-compose -f $COMPOSE_FILE exec -T ds-registry npx tsx src/db/seed-prod.ts; then
            echo_success "ds-registry database seeding (prod) completed"
        else
            echo_error "ds-registry database seeding (prod) failed"
            exit 1
        fi
    fi
else
    echo ""
    echo_info "Skipping database setup (quick test mode)"
fi

# Check final health
echo ""
echo_header "🔍 Final health check..."

services_healthy=true
total_services=7
current_service=0

# Check PostgreSQL (db-service)
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking PostgreSQL (db-service)..."
if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres -d ds_builder > /dev/null 2>&1; then
    echo_success "PostgreSQL (db-service) is healthy"
else
    echo_error "PostgreSQL (db-service) is not healthy"
    services_healthy=false
fi

# Check PostgreSQL (ds-registry)
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking PostgreSQL (ds-registry)..."
if docker-compose -f $COMPOSE_FILE exec -T postgres-registry pg_isready -U postgres -d ds_registry > /dev/null 2>&1; then
    echo_success "PostgreSQL (ds-registry) is healthy"
else
    echo_error "PostgreSQL (ds-registry) is not healthy"
    services_healthy=false
fi

# Check Backend
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking Backend API..."
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo_success "Backend API is healthy"
else
    echo_error "Backend API is not healthy"
    services_healthy=false
fi

# Check DS Registry
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking DS Registry..."
if curl -sf http://localhost:3008/api/tables > /dev/null 2>&1; then
    echo_success "DS Registry is healthy"
else
    echo_error "DS Registry is not healthy"
    services_healthy=false
fi

# Check Frontend
current_service=$((current_service + 1))
show_progress $current_service $total_services "Checking Frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo_success "Frontend is healthy"
else
    echo_error "Frontend is not healthy"
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
    echo "   📱 Frontend:       http://localhost:3000"
    echo "   🛠️ Admin:          http://localhost:3004"
    echo "   🎨 Client:         http://localhost:3002"
    echo "   🔧 Backend API:    http://localhost:3001"
    echo "   📋 DS Registry:    http://localhost:3008"
    echo "   🔗 Client Proxy:   http://localhost:3003"
    echo "   🏗️ Generator:      http://localhost:3005"
    echo "   📄 Docs Generator: http://localhost:3006"
    echo "   🗄️ DB (db-service):   localhost:5432"
    echo "   🗄️ DB (ds-registry):  localhost:5433"
    echo ""
    echo_header "📦 View running services:"
    docker-compose -f $COMPOSE_FILE ps
    echo ""
    echo_header "📝 Useful commands:"
    echo "   View logs:      docker-compose -f $COMPOSE_FILE logs -f"
    echo "   Stop services:  docker-compose -f $COMPOSE_FILE down"
    echo "   Restart:        docker-compose -f $COMPOSE_FILE restart"
    echo ""
    echo_header "🎯 Test the CLI tool:"
    echo "   cd generate-ds && npm run dev 1 --dry-run"

    if [ "$ENV_NAME" = "production" ]; then
        echo ""
        echo_info "Production mode: Databases seeded with prod data"
    fi
else
    echo_error "Setup completed with errors. Please check the service logs:"
    echo "   docker-compose -f $COMPOSE_FILE logs"
fi
