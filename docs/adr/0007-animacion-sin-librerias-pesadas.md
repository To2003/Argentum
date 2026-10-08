# 0007 — Animación, dados y audio sin librerías pesadas

- **Estado:** aceptada (M6, modo autónomo; ver REVIEW.md)
- **Fecha:** 2026-10-08

## Contexto

El SPEC sugería Framer Motion, React Three Fiber + Rapier para dados 3D con física y
Howler.js para audio, "usados con criterio, sin inflar el bundle", con objetivos de 60 fps en
un celular de gama media y carga inicial < 3 s en 4G.

## Decisión

| Necesidad                                                         | Elegido                                                                   | Descartado                    | Costo evitado (aprox., gzip)                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| Secuenciar animaciones (dados → saltos → carta)                   | **XState v5** en el cliente (ya aprobado en ADR 0004)                     | —                             | — (XState: ~15 kB, solo en el chunk de la sala) |
| Saltos de ficha, flip de carta, conteo de plata, edificios, shake | **CSS** (`@keyframes`, transiciones)                                      | Framer Motion                 | ~35 kB                                          |
| Dados 3D                                                          | **Cubos 3D con transformaciones CSS** que caen en el resultado del server | R3F + three + Rapier          | ~200 kB de JS + ~1,5 MB de wasm                 |
| Audio                                                             | **Web Audio API**, sonidos sintetizados en código                         | Howler.js + archivos de audio | ~10 kB + los archivos (y sus licencias)         |
| Confeti de victoria                                               | **canvas-confetti** (cargado solo al terminar)                            | —                             | — (~3 kB)                                       |

- Los dados en CSS 3D no necesitan WebGL, así que el "fallback sin WebGL" es el mismo
  componente; con `prefers-reduced-motion` se muestran quietos (2D).
- No hay física simulada: los dados "ruedan" con una animación que termina mostrando la cara
  que decidió el server (el cliente nunca decide resultados, SPEC §3.1).

## Consecuencias

- Sin rebotes físicos reales en los dados. Si se quisiera, R3F + Rapier se puede enchufar
  después detrás de `import()` dinámico, con este componente como fallback.
- El audio es sintético: suena "de juego", no realista. Cambiarlo por archivos es reemplazar
  `apps/web/src/audio/`.
