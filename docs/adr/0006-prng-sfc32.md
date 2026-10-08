# 0006 — PRNG sfc32 con 128 bits de estado

- **Estado:** aceptada (M2). Reemplaza la elección de algoritmo de la ADR 0003.
- **Fecha:** 2026-10-08

## Contexto

La ADR 0003 eligió mulberry32. Su estado es un solo entero de 32 bits: con unas pocas tiradas
observadas (públicas) se recupera por fuerza bruta en segundos, y desde ahí se predicen todos
los dados y se reconstruye el orden de los mazos. Ocultar el `rngState` en la `PlayerView` no
alcanza si el estado se puede deducir.

## Decisión

- **sfc32** (Small Fast Counting, de PractRand): 4 palabras de 32 bits = **128 bits de
  estado**, una de ellas un contador que garantiza período ≥ 2³².
- El server siembra con **128 bits de `crypto`** (`Seed` = 32 caracteres hex). `createRng`
  descarta 15 rondas para mezclar seeds con estructura.
- El estado sigue en `GameState.rngState` (`[a, b, c, d]`, uint32) y se oculta en la
  `PlayerView`, igual que el seed y el orden de los mazos.
- Un test compara 1000 salidas contra la implementación de referencia de sfc32, y un snapshot
  fija la secuencia de un seed conocido: si cambia, se rompen los replays guardados.

## Alternativas

- **xoshiro128\*\***: también 128 bits y buena calidad; sfc32 es igual de chico y no tiene
  estados débiles conocidos con seeds bajos (el contador evita el estado todo-cero).
- **Entropía fresca por tirada** (no implementada, queda como opción para un juego público
  con plata real o ranking): el server genera bytes con `crypto` en cada acción que tira
  dados, los pasa al engine dentro de la acción y los guarda en el log. El replay sigue siendo
  exacto (las tiradas están en el log) y ya no hay estado que deducir.

## Consecuencias

- sfc32 **no es criptográfico**: no está demostrado que recuperar su estado desde las salidas
  sea inviable, solo que no es trivial (128 bits contra fuerza bruta, y cada dado revela
  ~2,6 bits). Para un juego entre amigos alcanza; para uno público, ver la alternativa.
- Las partidas guardadas con mulberry32 dejan de reproducirse (no había ninguna: el server de
  juego es M4).
