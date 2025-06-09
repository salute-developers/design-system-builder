#!/bin/bash

echo "🧪 Testing Swagger API Documentation"
echo "====================================="

# Check if backend is running
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Backend is not running. Please start with: docker-compose -f docker-compose.dev.yml up -d"
    exit 1
fi

echo "✅ Backend is running"

# Test Swagger UI
if curl -s http://localhost:3001/api-docs/ | grep -q "swagger-ui\|Design System Builder API"; then
    echo "✅ Swagger UI is accessible at http://localhost:3001/api-docs"
else
    echo "❌ Swagger UI is not accessible"
    exit 1
fi

# Test OpenAPI spec
if curl -s http://localhost:3001/api-docs.json | grep -q "Design System Builder API"; then
    echo "✅ OpenAPI spec is accessible at http://localhost:3001/api-docs.json"
else
    echo "❌ OpenAPI spec is not accessible"
    exit 1
fi

# Test a sample API endpoint
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
    echo "✅ API health endpoint is working"
else
    echo "❌ API health endpoint is not working"
    exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "📚 Access the API documentation:"
echo "   Interactive Docs: http://localhost:3001/api-docs"
echo "   OpenAPI Spec:     http://localhost:3001/api-docs.json"
echo ""
echo "🔗 Available API endpoints:"
echo "   Design Systems:   GET/POST/PUT/DELETE /api/design-systems"
echo "   Components:       GET /api/components/available"
echo "   Variation Values: GET/POST/PUT/DELETE /api/variation-values"
echo "   Health Check:     GET /api/health" 