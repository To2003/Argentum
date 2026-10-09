# Imagen del server de juego (Fly.io u otro host con WebSockets persistentes).
# La web es estática y va aparte (Vercel). Ver docs/deploy.md.
#
# Contexto de build: la raíz del repo →  docker build -f apps/server/Dockerfile .

# node:sqlite funciona sin flag desde Node 22.13 / 23.4; se fija la misma
# versión que en desarrollo (.nvmrc) para que el build sea reproducible.
ARG NODE_VERSION=24.13.0

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @gran-negocio/server... --ignore-scripts

COPY packages/shared packages/shared
COPY packages/engine packages/engine
COPY apps/server apps/server
RUN pnpm --filter @gran-negocio/server build

# Solo las dependencias de runtime del server, sin el workspace ni los fuentes.
RUN pnpm --filter @gran-negocio/server deploy --prod --legacy /runtime

FROM node:${NODE_VERSION}-slim AS run
WORKDIR /app
# Producción: sin rutas /dev/* (ver apps/server/src/config.ts).
ENV NODE_ENV=production

COPY --from=build /runtime/node_modules ./node_modules
COPY --from=build /app/apps/server/build ./build

# Dónde viven las partidas (seed + acciones). En Fly.io se monta un volumen
# acá (fly.toml → [mounts]); sin volumen, las partidas se pierden al reiniciar.
ENV DB_PATH=/data/gran-negocio.db
RUN mkdir -p /data
VOLUME /data

ENV PORT=3001
EXPOSE 3001

# Para `docker run` y otros hosts; Fly.io usa su propio chequeo (fly.toml).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# WEB_ORIGIN tiene que nombrar el front desplegado, o CORS rechaza el socket.
CMD ["node", "build/index.js"]
