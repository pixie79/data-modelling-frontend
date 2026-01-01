# Docker Setup Guide

This guide explains how to run the Data Modelling application using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git (to clone the repository)

## Quick Start

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd dm
   ```

2. **Set up environment variables** (optional):
   ```bash
   # Copy the example override file
   cp docker-compose.override.yml.example docker-compose.override.yml
   
   # Edit docker-compose.override.yml with your GitHub OAuth credentials
   # GITHUB_CLIENT_ID=your_client_id
   # GITHUB_CLIENT_SECRET=your_client_secret
   # JWT_SECRET=your-secure-secret
   ```

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Check service status**:
   ```bash
   docker-compose ps
   ```

5. **View logs**:
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f api
   docker-compose logs -f frontend
   docker-compose logs -f postgres
   ```

6. **Access the application**:
   - Frontend: http://localhost:5173
   - API: http://localhost:8081
   - PostgreSQL: localhost:5432

## Services

### PostgreSQL Database
- **Port**: 5432
- **Database**: data_modelling
- **User**: data_modelling
- **Password**: data_modelling_password
- **Volume**: `postgres_data` (persists data)

### API Service
- **Port**: 8081
- **Image**: Built from `Dockerfile.api` (installs from crates.io)
- **Health Check**: `/api/v1/health`
- **Dependencies**: PostgreSQL (waits for healthy status)

### Frontend Service
- **Port**: 5173 (mapped to container port 80)
- **Image**: Built from `frontend/Dockerfile`
- **Dependencies**: API (waits for healthy status)

## Environment Variables

### API Service
- `DATABASE_URL`: PostgreSQL connection string (auto-configured)
- `RUST_LOG`: Log level (default: `info`)
- `API_HOST`: API host (default: `0.0.0.0`)
- `API_PORT`: API port (default: `8081`)
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID (required for authentication)
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret (required for authentication)
- `JWT_SECRET`: JWT signing secret (change in production!)

### Frontend Service
- `VITE_API_BASE_URL`: API base URL (default: `http://localhost:8081`)
- `VITE_WS_BASE_URL`: WebSocket base URL (default: `ws://localhost:8081`)

### PostgreSQL Service
- `POSTGRES_USER`: Database user (default: `data_modelling`)
- `POSTGRES_PASSWORD`: Database password (default: `data_modelling_password`)
- `POSTGRES_DB`: Database name (default: `data_modelling`)

## Building Images

### Build all services:
```bash
docker-compose build
```

### Build specific service:
```bash
docker-compose build api
docker-compose build frontend
```

### Rebuild without cache:
```bash
docker-compose build --no-cache
```

## Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes database data)
docker-compose down -v
```

## Database Management

### Access PostgreSQL:
```bash
# Using docker exec
docker-compose exec postgres psql -U data_modelling -d data_modelling

# Or connect from host
psql -h localhost -p 5432 -U data_modelling -d data_modelling
```

### Backup database:
```bash
docker-compose exec postgres pg_dump -U data_modelling data_modelling > backup.sql
```

### Restore database:
```bash
docker-compose exec -T postgres psql -U data_modelling data_modelling < backup.sql
```

## Development Mode

For development with hot reload, you can override the frontend service:

1. Create `docker-compose.override.yml`:
   ```yaml
   version: '3.8'
   services:
     frontend:
       volumes:
         - ./frontend/src:/app/src:ro
       command: npm run dev
   ```

2. Run in development mode:
   ```bash
   docker-compose up frontend
   ```

**Note**: For full hot reload, it's recommended to run the frontend locally with `npm run dev` and only use Docker for the API and PostgreSQL.

## Troubleshooting

### Services won't start
- Check logs: `docker-compose logs`
- Verify ports aren't in use: `lsof -i :5173 -i :8081 -i :5432`
- Check Docker resources: `docker system df`

### API health check fails
- Wait longer (API may need time to compile on first run)
- Check API logs: `docker-compose logs api`
- Verify PostgreSQL is healthy: `docker-compose ps postgres`

### Frontend can't connect to API
- Verify `VITE_API_BASE_URL` is correct
- Check API is running: `curl http://localhost:8081/api/v1/health`
- Check network: `docker-compose network ls`

### Database connection errors
- Verify PostgreSQL is healthy: `docker-compose ps postgres`
- Check connection string in API logs
- Verify database credentials match

## Production Considerations

⚠️ **This setup is for development only!** For production:

1. **Change default passwords** in `docker-compose.yml`
2. **Use secrets management** (Docker secrets, Kubernetes secrets, etc.)
3. **Enable SSL/TLS** for API and frontend
4. **Use a reverse proxy** (nginx, Traefik) in front of services
5. **Set up proper backups** for PostgreSQL
6. **Configure resource limits** for containers
7. **Use environment-specific configs** (don't commit secrets)
8. **Enable monitoring and logging** (Prometheus, Grafana, ELK)

## Cleanup

```bash
# Remove all containers, networks, and volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Full cleanup (removes everything)
docker system prune -a --volumes
```

