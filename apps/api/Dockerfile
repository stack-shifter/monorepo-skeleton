# Multi-stage build for App Runner / ECS

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/core/package.json ./packages/core/
COPY packages/services/package.json ./packages/services/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=@repo/api --include-workspace-root

# Copy source
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build all packages in dependency order
RUN npm run build -w @repo/db
RUN npm run build -w @repo/core
RUN npm run build -w @repo/services
RUN npm run build -w @repo/api

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed to run
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/services/dist ./packages/services/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

# App Runner expects the process to listen on $PORT
CMD ["node", "apps/api/dist/index.js"]
