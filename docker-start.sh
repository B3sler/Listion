#!/bin/bash
# Quick Start Script for Listion Docker Setup

set -euo pipefail

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Allow specifying compose file via argument
COMPOSE_FILE="${1:-docker-compose.yml}"

echo "Starting Listion with Docker..."
echo "Using compose file: ${COMPOSE_FILE}"
echo ""

docker compose -f "${COMPOSE_FILE}" up -d

echo ""
echo "Listion is starting!"
echo ""
echo "Access the application:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:3000/api"
echo "  Swagger:   http://localhost:3000/api/docs"
echo ""
echo "View logs: docker compose -f ${COMPOSE_FILE} logs -f"
echo "Stop services: docker compose -f ${COMPOSE_FILE} down"
