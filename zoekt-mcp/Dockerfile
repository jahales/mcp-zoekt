# Zoekt MCP Server - Docker Image
FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Create non-root user
RUN adduser -D -u 1001 mcpuser
USER mcpuser

# Default environment
ENV ZOEKT_URL=http://zoekt-webserver:6070
ENV MCP_TRANSPORT=stdio
ENV LOG_LEVEL=info

EXPOSE 3001

ENTRYPOINT ["node", "dist/index.js"]
