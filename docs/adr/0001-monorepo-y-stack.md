# 0001 — Monorepo y stack

- **Estado:** aceptada (M0)
- **Fecha:** 2026-10-07

## Contexto

El SPEC pide un engine puro testeable en aislamiento, un server autoritativo y un cliente web,
compartiendo tipos y datos. El dueño del proyecto ya maneja un stack equivalente en Tierra
Austral y desarrolla en Windows 10.

## Decisión

- **pnpm workspaces + Turborepo** (`turbo run build/dev`). `typecheck`, `lint` y `test` corren
  una sola vez desde la raíz (`tsc --build` con project references, ESLint flat config,
  Vitest `projects`), que es más rápido que una tarea por paquete.
- Paquetes: `packages/shared` (tipos, datos, zod), `packages/engine` (reglas), `packages/ui`
  (componentes), `apps/server`, `apps/web`.
- **Los paquetes internos se consumen por source** (`exports` → `./src/index.ts`): no hay paso
  de build en dev. El server se empaqueta con **tsup** (los paquetes del workspace quedan
  adentro del bundle); la web, con **Vite**.
- **Web: Vite + React 19 + React Router (modo declarativo) + Tailwind v4**, en vez de Next.js.
  Es una SPA con estado en tiempo real por socket: SSR no aporta y suma complejidad de deploy.
- **TypeScript 6.0** (no 7): `typescript-eslint` todavía exige `< 6.1`.
- Versiones al cierre de M0: Vite 8, Vitest 5, ESLint 10, React Router 8, Playwright 1.63.
- Calidad: Prettier, Husky + lint-staged (pre-commit) y commitlint (mensajes convencionales).
- Multiplataforma: todo script es un comando de Node/pnpm (sin bash), `.gitattributes` fuerza
  LF y `.editorconfig`/Prettier también.

## Consecuencias

- Los paquetes internos no se pueden publicar tal cual (no hace falta).
- Cualquier dependencia nueva del server con paquete real en `node_modules` va como `external`
  en `tsup.config.ts`.
- pnpm 10 no corre scripts de instalación salvo los listados en `onlyBuiltDependencies`
  (`pnpm-workspace.yaml`); hoy solo `esbuild`.
