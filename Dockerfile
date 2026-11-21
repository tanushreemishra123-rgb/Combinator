# Reproducible container for the Topcoder Combinator.
# Pure-JS dependencies only — no native build step required.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# App code + production deps.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Default: serve the review UI. Mount a starter pack at /app/starter-pack and a
# writable workspace at /app/workspace. Run the CLI by overriding the command, e.g.
#   docker run --rm -v "$PWD/starter-pack:/app/starter-pack" \
#     -v "$PWD/workspace:/app/workspace" tc-combinator \
#     node dist/cli.js run-all --pack ./starter-pack --out ./workspace
ENV COMBINATOR_LLM_PROVIDER=mock \
    COMBINATOR_UI_PORT=4600 \
    COMBINATOR_PACK=/app/starter-pack \
    COMBINATOR_OUT=/app/workspace
EXPOSE 4600

# Run as the built-in unprivileged "node" user (never root).
RUN chown -R node:node /app
USER node

CMD ["node", "dist/server.js"]
