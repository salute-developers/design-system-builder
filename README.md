# Design System Builder

A modern web application for managing and building design systems. This application allows you to create and manage components, variations, tokens, and their relationships with an intuitive admin interface.

## Features

- **Component Management**: Create and organize UI components with cascade delete support
- **Variation System**: Define different states/types for each component  
- **Token System**: Manage design tokens (colors, spacing, typography, etc.) with platform-specific parameters
- **Smart Token Assignment**: Intelligent token-to-variation assignment based on configuration structure
- **Cross-Platform Support**: Define platform-specific parameters for Android XML, Jetpack Compose, iOS, and Web
- **Admin Interface**: Clean, modern three-panel UI for efficient workflow
- **Real-time Updates**: Live UI updates with proper state management
- **Search & Filtering**: Independent search functionality for components, variations, and tokens
- **Visual Indicators**: Clear indication of unassigned tokens and current assignments
- **Multi-Selection**: Bulk token assignment capabilities
- **Database Integrity**: Proper foreign key constraints with cascade delete for data consistency

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm run install:all
   ```

3. Set up the database:
   - Create a PostgreSQL database named `ds_builder`
   - Create a `.env` file in the backend directory with the following variables:
     ```
     # Database Configuration
     DB_HOST=localhost
     DB_PORT=5432
     DB_USER=postgres
     DB_PASSWORD=postgres
     DB_NAME=ds_builder

     # Server Configuration
     PORT=3001
     ```

4. Generate and run migrations:
   ```bash
   cd backend
   npm run generate
   npm run migrate
   ```

5. (Optional) Seed the database with sample components:
   ```bash
   cd backend
   npm run seed
   ```
   This will create Button, IconButton, and Link components with proper variations and tokens matching web configuration structure.

6. Start the development servers:
   ```bash
   npm run dev
   ```

This will start both the backend (port 3001) and frontend (port 5173) servers.

## Project Structure

- `/backend` - Node.js backend with Express and Drizzle ORM
- `/frontend` - React frontend with TypeScript and shadcn/ui
- `/docs` - Documentation including database schema

## Admin Interface

The admin interface provides a streamlined workflow:

1. **Components Panel (1/3)**: Browse and manage UI components
2. **Tokens & Variations Tabs (2/3)**: Manage component tokens and variations
3. **Token Assignment**: Assign component tokens to specific variations

### Key Features:
- **Linear Workflow**: Components → Variations → Tokens
- **Independent Search**: Separate search for components, tokens, and variations
- **Visual Feedback**: Unassigned tokens are highlighted in orange
- **Multi-Token Assignment**: Select multiple tokens for bulk assignment
- **Platform Parameters**: Define token values for XML, Compose, iOS, and Web

## API Endpoints

### Admin API (Components Management)
- `GET /admin-api/components` - Get all components with variations and tokens
- `POST /admin-api/components` - Create a new component
- `PUT /admin-api/components/:id` - Update a component
- `DELETE /admin-api/components/:id` - Delete a component
- `GET /admin-api/components/:id` - Get component details with relations

### Variations
- `GET /admin-api/variations` - Get all variations
- `POST /admin-api/variations` - Create a new variation
- `PUT /admin-api/variations/:id` - Update a variation
- `DELETE /admin-api/variations/:id` - Delete a variation
- `GET /admin-api/variations/:id/tokens` - Get tokens assigned to variation

### Tokens
- `GET /admin-api/tokens` - Get all tokens
- `POST /admin-api/tokens` - Create a new token
- `PUT /admin-api/tokens/:id` - Update a token
- `DELETE /admin-api/tokens/:id` - Delete a token

### Token Assignment
- `POST /admin-api/tokens/:tokenId/variations/:variationId` - Assign token to variation
- `DELETE /admin-api/tokens/:tokenId/variations/:variationId` - Remove token from variation

### Design Systems API (Future/Extended)
- `GET /api/design-systems` - Get all design systems
- `POST /api/design-systems` - Create a new design system

## Database Architecture

The system uses a sophisticated many-to-many relationship model with proper cascade delete:

- **Components** have many **Tokens** (component-level tokens)
- **Components** have many **Variations** (component states/types)
- **Tokens** can be assigned to multiple **Variations** (via junction table)
- **Variations** can use multiple **Tokens** (flexible assignment)

### Database Integrity Features:
- **Cascade Delete**: Deleting a component automatically removes all related variations, tokens, and assignments
- **Foreign Key Constraints**: Ensures referential integrity across all relationships
- **Smart Seeding**: Seed script creates components with tokens properly assigned to relevant variations

### Token-Variation Assignment Logic:
The system intelligently assigns tokens to variations based on their purpose:
- **View tokens** (colors, appearance) → assigned to `view` variations
- **Size tokens** (dimensions, spacing) → assigned to `size` variations  
- **Typography tokens** (fonts) → assigned to all variations
- **State tokens** (disabled, focused) → assigned to their specific variations

This architecture ensures design system principles are maintained while providing maximum flexibility for token reuse.

## Technologies Used

### Backend:
- Node.js with Express
- Drizzle ORM with PostgreSQL
- TypeScript
- Vitest for testing

### Frontend:
- React 18 with TypeScript
- shadcn/ui component library
- Tailwind CSS for styling
- React Router for navigation
- Axios for API communication

### Development:
- Concurrent development servers
- Hot reload for both frontend and backend
- Type-safe database schema
- Comprehensive test suite

## Testing

Run the backend test suite:
```bash
cd backend
npm test
```

The project includes comprehensive tests covering:
- Database operations
- API endpoints
- CRUD operations
- Relationship integrity
- Error handling

## Development Commands

```bash
# Install all dependencies
npm run install:all

# Start both servers
npm run dev

# Backend only
cd backend && npm run dev

# Frontend only  
cd frontend && npm run dev

# Run tests
cd backend && npm test

# Database migrations
cd backend && npm run generate && npm run migrate

# Seed database with sample data
cd backend && npm run seed
```

## Recent Improvements

### v1.1.0 - Database Integrity & Smart Seeding
- **Fixed Foreign Key Constraints**: Added cascade delete to all relationships for proper data cleanup
- **Component Deletion**: Components can now be safely deleted with all related data automatically removed
- **Smart Token Assignment**: Seed script now properly assigns tokens to relevant variations based on web config structure
- **Enhanced Testing**: Added comprehensive CRUD tests for all components operations
- **Optional Token Values**: Made `defaultValue` optional for tokens in both frontend and API 