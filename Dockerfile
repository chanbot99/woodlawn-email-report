# New Homeowners Extractor Dockerfile
# Multi-stage build with Playwright support

# ============================================
# Stage 1: Build
# ============================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

WORKDIR /app

# Install Node.js (Playwright image is Ubuntu-based)
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV HEADLESS=true
ENV OUT_DIR=/app/data

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('OK')" || exit 1

# Entry point
ENTRYPOINT ["node", "dist/index.js"]

# Default command (can be overridden)
CMD ["--help"]

