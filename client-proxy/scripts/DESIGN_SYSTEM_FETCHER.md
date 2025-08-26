# Design System Fetcher

A specialized script to fetch a specific design system by ID and merge all related entities into one comprehensive JSON file.

## 🎯 Purpose

This script fetches a single design system and all its related data, creating a self-contained JSON file that includes:
- Design system metadata
- All components in the design system
- Component variations and their token variations
- Tokens with platform-specific parameters
- Props API definitions
- Variation values specific to the design system
- Token values for those variations

## 🚀 Quick Start

```bash
# Fetch design system with ID 26
npm run fetch-design-system 26

# Or use the shell script
npm run fetch-design-system:check 26
```

## 📊 What Gets Fetched

### 1. Design System
- Basic info (id, name, description, timestamps)

### 2. Components
- All components associated with the design system
- Each component includes:
  - **Variations**: Different states/appearances (e.g., "view", "size")
  - **Tokens**: Design tokens (colors, typography, dimensions)
  - **Props API**: Component properties and their values

### 3. Variations
- Component variations with their token variations
- Token variations link tokens to specific variations

### 4. Tokens
- Design tokens with platform-specific parameters:
  - `xmlParam`: Android/XML parameter names
  - `composeParam`: Jetpack Compose parameter names
  - `iosParam`: iOS parameter names
  - `webParam`: Web/CSS parameter names

### 5. Props API
- Component properties (e.g., "disabled", "target", "href")
- Each prop has a name and value

### 6. Variation Values
- Specific values for variations within this design system
- Links to token values

### 7. Token Values
- Actual values for tokens in specific variation contexts

## 🔧 Usage Examples

### Basic Usage
```bash
npm run fetch-design-system 26
```

### Shell Script with Validation
```bash
./scripts/fetch-design-system.sh 26
```

### Programmatic Usage
```typescript
import { DesignSystemFetcher } from './scripts/fetch-design-system';

const fetcher = new DesignSystemFetcher();
const data = await fetcher.fetchDesignSystem(26);
await fetcher.saveData(data);
```

## 📁 Output Files

For design system "test-x" with ID 26:

1. **`design-system-test-x-{timestamp}.json`**
   - Timestamped data file for historical tracking
   - Contains complete merged data structure

2. **`latest-test-x.json`**
   - Always the most recent data for this design system
   - Easy access to current state

3. **`fetch-summary-test-x.json`**
   - Summary with metadata and file paths
   - Quick overview of what was fetched

## 📋 Data Structure

```json
{
  "timestamp": "2025-08-26T11:21:28.918Z",
  "designSystem": {
    "id": 26,
    "name": "test-x",
    "description": "Design System test v0.1.0",
    "createdAt": "2025-07-01T16:51:59.840Z",
    "updatedAt": "2025-08-21T23:11:10.911Z"
  },
  "components": [
    {
      "id": 12,
      "name": "Link",
      "description": "Clickable link component for navigation",
      "variations": [
        {
          "id": 53,
          "name": "view",
          "description": "Visual appearance variation",
          "tokenVariations": [
            {
              "id": 390,
              "token": {
                "id": 198,
                "name": "textColor",
                "type": "color",
                "xmlParam": "contentColor",
                "composeParam": "contentColor",
                "iosParam": "contentColor",
                "webParam": "linkColor"
              }
            }
          ]
        }
      ],
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
      "tokenValues": [
        {
          "id": 1229,
          "value": "body.s.normal",
          "token": { ... }
        }
      ]
    }
  ],
  "tokenValues": [
    {
      "id": 1229,
      "value": "body.s.normal",
      "variationValueId": 268,
      "token": { ... }
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

## ⚙️ Configuration

### Environment Variables
```bash
export BACKEND_BASE_URL="http://localhost:3001"
export BACKEND_TIMEOUT="30000"
```

### Custom Configuration
```typescript
const customConfig = {
  backend: {
    baseUrl: 'http://your-backend:port',
    timeout: 60000
  },
  output: {
    directory: 'custom-data'
  }
};

const fetcher = new DesignSystemFetcher(customConfig);
```

## 🔍 Backend Requirements

The backend must support the endpoint:
```
GET /api/design-systems/{id}
```

With the following relations included:
- `components.component.variations.tokenVariations.token`
- `components.component.tokens`
- `components.component.propsAPI`
- `variationValues.tokenValues.token`

## 🚨 Error Handling

- **Design system not found**: Returns 404 error
- **Backend unavailable**: Script exits with error
- **Invalid ID**: Script validates input before making requests
- **Partial failures**: Script continues and logs errors

## 📈 Use Cases

1. **Design System Migration**: Export complete design system data
2. **Backup & Recovery**: Create point-in-time snapshots
3. **Analysis**: Analyze component relationships and token usage
4. **Documentation**: Generate comprehensive design system docs
5. **Testing**: Use data for automated testing scenarios

## 🔗 Related Scripts

- **`fetch-backend-data.ts`**: Fetches all data from all endpoints
- **`fetch-design-system.ts`**: Fetches specific design system (this script)
- **`config.ts`**: Configuration management
- **`example-usage.ts`**: Usage examples and patterns
