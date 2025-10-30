# Backend Dockerfile for Listion
# Multi-stage build for development and production

# Base stage with common dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Development stage - uses mounted volumes from host
FROM base AS development
ENV NODE_ENV=development
EXPOSE 3000
# Note: Source code and node_modules are mounted as volumes in docker-compose.yml
# This allows for hot-reload during development
CMD ["sh", "-c", "cd /app/backend && npm run dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app

# Copy everything from the project
COPY . .

# Install dependencies from the root (workspace aware)
# Note: If this fails in your environment, run `npm install` on the host first
RUN npm install --verbose 2>&1 || (echo "Warning: npm install had issues but continuing..." && true)

# Build the backend
WORKDIR /app/backend
RUN npm run build --verbose || node ../node_modules/typescript/lib/tsc.js -p tsconfig.build.json || npx --yes typescript@latest tsc -p tsconfig.build.json

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install production dependencies
RUN npm install --omit=dev --verbose 2>&1 || (echo "Warning: npm install had issues but continuing..." && true)

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/

WORKDIR /app/backend
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
