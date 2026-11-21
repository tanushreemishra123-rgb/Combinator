FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Run as the image's built-in non-root `node` user (uid 1000). /app/node_modules
# and Vite's cache dir are chowned here so the anonymous volume Compose mounts
# over node_modules inherits that ownership.
RUN mkdir -p /app/node_modules/.vite && chown -R node:node /app

USER node

EXPOSE 5173

# Vite's dev server, probed with node's own global fetch so the image needs no
# extra HTTP client. Plain HTTP is correct here: the probe only ever talks to the
# container's loopback interface, and that traffic never leaves the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:5173/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
