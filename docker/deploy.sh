#!/bin/bash
# Deployment script for Zoekt + MCP
# This script sets up the code search infrastructure with daily index updates
#
# Required environment variables:
#   GITHUB_ORGS or GITHUB_ORG - GitHub organization(s) to index
#
# Usage: GITHUB_ORG=my-org ./deploy.sh
#    or: GITHUB_ORGS=org-a,org-b ./deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

read_dotenv_var() {
    # Reads VAR=... from .env without sourcing/eval.
    # Strips a single pair of surrounding quotes if present.
    # Usage: read_dotenv_var COMPOSE_PROFILES
    local key="$1"
    local line
    line="$(grep -E "^${key}=" .env 2>/dev/null | tail -n 1)"
    if [ -z "$line" ]; then
        return 0
    fi
    local val="${line#*=}"
    # Strip surrounding quotes
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    echo "$val"
}

# Load local env values if present (for docker-compose.yml profile mode)
# NOTE: Docker Compose reads .env automatically; we only use this for preflight checks.
if [ -f ".env" ]; then
    : "${COMPOSE_PROFILES:=$(read_dotenv_var COMPOSE_PROFILES)}"
    : "${WORKSPACE_ROOT:=$(read_dotenv_var WORKSPACE_ROOT)}"
    : "${GITHUB_ORGS:=$(read_dotenv_var GITHUB_ORGS)}"
    : "${GITHUB_ORG:=$(read_dotenv_var GITHUB_ORG)}"
fi

has_profile() {
    case ",${COMPOSE_PROFILES}," in
        *",$1,"*) return 0 ;;
        *) return 1 ;;
    esac
}

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

# -----------------------------------------------------------------
# Local docker-compose.yml mode (profile-based)
# -----------------------------------------------------------------
if [ -n "$COMPOSE_PROFILES" ]; then
    echo "Detected COMPOSE_PROFILES=$COMPOSE_PROFILES (local compose mode)"

    if has_profile "workingtree"; then
        if [ -z "$WORKSPACE_ROOT" ]; then
            echo "ERROR: WORKSPACE_ROOT is required when COMPOSE_PROFILES includes 'workingtree'"
            exit 1
        fi
    fi

    if has_profile "github"; then
        if [ -z "$GITHUB_ORGS" ] && [ -z "$GITHUB_ORG" ]; then
            echo "ERROR: Set GITHUB_ORGS or GITHUB_ORG when COMPOSE_PROFILES includes 'github'"
            exit 1
        fi

        if [ ! -f "config/github-token.txt" ]; then
            echo "ERROR: GitHub token not found at config/github-token.txt"
            echo "Create one with 'repo' scope at https://github.com/settings/tokens"
            echo "Then run: echo 'ghp_your_token' > config/github-token.txt"
            exit 1
        fi
    fi

    echo "Prerequisites OK"
    echo ""

    echo "Building Zoekt image..."
    docker build -t zoekt:local -f Dockerfile.zoekt .

    echo ""
    echo "Starting services..."
    docker compose up -d

    echo ""
    echo "=== Deployment Complete (local compose) ==="
    echo ""
    docker compose ps
    echo ""
    echo "Endpoints:"
    echo "  Zoekt Web UI:    http://localhost:6070"
    echo "  Zoekt API:       http://localhost:6070/api/search"
    echo ""
    echo "Logs:"
    echo "  docker compose logs -f"
    echo ""
    echo "NOTE: MCP server is not started by docker-compose.yml; run it from ../zoekt-mcp (see docker/README.md)"
    exit 0
fi

# -----------------------------------------------------------------
# Production docker-compose.prod.yml workflow (legacy)
# -----------------------------------------------------------------

if [ -z "$GITHUB_ORG" ] && [ -z "$GITHUB_ORGS" ]; then
    echo "ERROR: Set GITHUB_ORGS or GITHUB_ORG environment variable"
    echo "Usage: GITHUB_ORG=my-org ./deploy.sh"
    echo "   or: GITHUB_ORGS=org-a,org-b ./deploy.sh"
    exit 1
fi

# Backward-compatible: production workflow expects a single org.
# If only GITHUB_ORGS is set, use the first entry for GITHUB_ORG.
if [ -z "$GITHUB_ORG" ] && [ -n "$GITHUB_ORGS" ]; then
    GITHUB_ORG="$(echo "$GITHUB_ORGS" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | head -n 1)"
fi

export GITHUB_ORG
export GITHUB_ORGS

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
