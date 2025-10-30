# Docker Setup for Listion

This guide explains how to run Listion using Docker and Docker Compose. Both frontend and backend run in separate containers with PostgreSQL as the database.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 2GB of free disk space

## Quick Start

### 1. Setup Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` and set your values (especially `POSTGRES_PASSWORD` and `JWT_SECRET` for production).

### 2. Start the Application (Development)

```bash
# Start all services (postgres, backend, frontend)
docker-compose up

# Or run in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Swagger UI**: http://localhost:3000/api/docs
- **Database**: localhost:5432

### 3. Stop the Application

```bash
# Stop all services
docker-compose down

# Stop and remove all data (including database)
docker-compose down -v
```

## Development Mode

In development mode, the containers mount your local source code as volumes, enabling hot-reload for both frontend and backend.

### Start Development Environment

```bash
docker-compose up
```

Changes you make to files in `./frontend` and `./backend` will be automatically detected and the services will reload.

### Rebuild After Dependency Changes

If you add new npm packages, rebuild the containers:

```bash
# Rebuild specific service
docker-compose build backend
docker-compose build frontend

# Or rebuild all services
docker-compose build

# Then restart
docker-compose up
```

### Access Container Shells

```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell
docker-compose exec frontend sh

# Database shell
docker-compose exec postgres psql -U listion_user -d listion
```

## Production Mode

Production mode builds optimized images:
- Frontend: Static files served by nginx
- Backend: Compiled JavaScript (no TypeScript compilation at runtime)

### Build and Run Production Images

```bash
# Set production environment
export BUILD_TARGET=production
export NODE_ENV=production

# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

The application will be available at:
- **Frontend**: http://localhost:80 (nginx)
- **Backend API**: http://localhost:3000/api (via nginx proxy)
- **Swagger UI**: http://localhost:3000/api/docs

### Stop Production Environment

```bash
docker-compose -f docker-compose.prod.yml down
```

## Docker Services Overview

### PostgreSQL (postgres)
- **Image**: postgres:15
- **Port**: 5432
- **Data**: Persisted in `postgres_data` volume
- **Health Check**: Monitors database availability

### Backend (backend)
- **Base**: Node.js 20 Alpine
- **Port**: 3000
- **Development**: Hot-reload with ts-node-dev
- **Production**: Compiled JavaScript with node
- **Health Check**: HTTP check on /api endpoint

### Frontend (frontend)
- **Base**: Node.js 20 Alpine (dev) / nginx Alpine (prod)
- **Port**: 5173 (dev) / 80 (prod)
- **Development**: Vite dev server with hot-reload
- **Production**: Static files served by nginx with API proxy

## Environment Variables

All environment variables are documented in `.env.example`. Key variables:

### Database
- `POSTGRES_DB`: Database name
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password (CHANGE IN PRODUCTION!)

### Backend
- `PORT`: Backend port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `DB_HOST`: Database host (use "postgres" for Docker)
- `JWT_SECRET`: Secret key for JWT tokens (CHANGE IN PRODUCTION!)

### Docker
- `BUILD_TARGET`: Build target (development/production)
- `BACKEND_PORT`: Backend host port mapping
- `FRONTEND_PORT`: Frontend host port mapping

### Frontend (Production)
- `VITE_API_BASE_URL`: API base URL for frontend

## Common Tasks

### View Running Containers

```bash
docker-compose ps
```

### Check Service Health

```bash
# Check all services
docker-compose ps

# Check specific service logs
docker-compose logs backend
```

### Reset Database

```bash
# Stop services and remove volumes
docker-compose down -v

# Start fresh
docker-compose up
```

### Update Dependencies

```bash
# On host machine
npm install <package>

# Rebuild container
docker-compose build backend
# or
docker-compose build frontend

# Restart
docker-compose up
```

### Run Tests in Containers

```bash
# Backend tests
docker-compose exec backend npm test

# Frontend tests
docker-compose exec frontend npm test
```

### Run Database Migrations

```bash
docker-compose exec backend npm run migration:run
# (if you add migration scripts later)
```

## Network Architecture

All services run in a shared Docker network (`listion-network`):

```
┌─────────────────────────────────────────┐
│           listion-network               │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │Frontend  │→ │ Backend  │→ │Postgres││
│  │  :5173   │  │  :3000   │  │ :5432  ││
│  └──────────┘  └──────────┘  └────────┘│
│                                         │
└─────────────────────────────────────────┘
        ↓           ↓
    localhost:5173  localhost:3000
```

- Services communicate using service names (e.g., `http://backend:3000`)
- Host machine accesses via localhost and port mappings

## Troubleshooting

### Port Already in Use

If ports 3000, 5173, or 5432 are already in use:

```bash
# Check what's using the port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Option 1: Stop the other service
# Option 2: Change port in .env
BACKEND_PORT=3001
FRONTEND_PORT=5174
DATABASE_PORT=5433
```

### Container Fails to Start

```bash
# Check logs
docker-compose logs backend

# Rebuild container
docker-compose build backend
docker-compose up backend

# Check if database is ready
docker-compose logs postgres
```

### Database Connection Issues

```bash
# Verify postgres is healthy
docker-compose ps

# Check backend environment variables
docker-compose exec backend env | grep DB_

# Test database connection
docker-compose exec postgres psql -U listion_user -d listion -c "SELECT 1;"
```

### Hot Reload Not Working

Development mode mounts local directories. Ensure:
1. Docker has file system access to your project directory
2. You're running `docker-compose up` (not prod compose file)
3. No permission issues on mounted volumes

```bash
# Restart with clean build
docker-compose down
docker-compose build
docker-compose up
```

### Out of Disk Space

```bash
# Clean up unused Docker resources
docker system prune

# Remove specific volumes
docker-compose down -v

# Remove unused images
docker image prune -a
```

## Performance Tips

### Development
- Use Docker Desktop with sufficient resources (4GB RAM minimum)
- Enable file sharing only for necessary directories
- Use volume mounts for source code (already configured)

### Production
- Use multi-stage builds (already configured)
- Minimize image layers
- Use .dockerignore to exclude unnecessary files (already configured)
- Set resource limits if needed

## Security Best Practices

1. **Change default secrets**: Update `JWT_SECRET` and `POSTGRES_PASSWORD` in `.env`
2. **Don't commit .env**: Already in .gitignore
3. **Use environment-specific configs**: Separate dev and prod compose files
4. **Regular updates**: Keep base images updated (`docker-compose pull`)
5. **Scan for vulnerabilities**: `docker scan listion-backend`

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

## Support

For issues specific to Docker setup, please check:
1. This documentation
2. Existing GitHub issues
3. Create a new issue with `docker` label
