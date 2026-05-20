# Multi-stage build for FEED application
# Supports AMD64 (Mac/x86) and ARM64 (Raspberry Pi 5)

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/packages/frontend

# Build-time API base URL for Vite
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Copy package files first (better caching)
COPY packages/frontend/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy frontend source
COPY packages/frontend ./

# Build frontend
RUN npm run build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Builder PDF export uses Puppeteer at runtime with Alpine's Chromium package.
# Avoid downloading Puppeteer's bundled Chromium during npm install.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files first (better caching)
WORKDIR /app/packages/backend
COPY packages/backend/package*.json ./

# Copy prisma schema for generation (needed for postinstall/generate)
COPY packages/backend/prisma ./prisma

# Install dependencies (includes dev deps needed to build)
RUN npm ci --legacy-peer-deps

# Generate Prisma Client with ARM64 support
RUN npx prisma generate

# Copy backend source
COPY packages/backend ./

# Build backend TypeScript
RUN npm run build

# ============================================
# Stage 3: Frontend Runtime (Nginx)
# ============================================
FROM nginx:alpine AS frontend

# Copy built frontend from builder
COPY --from=frontend-builder /app/packages/frontend/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# ============================================
# Stage 4: Backend Runtime
# ============================================
FROM node:20-alpine AS backend

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Pin Prisma CLI in runtime so `migrate deploy` doesn't pull latest via npx.
ARG PRISMA_CLI_VERSION=6.12.0

# Install runtime dependencies only
RUN apk add --no-cache sqlite chromium nss freetype harfbuzz ca-certificates

# Copy package files
COPY packages/backend/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps

# Install Prisma CLI (runtime migrations)
RUN npm install --no-save prisma@${PRISMA_CLI_VERSION} --legacy-peer-deps

# Copy built backend from builder
COPY --from=backend-builder /app/packages/backend/dist ./dist
COPY --from=backend-builder /app/packages/backend/assets ./assets
COPY --from=backend-builder /app/packages/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/packages/backend/node_modules/@prisma ./node_modules/@prisma

# Copy prisma directory for migrations
COPY packages/backend/prisma ./prisma

# Create directory for SQLite database
RUN mkdir -p /app/data

# Create directory for storage
RUN mkdir -p /app/storage

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3001/health || exit 1

EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
