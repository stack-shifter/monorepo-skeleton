# Multi-stage build for Next.js on ECS Fargate

FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY ui/package.json ./ui/

RUN npm ci --workspace=@repo/ui --include-workspace-root

COPY ui/ ./ui/

RUN npm run build -w @repo/ui

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/ui/.next/standalone ./
COPY --from=builder /app/ui/.next/static ./ui/.next/static
COPY --from=builder /app/ui/public ./ui/public

EXPOSE 3000

CMD ["node", "ui/server.js"]
