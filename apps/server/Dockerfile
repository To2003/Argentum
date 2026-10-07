# Imagen del server. La web se buildea aparte (es estática).
# Contexto de build: la raíz del repo →  docker build -f apps/server/Dockerfile .

FROM node:24-slim AS build
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

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /runtime/node_modules ./node_modules
COPY --from=build /app/apps/server/build ./build

ENV PORT=3001
EXPOSE 3001
# WEB_ORIGIN tiene que nombrar el front desplegado, o CORS rechaza el socket.
CMD ["node", "build/index.js"]
