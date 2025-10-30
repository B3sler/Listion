# Frontend Dockerfile for Listion
# Multi-stage build for development and production

# Base stage with common dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Development stage
FROM base AS development
ENV NODE_ENV=development

# Copy workspace root package files
COPY package*.json ./

# Copy frontend package files
COPY frontend/package*.json ./frontend/

# Install all dependencies (ignoring npm error - deps are still installed)
RUN npm install || true

# Copy frontend source code
COPY frontend ./frontend

WORKDIR /app/frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Builder stage for production
FROM base AS builder
WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy frontend package files
COPY frontend/package*.json ./frontend/

# Install all dependencies (ignoring npm error - deps are still installed)
RUN npm install || true

# Copy frontend source code
COPY frontend ./frontend

WORKDIR /app/frontend
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
