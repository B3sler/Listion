#!/bin/bash
# Quick Start Script for Listion Docker Setup

set -e

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
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo ""
echo "🚀 Starting Listion with Docker..."
echo ""
echo "This will start:"
echo "  - PostgreSQL database on port 5432"
echo "  - Backend API on port 3000"
echo "  - Frontend on port 5173"
echo ""

docker compose up -d

echo ""
echo "✅ Listion is starting!"
echo ""
echo "Access the application:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:3000/api"
echo "  Swagger:   http://localhost:3000/api/docs"
echo ""
echo "View logs: docker compose logs -f"
echo "Stop services: docker compose down"
echo ""
