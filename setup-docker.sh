#!/bin/bash

echo "🐳 Setting up Design System Builder with Docker"
echo "=============================================="

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

# Ask which environment to set up
echo ""
echo "Which environment would you like to set up?"
echo "1) Development (with hot reloading)"
echo "2) Production"
read -p "Enter your choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    ENV_NAME="development"
elif [ "$choice" = "2" ]; then
    COMPOSE_FILE="docker-compose.yml"
    ENV_NAME="production"
else
    echo "❌ Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "🚀 Setting up $ENV_NAME environment..."

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down -v

# Build and start services
echo "🔧 Building and starting services..."
docker-compose -f $COMPOSE_FILE build
docker-compose -f $COMPOSE_FILE up -d

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout=60
while ! docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres -d ds_builder > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        echo "❌ PostgreSQL did not start in time"
        exit 1
    fi
done

echo "✅ PostgreSQL is ready"

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
timeout=60
while ! docker-compose -f $COMPOSE_FILE exec -T backend curl -f http://localhost:3001/api/health > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        echo "❌ Backend did not start in time"
        exit 1
    fi
done

echo "✅ Backend is ready"

# Run database setup
echo ""
echo "🗄️ Setting up database..."

echo "  📋 Running migrations..."
if docker-compose -f $COMPOSE_FILE exec -T backend npm run migrate; then
    echo "  ✅ Migrations completed"
else
    echo "  ❌ Migrations failed"
    exit 1
fi

echo "  🌱 Seeding basic data (components and tokens)..."
if docker-compose -f $COMPOSE_FILE exec -T backend npm run seed; then
    echo "  ✅ Basic seeding completed"
else
    echo "  ❌ Basic seeding failed"
    exit 1
fi

echo "  🎨 Creating design system with variation values..."
if docker-compose -f $COMPOSE_FILE exec -T backend npm run seed-all; then
    echo "  ✅ Design system seeding completed"
else
    echo "  ❌ Design system seeding failed"
    exit 1
fi

# Check final health
echo ""
echo "🔍 Final health check..."

services_healthy=true

# Check PostgreSQL
if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U postgres -d ds_builder > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL is not healthy"
    services_healthy=false
fi

# Check Backend
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend API is healthy"
else
    echo "❌ Backend API is not healthy"
    services_healthy=false
fi

# Check Frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is not healthy"
    services_healthy=false
fi

echo ""
if [ "$services_healthy" = true ]; then
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📋 Service Information:"
    echo "   📱 Frontend:    http://localhost:3000"
    echo "   🔧 Backend API: http://localhost:3001"
    echo "   🗄️ Database:    localhost:5432"
    echo "   📊 Health:      http://localhost:3001/api/health"
    echo ""
    echo "📦 View running services:"
    docker-compose -f $COMPOSE_FILE ps
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs:      docker-compose -f $COMPOSE_FILE logs -f"
    echo "   Stop services:  docker-compose -f $COMPOSE_FILE down"
    echo "   Restart:        docker-compose -f $COMPOSE_FILE restart"
    echo ""
    echo "🎯 Test the CLI tool:"
    echo "   cd generate-ds && npm run dev 1 --dry-run"
else
    echo "❌ Setup completed with errors. Please check the service logs:"
    echo "   docker-compose -f $COMPOSE_FILE logs"
fi 