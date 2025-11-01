#!/bin/bash

# Script to seed the database via API
# Usage: ./seed-via-api.sh [API_URL]
#
# Examples:
#   ./seed-via-api.sh                     # Uses default http://localhost:3000
#   ./seed-via-api.sh http://localhost:4000
#   ./seed-via-api.sh https://api.example.com

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default API URL
API_URL="${1:-http://localhost:3000}"

echo -e "${GREEN}🌱 Database Seeding via API${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if the API is reachable
echo -e "${YELLOW}📡 Checking API at: ${API_URL}${NC}"
if curl -s -f "${API_URL}/health" > /dev/null; then
  echo -e "${GREEN}✅ API is reachable${NC}"
else
  echo -e "${RED}❌ Cannot reach API at ${API_URL}${NC}"
  echo -e "${YELLOW}💡 Make sure the API server is running:${NC}"
  echo -e "   ${YELLOW}npm run dev${NC}"
  exit 1
fi

echo ""

# Run the seeding script
echo -e "${YELLOW}🚀 Starting seed process...${NC}"
echo ""

API_BASE_URL="${API_URL}" npm run seed-via-api

echo ""
echo -e "${GREEN}✅ Seeding completed!${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

