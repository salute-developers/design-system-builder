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

### Type Definitions
```typescript
// Core design system types
interface ThemeSource {
    meta: ThemeMeta;
    variations: PlatformsVariations;
}

interface Meta {
    name: string;
    description: string;
    sources: Sources;
}

// API request/response types
interface DesignSystemData {
    name: string;
    version: string;
    themeData: ThemeSource;
    componentsData: Array<Meta>;
}
```

### Development Workflow
```bash
# Type checking during development
npm run type-check

# Build with type checking
npm run build

# Development with hot reload and type checking
npm run dev
```
