# Single-image build (CLAUDE.md: Fastify serves the React SPA in production).
# Multi-stage, non-root, explicit deps (platform Container Requirements).

# ---- Build stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Prisma needs OpenSSL at generate time.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .
RUN npx --workspace @ai-fluency/api prisma generate \
  && npm run build --workspace @ai-fluency/web \
  && npm run build --workspace @ai-fluency/api

# Prune dev dependencies but keep the Prisma CLI for migrate deploy at startup.
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV STATIC_DIR=/app/apps/web/dist

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/prompts ./prompts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
