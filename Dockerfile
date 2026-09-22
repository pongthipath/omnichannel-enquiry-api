# syntax=docker/dockerfile:1.7
# One image, three roles: api (node dist/main.js) · worker (node dist/worker.js) · migrate (npm run migration:run:prod)

FROM node:22-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# ---------- dev: hot reload, used by docker-compose ----------
FROM base AS dev
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "start:dev"]

# ---------- build ----------
FROM base AS build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- prod: small, non-root ----------
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4000
# SIGTERM goes straight to node → graceful shutdown (ready=503 → drain → close)
CMD ["node", "dist/main.js"]
