# PROGRESS

Estado del proyecto hito por hito. Cualquier sesión nueva arranca leyendo [SPEC.md](./SPEC.md)
(incluida la §15, "Aclaraciones de reglas y decisiones") y después este archivo.

## Hitos

| Hito | Contenido                                               | Estado        |
| ---- | ------------------------------------------------------- | ------------- |
| M0   | Fundaciones: monorepo, TS strict, lint, tests, CI, docs | ✅ Completado |
| M1   | Datos: tablero, cartas, RulesConfig, zod, i18n          | ⬜ Pendiente  |
| M2   | Engine núcleo                                           | ⬜ Pendiente  |
| M3   | Engine avanzado                                         | ⬜ Pendiente  |
| M4   | Server de juego                                         | ⬜ Pendiente  |
| M5   | Cliente base                                            | ⬜ Pendiente  |
| M6   | Juice y visuales                                        | ⬜ Pendiente  |
| M7   | Subasta, comercio y construcción en la UI               | ⬜ Pendiente  |
| M8   | Bots y simulador de balance                             | ⬜ Pendiente  |
| M9   | Pulido                                                  | ⬜ Pendiente  |
| M10  | Deploy y cuentas                                        | ⬜ Pendiente  |

---

## M0 — Fundaciones ✅

**Qué quedó hecho**

- Workspace pnpm + Turborepo: `packages/{shared,engine,ui}`, `apps/{server,web}`, `e2e/`.
- TypeScript 6 strict (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) con project
  references: `pnpm typecheck` es un solo `tsc --build`. La salida va a `.tsbuild/` (ignorada).
- ESLint 10 flat config con `typescript-eslint` type-checked, Prettier, Husky + lint-staged
  (pre-commit) y commitlint (commit-msg).
- **Reglas de pureza** en `packages/engine/src` y `packages/shared/src`: sin `Math.random`,
  `Date`, `performance`, `crypto`, `process`, `fetch`, `console`, `setTimeout`/`setInterval` ni
  imports `node:*`/`fs`/`path`/`crypto`/`os`/`child_process`. **Verificado con un archivo
  sonda**: dispararon las 7 categorías (11 errores de las reglas de pureza).
- `packages/engine`: PRNG mulberry32 (`createRng`, `nextFloat`, `nextInt`, `rollDie`,
  `rollDice`, `shuffle`) con tests de determinismo y property-based (fast-check) y un
  snapshot de la secuencia del seed 42 que protege los replays.
- `packages/shared`: constantes base (`TILE_COUNT`, `MIN/MAX_PLAYERS`, `PROTOCOL_VERSION`).
- `packages/ui`: componente `Panel` (placeholder hasta M5).
- `apps/server`: Express 5 + Socket.IO con `/health` y eco `ping` tipado; `createGameServer()`
  separado de `index.ts` para testear en puerto libre; bundle tsup; Dockerfile multi-stage.
- `apps/web`: Vite 8 + React 19 + React Router 8 (declarativo) + Tailwind 4. Rutas `/`,
  `/sala/:code` y 404. Textos por un diccionario es-AR mínimo (se reemplaza en M1).
- Vitest 5 con `projects` (shared, engine, server, web/jsdom) y cobertura v8 con **umbral 90 %
  sobre el engine** ya activo.
- Playwright con proyectos desktop y mobile (Pixel 7); levanta server y web solo.
- CI de GitHub Actions: typecheck → lint → format:check → test:coverage → build, y un job e2e.
- `.vscode/extensions.json` (las 10 del SPEC) y `settings.json`.
- Docs: ADRs 0001–0004, `docs/turn-fsm.mmd` (validado renderizándolo con Mermaid 11),
  `docs/reglas.md` (stub), README, `.env.example`.
- SPEC actualizado: stack (§2), RNG y concurrencia (§3.1), modelo (§3.3), FSM (§3.4), M10 y
  nueva §15 de aclaraciones.

**Verificado localmente** (Linux; el CI no corrió porque todavía no hay repo remoto)

- `pnpm install` limpio, sin avisos de build scripts ignorados.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: limpios.
- `pnpm test`: 4 archivos, 14 tests. `pnpm test:coverage`: umbral del engine cumplido.
- `pnpm build`: web (82 kB gzip de JS) y server (bundle de 1.7 kB).
- El bundle del server arranca solo con `node apps/server/build/index.js` y responde `/health`.
- `pnpm e2e`: 4 tests (2 × desktop/mobile).
- `docker build` + `docker run`: la imagen responde `/health`.

### Decisiones técnicas de M0

1. **TypeScript 6.0.3, no 7.** `typescript-eslint` 8.71 exige `typescript < 6.1`. Se revisa
   cuando lo soporte.
2. **pnpm 10 y build scripts**: pnpm 10 bloquea los `postinstall` de dependencias. Solo
   `esbuild` (lo usan tsx y tsup) está habilitado en `onlyBuiltDependencies`
   (`pnpm-workspace.yaml`). Si un `pnpm install` avisa "Ignored build scripts: X", hay que
   decidir si se agrega X a la lista (no correr `pnpm approve-builds` a ciegas).
3. **Typecheck, lint y test corren una vez desde la raíz**, no por paquete vía Turbo: es más
   rápido y da un solo reporte. Turbo orquesta `build` y `dev`.
4. **`emitDeclarationOnly` + `outDir` en `.tsbuild/`**: `tsc --build` con `composite` tiene que
   emitir algo; así no ensucia los paquetes ni el linter los levanta.
5. **Storybook queda para M5**, cuando haya componentes reales.
6. **Coverage**: el umbral del 90 % aplica solo a `packages/engine/src/**`.

**Pendiente / deuda conocida**

- El CI nunca corrió en GitHub (falta el repo). Comandos idénticos verificados localmente.
- No se probó en Windows: los scripts no usan nada de shell salvo los hooks de Husky, que Git
  for Windows corre con su `sh`.
- `reduce`, `GameState` y la tabla de transiciones arrancan en M2 (no tiene sentido un reducer
  sin reglas).

**Cómo probarlo**

```sh
pnpm install && pnpm e2e:install
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
pnpm dev   # http://localhost:5173 y http://localhost:3001/health
```
