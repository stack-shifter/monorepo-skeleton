# Multi-stage build for App Runner / ECS

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/

RUN npm ci --workspace=@repo/api --include-workspace-root

# Copy source
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY api/ ./api/

# Build shared first, then api
RUN npm run build -w @repo/shared
RUN npm run build -w @repo/api

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed to run
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/api/dist ./api/dist

EXPOSE 3000

# App Runner expects the process to listen on $PORT
CMD ["node", "api/dist/index.js"]
