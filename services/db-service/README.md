# Database Service

Backend API service for the Design System Builder application.

## Features

- RESTful API for managing design systems, components, variations, and tokens
- PostgreSQL database with Drizzle ORM
- Swagger/OpenAPI documentation
- Comprehensive test suite
- Two seeding options: Direct DB and API-based

## Quick Start

### Installation

```bash
cd services/db-service
npm install
```

### Environment Setup

Create a `.env` file or set environment variables:

```bash
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ds_builder
PORT=3000
```

### Run the Service

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start
```

The API will be available at `http://localhost:3000`

## API Documentation

Once the service is running, view the interactive API documentation:

- **Public API**: http://localhost:3000/api-docs
- **Admin API**: http://localhost:3000/admin-api-docs

## Database Management

### Migrations

```bash
# Generate migration
npm run generate

# Run migrations
npm run migrate

# Open Drizzle Studio (GUI)
npm run studio
```

### Clear Database

```bash
npm run clear-db
```

## Seeding the Database

There are **two ways** to seed the database with test data:

### Option 1: Direct Database Seeding (Faster)

Seeds the database directly using Drizzle ORM:

```bash
# From root (using setup-docker.sh)
./setup-docker.sh seed

# Or directly
cd services/db-service
ts-node src/db/seed-from-saved-state.ts
```

**Pros:**
- Fast execution
- No dependencies on running services
- Direct database access

**Use when:**
- Initial database setup
- Development environment setup
- You have direct database access

### Option 2: API-based Seeding (Validation)

Seeds the database through REST API endpoints:

```bash
# Using npm script
npm run seed-via-api

# Using shell script (recommended)
./seed-via-api.sh

# With custom API URL
./seed-via-api.sh http://localhost:4000
API_BASE_URL=http://localhost:4000 npm run seed-via-api
```

**Pros:**
- Tests API endpoints
- Full validation
- Can seed remote databases
- Demonstrates API usage

**Requires:**
- API server must be running (`npm run dev`)

**Use when:**
- Testing API endpoints
- Seeding remote databases
- Validating data integrity
- Learning API usage patterns

See [SEED_VIA_API.md](./SEED_VIA_API.md) for detailed documentation.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with auto-reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run generate` | Generate database migrations |
| `npm run migrate` | Run database migrations |
| `npm run studio` | Open Drizzle Studio GUI |
| `npm run clear-db` | Clear all database tables |
| `npm run seed-via-api` | Seed database via API |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Project Structure

```
services/db-service/
├── src/
│   ├── db/
│   │   ├── schema.ts              # Database schema definitions
│   │   ├── index.ts               # Database connection
│   │   ├── seed-from-saved-state.ts  # Direct DB seeding
│   │   ├── seed-via-api.ts        # API-based seeding
│   │   ├── all-components-data.ts # Seed data source
│   │   └── clear-database.ts      # Database cleanup
│   ├── routes/
│   │   ├── api/                   # Public API routes
│   │   │   ├── design-systems.ts
│   │   │   ├── components.ts
│   │   │   ├── variation-values.ts
│   │   │   └── themes.ts
│   │   ├── admin-api/             # Admin API routes
│   │   │   ├── components.ts
│   │   │   ├── variations.ts
│   │   │   ├── tokens.ts
│   │   │   └── props-api.ts
│   │   └── index.ts               # Route aggregation
│   ├── swagger/                   # OpenAPI specs
│   ├── validation/                # Zod validation schemas
│   └── index.ts                   # Application entry point
├── SEED_VIA_API.md               # API seeding documentation
├── seed-via-api.sh               # API seeding script
├── package.json
└── tsconfig.json
```

## API Endpoints Overview

### Public API (`/api`)

- `GET /health` - Health check
- `GET/POST/PUT/DELETE /api/design-systems` - Design system management
- `GET/POST/PUT/DELETE /api/variation-values` - Variation value management
- `GET /api/components` - Component queries
- `POST /api/components/:id/invariants` - Invariant token values
- `GET/POST/PUT/DELETE /api/themes` - Theme management

### Admin API (`/admin-api`)

- `GET/POST/PUT/DELETE /admin-api/components` - Component CRUD
- `GET/POST/PUT/DELETE /admin-api/variations` - Variation CRUD
- `GET/POST/PUT/DELETE /admin-api/tokens` - Token CRUD
- `POST /admin-api/tokens/:tokenId/variations/:variationId` - Token-variation assignment
- `GET/POST/PUT/DELETE /admin-api/props-api` - Props API CRUD

## Data Model

The service manages the following entities:

- **Design Systems** - Top-level design system containers
- **Components** - UI components (Button, Input, etc.)
- **Variations** - Component variations (size, view, etc.)
- **Tokens** - Design tokens (colors, spacing, etc.)
- **Token Values** - Specific values for tokens in variations
- **Variation Values** - Specific values for variations in design systems
- **Props API** - Component prop definitions
- **Themes** - Design system themes

## Development

### Adding New Endpoints

1. Create route handler in `src/routes/api/` or `src/routes/admin-api/`
2. Add validation schemas in `src/validation/`
3. Update OpenAPI specs in `src/swagger/`
4. Add tests in `__tests__/`
5. Register route in `src/routes/index.ts`

### Database Schema Changes

1. Modify schema in `src/db/schema.ts`
2. Generate migration: `npm run generate`
3. Review migration in `drizzle/` folder
4. Apply migration: `npm run migrate`

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED
```

**Solution**: Check that PostgreSQL is running and environment variables are correct.

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Change the `PORT` environment variable or stop the process using port 3000.

### Migration Errors

```
Error: relation "..." does not exist
```

**Solution**: Run migrations with `npm run migrate`

## Contributing

1. Write tests for new features
2. Ensure all tests pass: `npm test`
3. Update API documentation
4. Follow existing code style

## License

[Your License Here]

