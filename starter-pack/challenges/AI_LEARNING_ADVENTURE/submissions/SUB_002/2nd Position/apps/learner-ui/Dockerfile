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
COPY apps/learner-ui/package.json ./apps/learner-ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/types ./packages/types
COPY packages/learner ./packages/learner
COPY apps/learner-ui ./apps/learner-ui

# Build learner-ui
RUN pnpm --filter @ai-learning-adventure/learner-ui build

# Production Stage
FROM nginxinc/nginx-unprivileged:alpine AS runner

COPY apps/learner-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/learner-ui/dist /usr/share/nginx/html

EXPOSE 5173

USER nginx

CMD ["nginx", "-g", "daemon off;"]
