#!/bin/bash
# Deployment script for Zoekt + MCP
# This script sets up the code search infrastructure with daily index updates
#
# Required environment variables:
#   GITHUB_ORG - GitHub organization to index
#
# Usage: GITHUB_ORG=my-org ./deploy.sh

set -e

if [ -z "$GITHUB_ORG" ]; then
    echo "ERROR: GITHUB_ORG environment variable is required"
    echo "Usage: GITHUB_ORG=my-org ./deploy.sh"
    exit 1
fi

export GITHUB_ORG

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Zoekt Code Search Deployment ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "ERROR: Docker Compose V2 is not installed"
    exit 1
fi

# Check for GitHub token
if [ ! -f "config/github-token.txt" ]; then
    echo "ERROR: GitHub token not found at config/github-token.txt"
    echo "Create one with 'repo' scope at https://github.com/settings/tokens"
    echo "Then run: echo 'ghp_your_token' > config/github-token.txt"
    exit 1
fi

echo "Prerequisites OK"
echo ""

# Build the Zoekt image
echo "Building Zoekt image..."
docker build -t zoekt:local -f Dockerfile.zoekt .

# Build the MCP server image
echo "Building MCP server image..."
cd ../zoekt-mcp
npm ci
npm run build
cd "$SCRIPT_DIR"
docker build -t zoekt-mcp:local -f ../zoekt-mcp/Dockerfile ../zoekt-mcp

echo ""
echo "Starting services..."

# Stop any existing containers
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Start the webserver (it will wait for data)
docker compose -f docker-compose.prod.yml up -d zoekt-webserver

# Run initial mirror and index
echo ""
echo "Running initial repository mirror and index..."
echo "This may take several minutes depending on repository count and size..."
docker compose -f docker-compose.prod.yml --profile mirror run --rm zoekt-mirror
docker compose -f docker-compose.prod.yml --profile index run --rm zoekt-indexer

# Start the scheduler for daily updates
echo ""
echo "Starting scheduler for daily index updates..."
docker compose -f docker-compose.prod.yml up -d zoekt-scheduler

# Start the MCP server
echo ""
echo "Starting MCP server..."
docker compose -f docker-compose.prod.yml up -d zoekt-mcp

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Services running:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Endpoints:"
echo "  Zoekt Web UI:    http://$(hostname -I | awk '{print $1}'):6070"
echo "  Zoekt API:       http://$(hostname -I | awk '{print $1}'):6070/api/search"
echo "  MCP Server:      http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "Test the search API:"
echo "  curl -X POST -d '{\"Q\":\"type:repo\"}' http://localhost:6070/api/search | jq '.Result.RepoURLs'"
echo ""
echo "Logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Index updates run daily at 2:00 AM UTC"
