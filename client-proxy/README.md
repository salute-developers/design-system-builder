# Client Proxy Server

A TypeScript-based file system proxy server for storing and retrieving design system data with full type safety.

## Features

- 📁 **File System Storage**: Saves design systems as JSON files on disk
- 🔄 **REST API**: Simple CRUD operations for design systems
- 🚀 **Express Server**: Lightweight and fast
- 🌐 **CORS Enabled**: Works with frontend applications
- 📝 **JSON Format**: Human-readable storage format
- 🔷 **TypeScript**: Full type safety with types derived from client sources
- 🎯 **Type-Safe API**: Strongly typed request/response interfaces
- 📊 **Comprehensive Types**: Shared types for ThemeSource, Meta, and API responses
- ✅ **Runtime Validation**: Zod schemas for request/response validation
- 🛡️ **Data Integrity**: Validates stored data on load to detect corruption
- 📋 **Detailed Errors**: Rich validation error messages with field-level details
- 🔄 **Type Inference**: All TypeScript types inferred from Zod schemas (single source of truth)
- 🎯 **Zero Duplication**: No manual type definitions - everything derived from validation schemas

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the TypeScript project**:
   ```bash
   npm run build
   ```

3. **Start the server**:
   ```bash
   # Production (compiled JS)
   npm start
   
   # Development (TypeScript with hot reload)
   npm run dev
   
   # Type checking only
   npm run type-check
   ```

4. **Server will start on port 3003** (configurable via PORT environment variable)

## API Endpoints

### Health Check
```
GET /health
```
Returns server status.

### Save Design System
```
POST /api/design-systems
Content-Type: application/json

{
  "name": "my-design-system",
  "version": "1.0.0",
  "themeData": { ... },
  "componentsData": [ ... ]
}
```

### Load Design System
```
GET /api/design-systems/:name/:version
```
Returns the design system data or 404 if not found.

### List All Design Systems
```
GET /api/design-systems
```
Returns array of `[name, version]` tuples or `undefined` if none exist.

### Delete Design System
```
DELETE /api/design-systems/:name/:version
```
Removes the design system file.

## Storage

- Design systems are stored in the `storage/` directory
- Each file is named `{name}@{version}.json`
- Files include metadata like `savedAt` timestamp
- Directory is automatically created on startup

## Data Fetching Scripts

The project includes scripts to fetch all data from the backend API and save it as structured JSON files.

### Quick Start

```bash
# Fetch all backend data
npm run fetch-data

# Check backend availability and fetch data
npm run fetch-data:check
```

### What It Fetches

- **Components**: All available components with variations, tokens, and props API
- **Design Systems**: All design systems with their components and variation values
- **Variation Values**: All variation values with token values

### Output Files

- `data/backend-data-{timestamp}.json` - Timestamped data file
- `data/latest-backend-data.json` - Most recent data
- `data/fetch-summary.json` - Summary of the fetch operation

### Configuration

You can customize the script behavior by setting environment variables:

```bash
export BACKEND_BASE_URL="http://localhost:3001"
export BACKEND_TIMEOUT="30000"
npm run fetch-data
```

For more details, see the [scripts documentation](scripts/README.md).

## Example Usage

```javascript
// Save a design system
const response = await fetch('http://localhost:3001/api/design-systems', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my-theme',
    version: '1.0.0',
    themeData: { /* theme data */ },
    componentsData: [ /* components data */ ]
  })
});

// Load a design system
const designSystem = await fetch('http://localhost:3001/api/design-systems/my-theme/1.0.0')
  .then(res => res.json());

// List all design systems
const allSystems = await fetch('http://localhost:3001/api/design-systems')
  .then(res => res.json());
```

## Error Handling

The server returns appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing name/version)
- `404` - Design System Not Found
- `500` - Server Error

All error responses include an `error` field with a descriptive message.

## 🧪 Testing

The server includes a comprehensive test suite with 86.3% code coverage.

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Coverage
- ✅ **19 tests** covering all API endpoints
- ✅ **CRUD operations** fully tested
- ✅ **Error handling** comprehensive
- ✅ **Integration scenarios** validated
- ✅ **Edge cases** covered

See [TESTING.md](./TESTING.md) for detailed testing documentation.

## 🔷 TypeScript Integration

The server is built with TypeScript and uses types derived from the client sources for maximum compatibility.

### Type Safety Features
- **Shared Types**: Types imported from client `themeBuilder` and `componentBuilder`
- **API Contracts**: Strongly typed request/response interfaces
- **Design System Data**: Full type safety for `ThemeSource` and `Meta` interfaces
- **Error Handling**: Typed error responses and status codes

### Type Definitions (Inferred from Zod)
```typescript
// All types are automatically inferred from Zod schemas - no manual definitions!
import { 
    ThemeSource,
    Meta,
    DesignSystemData,
    ComponentAPI,
    Sources
} from './validation'; // <- All types come from here

// Example: ThemeSource is automatically inferred from ThemeSourceSchema
const themeData: ThemeSource = {
    meta: { /* ... */ },
    variations: { /* ... */ }
}; // ✅ Full type safety with runtime validation
```

### Development Workflow
```bash
# Type checking during development
npm run type-check

# Build with type checking
npm run build

# Development with hot reload and type checking
npm run dev

# Run validation tests
npm test validation.test.ts
```

## ✅ Runtime Validation with Zod

The server uses Zod for comprehensive runtime validation, ensuring data integrity at every level.

### Validation Features
- **Request Body Validation**: All POST requests validated against strict schemas
- **URL Parameter Validation**: Design system names and versions validated
- **Data Integrity Checks**: Stored files validated when loaded
- **Detailed Error Messages**: Field-level validation errors with clear descriptions
- **Type Coercion**: Automatic trimming and type conversion where appropriate

### Validation Error Format
```typescript
{
  "error": "Validation failed",
  "details": "Request body does not match required schema",
  "validationErrors": [
    {
      "path": "componentsData.0.sources.api.0.type",
      "message": "Invalid enum value. Expected 'color' | 'dimension' | 'float' | 'shape' | 'typography', received 'invalid_type'",
      "code": "invalid_enum_value"
    }
  ]
}
```

### Validated Endpoints
- `POST /api/design-systems` - Full design system validation
- `GET /api/design-systems/:name/:version` - Parameter validation + data integrity
- `DELETE /api/design-systems/:name/:version` - Parameter validation

### Schema Coverage & Type Inference
- **Complete Component Builder Types**: ComponentAPI, Sources, Config hierarchies
- **Theme System Types**: ThemeMeta, TokenType, PlatformsVariations  
- **Nested Validation**: Deep validation of complex component configurations
- **Platform Mappings**: Cross-platform token validation
- **Single Source of Truth**: All TypeScript types automatically inferred from Zod schemas
- **Zero Type Duplication**: No manual type definitions - everything derived from validation

### Migration Guide
```typescript
// ❌ Old way (deprecated)
import { DesignSystemData } from './types';

// ✅ New way (recommended)
import { DesignSystemData } from './validation';

// Benefits:
// - Types are guaranteed to match validation schemas
// - No risk of type/schema drift
// - Single place to update both types and validation
// - Better IntelliSense with Zod inference
```
