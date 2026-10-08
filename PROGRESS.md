# PROGRESS

Estado del proyecto hito por hito. Cualquier sesión nueva arranca leyendo [SPEC.md](./SPEC.md)
(incluida la §15, "Aclaraciones de reglas y decisiones") y después este archivo.

## Hitos

| Hito | Contenido                                               | Estado        |
| ---- | ------------------------------------------------------- | ------------- |
| M0   | Fundaciones: monorepo, TS strict, lint, tests, CI, docs | ✅ Completado |
| M1   | Datos: tablero, cartas, RulesConfig, zod, i18n          | ✅ Completado |
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

## M1 — Datos ✅

**Qué quedó hecho** (todo en `packages/shared`)

- `data/board.json`: las 40 casillas con los valores clásicos (§4.2–4.3). Cada una tiene `id`
  estable en camelCase, `nameKey` de i18n y, las de marca (Edenor, AySA), `brand: true`.
- `data/cards.json`: Suerte y Barrio, 16 cartas cada uno, con `id`, `textKey` y `effect`
  tipado (`moveTo`, `moveToNearest` utility/subway, `moveRelative`, `gain`, `pay`,
  `gainFromEach`, `payEach`, `repairs`, `goToJail`, `jailFreeCard`).
- `src/schemas/{board,cards,rules}.ts`: esquemas zod estrictos (rechazan campos desconocidos).
  Uniones discriminadas por `kind` y por `effect.type` (con `target` anidado para
  `moveToNearest`). Chequean orden de índices, ids únicos y mazos de 16.
- `src/board.ts` / `src/cards.ts`: `BOARD`, `DECKS`, tipos inferidos (`Tile`, `PropertyTile`,
  `OwnableTile`, `Card`, `CardEffect`…) y helpers (`tileAt`, `GROUP_TILES`, `SUBWAY_TILES`,
  `UTILITY_TILES`, `isOwnable`, `cardById`).
- `src/rules.ts`: `DEFAULT_RULES` (congelado) y `resolveRules(overrides, base)`, que valida
  el resultado entero.
- `src/validate.ts`: `validateGameData()` para el arranque del server (M4).
- `src/constants.ts`: índices fijos (Salida, Cárcel, Vas preso), 32 casas / 12 hoteles,
  `COLOR_GROUPS`, porcentajes de interés de hipoteca y reventa.
- `src/i18n/`: diccionario propio tipado (ADR 0005) en es-AR y en, con nombres de casillas,
  bajadas, nombres genéricos, textos de cartas, grupos, mazos, etiquetas de reglas y la UI que
  ya existía. `createTranslator(locale)` con `t`, `translate`, `money`, `number`, `tileName`,
  `tileDetail`, `groupName` y `cardText`.
- `apps/web` usa el traductor de shared; se borró el diccionario provisorio de M0.
- CI: matriz `ubuntu-latest` + `windows-latest` en los jobs de checks y de e2e.

**Tests** (84 nuevos; 98 en total)

- Tablero: 40 casillas en orden; 22 propiedades, 4 subtes, 2 servicios, 2 impuestos, 3 + 3
  casillas de carta y las 4 esquinas en su lugar; las 22 propiedades contra una tabla
  transcripta a mano del SPEC; hipoteca = 50 %; grupos de 2/3 con el mismo costo de casa;
  precio no decreciente; solo Edenor y AySA son marcas; snapshot.
- Cartas: 16 + 16 contra tablas transcriptas del SPEC; las 2 copias del subte comparten
  texto; una "Salí gratis" por mazo; snapshot.
- Esquemas: rechazan tableros incompletos o desordenados, ids repetidos, campos extra,
  alquileres cortos, mazos de 15, cartas del otro mazo, `steps: 0` y efectos cruzados.
- Reglas: defaults de §5.9, overrides, base del server, rangos inválidos.
- i18n: **es-AR y en tienen exactamente las mismas claves**, con los mismos parámetros y la
  misma forma (plural o no); ningún texto vacío; toda casilla tiene nombre y **toda casilla con
  `brand: true` tiene nombre genérico en los dos idiomas**; solo las marcas tienen genérico;
  toda carta renderiza sin `{param}` sin completar; todo grupo y toda regla tiene etiqueta;
  plata, plurales y genéricos con valores concretos.
- **Chequeo de tipos**: `@ts-expect-error` sobre clave inexistente, parámetro faltante o mal
  nombrado, `count` no numérico y parámetros de más. Verificado a mano que borrar o agregar
  una clave en `en.ts` no compila.

**Verificado localmente**: typecheck, lint, format, test (98), coverage (shared 97 % de
líneas), build, el bundle del server arranca, `tsx` resuelve los JSON y e2e (4).

### Decisiones técnicas de M1

1. **Los datos no se parsean con zod al cargar el módulo.** Hacerlo subía el JS de la web de
   82 a 115 kB gzip. Ahora se validan en tests y en el arranque del server; el cliente usa un
   cast documentado. `COLOR_GROUPS` vive en `constants.ts` para que importar los datos no
   arrastre zod, y `shared` está marcado `sideEffects: false`. Web: 86,5 kB gzip y zod ausente
   del bundle (verificado).
2. **`with { type: 'json' }`** en los imports de JSON: lo exige Node ESM y lo entienden Vite,
   Vitest, tsx y tsup.
3. **Claves de casilla**: `tile.<id>` (nombre), `tile.<id>.detail` (bajada opcional),
   `tile.<id>.generic` (solo marcas). Las casillas de Suerte/Barrio comparten `tile.chance` /
   `tile.community`.
4. Agregados a `RulesConfig`: `auctionBidSeconds` y `maxRounds` (ver SPEC §15.2).

**Pendiente / deuda conocida**

- El CI con Windows nunca corrió (no hay repo). Pendiente que confirmes `pnpm install` +
  `pnpm test` en tu Windows 10.
- `resolveRules` usa zod: si el cliente lo importa (formulario de reglas del lobby, M5), zod
  vuelve al bundle. Se evalúa ahí; probablemente alcance con validar en el server.
- El mazo de eventos argentinos queda para M8.

**Cómo probarlo**

```sh
pnpm install
pnpm test                                  # 98 tests
pnpm vitest run --project shared           # solo los datos e i18n
```

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
