# Frontend Dockerfile for Listion
# Multi-stage build for development and production

# Base stage with common dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Development stage - uses mounted volumes from host
FROM base AS development
ENV NODE_ENV=development
EXPOSE 5173
# Note: Source code and node_modules are mounted as volumes in docker-compose.yml
# This allows for hot-reload during development
CMD ["sh", "-c", "cd /app/frontend && npm run dev -- --host 0.0.0.0"]

# Builder stage for production
FROM base AS builder
WORKDIR /app

# Copy everything from the project
COPY . .

# Install dependencies from the root (workspace aware)
# Note: If this fails in your environment, run `npm install` on the host first
RUN npm install --verbose 2>&1 || (echo "Warning: npm install had issues but continuing..." && true)

# Build the frontend
WORKDIR /app/frontend
RUN npm run build --verbose

# Production stage with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
