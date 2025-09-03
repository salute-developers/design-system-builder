#!/bin/bash

# =============================================================================
# Design System Builder - Quick Docker Smoke Test
# =============================================================================
# This script performs a quick smoke test of the Docker setup without
# any database initialization or data seeding. It's designed for:
# - Quick validation that all services can start and respond
# - Testing Docker configuration changes
# - Verifying service connectivity
# - CI/CD pipeline validation
#
# Usage: ./test-docker.sh [dev|prod]
# Default: dev (development environment)
# =============================================================================

# Parse command line argument
ENV=${1:-dev}

if [ "$ENV" = "dev" ] || [ "$ENV" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    ENV_NAME="development"
elif [ "$ENV" = "prod" ] || [ "$ENV" = "production" ]; then
    COMPOSE_FILE="docker-compose.yml"
    ENV_NAME="production"
else
    echo "❌ Invalid environment. Use: dev, development, prod, or production"
    echo "Usage: ./test-docker.sh [dev|prod]"
    exit 1
fi

echo "🧪 Design System Builder - Quick Docker Smoke Test"
echo "=================================================="
echo "Environment: $ENV_NAME"
echo "Compose file: $COMPOSE_FILE"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose."
    exit 1
fi

echo "✅ docker-compose is available"

# Quick cleanup and start
echo ""
echo "🔄 Quick restart of services..."
docker-compose -f $COMPOSE_FILE down > /dev/null 2>&1
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to start
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

# Quick health checks
echo ""
echo "🔍 Quick health check..."

services_healthy=true
failed_services=()

# Check PostgreSQL
if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres -d ds_builder > /dev/null 2>&1; then
    echo "✅ PostgreSQL: healthy"
else
    echo "❌ PostgreSQL: not responding"
    services_healthy=false
    failed_services+=("postgres")
fi

# Check Backend
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend API: healthy"
else
    echo "❌ Backend API: not responding"
    services_healthy=false
    failed_services+=("backend")
fi

# Check Frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend: healthy"
else
    echo "❌ Frontend: not responding"
    services_healthy=false
    failed_services+=("frontend")
fi

# Check Client
if curl -f http://localhost:3002 > /dev/null 2>&1; then
    echo "✅ Client: healthy"
else
    echo "❌ Client: not responding"
    services_healthy=false
    failed_services+=("client")
fi

# Check Client Proxy
if curl -f http://localhost:3003/health > /dev/null 2>&1; then
    echo "✅ Client Proxy: healthy"
else
    echo "❌ Client Proxy: not responding"
    services_healthy=false
    failed_services+=("client-proxy")
fi

echo ""
echo "📊 Service Status Summary:"
docker-compose -f $COMPOSE_FILE ps

echo ""
if [ "$services_healthy" = true ]; then
    echo "🎉 All services are healthy!"
    echo ""
    echo "📋 Quick Access URLs:"
    echo "   📱 Frontend:    http://localhost:3000"
    echo "   🎨 Client:      http://localhost:3002"
    echo "   🔧 Backend API: http://localhost:3001"
    echo "   🔗 Client Proxy: http://localhost:3003"
    echo "   🗄️ Database:    localhost:5432"
    echo ""
    echo "ℹ️  Note: This is a quick smoke test. For full setup with database"
    echo "   initialization, use: ./setup-docker.sh"
    exit 0
else
    echo "❌ Some services failed health checks:"
    for service in "${failed_services[@]}"; do
        echo "   - $service"
    done
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   View logs: docker-compose -f $COMPOSE_FILE logs [service-name]"
    echo "   Full setup: ./setup-docker.sh"
    exit 1
fi