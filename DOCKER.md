# Docker Setup for Design System Builder

This project includes Docker configurations for easy deployment and development.

## Quick Start

### Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Development Environment

```bash
# Start development environment with hot reloading
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

## Services

### 🗄️ PostgreSQL Database
- **Port**: 5432
- **Database**: ds_builder
- **Username**: postgres
- **Password**: postgres
- **Volume**: Persistent data storage

### 🔧 Backend API
- **Port**: 3001
- **Framework**: Node.js/Express with TypeScript
- **Health Check**: `http://localhost:3001/api/health`
- **API Documentation**: `http://localhost:3001/api-docs`
- **Features**: 
  - Database migrations and seeding
  - REST API endpoints
  - Health monitoring
  - OpenAPI/Swagger documentation

### 🎨 Frontend Application
- **Port**: 3000
- **Framework**: React with Vite
- **Features**:
  - Nginx reverse proxy
  - API proxy to backend
  - Static asset caching
  - Client-side routing support

## Available Commands

### Production Commands
```bash
# Build and start all services
docker-compose up -d

# Rebuild images
docker-compose build

# Scale services
docker-compose up -d --scale backend=2

# View service status
docker-compose ps

# View logs for specific service
docker-compose logs backend

# Execute commands in running containers
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
docker-compose exec postgres psql -U postgres -d ds_builder
```

### Development Commands
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Rebuild development images
docker-compose -f docker-compose.dev.yml build

# Follow logs for all services
docker-compose -f docker-compose.dev.yml logs -f

# Access development containers
docker-compose -f docker-compose.dev.yml exec backend sh
docker-compose -f docker-compose.dev.yml exec frontend sh
```

## Database Setup

### Initial Setup
The database requires a specific order of operations for proper setup:

```bash
# 1. First, run database migrations to create tables
docker-compose exec backend npm run migrate

# 2. Seed basic components and tokens
docker-compose exec backend npm run seed

# 3. Create design systems with variation values (uses existing tokens)
docker-compose exec backend npm run seed-all

# Or for development environment
docker-compose -f docker-compose.dev.yml exec backend npm run migrate
docker-compose -f docker-compose.dev.yml exec backend npm run seed
docker-compose -f docker-compose.dev.yml exec backend npm run seed-all
```

⚠️ **Important**: Run `npm run seed` before `npm run seed-all` to ensure tokens exist for the design system creation.

### Database Access
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d ds_builder

# Or using external tools with connection:
# Host: localhost
# Port: 5432
# Database: ds_builder
# Username: postgres
# Password: postgres
```

## Environment Variables

### Production Environment
The `docker-compose.yml` uses the following environment variables:

**Backend:**
- `NODE_ENV=production`
- `PORT=3001`
- `DB_HOST=postgres`
- `DB_PORT=5432`
- `DB_NAME=ds_builder`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DATABASE_URL=postgres://postgres:postgres@postgres:5432/ds_builder`

**Database:**
- `POSTGRES_DB=ds_builder`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`

### Development Environment
The `docker-compose.dev.yml` uses:

**Backend:**
- `NODE_ENV=development`
- `DATABASE_URL=postgres://postgres:postgres@postgres:5432/ds_builder`
- Hot reloading enabled

**Frontend:**
- `VITE_API_URL=http://localhost:3001`
- Hot reloading enabled

## Volumes and Data Persistence

### Production Volumes
- `postgres_data`: Database data persistence
- Backend application code (read-only)
- Frontend built assets (read-only)

### Development Volumes
- `postgres_data_dev`: Development database data
- `./backend:/app`: Backend source code mounting (hot reload)
- `./frontend:/app`: Frontend source code mounting (hot reload)
- Excluded `node_modules` directories for performance

## Network Configuration

All services run on a custom bridge network `ds-builder-network` for internal communication:
- Frontend → Backend: `http://backend:3001`
- Backend → Database: `postgres:5432`

## Health Checks

All services include health checks:
- **PostgreSQL**: `pg_isready` command
- **Backend**: HTTP check on `/api/health`
- **Frontend**: HTTP check on root path

## Troubleshooting

### Common Issues

1. **Port conflicts**:
   ```bash
   # Check what's using the ports
   lsof -i :3000  # Frontend
   lsof -i :3001  # Backend
   lsof -i :5432  # PostgreSQL
   ```

2. **Database connection issues**:
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U postgres -d ds_builder
   
   # View database logs
   docker-compose logs postgres
   ```

3. **Seeding issues**:
   ```bash
   # Reset database and re-seed
   docker-compose exec backend npm run migrate
   docker-compose exec backend npm run seed
   docker-compose exec backend npm run seed-all
   ```

4. **Build failures**:
   ```bash
   # Clean rebuild
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

5. **Permission issues**:
   ```bash
   # Reset permissions (if needed)
   sudo chown -R $USER:$USER .
   ```

### Useful Commands

```bash
# Remove all containers and volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# System cleanup
docker system prune -a

# View container resource usage
docker stats

# Access container shell
docker-compose exec [service_name] sh
```

## Security Considerations

### Production Recommendations
1. Change default database passwords
2. Use environment files for sensitive data
3. Enable HTTPS with reverse proxy (nginx/traefik)
4. Implement proper backup strategies
5. Use Docker secrets for sensitive information

### Development Safety
- Development environment uses default credentials
- Should not be used in production
- Database data is isolated in named volumes

## Performance Optimization

### Production Optimizations
- Multi-stage builds for smaller images
- Alpine Linux base images
- Static asset caching
- Gzip compression
- Non-root user execution

### Development Features
- Volume mounting for hot reloading
- Development dependencies included
- Source maps enabled
- Debug logging available 