# Build stage: compile the static site. The API URL is baked in at build time.
FROM node:22.20.0-alpine3.22@sha256:dbcedd8aeab47fbc0f4dd4bffa55b7c3c729a707875968d467aaaea42d6225af AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public URL of the backend, not a secret: it ends up in the browser bundle anyway.
ARG BACKEND_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$BACKEND_URL
RUN npm run build

# Runtime stage: unprivileged nginx serving the built files.
FROM nginxinc/nginx-unprivileged:1.29.1-alpine@sha256:27985295bdb22a1ef8f712863210bd5877c0f3006494a593e86b3fe0fa55467e
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# The base image already runs unprivileged; stated here so it is explicit and checkable.
USER 101
EXPOSE 8080
# nginx only listens once its config loaded, so an open port means it is serving.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["nc", "-z", "127.0.0.1", "8080"]
