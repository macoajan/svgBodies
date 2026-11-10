# PROVISIONAL — imagen del servidor de pautas para Coolify.
# Se construye desde la RAÍZ del repositorio (necesita library/ para el visor):
#   docker build -f server/Dockerfile -t pautas-server .
# En Coolify: Base Directory «/», Dockerfile Location «/server/Dockerfile», puerto 3000,
# volumen persistente en /data.
FROM node:22-alpine

WORKDIR /app
COPY server/package.json server/README.md ./server/
COPY server/src ./server/src
COPY server/public ./server/public
COPY library/catalog.json ./library/catalog.json
COPY library/svg ./library/svg

RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/server

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    LIBRARY_DIR=/app/library \
    PUBLIC_URL=https://maroto.es

VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.mjs"]
