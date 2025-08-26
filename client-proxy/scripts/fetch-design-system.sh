#!/bin/bash

# Script to fetch a specific design system by ID
# Usage: ./fetch-design-system.sh <design-system-id>

# Check if design system ID is provided
if [ $# -eq 0 ]; then
    echo "❌ Usage: $0 <design-system-id>"
    echo "Example: $0 26"
    exit 1
fi

DESIGN_SYSTEM_ID=$1

# Validate that the ID is a positive number
if ! [[ "$DESIGN_SYSTEM_ID" =~ ^[1-9][0-9]*$ ]]; then
    echo "❌ Invalid design system ID: $DESIGN_SYSTEM_ID"
    echo "Design system ID must be a positive number."
    exit 1
fi

echo "🚀 Starting design system fetch for ID: $DESIGN_SYSTEM_ID"

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
echo "📥 Fetching design system data..."
npx ts-node scripts/fetch-design-system.ts "$DESIGN_SYSTEM_ID"

echo "✨ Done!"
