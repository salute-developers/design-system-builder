# Backend Data Fetcher Scripts

This directory contains scripts to fetch all data from the backend API and save it as structured JSON files.

## Files

- `fetch-backend-data.ts` - Main TypeScript script that fetches data from all API endpoints
- `fetch-design-system.ts` - Script to fetch a specific design system by ID with all related data
- `fetch-data.sh` - Shell script wrapper with backend availability check
- `fetch-design-system.sh` - Shell script wrapper for design system fetching
- `README.md` - This documentation file

## Usage

### Prerequisites

1. Make sure your backend server is running on `http://localhost:3001`
2. Install dependencies: `npm install`

### Running the Script

#### Option 1: Using npm script (Recommended)
```bash
npm run fetch-data
```

#### Option 2: Using the shell script
```bash
npm run fetch-data:check
```

#### Option 3: Direct execution
```bash
npx ts-node scripts/fetch-backend-data.ts
```

### Fetching Specific Design System

To fetch data for a specific design system by ID:

#### Option 1: Using npm script (Recommended)
```bash
npm run fetch-design-system <design-system-id>
# Example: npm run fetch-design-system 26
```

#### Option 2: Using the shell script
```bash
npm run fetch-design-system:check <design-system-id>
# Example: npm run fetch-design-system:check 26
```

#### Option 3: Direct execution
```bash
npx ts-node scripts/fetch-design-system.ts <design-system-id>
# Example: npx ts-node scripts/fetch-design-system.ts 26
```

### What the Script Does

#### All Data (fetch-backend-data.ts)
1. **Fetches data from all API endpoints:**
   - `/api/components/available` - All available components with their variations and tokens
   - `/api/design-systems` - All design systems with their components
   - `/api/variation-values` - All variation values with token values

#### Specific Design System (fetch-design-system.ts)
1. **Fetches a single design system by ID:**
   - `/api/design-systems/{id}` - Design system with all related components, variations, tokens, and props API
2. **Merges all related entities into one comprehensive JSON file**
3. **Organizes data hierarchically by component**
4. **Includes variation values and token values specific to the design system**

2. **Saves data in multiple formats:**
   - `backend-data-{timestamp}.json` - Timestamped data file
   - `latest-backend-data.json` - Always the most recent data
   - `fetch-summary.json` - Summary of the fetch operation

3. **Output location:** `client-proxy/data/` directory

#### Design System Output Files
- `design-system-{name}-{timestamp}.json` - Timestamped design system data
- `latest-{name}.json` - Most recent data for specific design system
- `fetch-summary-{name}.json` - Summary for specific design system

### Data Structure

#### All Data Structure
The fetched data includes:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "components": [...],
  "designSystems": [...],
  "variationValues": [...],
  "metadata": {
    "totalComponents": 10,
    "totalDesignSystems": 5,
    "totalVariationValues": 25,
    "apiBaseUrl": "http://localhost:3001"
  }
}
```

#### Design System Structure
A single design system includes:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "designSystem": {
    "id": 26,
    "name": "test-x",
    "description": "Design System test v0.1.0",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "components": [
    {
      "id": 12,
      "name": "Link",
      "variations": [...],
      "tokens": [...],
      "propsAPI": [...]
    }
  ],
  "variationValues": [
    {
      "id": 268,
      "name": "s",
      "componentId": 12,
      "variationId": 57,
      "tokenValues": [...]
    }
  ],
  "tokenValues": [
    {
      "id": 1229,
      "value": "body.s.normal",
      "variationValueId": 268,
      "token": {...}
    }
  ],
  "metadata": {
    "designSystemId": 26,
    "designSystemName": "test-x",
    "totalComponents": 2,
    "totalVariations": 4,
    "totalVariationValues": 8,
    "totalTokens": 7,
    "totalTokenValues": 16,
    "totalPropsAPI": 4
  }
}
```

### Error Handling

- The script continues even if individual endpoints fail
- Failed endpoints return empty arrays
- All errors are logged to console
- The script exits with code 1 if critical errors occur

### Customization

You can modify the base URL by changing the constructor parameter in `fetch-backend-data.ts`:

```typescript
const fetcher = new BackendDataFetcher('http://your-custom-url:port');
```

## Troubleshooting

- **Backend not accessible**: Make sure your backend server is running on port 3001
- **Missing dependencies**: Run `npm install` to install axios and other dependencies
- **Permission errors**: Make sure the `data/` directory is writable
