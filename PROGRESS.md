# PROGRESS

Estado del proyecto hito por hito. Cualquier sesión nueva arranca leyendo [SPEC.md](./SPEC.md)
(incluida la §15, "Aclaraciones de reglas y decisiones") y después este archivo.

## Hitos

| Hito | Contenido                                               | Estado        |
| ---- | ------------------------------------------------------- | ------------- |
| M0   | Fundaciones: monorepo, TS strict, lint, tests, CI, docs | ✅ Completado |
| M1   | Datos: tablero, cartas, RulesConfig, zod, i18n          | ✅ Completado |
| M2   | Engine núcleo                                           | ✅ Completado |
| M3   | Engine avanzado                                         | ✅ Completado |
| M4   | Server de juego                                         | ✅ Completado |
| M5   | Cliente base                                            | ✅ Completado |
| M6   | Juice y visuales                                        | ✅ Completado |
| M7   | Subasta, comercio y construcción en la UI               | ✅ Completado |
| M8   | Bots y simulador de balance                             | ✅ Completado |
| M9   | Pulido                                                  | ⬜ Pendiente  |
| M10  | Deploy y cuentas                                        | ⬜ Pendiente  |

---

## M8 — Bots y simulador de balance ✅ (modo autónomo)

**Qué quedó hecho**: bots deterministas en tres dificultades (engine), bots en la sala (lobby
y server), simulador headless con `pnpm sim` y `docs/balance-report.md`.

**Aceptación**: Medio le gana al Fácil en el 84,3 % de 1000 partidas (test incluido).
Hallazgos y ajustes propuestos en `REVIEW.md` y en el reporte.

---

## M6 — Juice y visuales ✅ (modo autónomo)

**Qué quedó hecho**: animación secuenciada con XState (dados, saltos casilla por casilla,
carta que se da vuelta), plata que cuenta y destella, edificios que brotan, cárcel con shake,
quiebra que se desvanece, confeti; dados 3D en CSS; audio sintetizado con ajustes; 3 temas de
tablero y modo oscuro; ilustraciones SVG propias de casillas y fichas. Detalle en SPEC §15.9,
ADR 0007 y `REVIEW.md`.

**Medido**: 59,5 fps promedio con CPU 4× más lenta en Pixel 7 emulado (build de producción).
e2e de saltos y de `prefers-reduced-motion`.

---

## M7 — Subasta, comercio y construcción en la UI ✅ (modo autónomo)

Hecho antes que M6, a pedido: el juego queda jugable de punta a punta antes de pulir lo visual.

**Qué quedó hecho**: diálogos de subasta, trueque (proponer, contraofertar, aceptar con
revalidación) y administración de propiedades, con validación en vivo usando los chequeos del
engine y el motivo cuando algo no se puede; escenarios de desarrollo en el server para e2e.

**Tests**: 3 e2e nuevos (subasta, trueque con contraoferta, construcción pareja) con dos
navegadores, más 2 del server para los escenarios.

---

## M5 — Cliente base ✅ (modo autónomo)

**Qué quedó hecho**: inicio, sala por link, lobby con fichas y reglas, partida jugable de punta
a punta (tablero 11 × 11 con la geometría de §4.1, jugadores, acciones contextuales, subasta,
deuda, detalle de casilla con alquileres y construcción/hipoteca, registro de eventos, fin de
partida), reconexión al recargar, mobile-first con zoom. Decisiones en SPEC §15.7 y `REVIEW.md`.

**Verificado en navegadores reales** (Playwright, escritorio y Pixel 7): partidas completas con
capturas revisadas; se encontraron y arreglaron 2 bugs reales (diálogo en StrictMode y vista
borrada al reconectar) y la ilegibilidad de las casillas en celular.

**Tests**: 17 de la web (geometría del tablero, texto de eventos, diálogo, rutas, hot-seat) y un
e2e de dos navegadores que juega una partida entera y recarga al final.

**Cómo probarlo**: `pnpm dev` y abrir `http://localhost:5173` en dos navegadores.

---

## M4 — Server de juego ✅ (modo autónomo)

**Qué quedó hecho**: salas con código y tokens de asiento, lobby (fichas, listos, reglas del
host, arranque), intents con idempotencia y `STALE_STATE`, `PlayerView` por asiento después de
cada acción, timers (turno, subasta, trueque, partida corta) con piloto automático, reconexión
con período de gracia, rate limit, persistencia en SQLite con restauración por replay,
`USE_REAL_BRANDS` como default de la regla por sala. Detalle en SPEC §15.6 y `REVIEW.md`.

**Tests**: 26 del server, entre ellos una partida completa de 4 clientes por sockets reales
con un corte y una reconexión a mitad de partida (aceptación de M4), validación zod, rate
limit, timers con reloj simulado, restauración y la base SQLite. Más 7 del piloto automático
en el engine.

**Cómo probarlo**: `pnpm vitest run --project server`.

---

## M3 — Engine avanzado ✅ (modo autónomo)

