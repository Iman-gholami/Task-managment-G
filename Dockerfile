# Build the online release image once; run it unchanged on the air-gapped host.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ARG GIT_REV=unknown
LABEL org.opencontainers.image.revision=$GIT_REV
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/sentinel.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Keep the service's existing user/UID setting, if one is configured in Compose.
# The image runs as root by default to remain compatible with existing bind
# mounts (which may be root-owned); hardening permissions is a separate migration.
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server.js"]
