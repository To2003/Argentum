# 0003 — Engine puro y RNG con semilla

- **Estado:** aceptada (M0)
- **Fecha:** 2026-10-07

## Contexto

El SPEC pide determinismo (mismo seed + mismas acciones = mismo estado), replays y que el
cliente nunca decida resultados. La versión original también pedía `crypto.randomInt` directo
para los dados, lo que es incompatible con reconstruir la partida desde el seed.

## Decisión

- `reduce(state, action) → { state, events }` puro.
- El server genera el **seed con `crypto`** al crear la partida. El engine usa **mulberry32**
  (`packages/engine/src/rng.ts`) y su estado vive en **`GameState.rngState`**: cada tirada
  recibe el estado y devuelve el siguiente. **Dados y barajado de mazos salen del mismo PRNG.**
- Persistencia de una partida: `seed + acciones[]`. Un test de replay lo garantiza.
- `rngState`, el seed y el orden de los mazos **nunca** salen del server: el cliente recibe una
  `PlayerView` filtrada.
- La pureza se hace cumplir con ESLint en `packages/engine/src` y `packages/shared/src`
  (sin `Math.random`, `Date`, `performance`, `crypto`, `process`, `fetch`, `console`, timers
  ni imports de Node). Verificado con un archivo sonda.
- Un snapshot test fija la secuencia del seed 42: si cambia, se rompieron los replays guardados.

## Consecuencias

- mulberry32 no es criptográfico: con el `rngState` se predice todo. Por eso no sale del server.
- Cambiar de PRNG invalida las partidas guardadas.
