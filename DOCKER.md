# Docker Setup for Listion

This guide explains how to run Listion using Docker and Docker Compose. Both frontend and backend run in separate containers with PostgreSQL as the database.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 2GB of free disk space

## Quick Start

### Easiest Way: Use the Quick Start Script

```bash
./docker-start.sh
```

That's it! The script automatically:
1. Creates `.env` file with default values if missing
2. Installs npm dependencies if needed
3. Starts all Docker services

### Manual Setup

If you prefer manual control:

```bash
# 1. Install dependencies (required for development hot-reload)
npm install

# 2. Start all services
docker compose up -d

# View logs
docker compose logs -f
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Swagger UI**: http://localhost:3000/api/docs
- **Database**: localhost:5432 (user: `listion_user`, password: `changeme`, db: `listion`)

### Stop the Application

```bash
# Stop all services
docker compose down

# Stop and remove all data (including database)
docker compose down -v
```

## Customizing Configuration

By default, services use these values:
- Database: `listion` / User: `listion_user` / Password: `changeme`
- JWT Secret: `supersecret_change_in_production`

To customize, create a `.env` file:

```bash
cp .env.example .env
# Edit .env with your preferred values
```

**For production**, change at least:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`

## Development Mode

In development mode, the containers mount your local source code and node_modules as volumes, enabling hot-reload for both frontend and backend.

```bash
# Quick start
./docker-start.sh

# Or manual
npm install
docker compose up -d
```

Changes to files in `./frontend` and `./backend` are automatically detected and the services reload.

### Adding New Packages

```bash
# Add package on host
npm install <package-name>

# Restart containers (uses mounted node_modules)
docker compose restart
```

### Access Container Shells

```bash
# Backend shell
docker compose exec backend sh

# Frontend shell
docker compose exec frontend sh

# Database shell
docker compose exec postgres psql -U listion_user -d listion
```

## Production Mode

Production mode builds optimized images with all dependencies bundled:
- Frontend: Static files served by nginx
- Backend: Compiled JavaScript (no TypeScript compilation at runtime)

**Note**: Production builds require dependencies to be properly installed during the build process. If you encounter npm errors during build, you can:
1. Pre-build on your host: `npm install && npm run --workspace backend build && npm run --workspace frontend build`
2. Copy the built files into the production containers

### Build and Run Production Images

```bash
# Option 1: Build production images (may have npm issues in some environments)
docker compose -f docker-compose.prod.yml build

# Option 2: Build on host first (recommended if build fails)
npm install
npm run --workspace backend build
npm run --workspace frontend build
# Then the Docker build will use these pre-built files

# Start production services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

The application will be available at:
- **Frontend**: http://localhost:80 (nginx)
- **Backend API**: http://localhost:3000/api (via nginx proxy)
- **Swagger UI**: http://localhost:3000/api/docs

### Stop Production Environment

```bash
docker compose -f docker-compose.prod.yml down
```

## Known Issues and Workarounds

### npm Install Issues in Alpine Linux

Some environments may experience issues with npm install inside Alpine Linux containers. Symptoms include:
- "Exit handler never called" errors
- Missing `.bin` symlinks in node_modules
- Packages installed but binaries not accessible

**Workarounds**:

1. **For Development** (Recommended): Install dependencies on your host machine before running Docker:
   ```bash
   npm install
   docker compose up
   ```
   This uses mounted volumes, so the host's node_modules is used directly.

2. **For Production Builds**: If builds fail, pre-build on the host:
   ```bash
   npm install
   npm run build  # Builds both workspaces
   ```
   Then create a simpler Dockerfile that just copies the dist folders.

3. **Alternative**: Use a different base image (e.g., `node:20` instead of `node:20-alpine`) in Dockerfiles, though this increases image size.

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
