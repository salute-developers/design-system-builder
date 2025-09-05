#!/bin/bash

echo "🐳 Testing Docker Setup for Design System Builder"
echo "=================================================="

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

# Build and start the development environment
echo ""
echo "🔧 Building and starting development environment..."
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml build
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo ""
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres -d ds_builder; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL is not healthy"
fi

# Check Backend
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend API is healthy"
else
    echo "❌ Backend API is not healthy"
fi

# Check Frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is not healthy"
fi

echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "🎉 Docker setup test completed!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "🗄️ Database: localhost:5432"
echo ""
echo "To stop services: docker-compose -f docker-compose.dev.yml down" 