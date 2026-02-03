# Zoekt MCP Server - Docker Image
# Multi-stage build for minimal production image

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source and build
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:22-alpine AS release

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy built application and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --omit=dev --ignore-scripts

# Create non-root user for security
RUN adduser -D -u 1001 mcpuser
USER mcpuser

# Default environment
ENV ZOEKT_URL=http://zoekt-webserver:6070
ENV MCP_TRANSPORT=stdio
ENV LOG_LEVEL=info

# HTTP transport port
EXPOSE 3001

ENTRYPOINT ["node", "dist/index.js"]
