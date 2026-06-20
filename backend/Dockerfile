# ---------- Build stage ----------
# better-sqlite3 is a native module; build tools are needed in case no
# prebuilt binary is available for the target platform.
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Runtime stage ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/macrolog.db
WORKDIR /app

# Compiled node_modules from the build stage (incl. better-sqlite3 binding).
COPY --from=build /app/node_modules ./node_modules
COPY . .

# SQLite database lives on a volume so it survives container restarts.
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

USER node
EXPOSE 3000

CMD ["node", "server.js"]
