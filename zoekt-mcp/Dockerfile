# Zoekt MCP Server - Docker Image
# Installs the published @jahales/mcp-zoekt release from npm rather than building
# from the working tree, so the image is pinned to a known release.

FROM node:22-alpine AS release

# Published package version to install. Override at build time:
#   docker build --build-arg MCP_VERSION=2.3.1 ...
ARG MCP_VERSION=2.3.0

# curl for the container healthcheck
RUN apk add --no-cache curl

# Install the MCP server globally from npm. Runs as root before dropping
# privileges so the global bin is owned correctly.
RUN npm install -g @jahales/mcp-zoekt@${MCP_VERSION}

# Create non-root user for security
RUN adduser -D -u 1001 mcpuser
USER mcpuser

# Default environment
ENV NODE_ENV=production
ENV ZOEKT_URL=http://zoekt-webserver:6070
ENV MCP_TRANSPORT=stdio
ENV LOG_LEVEL=info

# HTTP transport port
EXPOSE 3001

# `mcp-zoekt` is the package's bin (installed on PATH by npm install -g).
ENTRYPOINT ["mcp-zoekt"]
