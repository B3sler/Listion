# Frontend Dockerfile for Listion
# Multi-stage build for development and production

# Base stage with common dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Development stage
FROM base AS development
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm install
ENV NODE_ENV=development
EXPOSE 5173
CMD ["sh", "-c", "cd /app/frontend && npm run dev -- --host 0.0.0.0"]

# Builder stage for production
FROM base AS builder
WORKDIR /app

# Copy everything from the project
COPY . .

# Install dependencies from the root (workspace aware)
RUN npm install

# Build the frontend
WORKDIR /app/frontend
RUN npm run build --verbose

# Production stage with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