Hecho sin consultar: cada decisión está en `REVIEW.md` y en SPEC §15.5.

**Qué quedó hecho** (`packages/engine`)

- **Subastas** (fase `auction` con `returnTo` y cola): al rechazar una compra (en
  `onPurchaseDeclined()`), en la quiebra ante el banco (una por una) y para la última casa u
  hotel del banco (escasez, entre los interesados).
- **Construcción**: grupo completo y sin hipotecas, pareja, 32 casas / 12 hoteles, hotel que
  devuelve 4 casas; venta pareja a la mitad; `sellAllBuildings` por grupo.
- **Hipotecas**: hipotecar, levantar con `mortgageLiftCost`, 10 % al recibir hipotecadas.
- **Trueques** (`state.trade`, superpuesto): proponer, contraofertar, aceptar (revalida),
  rechazar, cancelar; plata, propiedades y "Salí gratis".
- **Deuda completa**: vender, hipotecar o trocar para juntar plata y `payDebt`; quiebra ante
  jugador (con el 10 % de las hipotecadas) o ante el banco (subasta).
- **Fin de partida**: último en pie, `maxRounds` o `timeUp` (actor `system`), por
  patrimonio neto (`netWorth`) con desempate.
- `legalActions` con parámetros (casilla, grupo, puja mínima) y `actorsOf`.
- Diagrama `docs/turn-fsm.mmd` actualizado (subasta y fase libre) y validado con Mermaid.

**Tests**: 333 en total (233 del engine). Nuevos: subasta (11), construcción y escasez (21),
hipotecas y deuda (11), trueques (14), fin de partida (8). Fuzz con dos escenarios (desde cero
y partida avanzada con escasez de casas) y las invariantes nuevas: 32/12 exactos, construcción
pareja, edificios solo en grupos completos y sin hipotecas, hipotecadas sin edificios, trueque
y subasta coherentes. En 30 partidas avanzadas: 1317 construcciones, 6 subastas de la última
casa, 182 trueques aceptados.

**Cobertura del engine**: sobre el umbral del 90 % en sentencias, ramas, funciones y líneas.

**Bug encontrado por el fuzz**: cuando el jugador del turno quebraba ante el banco, la subasta
de sus propiedades se abría con él como "jugador del turno". Ahora su turno termina antes.

**Cómo probarlo**: `pnpm test`; hot-seat en `/?debug=1` con "Auto ×200".

---

## M2 — Engine núcleo ✅

**Qué quedó hecho** (`packages/engine`)

- **PRNG sfc32 con 128 bits de estado** (ADR 0006), en reemplazo de mulberry32. Seed = 32
  hex; verificado contra la implementación de referencia en 1000 salidas.
- **API**: `createGame({ seed, players, rules })` y `applyAction(state, playerId, action)`.
  Valida una sola vez (`validateAction`); una acción rechazada no clona ni consume RNG.
- **Fases** (unión discriminada + `PHASE_ACTIONS`): `waitingRoll`, `jailDecision`,
  `awaitingPurchase`, `postRoll`, `inDebt` (con `returnTo` y cola de deudores), `gameOver`.
- **Reglas**: dados, dobles y tercer doble; movimiento y Salida; compra y rechazo (con
  `onPurchaseDeclined`, `TODO(M3)` para la subasta); alquileres de propiedades (monopolio ×2,
  casas/hotel), subtes 1–4 y servicios 4×/10×; impuestos y pozo opcional; los 32 efectos de
  carta (10 tipos); cárcel por casilla, carta y tercer doble, con las 4 salidas; deuda mínima,
  quiebra ante jugador o banco, fin de partida; orden inicial por suma de 2 dados con
  desempate solo entre empatados.
- `rules/mortgage.ts`: `mortgageInterest` / `mortgageLiftCost` (10 % hacia arriba).
- `legal.ts`: `legalActions` filtra candidatos con `validateAction` (sin reglas propias).
- `view.ts`: `PlayerView` armada campo por campo; sin `rngState`, sin seed y sin el orden de
  los mazos (solo cuántas quedan); trae las acciones legales del viewer.
- **Hot-seat de debug** (`apps/web/src/debug/HotSeat.tsx`) en `/?debug=1`, solo en dev:
  seed, cantidad de jugadores, botones con las acciones legales, Auto ×10/×200, estado
  completo o `PlayerView` de cada jugador, eventos crudos y log de acciones para replay.
  El build de producción no lo incluye (verificado: el chunk no se emite).
- `docs/turn-fsm.mmd` reescrito con las fases reales (subasta y deuda como fases con
  `returnTo`, trueque como estado superpuesto). Validado renderizándolo con Mermaid.
- SPEC: §3.1 (API, RNG), §3.3 (modelo refinado), nuevas §15.3 (dinero e hipotecas) y §15.4
  (las 16 decisiones de reglas de M2 y la arquitectura del engine). ADR 0006.

**Tests**: 264 en total (170 del engine).

