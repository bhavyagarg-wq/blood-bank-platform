# Single image serving the API and the built frontend from one origin.
# Used for single-service hosts such as Render; docker-compose still runs the
# backend and an nginx frontend as separate containers.

FROM node:20-alpine AS frontend

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src
RUN npm run build

FROM node:20-alpine

# Prisma's engines need OpenSSL to detect the right musl binary target.
RUN apk add --no-cache openssl

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

COPY --from=frontend /app/frontend/dist ./public
ENV STATIC_DIR=/app/public

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
