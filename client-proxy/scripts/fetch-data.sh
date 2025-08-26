#!/bin/bash

# Script to fetch backend data
echo "🚀 Starting backend data fetch..."

# Check if backend is running
echo "🔍 Checking if backend is accessible..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is accessible"
else
    echo "❌ Backend is not accessible at http://localhost:3001"
    echo "Please make sure your backend server is running"
    exit 1
fi

# Run the TypeScript script
echo "📥 Fetching data..."
npx ts-node scripts/fetch-backend-data.ts

echo "✨ Done!"
