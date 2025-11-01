# Seed Database via API

This document explains how to populate the database using the API endpoints instead of direct database access.

## Overview

There are two ways to seed the database with test data:

1. **Direct Database Seeding** (`seed-from-saved-state.ts`) - Uses direct database connection via Drizzle ORM
2. **API-based Seeding** (`seed-via-api.ts`) - Uses REST API endpoints to populate data

## API-based Seeding

The `seed-via-api.ts` script populates the database using the REST API endpoints defined in the application. This approach:

- Tests the API endpoints during seeding
- Validates data through the same validation layers used by real clients
- Can be used to seed remote databases over HTTP
- Demonstrates proper API usage patterns

### Prerequisites

1. Install dependencies (including axios):
```bash
cd services/db-service
npm install
```

2. Make sure the API server is running:
```bash
npm run dev
```

### Usage

#### Basic Usage (Local Development)

```bash
cd services/db-service
npm run seed-via-api
```

By default, the script connects to `http://localhost:3000`.

#### Custom API URL

To seed a different server, set the `API_BASE_URL` environment variable:

```bash
API_BASE_URL=http://localhost:4000 npm run seed-via-api
```

Or for a remote server:

```bash
API_BASE_URL=https://your-api-server.com npm run seed-via-api
```

### What Gets Created

The script creates the same data as the direct database seed:

- ✅ 1 Design System (`test_66`)
- ✅ 5 Components (IconButton, Link, Button, Checkbox, Radiobox)
- ✅ Multiple Variations per component
- ✅ Tokens for each component
- ✅ Token-Variation assignments
- ✅ Props API entries
- ✅ Variation Values with token values
- ✅ Invariant Token Values

### API Endpoints Used

The script uses the following endpoints:

#### Public API (`/api/*`)
- `POST /api/design-systems` - Create design system
- `POST /api/design-systems/components` - Link component to design system
- `POST /api/variation-values` - Create variation values with token values
- `POST /api/components/:id/invariants` - Create invariant token values

#### Admin API (`/admin-api/*`)
- `POST /admin-api/components` - Create components
- `POST /admin-api/variations` - Create variations
- `POST /admin-api/tokens` - Create tokens
- `POST /admin-api/tokens/:tokenId/variations/:variationId` - Assign tokens to variations
- `POST /admin-api/props-api` - Create props API entries

### Seeding Process

The script follows this order to respect foreign key relationships:

1. **Design Systems** - Create the design system(s) first
2. **Components** - Create all components
3. **Design System-Component Links** - Associate components with design systems
4. **Variations** - Create variations for each component
5. **Tokens** - Create tokens for each component
6. **Token-Variation Assignments** - Link tokens to specific variations
7. **Props API** - Create props API entries for components
8. **Variation Values** - Create variation values with their associated token values
9. **Invariant Token Values** - Create invariant token values (non-variation tokens)

### ID Mapping

Since the API returns auto-generated IDs, the script maintains mapping between:
- Old IDs (from source data) → New IDs (from API responses)

This ensures all relationships are correctly established with the new IDs.

### Error Handling

The script includes error handling for:
- Duplicate entries (tokens already assigned to variations, etc.)
- Missing references (component not found, etc.)
- API validation errors

### Comparison with Direct Database Seeding

| Feature | Direct DB Seed | API Seed |
|---------|---------------|----------|
| Speed | Fast | Slower (HTTP overhead) |
| Validation | Minimal | Full API validation |
| Use Case | Development, initial setup | Testing APIs, remote seeding |
| Dependencies | Database connection | Running API server |
| Data Integrity | Manual | Enforced by API |

### Example Output

```
🌱 Starting database seed via API...
📡 API Base URL: http://localhost:3000
🔍 Checking API health...
✅ API is healthy: { status: 'ok', startedAt: '...' }

📊 Creating design systems...
  ✅ Created design system: test_66 (old ID: 1, new ID: 1)

🔧 Creating components...
  ✅ Created component: IconButton (old ID: 1, new ID: 1)
  ✅ Created component: Link (old ID: 2, new ID: 2)
  ...

✅ Seed via API completed successfully!
📊 Summary:
  • 1 Design Systems
  • 5 Components
  • 5 Design System-Component Relationships
  • 25 Variations
  • 150 Tokens
  • 200 Token-Variation Assignments
  • 50 Props API Entries
  • 100 Variation Values
  • 75 Invariant Token Values
```

### Troubleshooting

#### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Make sure the API server is running with `npm run dev`

#### 404 Not Found
```
Response status: 404
```
**Solution**: Verify the API_BASE_URL is correct and includes the correct port

#### Validation Errors
```
Response status: 400
Response data: { "error": "Validation failed", ... }
```
**Solution**: Check that the source data in `all-components-data.ts` is valid

### Development Tips

1. **Clear Database First**: If you need to re-seed, clear the database first
2. **Check API Health**: The script automatically checks `/health` endpoint before starting
3. **View Progress**: The script outputs detailed progress for each step
4. **ID Mapping**: All ID mappings are logged for debugging

### Related Files

- `seed-via-api.ts` - The API-based seeding script
- `seed-from-saved-state.ts` - Direct database seeding script
- `all-components-data.ts` - Source data for seeding
- `routes/index.ts` - API route definitions

