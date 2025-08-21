# Client Proxy Server

A simple file system proxy server for storing and retrieving design system data.

## Features

- 📁 **File System Storage**: Saves design systems as JSON files on disk
- 🔄 **REST API**: Simple CRUD operations for design systems
- 🚀 **Express Server**: Lightweight and fast
- 🌐 **CORS Enabled**: Works with frontend applications
- 📝 **JSON Format**: Human-readable storage format

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   # Production
   npm start
   
   # Development (with auto-reload)
   npm run dev
   ```

3. **Server will start on port 3001** (configurable via PORT environment variable)

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
