# Build Stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native build dependencies required by node-gyp for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

# Copy workspace configuration files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/learner/package.json ./packages/learner/
COPY apps/api/package.json ./apps/api/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source code for types and api
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Production Runner Stage
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Copy installed workspace and dependencies from builder
COPY --from=builder --chown=node:node /app /app

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=4000

EXPOSE 4000

USER node

CMD ["node", "src/server.ts"]
