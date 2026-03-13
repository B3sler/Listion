# Backend Dockerfile for Listion
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
EXPOSE 3000
CMD ["sh", "-c", "cd /app/backend && npx ts-node-dev --poll --respawn --transpile-only src/main.ts"]

# Builder stage for production
FROM base AS builder
WORKDIR /app

# Copy everything from the project
COPY . .

# Install dependencies from the root (workspace aware)
RUN npm install

# Build the backend
WORKDIR /app/backend
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/

WORKDIR /app/backend
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
