# ============================================================
# Stage 1: Build
# ============================================================
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy manifests first to leverage layer cache
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including dev) for building
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Production build
RUN pnpm build

# ============================================================
# Stage 2: Production runtime
# ============================================================
FROM node:22-alpine AS runtime

# Security: run as non-root user
RUN addgroup -S openclaw && adduser -S openclaw -G openclaw

WORKDIR /app

# Copy only what's needed to run the static server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/package.json ./package.json

# Install only the Node built-in dependencies needed (no extra npm packages needed
# by bin/openclaw-office.js — it only uses node:http, node:fs, node:path, node:os)
# No production deps needed beyond Node itself.

# Switch to non-root
USER openclaw

# Default environment
ENV PORT=5180
ENV HOST=0.0.0.0
# OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN should be provided at runtime

EXPOSE 5180

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/ > /dev/null || exit 1

ENTRYPOINT ["node", "bin/openclaw-office.js"]
