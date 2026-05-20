# Docker Deployment Guide - FEED Application

Deploy from Mac to Raspberry Pi 5 using multi-architecture Docker images.

## Prerequisites

**On Mac:**
- Docker Desktop installed
- Docker Buildx enabled (included in Docker Desktop)
- Docker Hub or GitHub Container Registry account

**On Raspberry Pi 5:**
- Raspberry Pi OS 64-bit (Bookworm recommended)
- Docker and Docker Compose installed
- Cloudflare account configured

## Quick Start

### 1. Setup Multi-Architecture Builder (Mac - One Time)

```bash
# Create and use buildx builder
docker buildx create --name multiarch --driver docker-container --use
docker buildx inspect --bootstrap
```

### 2. Configure Environment Variables

**Mac (for build):**
```bash
cd /Users/russbook/wth_app_clean
cp packages/backend/.env.docker.example packages/backend/.env
```

Edit `packages/backend/.env` with production values.
Set the frontend API base URL at build time (recommended: empty for same-origin):
```bash
export VITE_API_BASE_URL=""
```
If you prefer an explicit value, use `export VITE_API_BASE_URL="https://feed.williamtemple.app"`.

### 3. Build Multi-Architecture Images (Mac)

```bash
cd /Users/russbook/wth_app_clean

# Option A: Build and push to registry (recommended)
export DOCKER_REGISTRY="yourusername"  # Docker Hub username (not email) or ghcr.io/username
export VERSION="0.14.9"

./docker-build.sh

# Or, run the equivalent buildx commands manually:
docker buildx build --platform linux/amd64,linux/arm64 \
  --target backend \
  -t ${DOCKER_REGISTRY}/feed-backend:${VERSION} \
  -t ${DOCKER_REGISTRY}/feed-backend:latest \
  --push .

docker buildx build --platform linux/amd64,linux/arm64 \
  --target frontend \
  --build-arg VITE_API_BASE_URL=${VITE_API_BASE_URL} \
  -t ${DOCKER_REGISTRY}/feed-frontend:${VERSION} \
  -t ${DOCKER_REGISTRY}/feed-frontend:latest \
  --push .

# Option B: Build locally for testing (single-arch)
docker buildx build --target backend -t feed/backend:latest --load .
docker buildx build --target frontend -t feed/frontend:latest --load .
```

### 4. Deploy to Raspberry Pi

**Transfer files to Pi:**
```bash
# From Mac
scp docker-compose.yml pi@feed-pi.local:~/feed/
scp -r docker pi@feed-pi.local:~/feed/
scp -r packages/backend/.env pi@feed-pi.local:~/feed/packages/backend/.env
```

**On Raspberry Pi:**
```bash
# SSH into Pi
ssh pi@feed-pi.local

# Navigate to deployment directory
cd ~/feed

# Create required directories
mkdir -p data/backend data/storage logs/backend

# Set environment variables
export DOCKER_REGISTRY="yourusername"
export VERSION="0.14.9"
export CLOUDFLARE_TUNNEL_TOKEN="your-tunnel-token"

# Pull and start services
docker compose pull
docker compose up -d

# Verify services
docker compose ps
docker compose logs -f
```

### 5. Setup Cloudflare Tunnel

This Docker setup serves the frontend via Nginx and proxies `/api/*` to the backend (see `docker/nginx.conf`), so you only need **one** public hostname: `feed.williamtemple.app` → `http://frontend:80`.

**Get tunnel token:**
```bash
# On Pi
cloudflared tunnel create feed-tunnel

# Get token
cloudflared tunnel token feed-tunnel
# Copy the token for docker-compose
```

**Or use config file method:**
Create `docker/cloudflared/config.yml`:
```yaml
tunnel: YOUR-TUNNEL-UUID
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: feed.williamtemple.app
    service: http://frontend:80
  - service: http_status:404
```

Update docker-compose.yml to mount config:
```yaml
cloudflared:
  volumes:
    - ./docker/cloudflared:/etc/cloudflared
```

### 6. Configure DNS

```bash
# Route domain to tunnel
cloudflared tunnel route dns feed-tunnel feed.williamtemple.app
```

## Testing Locally (Mac)

Test before deploying to Pi:

```bash
# Optional: local overrides to fix cookies on localhost
cat > /Users/russbook/wth_app_clean/packages/backend/.env.local <<'EOF'
APP_URL="http://localhost:5173"
COOKIE_DOMAIN=""
EOF

# Build + start backend + frontend (skip Cloudflare tunnel locally)
docker compose -f /Users/russbook/wth_app_clean/docker-compose.yml \
  -f /Users/russbook/wth_app_clean/docker-compose.local.yml \
  up -d --build backend frontend

# Check health
curl http://localhost:3001/health
curl http://localhost:5173

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Database Seeding (Optional)

Run the seed script in a one-off container. This uses the backend builder stage
so TypeScript tooling is available without bloating the runtime image.

**Mac (local overrides):**
```bash
docker compose -f /Users/russbook/wth_app_clean/docker-compose.yml \
  -f /Users/russbook/wth_app_clean/docker-compose.local.yml \
  --profile seed run --rm seed
```

**Raspberry Pi (production):**
```bash
docker compose --profile seed run --rm seed
```

## Common Commands

**Build & Deploy:**
```bash
# Build multi-arch and push
docker buildx build --platform linux/amd64,linux/arm64 \
  --target backend -t ${DOCKER_REGISTRY}/feed-backend:${VERSION} --push .

