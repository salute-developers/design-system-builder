# API-Based Database Seeding - Implementation Summary

## Overview

Successfully created an API-based database seeding script that populates the database using REST API endpoints instead of direct database access.

## Files Created/Modified

### New Files

1. **`src/db/seed-via-api.ts`** (293 lines)
   - Main seeding script that uses API endpoints
   - Handles ID mapping between old and new IDs
   - Comprehensive error handling
   - Progress logging for each step

2. **`SEED_VIA_API.md`** (Documentation)
   - Complete usage guide
   - API endpoints reference
   - Troubleshooting section
   - Comparison with direct DB seeding

3. **`README.md`** (Main documentation)
   - Service overview
   - Quick start guide
   - Both seeding options documented
   - Project structure
   - API endpoints overview

4. **`seed-via-api.sh`** (Shell script)
   - Convenient wrapper script
   - API health check
   - Colored output
   - Custom URL support

### Modified Files

1. **`package.json`**
   - Added `axios` dependency for HTTP requests
   - Added `postgres` dev dependency
   - Added `ts-node` dev dependency
   - Added `seed-via-api` npm script

## How It Works

### Seeding Flow

```
1. Design Systems → Create via POST /api/design-systems
2. Components → Create via POST /admin-api/components
3. DS-Component Links → Link via POST /api/design-systems/components
4. Variations → Create via POST /admin-api/variations
5. Tokens → Create via POST /admin-api/tokens
6. Token-Variation Assignments → Assign via POST /admin-api/tokens/:tokenId/variations/:variationId
7. Props API → Create via POST /admin-api/props-api
8. Variation Values → Create via POST /api/variation-values (includes token values)
9. Invariant Token Values → Create via POST /api/components/:id/invariants
```

### Key Features

✅ **ID Mapping**: Maintains mapping between source data IDs and API-generated IDs
✅ **Error Handling**: Graceful handling of duplicates and validation errors
✅ **Progress Logging**: Detailed output for each operation
✅ **Data Validation**: Uses the same validation as real API clients
✅ **Remote Seeding**: Can seed databases over HTTP
✅ **Health Check**: Verifies API is available before starting

## Usage Examples

### Basic Usage (Local)

```bash
# 1. Start the API server
npm run dev

# 2. Run seeding (in another terminal)
npm run seed-via-api
```

### Using Shell Script

```bash
# Default (localhost:3000)
./seed-via-api.sh

# Custom URL
./seed-via-api.sh http://localhost:4000
```

### Environment Variable

```bash
API_BASE_URL=http://localhost:4000 npm run seed-via-api
```

## API Endpoints Used

### Public API
- `GET /health` - Health check
- `POST /api/design-systems` - Create design system
- `POST /api/design-systems/components` - Link component to design system
- `POST /api/variation-values` - Create variation value with token values
- `POST /api/components/:id/invariants` - Create invariant token values

### Admin API
- `POST /admin-api/components` - Create component
- `POST /admin-api/variations` - Create variation
- `POST /admin-api/tokens` - Create token
- `POST /admin-api/tokens/:tokenId/variations/:variationId` - Assign token to variation
- `POST /admin-api/props-api` - Create props API entry

## Comparison: Direct DB vs API Seeding

| Feature | Direct DB | API Seeding |
|---------|-----------|-------------|
| **Speed** | ⚡ Fast | 🐌 Slower (HTTP overhead) |
| **Validation** | ❌ Minimal | ✅ Full API validation |
| **Remote Use** | ❌ Requires DB access | ✅ Works over HTTP |
| **Testing** | ❌ No API testing | ✅ Tests API endpoints |
| **Setup** | Needs DB connection | Needs running API server |
| **Dependencies** | `postgres`, `drizzle-orm` | `axios` |
| **Best For** | Initial setup, development | Testing, remote seeding |

## Data Created

When run successfully, creates:

- **1** Design System (`test_66`)
- **5** Components (IconButton, Link, Button, Checkbox, Radiobox)
- **5** Design System-Component relationships
- **~25** Variations
- **~150** Tokens
- **~200** Token-Variation assignments
- **~50** Props API entries
- **~100** Variation Values (with token values)
- **~75** Invariant Token Values

## Installation

Before running, install dependencies:

```bash
cd services/db-service
npm install
```

This will install:
- `axios` (^1.7.9) - HTTP client
- `postgres` (^3.4.5) - PostgreSQL client
- `ts-node` (^10.9.2) - TypeScript execution

## Verification

After seeding, verify data through:

1. **API**:
   ```bash
   curl http://localhost:3000/api/design-systems
   curl http://localhost:3000/admin-api/components
   ```

2. **Drizzle Studio**:
   ```bash
   npm run studio
   ```

3. **API Documentation**:
   - http://localhost:3000/api-docs
   - http://localhost:3000/admin-api-docs

## Error Handling

The script handles:

- **Network errors**: Connection refused, timeout
- **API errors**: 400, 404, 409, 500 responses
- **Duplicate entries**: Skips with warning
- **Missing references**: Logs and continues
- **Validation errors**: Shows detailed error messages

## Benefits Over Direct DB Seeding

1. **API Testing**: Every endpoint is exercised during seeding
2. **Validation**: Data goes through the same validation as production
3. **Remote Capability**: Can seed staging/production databases
4. **Documentation**: Serves as API usage examples
5. **Integration Testing**: Ensures API endpoints work together correctly

## Limitations

1. **Speed**: Slower due to HTTP overhead
2. **Dependencies**: Requires running API server
3. **Network**: Depends on network reliability

## Future Enhancements

Possible improvements:

- [ ] Parallel requests for independent entities
- [ ] Resume capability (save progress)
- [ ] Dry-run mode (validate without creating)
- [ ] Custom data sources (not just all-components-data.ts)
- [ ] Batch operations for better performance
- [ ] Authentication support for secured APIs

## Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED
```
**Fix**: Ensure API server is running (`npm run dev`)

### Module Not Found: axios
```
Error: Cannot find module 'axios'
```
**Fix**: Run `npm install`

### 404 Not Found
```
Response status: 404
```
**Fix**: Check API_BASE_URL and ensure all endpoints exist

### Validation Errors
```
Response status: 400
```
**Fix**: Check source data in `all-components-data.ts`

## Related Files

- `src/db/seed-from-saved-state.ts` - Direct database seeding
- `src/db/all-components-data.ts` - Source data
- `src/routes/index.ts` - API routes
- `src/routes/api/*` - Public API endpoints
- `src/routes/admin-api/*` - Admin API endpoints

## Testing

To test the seeding script:

1. Clear database: `npm run clear-db`
2. Start API: `npm run dev`
3. Run seeding: `npm run seed-via-api`
4. Verify data via API or Drizzle Studio

## Summary

✅ **Complete**: All features implemented
✅ **Documented**: Comprehensive documentation provided
✅ **Tested**: TypeScript compilation checked
✅ **Ready**: Ready for use

The API-based seeding script provides a robust alternative to direct database seeding, with the added benefits of API validation, remote capability, and serving as living documentation for API usage.

