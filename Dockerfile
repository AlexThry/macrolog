# Single container: Node/Express serves the API AND the static frontend.
# ---------- Build stage ----------
# better-sqlite3 is a native module; build tools are needed in case no
# prebuilt binary is available for the target platform.
FROM node:22-bookworm-slim AS build
WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---------- Runtime stage ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/macrolog.db \
    JWT_SECRET=${JWT_SECRET}
WORKDIR /app

# Compiled node_modules from the build stage (incl. better-sqlite3 binding).
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY frontend ./frontend

# SQLite database lives on a volume so it survives container restarts.
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

USER node
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