# Pull on Pi
docker compose pull
docker compose up -d
```

**Manage Services:**
```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart backend

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f cloudflared

# Execute commands in container
docker compose exec backend sh
docker compose exec backend ./node_modules/.bin/prisma studio
```

**Database Operations:**
```bash
# Run migrations
docker compose exec backend ./node_modules/.bin/prisma migrate deploy

# Open Prisma Studio
docker compose exec backend ./node_modules/.bin/prisma studio

# Backup database
docker compose exec backend sqlite3 /app/data/production.db ".backup /app/data/backup.db"

# Copy backup to host
docker compose cp backend:/app/data/backup.db ./backups/
```

Note: Recent releases add AI Configuration token limit fields (`inputTokenLimit`, `outputTokenLimit`). After updating images, run migrations and verify these columns exist before testing the AI Configuration modal.

**Monitor Resources:**
```bash
# Container stats
docker stats

# Disk usage
docker system df

# Cleanup
docker system prune -a
```

## Updating Application

**From Mac:**
```bash
# Make code changes
git commit -am "Update feature"

# Build new version
export VERSION="0.14.9"
docker buildx build --platform linux/amd64,linux/arm64 \
  --target backend -t ${DOCKER_REGISTRY}/feed-backend:${VERSION} --push .
docker buildx build --platform linux/amd64,linux/arm64 \
  --target frontend -t ${DOCKER_REGISTRY}/feed-frontend:${VERSION} --push .
```

**On Pi:**
```bash
export VERSION="0.14.9"
docker compose pull
docker compose up -d
```

## Rollback

```bash
# On Pi
export VERSION="0.14.8"  # Previous version
docker compose pull
docker compose up -d
```

## Backup Strategy

**Automated daily backup (add to Pi crontab):**
```bash
# Create backup script
cat > ~/feed/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups/feed
mkdir -p $BACKUP_DIR

# Backup database
docker compose -f ~/feed/docker-compose.yml exec -T backend \
  sqlite3 /app/data/production.db ".backup /app/data/backup_${DATE}.db"

# Copy to host
docker compose -f ~/feed/docker-compose.yml cp \
  backend:/app/data/backup_${DATE}.db ${BACKUP_DIR}/

# Compress
gzip ${BACKUP_DIR}/backup_${DATE}.db

# Keep last 7 days
find $BACKUP_DIR -name "backup_*.db.gz" -mtime +7 -delete

echo "Backup completed: backup_${DATE}.db.gz"
EOF

chmod +x ~/feed/backup.sh

# Add to crontab (2 AM daily)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/feed/backup.sh >> ~/logs/feed/backup.log 2>&1") | crontab -
```

## Troubleshooting

**Images won't build:**
```bash
# Clear buildx cache
docker buildx prune -af

# Rebuild without cache
docker buildx build --no-cache --platform linux/arm64 --target backend -t feed/backend:latest --load .
```

**Container won't start:**
```bash
# Check logs
docker compose logs backend

# Check environment
docker compose exec backend env

# Shell into container
docker compose exec backend sh
```

**Database locked:**
```bash
# Restart backend
docker compose restart backend

# Check database
docker compose exec backend sqlite3 /app/data/production.db "PRAGMA integrity_check;"
```

**High memory usage:**
```bash
# Set memory limits in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

**Cloudflare tunnel disconnected:**
```bash
# Check cloudflared logs
docker compose logs cloudflared

# Restart tunnel
docker compose restart cloudflared
```

## Architecture Notes

**Why multi-stage build:**
- Separate build and runtime environments
- Smaller final images (no build tools in production)
- Better caching layers
- Single Dockerfile for entire stack

**Why buildx:**
- Build ARM64 images on Mac (AMD64)
- Push multi-architecture manifests
- Pi automatically pulls correct architecture

**Volume mounts:**
- `./data/backend` → SQLite database (persistent)
- `./data/storage` → Uploaded files/translations (persistent)
- `./logs` → Application logs (optional)

**Health checks:**
- Backend: `/health` endpoint
- Frontend: Nginx health endpoint
- Cloudflared: Depends on backend/frontend health

## Performance Tips

**On Raspberry Pi 5:**

1. **Use overlay2 storage driver** (default in modern Docker)
2. **Limit container memory** if experiencing OOM
3. **Use volumes not bind mounts** for better I/O
4. **Enable swap** if needed:
```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile  # Set CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

## Security Checklist

- [ ] Environment files have sensitive data removed from repo
- [ ] JWT secret is strong and unique
- [ ] Database files have proper permissions
- [ ] Cloudflare Tunnel token is secure
- [ ] Container user is non-root (TODO: add to Dockerfile)
- [ ] Rate limiting configured in backend
- [ ] HTTPS enforced via Cloudflare
- [ ] Regular backups scheduled
- [ ] Log rotation configured

## Next Steps

1. **Add container user** (run as non-root)
2. **Configure log rotation** for container logs
3. **Set up monitoring** (Prometheus + Grafana)
4. **Add health check dashboard**
5. **Configure alerts** for container failures
6. **Document disaster recovery**

## Support

**Issues:**
- Check logs first: `docker compose logs -f`
- Verify environment: `docker compose config`
- Test connectivity: `docker compose exec backend wget -O- http://frontend/`

**Useful commands:**
```bash
# Full system check
docker compose ps
docker compose logs --tail=100
docker stats
df -h
free -h
```
