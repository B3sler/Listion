#!/bin/bash
# Quick Start Script for Listion Docker Setup

set -euo pipefail

echo "🐳 Listion Docker Quick Start"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and set your database password and JWT secret!"
    echo "    Then run this script again."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies with npm..."
    # Check for package-lock.json to confirm npm is used
    if [ ! -f "package-lock.json" ]; then
        echo "⚠️  Warning: package-lock.json not found. Using npm anyway..."
    fi
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Allow specifying compose file via environment variable or argument
COMPOSE_FILE="${1:-docker-compose.yml}"

echo ""
echo "🚀 Starting Listion with Docker..."
echo "Using compose file: ${COMPOSE_FILE}"
echo ""
echo "This will start:"
echo "  - PostgreSQL database on port 5432"
echo "  - Backend API on port 3000"
echo "  - Frontend on port 5173"
echo ""

docker compose -f "${COMPOSE_FILE}" up -d

echo ""
echo "✅ Listion is starting!"
echo ""
echo "Access the application:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:3000/api"
echo "  Swagger:   http://localhost:3000/api/docs"
echo ""
echo "View logs: docker compose -f ${COMPOSE_FILE} logs -f"
echo "Stop services: docker compose -f ${COMPOSE_FILE} down"
echo ""
