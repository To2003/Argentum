# El Gran Negocio

Juego de tablero económico online (2–6 jugadores) ambientado en Argentina. Proyecto fan y
educativo, **sin afiliación con Hasbro** ni con las marcas o lugares mencionados.

La especificación completa está en [SPEC.md](./SPEC.md) y el estado por hito en
[PROGRESS.md](./PROGRESS.md).

## Requisitos

- Node 24 (ver `.nvmrc`; mínimo 22.13, la primera con `node:sqlite` sin flag) y pnpm 10
  (`corepack enable` alcanza).
- Funciona igual en Windows, macOS y Linux.

## Primeros pasos

```sh
pnpm install
pnpm e2e:install   # una sola vez: baja Chromium para Playwright
pnpm dev           # web en http://localhost:5173, server en http://localhost:3001
```

## Scripts

| Comando              | Qué hace                                                  |
| -------------------- | --------------------------------------------------------- |
| `pnpm dev`           | Levanta web y server en paralelo (Turborepo).             |
| `pnpm build`         | Build de producción de web (Vite) y server (tsup).        |
| `pnpm typecheck`     | `tsc --build` sobre todo el monorepo.                     |
| `pnpm lint`          | ESLint (incluye las reglas de pureza del engine).         |
| `pnpm format`        | Prettier.                                                 |
| `pnpm test`          | Vitest: engine, shared, server y web.                     |
| `pnpm test:coverage` | Igual, con cobertura (el engine exige ≥ 90 %).            |
| `pnpm e2e`           | Playwright (desktop + mobile); levanta web y server solo. |

## Estructura

```
apps/web          cliente: Vite + React + React Router + Tailwind
apps/server       server autoritativo: Express + Socket.IO
packages/engine   reglas puras y deterministas (PRNG con semilla)
packages/shared   tipos, constantes, datos del tablero y cartas, zod
packages/ui       componentes de presentación
docs/             ADRs y diagrama de la FSM del turno
e2e/              tests de Playwright
```

## Deploy

Web en Vercel y server de juego en Fly.io: guía paso a paso (pensada para Windows 10) en
[docs/deploy.md](./docs/deploy.md). Variables de entorno: [.env.example](./.env.example).

Para probar la imagen del server en local:

```sh
docker build -f apps/server/Dockerfile -t gran-negocio-server .
docker run -p 3001:3001 -v gn-data:/data -e WEB_ORIGIN=http://localhost:5173 gran-negocio-server
```
