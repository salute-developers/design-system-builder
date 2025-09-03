#!/bin/bash

# =============================================================================
# Design System Builder - Quick Docker Smoke Test (Enhanced)
# =============================================================================
# This script performs a quick smoke test of the Docker setup without
# any database initialization or data seeding. It's designed for:
# - Quick validation that all services can start and respond
# - Testing Docker configuration changes
# - Verifying service connectivity
# - CI/CD pipeline validation
# - DNS fallback with Google DNS (8.8.8.8, 8.8.4.4) for connectivity issues
# - Enhanced diagnostics and troubleshooting
#
# Usage: ./test-docker.sh [dev|prod]
# Default: dev (development environment)
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

# Parse command line argument
ENV=${1:-dev}

if [ "$ENV" = "dev" ] || [ "$ENV" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    ENV_NAME="development"
elif [ "$ENV" = "prod" ] || [ "$ENV" = "production" ]; then
    COMPOSE_FILE="docker-compose.yml"
    ENV_NAME="production"
else
    echo_error "Invalid environment. Use: dev, development, prod, or production"
    echo "Usage: ./test-docker.sh [dev|prod]"
    exit 1
fi

echo_header "🧪 Design System Builder - Quick Docker Smoke Test (Enhanced)"
echo "============================================================"
echo "Environment: $ENV_NAME"
echo "Compose file: $COMPOSE_FILE"
echo ""

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

# Test Docker Hub connectivity
echo_info "Testing Docker Hub connectivity..."
if docker pull hello-world > /dev/null 2>&1; then
    echo_success "Docker Hub connectivity: OK"
    docker rmi hello-world > /dev/null 2>&1
    DNS_FALLBACK=false
else
    echo_warning "Docker Hub connectivity: Issues detected"
    echo_info "Will use Google DNS fallback during build"
    DNS_FALLBACK=true
fi

# Quick cleanup and start
echo ""
echo_step "Quick restart of services..."

# Function to build with DNS fallback
build_with_dns_fallback() {
    local compose_file=$1
    local dns_fallback=$2
    
    if [ "$dns_fallback" = true ]; then
        echo_info "Building with Google DNS (8.8.8.8, 8.8.4.4)..."
        if docker-compose -f $compose_file build --dns=8.8.8.8 --dns=8.8.4.4; then
            echo_success "Build successful with Google DNS"
            return 0
        else
            echo_error "Build failed even with Google DNS"
            return 1
        fi
    else
        echo_info "Building with default DNS..."
        if docker-compose -f $compose_file build; then
            echo_success "Build successful with default DNS"
            return 0
        else
            echo_warning "Build failed with default DNS"
            echo_info "Retrying with Google DNS (8.8.8.8, 8.8.4.4)..."
            if docker-compose -f $compose_file build --dns=8.8.8.8 --dns=8.8.4.4; then
                echo_success "Build successful with Google DNS fallback"
                return 0
            else
                echo_error "Build failed even with Google DNS"
                return 1
            fi
        fi
    fi
}

# Build services
if ! build_with_dns_fallback $COMPOSE_FILE $DNS_FALLBACK; then
    echo ""
    echo_error "Build failed. Troubleshooting suggestions:"
    echo "  1. Check internet connection: ping google.com"
    echo "  2. Try disabling Docker proxy in Docker Desktop settings"
    echo "  3. Restart Docker Desktop"
    echo "  4. Check firewall settings"
    echo ""
    echo_info "Current Docker proxy settings:"
    docker info | grep -E "(HTTP Proxy|HTTPS Proxy)" || echo "  No proxy configured"
    exit 1
fi

docker-compose -f $COMPOSE_FILE down > /dev/null 2>&1
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to start
echo_step "Waiting for services to start (30 seconds)..."
sleep 30

# Quick health checks
echo ""
echo_header "🔍 Quick health check..."

services_healthy=true
failed_services=()
total_services=5
current_service=0

# Check PostgreSQL
current_service=$((current_service + 1))
echo_info "Checking PostgreSQL ($current_service/$total_services)..."
if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres -d ds_builder > /dev/null 2>&1; then
    echo_success "PostgreSQL: healthy"
else
    echo_error "PostgreSQL: not responding"
    services_healthy=false
    failed_services+=("postgres")
fi

# Check Backend
current_service=$((current_service + 1))
echo_info "Checking Backend API ($current_service/$total_services)..."
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo_success "Backend API: healthy"
else
    echo_error "Backend API: not responding"
    services_healthy=false
    failed_services+=("backend")
fi

# Check Frontend
current_service=$((current_service + 1))
echo_info "Checking Frontend ($current_service/$total_services)..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo_success "Frontend: healthy"
else
    echo_error "Frontend: not responding"
    services_healthy=false
    failed_services+=("frontend")
fi

# Check Client
current_service=$((current_service + 1))
echo_info "Checking Client ($current_service/$total_services)..."
if curl -f http://localhost:3002 > /dev/null 2>&1; then
    echo_success "Client: healthy"
else
    echo_error "Client: not responding"
    services_healthy=false
    failed_services+=("client")
fi

# Check Client Proxy
current_service=$((current_service + 1))
echo_info "Checking Client Proxy ($current_service/$total_services)..."
if curl -f http://localhost:3003/health > /dev/null 2>&1; then
    echo_success "Client Proxy: healthy"
else
    echo_error "Client Proxy: not responding"
    services_healthy=false
    failed_services+=("client-proxy")
fi

echo ""
echo_header "📊 Service Status Summary:"
docker-compose -f $COMPOSE_FILE ps

echo ""
if [ "$services_healthy" = true ]; then
    echo_header "🎉 All services are healthy!"
    echo ""
    echo_header "📋 Quick Access URLs:"
    echo "   📱 Frontend:    http://localhost:3000"
    echo "   🎨 Client:      http://localhost:3002"
    echo "   🔧 Backend API: http://localhost:3001"
    echo "   🔗 Client Proxy: http://localhost:3003"
    echo "   🗄️ Database:    localhost:5432"
    echo ""
    echo_info "Note: This is a quick smoke test. For full setup with database"
    echo_info "initialization, use: ./setup-docker.sh"
    exit 0
else
    echo_error "Some services failed health checks:"
    for service in "${failed_services[@]}"; do
        echo "   - $service"
    done
    echo ""
    echo_header "🔍 Troubleshooting:"
    echo "   View logs: docker-compose -f $COMPOSE_FILE logs [service-name]"
    echo "   Full setup: ./setup-docker.sh"
    echo ""
    echo_info "Common issues and solutions:"
    echo "   • Service not starting: Check logs for errors"
    echo "   • Port conflicts: Ensure ports 3000-3003 are available"
    echo "   • Database issues: Try full setup with migrations"
    echo "   • Network issues: Check Docker network configuration"
    exit 1
fi

