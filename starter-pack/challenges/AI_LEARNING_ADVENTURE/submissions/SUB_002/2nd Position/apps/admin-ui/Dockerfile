# Build Stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
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
COPY apps/admin-ui/package.json ./apps/admin-ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/types ./packages/types
COPY apps/admin-ui ./apps/admin-ui

# Set non-secret build-time configuration for the Next.js build
ARG UPSTREAM_ORIGIN=http://api:4000
ENV UPSTREAM_API_ORIGIN=${UPSTREAM_ORIGIN}
ARG NEXT_PUBLIC_LEARNER_URL=http://localhost:5173
ENV NEXT_PUBLIC_LEARNER_URL=${NEXT_PUBLIC_LEARNER_URL}

# Build admin-ui
RUN pnpm --filter @ai-learning-adventure/admin-ui build

# Production Stage
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

# Copy full built workspace from builder
COPY --from=builder --chown=node:node /app /app

WORKDIR /app/apps/admin-ui

ENV NODE_ENV=production
ENV PORT=6173
ENV HOSTNAME=0.0.0.0
ENV UPSTREAM_API_ORIGIN=http://api:4000
ENV NEXT_PUBLIC_LEARNER_URL=http://localhost:5173

EXPOSE 6173

USER node

CMD ["pnpm", "start"]