- Unitarios por regla: movimiento y Salida, dobles, compra, alquileres (todas las variantes),
  impuestos y pozo, cárcel (todas las vías de entrada y salida), deuda, cola de deudores,
  quiebra ante jugador y banco, fin de partida, `createGame`, validación y vista.
- Cartas: cada carta de movimiento desde las 3 casillas de Suerte (y "Avanzá a la Salida"
  desde las 3 de Barrio), verificando cuándo pasa por la Salida; las 14 de plata; cumpleaños,
  presidente del consorcio, arreglos; "Salí gratis"; "más cercano" con y sin dueño; la tirada
  `utilityCard` que no cuenta como dobles; encadenado (Retrocedé 3 → Barrio).
- `mortgageLiftCost` con los 16 valores de hipoteca del tablero.
- **Fuzz** (fast-check, 80 corridas × 400 pasos, 2–6 jugadores, con y sin pozo y ×2, plata
  inicial 500 o 1500). Invariantes después de cada paso: dinero conservado contra la
  contabilidad de los eventos (banco incluido); todo efectivo entero y ≥ 0; posiciones en
  0–39; una propiedad = un dueño activo; ≤ 32 casas / ≤ 12 hoteles; cada mazo conserva sus 16
  cartas contando las "Salí gratis" en mano; el orden de turno tiene a cada jugador una vez;
  el jugador del turno y el actor nunca están quebrados; coherencia de cada fase; siempre hay
  al menos una acción legal; toda acción legal se acepta. Además, en cada paso prueba una
  acción ilegal al azar y exige que se rechace **sin modificar el estado ni consumir RNG**.
  Explora deuda, quiebra y fin de partida (en 40 corridas: 19 deudas, 18 quiebras, 2 finales).
- **Replay**: seed + acciones reproduce el mismo estado y los mismos eventos (40 corridas).
- **Partida de bots de 200 turnos** con seed fijo (aceptación de M2): 486 acciones,
  invariantes en verde. Sin edificios los alquileres son bajos y nadie quiebra en 200 turnos.
- Tabla de transiciones contra el diagrama: mismas fases y todas las acciones nombradas.
- Web: 4 tests del hot-seat (jsdom) y un e2e que lo juega en un navegador real.

**Cobertura del engine**: 96 % de sentencias, 90,7 % de ramas en `src/` y 95,8 % en
`src/rules/`, 100 % de funciones (umbral del 90 % cumplido).

### Decisiones técnicas de M2

1. **Fuerza bruta para forzar dados en los tests** (`rigDice`): busca el `rngState` que produce
   las tiradas pedidas. El engine no tiene ningún gancho para tests.
2. **`turnOrder` guarda a todos los jugadores**, incluidos los quebrados (se saltean). Así el
   orden no se reindexa y la invariante "cada jugador exactamente una vez" es simple.
3. **`bank`, `pot` y `deck` son ids reservados** (`RESERVED_PLAYER_IDS`): `Party` es
   `PlayerId | 'bank' | 'pot'` y un jugador con esos ids rompería la contabilidad.
4. **El clon del estado es `JSON.parse(JSON.stringify())`**: el estado es JSON puro y el
   engine no tiene `structuredClone` sin tipos de DOM o Node.
5. ESLint: `argsIgnorePattern: '^_'` (parámetros de puntos de extensión) y `!` permitido en
   tests (los fixtures se arman mutando estados conocidos).
6. Los tests del engine usan `types: ["node"]` (leen el diagrama con `node:fs`); la regla de
   pureza de ESLint sigue cubriendo `src/`.

**Pendiente / deuda conocida**

- Todo lo marcado `TODO(M3)`: subasta al rechazar y en quiebra ante el banco, interés de
  hipotecadas recibidas, `payDebt` y juntar plata (vender, hipotecar) en `inDebt`.
- `validateGameData()` en el arranque del server: M4.

**Cómo probarlo**

```sh
pnpm test                              # 264 tests
pnpm vitest run --project engine       # solo el engine (~10 s)
pnpm dev                               # y abrir http://localhost:5173/?debug=1
```

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

**Verificado localmente y en un clon limpio**: typecheck, lint, format, test (98), coverage
(shared 97 % de líneas), build, el bundle del server arranca, `tsx` resuelve los JSON, e2e (4)
y la imagen de Docker responde `/health`.

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
5. **`.gitignore` tenía `data/` suelto** (heredado del patrón del SQLite) y dejaba afuera
   `packages/shared/data/`: todo pasaba en local y un clon nuevo no habría tenido el tablero.
   Ahora ignora solo `apps/server/data/`. **Desde M1, la verificación de cierre de hito corre
   sobre un clon limpio del repo** (`git clone` + `pnpm install --frozen-lockfile` + checks),
   no sobre el working tree.

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
- `packages/engine`: PRNG mulberry32, reemplazado por sfc32 en M2 (`createRng`, `nextFloat`, `nextInt`, `rollDie`,
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
