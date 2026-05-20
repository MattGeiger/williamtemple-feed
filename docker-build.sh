#!/bin/bash
# FEED Docker Multi-Architecture Build & Push Script

set -e  # Exit on error

# Configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-yourusername}"  # Change this!
VERSION="${VERSION:-latest}"
PLATFORMS="linux/amd64,linux/arm64"
# Recommended: leave empty to use same-origin (Nginx proxies `/api/*` → backend).
VITE_API_BASE_URL="${VITE_API_BASE_URL-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}FEED Multi-Arch Docker Build${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Verify registry is set
if [ "$DOCKER_REGISTRY" = "yourusername" ]; then
    echo -e "${RED}ERROR: Please set DOCKER_REGISTRY environment variable${NC}"
    echo "Example: export DOCKER_REGISTRY=mydockerhubusername  (not your email)"
    exit 1
fi

echo -e "${YELLOW}Registry:${NC} $DOCKER_REGISTRY"
echo -e "${YELLOW}Version:${NC} $VERSION"
echo -e "${YELLOW}Platforms:${NC} $PLATFORMS"
echo -e "${YELLOW}VITE_API_BASE_URL:${NC} $VITE_API_BASE_URL"
echo ""

# Create builder if doesn't exist
echo -e "${GREEN}Setting up buildx builder...${NC}"
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
    docker buildx create --name multiarch --driver docker-container --use
fi
docker buildx use multiarch
docker buildx inspect --bootstrap

# Build and push backend
echo ""
echo -e "${GREEN}Building backend for $PLATFORMS...${NC}"
docker buildx build \
    --platform $PLATFORMS \
    --target backend \
    -t ${DOCKER_REGISTRY}/feed-backend:${VERSION} \
    -t ${DOCKER_REGISTRY}/feed-backend:latest \
    --push \
    .

# Build and push frontend
echo ""
echo -e "${GREEN}Building frontend for $PLATFORMS...${NC}"
docker buildx build \
    --platform $PLATFORMS \
    --target frontend \
    --build-arg VITE_API_BASE_URL=$VITE_API_BASE_URL \
    -t ${DOCKER_REGISTRY}/feed-frontend:${VERSION} \
    -t ${DOCKER_REGISTRY}/feed-frontend:latest \
    --push \
    .

echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Build Complete!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Images pushed to:"
echo "  - ${DOCKER_REGISTRY}/feed-backend:${VERSION}"
echo "  - ${DOCKER_REGISTRY}/feed-frontend:${VERSION}"
echo ""
echo "To deploy on Raspberry Pi:"
echo "  export DOCKER_REGISTRY=${DOCKER_REGISTRY}"
echo "  export VERSION=${VERSION}"
echo "  docker compose pull"
echo "  docker compose up -d"
echo ""
